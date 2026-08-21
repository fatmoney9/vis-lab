/*
 * L1 · 可选图片内容块。权威规则见 specs/image-content.md。
 *
 * 只处理通用 label / value / image / details，不认识图表、主题、品牌或业务字段。
 * 调用方负责提供 token 解析后的尺寸档与符合本图表视觉的承载图层。
 */

const text = (value, fallback = '') => String(value ?? fallback);

/* [IMAGECONTENT-01] 业务数据应在进入组件前映射为这份最小显示合同。 */
export function normalizeImageContent(source, fallback = {}) {
  const content = source && typeof source === 'object' ? source : {};
  return {
    label: text(content.label, fallback.label),
    value: content.value == null
      ? (fallback.value == null ? null : text(fallback.value))
      : text(content.value),
    image: content.image ? text(content.image) : null,
    details: Array.isArray(content.details)
      ? content.details.map((row, index) => ({
        key: text(row?.key, index),
        label: text(row?.label),
        value: row?.value == null ? '-' : text(row.value),
      }))
      : [],
  };
}

/* [IMAGECONTENT-02] 按调用方尺寸档从大到小降级；本函数不持有任何像素常量。 */
export function fitImageContent({
  label,
  value,
  image,
  width,
  height,
  metrics,
  measureLabel = (content, size) => text(content).length * size * 0.62,
  measureValue = measureLabel,
}) {
  if (!metrics || !Array.isArray(metrics.presets) || !metrics.presets.length) {
    throw new TypeError('图片内容块缺少由 token 解析的尺寸档');
  }
  const { padding, imageGap, textGap, compact, presets } = metrics;
  const innerWidth = Math.max(0, width - padding * 2);
  const innerHeight = Math.max(0, height - padding * 2);
  if (!label || innerWidth <= 0 || innerHeight <= 0) return null;

  for (const preset of presets) {
    if (width < preset.minWidth || height < preset.minHeight) continue;
    const imageSize = image ? preset.imageSize : 0;
    const blockHeight = imageSize
      + (imageSize ? imageGap : 0)
      + preset.labelSize
      + textGap
      + preset.valueSize;
    if (blockHeight > innerHeight) continue;
    if (
      measureLabel(label, preset.labelSize) > innerWidth
      || measureValue(value, preset.valueSize) > innerWidth
    ) continue;
    return {
      imageSize,
      labelSize: preset.labelSize,
      valueSize: preset.valueSize,
      showLabel: true,
      showValue: true,
      blockHeight,
    };
  }

  const compactImageSize = image && Number(compact.imageSize) > 0
    ? Number(compact.imageSize)
    : 0;
  if (
    compactImageSize
    && compactImageSize <= innerWidth
    && compactImageSize <= innerHeight
  ) {
    const labelFits = measureLabel(label, compact.fontSize) <= innerWidth;
    const imageAndLabelHeight = compactImageSize + imageGap + compact.fontSize;
    if (
      width >= compact.minWidth
      && height >= compact.minHeight
      && labelFits
      && imageAndLabelHeight <= innerHeight
    ) {
      return {
        imageSize: compactImageSize,
        labelSize: compact.fontSize,
        valueSize: null,
        showLabel: true,
        showValue: false,
        blockHeight: imageAndLabelHeight,
      };
    }
    return {
      imageSize: compactImageSize,
      labelSize: null,
      valueSize: null,
      showLabel: false,
      showValue: false,
      blockHeight: compactImageSize,
    };
  }

  if (
    width >= compact.minWidth
    && height >= compact.minHeight
    && measureLabel(label, compact.fontSize) <= innerWidth
  ) {
    return {
      imageSize: 0,
      labelSize: compact.fontSize,
      valueSize: null,
      showLabel: true,
      showValue: false,
      blockHeight: compact.fontSize,
    };
  }
  if (
    width >= compact.minWidth
    && height >= compact.minHeight
    && measureValue(value, compact.fontSize) <= innerWidth
  ) {
    return {
      imageSize: 0,
      labelSize: null,
      valueSize: compact.fontSize,
      showLabel: false,
      showValue: true,
      blockHeight: compact.fontSize,
    };
  }
  return null;
}

/* [IMAGECONTENT-03] SVG 结构统一，字体、颜色与具体图表类名仍由调用方控制。 */
export function renderImageContent(layer, {
  content,
  layout,
  x,
  y,
  imageGap,
  textGap,
  key,
  className,
}) {
  if (!layer?.append || !layout) throw new TypeError('图片内容块缺少 SVG 图层或布局结果');
  const normalized = normalizeImageContent(content);
  let cursorY = y;
  const group = layer.append('g')
    .attr('class', ['dv-image-content', className].filter(Boolean).join(' '))
    .attr('data-key', key ?? null)
    .style('--dv-image-content-label-size', layout.labelSize == null ? null : `${layout.labelSize}px`)
    .style('--dv-image-content-value-size', layout.valueSize == null ? null : `${layout.valueSize}px`);

  if (layout.imageSize && normalized.image) {
    group.append('image')
      .attr('class', 'dv-image-content__image')
      .attr('href', normalized.image)
      .attr('x', x - layout.imageSize / 2)
      .attr('y', cursorY)
      .attr('width', layout.imageSize)
      .attr('height', layout.imageSize);
    cursorY += layout.imageSize + imageGap;
  }
  if (layout.showLabel) {
    group.append('text')
      .attr('class', 'dv-image-content__label')
      .attr('x', x)
      .attr('y', cursorY + layout.labelSize / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text(normalized.label);
    cursorY += layout.labelSize;
  }
  if (layout.showLabel && layout.showValue) cursorY += textGap;
  if (layout.showValue) {
    group.append('text')
      .attr('class', 'dv-image-content__value')
      .attr('x', x)
      .attr('y', cursorY + layout.valueSize / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text(normalized.value);
  }
  return group;
}

/* [IMAGECONTENT-04] 可选图片直接复用 L1 Tooltip 的 titleIcon 合同。 */
export function imageContentTooltip(content, fallback = {}) {
  const normalized = normalizeImageContent(content, fallback);
  const rows = normalized.details.length
    ? normalized.details
    : [{
      key: 'value',
      label: text(fallback.rowLabel, normalized.label),
      value: text(fallback.rowValue, normalized.value ?? '-'),
    }];
  return {
    title: normalized.label,
    titleIcon: normalized.image,
    rows: rows.map((row) => ({ ...row, showMarker: false })),
  };
}
