import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertWorldHeatmapTone,
  countryFlagThumbnail,
  normalizeWorldRegions,
  projectLonLat,
  worldMapRegions,
  WORLD_MAP_URL,
  WORLD_MAP_VIEWBOX,
} from '../charts/charts/world-heatmap/model.js';

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

test('WORLD-HEATMAP-02：投影把世界等比铺进视框，北在上', () => {
  const [, , width, height] = WORLD_MAP_VIEWBOX;
  assert.deepEqual(projectLonLat(-180, 84), [0, 0]);
  const [right, bottom] = projectLonLat(180, -56);
  assert.equal(right, width);
  assert.ok(Math.abs(bottom - height) < 1, '南缘落在视框底部');
  assert.equal(projectLonLat(0, 0)[0], width / 2);
  assert.ok(projectLonLat(0, 60)[1] < projectLonLat(0, 0)[1], '北纬在上');
  /* 墨卡托的成品形状：同样 10 度纬差，越靠近高纬拉得越长。 */
  const span = (lat) => projectLonLat(0, lat)[1] - projectLonLat(0, lat + 10)[1];
  assert.ok(span(60) > span(0));
});

test('WORLD-HEATMAP-09：底图固定第三方提交，南极洲不画，无 ISO 码的争议区只能显示为无数据', () => {
  assert.match(WORLD_MAP_URL, /^https:\/\/cdn\.jsdelivr\.net\/gh\/.+@[0-9a-f]{40}\/.+\.json$/);
  const feature = (code, name) => ({ properties: { iso_a2: code, name }, geometry: { type: 'Point', coordinates: [0, 0] } });
  const regions = worldMapRegions({
    features: [feature('CN'), feature('AQ'), feature('-99', 'a'), feature('-99', 'b'), feature('IN')],
  });
  assert.deepEqual(regions.map(({ id }) => id).slice(0, 1), ['CN']);
  assert.equal(regions.some(({ id }) => id === 'AQ'), false);
  assert.equal(new Set(regions.map(({ id }) => id)).size, regions.length, 'id 不得重复');
  assert.deepEqual(regions.filter(({ id }) => /^[A-Z]{2}$/.test(id)).map(({ id }) => id), ['CN', 'IN']);
});

test('WORLD-HEATMAP-06：国旗指向固定提交，上游符号链接改取真实文件', () => {
  /* 固定到完整提交号：浮动版本会让线上国旗随上游变化，也就失去了对账依据。 */
  const flagFile = /^https:\/\/cdn\.jsdelivr\.net\/gh\/HatScripts\/circle-flags@[0-9a-f]{40}\/flags\/([a-z-]+)\.svg$/;
  const flagOf = (id) => countryFlagThumbnail(id).match(flagFile)?.[1];
  assert.equal(flagOf('cn'), 'cn');
  /* 上游符号链接：CDN 对它们返回目标文件名字符串，图片必然加载失败。 */
  assert.equal(flagOf('HM'), 'au');
  assert.equal(flagOf('SH'), 'sh-hl');
  assert.equal(flagOf('UM'), 'us');
  assert.equal(countryFlagThumbnail('invalid'), null);
});
