import test from 'node:test';
import assert from 'node:assert/strict';
import { earningsState, earningsTone, earningsLegendTone } from '../charts/core/earnings-point.js';
import { axisSubClass } from '../charts/core/axis.js';

test('EARNINGS-02：五种状态由数据决定', () => {
  assert.equal(earningsState(1.48, 1.42), 'beat');
  assert.equal(earningsState(1.39, 1.45), 'missed');
  assert.equal(earningsState(1.55, 1.55), 'met');
  assert.equal(earningsState(null, 1.84), 'pending');
  assert.equal(earningsState(1.61, null), 'unrated');
  assert.equal(earningsState(null, null), null);
  assert.equal(earningsState(undefined, undefined), null);
});

test('EARNINGS-02：浮点算出的「相等」仍判为符合，不因 0.1 + 0.2 这类噪声变成超预期', () => {
  assert.equal(earningsState(0.1 + 0.2, 0.3), 'met');
});

test('EARNINGS-03：颜色语义——超预期 / 符合涨色、未达预期跌色、其余次要色', () => {
  assert.equal(earningsTone('beat'), 'up');
  assert.equal(earningsTone('met'), 'up');
  assert.equal(earningsTone('missed'), 'down');
  assert.equal(earningsTone('pending'), 'muted');
  assert.equal(earningsTone('unrated'), 'muted');
});

test('EARNINGS-05：图例 Actual 颜色按全量状态构成', () => {
  /* 有超预期 / 符合 / 无预期 → 涨色 */
  assert.equal(earningsLegendTone(['missed', 'beat', 'pending']), 'up');
  assert.equal(earningsLegendTone(['missed', 'met']), 'up');
  assert.equal(earningsLegendTone(['missed', 'unrated']), 'up');
  /* 实际点全部未达预期（待公布不算实际点）→ 跌色 */
  assert.equal(earningsLegendTone(['missed', 'missed', 'pending']), 'down');
  /* 完全没有预期数据 → 系列色 */
  assert.equal(earningsLegendTone(['unrated', 'unrated']), 'series');
  /* 一个实际点都没有 → 系列色 */
  assert.equal(earningsLegendTone(['pending', 'pending']), 'series');
});

test('AXIS-09：副标题类名只有三种颜色语义，未知值落到 muted', () => {
  assert.equal(axisSubClass('up'), 'dv-axis-sub dv-axis-sub--up');
  assert.equal(axisSubClass('down'), 'dv-axis-sub dv-axis-sub--down');
  assert.equal(axisSubClass('muted'), 'dv-axis-sub dv-axis-sub--muted');
  assert.equal(axisSubClass(undefined), 'dv-axis-sub dv-axis-sub--muted');
});
