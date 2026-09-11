/*
 * L3 · 示例数据源（唯一权威）。
 *
 * 各预览面共享本模块，各自只负责「怎么展示」：
 *   index.html                     对外站点：画廊 + 详情页、单主题切换
 *   playground/preview.html        开发验收：三主题横向并排、旋钮更全
 *   playground/radar-preview.html  雷达专用对照面：六个典型配置 × 三主题十八张图同屏
 * 示例定义与数据生成函数只有这一份——加示例改一处，各面同时生效，不会漂移。
 *
 * 本模块**只装数据**：不 import d3、不 import 图表组件、不碰 DOM
 * （组件在 registry.js 里映射，见 WORKFLOW 铁律6：L3 永不直接 import d3）。
 *
 * ── 加一个新示例 ────────────────────────────────────────────────
 * 往 EXAMPLES 里加一项即可。必填 id / group / chart / title / spec / description / cfg；
 * surfaces 决定它出现在哪个面（缺省两面都进）。
 * **不要再加「验收要点」这类长说明**：验收口径的家是 specs/*.md 的「活 demo」小节（WORKFLOW §一
 * 「规范只有一个家」）。这里曾有过一个 notes 字段，最终长成了 specs/pie.md 的副本——
 * 复述必然漂移，故整个字段已移除，description 保持一句话。
 *
 * ── 加一种新图表（饼 / 环 / 横向条形 / K 线…）──────────────────
 *   1. 在 registry.js 的 CHARTS 里登记「类型键 → L2 组件」（一行）
 *   2. 在 CHART_CAPABILITIES 里声明该类型支持哪些语义旋钮（决定两面各自显示哪几个开关）
 *   3. 往 EXAMPLES 里加示例，chart 写成新类型键
 * 预览面都不用改——它们按 chart 字段查表挂载、按能力声明画旋钮。
 *
 * ⚠️ 唯一破例的是桑基：SANKEY-23 要求 812px 横版财报外框与序列统一高度，三主题卡片网格表达不了，
 * 故另有 playground/sankey-preview.html 独立面，**自带节点与季度输入、不 import 本模块**
 * （全库唯一脱离单一示例源的展示面，改桑基示例仍要两处同步）；关键 P = B + D 公式复用
 * demos/sankey-financial.js，两个预览面里另有专属样式与旋钮接线。
 * 没有同类固定外框硬需求的新图型，照上面三步走即可，不要照抄桑基。
 */

import { ainvestCompanyIdentity } from './company-icons.js';
import {
  resolveSankeySequenceViewport,
  withSharedSankeyScale,
} from '../charts/charts/sankey/model.js';
import { buildFinancialDifferencePair } from './sankey-financial.js';
import { financialSankeyPresentation } from './sankey-presentation.js';
import { chartContentPresentation } from './chart-presentation.js';

/* ── 数据生成（示例专用假数据；固定公式、无随机数与当前时间，保证截图可复现）── */

const K = (values) => values.map((v) => (v == null ? null : v * 1000));

export const seq = (n) => Array.from({ length: n }, (_, i) => `${i + 1}`);

/* 基础波形：相位 p 让多系列彼此错开 */
export const wave = (n, p = 0) => K(Array.from(
  { length: n },
  (_, i) => Math.round(560 + 360 * Math.sin(i * 0.6 + p) + 140 * Math.cos(i * 1.7 + p)),
));

/* 含负值 / 0 / null 的单系列（正负值柱专用：负值向下、0 值 1px 占位、null 断口全可见） */
export const signedWave = (n) => {
  const d = wave(n, 0.8).map((v) => v - 500000);
  if (n > 1) d[1] = -Math.abs(d[1]);
  if (n > 2) d[2] = 0;
  if (n > 4) d[4] = null;
  return d;
};

/* 多系列正值波形：按序相移。
   ⚠️ **相位不能一路按 index × 0.9 递增**：第 8 条落到 6.3，与 2π（6.283）只差 0.017，
   于是与第 1 条几乎同轨——实测 Δmax 仅为量程的 0.72%。更糟的是 7 色板（COLOR-02）
   恰好也在第 8 条循环回第 1 色，**同色又同高**，看起来像图表把同一条画了两遍。
   故第 7 条起插半档相位回到区间前段：12 条全部落在 [0, 4.95]、互不重合，也不越过 2π。
   前 6 条相位与本规则落地前逐字一致，故既有示例与三档预设的数据一个数都没变。
   它只保证**轨迹不重复**，不干预折线自然交叉。 */
const seriesPhase = (index) => (index < 6 ? index * 0.9 : (index - 6) * 0.9 + 0.45);
export const posSeries = (n, names) => names.map((name, k) => ({ name, data: wave(n, seriesPhase(k)) }));

const FINANCIAL_SERIES_NAMES = [
  '营业收入', '成本', '利润', '税费', '研发投入', '现金流',
  '销售费用', '管理费用', '财务费用', '投资收益', '营业外收入', '所得税',
];

const MARKET_INDEX_SERIES_NAMES = [
  '沪深300', '中证500', '创业板指', '上证50', '科创50', '中证1000',
  '中证红利', '国证2000', '北证50', '恒生指数', '恒生科技', '纳斯达克',
];

/* index 详情页的系列数量滑块会把第二个参数传进示例 cfg。这里仅负责从假数据池取数，
   不是图表能力；preserveLast 用于始终保留组合图折线 / 正负堆叠负值项。 */
const selectExampleSeries = (series, requested, fallback, preserveLast = false) => {
  const parsed = Math.round(Number(requested));
  const count = Math.max(1, Math.min(series.length, Number.isFinite(parsed) ? parsed : fallback));
  return preserveLast && count < series.length
    ? [...series.slice(0, count - 1), series.at(-1)]
    : series.slice(0, count);
};

/* 负值系列（堆叠含负值用） */
export const negWave = (n) => wave(n, 2).map((v) => -Math.round(v * 0.4));

/* 基础折线：保持正值，中途一个 null 断口 */
export const lineWave = (n) => {
  const d = wave(n, 0.4);
  d[Math.floor(n / 3)] = null;
  return d;
};

/* 正负值折线：默认首屏即跨零；数据量增加后补一个 null 断口 */
export const signedLineWave = (n) => {
  const d = wave(n, 0.4).map((v) => v - 500000);
  if (n > 1) d[1] = -Math.abs(d[1]);
  if (n > 2) d[2] = 0;
  if (n > 4) d[4] = null;
  return d;
};

/* 副轴增速（%）：小数量级、与柱不同量纲 */
export const growth = (n) => Array.from({ length: n }, (_, i) => Math.round(12 + 9 * Math.sin(i * 0.5)));

/* ── 雷达图（specs/radar.md）────────────────────────────────────
   维度名取自基线文档 7.2 的财务指标示例；英文一套对齐 AInvest Figma 实例。
   **密度旋钮在本族 = 维度数**，三档 3 / 5 / 6 正好压住基线 1.2 的两端建议
   （「并列维度应大于 2」「建议小于 6」）。3 轴档是轴标签八向定位最容易崩的一档。 */
const RADAR_DIM_CN = ['盈利能力', '资产质量', '偿债能力', '现金流', '运营能力', '成长性'];
const RADAR_DIM_EN = ['Performance', 'Safety', 'Momentum', 'Funds flow', 'Basics', 'Sentiment'];

export const radarDims = (n, lang = 'cn') => (lang === 'en' ? RADAR_DIM_EN : RADAR_DIM_CN).slice(0, n);

/* [RADAR-04] 固定量程：评分类雷达的常态。不固定的话 niceSplit 会把 0–5 抬成 0–5.4，
   且两张图数据不同时量程不同、形状不可比——而横向对比正是雷达图存在的理由。 */
const RADAR_FIXED_MAX = 5;

/* [RADAR-03] 网格环数。配 0–5 量程恰好每环 1 分，刻度读数与环一一对应。 */
const RADAR_SEGMENTS = 5;

/* [RADAR-15] 分段雷达的两套设计档位。数组长度既是底部说明项数，也会成为雷达内部
   色带 / 环线数量；两者必须同源，禁止预览面各自拼一份。 */
export const RADAR_RATING_BAND_LABELS = Object.freeze({
  5: Object.freeze(['-2%', '-1%', '0%', '+1%', '>+2%']),
  6: Object.freeze(['>-3%', '-2%', '-1%', '+1%', '+2%', '>+2%']),
});

