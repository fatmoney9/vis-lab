import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertSankeyConfig,
  fitSankeyValueFontSize,
  layoutSankey,
  resolveSankeyCanvasHeight,
  resolveSankeyColumnMinimumSpan,
  resolveSankeyLabelFontSize,
  resolveSankeyLabelSlot,
  truncateSankeyTitle,
} from '../charts/charts/sankey/layout.js';
import {
  sankeyNodeDashboard,
  sankeyNodeDashboardValueColor,
  sankeyRelatedNeighborhood,
} from '../charts/charts/sankey/interaction.js';
import {
  cubicOut,
  hasSameSankeyTopology,
  interpolateSankeyConfig,
} from '../charts/charts/sankey/playback.js';

const TOKENS = JSON.parse(
  readFileSync(new URL('../tokens/sankey.json', import.meta.url), 'utf8'),
);
const SANKEY_CSS = readFileSync(
  new URL('../charts/charts/sankey/styles.css', import.meta.url),
  'utf8',
);
const SANKEY_SOURCE = readFileSync(
  new URL('../charts/charts/sankey/index.js', import.meta.url),
  'utf8',
);

const STYLE = {
  geometry: {
    'primary-node-width': 24,
    'node-width': 12,
    'primary-node-height': 240,
    'node-gap': 24,
    'multi-node-span-base-ratio': 0.7,
    'third-node-span-ratio': 0.3,
    'zero-flow-size': 1,
    'node-min-height': 1,
    'edge-min-thickness': 1,
    'canvas-min-height': 288,
    'canvas-recommended-height': 384,
    'canvas-max-height': null,
    'canvas-padding-x': 120,
    'canvas-padding-y': 24,
    'label-gap': 8,
    'label-title-width': 96,
    'label-title-font-size-min': 10,
    'label-title-font-size-max': 12,
    'label-value-font-size-min': 11,
    'label-value-font-size-max': 14,
    'column-gap': 24,
    'legend-reserved-height': 40,
    'edge-opacity': 0.2,
    'edge-highlight-opacity': 0.64,
    'centerline-attraction': 0.8,
    'curve-tension': 0.5,
    'dense-edge-label-threshold': 8,
  },
  colors: {
    income: 'income',
    expense: 'expense',
    profit: 'profit',
  },
};

const MOBILE_STYLE = structuredClone(STYLE);
Object.assign(MOBILE_STYLE.geometry, {
  'primary-node-height': 120,
  'node-gap': 12,
  'canvas-min-height': 168,
  'canvas-recommended-height': 203,
  'canvas-max-height': 203,
});

const CONFIG = {
  nodes: [
    { id: 'source-a', name: '来源甲', role: 'income', stage: 0 },
    { id: 'source-b', name: '来源乙', role: 'income', stage: 0 },
    { id: 'hub', name: '枢纽', role: 'income', stage: 1 },
    { id: 'expense', name: '支出', role: 'expense', stage: 2 },
    { id: 'retained', name: '结余', role: 'profit', stage: 2 },
  ],
  links: [
    { source: 'source-a', target: 'hub', value: 60 },
    { source: 'source-b', target: 'hub', value: 40 },
    { source: 'hub', target: 'expense', value: 70 },
    { source: 'hub', target: 'retained', value: 30 },
  ],
};

