/*
 * 门禁 · 预览面 HTML 的内联脚本语法。
 *
 * 语法检查的 find 只认 .js / .mjs，而 index.html 与 playground/*.html 的主逻辑都写在内联
 * <script> 里；单测又加载不了它们。写坏了不会有任何检查报错，页面只是打不开。
 *
 * 内联模块写到临时文件后交给 node --check，只查语法、不执行；import map 按 JSON 解析。
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pages = [
  'index.html',
  ...readdirSync('playground').filter((file) => file.endsWith('.html')).map((file) => `playground/${file}`),
];
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
const dir = mkdtempSync(join(tmpdir(), 'vis-lab-inline-'));
const errors = [];
let checked = 0;

try {
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    for (const [, attrs, body] of html.matchAll(SCRIPT)) {
      if (/\bsrc=/.test(attrs)) continue;
      checked += 1;
      if (/type="importmap"/.test(attrs)) {
        try {
          JSON.parse(body);
        } catch (error) {
          errors.push(`${page} import map：${error.message}`);
        }
        continue;
      }
      const file = join(dir, `inline-${checked}.mjs`);
      writeFileSync(file, body);
      try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
      } catch (error) {
        errors.push(`${page} 内联脚本：\n${String(error.stderr).split(file).join(page)}`);
      }
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (errors.length) {
  console.error(`✗ [内联脚本] 语法错误：\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(`✓ 内联脚本守卫通过（${pages.length} 个预览面共 ${checked} 段脚本）`);
