import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rankItems, interpolateRanking, rowGeometry, visibleRows,
} from '../charts/charts/hbar/model.js';

/*
 * ⚠️ 这里刻意**不断言插值公式本身**（`value === from + (to-from)*t` 那种）——
 * 那等于把实现抄一遍当测试，实现怎么错它怎么绿。
 * 断言的是成品性质：端点相等、单调、名次对穿、进出榜的方向、并列稳定。
 */

const items = (pairs) => pairs.map(([name, value]) => ({ name, value }));
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const rowOf = (snap, key) => snap.rows.find((r) => r.key === key);

test('HBAR-10：按值降序，同值按 key 稳定裁决（打乱输入不改变结果）', () => {
  const a = rankItems(items([['甲', 10], ['乙', 30], ['丙', 20]]), 10);
  assert.deepEqual(a.rows.map((r) => r.key), ['乙', '丙', '甲']);
  assert.deepEqual(a.rows.map((r) => r.rank), [0, 1, 2]);

  /* 并列：两帧之间不得换来换去，否则画面无端抖动 */
  const tied1 = rankItems(items([['丙', 5], ['甲', 5], ['乙', 5]]), 10);
  const tied2 = rankItems(items([['乙', 5], ['丙', 5], ['甲', 5]]), 10);
  assert.deepEqual(tied1.rows.map((r) => r.key), tied2.rows.map((r) => r.key),
    '同值时名次只由 key 决定，与输入顺序无关');
});

test('HBAR-07：颜色槽位跟随声明序，不跟随名次', () => {
  const snap = rankItems(items([['甲', 10], ['乙', 30]]), 10);
  assert.equal(rowOf(snap, '甲').slot, 0, '甲声明在前，槽位恒为 0');
  assert.equal(rowOf(snap, '乙').slot, 1);
  assert.equal(rowOf(snap, '乙').rank, 0, '但乙值大，名次在前');
});

test('HBAR-11：Top-N 之外的项仍在结果里，但 alpha=0 且座位是榜底外一行', () => {
  const snap = rankItems(items([['a', 5], ['b', 4], ['c', 3], ['d', 2]]), 2);
  assert.deepEqual(snap.rows.filter((r) => r.alpha === 1).map((r) => r.key), ['a', 'b']);
  for (const key of ['c', 'd']) {
    assert.equal(rowOf(snap, key).alpha, 0, `${key} 不在榜`);
    assert.equal(rowOf(snap, key).seat, 2, `${key} 的座位应是榜底外一行（topN）`);
  }
  assert.equal(snap.max, 5, 'max 只看在榜的项');
});

test('HBAR-12：两端严格相等——t=0 等于 from、t=1 等于 to', () => {
  const from = rankItems(items([['甲', 10], ['乙', 30]]), 5);
  const to = rankItems(items([['甲', 40], ['乙', 20]]), 5);
  for (const [t, want] of [[0, from], [1, to]]) {
    const got = interpolateRanking(from, to, t, 5);
    for (const w of want.rows) {
      const g = rowOf(got, w.key);
      assert.ok(near(g.value, w.value), `t=${t} 时 ${w.key} 的值应等于端点`);
      assert.ok(near(g.rank, w.seat), `t=${t} 时 ${w.key} 的名次应等于端点`);
      assert.ok(near(g.alpha, w.alpha), `t=${t} 时 ${w.key} 的 alpha 应等于端点`);
    }
    assert.ok(near(got.max, want.max), `t=${t} 时 max 应等于端点`);
  }
});

test('HBAR-12：名次互换时两条平滑对穿——存在一刻名次相等，且全程不越出两端之间', () => {
  const from = rankItems(items([['甲', 30], ['乙', 10]]), 5);   /* 甲第0、乙第1 */
  const to = rankItems(items([['甲', 10], ['乙', 30]]), 5);     /* 交换 */
  assert.equal(rowOf(from, '甲').rank, 0);
  assert.equal(rowOf(to, '甲').rank, 1, '前置：这一对确实互换了名次，否则本条空转');

  let crossed = false;
  let prevGap = null;
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20;
    const snap = interpolateRanking(from, to, t, 5);
    const a = rowOf(snap, '甲').rank;
    const b = rowOf(snap, '乙').rank;
    assert.ok(a >= -1e-9 && a <= 1 + 1e-9, `t=${t} 甲的名次越界：${a}`);
    assert.ok(b >= -1e-9 && b <= 1 + 1e-9, `t=${t} 乙的名次越界：${b}`);
    const gap = a - b;
    if (prevGap !== null && Math.sign(gap) !== Math.sign(prevGap)) crossed = true;
    if (near(gap, 0)) crossed = true;
    prevGap = gap;
  }
  assert.ok(crossed, '两条必须在中途对穿，而不是某一帧整行瞬跳');
});

