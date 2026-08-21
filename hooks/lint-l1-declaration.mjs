/*
 * hooks/lint-l1-declaration.mjs —— L1 复用声明守卫。
 * 被 hooks/check.sh 调用，也可单独跑：node hooks/lint-l1-declaration.mjs
 *
 * 规则：每个 L2 图型（charts/charts/<名>/）必须有一份 README.md，用一张表把 charts/core/ 下
 * **每一个** L1 模块交代清楚——要么「用」，要么「不用：<理由>」。
 *
 * 为什么值得上守卫：**「悄悄不用一个 L1」是 L2 长成第二套 L1 的起点**，而它恰恰不会报错。
 * 少用一个 L1 不会红、不会崩，只是那份能力被在 L2 又实现了一遍；等发现时，两份实现已经
 * 各自长出细节差异，合并回去的成本远高于当初直接复用。**声明的作用是把这个决定从
 * 「默认发生」变成「必须解释」**——写不出正当理由的那几条，往往就是该复用的那几条。
 *
 * **本守卫不判断理由好不好——那是人的事**。它只保证三件机器能确定的事：
 *   ① 每个 L1 模块都被交代过（没写 = 悄悄不用 → 红）
 *   ② 声明与代码里的 import 逐条对得上（说用了却没 import、或 import 了却没声明 → 红）
 *   ③ 「不用」必须带理由，且不能是敷衍的空话
 * ②是关键：它让这张表**没法退化成打勾的表格**——一旦代码变了而声明没跟，门禁立刻红。
 *
 * 排除 watermark-assets.js：它是生成物（资源数据），由 watermark.js 消费，L2 本就不该直接 import。
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* 已知欠账：清掉一条就删一行；**新图型一律不得加进本列表**。 */
const DEBT = new Set(['sankey']);

const L2_ROOT = 'charts/charts';
const L1_ROOT = 'charts/core';
const GENERATED = new Set(['watermark-assets']); /* 生成物，非能力模块 */
const HEADING = 'L1 复用声明';
const MIN_REASON = 6; /* 理由下限：挡住「无」「不需要」这类等于没写的字 */

const l1Modules = readdirSync(L1_ROOT)
  .filter((f) => f.endsWith('.js'))
  .map((f) => f.slice(0, -3))
  .filter((m) => !GENERATED.has(m))
  .sort();

const families = readdirSync(L2_ROOT).filter((d) => statSync(join(L2_ROOT, d)).isDirectory()).sort();

/* 代码侧事实：该图型实际 import 了哪些 L1 */
const importsOf = (dir) => {
  const src = readdirSync(dir).filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  return new Set(l1Modules.filter((m) => new RegExp(`core/${m}\\.js`).test(src)));
};

/* 声明侧事实：README 表里每个模块写了什么。行形如 | `axis` | 用 | 或 | `axis` | 不用：理由 | */
const ROW = /^\|\s*`([\w-]+)`\s*\|\s*([^|]*?)\s*\|\s*$/;
function parseDeclaration(text) {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.startsWith('#') && l.includes(HEADING));
  if (at === -1) return null;
  const rows = new Map();
  const dupes = [];
  for (const line of lines.slice(at)) {
    if (line.startsWith('#') && !line.includes(HEADING)) break; /* 下一节开始 */
    const m = ROW.exec(line);
    if (!m) continue;
    if (rows.has(m[1])) dupes.push(m[1]);
    rows.set(m[1], m[2]);
  }
  return { rows, dupes };
}

const HOWTO = [
  `    怎么补：在该目录下建 README.md，加一节「## ${HEADING}」，用下表交代每一个 L1 模块——`,
  '      | L1 模块 | 状态 |',
  '      |---|---|',
  '      | `axis` | 用 |',
  '      | `crosshair` | 不用：无坐标轴，没有指示线可言 |',
  '    「用」必须与代码里的 import 一致；「不用」必须写清为什么（≥6 字，不能是「无」「不需要」）。',
  '    照抄现成的：charts/charts/cartesian/README.md · charts/charts/pie/README.md',
].join('\n');

let failed = false;
const fail = (msg) => { failed = true; console.error(msg); };

for (const family of families) {
  const dir = join(L2_ROOT, family);
  const readme = join(dir, 'README.md');
  const isDebt = DEBT.has(family);

  const declared = existsSync(readme) ? parseDeclaration(readFileSync(readme, 'utf8')) : null;
  if (!declared) {
    if (isDebt) continue; /* 欠账：允许暂缺 */
    fail(`✗ [L1 声明] ${family}：缺 ${readme} 里的「${HEADING}」小节。\n${HOWTO}`);
    continue;
  }
  if (isDebt) {
    fail(`✗ [L1 声明] ${family} 已经补上声明了，请从 hooks/lint-l1-declaration.mjs 的 DEBT 列表里删除该行——`
      + '留着它会让这份欠账清单变成过期副本，且该图型从此不再受本守卫检查。');
    continue;
  }

  const used = importsOf(dir);
  const problems = [];

  for (const d of declared.dupes) problems.push(`\`${d}\` 在表里出现了多次`);
  for (const m of declared.rows.keys()) {
    if (!l1Modules.includes(m)) {
      problems.push(`表里的 \`${m}\` 不是 L1 模块（${L1_ROOT}/ 下没有它）——多半是改名后声明没跟上`);
    }
  }
  for (const m of l1Modules) {
    const cell = declared.rows.get(m);
    if (cell === undefined) {
      problems.push(`\`${m}\` 没有交代（${used.has(m) ? '代码里 import 了它' : '**代码里没用它——这正是本守卫要抓的「悄悄不用」**'}）`);
      continue;
    }
    if (cell === '用') {
      if (!used.has(m)) problems.push(`\`${m}\` 声明为「用」，但代码里没有 import——声明过期了`);
    } else if (cell.startsWith('不用')) {
      const reason = cell.replace(/^不用[：:]?\s*/, '').trim();
      if (used.has(m)) problems.push(`\`${m}\` 声明为「不用」，但代码里 import 了它——声明过期了`);
      else if (reason.length < MIN_REASON) problems.push(`\`${m}\` 的「不用」没写清理由（当前「${reason || '空'}」，需 ≥${MIN_REASON} 字）`);
    } else {
      problems.push(`\`${m}\` 的状态列只能是「用」或「不用：<理由>」，当前是「${cell}」`);
    }
  }

  if (problems.length) {
    fail(`✗ [L1 声明] ${family}（${readme}）：`);
    for (const p of problems) console.error(`      ${p}`);
    console.error(HOWTO);
  }
}

if (failed) process.exit(1);
const checked = families.filter((f) => !DEBT.has(f));
console.log(`✓ L1 复用声明守卫通过（已核对 ${checked.join(' / ')} 共 ${checked.length} 个图型 × ${l1Modules.length} 个 L1 模块；已知欠账 ${DEBT.size} 项）`);
