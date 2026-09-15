/*
 * 雷达图几何的纯逻辑单测（specs/radar.md）。
 *
 * 测 charts/charts/radar/geometry.js —— 它不碰 DOM / d3 / token，唯一的 import 是同样
 * 零依赖的 core/polar-label.js，故可直接加载。
 * niceSplit 经参数注入，这里传真货（core/split.js 同样零依赖），测的就是线上那条路。
 *
 * pointAt / labelAnchor / labelArc 已下沉 L1（specs/radar.md 下沉点②），故从 core 取；
 * **断言一字未改**——这正是「移动纯函数而非重写」的凭据。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { niceSplit } from '../charts/core/split.js';
import { pointAt, labelAnchor, labelArc } from '../charts/core/polar-label.js';
import {
  MIN_DIMENSIONS,
  axisAngles,
  radarDomain,
  radarFrame,
  radarValueAt,
  ringRadii,
  gridPath,
  seriesPoints,
  snapRadarValue,
  sectorAt,
  sectorCorners,
} from '../charts/charts/radar/geometry.js';

const TAU = Math.PI * 2;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

/* ── [RADAR-02] 径向轴角度 ───────────────────────────────────── */

test('RADAR-02：首轴恒在 12 点方向', () => {
  for (const n of [3, 5, 6, 8]) {
    assert.equal(axisAngles(n)[0], 0, `${n} 轴时首轴应为 0 弧度（12 点）`);
  }
});

test('RADAR-02：n 根轴按 360/n 均分且顺时针递增', () => {
  for (const n of [3, 5, 6]) {
    const angles = axisAngles(n);
    assert.equal(angles.length, n);
    for (let i = 1; i < n; i++) {
      assert.ok(near(angles[i] - angles[i - 1], TAU / n), `${n} 轴第 ${i} 段间隔不等分`);
    }
    assert.ok(angles[n - 1] < TAU, '最后一根轴不应绕回 0 之后');
  }
});

test('RADAR-02：0 弧度指向正上方，正角顺时针（与 pie 同一套约定）', () => {
  const up = pointAt(0, 10);
  assert.ok(near(up.x, 0) && near(up.y, -10), '0 弧度应是正上方 (0, −r)');
  const right = pointAt(Math.PI / 2, 10);
  assert.ok(near(right.x, 10) && near(right.y, 0), 'π/2 应是正右方 —— 正角即顺时针');
});

/* ── [RADAR-04] 值域两条路 ───────────────────────────────────── */

test('RADAR-04：给了 max 就以它为准——0–5 评分不得被算成 0–5.4', () => {
  const d = radarDomain([[1.9, 2.1, 3.0, 3.4, 1.6]], { max: 5, segments: 4 }, niceSplit);
  assert.equal(d.max, 5, '固定量程必须原样保留');
  assert.notEqual(d.max, 5.4, '这正是留 max 口子的原因：自动档会给出 5.4');
  assert.equal(d.min, 0);
  assert.equal(d.segments, 4);
});

test('RADAR-04：没给 max 时等价于 niceSplit(0, 数据max, {lineCount: segments+1})', () => {
  const data = [[1.9, 2.1, 3.0, 3.4, 1.6]];
  const d = radarDomain(data, { segments: 4 }, niceSplit);
  assert.equal(d.max, niceSplit(0, 3.4, { lineCount: 5 }).max);
});

test('RADAR-04：自动档确实会抬高上界——固定档与自动档在同一份数据上不同', () => {
  const data = [[5, 4, 3]];
  const auto = radarDomain(data, { segments: 4 }, niceSplit);
  const fixed = radarDomain(data, { max: 5, segments: 4 }, niceSplit);
  assert.equal(fixed.max, 5);
  assert.ok(auto.max > 5, `自动档应抬高到 nice 值，实得 ${auto.max}`);
});

test('RADAR-04：非法 max（0 / 负 / 非数）回落自动档，不产生零宽值域', () => {
  const data = [[2, 3]];
  for (const bad of [0, -1, NaN, Infinity]) {
    const d = radarDomain(data, { max: bad, segments: 4 }, niceSplit);
    assert.ok(d.max > 0, `max=${bad} 时应回落自动档而非留下 ${d.max}`);
  }
});

test('RADAR-01：全空 / 全负数据不产生零宽值域', () => {
  for (const data of [[[null, null]], [[-1, -5]], [[]]]) {
    const d = radarDomain(data, { segments: 4 }, niceSplit);
    assert.ok(d.max > 0, '无有效正值时仍须给出可用上界');
  }
});

