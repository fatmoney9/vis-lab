import { select } from 'd3';
import { tokenNum } from './tokens.js';

/* ── 常量（待 token 化项登记在 specs/axes.md 待办）──────────────────── */
/* [AXIS-01] outside 布局：网格线与标签间距（规范定值 8px）。
   标签绘制（axis.js renderYLabels）与列宽预留（本文件）共用此常量。
   注意：8px 只是「标签 ↔ 网格」间距，网格与画布边缘之间**不留白**（无标签侧贴边） */
export const Y_LABEL_GAP_OUTSIDE = 8;
const X_GAP_TOP_INSIDE = 4;          // [AXIS-04] inside：底部网格线 → X 标签顶部
const X_GAP_TOP_OUTSIDE_LABEL = 4;   // [AXIS-04] outside：底部 Y 标签外缘 → X 标签顶部
const X_GAP_BOTTOM = 4;              // [AXIS-04] X 标签底部 → 标签带下沿

/*
 * 画布骨架：SVG + 绘制区几何。
 * [AXIS-01] yForm 决定四周留白：
 *   inside—— 标签在网格内部，网格左右铺满画布，不占外部宽度
 *        （数据让位由调用方用 yLabelInset 收缩数据范围）；顶部不留白——
 *        图例与 grid 的间距归图例容器 padding（--spacing-legend-container-v-bottom），frame 不重复垫
 *   outside—— 仅有标签一侧预留 yLabelWidth + 8px 标签列，**无标签侧网格贴边**；
 *        顶/底标签与网格线居中对齐会超出绘制区约半个行高，顶部留白与 X 标签带上间距相应加大
 * [AXIS-04] X 轴标签自成容器带：带高 = 行高 + 上下间距（xBand=false 时不预留）
 * [GRID-03] 传入 height 时 SVG 高度随容器（宽高自适应）；缺省时
 *   --size-chart-region-height 表示 Y 方向的图表高度包络：
 *   inside = 顶/底轴线间距；outside = 顶/底 Y 标签外缘间距（轴线间距需扣两端半行高）。
 */
export function createFrame(host, opts = {}) {
  const {
    width, height,
    yForm = 'inside', ySide = 'left',
    yLabelWidth = 0,
    /* [AXIS-02] 双 Y：副轴（主轴反侧）的标签列宽，outside 布局时预留 */
    yLabelWidthSecondary = 0,
    xBand = true,
    /* [DATAZOOM-01] 缩放轴带：在 X 标签带下方额外预留的高度（含手柄溢出与上下间距）。
       默认 0 = 无缩放轴，几何与原状逐像素一致。带宽 = grid 宽（与网格/X 轴对齐，天然不含 outside 的 Y 标签列）。 */
    navH = 0,
  } = opts;
  const W = Math.max(240, width ?? host.clientWidth ?? 640);
  const lineH = tokenNum(host, '--line-height-axis') || 14;
  const halfLabel = Math.ceil(lineH / 2);

  const topPad = yForm === 'outside' ? halfLabel + 2 : 0;
  /* outside 的底部 Y 标签以末条网格线为垂直中心，会向下溢出 halfLabel；
     因此 X 标签位置 = 网格线 + halfLabel + 规范净距 4px。 */
  const xGapTop = yForm === 'outside' ? halfLabel + X_GAP_TOP_OUTSIDE_LABEL : X_GAP_TOP_INSIDE;
  const bottomPad = xBand
    ? xGapTop + lineH + X_GAP_BOTTOM
    : yForm === 'outside' ? halfLabel + 2 : 0;

  /* [AXIS-01] 左右：仅有标签一侧预留标签列，无标签侧贴边（0，不设边缘留白） */
  const pad = { left: 0, right: 0 };
  if (yForm === 'outside') {
    pad[ySide] = Math.ceil(yLabelWidth) + Y_LABEL_GAP_OUTSIDE;
    if (yLabelWidthSecondary > 0) {
      pad[ySide === 'left' ? 'right' : 'left'] = Math.ceil(yLabelWidthSecondary) + Y_LABEL_GAP_OUTSIDE;
    }
  }

  const regionH = tokenNum(host, '--size-chart-region-height') || 160;
  /* [DATAZOOM-01] 缩放轴带占容器高度：显式高度时从绘图区扣除 navH（SVG 总高仍 = 容器高）；
     缺省高度时缩放轴带加在图表包络之下（绘图区维持 region 高度不变） */
  const gridH = height != null
    ? Math.max(48, height - topPad - bottomPad - navH)
    : Math.max(48, regionH - (yForm === 'outside' ? 2 * halfLabel : 0));
  const H = topPad + gridH + bottomPad + navH;

  const svg = select(host).append('svg').attr('width', W).attr('height', H).attr('role', 'img');

  const grid = {
    left: pad.left,
    right: W - pad.right,
    top: topPad,
    bottom: topPad + gridH,
    width: W - pad.left - pad.right,
    height: gridH,
  };

  /* [DATAZOOM-01] navTop = X 标签带下沿（= 绘图区底 + bottomPad）；navBottom = SVG 底 */
  const navTop = topPad + gridH + bottomPad;
  return { svg, host, width: W, height: H, grid, xBandTop: grid.bottom + xGapTop, lineH, navTop, navBottom: navTop + navH, navH };
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
