/*
 * radar/geometry.js —— 【轴角均分 + 值→半径 + 网格环 + 绕圆标签锚点 / 弧线 + 扇形命中】
 * [L2-LOCAL] 图表专属，本期有意不下沉 L1（[RADAR-02][RADAR-03][RADAR-04][RADAR-07][RADAR-09][RADAR-10][RADAR-14][RADAR-18]）
 *
 * 干什么：把「每根轴指向哪、值该落在多远、网格环画多大、标签摆在哪、指针落在第几个扇形」
 * 算成**纯数据**，交给 index.js 去画。不碰 DOM、不碰 d3、不碰 token、**零 import**——
 * 故可被 `node --test` 直接加载（同 pie/geometry.js、cartesian/layout.js）。
 *
 * 角度约定与 pie/geometry.js 同源：**0 弧度 = 12 点方向，正角顺时针**；圆心为原点，
 * 故任一角 a 处半径 r 的点是 (sin(a)·r, −cos(a)·r)——见 pointAt()。
 *
 * ── 将来下沉 L1 的三个点（满足各自消费方条件时才动，别提前抽象）────────────
 *
 * 下沉点 ①：axisAngles / seriesPoints / ringRadii —— 极坐标骨架
 *   判断条件：出现**第二个**「角度按 360/n 均分、数据映射到半径」的图型。
 *   会触发：玫瑰图 / 南丁格尔图。
 *   不会触发：极坐标柱状图——它的角度方向是一根真正的轴（一根 angleAxis 上排若干类目），
 *             不是均分出来的常量位置；看着像，数学不是一回事。
 *
 * 下沉点 ②：labelAnchor / labelArc —— 绕圆文字的锚点与可读弧线
 *   判断条件：出现**第二个**需要「把文字摆在圆周上、决定对齐方式或生成可读弧线」的图型。
 *   会触发：**仪表盘**（刻度标签沿弧排布，问题与雷达维度标签完全相同）。
 *   饼环不算：pie 的 labelAnchor 吃的是一个扇区的两个角、只分左右两侧，没有八向逻辑。
 *   ⚠️ 故两个函数都只收角度、半径等纯几何参数，不收 dimensions / series / cfg——
 *      命中时是「移动纯函数」，不是重写。改签名前先想清楚这件事。
 *
 * 下沉点 ③：radarFrame 的标签带「吃剩下的」公式
 *   判断条件：出现**第三个**需要「图元先占位、标签带吃剩余空间并封顶」的图型。
 *   现有两个消费方是 pie/geometry.js 的 labelBand 与本族 radarFrame；公式虽同，调用形态不同。
 *   第三个消费方出现时不要再抄第四份，应连同调用形态一起收进 L1。
 *
 * 三个下沉点互相独立，命中 ② 不代表 ① 也该动。
 * gridPath 与 sectorAt **不在下沉候选内**：闭合整环只有雷达要，而 sectorAt 整个算法
 * 建立在「角度均分」这个雷达专属前提上。
 * 完整判据与规范见 specs/radar.md 的「分层边界」。
 */

const TAU = Math.PI * 2;

/*
 * [RADAR-09] 半径收缩的**下限比例**：R 不小于 `--size-radar-radius` 的这个比例（50%）。
 * **取比例不取像素**，跟着各主题自己的 token 走，故不进 token——同 pie 的 MIN_RADIUS_RATIO、
 * BAR-03 柱与间距的 2:1。没有下限时容器越拖越小、网格一路缩到几像素，那时形状已无法分辨，
 * 不如让它溢出容器由调用方决定裁剪。
 */
const MIN_RADIUS_RATIO = 0.5;

/* [RADAR-03] 网格分段下限（基线 6.2「最少为 2 段」）。1 段只剩一个外圈，没有参考可言。 */
const MIN_SEGMENTS = 2;

/* [RADAR-01] 维度数下限（基线 1.2「并列维度应大于 2」）。两根轴构不成面积，读不出形状。 */
export const MIN_DIMENSIONS = 3;

const clamp = (lo, v, hi) => Math.max(lo, Math.min(v, hi));

/*
 * 极坐标 → 直角坐标（相对圆心）。**全族唯一一处三角公式**，别在别处再写一遍。
 * a = 0 指向 12 点，正角顺时针；y 轴向下为正，故 cos 前带负号。
 */
export function pointAt(a, r) {
  return { x: Math.sin(a) * r, y: -Math.cos(a) * r };
}

/*
 * [RADAR-02] n 根径向轴的角度：首轴恒在 12 点方向（0 弧度），其余按 360/n 均分、顺时针。
 */
export function axisAngles(n) {
  return Array.from({ length: n }, (_, i) => (i * TAU) / n);
}

