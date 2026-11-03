import { intensityLevels } from '../../core/visual-color.js';

export const WORLD_HEATMAP_TONES = Object.freeze(['primary', 'up', 'down']);

const REGION_ID = /^(?:[A-Z]{2}|XK|UM-[A-Z]{2})$/;
const FLAG_ROOT = new URL('../../../assets/country-flags/', import.meta.url);
/* 地图独有地区码：Glorioso / Juan de Nova 同属 French Southern and Antarctic Lands。 */
const FLAG_ALIASES = { GO: 'TF', JU: 'TF' };

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

/* [WORLD-HEATMAP-06] 本地 Circle Flags（MIT）；复合地区码使用其 alpha-2 主码。
 * 资源地址相对本模块解析，保留 GitHub Pages 的 /vis-lab/ 等部署前缀。 */
export function countryFlagThumbnail(id) {
  const regionId = String(id ?? '').toUpperCase();
  if (!REGION_ID.test(regionId)) return null;
  const countryId = regionId.split('-')[0];
  const code = (FLAG_ALIASES[countryId] ?? countryId).toLowerCase();
  return new URL(`${code}.svg`, FLAG_ROOT).href;
}
