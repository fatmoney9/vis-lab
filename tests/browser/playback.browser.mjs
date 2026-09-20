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

  /* ⑥ [SANKEY-28][SANKEY-29] 三主题 × 明暗：播放键必须**真的看得见**，且底色取各自的
        控件强调色。
        ⚠️ 只断言「节点存在」是不够的——Ainvest 曾用 `display: none` 把它藏掉，
        节点一直都在、`querySelector` 一直为真，断言照样全绿。所以这里读的是
        computed display 与实际盒子尺寸。
        ⚠️ 底色也必须逐主题断言：它曾直接引用 `--color-price-up`，于是跟着「涨」色走，
        iFinD 的涨色是红的、播放键就是红的——而那在三主题下都「有颜色」，
        任何「底色非空」式的断言都验不到。 */
  const PAUSED_BG = 'rgb(133, 133, 133)';   /* color-grey-05 #858585，三主题同值 */
  const PRIMARY_BG = {
    ths: { light: 'rgb(255, 36, 54)', dark: 'rgb(255, 36, 54)' },
    'ifind-pc': { light: 'rgb(27, 99, 217)', dark: 'rgb(51, 113, 255)' },
    ainvest: { light: 'rgb(22, 93, 255)', dark: 'rgb(51, 113, 255)' },
  };
  for (const [theme, byMode] of Object.entries(PRIMARY_BG)) {
    for (const [mode, expected] of Object.entries(byMode)) {
      await evaluate(cdp, clickOn(`[data-segment="theme"] [data-value="${theme}"]`));
      await sleep(900);
      await evaluate(cdp, clickOn(`[data-segment="mode"] [data-value="${mode}"]`));
      await sleep(1400);
      const button = await evaluate(cdp, `(() => {
        const node = document.querySelector('.chart-playback__primary');
        if (!node) return null;
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        return { display: style.display, visibility: style.visibility,
                 bg: style.backgroundColor, w: Math.round(box.width), h: Math.round(box.height) };
      })()`);
      assert.ok(button, `${theme}/${mode}：播放键节点存在`);
      assert.notEqual(button.display, 'none', `${theme}/${mode}：播放键不得被 display:none 藏掉`);
      assert.notEqual(button.visibility, 'hidden', `${theme}/${mode}：播放键不得被 visibility 藏掉`);
      assert.ok(button.w > 0 && button.h > 0, `${theme}/${mode}：播放键要有实际尺寸（实测 ${button.w}×${button.h}）`);
      assert.equal(button.bg, expected, `${theme}/${mode}：播放键底色取本主题控件强调色`);

      /* 播放中 = 按钮此刻的动作是「暂停」，底色转中性灰（三主题共用 `color-grey-05`）。
         ⚠️ 同时断言**图标也换了**：只看底色的话，一个「底色变灰但图标还是播放三角」的
         半截实现照样全绿。 */
      await evaluate(cdp, clickOn('.chart-playback__primary'));
      await sleep(350);
      const playing = await evaluate(cdp, `(() => {
        const node = document.querySelector('.chart-playback__primary');
        return {
          bg: getComputedStyle(node).backgroundColor,
          isPlaying: node.classList.contains('is-playing'),
          pauseIcon: getComputedStyle(node.querySelector('.chart-playback__pause-icon')).display,
          playIcon: getComputedStyle(node.querySelector('.chart-playback__play-icon')).display,
        };
      })()`);
      assert.equal(playing.isPlaying, true, `${theme}/${mode}：点击后进入播放态`);
      assert.equal(playing.bg, PAUSED_BG, `${theme}/${mode}：播放中底色转中性灰`);
      assert.notEqual(playing.bg, expected, `${theme}/${mode}：两态底色必须不同`);
      assert.notEqual(playing.pauseIcon, 'none', `${theme}/${mode}：播放中要显示暂停图标`);
      assert.equal(playing.playIcon, 'none', `${theme}/${mode}：播放中要隐藏播放图标`);

      /* 停回去，别把播放态带进下一轮主题 */
      await evaluate(cdp, clickOn('.chart-playback__primary'));
      await sleep(400);
    }
  }

  assert.deepEqual(cdp.errors, [], '播放全程不得有页面报错');
  await cdp.close();
  console.log('✓ 播放合同通过：推进 / 暂停冻结 / 跳期 / 拖轴 / 三主题×明暗 播放键两态配色与图标');
} finally {
  await stopProcess(chrome);
  server.close();
  await rm(profile, { recursive: true, force: true });
}
