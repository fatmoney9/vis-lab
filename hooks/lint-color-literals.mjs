/*
 * hooks/lint-color-literals.mjs —— 色值字面量守卫（WORKFLOW 第四节 拼接铁律 1）。
 * 被 hooks/check.sh 调用，也可单独跑：node hooks/lint-color-literals.mjs
 *
 * 规则：生产组件源码（charts/ 下 .js / .css）里不许出现色值字面量。
 * 元素色来自 tokens/<theme>.json 生成的 CSS 变量，系列色只在 tokens/palette.json 定义。
 * 写死一个颜色 = 该颜色从此不随主题、不随明暗、不随品牌改版而变，且**不会报错**——
 * 只是慢慢跟其余部分对不上。这类静默漂移正是守卫存在的理由。
 *
 * 范围为什么只到 charts/：铁律的措辞是「生产组件源码」。L3 的两个预览面与 demos/
 * 有自己的页面配色（主题选择器圆点、站点外壳），不走图表 token 链路，不在本条约束内。
 *
 * 唯一豁免 core/watermark-assets.js：生成物，色按 WATERMARK-01 烘焙在源 SVG 内、
 * 有意不走 token 链路（明暗各一份资源），改它要改 assets/watermarks/*.svg。
 *
 * 注释被整段剥离后才匹配——注释里说明「THS #52BBFF 当 1px 线够用」是正当的技术说明，
 * 拦它只会让人删掉有用的解释。剥离时保留原长度与换行，故报出的行号仍是真实行号。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const EXEMPT = new Set(['charts/core/watermark-assets.js']);

/* 关键字形态的合法值：它们表达「跟随上游」或「无色」，不是写死的颜色 */
const KEYWORD_OK = new Set(['transparent', 'currentcolor', 'inherit', 'none', 'unset', 'initial']);

const NAMED = [
  'white', 'black', 'red', 'green', 'blue', 'gray', 'grey', 'yellow', 'orange',
  'purple', 'pink', 'cyan', 'magenta', 'silver', 'gold', 'navy', 'teal',
  'lime', 'aqua', 'fuchsia', 'maroon', 'olive', 'brown',
].filter((name) => !KEYWORD_OK.has(name));

const PATTERNS = [
  [/#[0-9a-fA-F]{3,8}\b/g, '十六进制色值'],
  [/\brgba?\s*\(/g, 'rgb() / rgba()'],
  [/\bhsla?\s*\(/g, 'hsl() / hsla()'],
  /* 只认值位置（冒号后或引号内）的**小写**颜色名——大写多是英文文案，拦它是误报 */
  [new RegExp(`(?::\\s*|['"\`])(?:${NAMED.join('|')})\\b`, 'g'), '颜色名'],
];

const walk = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (path.endsWith('.js') || path.endsWith('.css')) acc.push(path);
  }
  return acc;
};

/* 注释替换成等长空白：偏移与换行都不变，行号才算得准 */
const blank = (match) => match.replace(/[^\n]/g, ' ');
function stripComments(text, isCss) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (!isCss) {
    /* (^|[^:]) 是为了避开 'http://www.w3.org/2000/svg' 这类 URL 里的双斜杠 */
    out = out.replace(/(^|[^:])\/\/[^\n]*/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
  }
  return out;
}

const findings = [];
for (const file of walk('charts')) {
  if (EXEMPT.has(file)) continue;
  const raw = readFileSync(file, 'utf8');
  const code = stripComments(raw, file.endsWith('.css'));
  for (const [pattern, what] of PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(code))) {
      findings.push({
        file,
        line: code.slice(0, match.index).split('\n').length,
        what,
        text: match[0].trim(),
      });
    }
  }
}

if (findings.length) {
  console.error('✗ [色值字面量] 生产组件源码里写死了颜色（拼接铁律 1）——改用 token 变量：');
  for (const f of findings) {
    console.error(`    ${f.file}:${f.line}  ${f.what}  「${f.text}」`);
  }
  console.error('    元素色 → tokens/<theme>.json；系列色 → tokens/palette.json。');
  process.exit(1);
}
console.log('✓ 色值字面量守卫通过（生产组件源码内无写死颜色）');
