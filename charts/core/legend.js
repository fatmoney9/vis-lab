import { select } from 'd3';
import { tokenNum } from './tokens.js';

/*
 * L1 · 图例（Legend）。权威规范见 specs/legend.md。
 * 职责边界：本模块只渲染图例本体（容器 / 项 / marker / 关闭态外观）并 emit 事件，
 * **不碰系列图形**——hover 弱化、点击隐藏对系列的实际作用由 L2 执行（见 LEGEND-05/06）。
 * 与 axis.js / grid.js 一致：纯函数 + d3 join 幂等重渲；状态（hidden 集合）由调用方持有。
 * 无 if(theme===…)：marker 形态、点击模式全部作为参数传入（由 L2 从 resolveBehavior 取）。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* [LEGEND-03] 按图表类型取 marker 规格：unified 全类型同形；by-type 命中类型、缺则 default 兜底。
   导出：tooltip 数据行的系列 marker 与图例同源（TOOLTIP-02），复用同一份规格与渲染 */
export function markerSpecFor(marker, type) {
  if (!marker) return { shape: 'rect', w: 6, h: 6, r: 1 };
  if (marker.mode === 'unified') return { shape: marker.shape, w: marker.w, h: marker.h };
  return (marker.shapes && (marker.shapes[type] || marker.shapes.default)) || { shape: 'rect', w: 6, h: 6, r: 1 };
}

/*
 * [LEGEND-03] 标记本体渲染：居中于 size-legend-marker 容器（container px）。
 *   rect —— 方块 / line —— 横粗线（同为可圆角填充矩形，line 即细矩形），fill=currentColor 跟随系列色
 *   dot  —— 实心圆，fill=currentColor
 *   box  —— 描边方（盒须缩略），stroke=currentColor
 *   split—— 左右两色（红绿柱），涨跌固定色 --color-price-up/-down（不跟随系列色，故 off 态不改色）
 * 颜色一律 currentColor 或 var() 引用，无色值字面量；w/h/r 为形态几何（来自 behavior）。
 * 导出：tooltip 复用（同 markerSpecFor）。
 */
export function renderMarker(sel, spec, container) {
  const node = sel.node();
  while (node.firstChild) node.removeChild(node.firstChild);
  sel.attr('width', container).attr('height', container).attr('viewBox', `0 0 ${container} ${container}`);

  const cx = container / 2;
  const cy = container / 2;
  const { shape, w, h = w, r = 0 } = spec;

  if (shape === 'dot') {
    sel.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', Math.min(w, h) / 2)
      .attr('fill', 'currentColor');
  } else if (shape === 'box') {
    sel.append('rect')
      .attr('x', cx - w / 2).attr('y', cy - h / 2).attr('width', w).attr('height', h).attr('rx', r)
      .attr('fill', 'none').attr('stroke', 'currentColor').attr('stroke-width', 1);
  } else if (shape === 'split') {
    sel.append('rect')
      .attr('x', cx - w / 2).attr('y', cy - h / 2).attr('width', w / 2).attr('height', h)
      .attr('fill', 'var(--color-price-up)');
    sel.append('rect')
      .attr('x', cx).attr('y', cy - h / 2).attr('width', w / 2).attr('height', h)
      .attr('fill', 'var(--color-price-down)');
  } else {
    /* rect / line：可圆角的填充矩形（line 为 8×2 一类的细矩形） */
    sel.append('rect')
      .attr('x', cx - w / 2).attr('y', cy - h / 2).attr('width', w).attr('height', h)
      .attr('rx', r).attr('ry', r).attr('fill', 'currentColor');
  }
}