/* 各系列在 6 个维度上的得分（固定表、无随机数与当前时间，保证截图可复现）。
   [RADAR-17] 全部维度已归到同一把 0–5 标尺，故面积可读、可横向比。 */
const RADAR_SCORES = {
  cn: [
    { name: '本期得分', data: [3.5, 4.8, 2.2, 2.0, 1.2, 2.6] },
    { name: '去年同期', data: [2.8, 3.9, 2.9, 3.1, 2.4, 1.8] },
    { name: '行业均值', data: [3.1, 3.3, 3.4, 2.7, 3.0, 2.9] },
    { name: '同类公司', data: [4.0, 3.1, 2.6, 3.8, 1.8, 3.5] },
    { name: '目标水平', data: [4.4, 4.2, 3.8, 4.0, 3.6, 4.1] },
    { name: '三年均值', data: [3.2, 3.7, 3.0, 2.8, 2.6, 3.1] },
    { name: '五年均值', data: [3.0, 3.5, 3.2, 2.6, 2.8, 2.9] },
    { name: '行业上游', data: [3.8, 3.6, 2.9, 3.3, 2.5, 3.7] },
    { name: '行业下游', data: [2.9, 3.2, 3.6, 3.0, 3.3, 2.7] },
    { name: '市场基准', data: [3.4, 3.4, 3.4, 3.4, 3.4, 3.4] },
  ],
  en: [
    { name: 'SPY', data: [1.9, 2.9, 3.0, 3.4, 1.6, 2.5] },
    { name: 'QQQ', data: [2.4, 2.6, 3.6, 2.7, 2.1, 3.2] },
    { name: 'DIA', data: [2.2, 2.8, 2.4, 3.9, 1.9, 2.0] },
  ],
};

export const radarSeries = (n, lang = 'cn') =>
  RADAR_SCORES[lang].map((s) => ({ name: s.name, data: s.data.slice(0, n) }));

/* 六条雷达示例共用同一套维度数档位与文案——档位是本族语义（轴数），不是各示例各自的口径 */
const RADAR_DENSITY = {
  densityValues: { few: 3, mid: 5, many: 6 },
  /* 连续档的上下限是**技术下限**不是建议：低于 3 维 RadarChart 抛错（RADAR-01
     「少于此构不成面积」），高于 6 维时维度名与每条 series 也只有 6 个值，
     再拉只会静默截断、看着像滑杆坏了。 */
  densityRange: { min: 3, max: 6 },
  densityUnit: '个维度',
  densityControl: {
    hint: '基线建议并列维度大于 2、小于 6',
    default: 'mid',
    labels: { few: '3 轴', mid: '5 轴', many: '6 轴' },
  },
};

/* 饼 / 环扇区名：8 个业务名循环，超出加序号后缀（多扇区时压图例换行与色板循环） */
const SLICE_NAMES = ['主营业务', '投资收益', '其他业务', '政府补助', '资产处置', '公允价值变动', '汇兑损益', '营业外收入'];

/* 饼 / 环扇区：递减占比的正值序列（固定公式、无随机数，保证截图可复现）。
   0 与 null 的位置对齐 signedWave 的先例——[PIE-01] 两者都**不占角也不进分母**，
   故 n=4 时可见 3 个扇区、n=16 时可见 14 个。 */
export const sliceItems = (n) => {
  const values = Array.from({ length: n }, (_, i) => Math.round(1200 / (i + 1.6) + 120));
  if (n > 2) values[2] = 0;
  if (n > 4) values[4] = null;
  return values.map((value, i) => ({
    name: i < SLICE_NAMES.length
      ? SLICE_NAMES[i]
      : `${SLICE_NAMES[i % SLICE_NAMES.length]}${Math.floor(i / SLICE_NAMES.length) + 1}`,
    value,
  }));
};

/* ── 边界与极端情况的数据（playground 专用）────────────────────
   这些不是「好看的示例」，是**把规则推到边界上**的夹具：长名称压截断、极端占比压窄扇区、
   单项压单系列取色、全空压不抛错。放 demos 而不是各写各的一次性页面，理由同 WORKFLOW §三——
   各预览面共享同一份数据源，验收用例也就只有一份。 */

/* 真实业务里会出现的超长财务科目名（不是「aaaa…」这种假串——假串量出来的宽度不真实） */
const LONG_NAMES = [
  '归属于母公司所有者的净利润扣除非经常性损益后',
  '经营活动产生的现金流量净额',
  '可供出售金融资产公允价值变动损益',
  '以摊余成本计量的金融资产终止确认收益',
  '对联营企业和合营企业的投资收益',
  '递延所得税资产',
  '短名',
];

/* 超长名称 + 大数值：压 PIE-16 名称截断、LEGEND-13 图例截断，以及「数值段恒完整」 */
export const longNameItems = (n) => Array.from({ length: n }, (_, i) => ({
  name: `${LONG_NAMES[i % LONG_NAMES.length]}${i >= LONG_NAMES.length ? Math.floor(i / LONG_NAMES.length) + 1 : ''}`,
  value: Math.round(987654321 / (i + 1.3)),
}));

/* 极端占比：首项独占约 98%，其余是几乎看不见的窄扇区 */
export const skewItems = (n) => Array.from({ length: n }, (_, i) => ({
  name: i === 0 ? '主营业务' : `${SLICE_NAMES[i % SLICE_NAMES.length]}${i}`,
  value: i === 0 ? 98000 : Math.max(1, Math.round(60 / i)),
}));

/* 当前演示八期保持同一拓扑；有符号流量保持会计守恒，负值只表达贡献方向。 */
const yi = (value) => value * 1e8;
const sankeyNode = (id, name, role, stage, order = 0) => ({
  id,
  name,
  role,
  stage,
  order,
});
const FINANCIAL_SANKEY_NODES = [
  sankeyNode('domestic', '国内政企业务', 'income', 0, 0),
  sankeyNode('other-business', '其他业务', 'income', 0, 1),
  sankeyNode('international', '国际业务', 'income', 0, 2),
  sankeyNode('revenue', '营业收入', 'income', 1),
  sankeyNode('cost', '营业成本', 'expense', 2, 0),
  sankeyNode('gross', '毛利', 'profit', 2, 1),
  sankeyNode('other-operating', '其他经营收益', 'income', 2, 2),
  sankeyNode('operating-expense', '费用及营业税', 'expense', 3, 0),
  sankeyNode('operating-profit', '营业利润', 'profit', 3, 1),
  sankeyNode('non-operating', '营业外净收入', 'income', 3, 2),
  sankeyNode('total-profit', '利润总额', 'profit', 4),
  sankeyNode('net-profit', '净利润', 'profit', 5, 0),
  sankeyNode('income-tax', '所得税费用', 'expense', 5, 1),
  sankeyNode('parent-profit', '归母净利润', 'profit', 6, 0),
  sankeyNode('minority-interest', '少数股东权益', 'expense', 6, 1),
];

export const makeFinancialSankeyQuarter = ({
  period,
  shortPeriod,
  sources,
  cost,
  operatingExpense,
  otherOperating,
  nonOperating,
  incomeTax,
  minorityInterest,
  statusLabel = '盈利',
}) => {
  const [domestic, otherBusiness, international] = sources.map(yi);
  const revenue = domestic + otherBusiness + international;
  const costValue = yi(cost);
  const grossPair = buildFinancialDifferencePair({
    parent: 'revenue',
    base: 'cost',
    difference: 'gross',
    parentValue: revenue,
    baseValue: costValue,
  });
  const gross = grossPair.differenceValue;
  const operatingExpenseValue = yi(operatingExpense);
  const operatingPair = buildFinancialDifferencePair({
    parent: 'gross',
    base: 'operating-expense',
    difference: 'operating-profit',
    parentValue: gross,
    baseValue: operatingExpenseValue,
  });
  const grossToOperating = operatingPair.differenceValue;
  const otherOperatingValue = yi(otherOperating);
  const operatingProfit = grossToOperating + otherOperatingValue;
  const nonOperatingValue = yi(nonOperating);
  const totalProfit = operatingProfit + nonOperatingValue;
  const incomeTaxValue = yi(incomeTax);
  const netProfitPair = buildFinancialDifferencePair({
    parent: 'total-profit',
    base: 'income-tax',
    difference: 'net-profit',
    parentValue: totalProfit,
    baseValue: incomeTaxValue,
  });
  const netProfit = netProfitPair.differenceValue;
  const minorityInterestValue = yi(minorityInterest);
  const parentProfitPair = buildFinancialDifferencePair({
    parent: 'net-profit',
    base: 'minority-interest',
    difference: 'parent-profit',
    parentValue: netProfit,
    baseValue: minorityInterestValue,
  });

  return {
    nodes: FINANCIAL_SANKEY_NODES.map((node) => ({ ...node })),
    links: [
      { source: 'domestic', target: 'revenue', value: domestic },
      { source: 'other-business', target: 'revenue', value: otherBusiness },
      { source: 'international', target: 'revenue', value: international },
      grossPair.baseLink,
      grossPair.differenceLink,
      operatingPair.baseLink,
      operatingPair.differenceLink,
      { source: 'other-operating', target: 'operating-profit', value: otherOperatingValue },
      { source: 'operating-profit', target: 'total-profit', value: operatingProfit },
      { source: 'non-operating', target: 'total-profit', value: nonOperatingValue },
      netProfitPair.differenceLink,
      netProfitPair.baseLink,
      parentProfitPair.differenceLink,
      parentProfitPair.baseLink,
    ],
    legendLabels: { income: '收入', expense: '支出', profit: '利润' },
    period,
    shortPeriod,
    statusLabel,
    showEdgeLabels: false,
  };
};

