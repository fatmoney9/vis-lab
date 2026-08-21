/*
 * L3 · 公司图标演示资源映射。
 *
 * 图片渲染能力在 core/image-content.js；本模块只保存证券代码到静态资源的业务映射，
 * 供任意图表 demo 复用。Figma 未提供真实图标的证券继续使用 Apple 图标占位。
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

export function ainvestCompanyIcon(ticker) {
  const symbol = String(ticker ?? '').toUpperCase();
  return new URL(AINVEST_ICON_FILES[symbol] ?? AINVEST_ICON_FILES.AAPL, AINVEST_ICON_ROOT).href;
}
