import { tokenNum } from './tokens.js';
import { measureTexts } from './measure.js';
import { renderAxisLabelLines } from './axis.js';

/*
 * L1 · 图表标注 callout（强调环 + 多行文字 + 带箭头曲线引线）。
 * 权威规范见 specs/callout.md（CALLOUT-01..16）。
 *
 * 与 label.js / watermark.js / mark.js 一致：接收调用方传入的 d3 selection，
 * 本模块**不 import d3**（顺带使下面全部纯几何函数可被 node --test 直接加载）。
 * 三个 import 都是零 d3 的 L1 横向复用（axis.js 那条的先例是 crosshair.js）。
 *
 * ── 职责边界 ──────────────────────────────────────────────────────
 * 本模块收「**已经解析好的像素锚点** + 文案 + 障碍矩形」，负责选位、算路径、画 DOM。
 * 「哪个数据点 → 哪个像素」留在 L2（CALLOUT-02）——那要懂 band 尺、双 Y、datazoom 窗口
 * 与图例隐藏，全是图表专属知识。本模块不认识柱和线，**只认识矩形**。
 *
 * ── 为什么叫 callout 而不是 mark-point ─────────────────────────────
 * core/mark.js 已经是「图元（柱 / 线 / 数据点）」，且 WORKFLOW.md 第五节的 ID 前缀表里
 * `MARK-` 正是给它预留的空号段。本模块画的是**批注**不是图元，名字必须把这条边界写清楚，
 * 否则两个相邻文件名会让下一个人以为是同一族。
 *
 * ── ⚠️ 单向无环，改动前必读（CALLOUT-10）─────────────────────────
 * 流水线严格一趟，不迭代、不做收敛判断：
 *     文案 → 定宽折行 → 批量测量 → 块尺寸 → 候选枚举 → 打分 → 选位 → 引线 → DOM
 * **块尺寸不由可用空间反推**——折行宽锚 token 常量 `--size-callout-max-width`，
 * 与 bounds / 障碍物 / 其它标注全都无关。
 * 这是 charts/charts/pie/geometry.js `alignOutside` 那段注释的直接套用：那里
 * 「带宽由文本宽反推 ↔ 文本按带宽截断」互为因果，靠「带宽由容器定死、单向一趟」才切断。
 * 标注会踩的是同一个环的变体：「选位依赖块尺寸 ↔ 块尺寸依赖可用空间」。
 * **想让折行宽跟着剩余空间走之前，先把那段注释读完。**
 *
 * ── 为什么不复用 axis.js 的 wrapAxisLabel ──────────────────────────
 * 它被 [AXIS-04] 限死**最多两行**、超出的余文并回末行——那是 X 轴名称的叙事规则，
 * 不是通用折行器。标注是整句话，参考稿就折了四行。故本模块自带 wrapByWidth，
 * 但**逐行 tspan 的装配仍复用 axis.js 的 renderAxisLabelLines**，不另造一份。
 *
 * ⚠️ 仓库有两个参数顺序不一致的私有 clamp：polar-label.js / radar/geometry.js /
 * chord/layout.js 是 (lo, v, hi)，tooltip.js 是 (v, lo, hi)。本模块取**多数派 (lo, v, hi)**。
 */

const TEXT_CLASS = 'dv-callout-text';

/* 数值判定用的浮点容差：方位向量的分量只有 0 / ±1 / ±√2/2，1e-9 足够把「正交」与「斜向」分开 */
const TOL = 1e-9;

const clamp = (lo, v, hi) => Math.max(lo, Math.min(v, hi));
const sgn = (v) => (v > TOL ? 1 : v < -TOL ? -1 : 0);

/*
 * [CALLOUT-05] 8 个方位的单位向量（svg 坐标系，y 向下）。
 * **数组顺序即候选枚举序**，也是打分同分时的破平手顺序——故它必须稳定，
 * 不要改成按 Object.keys 遍历某个对象。斜向已归一化（√2/2），
 * 使「块最近点到锚点的距离恒等于 d」这条不变量对 8 向一致成立。
 */
