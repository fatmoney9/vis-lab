/*
 * L2 · ChordChart —— 弦图：外圈弧是实体，圈内的带是实体之间的流量。
 * 规范见 specs/chord.md。
 *
 *   host  容器元素（须挂在带 data-theme 的祖先内）
 *   cfg   { entities, matrix, name?, variant='undirected', entityLabelLayout='arc',
 *           platform='pc', animation=true }
 *         variant（形态语义，非样式）：'undirected' 一对一条带 / 'directed' 每向一条
 *         entityLabelLayout（形态语义）：'arc' 沿弧环绕 / 'horizontal' 径向横排
 *
 * 只接收数据与形态语义；颜色、半径、环宽、字号、透明度一律由规范数据（token / 色板）决定，
 * API 不收任何样式参数（拼接铁律 2 / 4）。
 */
import { pointer, select } from 'd3';
import { observeResize } from '../../core/frame.js';
import { makeFormatter } from '../../core/format.js';
import { truncateBatch } from '../../core/label.js';
import { createTextMeasurer, measureInk } from '../../core/measure.js';
import { easeOutCubic, reducedMotion } from '../../core/motion.js';
import { resolveSeriesColors } from '../../core/palette.js';
import { resolveBehavior, modeOf } from '../../core/theme.js';
import { createTooltip } from '../../core/tooltip.js';
import { renderWatermark } from '../../core/watermark.js';
import { tokenNum } from '../../core/tokens.js';
import { labelAnchor, labelArc } from '../../core/polar-label.js';
import { resolveChartText } from '../../core/chart-text.js';
import {
  createHighlightState, applyHover, applyLeave, applyPick, applyClear, activeTarget,
} from '../../core/highlight-state.js';
import { resolveChordSettings } from './config.js';
import { layoutChord, taperedSpan, ribbonPath } from './layout.js';
import {
  chordRelatedNeighborhood, chordEntityDashboard, chordRibbonDashboard,
  chordArcLabel, chordRibbonLabel, CHORD_TEXT,
} from './model.js';

const LABEL_CLASS = 'dv-chord__label';

/* <textPath> 要按 id 引用路径，同页多张图必须各用各的。用实例序号而非随机数：
   随机数会让同一份数据两次渲染出不同的 DOM，SVG 逐字对比那类回归手段就用不了了。 */
let instanceSeq = 0;

