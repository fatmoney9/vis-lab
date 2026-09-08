/*
 * radar/index.js —— 【RadarChart 编排器（公开入口）】
 *
 * 干什么：多指标对比图（雷达 / 蜘蛛图）的**拼装编排**。它自己几乎不算东西——把 L1 构件
 * （frame/legend/label/measure/tooltip/watermark/motion + palette 取色 + split 刻度 + scale 换算）
 * 按顺序拼起来，「轴指向哪、值落多远、环画多大、标签摆哪、指针命中第几个扇形」全部派发给
 * 同目录的 geometry.js，本文件只负责串流程 + 接交互。
 *
 * 与 CartesianChart / PieChart 平级、互不依赖：本族没有类目轴 / 值域刻度带 / 直角网格，
 * axis·axis-title·grid·crosshair·datazoom 整条链路都不适用；但**通用构件全部原样复用**。
 *
 * ⚠️ **极坐标 ≠ 雷达**：饼环也画在极坐标里，但两者做的是相反的事——饼环「值 → 角度、半径恒定」，
 * 雷达「角度均分、值 → 半径」。两族真正共享的只有 (角度,半径)→(x,y) 那个三角公式，
 * 故本期不新建 core/polar.js。判据与两个下沉点见 specs/radar.md 的「分层边界」。
 *
 * 只吃数据 + 语义配置，不暴露样式参数（颜色按固定色槽 COLOR-03/08、尺寸走 token）。
 *
 *   host  容器元素（须挂在带 data-theme 的祖先内）
 *   cfg   { name?, dimensions, series, max?, segments=5, gridShape='circle', shape='straight',
 *           variant='basic', axisValue=false, editable=false, editStep?, onChange?,
 *           legendSelect='multi', platform='pc', animation=true }
 *         name（可选）：这组数据的名字；本族气泡标题恒为维度名或系列名，故仅作可访问名
 *         dimensions：维度名数组，**≥3**（[RADAR-01]）；顺序即 12 点起顺时针
 *         series：[{ name, data }]，data 与 dimensions 等长
 *         max（语义配置）：径向上界；不给则自动求 nice 上界（[RADAR-04]）
 *         segments（形态语义）：网格环数，默认 5，最少 2
 *         gridShape（形态语义）：'circle' 同心圆（默认）/ 'polygon' 正多边形（[RADAR-03]）
 *         shape（形态语义）：'straight' 直线闭合（默认）/ 'curve' 曲线闭合、隐点（[RADAR-05]）
 *         variant（形态语义）：'basic' / 'rating'（评级环未实现，[RADAR-15]）
 *         axisValue（语义配置）：轴标签是否带数值；**与交互无关**（[RADAR-07]）
 *         editable（能力语义）：单系列时沿径向轴拖动 / 键盘调值（[RADAR-18]）
 *         editStep（可选）：拖动与键盘的值吸附步长；不给时拖动连续、键盘按一环递增
 *         onChange（可选）：调值回调，收到维度 / 系列索引、当前值与完整 data 副本
 *         animation（语义配置）：true 顺时针依次出现 / false 直接终态；减弱动效下恒终态
 */
import { select, line, curveLinearClosed, curveCardinalClosed } from 'd3';
import { createFrame, observeResize, containerDrivesHeight, containerTookOver } from '../../core/frame.js';
import { tokenNum, tokenStr } from '../../core/tokens.js';
import { resolveBehavior, modeOf } from '../../core/theme.js';
import { makeFormatter } from '../../core/format.js';
import { measureTexts, measureInk } from '../../core/measure.js';
import { truncateBatch } from '../../core/label.js';
import { niceSplit } from '../../core/split.js';
import { linearY } from '../../core/scale.js';
import { resolveSeriesColors } from '../../core/palette.js';
import { renderLegend } from '../../core/legend.js';
import { applyToggle, applyFocus } from '../../core/legend-state.js';
import { renderWatermark } from '../../core/watermark.js';
import { createTooltip } from '../../core/tooltip.js';
import { runGrowth, reducedMotion } from '../../core/motion.js';
import {
  MIN_DIMENSIONS, pointAt, axisAngles, radarDomain, radarFrame,
  ringRadii, gridPath, seriesPoints, labelAnchor, labelArc, sectorAt, sectorCorners,
  radarValueAt, snapRadarValue,
} from './geometry.js';

/* [RADAR-08][LEGEND-03] 图例 marker 类型键：三主题都按这个键取「饼/环/气泡/雷达 6×6 圆点」——
   THS / iFinD-PC 命中各自 legend-marker.shapes.dot，Ainvest 是 unified 恒圆点。
   故 behavior.json 无需为本族新增任何键（同 PIE-03）。 */
const MARKER_TYPE = 'dot';

/* [RADAR-07] 轴标签两段各自的字号修饰类。名称段是**非数字文本**，故不能直接挂通用
   `.dv-data-label`——那套 token 的隐含前提是「标签内容是数字」（medium 字重 + 数字字体 +
   tabular-nums），见 specs/pie.md PIE-15 记的同一个坑。两段各有自己的类与 token。 */
