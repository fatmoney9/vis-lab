import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { truncateBatch } from '../charts/core/label.js';
import { easeOutCubic } from '../charts/core/motion.js';
import {
  SANKEY_SETTINGS,
  resolveSankeySettings,
} from '../charts/charts/sankey/config.js';
import {
  assertSankeyConfig,
  fitSankeyValueFontSize,
  layoutSankey,
  resolveSankeyCanvasHeight,
  resolveSankeyColumnMinimumSpan,
  resolveSankeyLabelFontSize,
  resolveSankeyLabelSlot,
  resolveSankeyLegendReservedHeight,
  resolveSankeyVisualLinkValues,
} from '../charts/charts/sankey/layout.js';
import {
  hasSameSankeyTopology,
  interpolateSankeyConfig,
  sankeyNodeDashboard,
  sankeyNodeDashboardValueColor,
  sankeyRelatedNeighborhood,
  resolveSankeySequenceViewport,
  withSharedSankeyScale,
} from '../charts/charts/sankey/model.js';
import {
  financialSankeyPresentation,
  sankeyPlaybackCopy,
} from '../demos/sankey-presentation.js';
import {
  sankeyPlaybackMarkup,
  sankeyPlaybackRangeTheme,
  sankeyPlaybackTicksMarkup,
} from '../demos/sankey-playback.js';
const THEME_TOKENS = Object.fromEntries(
  ['ths', 'ifind-pc', 'ainvest'].map((theme) => [
    theme,
    JSON.parse(readFileSync(new URL(`../tokens/${theme}.json`, import.meta.url), 'utf8')),
  ]),
);
const THEME_BEHAVIOR = JSON.parse(
  readFileSync(new URL('../tokens/behavior.json', import.meta.url), 'utf8'),
);
const SANKEY_CSS = readFileSync(
  new URL('../charts/styles.css', import.meta.url),
  'utf8',
);
const SANKEY_SOURCE = readFileSync(
  new URL('../charts/charts/sankey/index.js', import.meta.url),
  'utf8',
);
const SANKEY_PLAYBACK_CSS = readFileSync(
  new URL('../demos/sankey-playback.css', import.meta.url),
  'utf8',
);
const PREVIEW_SOURCES = [
  '../index.html',
  '../playground/preview.html',
  '../playground/sankey-preview.html',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));
const INDEX_SOURCE = PREVIEW_SOURCES[0];
const SANKEY_PREVIEW_SOURCE = PREVIEW_SOURCES[2];

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
    'sequence-height-step': 4,
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
  'canvas-padding-x': 84,
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
    {
      source: 'gross',
      target: 'operating',
      value: -30140900,
      negativeSource: 'expense',
    },
    { source: 'other', target: 'operating', value: -5630900 },
    { source: 'operating', target: 'total', value: -35771800 },
  ],
};

test('Sankey 配置：只承载跨主题不变的 L2 几何与播放参数', () => {
  assert.deepEqual(Object.keys(SANKEY_SETTINGS).sort(), ['geometry', 'motion']);
  assert.equal(SANKEY_SETTINGS.typography, undefined);
  assert.equal(SANKEY_SETTINGS.base, undefined);
  assert.deepEqual(resolveSankeySettings('pc').geometry, STYLE.geometry);
  assert.deepEqual(resolveSankeySettings('mobile').geometry, MOBILE_STYLE.geometry);
  assert.deepEqual(resolveSankeySettings('pc').colors, {
    income: 'var(--color-sankey-income)',
    expense: 'var(--color-sankey-expense)',
    profit: 'var(--color-sankey-profit)',
  });
});

test('SANKEY-18：config 固定标题 10–12px、数值 11–14px 的适配范围', () => {
  assert.deepEqual({
    titleMin: SANKEY_SETTINGS.geometry['label-title-font-size-min'],
    titleMax: SANKEY_SETTINGS.geometry['label-title-font-size-max'],
    valueMin: SANKEY_SETTINGS.geometry['label-value-font-size-min'],
    valueMax: SANKEY_SETTINGS.geometry['label-value-font-size-max'],
  }, {
    titleMin: 10, titleMax: 12, valueMin: 11, valueMax: 14,
  });
});

