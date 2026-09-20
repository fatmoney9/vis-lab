/*
 * [L2-LOCAL][HBAR-10..13] 横向条的排名模型：排序、Top-N 截断、两帧之间的插值。
 * 零 import、无 DOM、无 d3、不读 token，故整份可被 node --test 直接加载。
 *
 * ── 为什么插值的是**名次**，不是只插值数值 ────────────────────────
 * 这是本族与 SankeyChart 最关键的分叉，别照抄那边：
 *   桑基的节点位置是流量的**连续函数** ⇒ 插值 value 后重跑 layout 天然平滑；
 *   本族的行位置是**排序名次**，是值的**离散函数** ⇒ 若每帧对插值后的值重新排序，
 *   两条曲线交叉的那一帧会整行**瞬跳**（A 从第 3 行瞬移到第 2 行）。
 * 所以名次本身也线性插值，得到**小数名次** ⇒ 行 y 连续 ⇒ 交叉时两条平滑对穿。
 *
 * ── Top-N 进出场是同一条 t 的副产品，不需要第二套时序 ──────────────
 * 不在某一端的实体，它在那端的名次取 `topN`（榜底外一行）、alpha 取 0：
 *   进榜者 rank 从 topN 滑到目标名次、alpha 0→1 ⇒ **从榜底滑入 + 淡入同时成立**；
 *   掉榜者反向。渲染时取 `rank <= topN` 并按绘图区裁剪即可。
 */

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a, b, t) => a + (b - a) * t;

/* 实体身份：显式 key 优先，回落名称。名次会变，**身份不能跟着名次变**，
   否则 keyed join 会把两根条认成同一根。 */
const keyOf = (item) => String(item?.key ?? item?.name ?? '');

/*
 * [HBAR-10][HBAR-11] 一帧的排名快照。
 *   items = [{ key?, name, value }]，**声明序决定取色槽位**（颜色跟随实体、不跟随名次）
 *   topN  = 只显示前 N 名；其余项仍留在结果里（rank >= topN、alpha 0），供插值当「榜外位」用
 * → { rows: [{ key, name, value, slot, rank, alpha, seat }], max }
 *     slot —— 声明序下标，取色用
 *     rank —— 名次，0 为榜首
 *     alpha—— 1 在榜、0 不在榜
 *     seat —— 供插值使用的「座位」：在榜取 rank、不在榜一律取 topN（榜底外一行）
 *
 * 同值按 key 字典序稳定裁决：并列的两条在相邻两帧里不得换来换去，否则会无端抖动。
 * null / 非数按 0 计（不画条，但仍占一个名次，避免它凭空消失又出现）。
 */
export function rankItems(items, topN = 10) {
  const n = Math.max(1, Math.round(topN));
  const list = (items ?? []).map((item, slot) => ({
    key: keyOf(item),
    name: String(item?.name ?? keyOf(item)),
    value: Number.isFinite(Number(item?.value)) ? Number(item.value) : 0,
    slot,
  }));
  list.sort((a, b) => (b.value - a.value) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const rows = list.map((row, rank) => ({
    ...row,
    rank,
    alpha: rank < n ? 1 : 0,
    seat: rank < n ? rank : n,
  }));
  return { rows, max: Math.max(0, ...rows.filter((r) => r.rank < n).map((r) => r.value)) };
}

/*
 * [HBAR-12][HBAR-13] 两帧之间的插值。t 是**已缓动**的进度。
 *
 * 取 from ∪ to 的全部实体：某一端缺席就用「榜底外一行 + alpha 0 + 值 0」顶上，
 * 于是进榜 / 掉榜与普通换位走的是同一条公式。
 * `max` 也插值——值域突变会让所有条同时抽一下，比名次跳变更刺眼。
 *
 * 端点严格相等：t=0 逐字段等于 from、t=1 逐字段等于 to（调用方在末帧仍应直接用目标帧原值收尾）。
 */
export function interpolateRanking(from, to, t, topN = 10) {
  const n = Math.max(1, Math.round(topN));
  const ratio = clamp01(t);
  const byKey = (snapshot) => new Map((snapshot?.rows ?? []).map((r) => [r.key, r]));
  const a = byKey(from);
  const b = byKey(to);
  const absent = { value: 0, seat: n, alpha: 0 };
  /* 不变量：**两个生产者（rankItems 与本函数）都保证每行带 seat**，所以这里直接读。
     它不是冗余字段——HBAR-17 要求「从当前显示态起补」，而当前显示态正是本函数上一帧的输出，
     于是本函数的输出必须能原样再喂给它自己。去掉输出末尾那行 seat 赋值，链式插值立刻算出 NaN。 */
  const seatOf = (r) => r?.seat;

  const keys = [...new Set([...a.keys(), ...b.keys()])];
  const rows = keys.map((key) => {
    const x = a.get(key) ?? absent;
    const y = b.get(key) ?? absent;
    const seed = b.get(key) ?? a.get(key);
    return {
      key,
      name: seed.name,
      slot: seed.slot,
      value: lerp(x.value, y.value, ratio),
      rank: lerp(seatOf(x), seatOf(y), ratio),
      alpha: lerp(x.alpha, y.alpha, ratio),
    };
  });
  rows.sort((p, q) => (p.rank - q.rank) || (p.key < q.key ? -1 : 1));
  /* 输出也带上 seat（= 当前小数名次），使本函数的结果能原样再喂给它自己 */
  rows.forEach((r) => { r.seat = r.rank; });
  return { rows, max: lerp(from?.max ?? 0, to?.max ?? 0, ratio) };
}

/*
 * [HBAR-03] 行几何：绘图区高 → 每行的纵向位置与条厚。
 *   rank 可以是小数（插值中途），所以行 y 是连续的。
 *   thickness 由 L1 `core/bar-geometry.js` 的 singleBar 算（band 传行高），本函数只管摆位。
 */
export function rowGeometry(rank, rowHeight, offset, thickness) {
  return { y: rank * rowHeight + offset, height: thickness };
}

/*
 * 可见行：只画 `rank <= topN`（含正在滑出榜底那一行）且还有不透明度的。
 * 上界用 topN 而不是 topN-1，是因为掉榜者要能滑到榜底外一行再消失。
 */
export function visibleRows(rows, topN = 10) {
  const n = Math.max(1, Math.round(topN));
  return (rows ?? []).filter((r) => r.rank <= n && r.alpha > 0.001);
}
