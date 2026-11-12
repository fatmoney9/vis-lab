/*
 * hooks/lint-spec-index.mjs —— 站点「设计规范」清单守卫。
 * 被 hooks/check.sh 调用，也可单独跑：node hooks/lint-spec-index.mjs
 *
 * 站点按 site/spec-index.js 的登记去取 specs/<id>.md 现场渲染。登记与文件之间、
 * 示例的规范徽标与规则之间，**错了都不报错、只是静默缺一块**：
 *   ① specs/ 新增一页忘了登记 → 站点上就是少一页，没有任何提示；
 *   ② 登记了却没有对应文件 → 点进去是「读取失败」；
 *   ③ 某页出现了新的规则前缀却没声明 → 指向它的徽标点不过去；
 *   ④ 示例的规范徽标写了不存在的 ID（改号、笔误）→ 跳过去停在页首，看着像是跳对了。
 * 四条都是机器能确定的事，故交给门禁，不靠记得。
 *
 * 规则 ID 的识别口径与 site/markdown.js 一致：表格首列 · 列表项开头的粗体 · 标题开头。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { SPEC_PAGES, specPageOfRule, ruleIdsOf } from '../site/spec-index.js';
import { examplesFor } from '../demos/examples.js';

const errors = [];
const files = readdirSync('specs').filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
const listed = new Set(SPEC_PAGES.map((p) => p.id));

for (const f of files) if (!listed.has(f)) errors.push(`specs/${f}.md 未登记到 site/spec-index.js——站点上会静默少这一页`);
for (const p of SPEC_PAGES) if (!files.includes(p.id)) errors.push(`site/spec-index.js 登记了 ${p.id}，但 specs/${p.id}.md 不存在`);

/* 每页实际出现的规则 ID */
const ID = '[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\\d+';
const RULE_LINE = new RegExp(`^(?:\\|\\s*(${ID})\\s*\\||-\\s+\\*\\*(${ID})\\b|#{1,6}\\s+(${ID})\\b)`, 'gm');
const rulesIn = new Map();
for (const p of SPEC_PAGES.filter((x) => files.includes(x.id))) {
  const text = readFileSync(`specs/${p.id}.md`, 'utf8');
  const ids = new Set([...text.matchAll(RULE_LINE)].map((m) => m[1] ?? m[2] ?? m[3]));
  rulesIn.set(p.id, ids);
  for (const id of ids) {
    const prefix = id.replace(/-\d+$/, '');
    if (!p.prefixes.includes(prefix)) {
      errors.push(`specs/${p.id}.md 有规则 ${id}，但 site/spec-index.js 没给这页声明前缀 ${prefix}——指向它的链接跳不过去`);
    }
  }
}

/* 示例的规范徽标：每个 ID 都要落到一条真实存在的规则 */
let chips = 0;
for (const example of examplesFor('index')) {
  for (const id of ruleIdsOf(example.spec)) {
    chips += 1;
    const page = specPageOfRule(id);
    if (!page) errors.push(`示例 ${example.id} 的规范徽标 ${id}：没有哪一页声明了这个前缀`);
    else if (!rulesIn.get(page.id)?.has(id)) errors.push(`示例 ${example.id} 的规范徽标 ${id}：specs/${page.id}.md 里没有这条规则（改号或笔误？）`);
  }
}

if (errors.length) {
  console.error('✗ [设计规范清单]');
  for (const e of errors) console.error(`    ${e}`);
  process.exit(1);
}
const ruleCount = [...rulesIn.values()].reduce((n, s) => n + s.size, 0);
console.log(`✓ 设计规范清单守卫通过（${files.length} 篇全部登记，${ruleCount} 条规则可锚定，${chips} 个示例徽标均指向真实规则）`);
