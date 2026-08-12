/* [L2-LOCAL] 桑基专属：业务角色校验、有向图分阶段、流式居中和边带槽位。 */

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const SANKEY_ROLES = new Set(['income', 'expense', 'profit']);
const ROLE_ORDER = { expense: 0, profit: 1, income: 2 };

function fail(message) {
  throw new TypeError(`SankeyChart：${message}`);
}

function isBalanced(incoming, outgoing) {
  const tolerance = Math.max(
    1e-6,
    Math.max(Math.abs(incoming), Math.abs(outgoing)) * Number.EPSILON * 128,
  );
  return Math.abs(incoming - outgoing) <= tolerance;
}

function resolveReference(reference, nodeById, nodeByName) {
  return nodeById.get(reference) ?? nodeByName.get(reference);
}

/*
 * [SANKEY-15] 标签槽以标题基准宽度兜底，并由全图最宽的格式化数值统一扩展。
 */
export function resolveSankeyLabelSlot(valueWidths, titleWidth) {
  const safeTitleWidth = Number.isFinite(titleWidth) && titleWidth > 0 ? titleWidth : 0;
  return Math.max(
    safeTitleWidth,
    ...valueWidths.filter((width) => Number.isFinite(width) && width >= 0),
  );
}

/*
 * [SANKEY-18] 当前图内按节点显示高度线性映射标签字号。
 */
export function resolveSankeyLabelFontSize(
  nodeHeight,
  minimumNodeHeight,
  maximumNodeHeight,
  minimumFontSize,
  maximumFontSize,
) {
  if (!(maximumFontSize > minimumFontSize)) return minimumFontSize;
  if (!(maximumNodeHeight > minimumNodeHeight)) return maximumFontSize;
  const ratio = Math.max(
    0,
    Math.min(1, (nodeHeight - minimumNodeHeight) / (maximumNodeHeight - minimumNodeHeight)),
  );
  return minimumFontSize + (maximumFontSize - minimumFontSize) * ratio;
}

/*
 * [SANKEY-18] 数值优先缩至 96px 内；最小字号仍超宽时保留完整文字。
 */
export function fitSankeyValueFontSize(
  value,
  preferredFontSize,
  minimumFontSize,
  maximumWidth,
  measure,
) {
  if (measure(value, preferredFontSize) <= maximumWidth) return preferredFontSize;
  if (measure(value, minimumFontSize) > maximumWidth) return minimumFontSize;

  let low = minimumFontSize;
  let high = preferredFontSize;
  for (let index = 0; index < 12; index += 1) {
    const middle = (low + high) / 2;
    if (measure(value, middle) <= maximumWidth) low = middle;
    else high = middle;
  }
  return Math.floor(low * 100) / 100;
}

/*
 * [SANKEY-15] 标题只占固定宽度；测量函数由渲染层按当前主题字体提供。
 */
export function truncateSankeyTitle(value, maxWidth, measure) {
  const title = String(value);
  if (!(maxWidth > 0) || measure(title) <= maxWidth) return title;

  const ellipsis = '…';
  if (measure(ellipsis) > maxWidth) return '';

  const characters = Array.from(title);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${characters.slice(0, middle).join('')}${ellipsis}`;
    if (measure(candidate) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${characters.slice(0, low).join('')}${ellipsis}`;
}

export function resolveSankeyCanvasHeight(hostHeight, geometry) {
  const availableHeight = Number(hostHeight) - geometry['legend-reserved-height'];
  const requestedHeight = Number.isFinite(availableHeight) && availableHeight > 0
    ? availableHeight
    : geometry['canvas-recommended-height'];
  const maximumHeight = geometry['canvas-max-height'];
  const constrainedHeight = Number.isFinite(maximumHeight)
    ? Math.min(requestedHeight, maximumHeight)
    : requestedHeight;
  return Math.max(geometry['canvas-min-height'], constrainedHeight);
}

/*
 * [SANKEY-01..03][SANKEY-06][SANKEY-11][SANKEY-13/16]
 * role 只决定收入/支出/利润语义，value 保留符号参与守恒，stage 只决定横向阶段。
 */
