import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHighlightState, applyHover, applyLeave, applyPick, applyClear,
  activeTarget, isPinned,
} from '../charts/core/highlight-state.js';

/*
 * 本文件是交互状态机从 L2 抽到 L1 时的**回归安全网**：那一族原先没有交互层单测，
 * 下面每条断言都对应抽取前就存在的一条行为，红了即说明抽取改了语义而不是搬了位置。
 */

const NODE = ['node', 'n1'];
const OTHER = ['node', 'n2'];
const EDGE = ['edge', 7];

test('SANKEY-10：初始态什么都不高亮', () => {
  const s = createHighlightState();
  assert.equal(activeTarget(s), null);
  assert.equal(s.pinned, null);
});

test('SANKEY-10：hover 进出——没有钉住时，移出即清空', () => {
  let s = createHighlightState();
  s = applyHover(s, ...NODE);
  assert.deepEqual(activeTarget(s), { kind: 'node', key: 'n1' });
  s = applyLeave(s);
  assert.equal(activeTarget(s), null);
});

test('SANKEY-10：hover 压过钉住——钉着 A 时移到 B，高亮跟去 B', () => {
  let s = applyPick(createHighlightState(), ...NODE);
  s = applyHover(s, ...OTHER);
  assert.deepEqual(activeTarget(s), { kind: 'node', key: 'n2' }, 'hover 优先于钉住');
  assert.ok(isPinned(s, ...NODE), '钉位没被 hover 动过');
});

test('SANKEY-10：钉住后扫过别处再移出 —— 回落到钉住态，不是清空', () => {
  /* 这条最容易在重写时丢掉：leave 一律清空的写法在没钉住时表现一样，只有钉住后才露馅。 */
  let s = applyPick(createHighlightState(), ...NODE);
  s = applyHover(s, ...OTHER);
  s = applyLeave(s);
  assert.deepEqual(activeTarget(s), { kind: 'node', key: 'n1' });
});

test('SANKEY-20：点同一个 → 关闭，且 hover 一并清空', () => {
  let s = applyPick(createHighlightState(), ...NODE);
  assert.deepEqual(activeTarget(s), { kind: 'node', key: 'n1' });
  s = applyPick(s, ...NODE);
  assert.equal(s.pinned, null);
  assert.equal(activeTarget(s), null, '关闭后指针虽仍在图元上，也不保留 hover 高亮');
});

test('SANKEY-20：点别的 → 钉位移过去，不是两个都钉着', () => {
  let s = applyPick(createHighlightState(), ...NODE);
  s = applyPick(s, ...OTHER);
  assert.ok(isPinned(s, ...OTHER));
  assert.ok(!isPinned(s, ...NODE));
});

test('SANKEY-20：跨类互斥 —— 钉着节点时点边，钉位整体移到边上', () => {
  let s = applyPick(createHighlightState(), ...NODE);
  s = applyPick(s, ...EDGE);
  assert.ok(isPinned(s, ...EDGE));
  assert.ok(!isPinned(s, ...NODE));
  assert.deepEqual(activeTarget(s), { kind: 'edge', key: 7 });
});

test('SANKEY-20：同 key 不同 kind 不算同一个目标', () => {
  /* 节点 id 与边 index 各自编号，'7' 与 7、node/edge 同号都可能撞上 */
  let s = applyPick(createHighlightState(), 'node', 7);
  s = applyPick(s, 'edge', 7);
  assert.ok(isPinned(s, 'edge', 7), '点的是另一类，应移过去而不是关闭');
});

test('SANKEY-20：点空白 —— 钉住与 hover 一起清掉', () => {
  let s = applyPick(createHighlightState(), ...NODE);
  s = applyHover(s, ...OTHER);
  s = applyClear(s);
  assert.equal(s.pinned, null);
  assert.equal(activeTarget(s), null);
});

test('键盘 focus 等同 hover；blur 不清钉住', () => {
  /* focus/blur 复用 applyHover / applyLeave，故与指针同一套回落规则 */
  let s = applyPick(createHighlightState(), ...NODE);
  s = applyHover(s, ...EDGE);     /* Tab 走到一条边 */
  s = applyLeave(s);              /* blur */
  assert.deepEqual(activeTarget(s), { kind: 'node', key: 'n1' });
});

test('所有迁移都不改入参', () => {
  const s0 = createHighlightState();
  const snapshot = JSON.stringify(s0);
  const pinned = applyPick(s0, ...NODE);
  applyHover(pinned, ...OTHER);
  applyLeave(pinned);
  applyClear(pinned);
  assert.equal(JSON.stringify(s0), snapshot, '初始态未被改写');
  assert.ok(isPinned(pinned, ...NODE), '中间态未被后续迁移改写');
});
