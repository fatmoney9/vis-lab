import { line, area } from 'd3';
import { tokenNum } from './tokens.js';

let areaGradSeq = 0; // 渐变面积 def 的唯一 id 计数（每次重绘递增，画布整体重建不残留）

/*
 * L1 · 图元标记（mark）。柱/线/点的纯渲染，供柱图 / 折线图 / 折柱组合共用。
 * 分组偏移、堆叠累加等**布局计算是图表专属**，由 L2 算好后经参数传入（见 specs/bar.md · BAR-02）。
 */

/* 单根柱的路径：仅“远离基线”的一端圆角（正值圆顶、负值圆底），r=0 时退化为直角矩形 */
function barPath(x, yTop, w, h, r, side) {
  r = Math.max(0, Math.min(r, w / 2, h));
  if (r === 0) return `M${x},${yTop}h${w}v${h}h${-w}Z`;
  return side === 'top'
    ? `M${x},${yTop + h}V${yTop + r}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${yTop + h}Z`
    : `M${x},${yTop}V${yTop + h - r}a${r},${r} 0 0 0 ${r},${r}h${w - 2 * r}a${r},${r} 0 0 0 ${r},${-r}V${yTop}Z`;
}

/*
 * [BAR-01][BAR-05] 一个柱系列的一批柱，渲染进已存在的分组 <g>（L2 每系列一个 g，便于整组控隐藏/弱化）。
 *   series = { categories, values, base?, offset, width, colorVar, rounded?, capped?, zeroBar? }
 *     offset/width —— L2 算好的 band 内偏移与柱宽（分组 / 堆叠排布）
 *     base         —— 每类目的基线值（默认 0=从零基线长）；堆叠时 = 累计基线数组，段 = [base, base+v]
 *     rounded      —— 整批统一是否圆角（默认 true；基础/分组柱用）
 *     capped       —— 每类目布尔数组，逐柱决定是否圆角（给一个则**覆盖** rounded）。
 *                     堆叠用它只给「整根最外端」那段封顶圆角（正向最上/负向最下），其余段直角（BAR-05）
 *     zeroBar      —— 0 值是否画 1px 占位（默认 true；堆叠传 false → 0 不占位）
 *     colorVar     —— 系列色 CSS 变量名，g 上 color=var(它)、柱 fill=currentColor
 *   x —— bandX 比例尺（类目→band 左沿）；y —— linearY 比例尺
 * 规则：null 跳过 · 0 →（zeroBar&&base=0 时）--size-zero-bar-placeholder（1px）贴基线，否则不画 ·
 *       段 = 值区间 [base, base+v]，正向远离基线端圆角、负向另一端。默认参数下与 v1 完全一致。
 */
export function renderBars(g, frame, series, x, y) {
  const { categories, values, base = null, offset, width, colorVar, rounded = true, capped = null, zeroBar = true } = series;
  const zeroH = tokenNum(frame.host, '--size-zero-bar-placeholder') || 1;
  const rMax = tokenNum(frame.host, '--radius-bar-top');   // 主题决定（THS=2、iFinD/Ainvest=0）

  g.style('color', `var(${colorVar})`);

  const bars = categories
    .map((c, i) => ({ key: c, v: values[i], b: base ? base[i] : 0, bx: x(c) + offset, r: (capped ? capped[i] : rounded) ? rMax : 0 }))
    .filter((d) => d.v != null);

  g.selectAll('path.dv-bar')
    .data(bars, (d) => d.key)
    .join('path')
    .attr('class', 'dv-bar')
    .attr('d', (d) => {
      if (d.v === 0) return zeroBar && d.b === 0 ? barPath(d.bx, y(0) - zeroH, width, zeroH, 0, 'top') : null;
      const top = d.b + d.v;                              // 段的另一端（值空间）
      const yHi = y(Math.max(d.b, top));                  // 像素上沿（值大 → y 小）
      const h = Math.abs(y(top) - y(d.b));
      return barPath(d.bx, yHi, width, h, d.r, d.v > 0 ? 'top' : 'bottom');
    });
}

