/*
 * cartesian/index.js —— 【CartesianChart 编排器（公开入口）】
 *
 * 干什么：直角坐标图（x-y 轴）的**拼装编排**。它自己几乎不算东西——而是把
 * L1 构件（frame/scale/grid/axis/legend/format/theme + palette 取色 + mark 画柱/线）
 * 按顺序拼起来，具体的「值域怎么算 / 柱怎么排 / 堆叠怎么累 / hover 怎么接」分别派发给
 * 同目录的 domain.js / layout.js / series.js / hover.js，本文件只负责串流程 + 接图例。
 *
 * 组合形态靠三旋钮（≠ 样式；样式走 token/主题）：
 *   ① stack（none/normal/percent）· ② 每系列 type（bar/line）· ③ 每系列 axis（primary/secondary）
 * 柱（基础/分组/堆叠/归一化）· 折线 · 折柱组合 · 双 Y 都是这三个的取值组合。
 * 边界：只管直角坐标系（柱/线/面积/散点/折柱组合）；饼/环/雷达是另一套骨架，不在此。
 * 只吃数据 + 语义配置，不暴露样式参数（颜色按 COLOR 固定槽位、不接受配置）。
 *
 *   host  容器元素（须挂在带 data-theme 的祖先内，且自身有高度）
 *   cfg   { categories, series:[{name,data,type?,axis?}], stack='none', platform='pc', unit, align='left',
 *           zoom, dataLabel='auto', axisTitle, animation=true }
 *         type 默认 bar / axis 默认 primary
 *         dataLabel（语义配置，非样式）：'auto' 按图表类型定默认 / true 全开 / false 全关（LABEL-05）
 *         axisTitle（语义配置，文案即内容）：{ y, y2, x } 三个可选字符串，默认不显示（AXISTITLE-01）
 *         animation（语义配置，"要不要有入场行为"，时长/缓动仍走 token 与规范值常量）：
 *           true 入场生长 / false 直接终态；系统「减弱动态效果」下恒直接终态（MOTION-07）
 */
import { select } from 'd3';
import { createFrame, observeResize, verticalGeometry } from '../../core/frame.js';
import { niceSplit, niceSplitDual } from '../../core/split.js';
import { linearY, bandX } from '../../core/scale.js';
import { renderGrid } from '../../core/grid.js';
import { renderYLabels, renderXLabels, yLabelInset, measureYLabelWidth } from '../../core/axis.js';
import { tokenNum } from '../../core/tokens.js';
import { resolveBehavior, modeOf } from '../../core/theme.js';
import { makeFormatter } from '../../core/format.js';
import { resolveSeriesColors } from '../../core/palette.js';
import { renderBars, renderLine } from '../../core/mark.js';
import { renderLegend } from '../../core/legend.js';
import { applyToggle, applyFocus } from '../../core/legend-state.js';
import { renderDataZoom } from '../../core/datazoom.js';
import { renderWatermark } from '../../core/watermark.js';
import { renderDataLabels } from '../../core/label.js';
import { axisTitleBand, axisTitleAnchor, renderAxisTitles } from '../../core/axis-title.js';
import { runGrowth, reducedMotion } from '../../core/motion.js';
import { resolveSeries } from './series.js';
import { bindHover } from './hover.js';
import { axisDomain } from './domain.js';
import { groupedBars, singleBar, stackBars } from './layout.js';

