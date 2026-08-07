/*
 * pie/geometry.js —— 【扇区角度 + 半径环宽 + 标签锚点】 · [L2-LOCAL] 图表专属，有意不下沉 L1（PIE-01/02/04）
 *
 * 干什么：把「每个扇区占多少角、环画多大多厚、标签摆在哪」算成**纯数据**，交给 index.js 去画。
 * 不碰 DOM、不碰 d3、不碰 token——只做几何/数值，故可被 node --test 直接加载（同 cartesian/layout.js）。
 *
 * 角度约定与 d3.arc 一致：**0 弧度 = 12 点方向，正角顺时针**；圆心为原点，
 * 故任一角 a 处半径 r 的点是 (sin(a)·r, −cos(a)·r)——labelAnchor 用的就是这个式子，
 * 与 d3.arc().centroid() 同源，标签因此天然落在扇区里。
 *
 * 五个函数：
 *   sliceAngles  值 → 每个可绘扇区的 {i, a0, a1}（PIE-01）
 *   donutRadii   可用宽高 + 两个 token → {R, innerR, ring}（PIE-02）
 *   labelAnchor  单个扇区 → **扇区内**标签锚点 {x, y, maxWidth}（PIE-04）
 *   leaderElbow  单个扇区 → **外侧**引线的前两点 + 所在侧（PIE-12）
 *   alignOutside 一批外侧标签 + 对齐档 → 横段末端 / 文字锚点 / 标签带宽（PIE-13）
 */

const TAU = Math.PI * 2;

/*
 * [PIE-02] 半径收缩的**下限比例**：R 不小于 `--size-donut-radius` 的这个比例（50%）。
 * 没有下限时容器越拖越小、环就一路缩到几像素——那时扇区已无法分辨，图例、标签、hover 全都
 * 还在，唯独「占比」这件本体看不见了，不如让它溢出容器由调用方决定裁剪或滚动。
 * **取比例不取像素**：跟着各主题自己的 token 走（THS/iFinD 70→35、Ainvest 80→40），
 * 故不进 token，同 BAR-03 柱与间距的 2:1、LEGEND_MAX_PLOT_RATIO 的先例。
 */
const MIN_RADIUS_RATIO = 0.5;

/*
 * [PIE-01] 值 → 角度：每扇区角 = v / 可见项之和 × 360°，自 12 点起顺时针依次排布。
 * **null 与 ≤ 0 既不占角也不进分母**（同 BAR-01「null 跳过」/ BAR-05「0 不占位」的口径）——
 * 占比是「对总量的份额」，负份额没有几何表达；0 角度的扇区不是细线而是不存在。
 * 返回值只含**可绘扇区**并带原始下标 i（同 mark.js 的 .filter(v != null) 做法），
 * 调用方据 i 取回该扇区的名字与固定色槽——**颜色跟随实体，不因跳过而移位**（COLOR-04/08）。
 * 末段的 a1 强制吸到 TAU：逐段累加的浮点残差虽只有 1e-15，但环是闭合图形，
 * 差一点就是一条缝；吸边同时让「隐藏扇区后重新闭合 360°」（PIE-03）成为可断言的等式。
 * 全为 null / ≤0（总和为 0）时返回空数组 = 什么都不画。
 */
export function sliceAngles(values) {
  const total = values.reduce((s, v) => (v != null && v > 0 ? s + v : s), 0);
  if (!(total > 0)) return [];
  const out = [];
  let a = 0;
  values.forEach((v, i) => {
    if (v == null || v <= 0) return;
    const span = (v / total) * TAU;
    out.push({ i, a0: a, a1: a + span });
    a += span;
  });
  out[out.length - 1].a1 = TAU;
  return out;
}

/*
 * [PIE-02] 半径与环宽。radiusMax = --size-donut-radius、ringMax = --size-donut-ring-width。
 *   R      外半径 = **clamp(radiusMax × 0.5, min(宽,高)/2, radiusMax)**——token 是**上限**，
 *          空间不足就收缩（同 BAR-03 柱宽「上限 + 放不下就收缩」的口径），
 *          但**收缩有底**：不小于默认半径的一半（MIN_RADIUS_RATIO）。
 *          触底后容器继续变小，环**溢出画布**而不再变小（`.dv-chart__plot > svg` 已 overflow:visible）——
 *          「看得见但装不下」优于「装得下但看不清」：环缩到几像素时占比本身就没了，
 *          而这是这张图存在的全部理由。两种图例结构同一条规则，不分方位。
 *   ring   环宽**等比跟随** ringMax × R/radiusMax：收缩时保持三主题 28:70 的环宽:半径比不变
 *          （同 BAR-02「柱与间距按同一比例等比缩小」）；触底时环宽也一并触底（比值恒定）。
 *   innerR 内半径 = R − ring
 * variant='pie' → innerR=0 退化为实心饼；此时 ring 记为 R（= 该形态下的径向厚度），
 * 好让 labelAnchor 的可用宽判定对饼与环用同一条式子。
 * radiusMax ≤ 0（token 缺失且调用方未兜底）时 R=0，一切退化为不画，不抛错——
 * 下限是「默认半径的一半」，默认半径为 0 时下限自然也是 0，不会凭空造出一个环。
 */