/*
 * [LINE-01] 一条折线（+ 数据点），渲染进已存在的分组 <g>。权威规范见 specs/line.md。
 *   series = { categories, values, colorVar }
 *   x —— bandX 比例尺（点取**类目中心** x(c)+bandwidth/2）；y —— linearY 比例尺
 * 规则：直线（无平滑）· null 处断开（d3 line.defined）· 0 值正常连续 ·
 *       线宽 --size-line-stroke · 数据点尺寸 --size-line-point 含描边（默认态实心、fill/stroke=折线色）·
 *       数据点形状 opts.pointShape（behavior line-point-shape，L2 传入）：
 *       circle 实心圆（THS/Ainvest）/ diamond 正方形旋转 45°（iFinD，边长含描边 = size-line-point）。
 * 数据点显隐（specs/line.md）：opts.showPoints=false（点数 > 13，移动/PC 一致）→ g 挂 points-muted
 *   类使全部点静默（opacity 0、留在 DOM），线仍连续；hover 十字准星按 data-i 亮出最近点（L2 驱动）。
 * 每点带 data-i=类目序，供 L2 跨线选中同一类目；hover 白心 / 数据标签见 specs/line.md 待办。
 * opts.multi（多折线中的**非主线**；主线=首条声明线保持标准线宽，L2 判定）：
 *   线与点描边切更细的 --size-line-stroke-multi（经 lines-multi 类）。
 * opts.area（主线渐变面积，可开启配置）：折线与 grid 底部之间填渐变——最大值处
 *   --opacity-line-area-from（0.2）渐到 grid 底部 --opacity-line-area-to（0）；面积 bbox 顶=峰值、
 *   底=grid 底，故 objectBoundingBox 垂直渐变即为「最大值→grid 底部」；null 断口面积同断；画在线下方。
 * opts.stackFill（堆叠折线）：折线与其累计基线（series.base）之间填**与线同色**的填充带，
 *   不透明度 --opacity-line-stack-fill（0.2，样式在 styles.css）；null 断口同断；画在线下方。
 */
export function renderLine(g, frame, series, x, y, opts = {}) {
  const { showPoints = true, multi = false, area: withArea = false, stackFill = false, pointShape = 'circle' } = opts;
  const { categories, values, base = null, colorVar } = series;
  const stroke = tokenNum(frame.host, multi ? '--size-line-stroke-multi' : '--size-line-stroke') || 1.5;
  const point = tokenNum(frame.host, '--size-line-point') || 6;
  const r = Math.max(1, (point - stroke) / 2); // 直径含描边 = size-line-point

  g.style('color', `var(${colorVar})`)
    .classed('points-muted', !showPoints)
    .classed('lines-multi', multi);

  const pts = categories.map((c, i) => ({ key: c, i, v: values[i], cx: x(c) + x.bandwidth() / 2 }));
  const gen = line().defined((d) => d.v != null).x((d) => d.cx).y((d) => y(d.v));

  if (stackFill && base) { /* 堆叠填充带在前、线在后（线压带上） */
    const bandGen = area().defined((d) => d.v != null)
      .x((d) => d.cx).y1((d) => y(d.v)).y0((d) => y(base[d.i] ?? 0));
    g.selectAll('path.dv-line-stack-fill').data([pts]).join('path')
      .attr('class', 'dv-line-stack-fill').attr('d', bandGen);
  }

  if (withArea) { /* 面积在前、线在后（SVG 文档序 = 绘制序，线压面积上） */
    const id = `dv-area-grad-${++areaGradSeq}`;
    const from = tokenNum(frame.host, '--opacity-line-area-from');
    const to = tokenNum(frame.host, '--opacity-line-area-to');
    const grad = g.append('defs').append('linearGradient')
      .attr('id', id).attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
    grad.selectAll('stop')
      .data([{ off: 0, op: from }, { off: 1, op: to }])
      .join('stop')
      .attr('class', 'dv-line-area-stop')
      .attr('offset', (d) => d.off)
      .attr('stop-opacity', (d) => d.op);
    const areaGen = area().defined((d) => d.v != null)
      .x((d) => d.cx).y1((d) => y(d.v)).y0(frame.grid.bottom);
    g.selectAll('path.dv-line-area').data([pts]).join('path')
      .attr('class', 'dv-line-area').attr('fill', `url(#${id})`).attr('d', areaGen);
  }

  g.selectAll('path.dv-line').data([pts]).join('path').attr('class', 'dv-line').attr('d', gen);
  const ptData = pts.filter((d) => d.v != null);
  if (pointShape === 'diamond') {
    /* 菱形 = 正方形绕中心旋 45°；边长含描边 = size-line-point（与圆的直径口径一致） */
    const s = Math.max(1, point - stroke);
    g.selectAll('rect.dv-line-point')
      .data(ptData, (d) => d.key)
      .join('rect')
      .attr('class', 'dv-line-point')
      .attr('data-i', (d) => d.i)
      .attr('x', (d) => d.cx - s / 2)
      .attr('y', (d) => y(d.v) - s / 2)
      .attr('width', s)
      .attr('height', s)
      .attr('transform', (d) => `rotate(45 ${d.cx} ${y(d.v)})`);
  } else {
    g.selectAll('circle.dv-line-point')
      .data(ptData, (d) => d.key)
      .join('circle')
      .attr('class', 'dv-line-point')
      .attr('data-i', (d) => d.i)
      .attr('cx', (d) => d.cx)
      .attr('cy', (d) => y(d.v))
      .attr('r', r);
  }
}