export function assertSankeyConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') fail('配置必须是对象');
  if (own(cfg, 'stack')) fail('不支持 stack 或任何堆叠配置');
  const scaleMax = cfg.scaleMax == null ? null : Number(cfg.scaleMax);
  if (scaleMax !== null && (!Number.isFinite(scaleMax) || scaleMax <= 0)) {
    fail('scaleMax 必须是大于 0 的有限数');
  }
  if (!Array.isArray(cfg.nodes) || !Array.isArray(cfg.links)) {
    fail('必须同时提供 nodes 与 links 数组');
  }
  if (cfg.nodes.length === 0) fail('nodes 不能为空');

  const nodeById = new Map();
  const nodeByName = new Map();
  const nodes = cfg.nodes.map((source, index) => {
    const name = typeof source?.name === 'string' ? source.name.trim() : '';
    const id = typeof source?.id === 'string' && source.id.trim()
      ? source.id.trim()
      : name;
    const role = source?.role;
    const explicitStage = source?.stage;
    const order = source?.order;

    if (!name) fail(`第 ${index + 1} 个节点缺少有效 name`);
    if (!id) fail(`第 ${index + 1} 个节点缺少有效 id`);
    if (nodeById.has(id)) fail(`节点 id 重复：「${id}」`);
    if (nodeByName.has(name)) fail(`节点 name 重复：「${name}」`);
    if (!SANKEY_ROLES.has(role)) {
      fail(`节点「${name}」的 role 必须是 'income'、'expense' 或 'profit'`);
    }
    if (explicitStage != null && (!Number.isInteger(explicitStage) || explicitStage < 0)) {
      fail(`节点「${name}」的 stage 必须是非负整数`);
    }
    if (order != null && !Number.isFinite(order)) {
      fail(`节点「${name}」的 order 必须是有限数`);
    }
    const node = {
      id,
      name,
      role,
      semanticRole: role,
      explicitStage,
      order: order ?? null,
      index,
      incoming: [],
      outgoing: [],
      depth: 0,
    };
    nodeById.set(id, node);
    nodeByName.set(name, node);
    return node;
  });

  const links = cfg.links.map((source, index) => {
    const from = resolveReference(source?.source, nodeById, nodeByName);
    const to = resolveReference(source?.target, nodeById, nodeByName);
    const negativeSource = source?.negativeSource == null
      ? null
      : resolveReference(source.negativeSource, nodeById, nodeByName);
    const value = Number(source?.value);
    if (!from || !to) fail(`第 ${index + 1} 条链接引用了未声明节点`);
    if (source?.negativeSource != null && !negativeSource) {
      fail(`第 ${index + 1} 条链接的 negativeSource 引用了未声明节点`);
    }
    if (from === to) fail(`第 ${index + 1} 条链接不允许自环`);
    if (!Number.isFinite(value)) {
      fail(`第 ${index + 1} 条链接 value 必须是有限数`);
    }
    const link = {
      source: from,
      target: to,
      negativeSource,
      value,
      magnitude: Math.abs(value),
      index,
    };
    from.outgoing.push(link);
    to.incoming.push(link);
    return link;
  });

  if (links.length === 0) fail('links 不能为空');
  if (nodes.some((node) => node.incoming.length === 0 && node.outgoing.length === 0)) {
    fail('不允许存在孤立节点');
  }

  const indegree = new Map(nodes.map((node) => [node, node.incoming.length]));
  const queue = nodes.filter((node) => indegree.get(node) === 0);
  let visited = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor];
    visited += 1;
    node.outgoing.forEach((link) => {
      link.target.depth = Math.max(link.target.depth, node.depth + 1);
      const next = indegree.get(link.target) - 1;
      indegree.set(link.target, next);
      if (next === 0) queue.push(link.target);
    });
  }
  if (visited !== nodes.length) fail('links 必须构成有向无环图');

  nodes.forEach((node) => {
    node.stage = node.explicitStage ?? node.depth;
  });
  links.forEach((link) => {
    if (link.target.stage <= link.source.stage) {
      fail(`链接「${link.source.name} → ${link.target.name}」的目标 stage 必须大于源 stage`);
    }
    if (link.negativeSource) {
      const isSiblingTarget = link.source.outgoing.some(
        (candidate) => candidate !== link && candidate.target === link.negativeSource,
      );
      if (!isSiblingTarget || link.negativeSource.stage !== link.target.stage) {
        fail(
          `链接「${link.source.name} → ${link.target.name}」的 negativeSource `
          + '必须是同一来源、同一目标阶段的兄弟节点',
        );
      }
    }
  });

  const stageValues = [...new Set(nodes.map((node) => node.stage))].sort((a, b) => a - b);
  if (stageValues.length < 3) fail('至少需要三个布局阶段');
  const stageIndex = new Map(stageValues.map((stage, index) => [stage, index]));
  nodes.forEach((node) => {
    node.columnIndex = stageIndex.get(node.stage);
    if (node.incoming.length === 0) node.kind = 'source';
    else if (node.outgoing.length === 0) node.kind = 'sink';
    else node.kind = 'intermediate';

    const incomingValue = node.incoming.reduce((sum, link) => sum + link.value, 0);
    const outgoingValue = node.outgoing.reduce((sum, link) => sum + link.value, 0);
    const incomingMagnitude = node.incoming.reduce(
      (sum, link) => sum + link.magnitude,
      0,
    );
    const outgoingMagnitude = node.outgoing.reduce(
      (sum, link) => sum + link.magnitude,
      0,
    );
    if (node.kind === 'intermediate' && !isBalanced(incomingValue, outgoingValue)) {
      fail(
        `中间节点「${node.name}」流量不守恒：流入 ${incomingValue}，流出 ${outgoingValue}`,
      );
    }
    node.value = node.kind === 'source'
      ? outgoingValue
      : node.kind === 'sink'
        ? incomingValue
        : (incomingValue + outgoingValue) / 2;
    node.magnitude = Math.max(
      Math.abs(node.value),
      incomingMagnitude,
      outgoingMagnitude,
    );
  });

  links.forEach((link) => {
    link.isNegativeDifference = link.value < 0 && Boolean(link.negativeSource);
    if (!link.isNegativeDifference) return;
    link.baseLink = link.source.outgoing.find(
      (candidate) => candidate !== link && candidate.target === link.negativeSource,
    );
    link.source.hasNegativeDifference = true;
    link.target.isNegativeDifferenceResult = true;
  });
  nodes.forEach((node) => {
    if (node.hasNegativeDifference || node.isNegativeDifferenceResult) {
      node.magnitude = Math.abs(node.value);
    }
  });

  const intermediates = nodes.filter((node) => node.kind === 'intermediate');
  if (intermediates.length === 0) fail('至少需要一个中间节点');
  const distributors = nodes.filter((node) => node.outgoing.length > 0);
  const primary = [...distributors].sort(
    (a, b) => b.magnitude - a.magnitude
      || Number(b.kind === 'intermediate') - Number(a.kind === 'intermediate')
      || a.stage - b.stage
      || a.index - b.index,
  )[0];
  if (!(primary.magnitude > 0)) fail('最大流量节点必须承载非零流量');
  if (scaleMax !== null && scaleMax < primary.magnitude) {
    fail('scaleMax 不得小于当前主节点流量');
  }

  return {
    nodes,
    links,
    primary,
    scaleMax,
    stageValues,
    maxStage: stageValues.at(-1),
  };
}

