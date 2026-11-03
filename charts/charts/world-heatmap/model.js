import { intensityLevels } from '../../core/visual-color.js';

export const WORLD_HEATMAP_TONES = Object.freeze(['primary', 'up', 'down']);

const REGION_ID = /^(?:[A-Z]{2}|XK|UM-[A-Z]{2})$/;
const FLAG_ROOT = 'https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@379588b5da95482d6bbf10bd45644a35b0609ea6/flags/';
/* GO / JU：地图独有地区码，Glorioso / Juan de Nova 同属 French Southern and Antarctic Lands。
 * 其余：上游是 Git 符号链接，CDN 对它返回 200 + 目标文件名字符串而不是 SVG，须直取目标文件。 */
const FLAG_FILES = {
  GO: 'tf', JU: 'tf', BQ: 'bq-bo', BV: 'no', SJ: 'no', HM: 'au', SH: 'sh-hl', UM: 'us',
};

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

/* [WORLD-HEATMAP-06] 固定提交的 Circle Flags（MIT）；复合地区码使用其 alpha-2 主码。 */
export function countryFlagThumbnail(id) {
  const regionId = String(id ?? '').toUpperCase();
  if (!REGION_ID.test(regionId)) return null;
  const countryId = regionId.split('-')[0];
  return `${FLAG_ROOT}${FLAG_FILES[countryId] ?? countryId.toLowerCase()}.svg`;
}
