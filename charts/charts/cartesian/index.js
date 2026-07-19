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
 *   cfg   { categories, series:[{name,data,type?,axis?}], stack='none', platform='pc', unit, align='left' }
 *         type 默认 bar / axis 默认 primary
 */
import { select } from 'd3';
import { createFrame, observeResize } from '../../core/frame.js';
import { niceSplit, niceSplitDual, linearY, bandX } from '../../core/scale.js';
import { renderGrid } from '../../core/grid.js';
import { renderYLabels, renderXLabels, yLabelInset, measureYLabelWidth } from '../../core/axis.js';
import { tokenNum } from '../../core/tokens.js';
import { resolveBehavior } from '../../core/theme.js';
import { makeFormatter } from '../../core/format.js';
import { resolveSeriesColors } from '../../core/palette.js';
import { renderBars, renderLine } from '../../core/mark.js';
import { renderLegend, applyToggle } from '../../core/legend.js';
import { resolveSeries } from './series.js';
import { bindHover } from './hover.js';
import { axisDomain } from './domain.js';
import { groupedBars, singleBar, stackBars } from './layout.js';

export function CartesianChart(host, cfg) {
  const { categories, series, stack = 'none', platform = 'pc', unit, align = 'left' } = cfg;

  const resolved = resolveSeries(series);                 /* 归一化：补默认 type/axis（见 series.js） */
  const keys = resolved.map((r) => r.name);
  const dual = resolved.some((r) => r.axis === 'secondary'); /* 用声明判定，副轴存在性稳定 */

  /* [COLOR-02..05] 按类型固定槽位配色：柱走 bar-multi、线走 line-multi；写成 host 上的 CSS 变量 */
  resolveSeriesColors(host, { series: resolved }).forEach((hex, i) => host.style.setProperty(resolved[i].colorVar, hex));

  const b = resolveBehavior(host, platform);
  const yForm = b['y-label-form'];
  const ySide = b['y-main-side'];
  const oppSide = ySide === 'left' ? 'right' : 'left';
  const mirror = b['y-dual-shared'] && !dual; /* [AXIS-02] iFinD 单轴：反侧镜像主轴同一套标签；真·双量纲仍走标准 dual（两侧各一套不同值） */
  const collision = b['x-collision'];
  const yAlign = b['y-label-align'];        /* [AXIS-03] Ainvest 右对齐特例 */
  const pointShape = b['line-point-shape']; /* [LINE-01] 数据点形状（iFinD 菱形特例） */
  const marker = b['legend-marker'];
  const selectMode = b['legend-select'];
  const format = makeFormatter(b['number-format']);       /* [FORMAT-01] */
  const pctFormat = (v) => `${Math.round(v * 100)}%`;     /* [BAR-06] 归一化轴 */

  const legendItems = resolved.map((r) => ({ key: r.name, label: r.name, type: r.type, colorVar: r.colorVar }));
  const state = { hidden: new Set() };
  let hoverKey = null;

  /* DOM 骨架（一次性）：图例在上、绘图区在下（LEGEND-04） */
  host.classList.add('dv-chart');
  const legendHost = select(host).append('div').node();
  const plotHost = select(host).append('div').attr('class', 'dv-chart__plot').node();

  /* [LEGEND-05] hover 弱化：柱 / 线系列 <g> 的 opacity，图例本身不动 */
  function applyDim() {
    const dim = getComputedStyle(host).getPropertyValue('--opacity-visualization-dim').trim() || '1';
    select(plotHost).selectAll('g.dv-bar-series, g.dv-line-series')
      .attr('opacity', function () { return hoverKey && this.dataset.key !== hoverKey ? dim : 1; });
  }

  function drawLegend() {
    renderLegend(legendHost, legendItems, {
      marker, align, state,
      onToggle: (key) => { state.hidden = applyToggle(state.hidden, key, keys, selectMode); hoverKey = null; build(); }, /* [LEGEND-06] */
      onHover: (key) => { hoverKey = key; applyDim(); },
    });
  }

  const seriesG = (cls, key) => {
    const g = select(plotHost).select('svg').append('g').attr('class', cls);
    g.node().dataset.key = key;
    return g;
  };

  /* 主流程：值域(domain) → 画布/轴/网格 → 柱布局(layout)+柱 mark → 线 mark → 交互态 */
  function build() {
    drawLegend(); /* 图例先占位，绘图区再按剩余高度算（LEGEND-04） */
    if (plotHost.clientHeight < 40) return requestAnimationFrame(build);
    plotHost.innerHTML = '';

    const primary = resolved.filter((r) => r.axis === 'primary');
    const secondary = resolved.filter((r) => r.axis === 'secondary');
    const yFormat = stack === 'percent' ? pctFormat : format;

    /* [SCALE-01/04] 值域（见 domain.js）：双轴共享刻度 + 0 对齐；单轴普通 niceSplit */
    let pSplit;
    let sSplit;
    if (dual) {
      const dd = niceSplitDual(axisDomain(categories, primary, stack, state.hidden), axisDomain(categories, secondary, stack, state.hidden));
      pSplit = dd.primary; sSplit = dd.secondary;
    } else {
      pSplit = niceSplit(...axisDomain(categories, primary, stack, state.hidden));
    }

    /* [AXIS-02] 反侧 Y 标签的刻度来源：真·双量纲 = 副轴另一套（dual）；iFinD 单轴 = 镜像主轴同一套（mirror）；否则无 */
    const oppTicks = dual ? sSplit.ticks : mirror ? pSplit.ticks : null;

    /* [AXIS-08] 列宽：outside 时主轴 + 反侧（副轴/镜像）各自测量 */
    const yLabelWidth = yForm === 'outside' ? measureYLabelWidth(plotHost, pSplit.ticks.map(yFormat)) : 0;
    const yLabelWidthSecondary = oppTicks && yForm === 'outside' ? measureYLabelWidth(plotHost, oppTicks.map(yFormat)) : 0;
    const frame = createFrame(plotHost, { height: plotHost.clientHeight, yForm, ySide, yLabelWidth, yLabelWidthSecondary }); /* [GRID-03] */

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

    const stacked = stack !== 'none';
    const bars = resolved.filter((r) => r.type === 'bar');
    const lines = resolved.filter((r) => r.type === 'line');
    /* x 排布：有柱（单柱/分组/堆叠）一律 slot=铺满整格、格间距最小 0（侧白/组间距归容器残量，见 bandX）；纯折线点居中留 inset */
    const xMode = bars.length ? 'slot' : 'center';
    const x = bandX(categories, dataL, dataR, { mode: xMode });

    renderGrid(frame.svg.append('g'), frame, pSplit.ticks, yP); /* [GRID-01] 网格用主轴刻度像素位 */
    renderYLabels(frame.svg.append('g'), frame, pSplit.ticks, yP, { form: yForm, side: ySide, format: yFormat, align: yAlign }); /* [AXIS-01/03] */
    if (oppTicks) renderYLabels(frame.svg.append('g'), frame, oppTicks, yS, { form: yForm, side: oppSide, format: yFormat, align: yAlign }); /* [AXIS-02] 反侧：副轴另一套 / iFinD 镜像同一套 */
    renderXLabels(frame.svg.append('g'), frame,
      categories.map((c) => ({ label: c, x: x(c) + x.bandwidth() / 2 })), { collision }); /* [AXIS-04..06] */

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
      /* [BAR-05] 单列堆叠（可见柱按可见重算，段闭合）；列走单柱容器留白（barContainerMax + barGapRatio） */
      const visBars = bars.filter((r) => !state.hidden.has(r.name));
      const { segs } = stackBars(categories, visBars, stack);
      const col = singleBar(band, barMax, barContainerMax, barGapRatio);
      segs.forEach((seg, i) => {
        const r = visBars[i];
        renderBars(seriesG('dv-bar-series', r.name), frame,
          { categories, values: seg.values, base: seg.base, offset: col.offset, width: col.width, colorVar: seg.colorVar, capped: seg.caps, zeroBar: false },
          x, yOf(r));
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
        renderBars(seriesG('dv-bar-series', r.name), frame,
          { categories, values: r.data, offset: slots[i].offset, width: slots[i].width, colorVar: r.colorVar }, x, yOf(r)); /* [BAR-01] */
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
      const { segs } = stackBars(categories, visLines, stack);
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
      renderLine(seriesG('dv-line-series', r.name), frame,
        { categories, values, base: st?.base ?? null, colorVar: r.colorVar }, x, yOf(r),
        { showPoints, multi, area: r.area && !stacked, stackFill: !!st, pointShape });
    });

    applyDim();

    /* ── hover 全链路（气泡 + X 指示线 + 轴贴片 + 线点唤出）：接线见 hover.js ── */
    bindHover(plotHost, frame, {
      categories, x, series: resolved, hidden: state.hidden,
      format, marker, position: b['tooltip-position'],
    });
  }

  build();
  const stop = observeResize(host, build); /* [GRID-03] */
  return { destroy: () => { stop(); host.innerHTML = ''; } };
}