const MULTI_STAGE_CONFIG = {
  nodes: [
    { id: 'domestic', name: '国内销售', role: 'income', stage: 0 },
    { id: 'overseas', name: '海外销售', role: 'income', stage: 0 },
    { id: 'revenue', name: '营业收入', role: 'income', stage: 1 },
    {
      id: 'cost',
      name: '营业成本',
      role: 'expense',
      stage: 2,
      order: 0,
    },
    {
      id: 'gross',
      name: '毛利润',
      role: 'profit',
      stage: 2,
      order: 1,
    },
    { id: 'research', name: '研发费用', role: 'expense', stage: 3 },
    { id: 'operating', name: '营业利润', role: 'profit', stage: 3 },
    { id: 'finance', name: '财务费用', role: 'expense', stage: 4 },
    { id: 'net', name: '净利润', role: 'profit', stage: 4 },
  ],
  links: [
    { source: 'domestic', target: 'revenue', value: 60 },
    { source: 'overseas', target: 'revenue', value: 40 },
    { source: 'revenue', target: 'cost', value: 45 },
    { source: 'revenue', target: 'gross', value: 55 },
    { source: 'gross', target: 'research', value: 20 },
    { source: 'gross', target: 'operating', value: 35 },
    { source: 'operating', target: 'finance', value: 5 },
    { source: 'operating', target: 'net', value: 30 },
  ],
};

const LOSS_CONFIG = {
  nodes: [
    { id: 'revenue', name: '营业收入', role: 'income', stage: 0 },
    { id: 'cost', name: '营业成本', role: 'expense', stage: 1, order: 0 },
    { id: 'gross', name: '毛利', role: 'profit', stage: 1, order: 1 },
    { id: 'expense', name: '费用及营业税', role: 'expense', stage: 2, order: 0 },
    { id: 'operating', name: '营业利润', role: 'profit', stage: 2, order: 1 },
    { id: 'other', name: '其他经营收益', role: 'income', stage: 1, order: 2 },
    { id: 'total', name: '利润总额', role: 'profit', stage: 3 },
  ],
  links: [
    { source: 'revenue', target: 'cost', value: 896013600 },
    {
      source: 'revenue',
      target: 'gross',
      value: -4013600,
      negativeSource: 'cost',
    },
    { source: 'gross', target: 'expense', value: 26127300 },
    { source: 'gross', target: 'operating', value: -30140900 },
    { source: 'other', target: 'operating', value: -5630900 },
    { source: 'operating', target: 'total', value: -35771800 },
  ],
};

test('SANKEY-02：拒绝任何 stack 配置', () => {
  assert.throws(
    () => assertSankeyConfig({ ...CONFIG, stack: 'normal' }),
    /不支持 stack/,
  );
});

test('SANKEY-03：两阶段关系不满足桑基图最小阶段数', () => {
  assert.throws(
    () => assertSankeyConfig({
      nodes: [
        { id: 'source', name: '来源', role: 'income', stage: 0 },
        { id: 'result', name: '结果', role: 'profit', stage: 1 },
      ],
      links: [{ source: 'source', target: 'result', value: 10 }],
    }),
    /至少需要三个布局阶段/,
  );
});

test('SANKEY-04/05：PC 主节点 24×240，移动端主节点高 120', () => {
  const graph = layoutSankey(CONFIG, { width: 960, height: 480 }, STYLE);
  const mobileGraph = layoutSankey(CONFIG, { width: 960, height: 320 }, MOBILE_STYLE);
  assert.equal(graph.primary.name, '枢纽');
  assert.equal(graph.primary.width, 24);
  assert.equal(graph.primary.height, 240);
  assert.equal(graph.nodeGap, 24);
  assert.equal(mobileGraph.primary.height, 120);
  assert.equal(mobileGraph.nodeGap, 12);
  graph.nodes
    .filter((node) => node !== graph.primary)
    .forEach((node) => assert.equal(node.width, 12));
});

test('SANKEY-15：全图最宽数值统一标签槽，且不小于 96px', () => {
  assert.equal(resolveSankeyLabelSlot([36, 72, 88], 96), 96);
  assert.equal(resolveSankeyLabelSlot([36, 128, 88], 96), 128);
});

