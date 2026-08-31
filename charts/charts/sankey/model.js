/*
 * [L2-LOCAL] 桑基专属语义模型：Tooltip 看板、直接邻域、同拓扑判断、季度值插值，
 * 以及复用 layout.js 结果装配序列级比例尺 / 视口；不复制布局公式，不包含 DOM 装配。
 */
import { resolveSankeySettings } from './config.js';
import { assertSankeyConfig, layoutSankey } from './layout.js';

function semanticColorVar(role) {
  return `--color-sankey-${role}`;
}

export function sankeyNodeDashboardValueColor(node) {
  return (node.displayValue ?? node.value) < 0
    ? 'var(--color-text-tooltip-series)'
    : `var(${semanticColorVar(node.semanticRole)})`;
}

export function sankeyNodeDashboard(node, format) {
  return {
    title: '',
    rows: [{
      key: `node-${node.id}`,
      label: node.name,
      type: 'bar',
      colorVar: semanticColorVar(node.semanticRole),
      value: node.formattedValue ?? format(node.displayValue ?? node.value),
    }],
  };
}

export function sankeyRelatedNeighborhood(node) {
  const nodes = new Set([node]);
  const links = new Set();
  const incoming = node.visualIncoming ?? node.incoming;
  const outgoing = node.visualOutgoing ?? node.outgoing;

  incoming.forEach((link) => {
    links.add(link);
    nodes.add(link.visualSource ?? link.source);
  });
  outgoing.forEach((link) => {
    links.add(link);
    nodes.add(link.visualTarget ?? link.target);
  });
  return { nodes, links };
}

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const referenceKey = (reference) => {
  if (reference && typeof reference === 'object') {
    return String(reference.id ?? reference.name ?? '');
  }
  return String(reference ?? '');
};

const nodeKey = (node) => String(node?.id ?? node?.name ?? '');
const linkKey = (link) => `${referenceKey(link?.source)}\u2192${referenceKey(link?.target)}`;
const linkTopologyKey = (link) => (
  `${linkKey(link)}|negativeSource:${referenceKey(link?.negativeSource)}`
);

export function hasSameSankeyTopology(fromConfig, toConfig) {
  if (!Array.isArray(fromConfig?.nodes) || !Array.isArray(toConfig?.nodes)) return false;
  if (!Array.isArray(fromConfig?.links) || !Array.isArray(toConfig?.links)) return false;

  const fromNodes = new Set(fromConfig.nodes.map(nodeKey));
  const toNodes = new Set(toConfig.nodes.map(nodeKey));
  if (fromNodes.size !== toNodes.size || [...fromNodes].some((key) => !toNodes.has(key))) {
    return false;
  }

  /*
   * [SANKEY-24/25] negativeSource 是视觉路由拓扑，不是只在亏损期临时出现的状态。
   * 元数据不同即立即切换，避免插值首帧把左侧回折带误画成普通正向边。
   */
  const fromLinks = new Set(fromConfig.links.map(linkTopologyKey));
  const toLinks = new Set(toConfig.links.map(linkTopologyKey));
  return fromLinks.size === toLinks.size && [...fromLinks].every((key) => toLinks.has(key));
}

/*
 * [SANKEY-26] 时间序列只建立一次绝对比例尺：以各期主轴几何量的最大值为上限，
 * 再把同一个 scaleMax 注入每一期。主轴识别与 magnitude 口径必须复用布局校验，
 * 避免 L3 按固定节点名或单条流量猜测主轴。
 */
export function withSharedSankeyScale(periods) {
  if (!Array.isArray(periods) || periods.length === 0) {
    throw new TypeError('SankeyChart：时间序列至少需要一个周期');
  }
  const scaleMax = Math.max(
    ...periods.map((period) => assertSankeyConfig(period).primary.magnitude),
  );
  return periods.map((period) => ({ ...period, scaleMax }));
}

/*
 * [SANKEY-23] 播放序列共用一份纵向视口：先取各期完整布局所需高度的最大值，
 * 超过端侧推荐高时再向上对齐 4px 布局网格。L3 只消费结果设置外框，不复制布局公式。
 */
export function resolveSankeySequenceViewport(periods, platform = 'mobile') {
  if (!Array.isArray(periods) || periods.length === 0) {
    throw new TypeError('SankeyChart：时间序列至少需要一个周期');
  }
  const style = resolveSankeySettings(platform);
  const { geometry } = style;
  const requiredCanvasHeight = Math.max(...periods.map((period) => layoutSankey(
    period,
    {
      width: 1,
      height: geometry['canvas-min-height'],
      labelSlotWidth: geometry['label-title-width'],
    },
    style,
  ).requiredHeight));
  const recommendedCanvasHeight = geometry['canvas-recommended-height'];
  const step = geometry['sequence-height-step'];
  const expandedCanvasHeight = Math.ceil(requiredCanvasHeight / step) * step;
  const canvasHeight = Math.max(recommendedCanvasHeight, expandedCanvasHeight);

  return {
    canvasHeight,
    totalHeight: canvasHeight + geometry['legend-reserved-height'],
    requiredCanvasHeight,
  };
}

export function interpolateSankeyConfig(fromConfig, toConfig, progress) {
  if (!hasSameSankeyTopology(fromConfig, toConfig)) {
    throw new TypeError('SankeyChart：时间序列插值要求节点与流向拓扑保持一致');
  }

  const ratio = clamp01(progress);
  const fromValues = new Map(
    fromConfig.links.map((link) => [linkTopologyKey(link), Number(link.value)]),
  );

  return {
    ...toConfig,
    nodes: toConfig.nodes.map((node) => ({ ...node })),
    links: toConfig.links.map((link) => {
      const fromValue = fromValues.get(linkTopologyKey(link));
      const toValue = Number(link.value);
      return {
        ...link,
        value: fromValue + (toValue - fromValue) * ratio,
      };
    }),
  };
}
