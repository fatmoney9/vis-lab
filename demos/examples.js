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
 * 本文件只留示例清单与族的查询；按职责拆出的几块由这里统一转出，**外部一律从本文件 import**：
 *   data/*.js        各图族的示例假数据
 *   density.js       数据量旋钮（离散三档 / 连续滑杆）
 *   capabilities.js  CHART_CAPABILITIES：各图表类型支持哪些语义旋钮
 *   config.js        buildConfig / describeConfig 与播放示例读取器
 *
 * ── 加一个新示例 ────────────────────────────────────────────────
 * 往 EXAMPLES 里加一项即可。必填 id / group / chart / title / spec / description / cfg；
 * surfaces 决定它出现在哪个面（缺省两面都进）。
 * **不要再加「验收要点」这类长说明**：验收口径的家是 specs/*.md 的「活 demo」小节（WORKFLOW §一
 * 「规范只有一个家」）。这里曾有过一个 notes 字段，最终长成了 specs/pie.md 的副本——
 * 复述必然漂移，故整个字段已移除，description 保持一句话。
 *
 * ── 加一种新图表（K 线 / 散点…）─────────────────────────────
 *   1. 在 registry.js 的 CHARTS 里登记「类型键 → L2 组件」（一行）
 *   2. 在 capabilities.js 的 CHART_CAPABILITIES 里声明该类型支持哪些语义旋钮（决定两面各自显示哪几个开关）
 *   3. 往 EXAMPLES 里加示例，chart 写成新类型键
 *   4. **在 nav-icons.js 里配分类图标**——首页左栏取不到图标会静默渲染成空串，
 *      不报错、不留痕；建议分类名与族名两个键都加
 *   5. **把业务词加进 chart-presentation.js 的 AINVEST_TEXT**——Ainvest 主题下
 *      图表内内容必须是英文
 * 预览面都不用改——它们按 chart 字段查表挂载、按能力声明画旋钮。
 * 第 4、5 步由门禁拦（lint-nav-icon.mjs / lint-ainvest-english.mjs），忘了会红。
 * ⚠️ 第 5 步有个够不着的盲点：翻译只发生在 config.js 的 buildConfig 里，**哪条路径手拼 cfg
 * 绕开它，翻译就在那条路径上失效**，而数据本身仍可翻译、那个守卫照样绿。
 * 2026-09-20 首页播放的 applyPeriod 就是这么漏的。喂配置一律走 buildConfig。
 *
 * ⚠️ 唯一破例的是桑基：SANKEY-23 要求 812px 横版财报外框与序列统一高度，三主题卡片网格表达不了，
 * 故另有 playground/sankey-preview.html 独立面，**自带节点与季度输入、不 import 本模块**
 * （全库唯一脱离单一示例源的展示面，改桑基示例仍要两处同步）；关键 P = B + D 公式复用
 * demos/sankey-financial.js，两个预览面里另有专属样式与旋钮接线。
 * 没有同类固定外框硬需求的新图型，照上面三步走即可，不要照抄桑基。
 */

import { financialSankeyPresentation } from './sankey-presentation.js';
import { waterfallPresentation } from './waterfall-presentation.js';
import { industryFlow } from './data/chord.js';
import { marketCapPeriods, marketCapPresentation } from './data/market-cap.js';
import { LONG_NAMES, SLICE_NAMES, longNameItems, skewItems, sliceItems } from './data/pie.js';
import { RADAR_DENSITY, RADAR_FIXED_MAX, RADAR_SEGMENTS, radarDims, radarSeries } from './data/radar.js';
import { financialSankey, financialSankeyPlayback } from './data/sankey.js';
import { FINANCIAL_SERIES_NAMES, MARKET_INDEX_SERIES_NAMES, growth, lineWave, negWave, posSeries, selectExampleSeries, seq, signedLineWave, signedWave, wave } from './data/series.js';
import { TREEMAP_SEMANTIC_THRESHOLDS, treemapHierarchy } from './data/treemap.js';

