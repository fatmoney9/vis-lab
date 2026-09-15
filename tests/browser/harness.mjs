/*
 * tests/browser/ 的公共壳：起一个只读静态服务器、拉起无头 Chrome、走 CDP 求值与轮询。
 *
 * 为什么单开一个文件：浏览器合同**按图型一个文件**，而这套壳与图表无关。
 * 抄第二份的代价不是行数，是两份壳会各自长出细节差异（超时、端口、Chrome 路径回落），
 * 到时候「瀑布过了弦图没过」分不清是图的问题还是壳的问题。
 *
 * 保持零 npm 依赖：只用 node 内置模块 + Chrome DevTools Protocol。
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
export const LOOPBACK = '127.0.0.1';
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

export async function chromeBinary() {
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

export function createStaticServer() {
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

export async function listen(server) {
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, LOOPBACK, resolvePromise);
  });
  return server.address().port;
}

export async function freePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

export async function waitForJson(url, timeout = 10000) {
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

export async function openCdp(wsUrl) {
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

export async function evaluate(cdp, expression) {
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

export async function waitFor(cdp, expression, timeout = 15000) {
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

export async function stopProcess(child, timeout = 2000) {
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
