/*
 * L3 · 桑基示例数据：财报流向八期，及其统一比例尺的播放序列。
 * 由 demos/examples.js 统一转出；只装数据与纯函数，不 import d3、不碰 DOM。
 */

import { resolveSankeySequenceViewport, withSharedSankeyScale } from '../../charts/charts/sankey/model.js';
import { buildFinancialDifferencePair } from '../sankey-financial.js';

/* 当前演示八期保持同一拓扑；有符号流量保持会计守恒，负值只表达贡献方向。 */
const yi = (value) => value * 1e8;
const sankeyNode = (id, name, role, stage, order = 0) => ({
  id,
  name,
  role,
  stage,
  order,
});
const FINANCIAL_SANKEY_NODES = [
  sankeyNode('domestic', '国内政企业务', 'income', 0, 0),
  sankeyNode('other-business', '其他业务', 'income', 0, 1),
  sankeyNode('international', '国际业务', 'income', 0, 2),
  sankeyNode('revenue', '营业收入', 'income', 1),
  sankeyNode('cost', '营业成本', 'expense', 2, 0),
  sankeyNode('gross', '毛利', 'profit', 2, 1),
  sankeyNode('other-operating', '其他经营收益', 'income', 2, 2),
  sankeyNode('operating-expense', '费用及营业税', 'expense', 3, 0),
  sankeyNode('operating-profit', '营业利润', 'profit', 3, 1),
  sankeyNode('non-operating', '营业外净收入', 'income', 3, 2),
  sankeyNode('total-profit', '利润总额', 'profit', 4),
  sankeyNode('net-profit', '净利润', 'profit', 5, 0),
  sankeyNode('income-tax', '所得税费用', 'expense', 5, 1),
  sankeyNode('parent-profit', '归母净利润', 'profit', 6, 0),
  sankeyNode('minority-interest', '少数股东权益', 'expense', 6, 1),
];

export const makeFinancialSankeyQuarter = ({
  period,
  shortPeriod,
  sources,
  cost,
  operatingExpense,
  otherOperating,
  nonOperating,
  incomeTax,
  minorityInterest,
  statusLabel = '盈利',
}) => {
  const [domestic, otherBusiness, international] = sources.map(yi);
  const revenue = domestic + otherBusiness + international;
  const costValue = yi(cost);
  const grossPair = buildFinancialDifferencePair({
    parent: 'revenue',
    base: 'cost',
    difference: 'gross',
    parentValue: revenue,
    baseValue: costValue,
  });
  const gross = grossPair.differenceValue;
  const operatingExpenseValue = yi(operatingExpense);
  const operatingPair = buildFinancialDifferencePair({
    parent: 'gross',
    base: 'operating-expense',
    difference: 'operating-profit',
    parentValue: gross,
    baseValue: operatingExpenseValue,
  });
  const grossToOperating = operatingPair.differenceValue;
  const otherOperatingValue = yi(otherOperating);
  const operatingProfit = grossToOperating + otherOperatingValue;
  const nonOperatingValue = yi(nonOperating);
  const totalProfit = operatingProfit + nonOperatingValue;
  const incomeTaxValue = yi(incomeTax);
  const netProfitPair = buildFinancialDifferencePair({
    parent: 'total-profit',
    base: 'income-tax',
    difference: 'net-profit',
    parentValue: totalProfit,
    baseValue: incomeTaxValue,
  });
  const netProfit = netProfitPair.differenceValue;
  const minorityInterestValue = yi(minorityInterest);
  const parentProfitPair = buildFinancialDifferencePair({
    parent: 'net-profit',
    base: 'minority-interest',
    difference: 'parent-profit',
    parentValue: netProfit,
    baseValue: minorityInterestValue,
  });

  return {
    nodes: FINANCIAL_SANKEY_NODES.map((node) => ({ ...node })),
    links: [
      { source: 'domestic', target: 'revenue', value: domestic },
      { source: 'other-business', target: 'revenue', value: otherBusiness },
      { source: 'international', target: 'revenue', value: international },
      grossPair.baseLink,
      grossPair.differenceLink,
      operatingPair.baseLink,
      operatingPair.differenceLink,
      { source: 'other-operating', target: 'operating-profit', value: otherOperatingValue },
      { source: 'operating-profit', target: 'total-profit', value: operatingProfit },
      { source: 'non-operating', target: 'total-profit', value: nonOperatingValue },
      netProfitPair.differenceLink,
      netProfitPair.baseLink,
      parentProfitPair.differenceLink,
      parentProfitPair.baseLink,
    ],
    legendLabels: { income: '收入', expense: '支出', profit: '利润' },
    period,
    shortPeriod,
    statusLabel,
    showEdgeLabels: false,
  };
};

const FINANCIAL_SANKEY_PERIOD_INPUTS = [
  ['2025 一季报', '25 Q1', [148, 55, 12], 188, 18, -0.8, 0.3, 0.8, 1.1],
  ['2025 半年报', '25 Q2', [162, 61, 14], 205, 20, -0.4, 0.5, 1.2, 1.4],
  ['2025 三季报', '25 Q3', [176, 67, 15], 222, 22, 0.2, 0.4, 1.5, 1.8],
  ['2025 年报', '25 Q4', [186, 71, 16], 295, 32, -3, 1, 1.7, 2, '亏损'],
  ['2026 一季报', '26 Q1', [190.71, 72.68, 16.46], 243.8, 24.4, -1.11, 0.015083, 0.945083, 1.73],
  ['2026 半年报', '26 Q2', [205, 78, 18], 260, 26, -0.4, 0.6, 1.4, 2.1],
  ['2026 三季报', '26 Q3', [218, 84, 20], 276, 28, 0.6, 0.9, 1.9, 2.5],
  ['2026 年报', '26 Q4', [236, 92, 22], 298, 31, 1.2, 1.1, 2.3, 3],
];

export const financialSankeyPeriods = () => {
  const periods = FINANCIAL_SANKEY_PERIOD_INPUTS.map(([
    period,
    shortPeriod,
    sources,
    cost,
    operatingExpense,
    otherOperating,
    nonOperating,
    incomeTax,
    minorityInterest,
    statusLabel,
  ]) => makeFinancialSankeyQuarter({
    period,
    shortPeriod,
    sources,
    cost,
    operatingExpense,
    otherOperating,
    nonOperating,
    incomeTax,
    minorityInterest,
    statusLabel,
  }));
  return withSharedSankeyScale(periods);
};

export const financialSankey = () => financialSankeyPeriods()[0];

export const financialSankeyPlayback = () => {
  const periods = financialSankeyPeriods();
  return {
    periods,
    viewport: Object.fromEntries(['pc', 'mobile'].map((platform) => [
      platform,
      resolveSankeySequenceViewport(periods, platform),
    ])),
  };
};
