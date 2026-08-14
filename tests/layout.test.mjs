import test from 'node:test';
import assert from 'node:assert/strict';

import { groupedBars, singleBar, stackBars } from '../charts/charts/cartesian/layout.js';

const closeTo = (actual, expected) => assert.ok(
  Math.abs(actual - expected) < 1e-9,
  `expected ${actual} to be close to ${expected}`,
);

test('BAR-02：宽 band 中的分组柱保持最大柱宽与间距并整体居中', () => {
  const slots = groupedBars(2, 120, 32, 2, 100, 2);

  assert.deepEqual(slots, [
    { offset: 27, width: 32 },
    { offset: 61, width: 32 },
  ]);
});

test('BAR-02：空间不足时柱宽与柱间距按同一比例缩小', () => {
  const slots = groupedBars(3, 60, 32, 2, 100, 2);

  closeTo(slots[0].width, 12.8);
  closeTo(slots[1].offset - slots[0].offset - slots[0].width, 0.8);
  closeTo(slots[0].offset, 10);
  closeTo(slots[2].offset + slots[2].width, 50);
});

test('BAR-02：分组隐藏到只剩一根时仍吃 ratio 侧白并随 band 等比收缩', () => {
  /* contentRegion = min(band,100)·2/3；width = min(barMax, contentRegion)。
     band=120 → 容器封顶 100 → 内容区 66.7 > 32 → 满宽；band=36 → 内容区 24 < 32 → 收缩到 24。 */
  assert.deepEqual(groupedBars(1, 120, 32, 2, 100, 2), [{ offset: 44, width: 32 }]);
  assert.deepEqual(groupedBars(1, 36, 32, 2, 100, 2), [{ offset: 6, width: 24 }]);

  /* 回归：曾漏掉 ratio（width=min(container,barMax)），band 在 48..100 区间柱宽被钉死在 32 不随缩放变化。 */
  const shrinking = [90, 60, 45].map((band) => groupedBars(1, band, 32, 2, 100, 2)[0].width);
  closeTo(shrinking[0], 32);
  closeTo(shrinking[1], 32);
  closeTo(shrinking[2], 30);
  assert.ok(shrinking[2] < shrinking[1], '窄 band 下 n=1 必须比宽 band 更窄');
});

test('BAR-02：n=1 与 n≥2 共用同一套容器/侧白规则（收缩起点仅因内容块变窄而不同）', () => {
  /* 两者都在 contentRegion 撑不下内容块时开始等比缩小：n=2 内容块 66 → band<99 起缩；n=1 内容块 32 → band<48 起缩。 */
  closeTo(groupedBars(2, 99, 32, 2, 100, 2)[0].width, 32);
  assert.ok(groupedBars(2, 90, 32, 2, 100, 2)[0].width < 32);
  closeTo(groupedBars(1, 48, 32, 2, 100, 2)[0].width, 32);
  assert.ok(groupedBars(1, 45, 32, 2, 100, 2)[0].width < 32);
});

test('BAR-02：ratio=0（不留侧白）时 n=1 退化为 min(band, containerMax, barMax)', () => {
  assert.deepEqual(groupedBars(1, 120, 16, 2, Infinity, 0), [{ offset: 52, width: 16 }]);
  assert.deepEqual(groupedBars(1, 10, 16, 2, Infinity, 0), [{ offset: 0, width: 10 }]);
});

test('BAR-03：单柱在容器内按 2:1 留白，窄 band 时等比收缩', () => {
  assert.deepEqual(singleBar(100, 16, 24, 2), { offset: 42, width: 16 });
  assert.deepEqual(singleBar(15, 16, 24, 2), { offset: 2.5, width: 10 });
});

test('BAR-05：普通堆叠分别累计正负值并只给最外段 caps', () => {
  const categories = ['A', 'B'];
  const bars = [
    { colorVar: '--a', data: [10, -5] },
    { colorVar: '--b', data: [20, -7] },
    { colorVar: '--c', data: [null, 3] },
  ];
  const result = stackBars(categories, bars, 'normal');

  assert.equal(result.lo, -12);
  assert.equal(result.hi, 30);
  assert.deepEqual(result.segs.map(({ values, base, caps }) => ({ values, base, caps })), [
    { values: [10, -5], base: [0, 0], caps: [false, false] },
    { values: [20, -7], base: [10, -5], caps: [true, true] },
    { values: [null, 3], base: [0, 0], caps: [false, true] },
  ]);
});

test('BAR-06：归一化堆叠按类目正值和换算并处理零总量', () => {
  const result = stackBars(
    ['A', 'B', 'C'],
    [
      { colorVar: '--a', data: [1, 0, null] },
      { colorVar: '--b', data: [3, 0, 2] },
    ],
    'percent',
  );

  assert.equal(result.lo, 0);
  assert.equal(result.hi, 1);
  assert.deepEqual(result.segs[0].values, [0.25, 0, null]);
  assert.deepEqual(result.segs[0].base, [0, 0, 0]);
  assert.deepEqual(result.segs[1].values, [0.75, 0, 1]);
  assert.deepEqual(result.segs[1].base, [0.25, 0, 0]);
});
