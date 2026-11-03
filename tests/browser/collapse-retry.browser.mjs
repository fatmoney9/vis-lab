/*
 * [GRID-03] 容器塌陷重试的生命周期合同（L1 `createBuildRetry` 的跨族消费方）。
 *
 * 容器高不可用时，图表每帧重试一次 build。合同验三件事：塌陷时确实在重试（前提，防空转）、
 * 容器恢复后图回来且重试停止、塌陷中销毁后不再有任何帧请求。
 * 用 display:none 造塌陷：高度置 0 拦不住声明了 min-height 的图型。
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LOOPBACK, chromeBinary, createStaticServer, listen, freePort,
  waitForJson, openCdp, evaluate, waitFor, stopProcess,
} from './harness.mjs';

const CHARTS = ['cartesian', 'pie', 'radar', 'treemap'];

const fixture = async () => {
  const [{ mountExample }, { EXAMPLES }] = await Promise.all([
    import('/demos/registry.js'),
    import('/demos/examples.js'),
  ]);
  const nativeRaf = window.requestAnimationFrame;
  const wait = (ms) => new Promise((settle) => setTimeout(settle, ms));
  const framesDuring = async (ms) => {
    let frames = 0;
    window.requestAnimationFrame = (callback) => {
      frames += 1;
      return nativeRaf.call(window, callback);
    };
    await wait(ms);
    window.requestAnimationFrame = nativeRaf;
    return frames;
  };
  window.__collapseRetry = {
    framesDuring,
    async run(chart) {
      const host = document.createElement('div');
      Object.assign(host.dataset, { theme: 'ths', platform: 'pc', mode: 'light' });
      host.style.cssText = 'position:absolute;left:0;top:0;width:600px;height:320px';
      document.body.append(host);
      const example = EXAMPLES.find((item) => item.chart === chart);
      const { instance } = mountExample(host, example, {
        theme: 'ths', platform: 'pc', mode: 'light', animation: false,
      });
      await wait(100);
      host.style.display = 'none';
      await wait(100);
      const whileCollapsed = await framesDuring(200);
      host.style.display = '';
      await wait(150);
      const rendered = host.querySelector('svg') !== null;
      const afterRestore = await framesDuring(200);
      host.style.display = 'none';
      await wait(100);
      instance.destroy();
      host.remove();
      await wait(50);
      const afterDestroy = await framesDuring(300);
      return { whileCollapsed, rendered, afterRestore, afterDestroy };
    },
  };
};

const server = createStaticServer();
const port = await listen(server);
const debugPort = await freePort();
const profile = await mkdtemp(join(tmpdir(), 'vis-lab-collapse-retry-'));
const chrome = spawn(await chromeBinary(), [
  '--headless', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox',
  `--remote-debugging-address=${LOOPBACK}`,
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

try {
  await waitForJson(`http://${LOOPBACK}:${debugPort}/json/version`);
  const page = await fetch(`http://${LOOPBACK}:${debugPort}/json/new`, { method: 'PUT' })
    .then((response) => response.json());
  const cdp = await openCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: `http://${LOOPBACK}:${port}/index.html` });
  await waitFor(cdp, "document.querySelectorAll('.example-card svg').length > 0", 60000);
  await evaluate(cdp, `(${fixture.toString()})()`);
  /* 画廊自身的入场动效结束后才开始计数，否则别人的帧会算到被测图表头上。 */
  const quietDeadline = Date.now() + 30000;
  while (await evaluate(cdp, 'window.__collapseRetry.framesDuring(300)') > 0) {
    assert.ok(Date.now() < quietDeadline, '画廊 30 秒内未静止，无法开始计数');
  }

  for (const chart of CHARTS) {
    const result = await evaluate(cdp, `window.__collapseRetry.run(${JSON.stringify(chart)})`);
    const context = `${chart} ${JSON.stringify(result)}`;
    assert.ok(result.whileCollapsed > 0, `${context}：前提不成立，塌陷时没有进入重试`);
    assert.ok(result.rendered, `${context}：容器恢复后应重新画出图表`);
    assert.equal(result.afterRestore, 0, `${context}：容器恢复后重试应停止`);
    assert.equal(result.afterDestroy, 0, `${context}：塌陷中销毁后不得再请求动画帧`);
  }
  console.log(`✓ 容器塌陷重试合同通过：${CHARTS.length} 个图型 × 塌陷重试 / 恢复停止 / 销毁停止`);
} finally {
  await stopProcess(chrome);
  server.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
process.exit(0);
