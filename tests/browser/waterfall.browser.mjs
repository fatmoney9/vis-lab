/*
 * [WATERFALL-08/12/13] 瀑布图浏览器合同。
 *
 * 不读取源码 / CSS 文本，也不手写生产 SVG：直接打开主站、通过公开控件切换主题与端，
 * 再从真实 DOM / computed style 验收折行、Tooltip、指示线和轴贴片的可观察结果。
 * 使用 Chrome DevTools Protocol，保持仓库零 npm 依赖。
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const LOOPBACK = '127.0.0.1';
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function chromeBinary() {
  const candidates = [
    process.env.VIS_LAB_CHROME_BIN,
    /* GitHub 官方 Ubuntu Runner 提供的浏览器路径合同。 */
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // 继续尝试下一条显式路径。
    }
  }
  throw new Error('未找到 Chrome/Chromium；可通过 VIS_LAB_CHROME_BIN 指定浏览器可执行文件');
}

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${LOOPBACK}`);
      if (url.pathname === '/favicon.ico') {
        response.writeHead(204).end();
        return;
      }
      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const relative = normalize(pathname).replace(/^[/\\]+/, '');
      const file = resolve(ROOT, relative);
      if (isAbsolute(relative) || (file !== ROOT && !file.startsWith(`${ROOT}${sep}`))) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const body = await readFile(file);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500).end(String(error?.message ?? error));
    }
  });
}

async function listen(server) {
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, LOOPBACK, resolvePromise);
  });
  return server.address().port;
}

async function freePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

async function waitForJson(url, timeout = 10000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(50);
  }
  throw new Error(`Chrome 调试端口未就绪：${lastError?.message ?? 'timeout'}`);
}

async function openCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = pending.get(message.id);
      if (!callback) return;
      pending.delete(message.id);
      if (message.error) callback.reject(new Error(message.error.message));
      else callback.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails?.exception?.description
        ?? message.params.exceptionDetails?.text
        ?? '页面发生未处理异常');
    }
    if (message.method === 'Log.entryAdded' && message.params.entry?.level === 'error') {
      errors.push(message.params.entry.text);
    }
  });
  const send = (method, params = {}) => new Promise((resolvePromise, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolvePromise, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return {
    errors,
    send,
    close() {
      for (const { reject } of pending.values()) reject(new Error('CDP 连接已关闭'));
      pending.clear();
      socket.close();
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description
      ?? result.exceptionDetails.text
      ?? '浏览器表达式执行失败');
  }
  return result.result?.value;
}

async function waitFor(cdp, expression, timeout = 15000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      if (await evaluate(cdp, `Boolean(${expression})`)) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(50);
  }
  throw new Error(`浏览器条件等待超时：${expression}${lastError ? `（${lastError.message}）` : ''}`);
}

async function stopProcess(child, timeout = 2000) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolvePromise) => child.once('exit', resolvePromise));
  child.kill('SIGTERM');
  const stopped = await Promise.race([
    exited.then(() => true),
    sleep(timeout).then(() => false),
  ]);
  if (stopped) return;
  child.kill('SIGKILL');
  await exited;
}

const setMainState = ({ theme, platform, mode }) => `(() => {
  const change = (node) => node.dispatchEvent(new Event('change', { bubbles: true }));
  const choose = (key, value) => {
    const button = document.querySelector('[data-segment="' + key + '"] [data-value="' + value + '"]');
    if (button && !button.classList.contains('is-active')) button.click();
  };
  const select = document.querySelector('#theme-select');
  if (select) {
    if (select.value !== ${JSON.stringify(theme)}) {
      select.value = ${JSON.stringify(theme)};
      change(select);
    }
  } else {
    choose('theme', ${JSON.stringify(theme)});
  }
  choose('platform', ${JSON.stringify(platform)});
  choose('mode', ${JSON.stringify(mode)});
  const animation = document.querySelector('#animation-switch');
  if (animation?.checked) {
    animation.checked = false;
    change(animation);
  }
  return true;
})()`;

const inspectHover = (index) => `(() => {
  const hits = [...document.querySelectorAll('.dv-waterfall-hit')];
  const hit = hits[${index}];
  if (!hit) throw new Error('缺少瀑布命中区 ${index}');
  const hitRect = hit.getBoundingClientRect();
  hit.dispatchEvent(new MouseEvent('mouseenter', {
    bubbles: true,
    clientX: hitRect.left + hitRect.width / 2,
    clientY: hitRect.top + Math.max(1, hitRect.height / 2),
  }));

  const normal = [...document.querySelectorAll('.dv-waterfall-x-axis text.dv-axis-label')][${index}];
  const selected = document.querySelector('.dv-waterfall-hover text.dv-axis-tag-text');
  const background = document.querySelector('.dv-waterfall-hover rect.dv-axis-tag-bg');
  const crosshair = document.querySelector('.dv-waterfall-hover line.dv-crosshair-x');
  const tooltip = document.querySelector('.dv-chart--waterfall .dv-tooltip');
  if (!normal || !selected || !background || !crosshair || !tooltip) {
    throw new Error('hover 后缺少常态标签、贴片、指示线或 Tooltip');
  }

  const normalSpans = [...normal.querySelectorAll('tspan')];
  const selectedSpans = [...selected.querySelectorAll('tspan')];
  /* [TOOLTIP-09/12] 背景以文字 em 排版盒中心定位（与 Y 值徽标同源），故量排版盒而非字形墨迹。 */
  const textBox = selected.getBBox();
  const backgroundY = Number(background.getAttribute('y'));
  const backgroundHeight = Number(background.getAttribute('height'));
  const tooltipLabel = tooltip.querySelector('.dv-tooltip__label');
  const tooltipValue = tooltip.querySelector('.dv-tooltip__value');
  const labelRect = tooltipLabel?.getBoundingClientRect();
  const valueRect = tooltipValue?.getBoundingClientRect();

  return {
    normalY: normal.getAttribute('y'),
    selectedY: selected.getAttribute('y'),
    normalBaseline: normal.getAttribute('dominant-baseline'),
    selectedBaseline: selected.getAttribute('dominant-baseline'),
    normalDy: normalSpans.map((span) => span.getAttribute('dy')),
    selectedDy: selectedSpans.map((span) => span.getAttribute('dy')),
    normalFontSize: getComputedStyle(normal).fontSize,
    selectedFontSize: getComputedStyle(selected).fontSize,
    lines: selectedSpans.map((span) => span.textContent),
    topGap: textBox.y - backgroundY,
    bottomGap: backgroundY + backgroundHeight - (textBox.y + textBox.height),
    crosshairEnd: Number(crosshair.getAttribute('y2')),
    backgroundY,
    backgroundFill: getComputedStyle(background).fill,
    selectedFill: getComputedStyle(selected).fill,
    tooltipVisible: getComputedStyle(tooltip).display !== 'none',
    tooltipNoOverlap: !labelRect || !valueRect || labelRect.right <= valueRect.left + 0.5,
    tooltipValue: tooltipValue?.textContent ?? '',
    /* [TOOLTIP-01] 容器封顶：宽度对比图表根 */
    tooltipWidth: tooltip.getBoundingClientRect().width,
    chartWidth: tooltip.closest('.dv-chart')?.getBoundingClientRect().width ?? 0,
  };
})()`;

function assertHover(result, context, { expectPercent = false } = {}) {
  assert.equal(result.normalY, result.selectedY, `${context}：点击态文字 y 发生变化`);
  assert.equal(result.normalBaseline, result.selectedBaseline, `${context}：点击态基线发生变化`);
  assert.deepEqual(result.normalDy, result.selectedDy, `${context}：点击态逐行 dy 发生变化`);
  assert.equal(result.normalFontSize, result.selectedFontSize, `${context}：点击态字号发生变化`);
  assert.ok(Math.abs(result.topGap - result.bottomGap) <= 0.75,
    `${context}：贴片未以文字排版盒上下居中（${result.topGap} / ${result.bottomGap}）`);
  assert.ok(Math.abs(result.crosshairEnd - result.backgroundY) <= 0.01,
    `${context}：指示线没有连接贴片上沿`);
  assert.notEqual(result.backgroundFill, 'rgba(0, 0, 0, 0)', `${context}：贴片背景透明`);
  assert.notEqual(result.selectedFill, 'rgba(0, 0, 0, 0)', `${context}：贴片文字透明`);
  assert.equal(result.tooltipVisible, true, `${context}：Tooltip 未显示`);
  assert.equal(result.tooltipNoOverlap, true, `${context}：Tooltip 名称与数值重叠`);
  if (expectPercent) {
    assert.match(result.tooltipValue, /\([^)]*%\)$/, `${context}：Tooltip 未合并数值与百分比`);
  }
}

const inspectThreeLineFixture = `void (async () => {
  const surface = document.createElement('div');
  surface.dataset.theme = 'ainvest';
  surface.dataset.platform = 'pc';
  surface.dataset.mode = 'light';
  surface.style.cssText = 'position:fixed;left:-10000px;top:0;width:630px;height:320px';
  const host = document.createElement('div');
  surface.appendChild(host);
  document.body.appendChild(surface);
  const { WaterfallChart } = await import('./charts/charts/waterfall/index.js');
  const chart = WaterfallChart(host, {
    name: 'Profit Bridge',
    period: '2024 Q3',
    platform: 'pc',
    animation: false,
    xAxisContent: 'name-value',
    items: [
      { id: 'revenue', name: 'Revenue', kind: 'total', value: 100 },
      { id: 'cost', name: 'Cost of sales', kind: 'delta', value: -10, operatorBefore: '+' },
      { id: 'gross', name: 'Gross profit', kind: 'subtotal', value: 90, operatorBefore: '=' },
      { id: 'other', name: 'Other Expenses', kind: 'delta', value: -10, operatorBefore: '-' },
      { id: 'net', name: 'Net income', kind: 'total', value: 80, operatorBefore: '=' },
    ],
  });
  const hit = [...host.querySelectorAll('.dv-waterfall-hit')][3];
  const rect = hit.getBoundingClientRect();
  hit.dispatchEvent(new MouseEvent('mouseenter', {
    bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
  }));
  const selected = host.querySelector('.dv-axis-tag-text');
  const spans = [...selected.querySelectorAll('tspan')];
  const background = host.querySelector('.dv-axis-tag-bg');
  const textBox = selected.getBBox();
  const backgroundY = Number(background.getAttribute('y'));
  const backgroundHeight = Number(background.getAttribute('height'));
  window.__waterfallThreeLine = {
    lines: spans.map((span) => span.textContent),
    classes: spans.map((span) => span.getAttribute('class') ?? ''),
    topGap: textBox.y - backgroundY,
    bottomGap: backgroundY + backgroundHeight - (textBox.y + textBox.height),
  };
  chart.destroy();
  surface.remove();
})()`;

async function main() {
  const staticServer = createStaticServer();
  const sitePort = await listen(staticServer);
  const debugPort = await freePort();
  const profile = await mkdtemp(join(tmpdir(), 'vis-lab-chrome-'));
  const chrome = spawn(await chromeBinary(), [
    '--headless',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
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
    const page = await fetch(
      `http://${LOOPBACK}:${debugPort}/json/new`,
      { method: 'PUT' },
    ).then((response) => response.json());
    cdp = await openCdp(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Page.navigate', {
      url: `http://${LOOPBACK}:${sitePort}/#waterfall-bridge`,
    });
    await waitFor(cdp, "document.querySelectorAll('.dv-waterfall-hit').length === 5");

    const themes = ['ths', 'ifind-pc', 'ainvest'];
    const platforms = ['pc', 'mobile'];
    const modes = ['light', 'dark'];
    let checks = 0;
    /* [TOOLTIP-01] THS 移动端容器封顶真正「撞上」的次数。本合同 hover 的第 3 根柱读数
       自然宽 186.6px > 半容器 171.5px，是这条规则的触发用例；若将来数据变窄、再没有一次
       撞上封顶，下面的「≤ 半宽」断言就会空跑通过，故另立一道守卫要求至少撞上一次。 */
    let thsMobileCapped = 0;
    for (const theme of themes) {
      for (const platform of platforms) {
        for (const mode of modes) {
          await evaluate(cdp, setMainState({ theme, platform, mode }));
          await waitFor(cdp, "document.querySelectorAll('.dv-waterfall-hit').length === 5");
          for (const index of [3, 4]) {
            const result = await evaluate(cdp, inspectHover(index));
            assertHover(result, `${theme}/${platform}/${mode}/item-${index}`, {
              expectPercent: index === 3,
            });
            if (theme === 'ths' && platform === 'mobile') {
              const half = result.chartWidth / 2;
              assert.ok(result.tooltipWidth <= half + 0.5,
                `${theme}/${platform}/${mode}/item-${index}：THS 移动端 Tooltip 宽 ${result.tooltipWidth.toFixed(1)}px 超过容器的 1/2（${half.toFixed(1)}px）`);
              if (Math.abs(result.tooltipWidth - half) <= 0.5) thsMobileCapped++;
            }
            if (theme === 'ainvest' && index === 3) {
              assert.deepEqual(result.lines, ['Other', 'Expenses'],
                `${theme}/${platform}/${mode}：双行标签内容发生变化`);
            }
            checks++;
          }
        }
      }
    }

    assert.ok(thsMobileCapped > 0,
      'THS 移动端没有任何一次 hover 撞上容器封顶——「≤ 半宽」断言在空跑，换一根读数更宽的柱来验');

    await evaluate(cdp, inspectThreeLineFixture);
    await waitFor(cdp, 'window.__waterfallThreeLine');
    const threeLine = await evaluate(cdp, 'window.__waterfallThreeLine');
    assert.deepEqual(threeLine.lines, ['Other', 'Expenses', '-10'], 'name-value 贴片应保留三行');
    assert.match(threeLine.classes[2], /dv-waterfall-axis-value/, '数值行应保留数字强调类');
    assert.ok(Math.abs(threeLine.topGap - threeLine.bottomGap) <= 0.75,
      `三行贴片未以文字排版盒上下居中（${threeLine.topGap} / ${threeLine.bottomGap}）`);
    assert.deepEqual(cdp.errors, [], `浏览器控制台存在错误：\n${cdp.errors.join('\n')}`);
    console.log(`✓ 瀑布浏览器合同通过：${checks} 个主题×端×明暗×标签状态 + 1 个三行配置`);
  } catch (error) {
    if (cdp) {
      try {
        const diagnostics = await evaluate(cdp, `({
          href: location.href,
          title: document.title,
          readyState: document.readyState,
          body: document.body?.innerText?.slice(0, 500) ?? '',
        })`);
        error.message += `\n页面状态：${JSON.stringify(diagnostics)}\n页面错误：${cdp.errors.join(' | ')}`;
      } catch {
        // 保留原始失败；诊断信息本身不能掩盖验收错误。
      }
    }
    if (chromeError) error.message += `\nChrome stderr（末尾）：\n${chromeError.slice(-2000)}`;
    throw error;
  } finally {
    cdp?.close();
    await stopProcess(chrome);
    await new Promise((resolvePromise) => staticServer.close(resolvePromise));
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 8,
      retryDelay: 100,
    });
  }
}

await main();
