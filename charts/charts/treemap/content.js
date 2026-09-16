/*
 * treemap/content.js -- [L2] 矩形树图 presentation 适配。
 *
 * 图片内容标准化与 Tooltip 合同复用 L1；这里只补充矩形树图需要的 colorValue。
 */

import { imageContentTooltip, normalizeImageContent } from '../../core/image-content.js';

/*
 * [CHARTTEXT-01] 本族固定文案的缺省表（无障碍描述）。调用方经 config.text 整套替换（CHARTTEXT-02），
 * 本族不认识语言：Ainvest 的英文表由 L3 demos/chart-presentation.js 注入。
 * fallbackName 是整图没有 name、根节点也没有 name 时的兜底称呼。
 */
export const TREEMAP_TEXT = Object.freeze({
  chartLabel: '{name}：按面积展示层级占比',
  fallbackName: '矩形树图',
  leafLabel: '{name}，{value}，可查看详情',
});

const finiteOrNull = (value) => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function itemPresentation(item) {
  const node = item?.node ?? {};
  const source = node.presentation && typeof node.presentation === 'object' ? node.presentation : {};
  const content = normalizeImageContent(source, { label: node.name });
  return {
    ...content,
    colorValue: finiteOrNull(source.colorValue),
  };
}

export function detailTooltipContent(item) {
  const content = item.presentation ?? itemPresentation(item);
  return imageContentTooltip(content, {
    rowLabel: item.node?.name ?? content.label,
    rowValue: item.displayValue,
  });
}
