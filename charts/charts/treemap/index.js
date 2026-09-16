/*
 * treemap/index.js -- [L2] 矩形树图编排器。
 *
 * API 只接收层级数据与形态语义：
 *   { name?, root:{name,value?,children?}, direction='squarify',
 *     variant='local', labelType='twoLineCenter', colorMode='intensity', colorThresholds?,
 *     platform='pc', animation=true, text? }
 * text 是组件固定文案的整套替换（CHARTTEXT-01/02），缺省为 content.js 的 TREEMAP_TEXT。
 * 高度由宿主容器决定；间距、圆角、文字和颜色由 token / 公共构件决定；
 * 语义分档阈值由业务配置提供。
 */
import { hierarchy, select, treemap, treemapDice, treemapSlice, treemapSquarify } from 'd3';
import { createFrame, observeResize, containerDrivesHeight, containerTookOver } from '../../core/frame.js';
import {
  createHighlightState, applyHover, applyLeave, applyPick, activeTarget,
} from '../../core/highlight-state.js';
import { tokenNum } from '../../core/tokens.js';
import { modeOf, resolveBehavior } from '../../core/theme.js';
import { makeFormatter } from '../../core/format.js';
import { createTextMeasurer } from '../../core/measure.js';
import { fitImageContent, renderImageContent } from '../../core/image-content.js';
import { resolveSeriesColors } from '../../core/palette.js';
import { ITEM_COLOR_MODES, resolveItemColors } from '../../core/visual-color.js';
import { renderWatermark } from '../../core/watermark.js';
import { createTooltip } from '../../core/tooltip.js';
import { reducedMotion, runGrowth } from '../../core/motion.js';
import { fillText, resolveChartText } from '../../core/chart-text.js';
import {
  displayChildren,
  entryCells,
  fitTreemapLabel,
  ratioShares,
  treemapPlotHeight,
} from './geometry.js';
import {
  detailTooltipContent,
  itemPresentation,
  TREEMAP_TEXT,
} from './content.js';

const NAME_CLASS = 'dv-treemap-label__name';
const VALUE_CLASS = 'dv-treemap-label__value';

function requiredTokenNum(host, name) {
  const value = tokenNum(host, name);
  if (!(value > 0)) throw new Error(`TreemapChart：缺少正数 token ${name}`);
  return value;
}

function requiredNonNegativeTokenNum(host, name) {
  const value = tokenNum(host, name);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`TreemapChart：缺少非负 token ${name}`);
  }
  return value;
}

function resolveImageContentMetrics(
  host,
  { nameMax, nameMin, valueMax, valueMin, valueFontDeviation },
) {
  return {
    padding: requiredTokenNum(host, '--spacing-4'),
    imageGap: requiredTokenNum(host, '--spacing-6'),
    textGap: requiredTokenNum(host, '--spacing-2'),
    valueFontDeviation,
    image: {
      min: requiredTokenNum(host, '--size-treemap-content-image-min'),
      max: requiredTokenNum(host, '--size-treemap-content-image-max'),
    },
    label: { min: nameMin, max: nameMax },
    value: { min: valueMin, max: valueMax },
  };
}

function tileFor(direction) {
  if (direction === 'horizontal') return treemapDice;
  if (direction === 'vertical') return treemapSlice;
  return treemapSquarify;
}

/* [TREEMAP-11] 入口型是固定两排行列，不用真实数值决定面积。 */
function entryTile(node, x0, y0, x1, y1) {
  const children = node.children ?? [];
  entryCells(children.length, x1 - x0, y1 - y0).forEach((cell) => {
    const child = children[cell.index];
    child.x0 = x0 + cell.x0;
    child.x1 = x0 + cell.x1;
    child.y0 = y0 + cell.y0;
    child.y1 = y0 + cell.y1;
  });
}