test('SANKEY-15：相邻阶段使用固定列距，不随容器宽度或单个节点变化', () => {
  const labelSlotWidth = 128;
  const graph = layoutSankey(
    MULTI_STAGE_CONFIG,
    { width: 1440, height: 640, labelSlotWidth },
    STYLE,
  );
  const centers = graph.columns.map((column) => {
    const node = column[0];
    return node.x + node.width / 2;
  });
  const expectedPitch = STYLE.geometry['primary-node-width']
    + STYLE.geometry['label-gap']
    + labelSlotWidth
    + STYLE.geometry['column-gap'];

  assert.equal(graph.labelSlotWidth, labelSlotWidth);
  assert.equal(graph.columnPitch, expectedPitch);
  centers.slice(1).forEach((center, index) => {
    assert.ok(Math.abs(center - centers[index] - expectedPitch) < 1e-9);
  });
});

test('SANKEY-15：超长标题在 96px 内以省略号结束', () => {
  const measure = (value) => Array.from(value).length * 12;
  assert.equal(truncateSankeyTitle('营业成本', 96, measure), '营业成本');

  const truncated = truncateSankeyTitle('营业成本及其他长期经营费用', 96, measure);
  assert.match(truncated, /…$/);
  assert.ok(measure(truncated) <= 96);
});

test('SANKEY-18：标题与数值字号随分支高度映射到各自上下限', () => {
  assert.equal(resolveSankeyLabelFontSize(2, 2, 240, 10, 12), 10);
  assert.equal(resolveSankeyLabelFontSize(240, 2, 240, 10, 12), 12);
  assert.equal(resolveSankeyLabelFontSize(121, 2, 240, 11, 14), 12.5);
});

test('SANKEY-18：长数值缩至 96px，11px 仍超宽时完整展示', () => {
  const measure = (value, fontSize) => String(value).length * fontSize;
  const fitted = fitSankeyValueFontSize('12345678', 14, 11, 96, measure);
  const minimum = fitSankeyValueFontSize('123456789', 14, 11, 96, measure);

  assert.ok(fitted >= 11 && fitted < 14);
  assert.ok(measure('12345678', fitted) <= 96);
  assert.equal(minimum, 11);
  assert.ok(measure('123456789', minimum) > 96);
});

test('SANKEY-19：桑基数值使用 THS → DIN → 等宽字体专属回退链', () => {
  assert.equal(
    TOKENS.typography['number-font-family'],
    "'THS Money font',THSJinRongTi,'DIN Alternate',ui-monospace,monospace",
  );
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey__edge-label[\s\S]*font-family: var\(--dv-sankey-number-font-family\)/,
  );
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey__node-value[\s\S]*font-family: var\(--dv-sankey-number-font-family\)/,
  );
});

test('SANKEY-20：节点看板为单行项目名与有符号值', () => {
  const node = {
    id: 'gross-profit',
    name: '毛利润',
    semanticRole: 'profit',
    value: -4013600,
    formattedValue: '-401.36万',
  };
  const format = (value) => `${value}`;

  assert.deepEqual(sankeyNodeDashboard(node, format), {
    title: '',
    rows: [{
      key: 'node-gross-profit',
      label: '毛利润',
      type: 'bar',
      colorVar: '--dv-sankey-profit-color',
      value: '-401.36万',
    }],
  });
  assert.equal(
    sankeyNodeDashboardValueColor(node),
    'var(--color-text-tooltip-series)',
  );
  assert.equal(
    sankeyNodeDashboardValueColor({ ...node, value: 4013600 }),
    'var(--dv-sankey-profit-color)',
  );
  assert.equal(
    sankeyNodeDashboardValueColor({ ...node, displayValue: 4013600 }),
    'var(--dv-sankey-profit-color)',
  );
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey \.dv-tooltip__title,[\s\S]*\.dv-sankey \.dv-tooltip__marker[\s\S]*display: none/,
  );
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey \.dv-tooltip__value[\s\S]*color: var\(--dv-sankey-tooltip-value-color\)[\s\S]*font-family: var\(--dv-sankey-number-font-family\)/,
  );
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey__node-label-hit[\s\S]*fill: transparent[\s\S]*pointer-events: all/,
  );
  assert.match(SANKEY_SOURCE, /nodeLabelHits[\s\S]*\.on\('click', clickNode\)/);
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey__edge-ribbon[\s\S]*stroke-width: var\(--spacing-8\)/,
  );
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey__edge-ribbon[\s\S]*vector-effect: non-scaling-stroke/,
  );
  const edgeHandlers = SANKEY_SOURCE.slice(
    SANKEY_SOURCE.indexOf("edgeGroups\n      .on('pointerenter'"),
    SANKEY_SOURCE.indexOf("svg.on('click.sankey-interaction'"),
  );
  assert.ok(edgeHandlers.length > 0);
  assert.match(edgeHandlers, /hideTooltip\(\)/);
  assert.match(edgeHandlers, /highlightEdge/);
  assert.doesNotMatch(edgeHandlers, /show(?:Node)?Tooltip/);
});

