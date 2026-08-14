/*
 * L2 · SankeyChart
 * 只接收节点、流向与端语义；颜色、节点宽度、间距、透明度和曲率均由规范数据决定。
 */
import { pointer, select } from 'd3';
import { makeFormatter } from '../../core/format.js';
import { renderLegend } from '../../core/legend.js';
import { resolveBehavior } from '../../core/theme.js';
import { createTooltip } from '../../core/tooltip.js';
import { tokenNum } from '../../core/tokens.js';
import {
  sankeyNodeDashboard,
  sankeyNodeDashboardValueColor,
  sankeyRelatedNeighborhood,
} from './interaction.js';
import {
  cubicOut,
  hasSameSankeyTopology,
  interpolateSankeyConfig,
} from './playback.js';
import {
  assertSankeyConfig,
  fitSankeyValueFontSize,
  layoutSankey,
  resolveSankeyLabelFontSize,
  resolveSankeyLabelSlot,
  resolveSankeyCanvasHeight,
  truncateSankeyTitle,
} from './layout.js';
import { resolveSankeyStyle } from './style.js';

const LEGEND_ROLES = [
  { key: 'income', fallback: '收入' },
  { key: 'expense', fallback: '支出' },
  { key: 'profit', fallback: '利润' },
];

function svgTextMeasurer(svgNode, childClass, fallbackFontSize) {
  const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  const spanNode = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
  textNode.setAttribute('class', 'dv-sankey__node-label');
  textNode.setAttribute('visibility', 'hidden');
  spanNode.setAttribute('class', childClass);
  textNode.append(spanNode);
  svgNode.append(textNode);

  const estimate = (value, fontSize) => Array.from(String(value)).reduce(
    (width, character) => (
      width + (character.codePointAt(0) > 0xff ? fontSize : fontSize * 0.62)
    ),
    0,
  );

  return {
    measure(value, fontSize = fallbackFontSize) {
      const safeFontSize = Number.isFinite(fontSize) && fontSize > 0
        ? fontSize
        : fallbackFontSize;
      spanNode.textContent = String(value);
      spanNode.style.fontSize = `${safeFontSize}px`;
      if (typeof spanNode.getComputedTextLength === 'function') {
        try {
          const measured = spanNode.getComputedTextLength();
          if (Number.isFinite(measured) && measured > 0) return measured;
        } catch {
          /* 非可视 DOM 环境使用同字体尺寸的保守估算。 */
        }
      }
      return estimate(value, safeFontSize);
    },
    destroy() {
      textNode.remove();
    },
  };
}

