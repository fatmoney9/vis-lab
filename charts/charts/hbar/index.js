/*
 * L2 · HBarChart —— 横向条形图。权威规范见 specs/hbar.md（HBAR-01..20）。
 *
 *   host  容器元素（须挂在带 data-theme 的祖先内）
 *   cfg   { items:[{ key?, name, value }], topN=10, platform='pc', dataLabel=true, animation=true }
 *         items 的**声明序决定取色槽位**（颜色跟随实体、不跟随名次，HBAR-07）
 *
 * 返回 { update(nextCfg, { animate }) => Promise<boolean>, pause(), destroy() }
 * —— 与 SankeyChart 同一形状，这是硬要求（HBAR-20）：两个会播放的图表若形状不同，
 * L3 的播放控制器就要为每个图型分叉，而那正是把它收敛成公用件想消掉的东西。
 * **不调 update 就是一张静态横向条形图**，竞赛形态不占 variant、是「有没有人驱动它」的自然结果。
 *
 * ── 两层渲染是硬要求，不是优化 ────────────────────────────────────
 *   build()      结构级：读 token、createFrame、测量并截断名称、建 clipPath 与行骨架
 *   paint(state) 逐帧：只写 transform / opacity / d / 数值文本
 * 桑基每帧整跑 build() 能接受是因为它节点少；本族每行一根条，逐帧重跑会变成
 * N×5 次 getComputedStyle，正撞 specs/motion.md 的 Don't「把 token 读取放进逐帧回调」。
 */
import { select } from 'd3';
import { createFrame, observeResize, containerDrivesHeight } from '../../core/frame.js';
import { tokenNum } from '../../core/tokens.js';
import { modeOf, resolveBehavior } from '../../core/theme.js';
import { linearY } from '../../core/scale.js';
import { niceSplit } from '../../core/split.js';
import { makeFormatter } from '../../core/format.js';
import { resolveSeriesColors } from '../../core/palette.js';
import { barPath, barRadius, singleBar } from '../../core/bar-geometry.js';
import { measureTexts } from '../../core/measure.js';
import { truncateBatch } from '../../core/label.js';
import { reducedMotion, runGrowth, runTween } from '../../core/motion.js';
import { renderWatermark } from '../../core/watermark.js';
import { rankItems, interpolateRanking, visibleRows, rowGeometry } from './model.js';
import { HBAR_SETTINGS, validateHBarSettings, clampTopN } from './config.js';

