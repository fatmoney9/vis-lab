import { select } from 'd3';
import { createFrame, observeResize } from '../core/frame.js';
import { niceSplit, linearY, bandX } from '../core/scale.js';
import { renderGrid } from '../core/grid.js';
import { renderYLabels, renderXLabels, yLabelInset, measureYLabelWidth } from '../core/axis.js';
import { tokenNum } from '../core/tokens.js';
import { resolveBehavior } from '../core/theme.js';
import { makeFormatter } from '../core/format.js';
import { resolveSeriesColors } from '../core/palette.js';
import { renderBars } from '../core/mark.js';
import { renderLegend, applyToggle } from '../core/legend.js';

/*
 * L2 · 直角坐标图（CartesianChart）—— x-y 轴图表的通用拼装骨架。
 * 拼装既有 L1：frame/scale/grid/axis/legend/format/theme + palette（取色）+ mark（柱/线/点）。
 * 组合形态靠三旋钮（≠ 样式，样式走 token/主题）：
 *   ① stack（none/normal/percent）· ② 每系列 type（bar/line）· ③ 每系列 axis（primary/secondary）
 * 图表专属计算（分组/堆叠排布）留在本组件（BAR-02/05），不上浮。
 * 只吃数据 + 语义配置，不暴露样式参数（颜色按 COLOR 固定槽位、不接受配置）。
 *
 * 现状：仅柱 mark · 单 Y。stack 全档（none 基础+分组 / normal 堆叠 / percent 归一化）已实现。
 *       折柱组合/双 Y(v3)、横向 HBar（独立组件）见 specs/bar.md 待办。
 * 边界：只管直角坐标系（柱/线/面积/散点/折柱组合）；饼/环/雷达是另一套骨架，不在此。
 *
 *   host  容器元素（须挂在带 data-theme 的祖先内，且自身有高度）
 *   cfg   { categories, series:[{name,data}], stack='none', platform='pc', unit, align='left' }
 */
