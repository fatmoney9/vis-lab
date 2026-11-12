/*
 * L3 · 横条竞赛示例数据：行业市值 24 个季度的排名序列。
 * 由 demos/examples.js 统一转出；只装数据与纯函数，不 import d3、不碰 DOM。
 */

import { isEnglishContent } from '../themes.js';

/*
 * ── 行业市值排名（HBar 竞赛形态的示例数据）────────────────────────
 * 固定公式、无随机数与当前时间，保证截图可复现（同本文件其余假数据）。
 * 每个行业一条独立的正弦轨迹：周期与相位互不相同，于是名次会反复互换——
 * 这正是竞赛图要展示的东西。数据量刻意给到 24 个季度（6 年）。
 */
const MARKET_CAP_INDUSTRIES = [
  ['bank', '银行', 8200, 0.18, 0.0],
  ['liquor', '白酒', 7400, 0.42, 1.1],
  ['semi', '半导体', 5100, 0.66, 2.3],
  ['newenergy', '新能源', 4600, 0.74, 0.5],
  ['pharma', '医药', 6100, 0.30, 3.0],
  ['realestate', '地产', 5600, 0.22, 4.2],
  ['broker', '券商', 4300, 0.52, 1.8],
  ['insurance', '保险', 5900, 0.26, 2.7],
  ['auto', '汽车', 3900, 0.60, 5.1],
  ['coal', '煤炭', 3200, 0.38, 3.6],
  ['solar', '光伏', 3500, 0.82, 0.9],
  ['defense', '军工', 2800, 0.46, 4.8],
];

const MARKET_CAP_QUARTERS = 24;

/* 季度标签是生成的、没法逐条进 AINVEST_TEXT 词表，故照桑基的做法给示例挂 presentation：
   语言映射只在 L3，且**不改 items 的 key 与数值**。periodEn 是内部辅助字段，用完就摘掉，
   不让它漏进传给组件的 cfg（「逻辑」面板展示的必须就是真正生效的那份）。 */
export const marketCapPresentation = (period, { theme = 'ths' } = {}) => {
  const { periodEn, ...rest } = period;
  return isEnglishContent(theme) ? { ...rest, period: periodEn } : rest;
};

export const marketCapPeriods = () => Array.from({ length: MARKET_CAP_QUARTERS }, (_, q) => {
  const year = 2020 + Math.floor(q / 4);
  const quarter = (q % 4) + 1;
  return {
    period: `${year} 年第 ${quarter} 季度`,
    periodEn: `Q${quarter} ${year}`,
    shortPeriod: `Q${quarter}`,
    timelinePeriod: `${String(year).slice(2)}Q${quarter}`,
    items: MARKET_CAP_INDUSTRIES.map(([key, name, base, rate, phase]) => ({
      key,
      name,
      /* 基准 + 自身周期的起伏 + 一条缓慢的长期趋势，三者叠加后名次会持续换位 */
      value: Math.round(
        base
        + base * 0.42 * Math.sin(q * rate + phase)
        + base * 0.16 * Math.cos(q * rate * 0.37 + phase * 1.7)
        + q * base * 0.012,
      ) * 100,
    })),
  };
});
