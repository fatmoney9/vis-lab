import { area } from 'd3';
import { tokenNum } from './tokens.js';

/*
 * L1 · 缩放轴（datazoom）。权威规范见 specs/datazoom.md（DATAZOOM-01..07）。
 *
 * 干什么：在绘图区下方的缩放带里画「轨道 + 数据迷你阴影 + 选区填充 + 两手柄 + 提示文本」，
 * 并把拖手柄 / 拖选区 / 点击轨道跳转接成对**类目窗口**的增删，经 onChange 回调驱动 L2 重绘。
 *
 * 主题无关：形态（手柄 rect/circle、对齐 center/edge、是否画数据阴影、是否显示标签）由 L2 从 behavior
 * 解析后传入，颜色只经 class 走 CSS 变量（DATAZOOM-04：A 背景 / B 未选中数据 / C 选区填充 / D 选中数据）。
 * 手柄按 behavior.datazoom-handle 参数**代码现画**（DATAZOOM-03，非 SVG 图片资源）。
 *
 *   g       缩放带的 <g>（挂在 frame.svg 下，L2 每次 build 重建）
 *   frame   createFrame 结果（用 grid.left/right + navTop/navH 定位；见 DATAZOOM-01）
 *   opts:
 *     categories  全量类目（长度 N）
 *     shadow      每类目非负幅值数组（迷你阴影包络，L2 按可见系列/堆叠算好；showShadow=false 时可省）
 *     win         { i0, i1 } 当前类目窗口（整数闭区间，0..N-1）
 *     platform    'pc' | 'mobile'（DATAZOOM-05：移动端一律不显示提示文本）
 *     align       'center' | 'edge'（DATAZOOM-02）
 *     handle      { shape:'rect'|'circle', w, h, r?, grip:'line'|'dots' }（DATAZOOM-03）
 *     sliderH     轨道高度 px（--size-slider-height）
 *     showShadow  是否画数据阴影（DATAZOOM-04，Ainvest false）
 *     showLabel   是否显示手柄两侧提示文本（DATAZOOM-05，仅 iFinD；移动端再关一层）
 *     onChange    (win) => void：窗口（吸附到类目）变化时回调，L2 据此重绘
 */

let clipSeq = 0; // 选中阴影裁剪 def 的唯一 id（每次重建递增）

