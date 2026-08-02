/*
 * pie/index.js —— 【PieChart 编排器（公开入口）】
 *
 * 干什么：无坐标系占比图（饼 / 环）的**拼装编排**。它自己几乎不算东西——把 L1 构件
 * （frame/legend/label/tooltip/watermark/motion + palette 取色 + format 格式化）按顺序拼起来，
 * 「扇区占多少角、环画多大、标签摆哪」派发给同目录的 geometry.js，本文件只负责串流程 + 接交互。
 *
 * 与 CartesianChart 平级、互不依赖：本族没有类目轴 / 值域刻度 / 网格，
 * scale·grid·axis·datazoom·crosshair 整条链路都不适用；但**通用构件全部原样复用**。
 * 饼与环不按名字分体，靠一个 variant 旋钮（同 bar.md「变体是取值组合，不是两份组件」的先例）。
 * 只吃数据 + 语义配置，不暴露样式参数（颜色按 COLOR-08 固定槽位、尺寸走 token）。
 *
 *   host  容器元素（须挂在带 data-theme 的祖先内）
 *   cfg   { name?, items:[{name,value}], variant='donut', legend='right', platform='pc',
 *           dataLabel='auto', animation=true }
 *         name（可选）：这组数据的名字，作 tooltip 标题行；不给则整行不渲染（PIE-05）
 *         items：扇区列表；null / ≤0 不占角也不进分母（PIE-01）
 *         variant（形态语义，非样式）：'donut' 环 / 'pie' 饼
 *         legend（形态语义，非样式）：'right' 左右结构（默认）/ 'bottom' 上下结构（PIE-09 / LEGEND-10）
 *         dataLabel（语义配置）：'auto' 按 PIE-04 默认出 / true 全开 / false 全关（LABEL-05）
 *         animation（语义配置）：true 入场扫掠 / false 直接终态；系统「减弱动态效果」下恒终态（MOTION-07）
 */
import { select, arc } from 'd3';
import { createFrame, observeResize } from '../../core/frame.js';
import { tokenNum } from '../../core/tokens.js';
import { resolveBehavior, modeOf } from '../../core/theme.js';
import { makeFormatter } from '../../core/format.js';
import { resolveSeriesColors } from '../../core/palette.js';
import { renderLegend, applyToggle } from '../../core/legend.js';
import { renderDataLabels } from '../../core/label.js';
import { renderWatermark } from '../../core/watermark.js';
import { createTooltip } from '../../core/tooltip.js';
import { runGrowth, reducedMotion } from '../../core/motion.js';
import { sliceAngles, donutRadii, labelAnchor } from './geometry.js';

/* [PIE-03] 图例 marker 类型键：三主题都按这个键取「饼/环 6×6 圆点」——
   THS / iFinD-PC 命中各自 legend-marker.shapes.dot，Ainvest 是 unified 恒圆点（LEGEND-03）。
   故 behavior.json 无需为本族新增任何键。 */
const MARKER_TYPE = 'dot';