test('Sankey 样式：并入全局入口且不再保留图型私有样式文件', () => {
  assert.match(SANKEY_CSS, /\.dv-sankey\s*\{/);
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey \.dv-tooltip__label\s*\{[^}]*white-space:\s*nowrap/s,
  );
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey \.dv-tooltip__row\s*\{[^}]*align-items:\s*center/s,
  );
  assert.equal(
    existsSync(new URL('../charts/charts/sankey/styles.css', import.meta.url)),
    false,
  );
});

test('Sankey 样式：三个预览入口都不再重复引用私有 CSS', () => {
  PREVIEW_SOURCES.forEach((source) => {
    assert.doesNotMatch(source, /charts\/charts\/sankey\/styles\.css|sankey\/styles\.css/);
  });
});

test('Sankey 独立预览：只保留含亏损期间的播放序列，PC 不套移动端裁切框', () => {
  assert.doesNotMatch(SANKEY_PREVIEW_SOURCE, /基础样式|complex-scenario|LOSS_DATA/);
  assert.match(SANKEY_PREVIEW_SOURCE, /\['2025 年报',[\s\S]*'亏损'\]/);
  assert.match(
    SANKEY_PREVIEW_SOURCE,
    /data-platform="pc"[^}]+sankey-preview__complex-content[\s\S]*max-width: none/,
  );
  assert.match(
    SANKEY_PREVIEW_SOURCE,
    /data-platform="pc"[^}]+sankey-preview__complex-host[\s\S]*min-height: 424px/,
  );
  assert.match(
    SANKEY_PREVIEW_SOURCE,
    /name="complex-theme" value="ifind"/,
  );
  assert.doesNotMatch(
    SANKEY_PREVIEW_SOURCE,
    /name="complex-theme" value="ifind-(?:pc|mobile)"/,
  );
  assert.match(
    SANKEY_PREVIEW_SOURCE,
    /complexState\.theme === 'ifind' \? 'ifind-pc' : complexState\.theme/,
  );
  assert.match(
    SANKEY_PREVIEW_SOURCE,
    /const playbackTokenTheme = sankeyPlaybackRangeTheme\(tokenTheme\);[\s\S]*complexPlaybackRange\.dataset\.theme = playbackTokenTheme/,
  );
});

test('SANKEY-18：最终标题与数值分别写入每个节点的实际字号', () => {
  assert.match(SANKEY_SOURCE, /dv-sankey__node-title[\s\S]*node\.titleFontSize/);
  assert.match(SANKEY_SOURCE, /dv-sankey__node-value[\s\S]*node\.valueFontSize/);
});

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

test('SANKEY-26：时间序列共享最大值比例尺，主轴缩放后仍以画板中线居中', () => {
  const sharedScaleConfig = { ...structuredClone(CONFIG), scaleMax: 200 };
  const graph = layoutSankey(
    sharedScaleConfig,
    { width: 960, height: 480 },
    STYLE,
  );

  assert.equal(graph.scaleMax, 200);
  assert.equal(graph.scale, STYLE.geometry['primary-node-height'] / 200);
  assert.equal(graph.primary.magnitude, 100);
  assert.equal(graph.primary.height, STYLE.geometry['primary-node-height'] / 2);
  assert.equal(graph.primary.y + graph.primary.height / 2, graph.centerlineY);
  assert.equal(graph.centerlineY, graph.height / 2);

  assert.throws(
    () => layoutSankey(
      { ...structuredClone(CONFIG), scaleMax: 99 },
      { width: 960, height: 480 },
      STYLE,
    ),
    /scaleMax 不得小于当前主节点流量/,
  );
});