export function ChordChart(host, initialConfig) {
  let config = initialConfig;
  let resizeFrame = 0;
  let motionFrame = 0;
  let destroyed = false;
  let highlight = createHighlightState();
  const uid = `dv-chord-${instanceSeq += 1}`;

  host.replaceChildren();
  const root = select(host).append('div').attr('class', 'dv-chart dv-chord');
  const svg = root.append('svg')
    .attr('class', 'dv-chord__svg')
    .attr('role', 'img');
  const tooltip = createTooltip(root.node());
  let tooltipHideTimer = 0;

  const clearTooltipHide = () => {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = 0;
  };
  const hideTooltip = () => {
    clearTooltipHide();
    tooltip.hide();
  };

  function build() {
    if (destroyed) return;
    const rect = host.getBoundingClientRect();
    if (rect.width < 1) {
      resizeFrame = requestAnimationFrame(build);
      return;
    }

    const platform = config.platform ?? 'pc';
    const style = resolveChordSettings(platform);
    const behavior = resolveBehavior(host, platform);
    const format = makeFormatter(behavior['number-format']);
    /* [CHARTTEXT-01/02] 固定文案：不给走缺省表，给了必须整套——语言由 L3 决定，本层不判断 */
    const chartText = resolveChartText(CHORD_TEXT, config.text, 'ChordChart');
    svg.attr('aria-label', chartText.chartLabel);
    const marker = behavior['legend-marker'];
    const wm = behavior.watermark;
    const configuredHideDelay = tokenNum(host, '--tooltip-hide-delay');
    const tooltipHideDelay = Number.isFinite(configuredHideDelay) ? configuredHideDelay : 2000;

    const maxRadius = tokenNum(host, '--size-chord-radius') || 80;
    const ring = tokenNum(host, '--size-chord-ring') || 10;
    const labelGap = tokenNum(host, '--size-chord-label-gap') || 4;
    const maxBand = tokenNum(host, '--size-chord-label-band') || Infinity;
    const fontSize = tokenNum(host, '--font-size-chord-label') || 12;

    const entityLabelLayout = config.entityLabelLayout ?? 'arc';
    const entityNames = Array.isArray(config.entities) ? config.entities : [];

    /* [CHORD-11] arc 档的标签带只由**文字墨迹**决定，与 R 无关，故一次量完即可定带宽，
       不需要桑基那样的两遍布局。horizontal 档的带宽在 chordFrame 里吃剩余空间。 */
    const inkBand = entityLabelLayout === 'arc' && entityNames.length
      ? labelGap + Math.max(
        0,
        ...measureInk(svg.node(), entityNames, LABEL_CLASS).map((m) => m.ascent),
      )
      : labelGap + fontSize;

    /* [CHORD-10] 容器没给高时退到本族 token，不占用三族共用的 --size-chart-region-height */
    const fallbackSize = tokenNum(host, '--size-chord-container') || 200;
    const graph = layoutChord(config, {
      width: rect.width,
      height: rect.height >= 1 ? rect.height : fallbackSize,
      inkBand,
    }, { ...style, maxRadius, ring, maxBand });

    /* [CHORD-09] 实体色走扇区盘：外圈实体与饼扇区是同一种东西（同一总量的并列组成部分）。
       写成 --dv-series-N 由 CSS 消费，组件不持有色值。 */
    resolveSeriesColors(host, { series: graph.entities.map(() => ({ type: 'pie' })) })
      .forEach((hex, i) => root.style(`--dv-series-${i + 1}`, hex));

    const colorVar = (i) => `var(--dv-series-${i + 1})`;
    const cx = graph.width / 2;
    const cy = graph.height / 2;

    root.style('min-height', `${Math.max(graph.height, graph.minSize)}px`);
    svg
      .attr('viewBox', `0 0 ${graph.width} ${graph.height}`)
      .attr('width', graph.width)
      .attr('height', graph.height);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    const stage = svg.append('g').attr('transform', `translate(${cx},${cy})`);
    /* 弦在下、外圈在上、标签最上：弦必须被外圈压住，否则半透明的带会爬到实体色上 */
    const ribbonLayer = stage.append('g').attr('class', 'dv-chord__ribbons');
    const arcLayer = stage.append('g').attr('class', 'dv-chord__arcs');
    const labelLayer = stage.append('g').attr('class', 'dv-chord__labels');
    const labelHitLayer = stage.append('g').attr('class', 'dv-chord__label-hits');

    /* ── 弦 ─────────────────────────────────────────────────── */
    /*
     * [CHORD-08] 一条弦连的是两个**平权**的实体，故两端各自带着自己的色、沿弦渐变——
     * 单色带只能表达其中一端，另一端的身份就丢了。
     * ⚠️ 这里与桑基**有意不同**：SANKEY-08 明令「边使用目标节点颜色、禁止颜色渐变」，
     * 那是因为它的边连接的是收入/支出/利润三种**业务角色**，颜色本身就是角色标识，
     * 渐变会让角色读不清。弦图的实体之间没有这种主从关系，别照桑基「修正」回单色。
     *
     * 渐变色由 stop-color 读 --dv-series-N，故色值仍不进源码（同其余取色路径）。
     * id 用实例序号 + 弦序号：弦的 key 里有 '->'，直接拿去做 url(#…) 会引用不到。
     */
    const gradients = defs.selectAll('linearGradient')
      .data(graph.ribbons, (r) => r.key)
      .join('linearGradient')
      .attr('id', (r, i) => `${uid}-rib-${i}`)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', (r) => r.gradient.x1)
      .attr('y1', (r) => r.gradient.y1)
      .attr('x2', (r) => r.gradient.x2)
      .attr('y2', (r) => r.gradient.y2);
    gradients.append('stop').attr('offset', '0%')
      .attr('stop-color', (r) => colorVar(r.i));
    gradients.append('stop').attr('offset', '100%')
      .attr('stop-color', (r) => colorVar(r.j));

    const ribbonGroups = ribbonLayer.selectAll('g')
      .data(graph.ribbons, (r) => r.key)
      .join('g')
      .attr('class', 'dv-chord__ribbon')
      .attr('tabindex', 0)
      .attr('role', 'graphics-symbol')
      .attr('aria-label', (r) => chordRibbonLabel(r, graph, format, chartText))
      /* 填充走渐变；描边只是撑命中区（stroke-opacity: 0），取源端色即可 */
      .style('--dv-chord-ribbon-fill', (r, i) => `url(#${uid}-rib-${i})`)
      .style('--dv-chord-color', (r) => colorVar(r.i));
    const ribbonPaths = ribbonGroups.append('path')
      .attr('class', 'dv-chord__ribbon-band')
      .attr('d', (r) => r.path);

    /* ── 外圈环带 ───────────────────────────────────────────── */
    const arcGroups = arcLayer.selectAll('g')
      .data(graph.groups, (g) => g.index)
      .join('g')
      .attr('class', 'dv-chord__arc')
      .attr('tabindex', 0)
      .attr('role', 'graphics-symbol')
      .attr('aria-label', (g) => chordArcLabel(g, format, chartText))
      .style('--dv-chord-color', (g) => colorVar(g.index));
    arcGroups.append('path')
      .attr('class', 'dv-chord__arc-band')
      .attr('d', (g) => g.path);

    /* ── 实体标签（CHORD-11）─────────────────────────────────── */
    const measurer = createTextMeasurer(svg.node(), LABEL_CLASS);
    try {
      if (entityLabelLayout === 'arc') {
        const inks = measureInk(svg.node(), graph.groups.map((g) => g.name), LABEL_CLASS);
        /* ⚠️ 预算取「这个标签自己那条弧」的长度：下半圆的弧按墨迹 ascent 外移、半径大一圈、
           弧就长一截。统一按 R + gap 估一个数会把下半圆的标签白白截短（同 RADAR-14）。 */
        const arcFor = (g, i) => labelArc(
          (g.a0 + g.a1) / 2, graph.rOuter, labelGap, g.a1 - g.a0, inks[i]?.ascent ?? 0,
        );
        const fitted = truncateBatch(
          graph.groups.map((g, i) => ({ text: g.name, maxWidth: arcFor(g, i).length })),
          (values) => values.map((v) => measurer.measure(v, fontSize)),
        );
        graph.groups.forEach((g, i) => {
          const arc = arcFor(g, i);
          defs.append('path').attr('id', `${uid}-label-${i}`).attr('d', arc.d);
        });
        labelLayer.selectAll('text')
          .data(graph.groups, (g) => g.index)
          .join('text')
          .attr('class', LABEL_CLASS)
          .append('textPath')
          .attr('href', (g, i) => `#${uid}-label-${i}`)
          .attr('startOffset', '50%')
          .attr('text-anchor', 'middle')
          .text((g, i) => fitted[i].text ?? '…');
      } else {
        /* horizontal 档：八向锚点径向摆出，预算是标签带宽 */
        const fitted = truncateBatch(
          graph.groups.map((g) => ({ text: g.name, maxWidth: graph.band })),
          (values) => values.map((v) => measurer.measure(v, fontSize)),
        );
        labelLayer.selectAll('text')
          .data(graph.groups, (g) => g.index)
          .join('text')
          .attr('class', LABEL_CLASS)
          .each(function place(g, i) {
            const a = labelAnchor((g.a0 + g.a1) / 2, graph.rOuter, labelGap);
            select(this)
              .attr('x', a.x)
              .attr('y', a.y)
              .attr('text-anchor', a.textAnchor)
              .attr('dominant-baseline', a.baseline)
              .text(fitted[i].text ?? '…');
          });
      }
    } finally {
      measurer.destroy();
    }
    const labels = labelLayer.selectAll('text');

    /* 一个字都放不下时给「…」而不是空串（同桑基）：实体的身份不能悄悄消失，
       省略号至少告诉读者「这里有个名字，但容器装不下」。 */
    /* SVG 文字的命中在各浏览器不稳定，用透明矩形覆盖（同桑基的做法） */
    const labelHits = labelHitLayer.selectAll('rect')
      .data(graph.groups, (g) => g.index)
      .join('rect')
      .attr('class', 'dv-chord__label-hit')
      .attr('aria-hidden', 'true')
      .each(function box(g, i) {
        const node = labels.nodes()[i];
        if (!node) return;
        const b = node.getBBox();
        select(this)
          .attr('x', b.x).attr('y', b.y)
          .attr('width', b.width).attr('height', b.height);
      });

    /* ── 高亮渲染（状态迁移在 L1，本层只负责画）────────────── */
    const resetHighlight = () => {
      ribbonGroups.classed('is-active', false).classed('is-dimmed', false);
      arcGroups.classed('is-active', false).classed('is-dimmed', false);
      labels.classed('is-dimmed', false);
    };
    const paint = (related) => {
      ribbonGroups
        .classed('is-active', (r) => related.ribbons.has(r))
        .classed('is-dimmed', (r) => !related.ribbons.has(r));
      arcGroups
        .classed('is-active', (g) => related.entities.has(g.index))
        .classed('is-dimmed', (g) => !related.entities.has(g.index));
      labels.classed('is-dimmed', (g) => !related.entities.has(g.index));
    };

    const placeTooltip = (point) => {
      tooltip.place('follow', {
        grid: { left: 0, right: root.node().clientWidth, top: 0, bottom: root.node().clientHeight },
        width: root.node().clientWidth,
        height: root.node().clientHeight,
        cx: point.x,
        pointer: point,
      });
    };
    const toRootPoint = (x, y) => {
      const rootRect = root.node().getBoundingClientRect();
      const svgRect = svg.node().getBoundingClientRect();
      return {
        x: svgRect.left - rootRect.left + (x + cx) * (svgRect.width / graph.width),
        y: svgRect.top - rootRect.top + (y + cy) * (svgRect.height / graph.height),
      };
    };
    const arcAnchor = (g) => {
      const mid = (g.a0 + g.a1) / 2;
      const r = (graph.rOuter + graph.rInner) / 2;
      return toRootPoint(Math.sin(mid) * r, -Math.cos(mid) * r);
    };

    /* 返回是否有目标：没有目标时气泡立刻收还是延时收，由各入口自己决定 */
    const renderHighlight = (point) => {
      const target = activeTarget(highlight);
      if (!target) { resetHighlight(); return false; }
      const related = chordRelatedNeighborhood(target, graph.ribbons);
      paint(related);
      clearTooltipHide();
      if (target.kind === 'arc') {
        const g = graph.groups.find((item) => item.index === target.key);
        if (!g) { resetHighlight(); return false; }
        tooltip.show(chordEntityDashboard(g, graph, format, chartText), marker);
        placeTooltip(point ?? arcAnchor(g));
      } else {
        const r = graph.ribbons.find((item) => item.key === target.key);
        if (!r) { resetHighlight(); return false; }
        tooltip.show(chordRibbonDashboard(r, graph, format, chartText), marker);
        placeTooltip(point ?? arcAnchor(graph.groups[r.i]));
      }
      return true;
    };
    const scheduleTooltipHide = () => {
      clearTooltipHide();
      tooltipHideTimer = setTimeout(hideTooltip, tooltipHideDelay);
    };
    const pointAtEvent = (event) => {
      const [x, y] = pointer(event, root.node());
      return { x, y };
    };

    const bindTarget = (selection, kind, keyOf) => selection
      .on('pointerenter', (event, d) => {
        highlight = applyHover(highlight, kind, keyOf(d));
        renderHighlight(pointAtEvent(event));
      })
      .on('pointermove', (event) => {
        if (activeTarget(highlight)) placeTooltip(pointAtEvent(event));
      })
      .on('pointerleave', () => {
        highlight = applyLeave(highlight);
        if (!renderHighlight()) scheduleTooltipHide();
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        highlight = applyPick(highlight, kind, keyOf(d));
        if (!renderHighlight(pointAtEvent(event))) hideTooltip();
      })
      .on('focus', (event, d) => {
        highlight = applyHover(highlight, kind, keyOf(d));
        renderHighlight();
      })
      .on('blur', () => {
        highlight = applyLeave(highlight);
        if (!renderHighlight()) hideTooltip();
      })
      /* [CHORD-15] 键盘钉住：与指针共用同一套迁移，故行为天然一致 */
      .on('keydown', (event, d) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        highlight = applyPick(highlight, kind, keyOf(d));
        if (!renderHighlight()) hideTooltip();
      });

    bindTarget(arcGroups, 'arc', (g) => g.index);
    bindTarget(labelHits, 'arc', (g) => g.index);
    bindTarget(ribbonGroups, 'ribbon', (r) => r.key);

    svg.on('click.chord-interaction', () => {
      highlight = applyClear();
      renderHighlight();
      hideTooltip();
    });

    /* 重渲后把钉住态画回去——否则拖一下容器钉住就没了 */
    if (highlight.pinned) renderHighlight();

    /* [WATERMARK-02] 水印置顶：build 末尾追加 = DOM 顺序最上。
       锚的是整块画布——本族没有绘图区与坐标系之分，圆就占满画布（同雷达的处理）。
       挂在 svg 而不是 stage：stage 带着 translate(cx,cy)，水印要的是画布的物理角。 */
    if (wm) {
      renderWatermark(
        svg.append('g').attr('class', 'dv-watermark-layer'),
        { grid: { left: 0, top: 0, right: graph.width, bottom: graph.height } },
        { spec: wm, mode: modeOf(host) },
      );
    }

    /* ── [CHORD-16] 入场：弦顺时针依次生长，外圈与标签第 0 帧就位 ── */
    const animate = config.animation !== false && !reducedMotion(window) && graph.ribbons.length > 0;
    cancelAnimationFrame(motionFrame);
    if (!animate) return;
    const duration = style.motion['growth-duration'];
    const staggerShare = style.motion['growth-stagger-share'];
    const count = graph.ribbons.length;
    const taper = graph.variant === 'directed' ? style.geometry['directed-taper'] : 1;
    /* 出现时机由**单一进度值**派生，不给每条弦各自计时：弦数在 4–90 之间变动，
       各自计时必然漂，而这里 n 再多也只有一条时间线。 */
    const startedAt = performance.now();
    const tick = (now) => {
      if (destroyed) return;
      const p = Math.min(1, (now - startedAt) / duration);
      const eased = easeOutCubic(p);
      ribbonPaths.attr('d', function grow(r, i) {
        const head = count > 1 ? (i / (count - 1)) * staggerShare : 0;
        const local = Math.max(0, Math.min(1, (eased - head) / Math.max(1e-6, 1 - staggerShare)));
        if (local >= 1) return r.path;
        /* 生长 = 两端弧从起点按比例张开，形态与终态同源（同一个 ribbonPath） */
        return ribbonPath(
          taperedSpan(r.source, local),
          taperedSpan(r.target, local),
          graph.rInner,
          taper,
        );
      });
      if (p < 1) motionFrame = requestAnimationFrame(tick);
      else motionFrame = 0;
    };
    motionFrame = requestAnimationFrame(tick);
  }

  const stopResize = observeResize(host, build);
  build();

  return {
    update(nextConfig) {
      config = nextConfig;
      highlight = applyClear();
      build();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(motionFrame);
      clearTooltipHide();
      stopResize();
      root.remove();
    },
  };
}