export function CartesianChart(host, cfg) {
  const { categories, series, stack = 'none', platform = 'pc', unit, align = 'left', zoom, dataLabel = 'auto', axisTitle, animation = true, legendSelect = 'multi', yIndicator = false } = cfg;
  /* [GRID-03] 调用方明确给容器高度时随容器适配；未给高度时使用主题默认高度包络 token。 */
  let usesContainerHeight = host.clientHeight >= 40;

  const resolved = resolveSeries(series);                 /* 归一化：补默认 type/axis（见 series.js） */
  const keys = resolved.map((r) => r.name);
  const dual = resolved.some((r) => r.axis === 'secondary'); /* 用声明判定，副轴存在性稳定 */

  /* [COLOR-02..05] 按类型固定槽位配色：柱走 bar-multi、线走 line-multi；写成 host 上的 CSS 变量。
     hex 顺手留在 resolved 上——数据标签档② 要按背景明暗反色（LABEL-04），需要色值本身而非变量名。 */
  resolveSeriesColors(host, { series: resolved }).forEach((hex, i) => {
    host.style.setProperty(resolved[i].colorVar, hex);
    resolved[i].colorHex = hex;
  });

  const b = resolveBehavior(host, platform);
  const yForm = b['y-label-form'];
  const ySide = b['y-main-side'];
  const oppSide = ySide === 'left' ? 'right' : 'left';
  const mirror = b['y-dual-shared'] && !dual; /* [AXIS-02] iFinD 单轴：反侧镜像主轴同一套标签；真·双量纲仍走标准 dual（两侧各一套不同值） */
  /* [AXISTITLE-01/03] 轴标题：默认不显示——不给文案就没有标题（带高 0，几何与不带标题时逐像素一致）。
     y2 只在**真·双量纲**（声明了 axis:'secondary'）时出：iFinD 的镜像反侧是主轴同一套刻度、不是第二根轴。 */
  const titles = axisTitle ?? {};
  const showY2Title = !!titles.y2 && dual;
  const collision = b['x-collision'];
  const yAlign = b['y-label-align'];        /* [AXIS-03] Ainvest 右对齐特例 */
  const pointShape = b['line-point-shape']; /* [LINE-01] 数据点形状（iFinD 菱形特例） */
  const marker = b['legend-marker'];
  const format = makeFormatter(b['number-format']);       /* [FORMAT-01] */
  const pctFormat = (v) => `${Math.round(v * 100)}%`;     /* [BAR-06] 归一化轴 */

  /* [DATAZOOM-02/03/04] 缩放轴形态（behavior）+ 初始窗口。zoom 语义配置（WORKFLOW §四 铁律4 允许 initialZoom 一类）：
     true = 启用全窗；{start,end}（0..1 比例）= 启用并设初始窗口；缺省/假值 = 不启用（布局与原状一致）。 */
  const dzAlign = b['datazoom-align'];
  const dzShadow = b['datazoom-data-shadow'];
  const dzHandle = b['datazoom-handle'];
  const dzLabel = b['datazoom-label']; /* [DATAZOOM-05] 手柄两侧标签仅 iFinD 显示 */
  const wm = b['watermark'];           /* [WATERMARK-01..05] 水印品牌 logo（三主题恒有，见 behavior.json） */
  const dzHandleH = dzHandle.shape === 'circle' ? dzHandle.w : dzHandle.h;
  const N = categories.length;
  const zoomOn = !!zoom && N >= 2;
  let win = { i0: 0, i1: Math.max(0, N - 1) };
  if (zoomOn && zoom !== true) {
    const s = Math.max(0, Math.min(1, zoom.start ?? 0));
    const e = Math.max(s, Math.min(1, zoom.end ?? 1));
    win = { i0: Math.min(N - 1, Math.floor(s * N)), i1: Math.max(0, Math.min(N - 1, Math.ceil(e * N) - 1)) };
    if (win.i1 < win.i0) win.i1 = win.i0;
  }

  const legendItems = resolved.map((r) => ({ key: r.name, label: r.name, type: r.type, colorVar: r.colorVar }));
  /* [LEGEND-06][LEGEND-14] 点击的两条状态线，按 legendSelect 分流、互不相干：
     hidden 是「筛」（multi / single 档改它，隐藏系列退出值域计算）、
     selected 是「强调」（focus 档改它，值域一点不动、只改视觉权重）。
     两者都挂在 build 外——resize / 显隐会整树重绘，状态不该因此丢失。 */
  const state = { hidden: new Set(), selected: null };
  let hoverKey = null;

  /* DOM 骨架（一次性）：图例在上、绘图区在下（LEGEND-04） */
  host.classList.add('dv-chart');
  const legendHost = select(host).append('div').attr('class', 'dv-chart__legend').node();
  const plotHost = select(host).append('div').attr('class', 'dv-chart__plot').node();

  /* [LEGEND-05] hover 弱化：柱 / 线系列 <g> 的 opacity，图例本身不动。
     数据标签也按系列分组（dataset.key 同名），随其所属系列一起弱化——否则柱变淡、数字仍全黑。 */
  /* [LEGEND-05][LEGEND-14] 弱化的**唯一出口**：两个来源都收在这里，各自不单独写 opacity。
     hover 是临时态、选中是常驻态，**hover 优先**——指针停在 B 上时读的就该是 B，
     松开后自然回落到常驻的那个（PIE-10「两者独立叠加」的同一条取舍）。
     `??` 而非 `||`：hoverKey 的「无」是 null，用 || 会让空串一类的假值也穿透。 */
  function applyDim() {
    const emph = hoverKey ?? state.selected;
    const dim = getComputedStyle(host).getPropertyValue('--opacity-visualization-dim').trim() || '1';
    select(plotHost).selectAll('g.dv-bar-series, g.dv-line-series, g.dv-data-label-series')
      .attr('opacity', function () { return emph && this.dataset.key !== emph ? dim : 1; });
  }

  function drawLegend() {
    renderLegend(legendHost, legendItems, {
      marker, align, state,
      /* [LEGEND-06][LEGEND-14] 按档分流：focus 只动 selected（不重排数据，故**不必 build**，
         改一层 opacity 就够）；multi / single 动 hidden，值域要按可见系列重算，必须整树重绘。 */
      onToggle: (key) => {
        if (legendSelect === 'focus') {
          state.selected = applyFocus(state.selected, key);
          drawLegend();
          applyDim();
          return;
        }
        state.hidden = applyToggle(state.hidden, key, keys, legendSelect);
        hoverKey = null;
        build();
      },
      onHover: (key) => { hoverKey = key; applyDim(); },
    });
  }

  const seriesG = (cls, key) => {
    const g = select(plotHost).select('svg').append('g').attr('class', cls);
    g.node().dataset.key = key;
    return g;
  };
  let stopHover = () => {};
  /* [MOTION-04] 入场生长只在实例首次挂载时播一次——build() 同时被 resize / 图例显隐 / 缩放轴拖动
     复用，不加这个标记的话拖一次滑块就会每帧重启动画。stopGrow 收口同 stopHover 的模式。 */
  let firstBuild = true;
  let stopGrow = () => {};

  /* 主流程：值域(domain) → 画布/轴/网格 → 柱布局(layout)+柱 mark → 线 mark → 交互态 → 入场生长 */
  function build() {
    stopHover();
    stopHover = () => {};
    stopGrow();
    stopGrow = () => {};
    drawLegend(); /* 图例先占位，绘图区再按剩余高度算（LEGEND-04） */
    if (usesContainerHeight && plotHost.clientHeight < 40) return requestAnimationFrame(build);
    plotHost.innerHTML = '';

    /* [DATAZOOM-07] 可见窗口切片：主图只吃窗口内类目/数据 → 下游 niceSplit / bandX / mark / hover
       全部对可见数据成立（SCALE-02：Y 按可见值域重算、分割线数不变；X 碰撞 AXIS-06、outside 列宽 AXIS-08 即时重判）。
       缩放轴本体（下方）仍拿全量 categories/resolved 画迷你阴影。 */
    const viewCats = zoomOn ? categories.slice(win.i0, win.i1 + 1) : categories;
    const viewResolved = zoomOn ? resolved.map((r) => ({ ...r, data: r.data.slice(win.i0, win.i1 + 1) })) : resolved;

    const primary = viewResolved.filter((r) => r.axis === 'primary');
    const secondary = viewResolved.filter((r) => r.axis === 'secondary');
    const yFormat = stack === 'percent' ? pctFormat : format;

    /* [DATAZOOM-01] 缩放带高度：启用时预留「上间距 6 + max(轨道高, 手柄高) + 下间距 6」；不启用为 0（无回归）。
       上下 6px 为结构留白常量（比 X 带的 4px 略大，给缩放轴与 X 标签多留分隔；待 token 化）。 */
    const dzSliderH = zoomOn ? (tokenNum(plotHost, '--size-slider-height') || 16) : 0;
    const navH = zoomOn ? 6 + Math.max(dzSliderH, dzHandleH) + 6 : 0;
    /* [AXISTITLE-02] 标题带高：Y（主/副任一有标题）在顶、X 在底；无标题即 0，几何与原状一致。 */
    const titleGap = tokenNum(plotHost, '--spacing-axis-title-gap');
    const titleLineH = tokenNum(plotHost, '--line-height-axis-title');
    const titleBand = axisTitleBand(titleLineH, titleGap);
    const titleTopH = titles.y || showY2Title ? titleBand : 0;
    const titleBottomH = titles.x ? titleBand : 0;

    /* [LABEL-05] 标签显隐判定：只依赖声明（系列构成 + dataLabel），与几何无关，故可提到算刻度之前。
       柱仅单柱系列出标签、线仅纯折线且单条；dataLabel:true/false 强制覆盖。 */
    const stacked = stack !== 'none';
    const bars = viewResolved.filter((r) => r.type === 'bar');
    const lines = viewResolved.filter((r) => r.type === 'line');
    const showBarLabel = dataLabel === true || (dataLabel !== false && !stacked && bars.length === 1);
    const showLineLabel = dataLabel === true || (dataLabel !== false && !bars.length && lines.length === 1);

    /* [LABEL-10][SCALE-03] 数据标签的呼吸位：会出标签时，要求图元末端离边界刻度至少一个标签高
       （行高 + 图元净距，两者皆有 token，无需设计另给数值）。这里把像素需求换算成刻度算法认识的
       「轴跨度占比」交给 niceSplit —— 于是呼吸位落在**网格内部**：刻度不再顶格，标签自然有地方待，
       而 X 标签带与网格线的距离一步不动。
       绘图区高度与刻度无关（刻度只影响 Y 标签列宽），故能先问出来、不必先画一趟再重算。 */
    const labelGap = tokenNum(plotHost, '--spacing-data-label-gap');
    const labelLineH = tokenNum(plotHost, '--line-height-data-label');
    const labelHeadroom = (showBarLabel || showLineLabel) ? labelLineH + labelGap : 0;
    const { gridH } = verticalGeometry(plotHost, {
      ...(usesContainerHeight ? { height: plotHost.clientHeight } : {}),
      yForm, navH, titleTopH, titleBottomH,
    });
    const headroom = labelHeadroom > 0 && gridH > 0 ? labelHeadroom / gridH : 0;

    /* [SCALE-01/04] 值域（见 domain.js）：双轴共享刻度 + 0 对齐；单轴普通 niceSplit */
    let pSplit;
    let sSplit;
    if (dual) {
      const dd = niceSplitDual(axisDomain(viewCats, primary, stack, state.hidden), axisDomain(viewCats, secondary, stack, state.hidden), { headroom });
      pSplit = dd.primary; sSplit = dd.secondary;
    } else {
      pSplit = niceSplit(...axisDomain(viewCats, primary, stack, state.hidden), { headroom });
    }

    /* [AXIS-02] 反侧 Y 标签的刻度来源：真·双量纲 = 副轴另一套（dual）；iFinD 单轴 = 镜像主轴同一套（mirror）；否则无 */
    const oppTicks = dual ? sSplit.ticks : mirror ? pSplit.ticks : null;

    /* [AXIS-08] 列宽：outside 时主轴 + 反侧（副轴/镜像）各自测量。
       轴标题不参与——它贴画布外缘，与标签列宽无关（AXISTITLE-04）。 */
    const yLabelWidth = yForm === 'outside' ? measureYLabelWidth(plotHost, pSplit.ticks.map(yFormat)) : 0;
    const yLabelWidthSecondary = oppTicks && yForm === 'outside' ? measureYLabelWidth(plotHost, oppTicks.map(yFormat)) : 0;
    const frame = createFrame(plotHost, {
      ...(usesContainerHeight ? { height: plotHost.clientHeight } : {}),
      yForm, ySide, yLabelWidth, yLabelWidthSecondary, navH,
      titleTopH, titleBottomH, titleGap,
    }); /* [GRID-03][DATAZOOM-01][AXISTITLE-02] */

    const yP = linearY(pSplit, frame.grid.top, frame.grid.bottom);
    const yS = dual ? linearY(sSplit, frame.grid.top, frame.grid.bottom) : yP;
    const yOf = (r) => (r.axis === 'secondary' ? yS : yP);

    /* [AXIS-01] inside 数据让位：反侧有标签（副轴/镜像）则两侧都让 */
    let dataL = frame.grid.left;
    let dataR = frame.grid.right;
    if (yForm === 'inside') {
      const insetP = yLabelInset(plotHost, pSplit.ticks, yFormat);
      if (ySide === 'left') dataL += insetP; else dataR -= insetP;
      if (oppTicks) {
        const insetO = yLabelInset(plotHost, oppTicks, yFormat);
        if (oppSide === 'left') dataL += insetO; else dataR -= insetO;
      }
    }

    /* x 排布：有柱（单柱/分组/堆叠）一律 slot=铺满整格、格间距最小 0（侧白/组间距归容器残量，见 bandX）；纯折线点居中留 inset */
    const xMode = bars.length ? 'slot' : 'center';
    const x = bandX(viewCats, dataL, dataR, { mode: xMode });

    renderGrid(frame.svg.append('g'), frame, pSplit.ticks, yP); /* [GRID-01] 网格用主轴刻度像素位 */
    renderYLabels(frame.svg.append('g'), frame, pSplit.ticks, yP, { form: yForm, side: ySide, format: yFormat, align: yAlign }); /* [AXIS-01/03] */
    if (oppTicks) renderYLabels(frame.svg.append('g'), frame, oppTicks, yS, { form: yForm, side: oppSide, format: yFormat, align: yAlign }); /* [AXIS-02] 反侧：副轴另一套 / iFinD 镜像同一套 */
    renderXLabels(frame.svg.append('g'), frame,
      viewCats.map((c) => ({ label: c, x: x(c) + x.bandwidth() / 2 })), { collision }); /* [AXIS-04..06] */

    /* [TOOLTIP-11] 纯分组柱（判定按声明：全 bar + stack:none + ≥2 系列）hover 指示线换 block 底色带：
       层此刻创建 → 在网格/轴之上、后续 mark 之下（是底色不是遮罩）；渲染与显隐接线见 bindHover */
    const hoverBlock = stack === 'none' && !lines.length && bars.length >= 2;
    const blockLayer = hoverBlock ? frame.svg.append('g').style('display', 'none') : null;

    /* ── [LABEL-01/05/07] 数据标签：本层只算「摆哪、要不要摆、写什么」，渲染 / 碰撞 / 反色归 L1 ──
       默认显隐按图表类型（LABEL-05）——只在「一个类目一个值」时默认出标签：
         柱：仅**单柱系列**（声明 1 个 bar 系列，含折柱组合里的唯一柱）；分组柱、堆叠、归一堆叠都不出
         线：仅**纯折线且单条**；多折线不出；**折柱组合里的折线也不出**（有柱在场，标签让给柱）
       dataLabel:true/false 强制覆盖（true 时分组 / 堆叠也画，走同一套放不下就不放的规则）。
       文本走与轴 / tooltip 同一份 makeFormatter（LABEL-07）。
       锚点在各 mark 分支里顺手算进 labelBatches（复用同一批 slots / segs，不重算布局），
       统一到所有 mark 之后渲染 —— 层级见 LABEL-08。 */
    /* [LABEL-06①] 密度阈值：**柱与线统一**——某系列在当前可见窗口内的非 null 值多于 5 个 →
       该系列标签整体不出（不是逐个挑着显示）。5 与 line.md 的数据点 >13 同属规范值常量。
       缩放后窗口内 ≤5 会重新出现（与 SCALE-02 的窗口重算同一口径）。 */
    const withinLabelDensity = (values) => values.filter((v) => v != null).length <= 5;
    /* [LABEL-01] 净距一律从**图元边缘**算起：柱是柱顶边，折线是数据点外缘——故折线要再让开点的半高，
       否则 4px 全被点吃掉（THS 点直径 6 → 半高 3，净距只剩 1px）。
       半高：circle = 直径/2；diamond（iFinD）= 正方形绕中心转 45°，含描边的半对角 = 直径 × √2/2。 */
    const linePointH = (tokenNum(plotHost, '--size-line-point') || 6) * (pointShape === 'diamond' ? Math.SQRT1_2 : 0.5);
    const labelText = (v) => (v == null ? null : (stack === 'percent' ? pctFormat : format)(v));
    const labelBatches = [];
    let labelLayer = null;

    /* [MOTION-01/02] 入场生长：收集各图元的逐帧重绘闭包（mark 层返回的 draw(t)）。
       时长全图统一（MOTION-02），故这里只收闭包、不需要按图元折算任何东西——
       柱竖向、线横向同时起跑同时到达，节奏天然一致。 */
    const grow = [];

    /* ── 柱（所有柱共享 band；布局见 layout.js。各柱用 yOf(axis) 选比例尺）── */
    const barMax = tokenNum(plotHost, '--size-bar-max') || 16;
    const gap = tokenNum(plotHost, '--size-bar-group-inner-gap-max') || 2;
    const groupMaxRaw = tokenNum(plotHost, '--size-bar-group-container-max');     /* [BAR-02] 分组容器上限 */
    const groupMax = groupMaxRaw > 0 ? groupMaxRaw : Infinity;                     /* none/0（如 THS）→ 不设上限 */
    const gapRatio = tokenNum(plotHost, '--size-bar-group-gap-ratio');           /* [BAR-02] 分组内容块:两侧留白 比（三主题 2:1；0=不留侧白）。tokenNum 解析 "2:1"→2 */
    const barContainerMax = tokenNum(plotHost, '--size-bar-container-max') || Infinity; /* [BAR-03] 单柱容器上限（24/48） */
    const barGapRatio = tokenNum(plotHost, '--size-bar-gap-ratio');              /* [BAR-03] 单柱 柱:两侧留白 比（三主题 2:1）。"2:1"→2、0→不留侧白 */
    const band = x.bandwidth();
    if (stacked && bars.length) {
      /* [BAR-05/06] 单列堆叠（可见柱按可见重算，段闭合）；列走单柱容器留白。
         normal 仅最外段可圆角；percent 所有分段强制直角。 */
      const visBars = bars.filter((r) => !state.hidden.has(r.name));
      const { segs } = stackBars(viewCats, visBars, stack);
      const col = singleBar(band, barMax, barContainerMax, barGapRatio);
      segs.forEach((seg, i) => {
        const r = visBars[i];
        grow.push(renderBars(seriesG('dv-bar-series', r.name), frame,
          {
            categories: viewCats, values: seg.values, base: seg.base, offset: col.offset, width: col.width,
            colorVar: seg.colorVar,
            rounded: stack === 'normal',
            capped: stack === 'normal' ? seg.caps : null,
            zeroBar: false,
          },
          x, yOf(r)));
        /* [LABEL-01] 堆叠段：段内垂直居中、压在填充上 → 走档②（按段色明暗反色，LABEL-04）。
           [LABEL-06③] 放不下就不放：段高不足一行标签高（含 0 值无高度段）在此判；
           横向放不下（文本宽 > 柱宽）由 L1 用 maxWidth 判——档② 的字一旦横向溢出色块，
           溢出部分落到画布底色上（浅底白字）直接看不见，比不画更糟。 */
        if (showBarLabel && withinLabelDensity(seg.values)) {
          const yy = yOf(r);
          labelBatches.push({
            key: r.name,
            colorVar: seg.colorVar,
            items: viewCats.map((c, j) => {
              const v = seg.values[j];
              if (v == null) return null;
              const yTop = yy(seg.base[j] + v);
              const yBot = yy(seg.base[j]);
              if (Math.abs(yBot - yTop) < labelLineH) return null;
              return {
                x: x(c) + col.offset + col.width / 2,
                y: (yTop + yBot) / 2,
                baseline: 'middle',
                tone: 'auto',            /* [LABEL-04] 档②：压在段的填充上，按底色明暗切前景 */
                bgHex: r.colorHex,
                maxWidth: col.width,
                text: labelText(v),
              };
            }).filter(Boolean),
          });
        }
      });
    } else if (bars.length) {
      /* 单柱系列（声明即单柱，含折柱组合里的唯一柱）走单柱容器留白（BAR-03）；
         分组（≥2 声明）走分组容器：按**可见**柱等分槽位 → 隐藏一根后剩余柱整组重新居中（BAR-02，即便隐藏到 1 根仍用分组容器）。
         系列色由固定 colorVar 决定、与可见性无关，故不重排（COLOR-04）。 */
      const visBars = bars.filter((r) => !state.hidden.has(r.name));
      const slots = bars.length === 1
        ? [singleBar(band, barMax, barContainerMax, barGapRatio)]
        : groupedBars(visBars.length, band, barMax, gap, groupMax, gapRatio);
      visBars.forEach((r, i) => {
        grow.push(renderBars(seriesG('dv-bar-series', r.name), frame,
          { categories: viewCats, values: r.data, offset: slots[i].offset, width: slots[i].width, colorVar: r.colorVar }, x, yOf(r))); /* [BAR-01] */
        /* [LABEL-01] 基础 / 分组柱：柱顶外侧——正值在柱顶上方（文字底对齐锚点）、
           负值在柱底下方（顶对齐），水平居中于该柱；落在图形外空白区 → 档①（跟随系列色，LABEL-03）。 */
        if (showBarLabel && withinLabelDensity(r.data)) {
          const yy = yOf(r);
          labelBatches.push({
            key: r.name,
            colorVar: r.colorVar,
            items: viewCats.map((c, j) => {
              const v = r.data[j];
              if (v == null) return null;
              const up = v >= 0;
              return {
                x: x(c) + slots[i].offset + slots[i].width / 2,
                y: up ? yy(v) - labelGap : yy(v) + labelGap,
                baseline: up ? 'auto' : 'hanging',
                text: labelText(v),
              };
            }).filter(Boolean),
          });
        }
      });
    }

    /* ── 线（叠加，走类目中心，各用 yOf(axis)）[LINE-01][BAR-07] ──
       多折线（声明 ≥2 条线，判定按声明）：**主线 = 首条声明线**保持 --size-line-stroke，
       其余线切更细的 --size-line-stroke-multi（并非所有线都切）；
       堆叠折线：stack≠none 时线沿**可见线**累计基线绘制（线堆线、柱堆柱各自独立，
       复用 stackBars 同一份累计，与 domain.js 值域一致），并在线与其基线间填
       同色 0.2 填充带（--opacity-line-stack-fill，mark.js stackFill）；
       渐变面积（series 级 area:true，仅 stack:none）：主线装饰，见 specs/line.md；
       数据点显隐分档：该线非 null 点数 > 13 → 全隐（移动/PC 一致），hover 唤出归 tooltip 切片 */
    const lineMulti = lines.length > 1;
    const visLines = lines.filter((r) => !state.hidden.has(r.name));
    let lineStack = null;
    if (stacked && visLines.length) {
      const { segs } = stackBars(viewCats, visLines, stack);
      lineStack = new Map(segs.map((seg, i) => [visLines[i].name, {
        values: seg.values.map((v, j) => (v == null ? null : seg.base[j] + v)),
        base: seg.base,
      }]));
    }
    /* 渲染按声明逆序：SVG 后画者在上 → 主线（首条声明线）最后画、层级最高，后续声明依次递减 */
    [...visLines].reverse().forEach((r) => {
      const st = lineStack?.get(r.name);
      const values = st ? st.values : r.data;
      const showPoints = values.filter((v) => v != null).length <= 13;
      const multi = lineMulti && r.seriesIndex !== lines[0].seriesIndex; /* 非主线才切细（主线按声明定、隐藏不改变） */
      grow.push(renderLine(seriesG('dv-line-series', r.name), frame,
        { categories: viewCats, values, base: st?.base ?? null, colorVar: r.colorVar }, x, yOf(r),
        { showPoints, multi, area: r.area && !stacked, stackFill: !!st, pointShape }));
      /* [LABEL-01] 折线：数据点正上方（类目中心），落在图形外 → 档①。
         [LABEL-06①] 非 null 点数 > 5 → 整条线不出标签（与柱同一阈值、全端统一）。
         堆叠折线：位置取累计后的点（values），文本取该系列**自身**的段值（= 累计值 − 基线）。 */
      if (showLineLabel && withinLabelDensity(values)) {
        const yy = yOf(r);
        labelBatches.push({
          key: r.name,
          colorVar: r.colorVar,
          items: viewCats.map((c, j) => {
            const v = values[j];
            if (v == null) return null;
            return {
              x: x(c) + x.bandwidth() / 2,
              y: yy(v) - labelGap - linePointH, /* 净距从数据点外缘算，不是圆心 */
              baseline: 'auto',
              text: labelText(st ? v - st.base[j] : v),
            };
          }).filter(Boolean),
        });
      }
    });

    /* [LABEL-08] 标签层在所有 mark 之后追加 = 压在柱 / 线之上（层级 = DOM 顺序，同 WATERMARK-05），
       水印仍在最末。每系列一个 <g>：color 下发系列色供档① 的 currentColor 取（LABEL-03），
       dataset.key 让图例 hover 弱化连同标签一起生效（applyDim）。
       每次调用传入的是「一个系列跨类目」= 同一行，故一律开碰撞过滤（LABEL-06②）。 */
    if (labelBatches.length) {
      labelLayer = frame.svg.append('g').attr('class', 'dv-data-label-layer');
      labelBatches.forEach((batch) => {
        const g = labelLayer.append('g')
          .attr('class', 'dv-data-label-series')
          .style('color', `var(${batch.colorVar})`);
        g.node().dataset.key = batch.key;
        renderDataLabels(g, frame, batch.items);
      });
    }

    /* [AXISTITLE-01..06] 轴标题：带高已在 createFrame 前预留，这里只定「摆哪、写什么」。
       主 Y 跟随 ySide、副 Y 在反侧（真·双量纲才有，AXISTITLE-03）、X 右对齐绘图区右缘。
       对齐口径（AXISTITLE-04：贴所在侧的画布外缘，左轴左对齐 / 右轴右对齐）与
       「放不下就不放」（AXISTITLE-06）都在 L1；本层只给它 side 与画布宽，不自算几何。 */
    const titleItems = [];
    if (titles.y) titleItems.push({ text: titles.y, band: 'top', y: frame.titleTop, ...axisTitleAnchor({ side: ySide, width: frame.width }) });
    if (showY2Title) titleItems.push({ text: titles.y2, band: 'top', y: frame.titleTop, ...axisTitleAnchor({ side: oppSide, width: frame.width }) });
    if (titles.x) titleItems.push({ text: titles.x, band: 'bottom', y: frame.xTitleTop, x: frame.grid.right, anchor: 'end' });
    if (titleItems.length) {
      renderAxisTitles(frame.svg.append('g').attr('class', 'dv-axis-title-layer'), frame, titleItems);
    }

    applyDim();

    /* ── hover 全链路（气泡 + X 指示线/block + 轴贴片 + 线点唤出）：接线见 hover.js ──
       [TOOLTIP-11] blockWidth = 分组柱容器宽（与 groupedBars 的 container 同一算法，BAR-02） */
    /* [TOOLTIP-12] Y 横线 + Y 值徽标（cfg `yIndicator`，默认关）。
       **徽标侧归属不另立规则：哪一侧画了 Y 标签，哪一侧就有徽标**——与上面两行 renderYLabels
       同一个 oppTicks 判据，故三种情形自动各就各位：单轴 1 个；iFinD 镜像（y-dual-shared 且非真
       双量纲）2 个、同一把标尺故同值；真·双量纲 2 个、各用自己的标尺故不同值——一条横线同时读出
       两个量纲各是多少，正是双 Y 图最难目测的那件事。
       值走 yFormat（与 Y 轴标签同一份格式化，percent 档显原值），不是气泡的 format。 */
    const yAxes = yIndicator
      ? [{ side: ySide, y: yP, format: yFormat },
        ...(oppTicks ? [{ side: oppSide, y: dual ? yS : yP, format: yFormat }] : [])]
      : [];

    stopHover = bindHover(plotHost, frame, {
      categories: viewCats, x, series: viewResolved, hidden: state.hidden,
      format, marker, position: b['tooltip-position'],
      indicator: hoverBlock ? 'block' : 'line',
      blockLayer, blockWidth: hoverBlock ? Math.min(band, groupMax) : 0,
      yAxes, yForm, yAlign,
    });

    /* [DATAZOOM-04..07] 缩放轴：拿**全量** categories/resolved 画迷你阴影（每类目取可见系列 |值| 包络）+
       窗口高亮；拖手柄/拖选区/点击轨道经 onChange 改 win 后整图重绘（Y 轴随之按新窗口重算 = SCALE-02）。 */
    if (zoomOn) {
      const visAll = resolved.filter((r) => !state.hidden.has(r.name));
      const shadowVals = categories.map((_, i) => Math.max(0, ...visAll.map((r) => Math.abs(r.data[i] ?? 0))));
      renderDataZoom(frame.svg.append('g').attr('class', 'dv-datazoom'), frame, {
        categories, shadow: dzShadow ? shadowVals : null, win, platform,
        align: dzAlign, handle: dzHandle, sliderH: dzSliderH, showShadow: dzShadow, showLabel: dzLabel,
        onChange: (w) => { win = w; build(); },
      });
    }

    /* [WATERMARK-05] 水印置顶：build 末尾追加 = DOM 顺序最上、贴数据图形之上不被裁剪；
       低透明 + pointer-events:none（CSS）不干扰 hover/tooltip。锚 frame.grid 绘图区角、随 resize 重排。 */
    if (wm) renderWatermark(frame.svg.append('g').attr('class', 'dv-watermark-layer'), frame, { spec: wm, mode: modeOf(host) });

    /* ── [MOTION-01/04/05/07] 入场生长（本函数最后一步，此前所有元素都已画到终态）──
       只在首次挂载播；animation:false 或系统「减弱动态效果」下直接终态——不是跑一遍 0ms 空动画，
       而是根本不进这个分支，保证与不带本能力时逐像素一致（MOTION-07 的零回归验收点）。
       坐标系 / 图例 / 轴标题 / 缩放轴 / 水印不参与生长；数据标签整层先藏、结束后出现（MOTION-05）。
       hover 已在上面接线，生长期间即可用（气泡取数据真值，与动画进度无关）。 */
    const animate = animation && firstBuild && grow.length > 0 && !reducedMotion();
    firstBuild = false;
    if (!animate) return;

    if (labelLayer) labelLayer.style('display', 'none');
    grow.forEach((draw) => draw(0)); /* 先落零帧，避免首帧闪出终态再跳回起点 */
    stopGrow = runGrowth(
      tokenNum(plotHost, '--motion-duration-grow'), /* [MOTION-02] 全图统一时长，不按图表 / 数据分档 */
      (t) => grow.forEach((draw) => draw(t)),
      { onDone: () => { if (labelLayer) labelLayer.style('display', null); } },
    );
  }

  build();
  const naturalHostHeight = host.clientHeight;
  const stop = observeResize(host, () => { /* [GRID-03] 默认尺寸建立后，外部改高才切容器适配 */
    if (!usesContainerHeight && Math.abs(host.clientHeight - naturalHostHeight) > 1) usesContainerHeight = true;
    build();
  });
  return { destroy: () => { stopGrow(); stopHover(); stop(); host.innerHTML = ''; } };
}