test('SANKEY-26：季度序列自动取最大主轴，并给所有周期注入同一比例尺', () => {
  const larger = structuredClone(CONFIG);
  larger.links.find((link) => link.source === 'source-a').value = 100;
  larger.links.find((link) => link.source === 'source-b').value = 60;
  larger.links.find((link) => link.target === 'expense').value = 120;
  larger.links.find((link) => link.target === 'retained').value = 40;

  const periods = withSharedSankeyScale([CONFIG, larger]);
  assert.equal(periods[0].scaleMax, 160);
  assert.equal(periods[1].scaleMax, 160);
  assert.equal(CONFIG.scaleMax, undefined, '不得反写调用方的周期配置');

  const smallerGraph = layoutSankey(periods[0], { width: 960, height: 480 }, STYLE);
  const largerGraph = layoutSankey(periods[1], { width: 960, height: 480 }, STYLE);
  assert.equal(smallerGraph.primary.height, 150);
  assert.equal(largerGraph.primary.height, 240);
  assert.equal(smallerGraph.scale, largerGraph.scale);
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
  const entries = [
    { text: '营业成本', maxWidth: 96, fontSize: 12 },
    { text: '营业成本及其他长期经营费用', maxWidth: 96, fontSize: 12 },
  ];
  const fitted = truncateBatch(
    entries,
    (values, sources) => values.map((value, index) => (
      Array.from(value).length * sources[index].fontSize
    )),
  );
  assert.equal(fitted[0].text, '营业成本');
  assert.match(fitted[1].text, /…$/);
  assert.ok(fitted[1].width <= 96);
  assert.match(SANKEY_SOURCE, /import \{ truncateBatch \} from '\.\.\/\.\.\/core\/label\.js'/);
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

test('SANKEY-19：桑基数值字体复用当前主题的全局数字字体 token', () => {
  assert.equal(SANKEY_SETTINGS.typography, undefined);
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey__edge-label[\s\S]*font-family: var\(--font-family-number\)/,
  );
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey__node-value[\s\S]*font-family: var\(--font-family-number\)/,
  );
  assert.equal(THEME_TOKENS.ainvest['font-family-cn'], '{font-family-en}');
  assert.equal(THEME_TOKENS.ainvest['font-family-number'], '{font-family-en}');
});

test('SANKEY-27：Ainvest 只翻译展示文案，稳定拓扑与适配输入不变', () => {
  const source = {
    nodes: [
      { id: 'revenue', name: '营业收入', role: 'income', stage: 1 },
      { id: 'gross', name: '毛利', role: 'profit', stage: 2 },
    ],
    links: [{ source: 'revenue', target: 'gross', value: -22 }],
    legendLabels: { income: '收入', expense: '支出', profit: '利润' },
    period: '2025 年报',
    shortPeriod: '25 Q4',
    statusLabel: '亏损',
  };
  const presented = financialSankeyPresentation(source, { theme: 'ainvest' });

  assert.deepEqual(presented.nodes.map(({ id, role, stage }) => ({ id, role, stage })), [
    { id: 'revenue', role: 'income', stage: 1 },
    { id: 'gross', role: 'profit', stage: 2 },
  ]);
  assert.strictEqual(presented.links, source.links);
  assert.deepEqual(presented.nodes.map(({ name }) => name), ['Revenue', 'Gross Profit']);
  assert.deepEqual(presented.legendLabels, { income: 'Income', expense: 'Expense', profit: 'Profit' });
  assert.equal(presented.period, 'FY 2025');
  assert.equal(presented.timelinePeriod, 'FY ’25');
  assert.equal(presented.shortPeriod, 'FY');
  assert.equal(presented.statusLabel, 'Loss');
  assert.strictEqual(financialSankeyPresentation(source, { theme: 'ths' }), source);
  assert.equal(sankeyPlaybackCopy({ theme: 'ainvest' }).previous, 'Previous');
});

test('SANKEY-28：Ainvest 全端复用目标播放区并隐藏自动播放按钮', () => {
  assert.equal(THEME_BEHAVIOR.ainvest['datazoom-handle'].w, 32);
  assert.equal(THEME_BEHAVIOR.ainvest['datazoom-handle'].grip.h, 10);
  assert.match(
    SANKEY_PREVIEW_SOURCE,
    /data-theme="ainvest"\] \.sankey-preview__complex-layout \{[\s\S]*--sankey-playback-height: 110px/,
  );
  assert.match(
    INDEX_SOURCE,
    /data-theme="ainvest"\] \.chart-playback-layout \{[\s\S]*--sankey-playback-height: 110px/,
  );
  assert.match(
    SANKEY_PLAYBACK_CSS,
    /data-theme='ainvest'\]\) \.sankey-playback__primary \{\s*display: none;/,
  );
  assert.match(SANKEY_PLAYBACK_CSS, /font-size: var\(--font-size-super-small\)/);
  assert.equal(THEME_TOKENS.ths['radius-playback-step'], '{radius-4}');
  assert.equal(THEME_TOKENS['ifind-pc']['radius-playback-step'], '{radius-4}');
  assert.equal(THEME_TOKENS.ainvest['radius-playback-step'], '18px');
  assert.match(SANKEY_PLAYBACK_CSS, /border-radius: var\(--radius-playback-step\)/);
  assert.match(
    SANKEY_PLAYBACK_CSS,
    /data-theme='ainvest'\]\) \.sankey-playback__timeline \{\s*overflow: visible;/,
  );
  assert.match(SANKEY_PLAYBACK_CSS, /filter: var\(--shadow-datazoom-handle\)/);
  assert.doesNotMatch(SANKEY_PLAYBACK_CSS, /box-shadow: var\(--shadow-datazoom-handle\)/);
  assert.match(SANKEY_PLAYBACK_CSS, /ainvest-period-arrow-prev\.svg/);
  assert.match(SANKEY_PLAYBACK_CSS, /ainvest-period-arrow-next\.svg/);
  assert.match(INDEX_SOURCE, /\.\/demos\/sankey-playback\.css/);
  assert.match(SANKEY_PREVIEW_SOURCE, /\.\.\/demos\/sankey-playback\.css/);
  assert.doesNotMatch(INDEX_SOURCE, /\.chart-playback__/);
  assert.equal(
    existsSync(new URL('../assets/sankey/ainvest-period-arrow-prev.svg', import.meta.url)),
    true,
  );
  assert.equal(
    existsSync(new URL('../assets/sankey/ainvest-period-arrow-next.svg', import.meta.url)),
    true,
  );
});