test('SANKEY-10：节点高亮只包含直接相邻的上下一级', () => {
  const graph = layoutSankey(MULTI_STAGE_CONFIG, { width: 960, height: 640 }, STYLE);
  const operating = graph.nodes.find((node) => node.id === 'operating');
  const related = sankeyRelatedNeighborhood(operating);

  assert.deepEqual(
    new Set([...related.nodes].map((node) => node.id)),
    new Set(['gross', 'operating', 'finance', 'net']),
  );
  assert.deepEqual(
    new Set([...related.links].map((link) => `${link.source.id}->${link.target.id}`)),
    new Set(['gross->operating', 'operating->finance', 'operating->net']),
  );
  assert.ok(!related.nodes.has(graph.nodes.find((node) => node.id === 'revenue')));
});

test('SANKEY-21：后续分支统一向画板垂直中轴回拉', () => {
  const graph = layoutSankey(MULTI_STAGE_CONFIG, { width: 960, height: 640 }, STYLE);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const axisY = graph.height / 2;
  const distanceToAxis = (id) => {
    const node = byId.get(id);
    return Math.abs(node.y + node.height / 2 - axisY);
  };

  assert.equal(graph.centerlineY, axisY);
  assert.ok(distanceToAxis('operating') < distanceToAxis('gross'));
  const operating = byId.get('operating');
  const operatingCenter = operating.y + operating.height / 2;
  const finalColumn = graph.columns[byId.get('net').columnIndex];
  const finalTop = Math.min(...finalColumn.map((node) => node.y));
  const finalBottom = Math.max(...finalColumn.map((node) => node.y + node.height));
  const finalCenter = (finalTop + finalBottom) / 2;

  assert.ok(Math.abs(finalCenter - axisY) < Math.abs(operatingCenter - axisY));
});

test('SANKEY-22：同列纵向范围随节点数和端侧主节点尺寸变化', () => {
  const expectedSpans = [0, 168, 240, 264];
  expectedSpans.forEach((expected, index) => {
    assert.ok(
      Math.abs(resolveSankeyColumnMinimumSpan(index + 1, STYLE.geometry) - expected) < 1e-9,
    );
  });
  const mobileExpectedSpans = [0, 84, 120, 132];
  mobileExpectedSpans.forEach((expected, index) => {
    assert.ok(
      Math.abs(
        resolveSankeyColumnMinimumSpan(index + 1, MOBILE_STYLE.geometry) - expected
      ) < 1e-9,
    );
  });

  const graph = layoutSankey(MULTI_STAGE_CONFIG, { width: 960, height: 640 }, STYLE);
  const finalColumn = graph.columns.at(-1);
  const finalGap = finalColumn[1].y - (finalColumn[0].y + finalColumn[0].height);
  const finalSpan = finalColumn.at(-1).y + finalColumn.at(-1).height - finalColumn[0].y;

  assert.ok(finalGap >= STYLE.geometry['node-gap']);
  assert.ok(Math.abs(finalGap - graph.columnGaps.at(-1)) < 1e-9);
  assert.ok(finalSpan >= resolveSankeyColumnMinimumSpan(2, STYLE.geometry));
});