const FINANCIAL_SANKEY_PERIOD_INPUTS = [
  ['2025 一季报', '25 Q1', [148, 55, 12], 188, 18, -0.8, 0.3, 0.8, 1.1],
  ['2025 半年报', '25 Q2', [162, 61, 14], 205, 20, -0.4, 0.5, 1.2, 1.4],
  ['2025 三季报', '25 Q3', [176, 67, 15], 222, 22, 0.2, 0.4, 1.5, 1.8],
  ['2025 年报', '25 Q4', [186, 71, 16], 295, 32, -3, 1, 1.7, 2, '亏损'],
  ['2026 一季报', '26 Q1', [190.71, 72.68, 16.46], 243.8, 24.4, -1.11, 0.015083, 0.945083, 1.73],
  ['2026 半年报', '26 Q2', [205, 78, 18], 260, 26, -0.4, 0.6, 1.4, 2.1],
  ['2026 三季报', '26 Q3', [218, 84, 20], 276, 28, 0.6, 0.9, 1.9, 2.5],
  ['2026 年报', '26 Q4', [236, 92, 22], 298, 31, 1.2, 1.1, 2.3, 3],
];

export const financialSankeyPeriods = () => {
  const periods = FINANCIAL_SANKEY_PERIOD_INPUTS.map(([
    period,
    shortPeriod,
    sources,
    cost,
    operatingExpense,
    otherOperating,
    nonOperating,
    incomeTax,
    minorityInterest,
    statusLabel,
  ]) => makeFinancialSankeyQuarter({
    period,
    shortPeriod,
    sources,
    cost,
    operatingExpense,
    otherOperating,
    nonOperating,
    incomeTax,
    minorityInterest,
    statusLabel,
  }));
  return withSharedSankeyScale(periods);
};

export const financialSankey = () => financialSankeyPeriods()[0];

const financialSankeyPlayback = () => {
  const periods = financialSankeyPeriods();
  return {
    periods,
    viewport: Object.fromEntries(['pc', 'mobile'].map((platform) => [
      platform,
      resolveSankeySequenceViewport(periods, platform),
    ])),
  };
};

/* AInvest 演示数据在 L3 适配为 Treemap 的通用 presentation 合同；charts/ 不认识这些业务字段。 */
const AINVEST_TICKERS = [
  'AAPL', 'WSM', 'DOLE', 'YSG', 'VKTX', 'YMM', 'CSCO', 'MAR', 'TEAM', 'ADMA', 'BTSG', 'GLTO',
  'GSAT', 'MSFT', 'NVDA', 'GOOG', 'AMZN', 'META', 'AVGO', 'ORCL', 'CRM', 'AMD', 'INTC',
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA', 'AXP', 'JNJ', 'LLY', 'PFE', 'MRK',
  'UNH', 'ABBV', 'TMO', 'COST', 'WMT', 'HD', 'NKE', 'MCD', 'KO', 'PEP', 'XOM', 'CVX',
  'CAT', 'GE', 'BA', 'UPS', 'NEE', 'PLD',
];
/* 语义值固定序列保证截图可复现；具体字段名和格式化都留在示例数据层。 */
const TREEMAP_SEMANTIC_VALUES = [
  5.55, 2.55, -0.21, -2.21, 0.83, -1.25, 3.42, -3.25, 0, 1.17, -0.86, 4.68,
  -4.12, 0.16, 2.03, -1.07, 0.62, -0.41,
];
/* AInvest Figma「涨跌色-3梯度」示例：±1 / ±2 为两处分档边界；属于业务配置，不是视觉 token。 */
const TREEMAP_SEMANTIC_THRESHOLDS = [1, 2];
const formatPercent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

const ainvestPresentation = (index) => {
  const ticker = AINVEST_TICKERS[index % AINVEST_TICKERS.length];
  const price = 38.5 + ((index * 37.11) % 410);
  const cap = index < 18 ? `${(3.48 - index * 0.13).toFixed(2)}T` : `${Math.round(860 - index * 9.4)}B`;
  const colorValue = TREEMAP_SEMANTIC_VALUES[index % TREEMAP_SEMANTIC_VALUES.length];
  const { image, imageFallback } = ainvestCompanyIdentity(ticker);
  return {
    label: ticker,
    value: formatPercent(colorValue),
    image,
    imageFallback,
    colorValue,
    details: [
      { key: 'price', label: 'Price', value: price.toFixed(2) },
      { key: 'market-cap', label: 'Market Cap', value: cap },
      { key: 'change', label: 'Change D,%', value: formatPercent(colorValue) },
    ],
  };
};
const treemapPresentation = (index) => ({ presentation: ainvestPresentation(index) });
const decorateTreemap = (node, siblingIndex = 0) => ({
  ...node,
  ...treemapPresentation(siblingIndex),
  ...(Array.isArray(node.children)
    ? { children: node.children.map((child, index) => decorateTreemap(child, index)) }
    : {}),
});

/* 行业市值层级：一级行业用于全局占比，点击后查看子行业；极小值验证比例压缩，0 值验证尾部剔除。 */
const treemapEntryHierarchy = () => decorateTreemap({
  name: '全部行业',
  children: [
    {
      name: '信息技术',
      children: [
        { name: '半导体与半导体生产设备', value: 1860 },
        { name: '软件服务', value: 1320 },
        { name: '技术硬件与设备', value: 780 },
        { name: '电子元件', value: 320 },
      ],
    },
    {
      name: '金融',
      children: [
        { name: '银行', value: 1480 },
        { name: '资本市场', value: 860 },
        { name: '保险', value: 620 },
      ],
    },
    {
      name: '工业',
      children: [
        { name: '电气设备', value: 940 },
        { name: '机械制造', value: 710 },
        { name: '航空航天与国防', value: 430 },
        { name: '运输', value: 280 },
      ],
    },
    {
      name: '医药卫生',
      children: [
        { name: '制药', value: 660 },
        { name: '医疗器械', value: 410 },
        { name: '生物科技', value: 95 },
        { name: '生命科学工具和服务', value: 2 },
        { name: '医疗服务', value: 0 },
      ],
    },
    {
      name: '可选消费',
      children: [
        { name: '汽车与汽车零部件', value: 520 },
        { name: '耐用消费品与服装', value: 270 },
        { name: '消费者服务', value: 130 },
      ],
    },
    {
      name: '原材料',
      children: [
        { name: '化工', value: 340 },
        { name: '金属与采矿', value: 220 },
        { name: '建筑材料', value: 105 },
      ],
    },
    {
      name: '通信服务',
      children: [
        { name: '电信服务', value: 460 },
        { name: '传媒', value: 290 },
        { name: '互联网服务', value: 170 },
      ],
    },
    {
      name: '日常消费',
      children: [
        { name: '食品饮料', value: 390 },
        { name: '家庭用品', value: 230 },
        { name: '零售', value: 160 },
      ],
    },
  ],
});

