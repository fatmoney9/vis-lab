/*
 * [L2-LOCAL] 瀑布图专属 SVG 片段与展示文本。
 * 调用方提供 layer / frame / 已解析数据，本模块不持有生命周期、主题状态或 hover 状态。
 */
import { renderXLabels } from '../../core/axis.js';
import { measureTexts } from '../../core/measure.js';
import { tokenNum } from '../../core/tokens.js';
import { WATERFALL_SETTINGS } from './geometry.js';

const percentText = (value) => (value == null || value === ''
  ? null
  : `${typeof value === 'number' ? String(value) : String(value).replace(/%$/, '')}%`);

/* [WATERFALL-08] 数据看板右列是一个完整读数，不把数值与涨幅拆成额外字段。 */
export function waterfallMetricText(format, value, percent) {
  const pct = percentText(percent);
  return `${format(value)}${pct ? `(${pct})` : ''}`;
}

const percentColorVar = (value) => {
  const number = Number(String(value).replace(/%$/, ''));
  if (!Number.isFinite(number) || number === 0) return '--color-price-even';
  return number > 0 ? '--color-price-up' : '--color-price-down';
};

export function waterfallItemColorVar(item, colorMode) {
  /* [WATERFALL-10] 首末总计恒为主色；中间汇总与增减项才参与语义色。 */
  if (item.kind === 'total' || colorMode === 'primary') return '--dv-waterfall-primary';
  return item.value === 0
    ? '--color-price-even-gradient'
    : `--color-price-${item.value > 0 ? 'up' : 'down'}-gradient-1`;
}

export function renderWaterfallPercentBadge(layer, host, {
  x, y, value, anchor = 'middle',
}) {
  const textValue = percentText(value);
  if (!textValue) return null;
  const pad = tokenNum(host, '--spacing-2');
  const height = tokenNum(host, '--line-height-super-small');
  const radius = tokenNum(host, '--radius-4');
  const width = measureTexts(host, [textValue], 'dv-waterfall-percent__text')[0] + pad * 2;
  const left = anchor === 'start' ? x : x - width / 2;
  const colorVar = percentColorVar(value);
  const group = layer.append('g')
    .attr('class', 'dv-waterfall-percent')
    .style('color', `var(${colorVar})`);
  group.append('rect')
    .attr('class', 'dv-waterfall-percent__bg')
    .attr('x', left).attr('y', y)
    .attr('width', width).attr('height', height)
    .attr('rx', radius).attr('ry', radius);
  group.append('text')
    .attr('class', 'dv-waterfall-percent__text')
    .attr('x', left + width / 2).attr('y', y + height / 2)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
    .text(textValue);
  return { width, height, colorVar };
}

export function renderWaterfallXAxis(layer, frame, items, centers, rows, showRelations) {
  /* [WATERFALL-12][AXIS-04/06/08] L2 只声明最终逐行内容；每行真实宽度、标签盒和
     常态 / 高亮态的 <tspan> 结构全部由 L1 轴构件负责。 */
  renderXLabels(layer, frame, items.map((item, index) => ({
    label: item.axisLabel ?? item.name, x: centers[index], lines: rows[index].lines,
    valueLineIndex: rows[index].valueLineIndex,
  })), {
    /* [WATERFALL-12] 每一项与运算符共同构成等式，省掉任一节点都会改变叙事。 */
    collision: 'none',
    lineClass: (_text, lineIndex, datum) => (
      lineIndex === datum.valueLineIndex ? 'dv-waterfall-axis-value' : null
    ),
  });

  layer.selectAll('text.dv-waterfall-operator')
    .data(showRelations
      ? items.map((item, index) => ({ item, index }))
        .filter(({ item, index }) => index > 0 && item.operatorBefore)
      : [])
    .join('text')
    .attr('class', 'dv-waterfall-operator')
    .attr('x', ({ index }) => (centers[index - 1] + centers[index]) / 2)
    .attr('y', frame.xBandTop)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'hanging')
    .text(({ item }) => item.operatorBefore);
}

export function renderWaterfallDataSegmentLabel(
  layer,
  host,
  segment,
  geometry,
  format,
  light,
) {
  const { x, top, height } = geometry;
  if (height < WATERFALL_SETTINGS['data-label-hide-height']) return;
  const padX = tokenNum(host, '--spacing-6');
  const padY = tokenNum(host, '--spacing-4');
  const lineH = tokenNum(host, '--line-height-extra-small');
  const nameLines = (Array.isArray(segment.labelLines) ? segment.labelLines : [segment.name])
    .map(String).filter(Boolean).slice(0, 2);
  const label = layer.append('g')
    .attr('class', `dv-waterfall-segment-label dv-waterfall-segment-label--${light ? 'light' : 'solid'}`)
    .attr('transform', `translate(${x + padX},${top + padY})`);
  const name = label.append('text').attr('class', 'dv-waterfall-segment-label__name')
    .attr('x', 0).attr('y', 0).attr('dominant-baseline', 'hanging');
  nameLines.forEach((line, index) => {
    name.append('tspan').attr('x', 0).attr('dy', index === 0 ? 0 : lineH).text(line);
  });
  const valueY = nameLines.length * lineH;
  label.append('text').attr('class', 'dv-waterfall-segment-label__value')
    .attr('x', 0).attr('y', valueY).attr('dominant-baseline', 'hanging')
    .text(format(segment.value));
  const badgeY = valueY + lineH;
  const badgeHeight = tokenNum(host, '--line-height-super-small');
  if (segment.percent != null && badgeY + badgeHeight <= height - padY * 2) {
    renderWaterfallPercentBadge(label, host, {
      x: 0, y: badgeY, value: segment.percent, anchor: 'start',
    });
  }
}
