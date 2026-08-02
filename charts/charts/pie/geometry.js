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
 * 三个函数：
 *   sliceAngles  值 → 每个可绘扇区的 {i, a0, a1}（PIE-01）
 *   donutRadii   可用宽高 + 两个 token → {R, innerR, ring}（PIE-02）
 *   labelAnchor  单个扇区 → 标签锚点 {x, y, maxWidth}（PIE-04）
 */

const TAU = Math.PI * 2;

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
 *   R      外半径 = min(token, min(宽,高)/2)——token 是**上限**，空间不足就收缩
 *          （同 BAR-03 柱宽「上限 + 放不下就收缩」的口径）
 *   ring   环宽**等比跟随** ringMax × R/radiusMax：收缩时保持三主题 28:70 的环宽:半径比不变
 *          （同 BAR-02「柱与间距按同一比例等比缩小」）
 *   innerR 内半径 = R − ring
 * variant='pie' → innerR=0 退化为实心饼；此时 ring 记为 R（= 该形态下的径向厚度），
 * 好让 labelAnchor 的可用宽判定对饼与环用同一条式子。
 * radiusMax ≤ 0（token 缺失且调用方未兜底）时 R=0，一切退化为不画，不抛错。
 */
export function donutRadii(w, h, radiusMax, ringMax, variant = 'donut') {
  const R = Math.max(0, Math.min(radiusMax, Math.min(w, h) / 2));
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
