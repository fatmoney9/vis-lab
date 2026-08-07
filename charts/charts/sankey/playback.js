/* [L2-LOCAL] 桑基专属：同拓扑时间序列插值与播放缓动。 */

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const referenceKey = (reference) => {
  if (reference && typeof reference === 'object') {
    return String(reference.id ?? reference.name ?? '');
  }
  return String(reference ?? '');
};

const nodeKey = (node) => String(node?.id ?? node?.name ?? '');
const linkKey = (link) => `${referenceKey(link?.source)}\u2192${referenceKey(link?.target)}`;

export function cubicOut(progress) {
  const value = clamp01(progress);
  return 1 - (1 - value) ** 3;
}

export function hasSameSankeyTopology(fromConfig, toConfig) {
  if (!Array.isArray(fromConfig?.nodes) || !Array.isArray(toConfig?.nodes)) return false;
  if (!Array.isArray(fromConfig?.links) || !Array.isArray(toConfig?.links)) return false;

  const fromNodes = new Set(fromConfig.nodes.map(nodeKey));
  const toNodes = new Set(toConfig.nodes.map(nodeKey));
  if (fromNodes.size !== toNodes.size || [...fromNodes].some((key) => !toNodes.has(key))) {
    return false;
  }

  const fromLinks = new Set(fromConfig.links.map(linkKey));
  const toLinks = new Set(toConfig.links.map(linkKey));
  return fromLinks.size === toLinks.size && [...fromLinks].every((key) => toLinks.has(key));
}

export function interpolateSankeyConfig(fromConfig, toConfig, progress) {
  if (!hasSameSankeyTopology(fromConfig, toConfig)) {
    throw new TypeError('SankeyChart：时间序列插值要求节点与流向拓扑保持一致');
  }

  const ratio = clamp01(progress);
  const fromValues = new Map(
    fromConfig.links.map((link) => [linkKey(link), Number(link.value)]),
  );

  return {
    ...toConfig,
    nodes: toConfig.nodes.map((node) => ({ ...node })),
    links: toConfig.links.map((link) => {
      const fromValue = fromValues.get(linkKey(link));
      const toValue = Number(link.value);
      return {
        ...link,
        value: fromValue + (toValue - fromValue) * ratio,
      };
    }),
  };
}
