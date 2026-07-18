import { Y_LABEL_GAP_OUTSIDE } from './frame.js';
import { tokenNum } from './tokens.js';

const fmt = new Intl.NumberFormat('en-US');
export const formatValue = (v) => fmt.format(v);

/* 轴标签级间距经 token 下发（源码禁字面量）：
 *   --spacing-axis-y-inset-gap   [AXIS-01] inside 数据让位安全间距
 *   --spacing-axis-x-label-min-gap [AXIS-06] 相邻 X 标签最小净距（碰撞阈值）
 * frame.js 的绘制区几何留白仍为字面量（见 specs/axes.md 待办，本轮不并入）。 */

/*
 * [AXIS-01][AXIS-03] Y 轴标签。
 * inside（原形式 A，默认；网格内部 + 避让网格线）：
 *   最顶标签顶对齐、贴顶线向下——不得高过绘制区上沿（最常见错误）；
 *   其余标签底对齐、贴线上方；0/最底标签不越下沿。
 * outside（原形式 B；网格外部 + 与网格线居中）：
 *   距网格 Y_LABEL_GAP_OUTSIDE（8px，与 frame.js 列宽预留同源），上下居中；
 *   顶/底标签超出绘制区约半行高（createFrame 已留位）。
 * [AXIS-03] 对齐贴轴线一侧、随位置自动：内/外 × 左/右由 anchor 适配。
 */
export function renderYLabels(layer, frame, ticks, y, opts = {}) {
  const { form = 'inside', side = 'left', format = formatValue } = opts;
  const topTick = Math.max(...ticks);
  const sel = layer
    .selectAll('text.dv-axis-label')
    .data(ticks)
    .join('text')
    .attr('class', 'dv-axis-label');

  if (form === 'inside') {
    sel
      .attr('x', side === 'left' ? frame.grid.left : frame.grid.right)
      .attr('text-anchor', side === 'left' ? 'start' : 'end')
      .attr('y', (d) => (d === topTick ? y(d) + 3 : y(d) - 4))
      .attr('dominant-baseline', (d) => (d === topTick ? 'hanging' : 'auto'));
  } else {
    sel
      .attr('x', side === 'left'
        ? frame.grid.left - Y_LABEL_GAP_OUTSIDE
        : frame.grid.right + Y_LABEL_GAP_OUTSIDE)
      .attr('text-anchor', side === 'left' ? 'end' : 'start')
      .attr('y', (d) => y(d))
      .attr('dominant-baseline', 'middle');
  }
  sel.text((d) => format(d));
}

/*
 * 渲染级文本测量：临时挂一棵隐藏 SVG，用真实类名走真实 CSS 级联量宽——
 * tabular-nums 等 Canvas measureText 表达不了的字体特性全部包含，无估算误差。
 * X / Y 轴标签的一切宽度测量共用此函数（唯一测量源，[AXIS-08]）。
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
function measureRendered(host, texts) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;overflow:visible';
  const nodes = texts.map((t) => {
    const el = document.createElementNS(SVG_NS, 'text');
    el.setAttribute('class', 'dv-axis-label');
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
 * [AXIS-08] outside 标签列宽：每次重绘按当前刻度**一次性渲染测量**，精确贴合，
 * 不附加余量、不做量化/滞回——列宽随缩放窗口的标签变化即时调整。
 */
export function measureYLabelWidth(host, labels) {
  return Math.ceil(Math.max(0, ...measureRendered(host, labels)));
}

/* [AXIS-01] inside 布局数据让位：有标签一侧的数据边界收缩「最长标签宽 + 安全间距」 */
export function yLabelInset(host, ticks, format = formatValue) {
  const widths = measureRendered(host, ticks.map(format));
  return Math.ceil(Math.max(0, ...widths)) + tokenNum(host, '--spacing-axis-y-inset-gap');
}

/*
 * [AXIS-04][AXIS-05][AXIS-06] X 轴标签（items: [{ label, x }]，x = 类目中心）。
 * [AXIS-05] 对齐：中间标签居中；首尾是否贴绘制区边缘由 flushFirst / flushLast
 *           决定（数据贴边时为 true，如满幅折线）；居中标签越界时向内回收。
 * [AXIS-06] 碰撞（任意相邻净距 < --spacing-axis-x-label-min-gap，默认 8px，触发；策略随主题）：
 *   segment3 —— 整体改 3 段式，只留首/中/尾（THS / Ainvest）
 *   hide     —— 隐藏碰撞标签，首尾始终保留（iFinD-PC）
 *   宽度走渲染级测量（与 AXIS-08 同源）——碰撞判定无估算误差。
 * [GRID-03] 容器宽度变化后必须重新调用（碰撞结果随宽度变化）。
 */
export function renderXLabels(layer, frame, items, opts = {}) {
  const { collision = 'segment3', flushFirst = false, flushLast = false } = opts;
  const n = items.length;
  const minGap = tokenNum(frame.host, '--spacing-axis-x-label-min-gap');
  const widths = measureRendered(frame.host, items.map((d) => d.label));

  const boxes = items.map((d, i) => {
    let left = d.x - widths[i] / 2;
    if (i === 0 && flushFirst) left = frame.grid.left;
    if (i === n - 1 && flushLast) left = frame.grid.right - widths[i];
    left = Math.max(frame.grid.left, Math.min(left, frame.grid.right - widths[i]));
    return { label: d.label, left, width: widths[i], i };
  });

  const collides = (a, b) => b.left - (a.left + a.width) < minGap;

  let kept = boxes;
  if (n > 2 && boxes.some((b, i) => i > 0 && collides(boxes[i - 1], b))) {
    if (collision === 'segment3') {
      const mid = boxes[Math.round((n - 1) / 2)];
      kept = [boxes[0], mid, boxes[n - 1]];
      if (collides(kept[0], mid) || collides(mid, kept[2])) kept = [boxes[0], boxes[n - 1]];
    } else {
      const last = boxes[n - 1];
      kept = [boxes[0]];
      for (let i = 1; i < n - 1; i++) {
        const prev = kept[kept.length - 1];
        if (!collides(prev, boxes[i]) && !collides(boxes[i], last)) kept.push(boxes[i]);
      }
      kept.push(last);
    }
  }

  layer
    .selectAll('text.dv-axis-label')
    .data(kept, (d) => d.i)
    .join('text')
    .attr('class', 'dv-axis-label')
    .attr('y', frame.xBandTop)
    .attr('dominant-baseline', 'hanging')
    .attr('x', (d) => d.left)
    .text((d) => d.label);
}