export function TreemapChart(host, cfg) {
  const {
    name,
    root,
    direction = 'squarify',
    variant = 'local',
    labelType = 'twoLineCenter',
    colorMode = 'intensity',
    colorThresholds,
    platform = 'pc',
    animation = true,
  } = cfg;
  if (!root || typeof root !== 'object') throw new TypeError('TreemapChart：root 必须是层级对象');
  if (!['squarify', 'horizontal', 'vertical'].includes(direction)) {
    throw new TypeError("TreemapChart：direction 仅支持 'squarify'、'horizontal' 或 'vertical'");
  }
  if (!['entry', 'local', 'overall'].includes(variant)) {
    throw new TypeError("TreemapChart：variant 仅支持 'entry'、'local' 或 'overall'");
  }
  if (!['twoLineCenter', 'twoLineLeftBottom', 'staticCenter'].includes(labelType)) {
    throw new TypeError('TreemapChart：labelType 不是受支持的标签形态');
  }
  if (!ITEM_COLOR_MODES.includes(colorMode)) {
    throw new TypeError('TreemapChart：colorMode 不是受支持的颜色模式');
  }
  if (!['pc', 'mobile'].includes(platform)) {
    throw new TypeError("TreemapChart：platform 仅支持 'pc' 或 'mobile'");
  }
  /* [CHARTTEXT-01/02] 固定文案：不给走缺省表，给了必须整套——语言由 L3 决定，本层不判断 */
  const chartText = resolveChartText(TREEMAP_TEXT, cfg.text, 'TreemapChart');

  const initialHostHeight = host.clientHeight;
  host.replaceChildren();
  host.classList.add('dv-chart', 'dv-chart--treemap');
  host.dataset.treemapVariant = variant;
  const plotHost = select(host).append('div').attr('class', 'dv-chart__plot').node();

  const behavior = resolveBehavior(host, platform);
  const treemapProfile = behavior['treemap-profile'];
  if (!treemapProfile || typeof treemapProfile !== 'object') {
    throw new Error('TreemapChart：主题缺少 treemap-profile 行为配置');
  }
  if (!['text', 'image'].includes(treemapProfile.content)) {
    throw new Error('TreemapChart：treemap-profile.content 仅支持 text 或 image');
  }
  const usesImageContent = treemapProfile.content === 'image';
  const format = makeFormatter(behavior['number-format']);
  const marker = behavior['legend-marker'];
  const wm = behavior.watermark;
  let firstBuild = true;
  let selfHeight = initialHostHeight;
  let usesContainerHeight = containerDrivesHeight(initialHostHeight);
  let stopGrow = () => {};
  let stopHover = () => {};

  function build(forceMotion = false) {
    stopGrow();
    stopHover();
    stopGrow = () => {};
    stopHover = () => {};
    plotHost.replaceChildren();

    const items = displayChildren(root);
    /* [TREEMAP-08] 高度恒由容器决定、图面填满整个容器，与 cartesian / pie 同一模型
       （那两族的图例 / 缩放轴 / 轴标题同样从容器高里让位；本族没有这类附加带）。 */
    const plotHeight = treemapPlotHeight({
      hostHeight: host.clientHeight,
      fallbackHeight: tokenNum(host, '--size-chart-region-height'),
      useContainerHeight: usesContainerHeight,
    });
    /* [TREEMAP-08] 容器塌到不可用高度时**推迟到下一帧重画**，不抛错——与 cartesian / pie
       同一处置（那两族用的是 `clientHeight < 40 → requestAnimationFrame(build)`）。
       容器高在真实页面里会短暂为 0（标签页切换、折叠面板展开、懒布局首帧），
       那不是配置错误，抛异常会把整张图打没且不会自己回来。
       **仅当「既没有容器高、主题也没给兜底」时才抛**——那才是真正的配置缺失，要当场看见。 */
    if (!(plotHeight > 0)) {
      if (usesContainerHeight) return requestAnimationFrame(build);
      throw new Error('TreemapChart：外层容器必须提供有效高度，或主题需提供 --size-chart-region-height');
    }
    const width = Math.max(1, plotHost.clientWidth || host.clientWidth);
    const frame = createFrame(plotHost, { width, height: plotHeight, xBand: false, minGridHeight: 0 });
    frame.svg
      .attr('class', 'dv-treemap')
      .attr('aria-label', fillText(chartText.chartLabel, { name: name ?? root.name ?? chartText.fallbackName }));

    if (!items.length) {
      selfHeight = host.clientHeight;
      firstBuild = false;
      return;
    }

    /* [TREEMAP-04][TREEMAP-17][COLOR-09] L2 只把主题 behavior 与归一化数值交给 L1：
       series / intensity / semantic 三类颜色策略均不认识主题或业务字段，且不参与面积布局。 */
    const declared = Array.isArray(root.children) ? root.children : [];
    const colors = resolveSeriesColors(host, { series: declared.map(() => ({ type: 'bar' })) });
    const primaryColor = resolveSeriesColors(host, { series: [{ type: 'bar' }] })[0];
    const activeColorMode = treemapProfile['color-mode'] === 'config'
      ? colorMode
      : treemapProfile['color-mode'];
    if (!ITEM_COLOR_MODES.includes(activeColorMode)) {
      throw new Error('TreemapChart：treemap-profile.color-mode 不是受支持的颜色模式');
    }
    items.forEach((item) => { item.presentation = itemPresentation(item); });
    const assignments = resolveItemColors({
      mode: activeColorMode,
      values: items.map((item) => item.value),
      semanticValues: items.map((item) => item.presentation.colorValue),
      seriesColors: items.map((item) => colors[item.index] ?? colors[0]),
      primaryColor,
      thresholds: colorThresholds,
    });
    host.dataset.treemapColorMode = activeColorMode;
    items.forEach((item, itemIndex) => {
      const assignment = assignments[itemIndex];
      item.colorVar = `--dv-treemap-${item.index + 1}`;
      item.semanticValue = assignment.semanticValue;
      item.fill = assignment.fill;
      item.opacity = assignment.opacity;
      item.displayValue = usesImageContent || activeColorMode.startsWith('semantic-')
        ? (item.presentation.value ?? format(item.semanticValue))
        : format(item.value);
      item.displayName = usesImageContent
        ? item.presentation.label
        : String(item.node.name ?? '');
      host.style.setProperty(item.colorVar, item.fill);
    });

    const shares = variant === 'entry'
      ? items.map(() => 1 / items.length)
      : ratioShares(items.map((item) => item.value));
    const itemGap = requiredTokenNum(host, '--size-treemap-gap');
    const layoutRoot = hierarchy({ children: items.map((item, index) => ({ item, share: shares[index] })) })
      .sum((datum) => datum.share ?? 0)
      .sort((a, b) => b.value - a.value
        || (b.data.item?.value ?? 0) - (a.data.item?.value ?? 0));
    treemap()
      .tile(variant === 'entry' ? entryTile : tileFor(direction))
      .size([frame.grid.width, frame.grid.height])
      .paddingInner(itemGap)
      .round(true)(layoutRoot);
    const leaves = layoutRoot.leaves();
    const nodeLayer = frame.svg.append('g')
      .attr('class', 'dv-treemap-nodes')
      .attr('transform', `translate(${frame.grid.left},${frame.grid.top})`);
    const labelLayer = frame.svg.append('g')
      .attr('class', 'dv-treemap-labels')
      .attr('transform', `translate(${frame.grid.left},${frame.grid.top})`);
    const groups = nodeLayer.selectAll('g.dv-treemap-node')
      .data(leaves)
      .join('g')
      .attr('class', 'dv-treemap-node')
      .style('color', (d) => `var(${d.data.item.colorVar})`)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (d) => fillText(chartText.leafLabel, {
        name: d.data.item.displayName,
        value: d.data.item.displayValue,
      }));
    groups.append('rect')
      .attr('class', 'dv-treemap-node__rect')
      .style('fill-opacity', (d) => d.data.item.opacity);
    const masks = groups.append('rect').attr('class', 'dv-treemap-node__mask').attr('aria-hidden', 'true');

    const padding = requiredTokenNum(host, '--spacing-4');
    const labelGap = requiredTokenNum(host, '--spacing-2');
    const lineExtra = requiredTokenNum(host, '--spacing-4');
    const valueFontDeviation = requiredNonNegativeTokenNum(
      host,
      '--size-treemap-value-font-deviation',
    );
    const nameMax = requiredTokenNum(host, `--font-size-treemap-${variant}-label-name`);
    const nameMin = requiredTokenNum(host, `--font-size-treemap-${variant}-label-name-min`);
    const valueMax = requiredTokenNum(host, `--font-size-treemap-${variant}-label-value`);
    const valueMin = requiredTokenNum(host, `--font-size-treemap-${variant}-label-value-min`);
    const imageMetrics = usesImageContent
      ? resolveImageContentMetrics(host, {
        nameMax,
        nameMin,
        valueMax,
        valueMin,
        valueFontDeviation,
      })
      : null;
    const names = leaves.map((d) => d.data.item.displayName);
    const values = leaves.map((d) => d.data.item.displayValue);
    const nameMeasurer = createTextMeasurer(plotHost, NAME_CLASS);
    const valueMeasurer = createTextMeasurer(plotHost, VALUE_CLASS);
    try {
      leaves.forEach((leaf, index) => {
        const item = leaf.data.item;
        const w = leaf.x1 - leaf.x0;
        const h = leaf.y1 - leaf.y0;
        if (usesImageContent) {
          const content = item.presentation;
          const layout = fitImageContent({
            label: item.displayName,
            value: item.displayValue,
            image: content.image,
            imageFallback: content.imageFallback,
            width: w,
            height: h,
            metrics: imageMetrics,
            measureLabel: nameMeasurer.measure,
            measureValue: valueMeasurer.measure,
          });
          if (!layout) return;
          const x = (leaf.x0 + leaf.x1) / 2;
          renderImageContent(labelLayer, {
            content: { ...content, label: item.displayName, value: item.displayValue },
            layout,
            x,
            y: (leaf.y0 + leaf.y1 - layout.blockHeight) / 2,
            imageGap: imageMetrics.imageGap,
            textGap: imageMetrics.textGap,
            key: String(item.index),
            className: 'dv-treemap-label',
          });
          return;
        }
        const layout = fitTreemapLabel({
          name: names[index], value: values[index], width: w, height: h, padding, gap: labelGap,
          nameMax, nameMin, valueMax, valueMin, lineExtra,
          valueFontDeviation,
          allowWrap: labelType !== 'staticCenter',
          includeValue: labelType !== 'staticCenter',
          measureName: nameMeasurer.measure,
          measureValue: valueMeasurer.measure,
        });
        if (!layout) return;

        const center = labelType !== 'twoLineLeftBottom';
        const x = center ? (leaf.x0 + leaf.x1) / 2 : leaf.x0 + padding;
        const blockTop = center
          ? (leaf.y0 + leaf.y1 - layout.blockHeight) / 2
          : leaf.y1 - padding - layout.blockHeight;
        const anchor = center ? 'middle' : 'start';
        const label = labelLayer.append('g')
          .attr('class', 'dv-treemap-label')
          .attr('data-key', String(item.index))
          .style('--dv-treemap-name-size', `${layout.nameSize}px`)
          .style('--dv-treemap-value-size', layout.valueSize == null ? null : `${layout.valueSize}px`);
        layout.nameLines.forEach((line, lineIndex) => {
          label.append('text')
            .attr('class', NAME_CLASS)
            .attr('x', x)
            .attr('y', blockTop + layout.nameLineHeight * (lineIndex + 0.5))
            .attr('text-anchor', anchor)
            .attr('dominant-baseline', 'middle')
            .text(line);
        });
        if (layout.valueText) {
          label.append('text')
            .attr('class', VALUE_CLASS)
            .attr('x', x)
            .attr('y', blockTop + layout.nameLines.length * layout.nameLineHeight
              + labelGap + layout.valueLineHeight / 2)
            .attr('text-anchor', anchor)
            .attr('dominant-baseline', 'middle')
            .text(layout.valueText);
        }
      });
    } finally {
      nameMeasurer.destroy();
      valueMeasurer.destroy();
    }

    /* [TREEMAP-07][TOOLTIP-07] 共用 L1 看板；L2 只装配矩形节点内容。
       **位置档恒 follow**——与饼环同一条通则：无坐标系图没有「最近类目」可锚，
       气泡跟指针走才对得上你正在看的那个节点。这不是主题分叉（三主题一致），
       故在 L2 定死、不给 behavior.json 加键（同 PIE-05 的做法）。 */
    const tooltip = createTooltip(plotHost);
    const tooltipMode = 'follow';
    const hideDelay = tokenNum(plotHost, '--tooltip-hide-delay');
    let hideTimer = 0;
    /* [TREEMAP-06] hover / 钉住的状态迁移走 L1（core/highlight-state.js），与其他关系型图同一套。
       本族只有一类图元、也没有邻域可算，故 kind 恒为 'leaf'、key 直接用 leaf 对象本身——
       状态与 pinnedLeaf 一样活在 build() 内，重渲即重置，行为与先前逐字一致。 */
    let highlight = createHighlightState();
    const reset = () => masks.classed('is-active', false);
    const showTip = (event, leaf) => {
      clearTimeout(hideTimer);
      const item = leaf.data.item;
      masks.classed('is-active', (d) => d === leaf);
      if (usesImageContent) tooltip.show(detailTooltipContent(item), marker);
      else {
        tooltip.show({
          title: root.name ?? name,
          rows: [{
            key: String(item.index), label: item.node.name, type: 'bar',
            colorVar: item.colorVar, value: item.displayValue,
          }],
        }, marker);
      }
      const box = plotHost.getBoundingClientRect();
      const pointer = event
        ? { x: event.clientX - box.left, y: event.clientY - box.top }
        : { x: frame.grid.left + (leaf.x0 + leaf.x1) / 2, y: frame.grid.top + (leaf.y0 + leaf.y1) / 2 };
      tooltip.place(tooltipMode, { grid: frame.grid, cx: pointer.x, pointer });
    };
    /* 把当前高亮目标画出来；返回是否有目标——没有时气泡怎么收由调用方决定
       （移出是延时收，点掉钉住是立刻收）。 */
    const renderHighlight = (event) => {
      const target = activeTarget(highlight);
      if (!target) { reset(); return false; }
      showTip(event, target.key);
      return true;
    };
    const enter = (event, leaf) => {
      highlight = applyHover(highlight, 'leaf', leaf);
      renderHighlight(event);
    };
    const leave = () => {
      highlight = applyLeave(highlight);
      /* 有钉住则回落到钉住态，否则延时收气泡 */
      if (!renderHighlight(null)) hideTimer = setTimeout(() => tooltip.hide(), hideDelay);
    };
    /* [TREEMAP-06] 单层展示，无下钻：点击只钉住 / 取消钉住 Tooltip。 */
    const activate = (event, leaf) => {
      highlight = applyPick(highlight, 'leaf', leaf);
      if (!renderHighlight(event)) tooltip.hide();
    };
    groups
      .on('mouseenter', enter)
      .on('mousemove', enter)
      .on('mouseleave', leave)
      .on('click', (event, leaf) => activate(event, leaf))
      .on('keydown', (event, leaf) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activate(null, leaf);
      });
    stopHover = () => { clearTimeout(hideTimer); tooltip.hide(); };

    if (wm) renderWatermark(frame.svg.append('g').attr('class', 'dv-watermark-layer'), frame, { spec: wm, mode: modeOf(host) });

    /* [MOTION] 入场从画布中心展开——下钻已移除（TREEMAP-06），不再有「从被点方块放大」的起点。 */
    const origin = { x: frame.grid.width / 2, y: frame.grid.height / 2, w: 0, h: 0 };
    const shapes = groups.selectAll('rect');
    const drawRects = (t = 1) => {
      shapes
        .attr('x', (d) => origin.x + (d.x0 - origin.x) * t)
        .attr('y', (d) => origin.y + (d.y0 - origin.y) * t)
        .attr('width', (d) => Math.max(0, origin.w + (d.x1 - d.x0 - origin.w) * t))
        .attr('height', (d) => Math.max(0, origin.h + (d.y1 - d.y0 - origin.h) * t));
    };
    drawRects();
    const animateNow = animation && (firstBuild || forceMotion) && !reducedMotion();
    firstBuild = false;
    if (animateNow) {
      labelLayer.style('display', 'none');
      drawRects(0);
      stopGrow = runGrowth(tokenNum(host, '--motion-duration-grow'), drawRects, {
        onDone: () => labelLayer.style('display', null),
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
      host.classList.remove('dv-chart', 'dv-chart--treemap');
      delete host.dataset.treemapVariant;
      delete host.dataset.treemapColorMode;
      host.replaceChildren();
    },
  };
}
