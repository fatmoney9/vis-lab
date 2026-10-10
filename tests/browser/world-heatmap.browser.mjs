/*
 * [WORLD-HEATMAP-01..08][TOOLTIP-01/02/03/10] 全球热力图浏览器合同。
 *
 * 复用主站真实 import map / token / 样式，并通过公开 L2 API 挂载隔离夹具；
 * 不读源码文本、不手写 SVG。几何、焦点、图片与滚动生命周期都从真实 DOM 验收。
 * Tab 使用 CDP 的真实键盘输入，不能用逐个 .focus() 代替顺序导航断言。
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

/* 普通 HTML 外壳属于测试夹具，国家与描边 SVG 只能由 WorldHeatmapChart 生成。 */
async function setupFixture() {
  const { WorldHeatmapChart } = await import('/charts/charts/world-heatmap/index.js');
  const fixture = document.createElement('section');
  fixture.id = 'world-heatmap-contract';
  Object.assign(fixture.style, {
    position: 'fixed', top: '20px', left: '20px', zIndex: '100000',
    background: 'white', padding: '10px', width: '700px',
  });
  const scroller = document.createElement('div');
  Object.assign(scroller.style, { height: '470px', overflow: 'auto' });
  const before = document.createElement('button');
  before.id = 'world-heatmap-before';
  before.textContent = 'Before';
  const host = document.createElement('div');
  const after = document.createElement('button');
  after.id = 'world-heatmap-after';
  after.textContent = 'After';
  const spacer = document.createElement('div');
  spacer.style.height = '900px';
  scroller.append(before, host, after, spacer);
  fixture.append(scroller);
  document.body.append(fixture);

  /* 只记录本夹具挂载后新增的 scroll 监听，并保留原生事件行为。
     按 target/callback/capture 对账，避免「销毁后图表没 DOM」冒充监听清理。 */
  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;
  const scrollListeners = [];
  const captureOf = (options) => typeof options === 'boolean' ? options : Boolean(options?.capture);
  EventTarget.prototype.addEventListener = function (type, callback, options) {
    if (type === 'scroll' && !scrollListeners.some((item) =>
      item.target === this && item.callback === callback && item.capture === captureOf(options))) {
      scrollListeners.push({ target: this, callback, capture: captureOf(options) });
    }
    return originalAdd.call(this, type, callback, options);
  };
  EventTarget.prototype.removeEventListener = function (type, callback, options) {
    if (type === 'scroll') {
      const index = scrollListeners.findIndex((item) => item.target === this
        && item.callback === callback && item.capture === captureOf(options));
      if (index !== -1) scrollListeners.splice(index, 1);
    }
    return originalRemove.call(this, type, callback, options);
  };
  let chart;
  const regions = [
    { id: 'BR', name: 'Brazil', value: 0 },
    { id: 'CN', name: 'China', value: 5 },
    { id: 'IN', name: 'India', value: 2 },
  ];
  const order = () => [...host.querySelectorAll('.dv-world-heatmap__country')]
    .map((node) => node.dataset.region);
  const dataOrder = () => [...host.querySelectorAll('.dv-world-heatmap__country[tabindex="0"]')]
    .map((node) => node.dataset.region);
  const tip = () => host.querySelector('.dv-tooltip');
  const activeCount = () => host.querySelectorAll('.dv-world-heatmap__country.is-active').length;
  const listenerState = () => ({
    count: scrollListeners.length,
    capture: scrollListeners.every((item) => item.capture),
  });
  const point = (node) => {
    const box = node.getBoundingClientRect();
    return { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
  };
  const enter = (id, type = 'mouseenter') => {
    const node = host.querySelector('[data-region="' + id + '"]');
    node.dispatchEvent(new MouseEvent(type, point(node)));
    return node;
  };
  const state = () => ({
    visible: Boolean(tip()?.classList.contains('is-visible')),
    active: activeCount(),
    outlines: host.querySelectorAll('.dv-world-heatmap__outline').length,
    order: order(),
  });
  window.__worldHeatmapContract = {
    host, scroller, before, after, regions, order, dataOrder, enter, state, listenerState,
    mount({ theme = 'ths', platform = 'pc', mode = 'light', customRegions, width, height } = {}) {
      chart?.destroy();
      scroller.scrollTop = 0;
      Object.assign(fixture.dataset, { theme, platform, mode });
      Object.assign(host.style, {
        width: (width ?? (platform === 'mobile' ? 343 : 600)) + 'px',
        height: (height ?? (platform === 'mobile' ? 206 : 360)) + 'px',
      });
      chart = WorldHeatmapChart(host, {
        name: 'World heatmap contract', platform, regions: customRegions ?? regions,
      });
      return {
        countries: order().length, dataOrder: dataOrder(),
        emptyTabs: [...host.querySelectorAll('.dv-world-heatmap__country:not(.has-data)')]
          .filter((node) => node.hasAttribute('tabindex')).length,
        zeroHasData: host.querySelector('[data-region="BR"]').classList.contains('has-data'),
        normalWidths: [...host.querySelectorAll('.dv-world-heatmap__shape')]
          .map((node) => getComputedStyle(node).strokeWidth),
        listeners: listenerState(),
      };
    },
    geometry() {
      const svg = host.querySelector('.dv-world-heatmap');
      const matrix = host.querySelector('.dv-world-heatmap__map').getCTM();
      /* [WORLD-HEATMAP-02] 规范视框是 1000×600，验证其四角在真实 SVG viewport 内；
         不能仅看国家计数或描边副本与原路径是否对齐。 */
      const corners = [[0, 0], [1000, 0], [1000, 600], [0, 600]]
        .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
      return {
        viewport: { width: svg.width.baseVal.value, height: svg.height.baseVal.value },
        matrix: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d },
        mapped: {
          left: Math.min(...corners.map((point) => point.x)),
          right: Math.max(...corners.map((point) => point.x)),
          top: Math.min(...corners.map((point) => point.y)),
          bottom: Math.max(...corners.map((point) => point.y)),
        },
      };
    },
    emptyData() {
      enter('CN');
      const sample = document.createElement('span');
      sample.style.color = 'var(--color-world-heatmap-empty)';
      host.append(sample);
      const expectedFill = getComputedStyle(sample).color;
      sample.remove();
      return {
        ...state(), countries: order().length,
        hasData: host.querySelectorAll('.dv-world-heatmap__country.has-data').length,
        tabs: host.querySelectorAll('.dv-world-heatmap__country[tabindex]').length,
        fills: [...host.querySelectorAll('.dv-world-heatmap__shape')].map((node) => ({
          fill: getComputedStyle(node).fill, opacity: getComputedStyle(node).fillOpacity,
        })),
        expectedFill,
      };
    },
    inspect(id, useFocus = false) {
      const originalOrder = order();
      const node = useFocus ? host.querySelector('[data-region="' + id + '"]') : enter(id);
      if (useFocus) node.focus({ preventScroll: true });
      const shapes = [...node.querySelectorAll('.dv-world-heatmap__shape')];
      const overlay = host.querySelector('.dv-world-heatmap__highlight');
      const outlines = [...host.querySelectorAll('.dv-world-heatmap__outline')];
      const sample = document.createElement('span');
      sample.style.color = 'var(--color-world-heatmap-highlight)';
      host.append(sample);
      const expectedStroke = getComputedStyle(sample).color;
      sample.remove();
      return {
        originalOrder, order: order(), visible: state().visible,
        activeId: host.querySelector('.dv-world-heatmap__country.is-active')?.dataset.region,
        focusedId: document.activeElement?.dataset.region ?? document.activeElement?.id,
        focusTargetTab: node.getAttribute('tabindex'),
        paths: shapes.map((path) => path.getAttribute('d')),
        outlines: outlines.map((path) => ({
          d: path.getAttribute('d'), stroke: getComputedStyle(path).stroke,
          width: getComputedStyle(path).strokeWidth, fill: getComputedStyle(path).fill,
          vectorEffect: getComputedStyle(path).vectorEffect,
          pointerEvents: getComputedStyle(path).pointerEvents,
        })),
        overlayTransform: overlay?.getAttribute('transform'),
        countryTransform: node.getAttribute('transform'),
        overlayHidden: overlay?.getAttribute('aria-hidden'),
        overlayTabs: overlay?.querySelectorAll('[tabindex]').length ?? 0,
        expectedStroke,
        title: tip()?.querySelector('.dv-tooltip__title-label')?.textContent,
        value: tip()?.querySelector('.dv-tooltip__title-value')?.textContent,
        valueFont: getComputedStyle(tip().querySelector('.dv-tooltip__title-value')).fontFamily,
        tooltipFont: getComputedStyle(tip()).fontFamily,
        iconSrc: tip()?.querySelector('img')?.src,
      };
    },
    leave(id) {
      const node = host.querySelector('[data-region="' + id + '"]');
      node.dispatchEvent(new MouseEvent('mouseleave'));
      node.blur();
      return state();
    },
    async ancestorScroll() {
      enter('CN');
      scroller.scrollTop = 15;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return state();
    },
    windowScroll() {
      enter('CN');
      window.dispatchEvent(new Event('scroll'));
      return state();
    },
    longTitle() {
      enter('CN');
      const tooltip = tip();
      const label = tooltip.querySelector('.dv-tooltip__title-label');
      const value = tooltip.querySelector('.dv-tooltip__title-value');
      const box = tooltip.getBoundingClientRect();
      const labelBox = label.getBoundingClientRect();
      const valueBox = value.getBoundingClientRect();
      return {
        tooltipWidth: box.width, hostWidth: host.getBoundingClientRect().width,
        wrapped: labelBox.height > parseFloat(getComputedStyle(label).lineHeight) + 1,
        labelInside: labelBox.left >= box.left && labelBox.right <= box.right + 0.5,
        labelNoOverflow: label.scrollWidth <= label.clientWidth + 1,
        valueInside: valueBox.left >= box.left && valueBox.right <= box.right + 0.5,
        noOverlap: labelBox.right <= valueBox.left + 0.5,
        value: value.textContent,
      };
    },
    flagState() {
      const image = tip().querySelector('img');
      const fallback = tip().querySelector('.dv-tooltip__title-icon-fallback');
      return {
        src: image.src, loaded: image.complete && image.naturalWidth > 0,
        imageVisible: getComputedStyle(image).display !== 'none',
        fallbackVisible: getComputedStyle(fallback).display !== 'none',
        fallback: fallback.textContent,
      };
    },
    resize(width) { enter('CN'); host.style.width = width + 'px'; },
    destroy() {
      chart.destroy(); chart = null;
      window.dispatchEvent(new Event('scroll'));
      return { children: host.childElementCount, listeners: listenerState() };
    },
    cleanup() {
      chart?.destroy();
      EventTarget.prototype.addEventListener = originalAdd;
      EventTarget.prototype.removeEventListener = originalRemove;
      fixture.remove();
    },
  };
}

