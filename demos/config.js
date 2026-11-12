/*
 * L3 · 配置装配：把「示例 + 旋钮状态」装成组件 cfg（buildConfig / describeConfig），以及播放示例的读取器。
 * 各面一律经这里喂配置——手拼 cfg 会绕开 Ainvest 英文翻译（见 examples.js 文件头第 5 步的盲点）。
 * 由 demos/examples.js 统一转出；只装数据与纯函数，不 import d3、不碰 DOM。
 */

import { chartContentPresentation } from './chart-presentation.js';
import { AXIS_TITLES, CHART_CAPABILITIES, INITIAL_ZOOM } from './capabilities.js';
import { RADAR_RATING_BAND_LABELS } from './data/radar.js';
import { clampDensity, defaultDensityCountOf, defaultDensityOf, densityOptionsOf } from './density.js';

/*
 * ── 播放示例的三个共享读取器 ──────────────────────────────────────
 * 住在这里而不是各预览面里，是因为「面不自己拼配置」（铁律3）：
 * 从示例读出当前期、夹取序号、把当前期伪装成普通示例，三面都要做同一件事。
 */

/* 取全部期并按主题做文案适配。**每次读取都重跑 presentation**，所以切 Ainvest 时期数文案一起变。 */
export const playbackPeriodsOf = (example, { theme = 'ths' } = {}) => (
  (example?.playback?.periods ?? []).map((period) => example?.presentation?.(period, { theme }) ?? period)
);

export const clampPeriodIndex = (example, index = 0, { theme = 'ths' } = {}) => {
  const periods = playbackPeriodsOf(example, { theme });
  return periods.length ? Math.max(0, Math.min(periods.length - 1, Math.round(index))) : 0;
};

/*
 * 把「当前期」伪装成普通示例，混进统一的 buildConfig 管线——下游完全不知道有播放这回事。
 *
 * ⚠️ **cfg 必须把密度参数透传下去**。2026-09-20 之前这里是 `cfg: () => period`，**形参为空**，
 * 于是播放示例的密度滑杆完全失效。桑基没暴露，只因为它声明了 `density: false`、根本没有滑杆；
 * 第一个同时要「数据量旋钮」和「播放」的图型会当场踩到。
 * 示例可声明 `playback.cfg(period, count)` 来消费数量；不声明则原样返回该期（桑基即此，零回归）。
 */
export const activePeriodExample = (example, { periodIndex = 0, theme = 'ths' } = {}) => {
  const periods = playbackPeriodsOf(example, { theme });
  if (!periods.length) return example;
  const period = periods[clampPeriodIndex(example, periodIndex, { theme })];
  const perPeriodCfg = example.playback?.cfg;
  return {
    ...example,
    presentation: undefined,
    cfg: (count) => perPeriodCfg?.(period, count) ?? period,
  };
};

const supportsArea = (example) => {
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
    /* [CALLOUT-01] 标注的内容由示例携带，没声明内容的示例不出这个旋钮
       （按示例条件化，先例同 ratingStyle / radarEditable / area） */
    callout: !!caps.callout && Array.isArray(example.callout) && example.callout.length > 0,
    animation: !!caps.animation, area: supportsArea(example), legend: !!caps.legend,
    labelLayout: !!caps.labelLayout, labelAlign: !!caps.labelAlign,
    legendSelect: !!caps.legendSelect, yIndicator: !!caps.yIndicator,
    treemapColor: !!caps.treemapColor, treemapImage: !!caps.treemapImage, axisValue: !!caps.axisValue,
    radarGridShape: !!caps.radarGridShape, radarShape: !!caps.radarShape,
    ratingStyle: !!caps.ratingStyle && ratingRadar,
    ratingBandCount: !!caps.ratingBandCount && ratingRadar,
    axisLabelLayout: !!caps.axisLabelLayout,
    chordVariant: !!caps.chordVariant, chordLabelLayout: !!caps.chordLabelLayout,
    radarEditable: !!caps.radarEditable && singleSeriesRadar,
    waterfallColor: !!caps.waterfallColor,
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
 *             ratingStyle, ratingBandCount, axisLabelLayout, radarEditable, waterfallColor, callout } —— 各项皆可缺省
 *   labelLayout（饼环）= 'off' | 'outside' | 'inside'，缺省 'off' —— 它同时是显隐开关
 *   callout —— 缺省 false：打开才把示例自带的 callout 文案注入 cfg（CALLOUT-01，同 axisTitle）
 * 主题与明暗不作为样式参数进 cfg：它们写在容器的 data-theme / data-mode 上，走 CSS 级联 +
 * behavior 解析。theme 在这里仅允许驱动 L3 presentation 文案映射：Ainvest 图表内部内容
 * 统一经 chart-presentation.js 转为英文；站点外壳仍保持中文。
 */