/*
 * [LEGEND-01..03/05/06] 渲染图例。幂等：同一 host 反复调用按 key diff 增量更新。
 *   host   容器元素（图例在其内建/复用一个 .dv-legend 根）
 *   items  [{ key, label, type, colorVar }]
 *          type = 系列类型（选 marker 形状）；colorVar = 系列色的 CSS 变量名（marker currentColor 取之）
 *   opts   { marker, align='left', layout='row', state:{hidden:Set, selected}, onToggle(key), onHover(key|null) }
 *          marker = resolveBehavior 的 legend-marker；align 无 token（默认左）；
 *          layout = [LEGEND-01] 排布主轴：'row' 横排换行（默认）/ 'column' 纵向单列一项一行。
 *                   align 的语义与方向无关（「左对齐」两种方向下都指靠左），只是实现从
 *                   justify-content 换成 align-items——CSS 里表达，本模块只挂类。
 *                   **方位（图例摆在图的哪一侧）不归本模块**：那是容器 flex 方向，
 *                   由 L2 给图表根元素挂 .dv-chart--legend-* 决定（LEGEND-10）。
 *          state.hidden   由调用方持有（配合 applyToggle）；关闭态 → .dv-legend-item--off
 *          state.selected 由调用方持有（配合 applyFocus，LEGEND-14 强调档）；
 *                         有选中时，**非选中项** → .dv-legend-item--dim。
 *                         ⚠️ 与 --off 是两套：--off 走 color-text-quaternary（「已关闭」的语义），
 *                         而强调档下什么都没关，故只压不透明度、不换色，语义才对得上。
 *          onHover：进入项 emit key、离开 emit null——L2 据此对其他系列施加 opacity-visualization-dim
 */
export function renderLegend(host, items, opts = {}) {
  const { marker, align = 'left', layout = 'row', state = {}, onToggle, onHover } = opts;
  const hidden = state.hidden ?? new Set();
  const selected = state.selected ?? null;
  const container = tokenNum(host, '--size-legend-marker') || 12;

  const root = select(host)
    .selectAll(':scope > div.dv-legend')
    .data([0])
    .join('div')
    .attr('class', 'dv-legend')
    .classed('dv-legend--column', layout === 'column') /* [LEGEND-10] */
    .classed('dv-legend--center', align === 'center')
    .classed('dv-legend--right', align === 'right');

  const item = root
    .selectAll('div.dv-legend-item')
    .data(items, (d) => d.key)
    .join((enter) => {
      const it = enter.append('div').attr('class', 'dv-legend-item');
      it.append(() => document.createElementNS(SVG_NS, 'svg')).attr('class', 'dv-legend-marker');
      it.append('span').attr('class', 'dv-legend-label');
      return it;
    });

  item
    .classed('dv-legend-item--off', (d) => hidden.has(d.key))
    /* [LEGEND-14] 强调档：有选中时其余项压暗。没有选中（selected=null）时整排都不带这个类，
       即「全部同权」——那是正常读数，不是「全部关闭」。 */
    .classed('dv-legend-item--dim', (d) => selected != null && d.key !== selected)
    /* 系列色只经自定义属性下发，不写 color——好让 --off 类以更高特异性覆盖为 quaternary */
    .style('--dv-series-color', (d) => `var(${d.colorVar})`)
    .on('click', (_e, d) => onToggle && onToggle(d.key))
    .on('mouseenter', (_e, d) => onHover && onHover(d.key))
    .on('mouseleave', () => onHover && onHover(null));

  /* [LEGEND-13] 纵列超宽由 CSS 省略号截断（纯 CSS，不测量）；title 是被截断时的兜底——
     原生 HTML 提示，无需接线，且图例本就接受鼠标（点击显隐），够得着。恒挂不判断是否真截了：
     判断要测量，而"没截时多一个与可见文字相同的 title"没有任何代价。 */
  item.select('.dv-legend-label').text((d) => d.label).attr('title', (d) => d.label);
  item.each(function (d) {
    renderMarker(select(this).select('svg.dv-legend-marker'), markerSpecFor(marker, d.type), container);
  });
}

/* [LEGEND-06][LEGEND-14] 点击的状态迁移（applyToggle / applyFocus）住在 core/legend-state.js。
   那边不 import d3，故可被 node --test 直接加载；本文件不再 re-export——
   同一个函数留两个门只会让下一个人挑错那个（同 examples.js 不留「扁平分类名」版本的取舍）。 */