function assertGeometry({ viewport, matrix, mapped }, context) {
  /* SVG transform 底层可存 float32，1e-6 容差避免把正常 0.6 的二进制误差当拉伸。 */
  assert.ok(matrix.a > 0 && Math.abs(matrix.a - matrix.d) < 1e-6
    && Math.abs(matrix.b) < 1e-6 && Math.abs(matrix.c) < 1e-6,
  `${context}：底图必须正向等比缩放，不能拉伸或旋转`);
  assert.ok(Math.abs(matrix.a - Math.min(viewport.width / 1000, viewport.height / 600)) < 1e-6,
    `${context}：1000×600 视框应使用完整 contain 缩放`);
  assert.ok(mapped.left >= -0.01 && mapped.top >= -0.01
    && mapped.right <= viewport.width + 0.01 && mapped.bottom <= viewport.height + 0.01,
  `${context}：完整底图视框不得越出 SVG viewport ${JSON.stringify({ viewport, mapped })}`);
  assert.ok(Math.abs((mapped.left + mapped.right) / 2 - viewport.width / 2) < 0.01
    && Math.abs((mapped.top + mapped.bottom) / 2 - viewport.height / 2) < 0.01,
  `${context}：完整底图视框必须水平和垂直居中`);
}

async function main() {
  const server = createStaticServer();
  const port = await listen(server);
  const debugPort = await freePort();
  const profile = await mkdtemp(join(tmpdir(), 'world-heatmap-chrome-'));
  const chrome = spawn(await chromeBinary(), [
    '--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox',
    '--no-first-run', '--window-size=1400,1000',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
  ], { stdio: 'ignore' });
  let cdp;
  let checks = 0;
  try {
    await waitForJson(`http://${LOOPBACK}:${debugPort}/json/version`);
    const page = await fetch(`http://${LOOPBACK}:${debugPort}/json/new`, { method: 'PUT' })
      .then((response) => response.json());
    cdp = await openCdp(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Page.navigate', { url: `http://${LOOPBACK}:${port}/index.html` });
    const gallerySelector = '.example-card[data-chart="world-heatmap"] .dv-world-heatmap__country';
    await waitFor(cdp, `document.querySelectorAll(${JSON.stringify(gallerySelector)}).length === 256`, 25000);
    const gallery = await evaluate(cdp, `([...document.querySelectorAll(${JSON.stringify(gallerySelector)})]
      .every((node) => getComputedStyle(node).pointerEvents === 'none'
        && [...node.querySelectorAll('path')].every((path) => getComputedStyle(path).pointerEvents === 'none')))`);
    assert.equal(gallery, true, '画廊国家不得覆盖继承的 pointer-events:none');
    await evaluate(cdp, `(${setupFixture.toString()})()`);
    const call = (expression) => evaluate(cdp, `window.__worldHeatmapContract.${expression}`);

    for (const theme of ['ths', 'ifind-pc', 'ainvest']) {
      for (const platform of ['pc', 'mobile']) {
        for (const mode of ['light', 'dark']) {
          const where = `${theme}/${platform}/${mode}`;
          const mounted = await call(`mount(${JSON.stringify({ theme, platform, mode })})`);
          assert.equal(mounted.countries, 256, `${where}：底图国家数`);
          assert.equal(mounted.dataOrder.length, 3, `${where}：有数据 Tab 数`);
          assert.equal(mounted.emptyTabs, 0, `${where}：无数据国家不得进入 Tab`);
          assert.equal(mounted.zeroHasData, true, `${where}：真实 0 应保留`);
          assertGeometry(await call('geometry()'), where);
          assert.ok(mounted.normalWidths.every((width) => width === '0.5px'), `${where}：常态国界必须 0.5px`);
          assert.ok(mounted.listeners.count > 0 && mounted.listeners.capture, `${where}：scroll 监听须使用 capture`);
          await call('enter("DE")');
          assert.equal((await call('state()')).visible, false, `${where}：无数据国家不得触发 Tooltip`);

          for (const [id, focus] of [['CN', false], ['IN', true], ['BR', false]]) {
            const r = await call(`inspect(${JSON.stringify(id)}, ${focus})`);
            assert.deepEqual(r.order, r.originalOrder, `${where}/${id}：强调不得重排国家 DOM`);
            assert.equal(r.activeId, id, `${where}/${id}：应激活命中国家（focus ${r.focusedId}; tabindex ${r.focusTargetTab}; visible ${r.visible}）`);
            assert.equal(r.visible, true, `${where}/${id}：应显示 Tooltip`);
            assert.equal(r.valueFont, r.tooltipFont, `${where}/${id}：标题数值须与共享 Tooltip 字体同源`);
            assert.deepEqual(r.outlines.map((outline) => outline.d), r.paths, `${where}/${id}：所有国界/离岛路径应有描边`);
            assert.equal(r.overlayTransform, r.countryTransform, `${where}/${id}：描边应对齐国家路径`);
            assert.equal(r.overlayHidden, 'true', `${where}/${id}：描边层须对读屏隐藏`);
            assert.equal(r.overlayTabs, 0, `${where}/${id}：装饰层不得进入 Tab`);
            assert.ok(r.outlines.every((outline) => outline.width === '0.5px'
              && outline.stroke === r.expectedStroke && outline.fill === 'none'
              && outline.vectorEffect === 'non-scaling-stroke' && outline.pointerEvents === 'none'),
            `${where}/${id}：描边需遵循主题、0.5px、非缩放且不命中`);
            if (id === 'BR') assert.equal(r.value, '0', `${where}：Tooltip 保留真实 0`);
            const left = await call(`leave(${JSON.stringify(id)})`);
            assert.equal(left.visible, false, `${where}/${id}：离开应隐藏 Tooltip`);
            assert.equal(left.active, 0, `${where}/${id}：离开应清除强调`);
          }
          for (const method of ['ancestorScroll()', 'windowScroll()']) {
            const r = await call(method);
            assert.equal(r.visible, false, `${where}/${method}：滚动应立即隐藏气泡`);
            assert.equal(r.active, 0, `${where}/${method}：滚动应同步清除国家强调`);
            assert.equal(r.outlines, 0, `${where}/${method}：滚动应清空描边副本`);
          }
          checks++;
        }
      }
    }

    /* 特意打破 1000:600 的容器比例：默认比例可能掩盖非等比/偏心缩放错误。 */
    await call('mount({ width: 600, height: 260 })');
    assertGeometry(await call('geometry()'), '非标准 600×260 容器');

    for (const theme of ['ths', 'ifind-pc', 'ainvest']) {
      for (const mode of ['light', 'dark']) {
        await call(`mount(${JSON.stringify({ theme, mode, customRegions: [] })})`);
        const empty = await call('emptyData()');
        const where = `${theme}/${mode}/空数据`;
        assert.equal(empty.countries, 256, `${where}：空数据仍保留完整底图`);
        assert.equal(empty.hasData, 0, `${where}：不能标记有数据国家`);
        assert.equal(empty.tabs, 0, `${where}：不能包含国家 Tab 入口`);
        assert.equal(empty.visible, false, `${where}：hover 不得显示 Tooltip`);
        assert.equal(empty.active, 0, `${where}：不能激活国家`);
        assert.equal(empty.outlines, 0, `${where}：不能生成强调描边`);
        assert.ok(empty.fills.length > 0 && empty.fills.every((shape) =>
          shape.fill === empty.expectedFill && shape.opacity === '1'),
        `${where}：所有国家应使用主题中性底色，不叠加强度透明度`);
      }
    }

    /* 不用主动 focus 国家替代 Tab：真实键盘必须按原国家顺序逐个访问，再退出地图。 */
    const keyboard = await call(`mount(${JSON.stringify({ theme: 'ths', platform: 'pc', mode: 'light' })})`);
    await call('before.focus()');
    for (const expected of [...keyboard.dataOrder, 'world-heatmap-after']) {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      const focused = await evaluate(cdp, 'document.activeElement.dataset.region ?? document.activeElement.id');
      assert.equal(focused, expected, '真实 Tab 不得跳过国家或重复焦点');
    }
    assert.equal((await call('state()')).visible, false, 'Tab 离开地图后应隐藏 Tooltip');

    for (const theme of ['ths', 'ifind-pc', 'ainvest']) {
      for (const platform of ['pc', 'mobile']) {
        await call(`mount(${JSON.stringify({ theme, platform, mode: 'light', customRegions: [
          { id: 'CN', name: 'UnbrokenCountryIdentifier'.repeat(10), value: 123.45 },
        ] })})`);
        const r = await call('longTitle()');
        assert.equal(r.wrapped, true, `${theme}/${platform}：无空格长名应换行`);
        assert.ok(r.labelInside && r.labelNoOverflow && r.valueInside && r.noOverlap,
          `${theme}/${platform}：长名不得溢出气泡/挤出数值 ${JSON.stringify(r)}`);
        if (theme === 'ths' && platform === 'mobile') {
          assert.ok(Math.abs(r.tooltipWidth - r.hostWidth / 2) <= 0.5, 'THS mobile 长名应触发 1/2 容器封顶');
        }
      }
    }

    await call('mount()');
    await call('enter("CN")');
    await waitFor(cdp, 'window.__worldHeatmapContract.flagState().loaded');
    const flag = await call('flagState()');
    assert.match(flag.src, /\/assets\/country-flags\/cn\.svg$/, '国旗应随本站本地发布');
    assert.ok(flag.imageVisible && !flag.fallbackVisible, '成功图片应显示且不占兜底槽');
    await call(`mount(${JSON.stringify({ customRegions: [
      { id: 'CN', name: 'China', value: 1, flagUrl: '/assets/country-flags/nonexistent-contract-flag.svg' },
    ] })})`);
    await call('enter("CN")');
    await waitFor(cdp, 'window.__worldHeatmapContract.flagState().fallbackVisible');
    const failedFlag = await call('flagState()');
    assert.ok(!failedFlag.imageVisible && failedFlag.fallbackVisible, '失败图片应使用回退而非破图');
    assert.equal(failedFlag.fallback, 'C', '回退只使用国家首字符，不用 emoji');
    await call('enter("CN", "mousemove")');
    await sleep(100);
    const repeatedFlag = await call('flagState()');
    assert.ok(!repeatedFlag.imageVisible && repeatedFlag.fallbackVisible, 'mousemove 不得将失败回退重置成破图');

    await call('mount()');
    const beforeResize = await call('listenerState()');
    await call('resize(420)');
    await waitFor(cdp, 'Number(window.__worldHeatmapContract.host.querySelector("svg").getAttribute("width")) === 420');
    assert.deepEqual(await call('listenerState()'), beforeResize, 'resize 重建不得重复积累 scroll 监听');
    assert.equal((await call('state()')).visible, false, 'resize 应清理旧 Tooltip');
    const destroyed = await call('destroy()');
    assert.equal(destroyed.children, 0, 'destroy 应清空图表 DOM');
    assert.equal(destroyed.listeners.count, 0, 'destroy 应移除 scroll 监听');
    await call('cleanup()');
    assert.deepEqual(cdp.errors, [], `浏览器未处理异常：${cdp.errors.join('\n')}`);
    console.log(`✓ 全球热力图浏览器合同通过：${checks} 个主题×端×明暗状态 + 等比居中 / 非标准容器 / 空数据 / Tab / 长名 / 国旗 / 生命周期 / 画廊`);
  } catch (error) {
    if (cdp) {
      try {
        const diagnostics = await evaluate(cdp, `({
          href: location.href, readyState: document.readyState,
          countries: document.querySelectorAll('.dv-world-heatmap__country').length,
          body: document.body?.innerText?.slice(0, 250) ?? '',
        })`);
        error.message += `\n页面状态：${JSON.stringify(diagnostics)}\n页面错误：${cdp.errors.join(' | ')}`;
      } catch {
        // 诊断失败不能覆盖原始测试失败。
      }
    }
    throw error;
  } finally {
    cdp?.close();
    await stopProcess(chrome);
    await new Promise((resolve) => server.close(resolve));
    await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }
}

await main();
