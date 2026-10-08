/*
 * playground 三主题面的**多实例同步播放**合同。
 *
 * 与 playback.browser.mjs 的分工：那份验「播放这件事本身」（推进 / 冻结 / 跳期），
 * 消费方是**一个**图表实例；这份只验一件那份验不到的事——**一条轴驱动三个实例**。
 *
 * ── 为什么非要有这一份 ────────────────────────────────────────────
 * 三卡同步的失败模式是静默的：三张卡各自都在动、控件回显也正常，只是**彼此差了一期**。
 * 门禁不渲染像素，单测里没有三个实例，两边都看不见它。
 *
 * ⚠️ 断言「三卡名次序列相同」是**不够的**——某张卡落后一期时，若那两期恰好没发生名次
 * 互换，三卡照样完全相同、断言照样全绿。所以真正的同步证据是下面这条：
 * 在同一个时间窗内，**每张卡跟自己比**都必须在变。跨主题不能直接比几何
 * （三主题的字号与边距本就不同，比出来的差异说明不了任何事），只能比各自的变化量。
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LOOPBACK, sleep, chromeBinary, createStaticServer, listen, freePort,
  waitForJson, openCdp, evaluate, waitFor, stopProcess,
} from './harness.mjs';

const ENTRY = 'playground/preview.html';
/* 竞赛示例的行。换图型时只改这两行，断言逻辑与它画的是什么无关。 */
const ROW = '.dv-hbar__row';
const RACE = '行业市值排名';
const OTHER = '财报收支拆解';

/* 每张卡一份几何指纹：**聚合全体行并排序**。DOM 顺序不等于名次顺序，
   跨帧比「第一根条」会比到不同的行上。 */
const perCard = `[...document.querySelectorAll('.theme-card')].map((card) =>
  [...card.querySelectorAll('${ROW}')]
    .map((g) => g.getAttribute('transform') + '~' + (g.querySelector('path')?.getAttribute('d') ?? ''))
    .sort().join('|'))`;

const orders = `[...document.querySelectorAll('.theme-card')].map((card) =>
  [...card.querySelectorAll('${ROW}')]
    .map((g) => ({ k: g.__data__?.key, y: +(/translate\\(0,([-\\d.]+)\\)/.exec(g.getAttribute('transform'))?.[1] ?? 0) }))
    .sort((a, b) => a.y - b.y).map((r) => r.k).join('>'))`;

const clickNav = (label) => `(() => {
  const b = [...document.querySelectorAll('.nav-item')].find((n) => n.textContent === ${JSON.stringify(label)});
  if (!b) return false; b.click(); return true; })()`;

const clickPlay = `document.querySelector('.chart-playback__primary').click()`;
const periodOf = `document.querySelector('.chart-playback__period')?.value ?? ''`;

const server = createStaticServer();
const port = await listen(server);
const profile = await mkdtemp(join(tmpdir(), 'pg-playback-'));
const debugPort = await freePort();
const chrome = spawn(await chromeBinary(), [
  '--headless=new', `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1800,1200',
], { stdio: 'ignore' });

try {
  await waitForJson(`http://${LOOPBACK}:${debugPort}/json/version`, 20000);
  const page = await fetch(`http://${LOOPBACK}:${debugPort}/json/new`, { method: 'PUT' })
    .then((r) => r.json());
  const cdp = await openCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: `http://${LOOPBACK}:${port}/${ENTRY}` });

  /* ⚠️ 等导航真的建出来再点。固定 sleep 会偶发地点在空导航上、然后靠「默认恰好就是它」
     蒙混过关——那等于什么都没验。 */
  await waitFor(cdp, `document.querySelectorAll('.nav-item').length > 5`, 20000);

  /* ① 跨示例切换要把上一个控制器收干净：否则旧控制器还挂在已 destroy 的实例上，
        切回来就是两个控制器抢同一条轴（表现为点一次播放跳两期）。 */
  assert.ok(await evaluate(cdp, clickNav(OTHER)), `左栏能切到「${OTHER}」`);
  await waitFor(cdp, `document.querySelectorAll('.dv-sankey__node-rect').length > 0`, 20000);
  await sleep(600);
  assert.equal(
    await evaluate(cdp, `document.querySelectorAll('.chart-playback').length`), 1,
    '切到另一个播放示例后仍只有一条播放条',
  );

  assert.ok(await evaluate(cdp, clickNav(RACE)), `左栏能切回「${RACE}」`);
  await waitFor(cdp, `document.querySelectorAll('${ROW}').length > 0`, 20000);
  await sleep(1200);

  /* ② 一条轴、三张卡，且轴在卡片之外 */
  assert.equal(await evaluate(cdp, `document.querySelectorAll('.chart-playback').length`), 1,
    '整个面只有一条播放条（不是每张卡各一条）');
  assert.equal(await evaluate(cdp, `document.querySelectorAll('.theme-card').length`), 3,
    '三张主题卡都在');
  assert.ok(!(await evaluate(cdp, `!!document.querySelector('.theme-card .chart-playback')`)),
    '播放条位于三张卡之外');

  const first = await evaluate(cdp, orders);
  assert.ok(first.every((o) => o.length > 0), '三张卡都画出了行');
  assert.equal(new Set(first).size, 1, '首帧三卡名次完全一致');

  /* ③ **同步的硬证据**：同一时间窗内每张卡跟自己比都在变。
        见文件头——只比「三卡彼此相同」验不到落后一期的情形。 */
  const before = await evaluate(cdp, periodOf);
  await evaluate(cdp, clickPlay);
  await sleep(300);
  const samples = [];
  for (let i = 0; i < 4; i += 1) {
    samples.push(await evaluate(cdp, perCard));
    await sleep(160);
  }
  const moved = [0, 1, 2].map((card) => samples.some((s, i) => i > 0 && s[card] !== samples[i - 1][card]));
  assert.deepEqual(moved, [true, true, true],
    '同一时间窗内三张卡各自都在补间——没有哪张是静止或已经跑完的');

  /* ④ 暂停：三张卡**一起**把当前这一期播完，然后一起停住。
     ⚠️ 2026-10-08 起本族的暂停不再是「冻结当前帧」而是「播完当前这一期再停」
     （[HBAR-16]），所以按下暂停后还会动约一期的补间时长——**采样必须等它收完尾**，
     否则会把正常的收尾动作读成「没停住」。 */
  await evaluate(cdp, clickPlay);
  await sleep(1500);                                  /* > 一期补间时长 */
  const frozen = await evaluate(cdp, perCard);
  await sleep(700);
  assert.deepEqual(await evaluate(cdp, perCard), frozen,
    '收尾后三张卡一起停住（700ms 内三份指纹都不变）');

  const after = await evaluate(cdp, periodOf);
  assert.notEqual(after, before, '播放确实推进了期次');
  assert.equal(new Set(await evaluate(cdp, orders)).size, 1,
    '推进若干期后三卡仍停在同一名次序列');

  assert.deepEqual(cdp.errors, [], '三卡同步播全程不得有页面报错');
  await cdp.close();
  console.log('✓ 三卡同步播合同通过：一轴驱动三实例 / 各自在动 / 一起收尾停住 / 跨示例切换不残留');
} finally {
  await stopProcess(chrome);
  server.close();
  await rm(profile, { recursive: true, force: true });
}
