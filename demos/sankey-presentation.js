/*
 * L3 · 财报桑基展示文案。
 *
 * [SANKEY-27] 业务语言在示例数据层切换：L2 仍只消费稳定 id、通用 name/value 与语义角色，
 * 不识别 Ainvest 或中英文。英文名称进入组件后继续走同一套真实字体测量、96px 截断与字号适配。
 */

const AINVEST_NODE_NAMES = {
  domestic: 'Domestic Government & Enterprise',
  'other-business': 'Other Business',
  international: 'International Business',
  revenue: 'Revenue',
  cost: 'Cost of Revenue',
  gross: 'Gross Profit',
  'other-operating': 'Other Operating Income',
  'operating-expense': 'Operating Expenses & Taxes',
  'operating-profit': 'Operating Profit',
  'non-operating': 'Net Non-Operating Income',
  'total-profit': 'Profit Before Tax',
  'net-profit': 'Net Profit',
  'income-tax': 'Income Tax Expense',
  'parent-profit': 'Net Profit Attributable to Parent',
  'minority-interest': 'Non-Controlling Interests',
};

const AINVEST_LEGEND_LABELS = {
  income: 'Income',
  expense: 'Expense',
  profit: 'Profit',
};

/* [CHARTTEXT-01/02] 组件固定文案（无障碍描述），与 sankey/config.js 的 SANKEY_TEXT 键集一一对应 */
const AINVEST_COMPONENT_TEXT = {
  chartLabel: 'Sankey chart showing flows and volumes between nodes',
  legendLabel: 'Sankey color legend',
  linkLabel: '{source} to {target}, value {value}',
  nodeLabel: '{name}, value {value}',
};

const AINVEST_STATUS_LABELS = {
  盈利: 'Profit',
  亏损: 'Loss',
};

const englishPeriod = (period) => {
  const match = /^(\d{4})\s*(一季报|半年报|三季报|年报)$/.exec(period ?? '');
  if (!match) return period;
  const [, year, report] = match;
  if (report === '一季报') return `${year} Q1`;
  if (report === '半年报') return `${year} H1`;
  if (report === '三季报') return `${year} Q3`;
  return `FY ${year}`;
};

const englishShortPeriod = (period) => {
  if (/Q1$/.test(period ?? '')) return 'Q1';
  if (/H1$/.test(period ?? '')) return 'H1';
  if (/Q3$/.test(period ?? '')) return 'Q3';
  if (/^FY\s/.test(period ?? '')) return 'FY';
  return period;
};

const englishTimelinePeriod = (period) => {
  const yearFirst = /^(\d{4})\s+(Q1|H1|Q3)$/.exec(period ?? '');
  if (yearFirst) return `${yearFirst[2]} ’${yearFirst[1].slice(-2)}`;
  const fiscalYear = /^FY\s+(\d{4})$/.exec(period ?? '');
  if (fiscalYear) return `FY ’${fiscalYear[1].slice(-2)}`;
  return period;
};

export function financialSankeyPresentation(config, { theme = 'ths' } = {}) {
  if (theme !== 'ainvest') return config;
  const period = englishPeriod(config.period);
  return {
    ...config,
    nodes: (config.nodes ?? []).map((node) => ({
      ...node,
      name: AINVEST_NODE_NAMES[node.id] ?? node.name,
    })),
    legendLabels: { ...AINVEST_LEGEND_LABELS },
    text: { ...AINVEST_COMPONENT_TEXT },
    period,
    timelinePeriod: englishTimelinePeriod(period),
    shortPeriod: englishShortPeriod(period),
    statusLabel: AINVEST_STATUS_LABELS[config.statusLabel] ?? config.statusLabel,
  };
}

const ZH_PLAYBACK_COPY = {
  timeline: '季度数据播放轴',
  progress: '季度进度',
  play: '播放季度变化',
  pause: '暂停季度变化',
  playTitle: '播放',
  pauseTitle: '暂停',
  previous: '上一期',
  next: '下一期',
  mobile: '移动端',
  light: '浅色',
  dark: '深色',
};

const EN_PLAYBACK_COPY = {
  timeline: 'Quarterly data playback',
  progress: 'Quarter progress',
  play: 'Play quarterly changes',
  pause: 'Pause quarterly changes',
  playTitle: 'Play',
  pauseTitle: 'Pause',
  previous: 'Previous',
  next: 'Next',
  mobile: 'Mobile',
  light: 'Light',
  dark: 'Dark',
};

export const sankeyPlaybackCopy = ({ theme = 'ths' } = {}) => (
  theme === 'ainvest' ? EN_PLAYBACK_COPY : ZH_PLAYBACK_COPY
);
