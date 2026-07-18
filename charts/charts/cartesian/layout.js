/*
 * cartesian/layout.js —— 【柱的 X 排布几何 + 堆叠累计】 · [L2-LOCAL] 图表专属，有意不下沉 L1（BAR-02/05）
 *
 * 干什么：把「有几根柱、band 多宽、堆叠怎么累」算成**纯数据**（offset / width / base），
 * 交给 mark 去画。不碰 DOM、不碰比例尺、不碰 token——只做几何/数值。
 *
 * 三个策略：
 *   groupedBars   分组柱：band 内 n 根等分、整组居中 → 每根的 {offset, width}
 *   singleBar     单列（基础单柱 + 堆叠单列）：container 内留侧白居中 → 单个 {offset, width}
 *   stackBars     堆叠累计：可见柱逐个累计基线（正上负下分开、percent 先缩放到占比）→
 *                 {lo, hi, segs}；segs 是每系列的 {colorVar, values, base}（喂给 renderBars 的 base），
 *                 lo/hi 是堆叠后的值域上下限（供 domain 用）
 */

/* [BAR-02/03] 分组：band 走 'slot' 模式 = 整格 step（每格铺满、组间距最小 0）。n 根柱在
   container=min(band, containerMax) 内、整组回 band 居中；**组间距 = band − 内容块** 为残量（数据少→容器封顶
   组间距变大、数据多→内容块占满 band 组间距=0），与单柱同一套容器规则（见 singleBar）。
   柱宽上限 barMax、柱间距上限 gapMax；放不下时**柱与间距按同一比例 s 等比缩小**
   （s=柱宽/barMax=间距/gapMax，恒保持 barMax:gapMax，如 32:2）——间距只在柱顶到 barMax 时才是满值 gapMax。
   ratio>0（三主题 2:1）时容器内**左右两侧再留白**：内容块(柱+柱间距) : 两侧留白总和 = ratio:1，
   内容块只能占 container 的 ratio/(ratio+1) → 进一步压小 s（ratio=0 退化为不留侧白、内容块铺满 container）。
   containerMax = size-bar-group-container-max。定位把内容块在 band 内居中（侧白即两侧自然余量、对称）。 */
export function groupedBars(n, band, barMax, gapMax, containerMax = Infinity, ratio = 0) {
  const container = Math.min(band, containerMax);
  if (n === 1) {
    const width = Math.min(container, barMax);
    return [{ offset: (band - width) / 2, width }];
  }
  const contentRegion = ratio > 0 ? (container * ratio) / (ratio + 1) : container;
  const contentAtMax = n * barMax + (n - 1) * gapMax;         /* 全部顶到最大时的内容块宽 */
  const s = Math.min(1, contentRegion / contentAtMax);        /* 放不下 → 柱与间距同比缩小 */
  const width = barMax * s;
  const g = gapMax * s;
  const content = n * width + (n - 1) * g;
  const start = (band - content) / 2;
  return Array.from({ length: n }, (_, i) => ({ offset: start + i * (width + g), width }));
}

/* [BAR-03/05] 单列（基础单柱 + 堆叠单列共用）：band 走 'slot' 模式 = 整格 step（每格铺满、格间距最小 0）。
   容器 = min(band, containerMax) = 「柱 + 左右侧白」：ratio>0（如 2:1）时柱只占容器 ratio/(ratio+1)、
   两侧各留 1/(2(ratio+1))；柱宽再受 barMax 封顶（containerMax·ratio/(ratio+1)=barMax 恒成立 → 宽格满宽）。
   数据少：band 大 → 容器封顶 containerMax、格间距=band−容器随之变大；数据多：band<containerMax → 容器缩小、格间距=0。
   ratio=0 → 不留侧白、退化为 min(band, barMax)。containerMax=size-bar-container-max、ratio=size-bar-gap-ratio。
   （堆叠时所有系列段共用这一个 {offset,width}，靠 base 叠起。） */
export function singleBar(band, barMax, containerMax = Infinity, ratio = 0) {
  const container = Math.min(band, containerMax);
  const contentRegion = ratio > 0 ? (container * ratio) / (ratio + 1) : container;
  const width = Math.min(barMax, contentRegion);
  return { offset: (band - width) / 2, width };
}

/*
 * [BAR-05/06] 堆叠累计：对传入的（通常是可见的）柱系列逐个累计基线。
 *   正值向上累计（pos）、负值向下累计（neg），两条独立；
 *   percent 先把每类目缩放到占比（v / 类目正值和，假设正值），domain 固定 0..1。
 * 返回每系列的 { colorVar, values, base, caps }（base = 该段的起始值，renderBars 画 [base, base+v]；
 * caps = 每类目布尔，仅「整根最外端」那段为 true → 封顶圆角，BAR-05），及堆叠总高 { lo, hi }。纯函数。
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
  /* [BAR-05] 每类目：正向最上段（累计顶端）+ 负向最下段（累计底端）封圆角，其余段直角。
     段按堆叠顺序累计，故正向最后一个正值段=最上、负向最后一个负值段=最下。 */
  const topSeg = categories.map(() => -1);
  const botSeg = categories.map(() => -1);
  segs.forEach((seg, si) => seg.values.forEach((v, i) => {
    if (v > 0) topSeg[i] = si; else if (v < 0) botSeg[i] = si;
  }));
  segs.forEach((seg, si) => { seg.caps = categories.map((_, i) => topSeg[i] === si || botSeg[i] === si); });
  return { lo: Math.min(0, ...neg), hi: percent ? 1 : Math.max(0, ...pos), segs };
}
