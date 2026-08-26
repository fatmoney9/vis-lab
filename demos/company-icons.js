/*
 * L3 · 公司图标演示资源映射。
 *
 * 图片渲染能力在 core/image-content.js；本模块只保存证券代码到静态资源的业务映射，
 * 供任意图表 demo 复用。无真实图标时返回企业名称首字母，不借用其他企业图标。
 */

const AINVEST_ICON_ROOT = new URL('../assets/company-icons/ainvest/', import.meta.url);
const AINVEST_ICON_FILES = {
  AAPL: 'aapl.png',
  ADMA: 'adma.png',
  BTSG: 'btsg.png',
  CSCO: 'csco.png',
  DOLE: 'dole.png',
  GLTO: 'glto.png',
  GSAT: 'gsat.png',
  MAR: 'mar.png',
  TEAM: 'team.png',
  VKTX: 'vktx.png',
  WSM: 'wsm.png',
  YMM: 'ymm.png',
  YSG: 'ysg.png',
};

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

export function ainvestCompanyIcon(ticker) {
  const symbol = String(ticker ?? '').toUpperCase();
  const file = AINVEST_ICON_FILES[symbol];
  return file ? new URL(file, AINVEST_ICON_ROOT).href : null;
}

export function ainvestCompanyIdentity(ticker) {
  const symbol = String(ticker ?? '').toUpperCase();
  const companyName = AINVEST_COMPANY_NAMES[symbol] ?? symbol;
  return {
    image: ainvestCompanyIcon(symbol),
    imageFallback: firstCharacter(companyName),
  };
}
