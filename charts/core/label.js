import { tokenNum } from './tokens.js';
import { measureTexts } from './measure.js';

/*
 * L1 · 数据标签（data label）。权威规范见 specs/data-label.md。
 * 职责边界：本模块只把「L2 算好的锚点数组」渲染成 <text>，并承担**跨图表通用**的两件判定——
 *   档②的明暗反色（LABEL-04）与同行碰撞过滤（LABEL-06②）；
 * 「标签摆哪、默认开不开、折线点数超没超阈值」是图表专属，由 L2 决定（LABEL-01/05/06①③）。
 * 与 watermark.js / mark.js 一致：接收调用方传入的 d3 selection，本模块**不 import d3**
 * （顺带使纯函数可被 node --test 直接加载）。无 if(theme===…)：主题分化只有字号，走值 token。
 */

const LABEL_CLASS = 'dv-data-label';

/*
 * [LABEL-04] 档② 明暗判据：sRGB 逆伽马 + WCAG 加权的相对亮度。
 * 阈值取**白/黑前景的对比度交叉点** √(1.05×0.05) − 0.05 ≈ 0.179（非直觉的 0.5）：
 * 亮度 0.5 会让 #52BBFF 一类的浅色系列判成"深底"、配上浅色文字只剩约 2:1 对比。
 * 两个候选前景是 token（color-text-primary / -inverse-primary，含 alpha 且随明暗模式变），
 * 逐个算真实对比度需要解析 rgba + 合成底色；本模块取 WCAG 的黑白交叉点常数，
 * 保持纯函数、可单测、与主题无关。
 */
const TONE_CROSSOVER = Math.sqrt(1.05 * 0.05) - 0.05;

const CHANNEL = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/* #RGB / #RRGGBB → [r,g,b]（0..1）；非法输入返回 null 由调用方兜底 */
function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  const h = hex.trim().replace(/^#/, '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

/* [LABEL-04] 相对亮度（0..1）。导出供测试与将来的色板校验复用 */
export function relativeLuminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(CHANNEL);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/*
 * [LABEL-04] 背景色 hex → 该用哪一档前景：
 *   'on-light' 浅底 → color-text-primary（深色文字）
 *   'on-dark'  深底 → color-text-inverse-primary（浅色文字）
 * 色值不可解析时按浅底处理（回落到常规正文色，最保守）。
 */
export function labelTone(hex) {
  const L = relativeLuminance(hex);
  if (L == null) return 'on-light';
  return L < TONE_CROSSOVER ? 'on-dark' : 'on-light';
}

/*
 * [LABEL-06③] 放不下就不放（纯函数）：标签宽超过给定的可用宽（如堆叠段的柱宽）→ 丢弃。
 * 不缩字号、不外移——档② 的标签一旦横向溢出色块，溢出部分会落到画布底色上
 * （浅底白字 / 深底黑字）直接看不见，比不画更糟。maxWidth 缺省 = 不限宽。
 */
export function dropOversized(boxes) {
  return boxes.filter((b) => b.maxWidth == null || b.width <= b.maxWidth);
}

/*
 * [LABEL-06②] 同一行内的水平碰撞过滤（纯函数）。
 *   boxes  —— [{ left, width, … }]，可乱序（内部按 left 升序处理）
 *   minGap —— 相邻标签最小净距（px）
 * 贪心：按 left 升序保留首个，其后每个与「上一个保留者」净距 ≥ minGap 才留。
 * 首个恒留 ⇒ 结果稳定、与容器宽变化单调（变窄只会更少，不会跳变）。
 * 返回保留下来的原对象（升序），不改入参。
 */
export function dropCollisions(boxes, minGap = 0) {
  const sorted = [...boxes].sort((a, b) => a.left - b.left);
  const kept = [];
  for (const box of sorted) {
    const prev = kept[kept.length - 1];
    if (!prev || box.left - (prev.left + prev.width) >= minGap) kept.push(box);
  }
  return kept;
}

/* anchor → 文本左沿（测量得到的 width 配合 text-anchor 换算） */
const leftOf = (x, width, anchor) =>
  anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;

/*
 * [LABEL-01..08] 把一批数据标签渲染进已存在的 <g>。
 *   items = [{ x, y, text, anchor='middle', baseline='auto', inside=false, bgHex, maxWidth }]
 *     x / y   —— L2 算好的锚点像素（柱顶净距、段内居中等偏移已含在内，LABEL-01）
 *     baseline—— SVG dominant-baseline：'auto' 文字在锚点上方 / 'hanging' 下方 / 'middle' 居中
 *     inside  —— 标签是否压在色块上：false 走档①（currentColor 跟随系列色，LABEL-03）；
 *                true 走档②（按 bgHex 明暗切 token 色，LABEL-04）
 *     bgHex   —— inside 时的背景色（= 该系列色 hex，由 L2 从 palette 结果透传）
 *     maxWidth—— 可用宽度（档② 传所在色块宽）；超出即不画（LABEL-06③），缺省不限
 *   opts  = { collide = true } —— 碰撞过滤开关（LABEL-06②）。约定**一次调用 = 同一行**
 *           （一个系列跨类目，柱顶行 / 折线行 / 堆叠中该系列的那一段行皆然）；
 *           将来若有本就不同行的批次（如饼图四周环绕），传 false 关掉
 * 空文本 / 无 items 直接返回（LABEL-07 的 null 已由 L2 过滤，此处只做兜底）。
 * 一次测量供两道过滤共用（宽度超限 → 碰撞），不重复量。
 */
export function renderDataLabels(g, frame, items, opts = {}) {
  const { collide = true } = opts;
  const list = items.filter((d) => d && d.text != null && d.text !== '');
  if (!list.length) return;

  const widths = measureTexts(frame.host, list.map((d) => d.text), LABEL_CLASS);
  let boxes = list.map((d, i) => ({
    left: leftOf(d.x, widths[i], d.anchor ?? 'middle'),
    width: widths[i],
    maxWidth: d.maxWidth,
    item: d,
  }));
  boxes = dropOversized(boxes);                                   /* [LABEL-06③] */
  if (collide && boxes.length > 1) {
    boxes = dropCollisions(boxes, tokenNum(frame.host, '--spacing-data-label-min-gap')); /* [LABEL-06②] */
  }
  const visible = boxes.map((b) => b.item);
  if (!visible.length) return;

  g.selectAll(`text.${LABEL_CLASS}`)
    .data(visible)
    .join('text')
    /* 档② 的修饰类承载 token 色——本模块不出现任何色值字面量（铁律1） */
    .attr('class', (d) => (d.inside ? `${LABEL_CLASS} ${LABEL_CLASS}--${labelTone(d.bgHex)}` : LABEL_CLASS))
    .attr('x', (d) => d.x)
    .attr('y', (d) => d.y)
    .attr('text-anchor', (d) => d.anchor ?? 'middle')
    .attr('dominant-baseline', (d) => d.baseline ?? 'auto')
    .text((d) => d.text);
}
