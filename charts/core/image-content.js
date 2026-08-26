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
    imageFallback: content.imageFallback ? text(content.imageFallback) : null,
    details: Array.isArray(content.details)
      ? content.details.map((row, index) => ({
        key: text(row?.key, index),
        label: text(row?.label),
        value: row?.value == null ? '-' : text(row.value),
      }))
      : [],
  };
}

function requiredRange(metrics, name) {
  const range = metrics?.[name];
  const min = Number(range?.min);
  const max = Number(range?.max);
  if (!(min > 0) || !(max >= min)) {
    throw new TypeError(`图片内容块缺少有效的 ${name} 尺寸上下限`);
  }
  return { min, max };
}

function scaledSize(range, ratio) {
  return Math.round(range.min + (range.max - range.min) * ratio);
}

function blockHeightOf({ imageSize, labelSize, valueSize, imageGap, textGap }) {
  return imageSize
    + (imageSize && (labelSize || valueSize) ? imageGap : 0)
    + (labelSize || 0)
    + (labelSize && valueSize ? textGap : 0)
    + (valueSize || 0);
}

/* [IMAGECONTENT-02] 在调用方给定的尺寸上下限内按实际空间连续适配；本函数不持有像素常量。 */
export function fitImageContent({
  label,
  value,
  image,
  imageFallback,
  width,
  height,
  metrics,
  measureLabel,
  measureValue,
}) {
  if (!metrics) throw new TypeError('图片内容块缺少由 token 解析的尺寸上下限');
  if (typeof measureLabel !== 'function' || typeof measureValue !== 'function') {
    throw new TypeError('图片内容块必须注入 L1 文字测量函数');
  }
  const { padding, imageGap, textGap, valueFontDeviation } = metrics;
  const imageRange = requiredRange(metrics, 'image');
  const labelRange = requiredRange(metrics, 'label');
  const valueRange = requiredRange(metrics, 'value');
  for (const [name, metric] of Object.entries({
    padding,
    imageGap,
    textGap,
    valueFontDeviation,
  })) {
    if (!Number.isFinite(Number(metric)) || Number(metric) < 0) {
      throw new TypeError(`图片内容块缺少非负 ${name} 尺寸`);
    }
  }
  const innerWidth = Math.max(0, width - padding * 2);
  const innerHeight = Math.max(0, height - padding * 2);
  if (!label || innerWidth <= 0 || innerHeight <= 0) return null;

  const fitScaled = ({ showImage, showLabel, showValue }) => {
    const activeRanges = [
      showImage ? imageRange : null,
      showLabel ? labelRange : null,
      showValue ? valueRange : null,
    ].filter(Boolean);
    const steps = Math.max(1, ...activeRanges.map((range) => Math.ceil(range.max - range.min)));
    for (let step = steps; step >= 0; step -= 1) {
      const ratio = step / steps;
      const imageSize = showImage ? scaledSize(imageRange, ratio) : 0;
      const labelSize = showLabel ? scaledSize(labelRange, ratio) : null;
      const valueSize = showValue
        ? Math.min(
          valueRange.max,
          Math.max(
            valueRange.min,
            (labelSize ?? scaledSize(labelRange, ratio)) - valueFontDeviation,
          ),
        )
        : null;
      const blockHeight = blockHeightOf({ imageSize, labelSize, valueSize, imageGap, textGap });
      if (imageSize > innerWidth || blockHeight > innerHeight) continue;
      if (labelSize && measureLabel(label, labelSize) > innerWidth) continue;
      if (valueSize && measureValue(value, valueSize) > innerWidth) continue;
      return {
        imageSize,
        ...(showImage && imageFallback
          ? { imageFallbackSize: scaledSize(labelRange, ratio) }
          : {}),
        labelSize,
        valueSize,
        showLabel,
        showValue,
        blockHeight,
      };
    }
    return null;
  };

  const hasImage = Boolean(image || imageFallback);
  const hasValue = value != null && text(value) !== '';
  const full = fitScaled({ showImage: hasImage, showLabel: true, showValue: hasValue });
  if (full) return full;

  if (hasImage) {
    const imageAndLabel = fitScaled({ showImage: true, showLabel: true, showValue: false });
    if (imageAndLabel) return imageAndLabel;
    const imageSize = Math.min(imageRange.max, Math.floor(innerWidth), Math.floor(innerHeight));
    if (imageSize >= imageRange.min) {
      const imageRatio = imageRange.max === imageRange.min
        ? 0
        : (imageSize - imageRange.min) / (imageRange.max - imageRange.min);
      return {
        imageSize,
        ...(imageFallback
          ? { imageFallbackSize: scaledSize(labelRange, imageRatio) }
          : {}),
        labelSize: null,
        valueSize: null,
        showLabel: false,
        showValue: false,
        blockHeight: imageSize,
      };
    }
  }

  const labelOnly = fitScaled({ showImage: false, showLabel: true, showValue: false });
  if (labelOnly) return labelOnly;
  if (hasValue) {
    const valueOnly = fitScaled({ showImage: false, showLabel: false, showValue: true });
    if (valueOnly) return valueOnly;
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
    .style('--dv-image-content-value-size', layout.valueSize == null ? null : `${layout.valueSize}px`)
    .style(
      '--dv-image-content-fallback-size',
      layout.imageFallbackSize == null ? null : `${layout.imageFallbackSize}px`,
    );

  if (layout.imageSize && (normalized.image || normalized.imageFallback)) {
    const fallback = normalized.imageFallback
      ? group.append('g')
        .attr('class', 'dv-image-content__fallback')
        .attr('aria-hidden', 'true')
        /* 兜底是缺失 / 失败态，不是加载中占位；有真实图片时首帧即隐藏。 */
        .style('display', normalized.image ? 'none' : null)
      : null;
    if (fallback) {
      fallback.append('circle')
        .attr('class', 'dv-image-content__fallback-bg')
        .attr('cx', x)
        .attr('cy', cursorY + layout.imageSize / 2)
        .attr('r', layout.imageSize / 2);
      fallback.append('text')
        .attr('class', 'dv-image-content__fallback-text')
        .attr('x', x)
        .attr('y', cursorY + layout.imageSize / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .text(normalized.imageFallback);
    }
    const image = normalized.image ? group.append('image') : null;
    if (image && fallback) {
      image
        .on('load', () => {
          fallback.style('display', 'none');
          image.style('display', null);
        })
        .on('error', () => {
          image.style('display', 'none');
          fallback.style('display', null);
        });
    }
    if (image) {
      image
        .attr('class', 'dv-image-content__image')
        .attr('x', x - layout.imageSize / 2)
        .attr('y', cursorY)
        .attr('width', layout.imageSize)
        .attr('height', layout.imageSize)
        .attr('href', normalized.image);
    }
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
    ...(normalized.imageFallback ? { titleIconFallback: normalized.imageFallback } : {}),
    rows: rows.map((row) => ({ ...row, showMarker: false })),
  };
}
