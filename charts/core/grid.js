/*
 * [GRID-01] 横向网格线：颜色 --color-visualization-divider，0 轴基线加深
 *           --color-visualization-divider-deep，线宽 --size-grid-line。
 *           样式集中在 charts/styles.css，此处只挂类名。
 * [GRID-02] X 轴分割线默认不显示；仅特例经 showXSplit 显式开启。
 */
export function renderGrid(layer, frame, ticks, y, { showXSplit = false, xPositions = [] } = {}) {
  layer
    .selectAll('line.dv-grid-line-y')
    .data(ticks)
    .join('line')
    .attr('class', (d) => (d === 0 ? 'dv-grid-line-y dv-grid-baseline' : 'dv-grid-line-y'))
    .attr('x1', frame.grid.left)
    .attr('x2', frame.grid.right)
    .attr('y1', (d) => y(d))
    .attr('y2', (d) => y(d));

  const xs = showXSplit ? xPositions : [];
  layer
    .selectAll('line.dv-grid-line-x')
    .data(xs)
    .join('line')
    .attr('class', 'dv-grid-line-x')
    .attr('y1', frame.grid.top)
    .attr('y2', frame.grid.bottom)
    .attr('x1', (d) => d)
    .attr('x2', (d) => d);
}

/*
 * [AXIS-07] 轴刻度线（tick marks）：默认不显示（全主题）。
 * 启用时长 3px，粗细/颜色与网格线同源（--size-grid-line / --color-visualization-divider，
 * 见 charts/styles.css 的 .dv-tick）。长度当前无专用 token。
 */
export function renderTicks(layer, frame, ticks, y, { side = 'left', show = false, length = 3 } = {}) {
  const data = show ? ticks : [];
  const x0 = side === 'left' ? frame.grid.left : frame.grid.right;
  const x1 = side === 'left' ? x0 - length : x0 + length;
  layer
    .selectAll('line.dv-tick')
    .data(data)
    .join('line')
    .attr('class', 'dv-tick')
    .attr('x1', x0)
    .attr('x2', x1)
    .attr('y1', (d) => y(d))
    .attr('y2', (d) => y(d));
}
