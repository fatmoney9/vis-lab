import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  assertWorldHeatmapTone,
  countryFlagThumbnail,
  normalizeWorldRegions,
} from '../charts/charts/world-heatmap/model.js';
import {
  WORLD_MAP_FEATURES,
  WORLD_MAP_VIEWBOX,
} from '../charts/charts/world-heatmap/world-map-data.js';

test('WORLD-HEATMAP-01/03：国家数据归一化并复用五档强度秩', () => {
  const regions = normalizeWorldRegions([
    { id: 'us', name: '美国', value: 50 },
    { id: 'CN', name: '中国', value: 10 },
    { id: 'JP', name: '日本', value: 30 },
    { id: 'DE', name: '德国', value: 50 },
    { id: 'IN', name: '印度', value: 20 },
  ]);
  assert.deepEqual(regions.map(({ id }) => id), ['US', 'CN', 'JP', 'DE', 'IN']);
  assert.deepEqual(regions.map(({ level }) => level), [5, 1, 4, 5, 2]);
});

test('WORLD-HEATMAP-01/04：非法国家数据和色调即时抛错', () => {
  assert.throws(() => normalizeWorldRegions(null), /必须是数组/);
  assert.throws(() => normalizeWorldRegions([{ id: 'USA', name: '美国', value: 1 }]), /国家码/);
  assert.throws(() => normalizeWorldRegions([{ id: 'US', name: '', value: 1 }]), /name 不能为空/);
  assert.throws(() => normalizeWorldRegions([{ id: 'US', name: '美国', value: NaN }]), /有限数/);
  assert.throws(() => normalizeWorldRegions([
    { id: 'US', name: '美国', value: 1 },
    { id: 'us', name: '美国', value: 2 },
  ]), /重复/);
  assert.equal(assertWorldHeatmapTone('primary'), 'primary');
  assert.equal(assertWorldHeatmapTone('up'), 'up');
  assert.throws(() => assertWorldHeatmapTone('series'), /仅支持/);
});

test('WORLD-HEATMAP-01：拒绝缺失值和可转成数字的非数值输入', () => {
  const invalidValues = [
    null, undefined, '', '  ', '2.13', true, false, {}, [],
    { valueOf: () => 2.13 }, NaN, Infinity, -Infinity,
  ];
  for (const value of invalidValues) {
    assert.throws(
      () => normalizeWorldRegions([{ id: 'CN', name: '中国', value }]),
      /value 必须是有限数/,
      `不得把 ${String(value)} 当成有效国家读数`,
    );
  }
});

test('WORLD-HEATMAP-01/05：零值、负值和无数据地图保持有效', () => {
  const regions = normalizeWorldRegions([
    { id: 'US', name: '美国', value: 0 },
    { id: 'CN', name: '中国', value: -2.13 },
  ]);
  assert.deepEqual(regions.map(({ value }) => value), [0, -2.13]);
  assert.deepEqual(normalizeWorldRegions([]), []);
});

test('WORLD-HEATMAP-02/06：Figma 世界底图与圆形国旗缩略图完整', () => {
  assert.deepEqual(WORLD_MAP_VIEWBOX, [0, 0, 1000, 600]);
  assert.equal(WORLD_MAP_FEATURES.length, 256);
  assert.equal(new Set(WORLD_MAP_FEATURES.map(({ id }) => id)).size, WORLD_MAP_FEATURES.length);
  assert.ok(WORLD_MAP_FEATURES.every(({ paths }) => paths.length > 0));
  const assetRoot = new URL('../assets/country-flags/', import.meta.url);
  for (const { id } of WORLD_MAP_FEATURES) {
    const url = new URL(countryFlagThumbnail(id));
    assert.ok(url.href.startsWith(assetRoot.href), `${id} 必须使用本地国旗资源`);
    const svg = readFileSync(url, 'utf8');
    assert.match(svg, /^<svg\b/, `${id} 必须能读取真实 SVG，不能是符号链接目标字符串`);
  }
  assert.equal(countryFlagThumbnail('cn'), new URL('cn.svg', assetRoot).href);
  assert.equal(countryFlagThumbnail('XK'), new URL('xk.svg', assetRoot).href);
  assert.equal(countryFlagThumbnail('GO'), new URL('tf.svg', assetRoot).href);
  assert.equal(countryFlagThumbnail('JU'), new URL('tf.svg', assetRoot).href);
  assert.equal(countryFlagThumbnail('UM-DQ'), new URL('um.svg', assetRoot).href);
  assert.equal(countryFlagThumbnail('invalid'), null);
});
