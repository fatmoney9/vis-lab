/*
 * L3 · 图表示例内容的主题展示适配。
 *
 * Ainvest 的图表内部内容统一使用英文：系列名、图例、轴标题、饼环扇区、雷达维度与
 * 矩形树图业务名称都在这里转换。站点导航、示例标题和配置面板仍是中文；L2 图表组件
 * 只消费转换后的通用配置，不识别品牌或语言。
 *
 * 财报桑基还有周期、播放控件与稳定节点 id 的专用映射，继续由 sankey-presentation.js
 * 负责；本模块在最终配置层补齐其余图表族的可见业务文案。
 *
 * 组件自己写死的固定文案（无障碍描述、看板固定行名）不在示例配置里，翻译配置够不着；
 * 它们经 `config.text` 整套注入（CHARTTEXT-01/02，specs/chart-text.md），英文表见 AINVEST_COMPONENT_TEXT。
 */

const AINVEST_TEXT = new Map([
  /* 图表标注（CALLOUT-03：文案由调用方写死，故经本词表整句替换） */
  ['若人人都按这个水平消耗资源，一年需要八个地球才够', 'If everyone consumed at this level, we would need eight Earths a year'],
  ['基准线', 'Baseline'],
  ['该季度含一次性资产处置收益', 'Includes a one-off gain on asset disposal'],
  /* 直角坐标图 */
  ['营业收入', 'Revenue'],
  ['成本', 'Cost'],
  ['利润', 'Profit'],
  ['税费', 'Taxes'],
  ['研发投入', 'R&D'],
  ['现金流', 'Cash Flow'],
  ['销售费用', 'Selling Expenses'],
  ['管理费用', 'Administrative Expenses'],
  ['财务费用', 'Finance Costs'],
  ['投资收益', 'Investment Income'],
  ['营业外收入', 'Non-operating Income'],
  ['所得税', 'Income Tax'],
  ['主营利润', 'Core Profit'],
  ['公允价值变动', 'Fair Value Changes'],
  ['资产处置收益', 'Asset Disposal Gains'],
  ['汇兑收益', 'FX Gains'],
  ['其他收益', 'Other Income'],
  ['补贴收入', 'Subsidy Income'],
  ['利息收入', 'Interest Income'],
  ['净亏损项', 'Net Loss'],
  ['净利润', 'Net Profit'],
  ['指数', 'Index'],
  ['沪深300', 'CSI 300'],
  ['中证500', 'CSI 500'],
  ['创业板指', 'ChiNext'],
  ['上证50', 'SSE 50'],
  ['科创50', 'STAR 50'],
  ['中证1000', 'CSI 1000'],
  ['中证红利', 'CSI Dividend'],
  ['国证2000', 'CNI 2000'],
  ['北证50', 'BSE 50'],
  ['恒生指数', 'Hang Seng'],
  ['恒生科技', 'Hang Seng TECH'],
  ['纳斯达克', 'Nasdaq'],
  ['营收增速', 'Revenue Growth'],
  ['单位：元', 'Value'],
  ['副轴', 'Secondary Axis'],
  ['增速（%）', 'Growth (%)'],
  ['交易日', 'Trading Day'],

  /* 雷达图 */
  ['盈利能力', 'Performance'],
  ['资产质量', 'Safety'],
  ['偿债能力', 'Momentum'],
  ['运营能力', 'Basics'],
  ['成长性', 'Sentiment'],
  ['本期得分', 'Current'],
  ['去年同期', 'Prior Year'],
  ['行业均值', 'Industry Average'],
  ['同类公司', 'Peers'],
  ['目标水平', 'Target'],
  ['三年均值', '3Y Average'],
  ['五年均值', '5Y Average'],
  ['行业上游', 'Sector Upstream'],
  ['行业下游', 'Sector Downstream'],
  ['市场基准', 'Market Benchmark'],
  ['综合财务评分', 'Financial Score'],
  ['同期能力对比', 'Period Comparison'],
  ['指数能力对比', 'Index Comparison'],
  ['能力风险评估', 'Performance Assessment'],
  ['自定义能力配置', 'Custom Profile'],

  /* 饼 / 环 */
  ['营收构成', 'Revenue Mix'],
  ['收入构成', 'Revenue Mix'],
  ['主营业务', 'Core Business'],
  ['其他业务', 'Other Business'],
  ['政府补助', 'Government Grants'],
  ['资产处置', 'Asset Disposals'],
  ['汇兑损益', 'FX Gains/Losses'],
  ['利润表科目', 'Income Statement Items'],
  ['归属于母公司所有者的净利润扣除非经常性损益后', 'Adjusted Net Profit Attributable to Parent'],
  ['经营活动产生的现金流量净额', 'Net Cash Flow from Operating Activities'],
  ['可供出售金融资产公允价值变动损益', 'Fair Value Changes on Available-for-sale Financial Assets'],
  ['以摊余成本计量的金融资产终止确认收益', 'Gains on Derecognition of Amortized-cost Financial Assets'],
  ['对联营企业和合营企业的投资收益', 'Investment Income from Associates and Joint Ventures'],
  ['递延所得税资产', 'Deferred Tax Assets'],
  ['短名', 'Short Name'],

  /* 矩形树图 */
  ['行业入口', 'Sector Entry'],
  ['重点行业', 'Key Sectors'],
  ['全市场行业', 'All Market Sectors'],
  ['全部行业', 'All Sectors'],
  ['信息技术', 'Information Technology'],
  ['金融', 'Financials'],
  ['工业', 'Industrials'],
  ['医药卫生', 'Health Care'],
  ['可选消费', 'Consumer Discretionary'],
  ['原材料', 'Materials'],
  ['通信服务', 'Communication Services'],
  ['日常消费', 'Consumer Staples'],
  ['公用事业', 'Utilities'],
  ['能源', 'Energy'],
  ['房地产', 'Real Estate'],
  ['半导体', 'Semiconductors'],
  ['半导体与半导体生产设备', 'Semiconductors & Semiconductor Equipment'],
  ['软件服务', 'Software & Services'],
  ['银行', 'Banks'],
  ['保险', 'Insurance'],
  ['电气设备', 'Electrical Equipment'],
  ['机械制造', 'Machinery'],
  ['航空航天与国防', 'Aerospace & Defense'],
  ['国防军工', 'Defense'],
  ['汽车与汽车零部件', 'Automobiles & Components'],
  ['汽车与零部件', 'Automobiles & Components'],
  ['耐用消费品与服装', 'Consumer Durables & Apparel'],
  ['消费者服务', 'Consumer Services'],
  ['制药', 'Pharmaceuticals'],
  ['医疗器械', 'Health Care Equipment'],
  ['生物科技', 'Biotechnology'],
  ['生命科学工具和服务', 'Life Sciences Tools & Services'],
  ['医疗服务', 'Health Care Services'],
  ['医药商业', 'Health Care Distribution'],
  ['化工', 'Chemicals'],
  ['金属与采矿', 'Metals & Mining'],
  ['建筑材料', 'Construction Materials'],
  ['媒体娱乐', 'Media & Entertainment'],
  ['传媒', 'Media'],
  ['零售业', 'Retailing'],
  ['零售', 'Retail'],
  ['食品饮料', 'Food & Beverage'],
  ['交通运输', 'Transportation'],
  ['运输', 'Transportation'],
  ['资本市场', 'Capital Markets'],
  ['电子元件', 'Electronic Components'],
  ['技术硬件与设备', 'Technology Hardware & Equipment'],
  ['家庭用品', 'Household Products'],
  ['家用电器', 'Household Appliances'],
  ['商业服务', 'Commercial Services'],
  ['新能源设备', 'Clean Energy Equipment'],
  ['综合金融', 'Diversified Financials'],
  ['纺织制造', 'Textiles'],
  ['其他行业', 'Other Sectors'],
  ['农林牧渔', 'Agriculture'],
  ['美容护理', 'Personal Care'],
  ['环保', 'Environmental Services'],
  ['社会服务', 'Social Services'],
  ['计算机设备', 'Computer Hardware'],
  ['通信设备', 'Communications Equipment'],
  ['互联网服务', 'Internet Services'],
  ['电信服务', 'Telecommunication Services'],
  ['煤炭', 'Coal'],
  ['石油石化', 'Oil & Gas'],

  /* 弦图：申万一级行业（行业间资金流向） */
  ['电子', 'Electronics'],
  ['医药生物', 'Pharmaceuticals'],
  ['电力设备', 'Power Equipment'],
  ['非银金融', 'Non-bank Financials'],
  ['计算机', 'Computers'],
  ['有色金属', 'Non-ferrous Metals'],
  ['汽车', 'Automobiles'],
  ['机械设备', 'Machinery'],
]);

