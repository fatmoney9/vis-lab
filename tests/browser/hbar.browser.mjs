/*
 * [HBAR-10..17] 横向条竞赛形态的浏览器合同。
 *
 * 纯逻辑那半（排序 / Top-N / 名次插值）已由 tests/hbar.test.mjs 覆盖；
 * 这里补的是它覆盖不到的那一半：L2 把模型翻译成 DOM 时有没有接错线。
 *
 * ⚠️ 两条踩过的坑写在断言旁边，别再踩：
 *   ① 「正在补间」不能看行 y 是不是小数——**静态布局下 y 本来就是小数**，那是空转检查。
 *      要用两个时刻的指纹差。
 *   ② 「暂停 = 把当前这一期播完再停」（HBAR-16，2026-10-08 由原「冻结当前帧」改成这样）
 *      要证两件事：**停下来之后不再动**，且**停的位置正是该期终态**。
 *      只证「不再动」是不够的——冻结在半路同样不动；必须拿该期终态逐字符比对。
 *   指纹必须**聚合全体行并排序**：DOM 顺序不等于名次顺序，跨帧比「第一根条」会比到不同的行上。
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LOOPBACK, sleep, chromeBinary, createStaticServer, listen, freePort,
  waitForJson, openCdp, evaluate, waitFor, stopProcess,
} from './harness.mjs';

const server = createStaticServer();
const port = await listen(server);
const dir = await mkdtemp(join(tmpdir(), 'race-'));
const dp = await freePort();
const chrome = spawn(await chromeBinary(), ['--headless=new', `--remote-debugging-port=${dp}`,
  `--user-data-dir=${dir}`, '--no-first-run', '--window-size=1400,1000'], { stdio: 'ignore' });
let bad = 0;
const ck = (ok, m) => { if (!ok) { console.error('  ✗', m); bad += 1; } };

try {
  await waitForJson(`http://${LOOPBACK}:${dp}/json/version`, 20000);
  const pg = await fetch(`http://${LOOPBACK}:${dp}/json/new`, { method: 'PUT' }).then((r) => r.json());
  const cdp = await openCdp(pg.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: `http://${LOOPBACK}:${port}/index.html#market-cap-race` });
  await waitFor(cdp, `document.querySelectorAll('.dv-hbar__row').length > 0`, 25000);
  await sleep(1500);

  /* 几何指纹：**聚合全体行**并排序。DOM 顺序不等于名次顺序，跨帧比「第一根条」会比到不同的行上。 */
  const fingerprint = () => evaluate(cdp, `[...document.querySelectorAll('.dv-hbar__row')]
    .map((g) => g.getAttribute('transform') + '~' + (g.querySelector('path')?.getAttribute('d') ?? ''))
    .sort().join('|')`);
  const order = () => evaluate(cdp, `[...document.querySelectorAll('.dv-hbar__row')]
    .map((g) => ({ k: g.__data__?.key, y: +(/translate\\(0,([-\\d.]+)\\)/.exec(g.getAttribute('transform'))?.[1] ?? 0) }))
    .sort((a, b) => a.y - b.y).map((r) => r.k)`);
  const click = (s) => evaluate(cdp, `(() => { const n = document.querySelector(${JSON.stringify(s)}); if (!n) return false; n.click(); return true; })()`);
  const playing = () => evaluate(cdp, `document.querySelector('.chart-playback__primary').classList.contains('is-playing')`);

  const first = await order();
  ck(first.length >= 5 && first.every(Boolean), 'keyed join 生效：每行都绑到了实体 key');

  await click('.chart-playback__primary');
  await sleep(250);
  ck(await playing(), '点播放后进入并保持播放态');

  /* 「正在补间」必须用**两个时刻的差**来证：静态布局下行 y 本来就是小数，看小数是空转的。 */
  const t1 = await fingerprint();
  await sleep(180);
  const t2 = await fingerprint();
  ck(t1 !== t2, '补间过程中几何确实在连续变化');

  /* [HBAR-16] 暂停 = **把当前这一期播完再停**，不冻结在半路。
     打在动画中途按下（起播后 200ms），然后给足剩余补间时长让它自己收尾。 */
  await click('.chart-playback__primary');
  await sleep(200);
  ck(!(await playing()), '按下暂停即退出播放态（控件立刻回显，不等动画）');
  await sleep(1400);                                   /* > 一期补间时长，留足收尾 */

  const restIndex = await evaluate(cdp, `+document.querySelector('.chart-playback__range').value`);
  const rest1 = await fingerprint();
  await sleep(700);
  const rest2 = await fingerprint();
  ck(rest1 === rest2 && !!rest1, '收尾后不再变化：间隔 700ms 两次指纹相同');

  /* 关键一条：停下来的位置必须**正是该期终态**。
     终态由「再跳一次同一期并等它跑完」独立取得，逐字符比对——
     只断言「不再动」是验不到「冻在半路然后不动」的。 */
  await click(`.chart-playback__tick[data-period-index="${Math.max(0, restIndex - 1)}"]`);
  await sleep(1500);
  await click(`.chart-playback__tick[data-period-index="${restIndex}"]`);
  await sleep(1800);
  const settled = await fingerprint();
  ck(settled === rest1, `停住的那一帧 === 第 ${restIndex} 期的终态（不是半路冻结）`);

  /* 暂停不得顺带再推一期：停在按下时正在走的那一期上 */
  const afterIdle = await evaluate(cdp, `+document.querySelector('.chart-playback__range').value`);
  ck(afterIdle === restIndex, '暂停后期序不再自行推进');

  await click('.chart-playback__tick[data-period-index="23"]');
  await sleep(1800);
  const last = await order();
  ck(JSON.stringify(last) !== JSON.stringify(first), '末期名次与首期不同——名次真的互换了');
  ck(new Set(last).size === last.length, '末期无重复实体');

  /* ── Ainvest 主题：图表内容必须是英文，**播放全程都是** ────────────────
     hooks/lint-ainvest-english.mjs 查的是「词表翻不翻得出来」，查不到这一条：
     翻译只发生在 buildConfig 里，**哪条路径手拼 cfg，翻译就在那条路径上失效**，
     而数据本身仍然是可翻译的、那个守卫照样全绿。
     2026-09-20 首页播放的 applyPeriod 就是这么绕过去的，症状是
     「静止时是 Banking，一点播放就变回银行」。只有渲染层能回答这件事。 */
  const CJK = /[\u4e00-\u9fff]/;
  const rowNames = () => evaluate(cdp, `[...document.querySelectorAll('.dv-hbar__name')].map((n) => n.textContent)`);

  await click('[data-segment="theme"] [data-value="ainvest"]');
  await sleep(2000);
  const idleNames = await rowNames();
  ck(idleNames.length > 0 && !idleNames.some((n) => CJK.test(n)),
     `Ainvest 静止态行名为英文（实测 ${JSON.stringify(idleNames.slice(0, 3))}）`);

  await click('.chart-playback__primary');
  await sleep(2200);
  await click('.chart-playback__primary');
  await sleep(700);
  const playedNames = await rowNames();
  ck(playedNames.length > 0 && !playedNames.some((n) => CJK.test(n)),
     `Ainvest 播放推进后行名仍为英文（实测 ${JSON.stringify(playedNames.slice(0, 3))}）`);

  if (cdp.errors.length) { console.log('页面报错', cdp.errors.slice(0, 2)); bad += 1; }
  await cdp.close();
} finally {
  await stopProcess(chrome);
  server.close();
  await rm(dir, { recursive: true, force: true });
}
if (bad) { console.error(`✗ HBar 竞赛合同失败 ${bad} 项`); } else { console.log('✓ HBar 竞赛合同通过：keyed join / 连续补间 / 暂停落在整期 / 名次互换 / Ainvest 播放全程英文'); }
process.exit(bad ? 1 : 0);
