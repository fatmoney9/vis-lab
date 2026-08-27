/*
 * hooks/lint-preview-contract.mjs —— L3 预览面契约守卫。
 * 被 hooks/check.sh 调用，也可单独跑：node hooks/lint-preview-contract.mjs
 *
 * 两条规则，都来自 2026-08-26 实际踩过的坑（当时门禁 10/10 全绿、四个问题全靠人眼发现）：
 *
 *   ① **L3 不许给图表宿主写高度**（`demos/` 下禁 `style.height=` / `setProperty('height'…)`
 *      / `setProperty('--…height'…)`）。高度归容器 CSS 与主题 token，L3 一旦用行内样式写死，
 *      **会压过预览面 `.is-resized .chart-host { height:100% }` 那条类规则，拖动直接失灵**；
 *      写成自定义属性再让组件读，则等于绕开组件 API 另开一条 L3→L2 私有通道。两种都发生过。
 *
 *   ② **两个预览面的容器下限必须一致**。playground 的 `.theme-card` 与 index 的
 *      `.stage__surface` 是同一个东西的两个实现——同一张图在两面必须显示成同一高度。
 *      曾经是 240 vs 160，且 index 的注释还写着「同 playground 卡片」，早已不成立。
 *
 * 本守卫只做机器能确定的事：找模式、比数字。**不判断某个高度值好不好**，那是设计的事。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SURFACES = [
  { file: 'playground/preview.html', selector: '.theme-card' },
  { file: 'index.html', selector: '.stage__surface' },
];

const findings = [];
const add = (file, line, msg) => findings.push({ file, line, msg });
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/* 注释替换成等长空白：偏移与换行不变，行号才算得准（同色值 / 字体守卫的手法） */
const blank = (m) => m.replace(/[^\n]/g, ' ');
const stripJs = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

/* ── ① demos/ 不许给宿主写高度 ── */
const walk = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (path.endsWith('.js')) acc.push(path);
  }
  return acc;
};

const HEIGHT_WRITES = [
  [/\.style\.height\s*=(?!=)/g, '给宿主写了行内 height'],
  [/setProperty\s*\(\s*['"`]height['"`]/g, "setProperty('height', …)"],
  [/setProperty\s*\(\s*['"`]--[^'"`]*height[^'"`]*['"`]/g, '注入了带 height 的自定义属性（等于绕开组件 API 的私有通道）'],
];
for (const file of walk('demos')) {
  const code = stripJs(readFileSync(file, 'utf8'));
  for (const [pattern, what] of HEIGHT_WRITES) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(code))) add(file, lineOf(code, m.index), `${what}——高度归容器 CSS 与主题 token`);
  }
}

/* ── ② 两个预览面的容器下限必须一致 ── */
const minOf = ({ file, selector }) => {
  const text = readFileSync(file, 'utf8');
  const at = text.indexOf(`${selector} {`);
  if (at === -1) return { file, selector, err: `找不到 \`${selector} {\` 规则块` };
  const block = text.slice(at, text.indexOf('}', at));
  const grab = (prop) => (block.match(new RegExp(`${prop}\\s*:\\s*([0-9]+)px`)) || [])[1];
  return { file, selector, w: grab('min-width'), h: grab('min-height'), line: lineOf(text, at) };
};
const [a, b] = SURFACES.map(minOf);
if (a.err || b.err) {
  add((a.err ? a : b).file, 0, (a.err || b.err) + '——预览面容器契约无法核对，选择器被改名了？');
} else if (a.w !== b.w || a.h !== b.h) {
  add(a.file, a.line, `容器下限 ${a.selector} = ${a.w}×${a.h}，但 ${b.file} 的 ${b.selector} = ${b.w}×${b.h}`
    + '——两面必须同口径，否则同一张图在两面显示成不同高度');
}

if (findings.length) {
  console.error('✗ [预览面契约]');
  for (const f of findings) console.error(`    ${f.file}${f.line ? `:${f.line}` : ''}  ${f.msg}`);
  process.exit(1);
}
console.log(`✓ 预览面契约守卫通过（demos/ 未给宿主写高度；两面容器下限同为 ${a.w}×${a.h}）`);
