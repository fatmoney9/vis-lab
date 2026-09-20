/*
 * L1 · 柱系几何（纯计算：无 DOM、无 d3、无 token）。
 * 权威规范见 specs/bar.md（BAR-01 / BAR-02 / BAR-03 / BAR-05 / BAR-06）。
 *
 * ⚠️ **本模块必须零 import**，这不是风格是硬约束：消费方 `tests/bar-geometry.test.mjs` 与
 * `tests/layout.test.mjs` 被 `node --test` 直接加载，而 `core/mark.js` 顶部 `import 'd3'`。
 * 同 measure.js / split.js / polar-label.js / legend-state.js 的纪律。
 *
 * ── 为什么会有这个模块 ────────────────────────────────────────────
 * 它不是「可能有用所以先抽出来」，而是两条既有纪律同时被兑现：
 *   ① `groupedBars` / `singleBar` / `stackBars` 原先住在 `charts/charts/cartesian/layout.js`
 *      并标着 `[L2-LOCAL]`。它们的签名里**没有一个 x/y 字样**、收的是标量 band 与值数组，
 *      横向条把 band 当行高传即可、一行不用改 —— 第二个消费者一出现，
 *      `WORKFLOW.md` 第三节「两种以上图表都要遵守的规范 → 沉到 L1」就机械触发。
 *   ② `barPath` / `barRadius` 原先是 `core/mark.js` 的私有函数。那里 import d3、
 *      `node --test` 加载不了 ⇒ **它们永远不能单测**，而圆角夹取 `min(r, w/2, h)` 写错
 *      在 2px 圆角上肉眼根本看不出来。
 * 两者合成一个模块而不是两个：都是「柱系的纯计算」，且每族 README 的 L1 声明只多一行。
 *
 * ── 为什么叫 bar-geometry 而不是 bar-layout ───────────────────────
 * 里面既有「排布」（band 内怎么分格）也有「图元路径」（单根柱长什么样），
 * 叫 layout 会让人以为 barPath 不在这儿。geometry 同时涵盖两者，
 * 与 `charts/charts/radar/geometry.js`、`charts/charts/waterfall/geometry.js` 的用词一致。
 */

/*
 * [BAR-01][HBAR-02] 单根柱 / 条的路径：仅**远离基线的那一端**圆角，r=0 退化为直角矩形。
 *   side —— 'top'    正值竖柱（圆角在上）   · 'bottom' 负值竖柱（圆角在下）
 *           'right'  正值横条（圆角在右）   · 'left'   负值横条（圆角在左）
 *
 * 圆角夹取**按方向换轴**：竖向 `min(r, w/2, h)`（半个柱宽、整根柱高），
 * 横向 `min(r, h/2, w)`（半个条厚、整根条长）。两者是同一条规则的两个方向——
 * 「圆角不得超过厚度的一半，也不得超过长度」。
 *
 * ⚠️ **'top' / 'bottom' 两支是从 core/mark.js 原样迁入的，一个字符都没改。**
 * `tests/bar-geometry.test.mjs` 用 golden-value 把它们的输出串锁死了：
 * 这是「柱系几何下沉没有改变 cartesian 任何一个像素」的可执行证据，
 * 比肉眼比对截图可靠。要改纵向路径，先想清楚你在改的是全部纵向柱图。
 */
export function barPath(x, yTop, w, h, r, side = 'top') {
  if (side === 'right' || side === 'left') {
    r = Math.max(0, Math.min(r, h / 2, w));
    if (r === 0) return `M${x},${yTop}h${w}v${h}h${-w}Z`;
    return side === 'right'
      ? `M${x},${yTop}H${x + w - r}a${r},${r} 0 0 1 ${r},${r}V${yTop + h - r}a${r},${r} 0 0 1 ${-r},${r}H${x}Z`
      : `M${x + w},${yTop}H${x + r}a${r},${r} 0 0 0 ${-r},${r}V${yTop + h - r}a${r},${r} 0 0 0 ${r},${r}H${x + w}Z`;
  }
  r = Math.max(0, Math.min(r, w / 2, h));
  if (r === 0) return `M${x},${yTop}h${w}v${h}h${-w}Z`;
  return side === 'top'
    ? `M${x},${yTop + h}V${yTop + r}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${yTop + h}Z`
    : `M${x},${yTop}V${yTop + h - r}a${r},${r} 0 0 0 ${r},${r}h${w - 2 * r}a${r},${r} 0 0 0 ${r},${-r}V${yTop}Z`;
}

