import test from 'node:test';
import assert from 'node:assert/strict';

import { makeFormatter } from '../charts/core/format.js';

test('FORMAT-01：THS 中文单位在边界值正确换算并去尾零', () => {
  const format = makeFormatter({ system: 'cn', 'max-decimals': 2 });

  assert.equal(format(0), '0');
  assert.equal(format(9999), '9999');
  assert.equal(format(10000), '1万');
  assert.equal(format(25000000), '2.5千万');
  assert.equal(format(100000000), '1亿');
  assert.equal(format(-340000), '-34万');
});

test('FORMAT-01：Ainvest 仅从 min-abbr 起使用英文缩写', () => {
  const format = makeFormatter({ system: 'en', 'max-decimals': 1, 'min-abbr': 10000 });

  assert.equal(format(9999), '9,999');
  assert.equal(format(10000), '10K');
  assert.equal(format(12500), '12.5K');
  assert.equal(format(1000000), '1M');
  assert.equal(format(-2500000000), '-2.5B');
});

test('FORMAT-01：plain 使用千分位，空值与 NaN 使用无数据占位', () => {
  const format = makeFormatter({ system: 'plain', 'max-decimals': 2 });

  assert.equal(format(820000), '820,000');
  assert.equal(format(1234.5), '1,234.5');
  assert.equal(format(null), '—');
  assert.equal(format(Number.NaN), '—');
});
