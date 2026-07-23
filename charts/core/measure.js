/*
 * L1 · 渲染级文本测量（全库唯一测量源，[AXIS-08]）。
 * 临时挂一棵隐藏 SVG，用**真实类名**走真实 CSS 级联量宽——tabular-nums 等
 * Canvas measureText 表达不了的字体特性全部包含，无估算误差。
 * 轴标签（axis.js）与数据标签（label.js）共用本模块，杜绝第二份测量实现。
 *
 * 本模块**零 import**（不碰 d3）：使它可被 node 直接加载，且不给消费方引入依赖。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/*
 * 量一批文本在 className 样式下的渲染宽度（px 数组，与入参一一对应）。
 *   host      —— 提供 token 作用域的元素（隐藏 SVG 挂它下面，继承同一套 CSS 变量）
 *   texts     —— 文本数组（非字符串会被 String() 化）
 *   className —— 参与测量的类名（决定字号/字体/字重）
 */
export function measureTexts(host, texts, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;overflow:visible';
  const nodes = texts.map((t) => {
    const el = document.createElementNS(SVG_NS, 'text');
    el.setAttribute('class', className);
    el.textContent = String(t);
    svg.appendChild(el);
    return el;
  });
  host.appendChild(svg);
  const widths = nodes.map((el) => el.getComputedTextLength());
  svg.remove();
  return widths;
}