/*
 * [RADAR-04] 径向值域：**两条路**。
 *   给了 max → 以它为准，[0, max] 均分 segments 段；
 *   没给     → 注入的 niceSplit 按 lineCount = segments + 1 求 nice 上界。
 *
 * 为什么必须留 max 这个口子（实测）：niceSplit(0, 5, { lineCount: 4 }) 得到 max 5.4。
 * 一个「0–5 分综合评分」雷达会被画成 0–5.4，且**两张图数据不同时量程不同、形状不可比**,
 * 而横向对比正是雷达图存在的理由。评分类量程是业务口径，不是算出来的。
 *
 * **niceSplit 经参数注入**（同 motion.js 注入时钟、label.js 注入测量函数的做法）：
 * 本模块因此保持零 import，`node --test` 直接可加载。
 *
 *   seriesData  [[v,...], ...] 各系列的值数组；null / 负值不参与求 max（[RADAR-01]）
 * → { min: 0, max, segments }
 */
export function radarDomain(seriesData, { max, segments = 5 } = {}, niceSplit) {
  const segs = Math.max(MIN_SEGMENTS, Math.floor(segments) || MIN_SEGMENTS);
  if (max != null && Number.isFinite(max) && max > 0) return { min: 0, max, segments: segs };

  /* [RADAR-01] 只有有限正值参与自动求上界；全空时给 1 兜底，避免零宽值域 */
  let dataMax = 0;
  for (const row of seriesData) {
    for (const v of row) if (Number.isFinite(v) && v > dataMax) dataMax = v;
  }
  if (dataMax <= 0) return { min: 0, max: 1, segments: segs };
  const split = niceSplit(0, dataMax, { lineCount: segs + 1 });
  return { min: 0, max: split.max, segments: segs };
}

/*
 * [RADAR-09] 画布几何：**半径先按容器定，标签带吃剩下的**——与饼环 PIE-02 / PIE-13 同一口径，
 * 且和它一样**横竖分开**（PIE-02 原文：「宽 = 2×标签带 + 2R、高 = 2×max(R, 最外标签的 |y|)」）。
 *
 * 为什么横竖不能共用一个带：上下两根轴的标签是**一行字**（约一个行高），左右的却是**整串横排**
 * ——四个汉字 @12px 就要 48px。用同一个带，要么左右截断、要么上下白白多出一截空带。
 *
 * 顺序（无循环依赖）：
 *   ① bandV = 行高 × 行数 + 间距        ← 上下要多高，看文字本身，与容器无关
 *   ② R = clamp(下限, min(宽/2, (高 − 2·bandV)/2), maxRadius)
 *   ③ bandH = clamp(0, (宽 − 2R)/2, maxBandH)   ← 横向带吃剩下的，封顶而非定值
 *   ④ 画布 = 2(R + bandH) × 2(R + bandV)         ← 图元外接框，不吃满容器
 *
 * 缩小容器时**标签带先被挤掉、半径后缩**，画布始终不超过容器；R 触到 50% 下限后改为溢出，
 * 由调用方裁剪（PIE-02「看得见但装不下，优于装得下但看不清」）。
 * ⚠️ 曾经反着做：固定扣 2×40 的带再 clamp R，且画布宽吃满容器宽。后果是容器一小就过早溢出
 * （实测 280×220 即溢出，饼环同尺寸安好），且宽方向多出的画布变成随容器浮动的死空间。
 *
 * ⚠️ **下沉候选**：`(avail − 2R)/2` 封顶这条「带吃剩下的」公式，`pie/geometry.js` 的
 * `labelBand()` 已有一份。两族都是 [L2-LOCAL]、互不可 import（分层守卫禁 L2→L2），
 * 故此处是同式而非复用。**出现第三个消费方时应下沉 L1**，别再抄第三份。见 specs/radar.md。
 */
export function radarFrame(width, height, { maxRadius, maxBandH, bandV }) {
  const R = clamp(maxRadius * MIN_RADIUS_RATIO, Math.min(width / 2, (height - 2 * bandV) / 2), maxRadius);
  const bandH = clamp(0, (width - 2 * R) / 2, maxBandH);
  /* [RADAR-09] 图元**触底时**的高度 = 2×(下限半径 + 纵向带)。调用方拿它推容器最小高度，
     免得在别处再抄一遍 50% 这个比例（抄一遍就等于多一处会漂的常量）。 */
  const minHeight = 2 * (maxRadius * MIN_RADIUS_RATIO + bandV);
  return { R, bandH, bandV, width: 2 * (R + bandH), height: 2 * (R + bandV), minHeight };
}

/*
 * [RADAR-03] 网格环半径，由内向外，共 segments 圈（最外圈 = R）。
 */
export function ringRadii(domain, R) {
  const { segments } = domain;
  return Array.from({ length: segments }, (_, i) => (R * (i + 1)) / segments);
}

/*
 * [RADAR-03] 一圈网格的形状。
 *   'circle'  → null，调用方画 <circle r={r}>（默认档）
 *   'polygon' → 各轴方向上的点，调用方连成闭合多边形
 */
export function gridPath(shape, r, angles) {
  if (shape === 'circle') return null;
  return angles.map((a) => pointAt(a, r));
}

/*
 * [RADAR-01][RADAR-17] 一条系列的闭合点集。**全部维度共用同一把标尺 domain**——
 * 不做逐轴归一化，理由见 specs/radar.md RADAR-17（逐轴各自量程会让图形面积失去意义）。
 * null / 非数 / 负值一律落在圆心（半径 0），既不断开闭合形状，也不伪造面积。
 */
