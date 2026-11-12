/*
 * L3 · 直角坐标系示例的假数据：类目、正负波形、多系列名与副轴增速。
 * 由 demos/examples.js 统一转出；只装数据与纯函数，不 import d3、不碰 DOM。
 */

/* ── 数据生成（示例专用假数据；固定公式、无随机数与当前时间，保证截图可复现）── */

const K = (values) => values.map((v) => (v == null ? null : v * 1000));

export const seq = (n) => Array.from({ length: n }, (_, i) => `${i + 1}`);

/* 基础波形：相位 p 让多系列彼此错开 */
export const wave = (n, p = 0) => K(Array.from(
  { length: n },
  (_, i) => Math.round(560 + 360 * Math.sin(i * 0.6 + p) + 140 * Math.cos(i * 1.7 + p)),
));

/* 含负值 / 0 / null 的单系列（正负值柱专用：负值向下、0 值 1px 占位、null 断口全可见） */
export const signedWave = (n) => {
  const d = wave(n, 0.8).map((v) => v - 500000);
  if (n > 1) d[1] = -Math.abs(d[1]);
  if (n > 2) d[2] = 0;
  if (n > 4) d[4] = null;
  return d;
};

/* 多系列正值波形：按序相移。
   ⚠️ **相位不能一路按 index × 0.9 递增**：第 8 条落到 6.3，与 2π（6.283）只差 0.017，
   于是与第 1 条几乎同轨——实测 Δmax 仅为量程的 0.72%。更糟的是 7 色板（COLOR-02）
   恰好也在第 8 条循环回第 1 色，**同色又同高**，看起来像图表把同一条画了两遍。
   故第 7 条起插半档相位回到区间前段：12 条全部落在 [0, 4.95]、互不重合，也不越过 2π。
   前 6 条相位与本规则落地前逐字一致，故既有示例与三档预设的数据一个数都没变。
   它只保证**轨迹不重复**，不干预折线自然交叉。 */
const seriesPhase = (index) => (index < 6 ? index * 0.9 : (index - 6) * 0.9 + 0.45);
export const posSeries = (n, names) => names.map((name, k) => ({ name, data: wave(n, seriesPhase(k)) }));

export const FINANCIAL_SERIES_NAMES = [
  '营业收入', '成本', '利润', '税费', '研发投入', '现金流',
  '销售费用', '管理费用', '财务费用', '投资收益', '营业外收入', '所得税',
];

export const MARKET_INDEX_SERIES_NAMES = [
  '沪深300', '中证500', '创业板指', '上证50', '科创50', '中证1000',
  '中证红利', '国证2000', '北证50', '恒生指数', '恒生科技', '纳斯达克',
];

/* index 详情页的系列数量滑块会把第二个参数传进示例 cfg。这里仅负责从假数据池取数，
   不是图表能力；preserveLast 用于始终保留组合图折线 / 正负堆叠负值项。 */
export const selectExampleSeries = (series, requested, fallback, preserveLast = false) => {
  const parsed = Math.round(Number(requested));
  const count = Math.max(1, Math.min(series.length, Number.isFinite(parsed) ? parsed : fallback));
  return preserveLast && count < series.length
    ? [...series.slice(0, count - 1), series.at(-1)]
    : series.slice(0, count);
};

/* 负值系列（堆叠含负值用） */
export const negWave = (n) => wave(n, 2).map((v) => -Math.round(v * 0.4));

/* 基础折线：保持正值，中途一个 null 断口 */
export const lineWave = (n) => {
  const d = wave(n, 0.4);
  d[Math.floor(n / 3)] = null;
  return d;
};

/* 正负值折线：默认首屏即跨零；数据量增加后补一个 null 断口 */
export const signedLineWave = (n) => {
  const d = wave(n, 0.4).map((v) => v - 500000);
  if (n > 1) d[1] = -Math.abs(d[1]);
  if (n > 2) d[2] = 0;
  if (n > 4) d[4] = null;
  return d;
};

/* 副轴增速（%）：小数量级、与柱不同量纲 */
export const growth = (n) => Array.from({ length: n }, (_, i) => Math.round(12 + 9 * Math.sin(i * 0.5)));
