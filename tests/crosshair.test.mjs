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

test('AXIS-04/TOOLTIP-09：高亮贴片未取得排版盒时按 X 轴行盒回落', () => {
  const frame = { grid: { bottom: 100 }, xBandTop: 104, lineH: 16 };
  const box = axisTagBox(frame, 2);
  assert.equal(box.y - frame.grid.bottom, 4);
  assert.deepEqual(box, { y: 104, height: 32 });
});

test('TOOLTIP-09：高亮贴片只移动背景，使背景与文字排版盒上下居中', () => {
  const frame = { xBandTop: 104, lineH: 16 };
  /* 两行文字的 em 排版盒：顶 101、高 38 */
  const box = axisTagBox(frame, 2, { y: 101, height: 38 });
  assert.deepEqual(box, { y: 104, height: 32 });
  /* 背景中心与文字盒中心重合——这正是与 Y 值徽标（TOOLTIP-12）逐像素同构的依据 */
  assert.equal(box.y + box.height / 2, 101 + 38 / 2);
});

test('AXIS-04/TOOLTIP-09：单行与多行共用一式，贴片顶沿对齐、多出的行高向下延伸', () => {
  const frame = { xBandTop: 104, lineH: 16 };
  /* SVG 对逐行 tspan 的排版盒有两条稳定性质：盒顶与单行一致、盒高恰好多 (n−1) × 行高。
     代入 axisTagBox 后行数项消去，故两者顶沿必然相同——单行贴片不因多行能力而位移。 */
  const one = axisTagBox(frame, 1, { y: 101, height: 22 });
  const two = axisTagBox(frame, 2, { y: 101, height: 22 + frame.lineH });
  assert.equal(one.y, two.y);
  assert.equal(two.height, one.height + frame.lineH);
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
