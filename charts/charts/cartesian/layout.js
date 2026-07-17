/*
 * cartesian/layout.js —— 【柱的 X 排布几何 + 堆叠累计】 · [L2-LOCAL] 图表专属，有意不下沉 L1（BAR-02/05）
 *
 * 干什么：把「有几根柱、band 多宽、堆叠怎么累」算成**纯数据**（offset / width / base），
 * 交给 mark 去画。不碰 DOM、不碰比例尺、不碰 token——只做几何/数值。
 *
 * 三个策略：
 *   groupedBars   分组柱：band 内 n 根等分、整组居中 → 每根的 {offset, width}
 *   stackedColumn 堆叠柱：每类目一根居中的列 → 单个 {offset, width}
 *   stackBars     堆叠累计：可见柱逐个累计基线（正上负下分开、percent 先缩放到占比）→
 *                 {lo, hi, segs}；segs 是每系列的 {colorVar, values, base}（喂给 renderBars 的 base），
 *                 lo/hi 是堆叠后的值域上下限（供 domain 用）
 */

/* [BAR-02/03] 分组：n 根柱在 band 内等分、整组居中；柱宽不超 barMax，系列间距 gap */
export function groupedBars(n, band, barMax, gap) {
  if (n === 1) {
    const width = Math.min(band, barMax);
    return [{ offset: (band - width) / 2, width }];
  }
  const width = Math.min((band - (n - 1) * gap) / n, barMax);
  const start = (band - (n * width + (n - 1) * gap)) / 2;
  return Array.from({ length: n }, (_, i) => ({ offset: start + i * (width + gap), width }));
}

/* [BAR-05] 堆叠：每类目一根居中的单列（所有系列段同宽同位、靠 base 叠起） */
export function stackedColumn(band, barMax) {
  const width = Math.min(band, barMax);
  return { offset: (band - width) / 2, width };
}

/*
 * [BAR-05/06] 堆叠累计：对传入的（通常是可见的）柱系列逐个累计基线。
 *   正值向上累计（pos）、负值向下累计（neg），两条独立；
 *   percent 先把每类目缩放到占比（v / 类目正值和，假设正值），domain 固定 0..1。
 * 返回每系列的 { colorVar, values, base }（base = 该段的起始值，renderBars 画 [base, base+v]），
 * 及堆叠总高 { lo, hi }。纯函数。
 */
export function stackBars(categories, bars, stack) {
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
