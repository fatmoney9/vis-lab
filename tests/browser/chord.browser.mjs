/*
 * [CHORD-07/09/10/11/12/14/16] 弦图浏览器合同。
 *
 * 不读取源码 / CSS 文本：打开主站、通过公开旋钮切主题与两档形态，再从真实 DOM /
 * computed style 验收可观察结果。服务器 / Chrome / CDP 这层壳共用 ./harness.mjs。
 *
 * **为什么这几条非得进浏览器**：纯逻辑单测覆盖得了角度、路径与守恒，覆盖不了
 * 「标签量出来是几个字」「三主题各取到哪几个色」「hover 之后哪些图元换了 class」。
 * CHORD-11 那条尤其是实账——横排档的标签带曾被容器高度决定，四个汉字一个都放不下、
 * 整层渲染成空串，而当时门禁 11/11 与全部单测都是绿的。
 */
import assert from 'node:assert/strict';
import {
  ROOT, LOOPBACK, sleep, chromeBinary, createStaticServer, listen, freePort,
  waitForJson, openCdp, evaluate, waitFor, stopProcess,
} from './harness.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const READY = "document.querySelectorAll('.stage__surface .dv-chord__arc').length > 0";

const setMainState = ({ theme, mode }) => `(() => {
  const change = (node) => node.dispatchEvent(new Event('change', { bubbles: true }));
  const choose = (key, value) => {
    const button = document.querySelector('[data-segment="' + key + '"] [data-value="' + value + '"]');
    if (button && !button.classList.contains('is-active')) button.click();
  };
  const select = document.querySelector('#theme-select');
  if (select) {
    if (select.value !== ${JSON.stringify(theme)}) { select.value = ${JSON.stringify(theme)}; change(select); }
  } else {
    choose('theme', ${JSON.stringify(theme)});
  }
  choose('mode', ${JSON.stringify(mode)});
  return true;
})()`;

const setChordKnobs = ({ variant, labelLayout, count }) => `(() => {
  const choose = (key, value) => {
    const button = document.querySelector('[data-segment="' + key + '"] [data-value="' + value + '"]');
    if (!button) throw new Error('缺少旋钮 ' + key + '=' + value);
    if (!button.classList.contains('is-active')) button.click();
  };
  const slider = document.querySelector('.stage input[type="range"], input[type="range"]');
  if (!slider) throw new Error('缺少实体数滑杆');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(slider, String(${count}));
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  slider.dispatchEvent(new Event('change', { bubbles: true }));
  choose('chordVariant', ${JSON.stringify(variant)});
  choose('chordLabelLayout', ${JSON.stringify(labelLayout)});
  return true;
})()`;

const inspectChord = `(() => {
  const surface = document.querySelector('.stage__surface');
  const root = surface.querySelector('.dv-chord');
  const svg = root.querySelector('svg.dv-chord__svg');
  const arcs = [...root.querySelectorAll('.dv-chord__arc')];
  const labels = [...root.querySelectorAll('.dv-chord__label')];
  const style = getComputedStyle(root);
  const sr = surface.getBoundingClientRect();
  const gr = svg.getBoundingClientRect();
  return {
    arcs: arcs.length,
    ribbons: root.querySelectorAll('.dv-chord__ribbon').length,
    labelTexts: labels.map((l) => l.textContent.trim()),
    arcFills: arcs.slice(0, 6).map((a) => getComputedStyle(a.querySelector('path')).fill),
    seriesVars: [1, 2, 3, 4, 5, 6].map((i) => style.getPropertyValue('--dv-series-' + i).trim()),
    ribbonOpacity: getComputedStyle(root.querySelector('.dv-chord__ribbon-band')).fillOpacity,
    /* [CHORD-08] 弦必须是两端实体色的渐变，不是单色 */
    gradients: root.querySelectorAll('linearGradient').length,
    ribbonFillsAreGradients: [...root.querySelectorAll('.dv-chord__ribbon-band')]
      .every((band) => getComputedStyle(band).fill.includes('url(')),
    gradientsWithTwoStops: [...root.querySelectorAll('linearGradient')]
      .filter((g) => g.querySelectorAll('stop').length === 2).length,
    degenerateGradients: [...root.querySelectorAll('linearGradient')].filter((g) => {
      const stops = [...g.querySelectorAll('stop')];
      return stops.length === 2
        && getComputedStyle(stops[0]).stopColor === getComputedStyle(stops[1]).stopColor;
    }).length,
    /* 实体色是否两两不同：色板比实体少时会循环（CHORD-09），那时两端同色的弦
       本来就该退化成单色——断言必须把这种情况摘出去，否则测的是色板长度不是渐变。 */
    entityColorsDistinct: (() => {
      const n = root.querySelectorAll('.dv-chord__arc').length;
      const cols = Array.from({ length: n }, (_, i) => style.getPropertyValue('--dv-series-' + (i + 1)).trim());
      return new Set(cols).size === n;
    })(),
    overflowX: +(gr.width - sr.width).toFixed(1),
    overflowY: +(gr.height - sr.height).toFixed(1),
  };
})()`;