const DIAG = Math.SQRT1_2;
export const CALLOUT_DIRS = Object.freeze([
  ['nw', { x: -DIAG, y: -DIAG }],
  ['ne', { x: DIAG, y: -DIAG }],
  ['n', { x: 0, y: -1 }],
  ['w', { x: -1, y: 0 }],
  ['e', { x: 1, y: 0 }],
  ['sw', { x: -DIAG, y: DIAG }],
  ['se', { x: DIAG, y: DIAG }],
  ['s', { x: 0, y: 1 }],
]);

/*
 * [CALLOUT-07] 打分权重与方位偏好。**模块常量，不是 behavior.json 键**——
 * 三主题的标注同形（CALLOUT-15），这里是算法取向不是品牌分叉。
 * 将来若真出现「某品牌要求标注恒在上方」，再套 LEGEND-10 那条
 * 「品牌之间形态真的不同才进 behavior.json」的判据。**这是判断不是遗漏。**
 *
 * hit ≫ dir 的意思是：**宁可摆到不喜欢的方位，也不要压住图元**。
 * far(3) < hit(12) 的意思是：为了不压图元愿意拉远，但同等干净时优先近档。
 *
 * cross 记**有没有穿越**而不是穿越了几个：障碍物是折线的逐段包围盒，
 * 段数随数据量线性增长，按条数计等于把「线很长」当成「挡得很厉害」，
 * 与 coverageFraction 避开的是同一个重复计数陷阱。
 */
const W = Object.freeze({ hit: 12, cross: 6, far: 3, dir: 1 });
const DIR_BIAS = Object.freeze({
  nw: 0, ne: 0, n: 0.5, w: 1, e: 1, sw: 1.5, se: 1.5, s: 2,
});

/* 远档距离比例。取比例不取像素，跟着各主题自己的 --size-callout-leader 走
   （先例：pie/geometry.js 的 MIN_RADIUS_RATIO、sankey 的 curve-tension）。 */
const FAR_RATIO = 2;

/* 三次贝塞尔的控制点外推比例，与 sankey/config.js 的 curve-tension 同值。
   0.5 时两个控制点落在主轴跨度的一半处，S 形最匀。 */
const LEADER_TENSION = 0.5;

/* [CALLOUT-12] 箭头三角尺寸。模块常量的先例是 core/tooltip.js 的 ARROW_W / ARROW_H；
   设计给值后再 token 化（specs/callout.md 待办已记）。 */
const HEAD_W = 6;
const HEAD_H = 5;

/* 实心点半径占环内半径的比例（CALLOUT-04：「任意数值坐标」档那里没有既有图元，
   环里要自己补一个点）。取比例而非像素，理由同 FAR_RATIO。 */
const DOT_RATIO = 0.5;

/* ────────────────────────────────────────────────────────────────
 * 矩形基元（纯几何，无 DOM）
 * ──────────────────────────────────────────────────────────────── */

/* 矩形上离给定点最近的点。点在矩形内时返回它自己。 */
export function rectNearestPoint(rect, point) {
  return {
    x: clamp(rect.x, point.x, rect.x + rect.width),
    y: clamp(rect.y, point.y, rect.y + rect.height),
  };
}

/* 两矩形是否至少相隔 minGap（净距，不是中心距）。 */
export function rectsApart(a, b, minGap = 0) {
  return a.x - (b.x + b.width) >= minGap
    || b.x - (a.x + a.width) >= minGap
    || a.y - (b.y + b.height) >= minGap
    || b.y - (a.y + a.height) >= minGap;
}

/* 矩形是否完整落在 bounds 内。bounds 字段名刻意与 frame.grid 一致，L2 可原样传。 */
export function rectWithin(rect, bounds) {
  return rect.x >= bounds.left && rect.x + rect.width <= bounds.right
    && rect.y >= bounds.top && rect.y + rect.height <= bounds.bottom;
}