/* 原先住在本文件、已按职责拆出的公开导出：照旧从这里转出，既有 import 一处不用改。 */
export { CHART_CAPABILITIES, suggestedLegend } from './capabilities.js';
export { activePeriodExample, buildConfig, capabilitiesOf, clampPeriodIndex, describeConfig, playbackPeriodsOf, radarAxisLabelLayoutOf, radarEditableOf, radarGridShapeOf, radarShapeOf } from './config.js';
export { financialSankeyPeriods, makeFinancialSankeyQuarter } from './data/sankey.js';
export { growth } from './data/series.js';
export { treemapHierarchy } from './data/treemap.js';
export { DENSITY, clampDensity, defaultDensityCountOf, defaultDensityOf, densityControlOf, densityOptionsOf, densitySliderOf, densityUnitOf } from './density.js';

/* ── 两面共用的展示维度 ──────────────────────────────────────── */

/* 主题清单与内容语言住在 demos/themes.js（presentation 模块也要读，放这里会成环）；此处 re-export 保持既有 import */
export { THEMES } from './themes.js';

/* ── 示例清单 ────────────────────────────────────────────────── */

const BOTH = ['index', 'playground'];
const RADAR_REGRESSION = ['radar-preview'];
const RADAR_ALL_SURFACES = [...BOTH, ...RADAR_REGRESSION];

