/*
 * L2 · HBarChart —— 横向条形图。权威规范见 specs/hbar.md（HBAR-01..23）。
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
import { niceSplit } from '../../core/split.js';
import { makeFormatter } from '../../core/format.js';
import { resolveSeriesColors } from '../../core/palette.js';
import { barPath, barRadius, singleBar } from '../../core/bar-geometry.js';
import { renderGrid } from '../../core/grid.js';
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

  /* 取消 in-flight 补间。**只在三处用**：update 开始、destroy。
     ⚠️ `pause()` 不走这里——本族的暂停要求是「把当前这一期播完再停」（HBAR-16），
     见下方实例 API 的 pause()。 */
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
    const axisLh = tokenNum(host, '--line-height-axis') || 12;
    const axisBand = axisLh + gap;            /* [HBAR-22] 顶部轴标签带 */
    const rMax = tokenNum(host, '--radius-bar-top');
    const rReduced = tokenNum(host, '--radius-bar-top-reduced');
    const rFullMin = tokenNum(host, '--size-bar-radius-full-min-width') || 8;
    const rReducedMin = tokenNum(host, '--size-bar-radius-reduced-min-width') || 4;

    /* [HBAR-08] 画布高按行数推导；容器给了高度就随容器（与三族共用同一条判据）。 */
    const rows = Math.max(1, Math.min(topN, target.rows.length));
    const usesContainer = containerDrivesHeight(host.clientHeight);
    const wantedHeight = rows * rowContainerMax + axisBand;
    const frame = createFrame(host, {
      height: usesContainer ? undefined : wantedHeight,
      xBand: false,
      minGridHeight: 0,
    });
    /* 行区从轴标签带**下面**开始；行高按剩余高度分。 */
    const rowsTop = frame.grid.top + axisBand;
    const rowHeight = frame.grid.bottom > rowsTop
      ? (frame.grid.bottom - rowsTop) / rows
      : rowContainerMax;
    const { offset: rowOffset, width: thickness } = singleBar(rowHeight, rowMax, rowContainerMax, rowRatio);
    const radius = barRadius(thickness, rMax, rReduced, rFullMin, rReducedMin);

    /* [HBAR-04] 名称列：先量再截，列宽封顶 size-hbar-y-label-max。
       ⚠️ **量的是全体成员，不是当前可见的前 N 行**。只量可见行的话，列宽 = 这一帧最长的
       那个名字——而播放时 Top-N 成员在换，最长名字跟着换，于是**条的起点每期都在左右跳**。
       按全体成员取最大值，同一份数据从头到尾只有一个列宽，起点恒定。
       代价是名字都短时左侧会留白，这是有意的：读者对比的是条长，基准线必须不动。 */
    const measured = truncateBatch(
      target.rows.map((r) => ({ text: r.name, maxWidth: nameMax })),
      (list) => measureTexts(host, list, 'dv-axis-label'),
    );
    const nameWidth = Math.min(nameMax, Math.max(0, ...measured.map((m) => m.width)));
    const labelByKey = new Map(target.rows.map((r, i) => [r.key, measured[i]?.text ?? r.name]));

    const b = resolveBehavior(host, config.platform ?? 'pc');
    const format = makeFormatter(b['number-format']);

    const dataL = frame.grid.left + nameWidth + gap;

    /* [HBAR-05] 右侧给条端数值预留的宽度 = **实测最宽的那条数值**，不是写死的 token。
       ⚠️ `size-hbar-data-label-max`(40px) 只是个上限兜底：真实文案「121.28万」要 55px 上下，
       按 40px 预留的话最长那条的数值会顶出画布右缘、被 SVG 裁掉半个字。
       量的是**全体成员**（同 HBAR-04 的理由）：只量可见行的话，Top-N 一换预留宽就变，
       dataR 跟着动 ⇒ 所有条重新缩放，又是一次跳变。
       再往上取 4px 网格，避免数值末位跳动引起的亚像素抖动。 */
    /* measureTexts 收**纯字符串**、返回**数字数组**（不是 {width} 对象）——
       传对象会被 String() 成 "[object Object]"，量出来的宽度与真实文案无关。 */
    /* 预留必须按**同位数下的最坏情况**量，不能按当前这几个数值量。
       ⚠️ `.dv-data-label` 虽然写了 `tabular-nums`，但数字字体并不提供等宽数字字形，
       该特性实际是空转的——实测「120.07万」40.3px、「120.53万」40.8px，同样 7 个字符差半像素。
       而 HBAR-14 的数值是**逐帧滚动**的，按某一帧的宽度定预留，别的帧就会顶出画布
       （实测切掉 0.8px，正好是一个字的边）。
       做法：先找出最宽的那个数字字形，把标签里的数字全替换成它再量。
       两端都量：中间帧的值介于起止之间，位数单调，故最大位数必在某一端。 */
    const digitWidths = measureTexts(host, ['0','1','2','3','4','5','6','7','8','9'], 'dv-data-label');
    const widestDigit = String(digitWidths.indexOf(Math.max(...digitWidths)));
    const valueWidths = measureTexts(
      host,
      [...target.rows, ...(display?.rows ?? [])]
        .map((r) => format(r.value).replace(/\d/g, widestDigit)),
      'dv-data-label',
    );
    const valueReserve = Math.ceil(
      (Math.max(valueMax, 0, ...valueWidths) + valueGap) / 4,
    ) * 4;
    const dataR = frame.grid.right - valueReserve;
    const colors = resolveSeriesColors(host, {
      series: target.rows.map((r) => ({ name: r.name, type: 'bar', seriesIndex: r.slot })),
    });
    colors.forEach((hex, i) => host.style.setProperty(`--dv-series-${i + 1}`, hex));

    /* [HBAR-21][HBAR-22] 分割线与轴标签的图层：**先于行层 append ⇒ 画在条的下面**。
       内容逐帧由 paint 重写（比例尺每帧都在变），这里只建壳。 */
    const gridFrame = { ...frame, grid: { ...frame.grid, top: rowsTop } };
    const gridLayer = frame.svg.append('g').attr('class', 'dv-hbar__grid');
    const axisLayer = frame.svg.append('g').attr('class', 'dv-hbar__axis');

    /* 行层裁剪到绘图区：掉榜的行滑到榜外一行时不得越出画布（HBAR-13） */
    const clipId = `dv-hbar-clip-${Math.random().toString(36).slice(2, 8)}`;
    frame.svg.append('defs').append('clipPath').attr('id', clipId)
      .append('rect')
      .attr('x', frame.grid.left).attr('y', rowsTop)
      .attr('width', Math.max(0, frame.grid.right - frame.grid.left))
      .attr('height', Math.max(0, frame.grid.bottom - rowsTop));
    const layer = frame.svg.append('g')
      .attr('class', 'dv-hbar__rows')
      .attr('clip-path', `url(#${clipId})`);

    const wm = b['watermark'];
    if (wm) renderWatermark(frame.svg.append('g').attr('class', 'dv-watermark-layer'), frame, { spec: wm, mode: modeOf(host) });

    /* ── 逐帧：只写几何与文本，一个 token 都不读 ── */
    paint = (state, grow = 1) => {
      /* [HBAR-06][HBAR-22] **比例尺逐帧算，域是连续的插值 max**。
         ⚠️ 这里曾经在 build() 里算一次 x 并整段补间复用：于是整个补间过程比例尺纹丝不动，
         等下一次 update 重新 build 时才一次性换掉——而 niceSplit 的上界是**量化**的
         （20Q1→20Q2 从 100 万跳到 120 万），所有条在那一瞬间同时缩短 17%。
         那就是「20Q1–20Q4 区间跳变」的真凶。域改成连续的 state.max 后，
         条长与分割线都随 max 平滑伸缩，跳变消失。
         只取 niceSplit 的**步长**（漂亮数字），上界不要。 */
      /* ⚠️ 不能只用 state.max。它是两期 max 的**插值**，而榜首互换时
         「插值后各行的最大值」会略大于「两期 max 的插值」——max(lerp(aᵢ)) ≥ lerp(max(aᵢ))，
         argmax 换人时取严格大于。差额虽只有零点几 px，却足以把最长那条顶出 dataR、
         数值标签被画布切掉一角。故取两者的大者，保证比例尺顶端恒覆盖最长的条。 */
      const visible = visibleRows(state.rows, topN);
      const liveMax = Math.max(1, state.max || 1, ...visible.map((d) => d.value));
      const step = (() => {
        const t = niceSplit(0, liveMax).ticks;
        return t.length > 1 ? t[1] - t[0] : liveMax;
      })();
      const span = dataR - dataL;
      const x = (v) => dataL + (Math.max(0, v) / liveMax) * span;
      const ticks = [];
      for (let k = 0; k * step <= liveMax + step * 1e-9 && k < 64; k += 1) ticks.push(k * step);

      /* 分割线：位置逐帧重写 ⇒ 随 max 连续滑动（HBAR-21） */
      renderGrid(gridLayer, gridFrame, [], () => 0, {
        showXSplit: true,
        xPositions: ticks.map(x),
      });

      /* [HBAR-22] 轴标签：键取刻度**值**，于是同一个数值的标签在滑动时是同一个节点，
         新刻度进场 / 旧刻度出场才各自独立，不会串成「数字乱跳」。 */
      const tick = axisLayer.selectAll('text.dv-hbar__axis-label').data(ticks, (d) => d);
      tick.exit().remove();
      tick.enter().append('text')
        .attr('class', 'dv-hbar__axis-label dv-axis-label')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .merge(tick)
        .attr('x', (d) => x(d))
        .attr('y', frame.grid.top + axisLh / 2)
        .text((d) => format(d));

      const sel = layer.selectAll('g.dv-hbar__row').data(visible, (d) => d.key);
      const enter = sel.enter().append('g').attr('class', 'dv-hbar__row');
      enter.append('path').attr('class', 'dv-hbar__bar');
      enter.append('text').attr('class', 'dv-hbar__name dv-axis-label').attr('text-anchor', 'end').attr('dominant-baseline', 'central');
      enter.append('text').attr('class', 'dv-hbar__value dv-data-label').attr('text-anchor', 'start').attr('dominant-baseline', 'central');
      sel.exit().remove();

      const merged = enter.merge(sel);
      merged
        .attr('opacity', (d) => d.alpha)
        .style('color', (d) => `var(--dv-series-${d.slot + 1})`)
        .attr('transform', (d) => `translate(0,${rowGeometry(d.rank, rowHeight, rowsTop, thickness).y})`);
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
    /*
     * [HBAR-16] **暂停 = 把当前这一期播完再停，不冻结在半路。**
     * 条停在两期之间是个读不出含义的状态——横向条的长度就是数值本身，
     * 停在 60% 处的那根条不对应任何一个季度的真实数值，读者却会去读它。
     * 故这里**不取消**补间：那一期自然收尾、落到真实数据上。
     * 「跑完之后别再往下走」由控制器负责——它在调本方法前就把 playing 置 false 了
     * （并推进播放代数，挡住旧循环复活，见 demos/playback/controller.js）。
     * **拖滑块 / 点刻度仍然是立即打断**：那条路走 update()，它一进来就 cancelMotion。
     *
     * ⚠️ 与桑基相反（SANKEY-24 要求冻结当前几何帧），两条都成立：
     * 桑基的中间帧仍是一张拓扑正确的流向图，而本族的中间帧是一个不存在的排名。
     * 驱动器 runTween 的「取消即冻结」语义没变（MOTION-08），本族只是不去调它的 pause。
     */
    pause() { /* 故意什么都不做，理由见上 */ },
    destroy() {
      destroyed = true;
      cancelMotion();
      stopResize();
      host.innerHTML = '';
      host.classList.remove('dv-chart', 'dv-hbar');
    },
  };
}
