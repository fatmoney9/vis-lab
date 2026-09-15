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
 *                                  [AXIS-01] inside「Y 标签**墨迹边缘** ↔ 网格线」净距
 *                                  （THS 2px；iFinD-PC / Ainvest 0px）。
 *                                  2026-08-20 前这里是硬编码的 `y(d) - 4` / `y(d) + 3`，且那两个数
 *                                  定的是**基线**不是墨迹边——见下方 renderYLabels 的说明。
 *                                  ⚠️ iFinD-PC / Ainvest 的本 token 取值恰为 0，而 tokenNum
 *                                  取不到时也返回 0，**名字写错不会露馅**；源侧由 tokens/build.mjs 的三主题
 *                                  合同校验兜住（少一个键就报错），代码侧只能靠这行注释。
 * frame.js 的绘制区几何留白已一并 token 化（specs/axes.md 待办第 2 条）。 */

/*
 * [AXIS-01][AXIS-03] Y 轴标签。
 * inside（默认；网格内部 + 避让网格线）：
 *   最顶标签顶对齐、贴顶线向下——不得高过绘制区上沿（最常见错误）；
 *   其余标签底对齐、贴线上方；0/最底标签不越下沿。
 *   **按「墨迹边缘」定位，不按基线**（--spacing-axis-y-label-inside-gap；THS 2px，
 *   iFinD-PC / Ainvest 0px）：
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
 * [AXIS-04] 轴标签的逐行内容协议。
 * 字符串 = 单行；数组 = 显式分行；允许调用方装配时多包一层数组，但最终只产出一维字符串。
 * 这是常态 X 标签与 TOOLTIP-09 高亮标签共用的唯一标准化入口，避免交互态把数组隐式
 * String() 成 `Other,Expenses`，或在另一个模块重新发明一套分行规则。
 */
export function axisLabelLines(label) {
  const source = Array.isArray(label) ? label : [label];
  const lines = source
    .flatMap((line) => (Array.isArray(line) ? line : [line]))
    .map((line) => String(line ?? ''))
    .filter(Boolean);
  return lines.length > 0 ? lines : [''];
}

/*
 * [AXIS-04] 把单行 X 轴名称按真实渲染宽度折成最多两行。
 * - 已显式分行（数组 / 换行符）时尊重调用方；超过两行则把余文并回末行，完整内容不丢失；
 * - 自动折行先找单词边界，并以两行视觉宽度最均衡为优先；单词本身仍超宽时才按字符兜底；
 * - measure 由调用方接入 core/measure.js，函数本身保持纯计算，禁止另造字体宽度估算。
 *
 * 这里不加省略号：是否允许丢失轴节点文本是图型叙事规则，不应成为通用折行器的副作用。
 */
export function wrapAxisLabel(label, maxWidth, measure) {
  const raw = Array.isArray(label) ? label : String(label ?? '').split(/\r?\n/);
  const explicit = axisLabelLines(raw);
  if (explicit.length > 1) {
    return explicit.length <= 2
      ? explicit
      : [explicit[0], explicit.slice(1).join(' ')];
  }

  const text = explicit[0].trim().replace(/\s+/g, ' ');
  if (!text || !(maxWidth > 0) || measure(text) <= maxWidth) return [text];

  const score = (lines) => {
    const widths = lines.map((line) => Number(measure(line)) || 0);
    return {
      lines,
      overflow: widths.reduce((sum, width) => sum + Math.max(0, width - maxWidth), 0),
      imbalance: Math.abs(widths[0] - widths[1]),
      widest: Math.max(...widths),
    };
  };
  const choose = (candidates) => candidates
    .map(score)
    .sort((a, b) => a.overflow - b.overflow
      || a.imbalance - b.imbalance
      || a.widest - b.widest)[0];

  const words = text.split(' ');
  let candidates = words.slice(1).map((_word, index) => [
    words.slice(0, index + 1).join(' '),
    words.slice(index + 1).join(' '),
  ]);
  let best = candidates.length > 0 ? choose(candidates) : null;

  /* CSS 的 break-word 语义：只在按词切仍装不下时，才允许拆开长单词 / 无空格文字。 */
  if (!best || best.overflow > 0) {
    const chars = Array.from(text);
    candidates = chars.slice(1).map((_char, index) => [
      chars.slice(0, index + 1).join('').trimEnd(),
      chars.slice(index + 1).join('').trimStart(),
    ]).filter((lines) => lines.every(Boolean));
    if (candidates.length > 0) best = choose(candidates);
  }
  return best?.lines ?? [text];
}

/*
 * [AXIS-04][TOOLTIP-09] 给已有 SVG <text> 写入同构的逐行 <tspan>。
 * selection 由调用方创建，因此本函数不引入 d3；常态轴与高亮态只在外层 class / 背景上分叉，
 * 内容结构、行高和水平锚点都走这里。lineClass 只给调用方附加逐行语义样式。
 */
