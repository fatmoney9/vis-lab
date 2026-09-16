/*
 * L1 · 绕圆标签几何（纯几何，无 DOM、无 d3、无 token）。
 * 权威规范见 specs/radar.md（RADAR-07 / RADAR-14）与 specs/pie.md（PIE-13）。
 *
 * ⚠️ **本模块必须零 import**，这不是风格是硬约束：消费方 pie/geometry.js、radar/geometry.js
 * 都被 `node --test` 直接加载，而 core/frame.js 顶部 `import 'd3'`、core/palette.js 顶层
 * `await fetch` —— 本模块只要接上其中任何一条链路，那几族的单测立刻全红。
 * 同 measure.js / split.js / legend-state.js 的纪律。
 *
 * ── 为什么会有这个模块 ────────────────────────────────────────────
 * 它不是「可能有用所以先抽出来」，而是 specs/radar.md 写死的两个下沉条件同时被兑现：
 *   下沉点②（labelAnchor / labelArc）——「出现第二个需要把文字摆在圆周上、按所在方位
 *     决定对齐方式或生成可读弧线的图型」；
 *   下沉点③（labelBand）——「出现第三个需要图元先占位、标签带吃剩余空间并封顶的图型」。
 * 两条都由弦图（绕圆实体标签 + 横排档标签带）触发。当年把 labelAnchor / labelArc 的签名
 * 定成「只收角度、半径等纯几何参数」，就是为了命中这天能**整个搬过来而不必重写**——
 * 本模块的四个函数确实一个字没改。
 *
 * ── 为什么叫 polar-label 而不是 polar ─────────────────────────────
 * 下沉的只有「绕圆摆文字」和它的基元，不是整个极坐标系。极坐标骨架（角度均分、值→半径、
 * 同心环）仍留在 radar/geometry.js 并标 [L2-LOCAL]，它的下沉条件（下沉点①）尚未命中——
 * 叫 polar.js 会暗示那些也已经在这里，下一个人就不会再去读那条判断条件了。
 *
 * ── 角度约定（三族同源，别在别处重写）──────────────────────────────
 * **0 弧度 = 12 点方向，正角顺时针**；圆心为原点，y 轴向下为正，故 cos 前带负号。
 * 与 d3.arc() 一致，标签因此天然与扇区/弧对得上。
 */

const TAU = Math.PI * 2;

const clamp = (lo, v, hi) => Math.max(lo, Math.min(v, hi));

/*
 * 极坐标 → 直角坐标（相对圆心）。**全库唯一一处三角公式**，别在别处再写一遍。
 * a = 0 指向 12 点，正角顺时针；y 轴向下为正，故 cos 前带负号。
 */
export function pointAt(a, r) {
  return { x: Math.sin(a) * r, y: -Math.cos(a) * r };
}

/*
 * [RADAR-07] 绕圆标签锚点：沿径向外延 gap 后的位置 + **按所在方位定的八向对齐**。
 *
 * ⚠️ **签名是契约的一部分**：只收 (angle, radius, gap)，不收任何图表专属结构。
 * 正因如此它才能在下沉条件命中时整个搬进 L1；改签名前先想清楚这件事。
 *
 * 八向由 sin / cos 的符号定，恰好 3×3 去掉圆心那格：
 *   sin > 0 右侧 → start   · sin < 0 左侧 → end     · sin ≈ 0 正上/正下 → middle
 *   cos > 0 上方 → auto    · cos < 0 下方 → hanging · cos ≈ 0 正左/正右 → central
 * 用 `central` 而不是 `middle` 的理由同 [TOOLTIP-12]：SVG 的 middle 对齐的是
 * 「字母基线 + 半个 x-height」，而标签里是汉字与数字、高度远超 x-height，用 middle 会整体上浮。
 */
export function labelAnchor(angle, radius, gap) {
  const r = radius + gap;
  const { x, y } = pointAt(angle, r);
  const sx = Math.sin(angle);
  const cy = Math.cos(angle);
  const TOL = 1e-9;
  return {
    x,
    y,
    textAnchor: sx > TOL ? 'start' : sx < -TOL ? 'end' : 'middle',
    baseline: cy > TOL ? 'auto' : cy < -TOL ? 'hanging' : 'central',
  };
}

/*
 * [RADAR-14] 绕圆文字的弧形路径。
 *
 * 默认沿顺时针弧排字，基线的外侧正好朝圆外；落在下半圆时反向，避免文字倒置，并按
 * 真实字形 ascent 外移，让反向路径朝内生长的墨迹仍从 radius + gap 之外开始。
 * 返回纯几何数据，调用方负责装配 <path> / <textPath>。
 *
 * 返回的 length 就是这条弧自己的可用宽——**下半圆的弧因 ascent 外移而更长**，
 * 调用方须按每条弧各自的 length 做截断预算，统一按 radius + gap 估一个数会把下半圆白白截短。
 */
export function labelArc(angle, radius, gap, span, inkAscent = 0) {
  const normalized = ((angle % TAU) + TAU) % TAU;
  const reversed = normalized > Math.PI / 2 && normalized < (Math.PI * 3) / 2;
  const arcSpan = clamp(0, Number.isFinite(span) ? span : 0, Math.PI - 1e-6);
  const r = Math.max(0, radius + gap + (reversed ? Math.max(0, inkAscent) : 0));
  const half = arcSpan / 2;
  const startAngle = reversed ? angle + half : angle - half;
  const endAngle = reversed ? angle - half : angle + half;
  const start = pointAt(startAngle, r);
  const end = pointAt(endAngle, r);
  const sweep = reversed ? 0 : 1;
  return {
    d: `M${start.x},${start.y}A${r},${r} 0 0 ${sweep} ${end.x},${end.y}`,
    radius: r,
    length: r * arcSpan,
    reversed,
    start,
    end,
    sweep,
  };
}

/*
 * [PIE-13][RADAR-09] 标签带「吃剩下的」：图元（直径 2R）先占位，标签带拿走剩余空间的一半，
 * 再按 maxBand 封顶。缩小容器时**标签带先被挤掉、半径后缩**，故调用方须先定 R 再调本函数。
 *
 * 为什么封顶而不是定值：定值会让窄容器过早溢出，而宽容器里多出的带宽变成随容器浮动的死空间。
 * 为什么不出负数：容器比图元还窄时带宽归 0，由调用方决定是截断还是让图元溢出。
 *
 * **本函数不取整**。像素取整是某一族的版面意图（见 PIE-13「让画布落在整像素上」），
 * 不是这条公式的一部分；需要的族在自己那侧包一层 Math.floor。
 * 注：maxBand 取自像素 token（整数）时，floor(min(x, maxBand)) 与 min(floor(x), maxBand) 同值，
 * 故包一层与原先内联取整在实际取值下完全等价。
 */
export function labelBand(avail, R, maxBand = Infinity) {
  return Math.max(0, Math.min((avail - 2 * R) / 2, maxBand));
}
