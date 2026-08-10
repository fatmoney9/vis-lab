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
 * [LABEL-06②] 一条线上的碰撞过滤（纯函数）。**与轴无关**——
 *   boxes  —— [{ start, size, … }]，可乱序（内部按 start 升序处理）
 *   minGap —— 相邻标签最小净距（px）
 * 柱线喂**水平**值（一个系列跨类目：start=文本左沿、size=文本宽）；
 * 饼环外侧标签喂**垂直**值（同一侧自上而下：start=y−行高/2、size=行高，见 specs/pie.md PIE-14）。
 * 字段刻意不叫 left/width：同一条贪心两个方向共用，L2 不得为另一个方向复制第二份。
 * 贪心：按 start 升序保留首个，其后每个与「上一个保留者」净距 ≥ minGap 才留。
 * 首个恒留 ⇒ 结果稳定、与容器变化单调（变挤只会更少，不会跳变）。
 * 返回保留下来的原对象（升序），不改入参。
 */
export function dropCollisions(boxes, minGap = 0) {
  const sorted = [...boxes].sort((a, b) => a.start - b.start);
  const kept = [];
  for (const box of sorted) {
    const prev = kept[kept.length - 1];
    if (!prev || box.start - (prev.start + prev.size) >= minGap) kept.push(box);
  }
  return kept;
}

/*
 * [PIE-16] 省略号截断（当前唯一消费者：饼环外侧标签的**名称段**）。
 *
 * 与 dropOversized 的关系：**同一个问题的两种处置，按图型二选一、不叠加**。
 * 档②（压在色块上）仍走「放不下就不放」——那里溢出的字会落到画布底色上直接看不见；
 * 饼环外侧档改走本函数——标签带是专门为它留的空间，截短仍可读，整条丢反而丢掉一个扇区的身份。
 *
 *   entries = [{ text, maxWidth }]   maxWidth 缺省 = 不限，原样返回
 *   measure = (texts[]) => widths[]  **一次量一批**的测量函数（由调用方绑定类名与宿主）
 * → [{ text, width, truncated }]，text 为 null 表示连最短形态都放不下、调用方应整条丢弃
 *
 * ⚠️ **测量必须按轮批量、不能逐条二分**：measureTexts 是「一次插入 N 个节点、一次 layout 读全部」，
 * 逐条二分会把 36 个标签 × 约 5 轮变成 180 次 layout flush；按轮批量只有约 5 次。
 * resize 时每帧重建都要跑这一段，差别就是卡不卡。
 *
 * 截断粒度是**字符**（Array.from 按码点切，不劈开 emoji / 代理对）。
 * 保底 MIN_KEPT_CHARS 个字符：只剩一个省略号的标签既读不出是谁、又占着位置，不如让它整条走人。
 */
const ELLIPSIS = '…';
const MIN_KEPT_CHARS = 1;

export function truncateBatch(entries, measure) {
  const full = measure(entries.map((e) => e.text));
  const out = entries.map((e, i) => ({ text: e.text, width: full[i], truncated: false }));

  /* 只把真正超宽的送进二分；没超的第一轮就定案，多数情况下一轮结束 */
  let pending = [];
  entries.forEach((e, i) => {
    if (e.maxWidth == null || full[i] <= e.maxWidth) return;
    const chars = Array.from(String(e.text));
    pending.push({ i, chars, lo: MIN_KEPT_CHARS, hi: chars.length - 1, maxWidth: e.maxWidth, best: null, bestW: 0 });
    out[i] = { text: null, width: 0, truncated: true };   /* 先按「放不下」置位，二分成功再覆盖 */
  });

  /* 找**最大的** k 使「前 k 字 + …」仍装得下。每轮所有待定项共用一次测量。 */
  while (pending.length) {
    const mids = pending.map((p) => Math.floor((p.lo + p.hi) / 2));
    const cands = pending.map((p, k) => p.chars.slice(0, mids[k]).join('') + ELLIPSIS);
    const w = measure(cands);
    const next = [];
    pending.forEach((p, k) => {
      if (w[k] <= p.maxWidth) { p.best = cands[k]; p.bestW = w[k]; p.lo = mids[k] + 1; }
      else p.hi = mids[k] - 1;
      if (p.lo <= p.hi) { next.push(p); return; }
      if (p.best != null) out[p.i] = { text: p.best, width: p.bestW, truncated: true };
    });
    pending = next;
  }
  return out;
}

/* anchor → 文本左沿（测量得到的 width 配合 text-anchor 换算） */
const leftOf = (x, width, anchor) =>
  anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;

