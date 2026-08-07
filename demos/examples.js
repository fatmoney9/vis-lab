/*
 * L3 · 示例数据源（唯一权威）。
 *
 * 两个预览面共享本模块，各自只负责「怎么展示」：
 *   index.html               对外站点：画廊 + 详情页、单主题切换
 *   playground/preview.html  开发验收：三主题横向并排、旋钮更全
 * 示例定义与数据生成函数只有这一份——加示例改一处，两面同时生效，不会漂移。
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
 * 两个预览面都不用改——它们按 chart 字段查表挂载、按能力声明画旋钮。
 */

/* ── 数据生成（示例专用假数据；固定公式、无随机数与当前时间，保证截图可复现）── */

const K = (values) => values.map((v) => (v == null ? null : v * 1000));

export const seq = (n) => Array.from({ length: n }, (_, i) => `${i + 1}`);

/* 基础波形：相位 p 让多系列彼此错开 */
export const wave = (n, p = 0) => K(Array.from(
  { length: n },
  (_, i) => Math.round(560 + 360 * Math.sin(i * 0.6 + p) + 140 * Math.cos(i * 1.7 + p)),
));

/* 含负值 / 0 / null 的单系列（基础柱专用：负值向下、0 值 1px 占位、null 断口全可见） */
export const signedWave = (n) => {
  const d = wave(n, 0.8).map((v) => v - 500000);
  if (n > 2) d[2] = 0;
  if (n > 4) d[4] = null;
  return d;
};

/* 多系列正值波形：按序相移 */
export const posSeries = (n, names) => names.map((name, k) => ({ name, data: wave(n, k * 0.9) }));

/* 负值系列（堆叠含负值用） */
export const negWave = (n) => wave(n, 2).map((v) => -Math.round(v * 0.4));

/* 折线：中途一个 null 断口；多数据（>13 点）整体下移、含负值区 */
export const lineWave = (n) => {
  const d = wave(n, 0.4).map((v) => (n > 13 ? v - 500000 : v));
  d[Math.floor(n / 3)] = null;
  return d;
};

/* 副轴增速（%）：小数量级、与柱不同量纲 */
export const growth = (n) => Array.from({ length: n }, (_, i) => Math.round(12 + 9 * Math.sin(i * 0.5)));

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
   两个预览面共享同一份数据源，验收用例也就只有一份。 */

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

/* 财报收支拆解：季度间保持同一拓扑；有符号流量保持会计守恒，负值只表达贡献方向。 */
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