export function PieChart(host, cfg) {
  const { name, items, variant = 'donut', legend = 'right', platform = 'pc', dataLabel = 'auto', animation = true } = cfg;
  /* [PIE-02] 调用方明确给容器高度时随容器适配；未给时用环形容器 token 作高度包络（口径同 GRID-03）。 */
  let usesContainerHeight = host.clientHeight >= 40;

  /* [COLOR-08] 扇区即取色单位：N 个扇区当 N 个取色单位喂给同一个取色器——
     type 既非 bar 也非 line，故「柱线混合」判定为假、自然落到通用 bar-multi 盘。
     hex 顺手留在 resolved 上——数据标签走档②，要按扇区色明暗反色（LABEL-04）需要色值本身而非变量名。 */
  const resolved = items.map((it, i) => ({
    name: it.name,
    value: it.value,
    sliceIndex: i,                    /* 声明序号（取色槽位按它，隐藏不重排 —— COLOR-04） */
    colorVar: `--dv-series-${i + 1}`,
  }));
  resolveSeriesColors(host, { series: resolved.map(() => ({ type: 'pie' })) }).forEach((hex, i) => {
    host.style.setProperty(resolved[i].colorVar, hex);
    resolved[i].colorHex = hex;
  });

  const b = resolveBehavior(host, platform);
  const marker = b['legend-marker'];
  const selectMode = b['legend-select'];
  const format = makeFormatter(b['number-format']);       /* [FORMAT-01] 与标签 / 气泡同一份 */
  const wm = b['watermark'];                              /* [PIE-07] 水印（三主题恒有） */

  const keys = resolved.map((r) => r.name);
  const legendItems = resolved.map((r) => ({ key: r.name, label: r.name, type: MARKER_TYPE, colorVar: r.colorVar }));
  const state = { hidden: new Set() };
  let hoverKey = null;
  /* [PIE-10] 点击选中的扇区（强调态的常驻档）。挂在组件作用域而非 build 内：
     resize / 图例显隐都会整树重建，选中态应当跨重建保留，同 state.hidden。 */
  let selectedKey = null;

  /* DOM 骨架（一次性）。[PIE-09][LEGEND-10] 与 cartesian 的关键差别：**绘图区在前、图例在后**。
     饼环没有「图例在上」这种形态（左右 / 上下两种结构里图例都在图之后），DOM 序 = 阅读序 =
     视觉序，方位只由容器 flex 方向切，不用 row-reverse 倒序。 */
  const legendClass = legend === 'bottom' ? 'dv-chart--legend-bottom' : 'dv-chart--legend-right';
  host.classList.add('dv-chart', legendClass);
  const plotHost = select(host).append('div').attr('class', 'dv-chart__plot').node();
  const legendHost = select(host).append('div').attr('class', 'dv-chart__legend').node();

  /* [LEGEND-05] hover 弱化：扇区 <g> 的 opacity，图例本身不动。
     数据标签也按扇区分组（dataset.key 同名），随其所属扇区一起弱化——否则扇区变淡、数字仍全黑。 */
  function applyDim() {
    const dim = getComputedStyle(host).getPropertyValue('--opacity-visualization-dim').trim() || '1';
    select(plotHost).selectAll('g.dv-pie-series, g.dv-data-label-series')
      .attr('opacity', function () { return hoverKey && this.dataset.key !== hoverKey ? dim : 1; });
  }

  /* [PIE-09][LEGEND-10] 方位定内部排布与对齐：左右结构纵向单列左对齐、上下结构横向居中换行。
     两者是同一种布局的两个面，故一处推导、不各传各的。 */
  const legendLayout = legend === 'bottom' ? 'row' : 'column';
  const legendAlign = legend === 'bottom' ? 'center' : 'left';

  function drawLegend() {
    renderLegend(legendHost, legendItems, {
      marker, layout: legendLayout, align: legendAlign, state,
      onToggle: (key) => { state.hidden = applyToggle(state.hidden, key, keys, selectMode); hoverKey = null; build(); }, /* [LEGEND-06][PIE-03] */
      onHover: (key) => { hoverKey = key; applyDim(); },
    });
  }

  /* hover / 生长的收口：两者都随 build 重建（气泡挂在 plotHost 内，build 会清空它），
     故每次 build 先停旧的、再由新一轮装配重新赋值——同 cartesian 的 stopHover / stopGrow 模式。 */
  let stopHover = () => {};
  /* [MOTION-04] 入场扫掠只在实例首次挂载时播一次——build() 同时被 resize / 图例显隐复用。 */
  let firstBuild = true;
  let stopGrow = () => {};
  /* [PIE-11] 强调态外扩的补间。与 stopGrow 同样挂在组件作用域：build 重建时要先停掉旧的，
     否则残余的 rAF 会继续往已被移除的节点上写。 */
  let stopEmph = () => {};

  /* 主流程：画布 → 扇区（顺带接 hover、收生长闭包）→ 标签 → 水印 → 入场扫掠 */
  function build() {
    stopHover();
    stopHover = () => {};
    stopGrow();
    stopGrow = () => {};
    stopEmph();
    stopEmph = () => {};
    drawLegend(); /* 图例先占位，可用空间再按剩余算（LEGEND-04） */
    if (usesContainerHeight && host.clientHeight < 40) return requestAnimationFrame(build);
    plotHost.innerHTML = '';

    /* [PIE-02][PIE-09] 可用空间从 **host** 量，不从 plotHost 量：绘图区已改成贴着环成块
       （CSS 里 flex:none），它的尺寸就是画布尺寸，拿它当输入会形成「画布依赖画布」的循环。
       上下结构里图例占掉一段高度，要连同间距一起扣除后才是环可用的高。 */
    const gapPx = tokenNum(host, '--spacing-legend-chart-gap') || 24;
    let avail;
    if (usesContainerHeight) {
      avail = legend === 'bottom'
        ? host.clientHeight - legendHost.getBoundingClientRect().height - gapPx
        : host.clientHeight;
    } else {
      avail = tokenNum(plotHost, '--size-donut-container') || 160;
    }

    /* [PIE-02] token 是上限，放不下才收缩；环宽等比跟随，环宽:半径比全程不变。 */
    const { R, innerR, ring } = donutRadii(
      avail, avail,
      tokenNum(plotHost, '--size-donut-radius') || 70,
      tokenNum(plotHost, '--size-donut-ring-width') || 28,
      variant,
    );

    /* [PIE-08][PIE-09] 无轴画布：xBand:false → 四周留白全 0、grid 即整块画布。
       **画布 = 环的外接方框（2R），不留任何富余**——半径被 token 封顶后，多出来的画布
       不会让环变大，只会变成环与图例之间随容器浮动的死空间，而 PIE-09 要求这段间距恒定。
       上下结构只定高不定宽：宽度铺满容器、环在其中水平居中即为整体居中，
       横向富余不夹在环与图例之间（图例在下方），不影响间距。 */
    const side = 2 * R;
    const frame = createFrame(plotHost, {
      height: side,
      ...(legend === 'bottom' ? {} : { width: side }),
      xBand: false,
      minGridHeight: 0, /* 画布已按图元算好，不要被轴图的最小网格高抬高（那会重新造出死空间） */
    });

    const cx = (frame.grid.left + frame.grid.right) / 2;
    const cy = (frame.grid.top + frame.grid.bottom) / 2;

    /* ── [PIE-05] hover 链路：只有气泡（无指示线 / 无轴贴片——无轴可指、无标签可贴）──
       气泡必须在 plotHost.innerHTML='' 之后创建：它把浮层 div 挂在 plotHost 内
       （保 data-theme token 作用域与随图表销毁），清空画布会一并带走上一轮的浮层。 */
    const tooltip = createTooltip(plotHost);
    let hideTimer = 0;
    const hideTip = () => { clearTimeout(hideTimer); tooltip.hide(); };
    /* [TOOLTIP-10] scroll 不冒泡，capture 才能覆盖 window 与内部滚动容器，
       否则 fixed 气泡会脱离已滚走的图表继续悬在原地。 */
    window.addEventListener('scroll', hideTip, { capture: true, passive: true });
    const hideDelay = tokenNum(plotHost, '--tooltip-hide-delay');
    stopHover = () => {
      clearTimeout(hideTimer);
      window.removeEventListener('scroll', hideTip, true);
      tooltip.hide();
    };

    function showTip(event, r) {
      clearTimeout(hideTimer);
      const box = plotHost.getBoundingClientRect();
      /* [TOOLTIP-02] 标题行 = 这组数据的名字（不给则整行不渲染）；数据行 = 命中扇区一行，
         marker 与图例同源（圆点）、数值与标签同一份 format、null 显示 "-"。 */
      tooltip.show({
        title: name,
        rows: [{ key: r.name, label: r.name, type: MARKER_TYPE, colorVar: r.colorVar, value: r.value == null ? '-' : format(r.value) }],
      }, marker);
      /* [TOOLTIP-04][TOOLTIP-07] 无坐标系图恒走 follow 档：这不是主题分叉（三主题一致），
         故在 L2 定死、不给 behavior.json 加键。follow 只用 pointer 与画布宽高；
         cx 于本档不参与，仍按入参形状传齐。 */
      const pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
      tooltip.place('follow', {
        grid: frame.grid, width: frame.width, height: frame.height, cx: pointer.x, pointer,
      });
    }

    /* [PIE-01][PIE-03] 角度按**可见**扇区重算 —— 隐藏一个扇区，剩余扇区重新闭合 360°；
       颜色不参与重算（各扇区的 colorVar 由声明序号定死，COLOR-04/08）。 */
    const visible = resolved.filter((r) => !state.hidden.has(r.name));
    const slices = sliceAngles(visible.map((r) => r.value));

    /* [PIE-04] 数据标签：本层只算「摆哪、要不要摆、写什么」，渲染 / 反色 / 放不下就不放归 L1。
       **默认不出**（LABEL-05：饼环是「一个类目一个值」原则的例外，占比由扇形本身表达、
       名称由图例承载，扇区内再压数字属冗余），只有 dataLabel:true 显式全开才画；
       开了也仍受环宽约束——装不下一行字时整层不出。 */
    const labelLineH = tokenNum(plotHost, '--line-height-data-label');
    const showLabel = dataLabel === true && ring >= labelLineH;
    const labelBatches = [];

    /* [MOTION-01][PIE-06] 入场扫掠：收集逐帧重绘闭包。起止角同乘 t → 整环自 12 点顺时针扫开，
       各扇区被前沿扫过时依次显形、**全程占比正确**（同 MOTION-06 堆叠「值空间同乘 t」的思路）。 */
    const grow = [];
    /* 四个几何字段全从 datum 读（d3.arc 的默认访问器），好让 hover 外扩逐扇区改 outerRadius，
       而不必每帧新建一个生成器。 */
    const arcGen = arc();
    const sectorLayer = frame.svg.append('g').attr('transform', `translate(${cx},${cy})`);

    /* [PIE-10] 强调态外扩：扇区的**外**半径 +expand（内半径不动 → 环变厚）。
       两个来源并存、任一命中即外扩：hover 是临时态、点击选中是常驻态。
       token 为 0 的主题（THS / iFinD-PC）自然无形态，无需分支判断。
       与图例 hover 的 hoverKey 是两条链路：这里管几何、那边管弱化透明度。 */
    const expand = tokenNum(plotHost, '--size-donut-hover-expand') || 0;
    let emphHover = null;
    const emphasized = (n) => n === emphHover || n === selectedKey;
    let currentT = 1; /* 扫掠进度：强调态重绘要沿用当前帧，否则动画中途 hover 会瞬间跳到终态 */

    /* [PIE-11] 每个扇区当前的外扩量（px），由补间逐帧写入；draw 只读它，不读布尔状态。
       初值直接取目标值：重建（resize / 图例显隐）是重新出图、不是状态切换，
       此时选中的扇区应当**已经**是外扩的，不该再补间一次。 */
    const bumps = new Map(slices.map((s) => [visible[s.i].name, emphasized(visible[s.i].name) ? expand : 0]));
    const bumpOf = (n) => bumps.get(n) ?? 0;

    /* [PIE-11] 外扩过渡：从**当前**外扩量补间到目标，而不是从 0 重来——快速划过一排扇区时
       每个都从半路接着走，不会跳一下。复用 L1 的 runGrowth（同一条 cubicOut、同一套逐帧驱动），
       只把时长换成强调态专属的 token（远短于入场，hover 反馈拖到 480ms 会显得迟钝）。
       [MOTION-07] 系统「减弱动态效果」下时长归零 → runGrowth 同步落终态，等同于无过渡。 */
    function animateEmphasis() {
      const names = [...bumps.keys()];
      /* ⚠️ 顺序要紧：**先读当前值，再停上一轮**。
         runGrowth 的 cancel 语义是「立即落终态」（MOTION-04 为入场定的：被打断即刻到位、
         不半途回退）——那对一次性入场是对的，但强调态会被反复打断。若在 stopEmph() 之后才读，
         读到的是上一轮的**终点**，新补间便从终点起步，中间那一下就是肉眼可见的硬切。
         故先取此刻的值，停掉上一轮后再把被落到终态的量改回打断瞬间，从那里接着补间。 */
      const from = names.map(bumpOf);
      stopEmph();
      names.forEach((n, i) => bumps.set(n, from[i]));
      grow.forEach((d) => d(currentT)); /* 把 cancel 落下的终态画面改回打断瞬间 */
      const to = names.map((n) => (emphasized(n) ? expand : 0));
      if (from.every((v, i) => v === to[i])) return; /* 目标没变就别起一轮空动画 */
      stopEmph = runGrowth(
        reducedMotion() ? 0 : tokenNum(plotHost, '--motion-duration-emphasis'),
        (t) => {
          names.forEach((n, i) => bumps.set(n, from[i] + (to[i] - from[i]) * t));
          grow.forEach((d) => d(currentT));
        },
      );
    }

    slices.forEach((s) => {
      const r = visible[s.i];
      const g = sectorLayer.append('g').attr('class', 'dv-pie-series').style('color', `var(${r.colorVar})`);
      g.node().dataset.key = r.name;
      const path = g.append('path').attr('class', 'dv-pie-sector');
      /* t 缺省 1 = 终态，与无动效时逐像素一致 */
      const draw = (t = 1) => path.attr('d', arcGen({
        startAngle: s.a0 * t,
        endAngle: s.a1 * t,
        innerRadius: innerR,
        outerRadius: R + bumpOf(r.name),
      }));
      draw();
      grow.push(draw);

      /* [PIE-10] 外扩的扇区会压住相邻扇区，故强调时把它抬到同层最上（DOM 序 = 绘制序）。 */
      const raiseAbove = () => g.raise();

      /* [PIE-05] 按扇区命中（无坐标轴 → 没有「最近类目」可言，不做 X 切片） */
      path.on('mouseenter', () => {
        if (!expand) return;
        emphHover = r.name;
        raiseAbove();
        animateEmphasis();
      })
        .on('mousemove', (event) => showTip(event, r))
        .on('mouseleave', () => {
          hideTimer = setTimeout(() => tooltip.hide(), hideDelay); /* [TOOLTIP-10] 延迟隐藏 */
          if (!expand) return;
          emphHover = null;
          animateEmphasis();
        })
        /* [PIE-10] 点击 = 常驻强调：单选，再点自己取消、点别的移过去。 */
        .on('click', () => {
          if (!expand) return;
          selectedKey = selectedKey === r.name ? null : r.name;
          raiseAbove();
          animateEmphasis();
        });

      if (showLabel) {
        const a = labelAnchor(s.a0, s.a1, R, innerR);
        labelBatches.push({
          key: r.name,
          /* [LABEL-04] 档②：标签压在扇区填充上 → 按该扇区色的明暗切前景 */
          item: {
            x: cx + a.x,
            y: cy + a.y,
            baseline: 'middle',
            inside: true,
            bgHex: r.colorHex,
            maxWidth: a.maxWidth,     /* [LABEL-06③] 放不下就不放（几何判定见 geometry.js） */
            text: r.value == null ? null : format(r.value),
          },
        });
      }
    });

    /* [PIE-07] 标签层在扇区之后追加 = 压在扇区之上（层级 = DOM 顺序，同 LABEL-08），水印仍在最末。
       每扇区一个 <g>：dataset.key 让图例 hover 弱化连同标签一起生效（applyDim）。
       [LABEL-06②] collide:false —— 扇区标签环绕四周、本就不同行，同行碰撞过滤不适用
       （core/label.js 的 collide 开关正是为此预留）。 */
    let labelLayer = null;
    if (labelBatches.length) {
      labelLayer = frame.svg.append('g').attr('class', 'dv-data-label-layer');
      labelBatches.forEach(({ key, item }) => {
        const g = labelLayer.append('g').attr('class', 'dv-data-label-series');
        g.node().dataset.key = key;
        renderDataLabels(g, frame, [item], { collide: false });
      });
    }

    applyDim();

    /* [PIE-07] 水印置顶：build 末尾追加 = DOM 顺序最上。锚 frame.grid——本族的 grid 就是整块画布
       （无轴带占位），故三主题的锚角与偏移仍只由 behavior.json 的 watermark 一处决定。 */
    if (wm) renderWatermark(frame.svg.append('g').attr('class', 'dv-watermark-layer'), frame, { spec: wm, mode: modeOf(host) });

    /* ── [MOTION-01/04/05/07][PIE-06] 入场扫掠（本函数最后一步，此前所有元素都已画到终态）──
       只在首次挂载播；animation:false 或系统「减弱动态效果」下根本不进这个分支，
       保证与不带本能力时逐像素一致（MOTION-07 的零回归验收点）。
       图例 / 水印不参与；数据标签整层先藏、结束后出现（MOTION-05）。
       hover 已在上面接线，扫掠期间即可用（气泡取数据真值，与动画进度无关）。 */
    const animate = animation && firstBuild && grow.length > 0 && !reducedMotion();
    firstBuild = false;
    if (!animate) return;

    if (labelLayer) labelLayer.style('display', 'none');
    grow.forEach((draw) => draw(0)); /* 先落零帧，避免首帧闪出终态再跳回起点 */
    stopGrow = runGrowth(
      tokenNum(plotHost, '--motion-duration-grow'), /* [MOTION-02] 全站统一时长，不按图表分档 */
      (t) => { currentT = t; grow.forEach((draw) => draw(t)); },
      { onDone: () => { if (labelLayer) labelLayer.style('display', null); } },
    );
  }

  build();
  const naturalHostHeight = host.clientHeight;
  const stop = observeResize(host, () => { /* [PIE-02] 默认尺寸建立后，外部改高才切容器适配（同 GRID-03） */
    if (!usesContainerHeight && Math.abs(host.clientHeight - naturalHostHeight) > 1) usesContainerHeight = true;
    build();
  });
  /* destroy 把 host 恢复原样：**方位修饰类必须一并摘掉**——同一个 host 换 legend 重新挂载时，
     旧类残留会让两个方位类并存，而 CSS 里后声明者恒胜，实际生效的与传入的 legend 无关。
     （CartesianChart 只加一个恒定的 dv-chart，没有这个问题，故那边不需要对称清理。） */
  return {
    destroy: () => {
      stopGrow();
      stopEmph();
      stopHover();
      stop();
      host.classList.remove('dv-chart', legendClass);
      host.innerHTML = '';
    },
  };
}
