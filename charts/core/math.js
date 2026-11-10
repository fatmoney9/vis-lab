/*
 * L1 · 数值小工具（零 import、无 DOM、无 d3、无 token，可被 node --test 直接加载）。
 *
 * 为什么单开一个文件：`clamp` 曾在 tooltip / callout / polar-label / radar / chord 各有一份私有副本，
 * **参数顺序还不一致**——tooltip 是 (v, lo, hi)、其余是 (lo, v, hi)，照着一处去调另一处就会悄悄传反；
 * `clamp01` 在 sankey / hbar 各一份，对非数输入的处理也不同（一个当 0、一个原样漏出 NaN）。
 * 收成一份，顺序与口径都只有一个答案。
 *
 * ⚠️ **本模块必须保持零 import**：polar-label.js 与多个 L2 纯几何模块都依赖它，
 * 而它们都要被 `node --test` 直接加载（同 measure.js / split.js / legend-state.js 的纪律）。
 */

/* 把 v 夹到 [lo, hi]。**参数顺序 = 数轴顺序 (lo, v, hi)**，读起来就是「lo ≤ v ≤ hi」。
   lo > hi 时结果为 lo（Math.max 后执行）——调用方传进来的上界可能因空间不足小于下界，此时下界优先。 */
export const clamp = (lo, v, hi) => Math.max(lo, Math.min(v, hi));

/* 进度 / 比例夹到 [0, 1]。非数（undefined / NaN / 非数字字符串）一律当 0：
   插值进度一旦漏出 NaN，后续几何会整片变 NaN、图元直接消失，不如停在起点。 */
export const clamp01 = (t) => clamp(0, Number(t) || 0, 1);