/*
 * [CALLOUT-07] 候选块被障碍物盖住的比例（0..1）。
 *
 * **用网格采样而不是「重叠面积求和 ÷ 块面积」**，这是实测逼出来的：折线的逐段包围盒
 * 彼此大量重叠，面积求和会**重复计数**，密集数据下几乎每个候选都迅速饱和到 1，
 * 于是十六个候选同分、最后由方位偏好而不是真实遮挡决定位置——2026-09-16 在 50 类目
 * 折线上实测，文字块因此被摆到线上。
 * 采样点命中即 break，天然是并集、不会重复计数，也就恢复了候选之间的区分度。
 *
 * 采样密度 7×5 = 35 点：16 候选 × 35 点 × 数十个障碍物仍是几万次比较，可忽略；
 * 再密只会让每帧重排变慢，换不来可见的选位差别。
 */
const COVER_COLS = 7;
const COVER_ROWS = 5;

export function coverageFraction(rect, obstacles) {
  if (!obstacles?.length) return 0;
  let hit = 0;
  for (let r = 0; r < COVER_ROWS; r += 1) {
    const y = rect.y + (rect.height * (r + 0.5)) / COVER_ROWS;
    for (let c = 0; c < COVER_COLS; c += 1) {
      const x = rect.x + (rect.width * (c + 0.5)) / COVER_COLS;
      for (const ob of obstacles) {
        if (x >= ob.x && x <= ob.x + ob.width && y >= ob.y && y <= ob.y + ob.height) {
          hit += ob.weight ?? 1;
          break;                       /* 命中即停 ⇒ 并集语义，不重复计数 */
        }
      }
    }
  }
  return hit / (COVER_COLS * COVER_ROWS);
}

/*
 * 线段是否与矩形相交（Liang-Barsky 区间裁剪）。
 * [CALLOUT-07] 引线穿越检测的**保守代理**：真实引线是曲线，但曲线只在
 * 「锚点 → 块最近点」这条直线两侧小幅摆动，用直线判便宜且偏保守（宁可多躲）。
 */
