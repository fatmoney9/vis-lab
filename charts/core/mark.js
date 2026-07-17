import { line } from 'd3';
import { tokenNum } from './tokens.js';

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
 *   series = { categories, values, base?, offset, width, colorVar, rounded?, zeroBar? }
 *     offset/width —— L2 算好的 band 内偏移与柱宽（分组 / 堆叠排布）
 *     base         —— 每类目的基线值（默认 0=从零基线长）；堆叠时 = 累计基线数组，段 = [base, base+v]
 *     rounded      —— 是否圆角（默认 true；堆叠段传 false → 直角）
 *     zeroBar      —— 0 值是否画 1px 占位（默认 true；堆叠传 false → 0 不占位）
 *     colorVar     —— 系列色 CSS 变量名，g 上 color=var(它)、柱 fill=currentColor
 *   x —— bandX 比例尺（类目→band 左沿）；y —— linearY 比例尺
 * 规则：null 跳过 · 0 →（zeroBar&&base=0 时）--size-zero-bar-placeholder（1px）贴基线，否则不画 ·
 *       段 = 值区间 [base, base+v]，正向远离基线端圆角、负向另一端。默认参数下与 v1 完全一致。
 */
export function renderBars(g, frame, series, x, y) {
  const { categories, values, base = null, offset, width, colorVar, rounded = true, zeroBar = true } = series;
  const zeroH = tokenNum(frame.host, '--size-zero-bar-placeholder') || 1;
  const r = rounded ? tokenNum(frame.host, '--radius-bar-top') : 0;

  g.style('color', `var(${colorVar})`);

  const bars = categories
    .map((c, i) => ({ key: c, v: values[i], b: base ? base[i] : 0, bx: x(c) + offset }))
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
      return barPath(d.bx, yHi, width, h, r, d.v > 0 ? 'top' : 'bottom');
    });
}

/*
 * [LINE-01] 一条折线（+ 数据点），渲染进已存在的分组 <g>。权威规范见 specs/line.md。
 *   series = { categories, values, colorVar }
 *   x —— bandX 比例尺（点取**类目中心** x(c)+bandwidth/2）；y —— linearY 比例尺
 * 规则：直线（无平滑）· null 处断开（d3 line.defined）· 0 值正常连续 ·
 *       线宽 --size-line-stroke · 数据点直径 --size-line-point（默认态实心、fill/stroke=折线色）。
 * v3 数据点常显；密度隐藏 / 碰撞 / hover 白心 / 数据标签见 specs/line.md 待办。
 */
export function renderLine(g, frame, series, x, y) {
  const { categories, values, colorVar } = series;
  const stroke = tokenNum(frame.host, '--size-line-stroke') || 1.5;
  const point = tokenNum(frame.host, '--size-line-point') || 6;
  const r = Math.max(1, (point - stroke) / 2); // 直径含描边 = size-line-point

  g.style('color', `var(${colorVar})`);

  const pts = categories.map((c, i) => ({ key: c, v: values[i], cx: x(c) + x.bandwidth() / 2 }));
  const gen = line().defined((d) => d.v != null).x((d) => d.cx).y((d) => y(d.v));

  g.selectAll('path.dv-line').data([pts]).join('path').attr('class', 'dv-line').attr('d', gen);
  g.selectAll('circle.dv-line-point')
    .data(pts.filter((d) => d.v != null), (d) => d.key)
    .join('circle')
    .attr('class', 'dv-line-point')
    .attr('cx', (d) => d.cx)
    .attr('cy', (d) => y(d.v))
    .attr('r', r);
}
