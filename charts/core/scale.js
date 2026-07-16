import { scaleLinear, scaleBand } from 'd3';

/*
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

export function niceSplit(minValue, maxValue, lineCount = Y_SPLIT_LINES) {
  const S = Math.max(1, lineCount - 1);
  const lo = Math.min(0, minValue);
  let hi = Math.max(0, maxValue);
  if (hi - lo < 1e-9) hi = lo + 1;

  /* 负值段数的合法取值：全正 0 段、全负 S 段、跨零 1..S-1 段 */
  const negSegs = lo < 0 && hi > 0
    ? Array.from({ length: S - 1 }, (_, i) => i + 1)
    : [lo < 0 ? S : 0];

  let best = null;
  for (const negSeg of negSegs) {
    const posSeg = S - negSeg;
    const need = Math.max(negSeg ? -lo / negSeg : 0, posSeg ? hi / posSeg : 0);
    const iv = snapUp(need);
    if (!best || iv < best.iv) best = { iv, negSeg };
  }

  const { iv, negSeg } = best;
  const min = r12(-negSeg * iv);
  return {
    min,
    max: r12(min + iv * S),
    interval: iv,
    ticks: Array.from({ length: S + 1 }, (_, i) => r12(min + i * iv)),
  };
}

/* 数值 → 像素（Y 向下为正，故 range 反转） */
export function linearY(split, top, bottom) {
  return scaleLinear().domain([split.min, split.max]).range([bottom, top]);
}

/* 类目 → band 位置与宽度（柱状图及延伸图表的 X 轴） */
export function bandX(categories, left, right, { grouped = false } = {}) {
  return scaleBand()
    .domain(categories)
    .range([left, right])
    .paddingInner(grouped ? 0.25 : 1 / 3)
    .paddingOuter(grouped ? 0.125 : 1 / 6);
}
