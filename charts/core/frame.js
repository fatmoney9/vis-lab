import { select } from 'd3';
import { tokenNum } from './tokens.js';

/*
 * 纵向几何：行高、上下留白、绘图区高度。**只依赖容器高与标题 / 缩放带，与刻度值无关**——
 * 刻度只影响 Y 标签的列宽（左右方向）。故它可以在算刻度**之前**先问出来，
 * 这正是 SCALE-03 动态占比上限所需的输入：上限 = 1 − 标签高 ÷ 绘图区高。
 * createFrame 内部也调本函数，公式只此一份、不会两处漂移。
 * [DATAZOOM-01] 缩放轴带：显式高度时从绘图区扣除 navH；缺省高度时加在图表包络之下。
 */
export function verticalGeometry(host, opts = {}) {
  const {
    height, yForm = 'inside', xBand = true, navH = 0,
    titleTopH = 0, titleBottomH = 0, minGridHeight = 48,
  } = opts;
  const lineH = tokenNum(host, '--line-height-axis') || 14;
  const halfLabel = Math.ceil(lineH / 2);
  const xBandTopGap = tokenNum(host, '--spacing-axis-x-band-top');
  const xBandBottomGap = tokenNum(host, '--spacing-axis-x-band-bottom');

  const topPad = titleTopH + (yForm === 'outside' ? halfLabel : 0);
  /* outside 的底部 Y 标签以末条网格线为垂直中心，会向下溢出 halfLabel；
     因此 X 标签位置 = 网格线 + halfLabel + 规范净距。 */
  const xGapTop = (yForm === 'outside' ? halfLabel : 0) + xBandTopGap;
  /* [AXISTITLE-02] X 标题带接在 X 标签带下沿之后 */
  const bottomPad = (xBand
    ? xGapTop + lineH + xBandBottomGap
    : yForm === 'outside' ? halfLabel : 0) + titleBottomH;

  const regionH = tokenNum(host, '--size-chart-region-height') || 160;
  const gridH = height != null
    ? Math.max(minGridHeight, height - topPad - bottomPad - navH)
    : Math.max(minGridHeight, regionH - (yForm === 'outside' ? 2 * halfLabel : 0));

  return { lineH, halfLabel, topPad, xGapTop, bottomPad, gridH };
}

