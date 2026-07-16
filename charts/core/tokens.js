/* L1 · token 读取。组件里的一切数值/颜色经由 CSS 变量获得，源码禁止字面量。 */

export function tokenStr(el, name) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/* 解析 px / ms / 无单位数值 */
export function tokenNum(el, name) {
  const v = parseFloat(tokenStr(el, name));
  return Number.isFinite(v) ? v : 0;
}
