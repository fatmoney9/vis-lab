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
 *   cfg   { categories, series:[{name,data,type?,axis?}], stack='none', platform='pc', unit,
 *           align='left', zoom, showXSplit=false }
 *         type 默认 bar / axis 默认 primary
 */
import { select } from 'd3';
import { createFrame, observeResize } from '../../core/frame.js';
import { niceSplit, niceSplitDual, linearY, bandX } from '../../core/scale.js';
import { renderGrid } from '../../core/grid.js';
import { renderYLabels, renderXLabels, yLabelInset, measureYLabelWidth } from '../../core/axis.js';
import { tokenNum } from '../../core/tokens.js';
import { resolveBehavior, modeOf } from '../../core/theme.js';
import { makeFormatter } from '../../core/format.js';
import { resolveSeriesColors } from '../../core/palette.js';
import { renderBars, renderLine } from '../../core/mark.js';
import { renderLegend, applyToggle } from '../../core/legend.js';
import { renderDataZoom } from '../../core/datazoom.js';
import { renderWatermark } from '../../core/watermark.js';
import { resolveSeries } from './series.js';
import { bindHover } from './hover.js';
import { axisDomain } from './domain.js';
import { groupedBars, singleBar, stackBars } from './layout.js';

export function CartesianChart(host, cfg) {
  const {
    categories, series, stack = 'none', platform = 'pc', unit, align = 'left',
    zoom, showXSplit = false,
  } = cfg;
  /* [GRID-03] 调用方明确给容器高度时随容器适配；未给高度时使用主题默认高度包络 token。 */
  let usesContainerHeight = host.clientHeight >= 40;

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
  let stopHover = () => {};

  /* 主流程：值域(domain) → 画布/轴/网格 → 柱布局(layout)+柱 mark → 线 mark → 交互态 */
  function build() {
    stopHover();
    stopHover = () => {};
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

    /* [SCALE-01/04] 值域（见 domain.js）：双轴共享刻度 + 0 对齐；单轴普通 niceSplit */
    let pSplit;
    let sSplit;
    if (dual) {
      const dd = niceSplitDual(axisDomain(viewCats, primary, stack, state.hidden), axisDomain(viewCats, secondary, stack, state.hidden));
      pSplit = dd.primary; sSplit = dd.secondary;
    } else {
      pSplit = niceSplit(...axisDomain(viewCats, primary, stack, state.hidden));
    }

    /* [AXIS-02] 反侧 Y 标签的刻度来源：真·双量纲 = 副轴另一套（dual）；iFinD 单轴 = 镜像主轴同一套（mirror）；否则无 */
    const oppTicks = dual ? sSplit.ticks : mirror ? pSplit.ticks : null;

    /* [AXIS-08] 列宽：outside 时主轴 + 反侧（副轴/镜像）各自测量 */
    const yLabelWidth = yForm === 'outside' ? measureYLabelWidth(plotHost, pSplit.ticks.map(yFormat)) : 0;
    const yLabelWidthSecondary = oppTicks && yForm === 'outside' ? measureYLabelWidth(plotHost, oppTicks.map(yFormat)) : 0;
    /* [DATAZOOM-01] 缩放带高度：启用时预留「上间距 6 + max(轨道高, 手柄高) + 下间距 6」；不启用为 0（无回归）。
       上下 6px 为结构留白常量（比 X 带的 4px 略大，给缩放轴与 X 标签多留分隔；待 token 化）。 */
    const dzSliderH = zoomOn ? (tokenNum(plotHost, '--size-slider-height') || 16) : 0;
    const navH = zoomOn ? 6 + Math.max(dzSliderH, dzHandleH) + 6 : 0;
    const frame = createFrame(plotHost, {
      ...(usesContainerHeight ? { height: plotHost.clientHeight } : {}),
      yForm, ySide, yLabelWidth, yLabelWidthSecondary, navH,
    }); /* [GRID-03][DATAZOOM-01] */

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
    const bars = viewResolved.filter((r) => r.type === 'bar');
    const lines = viewResolved.filter((r) => r.type === 'line');
    /* x 排布：有柱（单柱/分组/堆叠）一律 slot=铺满整格、格间距最小 0（侧白/组间距归容器残量，见 bandX）；纯折线点居中留 inset */
    const xMode = bars.length ? 'slot' : 'center';
    const x = bandX(viewCats, dataL, dataR, { mode: xMode });

    renderGrid(frame.svg.append('g'), frame, pSplit.ticks, yP, {
      showXSplit,
      xPositions: viewCats.map((category) => x(category) + x.bandwidth() / 2),
    }); /* [GRID-01/02] 网格用主轴刻度像素位；X 参考线仅经语义配置显式开启 */
    renderYLabels(frame.svg.append('g'), frame, pSplit.ticks, yP, { form: yForm, side: ySide, format: yFormat, align: yAlign }); /* [AXIS-01/03] */
    if (oppTicks) renderYLabels(frame.svg.append('g'), frame, oppTicks, yS, { form: yForm, side: oppSide, format: yFormat, align: yAlign }); /* [AXIS-02] 反侧：副轴另一套 / iFinD 镜像同一套 */
    renderXLabels(frame.svg.append('g'), frame,
      viewCats.map((c) => ({ label: c, x: x(c) + x.bandwidth() / 2 })), { collision }); /* [AXIS-04..06] */

    /* [TOOLTIP-11] 纯分组柱（判定按声明：全 bar + stack:none + ≥2 系列）hover 指示线换 block 底色带：
       层此刻创建 → 在网格/轴之上、后续 mark 之下（是底色不是遮罩）；渲染与显隐接线见 bindHover */
    const hoverBlock = stack === 'none' && !lines.length && bars.length >= 2;
    const blockLayer = hoverBlock ? frame.svg.append('g').style('display', 'none') : null;

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
        renderBars(seriesG('dv-bar-series', r.name), frame,
          {
            categories: viewCats, values: seg.values, base: seg.base, offset: col.offset, width: col.width,
            colorVar: seg.colorVar,
            rounded: stack === 'normal',
            capped: stack === 'normal' ? seg.caps : null,
            zeroBar: false,
          },
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
          { categories: viewCats, values: r.data, offset: slots[i].offset, width: slots[i].width, colorVar: r.colorVar }, x, yOf(r)); /* [BAR-01] */
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
      renderLine(seriesG('dv-line-series', r.name), frame,
        { categories: viewCats, values, base: st?.base ?? null, colorVar: r.colorVar }, x, yOf(r),
        { showPoints, multi, area: r.area && !stacked, stackFill: !!st, pointShape });
    });

    applyDim();

    /* ── hover 全链路（气泡 + X 指示线/block + 轴贴片 + 线点唤出）：接线见 hover.js ──
       [TOOLTIP-11] blockWidth = 分组柱容器宽（与 groupedBars 的 container 同一算法，BAR-02） */
    stopHover = bindHover(plotHost, frame, {
      categories: viewCats, x, series: viewResolved, hidden: state.hidden,
      format, marker, position: b['tooltip-position'],
      indicator: hoverBlock ? 'block' : 'line',
      blockLayer, blockWidth: hoverBlock ? Math.min(band, groupMax) : 0,
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
  }

  build();
  const naturalHostHeight = host.clientHeight;
  const stop = observeResize(host, () => { /* [GRID-03] 默认尺寸建立后，外部改高才切容器适配 */
    if (!usesContainerHeight && Math.abs(host.clientHeight - naturalHostHeight) > 1) usesContainerHeight = true;
    build();
  });
  return { destroy: () => { stopHover(); stop(); host.innerHTML = ''; } };
}
