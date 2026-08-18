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
 * 间隔数组（规范值）。档位密度决定「跳档粒度」，进而决定两件事：
 *   1. 占比下限 ≈ 1 / 最大相邻档位比（本数组最大相邻比 1.25，来自 2→2.5 与 8→10）；
 *   2. **配合 headroom 时的超额留白**——上限只要求「至少留够」，实际留多少取决于
 *      能跳到哪一档。档位越密，越贴近所需，浪费越少。
 *
 * 2026-08-18 由 10 档扩到 16 档（新增 1.4 / 1.6 / 1.8 / 3.5 / 4.5 / 7）：
 * 原数组最大相邻比 1.33（1.5→2、3→4、6→8），顶格时一跳就多让 17~20%，远超一个标签的高度。
 * 实测（600 组正负数据、上限 h=0.107）中位超额由 9.5% 降到 6.5%，占比均值 79.8% → 82.3%。
 * 未取更密的 21 档方案（再加 1.1/2.2/2.8/5.5/9）：超额只再降 2 个百分点，
 * 却会出现 −36/−27/−18/−9万 这类不够圆的刻度，取舍上不划算。
 *
 * 想再抬高占比 / 再降超额 → 继续加档位；想让数字更圆 → 删档位。
 * 修订即修订 specs/axes.md 的 SCALE-01，并同步 tests/split.test.mjs 的占比下限护栏。
 */
export const INTERVAL_STEPS = [1, 1.2, 1.4, 1.5, 1.6, 1.8, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8];

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

/*
 * 给定负值段数：正负两侧各自够用的最小 need → 数组内最小档位，并算占比。
 *
 * [SCALE-03] `headroom`（0~1，缺省 0）= 数据端点与边界刻度之间至少要留出的「轴跨度占比」。
 * 调用方按像素需求换算：headroom = 标签高 ÷ 绘图区高。推导——要求
 *   正侧 posSeg×iv − hi ≥ headroom×iv×S  ⇒  iv ≥ hi / (posSeg − headroom×S)
 * 即**分母扣掉呼吸位**，负侧同理。headroom = 0 时完全退化为原式，故不出标签的图零变化。
 * 分母扣到 ≤ 0 说明绘图区矮到连一格都塞不下标签 —— 退回原分母（不留），
 * 否则会算出荒谬的大间隔，把图压成一条线。
 */
const solveAt = ([lo, hi], negSeg, S, headroom = 0) => {
  const posSeg = S - negSeg;
  const cut = headroom * S;
  const dNeg = negSeg - cut;
  const dPos = posSeg - cut;
  const need = Math.max(
    negSeg ? -lo / (dNeg > 0 ? dNeg : negSeg) : 0,
    posSeg ? hi / (dPos > 0 ? dPos : posSeg) : 0,
  );
  const iv = snapUp(need);
  return { iv, util: (hi - lo) / (iv * S) };
};

/* 负值段数 + interval → 三件套。刻度按「距零段数 × interval」构造而非
   min 累加：保证 0 点精确为零（浮点残差会破坏 0 轴判定与加深线） */
const mkSplit = (iv, negSeg, S) => {
  const ticks = Array.from({ length: S + 1 }, (_, i) => r12((i - negSeg) * iv));
  return { min: ticks[0], max: ticks[S], interval: iv, ticks };
};

/* 第三参兼容两种写法：数字 = lineCount（旧签名）；对象 = { lineCount, headroom } */
const readOpts = (o) => (typeof o === 'number' ? { lineCount: o } : (o || {}));

export function niceSplit(minValue, maxValue, opts = {}) {
  const { lineCount = Y_SPLIT_LINES, headroom = 0 } = readOpts(opts);
  const S = Math.max(1, lineCount - 1);
  const ext = normExtent([minValue, maxValue]);
  const [minNeg, maxNeg] = negSegRange(ext, S);

  let best = null;
  for (let negSeg = minNeg; negSeg <= maxNeg; negSeg++) {
    const c = { negSeg, ...solveAt(ext, negSeg, S, headroom) };
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
export function niceSplitDual(extentA, extentB, opts = {}) {
  const { lineCount = Y_SPLIT_LINES, headroom = 0 } = readOpts(opts);
  const S = Math.max(1, lineCount - 1);
  const A = normExtent(extentA);
  const B = normExtent(extentB);
  const [aLo, aHi] = negSegRange(A, S);
  const [bLo, bHi] = negSegRange(B, S);

  let best = null;
  for (let negSeg = Math.max(aLo, bLo); negSeg <= Math.min(aHi, bHi); negSeg++) {
    const a = solveAt(A, negSeg, S, headroom);
    const b = solveAt(B, negSeg, S, headroom);
    const score = Math.min(a.util, b.util);
    if (!best || score > best.score) best = { negSeg, a, b, score };
  }
  return {
    primary: mkSplit(best.a.iv, best.negSeg, S),
    secondary: mkSplit(best.b.iv, best.negSeg, S),
  };
}