/*
 * [BAR-01] 圆角按**最终条厚**分档：THS 的圆角随柱变窄降级，其他主题 rMax=0 恒直角。
 * 首参叫 thickness 而不是 width —— 竖柱的「厚」是柱宽、横条的「厚」是行厚，是同一件事；
 * 叫 width 会让横向消费方以为该传条长。语义未变，纵向调用方传的仍是柱宽。
 */
export function barRadius(thickness, rMax, rReduced, fullMinThickness, reducedMinThickness) {
  if (rMax <= 0 || thickness < reducedMinThickness) return 0;
  if (thickness < fullMinThickness) return Math.min(rMax, rReduced);
  return rMax;
}

/* [BAR-02/03] 分组：band 走 'slot' 模式 = 整格 step（每格铺满、组间距最小 0）。n 根柱在
   container=min(band, containerMax) 内、整组回 band 居中；**组间距 = band − 内容块** 为残量（数据少→容器封顶
   组间距变大、数据多→内容块占满 band 组间距=0），与单柱同一套容器规则（见 singleBar）。
   柱宽上限 barMax、柱间距上限 gapMax；放不下时**柱与间距按同一比例 s 等比缩小**
   （s=柱宽/barMax=间距/gapMax，恒保持 barMax:gapMax，如 32:2）——间距只在柱顶到 barMax 时才是满值 gapMax。
   ratio>0（三主题 2:1）时容器内**左右两侧再留白**：内容块(柱+柱间距) : 两侧留白总和 = ratio:1，
   内容块只能占 container 的 ratio/(ratio+1) → 进一步压小 s（ratio=0 退化为不留侧白、内容块铺满 container）。
   containerMax = size-bar-group-container-max。定位把内容块在 band 内居中（侧白即两侧自然余量、对称）。
   n=1（分组被隐藏到只剩一根）不特判：通用式退化为 contentAtMax=barMax → width=min(barMax, contentRegion)，
   同样吃 ratio 侧白 → 与 n≥2 一样随 band 变窄等比收缩。（曾有 n===1 早返回漏掉 ratio，柱宽变成
   min(band, barMax)：band≥barMax 时钉死在上限、缩放轴拖动毫无反应，band<barMax 时柱宽=band、柱贴柱无间隙。） */
export function groupedBars(n, band, barMax, gapMax, containerMax = Infinity, ratio = 0) {
  const container = Math.min(band, containerMax);
  const contentRegion = ratio > 0 ? (container * ratio) / (ratio + 1) : container;
  const contentAtMax = n * barMax + (n - 1) * gapMax;         /* 全部顶到最大时的内容块宽 */
  const s = Math.min(1, contentRegion / contentAtMax);        /* 放不下 → 柱与间距同比缩小 */
  const width = barMax * s;
  const g = gapMax * s;
  const content = n * width + (n - 1) * g;
  const start = (band - content) / 2;
  return Array.from({ length: n }, (_, i) => ({ offset: start + i * (width + g), width }));
}

/* [BAR-03/05][HBAR-03] 单列（基础单柱 + 堆叠单列共用）：band 走 'slot' 模式 = 整格 step（每格铺满、格间距最小 0）。
   容器 = min(band, containerMax) = 「柱 + 左右侧白」：ratio>0（如 2:1）时柱只占容器 ratio/(ratio+1)、
   两侧各留 1/(2(ratio+1))；柱宽再受 barMax 封顶（containerMax·ratio/(ratio+1)=barMax 恒成立 → 宽格满宽）。
   数据少：band 大 → 容器封顶 containerMax、格间距=band−容器随之变大；数据多：band<containerMax → 容器缩小、格间距=0。
   ratio=0 → 不留侧白、退化为 min(band, barMax)。containerMax=size-bar-container-max、ratio=size-bar-gap-ratio。
   （堆叠时所有系列段共用这一个 {offset,width}，靠 base 叠起。）
   **横向条复用同一份**：band 传行高、返回的 offset/width 读作「行内纵向偏移 / 条厚」，
   token 换成 size-hbar-row-* 一族；这是本模块从 L2 下沉的直接原因。 */
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
