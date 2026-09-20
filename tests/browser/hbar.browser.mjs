/*
 * [HBAR-10..17] 横向条竞赛形态的浏览器合同。
 *
 * 纯逻辑那半（排序 / Top-N / 名次插值）已由 tests/hbar.test.mjs 覆盖；
 * 这里补的是它覆盖不到的那一半：L2 把模型翻译成 DOM 时有没有接错线。
 *
 * ⚠️ 两条踩过的坑写在断言旁边，别再踩：
 *   ① 「正在补间」不能看行 y 是不是小数——**静态布局下 y 本来就是小数**，那是空转检查。
 *      要用两个时刻的指纹差。
 *   ② 「暂停 = 冻结」不能只证「暂停前后不同」——暂停可能正好打在两期之间的间隙上，
 *      那时几何本就是某期终态。要证的是**冻结帧 ≠ 该期终态**。
 *   指纹必须**聚合全体行并排序**：DOM 顺序不等于名次顺序，跨帧比「第一根条」会比到不同的行上。
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LOOPBACK, sleep, chromeBinary, createStaticServer, listen, freePort,
  waitForJson, openCdp, evaluate, waitFor, stopProcess,
} from 'file:///Users/qianyunan/202605%20DataVis/Vis-demo/tests/browser/harness.mjs';

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

  /* [HBAR-16] 暂停 = 冻结当前帧。
     ⚠️ 不能用「暂停前后指纹不同」来证「停在半路」——暂停可能正好打在两期之间的间隙上，
     那时几何本就是某期终态、前后自然相同，断言会假红。
     真正要证的是：**冻结帧 ≠ 该期终态**。终态由「再跳一次同一期并等它跑完」取得。 */
  const atIndex = await evaluate(cdp, `+document.querySelector('.chart-playback__range').value`);
  await click('.chart-playback__primary');
  await sleep(200);
  const f1 = await fingerprint();
  await sleep(700);
  const f2 = await fingerprint();
  ck(!(await playing()), '暂停后退出播放态');
  ck(f1 === f2 && !!f1, '暂停后几何冻结：间隔 700ms 两次指纹相同');

  await click(`.chart-playback__tick[data-period-index="${atIndex}"]`);
  await sleep(1600);
  const settled = await fingerprint();
  ck(settled !== f1, '冻结帧 ≠ 该期终态——排除「已经落到终态然后不动了」');

  await click('.chart-playback__tick[data-period-index="23"]');
  await sleep(1800);
  const last = await order();
  ck(JSON.stringify(last) !== JSON.stringify(first), '末期名次与首期不同——名次真的互换了');
  ck(new Set(last).size === last.length, '末期无重复实体');

  if (cdp.errors.length) { console.log('页面报错', cdp.errors.slice(0, 2)); bad += 1; }
  await cdp.close();
} finally {
  await stopProcess(chrome);
  server.close();
  await rm(dir, { recursive: true, force: true });
}
if (bad) { console.error(`✗ HBar 竞赛合同失败 ${bad} 项`); } else { console.log('✓ HBar 竞赛合同通过：keyed join / 连续补间 / 暂停冻结 / 名次互换'); }
process.exit(bad ? 1 : 0);
