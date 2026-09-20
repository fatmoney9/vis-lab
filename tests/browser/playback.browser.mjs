/*
 * [SANKEY-24] 播放区的**跨族合同**：`demos/chart-playback.*` + `demos/playback-controller.js`。
 *
 * 这份文件和按图型组织的合同不同：它不验桑基画得对不对，而验**播放这件事本身**——
 * 推进 / 暂停 / 冻结 / 跳期 / 回卷，以及控件与图形的联动口径。当前唯一的消费方是桑基，
 * 但断言里没有一行认识桑基的数据；接第二个会播放的图型时，把 `ENTRY` 换掉即可复用。
 *
 * ── 为什么非要有这一份 ────────────────────────────────────────────
 * 2026-09-20 把播放件从 `sankey-playback.*` 中性化提取成 `chart-playback.*`，
 * 并把同一套状态机（此前在 index.html 与 playground/sankey-preview.html 里**逐行重复两遍**）
 * 收敛进 `playback-controller.js`。那次重构 `charts/` 一行没动、门禁 11/11 全绿，
 * 但门禁一个像素都不渲染、也不派发任何事件——**播放坏没坏，只有这里能回答**。
 *
 * ⚠️ 最值钱的是「暂停 = 冻结当前帧」那条。它是 SANKEY-24 的原文要求，
 * 也正是当年宁可在 L2 手写 rAF 也不用 `core/motion.js` 的 `runGrowth` 的唯一理由
 * （那个驱动被取消时会落终态）。只断言「暂停后画面没变」是不够的——
 * 「已经落到终态然后不动了」同样满足，所以必须同时断言**它不等于目标期的终态**。
 */
import assert from 'node:assert/strict';
import {
  LOOPBACK, sleep, chromeBinary, createStaticServer, listen, freePort,
  waitForJson, openCdp, evaluate, waitFor, stopProcess,
} from './harness.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ENTRY = 'index.html#sankey-financial';
/* 一根随播放变形的图元。换图型时只改这一行；断言逻辑与它画的是什么无关。 */
const GEOMETRY = '.dv-sankey__edge-ribbon';

const readState = `({
  period: document.querySelector('.chart-playback__period')?.value ?? null,
  range: document.querySelector('.chart-playback__range')?.value ?? null,
  playing: !!document.querySelector('.chart-playback__primary')?.classList.contains('is-playing'),
  prevDisabled: !!document.querySelector('.chart-playback__step--prev')?.disabled,
  nextDisabled: !!document.querySelector('.chart-playback__step--next')?.disabled,
  currentTicks: document.querySelectorAll('.chart-playback__tick.is-current').length,
  ticks: document.querySelectorAll('.chart-playback__tick').length,
})`;
const geometry = `document.querySelector(${JSON.stringify(GEOMETRY)})?.getAttribute('d') ?? null`;
const clickOn = (selector) => `(() => {
  const node = document.querySelector(${JSON.stringify(selector)});
  if (!node) return false;
  node.click();
  return true;
})()`;

const server = createStaticServer();
const port = await listen(server);
const profile = await mkdtemp(join(tmpdir(), 'playback-contract-'));
const debugPort = await freePort();
const chrome = spawn(await chromeBinary(), [
  '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=1400,1000',
], { stdio: 'ignore' });

