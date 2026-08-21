/*
 * treemap/index.js -- [L2] 矩形树图编排器。
 *
 * API 只接收层级数据与形态语义：
 *   { name?, root:{name,value?,children?}, direction='squarify',
 *     variant='local', ratioMode='approximate', labelType='twoLineCenter', colorMode='intensity',
 *     platform='pc', animation=true }
 * 尺寸、间距、圆角、文字和比例跨度全部由 token / 公共构件决定。
 */
import { hierarchy, select, treemap, treemapDice, treemapSlice, treemapSquarify } from 'd3';
import { createFrame, observeResize } from '../../core/frame.js';
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
import {
  displayChildren,
  entryCells,
  fitTreemapLabel,
  pathNames,
  ratioShares,
  resolvePath,
} from './geometry.js';
import {
  detailTooltipContent,
  itemPresentation,
} from './content.js';

const NAME_CLASS = 'dv-treemap-label__name';
const VALUE_CLASS = 'dv-treemap-label__value';

function requiredTokenNum(host, name) {
  const value = tokenNum(host, name);
  if (!(value > 0)) throw new Error(`TreemapChart：缺少正数 token ${name}`);
  return value;
}

function resolveImageContentMetrics(host, { nameMax, nameMin, valueMax, valueMin }) {
  const preset = (size, labelSize, valueSize) => ({
    minWidth: requiredTokenNum(host, `--size-treemap-block-${size}-min-width`),
    minHeight: requiredTokenNum(host, `--size-treemap-block-${size}-min-height`),
    imageSize: requiredTokenNum(host, `--size-treemap-block-${size}-image`),
    labelSize,
    valueSize,
  });
  return {
    padding: requiredTokenNum(host, '--spacing-4'),
    imageGap: requiredTokenNum(host, '--spacing-6'),
    textGap: requiredTokenNum(host, '--spacing-2'),
    compact: {
      minWidth: requiredTokenNum(host, '--size-treemap-block-compact-min-width'),
      minHeight: requiredTokenNum(host, '--size-treemap-block-compact-min-height'),
      imageSize: requiredTokenNum(host, '--size-treemap-block-sm-image'),
      fontSize: requiredTokenNum(host, '--font-size-super-small'),
    },
    presets: [
      preset('xl', nameMax, valueMax),
      preset(
        'lg',
        requiredTokenNum(host, '--font-size-base'),
        requiredTokenNum(host, '--font-size-medium'),
      ),
      preset(
        'md',
        requiredTokenNum(host, '--font-size-extra-small'),
        requiredTokenNum(host, '--font-size-extra-small'),
      ),
      preset('sm', nameMin, valueMin),
    ],
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

function hasChildren(node) {
  return displayChildren(node).length > 0;
}

export function TreemapChart(host, cfg) {
  const {
    name,
    root,
    direction = 'squarify',
    variant = 'local',
    ratioMode = 'approximate',
    labelType = 'twoLineCenter',
    colorMode = 'intensity',
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
  if (!['absolute', 'approximate'].includes(ratioMode)) {
    throw new TypeError("TreemapChart：ratioMode 仅支持 'absolute' 或 'approximate'");
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

  host.replaceChildren();
  host.classList.add('dv-chart', 'dv-chart--treemap');
  host.dataset.treemapVariant = variant;
  const breadcrumbHost = select(host).append('nav')
    .attr('class', 'dv-treemap-breadcrumb')
    .attr('aria-label', '矩形树图层级路径');
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
  let currentPath = [];
  let firstBuild = true;
  let selfHeight = host.clientHeight;
  let usesContainerHeight = false;
  let stopGrow = () => {};
  let stopHover = () => {};
  let transitionOrigin = null;

  function drawBreadcrumb() {
    breadcrumbHost.attr(
      'hidden',
      !treemapProfile['root-breadcrumb'] && currentPath.length === 0 ? true : null,
    );
    const names = pathNames(root, currentPath);
    const item = breadcrumbHost.selectAll('span.dv-treemap-breadcrumb__item')
      .data(names.map((label, depth) => ({ label, depth })))
      .join((enter) => {
        const span = enter.append('span').attr('class', 'dv-treemap-breadcrumb__item');
        span.append('button').attr('type', 'button').attr('class', 'dv-treemap-breadcrumb__button');
        span.append('span').attr('class', 'dv-treemap-breadcrumb__separator').attr('aria-hidden', 'true').text('/');
        return span;
      });
    item.select('button')
      .text((d) => d.label)
      .attr('aria-current', (d) => d.depth === names.length - 1 ? 'page' : null)
      .attr('disabled', (d) => d.depth === names.length - 1 ? true : null)
      .on('click', (_, d) => {
        currentPath = currentPath.slice(0, d.depth);
        transitionOrigin = null;
        build(true);
      });
    item.select('.dv-treemap-breadcrumb__separator')
      .style('display', (d) => d.depth === names.length - 1 ? 'none' : null);
  }

  function build(forceMotion = false) {
    stopGrow();
    stopHover();
    stopGrow = () => {};
    stopHover = () => {};
    plotHost.replaceChildren();
    host.dataset.treemapDepth = String(currentPath.length);
    drawBreadcrumb();

    const current = resolvePath(root, currentPath);
    const items = displayChildren(current);
    const regionHeight = requiredTokenNum(host, `--size-treemap-${variant}-height`);
    const plotHeight = usesContainerHeight
      ? Math.max(1, host.clientHeight - requiredTokenNum(host, '--line-height-extra-large'))
      : regionHeight;
    const width = Math.max(1, plotHost.clientWidth || host.clientWidth);
    const frame = createFrame(plotHost, { width, height: plotHeight, xBand: false, minGridHeight: 0 });
    frame.svg
      .attr('class', 'dv-treemap')
      .attr('aria-label', `${name ?? root.name ?? '矩形树图'}：按面积展示层级占比`);

    if (!items.length) {
      selfHeight = host.clientHeight;
      firstBuild = false;
      return;
    }

    /* [TREEMAP-04][TREEMAP-17][COLOR-09] L2 只把主题 behavior 与归一化数值交给 L1：
       series / intensity / semantic 三类颜色策略均不认识主题或业务字段，且不参与面积布局。 */
    const declared = Array.isArray(current.children) ? current.children : [];
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
      thresholds: [
        requiredTokenNum(host, '--ratio-visualization-semantic-bin-1'),
        requiredTokenNum(host, '--ratio-visualization-semantic-bin-2'),
      ],
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
      item.path = [...currentPath, item.index];
    });

    const shares = variant === 'entry'
      ? items.map(() => 1 / items.length)
      : ratioShares(
        items.map((item) => item.value),
        ratioMode,
        requiredTokenNum(host, '--ratio-treemap-max-area-ratio'),
      );
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
      .attr('aria-label', (d) => `${d.data.item.displayName}，${d.data.item.displayValue}，${hasChildren(d.data.item.node) ? '可下钻' : '可查看详情'}`);
    groups.append('rect')
      .attr('class', 'dv-treemap-node__rect')
      .style('fill-opacity', (d) => d.data.item.opacity);
    const masks = groups.append('rect').attr('class', 'dv-treemap-node__mask').attr('aria-hidden', 'true');

    const padding = requiredTokenNum(host, '--spacing-4');
    const labelGap = requiredTokenNum(host, '--spacing-2');
    const lineExtra = requiredTokenNum(host, '--spacing-4');
    const valueFontDeviation = requiredTokenNum(host, '--size-treemap-value-font-deviation');
    const nameMax = requiredTokenNum(host, `--font-size-treemap-${variant}-label-name`);
    const nameMin = requiredTokenNum(host, `--font-size-treemap-${variant}-label-name-min`);
    const valueMax = requiredTokenNum(host, `--font-size-treemap-${variant}-label-value`);
    const valueMin = requiredTokenNum(host, `--font-size-treemap-${variant}-label-value-min`);
    const imageMetrics = usesImageContent
      ? resolveImageContentMetrics(host, { nameMax, nameMin, valueMax, valueMin })
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
            key: item.path.join('.'),
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
          .attr('data-key', item.path.join('.'))
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

    /* [TREEMAP-07] 共用 L1 看板与对侧固定布局；L2 只装配矩形节点内容。 */
    const tooltip = createTooltip(plotHost);
    const tooltipMode = 'side-fixed';
    const hideDelay = tokenNum(plotHost, '--tooltip-hide-delay');
    let hideTimer = 0;
    let pinnedLeaf = null;
    const reset = () => masks.classed('is-active', false);
    const showTip = (event, leaf) => {
      clearTimeout(hideTimer);
      const item = leaf.data.item;
      masks.classed('is-active', (d) => d === leaf);
      if (usesImageContent) tooltip.show(detailTooltipContent(item), marker);
      else {
        tooltip.show({
          title: current.name ?? name,
          rows: [{
            key: item.path.join('.'), label: item.node.name, type: 'bar',
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
    const leave = () => {
      if (pinnedLeaf) {
        showTip(null, pinnedLeaf);
      } else {
        reset();
        hideTimer = setTimeout(() => tooltip.hide(), hideDelay);
      }
    };
    const activate = (event, leaf) => {
      const item = leaf.data.item;
      if (hasChildren(item.node)) {
        transitionOrigin = { x: leaf.x0, y: leaf.y0, w: leaf.x1 - leaf.x0, h: leaf.y1 - leaf.y0 };
        currentPath = item.path;
        build(true);
        return;
      }
      pinnedLeaf = pinnedLeaf === leaf ? null : leaf;
      if (pinnedLeaf) showTip(event, leaf);
      else { reset(); tooltip.hide(); }
    };
    groups
      .on('mouseenter', (event, leaf) => showTip(event, leaf))
      .on('mousemove', (event, leaf) => showTip(event, leaf))
      .on('mouseleave', leave)
      .on('click', (event, leaf) => activate(event, leaf))
      .on('keydown', (event, leaf) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activate(null, leaf);
      });
    stopHover = () => { clearTimeout(hideTimer); tooltip.hide(); };

    if (wm) renderWatermark(frame.svg.append('g').attr('class', 'dv-watermark-layer'), frame, { spec: wm, mode: modeOf(host) });

    const origin = transitionOrigin ?? { x: frame.grid.width / 2, y: frame.grid.height / 2, w: 0, h: 0 };
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
    transitionOrigin = null;
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
    if (!usesContainerHeight && Math.abs(host.clientHeight - selfHeight) > 1) usesContainerHeight = true;
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
      delete host.dataset.treemapDepth;
      host.replaceChildren();
    },
  };
}