test('RADAR-03：默认 5 环——不传 segments 时按设计默认值走', () => {
  assert.equal(radarDomain([[3]], { max: 5 }, niceSplit).segments, 5);
  assert.equal(ringRadii(radarDomain([[3]], { max: 5 }, niceSplit), 80).length, 5);
});

test('RADAR-03：分段数最少 2', () => {
  for (const [given, want] of [[1, 2], [0, 2], [-3, 2], [2, 2], [5, 5]]) {
    assert.equal(radarDomain([[1]], { max: 1, segments: given }, niceSplit).segments, want);
  }
});

/* ── [RADAR-03] 网格环 ───────────────────────────────────────── */

test('RADAR-03：环由内向外均分，最外圈恰为 R', () => {
  const radii = ringRadii({ max: 5, segments: 4 }, 64);
  assert.equal(radii.length, 4);
  assert.ok(near(radii.at(-1), 64), '最外圈必须正好是 R');
  for (let i = 1; i < radii.length; i++) {
    assert.ok(near(radii[i] - radii[i - 1], 16), '各环间距应相等');
  }
});

test('RADAR-03：circle 档不产出点集（调用方画 <circle>），polygon 档每轴一个点', () => {
  const angles = axisAngles(6);
  assert.equal(gridPath('circle', 40, angles), null);
  const poly = gridPath('polygon', 40, angles);
  assert.equal(poly.length, 6);
  for (const p of poly) assert.ok(near(Math.hypot(p.x, p.y), 40), '多边形顶点须落在该环上');
});

/* ── [RADAR-09] 半径 ────────────────────────────────────────── */

test('RADAR-09：默认容器下 R 恰好取到 token 值（容器 = 2×(R+纵向带)）', () => {
  /* 纵向带 = 间距 4 + 名称行高 16 = 20；THS/iFinD 容器 200 → R 80，Ainvest 220 → R 90 */
  const a = radarFrame(1200, 200, { maxRadius: 80, maxBandH: 56, bandV: 20 });
  assert.equal(a.R, 80, 'THS / iFinD');
  const b = radarFrame(1200, 220, { maxRadius: 90, maxBandH: 56, bandV: 20 });
  assert.equal(b.R, 90, 'Ainvest');
});

test('RADAR-09：横竖分开——纵向带只装一行字，横向带才吃剩余宽度', () => {
  const f = radarFrame(1200, 200, { maxRadius: 80, maxBandH: 56, bandV: 20 });
  assert.equal(f.bandV, 20, '纵向带由行高决定，与容器无关');
  assert.equal(f.bandH, 56, '横向有余量时取到上限');
  assert.deepEqual([f.width, f.height], [272, 200], '画布不是正方形——高比宽矮，正是横竖分开的收益');
});

test('RADAR-09：画布恒为图元外接框，绝不吃满容器宽', () => {
  const f = radarFrame(1600, 200, { maxRadius: 80, maxBandH: 56, bandV: 20 });
  assert.equal(f.width, 272, '宽 1600 时画布仍是 272（PIE-02：多出来的只会变成死空间）');
});

test('RADAR-09：缩小时**横向带先被挤掉、半径后缩**（同饼环 PIE-02 的顺序）', () => {
  const at = (w) => radarFrame(w, 900, { maxRadius: 80, maxBandH: 56, bandV: 20 });
  assert.deepEqual([at(272).R, at(272).bandH], [80, 56], '恰好装下');
  assert.deepEqual([at(200).R, at(200).bandH], [80, 20], '带被挤到 20，半径不动');
  assert.deepEqual([at(160).R, at(160).bandH], [80, 0], '带先归零');
  assert.deepEqual([at(120).R, at(120).bandH], [60, 0], '带已零，半径才开始缩');
});

test('RADAR-09：纵向也受约束——容器变矮时半径同样收缩', () => {
  const f = radarFrame(1200, 120, { maxRadius: 80, maxBandH: 56, bandV: 20 });
  assert.equal(f.R, 40, '(120 − 2×20)/2 = 40');
});

test('RADAR-09：最小高度 = 触底画布，且随标签行数自适应', () => {
  /* 纵向带 20（只有名称）→ 2×(40+20) = 120；带 36（名称+数值）→ 2×(40+36) = 152。
     调用方再加图例高与间距，得到容器最小高度（实测 160 / 192）。 */
  assert.equal(radarFrame(1200, 900, { maxRadius: 80, maxBandH: 56, bandV: 20 }).minHeight, 120);
  assert.equal(radarFrame(1200, 900, { maxRadius: 80, maxBandH: 56, bandV: 36 }).minHeight, 152);
  /* 与容器无关——它是图元的下限，不是当前尺寸 */
  assert.equal(radarFrame(100, 100, { maxRadius: 80, maxBandH: 56, bandV: 20 }).minHeight, 120);
});

