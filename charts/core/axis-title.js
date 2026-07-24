import { tokenNum } from './tokens.js';
import { measureTexts } from './measure.js';

/*
 * L1 · 轴标题（axis title）。权威规范见 specs/axis-title.md。
 * 职责边界：本模块只做**跨图表通用**的三件事——标题带高（AXISTITLE-02）、
 *   右对齐锚点几何（AXISTITLE-04）、同一条带内放不下就不放（AXISTITLE-06）；
 * 「哪根轴有标题、文案是什么、带高传给谁」由调用方 / L2 决定（AXISTITLE-01/03）。
 * 与 label.js / watermark.js 一致：接收调用方传入的 d3 selection，本模块**不 import d3**，
 * 也**不 import frame.js**（它引 d3）——保证纯函数可被 node --test 直接加载。
 * 无 if(theme===…)：形态三主题一致，样式差异全在值 token（AXISTITLE-05）。
 */

const TITLE_CLASS = 'dv-axis-title';

/*
 * [AXISTITLE-02] 标题带高 = 标题行高 + **上下各一份**间距（4 + 行高 + 4，上下对称）。
 * 调用方无标题时不要调用（带高 0），frame 不自行判断有没有标题。
 */
export function axisTitleBand(lineH, gap) {
  return lineH + 2 * gap;
}

/*
 * [AXISTITLE-04] 锚点：标题贴自己那一侧的画布外缘。
 *   side  —— 'left' | 'right'（该标题跟随的轴在哪一侧）
 *   width —— frame.width（画布宽）
 * 规则只有一条：**标题贴自己那一侧的画布外缘**——左侧轴左对齐画布左缘（x=0, anchor start）、
 * 右侧轴右对齐画布右缘（x=width, anchor end），三主题一律如此。
 * 为什么不按「最长轴标签的右沿」右对齐（原设计稿的写法）：左侧轴上那条右沿距画布左缘只有一个
 * 标签列宽（inside 布局尤其窄，如 THS 的「24万」仅 26px），标题一旦比最长标签宽，左端就顶成负数、
 * 跑出 SVG 视口被裁。贴外缘则**标题多长都不会被裁**，且与它标注的那根轴天然同侧。
 * 不依赖 form / align / 标签宽——口径只由 side 决定。
 */
export function axisTitleAnchor({ side, width }) {
  return side === 'left' ? { x: 0, anchor: 'start' } : { x: width, anchor: 'end' };
}

/*
 * [AXISTITLE-06] 同一条标题带内放不下就不放（纯函数，不缩字号 / 不换行 / 不裁字）。
 *   boxes  —— [{ left, width, band, … }]，**按优先级排列**（主轴在前、副轴在后）
 *   minGap —— 相邻标题最小净距（px）
 * 只在同一条 band（'top' 顶部 Y 标题带 / 'bottom' X 标题带）内互判；先到先得 ⇒
 * 主轴标题恒留、被挤掉的永远是副轴，结果不随容器宽跳变。返回保留下来的原对象（保持入参顺序）。
 */
export function dropCollidingTitles(boxes, minGap = 0) {
  const kept = [];
  for (const box of boxes) {
    const clash = kept.some((k) => {
      if (k.band !== box.band) return false;
      const netGap = Math.max(k.left, box.left) - Math.min(k.left + k.width, box.left + box.width);
      return netGap < minGap;
    });
    if (!clash) kept.push(box);
  }
  return kept;
}

/* anchor → 文本左沿（测量得到的 width 配合 text-anchor 换算） */
const leftOf = (x, width, anchor) =>
  anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;

/*
 * [AXISTITLE-01..06] 把一批轴标题渲染进已存在的 <g>。
 *   items = [{ text, x, y, anchor='end', band='top' }]，**按优先级排列**（主轴 → 副轴 → X）
 *     x / y   —— 调用方（L2）算好的锚点像素：x 走 axisTitleAnchor、y 走 frame 的标题带上沿
 *     anchor  —— 'start'（左侧轴，贴画布左缘）/ 'end'（右侧轴与 X 标题）
 *     band  —— 参与 AXISTITLE-06 互判的分组；顶部 Y 标题带与底部 X 标题带互不干扰
 * 空文本直接跳过；文本一律 hanging（y = 文字上沿，与带高口径一致）。
 */
export function renderAxisTitles(g, frame, items) {
  const list = items.filter((d) => d && d.text != null && d.text !== '');
  if (!list.length) return;

  const widths = measureTexts(frame.host, list.map((d) => d.text), TITLE_CLASS);
  const boxes = list.map((d, i) => ({
    left: leftOf(d.x, widths[i], d.anchor ?? 'end'),
    width: widths[i],
    band: d.band ?? 'top',
    item: d,
  }));
  const visible = dropCollidingTitles(boxes, tokenNum(frame.host, '--spacing-axis-title-gap')).map((b) => b.item);

  g.selectAll(`text.${TITLE_CLASS}`)
    .data(visible)
    .join('text')
    .attr('class', TITLE_CLASS)
    .attr('x', (d) => d.x)
    .attr('y', (d) => d.y)
    .attr('text-anchor', (d) => d.anchor ?? 'end')
    .attr('dominant-baseline', 'hanging')
    .text((d) => d.text);
}