test('SANKEY-24/28：两个 L3 入口复用同一份播放区 DOM 与动态刻度模板', () => {
  const periods = [
    { period: '2025 一季报', timelinePeriod: '2025 一季报', shortPeriod: '一季' },
    { period: '2025 半年报', timelinePeriod: '2025 半年报', shortPeriod: '半年' },
  ];
  const copy = sankeyPlaybackCopy({ theme: 'ths' });
  const ticks = sankeyPlaybackTicksMarkup(periods, 1);
  const markup = sankeyPlaybackMarkup({
    periods,
    currentIndex: 1,
    copy,
    playIconSrc: '../assets/sankey/play.svg',
    idPrefix: 'test-playback',
  });

  assert.match(ticks, /style="left:100%"/);
  assert.match(ticks, /class="sankey-playback__tick is-current"/);
  assert.match(markup, /id="test-playback-range"/);
  assert.match(markup, /--sankey-playback-interval-count:1/);
  assert.match(markup, /2025 半年报/);
});

test('SANKEY-29：iFinD 全端播放滑块复用 THS token 作用域', () => {
  assert.equal(sankeyPlaybackRangeTheme('ifind'), 'ths');
  assert.equal(sankeyPlaybackRangeTheme('ifind-pc'), 'ths');
  assert.equal(sankeyPlaybackRangeTheme('ths'), 'ths');
  assert.equal(sankeyPlaybackRangeTheme('ainvest'), 'ainvest');
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
      colorVar: '--color-sankey-profit',
      value: '-401.36万',
    }],
  });
  assert.equal(
    sankeyNodeDashboardValueColor(node),
    'var(--color-text-tooltip-series)',
  );
  assert.equal(
    sankeyNodeDashboardValueColor({ ...node, value: 4013600 }),
    'var(--color-sankey-profit)',
  );
  assert.equal(
    sankeyNodeDashboardValueColor({ ...node, displayValue: 4013600 }),
    'var(--color-sankey-profit)',
  );
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey \.dv-tooltip__title,[\s\S]*\.dv-sankey \.dv-tooltip__marker[\s\S]*display: none/,
  );
  assert.match(
    SANKEY_CSS,
    /\.dv-sankey \.dv-tooltip__value[\s\S]*color: var\(--dv-sankey-tooltip-value-color\)[\s\S]*font-family: var\(--font-family-number\)/,
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
  const finalOccupiedGap = finalColumn[1].occupiedTop - finalColumn[0].occupiedBottom;
  const finalOccupiedSpan = finalColumn.at(-1).occupiedBottom - finalColumn[0].occupiedTop;

  assert.ok(finalGap >= STYLE.geometry['node-gap']);
  assert.ok(Math.abs(finalOccupiedGap - graph.columnGaps.at(-1)) < 1e-9);
  assert.ok(finalOccupiedSpan >= resolveSankeyColumnMinimumSpan(2, STYLE.geometry));
});

