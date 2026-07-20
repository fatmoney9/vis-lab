/*
 * cartesian/hover.js —— 【绘图区 hover 全链路：切片定位 + 气泡 + 指示线 + 贴片 + 线点唤出】 · [L2-LOCAL] 图表专属，有意不下沉 L1
 *
 * 干什么：把 L1 的 tooltip / crosshair 构件接到绘图区鼠标事件上（specs/tooltip.md）。
 * [TOOLTIP-10] 三主题一致按 X 坐标最近类目触发（横向切片，无需悬停在数据项上）、无过渡动画；
 * 移出按 tooltip-hide-delay 延迟隐藏；任意页面/祖先滚动时立即隐藏——
 * 气泡 / 指示线 / 线点同步收口，避免 fixed 气泡脱离已滚走的图表。
 * [TOOLTIP-07] 气泡档位由 behavior 的 tooltip-position 决定（follow / top-anchor / side-fixed）。
 *
 * 只做事件接线 + hover 态 DOM（指示线层 / 贴片层 / 唤出点副本层），每次 build 重建、随 svg 一起丢弃。
 * 图例 hover（弱化其它系列 applyDim）是另一条链路，留在 index.js。
 * [TOOLTIP-11] 指示形态分发：indicator='block'（纯分组柱，判定在 index）时竖线换 block 底色带——
 * 画进 index 建在 mark 之下的 blockLayer（底色），显隐与气泡/贴片同一 timer。
 *   series —— resolved 系列（声明序）；hidden —— 已隐藏系列名集合（行 = 可见系列按声明序，TOOLTIP-02）
 */
import { select } from 'd3';
import { tokenNum } from '../../core/tokens.js';
import { createTooltip } from '../../core/tooltip.js';
import { renderCrosshairX, renderCrosshairBlock, renderAxisTag } from '../../core/crosshair.js';

export function bindHover(plotHost, frame, { categories, x, series, hidden, format, marker, position,
  indicator = 'line', blockLayer = null, blockWidth = 0 }) {
  const tooltip = createTooltip(plotHost);
  const hoverG = frame.svg.append('g').style('display', 'none'); /* 指示线 + 贴片层，画在 mark 之上 */
  const crossLayer = hoverG.append('g');
  const tagLayer = hoverG.append('g');                           /* 贴片压过指示线端头 */
  const activeLayer = hoverG.append('g');                        /* 唤出点副本层：仅让 hover 数据点压过指示线，其余层级不动 */
  const centers = categories.map((c) => x(c) + x.bandwidth() / 2);
  const hideDelay = tokenNum(plotHost, '--tooltip-hide-delay');
  let hideTimer = 0;
  /* [TOOLTIP-10] 唤出当前类目可见折线点：.is-active 压过 points-muted 静默、白心填充（specs/line.md）；
     并把这些点克隆到 activeLayer——原点仍在系列层（被指示线压过），副本带系列色 /
     lines-multi 线宽上下文绘制在指示线之上（剔除 dv-line-series 类避免 applyDim 波及） */
  const setActivePoints = (i) => {
    const sel = select(plotHost).selectAll('.dv-line-point') /* 圆/菱形两种元素通吃 */
      .classed('is-active', function () { return +this.dataset.i === i; });
    activeLayer.node().textContent = '';
    if (i < 0) return;
    sel.filter(function () { return +this.dataset.i === i; }).each(function () {
      const seriesG = this.parentNode;
      const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      wrap.setAttribute('class', (seriesG.getAttribute('class') || '').replace('dv-line-series', '').trim());
      wrap.style.color = seriesG.style.color;
      wrap.appendChild(this.cloneNode(true));
      activeLayer.node().appendChild(wrap);
    });
  };
  const hideHover = () => { tooltip.hide(); hoverG.style('display', 'none'); blockLayer?.style('display', 'none'); setActivePoints(-1); };
  const hideOnScroll = () => {
    clearTimeout(hideTimer);
    hideHover();
  };
  /* [TOOLTIP-10] scroll 不冒泡，capture 才能覆盖 window、页面与 Preview 内部滚动容器。 */
  window.addEventListener('scroll', hideOnScroll, { capture: true, passive: true });

  frame.svg.on('mousemove', (event) => {
    clearTimeout(hideTimer);
    const box = frame.svg.node().getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    const i = centers.reduce((best, c, k) => (Math.abs(c - px) < Math.abs(centers[best] - px) ? k : best), 0);

    /* [TOOLTIP-02] 行 = 可见系列按声明序（与图例一致）；数值与 Y 轴同源 format（percent 显原值）、null → "-" */
    const rows = series.filter((r) => !hidden.has(r.name)).map((r) => ({
      key: r.name, label: r.name, type: r.type, colorVar: r.colorVar,
      value: r.data[i] == null ? '-' : format(r.data[i]),
    }));
    if (!rows.length) return hideHover();

    tooltip.show({ title: categories[i], rows }, marker);
    tooltip.place(position, {
      grid: frame.grid, width: frame.width, height: frame.height,
      cx: centers[i], pointer: { x: px, y: py },
    });
    hoverG.style('display', null);
    const tagTop = renderAxisTag(tagLayer, frame, { x: centers[i], label: categories[i] }); /* [TOOLTIP-09] */
    if (indicator === 'block') {
      blockLayer.style('display', null);
      renderCrosshairBlock(blockLayer, frame, centers[i], blockWidth); /* [TOOLTIP-11] 纯分组柱：竖线换 block */
    } else {
      renderCrosshairX(crossLayer, frame, centers[i], tagTop); /* [TOOLTIP-08] 竖线连到贴片上沿 */
    }
    setActivePoints(i);
  });
  frame.svg.on('mouseleave', () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideHover, hideDelay);
  });

  return () => {
    clearTimeout(hideTimer);
    window.removeEventListener('scroll', hideOnScroll, true);
    frame.svg.on('mousemove', null).on('mouseleave', null);
  };
}