test('SANKEY-23：PC 自适应高度，移动端限制为 243px 可视总高', () => {
  assert.equal(resolveSankeyCanvasHeight(0, STYLE.geometry), 384);
  assert.equal(resolveSankeyCanvasHeight(328, STYLE.geometry), 288);
  assert.equal(resolveSankeyCanvasHeight(424, STYLE.geometry), 384);
  assert.equal(resolveSankeyCanvasHeight(640, STYLE.geometry), 600);
  assert.equal(resolveSankeyCanvasHeight(0, MOBILE_STYLE.geometry), 203);
  assert.equal(resolveSankeyCanvasHeight(208, MOBILE_STYLE.geometry), 168);
  assert.equal(resolveSankeyCanvasHeight(243, MOBILE_STYLE.geometry), 203);
  assert.equal(resolveSankeyCanvasHeight(640, MOBILE_STYLE.geometry), 203);

  const graph = layoutSankey(
    MULTI_STAGE_CONFIG,
    { width: 400, height: STYLE.geometry['canvas-min-height'] },
    STYLE,
  );
  assert.ok(graph.width >= graph.requiredWidth);
  assert.ok(graph.height >= graph.requiredHeight);
  assert.ok(graph.requiredWidth > 400);
});

test('SANKEY-24：同拓扑季度数据平滑插值且中间帧保持守恒', () => {
  const next = structuredClone(CONFIG);
  next.links.find((link) => link.source === 'source-a').value = 80;
  next.links.find((link) => link.source === 'source-b').value = 40;
  next.links.find((link) => link.target === 'expense').value = 90;
  next.links.find((link) => link.target === 'retained').value = 30;

  assert.equal(hasSameSankeyTopology(CONFIG, next), true);
  assert.equal(cubicOut(0), 0);
  assert.equal(cubicOut(1), 1);
  assert.ok(cubicOut(0.5) > 0.5);

  const middle = interpolateSankeyConfig(CONFIG, next, 0.5);
  assert.equal(middle.links.find((link) => link.source === 'source-a').value, 70);
  assert.equal(middle.links.find((link) => link.target === 'expense').value, 80);
  assert.doesNotThrow(() => assertSankeyConfig(middle));
  assert.equal(TOKENS.motion['playback-label-lead-duration'], 120);
  assert.equal(TOKENS.motion['playback-duration'], 720);
  assert.equal(TOKENS.motion['playback-easing'], 'cubic-out');
  assert.match(SANKEY_SOURCE, /displayValueByNodeId/);
  assert.match(SANKEY_SOURCE, /onProgress\?\.\(easedProgress, linearProgress\)/);

  assert.doesNotThrow(() => assertSankeyConfig({
    nodes: [
      { id: 'source', name: '收入', role: 'income', stage: 0 },
      { id: 'gross', name: '毛利', role: 'profit', stage: 1 },
      { id: 'expense', name: '费用', role: 'expense', stage: 2 },
      { id: 'result', name: '结果', role: 'profit', stage: 2 },
    ],
    links: [
      { source: 'source', target: 'gross', value: -37_441_831.721952915 },
      { source: 'gross', target: 'expense', value: 3_200_000_000 },
      { source: 'gross', target: 'result', value: -3_237_441_831.7219534 },
    ],
  }));
});

test('SANKEY-24：拓扑变化时拒绝季度插值', () => {
  const changed = structuredClone(CONFIG);
  changed.links.pop();
  assert.equal(hasSameSankeyTopology(CONFIG, changed), false);
  assert.throws(
    () => interpolateSankeyConfig(CONFIG, changed, 0.5),
    /拓扑保持一致/,
  );
});

