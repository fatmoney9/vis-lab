/*
 * hooks/lint-spec-ids.mjs —— Spec ID 回引守卫。被 hooks/pre-commit 调用，也可单独跑：node hooks/lint-spec-ids.mjs
 *
 * 规则：代码（charts/ 下 .js/.css）注释里引用的每个 [ID]，必须在 specs/*.md 有定义。
 * 查不到 = 拼错 / 过时（孤儿引用）→ 拦提交。
 *
 * 源头是 md：specs/*.md 定义 ID（ID + 规则 + 实现指向 + 状态）；js 里的 [ID] 只是**回引指针**，
 * 不是第二份定义（WORKFLOW §五 + 拼接铁律5）。本守卫只查 code→spec 方向。
 * 反方向（spec 里 ✅ 的 ID 是否至少被引用一次）不在此强制——principle 类规则会误报（如 SCALE-02 夹具已移除）。
 *
 * 紧凑写法先展开再逐个校验：数字段先按 `/` 拆，每段再判 `..` 展成闭区间，覆盖
 * 单个 / 斜杠 / 区间 / 混合（如 [LEGEND-01..03/05/06] → LEGEND-01/02/03/05/06）。
 * 约定：一个 [] 只放一个类别（跨类别写成相邻两个括号 [LINE-01][BAR-07]）。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir, exts, acc = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, exts, acc);
    else if (exts.some((x) => p.endsWith(x))) acc.push(p);
  }
  return acc;
};

const specText = walk('specs', ['.md']).map((f) => readFileSync(f, 'utf8')).join('\n');
/* 定义 = ID 以词边界出现在某份 spec（防 LEGEND-05 误配 LEGEND-050 / XLEGEND-05） */
const specHas = (id) => new RegExp(`(?<![A-Z0-9-])${id}(?![0-9])`).test(specText);

/* 紧凑写法展开成具体 ID 列表 */
function expand(tok) {
  const dash = tok.indexOf('-');
  const cat = tok.slice(0, dash);
  const out = [];
  for (const piece of tok.slice(dash + 1).split('/')) {
    if (piece.includes('..')) {
      const [a, b] = piece.split('..').map(Number);
      for (let n = a; n <= b; n++) out.push(`${cat}-${String(n).padStart(2, '0')}`);
    } else {
      out.push(`${cat}-${piece}`);
    }
  }
  return out;
}

const RE = /\[([A-Z]{2,}-[0-9][0-9/.]*)\]/g;
const orphans = new Map(); /* id → Set('file:line') */
for (const f of walk('charts', ['.js', '.css'])) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    let m;
    while ((m = RE.exec(line))) {
      for (const id of expand(m[1])) {
        if (!specHas(id)) {
          if (!orphans.has(id)) orphans.set(id, new Set());
          orphans.get(id).add(`${f}:${i + 1}`);
        }
      }
    }
  });
}

if (orphans.size) {
  console.error('✗ [Spec ID] 代码引用了 specs 里查无定义的 ID（拼错 / 过时的回引）：');
  for (const [id, locs] of orphans) console.error(`    ${id}  ← ${[...locs].join(', ')}`);
  process.exit(1);
}
console.log('✓ Spec ID 回引守卫通过（代码引用的 ID 全部在 specs 有定义）');