export function buildConfig(example, state = {}) {
  const {
    density = defaultDensityOf(example), theme = 'ths', platform = 'pc', zoom = false, area = false,
    dataLabel = 'auto', axisTitle = false, animation = true, legend = 'auto', callout = false,
    labelLayout = 'off', labelAlign = 'anchor', legendSelect = 'multi', yIndicator = false,
    treemapColor = 'intensity', treemapImage = false, axisValue = false,
    radarGridShape = 'auto', radarShape = 'auto', ratingStyle = 'gradient', ratingBandCount = '6',
    axisLabelLayout = 'auto', radarEditable = 'auto', waterfallColor = 'primary',
    chordVariant = 'undirected', chordLabelLayout = 'arc',
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
  /* [CALLOUT-01] 标注：**默认不显示，旋钮打开才注入**示例自带的文案——与 axisTitle 同构。
     可选叠加层一律默认关：画廊缩略图与详情页首屏都应是图表的规范原貌，批注由人主动打开。
     2026-09-17 曾默认开（内容放在 cfg(n) 里、关掉再删），上线后首页基础柱 / 基础折线的
     缩略图都带着批注，当天改回。逐条浅拷贝：注入的是示例上的共享数组，别让下游改到它。 */
  if (caps.callout && callout && example.callout?.length) cfg.callout = example.callout.map((c) => ({ ...c }));
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
  /* [TREEMAP-18] 公司标识：组件默认关，只有**开**才落进 cfg（同 zoom / axisTitle 的口径）。 */
  if (caps.treemapImage && treemapImage) cfg.showImage = true;
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
  /* [WATERFALL-10] Figma 的验收配置只保留主色 / 语义色两档，预览面始终显式下发当前选择。
     [WATERFALL-12] xAxisContent / showRelations 直接来自示例 cfg，是代码配置而非预览旋钮。 */
  if (caps.waterfallColor) cfg.colorMode = waterfallColor;
  /* [CHORD-05][CHORD-11] 两档 variant 与两档标签排列都是**形态语义**（同 pie 的 variant）。
     'undirected' 与 'arc' 是组件默认，故选中默认档时什么都不落进 cfg——「逻辑」面板里
     没有这两个字段就等于走组件默认，与 animation 同一口径。 */
  if (caps.chordVariant && chordVariant !== 'undirected') cfg.variant = chordVariant;
  if (caps.chordLabelLayout && chordLabelLayout !== 'arc') cfg.entityLabelLayout = chordLabelLayout;
  /* [MOTION-07] 组件默认就播，故只有**关**才落进 cfg——「逻辑」面板里 cfg 无 animation = 走默认（开）。
     与 zoom / axisTitle「有才开」的方向相反，这里是「有才关」。 */
  if (caps.animation && animation === false) cfg.animation = false;
  return chartContentPresentation(cfg, { theme, chart: example.chart });
}

/*
 * 「逻辑」面板完整展示传给 L2 组件的实例配置。节点、流向、类目、系列与逐点数据
 * 一律原样保留，便于核对 Sankey 的 role / stage / order / negativeSource 等数据语义。
 * 这里仍然**不补任何默认值**：cfg 里没有 stack / animation 就是「走组件默认」，
 * 面板照实不显示——L2 几何、主题 token 与 behavior 不是实例入参，不能混进来冒充可配置项。
 * 主题 / 明暗不在此：它们不进 cfg，走容器的 data-* 属性 + CSS 级联。
 */
export function describeConfig(example, state = {}) {
  return buildConfig(example, state);
}
