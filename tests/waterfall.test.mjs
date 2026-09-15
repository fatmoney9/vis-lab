import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveWaterfall,
  waterfallExtent,
} from '../charts/charts/waterfall/model.js';
import { waterfallBarWidth } from '../charts/charts/waterfall/geometry.js';

test('瀑布累计：delta 按上一终点增减，subtotal / total 回到 0 但不改变累计结果', () => {
  const model = resolveWaterfall([
    { id: 'revenue', name: 'Revenue', kind: 'total', value: 100 },
    { id: 'cost', name: 'Cost', kind: 'delta', value: -30 },
    { id: 'gross', name: 'Gross profit', kind: 'subtotal', value: 70 },
    { id: 'other', name: 'Other income', kind: 'delta', value: 5 },
    { id: 'net', name: 'Net income', kind: 'total', value: 75 },
  ]);
  assert.deepEqual(model.items.map(({ start, end }) => [start, end]), [
    [0, 100], [100, 70], [0, 70], [70, 75], [0, 75],
  ]);
  assert.deepEqual(model.connectors.map(({ level }) => level), [100, 70, 70, 75]);
  assert.equal(model.total, 75);
  assert.deepEqual(waterfallExtent(model.items), [0, 100]);
});

test('数据柱：segments 有符号和值决定整项值，并在所属累计区间内连续排布', () => {
  const model = resolveWaterfall([
    {
      id: 'assets', name: 'Total Assets', kind: 'total',
      segments: [
        { id: 'current-assets', name: 'Current Assets', value: 2000 },
        { id: 'non-current-assets', name: 'Non Current Assets', value: 6000 },
      ],
    },
    {
      id: 'liabilities', name: 'Total Liabilities', kind: 'delta',
      segments: [
        { id: 'current-liabilities', name: 'Current Liabilities', value: -3000 },
        { id: 'non-current-liabilities', name: 'Non Current Liabilities', value: -2000 },
      ],
    },
    { id: 'equity', name: 'Total Equity', kind: 'total', value: 3000 },
  ]);
  assert.equal(model.items[0].value, 8000);
  assert.deepEqual(model.items[0].segments.map(({ start, end }) => [start, end]), [[0, 2000], [2000, 8000]]);
  assert.equal(model.items[1].value, -5000);
  assert.deepEqual(model.items[1].segments.map(({ start, end }) => [start, end]), [[8000, 5000], [5000, 3000]]);
  assert.deepEqual(waterfallExtent(model.items), [0, 8000]);
});

test('瀑布守恒：汇总值或分段和值不一致时拒绝配置', () => {
  assert.throws(() => resolveWaterfall([
    { id: 'start', kind: 'total', value: 100 },
    { id: 'end', kind: 'total', value: 90 },
  ]), /汇总值/);
  assert.throws(() => resolveWaterfall([
    { id: 'start', kind: 'total', value: 100, segments: [{ name: 'A', value: 80 }] },
  ]), /有符号和值/);
});

test('瀑布柱宽：常规柱按 2:1 收缩并封顶，数据柱保持规范宽度', () => {
  assert.equal(waterfallBarWidth('standard', 60), 40);
  assert.equal(waterfallBarWidth('standard', 96), 64);
  assert.equal(waterfallBarWidth('standard', 160), 64);
  assert.equal(waterfallBarWidth('data', 40), 110);
});
