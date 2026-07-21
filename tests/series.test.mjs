import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSeries } from '../charts/charts/cartesian/series.js';

test('系列归一化集中补齐默认 type、axis、area 与固定颜色槽位', () => {
  const result = resolveSeries([
    { name: '收入', data: [1, 2] },
    { name: '增速', data: [3, 4], type: 'line', axis: 'secondary', area: true },
  ]);

  assert.deepEqual(result, [
    {
      name: '收入', data: [1, 2], type: 'bar', axis: 'primary', area: false,
      seriesIndex: 0, colorVar: '--dv-series-1',
    },
    {
      name: '增速', data: [3, 4], type: 'line', axis: 'secondary', area: true,
      seriesIndex: 1, colorVar: '--dv-series-2',
    },
  ]);
});