export function donutRadii(w, h, radiusMax, ringMax, variant = 'donut') {
  const floor = Math.max(0, radiusMax) * MIN_RADIUS_RATIO;
  const R = Math.max(0, Math.min(radiusMax, Math.max(Math.min(w, h) / 2, floor)));
  if (variant === 'pie') return { R, innerR: 0, ring: R };
  const ring = radiusMax > 0 ? Math.min(R, ringMax * (R / radiusMax)) : 0;
  return { R, innerR: Math.max(0, R - ring), ring };
}

/*
 * [PIE-04] 标签锚点：扇区中线方向 × **环带中心半径** rm=(R+innerR)/2
 * （variant='pie' 时 innerR=0 即 R/2——一条公式通吃两种形态）。返回**相对圆心**的偏移，
 * 调用方叠加圆心坐标；这样本函数不需要知道画布在哪。
 *
 * maxWidth = min(切向弧长 rm·Δθ, 环宽 ring) —— 交给 L1 的 dropOversized 做「放不下就不放」
 * （LABEL-06③）。取两者较小者是为了**与扇区落在钟面哪个方向无关**：
 * 水平文本在 3 点方向受环宽限制、在 12 点方向受弧长限制，取小者对任意角度都成立，
 * 代价是宽扁扇区偏保守（少画几个）——而 LABEL-06③ 的立场本就是宁可不画
 * （档② 的字一旦溢出色块，溢出部分落到画布底色上直接看不见，比不画更糟）。
 */
export function labelAnchor(a0, a1, R, innerR) {
  const mid = (a0 + a1) / 2;
  const rm = (R + innerR) / 2;
  const ring = R - innerR;
  return {
    x: Math.sin(mid) * rm,
    y: -Math.cos(mid) * rm,
    maxWidth: Math.min(rm * (a1 - a0), ring),
  };
}

/*
 * [PIE-12] 外侧引线的前两个点（相对圆心）+ 该扇区归哪一侧。
 *   a  弧上起点：扇区中线与外半径的交点
 *   e  肘点：自 a 沿**同一条法线**再外延 radial（= --size-donut-label-line-radial）
 * 第三点（横段末端）由 alignOutside 按对齐档给，**其 y 恒等于 ey**——
 * 标签锚在扇区的自然角度上、不做纵向位移（LABEL-01 原样适用，PIE-14），
 * 故第二段是严格水平线。这条也是「未位移」最好验证的证据：量末两点的 y 差应恒为 0。
 *
 * 分侧：中线角 mid < π 归右、否则归左（12 点归右、6 点归左）。
 * 边界取「右」是因为 mid=0 的扇区其 ex=0 落在中轴上，归哪侧都不违反几何，
 * 取右让判定成为一条不含浮点比较的闭区间规则。
 * radial 取负值无意义，按 0 兜底（退化为肘点贴在弧上）。
 */
export function leaderElbow(a0, a1, R, radial) {
  const mid = (a0 + a1) / 2;
  const sin = Math.sin(mid);
  const cos = Math.cos(mid);
  const er = R + Math.max(0, radial);
  return {
    side: mid < Math.PI ? 'right' : 'left',
    ax: sin * R, ay: -cos * R,
    ex: sin * er, ey: -cos * er,
  };
}

