/* [L2-LOCAL] 桑基节点与边的数据看板语义，只负责组装共享 Tooltip 所需内容。 */
function semanticColorVar(role) {
  return `--dv-sankey-${role}-color`;
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
    nodes.add(link.target);
  });

  return { nodes, links };
}