test('RADAR-09：收缩有底——触底后不再变小（宁可溢出容器）', () => {
  const floor = 80 * 0.5;
  const R = (avail) => radarFrame(avail, avail, { maxRadius: 80, maxBandH: 56, bandV: 20 }).R;
  assert.equal(R(200), 80, '还没触底时随容器连续收缩');
  assert.equal(R(120), floor, '恰好触底');
  assert.equal(R(60), floor, '越过下限后不再变小——此后改为溢出容器');
  assert.equal(R(10), floor, '容器再小也不越过下限');
});

/* ── [RADAR-01][RADAR-17] 值 → 半径 ──────────────────────────── */

test('RADAR-17：全部维度共用一把标尺——同值在不同轴上半径相同', () => {
  const domain = { min: 0, max: 5, segments: 4 };
  const angles = axisAngles(5);
  const pts = seriesPoints([3, 3, 3, 3, 3], domain, 64, angles);
  const radii = pts.map((p) => Math.hypot(p.x, p.y));
  for (const r of radii) assert.ok(near(r, radii[0]), '共享标尺下同值必须等距圆心');
});

test('RADAR-04：值→半径两端——0 落圆心、max 落最外圈', () => {
  const domain = { min: 0, max: 5, segments: 4 };
  const angles = axisAngles(3);
  const pts = seriesPoints([0, 5, 2.5], domain, 64, angles);
  assert.ok(near(Math.hypot(pts[0].x, pts[0].y), 0), '0 应落在圆心');
  assert.ok(near(Math.hypot(pts[1].x, pts[1].y), 64), 'max 应落在最外圈');
  assert.ok(near(Math.hypot(pts[2].x, pts[2].y), 32), '半值应落在半径处');
});

test('RADAR-01：null / 负值落圆心，不断开闭合形状也不伪造面积', () => {
  const domain = { min: 0, max: 5, segments: 4 };
  const angles = axisAngles(4);
  const pts = seriesPoints([null, -3, NaN, 5], domain, 64, angles);
  assert.equal(pts.length, 4, '点数恒等于维度数——闭合形状不能断');
  for (const i of [0, 1, 2]) {
    assert.ok(near(Math.hypot(pts[i].x, pts[i].y), 0), `第 ${i} 项非有效正值，应落圆心`);
  }
});

test('RADAR-01：闭合点集点数恒等于维度数（3 / 5 / 6 轴）', () => {
  const domain = { min: 0, max: 5, segments: 4 };
  for (const n of [MIN_DIMENSIONS, 5, 6]) {
    const pts = seriesPoints(Array(n).fill(2), domain, 64, axisAngles(n));
    assert.equal(pts.length, n);
  }
});

/* ── [RADAR-07] 绕圆标签八向锚点 ─────────────────────────────── */

test('RADAR-07：标签沿径向轴外延 gap 后放置', () => {
  const a = labelAnchor(0, 64, 4);
  assert.ok(near(Math.hypot(a.x, a.y), 68), '锚点距圆心应为 R + gap');
});

test('RADAR-07：八个方位逐个断言对齐方式（下沉点 ② 的契约）', () => {
  const at = (deg) => labelAnchor((deg / 360) * TAU, 64, 4);
  const cases = [
    [0, 'middle', 'auto', '正上'],
    [45, 'start', 'auto', '右上'],
    [90, 'start', 'central', '正右'],
    [135, 'start', 'hanging', '右下'],
    [180, 'middle', 'hanging', '正下'],
    [225, 'end', 'hanging', '左下'],
    [270, 'end', 'central', '正左'],
    [315, 'end', 'auto', '左上'],
  ];
  for (const [deg, textAnchor, baseline, name] of cases) {
    const a = at(deg);
    assert.equal(a.textAnchor, textAnchor, `${name}（${deg}°）的 text-anchor`);
    assert.equal(a.baseline, baseline, `${name}（${deg}°）的 dominant-baseline`);
  }
});

test('RADAR-07：正左 / 正右用 central 而非 middle（同 TOOLTIP-12 的理由）', () => {
  assert.equal(labelAnchor(TAU / 4, 64, 4).baseline, 'central');
  assert.equal(labelAnchor((TAU * 3) / 4, 64, 4).baseline, 'central');
});