const TREEMAP_NAMES = [
  '信息技术', '金融', '工业', '医药卫生', '可选消费', '原材料',
  '通信服务', '日常消费', '公用事业', '能源', '房地产', '半导体',
  '软件服务', '银行', '保险', '电气设备', '机械制造', '航空航天与国防',
  '汽车与零部件', '耐用消费品与服装', '消费者服务', '制药', '医疗器械', '生物科技',
  '化工', '金属与采矿', '建筑材料', '媒体娱乐', '零售业', '食品饮料',
  '交通运输', '资本市场', '电子元件', '技术硬件与设备', '家庭用品', '商业服务',
  '新能源设备', '生命科学工具和服务', '医疗服务', '综合金融', '纺织制造', '其他行业',
  '农林牧渔', '国防军工', '家用电器', '美容护理', '环保', '社会服务',
  '计算机设备', '通信设备', '互联网服务', '医药商业', '煤炭', '石油石化',
];

const TREEMAP_VALUES = [
  4280, 2960, 2360, 1800, 1500, 1200, 920, 780, 665, 520, 430, 340,
  270, 220, 190, 160, 130, 2, 118, 106, 95, 86, 78, 70, 63, 56, 50, 44,
  39, 34, 29, 24, 20, 16, 13, 10, 8, 6, 4, 3, 2, 1,
  0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05,
];

/* 同一份行业数据支持三个独立树图组件入口，类型由示例配置决定，不再由项数反推。 */
export const treemapHierarchy = (count = 6) => {
  if (count <= 8) {
    const hierarchy = treemapEntryHierarchy();
    return { ...hierarchy, children: hierarchy.children.slice(0, Math.max(1, count)) };
  }
  const size = Math.min(count, TREEMAP_NAMES.length);
  return {
    name: size > 30 ? '全市场行业' : '重点行业',
    children: TREEMAP_NAMES.slice(0, size).map((name, index) => ({
      name,
      value: TREEMAP_VALUES[index],
      ...treemapPresentation(index),
    })),
  };
};

/* ── 两面共用的展示维度 ──────────────────────────────────────── */

export const THEMES = [
  { id: 'ths', label: 'THS', dot: '#3366FF' },
  { id: 'ifind-pc', label: 'iFinD PC', dot: '#4D5999' },
  { id: 'ainvest', label: 'Ainvest', dot: '#265FFC' },
];

/* 数据密度 = 传给 cfg 的类目数（cfg 是 n 的函数，故新图表可自行解释「一个类目」的含义） */
export const DENSITY = { few: 4, mid: 16, many: 36 };
export const DENSITY_LEVELS = [
  { id: 'few', label: '少量' },
  { id: 'mid', label: '中量' },
  { id: 'many', label: '大量' },
];

export const densityOptionsOf = (example) => ({ ...DENSITY, ...(example?.densityValues ?? {}) });

export const defaultDensityOf = (example) => example?.densityControl?.default ?? 'few';

export const densityControlOf = (example) => {
  const values = densityOptionsOf(example);
  const control = example.densityControl ?? {};
  return {
    label: control.label ?? '项数',
    hint: control.hint ?? '切换少量、中量与大量数据场景',
    default: defaultDensityOf(example),
    options: DENSITY_LEVELS.map(({ id, label }) => ({
      id,
      label: control.labels?.[id] ?? `${label} · ${values[id]}项`,
    })),
  };
};

/* ── 连续档：数据量作一根可拖的滑杆 ─────────────────────────────
   与三档预设**并存**、读同一份示例定义，不是两套数据：playground 两个面要的是
   「三个可复现的固定场景」（截图对比、回归），主站要的是「随手拉到任意一档看形变」。
   上下限默认 1–50，示例可各自收窄——**收窄是硬约束不是审美**：
   雷达低于 3 维 RadarChart 直接抛错（RADAR-01），高于 6 维示例也只有 6 个维度名。 */
export const DENSITY_RANGE = { min: 1, max: 50 };
export const densityRangeOf = (example) => ({ ...DENSITY_RANGE, ...(example?.densityRange ?? {}) });
export const densityUnitOf = (example) => example?.densityUnit ?? '类目';

export const clampDensity = (example, n) => {
  const { min, max } = densityRangeOf(example);
  const value = Math.round(Number(n));
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
};

/* 滑杆初值 = 该示例预设默认档的数值：同一个示例在三档面与滑杆面首屏一致，切面不跳 */
export const defaultDensityCountOf = (example) =>
  clampDensity(example, densityOptionsOf(example)[defaultDensityOf(example)]);

/* 连续档控件描述。与 densityControlOf 并列而不是取代它——后者仍是三档面的数据源。
   主站滑杆的说明保持简短；各示例的量程建议仍留在三档验收面。 */
export const densitySliderOf = (example) => {
  const { min, max } = densityRangeOf(example);
  const control = example?.densityControl ?? {};
  return {
    label: control.label ?? '项数',
    hint: '数据项数量',
    unit: densityUnitOf(example),
    min,
    max,
    value: defaultDensityCountOf(example),
  };
};

export const INITIAL_ZOOM = { start: 0.35, end: 1 };

/*
 * 各图表类型支持哪些**语义旋钮**（≠ 样式参数，样式一律走 token）。
 * 预览面据此决定显示哪几个开关——新图表在这里声明，两面自动适配。
 *   zoom      缩放轴（DATAZOOM-01..07，需要类目轴）
 *   area      主线渐变面积（仅非堆叠且含折线的 cartesian 配置，见 supportsArea）
 *   dataLabel 数据标签开关（LABEL-05）——**只有直角坐标系声明**，开 = 按图表类型默认
 *   axisTitle 轴标题开关（AXISTITLE-01，默认不显示；开时注入 { y, y2, x } 文案）
 *   animation 入场生长开关（MOTION-01/07，**默认开**——与其他旋钮相反，关掉才落进 cfg）
 */
export const CHART_CAPABILITIES = {
  cartesian: { zoom: true, area: true, dataLabel: true, axisTitle: true, animation: true, legendSelect: true, yIndicator: true },
  /* 饼 / 环无类目轴、无 Y 轴、无折线：zoom / area / axisTitle 一概不声明，
     两个预览面的对应旋钮据此自动不出现（见 specs/pie.md 活 demo 的验收点）。
     **不声明 dataLabel**：饼环的显隐与形态是同一件事（PIE-12「引线与标签强绑定」——
     「显示但没形态」不是合法状态），故合并进 labelLayout 一个三档旋钮，见 buildConfig。
     legend / labelLayout / labelAlign 是本族专属，cartesian 不声明。
     [LEGEND-06][LEGEND-14] legendSelect 只有 cartesian / pie 声明：它是「点击图例发生什么」的
     三档语义，前提是图例可点。桑基的图例是静态色卡（renderLegend 不接 onToggle/onHover，
     且标了 role="list"），没有点击可言，故本族不声明——不是漏了。 */
  pie: { animation: true, legend: true, labelLayout: true, labelAlign: true, legendSelect: true },
  /* [RADAR-07] 雷达无坐标轴、无 Y 轴、无折线：zoom / area / axisTitle / dataLabel 一概不声明
     （它已进 tests/examples.test.mjs 的 axisless 名单，那是被断言的契约、不是约定）。
     axisValue 是本族专属：轴标签是否带数值。**与交互无关**——基线 7.2 那条「展示数值时
     不可交互」已被 AInvest Figma 推翻（三组数据带数值且照常 hover），故它只是个显隐开关。
     [RADAR-03/05/07/14/18] 对外示例分标准 / 多数据 / 分区，但组件视觉变体仍只有 basic / rating：
     多数据是 series 数量不同，不是第三个 variant。网格、闭合轮廓与标签排列都可正交组合；
     editable 只开放给单系列示例，多系列示例不显示该能力。ratingStyle / ratingBandCount 只在
     rating 分类下有意义；后者只在分段档显示。 */
  radar: {
    animation: true, legendSelect: true, axisValue: true,
    radarGridShape: true, radarShape: true, ratingStyle: true, ratingBandCount: true,
    axisLabelLayout: true, radarEditable: true,
  },
  /* 桑基当前由节点 hover / 点击和季度播放 API 承担交互，不复用坐标轴或饼环旋钮。 */
  sankey: { density: false },
  /* 矩形树图无轴、无图例；入口、通用与全局作为独立示例，共用本族能力。 */
  treemap: { animation: true, treemapColor: true },
};

/*
 * [PIE-09][PIE-12] 外侧引线档下**图例方位的建议默认值**。
 * 左右结构里右侧的标签带会把图例推得很远、整组重心偏掉，故切到引线时把图例默认拨到上下。
 * 只是预览面的**默认值联动**，用户仍可手动改回左右；组件的默认方位仍是 'right'（PIE-09 未变）。
 * 放这里而不是各写一遍：两个预览面共用，省得将来改了一处漏一处。
 */