test('SANKEY-23：单图按容器自然展开，不再限制移动端最大高度', () => {
  assert.equal(resolveSankeyCanvasHeight(0, STYLE.geometry), 384);
  assert.equal(resolveSankeyCanvasHeight(328, STYLE.geometry), 288);
  assert.equal(resolveSankeyCanvasHeight(424, STYLE.geometry), 384);
  assert.equal(resolveSankeyCanvasHeight(640, STYLE.geometry), 600);
  assert.equal(resolveSankeyCanvasHeight(0, MOBILE_STYLE.geometry), 203);
  assert.equal(resolveSankeyCanvasHeight(208, MOBILE_STYLE.geometry), 168);
  assert.equal(resolveSankeyCanvasHeight(243, MOBILE_STYLE.geometry), 203);
  assert.equal(resolveSankeyCanvasHeight(640, MOBILE_STYLE.geometry), 600);

  const graph = layoutSankey(
    MULTI_STAGE_CONFIG,
    { width: 400, height: STYLE.geometry['canvas-min-height'] },
    STYLE,
  );
  assert.ok(graph.width >= graph.requiredWidth);
  assert.ok(graph.height >= graph.requiredHeight);
  assert.ok(graph.requiredWidth > 400);
});

test('SANKEY-23：图例以 40px 兜底，仅真实高度更大时扩容', () => {
  assert.equal(resolveSankeyLegendReservedHeight(32, MOBILE_STYLE.geometry), 40);
  assert.equal(resolveSankeyLegendReservedHeight(40, MOBILE_STYLE.geometry), 40);
  assert.equal(resolveSankeyLegendReservedHeight(48, MOBILE_STYLE.geometry), 48);
  assert.equal(resolveSankeyLegendReservedHeight(0, MOBILE_STYLE.geometry), 40);
  assert.equal(resolveSankeyCanvasHeight(280, MOBILE_STYLE.geometry, 48), 232);
});

test('SANKEY-23：播放序列统一采用最大所需高度并向上对齐 4px 网格', () => {
  const compact = structuredClone(CONFIG);
  const dense = structuredClone(MULTI_STAGE_CONFIG);
  const periods = withSharedSankeyScale([compact, dense]);
  const viewport = resolveSankeySequenceViewport(periods, 'mobile');
  const required = Math.max(...periods.map((period) => layoutSankey(
    period,
    {
      width: 1,
      height: MOBILE_STYLE.geometry['canvas-min-height'],
      labelSlotWidth: MOBILE_STYLE.geometry['label-title-width'],
    },
    MOBILE_STYLE,
  ).requiredHeight));

  assert.equal(viewport.requiredCanvasHeight, required);
  if (required > MOBILE_STYLE.geometry['canvas-recommended-height']) {
    assert.equal(viewport.canvasHeight % MOBILE_STYLE.geometry['sequence-height-step'], 0);
  } else {
    assert.equal(viewport.canvasHeight, MOBILE_STYLE.geometry['canvas-recommended-height']);
  }
  assert.ok(viewport.canvasHeight >= required);
  assert.equal(
    viewport.totalHeight,
    viewport.canvasHeight + MOBILE_STYLE.geometry['legend-reserved-height'],
  );
});