const AINVEST_CHART_TEXT = {
  radar: new Map([
    ['现金流', 'Funds Flow'],
  ]),
};

/* 与各族 L2 缺省表（CHORD_TEXT / RADAR_TEXT / TREEMAP_TEXT）键集一一对应；缺键或多键组件会当场报错。 */
const AINVEST_COMPONENT_TEXT = {
  chord: {
    chartLabel: 'Chord chart showing mutual flows between entities',
    outflow: 'Outflow',
    inflow: 'Inflow',
    net: 'Net',
    arcLabel: '{name}, outflow {outflow}, inflow {inflow}',
    ribbonLabel: 'Flow between {source} and {target}: {source} to {target} {forward}, {target} to {source} {backward}',
  },
  radar: {
    handleLabel: '{dimension}, {series}',
    ratingBandSeparator: ', ',
  },
  treemap: {
    chartLabel: '{name}: hierarchical share by area',
    fallbackName: 'Treemap',
    leafLabel: '{name}, {value}, view details',
  },
};

function ainvestText(value, chart) {
  if (typeof value !== 'string') return value;
  const chartSpecific = AINVEST_CHART_TEXT[chart]?.get(value);
  if (chartSpecific) return chartSpecific;
  const exact = AINVEST_TEXT.get(value);
  if (exact) return exact;

  /* 饼环的循环名称会附加 1、2… 后缀；先保留中证1000等完整专名的精确匹配，
     再只对已登记的基础名称翻译后缀。 */
  const suffixed = /^(.*?)(\d+)$/.exec(value);
  if (!suffixed) return value;
  const translatedBase = AINVEST_TEXT.get(suffixed[1]);
  return translatedBase ? `${translatedBase} ${suffixed[2]}` : value;
}

function translateDeep(value, chart) {
  if (typeof value === 'string') return ainvestText(value, chart);
  if (Array.isArray(value)) return value.map((item) => translateDeep(item, chart));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateDeep(item, chart)]));
}

export function ainvestComponentText(chart) {
  const text = AINVEST_COMPONENT_TEXT[chart];
  return text ? { ...text } : undefined;
}

export function chartContentPresentation(config, { theme = 'ths', chart } = {}) {
  if (theme !== 'ainvest') return config;
  const translated = translateDeep(config, chart);
  const text = ainvestComponentText(chart);
  /* 固定文案在翻译之后挂上：模板里的占位与英文句子不该再过一遍中文词表 */
  return text ? { ...translated, text } : translated;
}