export const suggestedLegend = (labelLayout) => (labelLayout === 'outside' ? 'bottom' : 'right');

/* [AXISTITLE-01] 轴标题旋钮打开时注入的通用文案；示例可用自己的 axisTitle 字段覆盖（给更贴切的文案）。
   文案是内容不是样式——两面共用这一份，避免各写各的。
   **y2 是否落进最终 cfg 由 buildConfig 按图表形态实判**（见那里的注释），不靠逐示例记得写。 */
export const AXIS_TITLES = { y: '单位：元', y2: '副轴', x: '交易日' };

/* ── 示例清单 ────────────────────────────────────────────────── */

const BOTH = ['index', 'playground'];
const RADAR_REGRESSION = ['radar-preview'];
const RADAR_ALL_SURFACES = [...BOTH, ...RADAR_REGRESSION];

export const EXAMPLES = [
  {
    id: 'basic', group: '柱状图', chart: 'cartesian',
    title: '基础柱状图', spec: 'BAR-01 / BAR-03', surfaces: BOTH,
    description: '单系列正值柱状图，展示基础柱宽、间距、圆角与数据标签。',
    cfg: (n) => ({ categories: seq(n), series: [{ name: '营业收入', data: wave(n) }] }),
  },
  {
    id: 'bar-negative', group: '柱状图', chart: 'cartesian',
    title: '正负值柱状图', spec: 'BAR-01 / BAR-03', surfaces: BOTH,
    description: '单系列数据跨越零轴，覆盖负值向下、0 值占位与 null 断口。',
    cfg: (n) => ({ categories: seq(n), series: [{ name: '净利润', data: signedWave(n) }] }),
  },
  {
    id: 'grouped3', group: '柱状图', chart: 'cartesian',
    title: '分组柱', spec: 'BAR-02 / COLOR-04', surfaces: BOTH,
    description: 'index 详情页可在 2–12 个系列间调整数据组数，覆盖分组排布、色板与图例显隐。',
    indexSeriesRange: { min: 2, max: 12, default: 3 },
    cfg: (n, seriesCount) => ({
      categories: seq(n),
      series: selectExampleSeries(posSeries(n, FINANCIAL_SERIES_NAMES), seriesCount, 3),
    }),
  },
  {
    id: 'stack', group: '堆叠图', chart: 'cartesian',
    title: '普通堆叠柱', spec: 'BAR-05', surfaces: BOTH,
    description: 'index 详情页可调整正值系列数；逐段累计，且仅整根堆叠外端保留主题圆角。',
    indexSeriesRange: { min: 2, max: 12, default: 3 },
    cfg: (n, seriesCount) => ({
      categories: seq(n),
      series: selectExampleSeries(posSeries(n, FINANCIAL_SERIES_NAMES), seriesCount, 3),
      stack: 'normal',
    }),
  },
  {
    id: 'stackNeg', group: '堆叠图', chart: 'cartesian',
    title: '正负堆叠柱', spec: 'BAR-05', surfaces: BOTH,
    description: 'index 详情页可调整系列数；正值向上、负值向下累计，最小档仍保留负值项。',
    indexSeriesRange: { min: 2, max: 10, default: 3 },
    cfg: (n, seriesCount) => ({
      categories: seq(n), stack: 'normal',
      series: selectExampleSeries(
        [...posSeries(n, [
          '主营利润', '投资收益', '营业外收入', '公允价值变动', '资产处置收益',
          '汇兑收益', '其他收益', '补贴收入', '利息收入',
        ]), { name: '净亏损项', data: negWave(n) }],
        seriesCount, 3, true,
      ),
    }),
  },
  {
    id: 'percent', group: '堆叠图', chart: 'cartesian',
    title: '归一化堆叠柱', spec: 'BAR-06', surfaces: BOTH,
    description: 'index 详情页可调整系列数；每个类目归一到 100%，隐藏系列后占比重新计算。',
    indexSeriesRange: { min: 2, max: 12, default: 3 },
    cfg: (n, seriesCount) => ({
      categories: seq(n),
      series: selectExampleSeries(posSeries(n, FINANCIAL_SERIES_NAMES), seriesCount, 3),
      stack: 'percent',
    }),
  },
  {
    id: 'line', group: '折线图', chart: 'cartesian',
    title: '基础折线图', spec: 'LINE-01', surfaces: BOTH,
    description: '折线直连，null 处断开；数据点显隐随密度分档。',
    cfg: (n) => ({ categories: seq(n), series: [{ name: '指数', data: lineWave(n), type: 'line' }] }),
  },
  {
    id: 'line-negative', group: '折线图', chart: 'cartesian',
    title: '正负值折线图', spec: 'LINE-01', surfaces: BOTH,
    description: '单系列折线跨越零轴，覆盖负值、0 值与 null 断点。',
    cfg: (n) => ({ categories: seq(n), series: [{ name: '净利润', data: signedLineWave(n), type: 'line' }] }),
  },
  {
    id: 'line-multi', group: '折线图', chart: 'cartesian',
    title: '多折线图', spec: 'LINE-01 / COLOR-05', surfaces: BOTH,
    description: 'index 详情页可在 2–12 条折线间调整数据组数；新增系列使用错开的波形，避免重复已有轨迹。',
    indexSeriesRange: { min: 2, max: 12, default: 3 },
    cfg: (n, seriesCount) => ({
      categories: seq(n),
      series: selectExampleSeries(
        posSeries(n, MARKET_INDEX_SERIES_NAMES).map((s) => ({ ...s, type: 'line' })),
        seriesCount, 3,
      ),
    }),
  },
  {
    id: 'line-stack', group: '折线图', chart: 'cartesian',
    title: '堆叠折线图', spec: 'LINE-01', surfaces: BOTH,
    description: 'index 详情页可调整系列数；折线沿累计基线绘制，并在折线与基线之间填充同色区域。',
    indexSeriesRange: { min: 2, max: 12, default: 3 },
    cfg: (n, seriesCount) => ({
      categories: seq(n), stack: 'normal',
      series: selectExampleSeries(
        posSeries(n, MARKET_INDEX_SERIES_NAMES).map((s) => ({ ...s, type: 'line' })),
        seriesCount, 3,
      ),
    }),
  },
  {
    id: 'combo', group: '组合图', chart: 'cartesian',
    title: '折柱组合 · 双 Y', spec: 'BAR-07 / SCALE-04', surfaces: BOTH,
    description: 'index 详情页可调整系列数；柱走主轴、线走副轴，最小档仍保留一柱一线。',
    axisTitle: { y: '单位：元', y2: '增速（%）', x: '交易日' },
    indexSeriesRange: { min: 2, max: 10, default: 3 },
    cfg: (n, seriesCount) => ({
      categories: seq(n),
      series: selectExampleSeries([
        ...posSeries(n, [
          '营业收入', '成本', '利润', '现金流', '研发投入',
          '销售费用', '管理费用', '财务费用', '投资收益',
        ]).map((series) => ({ ...series, type: 'bar', axis: 'primary' })),
        { name: '营收增速', data: growth(n), type: 'line', axis: 'secondary' },
      ], seriesCount, 3, true),
    }),
  },
  {
    id: 'combo-single', group: '组合图', chart: 'cartesian',
    title: '折柱组合 · 单柱 + 线', spec: 'BAR-07 / LABEL-05', surfaces: BOTH,
    description: '一柱一线的组合，数据标签只跟柱走。',
    axisTitle: { y: '单位：元', y2: '增速（%）', x: '交易日' },
    cfg: (n) => ({
      categories: seq(n),
      series: [
        { name: '营业收入', data: wave(n), type: 'bar', axis: 'primary' },
        { name: '营收增速', data: growth(n), type: 'line', axis: 'secondary' },
      ],
    }),
  },
  {
    id: 'sankey-financial', group: '桑基图', chart: 'sankey',
    title: '财报收支拆解', spec: 'SANKEY-01 / SANKEY-24 / SANKEY-26', surfaces: BOTH,
    description: '收入、成本与利润按真实业务阶段展开，负值保留方向并参与有符号守恒。',
    summary: '15 节点 · 14 条流向 · 8 期',
    preferredWidth: 812,
    logicNote: '节点只接收业务角色、阶段与有符号流量；节点宽高、列距、最小可见粗细和主题语义色均由 Sankey token 解析。',
    presentation: financialSankeyPresentation,
    summaryByTheme: { ainvest: '15 nodes · 14 flows · 8 periods' },
    playback: financialSankeyPlayback(),
    cfg: () => financialSankey(),
  },
  {
    id: 'treemap-entry', group: '矩形树图', chart: 'treemap',
    title: '入口型矩形树图', spec: 'TREEMAP-11 / TREEMAP-13', surfaces: BOTH,
    description: '3–8 个等面积模块组成业务入口，面积不映射业务值。',
    densityValues: { few: 3, mid: 6, many: 8 },
    densityUnit: '个模块',
    densityControl: {
      hint: 'PRD 建议 3–8 个入口模块',
      default: 'mid',
      labels: { few: '3项', mid: '6项', many: '8项' },
    },
    cfg: (count) => ({
      name: '行业入口', root: treemapHierarchy(count), variant: 'entry',
      labelType: 'twoLineCenter', colorThresholds: TREEMAP_SEMANTIC_THRESHOLDS,
    }),
  },
  {
    id: 'treemap-local', group: '矩形树图', chart: 'treemap',
    title: '通用矩形树图', spec: 'TREEMAP-05 / TREEMAP-08 / TREEMAP-13', surfaces: BOTH,
    description: '对应 PRD 局部类型单屏形态，展示头部重点或二级完整数据，兼顾比例和文字可读性。',
    densityValues: { few: 10, mid: 18, many: 30 },
    densityUnit: '项',
    densityControl: {
      hint: 'PRD 建议不超过 30 项',
      default: 'mid',
      labels: { few: '10项', mid: '18项', many: '30项' },
    },
    cfg: (count) => ({
      name: '重点行业', root: treemapHierarchy(count), variant: 'local',
      labelType: 'twoLineCenter', colorThresholds: TREEMAP_SEMANTIC_THRESHOLDS,
    }),
  },
  {
    id: 'treemap-overall', group: '矩形树图', chart: 'treemap',
    title: '全局矩形树图', spec: 'TREEMAP-12 / TREEMAP-13', surfaces: BOTH,
    description: '对应 PRD 整体类型固定页形态，容纳 30 项以上全量数据，面积严格映射真实占比。',
    densityValues: { few: 32, mid: 42, many: 54 },
    /* 上限必须盖过本例最大的预设档（54）：滑杆够不到自己的预设档，
       就成了「三档面能看到、主站看不到」的静默分叉 */
    densityRange: { min: 1, max: 60 },
    densityUnit: '项',
    densityControl: {
      hint: 'PRD 建议 30 项以上',
      default: 'mid',
      labels: { few: '32项', mid: '42项', many: '54项' },
    },
    cfg: (count) => ({
      name: '全市场行业', root: treemapHierarchy(count), variant: 'overall',
      labelType: 'twoLineLeftBottom', colorThresholds: TREEMAP_SEMANTIC_THRESHOLDS,
    }),
  },
  {
    id: 'radar-basic', group: '雷达图', chart: 'radar',
    title: '标准雷达图', spec: 'RADAR-02 / RADAR-04 / RADAR-07', surfaces: RADAR_ALL_SURFACES,
    description: '单数据的基线形态；可组合网格、轮廓、标签排列与可调节能力。',
    ...RADAR_DENSITY,
    cfg: (n) => ({
      name: '综合财务评分', dimensions: radarDims(n), series: [radarSeries(n)[0]],
      max: RADAR_FIXED_MAX, segments: RADAR_SEGMENTS,
    }),
  },
  {
    id: 'radar-multi', group: '雷达图', chart: 'radar',
    title: '多数据雷达图', spec: 'RADAR-04 / RADAR-08 / RADAR-10', surfaces: RADAR_ALL_SURFACES,
    description: '多系列在同一组维度与量程中对比；保持只读，不提供可调节能力。',
    ...RADAR_DENSITY,
    indexSeriesRange: { min: 2, max: 10, default: 2 },
    cfg: (n, seriesCount) => ({
      name: '同期能力对比', dimensions: radarDims(n),
      series: selectExampleSeries(radarSeries(n), seriesCount, 2),
      max: RADAR_FIXED_MAX, segments: RADAR_SEGMENTS,
    }),
  },
  {
    id: 'radar-curve', group: '雷达图', chart: 'radar',
    title: '曲线轮廓配置', spec: 'RADAR-05 / RADAR-06 / RADAR-10', surfaces: RADAR_REGRESSION,
    description: '专项回归配置：闭合曲线 + 面填充，曲线态不出圆点；hover 热区为扇形。',
    ...RADAR_DENSITY,
    cfg: (n) => ({
      name: '指数能力对比', dimensions: radarDims(n, 'en'), series: radarSeries(n, 'en'),
      max: RADAR_FIXED_MAX, segments: RADAR_SEGMENTS, shape: 'curve',
    }),
  },
  {
    id: 'radar-polygon', group: '雷达图', chart: 'radar',
    title: '多边形网格配置', spec: 'RADAR-03 / RADAR-04', surfaces: RADAR_REGRESSION,
    description: '专项回归配置：正多边形网格；不给 max，走自动 nice 上界。',
    ...RADAR_DENSITY,
    /* [RADAR-04] **有意不给 max**：与另两条固定量程的示例并排，即可看出自动档会把上界抬到
       nice 值、两张图量程不同因而形状不可比——那正是留 max 这个口子的理由。 */
    cfg: (n) => ({
      name: '综合财务评分', dimensions: radarDims(n), series: radarSeries(n).slice(0, 2),
      segments: RADAR_SEGMENTS, gridShape: 'polygon',
    }),
  },
  {
    id: 'radar-rating', group: '雷达图', chart: 'radar',
    title: '分区雷达图', spec: 'RADAR-15 / COLOR-10', surfaces: RADAR_ALL_SURFACES,
    description: '低表现到高表现的同心语义分区；默认连续渐变，可切换为离散色带。',
    ...RADAR_DENSITY,
    cfg: (n) => ({
      name: '能力风险评估', dimensions: radarDims(n), series: [radarSeries(n)[0]],
      max: RADAR_FIXED_MAX, segments: RADAR_SEGMENTS, variant: 'rating',
    }),
  },
  {
    id: 'radar-adjustable', group: '雷达图', chart: 'radar',
    title: '可调节能力配置', spec: 'RADAR-18', surfaces: RADAR_REGRESSION,
    description: '专项回归配置：在标准雷达上开启单系列编辑能力，验证径向拖动、键盘调值与环绕标签。',
    ...RADAR_DENSITY,
    cfg: (n) => ({
      name: '自定义能力配置', dimensions: radarDims(n),
      series: [radarSeries(n)[0]],
      max: RADAR_FIXED_MAX, segments: RADAR_SEGMENTS,
      editable: true, editStep: 0.1, axisLabelLayout: 'arc',
    }),
  },
  {
    id: 'donut', group: '饼图与环形图', chart: 'pie',
    title: '环形图', spec: 'PIE-01 / PIE-02', surfaces: BOTH,
    description: '中空环形占比图，扇区按声明序固定取色，隐藏后重新闭合 360°。',
    cfg: (n) => ({ name: '营收构成', variant: 'donut', items: sliceItems(n) }),
  },
  {
    id: 'pie', group: '饼图与环形图', chart: 'pie',
    title: '饼图', spec: 'PIE-02 / COLOR-08', surfaces: BOTH,
    description: '实心饼图，与环形图同一组件、同一份数据，只差 variant 一个旋钮。',
    cfg: (n) => ({ name: '营收构成', variant: 'pie', items: sliceItems(n) }),
  },

  /* ── 边界与极端情况（**只进 playground**）────────────────────────
     对外站点是画廊，不该摆这些；但它们是改标签 / 图例 / 取色时最先该看的几张图。
     每个示例只推**一个**边界，出问题时能一眼定位是哪条规则塌了。 */
  {
    id: 'edge-long-name', group: '边界与极端情况', chart: 'pie',
    title: '超长名称与数值', spec: 'PIE-16 / LEGEND-13', surfaces: ['playground'],
    description: '扇区名长到必然溢出：外侧标签截名称、图例截标签，数值段两处都恒完整。',
    cfg: (n) => ({ name: '利润表科目', variant: 'donut', items: longNameItems(n) }),
  },
  {
    id: 'edge-skew', group: '边界与极端情况', chart: 'pie',
    title: '极端占比', spec: 'PIE-01 / PIE-14', surfaces: ['playground'],
    description: '首项独占约 98%，其余是几乎无角度的窄扇区——压窄扇区的标签、hover 命中与重叠丢弃。',
    cfg: (n) => ({ name: '收入构成', variant: 'donut', items: skewItems(n) }),
  },
  {
    id: 'edge-single', group: '边界与极端情况', chart: 'pie',
    title: '单扇区', spec: 'COLOR-03 / PIE-01', surfaces: ['playground'],
    description: '只有一个扇区（整环 360°），取色应走单系列默认色而非扇区盘首色——数据量旋钮对它无效。',
    cfg: () => ({ name: '营收构成', variant: 'donut', items: [{ name: '主营业务', value: 1000 }] }),
  },
  {
    id: 'edge-empty', group: '边界与极端情况', chart: 'pie',
    title: '全 0 与全 null', spec: 'PIE-01', surfaces: ['playground'],
    description: '所有值都是 0 或 null：总和为 0 → 什么都不画（不抛错、不留半个环），图例仍在。',
    cfg: (n) => ({
      name: '营收构成',
      variant: 'donut',
      items: Array.from({ length: n }, (_, i) => ({
        name: SLICE_NAMES[i % SLICE_NAMES.length] + (i >= SLICE_NAMES.length ? Math.floor(i / SLICE_NAMES.length) + 1 : ''),
        value: i % 2 ? null : 0,
      })),
    }),
  },
  {
    id: 'edge-long-legend', group: '边界与极端情况', chart: 'cartesian',
    title: '超长图例名（横排）', spec: 'LEGEND-01 / LEGEND-13', surfaces: ['playground'],
    description: '与饼环那张对照：横排图例放不下是**换行**、不截断（LEGEND-13 只管纵列），故长名会把图例撑高而非省略。',
    cfg: (n) => ({
      categories: seq(n),
      series: LONG_NAMES.slice(0, 4).map((name, k) => ({ name, data: wave(n, k * 0.9) })),
    }),
  },
];

