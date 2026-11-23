/*
 * [GRID-01] 横向网格线：颜色 --color-visualization-divider，0 轴基线加深
 *           --color-visualization-divider-deep，线宽 --size-grid-line。
 *           样式集中在 charts/styles.css，此处只挂类名。
 *           0 轴不在 renderGrid 里画——它要压在柱 / 线之上，由 L2 在图元之后调 renderBaseline。
 * [GRID-02] X 轴分割线默认不显示；仅特例经 showXSplit 显式开启。
 */
export function renderGrid(layer, frame, ticks, y, { showXSplit = false, xPositions = [] } = {}) {
  layer
    .selectAll('line.dv-grid-line-y')
    .data(ticks.filter((d) => d !== 0))
    .join('line')
    .attr('class', 'dv-grid-line-y')
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
 * [GRID-01] 0 轴基线：只画值为 0 的那一条，层级由调用方决定（直角坐标系放在柱 / 线之后、
 *           数据标签之前，故 0 轴压在图元上）。`ticks` 里没有 0 就什么都不画。
 *           不参与入场生长：一次落到终态。
 */
export function renderBaseline(layer, frame, y, ticks = [0]) {
  layer
    .selectAll('line.dv-grid-baseline')
    .data(ticks.includes(0) ? [0] : [])
    .join('line')
    .attr('class', 'dv-grid-line-y dv-grid-baseline')
    .attr('x1', frame.grid.left)
    .attr('x2', frame.grid.right)
    .attr('y1', (d) => y(d))
    .attr('y2', (d) => y(d));
}