test('SANKEY-06：终止节点停在实际阶段，不强制补齐到最右列', () => {
  const graph = layoutSankey(MULTI_STAGE_CONFIG, { width: 960, height: 640 }, STYLE);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));

  assert.equal(byId.get('cost').kind, 'sink');
  assert.equal(byId.get('cost').stage, 2);
  assert.ok(byId.get('cost').stage < graph.maxStage);
  assert.equal(byId.get('research').kind, 'sink');
  assert.equal(byId.get('research').stage, 3);
  assert.ok(byId.get('research').stage < graph.maxStage);
  assert.ok(byId.get('cost').x < byId.get('net').x);
  assert.ok(byId.get('research').x < byId.get('net').x);
});

test('SANKEY-07：显式业务顺序优先于默认角色分区', () => {
  const graph = layoutSankey(MULTI_STAGE_CONFIG, { width: 960, height: 640 }, STYLE);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  assert.ok(byId.get('cost').y < byId.get('gross').y);
});

test('SANKEY-11：业务角色决定颜色，与布局阶段、数值符号和是否终止无关', () => {
  const graph = layoutSankey(MULTI_STAGE_CONFIG, { width: 960, height: 640 }, STYLE);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));

  assert.equal(byId.get('domestic').color, 'income');
  assert.equal(byId.get('revenue').color, 'income');
  assert.equal(byId.get('gross').kind, 'intermediate');
  assert.equal(byId.get('gross').color, 'profit');
  assert.equal(byId.get('operating').color, 'profit');
  assert.equal(byId.get('cost').color, 'expense');
});

test('SANKEY-11：每个节点必须声明收入、支出或利润角色', () => {
  const invalid = structuredClone(CONFIG);
  delete invalid.nodes.find((node) => node.id === 'expense').role;
  assert.throws(
    () => assertSankeyConfig(invalid),
    /role 必须是/,
  );
});

test('SANKEY-11：THS 与 Ainvest 使用各自三种业务语义色', () => {
  assert.deepEqual(TOKENS.ths, {
    income: '#FF9500',
    expense: '#3366FF',
    profit: '#FF2436',
  });
  assert.deepEqual(TOKENS.ainvest, {
    income: '#265FFC',
    expense: '#FF381A',
    profit: '#00B53C',
  });
});

test('SANKEY-11：iFinD-PC 完整继承 base 三色', () => {
  assert.deepEqual(TOKENS['ifind-pc'], TOKENS.base);
});

test('SANKEY-08/13：边宽与节点高共用比例尺，边色取目标节点色', () => {
  const graph = layoutSankey(CONFIG, { width: 960, height: 480 }, STYLE);
  const wide = graph.links.find((link) => link.value === 70);
  const narrow = graph.links.find((link) => link.value === 30);
  const expense = graph.nodes.find((node) => node.id === 'expense');

  assert.equal(wide.thickness / narrow.thickness, 70 / 30);
  assert.equal(expense.height / graph.primary.height, 70 / 100);
  assert.equal(wide.color, wide.target.color);
  assert.equal(graph.scale, 240 / 100);
});

test('SANKEY-17：节点与非零小流量使用 1px 下限，节点容纳最终显示粗细', () => {
  const tinyFlowConfig = {
    nodes: [
      { id: 'large', name: '主要收入', role: 'income', stage: 0 },
      { id: 'tiny', name: '微小收入', role: 'income', stage: 0 },
      { id: 'hub', name: '收入合计', role: 'income', stage: 1 },
      { id: 'result', name: '利润总额', role: 'profit', stage: 2 },
    ],
    links: [
      { source: 'large', target: 'hub', value: 896_000_000 },
      { source: 'tiny', target: 'hub', value: 7_100 },
      { source: 'hub', target: 'result', value: 896_007_100 },
    ],
  };
  const graph = layoutSankey(tinyFlowConfig, { width: 960, height: 480 }, STYLE);
  const tinyLink = graph.links.find((link) => link.source.id === 'tiny');
  const hub = graph.nodes.find((node) => node.id === 'hub');
  const incomingDisplayHeight = hub.incoming.reduce(
    (sum, link) => sum + link.thickness,
    0,
  );

  assert.ok(tinyLink.proportionalThickness < STYLE.geometry['edge-min-thickness']);
  assert.equal(tinyLink.thickness, STYLE.geometry['edge-min-thickness']);
  assert.equal(STYLE.geometry['node-min-height'], 1);
  assert.equal(tinyLink.value, 7_100);
  assert.ok(hub.height >= incomingDisplayHeight);
  assert.ok(hub.height > hub.proportionalHeight);
});