/*
 * [LABEL-01..09] 把一批数据标签渲染进已存在的 <g>。
 *   items = [{ x, y, text, anchor='middle', baseline='auto', tone='series', bgHex, maxWidth, sizeClass }]
 *     sizeClass—— 可选的字号修饰类（当前只有饼环用：名称段 / 数值段各一个，PIE-15）。
 *                **测量与渲染共用同一个 class 串**（见 classOf），不得只在渲染时挂。
 *                一个逻辑标签要出两行时（PIE-15 stacked 档），L2 把两行当**两个 item**
 *                传进同一次调用即可——本模块一个 item 恒对应一个 <text>，不做多行拼装。
 *     x / y   —— L2 算好的锚点像素（柱顶净距、段内居中等偏移已含在内，LABEL-01）
 *     baseline—— SVG dominant-baseline：'auto' 文字在锚点上方 / 'hanging' 下方 / 'middle' 居中
 *     tone    —— 前景色三档（判据在 L2，本模块只按 tone 挂类，不靠位置反推）：
 *                'series'  档① 跟随系列色（currentColor，LABEL-03）—— 缺省
 *                'auto'    档② 压在色块上，按 bgHex 明暗切 token 色（LABEL-04）
 *                'neutral' 档③ 有引线关联，走中性正文色（LABEL-09；当前只有饼环外侧标签用）
 *                'neutral-secondary' 档③ 的次级：同一条标签里比 'neutral' 降一级
 *                          （饼环外侧的**名称段**；数值段仍走 'neutral'，PIE-12 / PIE-15）
 *     bgHex   —— tone:'auto' 时的背景色（= 该系列色 hex，由 L2 从 palette 结果透传）
 *     maxWidth—— 可用宽度（档② 传所在色块宽、档③ 传标签带留给它的宽）；超出即不画（LABEL-06③），缺省不限
 *   opts  = { collide = true } —— 水平碰撞过滤开关（LABEL-06②）。约定**一次调用 = 同一行**
 *           （一个系列跨类目，柱顶行 / 折线行 / 堆叠中该系列的那一段行皆然）；
 *           本就不同行的批次（如饼环四周环绕）传 false 关掉——它们改在**纵向**判，
 *           由 L2 分好左右两栏后各调一次 dropCollisions（同一个函数，喂 y 值，PIE-14）
 * 空文本 / 无 items 直接返回（LABEL-07 的 null 已由 L2 过滤，此处只做兜底）。
 * 一次测量供两道过滤共用（宽度超限 → 碰撞），不重复量。
 */
export function renderDataLabels(g, frame, items, opts = {}) {
  const { collide = true } = opts;
  const list = items.filter((d) => d && d.text != null && d.text !== '');
  if (!list.length) return;

  /* 没有任何一项要判宽、也不判碰撞时，测量结果无人消费——直接跳过（饼环外侧档就是这种：
     宽度已由 PIE-16 的截断保证装得下，碰撞已在 L2 按纵向判过）。省一次 layout flush。 */
  const needsMeasure = collide || list.some((d) => d.maxWidth != null);
  const widths = needsMeasure ? measureByClass(frame.host, list) : null;
  if (!needsMeasure) return paint(g, list);

  let boxes = list.map((d, i) => ({
    /* 水平向的 {start,size}：dropCollisions 收的是轴无关字段（LABEL-06②） */
    start: leftOf(d.x, widths[i], d.anchor ?? 'middle'),
    size: widths[i],
    width: widths[i],          /* dropOversized 判的是「文本宽 vs 可用宽」，恒为水平量 */
    maxWidth: d.maxWidth,
    item: d,
  }));
  boxes = dropOversized(boxes);                                   /* [LABEL-06③] */
  if (collide && boxes.length > 1) {
    boxes = dropCollisions(boxes, tokenNum(frame.host, '--spacing-data-label-min-gap')); /* [LABEL-06②] */
  }
  const visible = boxes.map((b) => b.item);
  if (!visible.length) return;
  paint(g, visible);
}

/*
 * 一个 item 最终挂的完整 class 串。**测量与渲染共用本函数**——
 * 这是不可省的：`sizeClass` 会改字号，拿另一个类去量就系统性偏（饼环 Ainvest 的数值段
 * 比名称段大 2px，按名称类量出来窄约 15%），而量出来的宽正是「装不装得下 / 截到第几个字」的依据。
 */
function classOf(d) {
  const size = d.sizeClass ? ` ${d.sizeClass}` : '';
  /* 档②③ 的修饰类承载 token 色——本模块不出现任何色值字面量（铁律1）；
     档①（'series' / 缺省）不挂修饰类，靠 .dv-data-label 的 fill:currentColor 跟随系列色 */
  if (d.tone === 'auto') return `${LABEL_CLASS} ${LABEL_CLASS}--${labelTone(d.bgHex)}${size}`;
  /* 档③ 两级同构：tone 名即修饰类名，色值一律落在 CSS 的 token 上（铁律1） */
  if (d.tone === 'neutral' || d.tone === 'neutral-secondary') {
    return `${LABEL_CLASS} ${LABEL_CLASS}--${d.tone}${size}`;
  }
  return `${LABEL_CLASS}${size}`;
}

/* 按 class 分组测量：同批里混着不同字号时，每组各用自己的类量一次（见 classOf 的说明）。
   绝大多数批次只有一个 class，等价于原来的单次调用。 */
function measureByClass(host, list) {
  const widths = new Array(list.length);
  const groups = new Map();
  list.forEach((d, i) => {
    const cls = classOf(d);
    if (!groups.has(cls)) groups.set(cls, []);
    groups.get(cls).push(i);
  });
  for (const [cls, idx] of groups) {
    const w = measureTexts(host, idx.map((i) => list[i].text), cls);
    idx.forEach((i, k) => { widths[i] = w[k]; });
  }
  return widths;
}

function paint(g, visible) {
  g.selectAll(`text.${LABEL_CLASS}`)
    .data(visible)
    .join('text')
    .attr('class', classOf)
    .attr('x', (d) => d.x)
    .attr('y', (d) => d.y)
    .attr('text-anchor', (d) => d.anchor ?? 'middle')
    .attr('dominant-baseline', (d) => d.baseline ?? 'auto')
    .text((d) => d.text);
}