test('HBAR-13：进榜者从榜底滑入并淡入，掉榜者反向——同一条 t 驱动', () => {
  const from = rankItems(items([['旧', 30], ['新', 1]]), 1);    /* 只显示第 1 名：旧在榜、新不在 */
  const to = rankItems(items([['旧', 1], ['新', 30]]), 1);      /* 换位 */
  assert.equal(rowOf(from, '新').alpha, 0, '前置：新在起点确实不在榜');
  assert.equal(rowOf(to, '新').alpha, 1, '前置：新在终点确实在榜');

  const mid = interpolateRanking(from, to, 0.5, 1);
  const enter = rowOf(mid, '新');
  const leave = rowOf(mid, '旧');
  assert.ok(enter.alpha > 0 && enter.alpha < 1, `进榜者中途半透明，实际 ${enter.alpha}`);
  assert.ok(leave.alpha > 0 && leave.alpha < 1, `掉榜者中途半透明，实际 ${leave.alpha}`);
  assert.ok(enter.rank < rowOf(from, '新').seat, '进榜者名次正在往上走');
  assert.ok(leave.rank > rowOf(from, '旧').seat, '掉榜者名次正在往下走');
});

test('HBAR-12：roster 变化（新增 / 移除实体）不抛错，缺席端按榜底外一行处置', () => {
  const from = rankItems(items([['甲', 10]]), 3);
  const to = rankItems(items([['甲', 10], ['乙', 20]]), 3);
  assert.doesNotThrow(() => interpolateRanking(from, to, 0.5, 3));
  const mid = interpolateRanking(from, to, 0.5, 3);
  assert.ok(rowOf(mid, '乙'), '新增实体必须出现在插值结果里');
  assert.ok(rowOf(mid, '乙').alpha > 0 && rowOf(mid, '乙').alpha < 1, '新增实体正在淡入');
});

test('HBAR-12：从中间态继续补，终点仍精确落在目标帧（快速连拖不闪回）', () => {
  const a = rankItems(items([['甲', 10], ['乙', 30]]), 5);
  const b = rankItems(items([['甲', 40], ['乙', 20]]), 5);
  const c = rankItems(items([['甲', 5], ['乙', 50]]), 5);
  const halfway = interpolateRanking(a, b, 0.4, 5);          /* 被打断在半途 */
  const settled = interpolateRanking(halfway, c, 1, 5);       /* 从打断处补到 c */
  for (const w of c.rows) {
    const g = rowOf(settled, w.key);
    assert.ok(near(g.value, w.value), `${w.key} 的值应精确落到目标帧`);
    assert.ok(near(g.rank, w.seat), `${w.key} 的名次应精确落到目标帧`);
  }
});

test('HBAR-01：退化输入不抛错——空帧 / 单实体 / 全等值 / 负值与 null', () => {
  assert.deepEqual(rankItems([], 5).rows, []);
  assert.equal(rankItems([], 5).max, 0);
  assert.equal(rankItems(items([['独', 7]]), 5).rows.length, 1);
  assert.doesNotThrow(() => interpolateRanking(rankItems([], 5), rankItems([], 5), 0.5, 5));

  const odd = rankItems([{ name: '空', value: null }, { name: '负', value: -3 }, { name: '零', value: 0 }], 5);
  assert.equal(rowOf(odd, '空').value, 0, 'null 按 0 计，但仍占一个名次');
  assert.equal(rowOf(odd, '负').value, -3);
  assert.deepEqual(odd.rows.map((r) => r.key), ['空', '零', '负'], '0 与 null 并列时按 key 码点序裁决（空 U+7A7A < 零 U+96F6），负值垫底');
});

test('HBAR-03：行几何——名次是小数时行 y 连续，条厚原样透传', () => {
  const a = rowGeometry(0, 30, 3, 24);
  const b = rowGeometry(1, 30, 3, 24);
  const mid = rowGeometry(0.5, 30, 3, 24);
  assert.equal(a.y, 3);
  assert.equal(b.y, 33);
  assert.equal(mid.y, 18, '小数名次落在两行正中');
  assert.equal(mid.height, 24);
});

test('HBAR-13：可见行含正在滑出榜底那一行，但不含已经透明的', () => {
  const rows = [
    { key: 'a', rank: 0, alpha: 1 },
    { key: 'b', rank: 2, alpha: 0.4 },     /* 正在滑出 */
    { key: 'c', rank: 2, alpha: 0 },       /* 已经没了 */
    { key: 'd', rank: 3, alpha: 1 },       /* 榜外更远处 */
  ];
  assert.deepEqual(visibleRows(rows, 2).map((r) => r.key), ['a', 'b']);
});
