import test from 'node:test';
import assert from 'node:assert/strict';
import { axisLabelLines, wrapAxisLabel, xAxisLabelTextLayout } from '../charts/core/axis.js';
import { axisTagBox } from '../charts/core/crosshair.js';

test('TOOLTIP-09：交互态保持 X 轴显式分行，不把数组整体字符串化', () => {
  assert.deepEqual(axisLabelLines(['Other', 'Expenses']), ['Other', 'Expenses']);
  assert.deepEqual(axisLabelLines([['Other', 'Expenses']]), ['Other', 'Expenses']);
  assert.notEqual(axisLabelLines(['Other', 'Expenses'])[0], 'Other,Expenses');
});

test('TOOLTIP-09：单行调用保持兼容，空标签回落为空行', () => {
  assert.deepEqual(axisLabelLines('Revenue'), ['Revenue']);
  assert.deepEqual(axisLabelLines(null), ['']);
});

test('AXIS-04/TOOLTIP-09：高亮贴片未取得墨迹测量时按 X 轴行盒回落', () => {
  const frame = { grid: { bottom: 100 }, xBandTop: 104, lineH: 16 };
  const box = axisTagBox(frame, 2);
  assert.equal(box.y - frame.grid.bottom, 4);
  assert.deepEqual(box, { y: 104, height: 32 });
});

test('TOOLTIP-09：高亮贴片只移动背景，使背景与多行实际字形墨迹上下居中', () => {
  const frame = { xBandTop: 104, lineH: 16 };
  const ink = [
    { ascent: 8, descent: 1, hanging: 9 },
    { ascent: 7, descent: 2, hanging: 9 },
  ];
  const box = axisTagBox(frame, 2, ink);
  assert.deepEqual(box, { y: 102, height: 32 });
  assert.equal(box.y + box.height / 2, 118);
});

test('AXIS-04/TOOLTIP-09：点击态复用常态 X 标签坐标，不发生纵向跳动', () => {
  const frame = { xBandTop: 104, lineH: 16 };
  assert.deepEqual(xAxisLabelTextLayout(frame), {
    y: 104,
    dominantBaseline: 'hanging',
    lineHeight: 16,
  });
});

test('AXIS-04：轴名称优先按词折成两行，不用省略号丢失内容', () => {
  const measure = (text) => Array.from(text).length * 8;
  assert.deepEqual(wrapAxisLabel('Cost of sales', 56, measure), ['Cost of', 'sales']);
  assert.deepEqual(wrapAxisLabel('Other Expenses', 64, measure), ['Other', 'Expenses']);
  const wrapped = wrapAxisLabel('超长无空格轴名称', 32, measure);
  assert.equal(wrapped.length, 2);
  assert.equal(wrapped.join(''), '超长无空格轴名称');
  assert.equal(wrapped.some((line) => line.includes('…')), false);
});

test('AXIS-04：显式两行保持不变，超过两行时合并余文而不截断', () => {
  const measure = (text) => Array.from(text).length * 8;
  assert.deepEqual(wrapAxisLabel(['Other', 'Expenses'], 8, measure), ['Other', 'Expenses']);
  assert.deepEqual(wrapAxisLabel(['A', 'B', 'C'], 8, measure), ['A', 'B C']);
});