export function segmentHitsRect(p0, p1, rect) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [-dx, p0.x - rect.x],
    [dx, rect.x + rect.width - p0.x],
    [-dy, p0.y - rect.y],
    [dy, rect.y + rect.height - p0.y],
  ];
  for (const [p, q] of edges) {
    if (Math.abs(p) < TOL) {
      if (q < 0) return false;          /* 与该对边平行且在外侧 */
      continue;
    }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

/* ────────────────────────────────────────────────────────────────
 * 选位（CALLOUT-05..09）
 * ──────────────────────────────────────────────────────────────── */

/*
 * [CALLOUT-05] 一个候选块矩形。定位规则**一条通吃 8 向**：
 *   块上离锚点最近的那个点，恰好落在 anchor + u × d 上。
 * 对正向（n/s/e/w）它是近边中点，对斜向（nw/ne/sw/se）它是近角。
 * sgn 的三态正是这条规则的闭式：-1 → 块在负侧（右沿贴接触点）、
 * 0 → 该轴居中、+1 → 块在正侧（左沿贴接触点）。
 *
 * 可断言的不变量（单测直接写）：rectNearestPoint(结果, anchor) 到 anchor 的距离 ≡ d，
 * 8 向 × 2 档共 16 例全部成立。
 */
export function calloutBlockRect(anchor, dir, d, size) {
  const u = CALLOUT_DIRS.find(([name]) => name === dir)?.[1];
  if (!u) return null;
  const px = anchor.x + u.x * d;
  const py = anchor.y + u.y * d;
  return {
    x: px + (sgn(u.x) - 1) * size.width / 2,
    y: py + (sgn(u.y) - 1) * size.height / 2,
    width: size.width,
    height: size.height,
  };
}

/*
 * [CALLOUT-06][CALLOUT-07] 给一个候选打分。**越小越好；返回 null = 硬约束不通过，直接淘汰。**
 *
 * 两条硬约束都不给惩罚分而是直接淘汰，理由是**一概不 clamp**：
 * clamp 会把块推向锚点，让引线退化甚至反向。tooltip（TOOLTIP-01）与轴高亮贴片能 clamp，
 * 是因为它们没有引线——前提不同，别照搬那边的写法。
 *
 *   ctx = { bounds, obstacles, placed, minGap, far }
 *     obstacles —— [{ x, y, width, height, weight = 1 }]，L2 把柱 / 线 / 水印转成的矩形
 *     placed    —— 本批已选定的块与环，用于标注之间互相避让
 *     far       —— 本候选是否用了远档（只影响分数，不是硬约束）
 */
export function scoreCandidate(rect, anchor, ctx) {
  const { bounds, obstacles = [], placed = [], minGap = 0, far = false, dir } = ctx;

  if (bounds && !rectWithin(rect, bounds)) return null;
  for (const p of placed) {
    if (!rectsApart(rect, p, minGap)) return null;
  }

  const near = rectNearestPoint(rect, anchor);
  let crossed = 0;
  for (const ob of obstacles) {
    if (segmentHitsRect(anchor, near, ob)) crossed += 1;
  }

  return W.hit * coverageFraction(rect, obstacles)
    + W.cross * Math.min(1, crossed)
    + W.far * (far ? 1 : 0)
    + W.dir * (DIR_BIAS[dir] ?? 0);
}

/*
 * [CALLOUT-05][CALLOUT-09] 为一条标注选位。
 * 候选 = 8 方位 × 近 / 远两档 = 16 个，按固定枚举序遍历（近档整轮在远档之前）。
 * 全灭 → 返回 null = **整条丢弃**（不缩字号、不截断、不 clamp）。
 *
 *   opts = { ringOuter, lead, bounds, obstacles, placed, minGap }
 */
export function placeCallout(anchor, size, opts = {}) {
  const { ringOuter = 0, lead = 0 } = opts;
  let best = null;
  for (const far of [false, true]) {
    const d = ringOuter + lead * (far ? FAR_RATIO : 1);
    for (const [dir] of CALLOUT_DIRS) {
      const rect = calloutBlockRect(anchor, dir, d, size);
      const score = scoreCandidate(rect, anchor, { ...opts, dir, far });
      if (score == null) continue;
      if (!best || score < best.score) best = { dir, distance: d, rect, score, far };
    }
    if (best) return best;            /* 近档有解就不看远档（far 的惩罚分已表达偏好） */
  }
  return best;
}

/*
 * [CALLOUT-08] 一批标注按**声明序**贪心放置：首条恒得全局最优位，
 * 其后每条把已定条目的块**与环**并入障碍集。声明序 = 优先级，由调用方决定。
 * 首个恒放 ⇒ 结果稳定、与容器变化单调（变挤只会更少、不跳变），
 * 与 label.js 的 dropCollisions 同一条品味。
 *
 *   entries = [{ anchor, size }]
 * → [{ entry, place }]，place 为 null 表示这条丢弃（调用方必须在画线之前过滤掉，CALLOUT-01）
 */
export function placeCallouts(entries, opts = {}) {
  const { ringOuter = 0 } = opts;
  const placed = [...(opts.placed ?? [])];
  return entries.map((entry) => {
    const place = placeCallout(entry.anchor, entry.size, { ...opts, placed });
    if (place) {
      placed.push(place.rect);
      placed.push({
        x: entry.anchor.x - ringOuter,
        y: entry.anchor.y - ringOuter,
        width: ringOuter * 2,
        height: ringOuter * 2,
      });
    }
    return { entry, place };
  });
}

/* ────────────────────────────────────────────────────────────────
 * 引线与箭头（CALLOUT-11 / CALLOUT-12）
 * ──────────────────────────────────────────────────────────────── */

/*
 * [CALLOUT-11][CALLOUT-12] 引线（三次贝塞尔 sigmoid）+ 箭头三角。
 *
 * **不用二次贝塞尔**：它只有一个控制点、曲线恒向控制点一侧凸，画不出 S 形。
 * （弦图那条二次贝塞尔是「以圆心为唯一控制点」的向心弓形，是另一件事。）
 * 写法与 charts/charts/sankey/layout.js 的 ribbon 同源：**长轴决定主轴、两端切向同轴、
 * 控制点各沿主轴外推 LEADER_TENSION × Δ**。
 *
 * 起点、底边、尖端、锚点**四点共线**（都在 anchor + u·t 这条射线上）——
 * 这是最好验证的不变量，单测直接断言。
 *
 * 曲线止于**底边**、三角形补到尖端，照 waterfall/index.js 的 directionLine → baseY 写法；
 * 否则线头会从三角形里穿出来。
 *
 * 退化：正上 / 正下走纵向档；正左 / 正右走横向档且两控制点与起点同 y，曲线退化为直线。
 * 两种都不抛错、不产生 NaN。
 */
export function calloutLeader(rect, anchor, opts = {}) {
  const { ringOuter = 0, gap = 0, headW = HEAD_W, headH = HEAD_H } = opts;

  /* ① 起点：块上离锚点最近的点，再朝锚点让开 gap（文字不贴线） */
  const n = rectNearestPoint(rect, anchor);
  const dx = anchor.x - n.x;
  const dy = anchor.y - n.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;                       /* 由块指向锚点的单位向量 */
  const start = { x: n.x + ux * gap, y: n.y + uy * gap };

  /* ② 终点：尖端恰落在环外缘；曲线止于底边（u 指向锚点，故从锚点反向外推） */
  const tip = { x: anchor.x - ux * ringOuter, y: anchor.y - uy * ringOuter };
  const base = { x: anchor.x - ux * (ringOuter + headH), y: anchor.y - uy * (ringOuter + headH) };

  /*
   * ③ 控制点。**两端切向不对称，这是有意的**：
   *   起点侧（c1）沿长轴离开文字块——文字是横排的，水平/垂直离开才像从文字里拉出来一条线；
   *   终点侧（c2）沿 **u 方向**到达环——箭头必须指着圆心。
   *
   * ⚠️ 早先两端都用轴对齐（照抄 sankey ribbon 的对称 sigmoid），结果是**斜向方位下箭头变形**：
   * tip 与 base 落在锚点沿 u 的射线上（三角形轴向 = u），底边却按轴对齐的末端切线取法向，
   * 两者差 45°，三角形被压扁成薄片（面积 15 → 10.61 = 15×cos45°）。2026-09-17 实测。
   * 桑基那条能对称，是因为它两端都接在竖直的节点边上、u 恒为水平；标注的 u 是任意方向。
   */
  const Dx = base.x - start.x;
  const Dy = base.y - start.y;
  const horizontal = Math.abs(Dx) >= Math.abs(Dy);
  const k = LEADER_TENSION;
  const c1 = horizontal ? { x: start.x + k * Dx, y: start.y } : { x: start.x, y: start.y + k * Dy };
  const reach = k * Math.hypot(Dx, Dy);
  const c2 = { x: base.x - ux * reach, y: base.y - uy * reach };

  /* ④ 箭头对齐曲线末端切线（= base − c2 方向）；退化时回落到 (−ux, −uy) */
  let ax = base.x - c2.x;
  let ay = base.y - c2.y;
  const al = Math.hypot(ax, ay);
  if (al < TOL) { ax = -ux; ay = -uy; } else { ax /= al; ay /= al; }
  const px = -ay;
  const py = ax;                             /* 末端切线的法向 */
  const hw = headW / 2;

  return {
    start,
    c1,
    c2,
    base,
    tip,
    curve: `M${start.x},${start.y}C${c1.x},${c1.y} ${c2.x},${c2.y} ${base.x},${base.y}`,
    head: `M${tip.x},${tip.y}`
      + `L${base.x + px * hw},${base.y + py * hw}`
      + `L${base.x - px * hw},${base.y - py * hw}Z`,
  };
}

/* ────────────────────────────────────────────────────────────────
 * 折行（CALLOUT-03 / CALLOUT-10）
 * ──────────────────────────────────────────────────────────────── */

/*
 * 把一段文案切成折行单元：西文按空白切词（连同其后的空格一起算宽），
 * CJK 按单字切（中文没有词间空格，按词切等于不折）。
 * 显式换行符恒被尊重，先按 \n 分段再逐段折。
 */
const CJK = /[⺀-鿿豈-﫿＀-￯]/;

export function tokenizeForWrap(text) {
  const out = [];
  for (const word of String(text).split(/(\s+)/)) {
    if (!word) continue;
    if (/^\s+$/.test(word)) {
      if (out.length) out[out.length - 1] += word;   /* 空白并进前一个单元，宽度才算得准 */
      continue;
    }
    if (CJK.test(word)) out.push(...Array.from(word));
    else out.push(word);
  }
  return out;
}

/*
 * [CALLOUT-10] 按**定宽**贪心折行。maxWidth 是 token 常量，**不是剩余空间**——
 * 这正是切断「选位 ↔ 块尺寸」那个环的地方，见文件头。
 *
 *   entries = [text, ...]
 *   measure = (list) => widths[]   **一次量一批**（同 label.js 的纪律：
 *             逐条二分会把 N 个标注 × 若干轮变成上百次 layout flush）
 * → [{ lines, width }]，width = 该块实际最宽行（≤ maxWidth，短文案不撑满）
 *
 * 块宽取**实际最宽行**而非恒等于 maxWidth：短文案不该撑出一个空荡荡的块，
 * 那会让选位白白躲开本来够用的空地。行宽里含行尾空白的宽度（≤ 一个空格），
 * 故块宽最多偏宽几个像素——**偏宽是安全方向**（文字只会更不可能溢出）。
 */
export function wrapByWidth(entries, maxWidth, measure) {
  const perEntry = entries.map((text) => tokenizeForWrap(text));
  const widths = measure(perEntry.flat());

  let cursor = 0;
  return perEntry.map((units) => {
    const w = widths.slice(cursor, cursor + units.length);
    cursor += units.length;

    const lines = [];
    let text = '';
    let width = 0;
    const flush = () => {
      if (!text) return;
      lines.push({ text: text.replace(/\s+$/, ''), width });
      text = '';
      width = 0;
    };
    units.forEach((unit, i) => {
      /* 单元本身就超宽时独占一行不再切：硬切西文单词会得到读不出的残词，
         而「放不下就整条丢弃」已由 CALLOUT-09 承担，此处不兼职截断 */
      if (text && width + w[i] > maxWidth) flush();
      text += unit;
      width += w[i];
    });
    flush();

    return {
      lines: lines.length ? lines.map((l) => l.text) : [''],
      width: Math.min(maxWidth, Math.max(0, ...lines.map((l) => l.width))),
    };
  });
}

/* ────────────────────────────────────────────────────────────────
 * 渲染
 * ──────────────────────────────────────────────────────────────── */

/*
 * [CALLOUT-01..16] 把一批标注渲染进已存在的 <g>。**层由 L2 建**（本模块不自己建层）。
 *
 *   items = [{ x, y, text, dot }]
 *     x/y  —— L2 算好的像素锚点（CALLOUT-02）
 *     text —— 调用方写死的整句；字符串或数组，\n 与数组两种显式分行都收
 *     dot  —— 该锚点处**没有**既有图元（柱顶 / 任意数值坐标）时为 true，环里补一个实心点
 *   opts  = { bounds = frame.grid, obstacles = [] }
 *
 * 流程严格一趟（CALLOUT-10）。**place === null 的条目在画任何 DOM 之前就被过滤掉**——
 * 这条抄自 PIE-12「引线与标签强绑定，所有丢弃都必须在画线前判完」，
 * 否则会画出一条指向空处的线。
 */
export function renderCallouts(g, frame, items, opts = {}) {
  const list = (items ?? []).filter((d) => d && d.text != null && d.text !== '');
  if (!list.length) return;

  const host = frame.host;
  const maxWidth = tokenNum(host, '--size-callout-max-width');
  const lineH = tokenNum(host, '--line-height-callout');
  const ringD = tokenNum(host, '--size-callout-ring');
  const ringStroke = tokenNum(host, '--size-callout-ring-stroke');
  const lead = tokenNum(host, '--size-callout-leader');
  const gap = tokenNum(host, '--spacing-4');
  const minGap = tokenNum(host, '--spacing-data-label-min-gap');

  /* 环直径**含描边**（口径同 size-line-point），故半径要把描边扣掉——
     与 mark.js 的 `r = max(1, (point - stroke) / 2)` 逐字同源 */
  const ringOuter = ringD / 2;
  const ringR = Math.max(1, (ringD - ringStroke) / 2);

  /* ① 折行 + ② 批量测量（一次 layout flush），③ 块尺寸就此定死 */
  const texts = list.map((d) => (Array.isArray(d.text) ? d.text.join('\n') : String(d.text)));
  const wrapped = [];
  const segmented = texts.map((t) => t.split(/\r?\n/).filter((s) => s !== ''));
  const flatSegments = segmented.flat();
  const measured = wrapByWidth(flatSegments, maxWidth, (l) => measureTexts(host, l, TEXT_CLASS));

  let cursor = 0;
  segmented.forEach((segs) => {
    const part = measured.slice(cursor, cursor + segs.length);
    cursor += segs.length;
    wrapped.push({
      lines: part.flatMap((p) => p.lines),
      width: Math.max(0, ...part.map((p) => p.width)),
    });
  });

  /* [CALLOUT-01] 折行**之后**再兜一次「有没有可见字」：`'\n'` / `'   '` 这类文案
     过得了入口的 text !== '' 却折不出任何字，放行就会画出「环 + 引线 + 箭头 + 空文字」,
     正是本条禁止的「没有文字的环」。入口那道过滤挡不住它，因为空白与换行都不是空串。 */
  const visible = [];
  list.forEach((d, i) => {
    if (wrapped[i].lines.some((l) => l.trim() !== '')) visible.push({ item: d, wrap: wrapped[i] });
  });
  if (!visible.length) return;

  const entries = visible.map(({ wrap }) => ({
    anchor: { x: 0, y: 0 },
    size: { width: wrap.width, height: wrap.lines.length * lineH },
  }));
  visible.forEach((v, i) => { entries[i].anchor = { x: v.item.x, y: v.item.y }; });

  /* ④ 选位 */
  const results = placeCallouts(entries, {
    ringOuter,
    lead,
    bounds: opts.bounds ?? frame.grid,
    obstacles: opts.obstacles ?? [],
    minGap,
  });

  /* ⑤ 丢弃的在画任何 DOM 之前过滤掉（CALLOUT-01） */
  const drawn = results
    .map((r, i) => (r.place ? { item: visible[i].item, lines: visible[i].wrap.lines, place: r.place } : null))
    .filter(Boolean)
    .map((d) => ({ ...d, leader: calloutLeader(d.place.rect, { x: d.item.x, y: d.item.y }, { ringOuter, gap }) }));
  if (!drawn.length) return;

  /* ⑥ DOM。每条一个 <g>，组内顺序即层序：点 → 环 → 引线 → 箭头 → 文字。
     层由 L2 每次 build 新建（且 build 开头就清空 plotHost），故这里恒为 enter-only——
     用**平行 append** 而不是逐条 each 里清空重建，同 crosshair.js「两个平行 join」的写法。 */
  const groups = g.selectAll('g.dv-callout').data(drawn).join('g').attr('class', 'dv-callout');

  /* 实心点只在锚点处没有既有图元时补（CALLOUT-04）。先于环 append ⇒ 画在环之下 */
  groups.filter((d) => d.item.dot).append('circle').attr('class', 'dv-callout-dot')
    .attr('cx', (d) => d.item.x).attr('cy', (d) => d.item.y).attr('r', ringR * DOT_RATIO);
  groups.append('circle').attr('class', 'dv-callout-ring')
    .attr('cx', (d) => d.item.x).attr('cy', (d) => d.item.y).attr('r', ringR);
  groups.append('path').attr('class', 'dv-callout-leader').attr('d', (d) => d.leader.curve);
  groups.append('path').attr('class', 'dv-callout-arrow').attr('d', (d) => d.leader.head);

  const textNodes = groups.append('text').attr('class', TEXT_CLASS)
    .attr('x', (d) => d.place.rect.x)
    .attr('y', (d) => d.place.rect.y)
    .attr('text-anchor', 'start')
    .attr('dominant-baseline', 'hanging');
  /* 逐行 tspan 复用 axis.js 的装配器（先例 crosshair.js），不另造一份 */
  renderAxisLabelLines(textNodes, { lines: (d) => d.lines, x: (d) => d.place.rect.x, lineHeight: lineH });
}