test('SANKEY-13：中间节点流入与流出不守恒时立即报错', () => {
  const invalid = structuredClone(CONFIG);
  invalid.links.find((link) => link.target === 'expense').value = 60;
  assert.throws(
    () => assertSankeyConfig(invalid),
    /流量不守恒/,
  );
});

test('SANKEY-13/16/25：毛利亏损从营业成本超额段引出，逻辑值仍保持守恒', () => {
  const graph = layoutSankey(LOSS_CONFIG, { width: 960, height: 480 }, STYLE);
  const mobileGraph = layoutSankey(
    LOSS_CONFIG,
    { width: 960, height: 320 },
    MOBILE_STYLE,
  );
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const lossLink = graph.links.find((link) => link.target.id === 'gross');
  const costLink = graph.links.find((link) => link.target.id === 'cost');
  const related = sankeyRelatedNeighborhood(byId.get('gross'));
  const revenue = byId.get('revenue');
  const cost = byId.get('cost');
  const gross = byId.get('gross');

  assert.equal(byId.get('revenue').value, 892000000);
  assert.equal(byId.get('gross').value, -4013600);
  assert.equal(byId.get('gross').semanticRole, 'profit');
  assert.equal(byId.get('gross').color, 'profit');
  assert.equal(lossLink.value, -4013600);
  assert.equal(lossLink.magnitude, 4013600);
  assert.ok(lossLink.thickness > 0);
  assert.equal(lossLink.source.id, 'revenue');
  assert.equal(lossLink.visualSource.id, 'cost');
  assert.equal(lossLink.visualSource.columnIndex, lossLink.target.columnIndex);
  assert.equal(lossLink.route, 'difference');
  assert.match(lossLink.path, new RegExp(`^M${byId.get('cost').x},`));
  assert.equal(graph.primary, revenue);
  assert.ok(Math.abs(cost.height / revenue.height - cost.value / revenue.value) < 1e-12);
  assert.ok(Math.abs(cost.height - revenue.height - lossLink.thickness) < 1e-12);
  assert.equal(costLink.sourceThickness, revenue.height);
  assert.equal(costLink.targetThickness, cost.height);
  assert.equal(gross.height, lossLink.targetThickness);
  assert.ok(related.nodes.has(byId.get('cost')));
  assert.ok(!related.nodes.has(byId.get('revenue')));

  const mobileRevenue = mobileGraph.nodes.find((node) => node.id === 'revenue');
  const mobileCost = mobileGraph.nodes.find((node) => node.id === 'cost');
  const mobileLoss = mobileGraph.links.find((link) => link.target.id === 'gross');
  assert.ok(
    Math.abs(
      mobileCost.height - mobileRevenue.height - mobileLoss.proportionalThickness,
    ) < 1e-12,
  );
  assert.equal(mobileLoss.thickness, STYLE.geometry['edge-min-thickness']);
  assert.ok(mobileLoss.thickness > mobileLoss.proportionalThickness);
});

