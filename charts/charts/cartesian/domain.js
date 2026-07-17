/*
 * cartesian/domain.js —— 【每根 Y 轴的数值范围（值域）】 · [L2-LOCAL] 图表专属，有意不下沉 L1
 *
 * 干什么：回答「这根轴要覆盖多大的数值区间」，结果喂给 niceSplit / niceSplitDual 取整成刻度。
 * 一根轴的值域 = 该轴**柱子集**（stack:none → 数据 extent、稳定不随隐藏变；堆叠 → 可见柱累计总高）
 * 并上**线子集** extent，且始终包含 0（柱从 0 基线长）。
 *
 * 不碰 DOM / 比例尺；堆叠总高借用 layout.js 的 stackBars（同一份累计逻辑，不重复实现）。
 */
import { stackBars } from './layout.js';

/* 一组系列里所有非 null 数据的 [min, max]（空则 [0,0]） */
export function extentOf(rows) {
  const nums = rows.flatMap((r) => r.data).filter((v) => v != null);
  return nums.length ? [Math.min(...nums), Math.max(...nums)] : [0, 0];
}

/*
 * 某根轴的值域 [lo, hi]。
 *   axisSeries —— 已按 axis 过滤出的该轴系列（含柱和线）
 *   stack      —— 当前堆叠模式；hidden —— 已隐藏系列名集合（堆叠按可见重算）
 */
export function axisDomain(categories, axisSeries, stack, hidden) {
  const bars = axisSeries.filter((r) => r.type === 'bar');
  const lines = axisSeries.filter((r) => r.type === 'line');
  let lo = 0;
  let hi = 0;
  if (stack !== 'none' && bars.length) {
    const st = stackBars(categories, bars.filter((r) => !hidden.has(r.name)), stack);
    lo = Math.min(lo, st.lo); hi = Math.max(hi, st.hi);
  } else if (bars.length) {
    const [a, c] = extentOf(bars);
    lo = Math.min(lo, a); hi = Math.max(hi, c);
  }
  if (lines.length) {
    const [a, c] = extentOf(lines);
    lo = Math.min(lo, a); hi = Math.max(hi, c);
  }
  return [lo, hi];
}
