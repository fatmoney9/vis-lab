/*
 * L3 · 财报桑基的业务差额装配。
 *
 * [SANKEY-25] 这里只把会计关系 P = B + D 转成两条通用 Sankey link：
 * P 为上一层父值、B 为基础分支、D 为差额。它不参与布局，也不识别主题；
 * L2 仍只消费 source / target / value / negativeSource 的通用合同。
 */

export function buildFinancialDifferencePair({
  parent,
  base,
  difference,
  parentValue,
  baseValue,
}) {
  const differenceValue = parentValue - baseValue;
  return {
    differenceValue,
    baseLink: {
      source: parent,
      target: base,
      value: baseValue,
    },
    differenceLink: {
      source: parent,
      target: difference,
      value: differenceValue,
      ...(baseValue > 0 ? { negativeSource: base } : {}),
    },
  };
}