export function CartesianChart(host, cfg) {
  const { categories, series, stack = 'none', platform = 'pc', unit, align = 'left' } = cfg;
  const n = series.length;
  const keys = series.map((s) => s.name);
  const colorVarOf = (i) => `--dv-series-${i + 1}`;

  /* [COLOR-02..04] 固定槽位配色：count=声明系列数（隐藏不重排）；hex 来自 palette，写成 host 上的 CSS 变量 */
  resolveSeriesColors(host, { count: n }).forEach((hex, i) => host.style.setProperty(colorVarOf(i), hex));

  const b = resolveBehavior(host, platform);
  const yForm = b['y-label-form'];
  const ySide = b['y-main-side'];
  const collision = b['x-collision'];
  const marker = b['legend-marker'];
  const selectMode = b['legend-select'];
  const format = makeFormatter(b['number-format']);        /* [FORMAT-01] 主题数值格式 */
  const pctFormat = (v) => `${Math.round(v * 100)}%`;      /* [BAR-06] 归一化轴百分比格式 */

  const legendItems = series.map((s, i) => ({ key: s.name, label: s.name, type: 'bar', colorVar: colorVarOf(i) }));
  const state = { hidden: new Set() };
  let hoverKey = null;

  /* ── 值域 / 堆叠策略（命名函数，按 stack 派发）───────────────────── */

  /* [SCALE-01] 非堆叠：全声明系列的稳定值域（隐藏系列不改轴） */
  function extentSplit() {
    const nums = series.flatMap((s) => s.data).filter((v) => v != null);
    return niceSplit(nums.length ? Math.min(...nums) : 0, nums.length ? Math.max(...nums) : 1);
  }

  /*
   * [BAR-05/06] 堆叠累计（图表专属计算）：对可见系列逐个累计基线（正上负下分开）。
   * percent 先把每类目缩放到占比（假设正值），domain 固定 0..1；normal 的 domain = 堆叠总高。
   * 返回 { split, segs:[{name, seriesIndex, values, base}] }（values 为原始或缩放后）。
   */
  function stackData(vis) {
    const percent = stack === 'percent';
    const totals = percent
      ? categories.map((_, i) => vis.reduce((s, sr) => s + (sr.data[i] > 0 ? sr.data[i] : 0), 0))
      : null;
    const valOf = (sr, i) => {
      const v = sr.data[i];
      if (v == null) return null;
      return percent ? (totals[i] > 0 ? v / totals[i] : 0) : v;
    };
    const pos = categories.map(() => 0);
    const neg = categories.map(() => 0);
    const segs = vis.map((sr) => {
      const values = categories.map((_, i) => valOf(sr, i));
      const base = values.map((v, i) => {
        if (v == null) return 0;
        if (v >= 0) { const bb = pos[i]; pos[i] += v; return bb; }
        const bb = neg[i]; neg[i] += v; return bb;
      });
      return { name: sr.name, seriesIndex: series.indexOf(sr), values, base };
    });
    const split = percent ? niceSplit(0, 1) : niceSplit(Math.min(0, ...neg), Math.max(0, ...pos));
    return { split, segs };
  }

  /* DOM 骨架（一次性）：图例在上、绘图区在下（LEGEND-04） */
  host.classList.add('dv-chart');
  const legendHost = select(host).append('div').node();
  const plotHost = select(host).append('div').attr('class', 'dv-chart__plot').node();

  /* [LEGEND-05] hover 弱化：只调其他系列 <g> 的 opacity，图例本身不动 */
  function applyDim() {
    const dim = getComputedStyle(host).getPropertyValue('--opacity-visualization-dim').trim() || '1';
    select(plotHost).selectAll('g.dv-bar-series')
      .attr('opacity', function () { return hoverKey && this.dataset.key !== hoverKey ? dim : 1; });
  }

  function drawLegend() {
    renderLegend(legendHost, legendItems, {
      marker, align, state,
      onToggle: (key) => { state.hidden = applyToggle(state.hidden, key, keys, selectMode); hoverKey = null; build(); }, /* [LEGEND-06] */
      onHover: (key) => { hoverKey = key; applyDim(); },
    });
  }

  function build() {
    drawLegend(); /* 图例先占位，绘图区再按剩余高度算，避免首帧 SVG 溢出（LEGEND-04） */
    if (plotHost.clientHeight < 40) return requestAnimationFrame(build); /* 等 flex 占位完成 */
    plotHost.innerHTML = '';

    const stacked = stack !== 'none';
    const vis = series.filter((s) => !state.hidden.has(s.name)); /* 堆叠按可见重算 */
    const sd = stacked ? stackData(vis) : null;
    const split = stacked ? sd.split : extentSplit();
    const yFormat = stack === 'percent' ? pctFormat : format;

    const yLabelWidth = yForm === 'outside' ? measureYLabelWidth(plotHost, split.ticks.map(yFormat)) : 0; /* [AXIS-08] */
    const frame = createFrame(plotHost, { height: plotHost.clientHeight, yForm, ySide, yLabelWidth }); /* [GRID-03] */
    const y = linearY(split, frame.grid.top, frame.grid.bottom);

    let dataL = frame.grid.left;
    let dataR = frame.grid.right;
    if (yForm === 'inside') { /* [AXIS-01] inside 数据让位 */
      const inset = yLabelInset(plotHost, split.ticks, yFormat);
      if (ySide === 'left') dataL += inset; else dataR -= inset;
    }
    /* 堆叠=每类目单列（band 不分组）；非堆叠多系列=分组 */
    const x = bandX(categories, dataL, dataR, { grouped: !stacked && n > 1 });

    renderGrid(frame.svg.append('g'), frame, split.ticks, y); /* [GRID-01] */
    renderYLabels(frame.svg.append('g'), frame, split.ticks, y, { form: yForm, side: ySide, format: yFormat }); /* [AXIS-01/03] */
    renderXLabels(frame.svg.append('g'), frame,
      categories.map((c) => ({ label: c, x: x(c) + x.bandwidth() / 2 })), { collision }); /* [AXIS-04..06] */

    const barMax = tokenNum(plotHost, '--size-bar-max') || 16;
    const gap = tokenNum(plotHost, '--size-bar-group-inner-gap-max') || 2;
    const band = x.bandwidth();
    const addSeriesG = (key) => {
      const g = frame.svg.append('g').attr('class', 'dv-bar-series');
      g.node().dataset.key = key;
      return g;
    };

    if (stacked) {
      /* [BAR-05] 单列：所有段同 offset/width，段从各自累计 base 长起（直角、0 不占位） */
      const w = Math.min(band, barMax);
      const off = (band - w) / 2;
      sd.segs.forEach((seg) => {
        renderBars(addSeriesG(seg.name), frame, {
          categories, values: seg.values, base: seg.base,
          offset: off, width: w, colorVar: colorVarOf(seg.seriesIndex), rounded: false, zeroBar: false,
        }, x, y);
      });
    } else {
      /* [BAR-02/03] 分组：declared n 槽位居中（隐藏留空、位置稳定）；单系列直接居中 */
      let subW;
      let offsets;
      if (n === 1) {
        subW = Math.min(band, barMax);
        offsets = [(band - subW) / 2];
      } else {
        subW = Math.min((band - (n - 1) * gap) / n, barMax);
        const start = (band - (n * subW + (n - 1) * gap)) / 2;
        offsets = series.map((_, i) => start + i * (subW + gap));
      }
      series.forEach((s, i) => {
        if (state.hidden.has(s.name)) return; /* [LEGEND-06] 隐藏系列不画 */
        renderBars(addSeriesG(s.name), frame,
          { categories, values: s.data, offset: offsets[i], width: subW, colorVar: colorVarOf(i) }, x, y); /* [BAR-01] */
      });
    }

    applyDim();
  }

  build();
  const stop = observeResize(host, build); /* [GRID-03] */
  return { destroy: () => { stop(); host.innerHTML = ''; } };
}