/* [CHORD-12/14] hover → 邻域高亮；click → 钉住；再 click → 关闭。只看 class 与气泡可见性。 */
const exerciseInteraction = `(() => {
  const root = document.querySelector('.stage__surface .dv-chord');
  const arc = root.querySelector('.dv-chord__arc');
  const snap = () => {
    const tip = root.querySelector('.dv-tooltip');
    const cs = tip && getComputedStyle(tip);
    return {
      activeArcs: root.querySelectorAll('.dv-chord__arc.is-active').length,
      activeRibbons: root.querySelectorAll('.dv-chord__ribbon.is-active').length,
      dimRibbons: root.querySelectorAll('.dv-chord__ribbon.is-dimmed').length,
      tooltip: !!(cs && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'),
    };
  };
  const initial = snap();
  arc.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
  const hovered = snap();
  arc.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
  arc.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
  arc.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const pinned = snap();
  arc.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
  const afterLeave = snap();
  arc.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
  arc.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const closed = snap();
  return { initial, hovered, pinned, afterLeave, closed };
})()`;

/*
 * [CHORD-07] 大弧标志：只有单个实体跨度超过半圈才暴露写错。
 * 示例数据永远均匀，故这里用真实组件 + 合成数据挂一张离屏图——
 * 造夹具不等于手写 SVG，路径仍然由生产代码产出。
 */
const exerciseLargeArc = `(async () => {
  const { ChordChart } = await import('/charts/charts/chord/index.js');
  const host = document.createElement('div');
  host.style.cssText = 'width:400px;height:400px;';
  document.body.appendChild(host);
  ChordChart(host, {
    entities: ['甲', '乙', '丙', '丁'],
    matrix: [[0, 300, 300, 300], [8, 0, 6, 6], [8, 6, 0, 6], [8, 6, 6, 0]],
    animation: false,
  });
  await new Promise((done) => setTimeout(done, 400));
  const flags = [...host.querySelectorAll('.dv-chord__arc-band')].map((a) => (
    [...a.getAttribute('d').matchAll(/A[\\d.]+,[\\d.]+ 0 (\\d) (\\d)/g)].map((m) => m[1] + m[2])
  ));
  host.remove();
  return flags;
})()`;

