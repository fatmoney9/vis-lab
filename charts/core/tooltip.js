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
    title.text(titleText);
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
   * ctx = { grid, width, height, cx, pointer:{x,y} }，全部为 plotHost/svg 坐标系像素：
   *   grid = frame.grid · width/height = frame 画布宽高 · cx = 触发类目中心 x · pointer = 鼠标位置
   */
  function place(mode, ctx) {
    const { grid, width, height, cx, pointer } = ctx;
    const w = root.node().offsetWidth;
    const h = root.node().offsetHeight;
    let left = 0;
    let top = 0;
    arrow.style('display', 'none');

    if (mode === 'top-anchor') {
      /* [TOOLTIP-05] 顶部锚定式：三角尖端 x 恒 = 触发坐标；气泡底边 y = grid 上沿 − 三角高
         （与坐标 y 无关）；水平容器内 clamp——贴边后气泡停、三角继续随坐标偏移；
         气泡是临时遮罩物，向上盖过 legend / 标题层属正常（不为它预留 grid 顶间距） */
      left = clamp(cx - w / 2, 0, width - w);
      top = grid.top - ARROW_H - h;
      arrow.style('display', 'block')
        .style('left', `${clamp(cx - left - ARROW_W / 2, 2, w - ARROW_W - 2)}px`);
    } else if (mode === 'side-fixed') {
      /* [TOOLTIP-06] 两侧固定式：以图表中点反选对侧（左半区触发 → 贴右上角、右半区 → 左上角），
         顶对齐 grid 上沿、不随鼠标纵移、水平只有左右两个离散档 */
      const midX = (grid.left + grid.right) / 2;
      left = pointer.x < midX ? grid.right - w : grid.left;
      top = grid.top;
    } else {
      /* [TOOLTIP-04] 跟随式：默认出现在触发点右下方连续跟随（无半区反选）；
         右侧与容器碰撞放不下才翻到触发点左侧躲避；垂直 clamp 不超出绘制区顶部 / 底部 */
      left = pointer.x + FOLLOW_OFFSET;
      if (left + w > width) left = pointer.x - FOLLOW_OFFSET - w;
      left = clamp(left, 0, width - w);
      top = clamp(pointer.y + FOLLOW_OFFSET, 0, height - h);
    }
    /* [TOOLTIP-12] 局部坐标 → fixed 视口坐标（plotHost 视口矩形每次 place 现取，滚动/重排后自准） */
    const box = plotHost.getBoundingClientRect();
    root.style('left', `${box.left + left}px`).style('top', `${box.top + top}px`);
  }

  /* 隐藏即时执行；「移出延迟」的 timer 归 L2（与指示线 / 线点同步隐藏，TOOLTIP-10） */
  const hide = () => root.classed('is-visible', false);

  return { show, place, hide };
}