try {
  await waitForJson(`http://${LOOPBACK}:${debugPort}/json/version`, 20000);
  const page = await fetch(`http://${LOOPBACK}:${debugPort}/json/new`, { method: 'PUT' }).then((r) => r.json());
  const cdp = await openCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: `http://${LOOPBACK}:${port}/${ENTRY}` });
  await waitFor(cdp, `!!document.querySelector('.chart-playback__primary')`, 25000);
  await waitFor(cdp, `${geometry} !== null`, 25000);
  await sleep(1200);

  /* ① 首屏：控件齐、停在第 0 期、**不自动起播** */
  const first = await evaluate(cdp, readState);
  assert.ok(first.ticks >= 2, `时间轴至少两个刻度，实际 ${first.ticks}`);
  assert.equal(first.range, '0', '首屏停在第 0 期');
  assert.equal(first.currentTicks, 1, '当前刻度有且只有一个');
  assert.equal(first.prevDisabled, true, '第 0 期时「上一期」置灰');
  assert.equal(first.playing, false, '进入页面不自动起播');

  /* ② 单步推进：期数与滑块同步 */
  assert.ok(await evaluate(cdp, clickOn('.chart-playback__step--next')), '「下一期」按钮应存在');
  await sleep(1400);
  const stepped = await evaluate(cdp, readState);
  assert.equal(stepped.range, '1', '「下一期」推进到第 1 期');
  assert.notEqual(stepped.period, first.period, '期数读数跟着变');
  assert.equal(stepped.prevDisabled, false, '离开第 0 期后「上一期」可用');

  /* ③ 播放 → 暂停：确实推进了，且退出播放态 */
  await evaluate(cdp, clickOn('.chart-playback__primary'));
  await sleep(600);
  assert.equal((await evaluate(cdp, readState)).playing, true, '点播放进入播放态');
  await sleep(2200);
  await evaluate(cdp, clickOn('.chart-playback__primary'));
  await sleep(400);
  const paused = await evaluate(cdp, readState);
  assert.equal(paused.playing, false, '再点一次退出播放态');
  assert.ok(Number(paused.range) > 1, `播放期间确实推进了，实际停在第 ${paused.range} 期`);

  /* ④ [SANKEY-24] 暂停 = **冻结当前帧**，不是落终态。
        两条断言缺一不可：画面不再变化，且**不等于该期终态**（后者才排除「落完终态才停」）。

     ⚠️ 必须在**动画中途**按暂停，时机不能碰运气。一期是 120ms 文字提前量 + 720ms 几何补间、
     期间再隔 120ms，所以「播一会儿再停」很容易正好落在两期之间的间隙上——
     那一刻几何本来就是某期终态，第二条断言会假红。起播后 300ms 必然落在补间里。 */
  await evaluate(cdp, clickOn('.chart-playback__primary'));
  await sleep(300);
  await evaluate(cdp, clickOn('.chart-playback__primary'));
  await sleep(250);
  const midway = await evaluate(cdp, readState);
  assert.equal(midway.playing, false, '中途暂停后退出播放态');

  const frozen = await evaluate(cdp, geometry);
  assert.ok(frozen, '几何读数不得为空——选择器失效会让本组断言空转通过');
  await sleep(800);
  assert.equal(await evaluate(cdp, geometry), frozen, '暂停后几何冻结：间隔 800ms 两次读数相同');

  /* 让它跑完同一期，终态必须与冻结帧不同 —— 这条才真正排除「落完终态才停」 */
  await evaluate(cdp, clickOn(`.chart-playback__tick[data-period-index="${Number(midway.range)}"]`));
  await sleep(1600);
  const settled = await evaluate(cdp, geometry);
  assert.notEqual(settled, frozen, '冻结帧必须不等于该期终态，否则「落完终态才停」也会通过本组断言');

  /* ⑤ 拖滑块与点刻度：都落离散期、都停止播放 */
  await evaluate(cdp, `(() => {
    const range = document.querySelector('.chart-playback__range');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(range, '${Math.max(0, first.ticks - 2)}');
    range.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(1500);
  const dragged = await evaluate(cdp, readState);
  assert.equal(dragged.range, `${Math.max(0, first.ticks - 2)}`, '拖滑块落到目标期');
  assert.equal(dragged.playing, false, '拖滑块会停止播放');

  await evaluate(cdp, clickOn('.chart-playback__tick[data-period-index="0"]'));
  await sleep(1500);
  const ticked = await evaluate(cdp, readState);
  assert.equal(ticked.range, '0', '点刻度跳回第 0 期');
  assert.equal(ticked.currentTicks, 1, '当前刻度仍唯一');

  /* ⑥ 切主题后播放区仍在（文案与把手 token 随主题走，但控件不该消失） */
  await evaluate(cdp, clickOn('[data-segment="theme"] [data-value="ainvest"]'));
  await sleep(1800);
  assert.ok(
    await evaluate(cdp, `!!document.querySelector('.chart-playback__primary')`),
    '切到 Ainvest 后播放区仍然存在',
  );

  assert.deepEqual(cdp.errors, [], '播放全程不得有页面报错');
  await cdp.close();
  console.log('✓ 播放合同通过：推进 / 暂停冻结 / 跳期 / 拖轴 / 切主题');
} finally {
  await stopProcess(chrome);
  server.close();
  await rm(profile, { recursive: true, force: true });
}