const NAME_CLASS = 'dv-radar-label-name';
const VALUE_CLASS = 'dv-radar-label-value';
let radarInstanceId = 0;

export function RadarChart(host, cfg) {
  const {
    name, dimensions, series, max, segments = 5,
    gridShape = 'circle', shape = 'straight', variant = 'basic',
    axisValue = false, editable = false, editStep, onChange,
    legendSelect = 'multi', platform = 'pc', animation = true,
  } = cfg;

  /* [RADAR-01] 维度数下限当场抛错：两根轴构不成面积、读不出任何形状，静默画出来更糟。 */
  if (!Array.isArray(dimensions) || dimensions.length < MIN_DIMENSIONS) {
    throw new Error(`RadarChart：维度数须 ≥ ${MIN_DIMENSIONS}（当前 ${dimensions?.length ?? 0}），少于此构不成面积`);
  }
  /* [RADAR-15] 评级形态的接缝已在 API 上，但本期未实现——认这个字段、明确抛错，
     而不是假装画出一张 basic 让人以为评级环没生效。 */
  if (variant === 'rating') throw new Error('RadarChart：variant "rating" 尚未实现（见 specs/radar.md RADAR-15）');
  /* [RADAR-18] 可调节态是一份输入控件，不是多系列比较器。多组手柄落在同一根轴时会重叠，
     调用方无法辨认正在改谁；先把边界说死，比静默只编辑第一组可靠。 */
  if (editable && series.length !== 1) {
    throw new Error(`RadarChart：editable 仅支持单系列（当前 ${series.length} 组），多系列手柄会重叠且语义不明`);
  }
  /* [RADAR-18] 可调节态只显示沿弧排布的维度名；即使调用方遗留 axisValue:true，
     也不渲染第二行数值、不为它预留高度。当前值由 slider 气泡与 aria-valuenow 承担。 */
  const showAxisValue = axisValue && !editable;
  const instanceId = ++radarInstanceId;

  /* [RADAR-09] 调用方明确给容器高度时随容器适配；未给时用主题 token 作高度包络（口径同 PIE-02 / TREEMAP-08）。 */
  let usesContainerHeight = containerDrivesHeight(host.clientHeight);
  /* 本组件上一次 build 结束时图表根的高度，供 observeResize 区分自变与外部改高（同饼环）。 */
  let selfHeight = host.clientHeight;

  /* [COLOR-03][COLOR-08] 系列即取色单位。type 传 'radar'：取色器没有本族的专用盘，
     故落到通用 bar-multi 按序号取；单系列自动走 single-default。**palette.js 一行不用改**。 */
  const resolved = series.map((s, i) => ({
    name: s.name,
    /* [RADAR-18] 可调值留在组件内部；不直接改调用方传入的数组，变更经 onChange 明确上抛。 */
    data: Array.isArray(s.data) ? [...s.data] : [],
    seriesIndex: i,                   /* 声明序号（取色槽位按它，隐藏不重排 —— COLOR-04） */
    colorVar: `--dv-series-${i + 1}`,
  }));
  resolveSeriesColors(host, { series: resolved.map(() => ({ type: 'radar' })) }).forEach((hex, i) => {
    host.style.setProperty(resolved[i].colorVar, hex);
    resolved[i].colorHex = hex;
  });

  const b = resolveBehavior(host, platform);
  const marker = b['legend-marker'];
  const format = makeFormatter(b['number-format']);       /* [FORMAT-01] 与标签 / 气泡同一份 */
  const wm = b['watermark'];

  const keys = resolved.map((r) => r.name);
  const legendItems = resolved.map((r) => ({ key: r.name, label: r.name, type: MARKER_TYPE, colorVar: r.colorVar }));
  /* [LEGEND-06][LEGEND-14][RADAR-11] 两条状态线，挂在 build 外——resize / 显隐会整树重建，
     状态不该因此丢失。hidden 是「筛」，selected 是「强调」= RADAR-11 的单系列钉住本身
     （图例项与多边形是同一个 selected 的两个入口，两处各持一份必然自相矛盾）。 */
  const state = { hidden: new Set(), selected: null };
  let hoverKey = null;

  host.classList.add('dv-chart', 'dv-chart--radar');
  /* [RADAR-08] 图例默认在图表**上方**（基线 3.1 默认上下布局、4.1 图例居上左对齐），
     故 DOM 序 = 阅读序：图例在前、绘图区在后。 */
  const legendHost = select(host).append('div').attr('class', 'dv-chart__legend').node();
  const plotHost = select(host).append('div').attr('class', 'dv-chart__plot').node();

  /* [LEGEND-05][LEGEND-14][RADAR-11] 弱化的**唯一出口**：hover（临时）与钉住（常驻）都收在这里，
     hover 优先——指针停在 B 上时读的就该是 B，松开回落到常驻那个（同 PIE-10 的取舍）。 */
  function applyDim() {
    const emph = hoverKey ?? state.selected;
    const dim = tokenStr(host, '--opacity-visualization-dim') || '1';
    /* [RADAR-06] 面与线分属两层（见 build），故弱化要**两层各压一次**：
       只压 g.dv-radar-series 会让被弱化系列的面仍是满不透明度，线淡了面没淡。 */
    select(plotHost).selectAll('g.dv-radar-series, path.dv-radar-area')
      .attr('opacity', function () { return emph && this.dataset.key !== emph ? dim : 1; });
    /* [RADAR-06] 钉住的那一组填充本色，其余回默认 10% 档——两档由修饰类切，值仍在 token 里。 */
    select(plotHost).selectAll('path.dv-radar-area')
      .classed('dv-radar-area--pinned', function () { return this.dataset.key === state.selected; });
  }

  function drawLegend() {
    /* [RADAR-08] 单系列时图例可省（基线 4.1）——不渲染，也就没有可点的入口。 */
    if (resolved.length <= 1) { legendHost.innerHTML = ''; return; }
    renderLegend(legendHost, legendItems, {
      marker, layout: 'row', align: 'left', state,
      onToggle: (key) => {
        if (legendSelect === 'focus') return pinSeries(applyFocus(state.selected, key));
        state.hidden = applyToggle(state.hidden, key, keys, legendSelect);
        hoverKey = null;
        build();
      },
      onHover: (key) => { hoverKey = key; applyDim(); },
    });
  }

  /* [RADAR-11] 钉住态的**唯一写入口**。图例项与多边形两个入口都走它，
     三处表达（图例弱化、图元弱化、填充切档）因此不可能各走各的。 */
  function pinSeries(next) {
    state.selected = next;
    drawLegend();
    applyDim();
  }

  let stopGrow = () => {};
  let stopDrag = () => {};
  let hideTimer = 0;
  /* [MOTION-04] 入场只在实例首次挂载时播一次——build() 同时被 resize / 图例显隐复用。 */
  let firstBuild = true;

  function build() {
    stopGrow();
    stopGrow = () => {};
    stopDrag();
    stopDrag = () => {};
    clearTimeout(hideTimer);
    drawLegend();                       /* 图例先占位，可用空间再按剩余算（LEGEND-04） */
    /* [RADAR-09] 容器塌到不可用高度时推迟到下一帧、**不抛错**：标签页切换 / 折叠面板展开 /
       懒布局首帧都会让容器高短暂为 0，那不是配置错误，抛异常会把整张图打没且不会自己回来。 */
    if (usesContainerHeight && host.clientHeight < 40) return requestAnimationFrame(build);
    plotHost.innerHTML = '';
    /* ⚠️ 气泡必须**在清空之后**建：它是 plotHost 的子节点，建在 build 外会被上面那行连根删掉
       （症状很隐蔽——扇形高亮照常，只是气泡再也不出现）。同 pie / treemap 的做法。 */
    const tooltip = createTooltip(plotHost);

    const gapPx = tokenNum(host, '--spacing-chart-region-gap') || 8;
    const legendH = resolved.length > 1 ? legendHost.getBoundingClientRect().height + gapPx : 0;
    const handleSize = editable ? tokenNum(plotHost, '--size-radar-handle') || 36 : 0;
    /* [RADAR-09] 容器没给高时退到**本族自己的**容器 token（同饼环的 --size-donut-container）。
       ⚠️ 曾经兜底三族共用的 --size-chart-region-height（160/200），那是错的：扣掉上下标签带后
       半径被压死在 40/60，`size-radar-radius` 怎么改都不生效——雷达要多大是本族的事，
       不该由「柱/线/树图共用的区域高」代管。 */
    const defaultAvailH = tokenNum(plotHost, '--size-radar-container') || 240;
    const availH = usesContainerHeight ? host.clientHeight - legendH : defaultAvailH;
    const availW = host.clientWidth || availH;

    /* [RADAR-09] 半径先按容器定、标签带吃剩下的（同饼环 PIE-02/PIE-13），横竖分开。
       纵向带只需装下一行（开了 axisValue 则两行）标签，与容器无关；横向带才吃剩余宽度。 */
    const gap = tokenNum(plotHost, '--size-radar-label-gap') || 4;
    const handleOffset = handleSize / 2;
    /* [RADAR-18] 数据点落在手柄朝圆心一侧的边缘：手柄中心沿轴外移一个半径。
       手柄是数据图元，不参与轴标签排版；标签仍按 RADAR-07 的原始 gap 锚定。 */
    const nameLineH = tokenNum(plotHost, '--line-height-radar-label-name') || 16;
    const valueLineH = tokenNum(plotHost, '--line-height-radar-label-value') || 16;
    const bandV = gap + nameLineH + (showAxisValue ? valueLineH : 0);
    const { R, bandH, width, height, minHeight } = radarFrame(availW, availH, {
      maxRadius: tokenNum(plotHost, '--size-radar-radius') || 80,
      maxBandH: tokenNum(plotHost, '--size-radar-label-band') || 56,
      bandV,
    });

    /* [RADAR-01][COLOR-04] 按**可见**系列画，颜色不参与重算（色槽由声明序号定死）。 */
    const visible = resolved.filter((r) => !state.hidden.has(r.name));
    const n = dimensions.length;
    const angles = axisAngles(n);
    const step = (Math.PI * 2) / n;
    /* [RADAR-04][RADAR-17] 一把标尺贯穿全部维度；niceSplit 经参数注入，几何模块保持零 import。 */
    const domain = radarDomain(visible.map((r) => r.data), { max, segments }, niceSplit);
    /* [RADAR-04] 值 → 半径复用 L1 的通用比例尺：linearY(split, R, 0) 即 min→0、max→R。
       函数名带 Y 但数学是通用的，故不在本族另写一份（AGENTS.md「参数化 L1，不要在 L2 另写」）。 */
    const toRadius = linearY(domain, R, 0);

    /* [RADAR-09] **画布 = 图元外接框，不吃满容器宽**——同 PIE-02：多出来的画布不会让图元
       变大，只会变成随容器浮动的死空间。宽高由 radarFrame 分别算出，故不是正方形。 */
    const frame = createFrame(plotHost, {
      width, height, xBand: false,
      minGridHeight: 0, /* 画布已按图元算好，别被轴图的最小网格高抬高（那会造出死空间） */
    });
    const cx = frame.grid.left + frame.grid.width / 2;
    const cy = frame.grid.top + frame.grid.height / 2;
    const at = (a, r) => { const p = pointAt(a, r); return { x: cx + p.x, y: cy + p.y }; };

      /* name 是这组数据的语义名称：本族气泡标题恒为维度名或系列名（RADAR-10/11），
       故它只作画布的可访问名，不进气泡（同 PIE-05「不给就整行不渲染」的反面情形）。 */
    /* [RADAR-18] 可调节形态包含真正的 slider 子控件，不能把整张 SVG 声明成不可拆的 img，
       否则辅助技术会把后代全部压成纯呈现节点。 */
    if (name) frame.svg.attr('role', editable ? 'group' : 'img').attr('aria-label', name);
    const root = frame.svg.append('g').attr('class', 'dv-radar');

    /* ── [RADAR-03] 网格环带 + 环线 + 径向轴 ────────────────────────────────── */
    const gridLayer = root.append('g').attr('class', 'dv-radar-grid');
    const radii = ringRadii(domain, R);   /* 由内向外 */

    /* 一条闭合轮廓的路径（圆或正多边形），供环带与环线共用一份几何。 */
    const outline = (r) => {
      const poly = gridPath(gridShape, r, angles);
      /* 圆用两段半圆弧闭合；A 的 sweep 取 0 与下方内圈相同，方向一致才好推理 */
      if (poly === null) return `M${cx - r},${cy}A${r},${r} 0 1,0 ${cx + r},${cy}A${r},${r} 0 1,0 ${cx - r},${cy}Z`;
      return `M${poly.map((p) => `${cx + p.x},${cy + p.y}`).join('L')}Z`;
    };

    /* [RADAR-03] **间隔填充是「一环一色」的环带，不是整圆**。
       ⚠️ 曾经直接给整圆上 fill：内圈的圆会盖住外圈，填充一路铺到圆心，
       看起来像"中间几环全被涂满"。正确做法是外轮廓 + 内轮廓两条子路径，
       用 fill-rule="evenodd" 把内圈挖空，得到真正的圆环。
       由外向内数第 k 条带，奇数条带上色；**最外圈恒为页面底色**（不填）。 */
    radii.forEach((rOuter, i) => {
      if ((radii.length - 1 - i) % 2 !== 1) return;
      const rInner = i > 0 ? radii[i - 1] : 0;
      gridLayer.append('path').attr('class', 'dv-radar-band')
        .attr('fill-rule', 'evenodd')
        .attr('d', rInner > 0 ? outline(rOuter) + outline(rInner) : outline(rOuter));
    });

    /* 环线只描边、不填充，画在环带之上 */
    radii.forEach((r) => gridLayer.append('path').attr('class', 'dv-radar-ring').attr('d', outline(r)));
    /* [RADAR-02] 径向轴：自圆心到最外圈，每维度一根 */
    angles.forEach((a) => {
      const p = at(a, R);
      gridLayer.append('line').attr('class', 'dv-radar-axis')
        .attr('x1', cx).attr('y1', cy).attr('x2', p.x).attr('y2', p.y);
    });

    /* ── [RADAR-05][RADAR-06] 系列闭合形状 ───────────────────────────────────── */
    /* [RADAR-06] **面与线分两层，面全在下、线全在上**。
       同一个 <g> 里「面 + 线」逐系列叠的话，后一个系列那层 10% 的面会盖在前一个系列的**线**上，
       线被冲淡一档；谁被冲淡纯看声明顺序，是个说不出道理的差别。分层后没有任何线会被面压。
       层内**倒序追加**：声明在前的系列后画、压在最上——「最前面的线层级最高」。
       两层都用同一个 dataset.key 认领系列，故弱化 / 钉住 / 点击照旧按 key 走。 */
    const areaLayer = root.append('g').attr('class', 'dv-radar-area-layer');
    const seriesLayer = root.append('g').attr('class', 'dv-radar-series-layer');
    /* [RADAR-05] 曲线档用闭合基数样条；直线档用闭合折线。**曲线档默认隐藏圆点**（基线 8.4）。 */
    const curved = shape === 'curve';
    const pathOf = line().x((p) => p.x).y((p) => p.y).curve(curved ? curveCardinalClosed : curveLinearClosed);
    const grow = [];
    /* [RADAR-18] 每系列保留唯一重绘入口：入场动效与拖动调值都调用它，避免两套 path 装配漂移。 */
    const renderers = new Map();
    [...visible].reverse().forEach((r) => {
      const g = seriesLayer.append('g').attr('class', 'dv-radar-series');
      g.node().dataset.key = r.name;
      g.attr('style', `--dv-radar-color: var(${r.colorVar})`);
      const area = areaLayer.append('path').attr('class', 'dv-radar-area')
        .attr('style', `--dv-radar-color: var(${r.colorVar})`);
      area.node().dataset.key = r.name;
      const stroke = g.append('path').attr('class', 'dv-radar-line');
      const dots = curved ? null : g.append('g').attr('class', 'dv-radar-points');

      /* [RADAR-12] 逐帧重绘闭包：顶点 i 在 t ∈ [i/n, (i+1)/n] 区间内由圆心长到终点，
         于是整条闭合形状**按顺时针依次出现**（基线 10.1）。单一进度派生、各顶点不各自计时。 */
      const renderer = { handles: null, anchors: null, draw: null };
      const draw = (t) => {
        /* 数据在可调节态会原地换值，故终点在每次重绘时算；仍只走 geometry.js 这一份映射。 */
        const finalPts = seriesPoints(r.data, domain, R, angles);
        const pts = finalPts.map((p, i) => {
          const vt = Math.max(0, Math.min(1, t * n - i));
          return { x: cx + p.x * vt, y: cy + p.y * vt };
        });
        const d = pathOf(pts);
        area.attr('d', d);
        stroke.attr('d', d);
        if (dots) {
          const sel = dots.selectAll('circle').data(pts);
          sel.enter().append('circle').attr('class', 'dv-radar-point').merge(sel)
            .attr('cx', (p) => p.x).attr('cy', (p) => p.y);
          sel.exit().remove();
        }
        if (renderer.handles) {
          renderer.handles.attr('transform', (_, i) => {
            const offset = pointAt(angles[i], handleOffset);
            const degrees = (angles[i] * 180) / Math.PI;
            /* [RADAR-18] 箭头的局部 0° 方向是竖直轴；随径向轴顺时针旋转，而非全图恒 0°。 */
            return `translate(${pts[i].x + offset.x},${pts[i].y + offset.y}) rotate(${degrees})`;
          });
        }
        if (renderer.anchors) {
          renderer.anchors.attr('cx', (_, i) => pts[i].x).attr('cy', (_, i) => pts[i].y);
        }
      };
      renderer.draw = draw;
      renderers.set(r.name, renderer);
      draw(1);
      grow.push(draw);
    });

    /* ── [RADAR-07][RADAR-14] 轴标签：常规八向横排；可调节态沿外围圆弧排布 ────── */
    const labelLayer = root.append('g').attr('class', 'dv-radar-labels');
    /* [RADAR-07] 标签可用宽：**按画布实际剩余的横向空间算，不按标签带**（见上方画布宽度的说明）。
       正上 / 正下那两根轴的标签以圆心为中线左右摊开，故两侧各有半个画布宽可用。
       「轴标签整体范围不可超出图内区域」（基线 7.2）由这个上限保证。 */
    const sideRoom = bandH - gap;
    const widthFor = (a) => (Math.abs(Math.sin(a)) < 1e-9 ? width / 2 : sideRoom);
    /* [RADAR-14] 每个标签占相邻轴夹角的 76%，三轴时封顶 60°，既保留轴间断口，也让
       4 字中文标签有可见但不过度的曲率。弧长同时作为截断上限，显示与测量同一几何。 */
    const arcSpan = Math.min(step * 0.76, Math.PI / 3);
    const arcMaxWidth = (R + gap) * arcSpan;
    /* [PIE-16 同法] 超宽走 truncateBatch 截断——整条丢弃等于丢掉一个维度的身份。
       measure 的第二参按 entry 传类名，两段字号不同故各量各的（#32 加宽的那个签名）。 */
    const nameRows = dimensions.map((label, i) => ({
      text: String(label), maxWidth: editable ? arcMaxWidth : widthFor(angles[i]),
    }));
    const names = truncateBatch(nameRows, (texts) => measureTexts(plotHost, texts, NAME_CLASS));
    const nameInk = editable
      ? measureInk(plotHost, names.map((entry) => entry.text ?? ''), NAME_CLASS)
      : [];
    const valueTextByDimension = [];
    const labelDefs = editable ? root.append('defs') : null;
    dimensions.forEach((label, i) => {
      const g = labelLayer.append('g').attr('class', 'dv-radar-label');
      const nameText = names[i].text;
      if (editable) {
        const arc = labelArc(angles[i], R, gap, arcSpan, nameInk[i]?.ascent ?? 0);
        const pathId = `dv-radar-label-arc-${instanceId}-${i}`;
        const pathD = `M${cx + arc.start.x},${cy + arc.start.y}A${arc.radius},${arc.radius} 0 0 ${arc.sweep} ${cx + arc.end.x},${cy + arc.end.y}`;
        labelDefs.append('path').attr('id', pathId).attr('d', pathD);
        if (nameText != null) {
          g.append('text').attr('class', NAME_CLASS)
            .append('textPath').attr('href', `#${pathId}`)
            .attr('startOffset', '50%').attr('text-anchor', 'middle')
            .text(nameText);
        }
        if (names[i].truncated) g.append('title').text(String(label));
        return;
      }

      const a = labelAnchor(angles[i], R, gap);
      /* [RADAR-07] axisValue 开启时名称下方加一行数值；**与交互无关**（基线 7.2 的
         「此时不可交互」已被 Figma 设计源推翻，见 specs/radar.md RADAR-07）。 */
      const rows = [{ text: nameText, cls: NAME_CLASS }];
      if (showAxisValue && visible.length) {
        rows.push({ text: visible.map((r) => format(r.data[i])).join(' / '), cls: VALUE_CLASS });
      }
      const lineH = tokenNum(plotHost, '--line-height-radar-label-name') || 16;
      /* 两行时整块以锚点为基准上下展开，保持标签块仍贴着径向轴末端 */
      const shift = rows.length > 1 && a.baseline === 'auto' ? -(rows.length - 1) * lineH : 0;
      rows.forEach((row, k) => {
        if (row.text == null) return;
        const text = g.append('text').attr('class', row.cls)
          .attr('x', cx + a.x).attr('y', cy + a.y + shift + k * lineH)
          .attr('text-anchor', a.textAnchor).attr('dominant-baseline', a.baseline)
          .text(row.text);
        if (row.cls === VALUE_CLASS) valueTextByDimension[i] = text;
      });
      /* 截断后原名挂 <title>，hover 拿得到完整值（同 LEGEND-13 的兜底） */
      if (names[i].truncated) g.append('title').text(String(label));
    });

    /* ── [RADAR-10] 扇形热区 + 高亮：热区是径向轴区域，不是数据点 ──────────────── */
    const hitLayer = root.append('g').attr('class', 'dv-radar-sectors');
    /* [RADAR-10] 热区外缘**跟着网格形状走**：圆形档是弧，多边形档必须沿多边形的两条半边。
       ⚠️ 两档不能共用弧——多边形档照画弧会让高亮块鼓出网格之外、和边对不齐。 */
    const wedgeVerts = gridPath(gridShape, R, angles);
    const wedge = (i) => {
      if (wedgeVerts === null) {
        const p0 = at(angles[i] - step / 2, R);
        const p1 = at(angles[i] + step / 2, R);
        /* sweep-flag=1 = 屏幕坐标下顺时针，与本族「正角顺时针」同向；n≥3 故 step<π，large-arc 恒 0 */
        return `M${cx},${cy} L${p0.x},${p0.y} A${R},${R} 0 0 1 ${p1.x},${p1.y} Z`;
      }
      const pts = sectorCorners(i, wedgeVerts).map((p) => `${cx + p.x},${cy + p.y}`).join('L');
      return `M${cx},${cy} L${pts} Z`;
    };
    /* [RADAR-18] 可调节态的主交互对象是轴上 slider，不再叠扇形 hover：否则指针在手柄附近
       会同时出现灰色维度块，抢走「正在调哪个点」的视觉主次。拖动时的数值气泡仍由手柄触发。 */
    if (!editable) {
      dimensions.forEach((label, i) => {
        const sector = hitLayer.append('path')
          .attr('class', 'dv-radar-sector').attr('d', wedge(i))
          .attr('tabindex', 0).attr('role', 'button')
          .attr('aria-label', `${label}`);
        const activate = (event) => {
          clearTimeout(hideTimer);
          hitLayer.selectAll('path').classed('is-active', false);
          sector.classed('is-active', true);
          showDimensionTip(i, event);
        };
        sector.on('mouseenter', activate).on('mousemove', activate).on('focus', activate)
          .on('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event); } });
      });
    }
    /* 指针在扇区之间移动时不该闪：整层统一收口，离开绘图区才按 token 延迟隐藏（同 PIE-05 / TREEMAP-07） */
    select(plotHost).on('mouseleave', () => {
      hideTimer = setTimeout(() => {
        hitLayer.selectAll('path').classed('is-active', false);
        tooltip.hide();
      }, tokenNum(plotHost, '--tooltip-hide-delay') || 0);
    });

    /* [RADAR-10] 气泡列「这个维度各系列多少」；位置档恒 follow（TOOLTIP-07 无坐标系图特例，
       三主题一致故在 L2 定死、不进 behavior.json）。 */
    function showDimensionTip(i, event) {
      const rows = visible.map((r) => ({
        key: r.name, label: r.name, type: MARKER_TYPE, colorVar: r.colorVar, value: format(r.data[i]),
      }));
      tooltip.show({ title: String(dimensions[i]), rows }, marker);
      const box = plotHost.getBoundingClientRect();
      /* focus / 键盘事件没有 clientX/Y，回落到当前数据点；否则 tooltip 会收到 NaN 后消失。 */
      let clientX = event?.clientX;
      let clientY = event?.clientY;
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
        const p = seriesPoints(visible[0]?.data ?? [], domain, R, angles)[i] ?? { x: 0, y: 0 };
        const svgBox = frame.svg.node().getBoundingClientRect();
        clientX = svgBox.left + (cx + p.x) * (svgBox.width / width);
        clientY = svgBox.top + (cy + p.y) * (svgBox.height / height);
      }
      const pointer = { x: clientX - box.left, y: clientY - box.top };
      tooltip.place('follow', { grid: frame.grid, cx: pointer.x, pointer });
    }

    /* ── [RADAR-18] 可调节雷达：沿每根径向轴拖动手柄 / 键盘调值 ───────────────── */
    if (editable && visible.length === 1) {
      const r = visible[0];
      const renderer = renderers.get(r.name);
      /* 手柄必须在透明扇形热区之后追加，否则热区会盖住手柄、pointerdown 永远到不了。 */
      const handleLayer = root.append('g').attr('class', 'dv-radar-handles')
        .attr('style', `--dv-radar-color: var(${r.colorVar})`);
      const handles = handleLayer.selectAll('g').data(dimensions.map((label, i) => ({ label, i })))
        .enter().append('g').attr('class', 'dv-radar-handle')
        .attr('tabindex', 0).attr('role', 'slider')
        .attr('aria-valuemin', domain.min).attr('aria-valuemax', domain.max)
        .attr('aria-label', (d) => `${d.label}，${r.name}`);
      handles.append('circle').attr('class', 'dv-radar-handle-hit');
      handles.append('circle').attr('class', 'dv-radar-handle-thumb');
      /* 双箭头只表达「可增 / 可减」，不承担命中；上下两个闭合子路径 = 实色三角形。
         每枚底边 12px、高 5px，两枚相邻底边间净距 2px，整体关于手柄圆心对称。 */
      handles.append('path').attr('class', 'dv-radar-handle-grip')
        .attr('d', 'M-6,-1L0,-6L6,-1ZM-6,1L0,6L6,1Z');
      renderer.handles = handles;
      /* [RADAR-18] 曲线不自带常规系列圆点，但可调节态仍需显出「曲线真实数据点 ↔ 手柄内缘」
         的接点。接点最后追加到手柄之上，保证完整 4×4 圆点不会被手柄遮掉。 */
      if (curved) {
        renderer.anchors = root.append('g').attr('class', 'dv-radar-edit-anchors')
          .selectAll('circle').data(dimensions).enter().append('circle')
          .attr('class', 'dv-radar-edit-anchor');
      }

      const refreshHandleA11y = () => handles
        .attr('aria-valuenow', (d) => r.data[d.i])
        .attr('aria-valuetext', (d) => format(r.data[d.i]));

      const emitEdit = (i, rawValue, event) => {
        const value = snapRadarValue(rawValue, domain.max, editStep);
        const changed = !Object.is(value, r.data[i]);
        if (changed) {
          r.data[i] = value;
          renderer.draw(1);
          refreshHandleA11y();
          if (valueTextByDimension[i]) valueTextByDimension[i].text(format(value));
        }
        hitLayer.selectAll('path').classed('is-active', (_, k) => k === i);
        showDimensionTip(i, event);
        if (changed && typeof onChange === 'function') {
          onChange({
            series: r.name, dimension: dimensions[i],
            seriesIndex: r.seriesIndex, dimensionIndex: i,
            value, data: [...r.data],
          });
        }
      };

      const localPointer = (event) => {
        const box = frame.svg.node().getBoundingClientRect();
        const sx = width / box.width;
        const sy = height / box.height;
        return { x: (event.clientX - box.left) * sx, y: (event.clientY - box.top) * sy };
      };

      handles.on('pointerdown', function (event, d) {
        event.preventDefault();
        event.stopPropagation();
        /* SVG 子图元被点中时浏览器不一定把焦点交给带 tabindex 的父 <g>；显式聚焦后，
           拖完无需再 Tab 一次即可接着用方向键微调。 */
        this.focus();
        stopGrow();
        renderer.draw(1);
        const handle = select(this).classed('is-dragging', true);
        const move = (e) => {
          const raw = radarValueAt(localPointer(e), cx, cy, angles[d.i], domain, R, handleOffset);
          emitEdit(d.i, raw, e);
        };
        const up = () => {
          handle.classed('is-dragging', false);
          window.removeEventListener('pointermove', move, true);
          window.removeEventListener('pointerup', up, true);
          window.removeEventListener('pointercancel', up, true);
          stopDrag = () => {};
        };
        stopDrag();
        stopDrag = up;
        move(event);
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', up, true);
        window.addEventListener('pointercancel', up, true);
      }).on('keydown', function (event, d) {
        const keyStep = Number.isFinite(editStep) && editStep > 0 ? editStep : domain.max / domain.segments;
        let next = r.data[d.i];
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next += keyStep;
        else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next -= keyStep;
        else if (event.key === 'Home') next = domain.min;
        else if (event.key === 'End') next = domain.max;
        else return;
        event.preventDefault();
        event.stopPropagation();
        emitEdit(d.i, next, event);
      }).on('focus', (_, d) => {
        hitLayer.selectAll('path').classed('is-active', (_, k) => k === d.i);
      });

      renderer.draw(1);
      refreshHandleA11y();
    }

    /* [RADAR-11] 点多边形 = 钉住该系列；气泡改列「这个系列各维度多少」。
       与 RADAR-10 的扇形 hover 互不冲突——一个问维度、一个问系列。 */
    seriesLayer.selectAll('g.dv-radar-series').on('click', function (event) {
      const key = this.dataset.key;
      pinSeries(state.selected === key ? null : key);
      if (state.selected) {
        const r = visible.find((x) => x.name === key);
        const rows = dimensions.map((label, i) => ({
          key: String(label), label: String(label), type: MARKER_TYPE,
          colorVar: r.colorVar, value: format(r.data[i]), showMarker: false,
        }));
        tooltip.show({ title: key, rows }, marker);
        const box = plotHost.getBoundingClientRect();
        const pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
        tooltip.place('follow', { grid: frame.grid, cx: pointer.x, pointer });
      }
      event.stopPropagation();
    });

    applyDim();

    /* [RADAR-10] 水印置顶：build 末尾追加 = DOM 顺序最上。锚 frame.grid——本族的 grid 就是整块画布。 */
    if (wm) renderWatermark(frame.svg.append('g').attr('class', 'dv-watermark-layer'), frame, { spec: wm, mode: modeOf(host) });

    /* [RADAR-09] 容器最小高度：**图元触底时的画布 + 图例 + 间距**。低于它，顶部轴标签会
       叠进图例（实测容器 158px 时叠 9px）。值由 L2 算、约束由 CSS 表达（同饼环
       `--dv-pie-legend-max-h` 的分工）；容器再被拖小就溢出滚动，不再压缩图元——
       同 PIE-02「看得见但装不下，优于装得下但看不清」。 */
    host.style.setProperty('--dv-radar-min-h', `${Math.ceil(minHeight + legendH)}px`);

    selfHeight = host.clientHeight;

    /* ── [RADAR-12][MOTION-01/04/07] 入场：顺时针依次出现，只在首次挂载播 ────────── */
    const animate = animation && firstBuild && grow.length > 0 && !reducedMotion();
    firstBuild = false;
    if (!animate) return;
    /* [RADAR-12] **轴标签自始至终可见，只有闭合形状生长**——这就是 [MOTION-05] 的主句
       「只有数据图元生长，坐标系与附属元素直接就位」：轴标签在本族的地位等同直角坐标系的
       轴标签，是图元赖以被读懂的参照系，与数据无关。
       MOTION-05 那条「**数据标签**整层先藏、结束后出现」的例外不适用——本族没有数据标签；
       axisValue 的数值是轴标签的第二行、与名称同生共死，跟着参照系一起在第 0 帧就位。 */
    grow.forEach((draw) => draw(0));  /* 先落零帧，避免首帧闪出终态再跳回起点 */
    stopGrow = runGrowth(
      tokenNum(plotHost, '--motion-duration-grow'),  /* [MOTION-02] 全站统一时长，不按图表分档 */
      (t) => grow.forEach((draw) => draw(t)),
    );
  }

  build();
  const stop = observeResize(host, () => {
    /* [RADAR-09] 默认尺寸建立后，**外部**改高才切容器适配；基线是本组件上一次产出的高度，
       故自变（图元自己长高）天然被排除，不会逐帧坍缩（同 PIE-02 记的那个坑）。 */
    if (!usesContainerHeight && containerTookOver(host.clientHeight, selfHeight)) usesContainerHeight = true;
    build();
  });

  return {
    /* [RADAR-18] 无回调场景也能在提交时读取当前编辑结果；始终返回副本，不泄露内部可变数组。 */
    getData: () => resolved.map((r) => ({ name: r.name, data: [...r.data] })),
    destroy: () => {
      stopGrow();
      stopDrag();
      clearTimeout(hideTimer);
      stop();
      host.classList.remove('dv-chart', 'dv-chart--radar');
      host.style.removeProperty('--dv-radar-min-h'); /* 同修饰类：残留会影响下一个挂上来的组件 */
      resolved.forEach((r) => host.style.removeProperty(r.colorVar));
      host.innerHTML = '';
    },
  };
}
