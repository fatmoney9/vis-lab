import { select } from 'd3';
import { tokenNum } from './tokens.js';

/* ── 常量（待 token 化项登记在 specs/axes.md 待办）──────────────────── */
/* [AXIS-01] outside 布局：网格线与标签间距（规范定值 8px）。
   标签绘制（axis.js renderYLabels）与列宽预留（本文件）共用此常量 */
export const Y_LABEL_GAP_OUTSIDE = 8;
const EDGE_PAD = 8;                // outside 布局无标签一侧及纵向边缘的绘制区留白
const X_GAP_TOP_INSIDE = 6;        // [AXIS-04] X 标签带上间距（Y 为 inside 布局时）
const X_GAP_TOP_OUTSIDE_EXTRA = 2; // [AXIS-04] outside 上间距增量：半行高 + 此值，防 Y 底标签溢入
const X_GAP_BOTTOM = 4;            // [AXIS-04] X 标签带下间距

/*
 * 画布骨架：SVG + 绘制区几何。
 * [AXIS-01] yForm 决定四周留白：
 *   inside—— 标签在网格内部，网格左右铺满画布，不占外部宽度
 *        （数据让位由调用方用 yLabelInset 收缩数据范围）
 *   outside—— ySide 一侧预留 yLabelWidth + 8px 标签列；顶/底标签
 *        与网格线居中对齐会超出绘制区约半个行高，顶部留白与 X 标签带上间距相应加大
 * [AXIS-04] X 轴标签自成容器带：带高 = 行高 + 上下间距（xBand=false 时不预留）
 * [GRID-03] 传入 height 时绘制区高度随容器（宽高自适应）；缺省用
 *           token --size-chart-region-height 的固定值
 */
export function createFrame(host, opts = {}) {
  const {
    width, height,
    yForm = 'inside', ySide = 'left',
    yLabelWidth = 0,
    /* [AXIS-02] 双 Y：副轴（主轴反侧）的标签列宽，outside 布局时预留 */
    yLabelWidthSecondary = 0,
    xBand = true,
  } = opts;
  const W = Math.max(240, width ?? host.clientWidth ?? 640);
  const lineH = tokenNum(host, '--line-height-axis') || 14;
  const halfLabel = Math.ceil(lineH / 2);

  const topPad = yForm === 'outside' ? halfLabel + 2 : EDGE_PAD;
  const xGapTop = yForm === 'outside' ? halfLabel + X_GAP_TOP_OUTSIDE_EXTRA : X_GAP_TOP_INSIDE;
  const bottomPad = xBand
    ? xGapTop + lineH + X_GAP_BOTTOM
    : yForm === 'outside' ? halfLabel + 2 : EDGE_PAD;

  const pad = yForm === 'inside'
    ? { left: 0, right: 0 }
    : { left: EDGE_PAD, right: EDGE_PAD };
  if (yForm === 'outside') {
    pad[ySide] = Math.ceil(yLabelWidth) + Y_LABEL_GAP_OUTSIDE;
    if (yLabelWidthSecondary > 0) {
      pad[ySide === 'left' ? 'right' : 'left'] = Math.ceil(yLabelWidthSecondary) + Y_LABEL_GAP_OUTSIDE;
    }
  }

  const gridH = height != null
    ? Math.max(48, height - topPad - bottomPad)
    : tokenNum(host, '--size-chart-region-height') || 160;
  const H = topPad + gridH + bottomPad;

  const svg = select(host).append('svg').attr('width', W).attr('height', H).attr('role', 'img');

  const grid = {
    left: pad.left,
    right: W - pad.right,
    top: topPad,
    bottom: topPad + gridH,
    width: W - pad.left - pad.right,
    height: gridH,
  };

  return { svg, host, width: W, height: H, grid, xBandTop: grid.bottom + xGapTop, lineH };
}

/* [GRID-03] 容器尺寸自适应：宽/高变化（rAF 合帧）后回调重建 */
export function observeResize(host, cb) {
  let raf = 0;
  let last = { w: host.clientWidth, h: host.clientHeight };
  const ro = new ResizeObserver(() => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === last.w && h === last.h) return;
    last = { w, h };
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(cb);
  });
  ro.observe(host);
  return () => ro.disconnect();
}
