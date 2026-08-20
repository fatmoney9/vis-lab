import { tokenNum } from './tokens.js';
import { measureTexts, measureInk } from './measure.js';

const fmt = new Intl.NumberFormat('en-US');
export const formatValue = (v) => fmt.format(v);

/* 轴标签级间距经 token 下发（源码禁字面量）：
 *   --spacing-axis-y-inset-gap     [AXIS-01] inside 数据让位安全间距
 *   --spacing-axis-x-label-min-gap [AXIS-06] 相邻 X 标签最小净距（碰撞阈值）
 *   --spacing-axis-y-label-gap     [AXIS-01] outside「Y 标签 ↔ 网格」净距；**与 frame.js 的
 *                                  列宽预留同源**——两处必须读同一个 token，否则标签会与它自己
 *                                  占的那列错开。2026-08-17 前这是 frame.js 导出的字面量常量。
 *   --spacing-axis-y-label-inside-gap
 *                                  [AXIS-01] inside「Y 标签**墨迹边缘** ↔ 网格线」净距（三主题 0）。
 *                                  2026-08-20 前这里是硬编码的 `y(d) - 4` / `y(d) + 3`，且那两个数
 *                                  定的是**基线**不是墨迹边——见下方 renderYLabels 的说明。
 *                                  ⚠️ 本 token 取值恰为 0，而 tokenNum 取不到时也返回 0，
 *                                  **名字写错不会露馅**；源侧由 tokens/build.mjs 的三主题
 *                                  合同校验兜住（少一个键就报错），代码侧只能靠这行注释。
 * frame.js 的绘制区几何留白已一并 token 化（specs/axes.md 待办第 2 条）。 */

/*
 * [AXIS-01][AXIS-03] Y 轴标签。
 * inside（默认；网格内部 + 避让网格线）：
 *   最顶标签顶对齐、贴顶线向下——不得高过绘制区上沿（最常见错误）；
 *   其余标签底对齐、贴线上方；0/最底标签不越下沿。
 *   **按「墨迹边缘」定位，不按基线**（--spacing-axis-y-label-inside-gap，三主题 0 = 字紧贴线）：
 *   基线到墨迹边的距离由**字体与字符**决定，代码完全参与不了。2026-08-20 前这里写的是
 *   `y(d) - 4`（基线偏移），实测同一根轴上产出的视觉间距各不相同——THS 的「万」下探基线
 *   1.35px 只剩 2.65px、纯数字「0」下探 0.09px 有 3.91px；换到 Ainvest 移动端（另一套字体）
 *   又是 3.88px，顶部那条 `+3` 则是 4.29 / 3.43px。**六个位置量出六个值，没有一个等于 3 或 4**，
 *   且换字体会静默漂移。改为量 measureInk 反推基线后，视觉间距恒等于 token 值。
 *   ⚠️ 已知边界：墨迹按**整串**量，故串里若有逗号 / 括号这类下伸标点，贴线的会是标点的尾巴、
 *   数字底会略微悬空。当前 inside 两档（THS 全端、Ainvest 移动端）的标签是「12万」「120K」
 *   这类无下伸标点的形态，不受影响；真遇到再议——那属于「视觉底该由谁定义」的设计问题，
 *   不是本处的定位算法问题。
 * outside（网格外部 + 与网格线居中）：
 *   距网格 --spacing-axis-y-label-gap（8px，与 frame.js 列宽预留同源），上下居中；
 *   顶/底标签超出绘制区约半行高（createFrame 已留位）。
 * [AXIS-03] 对齐：默认（align=auto）贴轴线一侧、随位置自动（内/外 × 左/右由 anchor 适配）；
 *           align=right（Ainvest 特例，behavior y-label-align）全部右对齐——只需改 outside 右列
 *           （anchor 切 end、贴标签列外沿 = 画布右缘），inside 右侧与 outside 左列本就右对齐。
 */
export function renderYLabels(layer, frame, ticks, y, opts = {}) {
  const { form = 'inside', side = 'left', format = formatValue, align = 'auto' } = opts;
  const topTick = Math.max(...ticks);
  const sel = layer
    .selectAll('text.dv-axis-label')
    .data(ticks)
    .join('text')
    .attr('class', 'dv-axis-label');

  if (form === 'inside') {
    /* 墨迹上下边（相对基线）按刻度序一一对应；基线由此反推，故 dominant-baseline 恒 auto——
       原先顶部那条靠 hanging 定位，而 hanging 的落点同样是字体给的、不可控，一并去掉。 */
    const gap = tokenNum(frame.host, '--spacing-axis-y-label-inside-gap');
    const ink = measureInk(frame.host, ticks.map((d) => format(d)), 'dv-axis-label');
    sel
      .attr('x', side === 'left' ? frame.grid.left : frame.grid.right)
      .attr('text-anchor', side === 'left' ? 'start' : 'end')
      /* 顶：墨迹顶贴顶线下方 gap → 基线 = 线 + gap + ascent
         其余：墨迹底贴线上方 gap → 基线 = 线 − gap − descent */
      .attr('y', (d, i) => (d === topTick
        ? y(d) + gap + ink[i].ascent
        : y(d) - gap - ink[i].descent))
      .attr('dominant-baseline', 'auto');
  } else {
    const alignEnd = side === 'right' && align === 'right'; /* [AXIS-03] 右列右对齐特例 */
    const gap = tokenNum(frame.host, '--spacing-axis-y-label-gap');
    sel
      .attr('x', side === 'left'
        ? frame.grid.left - gap
        : alignEnd ? frame.width : frame.grid.right + gap)
      .attr('text-anchor', side === 'left' || alignEnd ? 'end' : 'start')
      .attr('y', (d) => y(d))
      .attr('dominant-baseline', 'middle');
  }
  sel.text((d) => format(d));
}

/*
 * [AXIS-08] 渲染级文本测量：X / Y 轴标签的一切宽度测量共用同一个源——实现已抽到
 * core/measure.js（数据标签 label.js 复用同一份，且该模块零依赖、可被 node 加载）。
 * 本处只固定「轴标签类名」这一个参数。
 */
const measureRendered = (host, texts) => measureTexts(host, texts, 'dv-axis-label');

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
