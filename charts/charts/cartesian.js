import { select } from 'd3';
import { createFrame, observeResize } from '../core/frame.js';
import { niceSplit, niceSplitDual, linearY, bandX } from '../core/scale.js';
import { renderGrid } from '../core/grid.js';
import { renderYLabels, renderXLabels, yLabelInset, measureYLabelWidth } from '../core/axis.js';
import { tokenNum } from '../core/tokens.js';
import { resolveBehavior } from '../core/theme.js';
import { makeFormatter } from '../core/format.js';
import { resolveSeriesColors } from '../core/palette.js';
import { renderBars, renderLine } from '../core/mark.js';
import { renderLegend, applyToggle } from '../core/legend.js';

/*
 * L2 · 直角坐标图（CartesianChart）—— x-y 轴图表的通用拼装骨架。
 * 拼装既有 L1：frame/scale/grid/axis/legend/format/theme + palette（取色）+ mark（柱/线/点）。
 * 组合形态靠三旋钮（≠ 样式，样式走 token/主题）：
 *   ① stack（none/normal/percent）· ② 每系列 type（bar/line）· ③ 每系列 axis（primary/secondary）
 * 图表专属计算（分组/堆叠排布）留在本组件（BAR-02/05），不上浮。
 * 只吃数据 + 语义配置，不暴露样式参数（颜色按 COLOR 固定槽位、不接受配置）。
 *
 * 现状：柱（基础/分组/堆叠/归一化）+ 折线 mark；折柱组合（type 混用）+ 双 Y（axis 绑定）。
 *       组合主测 stack:none；percent+组合、数据点密度隐藏/数据标签、iFinD 双侧镜像见 specs 待办。
 * 边界：只管直角坐标系（柱/线/面积/散点/折柱组合）；饼/环/雷达是另一套骨架，不在此。
 *
 *   host  容器元素（须挂在带 data-theme 的祖先内，且自身有高度）
 *   cfg   { categories, series:[{name,data,type?,axis?}], stack='none', platform='pc', unit, align='left' }
 *         type 默认 bar / axis 默认 primary
 */
