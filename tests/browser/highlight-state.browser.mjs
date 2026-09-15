/*
 * [SANKEY-10/20][TREEMAP-06][CHORD-12/14] `core/highlight-state.js` 的**跨族合同**。
 *
 * 这份文件和其他浏览器合同不同：它不验某一个图型，而验**同一套状态迁移在三个消费方
 * 身上表现一致**。桑基、矩形树图与弦图各自的邻域算法、class 名与看板都不一样，
 * 但「hover 压过钉住、移出回落到钉住态、再点关闭」这三条必须一模一样——
 * 状态机下沉 L1 换来的就是这个，散回三份实现的第一天它就会开始漂。
 *
 * 纯逻辑部分已有 tests/highlight-state.test.mjs 覆盖；这里补的是它覆盖不到的那一半：
 * L2 把状态翻译成 DOM 时有没有接错线。事件用合成 Event 派发，不依赖鼠标坐标，
 * 故与容器尺寸、滚动位置和图元疏密都无关。
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

/*
 * 三个消费方的接线各不相同，故各自声明「怎么到达」「点谁」「看哪个 class」。
 * 除此之外的断言完全共用——差异只该出现在这张表里。
 */
const CONSUMERS = [
  {
    name: 'SankeyChart',
    path: '/playground/sankey-preview.html',
    ready: "document.querySelectorAll('.dv-sankey__node').length > 0",
    target: '.dv-sankey__node',
    active: '.dv-sankey__node.is-active',
  },
  {
    name: 'TreemapChart',
    path: '/index.html#treemap-entry',
    ready: "document.querySelectorAll('.stage__surface .dv-treemap-node').length > 0",
    target: '.stage__surface .dv-treemap-node',
    active: '.stage__surface .dv-treemap-node__mask.is-active',
  },
  {
    name: 'ChordChart',
    path: '/index.html#chord-sector-flow',
    ready: "document.querySelectorAll('.stage__surface .dv-chord__arc').length > 0",
    target: '.stage__surface .dv-chord__arc',
    active: '.stage__surface .dv-chord__arc.is-active',
  },
];

/*
 * 同时派发 mouse 与 pointer 两套事件：三族的接线用的不是同一套
 * （矩形树图听 mouseenter / mouseleave，另两族听 pointerenter / pointerleave）。
 * 合同要验的是状态迁移，不是各族选了哪个事件名。
 */
const exercise = ({ target, active }) => `(() => {
  const nodes = [...document.querySelectorAll(${JSON.stringify(target)})];
  if (nodes.length < 2) throw new Error('可交互图元不足两个，无法验「钉住 A 再扫 B」');
  const [a, b] = nodes;
  const enter = (el) => {
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
  };
  const leave = (el) => {
    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
  };
  const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const count = () => document.querySelectorAll(${JSON.stringify(active)}).length;

  const initial = count();
  enter(a); const hovered = count();
  leave(a); const leftUnpinned = count();

  enter(a); click(a); const pinned = count();
  leave(a); const leftPinned = count();

  enter(b); const hoverOther = count();
  leave(b); const backToPinned = count();

  enter(a); click(a); const closed = count();
  leave(a);
  return { initial, hovered, leftUnpinned, pinned, leftPinned, hoverOther, backToPinned, closed };
})()`;

async function main() {
  const staticServer = createStaticServer();
  const sitePort = await listen(staticServer);
  const debugPort = await freePort();
  const profile = await mkdtemp(join(tmpdir(), 'vis-lab-chrome-'));
  const chrome = spawn(await chromeBinary(), [
    '--headless', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox',
    `--remote-debugging-address=${LOOPBACK}`,
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeError = '';
  chrome.stderr.on('data', (chunk) => { chromeError += String(chunk); });
  let cdp;
  try {
    await waitForJson(`http://${LOOPBACK}:${debugPort}/json/version`);
    const page = await fetch(`http://${LOOPBACK}:${debugPort}/json/new`, { method: 'PUT' })
      .then((response) => response.json());
    cdp = await openCdp(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

    for (const consumer of CONSUMERS) {
      await cdp.send('Page.navigate', { url: `http://${LOOPBACK}:${sitePort}${consumer.path}` });
      await waitFor(cdp, consumer.ready);
      await sleep(400);
      const r = await evaluate(cdp, exercise(consumer));
      const at = (step) => `${consumer.name}／${step}`;

      assert.equal(r.initial, 0, at('初始态不该有高亮'));
      assert.ok(r.hovered > 0, at('hover 图元应产生高亮'));
      assert.equal(r.leftUnpinned, 0, at('未钉住时移出应清空'));
      assert.ok(r.pinned > 0, at('点击应钉住'));
      /* 本合同的核心一条：状态机散回三份实现时，最先丢的就是它 */
      assert.ok(r.leftPinned > 0, at('钉住后移出应**回落到钉住态**，不是清空'));
      assert.ok(r.hoverOther > 0, at('钉住 A 时 hover B，高亮应跟去 B'));
      assert.ok(r.backToPinned > 0, at('扫过 B 再移出，应回落到仍钉着的 A'));
      assert.equal(r.closed, 0, at('再点同一图元应关闭'));
    }

    console.log(`✓ highlight-state 跨族合同通过：${CONSUMERS.length} 个消费方 × 8 条迁移`);
  } catch (error) {
    if (chromeError.trim()) console.error(chromeError.trim());
    throw error;
  } finally {
    if (cdp) await cdp.close();
    await stopProcess(chrome);
    await new Promise((done) => staticServer.close(done));
    await rm(profile, { recursive: true, force: true });
  }
}

await main();