test('SANKEY-25：盈利时差额仍从营业收入分出，跨过零值才切换视觉来源', () => {
  const profitConfig = structuredClone(LOSS_CONFIG);
  profitConfig.links.find((link) => link.target === 'cost').value = 887986400;
  profitConfig.links.find((link) => link.target === 'gross').value = 4013600;
  profitConfig.links.find((link) => link.source === 'gross' && link.target === 'expense').value = 0;
  profitConfig.links.find((link) => link.source === 'gross' && link.target === 'operating').value = 4013600;
  profitConfig.links.find((link) => link.source === 'other').value = 0;
  profitConfig.links.find((link) => link.source === 'operating').value = 4013600;

  const graph = layoutSankey(profitConfig, { width: 960, height: 480 }, STYLE);
  const profitLink = graph.links.find((link) => link.target.id === 'gross');
  const beforeZero = layoutSankey(
    interpolateSankeyConfig(profitConfig, LOSS_CONFIG, 0.49),
    { width: 960, height: 480 },
    STYLE,
  ).links.find((link) => link.target.id === 'gross');
  const afterZero = layoutSankey(
    interpolateSankeyConfig(profitConfig, LOSS_CONFIG, 0.51),
    { width: 960, height: 480 },
    STYLE,
  ).links.find((link) => link.target.id === 'gross');

  assert.equal(profitLink.value, 4013600);
  assert.equal(profitLink.visualSource.id, 'revenue');
  assert.notEqual(profitLink.route, 'difference');
  assert.ok(profitLink.visualSource.x < profitLink.target.x);
  assert.equal(beforeZero.visualSource.id, 'revenue');
  assert.equal(afterZero.visualSource.id, 'cost');
  assert.equal(afterZero.negativeSource.id, 'cost');
});

test('SANKEY-25：差额来源必须是同一来源、同一阶段的兄弟节点', () => {
  const invalid = structuredClone(LOSS_CONFIG);
  invalid.links.find((link) => link.target === 'gross').negativeSource = 'expense';
  assert.throws(
    () => assertSankeyConfig(invalid),
    /negativeSource.*兄弟节点/,
  );
});

test('SANKEY-13/16/25：差额结果节点按自身负值定高，其余节点仍容纳绝对流量', () => {
  const graph = layoutSankey(LOSS_CONFIG, { width: 960, height: 480 }, STYLE);
  const gross = graph.nodes.find((node) => node.id === 'gross');
  const operating = graph.nodes.find((node) => node.id === 'operating');

  assert.equal(gross.value, -4013600);
  assert.equal(gross.magnitude, Math.abs(gross.value));
  assert.equal(operating.value, -35771800);
  assert.equal(operating.magnitude, 30140900 + 5630900);
  assert.equal(gross.height, Math.abs(gross.value) * graph.scale);
});

test('SANKEY-06：显式 stage 必须保持流向单调向右', () => {
  const invalid = structuredClone(CONFIG);
  invalid.nodes.find((node) => node.id === 'expense').stage = 1;
  assert.throws(
    () => assertSankeyConfig(invalid),
    /目标 stage 必须大于源 stage/,
  );
});

test('SANKEY-12：超过 30 个节点仍完整渲染，并通过扩高画布保持间距', () => {
  const sinks = Array.from({ length: 30 }, (_, index) => ({
    id: `sink-${index + 1}`,
    name: `去向${index + 1}`,
    role: index === 0 ? 'profit' : 'expense',
    stage: 2,
  }));
  const denseConfig = {
    nodes: [
      { id: 'source', name: '业务来源', role: 'income', stage: 0 },
      { id: 'hub', name: '分配枢纽', role: 'income', stage: 1 },
      ...sinks,
    ],
    links: [
      { source: 'source', target: 'hub', value: 300 },
      ...sinks.map((sink) => ({
        source: 'hub',
        target: sink.id,
        value: 10,
      })),
    ],
  };

  const graph = layoutSankey(denseConfig, { width: 960, height: 384 }, STYLE);
  assert.equal(graph.nodes.length, 32);
  assert.equal(graph.links.length, 31);
  assert.ok(graph.height > STYLE.geometry['canvas-min-height']);
  graph.columns.at(-1)
    .slice(1)
    .forEach((node, index) => {
      const previous = graph.columns.at(-1)[index];
      const actualGap = node.y - (previous.y + previous.height);
      assert.ok(actualGap + 1e-9 >= graph.nodeGap);
      assert.ok(Math.abs(actualGap - graph.columnGaps.at(-1)) < 1e-9);
    });
});