export const EXAMPLES = [
  {
    id: 'basic', group: '柱状图', chart: 'cartesian',
    title: '基础柱状图', spec: 'BAR-01 / BAR-03', surfaces: BOTH,
    description: '单系列正值柱状图，展示基础柱宽、间距、圆角与数据标签。',
    /* [CALLOUT-01] 标注文案住在示例对象上、不进 cfg(n)，旋钮打开才注入——与 axisTitle 同构。
       锚在柱顶外端，走 CALLOUT-02 的真实数据点档。 */
    callout: [{ series: '营业收入', category: '2', text: '该季度含一次性资产处置收益' }],
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
    /* [CALLOUT-02] 两档锚点各一条：真实数据点 + 任意数值坐标（住在示例对象上，理由同基础柱）。
       拖数据组数到 3 以下时第一条会消失——那是「类目不在可见窗口内就不出」的活演示。 */
    callout: [
      { series: '指数', category: '3', text: '若人人都按这个水平消耗资源，一年需要八个地球才够' },
      { category: '1', value: 0, text: '基准线' },
    ],
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
    id: 'market-cap-race', group: '排名变化', chart: 'hbar',
    title: '行业市值排名', spec: 'HBAR-10 / HBAR-12', surfaces: BOTH,
    description: '横向条按市值排名，随季度推进名次互换；只显示前 N 名，进出榜有滑入滑出。',
    densityRange: { min: 5, max: 12 }, densityValues: { few: 6, mid: 8, many: 12 }, densityUnit: '名',
    /* 数据量旋钮在本族的语义是 **Top-N**，不是类目数——所以 cfg 的入参叫 count。 */
    cfg: (count) => ({ ...marketCapPeriods().at(-1), topN: count }),
    presentation: marketCapPresentation,
    /* [HBAR-12] 播放：每期一帧。cfg(period, count) 让 Top-N 滑杆对播放示例也生效
       （activePeriodExample 会把数量透传进来）。 */
    playback: {
      periods: marketCapPeriods(),
      cfg: (period, count) => ({ ...period, topN: count }),
    },
  },
  {
    /* [HBAR-01] 不给时间序列就是静态横向条：与竞赛示例同一份数据的最后一期，只是不接播放。 */
    id: 'market-cap-rank', group: '排名变化', chart: 'hbar',
    title: '行业市值排名（静态）', spec: 'HBAR-01 / HBAR-04', surfaces: BOTH,
    description: '不给时间序列时就是静态横向条：按市值从高到低排列，只显示前 N 名。',
    densityRange: { min: 5, max: 12 }, densityValues: { few: 6, mid: 8, many: 12 }, densityUnit: '名',
    cfg: (count) => ({ ...marketCapPeriods().at(-1), topN: count }),
    presentation: marketCapPresentation,
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
    id: 'sankey-financial', group: '桑基图', chart: 'sankey',
    title: '财报收支拆解', spec: 'SANKEY-01 / SANKEY-24 / SANKEY-26', surfaces: BOTH,
    description: '收入、成本与利润按真实业务阶段展开，负值保留方向并参与有符号守恒。',
    summary: '15 节点 · 14 条流向 · 8 期',
    preferredWidth: 812,
    logicNote: '节点只接收业务角色、阶段与有符号流量；节点宽高、列距、最小可见粗细和主题语义色均由 Sankey token 解析。',
    presentation: financialSankeyPresentation,
    summaryByLocale: { en: '15 nodes · 14 flows · 8 periods' },
    playback: financialSankeyPlayback(),
    cfg: () => financialSankey(),
  },
  {
    id: 'chord-sector-flow', group: '弦图', chart: 'chord',
    title: '行业资金流向', spec: 'CHORD-01 / CHORD-05 / CHORD-11', surfaces: BOTH,
    description: '主力资金在申万一级行业之间的流转：外圈一段弧是一个行业，圈内的带是两个行业之间的往来，带的两端粗细分别是两个方向的量。',
    summary: '6 个行业 · 双向流量',
    summaryByLocale: { en: '6 sectors · two-way flows' },
    densityValues: { few: 4, mid: 6, many: 10 },
    densityRange: { min: 4, max: 10 },
    densityUnit: '个行业',
    densityControl: {
      label: '行业数',
      hint: '组件下限是 3（CHORD-01）；示例从 4 起，10 已接近可读上限',
      default: 'mid',
      labels: { few: '4个', mid: '6个', many: '10个' },
    },
    logicNote: '组件只接收实体名与 n×n 流量方阵；弧长、弦宽、配色、透明度与标签排布全部由规范数据决定。对角线（行业自流）被忽略，负值与非数按 0。',
    cfg: (count) => industryFlow(count),
  },
  {
    id: 'waterfall-bridge', group: '瀑布图', chart: 'waterfall',
    title: '累计桥接瀑布图', spec: 'WATERFALL-01 / WATERFALL-09', surfaces: BOTH,
    description: '从营业收入经过成本与费用的有符号增减，得到净利润；三主题均使用各自主题色的浅底箭头柱。',
    summary: '5 个叙事项 · 累计守恒',
    preferredWidth: 630,
    logicNote: 'kind 与有符号 value 决定累计公式；operatorBefore 只负责等式叙事，颜色模式、箭头形态和格式化分别由语义配置、behavior 与 L1 构件解析。',
    presentation: waterfallPresentation,
    cfg: () => ({
      name: '利润桥接', period: '2024 三季报', variant: 'standard',
      xAxisContent: 'name', showRelations: true,
      items: [
        { id: 'revenue', name: '营业收入', axisLabel: ['营业收入'], kind: 'total', value: 98.1e9, percent: 2.242 },
        { id: 'cost', name: '营业成本', axisLabel: ['营业成本'], kind: 'delta', value: -8.4e9, operatorBefore: '+', percent: -12.12 },
        { id: 'gross', name: '毛利', axisLabel: ['毛利'], kind: 'subtotal', value: 89.7e9, operatorBefore: '=' },
        { id: 'other-expenses', name: '其他费用', axisLabel: ['其他费用'], kind: 'delta', value: -10.6e9, operatorBefore: '-', percent: -5.18 },
        { id: 'net-income', name: '净利润', axisLabel: ['净利润'], kind: 'total', value: 79.1e9, operatorBefore: '=' },
      ],
    }),
  },
  {
    id: 'waterfall-data', group: '瀑布图', chart: 'waterfall',
    title: '分组数据柱瀑布图', spec: 'WATERFALL-04 / WATERFALL-12', surfaces: BOTH,
    description: '总资产由分段构成，扣除负债后得到所有者权益；段内标签按可用高度自动退场。',
    summary: '3 个等式项 · 5 个数据段',
    preferredWidth: 630,
    logicNote: 'segments 在所属项区间内连续累计，value 可由有符号段和值推导；X 轴固定展示项目名称，分段和值在柱内与 Tooltip 中读取。',
    presentation: waterfallPresentation,
    cfg: () => ({
      name: '资产负债构成', period: '2024 三季报', variant: 'data',
      xAxisContent: 'name', showRelations: true,
      items: [
        {
          id: 'assets', name: '总资产', axisLabel: ['总资产'], kind: 'total',
          segments: [
            { id: 'current-assets', name: '流动资产', value: 2e12, percent: 2.242 },
            { id: 'non-current-assets', name: '非流动资产', value: 6e12 },
          ],
        },
        {
          id: 'liabilities', name: '总负债', axisLabel: ['总负债'], kind: 'delta', operatorBefore: '=',
          segments: [
            { id: 'current-liabilities', name: '流动负债', value: -3e12, percent: -2.242 },
            { id: 'non-current-liabilities', name: '非流动负债', value: -2e12 },
          ],
        },
        { id: 'equity', name: '所有者权益', axisLabel: ['所有者权益'], kind: 'total', value: 3e12, operatorBefore: '+' },
      ],
    }),
  },

  /* ── 边界与极端情况（**只进 playground**）────────────────────────
     对外站点是画廊，不该摆这些；但它们是改标签 / 图例 / 取色时最先该看的几张图。
     每个示例只推**一个**边界，出问题时能一眼定位是哪条规则塌了。 */
  {
    id: 'world-heatmap-market', group: '全球热力图', chart: 'world-heatmap',
    title: '全球市场热力图', spec: 'WORLD-HEATMAP-01 / WORLD-HEATMAP-06', surfaces: BOTH,
    description: '按国家市场热度分五档着色；hover 国家时显示国旗、名称与读数。',
    summary: '12 个国家 · 五档强度',
    summaryByTheme: { ainvest: '12 countries · five intensity levels' },
    preferredWidth: 700,
    logicNote: '实例只提供 ISO 国家码、名称与数值；底图几何、五档透明度、国界、主题色与 Tooltip 形态由组件和 token 统一决定。',
    cfg: () => ({
      name: '全球市场热度',
      regions: [
        { id: 'US', name: '美国', value: 4.82 },
        { id: 'CN', name: '中国', value: 2.13 },
        { id: 'JP', name: '日本', value: 3.64 },
        { id: 'DE', name: '德国', value: 3.12 },
        { id: 'RU', name: '俄罗斯', value: 2.78 },
        { id: 'IN', name: '印度', value: 2.26 },
        { id: 'SA', name: '沙特阿拉伯', value: 1.94 },
        { id: 'AU', name: '澳大利亚', value: 1.62 },
        { id: 'CA', name: '加拿大', value: 1.48 },
        { id: 'ZA', name: '南非', value: 1.21 },
        { id: 'BR', name: '巴西', value: 1.03 },
        { id: 'AR', name: '阿根廷', value: 0.82 },
      ],
    }),
  },
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
  hbar: '排名对比图',
  /* chord → 关系流向图：桑基已占「流向图」，而两者是**两个 L2 组件**，按本表
     「一个组件一族」的口径必须分开列（族名恒出的理由见 index.html renderNavigation
     的注释）。差别也正在名字里——桑基是一笔总量的纵向拆解，弦图是同一组实体之间的相互流动。 */
  chord: '关系流向图',
  pie: '占比图',
  radar: '多维对比图',
  sankey: '流向图',
  treemap: '层级占比图',
  waterfall: '过程变化图',
  'world-heatmap': '地理空间图',
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