const makeFinancialSankeyQuarter = ({
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
  const gross = revenue - costValue;
  const operatingExpenseValue = yi(operatingExpense);
  const grossToOperating = gross - operatingExpenseValue;
  const otherOperatingValue = yi(otherOperating);
  const operatingProfit = grossToOperating + otherOperatingValue;
  const nonOperatingValue = yi(nonOperating);
  const totalProfit = operatingProfit + nonOperatingValue;
  const incomeTaxValue = yi(incomeTax);
  const netProfit = totalProfit - incomeTaxValue;
  const minorityInterestValue = yi(minorityInterest);

  return {
    nodes: FINANCIAL_SANKEY_NODES.map((node) => ({ ...node })),
    links: [
      { source: 'domestic', target: 'revenue', value: domestic },
      { source: 'other-business', target: 'revenue', value: otherBusiness },
      { source: 'international', target: 'revenue', value: international },
      { source: 'revenue', target: 'cost', value: costValue },
      { source: 'revenue', target: 'gross', value: gross },
      { source: 'gross', target: 'operating-expense', value: operatingExpenseValue },
      { source: 'gross', target: 'operating-profit', value: grossToOperating },
      { source: 'other-operating', target: 'operating-profit', value: otherOperatingValue },
      { source: 'operating-profit', target: 'total-profit', value: operatingProfit },
      { source: 'non-operating', target: 'total-profit', value: nonOperatingValue },
      { source: 'total-profit', target: 'net-profit', value: netProfit },
      { source: 'total-profit', target: 'income-tax', value: incomeTaxValue },
      { source: 'net-profit', target: 'parent-profit', value: netProfit - minorityInterestValue },
      { source: 'net-profit', target: 'minority-interest', value: minorityInterestValue },
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
  ['2025 年报', '25 Q4', [6.1, 2.2, 0.62], 8.960136, 0.261273, -0.056309, 0.000071, -0.080673, 0.009906, '亏损'],
  ['2026 一季报', '26 Q1', [190.71, 72.68, 16.46], 243.8, 24.4, -1.11, 0.015083, 0.945083, 1.73],
  ['2026 半年报', '26 Q2', [205, 78, 18], 260, 26, -0.4, 0.6, 1.4, 2.1],
  ['2026 三季报', '26 Q3', [218, 84, 20], 276, 28, 0.6, 0.9, 1.9, 2.5],
  ['2026 年报', '26 Q4', [236, 92, 22], 298, 31, 1.2, 1.1, 2.3, 3],
];

export const financialSankeyPeriods = () => FINANCIAL_SANKEY_PERIOD_INPUTS.map(([
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

export const financialSankey = () => financialSankeyPeriods()[0];

/* ── 两面共用的展示维度 ──────────────────────────────────────── */

export const THEMES = [
  { id: 'ths', label: 'THS 同花顺', dot: '#3366FF' },
  { id: 'ifind-pc', label: 'iFinD PC', dot: '#4D5999' },
  { id: 'ainvest', label: 'Ainvest', dot: '#265FFC' },
];

/* 数据密度 = 传给 cfg 的类目数（cfg 是 n 的函数，故新图表可自行解释「一个类目」的含义） */
export const DENSITY = { few: 4, mid: 16, many: 36 };

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
  cartesian: { zoom: true, area: true, dataLabel: true, axisTitle: true, animation: true },
  /* 饼 / 环无类目轴、无 Y 轴、无折线：zoom / area / axisTitle 一概不声明，
     两个预览面的对应旋钮据此自动不出现（见 specs/pie.md 活 demo 的验收点）。
     **不声明 dataLabel**：饼环的显隐与形态是同一件事（PIE-12「引线与标签强绑定」——
     「显示但没形态」不是合法状态），故合并进 labelLayout 一个三档旋钮，见 buildConfig。
     legend / labelLayout / labelAlign 是本族专属，cartesian 不声明。 */
  pie: { animation: true, legend: true, labelLayout: true, labelAlign: true },
  /* 桑基当前由节点 hover / 点击和季度播放 API 承担交互，不复用坐标轴或饼环旋钮。 */
  sankey: { density: false },
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

export const EXAMPLES = [
  {
    id: 'basic', group: '柱状图', chart: 'cartesian',
    title: '基础柱状图', spec: 'BAR-01 / BAR-03', surfaces: BOTH,
    description: '单系列柱状图，覆盖正负值、0 值占位与 null 断口。',
    cfg: (n) => ({ categories: seq(n), series: [{ name: '营业收入', data: signedWave(n) }] }),
  },
  {
    id: 'grouped3', group: '柱状图', chart: 'cartesian',
    title: '三系列分组柱', spec: 'BAR-02', surfaces: BOTH,
    description: '三系列分组排布，系列颜色固定槽位，隐藏后重新居中。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润']) }),
  },
  {
    id: 'grouped6', group: '柱状图', chart: 'cartesian',
    title: '多系列分组柱', spec: 'BAR-02 / COLOR-04', surfaces: BOTH,
    description: '六系列场景，用于检查色板循环、图例换行与显隐逻辑。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润', '税费', '研发投入', '现金流']) }),
  },
  {
    id: 'stack', group: '堆叠图', chart: 'cartesian',
    title: '普通堆叠柱', spec: 'BAR-05', surfaces: BOTH,
    description: '正值逐段累计，段间直角，仅整根堆叠外端保留主题圆角。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润']), stack: 'normal' }),
  },
  {
    id: 'stackNeg', group: '堆叠图', chart: 'cartesian',
    title: '正负堆叠柱', spec: 'BAR-05', surfaces: BOTH,
    description: '正值向上累计、负值向下累计，分别闭合。',
    cfg: (n) => ({
      categories: seq(n), stack: 'normal',
      series: [...posSeries(n, ['主营利润', '投资收益']), { name: '净亏损项', data: negWave(n) }],
    }),
  },
  {
    id: 'percent', group: '堆叠图', chart: 'cartesian',
    title: '归一化堆叠柱', spec: 'BAR-06', surfaces: BOTH,
    description: '每个类目归一到 100%，隐藏系列后占比重新计算。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润']), stack: 'percent' }),
  },
  {
    id: 'line', group: '折线图', chart: 'cartesian',
    title: '基础折线图', spec: 'LINE-01', surfaces: BOTH,
    description: '折线直连，null 处断开；数据点显隐随密度分档。',
    cfg: (n) => ({ categories: seq(n), series: [{ name: '指数', data: lineWave(n), type: 'line' }] }),
  },
  {
    id: 'line-multi', group: '折线图', chart: 'cartesian',
    title: '多折线图', spec: 'LINE-01 / COLOR-05', surfaces: BOTH,
    description: '主线保持标准线宽，其余线使用多折线细线 token。',
    cfg: (n) => ({
      categories: seq(n),
      series: posSeries(n, ['沪深300', '中证500', '创业板指']).map((s) => ({ ...s, type: 'line' })),
    }),
  },
  {
    id: 'line-stack', group: '折线图', chart: 'cartesian',
    title: '堆叠折线图', spec: 'LINE-01', surfaces: BOTH,
    description: '折线沿累计基线绘制，并在折线与基线之间填充同色区域。',
    cfg: (n) => ({
      categories: seq(n), stack: 'normal',
      series: posSeries(n, ['沪深300', '中证500', '创业板指']).map((s) => ({ ...s, type: 'line' })),
    }),
  },
  {
    id: 'combo', group: '组合图', chart: 'cartesian',
    title: '折柱组合 · 双 Y', spec: 'BAR-07 / SCALE-04', surfaces: BOTH,
    description: '柱走主轴、线走副轴，两轴共享网格并保持 0 轴对齐。',
    axisTitle: { y: '单位：元', y2: '增速（%）', x: '交易日' },
    cfg: (n) => ({
      categories: seq(n),
      series: [
        { name: '营业收入', data: wave(n), type: 'bar', axis: 'primary' },
        { name: '成本', data: wave(n, 0.9), type: 'bar', axis: 'primary' },
        { name: '营收增速', data: growth(n), type: 'line', axis: 'secondary' },
      ],
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
    title: '财报收支拆解', spec: 'SANKEY-01 / SANKEY-24', surfaces: BOTH,
    description: '收入、成本与利润按真实业务阶段展开，负值保留方向并参与有符号守恒。',
    summary: '15 节点 · 14 条流向 · 8 期',
    preferredWidth: 812,
    logicNote: '节点只接收业务角色、阶段与有符号流量；节点宽高、列距、最小可见粗细和主题语义色均由 Sankey token 解析。',
    playback: { periods: financialSankeyPeriods() },
    cfg: () => financialSankey(),
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
  sankey: '流向图',
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
  return {
    density: caps.density !== false,
    zoom: !!caps.zoom, dataLabel: !!caps.dataLabel, axisTitle: !!caps.axisTitle,
    animation: !!caps.animation, area: supportsArea(example), legend: !!caps.legend,
    labelLayout: !!caps.labelLayout, labelAlign: !!caps.labelAlign,
  };
};

/*
 * 示例 + 当前旋钮状态 → 传给 L2 组件的最终配置。
 * 铁律3/4：只装配**数据与语义配置**，样式一律走 token；预览面不得在此之外自加参数。
 *   state = { density='few', platform='pc', zoom, area, dataLabel, axisTitle, animation,
 *             legend, labelLayout, labelAlign } —— 各项皆可缺省
 *   labelLayout（饼环）= 'off' | 'outside' | 'inside'，缺省 'off' —— 它同时是显隐开关
 * 主题与明暗不进 cfg：它们写在容器的 data-theme / data-mode 上，走 CSS 级联 + behavior 解析。
 */
export function buildConfig(example, state = {}) {
  const {
    density = 'few', platform = 'pc', zoom = false, area = false,
    dataLabel = 'auto', axisTitle = false, animation = true, legend = 'auto',
    labelLayout = 'off', labelAlign = 'anchor',
  } = state;
  const caps = capabilitiesOf(example);
  const cfg = { ...example.cfg(DENSITY[density] ?? DENSITY.few), platform };

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
  /* [MOTION-07] 组件默认就播，故只有**关**才落进 cfg——「逻辑」面板里 cfg 无 animation = 走默认（开）。
     与 zoom / axisTitle「有才开」的方向相反，这里是「有才关」。 */
  if (caps.animation && animation === false) cfg.animation = false;
  return cfg;
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
