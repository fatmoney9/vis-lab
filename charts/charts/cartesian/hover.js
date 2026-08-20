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
 * [TOOLTIP-12] Y 横线 + Y 值徽标：默认关（yAxes 为空），开启后随指针高度走、与 X 向各构件同一 timer 收口。
 *   series —— resolved 系列（声明序）；hidden —— 已隐藏系列名集合（行 = 可见系列按声明序，TOOLTIP-02）
 */
import { select } from 'd3';
import { tokenNum } from '../../core/tokens.js';
import { createTooltip } from '../../core/tooltip.js';
import { renderCrosshairX, renderCrosshairY, renderCrosshairBlock, renderAxisTag, renderYAxisTags } from '../../core/crosshair.js';

export function bindHover(plotHost, frame, { categories, x, series, hidden, format, marker, position,
  indicator = 'line', blockLayer = null, blockWidth = 0,
  /* [TOOLTIP-12] Y 横线 + Y 值徽标：yAxes 为空 = 该能力关闭（默认），故不开时零开销、几何一步不动。
     每项 { side, y, format }——y 是该轴的比例尺，本层只调 invert 把像素翻译成值。 */
  yAxes = [], yForm = 'inside', yAlign = 'auto' }) {
  const tooltip = createTooltip(plotHost);
  const hoverG = frame.svg.append('g').style('display', 'none'); /* 指示线 + 贴片层，画在 mark 之上 */
  const crossLayer = hoverG.append('g');
  /* [TOOLTIP-12] Y 横线 + 徽标自成一组：它比其余 hover 件多一条显隐条件（指针须在 grid 纵向范围内），
     整组一起开合，免得给每个构件各写一次判断 */
  const yLayer = hoverG.append('g');
  const yCrossLayer = yLayer.append('g');
  const yTagLayer = yLayer.append('g');
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
  /* [TOOLTIP-12] 显示精度对齐**指针能分辨的精度**，不是浮点算出来多少写多少。
     裸插值形如 299354.84——那个 .84 是假精度：iFinD 这张图 1px ≈ 1300 元，
     指针根本分辨不到 1 分钱，写出来只是噪声，还会让人误以为读数很准。
     故先按「1px 值跨度的十的幂」取整再交给 format。自适应：值域小的图（如增长率 12~21，
     1px ≈ 0.05）step 落到 0.01，两位小数照样留得住。
     cn / en 体系（万 / K）因为先除以 1e4 / 1e3，噪声本来就不显眼；**plain 体系（iFinD）
     不处理就会满屏小数**——所以这一步不能只在某个体系里做。 */
  const snapToPointer = (scale, py) => {
    const v = scale.invert(py);
    const perPx = Math.abs(scale.invert(1) - scale.invert(0));
    if (!(perPx > 0)) return v;
    const step = 10 ** Math.floor(Math.log10(perPx));
    return Math.round(v / step) * step;
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
    /* [DATAZOOM-01] 缩放带在绘图区之下：指针落到缩放带内不触发绘图区 tooltip/指示线（无缩放轴时 navTop=svg 底，恒不触发） */
    if (frame.navH > 0 && py > frame.navTop) return hideHover();
    const i = centers.reduce((best, c, k) => (Math.abs(c - px) < Math.abs(centers[best] - px) ? k : best), 0);

    /* [TOOLTIP-02] 行 = 可见系列按声明序（与图例一致）；数值与 Y 轴同源 format（percent 显原值）、null → "-" */
    const rows = series.filter((r) => !hidden.has(r.name)).map((r) => ({
      key: r.name, label: r.name, type: r.type, colorVar: r.colorVar,
      value: r.data[i] == null ? '-' : format(r.data[i]),
    }));
    if (!rows.length) return hideHover();

    tooltip.show({ title: categories[i], rows }, marker);
    /* clamp 边界由 tooltip.js 按位置档自取（follow = 图表根 / top-anchor = 视口 / side-fixed = grid），
       本层只给几何：grid 与触发点。 */
    tooltip.place(position, { grid: frame.grid, cx: centers[i], pointer: { x: px, y: py } });
    hoverG.style('display', null);
    const tagTop = renderAxisTag(tagLayer, frame, { x: centers[i], label: categories[i] }); /* [TOOLTIP-09] */
    if (indicator === 'block') {
      blockLayer.style('display', null);
      renderCrosshairBlock(blockLayer, frame, centers[i], blockWidth); /* [TOOLTIP-11] 纯分组柱：竖线换 block */
    } else {
      renderCrosshairX(crossLayer, frame, centers[i], tagTop); /* [TOOLTIP-08] 竖线连到贴片上沿 */
    }
    setActivePoints(i);

    /* [TOOLTIP-12] Y 横线 + Y 值徽标。**值是指针高度的插值、不是数据读数**——
       气泡回答「这个类目各系列是多少」，本徽标回答「指针停在这个高度相当于多少」，
       用来目测一个点大概落在什么量级，故走 y.invert(py) 而非取 series 里的值。
       纵向出界即整组不画：grid 之外没有对应的值，硬画会显示超出值域的数字。 */
    if (yAxes.length && py >= frame.grid.top && py <= frame.grid.bottom) {
      yLayer.style('display', null);
      const items = yAxes.map((ax) => ({ y: py, side: ax.side, label: ax.format(snapToPointer(ax.y, py)) }));
      renderCrosshairY(yCrossLayer, frame, py,
        renderYAxisTags(yTagLayer, frame, items, { form: yForm, align: yAlign }));
    } else {
      yLayer.style('display', 'none');
    }
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
