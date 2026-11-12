import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMarkdown } from '../site/markdown.js';
import { specPageOfRule, ruleIdsOf, ruleHref, parseSpecRoute, specHref } from '../site/spec-index.js';

const html = (md, opts) => renderMarkdown(md, opts).html;

/* ── 安全口径：先整体转义，只放行 <br> ─────────────────────────── */

test('规范正文里写成纯文本的 SVG 标签被转义，<br> 照常换行', () => {
  const out = html('| ID | 规则 |\n|---|---|\n| PIE-12 | 引线在 <g> 里<br>与扇区同组 |');
  assert.match(out, /&lt;g&gt;/);
  assert.doesNotMatch(out, /<g>/);
  assert.match(out, /里<br>与/);
});

test('行内代码里的 ** 与 [] 不再被当成粗体 / 链接', () => {
  const out = html('看 `a**b**[c](d)` 这段');
  assert.match(out, /<code>a\*\*b\*\*\[c\]\(d\)<\/code>/);
});

/* ── 表格 ─────────────────────────────────────────────────────── */

test('单元格里转义的竖线是内容，不切成新列', () => {
  const out = html('| ID | 规则 |\n|---|---|\n| COLOR-ADR-01 | 写入 `up\\|down` 两档 |');
  assert.equal((out.match(/<td>/g) || []).length, 2);
  assert.match(out, /<code>up\|down<\/code>/);
});

test('行内代码里的竖线（如绝对值 |y|）不切列', () => {
  const out = html('| ID | 规则 | 状态 |\n|---|---|---|\n| PIE-02 | 高 = `max(R, |y| + 块高/2)` | ✅ |');
  assert.equal((out.match(/<td>/g) || []).length, 3);
  assert.match(out, /<code>max\(R, \|y\| \+ 块高\/2\)<\/code>/);
});

test('以 | 开头却没有分隔行的行落成段落，不会原地打转', () => {
  const out = html('| 不是表格\n下一行');
  assert.match(out, /^<p>\| 不是表格 下一行<\/p>$/);
});

/* ── 规则锚点：三种写法都认 ───────────────────────────────────── */

test('规则锚点：表格首列 / 列表项粗体开头 / 标题开头', () => {
  const out = html([
    '| ID | 规则 |', '|---|---|', '| WORLD-HEATMAP-02 | 底图 |',
    '', '- **WORLD-HEATMAP-03 · 强度**：五档',
    '', '## FORMAT-01 · 主题数值格式',
  ].join('\n'));
  assert.match(out, /<tr id="rule-WORLD-HEATMAP-02">/);
  assert.match(out, /<li id="rule-WORLD-HEATMAP-03">/);
  assert.match(out, /<h2 id="rule-FORMAT-01">/);
});

test('普通标题给出可作页内目录的 headings', () => {
  const { headings } = renderMarkdown('# 饼图\n\n## 扇区几何\n\n### 细节');
  assert.deepEqual(headings.map((h) => [h.level, h.text]), [[1, '饼图'], [2, '扇区几何'], [3, '细节']]);
});

/* ── 链接与其他块 ─────────────────────────────────────────────── */

test('链接去向由调用方决定，外链带 noopener', () => {
  const resolveLink = (href) => (href.endsWith('.md') ? { href: '#spec/pie', external: false } : { href, external: true });
  const out = html('[饼环](pie.md) 与 [源](https://example.com)', { resolveLink });
  assert.match(out, /<a href="#spec\/pie">饼环<\/a>/);
  assert.match(out, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">源<\/a>/);
});

test('勾选列表区分已完成与待办，代码块原样保留', () => {
  const out = html('- [x] 已做\n- [ ] 未做\n\n```js\nconst a = 1 < 2;\n```');
  assert.match(out, /<li class="md-task is-done">/);
  assert.match(out, /<li class="md-task">/);
  assert.match(out, /<pre><code data-lang="js">const a = 1 &lt; 2;<\/code><\/pre>/);
});

/* ── 规范清单：ID → 页 / 路由 ─────────────────────────────────── */

test('规则 ID 按整段前缀找页：COLOR-ADR 不被 COLOR 抢走，带连字符的前缀也认', () => {
  assert.equal(specPageOfRule('COLOR-04').id, 'color');
  assert.equal(specPageOfRule('COLOR-ADR-01').id, 'color');
  assert.equal(specPageOfRule('WORLD-HEATMAP-02').id, 'world-heatmap');
  assert.equal(specPageOfRule('SCALE-01').id, 'axes');
  assert.equal(specPageOfRule('NOPE-01'), null);
});

test('示例徽标拆成单个 ID，并给出跳到那一条的路由', () => {
  assert.deepEqual(ruleIdsOf('PIE-02 / COLOR-08'), ['PIE-02', 'COLOR-08']);
  assert.equal(ruleHref('PIE-02'), '#spec/pie/rule-PIE-02');
  assert.equal(ruleHref('NOPE-01'), null);
});

test('规范路由往返：总览 / 页 / 锚点（含中文锚点）', () => {
  assert.deepEqual(parseSpecRoute('spec'), { page: null, anchor: null });
  assert.deepEqual(parseSpecRoute('spec/pie'), { page: 'pie', anchor: null });
  assert.deepEqual(parseSpecRoute(specHref('pie', '扇区几何').slice(1)), { page: 'pie', anchor: '扇区几何' });
  assert.equal(parseSpecRoute('pie'), null);
  assert.equal(parseSpecRoute('special-example'), null);
});
