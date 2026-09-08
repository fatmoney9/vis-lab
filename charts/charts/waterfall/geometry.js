/*
 * [L2-LOCAL][WATERFALL-03/04/07/09] 瀑布图专属几何。
 * 集中保管 Figma 明确给出的跨主题固定尺寸，并完成槽宽到柱宽的换算；
 * 不读取 DOM、主题或数据业务字段。
 */
export const WATERFALL_SETTINGS = Object.freeze({
  'standard-bar-max-width': 64,
  'standard-bar-container-max-width': 96,
  'data-bar-width': 110,
  'delta-arrow-hide-height': 4,
  'data-label-hide-height': 36,
  'arrow-head-width': 5,
  'arrow-head-height': 4,
});

const finitePositive = (value, where) => {
  const number = Number(value);
  if (!Number.isFinite(number) || !(number > 0)) {
    throw new TypeError(`WaterfallChart：${where} 必须是大于 0 的有限数`);
  }
  return number;
};

export function waterfallBarWidth(variant, slotWidth) {
  if (!['standard', 'data'].includes(variant)) {
    throw new TypeError('WaterfallChart：variant 仅支持 standard / data');
  }
  const slot = finitePositive(slotWidth, 'slotWidth');
  if (variant === 'data') return WATERFALL_SETTINGS['data-bar-width'];
  const container = Math.min(slot, WATERFALL_SETTINGS['standard-bar-container-max-width']);
  return Math.min(WATERFALL_SETTINGS['standard-bar-max-width'], container * 2 / 3);
}
