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