function barycenter(node, direction, fallback) {
  const links = direction === 'incoming' ? node.incoming : node.outgoing;
  if (links.length === 0) return fallback;
  const sum = links.reduce((acc, link) => {
    const peer = direction === 'incoming' ? link.source : link.target;
    return acc + (peer.y + peer.height / 2) * Math.max(link.magnitude, 1);
  }, 0);
  const weight = links.reduce((acc, link) => acc + Math.max(link.magnitude, 1), 0);
  return sum / weight;
}

function columnHeight(nodes, gap) {
  return nodes.reduce((sum, node) => sum + node.height, 0)
    + Math.max(0, nodes.length - 1) * gap;
}

/* [SANKEY-22] 多节点列随节点数逐级扩展，避免双节点与三节点占用同一范围。 */
export function resolveSankeyColumnMinimumSpan(nodeCount, geometry) {
  if (nodeCount < 2) return 0;
  const threeNodeSpan = geometry['primary-node-height'] * (
    geometry['multi-node-span-base-ratio']
    + geometry['third-node-span-ratio']
  );
  if (nodeCount === 2) {
    return geometry['primary-node-height'] * geometry['multi-node-span-base-ratio'];
  }
  return threeNodeSpan + Math.max(0, nodeCount - 3) * geometry['node-gap'];
}

