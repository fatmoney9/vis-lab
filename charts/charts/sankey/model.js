/*
 * [L2-LOCAL] 桑基专属语义模型：Tooltip 看板、直接邻域、同拓扑判断、季度值插值，
 * 以及复用 layout.js 结果装配序列级比例尺 / 视口；不复制布局公式，不包含 DOM 装配。
 */
import { resolveSankeySettings } from './config.js';
import { assertSankeyConfig, layoutSankey, scaleSankeyStyle } from './layout.js';
import { clamp01 } from '../../core/math.js';

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
   * [SANKEY-24/25] B > 0 时，negativeSource 是跨 D 正负稳定的视觉路由拓扑，
   * 不是只在亏损期临时出现的状态；B 跨越到非正值时 L3 会移除该元数据，
   * 这里据此判为拓扑变化并立即切换，避免插值首帧误画路由。
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
  const scaled = periods.map((period) => ({ ...period, scaleMax }));
  /* [SANKEY-29] 序列的默认绘图区高也是全序列口径，随 scaleMax 一起声明给每一期。 */
  const sequenceCanvasHeight = Object.fromEntries(['pc', 'mobile'].map((platform) => [
    platform,
    resolveSankeySequenceViewport(scaled, platform).canvasHeight,
  ]));
  const sequencePeakLinkValues = Object.fromEntries(['pc', 'mobile'].map((platform) => [
    platform,
    peakLinkValues(scaled, platform),
  ]));
  return scaled.map((period) => ({ ...period, sequenceCanvasHeight, sequencePeakLinkValues }));
}

/* [SANKEY-29] 缩到下限时最费空间的那一期的流量：缩放后标签占比最大，这时最容易放不下。 */
function peakLinkValues(periods, platform) {
  const style = resolveSankeySettings(platform);
  const { geometry } = style;
  const floor = scaleSankeyStyle(
    style,
    geometry['primary-node-height-min'] / geometry['primary-node-height'],
  );
  const required = periods.map((period) => layoutSankey(
    period,
    { width: 1, height: 0, labelSlotWidth: geometry['label-title-width'] },
    floor,
  ).requiredHeight);
  const peak = periods[required.indexOf(Math.max(...required))];
  return Object.fromEntries(peak.links.map((link) => [`${link.source}->${link.target}`, Number(link.value)]));
}

/*
 * [SANKEY-23] 播放序列共用一份纵向视口：先取各期完整布局所需高度的最大值，
 * 超过端侧推荐高时再向上对齐 4px 布局网格。L2 同时给出跨主题最低图例兜底，
 * L3 再按当前主题 token 求真实图例占位；两层都不复制画布布局公式。
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
    /* [SANKEY-29] 密度档可覆盖默认绘图区高；token 只有 L3 按实际作用域才读得到。 */
    canvasHeightToken: '--size-sankey-canvas-height',
    legendFallbackHeight: geometry['legend-reserved-height'],
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
