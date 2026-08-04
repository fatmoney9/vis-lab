import { select } from 'd3';
import { tokenNum } from './tokens.js';
import { markerSpecFor, renderMarker } from './legend.js';

/*
 * L1 · Tooltip 气泡（HTML 浮层）。权威规范见 specs/tooltip.md。
 * 职责边界：气泡本体渲染（TOOLTIP-01..03）+ 三个位置档几何（TOOLTIP-04..06）。
 * 「hover 落在哪个类目、行数据是什么、用哪一档」由 L2 组装后传入（TOOLTIP-07/10）；
 * 本模块无 if(theme)：样式全走 token（styles.css），行为差异全部经参数进入。
 * 浮层挂在 plotHost 内（token 作用域 + 随图表销毁），但定位是 fixed 视口坐标（TOOLTIP-12）：
 * 档位几何仍按 svg 局部坐标算（svg 充满 plotHost 左上角），输出时叠加 plotHost 视口矩形——
 * 祖先 overflow 不裁剪，气泡可超出图表 frame / 外层卡片容器。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* 形态兜底常量（档位专属几何、无 token，与 frame.js 常量同类；权威定义 specs/tooltip.md） */
const ARROW_H = 6;        /* [TOOLTIP-05] top-anchor 专属下三角高（兜底值） */
const ARROW_W = 12;       /* [TOOLTIP-05] 三角底宽 */
const FOLLOW_OFFSET = 12; /* [TOOLTIP-04] follow 档气泡与鼠标的间距 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

export function createTooltip(plotHost) {
  const root = select(plotHost).append('div').attr('class', 'dv-tooltip');

  /*
   * [TOOLTIP-04] follow 档的 clamp 边界 = **图表根**，换算成 plotHost 局部坐标返回。
   * 找法是 `closest('.dv-chart')`——那是**组件自己挂的类**（两个 L2 骨架都加），
   * 不是使用方的 DOM 结构，故这不算越层、也不需要调用方传引用（传引用等于把刚删掉的
   * 那类「可以传错的参数」换个名字请回来）。
   * 再往外的卡片（预览面的 .theme-card / .stage__surface）是 L3 外壳，组件不该知道它存在；
   * 差的就是外壳那圈内边距（实测每侧约 15px），肉眼不可辨。
   * 找不到时回落到 plotHost 自身 = 保持旧行为，不抛错。
   */
  function bounds(box) {
    const rootEl = plotHost.closest('.dv-chart');
    if (!rootEl) return { left: 0, top: 0, right: box.width, bottom: box.height };
    const r = rootEl.getBoundingClientRect();
    return { left: r.left - box.left, top: r.top - box.top, right: r.right - box.left, bottom: r.bottom - box.top };
  }

  /* 三角几何在此（ARROW 常量唯一源）、颜色在 styles.css（禁字面量） */
  const arrow = root.append('div').attr('class', 'dv-tooltip__arrow')
    .style('border-width', `${ARROW_H}px ${ARROW_W / 2}px 0`);
  const title = root.append('div').attr('class', 'dv-tooltip__title');
  const rowsHost = root.append('div').attr('class', 'dv-tooltip__rows');
  const markerSize = tokenNum(plotHost, '--size-legend-marker') || 12;

  /*
   * [TOOLTIP-02] 内容：标题行 + 数据行（marker + 系列名左 / 数值右）。
   * 行序由调用方保证 = 图例序（声明序）；marker 与图例同源（legend.js 同一份规格与渲染）。
   * rows = [{ key, label, type, colorVar, value }]（value 已格式化，null 已转 "-"）
   */
  function show({ title: titleText, rows }, marker) {
    root.classed('is-visible', true);
    /* [TOOLTIP-02] 标题行**可省**：无标题维度的图（饼 / 环等无坐标系图，见 specs/pie.md PIE-05）
       不传 title 时整行不渲染——渲染成空行并不等于没有，它仍占 spacing-tooltip-row 的下间距
       与 iFinD 特例的标题行下分割线，会在气泡顶部露出一条孤立横线。 */
    const hasTitle = titleText != null && titleText !== '';
    title.style('display', hasTitle ? null : 'none').text(hasTitle ? titleText : '');
    const row = rowsHost.selectAll('div.dv-tooltip__row').data(rows, (d) => d.key)
      .join((enter) => {
        const r = enter.append('div').attr('class', 'dv-tooltip__row');
        r.append(() => document.createElementNS(SVG_NS, 'svg')).attr('class', 'dv-tooltip__marker');
        r.append('span').attr('class', 'dv-tooltip__label');
        r.append('span').attr('class', 'dv-tooltip__value');
        return r;
      })
      .order();
    row.select('.dv-tooltip__label').text((d) => d.label);
    row.select('.dv-tooltip__value').text((d) => d.value);
    row.each(function (d) {
      const svg = select(this).select('svg.dv-tooltip__marker').style('color', `var(${d.colorVar})`);
      renderMarker(svg, markerSpecFor(marker, d.type), markerSize);
    });
  }

  /*
   * [TOOLTIP-04..06] 三个位置档（形态定义见 specs/tooltip.md）。
   * ctx = { grid, cx, pointer:{x,y} } —— 全部为 **plotHost 坐标系**像素：
   *   grid = frame.grid（top-anchor 定锚边高度 / side-fixed 定左右角）
   *   cx   = 触发类目中心 x · pointer = 鼠标位置
   *
   * **clamp 的盒子不由调用方传**，本模块按档自己取（TOOLTIP-04/05/06 各有各的边界）。
   * 这是有意收回来的：调用方手边最顺手的是 `frame` 的画布宽高，而轴图下
   * 画布 == 绘图区 == 图表根（同宽），三者恰好相等 → 传错也看不出来；
   * 饼环却三者都不等（画布 = 图元外接框、绘图区紧裹画布、图表根还含图例），
   * 于是「该传哪个」成了看不见、传错不报错、只在特定布局才现形的隐性契约。
   * 参数删掉，这类错就不可能再发生，新图表接入也不必知道有这回事。
   */
  function place(mode, ctx) {
    const { grid, cx, pointer } = ctx;
    const w = root.node().offsetWidth;
    const h = root.node().offsetHeight;
    /* 这个 rect 既是各档 clamp 边界的换算原点，也是末尾 fixed 换算的原点——一处取、处处同源 */
    const box = plotHost.getBoundingClientRect();
    let left = 0;
    let top = 0;
    arrow.style('display', 'none');

    if (mode === 'top-anchor') {
      /* [TOOLTIP-05] 顶部锚定式：三角尖端 x 恒 = 触发坐标；气泡底边 y = grid 上沿 − 三角高
         （与坐标 y 无关）；气泡是临时遮罩物，向上盖过 legend / 标题层属正常。
         **水平 clamp 到视口**：气泡钉在类目上、宽度可观，夹在图表里会让贴边的类目频繁被截；
         它本就是 fixed 浮层（TOOLTIP-12 允许越出任何祖先），只需保证不跑出屏幕。
         **垂直不 clamp**：② 明写「底边 y 与坐标 y 无关」，一夹这条就碎（三角会脱离气泡底边）。 */
      left = clamp(cx - w / 2, -box.left, window.innerWidth - box.left - w);
      top = grid.top - ARROW_H - h;
      arrow.style('display', 'block')
        .style('left', `${clamp(cx - left - ARROW_W / 2, 2, w - ARROW_W - 2)}px`);
    } else if (mode === 'side-fixed') {
      /* [TOOLTIP-06] 两侧固定式：以图表中点反选对侧（左半区触发 → 贴右上角、右半区 → 左上角），
         顶对齐 grid 上沿、不随鼠标纵移、水平只有左右两个离散档。
         **边界就是绘图区**——它不做 clamp，直接贴 grid 的左右角，本就落在绘图区内。 */
      const midX = (grid.left + grid.right) / 2;
      left = pointer.x < midX ? grid.right - w : grid.left;
      top = grid.top;
    } else {
      /* [TOOLTIP-04] 跟随式：默认出现在触发点右下方连续跟随（无半区反选）；
         右侧碰撞放不下才翻到触发点左侧躲避。
         **边界是图表根**（绘图区 + 间距 + 图例，即组件自己的整块地盘），不是绘图区：
         气泡恒在光标 ±12px、光标又必然在图内，用绘图区夹它防不住什么，只会在
         绘图区紧裹图元时（饼环左右结构：绘图区 291 而图表根 706）把它平白挤扁。 */
      const b = bounds(box);
      left = pointer.x + FOLLOW_OFFSET;
      if (left + w > b.right) left = pointer.x - FOLLOW_OFFSET - w;
      left = clamp(left, b.left, Math.max(b.left, b.right - w));
      top = clamp(pointer.y + FOLLOW_OFFSET, b.top, Math.max(b.top, b.bottom - h));
    }
    /* [TOOLTIP-12] 局部坐标 → fixed 视口坐标（plotHost 视口矩形每次 place 现取，滚动/重排后自准） */
    root.style('left', `${box.left + left}px`).style('top', `${box.top + top}px`);
  }

  /* 隐藏即时执行；「移出延迟」的 timer 归 L2（与指示线 / 线点同步隐藏，TOOLTIP-10） */
  const hide = () => root.classed('is-visible', false);

  return { show, place, hide };
}
