import test from 'node:test';
import assert from 'node:assert/strict';

import { clamp, clamp01 } from '../charts/core/math.js';

test('clamp：参数顺序是数轴顺序 (lo, v, hi)', () => {
  assert.equal(clamp(0, 5, 10), 5);
  assert.equal(clamp(0, -3, 10), 0);
  assert.equal(clamp(0, 42, 10), 10);
});

test('clamp：上界小于下界时下界优先（空间不足时的保底）', () => {
  assert.equal(clamp(8, 3, 4), 8);
});

test('clamp01：落在 [0, 1]，非数一律回到起点 0', () => {
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(7), 1);
  for (const bad of [undefined, null, NaN, 'abc']) assert.equal(clamp01(bad), 0);
});
