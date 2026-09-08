/*
 * WaterfallChart —— 瀑布图 L2 编排器。
 *
 * API 只接收数据与语义配置：
 *   { name?, period?, variant='standard', items,
 *     colorMode?, xAxisContent='name', showRelations=true,
 *     platform='pc', animation=true }
 * 主题独占形态由 behavior.json 解析；像素、颜色、字体与透明度不从实例传入。
 */
import { pointer, select } from 'd3';
import {
  containerDrivesHeight,
  containerTookOver,
  createFrame,
  observeResize,
  verticalGeometry,
} from '../../core/frame.js';
import { niceSplit } from '../../core/split.js';
import { bandX, linearY } from '../../core/scale.js';
import { renderGrid } from '../../core/grid.js';
import { wrapAxisLabel } from '../../core/axis.js';
import { renderAxisTag, renderCrosshairX } from '../../core/crosshair.js';
import { createTooltip } from '../../core/tooltip.js';
import { makeFormatter } from '../../core/format.js';
import { resolveBehavior, modeOf } from '../../core/theme.js';
import { tokenNum } from '../../core/tokens.js';
import { createTextMeasurer } from '../../core/measure.js';
import { resolveSeriesColors } from '../../core/palette.js';
import { resolveItemColors } from '../../core/visual-color.js';
import { renderDataLabels } from '../../core/label.js';
import { reducedMotion, runGrowth } from '../../core/motion.js';
import { renderWatermark } from '../../core/watermark.js';
import { WATERFALL_SETTINGS, waterfallBarWidth } from './geometry.js';
import {
  renderWaterfallDataSegmentLabel,
  renderWaterfallPercentBadge,
  renderWaterfallXAxis,
  waterfallItemColorVar,
  waterfallMetricText,
} from './render.js';
import {
  resolveWaterfall,
  waterfallExtent,
  WATERFALL_VARIANTS,
  WATERFALL_X_CONTENTS,
} from './model.js';

const COLOR_MODES = ['primary', 'semantic'];

function validateProfile(profile) {
  if (!profile || !['solid', 'arrow'].includes(profile['delta-form'])) {
    throw new TypeError('WaterfallChart：waterfall-profile.delta-form 仅支持 solid / arrow');
  }
  if (!COLOR_MODES.includes(profile['default-color-mode'])) {
    throw new TypeError('WaterfallChart：waterfall-profile.default-color-mode 仅支持 primary / semantic');
  }
}