/* [CHORD-16][MOTION-07] 减弱动效下第 0 帧即终态。固定尺寸宿主，排除容器重排的干扰。 */
const exerciseReducedMotion = `(async () => {
  const { ChordChart } = await import('/charts/charts/chord/index.js');
  const host = document.createElement('div');
  host.style.cssText = 'width:400px;height:400px;';
  document.body.appendChild(host);
  const seen = [];
  const started = performance.now();
  ChordChart(host, {
    entities: ['甲', '乙', '丙', '丁', '戊'],
    matrix: [[0,50,40,30,20],[45,0,35,25,15],[38,33,0,28,18],[29,24,27,0,22],[19,14,17,21,0]],
  });
  await new Promise((done) => {
    const tick = () => {
      seen.push([...host.querySelectorAll('.dv-chord__ribbon-band')].map((r) => r.getAttribute('d')).join('|'));
      if (performance.now() - started > 600) return done();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  host.remove();
  return { frames: seen.length, distinct: new Set(seen).size, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
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
  let checks = 0;
  try {
    await waitForJson(`http://${LOOPBACK}:${debugPort}/json/version`);
    const page = await fetch(`http://${LOOPBACK}:${debugPort}/json/new`, { method: 'PUT' })
      .then((response) => response.json());
    cdp = await openCdp(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Page.navigate', { url: `http://${LOOPBACK}:${sitePort}/#chord-sector-flow` });
    await waitFor(cdp, READY);

    /* ── 三主题 × 两档 variant × 两档标签 × 两个实体数极值 ── */
    for (const theme of ['ths', 'ifind-pc', 'ainvest']) {
      for (const mode of ['light', 'dark']) {
        await evaluate(cdp, setMainState({ theme, mode }));
        await waitFor(cdp, READY);
        for (const variant of ['undirected', 'directed']) {
          for (const labelLayout of ['arc', 'horizontal']) {
            for (const count of [4, 10]) {
              await evaluate(cdp, setChordKnobs({ variant, labelLayout, count }));
              await waitFor(cdp, `document.querySelectorAll('.stage__surface .dv-chord__arc').length === ${count}`);
              await sleep(120);
              const info = await evaluate(cdp, inspectChord);
              const where = `${theme}/${mode}/${variant}/${labelLayout}/n=${count}`;

              assert.equal(info.arcs, count, `${where}：外圈弧数应等于实体数`);
              assert.equal(info.labelTexts.length, count, `${where}：每个实体都要有标签`);
              /* [CHORD-11] 一个字都放不下时给「…」，但**绝不能是空串** */
              for (const [i, text] of info.labelTexts.entries()) {
                assert.ok(text.length > 0, `${where}：第 ${i} 个实体标签为空——标签带被算没了`);
              }
              /* [CHORD-10] 画布是图元外接框，不得超出容器 */
              assert.ok(info.overflowX <= 0.5, `${where}：画布横向溢出 ${info.overflowX}px`);
              assert.ok(info.overflowY <= 0.5, `${where}：画布纵向溢出 ${info.overflowY}px`);
              /* [CHORD-09] 实体色来自扇区盘，写成 --dv-series-N 由 CSS 消费 */
              assert.ok(info.seriesVars.slice(0, Math.min(count, 6)).every((v) => /^#/.test(v)),
                `${where}：实体色未写进 --dv-series-N`);
              assert.equal(new Set(info.arcFills.slice(0, Math.min(count, 6))).size,
                Math.min(count, 6), `${where}：前 6 个实体的外圈应各取一色`);
              /* [CHORD-08] 弦是两端实体色的渐变——单色带只能表达其中一端。
                 这一条是用眼睛发现的（"中间的链接看起来只有一个颜色"），故钉成断言。 */
              assert.equal(info.gradients, info.ribbons,
                `${where}：应逐条弦生成 linearGradient，实际 ${info.gradients}/${info.ribbons}`);
              assert.ok(info.ribbonFillsAreGradients,
                `${where}：有弦的 fill 不是渐变——CSS 的单色兜底把渐变盖掉了`);
              assert.equal(info.gradientsWithTwoStops, info.gradients,
                `${where}：每条渐变都应恰有两个 stop`);
              if (info.entityColorsDistinct) {
                assert.equal(info.degenerateGradients, 0,
                  `${where}：实体色两两不同，却有 ${info.degenerateGradients} 条渐变两端同色 —— 等于还是单色`);
              }
              /* [CHORD-17] 弦的默认透明度来自 token，不是写死的 1 */
              assert.ok(Number(info.ribbonOpacity) > 0 && Number(info.ribbonOpacity) < 1,
                `${where}：弦透明度应取自 token，实际 ${info.ribbonOpacity}`);
              checks += 1;
            }
          }
        }
      }
    }

    /* ── [CHORD-12/14] 交互 ── */
    await evaluate(cdp, setChordKnobs({ variant: 'undirected', labelLayout: 'arc', count: 6 }));
    await waitFor(cdp, "document.querySelectorAll('.stage__surface .dv-chord__arc').length === 6");
    const flow = await evaluate(cdp, exerciseInteraction);
    assert.equal(flow.initial.activeArcs, 0, '初始态不应有高亮');
    assert.ok(flow.hovered.activeArcs >= 2, 'hover 实体弧应连带高亮邻域');
    assert.ok(flow.hovered.activeRibbons > 0 && flow.hovered.dimRibbons > 0,
      'hover 时弦要分出高亮与压暗两组——否则高亮没有区分作用');
    assert.ok(flow.hovered.tooltip, 'hover 实体弧应出数据看板');
    assert.ok(flow.pinned.activeArcs >= 2, '点击应钉住');
    assert.ok(flow.afterLeave.activeArcs >= 2 && flow.afterLeave.tooltip,
      '钉住后移出应回落到钉住态，而不是清空');
    assert.equal(flow.closed.activeArcs, 0, '再点同一实体应关闭');
    checks += 1;

    /* ── [CHORD-07] 大弧标志 ── */
    const flags = await evaluate(cdp, exerciseLargeArc);
    assert.deepEqual(flags[0], ['11', '10'],
      '跨度超过半圈的实体：外弧应是大弧+顺时针、内弧应是大弧+反向（写反会自交成蝴蝶结）');
    assert.ok(flags.slice(1).every((f) => f[0] === '01' && f[1] === '00'),
      '跨度不足半圈的实体不应置大弧标志');
    checks += 1;

    /* ── [CHORD-16] 减弱动效 ── */
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    const motion = await evaluate(cdp, exerciseReducedMotion);
    assert.ok(motion.reduced, '减弱动效媒体查询未生效，本条判定无意义');
    assert.equal(motion.distinct, 1,
      `减弱动效下弦仍在生长：${motion.frames} 帧里出现了 ${motion.distinct} 个不同形态`);
    checks += 1;

    console.log(`✓ 弦图浏览器合同通过：${checks - 3} 个主题×明暗×形态×实体数 + 交互 / 大弧 / 减弱动效各 1`);
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