function distributedColumnGap(nodes, minimumGap, minimumSpan) {
  if (nodes.length < 2) return minimumGap;
  const nodeHeight = nodes.reduce((sum, node) => sum + node.height, 0);
  return Math.max(minimumGap, (minimumSpan - nodeHeight) / (nodes.length - 1));
}

function columnIncomingCenter(nodes, fallback) {
  let weightedCenter = 0;
  let totalWeight = 0;

  nodes.forEach((node) => {
    if (node.incoming.length === 0) return;
    const weight = node.incoming.reduce(
      (sum, link) => sum + Math.max(link.magnitude, 1),
      0,
    );
    weightedCenter += barycenter(node, 'incoming', fallback) * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedCenter / totalWeight : fallback;
}

function centerlineAlignedCenter(
  nodes,
  columnIndex,
  primaryColumnIndex,
  incomingCenter,
  anchorY,
  attraction,
) {
  const distance = Math.abs(columnIndex - primaryColumnIndex);
  if (distance <= 1) return incomingCenter;

  const passes = distance - 1;
  const strength = 1 - (1 - attraction) ** passes;
  return incomingCenter + (anchorY - incomingCenter) * strength;
}

function placeColumn(nodes, centerY, gap, canvasHeight, paddingY, anchoredNode) {
  if (nodes.length === 0) return;
  const total = columnHeight(nodes, gap);
  const minTop = paddingY;
  const maxTop = Math.max(minTop, canvasHeight - paddingY - total);
  const centeredTop = Math.max(minTop, Math.min(maxTop, centerY - total / 2));
  const anchorIndex = nodes.indexOf(anchoredNode);

  if (anchorIndex < 0) {
    let cursor = centeredTop;
    nodes.forEach((node) => {
      node.y = cursor;
      cursor += node.height + gap;
    });
    return;
  }

  const heightAbove = columnHeight(nodes.slice(0, anchorIndex), gap)
    + (anchorIndex > 0 ? gap : 0);
  let anchorY = centerY - anchoredNode.height / 2;
  anchorY = Math.max(anchorY, paddingY + heightAbove);
  const heightBelow = columnHeight(nodes.slice(anchorIndex + 1), gap)
    + (anchorIndex < nodes.length - 1 ? gap : 0);
  anchorY = Math.min(
    anchorY,
    canvasHeight - paddingY - anchoredNode.height - heightBelow,
  );
  anchoredNode.y = anchorY;

  let cursor = anchoredNode.y - gap;
  for (let index = anchorIndex - 1; index >= 0; index -= 1) {
    cursor -= nodes[index].height;
    nodes[index].y = cursor;
    cursor -= gap;
  }
  cursor = anchoredNode.y + anchoredNode.height + gap;
  for (let index = anchorIndex + 1; index < nodes.length; index += 1) {
    nodes[index].y = cursor;
    cursor += nodes[index].height + gap;
  }
}

function semanticColor(node, colors) {
  return colors[node.semanticRole];
}

function compareColumnNodes(a, b, fallbackY) {
  if (a.order != null || b.order != null) {
    const orderDifference = (a.order ?? Infinity) - (b.order ?? Infinity);
    if (orderDifference) return orderDifference;
  }
  const roleDifference = ROLE_ORDER[a.semanticRole] - ROLE_ORDER[b.semanticRole];
  if (roleDifference) return roleDifference;
  return barycenter(a, 'incoming', fallbackY) - barycenter(b, 'incoming', fallbackY)
    || b.magnitude - a.magnitude
    || a.index - b.index;
}

function skippedNodes(link, columns) {
  return columns
    .slice(link.source.columnIndex + 1, link.target.columnIndex)
    .flat();
}

function routedPoints(link, columns, gap) {
  const sourceX = link.source.x + link.source.width;
  const targetX = link.target.x;
  const points = [
    { x: sourceX, y: link.sourceY },
    { x: targetX, y: link.targetY },
  ];
  if (link.target.columnIndex - link.source.columnIndex <= 1) return points;

  const obstacles = skippedNodes(link, columns);
  if (obstacles.length === 0) return points;
  const firstLeft = Math.min(...obstacles.map((node) => node.x));
  const lastRight = Math.max(...obstacles.map((node) => node.x + node.width));
  const topRoute = Math.min(...obstacles.map((node) => node.y))
    - gap
    - Math.max(link.sourceThickness, link.targetThickness);
  const bottomRoute = Math.max(...obstacles.map((node) => node.y + node.height)) + gap;
  const sourceCenter = link.source.y + link.source.height / 2;
  const targetCenter = link.target.y + link.target.height / 2;
  const routesBelow = targetCenter >= sourceCenter;
  const routeY = routesBelow ? bottomRoute : topRoute;
  link.route = routesBelow ? 'below' : 'above';
  link.routeY = routeY;
  points.splice(
    1,
    0,
    { x: (sourceX + firstLeft) / 2, y: routeY },
    { x: (lastRight + targetX) / 2, y: routeY },
  );
  return points;
}

function ribbonPath(link, tension, columns, gap) {
  const routed = routedPoints(link, columns, gap);
  const sourceX = routed[0].x;
  const targetX = routed.at(-1).x;
  const span = Math.max(1, targetX - sourceX);
  const points = routed.map((point) => {
    const ratio = Math.max(0, Math.min(1, (point.x - sourceX) / span));
    return {
      ...point,
      thickness: link.sourceThickness
        + (link.targetThickness - link.sourceThickness) * ratio,
    };
  });
  const commands = [`M${points[0].x},${points[0].y}`];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const deltaX = (to.x - from.x) * tension;
    commands.push(
      `C${from.x + deltaX},${from.y} ${to.x - deltaX},${to.y} ${to.x},${to.y}`,
    );
  }
  const last = points.at(-1);
  commands.push(`L${last.x},${last.y + last.thickness}`);
  for (let index = points.length - 1; index > 0; index -= 1) {
    const from = points[index];
    const to = points[index - 1];
    const deltaX = (to.x - from.x) * tension;
    commands.push(
      `C${from.x + deltaX},${from.y + from.thickness} `
      + `${to.x - deltaX},${to.y + to.thickness} `
      + `${to.x},${to.y + to.thickness}`,
    );
  }
  commands.push('Z');
  return commands.join(' ');
}

/* [SANKEY-25] 亏损差额从兄弟成本节点的超额段回弯到同列结果节点。 */
function differenceRibbonPath(link, gap) {
  const source = link.visualSource;
  const target = link.target;
  const sourceX = source.x;
  const targetX = target.x;
  const controlX = Math.min(sourceX, targetX) - gap;
  const sourceY = Math.max(source.y, source.y + source.height - link.sourceThickness);
  const targetY = link.targetY;
  const sourceThickness = link.sourceThickness;
  const targetThickness = link.targetThickness;

  link.sourceY = sourceY;
  link.route = 'difference';
  link.routeX = controlX;
  return [
    `M${sourceX},${sourceY}`,
    `C${controlX},${sourceY} ${controlX},${targetY} ${targetX},${targetY}`,
    `L${targetX},${targetY + targetThickness}`,
    `C${controlX},${targetY + targetThickness} `
      + `${controlX},${sourceY + sourceThickness} ${sourceX},${sourceY + sourceThickness}`,
    'Z',
  ].join(' ');
}

/*
 * [SANKEY-04..08][SANKEY-11][SANKEY-13][SANKEY-15..18][SANKEY-25/26]
 * 最大分配枢纽作为尺度锚点；时间序列可共享最大值比例尺并保持中轴居中。
 */
export function layoutSankey(cfg, bounds, style) {
  const geometry = style.geometry;
  const graph = assertSankeyConfig(cfg);
  const scaleMagnitude = graph.scaleMax ?? graph.primary.magnitude;
  const scale = geometry['primary-node-height'] / scaleMagnitude;
  const nodeGap = geometry['node-gap'];
  const paddingX = geometry['canvas-padding-x'];
  const paddingY = geometry['canvas-padding-y'];
  const zeroFlowSize = geometry['zero-flow-size'];
  const nodeMinHeight = geometry['node-min-height'];
  const edgeMinThickness = Math.max(
    zeroFlowSize,
    geometry['edge-min-thickness'],
  );
  const centerlineAttraction = geometry['centerline-attraction'];
  const labelSlotWidth = Math.max(
    geometry['label-title-width'],
    Number(bounds.labelSlotWidth) || 0,
  );
  const columnPitch = geometry['primary-node-width']
    + geometry['label-gap']
    + labelSlotWidth
    + geometry['column-gap'];

  graph.links.forEach((link) => {
    link.semanticRole = link.target.semanticRole;
    link.proportionalThickness = link.magnitude * scale;
    link.thickness = link.magnitude === 0
      ? zeroFlowSize
      : Math.max(edgeMinThickness, link.proportionalThickness);
    link.sourceThickness = link.thickness;
    link.targetThickness = link.thickness;
  });
  graph.nodes.forEach((node) => {
    node.width = node === graph.primary
      ? geometry['primary-node-width']
      : geometry['node-width'];
    node.proportionalHeight = Math.max(nodeMinHeight, node.magnitude * scale);
    const incomingDisplayHeight = node.incoming.reduce(
      (sum, link) => sum + link.thickness,
      0,
    );
    const outgoingDisplayHeight = node.outgoing.reduce(
      (sum, link) => sum + link.thickness,
      0,
    );
    node.height = node.hasNegativeDifference || node.isNegativeDifferenceResult
      ? Math.max(nodeMinHeight, node.proportionalHeight)
      : Math.max(
        nodeMinHeight,
        node.proportionalHeight,
        incomingDisplayHeight,
        outgoingDisplayHeight,
      );
    node.color = semanticColor(node, style.colors);
  });
  graph.links.forEach((link) => {
    if (!link.isNegativeDifference) return;
    link.baseLink.sourceThickness = Math.min(
      link.baseLink.sourceThickness,
      link.source.height,
    );
  });

  const columns = graph.stageValues.map(() => []);
  graph.nodes.forEach((node) => columns[node.columnIndex].push(node));
  const columnGaps = columns.map((column) => distributedColumnGap(
    column,
    nodeGap,
    resolveSankeyColumnMinimumSpan(column.length, geometry),
  ));

  let requiredHeight = Math.max(
    geometry['canvas-min-height'],
    ...columns.map((column, index) => (
      columnHeight(column, columnGaps[index]) + paddingY * 2
    )),
  );
  [graph.primary].forEach((anchoredNode) => {
    const columnIndex = anchoredNode.columnIndex;
    const column = columns[columnIndex];
    const gap = columnGaps[columnIndex];
    const anchorIndex = column.indexOf(anchoredNode);
    const above = columnHeight(column.slice(0, anchorIndex), gap)
      + (anchorIndex > 0 ? gap : 0);
    const below = columnHeight(column.slice(anchorIndex + 1), gap)
      + (anchorIndex < column.length - 1 ? gap : 0);
    requiredHeight = Math.max(
      requiredHeight,
      (anchoredNode.height / 2 + Math.max(above, below)) * 2 + paddingY * 2,
    );
  });

  const sidePadding = Math.max(
    paddingX,
    labelSlotWidth + geometry['label-gap'] + geometry['primary-node-width'] / 2,
  );
  const requiredWidth = sidePadding * 2 + Math.max(0, columns.length - 1) * columnPitch;
  const width = Math.max(1, bounds.width, requiredWidth);
  const height = Math.max(bounds.height, requiredHeight);
  const horizontalOffset = (width - requiredWidth) / 2;
  graph.nodes.forEach((node) => {
    const centerX = horizontalOffset + sidePadding + node.columnIndex * columnPitch;
    node.x = centerX - node.width / 2;
  });

  const anchorY = height / 2;
  columns.forEach((column, columnIndex) => {
    column.sort((a, b) => compareColumnNodes(a, b, anchorY));
    const incomingCenter = columnIncomingCenter(column, anchorY);
    const centerY = columnIndex === graph.primary.columnIndex
      ? anchorY
      : centerlineAlignedCenter(
        column,
        columnIndex,
        graph.primary.columnIndex,
        incomingCenter,
        anchorY,
        centerlineAttraction,
      );

    const columnAnchor = columnIndex === graph.primary.columnIndex
      ? graph.primary
      : null;

    /* [SANKEY-21/22] 画板中心定中轴；同列范围随节点数量逐级扩展。 */
    placeColumn(
      column,
      centerY,
      columnGaps[columnIndex],
      height,
      paddingY,
      columnAnchor,
    );
  });

  graph.nodes.forEach((node) => {
    node.visualIncoming = [];
    node.visualOutgoing = [];
  });
  graph.links.forEach((link) => {
    link.visualSource = link.value < 0 && link.negativeSource
      ? link.negativeSource
      : link.source;
    link.visualTarget = link.target;
    link.visualSource.visualOutgoing.push(link);
    link.visualTarget.visualIncoming.push(link);
  });

  graph.nodes.forEach((node) => {
    const incoming = [...node.visualIncoming].sort(
      (a, b) => (a.visualSource.y + a.visualSource.height / 2)
        - (b.visualSource.y + b.visualSource.height / 2),
    );
    const outgoing = [...node.visualOutgoing].sort(
      (a, b) => (a.target.y + a.target.height / 2) - (b.target.y + b.target.height / 2),
    );
    const incomingHeight = incoming.reduce(
      (sum, link) => sum + link.targetThickness,
      0,
    );
    const outgoingHeight = outgoing.reduce(
      (sum, link) => sum + link.sourceThickness,
      0,
    );
    let incomingOffset = node.y + Math.max(0, (node.height - incomingHeight) / 2);
    let outgoingOffset = node.y + Math.max(0, (node.height - outgoingHeight) / 2);
    incoming.forEach((link) => {
      link.targetY = incomingOffset;
      incomingOffset += link.targetThickness;
    });
    outgoing.forEach((link) => {
      link.sourceY = outgoingOffset;
      outgoingOffset += link.sourceThickness;
    });
  });

  graph.links.forEach((link) => {
    link.color = link.target.color;
    const isNegativeDifference = link.isNegativeDifference;
    link.path = isNegativeDifference
      ? differenceRibbonPath(link, nodeGap)
      : ribbonPath(link, geometry['curve-tension'], columns, nodeGap);
    link.labelX = isNegativeDifference
      ? link.routeX
      : (link.source.x + link.source.width + link.target.x) / 2;
    link.labelY = isNegativeDifference
      ? (link.sourceY + link.targetY) / 2
        + (link.sourceThickness + link.targetThickness) / 4
      : (link.route
        ? link.routeY + (link.sourceThickness + link.targetThickness) / 4
        : (link.sourceY + link.targetY) / 2
          + (link.sourceThickness + link.targetThickness) / 4);
  });

  return {
    ...graph,
    columns,
    width,
    height,
    requiredWidth,
    requiredHeight,
    nodeGap,
    columnGaps,
    labelSlotWidth,
    columnPitch,
    centerlineY: anchorY,
    scaleMax: scaleMagnitude,
    scale,
  };
}
