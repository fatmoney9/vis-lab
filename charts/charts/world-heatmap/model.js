import { intensityLevels } from '../../core/visual-color.js';

const WORLD_HEATMAP_TONES = Object.freeze(['primary', 'up', 'down']);

const REGION_ID = /^[A-Z]{2}$/;
const FLAG_ROOT = 'https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@379588b5da95482d6bbf10bd45644a35b0609ea6/flags/';
/* 上游是 Git 符号链接：CDN 对它返回 200 + 目标文件名字符串而不是 SVG，须直取目标文件。 */
const FLAG_FILES = { HM: 'au', SH: 'sh-hl', UM: 'us' };

/* [WORLD-HEATMAP-09] 固定提交的第三方全球数据。 */
export const WORLD_MAP_URL = 'https://cdn.jsdelivr.net/gh/JayMuShui/chinese-global-compliant-geodata@3cf3485789876c37be6193bf2848cf9aaa40f758/src/geojson/globe/world.json';
export const REGIONS_MERGED_INTO_CN = Object.freeze(['TW', 'HK', 'MO']);

/* [WORLD-HEATMAP-02] 墨卡托投影，宽恒为 1000，纬度取到数据实际覆盖的范围（不含南极洲）。 */
const MAP_WIDTH = 1000;
const LAT_TOP = 84;
const LAT_BOTTOM = -56;
const mercator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const MAP_SCALE = MAP_WIDTH / (2 * Math.PI);
const MAP_HEIGHT = Math.round((mercator(LAT_TOP) - mercator(LAT_BOTTOM)) * MAP_SCALE);
export const WORLD_MAP_VIEWBOX = Object.freeze([0, 0, MAP_WIDTH, MAP_HEIGHT]);

export const projectLonLat = (lon, lat) => [
  ((lon + 180) / 360) * MAP_WIDTH,
  (mercator(LAT_TOP) - mercator(lat)) * MAP_SCALE,
];

/* 数据里没有 ISO 码的争议区（iso_a2 = -99）照常绘制，但取不可传入的内部 id，只能显示为无数据。 */
export function worldMapRegions(geojson) {
  return geojson.features
    .filter(({ properties }) => properties.iso_a2 !== 'AQ')
    .map(({ properties, geometry }, index) => ({
      id: REGION_ID.test(properties.iso_a2) ? properties.iso_a2 : `unlisted-${index}`,
      geometry,
    }));
}

export function normalizeWorldRegions(regions) {
  if (!Array.isArray(regions)) throw new TypeError('WorldHeatmapChart：regions 必须是数组');
  const seen = new Set();
  const normalized = regions.map((region, index) => {
    if (!region || typeof region !== 'object') {
      throw new TypeError(`WorldHeatmapChart：regions[${index}] 必须是对象`);
    }
    const id = String(region.id ?? '').toUpperCase();
    if (!REGION_ID.test(id)) {
      throw new TypeError(`WorldHeatmapChart：regions[${index}].id 必须是 ISO 3166-1 alpha-2 国家码`);
    }
    if (seen.has(id)) throw new TypeError(`WorldHeatmapChart：国家码 ${id} 重复`);
    seen.add(id);
    const name = String(region.name ?? '').trim();
    if (!name) throw new TypeError(`WorldHeatmapChart：regions[${index}].name 不能为空`);
    /* [WORLD-HEATMAP-01] 数据适配在 L3 完成，不将空值或字符串隐式转成国家读数。 */
    const value = region.value;
    if (!Number.isFinite(value)) {
      throw new TypeError(`WorldHeatmapChart：regions[${index}].value 必须是有限数`);
    }
    return { ...region, id, name, value };
  });
  const levels = intensityLevels(normalized.map(({ value }) => value));
  return normalized.map((region, index) => ({ ...region, level: levels[index] }));
}

export function assertWorldHeatmapTone(tone) {
  if (!WORLD_HEATMAP_TONES.includes(tone)) {
    throw new TypeError("WorldHeatmapChart：tone 仅支持 'primary'、'up' 或 'down'");
  }
  return tone;
}

/* [WORLD-HEATMAP-06] 固定提交的 Circle Flags（MIT）。 */
export function countryFlagThumbnail(id) {
  const regionId = String(id ?? '').toUpperCase();
  if (!REGION_ID.test(regionId)) return null;
  return `${FLAG_ROOT}${FLAG_FILES[regionId] ?? regionId.toLowerCase()}.svg`;
}