/* ── 查询与配置装配（两面共用，避免各写一份而漂移）──────────── */

/*
 * 图表族：**一个 L2 组件 = 一族**（`chart` 字段就是族的身份，与 registry 的键同源）。
 * 首页的分类导航按族分节、族内再按 `group` 分类——接一个新组件（HBar / 散点 / 雷达 …）
 * 只需在这里补一行族名，导航的分节自动跟着走，不必再动首页。
 * 族名取各自规范页的用词：cartesian → 直角坐标图（[axes.md]）、
 * pie → 占比图（[pie.md] 开篇「无坐标系的**占比图**」）——不叫「饼图与环形图」，
 * 那是族**内**的分类名，将来还会有别的占比形态（玫瑰图 / 旭日 …）落进同一族。
 */
export const CHART_FAMILIES = {
  cartesian: '直角坐标图',
  pie: '占比图',
  radar: '多维对比图',
  sankey: '流向图',
  treemap: '层级占比图',
};

/* 某个面要展示的示例（surfaces 缺省 = 两面都进） */
export const examplesFor = (surface) =>
  EXAMPLES.filter((e) => (e.surfaces ?? BOTH).includes(surface));

/*
 * 该面的「族 → 族内分类」清单，顺序 = EXAMPLES 的声明序。
 * **不另提供「扁平分类名」的版本**：那种清单分不出哪几个分类属同一族，导航一旦按族分节就不够用，
 *   两个近义 API 并存只会让下一个人挑错那个。要扁平列表就 `familiesFor(s).flatMap(f => f.groups)`。
 * 首页导航据此分节；族名未登记时回落到 chart 键本身（宁可露出一个陌生的键，
 * 也不要静默把新组件的示例混进别人的分节里）。
 */
