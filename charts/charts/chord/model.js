/*
 * chord/model.js —— 【邻域高亮集合 + Tooltip 看板装配】
 * [L2-LOCAL] 图表专属，有意不下沉 L1（[CHORD-12][CHORD-13]）
 *
 * 干什么：回答两个问题——「高亮这个图元时，还有谁该亮」和「看板上写什么」。
 * 纯数据、零 DOM、零 d3、零 import，故可被 `node --test` 直接加载。
 *
 * ⚠️ 这里**不管 hover / 钉住的状态迁移**——那是 L1 core/highlight-state.js 的事。
 * 本模块只把「当前目标」翻译成「该亮哪些图元」与「看板内容」，两件事分开才测得了。
 */

/*
 * [CHORD-12] 邻域：**只含直接相邻，不做传递闭包**（同 SANKEY-10）。
 *   实体弧 → 该实体 + 它的全部弦 + 这些弦另一端的实体
 *   弦     → 该弦 + 它的两端实体
 *
 * 传递闭包在本族尤其不能要：实体之间常常两两互通，闭包一算几乎整张图都亮，
 * 高亮就失去了「把这一笔从背景里摘出来」的作用。
 */
export function chordRelatedNeighborhood(target, ribbons) {
  const entities = new Set();
  const related = new Set();
  if (!target) return { entities, ribbons: related };

  if (target.kind === 'arc') {
    const index = target.key;
    entities.add(index);
    for (const ribbon of ribbons) {
      if (ribbon.i !== index && ribbon.j !== index) continue;
      related.add(ribbon);
      entities.add(ribbon.i);
      entities.add(ribbon.j);
    }
    return { entities, ribbons: related };
  }

  const ribbon = ribbons.find((r) => r.key === target.key);
  if (ribbon) {
    related.add(ribbon);
    entities.add(ribbon.i);
    entities.add(ribbon.j);
  }
  return { entities, ribbons: related };
}

/*
 * [CHORD-13] 实体看板：流出 / 流入 / 净额三行 + 对手方明细。
 *
 * 净额 = 流入 − 流出，**只出现在看板里，不参与任何几何**——几何只认 abs 意义上的量。
 * 明细按对手方声明序（与槽位同序），让看板行与圆上的段一一对得上；
 * 按值排序会让「看板第三行」和「弧上第三段」不是同一个东西。
 */
export function chordEntityDashboard(group, graph, format) {
  const { entities, matrix } = graph;
  const i = group.index;
  const rows = [
    { key: 'outflow', label: '流出', value: format(group.outflow), showMarker: false },
    { key: 'inflow', label: '流入', value: format(group.inflow), showMarker: false },
    { key: 'net', label: '净额', value: format(group.inflow - group.outflow), showMarker: false },
  ];
  entities.forEach((name, j) => {
    if (j === i) return;
    const out = matrix[i][j];
    const back = matrix[j][i];
    if (out <= 0 && back <= 0) return;
    rows.push({
      key: `partner-${j}`,
      label: name,
      type: 'bar',
      colorVar: `--dv-series-${j + 1}`,
      value: `${format(out)} / ${format(back)}`,
    });
  });
  return { title: group.name, rows };
}

/*
 * [CHORD-13] 弦看板：两个方向各一行 + 净额。
 * 两行的方向写成「甲 → 乙」而不是靠行序暗示，因为 undirected 档下一条弦同时承载两个方向，
 * 只给两个数字读者无从判断哪个是哪个。
 */
export function chordRibbonDashboard(ribbon, graph, format) {
  const { entities } = graph;
  const a = entities[ribbon.i];
  const b = entities[ribbon.j];
  const forward = ribbon.sourceValue;
  const backward = ribbon.targetValue;
  return {
    title: `${a} ↔ ${b}`,
    rows: [
      {
        key: 'forward',
        label: `${a} → ${b}`,
        type: 'bar',
        colorVar: `--dv-series-${ribbon.i + 1}`,
        value: format(forward),
      },
      {
        key: 'backward',
        label: `${b} → ${a}`,
        type: 'bar',
        colorVar: `--dv-series-${ribbon.j + 1}`,
        value: format(backward),
      },
      {
        key: 'net',
        label: '净额',
        value: format(Math.abs(forward - backward)),
        showMarker: false,
      },
    ],
  };
}

/*
 * 无障碍文案。与看板同源，避免「看得见的」和「读得出的」两套说法各自漂移。
 */
export function chordArcLabel(group, format) {
  return `${group.name}，流出 ${format(group.outflow)}，流入 ${format(group.inflow)}`;
}

export function chordRibbonLabel(ribbon, graph, format) {
  const a = graph.entities[ribbon.i];
  const b = graph.entities[ribbon.j];
  return `${a} 与 ${b} 之间的流量：${a} 流向 ${b} ${format(ribbon.sourceValue)}，`
    + `${b} 流向 ${a} ${format(ribbon.targetValue)}`;
}
