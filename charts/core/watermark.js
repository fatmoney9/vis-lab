/*
 * L1 · 水印（品牌 logo）。
 * 与 datazoom 手柄不同：水印是含多条 <path> 字形的**真实 logo**，无法用代码 rect+text 还原，
 * 故直接加载 SVG 资源（内联为 data URI，见 charts/core/watermark-assets.js 与 specs/watermark.md WATERMARK-01）。
 * 颜色/透明度烘焙在 SVG 内、light/dark 各一份（WATERMARK-04），本模块不含任何色值——不走 token 链路。
 * 锚定 frame.grid 绘图区角落、偏移相对 grid 物理边（WATERMARK-02/03）；层级/命中由 L2 追加位置 + CSS 决定（WATERMARK-05）。
 */
import { WATERMARKS } from './watermark-assets.js';

/*
 * [WATERMARK-02] 纯几何：由锚角 + grid 边 + 固有尺寸 + 偏移算左上角像素 {x, y}。
 *   anchor = `${top|bottom}-${left|right}`；offset 各方向可缺省 0，含义 = 距对应 grid 物理边的净距。
 *   left/top 锚：从 grid 内推 offset；right/bottom 锚：从 grid 边内退 offset + 尺寸，使该边贴齐。
 */
export function watermarkAnchor(anchor, grid, size, offset = {}) {
  const { w, h } = size;
  const x = anchor.includes('left')
    ? grid.left + (offset.left ?? 0)
    : grid.right - (offset.right ?? 0) - w;
  const y = anchor.includes('top')
    ? grid.top + (offset.top ?? 0)
    : grid.bottom - (offset.bottom ?? 0) - h;
  return { x, y };
}

/*
 * 把水印画进传入的 <g>。spec = behavior.json 的 watermark 对象 {asset, anchor, offset}；
 * mode = 'light' | 'dark'（由 L2 从 data-mode 取，见 theme.js modeOf）。资源缺失则静默跳过。
 */
export function renderWatermark(g, frame, { spec, mode = 'light' }) {
  const asset = WATERMARKS[spec.asset];
  if (!asset) return;
  const href = asset[mode] ?? asset.light;
  const { x, y } = watermarkAnchor(spec.anchor, frame.grid, asset, spec.offset);
  g.append('image')
    .attr('class', 'dv-watermark')
    .attr('href', href)
    .attr('x', x)
    .attr('y', y)
    .attr('width', asset.w)
    .attr('height', asset.h);
}
