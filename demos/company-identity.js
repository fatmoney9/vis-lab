/*
 * L3 · 公司标识演示数据。
 *
 * 示例不收录真实企业 logo，只提供企业名称首字母，由 core/image-content.js 渲染成圆形占位。
 * 组件的图片能力不受影响：真实接入时由调用方在 presentation.image 传入有授权的图片地址。
 */

const AINVEST_COMPANY_NAMES = {
  AAPL: 'Apple', WSM: 'Williams-Sonoma', DOLE: 'Dole', YSG: 'Yatsen Holding',
  VKTX: 'Viking Therapeutics', YMM: 'Full Truck Alliance', CSCO: 'Cisco',
  MAR: 'Marriott International', TEAM: 'Atlassian', ADMA: 'ADMA Biologics',
  BTSG: 'BrightSpring Health Services', GLTO: 'Galecto', GSAT: 'Globalstar',
  MSFT: 'Microsoft', NVDA: 'NVIDIA', GOOG: 'Alphabet', AMZN: 'Amazon',
  META: 'Meta Platforms', AVGO: 'Broadcom', ORCL: 'Oracle', CRM: 'Salesforce',
  AMD: 'Advanced Micro Devices', INTC: 'Intel', JPM: 'JPMorgan Chase',
  BAC: 'Bank of America', WFC: 'Wells Fargo', GS: 'Goldman Sachs',
  MS: 'Morgan Stanley', V: 'Visa', MA: 'Mastercard', AXP: 'American Express',
  JNJ: 'Johnson & Johnson', LLY: 'Eli Lilly', PFE: 'Pfizer', MRK: 'Merck',
  UNH: 'UnitedHealth Group', ABBV: 'AbbVie', TMO: 'Thermo Fisher Scientific',
  COST: 'Costco', WMT: 'Walmart', HD: 'Home Depot', NKE: 'Nike',
  MCD: "McDonald's", KO: 'Coca-Cola', PEP: 'PepsiCo', XOM: 'Exxon Mobil',
  CVX: 'Chevron', CAT: 'Caterpillar', GE: 'GE Aerospace', BA: 'Boeing',
  UPS: 'United Parcel Service', NEE: 'NextEra Energy', PLD: 'Prologis',
};

const firstCharacter = (value) => Array.from(String(value ?? '').trim())[0]?.toUpperCase() ?? null;

export function ainvestCompanyFallback(ticker) {
  const symbol = String(ticker ?? '').toUpperCase();
  return firstCharacter(AINVEST_COMPANY_NAMES[symbol] ?? symbol);
}