export function familiesFor(surface) {
  const out = [];
  for (const e of examplesFor(surface)) {
    const label = CHART_FAMILIES[e.chart] ?? e.chart;
    let fam = out.find((f) => f.label === label);
    if (!fam) out.push((fam = { chart: e.chart, label, groups: [] }));
    if (!fam.groups.includes(e.group)) fam.groups.push(e.group);
  }
  return out;
}

/* 渐变面积只对「非堆叠且含折线」的配置有意义——按 cfg 实际形态判，不是按图表类型 */
export const supportsArea = (example) => {
  if (!CHART_CAPABILITIES[example.chart]?.area) return false;
  const cfg = example.cfg(4);
  return cfg.stack == null && cfg.series.some((s) => s.type === 'line');
};

/* 该示例实际可用的旋钮（图表类型能力 ∩ 本示例配置形态） */
export const capabilitiesOf = (example) => {
  const caps = CHART_CAPABILITIES[example.chart] ?? {};
  const sampleCfg = example.cfg(defaultDensityCountOf(example));
  const ratingRadar = example.chart === 'radar' && sampleCfg.variant === 'rating';
  const singleSeriesRadar = example.chart === 'radar' && sampleCfg.series?.length === 1;
  return {
    density: caps.density !== false,
    zoom: !!caps.zoom, dataLabel: !!caps.dataLabel, axisTitle: !!caps.axisTitle,
    animation: !!caps.animation, area: supportsArea(example), legend: !!caps.legend,
    labelLayout: !!caps.labelLayout, labelAlign: !!caps.labelAlign,
    legendSelect: !!caps.legendSelect, yIndicator: !!caps.yIndicator,
    treemapColor: !!caps.treemapColor, axisValue: !!caps.axisValue,
    radarGridShape: !!caps.radarGridShape, radarShape: !!caps.radarShape,
    ratingStyle: !!caps.ratingStyle && ratingRadar,
    ratingBandCount: !!caps.ratingBandCount && ratingRadar,
    axisLabelLayout: !!caps.axisLabelLayout,
    radarEditable: !!caps.radarEditable && singleSeriesRadar,
  };
};

const radarSampleConfig = (example) => example.cfg(defaultDensityCountOf(example));

/* [RADAR-03/05/18] 预览控件显示的有效值。`auto` 保留专项回归示例自己的配置；
   主站两类示例显式选择后才覆盖。集中在这里，避免三个面各自猜组件默认。 */
export function radarGridShapeOf(example, requested = 'auto') {
  if (requested === 'circle' || requested === 'polygon') return requested;
  return radarSampleConfig(example).gridShape ?? 'circle';
}

export function radarShapeOf(example, requested = 'auto') {
  if (requested === 'straight' || requested === 'curve') return requested;
  return radarSampleConfig(example).shape ?? 'straight';
}

export function radarEditableOf(example, requested = 'auto') {
  if (!capabilitiesOf(example).radarEditable) return false;
  if (requested === true || requested === 'on') return true;
  if (requested === false || requested === 'off') return false;
  return radarSampleConfig(example).editable === true;
}

/* [RADAR-07/14] 标签默认还要看最终是否开启编辑：常规横排、editable 环绕。 */
export function radarAxisLabelLayoutOf(example, requested = 'auto', editable = 'auto') {
  if (requested === 'horizontal' || requested === 'arc') return requested;
  const cfg = example.cfg(defaultDensityCountOf(example));
  return cfg.axisLabelLayout ?? (radarEditableOf(example, editable) ? 'arc' : 'horizontal');
}

/*
 * 示例 + 当前旋钮状态 → 传给 L2 组件的最终配置。
 * 铁律3/4：只装配**数据与语义配置**，样式一律走 token；预览面不得在此之外自加参数。
 *   state = { density='few', theme='ths', platform='pc', zoom, area, dataLabel, axisTitle, animation,
 *             legend, labelLayout, labelAlign, treemapColor, radarGridShape, radarShape,
 *             ratingStyle, ratingBandCount, axisLabelLayout, radarEditable } —— 各项皆可缺省
 *   labelLayout（饼环）= 'off' | 'outside' | 'inside'，缺省 'off' —— 它同时是显隐开关
 * 主题与明暗不作为样式参数进 cfg：它们写在容器的 data-theme / data-mode 上，走 CSS 级联 +
 * behavior 解析。theme 在这里仅允许驱动 L3 presentation 文案映射：Ainvest 图表内部内容
 * 统一经 chart-presentation.js 转为英文；站点外壳仍保持中文。
 */