test('SANKEY-24：同拓扑季度数据平滑插值且中间帧保持守恒', () => {
  const next = structuredClone(CONFIG);
  next.links.find((link) => link.source === 'source-a').value = 80;
  next.links.find((link) => link.source === 'source-b').value = 40;
  next.links.find((link) => link.target === 'expense').value = 90;
  next.links.find((link) => link.target === 'retained').value = 30;

  assert.equal(hasSameSankeyTopology(CONFIG, next), true);
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);

  const middle = interpolateSankeyConfig(CONFIG, next, 0.5);
  assert.equal(middle.links.find((link) => link.source === 'source-a').value, 70);
  assert.equal(middle.links.find((link) => link.target === 'expense').value, 80);
  assert.doesNotThrow(() => assertSankeyConfig(middle));
  assert.equal(SANKEY_SETTINGS.motion['playback-label-lead-duration'], 120);
  assert.equal(SANKEY_SETTINGS.motion['playback-duration'], 720);
  assert.equal(SANKEY_SETTINGS.motion['playback-easing'], 'cubic-out');
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

test('SANKEY-24/25：negativeSource 属于播放拓扑且在插值期间保持稳定', () => {
  const from = structuredClone(LOSS_CONFIG);
  const to = structuredClone(LOSS_CONFIG);
  const difference = to.links.find((link) => link.target === 'gross');
  difference.value = Math.abs(difference.value);

  assert.equal(hasSameSankeyTopology(from, to), true);
  assert.equal(
    interpolateSankeyConfig(from, to, 0.5)
      .links.find((link) => link.target === 'gross').negativeSource,
    'cost',
  );

  delete difference.negativeSource;
  assert.equal(hasSameSankeyTopology(from, to), false);
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
  assert.deepEqual({
    income: THEME_TOKENS.ths['color-sankey-income'],
    expense: THEME_TOKENS.ths['color-sankey-expense'],
    profit: THEME_TOKENS.ths['color-sankey-profit'],
  }, {
    income: '#FF9500', expense: '#3366FF', profit: '{color-price-up}',
  });
  assert.deepEqual({
    income: THEME_TOKENS.ainvest['color-sankey-income'],
    expense: THEME_TOKENS.ainvest['color-sankey-expense'],
    profit: THEME_TOKENS.ainvest['color-sankey-profit'],
  }, {
    income: '#265FFC', expense: '{color-price-down}', profit: '{color-price-up}',
  });
});

test('SANKEY-11：iFinD-PC 声明完整三色', () => {
  assert.deepEqual({
    income: THEME_TOKENS['ifind-pc']['color-sankey-income'],
    expense: THEME_TOKENS['ifind-pc']['color-sankey-expense'],
    profit: THEME_TOKENS['ifind-pc']['color-sankey-profit'],
  }, {
    income: '#3366FF', expense: '#07AB4B', profit: '#FF2436',
  });
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
  assert.equal(lossLink.route, 'left-return');
  assert.match(lossLink.path, new RegExp(`^M${byId.get('cost').x},`));
  assert.ok(lossLink.routeX < byId.get('cost').x);
  assert.equal(graph.primary, revenue);
  assert.ok(Math.abs(cost.height / revenue.height - cost.value / revenue.value) < 1e-12);
  assert.ok(Math.abs(cost.height - revenue.height - lossLink.thickness) < 1e-12);
  assert.equal(costLink.sourceThickness, revenue.height);
  assert.equal(costLink.targetThickness, revenue.height);
  assert.equal(costLink.targetY, cost.y);
  assert.equal(costLink.pairedSourceValue, revenue.value);
  assert.equal(gross.height, lossLink.targetThickness);
  assert.equal(lossLink.isConstantWidthReturn, true);
  assert.equal(lossLink.returnThickness, lossLink.sourceThickness);
  assert.equal(lossLink.sourceY, cost.y + revenue.height);
  assert.equal(lossLink.color, gross.color);
  assert.ok(lossLink.returnOuterX < lossLink.returnInnerX);
  assert.ok(lossLink.returnInnerX < cost.x);
  assert.ok(
    Math.abs(
      lossLink.returnInnerX - lossLink.returnOuterX - lossLink.returnThickness,
    ) < 1e-12,
  );
  assert.match(lossLink.path, / Z$/);
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

test('SANKEY-25：同源负差额遵循 P = B + D，样图数值形成等宽超额段', () => {
  const sample = structuredClone(LOSS_CONFIG);
  sample.links.find((link) => link.target === 'cost').value = 196.89;
  sample.links.find((link) => link.target === 'gross').value = -67.71;
  sample.links.find((link) => link.source === 'gross' && link.target === 'expense').value = 34.56;
  sample.links.find((link) => link.source === 'gross' && link.target === 'operating').value = -102.27;
  sample.links.find((link) => link.source === 'other').value = -2.23;
  sample.links.find((link) => link.source === 'operating').value = -104.5;

  const graph = layoutSankey(sample, { width: 960, height: 480 }, STYLE);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const baseLink = graph.links.find((link) => link.target.id === 'cost');
  const differenceLink = graph.links.find((link) => link.target.id === 'gross');
  const revenue = byId.get('revenue');
  const cost = byId.get('cost');
  const gross = byId.get('gross');

  assert.ok(Math.abs(revenue.value - 129.18) < 1e-12);
  assert.ok(Math.abs(cost.value - 196.89) < 1e-12);
  assert.ok(Math.abs(gross.value - -67.71) < 1e-12);
  assert.ok(Math.abs(baseLink.pairedSourceValue - revenue.value) < 1e-12);
  assert.ok(Math.abs(baseLink.sourceThickness - revenue.height) < 1e-12);
  assert.ok(Math.abs(baseLink.targetThickness - revenue.height) < 1e-12);
  assert.ok(Math.abs(baseLink.targetY - cost.y) < 1e-12);
  assert.ok(Math.abs(cost.height - revenue.height - gross.height) < 1e-12);
  assert.ok(Math.abs(differenceLink.sourceThickness - gross.height) < 1e-12);
  assert.ok(Math.abs(differenceLink.returnThickness - gross.height) < 1e-12);
});

test('SANKEY-25：上一层负值不足时，由同层正值分支补足下一层亏损', () => {
  const sample = structuredClone(LOSS_CONFIG);
  sample.links.find((link) => link.target === 'cost').value = 295;
  sample.links.find((link) => link.target === 'gross').value = -22;
  sample.links.find((link) => link.source === 'gross' && link.target === 'expense').value = 32;
  sample.links.find((link) => link.source === 'gross' && link.target === 'operating').value = -54;
  sample.links.find((link) => link.source === 'other').value = -3;
  sample.links.find((link) => link.source === 'operating').value = -57;

  const graph = layoutSankey(sample, { width: 960, height: 480 }, STYLE);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const expenseLink = graph.links.find(
    (link) => link.source.id === 'gross' && link.target.id === 'expense',
  );
  const costLink = graph.links.find(
    (link) => link.source.id === 'revenue' && link.target.id === 'cost',
  );
  const grossDifference = graph.links.find(
    (link) => link.source.id === 'revenue' && link.target.id === 'gross',
  );
  const operatingDifference = graph.links.find(
    (link) => link.source.id === 'gross' && link.target.id === 'operating',
  );
  const operating = byId.get('operating');
  const visualIncomingHeight = operating.visualIncoming.reduce(
    (sum, link) => sum + link.targetThickness,
    0,
  );

  assert.equal(byId.get('revenue').value, 273);
  assert.equal(byId.get('cost').value, 295);
  assert.equal(byId.get('gross').value, -22);
  assert.equal(byId.get('expense').value, 32);
  assert.equal(operating.value, -57);
  assert.equal(operatingDifference.value, -54);
  assert.equal(operatingDifference.pairedSourceValue, -22);
  assert.equal(operatingDifference.negativeDifferenceMode, 'deficit-merge');
  assert.equal(operatingDifference.visualSource.id, 'gross');
  assert.equal(operatingDifference.visualTarget.id, 'operating');
  assert.equal(operatingDifference.sourceThickness, byId.get('gross').height);
  assert.equal(operatingDifference.targetThickness, byId.get('gross').height);
  assert.notEqual(operatingDifference.route, 'left-return');
  assert.equal(costLink.sourceThickness, byId.get('revenue').height);
  assert.equal(costLink.targetThickness, byId.get('revenue').height);
  assert.equal(costLink.targetY, byId.get('cost').y);
  assert.ok(
    Math.abs(
      byId.get('cost').height
        - byId.get('revenue').height
        - byId.get('gross').height,
    ) < 1e-12,
  );
  assert.equal(grossDifference.visualSource.id, 'cost');
  assert.equal(grossDifference.visualTarget.id, 'gross');
  assert.equal(grossDifference.route, 'left-return');
  assert.equal(grossDifference.isConstantWidthReturn, true);
  assert.equal(grossDifference.returnThickness, grossDifference.sourceThickness);
  assert.equal(grossDifference.color, byId.get('gross').color);
  assert.ok(grossDifference.returnOuterX < grossDifference.returnInnerX);
  assert.ok(
    Math.abs(
      grossDifference.returnInnerX
        - grossDifference.returnOuterX
        - grossDifference.returnThickness,
    ) < 1e-12,
  );
  assert.ok(grossDifference.routeX < byId.get('cost').x);
  assert.match(
    grossDifference.path,
    new RegExp(`^M${byId.get('cost').x},`),
  );
  assert.equal(expenseLink.source.id, 'gross', '逻辑守恒关系不改写');
  assert.equal(expenseLink.target.id, 'expense', '逻辑守恒关系不改写');
  assert.equal(expenseLink.visualSource.id, 'expense');
  assert.equal(expenseLink.visualTarget.id, 'operating');
  assert.equal(expenseLink.sourceThickness, byId.get('expense').height);
  assert.equal(expenseLink.targetThickness, byId.get('expense').height);
  assert.equal(expenseLink.color, operating.color);
  assert.equal(expenseLink.isDeficitContribution, true);
  assert.equal(expenseLink.route, 'left-return');
  assert.equal(expenseLink.isConstantWidthReturn, true);
  assert.equal(expenseLink.returnThickness, expenseLink.sourceThickness);
  assert.ok(expenseLink.returnOuterX < expenseLink.returnInnerX);
  assert.ok(
    Math.abs(
      expenseLink.returnInnerX
        - expenseLink.returnOuterX
        - expenseLink.returnThickness,
    ) < 1e-12,
  );
  assert.ok(expenseLink.routeX < byId.get('expense').x);
  assert.ok(Math.abs(visualIncomingHeight - operating.height) < 1e-12);
  assert.match(
    operatingDifference.path,
    new RegExp(`^M${byId.get('gross').x + byId.get('gross').width},`),
  );
  assert.match(
    expenseLink.path,
    new RegExp(`^M${byId.get('expense').x},`),
  );
});

test('SANKEY-25：净利润与归母净利润继续逐层执行 P = B + D', () => {
  const graph = layoutSankey({
    nodes: [
      { id: 'total', name: '利润总额', role: 'profit', stage: 0 },
      { id: 'tax', name: '所得税费用', role: 'expense', stage: 1, order: 1 },
      { id: 'net', name: '净利润', role: 'profit', stage: 1, order: 0 },
      { id: 'minority', name: '少数股东权益', role: 'expense', stage: 2, order: 1 },
      { id: 'parent', name: '归母净利润', role: 'profit', stage: 2, order: 0 },
    ],
    links: [
      { source: 'total', target: 'tax', value: 1.7 },
      {
        source: 'total', target: 'net', value: -57.7,
        negativeSource: 'tax',
      },
      { source: 'net', target: 'minority', value: 2 },
      {
        source: 'net', target: 'parent', value: -59.7,
        negativeSource: 'minority',
      },
    ],
  }, { width: 960, height: 480 }, STYLE);
  const visualValues = resolveSankeyVisualLinkValues(graph);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const netLink = graph.links.find((link) => link.target.id === 'net');
  const parentLink = graph.links.find((link) => link.target.id === 'parent');
  const taxContribution = graph.links.find((link) => link.target.id === 'tax');
  const minorityContribution = graph.links.find((link) => link.target.id === 'minority');

  assert.ok(Math.abs(byId.get('total').value - -56) < 1e-12);
  assert.ok(Math.abs(byId.get('net').value - -57.7) < 1e-12);
  assert.ok(Math.abs(byId.get('parent').value - -59.7) < 1e-12);
  assert.equal(byId.get('net').magnitude, 57.7);
  assert.equal(netLink.negativeDifferenceMode, 'deficit-merge');
  assert.equal(parentLink.negativeDifferenceMode, 'deficit-merge');
  assert.equal(taxContribution.visualSource.id, 'tax');
  assert.equal(taxContribution.visualTarget.id, 'net');
  assert.equal(minorityContribution.visualSource.id, 'minority');
  assert.equal(minorityContribution.visualTarget.id, 'parent');
  assert.equal(visualValues.get(netLink.index), -56);
  assert.equal(visualValues.get(taxContribution.index), -1.7);
  assert.equal(visualValues.get(parentLink.index), -57.7);
  assert.equal(visualValues.get(minorityContribution.index), -2);
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
  assert.notEqual(profitLink.route, 'left-return');
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
  assert.equal(operating.magnitude, Math.abs(operating.value));
  assert.equal(gross.height, Math.abs(gross.value) * graph.scale);
  assert.ok(Math.abs(
    operating.visualIncoming.reduce((sum, link) => sum + link.targetThickness, 0)
      - operating.height,
  ) < 1e-12);
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
      const occupiedGap = node.occupiedTop - previous.occupiedBottom;
      assert.ok(occupiedGap + 1e-9 >= graph.nodeGap);
      assert.ok(Math.abs(occupiedGap - graph.columnGaps.at(-1)) < 1e-9);
    });
});

test('SANKEY-22：同列按节点与两行文字联合占位盒保持最小上下间距', () => {
  const graph = layoutSankey(LOSS_CONFIG, { width: 960, height: 288 }, STYLE);

  graph.columns.forEach((column, columnIndex) => {
    column.slice(1).forEach((node, index) => {
      const previous = column[index];
      const occupiedGap = node.occupiedTop - previous.occupiedBottom;
      assert.ok(
        occupiedGap + 1e-9 >= graph.nodeGap,
        `第 ${columnIndex + 1} 列的文字联合占位间距不足`,
      );
    });
  });
});
