/*
 * L3 · 矩形树图示例数据：入口 / 局部 / 全局三种层级，及 Ainvest 的标的与图片内容。
 * 由 demos/examples.js 统一转出；只装数据与纯函数，不 import d3、不碰 DOM。
 */

import { ainvestCompanyFallback } from '../company-identity.js';

/* AInvest 演示数据在 L3 适配为 Treemap 的通用 presentation 合同；charts/ 不认识这些业务字段。 */
const AINVEST_TICKERS = [
  'AAPL', 'WSM', 'DOLE', 'YSG', 'VKTX', 'YMM', 'CSCO', 'MAR', 'TEAM', 'ADMA', 'BTSG', 'GLTO',
  'GSAT', 'MSFT', 'NVDA', 'GOOG', 'AMZN', 'META', 'AVGO', 'ORCL', 'CRM', 'AMD', 'INTC',
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA', 'AXP', 'JNJ', 'LLY', 'PFE', 'MRK',
  'UNH', 'ABBV', 'TMO', 'COST', 'WMT', 'HD', 'NKE', 'MCD', 'KO', 'PEP', 'XOM', 'CVX',
  'CAT', 'GE', 'BA', 'UPS', 'NEE', 'PLD',
];
/* 语义值固定序列保证截图可复现；具体字段名和格式化都留在示例数据层。 */
const TREEMAP_SEMANTIC_VALUES = [
  5.55, 2.55, -0.21, -2.21, 0.83, -1.25, 3.42, -3.25, 0, 1.17, -0.86, 4.68,
  -4.12, 0.16, 2.03, -1.07, 0.62, -0.41,
];
/* AInvest Figma「涨跌色-3梯度」示例：±1 / ±2 为两处分档边界；属于业务配置，不是视觉 token。 */
export const TREEMAP_SEMANTIC_THRESHOLDS = [1, 2];
const formatPercent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

const ainvestPresentation = (index) => {
  const ticker = AINVEST_TICKERS[index % AINVEST_TICKERS.length];
  const price = 38.5 + ((index * 37.11) % 410);
  const cap = index < 18 ? `${(3.48 - index * 0.13).toFixed(2)}T` : `${Math.round(860 - index * 9.4)}B`;
  const colorValue = TREEMAP_SEMANTIC_VALUES[index % TREEMAP_SEMANTIC_VALUES.length];
  return {
    label: ticker,
    value: formatPercent(colorValue),
    imageFallback: ainvestCompanyFallback(ticker),
    colorValue,
    details: [
      { key: 'price', label: 'Price', value: price.toFixed(2) },
      { key: 'market-cap', label: 'Market Cap', value: cap },
      { key: 'change', label: 'Change D,%', value: formatPercent(colorValue) },
    ],
  };
};
const treemapPresentation = (index) => ({ presentation: ainvestPresentation(index) });
const decorateTreemap = (node, siblingIndex = 0) => ({
  ...node,
  ...treemapPresentation(siblingIndex),
  ...(Array.isArray(node.children)
    ? { children: node.children.map((child, index) => decorateTreemap(child, index)) }
    : {}),
});

/* 行业市值层级：一级行业用于全局占比，子行业只参与父节点求和（TREEMAP-06）；极小值验证比例压缩，0 值验证尾部剔除。 */
const treemapEntryHierarchy = () => decorateTreemap({
  name: '全部行业',
  children: [
    {
      name: '信息技术',
      children: [
        { name: '半导体与半导体生产设备', value: 1860 },
        { name: '软件服务', value: 1320 },
        { name: '技术硬件与设备', value: 780 },
        { name: '电子元件', value: 320 },
      ],
    },
    {
      name: '金融',
      children: [
        { name: '银行', value: 1480 },
        { name: '资本市场', value: 860 },
        { name: '保险', value: 620 },
      ],
    },
    {
      name: '工业',
      children: [
        { name: '电气设备', value: 940 },
        { name: '机械制造', value: 710 },
        { name: '航空航天与国防', value: 430 },
        { name: '运输', value: 280 },
      ],
    },
    {
      name: '医药卫生',
      children: [
        { name: '制药', value: 660 },
        { name: '医疗器械', value: 410 },
        { name: '生物科技', value: 95 },
        { name: '生命科学工具和服务', value: 2 },
        { name: '医疗服务', value: 0 },
      ],
    },
    {
      name: '可选消费',
      children: [
        { name: '汽车与汽车零部件', value: 520 },
        { name: '耐用消费品与服装', value: 270 },
        { name: '消费者服务', value: 130 },
      ],
    },
    {
      name: '原材料',
      children: [
        { name: '化工', value: 340 },
        { name: '金属与采矿', value: 220 },
        { name: '建筑材料', value: 105 },
      ],
    },
    {
      name: '通信服务',
      children: [
        { name: '电信服务', value: 460 },
        { name: '传媒', value: 290 },
        { name: '互联网服务', value: 170 },
      ],
    },
    {
      name: '日常消费',
      children: [
        { name: '食品饮料', value: 390 },
        { name: '家庭用品', value: 230 },
        { name: '零售', value: 160 },
      ],
    },
  ],
});

const TREEMAP_NAMES = [
  '信息技术', '金融', '工业', '医药卫生', '可选消费', '原材料',
  '通信服务', '日常消费', '公用事业', '能源', '房地产', '半导体',
  '软件服务', '银行', '保险', '电气设备', '机械制造', '航空航天与国防',
  '汽车与零部件', '耐用消费品与服装', '消费者服务', '制药', '医疗器械', '生物科技',
  '化工', '金属与采矿', '建筑材料', '媒体娱乐', '零售业', '食品饮料',
  '交通运输', '资本市场', '电子元件', '技术硬件与设备', '家庭用品', '商业服务',
  '新能源设备', '生命科学工具和服务', '医疗服务', '综合金融', '纺织制造', '其他行业',
  '农林牧渔', '国防军工', '家用电器', '美容护理', '环保', '社会服务',
  '计算机设备', '通信设备', '互联网服务', '医药商业', '煤炭', '石油石化',
];

const TREEMAP_VALUES = [
  4280, 2960, 2360, 1800, 1500, 1200, 920, 780, 665, 520, 430, 340,
  270, 220, 190, 160, 130, 2, 118, 106, 95, 86, 78, 70, 63, 56, 50, 44,
  39, 34, 29, 24, 20, 16, 13, 10, 8, 6, 4, 3, 2, 1,
  0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05,
];

/* 同一份行业数据支持三个独立树图组件入口，类型由示例配置决定，不再由项数反推。 */
export const treemapHierarchy = (count = 6) => {
  if (count <= 8) {
    const hierarchy = treemapEntryHierarchy();
    return { ...hierarchy, children: hierarchy.children.slice(0, Math.max(1, count)) };
  }
  const size = Math.min(count, TREEMAP_NAMES.length);
  return {
    name: size > 30 ? '全市场行业' : '重点行业',
    children: TREEMAP_NAMES.slice(0, size).map((name, index) => ({
      name,
      value: TREEMAP_VALUES[index],
      ...treemapPresentation(index),
    })),
  };
};