export function buildConfig(example, state = {}) {
  const {
    density = defaultDensityOf(example), theme = 'ths', platform = 'pc', zoom = false, area = false,
    dataLabel = 'auto', axisTitle = false, animation = true, legend = 'auto',
    labelLayout = 'off', labelAlign = 'anchor', legendSelect = 'multi', yIndicator = false,
    treemapColor = 'intensity', axisValue = false,
    radarGridShape = 'auto', radarShape = 'auto', ratingStyle = 'gradient', ratingBandCount = '6',
    axisLabelLayout = 'auto', radarEditable = 'auto',
  } = state;
  const caps = capabilitiesOf(example);
  const densityOptions = densityOptionsOf(example);
  /* density 有两种形态：**预设档位 id**（三档面传）或**直接给数**（滑杆面传）。
     给数时按示例自己的上下限夹一次——越界会让组件抛错（雷达 <3 维即是），
     夹在这里而不是各面自己夹，是为了「面不自己拼配置」这条不被绕开。 */
  const count = typeof density === 'number'
    ? clampDensity(example, density)
    : (densityOptions[density] ?? densityOptions.few);
  const sourceCfg = example.cfg(count);
  const presentedCfg = example.presentation?.(sourceCfg, { theme }) ?? sourceCfg;
  const cfg = { ...presentedCfg, platform };
  const effectiveEditable = radarEditableOf(example, radarEditable);
  const effectiveAxisLabelLayout = radarAxisLabelLayoutOf(example, axisLabelLayout, radarEditable);

  if (caps.zoom && zoom) cfg.zoom = { ...INITIAL_ZOOM };
  /* [AXISTITLE-01/03] 默认不显示；旋钮打开才注入文案（示例自带的 axisTitle 优先，可给更贴切的措辞）。
     **y2 按 cfg 的实际形态判、不按示例记得没记得写**（同 supportsArea 的做法）：
     真·双量纲才留 y2、否则删掉。两个方向都兜住——双 Y 示例漏写 y2 不会静默丢标题，
     非双 Y 示例误写 y2 也不会混进 cfg（组件侧 showY2Title 还有一道，但预览面的
     「逻辑」面板直接展示这份 cfg，展示的必须就是真正生效的）。 */
  if (caps.axisTitle && axisTitle) {
    const titles = { ...(example.axisTitle ?? AXIS_TITLES) };
    if (!cfg.series.some((s) => s.axis === 'secondary')) delete titles.y2;
    cfg.axisTitle = titles;
  }
  if (caps.area && area) {
    const mainLine = cfg.series.find((s) => s.type === 'line');
    if (mainLine) mainLine.area = true;
  }
  /* [LABEL-05] 直角坐标系：开关的「开」= 'auto' = **按图表类型默认**（单柱 / 单折线出、
     分组柱 / 堆叠不出），故开着时什么都不落进 cfg；只有关掉才显式写 false。 */
  if (caps.dataLabel && dataLabel !== 'auto') cfg.dataLabel = dataLabel === true || dataLabel === 'on';
  /* [PIE-12] 饼环：显隐与形态合成一个三档旋钮（关 / 引线 / 扇区内）——
     「关」= 组件默认（LABEL-05 饼环默认就不出），故不落进 cfg；另两档才同时给出显隐与形态。
     [PIE-13] 对齐档只在外侧引线下有意义，扇区内时不装进 cfg（免得给组件一个它用不上的字段）。 */
  if (caps.labelLayout && labelLayout !== 'off') {
    cfg.dataLabel = true;
    cfg.labelLayout = labelLayout;
    if (caps.labelAlign && labelLayout === 'outside') cfg.labelAlign = labelAlign;
  }
  /* [PIE-09] 图例布局：'auto' = 用示例自己声明的（两个示例各展一种，不动旋钮就能同屏对比）；
     旋钮给了具体值才覆盖。示例没声明也不写进 cfg —— 让组件默认（'right'）说话。 */
  if (caps.legend && legend !== 'auto') cfg.legend = legend;
  /* [LEGEND-06][LEGEND-14] 图例点击语义：'multi' 是组件默认，故不落进 cfg——
     「逻辑」面板里没有 legendSelect = 走默认（多选显隐），同 animation 的口径。 */
  if (caps.legendSelect && legendSelect !== 'multi') cfg.legendSelect = legendSelect;
  /* [TOOLTIP-12] Y 横线 + Y 值徽标：组件默认关，故只有**开**才落进 cfg（同 zoom / axisTitle 的口径）。 */
  if (caps.yIndicator && yIndicator) cfg.yIndicator = true;
  /* [TREEMAP-17][COLOR-09] 强度是组件默认值；仅切到语义色时显式注入通用颜色策略。 */
  if (caps.treemapColor && treemapColor !== 'intensity') cfg.colorMode = treemapColor;
  /* [RADAR-07] 轴标签数值：组件默认关，故只有**开**才落进 cfg（同 zoom / axisTitle 的口径）。
     它不牵动任何交互开关——基线 7.2 的「展示数值时不可交互」已被设计源推翻，见 specs/radar.md。 */
  if (caps.axisValue && axisValue && !effectiveEditable && effectiveAxisLabelLayout === 'horizontal') cfg.axisValue = true;
  /* [RADAR-03/05] 网格和轮廓是两类雷达都能组合的形态选项。auto 保留专项回归配置；
     显式选默认档时删掉示例预置，让 L2 的 circle / straight 默认成为唯一真相。 */
  if (caps.radarGridShape && radarGridShape !== 'auto') {
    if (radarGridShape === 'polygon') cfg.gridShape = 'polygon';
    else delete cfg.gridShape;
  }
  if (caps.radarShape && radarShape !== 'auto') {
    if (radarShape === 'curve') cfg.shape = 'curve';
    else delete cfg.shape;
  }
  /* [RADAR-15] 分区雷达默认就是连续渐变，故只在切到离散色带时显式落字段。
     分段数量同时写入 segments 与说明数组：L2 用同一个数量画环线、色带与底部色块。 */
  if (caps.ratingStyle && ratingStyle === 'bands') {
    const bandCount = String(ratingBandCount) === '5' ? 5 : 6;
    cfg.ratingStyle = 'bands';
    cfg.segments = bandCount;
    cfg.ratingBandLabels = [...RADAR_RATING_BAND_LABELS[bandCount]];
  }
  /* [RADAR-18] editable 是正交能力。开启时按组件契约收敛为单系列，避免同轴多组手柄重叠；
     关闭则去掉专项回归示例的编辑字段。默认步长只属于演示装配，不进入组件默认。 */
  if (caps.radarEditable && radarEditable !== 'auto') {
    if (effectiveEditable) {
      cfg.editable = true;
      cfg.editStep ??= 0.1;
      cfg.series = cfg.series.slice(0, 1);
    } else {
      delete cfg.editable;
      delete cfg.editStep;
      delete cfg.onChange;
    }
  }
  /* [RADAR-07/14] auto 保留示例 / 编辑能力的默认；显式选项覆盖全部雷达形态。 */
  if (caps.axisLabelLayout && axisLabelLayout !== 'auto') cfg.axisLabelLayout = effectiveAxisLabelLayout;
  /* [MOTION-07] 组件默认就播，故只有**关**才落进 cfg——「逻辑」面板里 cfg 无 animation = 走默认（开）。
     与 zoom / axisTitle「有才开」的方向相反，这里是「有才关」。 */
  if (caps.animation && animation === false) cfg.animation = false;
  return chartContentPresentation(cfg, { theme, chart: example.chart });
}

/*
 * 数组字段的展示摘要：长数组或原始值数组折成 `Array(n)`，短对象数组保留但去掉数组字段
 * （series 的 data 一折就是几十个数字，刷屏且无信息）。
 * **按值的形状判，不按字段名判**——故 cartesian 的 series 与饼环的 items 走同一条规则，
 * 面里和这里都不出现 `if (chart === …)`。
 */
const briefValue = (v) => {
  if (!Array.isArray(v)) return v;
  if (v.length > 6 || v.some((x) => x == null || typeof x !== 'object')) return `Array(${v.length})`;
  return v.map((o) => Object.fromEntries(Object.entries(o).filter(([, x]) => !Array.isArray(x))));
};

/*
 * 「逻辑」面板要展示的配置摘要。**内部调的就是同一个 buildConfig**，
 * 保证展示的和真正传进组件的是同一份（examples.js 上方注释里的承诺）。
 * 因此这里**不补任何默认值**：cfg 里没有 stack / animation 就是「走组件默认」，
 * 面板照实不显示——比印一个 `stack: 'none'` 更接近真相（那个值组件里才产生）。
 * 主题 / 明暗不在此：它们不进 cfg，走容器的 data-* 属性 + CSS 级联。
 */
export function describeConfig(example, state = {}) {
  return Object.fromEntries(
    Object.entries(buildConfig(example, state)).map(([k, v]) => [k, briefValue(v)]),
  );
}