export function WaterfallChart(host, cfg) {
  const {
    name = 'Waterfall chart',
    period,
    variant = 'standard',
    items,
    colorMode,
    xAxisContent = 'name',
    showRelations = true,
    platform = 'pc',
    animation = true,
  } = cfg;
  if (!WATERFALL_VARIANTS.includes(variant)) {
    throw new TypeError(`WaterfallChart：variant 仅支持 ${WATERFALL_VARIANTS.join(' / ')}`);
  }
  if (!WATERFALL_X_CONTENTS.includes(xAxisContent)) {
    throw new TypeError(`WaterfallChart：xAxisContent 仅支持 ${WATERFALL_X_CONTENTS.join(' / ')}`);
  }
  if (typeof showRelations !== 'boolean') {
    throw new TypeError('WaterfallChart：showRelations 必须是布尔值');
  }
  const model = resolveWaterfall(items);
  let usesContainerHeight = containerDrivesHeight(host.clientHeight);
  let selfHeight = host.clientHeight;
  let firstBuild = true;
  let stopGrow = () => {};
  let stopHover = () => {};

  host.classList.add('dv-chart', 'dv-chart--waterfall');
  const plotHost = select(host).append('div').attr('class', 'dv-chart__plot').node();
  const primary = resolveSeriesColors(host, { series: [{ type: 'bar' }] })[0];
  host.style.setProperty('--dv-waterfall-primary', primary);

  function build() {
    stopGrow();
    stopGrow = () => {};
    stopHover();
    stopHover = () => {};
    plotHost.innerHTML = '';

    const behavior = resolveBehavior(host, platform);
    const profile = behavior['waterfall-profile'];
    validateProfile(profile);
    const resolvedColorMode = colorMode ?? profile['default-color-mode'];
    if (!COLOR_MODES.includes(resolvedColorMode)) {
      throw new TypeError(`WaterfallChart：colorMode 仅支持 ${COLOR_MODES.join(' / ')}`);
    }
    const format = makeFormatter(behavior['number-format']);
    /* [WATERFALL-06/12][AXIS-04] 瀑布虽不渲染 Y 标签，X 标签带仍跟随当前主题的轴布局口径：
       Ainvest / iFinD-PC 的 outside 档与柱状图一样，先避让底部轴行盒再留 4px；
       THS / 移动端的 inside 档仍只留 4px。这样常态标签和点击贴片共用 frame.xBandTop，
       且同主题下不会因图型切换产生纵向跳位。 */
    const yForm = behavior['y-label-form'];
    const tooltipMode = behavior['tooltip-position'];
    const marker = behavior['legend-marker'];
    const wm = behavior.watermark;
    /* [WATERFALL-12/13][AXIS-04/08] Figma 的轴节点宽度与柱宽同口径：常规 64px、
       数据柱 110px；窄容器再按单槽宽减去轴标签最小净距收缩。名称由 L1 按真实 SVG 字宽
       最多折两行，不省略；常规轴与交互贴片共用最终行数组。 */
    const labelWidthLimit = variant === 'data'
      ? WATERFALL_SETTINGS['data-bar-width']
      : WATERFALL_SETTINGS['standard-bar-max-width'];
    const slotWidth = plotHost.clientWidth > 0
      ? plotHost.clientWidth / model.items.length
      : labelWidthLimit;
    const axisLabelMaxWidth = Math.max(1, Math.min(
      labelWidthLimit,
      slotWidth - tokenNum(plotHost, '--spacing-axis-x-label-min-gap'),
    ));
    const axisMeasurer = createTextMeasurer(plotHost, 'dv-axis-label');
    const axisRows = model.items.map((item) => {
      const nameLines = wrapAxisLabel(
        item.axisLabel ?? item.name,
        axisLabelMaxWidth,
        (text) => axisMeasurer.measure(text),
      );
      const lines = xAxisContent === 'name-value'
        ? [...nameLines, format(item.value)]
        : nameLines;
      return {
        lines,
        valueLineIndex: xAxisContent === 'name-value' ? lines.length - 1 : -1,
      };
    });
    axisMeasurer.destroy();
    const xBandLines = Math.max(...axisRows.map((row) => row.lines.length));
    const periodBand = period ? tokenNum(plotHost, '--line-height-large') : 0;
    const labelLineH = tokenNum(plotHost, '--line-height-extra-small');
    const badgeH = tokenNum(plotHost, '--line-height-super-small');
    const labelGap = tokenNum(plotHost, '--spacing-data-label-gap');
    const badgeGap = tokenNum(plotHost, '--spacing-2');
    const hasPercent = variant === 'standard' && model.items.some((item) => item.percent != null);
    const labelHeadroom = variant === 'standard'
      ? labelLineH + labelGap + (hasPercent ? badgeGap + badgeH : 0)
      : 0;
    const heightOpts = usesContainerHeight ? { height: plotHost.clientHeight } : {};
    const { gridH } = verticalGeometry(plotHost, {
      ...heightOpts,
      yForm, xBand: true, xBandLines, titleTopH: periodBand,
    });
    const [extentMin, extentMax] = waterfallExtent(model.items);
    const split = niceSplit(extentMin, extentMax, {
      headroom: labelHeadroom > 0 && gridH > 0 ? labelHeadroom / gridH : 0,
    });
    const frame = createFrame(plotHost, {
      ...heightOpts,
      yForm, xBand: true, xBandLines, titleTopH: periodBand,
    });
    frame.svg.attr('class', 'dv-waterfall').append('title').text(name);
    const y = linearY(split, frame.grid.top, frame.grid.bottom);
    const x = bandX(model.items.map((item) => item.id), frame.grid.left, frame.grid.right, { mode: 'slot' });
    const centers = model.items.map((item) => x(item.id) + x.bandwidth() / 2);
    const barWidth = waterfallBarWidth(variant, x.bandwidth());

    if (period) {
      frame.svg.append('text')
        .attr('class', 'dv-waterfall-period')
        .attr('x', frame.grid.right).attr('y', 0)
        .attr('text-anchor', 'end').attr('dominant-baseline', 'hanging')
        .text(period);
    }

    /* [WATERFALL-06] 只把 0 交给 L1 网格构件，天然只渲染一根加深基线。 */
    renderGrid(frame.svg.append('g').attr('class', 'dv-waterfall-grid'), frame, [0], y);

    const connectorLayer = frame.svg.append('g').attr('class', 'dv-waterfall-connectors');
    connectorLayer.selectAll('line.dv-waterfall-connector')
      .data(model.connectors)
      .join('line')
      .attr('class', 'dv-waterfall-connector')
      .attr('x1', (_link, index) => centers[index] + barWidth / 2)
      .attr('x2', (_link, index) => centers[index + 1] - barWidth / 2)
      .attr('y1', (link) => y(link.level))
      .attr('y2', (link) => y(link.level));

    /* resolveItemColors 只做通用有符号语义映射；是否采用它、总计是否回主色由本族规则决定。 */
    const semanticColors = resolveItemColors({
      mode: 'semantic-flat',
      values: model.items.map((item) => item.value),
      semanticValues: model.items.map((item) => item.value),
    });
    const itemColors = model.items.map((item, index) => ({
      variable: waterfallItemColorVar(item, resolvedColorMode),
      fill: item.kind === 'total' || resolvedColorMode === 'primary'
        ? 'var(--dv-waterfall-primary)'
        : semanticColors[index].fill,
    }));

    const barLayer = frame.svg.append('g').attr('class', 'dv-waterfall-bars');
    const itemGroups = barLayer.selectAll('g.dv-waterfall-item')
      .data(model.items, (item) => item.id)
      .join('g')
      .attr('class', 'dv-waterfall-item')
      .style('color', (_item, index) => itemColors[index].fill);
    const drawCalls = [];

    itemGroups.each(function (item, itemIndex) {
      const itemLayer = select(this);
      const center = centers[itemIndex];
      const light = profile['delta-form'] === 'arrow' && item.kind === 'delta';
      const arrow = variant === 'standard' && light;
      const segments = itemLayer.selectAll('g.dv-waterfall-segment')
        .data(item.segments, (segment) => segment.id)
        .join('g')
        .attr('class', 'dv-waterfall-segment');
      const rects = segments.append('rect')
        .attr('class', `dv-waterfall-bar${light ? ' dv-waterfall-bar--delta-arrow' : ''}`)
        .attr('x', center - barWidth / 2)
        .attr('width', barWidth);

      const dividerValues = variant === 'data'
        ? item.segments.slice(0, -1).map((segment) => segment.end)
        : [];
      const dividers = itemLayer.selectAll('line.dv-waterfall-segment-divider')
        .data(dividerValues)
        .join('line')
        .attr('class', 'dv-waterfall-segment-divider')
        .attr('x1', center - barWidth / 2).attr('x2', center + barWidth / 2);

      let cap;
      let directionLine;
      let directionHead;
      if (arrow) {
        cap = itemLayer.append('line').attr('class', 'dv-waterfall-delta-cap')
          .attr('x1', center - barWidth / 2).attr('x2', center + barWidth / 2);
        directionLine = itemLayer.append('line').attr('class', 'dv-waterfall-direction-line')
          .attr('x1', center).attr('x2', center);
        directionHead = itemLayer.append('path').attr('class', 'dv-waterfall-direction-head');
      }

      const draw = (t) => {
        const animated = (value) => item.start + (value - item.start) * t;
        rects
          .attr('y', (segment) => Math.min(y(animated(segment.start)), y(animated(segment.end))))
          .attr('height', (segment) => Math.abs(y(animated(segment.end)) - y(animated(segment.start))));
        dividers
          .attr('y1', (value) => y(animated(value)))
          .attr('y2', (value) => y(animated(value)));
        if (!arrow) return;
        const startY = y(item.start);
        const endY = y(animated(item.end));
        const pixelHeight = Math.abs(endY - startY);
        cap.attr('y1', startY).attr('y2', startY);
        const visible = pixelHeight > WATERFALL_SETTINGS['delta-arrow-hide-height'];
        directionLine.style('display', visible ? null : 'none');
        directionHead.style('display', visible ? null : 'none');
        if (!visible) return;
        const direction = endY >= startY ? 1 : -1;
        const headH = WATERFALL_SETTINGS['arrow-head-height'];
        const halfW = WATERFALL_SETTINGS['arrow-head-width'] / 2;
        const baseY = endY - direction * headH;
        directionLine.attr('y1', startY).attr('y2', baseY);
        directionHead.attr('d', `M${center},${endY}L${center - halfW},${baseY}L${center + halfW},${baseY}Z`);
      };
      drawCalls.push(draw);
      draw(1);
    });

    const annotationLayer = frame.svg.append('g').attr('class', 'dv-waterfall-annotations');
    if (variant === 'standard') {
      model.items.forEach((item, index) => {
        const top = Math.min(y(item.start), y(item.end));
        const hasItemPercent = item.percent != null;
        const mainTop = top - labelGap - labelLineH - (hasItemPercent ? badgeGap + badgeH : 0);
        const labelGroup = annotationLayer.append('g')
          .style('color', itemColors[index].fill);
        renderDataLabels(labelGroup, frame, [{
          text: format(item.value),
          x: centers[index], y: mainTop,
          baseline: 'hanging',
          tone: resolvedColorMode === 'semantic' && item.kind !== 'total' ? 'series' : 'neutral',
          sizeClass: 'dv-waterfall-value-label',
        }], { collide: false });
        if (hasItemPercent) {
          renderWaterfallPercentBadge(annotationLayer, plotHost, {
            x: centers[index], y: mainTop + labelLineH + badgeGap, value: item.percent,
          });
        }
      });
    } else {
      model.items.forEach((item, itemIndex) => {
        item.segments.forEach((segment) => {
          const top = Math.min(y(segment.start), y(segment.end));
          const height = Math.abs(y(segment.end) - y(segment.start));
          renderWaterfallDataSegmentLabel(annotationLayer, plotHost, segment, {
            x: centers[itemIndex] - barWidth / 2,
            top, width: barWidth, height,
          }, format, profile['delta-form'] === 'arrow' && item.kind === 'delta');
        });
      });
    }

    renderWaterfallXAxis(
      frame.svg.append('g').attr('class', 'dv-waterfall-x-axis'),
      frame, model.items, centers, axisRows, showRelations,
    );

    /* [WATERFALL-15] 水印在标注之后、hover 之前，锚点仍是 frame.grid。 */
    if (wm) renderWatermark(frame.svg.append('g').attr('class', 'dv-watermark-layer'), frame, {
      spec: wm, mode: modeOf(host),
    });

    const hoverLayer = frame.svg.append('g').attr('class', 'dv-waterfall-hover').style('display', 'none');
    const tooltip = createTooltip(plotHost);
    const hideDelay = tokenNum(plotHost, '--tooltip-hide-delay');
    let hideTimer = 0;
    const hitItems = model.items.map((item, index) => {
      const left = index === 0 ? frame.grid.left : (centers[index - 1] + centers[index]) / 2;
      const right = index === model.items.length - 1 ? frame.grid.right : (centers[index] + centers[index + 1]) / 2;
      return { item, index, left, right };
    });
    const hitLayer = frame.svg.append('g').attr('class', 'dv-waterfall-hits');
    const hits = hitLayer.selectAll('rect.dv-waterfall-hit').data(hitItems).join('rect')
      .attr('class', 'dv-waterfall-hit')
      .attr('x', (hit) => hit.left).attr('width', (hit) => hit.right - hit.left)
      .attr('y', frame.grid.top).attr('height', frame.grid.height);

    const showHover = (event, hit) => {
      clearTimeout(hideTimer);
      const local = pointer(event, plotHost);
      const item = hit.item;
      const segment = variant === 'data'
        ? item.segments.find((candidate) => {
          const top = Math.min(y(candidate.start), y(candidate.end));
          const bottom = Math.max(y(candidate.start), y(candidate.end));
          return local[1] >= top && local[1] <= bottom;
        })
        : null;
      const datum = segment ?? item;
      const cx = centers[hit.index];
      hoverLayer.style('display', null).selectAll('*').remove();
      const axisRow = axisRows[hit.index];
      const tagTop = renderAxisTag(hoverLayer, frame, {
        x: cx,
        label: axisRow.lines,
        lineClass: (_text, lineIndex) => (
          lineIndex === axisRow.valueLineIndex ? 'dv-waterfall-axis-value' : null
        ),
      });
      renderCrosshairX(hoverLayer, frame, cx, tagTop);
      tooltip.show({
        title: period,
        rows: [{
          key: datum.id,
          label: datum.name,
          type: 'bar',
          colorVar: itemColors[hit.index].variable,
          value: waterfallMetricText(format, datum.value, datum.percent),
        }],
      }, marker);
      tooltip.place(tooltipMode, {
        grid: frame.grid,
        cx,
        pointer: { x: local[0], y: local[1] },
      });
    };
    const leave = () => {
      hideTimer = setTimeout(() => {
        hoverLayer.style('display', 'none');
        tooltip.hide();
      }, hideDelay);
    };
    hits.on('mouseenter', showHover).on('mousemove', showHover).on('mouseleave', leave);
    stopHover = () => {
      clearTimeout(hideTimer);
      tooltip.hide();
      hits.on('mouseenter', null).on('mousemove', null).on('mouseleave', null);
    };

    /* [WATERFALL-14][MOTION-01/04/05/07] 每根从自己的累计起点生长，标注/连接线结束后再出现。 */
    const animateNow = animation && firstBuild && !reducedMotion();
    firstBuild = false;
    if (animateNow) {
      connectorLayer.style('display', 'none');
      annotationLayer.style('display', 'none');
      hitLayer.style('display', 'none');
      drawCalls.forEach((draw) => draw(0));
      stopGrow = runGrowth(tokenNum(plotHost, '--motion-duration-grow'), (t) => {
        drawCalls.forEach((draw) => draw(t));
      }, {
        onDone: () => {
          connectorLayer.style('display', null);
          annotationLayer.style('display', null);
          hitLayer.style('display', null);
        },
      });
    }
    selfHeight = host.clientHeight;
  }

  build();
  const stopResize = observeResize(host, () => {
    if (!usesContainerHeight && containerTookOver(host.clientHeight, selfHeight)) usesContainerHeight = true;
    build();
  });
  return {
    destroy() {
      stopGrow();
      stopHover();
      stopResize();
      host.classList.remove('dv-chart', 'dv-chart--waterfall');
      host.style.removeProperty('--dv-waterfall-primary');
      host.replaceChildren();
    },
  };
}
