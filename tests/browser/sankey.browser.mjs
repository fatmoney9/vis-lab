/*
 * [SANKEY-29] 桑基图形随容器缩放的浏览器合同。
 *
 * 单测只能证明系数算得对，这里证明真实页面上这条链路是通的：容器高 → 系数 → 节点高。
 * 播放本身的合同在 playback.browser.mjs，那份不认识桑基的数据，桑基专属断言放这里。
 * 浏览器原生 resize 同时写宽高，这里照做。
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

const size = `(() => {
  const surface = document.querySelector('.stage__surface');
  const host = surface.querySelector('.chart-host');
  const svg = host.querySelector('svg.dv-sankey__svg');
  const heights = [...svg.querySelectorAll('.dv-sankey__node-rect')].map((n) => +n.getAttribute('height'));
  return {
    primary: Math.max(...heights),
    nodeWidths: [...new Set([...svg.querySelectorAll('.dv-sankey__node-rect')].map((n) => +n.getAttribute('width')))],
    svgH: +svg.getAttribute('height'),
    overflow: svg.getBoundingClientRect().bottom - host.getBoundingClientRect().bottom,
    surfaceW: surface.getBoundingClientRect().width,
    surfaceH: surface.getBoundingClientRect().height,
  };
})()`;
const tick = (index) => `document.querySelector('.chart-playback__tick[data-period-index="${index}"]').click()`;

const server = createStaticServer();
const port = await listen(server);
const debugPort = await freePort();
const profile = await mkdtemp(join(tmpdir(), 'sankey-chrome-'));
const chrome = spawn(await chromeBinary(), [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--window-size=1400,1000',
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
], { stdio: 'ignore' });

try {
  await waitForJson(`http://${LOOPBACK}:${debugPort}/json/version`, 20000);
  const page = await fetch(`http://${LOOPBACK}:${debugPort}/json/new`, { method: 'PUT' }).then((r) => r.json());
  const cdp = await openCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: `http://${LOOPBACK}:${port}/index.html#sankey-financial` });
  await waitFor(cdp, `document.querySelector('.stage__surface .dv-sankey__node-rect')`, 20000);
  await sleep(1000);

  const resize = async (width, height) => {
    await evaluate(cdp, `(() => {
      const s = document.querySelector('.stage__surface');
      s.classList.add('is-resized');
      s.style.width = '${width}px';
      s.style.height = '${height}px';
    })()`);
    await sleep(500);
  };

  const natural = await evaluate(cdp, size);
  await resize(natural.surfaceW, natural.surfaceH + 200);
  const taller = await evaluate(cdp, size);
  assert.ok(taller.svgH > natural.svgH, `前置：画布应变高（${natural.svgH} → ${taller.svgH}）`);
  assert.ok(Math.abs(taller.primary / natural.primary - taller.svgH / natural.svgH) < 0.01,
    `节点应与绘图区等比缩放（节点 ${natural.primary} → ${taller.primary}，画布 ${natural.svgH} → ${taller.svgH}）`);
  assert.deepEqual(taller.nodeWidths, natural.nodeWidths, '节点宽度不随高度变化');

  /* 播放不能改比例尺：切到末期再切回首期，主节点必须回到原值。 */
  await evaluate(cdp, tick(7));
  await sleep(1100);
  const last = await evaluate(cdp, size);
  assert.ok(last.primary > taller.primary, '前置：末期主节点确实比首期大');
  await evaluate(cdp, tick(0));
  await sleep(1100);
  assert.equal((await evaluate(cdp, size)).primary, taller.primary, '切回首期比例尺不变');

  await resize(natural.surfaceW, natural.surfaceH - 140);
  const shorter = await evaluate(cdp, size);
  assert.ok(shorter.primary < natural.primary, `变矮后节点应变小（${natural.primary} → ${shorter.primary}）`);
  assert.ok(shorter.overflow <= 0, `变矮后图形不得超出容器（超出 ${shorter.overflow}px）`);

  /* 拖回原高度，形态必须回到默认：没有不可逆的残留。 */
  await resize(natural.surfaceW, natural.surfaceH);
  const restored = await evaluate(cdp, size);
  assert.ok(Math.abs(restored.primary - natural.primary) < 0.01, `拖回原高恢复默认（${natural.primary} → ${restored.primary}）`);

  /* 紧凑档：绘图区高 = size-chart-region-height，各期都放得下。 */
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await cdp.send('Page.navigate', { url: `http://${LOOPBACK}:${port}/index.html#sankey-financial` });
  await waitFor(cdp, `document.querySelector('.stage__surface .dv-sankey__node-rect')`, 20000);
  await evaluate(cdp, `document.querySelector('[data-segment="theme"] [data-value="ainvest"]').click()`);
  await sleep(600);
  const standard = await evaluate(cdp, size);
  await evaluate(cdp, `document.querySelector('[data-segment="uiDensity"] [data-value="compact"]').click()`);
  await sleep(800);
  const regionHeight = await evaluate(cdp, `parseFloat(getComputedStyle(document.querySelector('.stage__surface')).getPropertyValue('--size-chart-region-height'))`);
  for (const index of [0, 7]) {
    await evaluate(cdp, tick(index));
    await sleep(1100);
    const compact = await evaluate(cdp, size);
    assert.equal(compact.svgH, regionHeight, `紧凑档第 ${index} 期绘图区高应等于 token`);
    assert.ok(compact.overflow <= 0, `紧凑档第 ${index} 期不得超出容器（超出 ${compact.overflow}px）`);
    assert.ok(compact.primary < standard.svgH, '前置：紧凑档确实缩小了');
  }

  assert.deepEqual(cdp.errors, [], '全程不得有页面报错');
  await cdp.close();
  console.log('✓ 桑基浏览器合同通过：等比缩放 / 节点宽度不变 / 播放比例尺稳定 / 变矮不溢出 / 拖回恢复 / 紧凑档高度跟 token');
} finally {
  await stopProcess(chrome);
  server.close();
  await rm(profile, { recursive: true, force: true });
}
