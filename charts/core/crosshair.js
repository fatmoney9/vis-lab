import { tokenNum } from './tokens.js';

/*
 * L1 · hover 指示线 + 轴标签高亮贴片。权威规范见 specs/tooltip.md。
 * 与 axis.js / grid.js 同族：纯函数 + d3 join 幂等重渲，渲染进调用方给的层 <g>；
 * 「hover 在哪个类目」由 L2 判定后传像素参数，本模块不感知数据与主题。
 * Y 轴横线 + Y 值徽标（可配置默认关）见 specs/tooltip.md 待办，暂不在此。
 */

/*
 * [TOOLTIP-09] X 轴标签高亮贴片：文字与 X 轴标签同基线（y = xBandTop、hanging）、
 * 字样式经 .dv-axis-tag-text 与轴标签同源；背景比文字大一圈——高 = line-height-axis
 * （上下由行高撑）、左右各加 spacing-axis-label-tag-pad-h，圆角 radius-axis-label-tag。
 * 水平以类目中心定位、贴 svg 边界 clamp（贴片与文字同步移）。
 * 即使该标签被碰撞策略（AXIS-06）隐藏也照常显示——贴片独立渲染、不查询标签 DOM。
 * 返回贴片上沿 y，供指示线连接（TOOLTIP-08）。
 */
export function renderAxisTag(layer, frame, { x, label }) {
  const pad = tokenNum(frame.host, '--spacing-axis-label-tag-pad-h');
  const radius = tokenNum(frame.host, '--radius-axis-label-tag');

  const g = layer.selectAll('g.dv-axis-tag').data([0]).join('g').attr('class', 'dv-axis-tag');
  const bg = g.selectAll('rect.dv-axis-tag-bg').data([0]).join('rect').attr('class', 'dv-axis-tag-bg');
  const text = g.selectAll('text.dv-axis-tag-text').data([0]).join('text')
    .attr('class', 'dv-axis-tag-text')
    .attr('dominant-baseline', 'hanging')
    .attr('text-anchor', 'middle')
    /* y 必须**在量 getBBox 之前**就位：bbox 的 y 是绝对坐标，未定位时读到的是 0，
       背景会被摆到画布顶端。横向的 x 不受此累（getComputedTextLength 是纯字宽、与位置无关），
       故仍留到下面与 bx 一起设。 */
    .attr('y', frame.xBandTop)
    .text(label);

  const w = text.node().getComputedTextLength() + 2 * pad;
  const bx = Math.max(0, Math.min(x - w / 2, frame.width - w));
  /* 背景以**文字实际盒**竖直居中、高 = 行高。**文字位置不动**（仍锚在 xBandTop，与相邻 X 轴标签
     同基线），移的只是底——高亮的那一个标签因此不会相对邻居跳位。
     2026-08-19 前这里是 `xBandTop + fontSize / 2 - lineH / 2`，即**拿 fontSize 当文字盒高的替身**。
     字体的 em 盒是 1.17–1.42 倍 fontSize（随字体而变），THS / iFinD 恰好蒙对，Ainvest 偏上 1.2px。
     改测 getBBox 后三主题上下留白实测均为 0 偏差，且与 Y 值徽标（TOOLTIP-12）逐像素同构。 */
  const box = text.node().getBBox();
  const by = box.y + box.height / 2 - frame.lineH / 2;
  bg.attr('x', bx).attr('y', by).attr('width', w).attr('height', frame.lineH)
    .attr('rx', radius).attr('ry', radius);
  text.attr('x', bx + w / 2);
  return by;
}

/*
 * [TOOLTIP-08] X 轴竖指示线：hover 即出、贯穿 grid 全高，并向下延伸出绘图区连到
 * 轴贴片上沿（yEnd 由调用方传 renderAxisTag 的返回值；缺省到轴标签带上沿）。
 * 线色 color-visualization-highlight-line、虚实 dash-highlight-line（iFinD 3 3 特例），
 * 均经 .dv-crosshair-x 类走 token，本模块零样式。
 */
export function renderCrosshairX(layer, frame, cx, yEnd = frame.xBandTop) {
  layer.selectAll('line.dv-crosshair-x').data([0]).join('line')
    .attr('class', 'dv-crosshair-x')
    .attr('x1', cx).attr('x2', cx)
    .attr('y1', frame.grid.top).attr('y2', yEnd);
}

/*
 * [TOOLTIP-11] hover 指示 block：竖指示线的另一形态（何时用哪种由 L2 判定，本模块不感知图型）——
 * 以类目中心 cx 定位、宽 width 的底色带，贯穿 grid 全高。色经 .dv-crosshair-block 走 token。
 * 层由调用方给：block 是底色不是遮罩，L2 把层建在 mark 之下（与 renderCrosshairX 的 hover 顶层不同）。
 */
export function renderCrosshairBlock(layer, frame, cx, width) {
  layer.selectAll('rect.dv-crosshair-block').data([0]).join('rect')
    .attr('class', 'dv-crosshair-block')
    .attr('x', cx - width / 2)
    .attr('width', width)
    .attr('y', frame.grid.top)
    .attr('height', frame.grid.bottom - frame.grid.top);
}