/*
 * [PIE-13] 三档对齐：给一批外侧标签算出「横段末端 x、文字锚点 x、文字可用宽」，
 * 以及两侧各自的**标签带宽**（band = 相对 R 向外多占的距离，喂给 PIE-02 定画布宽）。
 *
 *   entries = [{ side:'left'|'right', ex, textWidth }]  —— ex 来自 leaderElbow（带符号）
 *   mode    = 'anchor' | 'column' | 'edge'
 *   lateral = --size-donut-label-line-lateral（横段基准长）
 *   gap     = --spacing-donut-label-gap（引线末端 → 文字净距）
 *   bandCap = 每侧带宽上限（容器余量与 --size-donut-label-band-max 取紧者，缺省不限）
 *   R       = 外半径
 * → { band: { left, right }, items: [{ lineEndX, textX, anchor, maxWidth }] }（与 entries 同序）
 *
 * 记 e = |ex|、w = 文本宽，各侧「够用的带宽」按档不同：
 *   anchor / edge  max(e + lateral + gap + w) − R   —— 能容下全部文字的**最紧**带宽
 *   column         max(e) + lateral + gap + max(w) − R —— 末端共线把线推到最远那条，故更宽
 *
 * ⚠️ **两侧带宽恒等**（`band.left === band.right`，取两侧所需的较大者）：算出来的是各侧**所需**，
 * 落地的是**两侧统一**的预留。哪怕只有左侧挂着一条引线，右侧也照样留出同宽的带——
 * 否则画布只往一侧长，环的圆心就偏离画布中心，整张卡片看起来是歪的（PIE-13）。
 *
 * 带宽被 bandCap 截断时不改变任何标签的位置，只让 maxWidth 变小，
 * 交给 L1 的 dropOversized 逐个丢弃（LABEL-06③）——本模块**不做丢弃判定**。
 *
 * 三档的差别只在「横段末端落在哪」与「文字往哪边对齐」：
 *   anchor  末端 = e + lateral（各自定长）      文字内沿贴末端，外沿参差
 *   column  末端 = max(e) + lateral（同侧共线） 文字内沿贴同一条线，外沿参差
 *   edge    文字外沿贴画布边（band 外沿）        末端反推，长短不一
 */
export function alignOutside(entries, mode, { lateral = 0, gap = 0, bandCap = Infinity, R = 0 } = {}) {
  const perSide = {};
  let need = 0;                                    /* 两侧所需的较大者 —— 带宽对称，只留一个 */

  for (const side of ['left', 'right']) {
    const own = entries.filter((d) => d.side === side);
    const maxE = own.length ? Math.max(...own.map((d) => Math.abs(d.ex))) : 0;
    perSide[side] = { lineAt: maxE + lateral };                      /* column 档的公共竖线 */
    if (!own.length) continue;                     /* 空侧不提需求，但下面照样拿到同宽的带 */
    need = Math.max(need, mode === 'column'
      ? perSide[side].lineAt + gap + Math.max(...own.map((d) => d.textWidth)) - R
      : Math.max(...own.map((d) => Math.abs(d.ex) + lateral + gap + d.textWidth)) - R);
  }

  /* ⚠️ **向上取整不是为了好看，是为了不把刚好装得下的标签判成装不下**：
     带宽正是由文本宽反推的，于是 maxWidth = R + band − inner 在实数意义上恰好等于该文本宽；
     L1 的 dropOversized 会**重新测量**同一段文字再比大小，两次浮点运算差 1e-14 就能让
     「恰好装得下」翻成 false，而引线已经画出去了 —— 结果是一条指向空处的线（实测过）。
     取整给出 <1px 的余量，稳稳盖住这点误差，顺带让画布尺寸落在整像素上。 */
  const width = Math.max(0, Math.min(Math.ceil(need), bandCap));
  const band = { left: width, right: width };      /* [PIE-13] 两侧恒等 → 圆心恒在画布中心 */
  for (const side of ['left', 'right']) perSide[side].outerX = R + width;

  const items = entries.map((d) => {
    const dir = d.side === 'right' ? 1 : -1;
    const { outerX, lineAt } = perSide[d.side];
    const e = Math.abs(d.ex);
    const inner = e + lateral + gap;          /* 文字最内侧能起排的位置，三档共用 */
    if (mode === 'edge') {
      /* 文字外沿贴边 → 末端 = 外沿 − 文字宽 − 净距；最窄不短于自己的定长横段 */
      const end = Math.max(e + lateral, outerX - d.textWidth - gap);
      return {
        lineEndX: dir * end,
        textX: dir * outerX,
        anchor: d.side === 'right' ? 'end' : 'start',
        maxWidth: Math.max(0, outerX - inner),
      };
    }
    const end = mode === 'column' ? lineAt : e + lateral;
    return {
      lineEndX: dir * end,
      textX: dir * (end + gap),
      anchor: d.side === 'right' ? 'start' : 'end',
      maxWidth: Math.max(0, outerX - (end + gap)),
    };
  });

  return { band, items };
}
