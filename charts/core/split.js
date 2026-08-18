/*
 * L1 · Y 轴刻度三件套（min / max / interval）的**纯数学**。权威规范见 specs/axes.md SCALE-01/03/04。
 *
 * 本模块**零 import**（尤其不碰 d3）：使它可被 node 直接加载、进而可被 `node --test` 覆盖。
 * 与 `scale.js` 分开只为一件事——那边 import d3（`linearY` / `bandX` 需要），住在里面
 * 整套刻度算法就一行都测不了。判例同 `legend-state.js` 从 `legend.js` 拆出。
 *
 * [SCALE-01] Y 轴分割线默认 5 条，min / max / interval 三件套对齐。
 * 两条硬约束（不降级）：
 *   1. interval 必须取自间隔数组 INTERVAL_STEPS（×10ⁿ）
 *   2. 0 恒落在某条分割线上（⇔ min = -负值段数 × interval）
 * [SCALE-03] 占比最大化：在硬约束内枚举「负值段数」（跨零时把 4 段按正负
 * 值域比例分配），每个段数取数组内能覆盖数据的最小 interval，
 * 最终选数据值域 / 轴值域占比最高的候选。
 * 分割线数量与间隔数组都是规范值而非组件参数——修订 = 修订 specs/axes.md。
 */
export const Y_SPLIT_LINES = 5;
/*
 * 间隔数组（规范值）。档位密度直接决定占比下限：
 * 占比下限 ≈ 1 / 最大相邻档位比。本数组最大相邻比 1.33（1.5→2、3→4、6→8），
 * 正值场景占比下限 ≈ 75%，典型 85%+。想再抬高占比 → 往数组加档位；
 * 想让数字更圆 → 删档位。修订即修订 specs/axes.md 的 SCALE-01。
 */
export const INTERVAL_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

const r12 = (v) => Number(v.toPrecision(12));

/* 数组内 ≥ need 的最小值（跨数量级） */
function snapUp(need) {
  const mag = 10 ** Math.floor(Math.log10(need));
  for (const s of INTERVAL_STEPS) {
    const iv = r12(s * mag);
    if (iv >= need - 1e-9) return iv;
  }
  return r12(INTERVAL_STEPS[0] * mag * 10);
}

/* ── 单轴 / 双轴共用的四个步骤（同一套刻度规则只写一遍）──────────────── */

/* 值域归一：并入 0，退化值域兜底 */
const normExtent = ([l, h]) => {
  const lo = Math.min(0, l);
  let hi = Math.max(0, h);
  if (hi - lo < 1e-9) hi = lo + 1;
  return [lo, hi];
};

/* 负值段数的可行区间：有负值至少 1 段，有正值至多 S-1 段
   （全正从 0 段起、全负到 S 段止——多余段位占比必然更低，会被择优淘汰） */
const negSegRange = ([lo, hi], S) => [lo < 0 ? 1 : 0, hi > 0 ? S - 1 : S];

/* 给定负值段数：正负两侧各自够用的最小 need → 数组内最小档位，并算占比 */
const solveAt = ([lo, hi], negSeg, S) => {
  const posSeg = S - negSeg;
  const need = Math.max(negSeg ? -lo / negSeg : 0, posSeg ? hi / posSeg : 0);
  const iv = snapUp(need);
  return { iv, util: (hi - lo) / (iv * S) };
};

/* 负值段数 + interval → 三件套。刻度按「距零段数 × interval」构造而非
   min 累加：保证 0 点精确为零（浮点残差会破坏 0 轴判定与加深线） */
const mkSplit = (iv, negSeg, S) => {
  const ticks = Array.from({ length: S + 1 }, (_, i) => r12((i - negSeg) * iv));
  return { min: ticks[0], max: ticks[S], interval: iv, ticks };
};

export function niceSplit(minValue, maxValue, lineCount = Y_SPLIT_LINES) {
  const S = Math.max(1, lineCount - 1);
  const ext = normExtent([minValue, maxValue]);
  const [minNeg, maxNeg] = negSegRange(ext, S);

  let best = null;
  for (let negSeg = minNeg; negSeg <= maxNeg; negSeg++) {
    const c = { negSeg, ...solveAt(ext, negSeg, S) };
    if (!best || c.util > best.util) best = c;
  }
  return mkSplit(best.iv, best.negSeg, S);
}

/*
 * [SCALE-04] 双 Y 轴：共享分割线 + 0 轴恒对齐。
 * 两轴共用同一组分割线（同数量、同像素位置），0 永远落在同一条分割线上——
 * 实现方式：两轴**共享负值段数 negSeg**（0 的位置 = 第 negSeg 条线），
 * interval 各自从间隔数组取（SCALE-01 硬约束对两轴分别成立）。
 * 在两轴可行 negSeg 的交集内，选「较差一侧占比」最大的组合。
 * 必然代价：一轴全正、另一轴跨零时，全正轴会出现空的负值段（0 对齐所致）。
 */
export function niceSplitDual(extentA, extentB, lineCount = Y_SPLIT_LINES) {
  const S = Math.max(1, lineCount - 1);
  const A = normExtent(extentA);
  const B = normExtent(extentB);
  const [aLo, aHi] = negSegRange(A, S);
  const [bLo, bHi] = negSegRange(B, S);

  let best = null;
  for (let negSeg = Math.max(aLo, bLo); negSeg <= Math.min(aHi, bHi); negSeg++) {
    const a = solveAt(A, negSeg, S);
    const b = solveAt(B, negSeg, S);
    const score = Math.min(a.util, b.util);
    if (!best || score > best.score) best = { negSeg, a, b, score };
  }
  return {
    primary: mkSplit(best.a.iv, best.negSeg, S),
    secondary: mkSplit(best.b.iv, best.negSeg, S),
  };
}
