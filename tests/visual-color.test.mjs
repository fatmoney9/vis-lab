import test from 'node:test';
import assert from 'node:assert/strict';

import { intensityLevels, resolveItemColors } from '../charts/core/visual-color.js';

test('COLOR-09：强度按数值秩分五档，并列值保持同档', () => {
  assert.deepEqual(intensityLevels([10, 20, 30, 40, 50]), [1, 2, 3, 4, 5]);
  assert.deepEqual(intensityLevels([50, 10, 30, 50, 20]), [5, 1, 4, 5, 2]);
  assert.deepEqual(intensityLevels([8, 8]), [5, 5]);

  const assignments = resolveItemColors({
    mode: 'intensity', values: [10, 20, 30, 40, 50], primaryColor: '#3366FF',
  });
  assert.deepEqual(assignments.map(({ fill }) => fill), Array(5).fill('#3366FF'));
  assert.deepEqual(assignments.map(({ opacity }) => opacity), [
    'var(--opacity-visualization-level-1)',
    'var(--opacity-visualization-level-2)',
    'var(--opacity-visualization-level-3)',
    'var(--opacity-visualization-level-4)',
    'var(--opacity-visualization-level-5)',
  ]);
});

test('COLOR-06/09：有符号语义色复用全局涨跌色，分档只改变透明度', () => {
  const values = [-4, -1, 0, 1, 4];
  const binned = resolveItemColors({
    mode: 'semantic-binned', values: Array(values.length).fill(1), semanticValues: values,
    thresholds: [1, 3],
  });
  assert.deepEqual(binned.map(({ fill }) => fill), [
    'var(--color-price-down)',
    'var(--color-price-down)',
    'var(--color-grey-05)',
    'var(--color-price-up)',
    'var(--color-price-up)',
  ]);
  assert.deepEqual(binned.map(({ opacity }) => opacity), [
    'var(--opacity-visualization-level-5)',
    'var(--opacity-visualization-level-1)',
    'var(--opacity-visualization-level-5)',
    'var(--opacity-visualization-level-1)',
    'var(--opacity-visualization-level-5)',
  ]);

  const flat = resolveItemColors({
    mode: 'semantic-flat', values: Array(values.length).fill(1), semanticValues: values,
  });
  assert.ok(flat.every(({ opacity }) => opacity === 'var(--opacity-visualization-level-5)'));
});

test('COLOR-09：系列色按调用方固定槽位原样透传', () => {
  assert.deepEqual(resolveItemColors({
    mode: 'series', values: [3, 2, 1], seriesColors: ['a', 'b', 'c'],
  }).map(({ fill }) => fill), ['a', 'b', 'c']);
});
