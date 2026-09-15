/* L3 · 瀑布图示例文案映射。只换展示语言，不改变累计值、类型、分段或运算关系。 */
const AINVEST_COPY = {
  revenue: { name: 'Revenue', axisLabel: ['Revenue'] },
  cost: { name: 'Cost of sales', axisLabel: ['Cost of', 'sales'] },
  gross: { name: 'Gross profit', axisLabel: ['Gross profit'] },
  /* Figma 固定为两行；显式内容也让缺少品牌字体的 Linux 验收不依赖回落字体宽度。 */
  'other-expenses': { name: 'Other Expenses', axisLabel: ['Other', 'Expenses'] },
  'net-income': { name: 'Net income', axisLabel: ['Net income'] },
  assets: { name: 'Total Assets', axisLabel: 'Total Assets' },
  liabilities: { name: 'Total Liabilities', axisLabel: 'Total Liabilities' },
  equity: { name: 'Total Equity', axisLabel: 'Total Equity' },
  'current-assets': { name: 'Current Assets', labelLines: ['Current Assets'] },
  'non-current-assets': { name: 'Non Current Assets', labelLines: ['Non Current', 'Assets'] },
  'current-liabilities': { name: 'Current Liabilities', labelLines: ['Current', 'Liabilities'] },
  'non-current-liabilities': { name: 'Non Current Liabilities', labelLines: ['Non Current', 'Liabilities'] },
};

export function waterfallPresentation(cfg, { theme }) {
  if (theme !== 'ainvest') return cfg;
  return {
    ...cfg,
    name: cfg.variant === 'data' ? 'Balance Sheet Composition' : 'Profit Bridge',
    period: '2024 Q3',
    items: cfg.items.map((item) => ({
      ...item,
      ...(AINVEST_COPY[item.id] ?? {}),
      segments: item.segments?.map((segment) => ({
        ...segment,
        ...(AINVEST_COPY[segment.id] ?? {}),
      })),
    })),
  };
}
