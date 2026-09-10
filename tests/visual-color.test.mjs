import test from 'node:test';
import assert from 'node:assert/strict';

import {
  intensityLevels,
  performanceColorRamp,
  resolveItemColors,
} from '../charts/core/visual-color.js';

test('COLOR-10：表现色阶恒由低到高，五档与六档分别取独立设计色', () => {
  assert.deepEqual(performanceColorRamp(), [
    'var(--color-performance-six-level-1)',
    'var(--color-performance-six-level-2)',
    'var(--color-performance-six-level-3)',
    'var(--color-performance-six-level-4)',
    'var(--color-performance-six-level-5)',
    'var(--color-performance-six-level-6)',
  ]);
  assert.deepEqual(performanceColorRamp(3), [
    'var(--color-performance-six-level-1)',
    'var(--color-performance-six-level-3)',
    'var(--color-performance-six-level-6)',
  ]);
  assert.equal(performanceColorRamp(7).length, 7);
  /* 五档是设计源明确给出的独立顺序，不从六档做等距抽样。 */
  assert.deepEqual(performanceColorRamp(5), [
    'var(--color-performance-five-level-1)',
    'var(--color-performance-five-level-2)',
    'var(--color-performance-five-level-3)',
    'var(--color-performance-five-level-4)',
    'var(--color-performance-five-level-5)',
  ]);
  assert.deepEqual(performanceColorRamp(2), [
    'var(--color-performance-six-level-1)',
    'var(--color-performance-six-level-6)',
  ]);
});

test('COLOR-09：强度按数值秩分五档，并列值保持同档', () => {
  assert.deepEqual(intensityLevels([10, 20, 30, 40, 50]), [1, 2, 3, 4, 5]);
  assert.deepEqual(intensityLevels([50, 10, 30, 50, 20]), [5, 1, 4, 5, 2]);
  assert.deepEqual(intensityLevels([8, 8]), [5, 5]);

  const assignments = resolveItemColors({
    mode: 'intensity', values: [10, 20, 30, 40, 50], primaryColor: '#3366FF',
  });
  assert.deepEqual(assignments.map(({ fill }) => fill), Array(5).fill('#3366FF'));
  assert.deepEqual(assignments.map(({ opacity }) => opacity), [
    'var(--opacity-visualization-intensity-level-1)',
    'var(--opacity-visualization-intensity-level-2)',
    'var(--opacity-visualization-intensity-level-3)',
    'var(--opacity-visualization-intensity-level-4)',
    'var(--opacity-visualization-intensity-level-5)',
  ]);
});

test('COLOR-06/09：有符号分档直接消费主题涨跌梯度色', () => {
  const values = [-4, -2, -1, 0, 1, 2, 4];
  const binned = resolveItemColors({
    mode: 'semantic-binned', values: Array(values.length).fill(1), semanticValues: values,
    thresholds: [1, 2],
  });
  assert.deepEqual(binned.map(({ fill }) => fill), [
    'var(--color-price-down-gradient-1)',
    'var(--color-price-down-gradient-2)',
    'var(--color-price-down-gradient-3)',
    'var(--color-price-even-gradient)',
    'var(--color-price-up-gradient-3)',
    'var(--color-price-up-gradient-2)',
    'var(--color-price-up-gradient-1)',
  ]);
  assert.ok(binned.every(({ opacity }) => opacity === null));

  const flat = resolveItemColors({
    mode: 'semantic-flat', values: Array(values.length).fill(1), semanticValues: values,
  });
  assert.deepEqual(flat.map(({ fill }) => fill), [
    'var(--color-price-down-gradient-1)',
    'var(--color-price-down-gradient-1)',
    'var(--color-price-down-gradient-1)',
    'var(--color-price-even-gradient)',
    'var(--color-price-up-gradient-1)',
    'var(--color-price-up-gradient-1)',
    'var(--color-price-up-gradient-1)',
  ]);
  assert.ok(flat.every(({ opacity }) => opacity === null));
});

test('COLOR-09：系列色按调用方固定槽位原样透传', () => {
  assert.deepEqual(resolveItemColors({
    mode: 'series', values: [3, 2, 1], seriesColors: ['a', 'b', 'c'],
  }).map(({ fill }) => fill), ['a', 'b', 'c']);
});

test('COLOR-09：语义颜色拒绝缺失值与无效分档阈值', () => {
  const base = { mode: 'semantic-binned', values: [1], semanticValues: [1], thresholds: [1, 2] };
  assert.throws(
    () => resolveItemColors({ ...base, semanticValues: [] }),
    /与 values 等长/,
  );
  assert.throws(
    () => resolveItemColors({ ...base, semanticValues: [Number.NaN] }),
    /必须是有限数/,
  );
  assert.throws(
    () => resolveItemColors({ ...base, semanticValues: [null] }),
    /必须是有限数/,
  );
  for (const thresholds of [[2, 1], [1, 1], [1, Infinity], [0, 1]]) {
    assert.throws(
      () => resolveItemColors({ ...base, thresholds }),
      /有限、递增的正数/,
    );
  }
});