/* ── [RADAR-14] 可调节态弧形轴标签 ───────────────────────────── */

test('RADAR-14：上半圆顺时针排字，下半圆反向保持正读', () => {
  const top = labelArc(0, 64, 4, Math.PI / 3, 10);
  assert.equal(top.reversed, false);
  assert.equal(top.sweep, 1);
  assert.ok(top.start.x < top.end.x, '顶部文字应从左向右');
  assert.ok(near(top.radius, 68), '顺向基线从 R + gap 开始');

  const bottom = labelArc(Math.PI, 64, 4, Math.PI / 3, 10);
  assert.equal(bottom.reversed, true);
  assert.equal(bottom.sweep, 0);
  assert.ok(bottom.start.x < bottom.end.x, '底部反向后仍应从左向右');
  assert.ok(near(bottom.radius, 78), '反向路径只外移真实墨迹 ascent，文字内缘仍从 R + gap 开始');
});

test('RADAR-14：弧长就是标签截断上限', () => {
  const span = Math.PI / 4;
  const arc = labelArc(0, 80, 4, span, 16);
  assert.ok(near(arc.length, 84 * span));
});

/*
 * 下半圆的弧半径按字形 ascent 外移，弧长因此比 (R+gap)×span 长一截。
 * index.js 曾对所有标签统一用 (R+gap)×span 当截断预算，于是下半圆被白白截短
 * （R80 / gap4 / 60° / ascent12 时少 12.6px）。本条钉死「预算必须取各自那条弧的长度」——
 * 回退成统一预算时它会红，而门禁与肉眼都发现不了这种「只是短了一点」的退化。
 */
test('RADAR-14：下半圆的截断预算必须取它自己那条弧，不能按 R+gap 统一估', () => {
  const [R, gap, span, ascent] = [80, 4, Math.PI / 3, 12];
  const flat = (R + gap) * span;                       /* 旧的统一预算 */
  const top = labelArc(0, R, gap, span, ascent);
  const bottom = labelArc(Math.PI, R, gap, span, ascent);

  assert.ok(near(top.length, flat), '上半圆不外移，两种算法本就一致');
  assert.ok(bottom.length > flat, '下半圆实际弧更长，统一预算会低估');
  assert.ok(near(bottom.length, (R + gap + ascent) * span), '下半圆预算 = (R + gap + ascent) × span');
});

/* ── [RADAR-10] 扇形命中 ────────────────────────────────────── */

test('RADAR-10：指针落在某轴正上方时命中该轴的扇形', () => {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const p = pointAt(axisAngles(n)[i], 30);
    assert.equal(sectorAt({ x: 100 + p.x, y: 100 + p.y }, 100, 100, n), i, `第 ${i} 根轴上的点`);
  }
});

test('RADAR-10：12 点正上方跨 0 度那一处不误判到最后一个扇形', () => {
  const n = 6;
  const step = TAU / n;
  /* 首轴扇区跨越 0 度，两侧各半格都应算首轴 */
  const justBefore = pointAt(TAU - step / 4, 30);
  const justAfter = pointAt(step / 4, 30);
  assert.equal(sectorAt({ x: justBefore.x, y: justBefore.y }, 0, 0, n), 0, '0 度左侧仍属首轴');
  assert.equal(sectorAt({ x: justAfter.x, y: justAfter.y }, 0, 0, n), 0, '0 度右侧仍属首轴');
});

test('RADAR-10：扇形边界——恰好半格处归下一个扇形，且结果恒在 [0, n)', () => {
  const n = 4;
  for (let k = 0; k < 40; k++) {
    const p = pointAt((k / 40) * TAU, 30);
    const idx = sectorAt({ x: p.x, y: p.y }, 0, 0, n);
    assert.ok(Number.isInteger(idx) && idx >= 0 && idx < n, `索引越界：${idx}`);
  }
});

test('RADAR-10：多边形档热区外缘沿多边形的边，不鼓出网格之外', () => {
  const n = 6;
  const R = 80;
  const verts = gridPath('polygon', R, axisAngles(n));
  for (let i = 0; i < n; i++) {
    const [a, v, b] = sectorCorners(i, verts);
    /* 中点必须落在边上（到圆心的距离 < R），顶点恰好在 R —— 若照画圆弧，
       两侧会一路鼓到 R，那正是「和多边形对不齐」的样子 */
    assert.ok(near(Math.hypot(v.x, v.y), R), `第 ${i} 个扇区的顶点应落在多边形顶点上`);
    for (const m of [a, b]) {
      assert.ok(Math.hypot(m.x, m.y) < R - 1e-9, `边中点必须在 R 之内（实得 ${Math.hypot(m.x, m.y)}）`);
    }
  }
});

