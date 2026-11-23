/*
 * L3 · EPS 预期对比示例数据（specs/earnings.md 活 demo）。
 *
 * 8 个季度，覆盖五种状态各至少一个：超预期 / 符合 / 未达预期 / 无预期 / 待公布（最后一季）。
 * 副标题文案在这里按状态生成（AXIS-09）——组件只负责「第二行用什么颜色语义」，不判断写什么字；
 * 中文写在这里，Ainvest 的英文由 chart-presentation.js 的词表统一转换。
 */
export const EPS_QUARTERS = [
  { quarter: "Q1 '24", actual: 1.48, estimate: 1.42 },  /* 超预期 */
  { quarter: "Q2 '24", actual: 1.39, estimate: 1.45 },  /* 未达预期 */
  { quarter: "Q3 '24", actual: 1.55, estimate: 1.55 },  /* 符合 */
  { quarter: "Q4 '24", actual: 1.61, estimate: null },  /* 无预期 */
  { quarter: "Q1 '25", actual: 1.72, estimate: 1.66 },  /* 超预期 */
  { quarter: "Q2 '25", actual: 1.58, estimate: 1.64 },  /* 未达预期 */
  { quarter: "Q3 '25", actual: 1.70, estimate: 1.70 },  /* 符合 */
  { quarter: "Q4 '25", actual: null, estimate: 1.84 },  /* 待公布 */
];

/* 状态 → 副标题文案与颜色语义。判定口径与 L1 earningsState 相同（实际 vs 预期）；
   这里只决定「写什么字」，颜色语义（tone）随状态固定。 */
export function epsSubOf({ actual, estimate }) {
  if (actual == null && estimate == null) return { text: '', tone: 'muted' }; /* 该季无数据：不写副标题 */
  if (actual == null) return { text: '待公布', tone: 'muted' };
  if (estimate == null) return { text: '--', tone: 'muted' };
  if (Math.abs(actual - estimate) < 1e-9) return { text: '符合', tone: 'up' };
  return actual > estimate ? { text: '超预期', tone: 'up' } : { text: '未达预期', tone: 'down' };
}

export function epsEstimateConfig() {
  return {
    categories: EPS_QUARTERS.map((q) => q.quarter),
    xSub: EPS_QUARTERS.map(epsSubOf),
    decimals: 2, /* EPS 报告值两位小数；主题 number-format 只到一位（Ainvest） */
    series: [{
      name: 'EPS',
      type: 'earnings',
      labels: { actual: '实际', estimate: '预期', diff: '差值' },
      data: EPS_QUARTERS.map(({ actual, estimate }) => ({ actual, estimate })),
    }],
  };
}
