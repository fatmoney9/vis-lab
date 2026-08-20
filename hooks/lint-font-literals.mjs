/*
 * hooks/lint-font-literals.mjs —— 字体引用守卫（与色值字面量守卫同源的一条铁律）。
 * 被 hooks/check.sh 调用，也可单独跑：node hooks/lint-font-literals.mjs
 *
 * 为什么不能照抄色值守卫：**颜色有语法，字体没有**。`#3366FF` / `rgb(…)` 一眼认得出，
 * 而 `THSJinRongTi` 和任意标识符长得一模一样，正则无从判断某个字符串是不是字体名。
 * 因此本守卫不找「字体名」，而是守住**声明字体的那几个位置**，要求值必须是 token。
 *
 * 三条规则：
 *   ① charts/**\/*.css 的 font-family 值必须是 var(--X)，且 --X 必须在 tokens/tokens.css
 *      里真实存在。「是个 var」不够——运行时注入的私有变量（.style('--dv-x-font-family', …)）
 *      同样是 var，却完全绕开主题通道，正是本守卫要抓的形态。顺带禁用 font 简写：
 *      它把 family 混在字号行高里，无法只对 family 这一段要求 token。
 *   ② charts/**\/*.js 不许**写**字体（.style()/.attr()/setProperty/setAttribute 传字体属性、
 *      直接给 .fontFamily 赋值、或在 JS 字符串里拼 `font-family:`）。JS 一旦能写字体
 *      （哪怕只是注入一个自定义属性），①的检查就被绕过去了。
 *      **读是放行的**：`getComputedStyle(el).fontFamily` 拿的是级联已解析的结果，
 *      正是「跟随 token」而非绕过它（core/measure.js 的 measureInk 就靠它把真实字体
 *      交给 Canvas 量墨迹）。本条 2026-08-20 由「出现即违规」收窄至此——
 *      原措辞把读也拦了，等于逼人绕开唯一正确的取值方式。
 *   ③ 字体名只许出现在三个主题文件 tokens/{ths,ifind-pc,ainvest}.json。
 *      其余 token 文件（sankey / behavior / palette）出现 font-family 类的键即违规。
 *      理由不是「那些文件一律不分主题」（tokens/sankey.json 的**颜色**就是按
 *      base/ths/ifind-pc/ainvest 分块的），而是**只有那三个主题文件进 token 合同**——
 *      tokens/build.mjs 校验它们键集一致、分叉完整并生成 CSS 变量；写在别处的字体
 *      既不受合同保护，也不保证有对应的主题分叉。sankey.json 的 typography 块正是
 *      这种情况：扁平一条、三主题共用，于是 iFinD / Ainvest 也在用 THS 的字体。
 *
 * 后果与颜色一致：写死的字体不随主题、不随品牌改版而变，且**不会报错**，
 * 只是在别的主题下和页面其余部分对不上。静默漂移正是守卫存在的理由。
 *
 * 范围为什么只到 charts/：与色值守卫同一条边界——铁律的措辞是「生产组件源码」。
 * L3 预览面与 demos/ 有自己的页面排版，不走图表 token 链路，不在本条约束内。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* 已知欠账：三处同属一个 bug（SANKEY-19 的桑基专属字体链绕开主题通道）。
   清掉时三处会一起消失；**新文件一律不得加进本列表**。 */
const DEBT = new Set([
  'charts/charts/sankey/styles.css',
  'charts/charts/sankey/index.js',
  'tokens/sankey.json',
]);

/* 字体名的唯一合法出处 */
const THEME_FILES = new Set(['ths.json', 'ifind-pc.json', 'ainvest.json']);

/* 表达「跟随上游」的关键字，不是写死的字体 */
const KEYWORD_OK = new Set(['inherit', 'unset', 'initial', 'revert']);

const walk = (dir, exts, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, exts, acc);
    else if (exts.some((ext) => path.endsWith(ext))) acc.push(path);
  }
  return acc;
};