export function seriesPoints(values, domain, R, angles) {
  return values.map((v, i) => {
    const r = Number.isFinite(v) && v > 0 ? clamp(0, (v / domain.max) * R, R) : 0;
    return pointAt(angles[i], r);
  });
}

/*
 * [RADAR-18] 指针位置 -> 某一径向轴上的值。
 *
 * 拖动手柄不是取「指针到圆心的距离」：那会让指针只要横向偏出去，值也跟着虚增。
 * 正确口径是把圆心到指针的向量**正交投影**到目标轴，再夹在 [0, R] 内；因此手指不必
 * 像素级贴着细轴移动，但只有沿轴方向的位移会改变值。
 *
 * pointAt() 给出的轴单位向量是 (sin(a), -cos(a))，与指针向量点积就是带符号投影长度。
 * 返回原始连续值；是否按业务步长吸附由 snapRadarValue() 单独负责。
 */
export function radarValueAt(pointer, cx, cy, angle, domain, R, handleOffset = 0) {
  if (!(R > 0) || !(domain?.max > 0)) return 0;
  const dx = pointer.x - cx;
  const dy = pointer.y - cy;
  /* [RADAR-18] 手柄圆心比真实数据点沿轴向外偏半径 handleOffset；反算值时须扣回，
     否则在手柄原位按下也会让数值凭空增加一截。 */
  const projected = dx * Math.sin(angle) - dy * Math.cos(angle) - Math.max(0, handleOffset);
  return clamp(0, projected / R, 1) * domain.max;
}

/*
 * [RADAR-18] 可选步长吸附。step 未给 / 非法时保留连续值；给了则吸附到最近一档，
 * 再次夹取保证浮点舍入不会越过 max。小数位按 step 推出，只用于消掉 0.30000000000000004。
 */
export function snapRadarValue(value, max, step) {
  const clamped = clamp(0, Number.isFinite(value) ? value : 0, max);
  if (!(Number.isFinite(step) && step > 0)) return clamped;
  const decimals = Math.min(12, Math.max(0, String(step).split('.')[1]?.length ?? 0));
  const snapped = Number((Math.round(clamped / step) * step).toFixed(decimals));
  return clamp(0, snapped, max);
}

/*
 * [RADAR-07] 轴标签锚点：沿径向轴外延 gap 后的位置 + **按所在方位定的八向对齐**。
 *
 * ⚠️ **签名是契约的一部分**：只收 (angle, radius, gap)，不收 dimensions / series / cfg。
 * 这是为了「下沉点 ②」（仪表盘刻度标签）命中时能整个函数搬进 charts/core/ 而不必重写。
 * 见本文件头。
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
 * [RADAR-14] 可调节雷达的弧形轴标签路径。
 *
 * 默认沿顺时针弧排字，基线的外侧正好朝圆外；落在下半圆时反向，避免文字倒置，并按
 * 真实字形 ascent 外移，让反向路径朝内生长的墨迹仍从 R + gap 之外开始。返回纯几何数据，
 * index.js 只负责装配 <path> / <textPath>。
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
 * [RADAR-10] 多边形网格下，扇形热区的**外缘点**。
 *
 * 为什么单独有这一条：圆形档的外缘是圆弧，多边形档若照抄圆弧，高亮块会**鼓出网格之外**、
 * 和多边形的边对不齐——一眼就看得出错位。
 * 正多边形的角平分线恰好过邻边中点，故第 i 个扇区的外缘是三个点：
 *   前一条边的中点 → 顶点 i → 后一条边的中点
 * 返回相对圆心的坐标，调用方补圆心并闭合成四边形（含圆心那个点）。
 */
export function sectorCorners(i, verts) {
  const n = verts.length;
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  return [mid(verts[(i - 1 + n) % n], verts[i]), verts[i], mid(verts[i], verts[(i + 1) % n])];
}

/*
 * [RADAR-10] 指针落在第几个扇形。热区是**以径向轴为中线的等分扇区**（基线 9.1 的 0728 更新
 * 「hover 热区为径向轴区域」），不是数据点——照数据点命中等于要求像素级瞄准。
 *
 * atan2(dx, −dy) 直接给出「0 = 12 点、正角顺时针」的角，与 pointAt 同一套约定。
 *
 * ⚠️ **圆心必须单独短路**，不能交给 atan2：`-(0)` 求出的是 **−0**，而 `atan2(0, −0)` = π
 * （不是 0），于是正圆心会命中**正对面**那根轴。单测 RADAR-10 就是踩出这条的。
 * 圆心归首轴，与「首轴恒在 12 点」自洽。
 */
export function sectorAt(pointer, cx, cy, n) {
  const dx = pointer.x - cx;
  const dy = pointer.y - cy;
  if (dx === 0 && dy === 0) return 0;
  const a = Math.atan2(dx, -dy);
  const norm = ((a % TAU) + TAU) % TAU;
  return Math.round(norm / (TAU / n)) % n;
}
