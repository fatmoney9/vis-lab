import test from 'node:test';
import assert from 'node:assert/strict';

import { axisDomain, extentOf } from '../charts/charts/cartesian/domain.js';

test('值域：空数据回落到零值域，null 不参与 extent', () => {
  assert.deepEqual(extentOf([]), [0, 0]);
  assert.deepEqual(extentOf([{ data: [null, 8, -3] }]), [-3, 8]);
});

test('非堆叠值域覆盖柱线全部声明数据且不随隐藏状态变化', () => {
  const series = [
    { name: '柱', type: 'bar', data: [10, 20] },
    { name: '线', type: 'line', data: [-5, null] },
  ];

  assert.deepEqual(axisDomain(['A', 'B'], series, 'none', new Set(['线'])), [-5, 20]);
});

test('BAR-05：堆叠值域按可见系列重新累计', () => {
  const bars = [
    { name: 'A', type: 'bar', colorVar: '--a', data: [10] },
    { name: 'B', type: 'bar', colorVar: '--b', data: [20] },
  ];

  assert.deepEqual(axisDomain(['X'], bars, 'normal', new Set()), [0, 30]);
  assert.deepEqual(axisDomain(['X'], bars, 'normal', new Set(['B'])), [0, 10]);
});

test('堆叠模式下柱系列与线系列分别累计，不跨图元相加', () => {
  const series = [
    { name: '柱', type: 'bar', colorVar: '--a', data: [10] },
    { name: '线', type: 'line', colorVar: '--b', data: [20] },
  ];

  assert.deepEqual(axisDomain(['X'], series, 'normal', new Set()), [0, 20]);
});