/* 注释替换成等长空白：偏移与换行都不变，行号才算得准（与色值守卫同一手法） */
const blank = (match) => match.replace(/[^\n]/g, ' ');
function stripComments(text, isCss) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (!isCss) {
    /* (^|[^:]) 是为了避开 'http://…' 这类 URL 里的双斜杠 */
    out = out.replace(/(^|[^:])\/\/[^\n]*/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/* tokens.css 里真实定义过的变量名（由 tokens/build.mjs 生成，check.sh 第 1 步先重建） */
const tokensCss = readFileSync('tokens/tokens.css', 'utf8');
const DEFINED = new Set(Array.from(tokensCss.matchAll(/^\s*(--[\w-]+)\s*:/gm), (m) => m[1]));

const findings = [];
const add = (file, line, why) => findings.push({ file, line, why });

/* ① CSS：font-family 的值必须是 tokens.css 里定义过的 var；禁用 font 简写 */
for (const file of walk('charts', ['.css'])) {
  const code = stripComments(readFileSync(file, 'utf8'), true);

  for (const m of code.matchAll(/(?:^|[;{}\s])font\s*:/g)) {
    add(file, lineOf(code, m.index), '用了 font 简写——请拆开写 font-family 等各属性');
  }

  for (const m of code.matchAll(/(?:^|[;{}\s])font-family\s*:\s*([^;}]+)/g)) {
    const value = m[1].trim();
    const line = lineOf(code, m.index);
    if (KEYWORD_OK.has(value.toLowerCase())) continue;

    const vars = Array.from(value.matchAll(/var\(\s*(--[\w-]+)/g), (v) => v[1]);
    /* 去掉所有 var(...) 后若还剩东西，说明混了裸字体名 */
    const rest = value.replace(/var\([^)]*\)/g, '').replace(/[,\s]/g, '');
    if (!vars.length || rest) {
      add(file, line, `字体值不是 token 引用：「${value}」`);
      continue;
    }
    for (const name of vars) {
      if (!DEFINED.has(name)) {
        add(file, line, `${name} 不是 token（tokens.css 里没有定义）——多半是运行时注入的私有变量，绕开了主题通道`);
      }
    }
  }
}

/* ② JS：不许**写**字体（读放行，见顶部说明） */
const JS_WRITES = [
  /\.(?:style|attr)\s*\(\s*['"`][^'"`]*font-family/g,
  /set(?:Property|Attribute)\s*\(\s*['"`][^'"`]*font-family/g,
  /\.fontFamily\s*=(?!=)/g,
  /['"`][^'"`]*font-family\s*:/g, /* JS 字符串里拼的内联样式 */
];
for (const file of walk('charts', ['.js'])) {
  const code = stripComments(readFileSync(file, 'utf8'), false);
  for (const pattern of JS_WRITES) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(code))) {
      add(file, lineOf(code, m.index), 'JS 里写了字体——字体只在 CSS 里声明，否则规则①的 token 检查会被绕过');
    }
  }
}

/* ③ 字体名只许出现在三个主题 token 文件里 */
for (const file of walk('tokens', ['.json'])) {
  if (THEME_FILES.has(file.slice('tokens/'.length))) continue;
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/"[\w-]*font[\w-]*family[\w-]*"\s*:/gi)) {
    add(file, lineOf(text, m.index), '非主题 token 文件里写了字体——只有三个主题文件进 token 合同（build.mjs 校验分叉完整），写在别处的字体不保证随主题变');
  }
}

/* 欠账文件：允许违规，但**必须仍在违规**——否则这份列表自己会变成过期副本 */
const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

let failed = false;
for (const [file, list] of byFile) {
  if (DEBT.has(file)) continue;
  failed = true;
  console.error(`✗ [字体引用] ${file}：`);
  for (const f of list) console.error(`    第 ${f.line} 行  ${f.why}`);
}
for (const file of DEBT) {
  if (byFile.has(file)) continue;
  failed = true;
  console.error(`✗ [字体引用] ${file} 已不再违规，请从 hooks/lint-font-literals.mjs 的 DEBT 列表里删除该行`);
}

if (failed) {
  console.error('    字体只经三个主题文件 tokens/{ths,ifind-pc,ainvest}.json 下发，组件侧一律 var(--font-family-*)。');
  process.exit(1);
}
console.log(`✓ 字体引用守卫通过（组件侧字体均为 token 引用；已知欠账 ${DEBT.size} 项）`);