export function SankeyChart(host, initialConfig) {
  let config = initialConfig;
  let resizeFrame = 0;
  let motionFrame = 0;
  let motionResolve = null;
  let destroyed = false;
  let pinnedNodeId = null;
  let pinnedLinkIndex = null;
  let displayValueByNodeId = null;
  let displayValueByLinkIndex = null;

  host.replaceChildren();
  const root = select(host).append('div').attr('class', 'dv-sankey');
  const legendHost = root.append('div').attr('class', 'dv-sankey__legend-host');
  const svg = root.append('svg')
    .attr('class', 'dv-sankey__svg')
    .attr('role', 'img')
    .attr('aria-label', '桑基图：展示节点之间的流向与流量');
  const tooltip = createTooltip(root.node());
  let tooltipHideTimer = 0;

  const clearTooltipHide = () => {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = 0;
  };
  const hideTooltip = () => {
    clearTooltipHide();
    tooltip.hide();
  };
  const cancelMotion = () => {
    cancelAnimationFrame(motionFrame);
    motionFrame = 0;
    if (motionResolve) motionResolve(false);
    motionResolve = null;
  };

  function build() {
    if (destroyed) return;
    hideTooltip();
    const platform = config.platform ?? 'pc';
    if (!['pc', 'mobile'].includes(platform)) {
      throw new TypeError("SankeyChart：platform 仅支持 'pc' 或 'mobile'");
    }

    const style = resolveSankeyStyle(host, platform);
    const behavior = resolveBehavior(host, platform);
    const format = makeFormatter(behavior['number-format']);
    const configuredHideDelay = tokenNum(host, '--tooltip-hide-delay');
    const tooltipHideDelay = Number.isFinite(configuredHideDelay)
      ? configuredHideDelay
      : 2000;
    const recommendedHeight = style.geometry['canvas-recommended-height']
      + style.geometry['legend-reserved-height'];
    const maximumCanvasHeight = style.geometry['canvas-max-height'];
    const hasMaximumHeight = Number.isFinite(maximumCanvasHeight);
    const maximumHeight = hasMaximumHeight
      ? maximumCanvasHeight + style.geometry['legend-reserved-height']
      : null;
    /* [SANKEY-23] 移动端限制可视高度；密集数据保留完整 SVG 并在组件内滚动。 */
    root
      .style('min-height', `${recommendedHeight}px`)
      .style('height', maximumHeight === null ? null : `${maximumHeight}px`)
      .style('max-height', maximumHeight === null ? null : `${maximumHeight}px`)
      .style('overflow-y', maximumHeight === null ? null : 'auto');
    const rect = host.getBoundingClientRect();
    if (rect.width < 1) {
      resizeFrame = requestAnimationFrame(build);
      return;
    }

    const chartBounds = {
      width: rect.width,
      height: resolveSankeyCanvasHeight(rect.height, style.geometry),
    };
    const titleWidth = style.geometry['label-title-width'];
    const preliminaryGraph = layoutSankey(
      config,
      { ...chartBounds, labelSlotWidth: titleWidth },
      style,
    );
    const nodeHeights = preliminaryGraph.nodes.map((node) => node.height);
    const minimumNodeHeight = Math.min(...nodeHeights);
    const maximumNodeHeight = Math.max(...nodeHeights);
    const titleMeasurer = svgTextMeasurer(
      svg.node(),
      'dv-sankey__node-title',
      style.geometry['label-title-font-size-max'],
    );
    const valueMeasurer = svgTextMeasurer(
      svg.node(),
      'dv-sankey__node-value',
      style.geometry['label-value-font-size-max'],
    );
    const displayTitleById = new Map();
    const displayTitleWidthById = new Map();
    const formattedValueById = new Map();
    const titleFontSizeById = new Map();
    const valueFontSizeById = new Map();
    const valueWidthById = new Map();
    let labelSlotWidth;
    try {
      preliminaryGraph.nodes.forEach((node) => {
        const titleFontSize = resolveSankeyLabelFontSize(
          node.height,
          minimumNodeHeight,
          maximumNodeHeight,
          style.geometry['label-title-font-size-min'],
          style.geometry['label-title-font-size-max'],
        );
        const preferredValueFontSize = resolveSankeyLabelFontSize(
          node.height,
          minimumNodeHeight,
          maximumNodeHeight,
          style.geometry['label-value-font-size-min'],
          style.geometry['label-value-font-size-max'],
        );
        const displayValue = displayValueByNodeId?.get(node.id) ?? node.value;
        const formattedValue = format(displayValue);
        const valueFontSize = fitSankeyValueFontSize(
          formattedValue,
          preferredValueFontSize,
          style.geometry['label-value-font-size-min'],
          titleWidth,
          valueMeasurer.measure,
        );

        formattedValueById.set(node.id, formattedValue);
        titleFontSizeById.set(node.id, titleFontSize);
        valueFontSizeById.set(node.id, valueFontSize);
        valueWidthById.set(node.id, valueMeasurer.measure(formattedValue, valueFontSize));
        const displayTitle = truncateSankeyTitle(
          node.name,
          titleWidth,
          (value) => titleMeasurer.measure(value, titleFontSize),
        );
        displayTitleById.set(node.id, displayTitle);
        displayTitleWidthById.set(
          node.id,
          titleMeasurer.measure(displayTitle, titleFontSize),
        );
      });
      labelSlotWidth = resolveSankeyLabelSlot(
        [...valueWidthById.values()],
        titleWidth,
      );
    } finally {
      titleMeasurer.destroy();
      valueMeasurer.destroy();
    }

    /* [SANKEY-15/18] 第二次布局用最终文字宽度统一列距，纵向流量几何保持不变。 */
    const graph = layoutSankey(
      config,
      {
        ...chartBounds,
        labelSlotWidth,
      },
      style,
    );
    graph.nodes.forEach((node) => {
      node.displayValue = displayValueByNodeId?.get(node.id) ?? node.value;
      node.displayTitle = displayTitleById.get(node.id);
      node.formattedValue = formattedValueById.get(node.id);
      node.titleFontSize = titleFontSizeById.get(node.id);
      node.valueFontSize = valueFontSizeById.get(node.id);
      node.labelHitWidth = Math.max(
        displayTitleWidthById.get(node.id),
        valueWidthById.get(node.id),
      );
    });
    graph.links.forEach((link) => {
      link.displayValue = displayValueByLinkIndex?.get(link.index) ?? link.value;
    });
    const showEdgeLabels = config.showEdgeLabels !== false
      && platform !== 'mobile'
      && graph.links.length <= style.geometry['dense-edge-label-threshold'];

    root
      .style(
        'min-height',
        `${hasMaximumHeight
          ? recommendedHeight
          : graph.height + style.geometry['legend-reserved-height']}px`,
      )
      .style('--dv-sankey-render-width', `${graph.width}px`)
      .style('--dv-sankey-render-height', `${graph.height}px`)
      .style('--dv-sankey-edge-opacity', style.geometry['edge-opacity'])
      .style('--dv-sankey-edge-highlight-opacity', style.geometry['edge-highlight-opacity'])
      .style('--dv-sankey-number-font-family', style.typography['number-font-family'])
      .style('--dv-sankey-income-color', style.colors.income)
      .style('--dv-sankey-expense-color', style.colors.expense)
      .style('--dv-sankey-profit-color', style.colors.profit);

    /* [SANKEY-14] 每个实际使用的语义色只生成一个静态图例项。 */
    const activeRoles = new Set(graph.nodes.map((node) => node.semanticRole));
    const legendLabels = config.legendLabels ?? {};
    renderLegend(
      legendHost.node(),
      LEGEND_ROLES
        .filter((item) => activeRoles.has(item.key))
        .map((item) => ({
          key: item.key,
          label: legendLabels[item.key] ?? item.fallback,
          type: 'bar',
          colorVar: `--dv-sankey-${item.key}-color`,
        })),
      { marker: behavior['legend-marker'] },
    );
    legendHost
      .select('.dv-legend')
      .attr('role', 'list')
      .attr('aria-label', '桑基图颜色图例');
    legendHost
      .selectAll('.dv-legend-item')
      .attr('role', 'listitem');

    svg
      .attr('viewBox', `0 0 ${graph.width} ${graph.height}`)
      .attr('width', graph.width)
      .attr('height', graph.height);
    svg.selectAll('*').remove();

    const edgeLayer = svg.append('g').attr('class', 'dv-sankey__edges');
    const nodeLayer = svg.append('g').attr('class', 'dv-sankey__nodes');
    const labelLayer = svg.append('g').attr('class', 'dv-sankey__labels');
    const labelHitLayer = svg.append('g').attr('class', 'dv-sankey__label-hits');

    /* [SANKEY-08] 边色固定取终节点色；path 是单色带，不创建 linearGradient。 */
    const edgeGroups = edgeLayer.selectAll('g')
      .data(graph.links, (link) => link.index)
      .join('g')
      .attr('class', 'dv-sankey__edge')
      .attr('tabindex', 0)
      .attr('role', 'graphics-symbol')
      .attr('aria-label', (link) => (
        `${(link.visualSource ?? link.source).name}流向${link.target.name}，`
        + `数值${format(link.displayValue)}`
      ))
      .style('--dv-sankey-color', (link) => link.color);

    edgeGroups.append('path')
      .attr('class', 'dv-sankey__edge-ribbon')
      .attr('d', (link) => link.path);

    if (showEdgeLabels) {
      edgeGroups.append('text')
        .attr('class', (link) => (
          `dv-sankey__edge-label${link.displayValue < 0 ? ' is-negative' : ''}`
        ))
        .attr('x', (link) => link.labelX)
        .attr('y', (link) => link.labelY)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .text((link) => format(link.displayValue));
    }

    /* [SANKEY-04/05][SANKEY-07][SANKEY-11] 最大节点 24×240；颜色由业务角色决定。 */
    const nodeGroups = nodeLayer.selectAll('g')
      .data(graph.nodes, (node) => node.id)
      .join('g')
      .attr('class', 'dv-sankey__node')
      .attr('tabindex', 0)
      .attr('role', 'graphics-symbol')
      .attr('aria-label', (node) => `${node.name}，数值${format(node.displayValue)}`)
      .style('--dv-sankey-color', (node) => node.color);

    nodeGroups.append('rect')
      .attr('class', 'dv-sankey__node-rect')
      .attr('x', (node) => node.x)
      .attr('y', (node) => node.y)
      .attr('width', (node) => node.width)
      .attr('height', (node) => node.height);

    /* [SANKEY-09/18] 标题与数值成组显示，字号随节点显示高度变化。 */
    const labelBeforeNode = (node) => node.columnIndex === 0;
    const nodeLabelX = (node) => (
      labelBeforeNode(node)
        ? node.x - style.geometry['label-gap']
        : node.x + node.width + style.geometry['label-gap']
    );
    const nodeLabels = labelLayer.selectAll('text')
      .data(graph.nodes, (node) => node.id)
      .join('text')
      .attr('class', 'dv-sankey__node-label')
      .attr('x', nodeLabelX)
      .attr('y', (node) => node.y + node.height / 2 - style.geometry['label-gap'])
      .attr('dy', '0.35em')
      .attr('text-anchor', (node) => (labelBeforeNode(node) ? 'end' : 'start'))
      .style('--dv-sankey-color', (node) => node.color);

    nodeLabels.append('tspan')
      .attr('class', 'dv-sankey__node-title')
      .style('font-size', (node) => `${node.titleFontSize}px`)
      .text((node) => node.displayTitle);
    nodeLabels.append('tspan')
      .attr('class', (node) => (
        `dv-sankey__node-value${node.displayValue < 0 ? ' is-negative' : ''}`
      ))
      .attr('x', nodeLabelX)
      .attr('dy', '1.35em')
      .style('font-size', (node) => `${node.valueFontSize}px`)
      .text((node) => node.formattedValue);

    /* SVG tspan 的命中在不同浏览器中不稳定，用透明矩形覆盖整组文字。 */
    const nodeLabelHits = labelHitLayer.selectAll('rect.dv-sankey__node-label-hit')
      .data(graph.nodes, (node) => node.id)
      .join('rect')
      .attr('class', 'dv-sankey__node-label-hit')
      .attr('aria-hidden', 'true')
      .attr('x', (node) => (
        labelBeforeNode(node)
          ? nodeLabelX(node) - node.labelHitWidth
          : nodeLabelX(node)
      ))
      .attr('y', (node) => (
        node.y + node.height / 2 - style.geometry['label-gap'] - node.titleFontSize
      ))
      .attr('width', (node) => node.labelHitWidth)
      .attr('height', (node) => node.titleFontSize + node.valueFontSize * 1.5);

    const resetHighlight = () => {
      edgeGroups.classed('is-active', false).classed('is-dimmed', false);
      nodeGroups.classed('is-active', false).classed('is-dimmed', false);
      nodeLabels.classed('is-dimmed', false);
    };
    const highlightNode = (_, node) => {
      const related = sankeyRelatedNeighborhood(node);
      edgeGroups
        .classed('is-active', (link) => related.links.has(link))
        .classed('is-dimmed', (link) => !related.links.has(link));
      nodeGroups
        .classed('is-active', (item) => related.nodes.has(item))
        .classed('is-dimmed', (item) => !related.nodes.has(item));
      nodeLabels.classed('is-dimmed', (item) => !related.nodes.has(item));
    };
    const highlightEdge = (_, link) => {
      const source = link.visualSource ?? link.source;
      edgeGroups
        .classed('is-active', (item) => item === link)
        .classed('is-dimmed', (item) => item !== link);
      nodeGroups
        .classed('is-active', (item) => item === source || item === link.target)
        .classed('is-dimmed', (item) => item !== source && item !== link.target);
      nodeLabels.classed('is-dimmed', (item) => item !== source && item !== link.target);
    };

    const placeTooltip = (point) => {
      tooltip.place('follow', {
        grid: {
          left: 0,
          right: root.node().clientWidth,
          top: 0,
          bottom: root.node().clientHeight,
        },
        width: root.node().clientWidth,
        height: root.node().clientHeight,
        cx: point.x,
        pointer: point,
      });
    };
    const placeTooltipAtEvent = (event) => {
      const [x, y] = pointer(event, root.node());
      placeTooltip({ x, y });
    };
    const showTooltip = (content, point) => {
      clearTooltipHide();
      tooltip.show(content, behavior['legend-marker']);
      placeTooltip(point);
    };
    const showNodeTooltip = (node, point) => {
      root.style(
        '--dv-sankey-tooltip-value-color',
        sankeyNodeDashboardValueColor(node),
      );
      showTooltip(sankeyNodeDashboard(node, format), point);
    };
    const scheduleTooltipHide = () => {
      clearTooltipHide();
      tooltipHideTimer = setTimeout(hideTooltip, tooltipHideDelay);
    };
    const pointFromSvg = (x, y) => {
      const rootRect = root.node().getBoundingClientRect();
      const svgRect = svg.node().getBoundingClientRect();
      return {
        x: svgRect.left - rootRect.left + x * (svgRect.width / graph.width),
        y: svgRect.top - rootRect.top + y * (svgRect.height / graph.height),
      };
    };
    const nodeAnchor = (node) => pointFromSvg(
      node.x + node.width / 2,
      node.y + node.height / 2,
    );
    const pinnedNode = () => graph.nodes.find((node) => node.id === pinnedNodeId);
    const pinnedLink = () => graph.links.find((link) => link.index === pinnedLinkIndex);
    const restorePinnedInteraction = () => {
      const node = pinnedNode();
      if (node) {
        highlightNode(null, node);
        showNodeTooltip(node, nodeAnchor(node));
        return true;
      }
      const link = pinnedLink();
      if (link) {
        highlightEdge(null, link);
        hideTooltip();
        return true;
      }
      resetHighlight();
      hideTooltip();
      return false;
    };
    const pointerPoint = (event, node) => {
      if (event.detail === 0) return nodeAnchor(node);
      const [x, y] = pointer(event, root.node());
      return { x, y };
    };

    const enterNode = (event, node) => {
      highlightNode(event, node);
      const [x, y] = pointer(event, root.node());
      showNodeTooltip(node, { x, y });
    };
    const leaveNode = () => {
      if (pinnedNodeId !== null || pinnedLinkIndex !== null) {
        restorePinnedInteraction();
        return;
      }
      resetHighlight();
      scheduleTooltipHide();
    };
    const clickNode = (event, node) => {
      event.stopPropagation();
      const shouldClose = pinnedNodeId === node.id;
      pinnedNodeId = shouldClose ? null : node.id;
      pinnedLinkIndex = null;
      if (shouldClose) {
        resetHighlight();
        hideTooltip();
        return;
      }
      highlightNode(event, node);
      showNodeTooltip(node, pointerPoint(event, node));
    };
    const blurInteractiveItem = () => {
      if (!restorePinnedInteraction()) hideTooltip();
    };

    /* [SANKEY-10/20] 节点矩形与文字共享 hover / click 看板；点击后保持以支持移动端。 */
    nodeGroups
      .on('pointerenter', enterNode)
      .on('pointermove', placeTooltipAtEvent)
      .on('pointerleave', leaveNode)
      .on('click', clickNode)
      .on('focus', (event, node) => {
        highlightNode(event, node);
        showNodeTooltip(node, nodeAnchor(node));
      })
      .on('blur', blurInteractiveItem);
    nodeLabelHits
      .on('pointerenter', enterNode)
      .on('pointermove', placeTooltipAtEvent)
      .on('pointerleave', leaveNode)
      .on('click', clickNode);

    /* 流向只编辑高亮状态，不触发数据看板。点击后保持单条流向高亮。 */
    edgeGroups
      .on('pointerenter', (event, link) => {
        hideTooltip();
        highlightEdge(event, link);
      })
      .on('pointerleave', restorePinnedInteraction)
      .on('click', (event, link) => {
        event.stopPropagation();
        const shouldClose = pinnedLinkIndex === link.index;
        pinnedNodeId = null;
        pinnedLinkIndex = shouldClose ? null : link.index;
        hideTooltip();
        if (shouldClose) resetHighlight();
        else highlightEdge(event, link);
      })
      .on('focus', (event, link) => {
        hideTooltip();
        highlightEdge(event, link);
      })
      .on('blur', blurInteractiveItem);

    svg.on('click.sankey-interaction', () => {
      pinnedNodeId = null;
      pinnedLinkIndex = null;
      resetHighlight();
      hideTooltip();
    });

    if (pinnedNodeId !== null || pinnedLinkIndex !== null) {
      restorePinnedInteraction();
    }

    const layoutDetail = {
      recommendedHeight,
      renderedHeight: hasMaximumHeight
        ? Math.min(graph.height, maximumCanvasHeight)
          + style.geometry['legend-reserved-height']
        : graph.height + style.geometry['legend-reserved-height'],
      requiredHeight: graph.requiredHeight + style.geometry['legend-reserved-height'],
      renderedWidth: graph.width,
      requiredWidth: graph.requiredWidth,
    };
    root
      .attr('data-recommended-height', layoutDetail.recommendedHeight)
      .attr('data-rendered-height', layoutDetail.renderedHeight)
      .attr('data-required-height', layoutDetail.requiredHeight)
      .attr('data-rendered-width', layoutDetail.renderedWidth)
      .attr('data-required-width', layoutDetail.requiredWidth);
    host.dispatchEvent(new CustomEvent('dv:sankey-layout', { detail: layoutDetail }));
  }

  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(build);
  });
  observer.observe(host);
  build();

  return {
    update(nextConfig, options = {}) {
      cancelMotion();
      pinnedNodeId = null;
      pinnedLinkIndex = null;
      const shouldAnimate = options.animate === true
        && hasSameSankeyTopology(config, nextConfig)
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!shouldAnimate) {
        config = nextConfig;
        displayValueByNodeId = null;
        displayValueByLinkIndex = null;
        options.onProgress?.(1, 1);
        build();
        return Promise.resolve(true);
      }

      const fromConfig = config;
      const platform = nextConfig.platform ?? 'pc';
      const nextGraph = assertSankeyConfig(nextConfig);
      const motion = resolveSankeyStyle(host, platform).motion;
      const duration = motion['playback-duration'];
      const labelLeadDuration = motion['playback-label-lead-duration'];
      const startedAt = performance.now() + labelLeadDuration;
      displayValueByNodeId = new Map(
        nextGraph.nodes.map((node) => [node.id, node.value]),
      );
      displayValueByLinkIndex = new Map(
        nextGraph.links.map((link) => [link.index, link.value]),
      );
      options.onProgress?.(0, 0);
      build();

      return new Promise((resolve) => {
        motionResolve = resolve;
        const tick = (now) => {
          if (now < startedAt) {
            motionFrame = requestAnimationFrame(tick);
            return;
          }
          const linearProgress = Math.min(1, (now - startedAt) / duration);
          const easedProgress = cubicOut(linearProgress);
          config = interpolateSankeyConfig(fromConfig, nextConfig, easedProgress);
          if (linearProgress === 1) {
            config = nextConfig;
            displayValueByNodeId = null;
            displayValueByLinkIndex = null;
          }
          options.onProgress?.(easedProgress, linearProgress);
          build();

          if (linearProgress < 1) {
            motionFrame = requestAnimationFrame(tick);
            return;
          }
          motionFrame = 0;
          motionResolve = null;
          resolve(true);
        };
        motionFrame = requestAnimationFrame(tick);
      });
    },
    pause() {
      cancelMotion();
    },
    destroy() {
      destroyed = true;
      cancelMotion();
      cancelAnimationFrame(resizeFrame);
      clearTooltipHide();
      observer.disconnect();
      root.remove();
    },
  };
}
