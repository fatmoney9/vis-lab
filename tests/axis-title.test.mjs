import test from 'node:test';
import assert from 'node:assert/strict';

import { axisTitleBand, axisTitleAnchor, dropCollidingTitles } from '../charts/core/axis-title.js';

test('AXISTITLE-02：带高 = 标题行高 + 上下各一份间距（4 + 12 + 4）', () => {
  assert.equal(axisTitleBand(12, 4), 20);
  assert.equal(axisTitleBand(12, 0), 12); /* 间距 0 退化为纯行高 */
});

test('AXISTITLE-04：左侧轴——左对齐画布左缘（标题多长都不会被裁）', () => {
  assert.deepEqual(axisTitleAnchor({ side: 'left', width: 600 }), { x: 0, anchor: 'start' });
});

test('AXISTITLE-04：右侧轴——右对齐画布右缘', () => {
  assert.deepEqual(axisTitleAnchor({ side: 'right', width: 600 }), { x: 600, anchor: 'end' });
});

/* 口径只由 side 决定：不随 Y 标签布局（inside/outside）、y-label-align 特例或标签宽变化，
   故三主题同一套——这正是「贴外缘」相对「对齐最长标签右沿」的价值所在。 */
test('AXISTITLE-04：口径与 Y 标签布局 / 对齐特例 / 标签宽无关', () => {
  const noise = { form: 'inside', align: 'right', labelWidth: 999, labelGap: 8, grid: { left: 40, right: 560 } };
  assert.deepEqual(axisTitleAnchor({ side: 'left', width: 600, ...noise }), { x: 0, anchor: 'start' });
  assert.deepEqual(axisTitleAnchor({ side: 'right', width: 600, ...noise }), { x: 600, anchor: 'end' });
});

test('AXISTITLE-06：同一条带内净距不足 → 副轴标题不出（主轴先到先得）', () => {
  const main = { left: 0, width: 60, band: 'top', key: 'y' };
  const secondary = { left: 62, width: 60, band: 'top', key: 'y2' }; /* 净距 2 < 4 */
  const kept = dropCollidingTitles([main, secondary], 4);
  assert.deepEqual(kept.map((b) => b.key), ['y']);
});

test('AXISTITLE-06：净距充足 → 主副两个标题都留', () => {
  const main = { left: 0, width: 60, band: 'top', key: 'y' };
  const secondary = { left: 200, width: 60, band: 'top', key: 'y2' };
  const kept = dropCollidingTitles([main, secondary], 4);
  assert.deepEqual(kept.map((b) => b.key), ['y', 'y2']);
});

test('AXISTITLE-06：X 标题独占底部带——与顶部 Y 标题重叠也不互相挤掉', () => {
  const y = { left: 0, width: 600, band: 'top', key: 'y' };
  const x = { left: 0, width: 600, band: 'bottom', key: 'x' };
  const kept = dropCollidingTitles([y, x], 4);
  assert.deepEqual(kept.map((b) => b.key), ['y', 'x']);
});