export function renderDataZoom(g, frame, opts) {
  const {
    categories, shadow = null, win, platform = 'pc',
    align = 'center', handle, sliderH, showShadow = true, showLabel = false, onChange,
  } = opts;
  const N = categories.length;
  if (N < 2 || frame.navH <= 0) return; /* 单类目无可缩放；无缩放带不画 */

  const host = frame.host;
  const { left, right } = frame.grid;
  const maskR = tokenNum(host, '--radius-slider-mask') || 4;
  const cy = frame.navTop + frame.navH / 2;      /* 缩放带垂直中线（带高对称留白，见 index.js navH 计算） */
  const trackTop = cy - sliderH / 2;
  const trackBottom = cy + sliderH / 2;

  /* 手柄尺寸（形态来自 behavior，DATAZOOM-03） */
  const hw = handle.w;
  const hh = handle.shape === 'circle' ? handle.w : handle.h;
  const hr = handle.r ?? (tokenNum(host, '--radius-slider-handle') || 6);

  /* [DATAZOOM-01/02] 轨道有效宽：center 对齐（THS/iFinD）左右各内缩半个手柄 → 轨道宽 = grid宽 − 手柄宽，
     手柄中心贴窗口边界时整只落在轨道内、不溢出；edge 对齐（Ainvest）用满宽，手柄内缘贴边界。 */
  const pad = align === 'edge' ? 0 : hw / 2;
  const tLeft = left + pad;
  const tW = (right - left) - 2 * pad;
  const step = tW / N;

  const clampI = (v) => Math.max(0, Math.min(N - 1, v));
  const i0 = clampI(win.i0);
  const i1 = Math.max(i0, clampI(win.i1));
  const xAt = (idx) => tLeft + idx * step;        /* 类目左沿像素（轨道内缩坐标系） */
  const xL = xAt(i0);                             /* 选区左沿 = 类目 i0 左边界 */
  const xR = xAt(i1 + 1);                         /* 选区右沿 = 类目 i1 右边界 */

  /* ── 透明热区（DATAZOOM-06 点击轨道跳转）：铺最底，收未被选区/手柄覆盖处的 pointer ── */
  g.append('rect').attr('data-dz', 'bg')
    .attr('x', tLeft).attr('y', trackTop).attr('width', tW).attr('height', sliderH)
    .style('fill', 'transparent').style('cursor', 'pointer');

  /* ── A 背景轨道（DATAZOOM-04·A）：铺满轨道有效宽 × 轨道高（纯视觉，pointer-events 由 CSS 关） ── */
  g.append('rect').attr('class', 'dv-datazoom-bg')
    .attr('x', tLeft).attr('y', trackTop).attr('width', tW).attr('height', sliderH)
    .attr('rx', maskR).attr('ry', maskR);

  /* ── B/D 数据阴影（DATAZOOM-04）：整条 = 未选中色，窗口内叠一层选中色 ──
     趋势整体裁进**圆角轨道**内（外层 group clip 圆角轨道形），D 再叠一层窗口矩形 clip
     → 数据趋势不溢出 mask 圆角（避免直角在圆角外露头）。 */
  if (showShadow && shadow) {
    const vmax = Math.max(1, ...shadow.map((v) => Math.abs(v || 0)));
    const sy = (v) => trackBottom - (Math.abs(v || 0) / vmax) * sliderH;
    const cxOf = (i) => tLeft + (i + 0.5) * step;
    /* 首尾锚到轨道两端，填满整条有效宽 */
    const pts = [
      { x: tLeft, y: sy(shadow[0]) },
      ...shadow.map((v, i) => ({ x: cxOf(i), y: sy(v) })),
      { x: tLeft + tW, y: sy(shadow[N - 1]) },
    ];
    const d = area().x((p) => p.x).y0(trackBottom).y1((p) => p.y)(pts);

    const defs = g.append('defs');
    const trackClip = `dv-dz-track-${++clipSeq}`;   /* 圆角轨道形（与 A 背景同几何） */
    defs.append('clipPath').attr('id', trackClip).append('rect')
      .attr('x', tLeft).attr('y', trackTop).attr('width', tW).attr('height', sliderH)
      .attr('rx', maskR).attr('ry', maskR);
    const winClip = `dv-dz-win-${++clipSeq}`;        /* 选中窗口矩形（D 再叠） */
    defs.append('clipPath').attr('id', winClip).append('rect')
      .attr('x', xL).attr('y', trackTop).attr('width', Math.max(0, xR - xL)).attr('height', sliderH);

    const shade = g.append('g').attr('clip-path', `url(#${trackClip})`); /* 整片阴影裁进圆角轨道 */
    shade.append('path').attr('class', 'dv-datazoom-data').attr('d', d); /* B 未选中数据 */
    shade.append('path').attr('class', 'dv-datazoom-data-select')        /* D 选中数据（∩ 窗口） */
      .attr('clip-path', `url(#${winClip})`).attr('d', d);
  }

  /* ── C 选区填充（DATAZOOM-04·C）── */
  g.append('rect').attr('class', 'dv-datazoom-filler').attr('data-dz', 'filler')
    .attr('x', xL).attr('y', trackTop).attr('width', Math.max(0, xR - xL)).attr('height', sliderH)
    .attr('rx', maskR).attr('ry', maskR).style('cursor', 'grab');

  /* ── 两手柄（DATAZOOM-02/03）：对齐 + 形态 ── */
  /* center：手柄中心贴边界（轨道已内缩半手柄，整只落轨道内）；edge：手柄内缘贴边界、整只落窗口内侧 */
  const handleX = (boundaryX, isLeft) => {
    if (align === 'edge') return isLeft ? boundaryX : boundaryX - hw;
    return boundaryX - hw / 2;
  };
  const clampX = (x) => Math.max(left, Math.min(right - hw, x));
  const drawHandle = (boundaryX, isLeft, role) => {
    const hx = clampX(handleX(boundaryX, isLeft));
    const hcx = hx + hw / 2;
    const hg = g.append('g').attr('data-dz', role).style('cursor', 'col-resize');
    if (handle.shape === 'circle') {
      hg.append('circle').attr('class', 'dv-datazoom-handle')
        .attr('cx', hcx).attr('cy', cy).attr('r', hw / 2);
    } else {
      hg.append('rect').attr('class', 'dv-datazoom-handle')
        .attr('x', hx).attr('y', cy - hh / 2).attr('width', hw).attr('height', hh)
        .attr('rx', hr).attr('ry', hr);
    }
    /* grip：n 根等距竖条，中心间距 gap、高 h（粗细 1.5 与色走 .dv-datazoom-grip）（DATAZOOM-03） */
    const { n: gn, h: gH, gap: gGap } = handle.grip;
    const gStart = -((gn - 1) / 2) * gGap;
    for (let k = 0; k < gn; k++) {
      const gx = hcx + gStart + k * gGap;
      hg.append('line').attr('class', 'dv-datazoom-grip')
        .attr('x1', gx).attr('y1', cy - gH / 2).attr('x2', gx).attr('y2', cy + gH / 2);
    }
  };
  drawHandle(xL, true, 'left');
  drawHandle(xR, false, 'right');

  /* ── 提示文本（DATAZOOM-05）：仅 showLabel 主题（iFinD）且非移动端渲染；默认隐藏，hover 缩放轴或拖动时显示（CSS）。
     与手柄**固定 8px 间距**（不夹取——贴边时靠 SVG overflow:visible 溢出渲染，间距恒定不塌陷）。 ── */
  if (showLabel && platform !== 'mobile') {
    const GAP = 8;
    const leftHx = clampX(handleX(xL, true));
    const rightHx = clampX(handleX(xR, false));
    g.append('text').attr('class', 'dv-datazoom-label')
      .attr('x', leftHx - GAP).attr('y', cy)
      .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
      .text(categories[i0]);
    g.append('text').attr('class', 'dv-datazoom-label')
      .attr('x', rightHx + hw + GAP).attr('y', cy)
      .attr('text-anchor', 'start').attr('dominant-baseline', 'central')
      .text(categories[i1]);
  }

  /* ── 交互（DATAZOOM-06）：拖手柄改边界 / 拖选区平移 / 点击轨道跳转 ──
     像素→类目用**持久锚点** plotHost 矩形 + 本次几何：onChange 触发 L2 全量重绘（本 g 被销毁），
     但拖拽的 window 级监听存活于 window、引用拖拽起始几何；仅当吸附后的窗口整数变化才回调（省重绘、免抖动）。 */
  if (typeof onChange === 'function') {
    const idxAt = (clientX) => {
      const box = host.getBoundingClientRect();
      return clampI(Math.floor((clientX - box.left - tLeft) / step));
    };
    const spanW = i1 - i0; /* 窗口宽度（类目数-1），平移时保持 */

    g.selectAll('[data-dz]').on('pointerdown', function (event) {
      event.preventDefault();
      host.classList.add('dz-dragging'); /* [DATAZOOM-05] 拖动期间保持标签可见（挂持久的 plotHost，跨重绘存活） */
      const role = this.getAttribute('data-dz');
      const startIdx = idxAt(event.clientX);
      const startWin = { i0, i1 };
      let last = { i0, i1 };
      const emit = (w) => {
        if (w.i0 === last.i0 && w.i1 === last.i1) return;
        last = w;
        onChange(w);
      };
      /* 点击轨道背景：先把窗口整体跳到点击处（保持宽度），随后可继续拖动平移 */
      let panBase = startWin;
      let panAnchor = startIdx;
      if (role === 'bg') {
        const n0 = Math.max(0, Math.min(N - 1 - spanW, startIdx - Math.round(spanW / 2)));
        panBase = { i0: n0, i1: n0 + spanW };
        panAnchor = startIdx;
        emit(panBase);
      }
      const onMove = (e) => {
        const idx = idxAt(e.clientX);
        if (role === 'left') {
          emit({ i0: Math.min(idx, startWin.i1), i1: startWin.i1 });
        } else if (role === 'right') {
          emit({ i0: startWin.i0, i1: Math.max(idx, startWin.i0) });
        } else { /* filler 或 bg：整窗平移，保持宽度 */
          const base = role === 'bg' ? panBase : startWin;
          const anchor = role === 'bg' ? panAnchor : startIdx;
          const w = base.i1 - base.i0;
          const n0 = Math.max(0, Math.min(N - 1 - w, base.i0 + (idx - anchor)));
          emit({ i0: n0, i1: n0 + w });
        }
      };
      const onUp = () => {
        host.classList.remove('dz-dragging'); /* 拖动结束：撤回标签常显（仍 hover 则由 :hover 接管） */
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onUp, true);
      };
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
    });
  }
}