/*
 * 画布骨架：SVG + 绘制区几何。
 * [AXIS-01] yForm 决定四周留白：
 *   inside—— 标签在网格内部，网格左右铺满画布，不占外部宽度
 *        （数据让位由调用方用 yLabelInset 收缩数据范围）；顶部不留白——
 *        图例与 grid 的间距归图例容器 padding（--spacing-legend-container-v-bottom），frame 不重复垫
 *   outside—— 仅有标签一侧预留 yLabelWidth + 8px 标签列，**无标签侧网格贴边**；
 *        顶/底标签与网格线居中对齐会超出绘制区约半个行高，顶部留白与 X 标签带上间距相应加大
 * [AXIS-04] X 轴标签自成容器带：带高 = 行高 + 上下间距（xBand=false 时不预留）
 * [AXISTITLE-02] 轴标题各自成带：Y 标题带在 Y 标签带之上、X 标题带在 X 标签带之下
 *   （缩放轴带恒在最下）。带高由调用方用 axisTitleBand() 算好传入，缺省 0 = 无标题、几何不变。
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
    /* [AXISTITLE-02] 轴标题带高（= 4 + 行高 + 4，由 axisTitleBand() 算）与带内上间距；
       默认 0 = 无标题，几何与原状逐像素一致。 */
    titleTopH = 0,
    titleBottomH = 0,
    titleGap = 0,
    /* 绘制区高度下限。默认 48 是**轴图的可用性兜底**：容器太矮时网格被压塌（甚至算成负数），
       刻度与标签会叠成一团，宁可溢出容器也要保住最小可读高度。
       无轴图（饼环）应传 0 —— 它的画布边长是调用方按图元算好的（PIE-02 的 2R），
       被这个下限抬高只会在图元四周多出死空间，而那正是 PIE-09 要求恒定的那段间距的来源。 */
    minGridHeight = 48,
  } = opts;
  /* 240 是**自动取宽**时的下限：轴图靠容器宽度决定画布，容器还没布局好时会量到 0，
     兜一个最小可用宽度免得刻度/标签挤成一团。
     **显式传 width 时不设限**——那是调用方算好的画布尺寸（如饼环按 donut 容器给的方形画布，
     PIE-02/PIE-09），再往上抬会把方形撑成横条。 */
  const W = width != null ? Math.max(1, width) : Math.max(240, host.clientWidth ?? 640);
  const { lineH, halfLabel, topPad, xGapTop, bottomPad, gridH } = verticalGeometry(host, opts);

  /* [AXIS-01][AXIS-04] 绘制区几何留白经 token 下发（源码禁字面量，三主题同值、走间距阶梯别名）：
       --spacing-axis-y-label-gap    outside 的「Y 标签 ↔ 网格」净距；**标签绘制（axis.js
                                     renderYLabels）与本文件的列宽预留必须同源**，故两处都读这一个 token。
                                     它只是标签与网格的间距——网格与画布边缘之间不留白（无标签侧贴边）
       --spacing-axis-x-band-top     X 标签带上净距。inside 从底部网格线量起；outside 因底部 Y 标签
                                     以末条网格线为垂直中心、向下溢出半行高，故另加 halfLabel——
                                     **那是几何修正，不是第二个规范值**，所以两种布局共用一个 token
       --spacing-axis-x-band-bottom  X 标签底 → 标签带下沿
     注意 tokenNum 取不到时返回 0（不是 NaN），token 名写错会让间距静默归零而非报错；
     名字拼写由 tokens/*.json 的三主题合同校验兜住源侧，代码侧只能靠这行注释和预览目检。 */
  const yLabelGap = tokenNum(host, '--spacing-axis-y-label-gap');

  /* [AXIS-01] outside 的顶部留白**恰为 halfLabel**：顶部 Y 标签以首条网格线为垂直中心、
     上溢半行高，留够这半行即可，不再多垫。
     2026-08-17 前这里是 `halfLabel + 2`，那 2px 自初始提交起无出处、规范无对应条目。
     实测确认它不是防裁保险——`.dv-chart__plot > svg` 声明了 overflow:visible（见 styles.css，
     为 DATAZOOM-01 的手柄描边/投影留的），标签越过画布上沿照样完整绘制、不会被切；
     它只是纯视觉留白，经目检对比后决定去掉。**副作用：outside 布局的 SVG 总高减 2px。**
     [AXISTITLE-02] Y 标题带叠在其上（标签带自身的留白口径不变）。 */
  /* 上下留白与绘图区高度均由 verticalGeometry 算出（见上），公式只此一份。 */

  /* [AXIS-01] 左右：仅有标签一侧预留标签列，无标签侧贴边（0，不设边缘留白） */
  const pad = { left: 0, right: 0 };
  if (yForm === 'outside') {
    pad[ySide] = Math.ceil(yLabelWidth) + yLabelGap;
    if (yLabelWidthSecondary > 0) {
      pad[ySide === 'left' ? 'right' : 'left'] = Math.ceil(yLabelWidthSecondary) + yLabelGap;
    }
  }

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

  /* [DATAZOOM-01] navTop = 底部各带的下沿（= 绘图区底 + bottomPad，含 X 标题带）；navBottom = SVG 底 */
  const navTop = topPad + gridH + bottomPad;
  /* [AXISTITLE-02] 标题文字上沿（hanging 基线）：Y 标题在 SVG 顶部的标题带内、X 标题在其带内，各让出带内上间距 */
  const titleTop = titleGap;
  const xTitleTop = navTop - titleBottomH + titleGap;
  return {
    svg, host, width: W, height: H, grid, xBandTop: grid.bottom + xGapTop, lineH,
    navTop, navBottom: navTop + navH, navH, titleTop, xTitleTop,
  };
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
