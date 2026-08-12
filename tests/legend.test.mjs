import test from 'node:test';
import assert from 'node:assert/strict';

import { applyToggle, applyFocus } from '../charts/core/legend-state.js';

const KEYS = ['A', 'B', 'C', 'D'];
/* 断言读的是「谁还亮着」而不是「谁在 hidden 里」——前者才是规范表述的口径 */
const visible = (hidden, keys = KEYS) => keys.filter((k) => !hidden.has(k));

/* ── [LEGEND-06] multi：独立开关 ───────────────────────────────── */

test('LEGEND-06 multi：每项独立开关，关了再点即开', () => {
  let h = applyToggle(new Set(), 'B', KEYS);
  assert.deepEqual(visible(h), ['A', 'C', 'D']);
  h = applyToggle(h, 'D', KEYS);
  assert.deepEqual(visible(h), ['A', 'C']);
  h = applyToggle(h, 'B', KEYS);
  assert.deepEqual(visible(h), ['A', 'B', 'C']);
});

test('LEGEND-06 multi：不改入参（返回新 Set）', () => {
  const before = new Set(['A']);
  const after = applyToggle(before, 'B', KEYS);
  assert.deepEqual([...before], ['A'], '入参被改了');
  assert.notEqual(after, before);
});

test('LEGEND-06 缺省即 multi', () => {
  assert.deepEqual(visible(applyToggle(new Set(), 'A', KEYS)),
    visible(applyToggle(new Set(), 'A', KEYS, 'multi')));
});

/* ── [LEGEND-12] 最后一个可见项不可关（两档共通）───────────────── */

test('LEGEND-12 multi：关到只剩一个后，点它原样返回', () => {
  let h = new Set();
  for (const k of ['A', 'B', 'C']) h = applyToggle(h, k, KEYS);
  assert.deepEqual(visible(h), ['D']);
  const same = applyToggle(h, 'D', KEYS);
  assert.deepEqual(visible(same), ['D'], '最后一个被关掉了');
});

test('LEGEND-12：全隐这个状态不可达——把每一项都点一遍也剩一个', () => {
  let h = new Set();
  for (const k of [...KEYS, ...KEYS]) h = applyToggle(h, k, KEYS);
  assert.ok(visible(h).length >= 1, '出现了全隐');
});

test('LEGEND-12 单项图表：唯一那项点不灭', () => {
  const one = ['A'];
  assert.deepEqual(visible(applyToggle(new Set(), 'A', one, 'multi'), one), ['A']);
});

/* ── [LEGEND-06] single：单选保留 ─────────────────────────────── */

test('LEGEND-06 single：点某项 → 只留该项', () => {
  const h = applyToggle(new Set(), 'B', KEYS, 'single');
  assert.deepEqual(visible(h), ['B']);
});

test('LEGEND-06 single：点别的 → 选择移过去，不是叠加', () => {
  let h = applyToggle(new Set(), 'B', KEYS, 'single');
  h = applyToggle(h, 'C', KEYS, 'single');
  assert.deepEqual(visible(h), ['C']);
});

test('LEGEND-06 single：点当前唯一可见项 → 恢复全显', () => {
  let h = applyToggle(new Set(), 'B', KEYS, 'single');
  h = applyToggle(h, 'B', KEYS, 'single');
  assert.deepEqual(visible(h), KEYS);
});

/* 「恢复」判的是**当前是否唯一可见**，不是「上次点的是不是它」——
   从 multi 档遗留下来的 hidden 切进 single 时，这两种判法会给出不同结果。 */
test('LEGEND-06 single：承接 multi 遗留的 hidden，按「是否唯一可见」判', () => {
  const legacy = new Set(['A', 'C', 'D']);            /* 只有 B 亮着 */
  assert.deepEqual(visible(applyToggle(legacy, 'B', KEYS, 'single')), KEYS, 'B 唯一可见，应恢复全显');
  const half = new Set(['C', 'D']);                   /* A、B 都亮着 */
  assert.deepEqual(visible(applyToggle(half, 'B', KEYS, 'single')), ['B'], 'B 非唯一可见，应聚焦到 B');
});

test('LEGEND-06 single：恒留一项，天然满足 LEGEND-12', () => {
  let h = new Set();
  for (const k of [...KEYS, ...KEYS]) {
    h = applyToggle(h, k, KEYS, 'single');
    assert.ok(visible(h).length >= 1, '出现了全隐');
  }
});

/* ── [LEGEND-14] focus：强调档 ────────────────────────────────── */

test('LEGEND-14 focus：点某项 → 选中它；点别的 → 移过去；再点自己 → 取消', () => {
  let sel = applyFocus(null, 'B');
  assert.equal(sel, 'B');
  sel = applyFocus(sel, 'C');
  assert.equal(sel, 'C');
  sel = applyFocus(sel, 'C');
  assert.equal(sel, null);
});

test('LEGEND-14 focus：不产生 hidden——数据构成一点不动', () => {
  /* 本档的分水岭：applyFocus 的返回值里根本没有「隐藏」这个概念，
     故饼环仍是完整 360°、轴图值域不变（对比 single 会把环打成满环）。 */
  assert.equal(typeof applyFocus(null, 'B'), 'string');
  assert.equal(applyFocus('B', 'B'), null);
});

test('LEGEND-14 focus：取消强调回到「全部同权」，不是「全部隐藏」——LEGEND-12 在本档不适用', () => {
  assert.equal(applyFocus('A', 'A'), null, '唯一被强调项应可取消');
});
