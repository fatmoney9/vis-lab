/*
 * treemap/content.js -- [L2] 矩形树图 presentation 适配。
 *
 * 图片内容标准化与 Tooltip 合同复用 L1；这里只补充矩形树图需要的 colorValue。
 */

import { imageContentTooltip, normalizeImageContent } from '../../core/image-content.js';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function itemPresentation(item) {
  const node = item?.node ?? {};
  const source = node.presentation && typeof node.presentation === 'object' ? node.presentation : {};
  const content = normalizeImageContent(source, { label: node.name });
  return {
    ...content,
    colorValue: finite(source.colorValue),
  };
}

export function detailTooltipContent(item) {
  const content = item.presentation ?? itemPresentation(item);
  return imageContentTooltip(content, {
    rowLabel: item.node?.name ?? content.label,
    rowValue: item.displayValue,
  });
}
