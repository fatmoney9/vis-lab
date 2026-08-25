import test from 'node:test';
import assert from 'node:assert/strict';

import { assertTokenDomain } from '../tokens/build.mjs';

test('TOKEN：透明度仅接受 0..1 的有限数', () => {
  assert.doesNotThrow(() => assertTokenDomain('test', 'opacity-example', 0.55));
  for (const value of [-0.1, 1.1, Infinity, 'invalid']) {
    assert.throws(
      () => assertTokenDomain('test', 'opacity-example', value),
      /0\.\.1 的有限数/,
    );
  }
});

test('TOKEN：颜色仅接受仓库支持的 CSS 颜色形态', () => {
  for (const value of ['#3366FF', '#fff', 'rgba(1, 2, 3, 0.5)', 'transparent', '{color-base}']) {
    assert.doesNotThrow(() => assertTokenDomain('test', 'color-example', value));
  }
  for (const value of ['#12', '#GGGGGG', 'rgba(256, 2, 3, 1)', 'rgba(1, 2, 3, 2)', 'not-a-color']) {
    assert.throws(
      () => assertTokenDomain('test', 'color-example', value),
      /不是受支持的 CSS 颜色/,
    );
  }
  assert.throws(
    () => assertTokenDomain(
      'test',
      'color-example',
      '{spacing-example}',
      { 'spacing-example': '4px' },
    ),
    /不是受支持的 CSS 颜色/,
    '颜色别名的最终叶值也必须是颜色',
  );
});