test('RADAR-10：相邻扇区共用同一个边中点，热区之间无缝也无重叠', () => {
  const n = 5;
  const verts = gridPath('polygon', 80, axisAngles(n));
  for (let i = 0; i < n; i++) {
    const endOfThis = sectorCorners(i, verts)[2];
    const startOfNext = sectorCorners((i + 1) % n, verts)[0];
    assert.ok(near(endOfThis.x, startOfNext.x) && near(endOfThis.y, startOfNext.y),
      `第 ${i} 与第 ${i + 1} 个扇区的交界点应完全重合`);
  }
});

test('RADAR-10：指针落在圆心时归首轴，不产生 NaN', () => {
  assert.equal(sectorAt({ x: 50, y: 50 }, 50, 50, 6), 0);
});

/* ── [RADAR-18] 可调节手柄 ───────────────────────────────────── */

test('RADAR-18：拖动值取指针在目标径向轴上的投影，不取到圆心的斜距', () => {
  const domain = { min: 0, max: 5 };
  /* 12 点轴：同为 y=-40 时，横向偏出 30px 不应把值从 2 虚增到 2.5 */
  assert.equal(radarValueAt({ x: 30, y: -40 }, 0, 0, 0, domain, 100), 2);
  /* 3 点轴：只看 x 投影，竖向偏移不参与 */
  assert.equal(radarValueAt({ x: 60, y: 80 }, 0, 0, Math.PI / 2, domain, 100), 3);
});

test('RADAR-18：手柄中心外移一个半径后，反算值扣回偏移、按下不跳值', () => {
  const domain = { min: 0, max: 5 };
  /* 真实数据点在 12 点轴 r=60（值 3）；36px 手柄圆心位于 r=78，反算仍须为 3。 */
  assert.equal(radarValueAt({ x: 0, y: -78 }, 0, 0, 0, domain, 100, 18), 3);
});

test('RADAR-18：拖动值始终夹在统一量程 [0,max] 内', () => {
  const domain = { min: 0, max: 5 };
  assert.equal(radarValueAt({ x: 0, y: -160 }, 0, 0, 0, domain, 100), 5);
  assert.equal(radarValueAt({ x: 0, y: 40 }, 0, 0, 0, domain, 100), 0);
  assert.equal(radarValueAt({ x: 0, y: 0 }, 0, 0, 0, domain, 0), 0);
});

test('RADAR-18：editStep 可选吸附并消除常见小数误差', () => {
  assert.equal(snapRadarValue(2.26, 5, 0.1), 2.3);
  assert.equal(snapRadarValue(4.9, 5, 2), 4);
  assert.equal(snapRadarValue(7, 5, 0.5), 5);
  assert.equal(snapRadarValue(2.26, 5), 2.26);
});

/*
 * 本条钉的是 index.js 冻结量程的**理由**，不是冻结动作本身（那一步在 build() 里、需要 DOM，
 * 不在纯几何的可测范围内，故另由浏览器验收）。
 * 自动档的上界是**数据的函数**：editable 会原地改数据，若每次 build 都重算，用户把各点拖低后
 * 一次 resize 就会把标尺缩小、已设好的值跳到外圈。这条把「重算 = 会变」这个前提固定下来——
 * 有人日后让 radarDomain 变得与数据无关时，它会红，提醒去检查冻结逻辑是否还有必要。
 */
test('RADAR-18：自动档上界随数据变，故可调节态必须冻结量程（冻结动作见 index.js）', () => {
  const before = radarDomain([[3, 3, 3, 3, 3]], { segments: 5 }, niceSplit);
  const after = radarDomain([[0.5, 0.4, 0.6, 0.5, 0.5]], { segments: 5 }, niceSplit);
  assert.notEqual(after.max, before.max, '编辑后重算会得到不同上界——这正是必须冻结的原因');

  /* 给了固定 max 的那条路本就不受编辑影响，两次必须一致 */
  const fixedA = radarDomain([[3, 3, 3, 3, 3]], { max: 5, segments: 5 }, niceSplit);
  const fixedB = radarDomain([[0.5, 0.4, 0.6, 0.5, 0.5]], { max: 5, segments: 5 }, niceSplit);
  assert.equal(fixedA.max, fixedB.max);
});