export function HBarChart(host, cfg) {
  validateHBarSettings();
  let config = cfg;
  let destroyed = false;
  let firstBuild = true;
  let tween = null;
  /* 当前**显示态**（可能是被冻结的中间帧，不等于 config 的排名）。
     HBAR-17：拖时间轴要从这里起补，不是从上一期原值重来，否则快速连拖会闪回。 */
  let display = null;
  let paint = () => {};

  /* createFrame 直接往 host 上 append svg，故整树重建就是清空 host。
     不另套一层 div：那样 clientHeight 的判据会落在包装层上，与三族共用的
     containerDrivesHeight 口径对不上。 */
  host.classList.add('dv-chart', 'dv-hbar');

  /* [HBAR-16][MOTION-08] 暂停 = 冻结当前帧，**不落终态**——这正是不能用 runGrowth 的
     唯一理由（那个被取消时会 settle 到 1）。驱动器在 L1，本族不自己写 rAF 循环。 */
  const cancelMotion = () => { tween?.pause(); tween = null; };

  /*
   * ⚠️ **build() 不得取消补间**。它同时是 ResizeObserver 的回调，而补间过程中
   * 容器尺寸本来就在变（行数可变时更是每帧都可能变）——在这里 cancelMotion()
   * 等于让 resize 把正在跑的那一期掐掉、update 返回 false、L3 的播放循环当场 break，
   * 症状是「点播放只推进一期就停」。2026-09-20 实测如此。
   * 取消只发生在三处语义明确的地方：update 开始、pause()、destroy()。
   * 重建后 paint 闭包被重新赋值，正在跑的 tick 下一帧自动画到新结构上。
   */
  function build() {
    if (destroyed) return;
    select(host).selectAll('svg').remove();

    const topN = clampTopN(config.topN);
    const target = rankItems(config.items, topN);
    if (!display) display = target;

    /* ── 结构级：token 只在这里读 ── */
    const rowMax = tokenNum(host, '--size-hbar-row-max') || 24;
    const rowContainerMax = tokenNum(host, '--size-hbar-row-container-max') || 36;
    const rowRatio = tokenNum(host, '--size-hbar-row-gap-ratio');
    const nameMax = tokenNum(host, '--size-hbar-y-label-max') || 80;
    const valueMax = tokenNum(host, '--size-hbar-data-label-max') || 40;
    const gap = tokenNum(host, '--spacing-axis-y-label-gap') || 8;
    const valueGap = tokenNum(host, '--spacing-data-label-gap') || 4;
    const rMax = tokenNum(host, '--radius-bar-top');
    const rReduced = tokenNum(host, '--radius-bar-top-reduced');
    const rFullMin = tokenNum(host, '--size-bar-radius-full-min-width') || 8;
    const rReducedMin = tokenNum(host, '--size-bar-radius-reduced-min-width') || 4;

    /* [HBAR-08] 画布高按行数推导；容器给了高度就随容器（与三族共用同一条判据）。 */
    const rows = Math.max(1, Math.min(topN, target.rows.length));
    const usesContainer = containerDrivesHeight(host.clientHeight);
    const wantedHeight = rows * rowContainerMax;
    const frame = createFrame(host, {
      height: usesContainer ? undefined : wantedHeight,
      xBand: false,
      minGridHeight: 0,
    });
    const rowHeight = frame.grid.bottom > frame.grid.top
      ? (frame.grid.bottom - frame.grid.top) / rows
      : rowContainerMax;
    const { offset: rowOffset, width: thickness } = singleBar(rowHeight, rowMax, rowContainerMax, rowRatio);
    const radius = barRadius(thickness, rMax, rReduced, rFullMin, rReducedMin);

    /* [HBAR-04] 名称列：先量再截，列宽封顶 size-hbar-y-label-max */
    const names = target.rows.slice(0, rows).map((r) => r.name);
    const measured = truncateBatch(
      names.map((text) => ({ text, maxWidth: nameMax })),
      (list) => measureTexts(host, list, 'dv-axis-label'),
    );
    const nameWidth = Math.min(nameMax, Math.max(0, ...measured.map((m) => m.width)));
    const labelByKey = new Map(target.rows.slice(0, rows).map((r, i) => [r.key, measured[i]?.text ?? r.name]));

    const dataL = frame.grid.left + nameWidth + gap;
    const dataR = frame.grid.right - valueMax;

    /* [HBAR-06] 值域 niceSplit(0, max)；条长走**反向 range** 的通用比例尺
       （linearY 的数学与方向无关，先例见 radar 的「值→半径」）。不画数值轴、不画网格。 */
    const split = niceSplit(0, Math.max(1, display.max || target.max));
    const x = linearY(split, dataR, dataL);

    const b = resolveBehavior(host, config.platform ?? 'pc');
    const format = makeFormatter(b['number-format']);
    const colors = resolveSeriesColors(host, {
      series: target.rows.map((r) => ({ name: r.name, type: 'bar', seriesIndex: r.slot })),
    });
    colors.forEach((hex, i) => host.style.setProperty(`--dv-series-${i + 1}`, hex));

    /* 行层裁剪到绘图区：掉榜的行滑到榜外一行时不得越出画布（HBAR-13） */
    const clipId = `dv-hbar-clip-${Math.random().toString(36).slice(2, 8)}`;
    frame.svg.append('defs').append('clipPath').attr('id', clipId)
      .append('rect')
      .attr('x', frame.grid.left).attr('y', frame.grid.top)
      .attr('width', Math.max(0, frame.grid.right - frame.grid.left))
      .attr('height', Math.max(0, frame.grid.bottom - frame.grid.top));
    const layer = frame.svg.append('g')
      .attr('class', 'dv-hbar__rows')
      .attr('clip-path', `url(#${clipId})`);

    const wm = b['watermark'];
    if (wm) renderWatermark(frame.svg.append('g').attr('class', 'dv-watermark-layer'), frame, { spec: wm, mode: modeOf(host) });

    /* ── 逐帧：只写几何与文本，一个 token 都不读 ── */
    paint = (state, grow = 1) => {
      const list = visibleRows(state.rows, topN);
      const sel = layer.selectAll('g.dv-hbar__row').data(list, (d) => d.key);
      const enter = sel.enter().append('g').attr('class', 'dv-hbar__row');
      enter.append('path').attr('class', 'dv-hbar__bar');
      enter.append('text').attr('class', 'dv-hbar__name dv-axis-label').attr('text-anchor', 'end').attr('dominant-baseline', 'central');
      enter.append('text').attr('class', 'dv-hbar__value dv-data-label').attr('text-anchor', 'start').attr('dominant-baseline', 'central');
      sel.exit().remove();

      const merged = enter.merge(sel);
      merged
        .attr('opacity', (d) => d.alpha)
        .style('color', (d) => `var(--dv-series-${d.slot + 1})`)
        .attr('transform', (d) => `translate(0,${rowGeometry(d.rank, rowHeight, 0, thickness).y})`);
      merged.select('path.dv-hbar__bar')
        .attr('d', (d) => {
          const len = Math.max(0, (x(d.value) - dataL) * grow);
          return barPath(dataL, rowOffset, len, thickness, radius, 'right');
        });
      merged.select('text.dv-hbar__name')
        .attr('x', frame.grid.left + nameWidth)
        .attr('y', rowHeight / 2)
        .text((d) => labelByKey.get(d.key) ?? d.name);
      /* [HBAR-14] 数值随插值后的值逐帧重排版——本族**显式覆盖**「不做数字跳动」那条口径：
         竞赛图的数字是叙事主体，不滚动等于把叙事砍掉一半。 */
      merged.select('text.dv-hbar__value')
        .attr('x', (d) => dataL + Math.max(0, (x(d.value) - dataL) * grow) + valueGap)
        .attr('y', rowHeight / 2)
        .text((d) => format(d.value));
    };

    paint(display);

    /* [HBAR-18][MOTION-01] 入场生长：条自左向右长。只在实例**首次挂载**时播一次；
       update() 的每一次补间都不是入场，不重放生长（MOTION-04 的 scope 澄清）。 */
    if (firstBuild && (config.animation ?? true) && !reducedMotion()) {
      runGrowth(tokenNum(host, '--motion-duration-grow'), (t) => paint(display, t));
    }
    firstBuild = false;
  }

  build();
  const stopResize = observeResize(host, build);

  return {
    /*
     * [HBAR-12][HBAR-16][HBAR-17] 推进到下一期。
     * from 取**当前显示态**而不是上一期原值：被暂停在半途时从冻结处接着补，
     * 快速连拖时间轴也不会闪回（先例：pie 的强调态补间）。
     * animate 为假、或系统减弱动效时直接落终态（HBAR-19，MOTION-07 的同一条底线）。
     */
    update(nextConfig, options = {}) {
      if (destroyed) return Promise.resolve(false);
      cancelMotion();
      const topN = clampTopN(nextConfig.topN ?? config.topN);
      const from = display ?? rankItems(config.items, topN);
      const to = rankItems(nextConfig.items, topN);
      /* topN 是组件的**持久状态**，不是每期数据的一部分：调用方逐期喂 items 时
         通常不重复声明它。不写回去的话，下一次 update 的 config.topN 就是 undefined、
         悄悄回落到默认 10——症状是播放过程中行数自己越变越多。 */
      config = { ...nextConfig, topN };

      if (options.animate !== true || reducedMotion()) {
        display = to;
        build();
        options.onProgress?.(1, 1);
        return Promise.resolve(true);
      }

      /* 先按目标帧重建结构（名称列宽、颜色槽位、行数可能都变了），再逐帧只重画 */
      display = from;
      build();

      tween = runTween(HBAR_SETTINGS['playback-duration'], (eased, linear) => {
        /* 末帧用目标帧原值收尾，不用 eased 结果——eased 在 1 附近精度不可靠 */
        display = linear === 1 ? to : interpolateRanking(from, to, eased, topN);
        paint(display);
        options.onProgress?.(eased, linear);
      });
      return tween.promise;
    },
    pause() { cancelMotion(); },
    destroy() {
      destroyed = true;
      cancelMotion();
      stopResize();
      host.innerHTML = '';
      host.classList.remove('dv-chart', 'dv-hbar');
    },
  };
}