export function CartesianChart(host, cfg) {
  const { categories, series, stack = 'none', platform = 'pc', unit, align = 'left' } = cfg;
  const colorVarOf = (i) => `--dv-series-${i + 1}`;

  /* 归一化：默认值集中在此一处，下游读字段（type/axis），不散落 ?? */
  const resolved = series.map((s, i) => ({
    name: s.name, data: s.data,
    type: s.type ?? 'bar',
    axis: s.axis ?? 'primary',
    seriesIndex: i,
    colorVar: colorVarOf(i),
  }));
  const keys = resolved.map((r) => r.name);
  const dual = resolved.some((r) => r.axis === 'secondary'); /* 用声明判定，副轴存在性稳定 */

  /* [COLOR-02..05] 按类型固定槽位配色：柱走 bar-multi、线走 line-multi；count=声明系列数（隐藏不重排） */
  resolveSeriesColors(host, { series: resolved }).forEach((hex, i) => host.style.setProperty(colorVarOf(i), hex));

  const b = resolveBehavior(host, platform);
  const yForm = b['y-label-form'];
  const ySide = b['y-main-side'];
  const oppSide = ySide === 'left' ? 'right' : 'left';
  const collision = b['x-collision'];
  const marker = b['legend-marker'];
  const selectMode = b['legend-select'];
  const format = makeFormatter(b['number-format']);       /* [FORMAT-01] */
  const pctFormat = (v) => `${Math.round(v * 100)}%`;     /* [BAR-06] 归一化轴 */

  const legendItems = resolved.map((r) => ({ key: r.name, label: r.name, type: r.type, colorVar: r.colorVar }));
  const state = { hidden: new Set() };
  let hoverKey = null;

  /* ── 值域 / 堆叠策略（命名函数，按 stack / type / axis 派发）──────── */

  const extentOf = (rows) => {
    const nums = rows.flatMap((r) => r.data).filter((v) => v != null);
    return nums.length ? [Math.min(...nums), Math.max(...nums)] : [0, 0];
  };

  /* [BAR-05/06] 一组柱的堆叠累计（正上负下分开；percent 先缩放到占比）。返回 {lo,hi,segs}。 */
  function stackBars(bars) {
    const percent = stack === 'percent';
    const totals = percent
      ? categories.map((_, i) => bars.reduce((s, r) => s + (r.data[i] > 0 ? r.data[i] : 0), 0))
      : null;
    const valOf = (r, i) => {
      const v = r.data[i];
      if (v == null) return null;
      return percent ? (totals[i] > 0 ? v / totals[i] : 0) : v;
    };
    const pos = categories.map(() => 0);
    const neg = categories.map(() => 0);
    const segs = bars.map((r) => {
      const values = categories.map((_, i) => valOf(r, i));
      const base = values.map((v, i) => {
        if (v == null) return 0;
        if (v >= 0) { const bb = pos[i]; pos[i] += v; return bb; }
        const bb = neg[i]; neg[i] += v; return bb;
      });
      return { colorVar: r.colorVar, values, base };
    });
    return { lo: Math.min(0, ...neg), hi: percent ? 1 : Math.max(0, ...pos), segs };
  }

  /* 某根轴的值域 [lo,hi]：该轴柱子集（none→extent 稳定 / 堆叠→可见累计）∪ 线子集 extent，含 0 */
  function axisDomain(axisSeries) {
    const bars = axisSeries.filter((r) => r.type === 'bar');
    const lines = axisSeries.filter((r) => r.type === 'line');
    let lo = 0;
    let hi = 0;
    if (stack !== 'none' && bars.length) {
      const st = stackBars(bars.filter((r) => !state.hidden.has(r.name)));
      lo = Math.min(lo, st.lo); hi = Math.max(hi, st.hi);
    } else if (bars.length) {
      const [a, c] = extentOf(bars);
      lo = Math.min(lo, a); hi = Math.max(hi, c);
    }
    if (lines.length) {
      const [a, c] = extentOf(lines);
      lo = Math.min(lo, a); hi = Math.max(hi, c);
    }
    return [lo, hi];
  }

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

  function build() {
    drawLegend(); /* 图例先占位，绘图区再按剩余高度算（LEGEND-04） */
    if (plotHost.clientHeight < 40) return requestAnimationFrame(build);
    plotHost.innerHTML = '';

    const primary = resolved.filter((r) => r.axis === 'primary');
    const secondary = resolved.filter((r) => r.axis === 'secondary');
    const yFormat = stack === 'percent' ? pctFormat : format;

    /* [SCALE-01/04] 值域：双轴共享刻度 + 0 对齐；单轴普通 niceSplit */
    let pSplit;
    let sSplit;
    if (dual) {
      const dd = niceSplitDual(axisDomain(primary), axisDomain(secondary));
      pSplit = dd.primary; sSplit = dd.secondary;
    } else {
      pSplit = niceSplit(...axisDomain(primary));
    }

    /* [AXIS-08] 列宽：outside 时主轴 + 副轴各自测量 */
    const yLabelWidth = yForm === 'outside' ? measureYLabelWidth(plotHost, pSplit.ticks.map(yFormat)) : 0;
    const yLabelWidthSecondary = dual && yForm === 'outside' ? measureYLabelWidth(plotHost, sSplit.ticks.map(yFormat)) : 0;
    const frame = createFrame(plotHost, { height: plotHost.clientHeight, yForm, ySide, yLabelWidth, yLabelWidthSecondary }); /* [GRID-03] */

    const yP = linearY(pSplit, frame.grid.top, frame.grid.bottom);
    const yS = dual ? linearY(sSplit, frame.grid.top, frame.grid.bottom) : yP;
    const yOf = (r) => (r.axis === 'secondary' ? yS : yP);

    /* [AXIS-01] inside 数据让位：双轴则两侧都让 */
    let dataL = frame.grid.left;
    let dataR = frame.grid.right;
    if (yForm === 'inside') {
      const insetP = yLabelInset(plotHost, pSplit.ticks, yFormat);
      if (ySide === 'left') dataL += insetP; else dataR -= insetP;
      if (dual) {
        const insetS = yLabelInset(plotHost, sSplit.ticks, yFormat);
        if (oppSide === 'left') dataL += insetS; else dataR -= insetS;
      }
    }

    const stacked = stack !== 'none';
    const bars = resolved.filter((r) => r.type === 'bar');
    const lines = resolved.filter((r) => r.type === 'line');
    const x = bandX(categories, dataL, dataR, { grouped: !stacked && bars.length > 1 });

    renderGrid(frame.svg.append('g'), frame, pSplit.ticks, yP); /* [GRID-01] 网格用主轴刻度像素位 */
    renderYLabels(frame.svg.append('g'), frame, pSplit.ticks, yP, { form: yForm, side: ySide, format: yFormat }); /* [AXIS-01/03] */
    if (dual) renderYLabels(frame.svg.append('g'), frame, sSplit.ticks, yS, { form: yForm, side: oppSide, format: yFormat }); /* [AXIS-02] 副轴反侧 */
    renderXLabels(frame.svg.append('g'), frame,
      categories.map((c) => ({ label: c, x: x(c) + x.bandwidth() / 2 })), { collision }); /* [AXIS-04..06] */

    /* ── 柱（所有柱共享 band；分组=n 根等分、堆叠=单列累计。各柱用 yOf(axis)）── */
    const barMax = tokenNum(plotHost, '--size-bar-max') || 16;
    const gap = tokenNum(plotHost, '--size-bar-group-inner-gap-max') || 2;
    const band = x.bandwidth();
    if (stacked && bars.length) {
      /* [BAR-05] 单列堆叠（可见柱）；组合里柱通常在主轴 */
      const visBars = bars.filter((r) => !state.hidden.has(r.name));
      const st = stackBars(visBars);
      const w = Math.min(band, barMax);
      const off = (band - w) / 2;
      st.segs.forEach((seg, i) => {
        const r = visBars[i];
        renderBars(seriesG('dv-bar-series', r.name), frame,
          { categories, values: seg.values, base: seg.base, offset: off, width: w, colorVar: seg.colorVar, rounded: false, zeroBar: false },
          x, yOf(r));
      });
    } else if (bars.length) {
      /* [BAR-02/03] 分组：所有柱按 declared 顺序等分槽位（隐藏留空、位置稳定） */
      const nb = bars.length;
      let subW;
      let offsets;
      if (nb === 1) {
        subW = Math.min(band, barMax);
        offsets = [(band - subW) / 2];
      } else {
        subW = Math.min((band - (nb - 1) * gap) / nb, barMax);
        const start = (band - (nb * subW + (nb - 1) * gap)) / 2;
        offsets = bars.map((_, i) => start + i * (subW + gap));
      }
      bars.forEach((r, i) => {
        if (state.hidden.has(r.name)) return;
        renderBars(seriesG('dv-bar-series', r.name), frame,
          { categories, values: r.data, offset: offsets[i], width: subW, colorVar: r.colorVar }, x, yOf(r)); /* [BAR-01] */
      });
    }

    /* ── 线（叠加，走类目中心，各用 yOf(axis)）[LINE-01][BAR-07] ── */
    lines.forEach((r) => {
      if (state.hidden.has(r.name)) return;
      renderLine(seriesG('dv-line-series', r.name), frame, { categories, values: r.data, colorVar: r.colorVar }, x, yOf(r));
    });

    applyDim();
  }

  build();
  const stop = observeResize(host, build); /* [GRID-03] */
  return { destroy: () => { stop(); host.innerHTML = ''; } };
}
