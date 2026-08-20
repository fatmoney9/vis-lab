import { tokenNum } from './tokens.js';

/*
 * L1 · hover 指示线 + 轴标签高亮贴片。权威规范见 specs/tooltip.md。
 * 与 axis.js / grid.js 同族：纯函数 + d3 join 幂等重渲，渲染进调用方给的层 <g>；
 * 「hover 在哪个类目」由 L2 判定后传像素参数，本模块不感知数据与主题。
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

/*
 * [TOOLTIP-12] Y 值徽标：横线所在高度对应的值，贴在 Y 标签所在位置。
 *
 * **样式与 TOOLTIP-09 的 X 贴片同源**——复用同一组 `.dv-axis-tag-bg` / `.dv-axis-tag-text` 类，
 * 故不新增任何 token：同一个「高亮读数」语义不该有两套外观。
 *
 * **items 一项一个徽标，由调用方按「哪一侧画了 Y 标签」给**（口径与 renderYLabels 完全一致，
 * 见 cartesian/index.js）：单轴 1 个、iFinD 镜像 2 个同值、真·双量纲 2 个不同值。
 * 本模块不感知有几根轴，只按 side 摆位置。
 *
 * **横向定位逐字对齐 renderYLabels 的四种情形**（inside/outside × left/right，含 AXIS-03 的
 * 右列右对齐特例）——徽标必须落在标签本来在的地方，否则「它指的是哪根轴」就读不出来。
 *
 * **纵向恒以 cy 为中心**，不模仿 inside 布局里 Y 标签「压在网格线上方」的摆法（那是为了不盖住
 * 网格线，而徽标跟的是指针、不是刻度，居中才与横线对得上）。上下 clamp 进画布，
 * 指针贴顶/贴底时徽标齐边——同 X 贴片贴左右边界 clamp 的口径。
 *
 * 返回横向包络 { x1, x2 }（已与 grid 取并），供 renderCrosshairY 把横线延伸到徽标外缘。
 */
export function renderYAxisTags(layer, frame, items, opts = {}) {
  const { form = 'inside', align = 'auto' } = opts;
  const pad = tokenNum(frame.host, '--spacing-axis-label-tag-pad-h');
  const radius = tokenNum(frame.host, '--radius-axis-label-tag');
  const gap = tokenNum(frame.host, '--spacing-axis-y-label-gap');

  /* 两个平行 join：rect 先建、text 后建，故文字恒压在底之上，无需再管层级 */
  const bgs = layer.selectAll('rect.dv-axis-tag-bg').data(items).join('rect')
    .attr('class', 'dv-axis-tag-bg');
  const texts = layer.selectAll('text.dv-axis-tag-text').data(items).join('text')
    .attr('class', 'dv-axis-tag-text')
    /* **`central` 而不是 `middle`**：SVG 的 `middle` 对齐的是「字母基线 + 半个 x-height」，
       而徽标里是数字与汉字、高度远超 x-height，用 middle 会让整体上浮（三主题实测上偏 2.75~3.10px）。
       `central` 才是 em 盒居中。X 贴片（TOOLTIP-09）走的是另一条路——它的文字必须与相邻轴标签同基线，
       故保持 hanging、改由背景去贴合文字盒；两者最终的上下留白逐像素相同。 */
    .attr('dominant-baseline', 'central')
    .text((d) => d.label);

  /* [AXIS-01/03] 与 renderYLabels 同一套分支：锚点 x 与 text-anchor */
  const anchorOf = (d) => {
    if (form === 'inside') {
      return d.side === 'left'
        ? { x: frame.grid.left, anchor: 'start' }
        : { x: frame.grid.right, anchor: 'end' };
    }
    const alignEnd = d.side === 'right' && align === 'right'; /* [AXIS-03] 右列右对齐特例 */
    if (d.side === 'left') return { x: frame.grid.left - gap, anchor: 'end' };
    return alignEnd ? { x: frame.width, anchor: 'end' } : { x: frame.grid.right + gap, anchor: 'start' };
  };

  const widths = texts.nodes().map((n) => n.getComputedTextLength());
  const boxes = items.map((d, i) => {
    const { x, anchor } = anchorOf(d);
    const w = widths[i] + 2 * pad;
    /* anchor='end' 文字止于 x，故底左沿 = x − 文字宽 − pad；anchor='start' 文字起于 x，底左沿 = x − pad */
    const raw = anchor === 'end' ? x - widths[i] - pad : x - pad;
    const bx = Math.max(0, Math.min(raw, frame.width - w));
    const by = Math.max(0, Math.min(d.y - frame.lineH / 2, frame.height - frame.lineH));
    return { bx, by, w, anchor };
  });

  bgs
    .attr('x', (_d, i) => boxes[i].bx)
    .attr('y', (_d, i) => boxes[i].by)
    .attr('width', (_d, i) => boxes[i].w)
    .attr('height', frame.lineH)
    .attr('rx', radius).attr('ry', radius);
  texts
    .attr('text-anchor', (_d, i) => boxes[i].anchor)
    .attr('x', (_d, i) => (boxes[i].anchor === 'end'
      ? boxes[i].bx + boxes[i].w - pad
      : boxes[i].bx + pad))
    .attr('y', (_d, i) => boxes[i].by + frame.lineH / 2);

  return {
    x1: Math.min(frame.grid.left, ...boxes.map((b) => b.bx)),
    x2: Math.max(frame.grid.right, ...boxes.map((b) => b.bx + b.w)),
  };
}

/*
 * [TOOLTIP-12] Y 轴横指示线：贯穿 grid 全宽，并向标签侧延伸至徽标外缘
 * （x1/x2 由 renderYAxisTags 返回，同 TOOLTIP-08 竖线连到贴片上沿的做法）。
 * 线色 / 虚实经 .dv-crosshair-y 走与竖线**同一组** token——同一个「hover 指示」语义，
 * 不因方向不同而分叉（iFinD 的 3 3 虚线两向一致）。
 */
export function renderCrosshairY(layer, frame, cy, { x1 = frame.grid.left, x2 = frame.grid.right } = {}) {
  layer.selectAll('line.dv-crosshair-y').data([0]).join('line')
    .attr('class', 'dv-crosshair-y')
    .attr('x1', x1).attr('x2', x2)
    .attr('y1', cy).attr('y2', cy);
}
