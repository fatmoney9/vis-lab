/*
 * L3 · 雷达图示例数据：维度名（中 / 英）、固定量程与各密度档的分数。
 * 由 demos/examples.js 统一转出；只装数据与纯函数，不 import d3、不碰 DOM。
 */

/* ── 雷达图（specs/radar.md）────────────────────────────────────
   维度名取自基线文档 7.2 的财务指标示例；英文一套对齐 AInvest Figma 实例。
   **密度旋钮在本族 = 维度数**，三档 3 / 5 / 6 正好压住基线 1.2 的两端建议
   （「并列维度应大于 2」「建议小于 6」）。3 轴档是轴标签八向定位最容易崩的一档。 */
const RADAR_DIM_CN = ['盈利能力', '资产质量', '偿债能力', '现金流', '运营能力', '成长性'];
const RADAR_DIM_EN = ['Performance', 'Safety', 'Momentum', 'Funds flow', 'Basics', 'Sentiment'];

export const radarDims = (n, lang = 'cn') => (lang === 'en' ? RADAR_DIM_EN : RADAR_DIM_CN).slice(0, n);

/* [RADAR-04] 固定量程：评分类雷达的常态。不固定的话 niceSplit 会把 0–5 抬成 0–5.4，
   且两张图数据不同时量程不同、形状不可比——而横向对比正是雷达图存在的理由。 */
export const RADAR_FIXED_MAX = 5;

/* [RADAR-03] 网格环数。配 0–5 量程恰好每环 1 分，刻度读数与环一一对应。 */
export const RADAR_SEGMENTS = 5;

/* [RADAR-15] 分段雷达的两套设计档位。数组长度既是底部说明项数，也会成为雷达内部
   色带 / 环线数量；两者必须同源，禁止预览面各自拼一份。 */
export const RADAR_RATING_BAND_LABELS = Object.freeze({
  5: Object.freeze(['-2%', '-1%', '0%', '+1%', '>+2%']),
  6: Object.freeze(['>-3%', '-2%', '-1%', '+1%', '+2%', '>+2%']),
});

/* 各系列在 6 个维度上的得分（固定表、无随机数与当前时间，保证截图可复现）。
   [RADAR-17] 全部维度已归到同一把 0–5 标尺，故面积可读、可横向比。 */
const RADAR_SCORES = {
  cn: [
    { name: '本期得分', data: [3.5, 4.8, 2.2, 2.0, 1.2, 2.6] },
    { name: '去年同期', data: [2.8, 3.9, 2.9, 3.1, 2.4, 1.8] },
    { name: '行业均值', data: [3.1, 3.3, 3.4, 2.7, 3.0, 2.9] },
    { name: '同类公司', data: [4.0, 3.1, 2.6, 3.8, 1.8, 3.5] },
    { name: '目标水平', data: [4.4, 4.2, 3.8, 4.0, 3.6, 4.1] },
    { name: '三年均值', data: [3.2, 3.7, 3.0, 2.8, 2.6, 3.1] },
    { name: '五年均值', data: [3.0, 3.5, 3.2, 2.6, 2.8, 2.9] },
    { name: '行业上游', data: [3.8, 3.6, 2.9, 3.3, 2.5, 3.7] },
    { name: '行业下游', data: [2.9, 3.2, 3.6, 3.0, 3.3, 2.7] },
    { name: '市场基准', data: [3.4, 3.4, 3.4, 3.4, 3.4, 3.4] },
  ],
  en: [
    { name: 'SPY', data: [1.9, 2.9, 3.0, 3.4, 1.6, 2.5] },
    { name: 'QQQ', data: [2.4, 2.6, 3.6, 2.7, 2.1, 3.2] },
    { name: 'DIA', data: [2.2, 2.8, 2.4, 3.9, 1.9, 2.0] },
  ],
};

export const radarSeries = (n, lang = 'cn') =>
  RADAR_SCORES[lang].map((s) => ({ name: s.name, data: s.data.slice(0, n) }));

/* 六条雷达示例共用同一套维度数档位与文案——档位是本族语义（轴数），不是各示例各自的口径 */
export const RADAR_DENSITY = {
  densityValues: { few: 3, mid: 5, many: 6 },
  /* 连续档的上下限是**技术下限**不是建议：低于 3 维 RadarChart 抛错（RADAR-01
     「少于此构不成面积」），高于 6 维时维度名与每条 series 也只有 6 个值，
     再拉只会静默截断、看着像滑杆坏了。 */
  densityRange: { min: 3, max: 6 },
  densityUnit: '个维度',
  densityControl: {
    hint: '基线建议并列维度大于 2、小于 6',
    default: 'mid',
    labels: { few: '3 轴', mid: '5 轴', many: '6 轴' },
  },
};
