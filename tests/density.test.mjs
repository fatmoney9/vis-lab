/*
 * 密度覆盖层（tokens/density.json）：合同、合并与作用域输出。
 * 渲染侧（紧凑档下图例 / 柱宽 / 最小宽高真的生效）靠预览面目检与浏览器契约，本文件不断言像素。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DENSITIES, parseDensity, mergeLayer } from '../tokens/density.mjs';
import { densityBlocks } from '../tokens/build.mjs';

const THEMES = ['ths', 'ifind-pc', 'ainvest'];
const json = (file) => JSON.parse(readFileSync(new URL(`../tokens/${file}`, import.meta.url), 'utf8'));
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('$')));
const TOKENS = Object.fromEntries(THEMES.map((t) => [t, strip(json(`${t}.json`))]));
const BEHAVIOR = strip(json('behavior.json'));
const DENSITY = parseDensity(json('density.json'), THEMES);

test('GRID-04：三主题自身不设尺寸下限（新增 token 不改变任何现有主题）', () => {
  for (const t of THEMES) {
    assert.equal(TOKENS[t]['size-chart-region-min-height'], '0px', t);
    assert.equal(TOKENS[t]['size-chart-min-width'], 'auto', t);
  }
});

test('density.json 现有内容过合同：值 token 只改已有键、形态覆盖与基准同构', () => {
  for (const [theme, levels] of Object.entries(DENSITY)) {
    for (const [d, layer] of Object.entries(levels)) {
      assert.doesNotThrow(() => mergeLayer(TOKENS[theme], layer.tokens, `${theme}.${d}`));
      assert.doesNotThrow(() => mergeLayer(BEHAVIOR[theme], layer.behavior, `${theme}.${d}`, { strict: true }));
    }
  }
});

test('覆盖层里没有与基准同值的空覆盖（否则读的人会以为这一项被改过）', () => {
  for (const [theme, levels] of Object.entries(DENSITY)) {
    for (const [d, layer] of Object.entries(levels)) {
      for (const [k, v] of Object.entries(layer.tokens)) {
        assert.notDeepEqual(v, TOKENS[theme][k], `${theme}.${d} tokens.${k}`);
      }
      for (const [k, v] of Object.entries(layer.behavior)) {
        assert.notDeepEqual(v, BEHAVIOR[theme][k], `${theme}.${d} behavior.${k}`);
      }
    }
  }
});

test('Ainvest 紧凑档：设计稿的形态两项落到合并结果上', () => {
  const dense = mergeLayer(BEHAVIOR.ainvest, DENSITY.ainvest.compact.behavior, 'ainvest.compact', { strict: true });
  assert.deepEqual([dense['legend-marker'].w, dense['legend-marker'].h], [6, 6]);
  assert.deepEqual([dense['datazoom-handle'].w, dense['datazoom-handle'].h], [24, 24]);
  /* 滑块内的抓手线随把手一起缩 */
  assert.ok(dense['datazoom-handle'].grip.h < BEHAVIOR.ainvest['datazoom-handle'].grip.h);
  /* 未覆盖的形态键原样继承 */
  assert.deepEqual(dense['number-format'], BEHAVIOR.ainvest['number-format']);
});

test('合并器拒绝：覆盖不存在的键 / 形态值少子键 / 未知主题 / 未登记的密度档', () => {
  assert.throws(() => mergeLayer({ a: 1 }, { b: 2 }, 'x'), /不是基准已有的键/);
  assert.throws(
    () => mergeLayer({ h: { w: 1, grip: { n: 3, gap: 5 } } }, { h: { w: 1, grip: { n: 3 } } }, 'x', { strict: true }),
    /不同构/,
  );
  assert.throws(() => parseDensity({ nope: { compact: {} } }, THEMES), /未知主题/);
  assert.throws(() => parseDensity({ ainvest: { tiny: {} } }, THEMES), /未登记/);
  assert.deepEqual(DENSITIES, ['compact']);
});

test('作用域输出：只改 pc 的端分叉键，必须另发紧凑×mobile 块把 mobile 值钉回去', () => {
  const base = { a: '12px', b: { mobile: '16px', pc: '12px' } };
  const override = { a: '11px', b: { mobile: '16px', pc: '8px' } };
  const css = densityBlocks('t', 'compact', base, { ...base, ...override }, Object.keys(override));
  const blocks = Object.fromEntries(
    css.split('\n\n').map((block) => {
      const [sel, ...body] = block.split('\n');
      return [sel.replace(/ \{$/, ''), body.slice(0, -1).map((l) => l.trim())];
    }),
  );
  assert.deepEqual(blocks['[data-theme="t"][data-density="compact"]'], ['--a: 11px;', '--b: 8px;']);
  assert.deepEqual(blocks['[data-theme="t"][data-density="compact"][data-platform="mobile"]'], ['--b: 16px;']);
  /* 未分叉的键不进端 / 明暗块；没有明暗分叉就不发暗色块 */
  assert.equal('[data-theme="t"][data-density="compact"][data-mode="dark"]' in blocks, false);
});
