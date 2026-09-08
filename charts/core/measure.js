/*
 * L1 · 渲染级文本测量（全库唯一测量源，[AXIS-08]）。
 * 临时挂一棵隐藏 SVG，用**真实类名**走真实 CSS 级联量宽——tabular-nums 等
 * Canvas measureText 表达不了的字体特性全部包含，无估算误差。
 * 轴标签（axis.js）、数据标签（label.js）与矩形树图文字拟合共用本模块，杜绝第二份测量实现。
 *
 * 本模块**零 import**（不碰 d3）：使它可被 node 直接加载，且不给消费方引入依赖。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const classAt = (className, text, index) => (typeof className === 'function'
  ? className(String(text), index)
  : className);

/*
 * 量一批文本在 className 样式下的渲染宽度（px 数组，与入参一一对应）。
 *   host      —— 提供 token 作用域的元素（隐藏 SVG 挂它下面，继承同一套 CSS 变量）
 *   texts     —— 文本数组（非字符串会被 String() 化）
 *   className —— 参与测量的类名（决定字号/字体/字重），也可传 `(text, index) => class`
 */
export function measureTexts(host, texts, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;overflow:visible';
  const nodes = texts.map((t, index) => {
    const el = document.createElementNS(SVG_NS, 'text');
    el.setAttribute('class', classAt(className, t, index) ?? '');
    el.textContent = String(t);
    svg.appendChild(el);
    return el;
  });
  host.appendChild(svg);
  const widths = nodes.map((el) => el.getComputedTextLength());
  svg.remove();
  return widths;
}

/*
 * 量一批文本在 className 样式下的**墨迹上下边**（相对字母基线的 px 距离，>=0）。
 *   → [{ ascent, descent, hanging }]，与入参一一对应；hanging 是 hanging 基线到
 *   alphabetic 基线的距离，供 `dominant-baseline:hanging` 的文字还原实际墨迹位置。
 *
 * **为什么这一个用 Canvas，而上面的宽度测量明令不用**——两者要的东西不同：
 *   宽度受 `tabular-nums` / `letter-spacing` 等 CSS 字体特性影响，Canvas 表达不了，故必须走真实 SVG；
 *   垂直墨迹只由 font-family / -size / -weight / -style 决定，这几项都能原样交给 Canvas。
 * 而 **SVG 侧根本拿不到墨迹**：`getBBox()` 对 text 返回的是 em 盒（12px 字量出 17px 高），
 * 不是字形实际覆盖的范围，用它对不齐视觉边缘。
 *
 * 字体仍**走真实级联**、不猜：先挂一个带真实类名的节点，用 getComputedStyle 读出解析后的
 * 字体，再交给 Canvas。故主题 / 端切换、token 改字号都自动跟上。className 同样可传
 * `(text, index) => class`，供同一标签内使用不同字重 / 字体的逐行内容分别测量。
 *
 * [AXIS-01] 用途：inside 布局的 Y 标签要按「墨迹边缘 ↔ 网格线」定位而不是按基线——
 * 基线到墨迹底的距离由**字体与字符**决定（THS 的「万」下探 1.35px、数字只有 0.09px），
 * 按基线定位会让同一根轴上的标签视觉间距各不相同，且换字体就静默漂移。
 */
export function measureInk(host, texts, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;overflow:visible';
  const probes = texts.map((text, index) => {
    const probe = document.createElementNS(SVG_NS, 'text');
    probe.setAttribute('class', classAt(className, text, index) ?? '');
    svg.appendChild(probe);
    return probe;
  });
  host.appendChild(svg);
  const fonts = probes.map((probe) => {
    const cs = getComputedStyle(probe);
    return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  });
  svg.remove();

  const ctx = (measureInk.ctx ||= document.createElement('canvas').getContext('2d'));
  return texts.map((t, index) => {
    ctx.font = fonts[index];
    const m = ctx.measureText(String(t));
    return {
      ascent: m.actualBoundingBoxAscent,
      descent: m.actualBoundingBoxDescent,
      /* 老浏览器缺 hangingBaseline 时，以实际 ascent 回落：至少保证墨迹顶贴近 hanging 起点。 */
      hanging: Number.isFinite(m.hangingBaseline) ? m.hangingBaseline : m.actualBoundingBoxAscent,
    };
  });
}

/*
 * [TREEMAP-05][SANKEY-18] 需要反复测量同一类文字时复用单个隐藏 SVG，避免每次字号拟合都重建 DOM。
 * 字号边界仍由图表 token 提供；本构件只负责按传入字号返回真实渲染宽度。
 */
export function createTextMeasurer(host, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;overflow:visible';
  const el = document.createElementNS(SVG_NS, 'text');
  el.setAttribute('class', className);
  svg.appendChild(el);
  host.appendChild(svg);

  return {
    measure(value, fontSize) {
      el.textContent = String(value);
      el.style.fontSize = Number.isFinite(fontSize) && fontSize > 0 ? `${fontSize}px` : '';
      const width = el.getComputedTextLength();
      return Number.isFinite(width) && width >= 0 ? width : 0;
    },
    destroy() {
      svg.remove();
    },
  };
}