export function renderAxisLabelLines(selection, {
  lines = (d) => d.lines ?? d.label,
  x = (d) => d.x,
  lineHeight,
  lineClass = null,
} = {}) {
  selection.text(null);
  selection.selectAll('tspan')
    .data((datum, datumIndex, nodes) => axisLabelLines(lines(datum, datumIndex, nodes))
      .map((text, lineIndex) => ({ datum, datumIndex, nodes, text, lineIndex })))
    .join('tspan')
    .attr('class', (line) => (lineClass
      ? lineClass(line.text, line.lineIndex, line.datum, line.datumIndex, line.nodes)
      : null))
    .attr('x', (line) => x(line.datum, line.datumIndex, line.nodes))
    .attr('dy', (line) => (line.lineIndex === 0 ? 0 : lineHeight))
    .text((line) => line.text);
  return selection;
}

/* [AXIS-04][TOOLTIP-09] 常态与高亮态 X 标签共用的文字定位合同。
   位置与逐行节奏只能在这一处定义，避免两个状态各自计算后产生像素跳动。 */
export function xAxisLabelTextLayout(frame) {
  return {
    y: frame.xBandTop,
    dominantBaseline: 'hanging',
    lineHeight: frame.lineH,
  };
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
 * [AXIS-04][AXIS-05][AXIS-06] X 轴标签（items: [{ label, x, lines? }]，x = 类目中心）。
 * lines 缺省时维持单行；存在时直接逐行测量并以最宽行作为标签盒，不要求 L2 另造测量探针。
 * [AXIS-05] 对齐：中间标签居中；首尾是否贴绘制区边缘由 flushFirst / flushLast
 *           决定（数据贴边时为 true，如满幅折线）；居中标签越界时向内回收。
 * [AXIS-06] 碰撞（任意相邻净距 < --spacing-axis-x-label-min-gap，默认 8px，触发；策略随主题）：
 *   segment3 —— 整体改 3 段式，只留首/中/尾（THS / Ainvest）
 *   hide     —— 隐藏碰撞标签，首尾始终保留（iFinD-PC）
 *   none     —— 全量保留；仅供缺少任一节点都会破坏叙事的图型显式选择（如瀑布等式）
 *   宽度走渲染级测量（与 AXIS-08 同源）——碰撞判定无估算误差。
 * [GRID-03] 容器宽度变化后必须重新调用（碰撞结果随宽度变化）。
 */
export function renderXLabels(layer, frame, items, opts = {}) {
  const {
    collision = 'segment3', flushFirst = false, flushLast = false, lineClass = null,
  } = opts;
  const n = items.length;
  const minGap = tokenNum(frame.host, '--spacing-axis-x-label-min-gap');
  const lineGroups = items.map((datum, datumIndex) => axisLabelLines(datum.lines ?? datum.label)
    .map((text, lineIndex) => ({
      datum,
      datumIndex,
      lineIndex,
      text,
      className: lineClass
        ? lineClass(text, lineIndex, datum, datumIndex, [])
        : null,
    })));
  const flatLines = lineGroups.flat();
  const flatWidths = measureTexts(frame.host, flatLines.map((line) => line.text), (_text, index) => [
    'dv-axis-label',
    flatLines[index].className,
  ].filter(Boolean).join(' '));
  let measuredOffset = 0;
  const widths = lineGroups.map((lines) => {
    const lineWidths = flatWidths.slice(measuredOffset, measuredOffset + lines.length);
    measuredOffset += lines.length;
    return Math.max(0, ...lineWidths);
  });
  const textLayout = xAxisLabelTextLayout(frame);

  const boxes = items.map((d, i) => {
    let left = d.x - widths[i] / 2;
    if (i === 0 && flushFirst) left = frame.grid.left;
    if (i === n - 1 && flushLast) left = frame.grid.right - widths[i];
    left = Math.max(frame.grid.left, Math.min(left, frame.grid.right - widths[i]));
    return { ...d, label: d.label, left, width: widths[i], i };
  });

  const collides = (a, b) => b.left - (a.left + a.width) < minGap;

  let kept = boxes;
  if (collision !== 'none'
    && n > 2
    && boxes.some((b, i) => i > 0 && collides(boxes[i - 1], b))) {
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

  const labels = layer
    .selectAll('text.dv-axis-label')
    .data(kept, (d) => d.i)
    .join('text')
    .attr('class', 'dv-axis-label')
    .attr('y', textLayout.y)
    .attr('dominant-baseline', textLayout.dominantBaseline);

  if (kept.some((d) => d.lines != null)) {
    const textX = (d) => d.left + d.width / 2;
    labels.attr('x', textX).attr('text-anchor', 'middle');
    renderAxisLabelLines(labels, {
      lines: (d) => d.lines ?? d.label,
      x: textX,
      lineHeight: textLayout.lineHeight,
      lineClass,
    });
  } else {
    /* 保持既有单行轴 DOM 与起点锚定不变，避免无关图型因本次多行能力重构发生像素漂移。 */
    labels.attr('x', (d) => d.left).attr('text-anchor', null).text((d) => d.label);
  }
  return labels;
}
