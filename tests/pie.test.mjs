import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sliceAngles, donutRadii, labelAnchor, leaderElbow, alignOutside,
} from '../charts/charts/pie/geometry.js';

const TAU = Math.PI * 2;

const closeTo = (actual, expected, msg) => assert.ok(
  Math.abs(actual - expected) < 1e-9,
  msg ?? `expected ${actual} to be close to ${expected}`,
);

/* ── PIE-01 扇区角度 ─────────────────────────────────────────────── */

test('PIE-01：等值扇区均分整环，自 12 点顺时针首尾相接', () => {
  const slices = sliceAngles([1, 1, 1, 1]);

  assert.equal(slices.length, 4);
  closeTo(slices[0].a0, 0);                    /* 首扇区自 12 点起 */
  slices.forEach((s) => closeTo(s.a1 - s.a0, TAU / 4));
  slices.slice(1).forEach((s, i) => closeTo(s.a0, slices[i].a1)); /* 段间无缝 */
});

test('PIE-01：末段吸到 TAU——整环恒闭合，不留浮点缝', () => {
  /* 三等分是最典型的除不尽情形：1/3 的浮点残差累加后末端会差 ~1e-16 */
  const slices = sliceAngles([1, 1, 1]);

  assert.equal(slices[slices.length - 1].a1, TAU, '末段 a1 必须**严格**等于 TAU');
});

test('PIE-01：null 与 ≤0 既不占角也不进分母', () => {
  /* 两个 30 若把 0/null/负值计入分母，各自会小于半环 */
  const slices = sliceAngles([30, 0, null, -10, 30]);

  assert.deepEqual(slices.map((s) => s.i), [0, 4], '只有可绘扇区进入结果，且带原始下标');
  closeTo(slices[0].a1 - slices[0].a0, TAU / 2);
  closeTo(slices[1].a1 - slices[1].a0, TAU / 2);
});

test('PIE-01：原始下标随跳过而保持——颜色跟随实体不移位（COLOR-04/08）', () => {
  const slices = sliceAngles([null, 5, null, 5]);

  assert.deepEqual(slices.map((s) => s.i), [1, 3]);
});

test('PIE-01：单个可见扇区独占整环', () => {
  const slices = sliceAngles([null, 7, 0]);

  assert.equal(slices.length, 1);
  closeTo(slices[0].a0, 0);
  assert.equal(slices[0].a1, TAU);
});

test('PIE-01：全为 null / ≤0 时什么都不画（不抛错）', () => {
  assert.deepEqual(sliceAngles([]), []);
  assert.deepEqual(sliceAngles([0, null, -3]), []);
});

test('PIE-03：隐藏扇区后剩余扇区重新闭合 360°', () => {
  /* 组件按可见扇区调本函数，故「隐藏」在这一层就是不传那一项 */
  const all = sliceAngles([50, 30, 20]);
  const afterHide = sliceAngles([50, 20]);

  assert.equal(all[all.length - 1].a1, TAU);
  assert.equal(afterHide[afterHide.length - 1].a1, TAU);
  closeTo(afterHide[0].a1 - afterHide[0].a0, TAU * (50 / 70)); /* 占比按可见项重算 */
});

/* ── PIE-02 半径与环宽 ───────────────────────────────────────────── */

test('PIE-02：空间富余时 R 取 token 上限，环宽取满值', () => {
  const { R, innerR, ring } = donutRadii(400, 200, 70, 28, 'donut');

  assert.equal(R, 70);
  assert.equal(ring, 28);
  assert.equal(innerR, 42);
});

test('PIE-02：空间不足时 R 收缩到短边一半，环宽等比跟随', () => {
  const { R, innerR, ring } = donutRadii(400, 100, 70, 28, 'donut');

  assert.equal(R, 50);                       /* min(w,h)/2 胜过 token */
  closeTo(ring, 20);                         /* 28 × 50/70 */
  closeTo(innerR, 30);
  closeTo(ring / R, 28 / 70, '环宽:半径比全程不变');
});

test('PIE-02：收缩触底 —— R 不小于默认半径的 50%，环宽同比触底', () => {
  /* 短边只有 40（半径够 20）时，若无下限 R 会缩到 20；下限把它托回 35 = 70 × 0.5 */
  const { R, innerR, ring } = donutRadii(400, 40, 70, 28, 'donut');

  assert.equal(R, 35);
  closeTo(ring, 14);                         /* 28 × 35/70 —— 触底时环宽也触底 */
  closeTo(innerR, 21);
  closeTo(ring / R, 28 / 70, '触底后环宽:半径比仍不变');
});

test('PIE-02：触底后容器继续变小，R 不再跟着缩（环改为溢出画布）', () => {
  const tiny = donutRadii(400, 4, 70, 28, 'donut');
  const zero = donutRadii(0, 0, 70, 28, 'donut');
  const negative = donutRadii(-100, -100, 70, 28, 'donut');   /* 上下结构扣掉图例后可能为负 */

  assert.equal(tiny.R, 35);
  assert.equal(zero.R, 35);
  assert.equal(negative.R, 35, '负的可用空间也只触底、不出负半径');
});

test('PIE-02：下限是「默认半径的一半」，故 token 缺失时下限也是 0（不凭空造环）', () => {
  assert.equal(donutRadii(0, 0, 0, 28, 'donut').R, 0);
});

test('PIE-02：variant=pie 内半径为 0，径向厚度记作 R', () => {
  const { R, innerR, ring } = donutRadii(400, 200, 70, 28, 'pie');

  assert.equal(R, 70);
  assert.equal(innerR, 0);
  assert.equal(ring, 70, 'pie 的径向厚度 = R，好让标签可用宽用同一条式子');
});

test('PIE-02：token 缺失（≤0）时退化为不画，而不是抛错或画出负半径', () => {
  const { R, innerR, ring } = donutRadii(400, 200, 0, 28, 'donut');

  assert.equal(R, 0);
  assert.equal(innerR, 0);
  assert.equal(ring, 0);
});

/* ── PIE-04 标签锚点 ─────────────────────────────────────────────── */

test('PIE-04：锚点落在环带中线上（距圆心 = (R+innerR)/2）', () => {
  const a = labelAnchor(0, TAU / 4, 70, 42);

  closeTo(Math.hypot(a.x, a.y), 56); /* (70+42)/2 */
});

test('PIE-04：0 弧度 = 12 点方向，正角顺时针（与 d3.arc 同源）', () => {
  const top = labelAnchor(-0.001, 0.001, 70, 42);   /* 中线 ≈ 0 → 正上方 */
  const right = labelAnchor(TAU / 4 - 0.001, TAU / 4 + 0.001, 70, 42); /* 中线 ≈ 90° → 正右方 */

  closeTo(top.x, 0);
  closeTo(top.y, -56, '12 点方向 y 为负（SVG 向下为正）');
  closeTo(right.x, 56);
  closeTo(right.y, 0);
});

test('PIE-04：可用宽取「切向弧长」与「环宽」的较小者', () => {
  /* 窄扇区：弧长 56 × 0.1 = 5.6 < 环宽 28 → 弧长胜出 */
  closeTo(labelAnchor(0, 0.1, 70, 42).maxWidth, 5.6);
  /* 宽扇区：弧长 56 × (π/2) ≈ 88 > 环宽 28 → 环宽胜出 */
  closeTo(labelAnchor(0, TAU / 4, 70, 42).maxWidth, 28);
});

test('PIE-04：pie 形态的可用宽比同尺寸的环宽松（径向厚度 = R）', () => {
  const donut = labelAnchor(0, TAU / 4, 70, 42);
  const pie = labelAnchor(0, TAU / 4, 70, 0);

  assert.ok(pie.maxWidth > donut.maxWidth, '实心饼能留住更多标签');
  closeTo(pie.maxWidth, 35 * (TAU / 4)); /* rm=35 → 弧长 ≈ 55 < R=70，弧长胜出 */
});

/* ── PIE-12 引线肘点 ─────────────────────────────────────────────── */

/* 单点扇区：把中线钉在指定角上，好逐个方向断言 */
const at = (mid, R = 70, radial = 8) => leaderElbow(mid - 1e-9, mid + 1e-9, R, radial);

test('PIE-12：肘点在中线延长线上，且比外半径远出恰好 radial', () => {
  for (const mid of [0.3, 1.2, 2.5, 4.0, 5.7]) {
    const e = at(mid);
    closeTo(Math.hypot(e.ax, e.ay), 70, '起点落在外半径上');
    closeTo(Math.hypot(e.ex, e.ey), 78, 'radial 是加在半径上，不是缩放');
    /* 共线：肘点方向与起点方向一致（叉积为 0） */
    closeTo(e.ax * e.ey - e.ay * e.ex, 0, '肘点必须在同一条法线上');
  }
});

test('PIE-12：四个钟点方向的坐标与分侧（12 点归右、6 点归左）', () => {
  const top = at(0);
  const right = at(TAU / 4);
  const bottom = at(TAU / 2);
  const left = at(TAU * 3 / 4);

  closeTo(top.ex, 0); closeTo(top.ey, -78); assert.equal(top.side, 'right');
  closeTo(right.ex, 78); closeTo(right.ey, 0); assert.equal(right.side, 'right');
  closeTo(bottom.ex, 0); closeTo(bottom.ey, 78); assert.equal(bottom.side, 'left');
  closeTo(left.ex, -78); closeTo(left.ey, 0); assert.equal(left.side, 'left');
});

test('PIE-12：主题分化只体现在 radial 上（Ainvest 16 vs THS 8），起点不受影响', () => {
  const ths = at(1.0, 70, 8);
  const ainvest = at(1.0, 70, 16);

  closeTo(Math.hypot(ths.ax - ainvest.ax, ths.ay - ainvest.ay), 0, '弧上起点只由 R 定');
  closeTo(Math.hypot(ainvest.ex, ainvest.ey) - Math.hypot(ths.ex, ths.ey), 8);
});

test('PIE-12：radial 取负按 0 兜底（肘点退化到弧上，不产生反向折线）', () => {
  const e = at(1.0, 70, -20);

  closeTo(e.ex, e.ax);
  closeTo(e.ey, e.ay);
});

/* ── PIE-13 三档对齐 ─────────────────────────────────────────────── */

const R = 70;
const OPT = { lateral: 8, gap: 8, R };
/* 三个右侧扇区。**最远的肘点与最宽的文本刻意不在同一项**——否则 column 与 anchor 的
   带宽会碰巧相等，「末端共线把线推到最远那条」这条差别就测不出来。 */
const RIGHT = [
  { side: 'right', ex: 10, textWidth: 120 },
  { side: 'right', ex: 60, textWidth: 30 },
  { side: 'right', ex: 30, textWidth: 60 },
];

test('PIE-13 anchor：横段定长，末端 = 肘点 + lateral，文字紧跟其后 gap', () => {
  const { items } = alignOutside(RIGHT, 'anchor', OPT);

  assert.deepEqual(items.map((d) => d.lineEndX), [18, 68, 38]);
  assert.deepEqual(items.map((d) => d.textX), [26, 76, 46]);
  assert.ok(items.every((d) => d.anchor === 'start'), '右侧文字自锚点向右排');
});

test('PIE-13 column：同侧末端共线（取最远肘点 + lateral），文字内沿贴同一条线', () => {
  const { items } = alignOutside(RIGHT, 'column', OPT);

  assert.deepEqual(items.map((d) => d.lineEndX), [68, 68, 68], '同侧 lineEndX 必须全相等');
  assert.deepEqual(items.map((d) => d.textX), [76, 76, 76]);
});

test('PIE-13 edge：文字外沿共线（贴画布边），横段反过来长短不一', () => {
  const { band, items } = alignOutside(RIGHT, 'edge', OPT);
  const outer = R + band.right;

  assert.ok(items.every((d) => d.anchor === 'end'), '右侧文字自外沿向左排');
  assert.deepEqual(items.map((d) => d.textX), [outer, outer, outer], '同侧文字外沿必须全相等');
  /* 末端 = 外沿 − 文本宽 − gap，故文本越短线越长；下限是自己那条定长横段（不折回） */
  assert.deepEqual(items.map((d) => d.lineEndX), [outer - 128, outer - 38, outer - 68]);
});

test('PIE-13：column 的标签带比 anchor / edge 宽 —— 末端共线把线推到最远那条', () => {
  const anchor = alignOutside(RIGHT, 'anchor', OPT).band.right;
  const edge = alignOutside(RIGHT, 'edge', OPT).band.right;
  const column = alignOutside(RIGHT, 'column', OPT).band.right;

  assert.equal(anchor, edge, 'anchor 与 edge 同为「能容下全部文字的最紧带宽」');
  closeTo(anchor, (10 + 8 + 8 + 120) - R);          /* 最外那一项各自算：146 − 70 */
  closeTo(column, (60 + 8) + 8 + 120 - R);          /* 共线于 68，再加最宽文本：196 − 70 */
  assert.ok(column > anchor, 'column 恒不窄于另两档，本例严格更宽');
});

test('PIE-13：两侧带宽恒等 —— 取较宽一侧所需，窄侧照样预留同宽', () => {
  const { band } = alignOutside([
    { side: 'right', ex: 10, textWidth: 20 },
    { side: 'left', ex: -60, textWidth: 120 },
  ], 'anchor', OPT);

  /* 左侧需 60+8+8+120−R，右侧只需 10+8+8+20−R；对称后两侧都取前者 */
  closeTo(band.left, 60 + 8 + 8 + 120 - R);
  assert.equal(band.right, band.left, '窄侧不能自己算自己的，否则圆心偏离画布中心');
});

test('PIE-13：单侧有标签时另一侧也留同宽的带（圆心不偏移的直接证据）', () => {
  const { band } = alignOutside([{ side: 'left', ex: -60, textWidth: 120 }], 'anchor', OPT);

  closeTo(band.left, 60 + 8 + 8 + 120 - R);
  assert.equal(band.right, band.left, '右侧一条引线都没有，仍要留出等宽的带');
});

test('PIE-13：bandCap 对称生效 —— 截断后两侧仍恒等', () => {
  const { band } = alignOutside([
    { side: 'left', ex: -60, textWidth: 400 },
    { side: 'right', ex: 10, textWidth: 20 },
  ], 'anchor', { ...OPT, bandCap: 120 });

  assert.deepEqual(band, { left: 120, right: 120 });
});

test('PIE-13：左侧的横段与文字一律朝左（x 为负、anchor 反向）', () => {
  const { items } = alignOutside([{ side: 'left', ex: -30, textWidth: 50 }], 'anchor', OPT);

  assert.equal(items[0].lineEndX, -38);
  assert.equal(items[0].textX, -46);
  assert.equal(items[0].anchor, 'end', '左侧文字自锚点向左排');
});

test('PIE-13：bandCap 截断带宽 → 只压缩 maxWidth，位置一概不动（丢弃归 LABEL-06③）', () => {
  const free = alignOutside(RIGHT, 'anchor', OPT);
  const capped = alignOutside(RIGHT, 'anchor', { ...OPT, bandCap: 20 });

  assert.deepEqual(capped.items.map((d) => d.lineEndX), free.items.map((d) => d.lineEndX));
  assert.deepEqual(capped.items.map((d) => d.textX), free.items.map((d) => d.textX));
  assert.equal(capped.band.right, 20);
  capped.items.forEach((d, i) => assert.ok(d.maxWidth < free.items[i].maxWidth, '可用宽必须变小'));
});

test('PIE-13：maxWidth 恰好是「文字起点 → 带宽外沿」的距离，且不为负', () => {
  const { band, items } = alignOutside(RIGHT, 'anchor', OPT);
  const outer = R + band.right;

  items.forEach((d) => closeTo(d.maxWidth, outer - d.textX));
  /* 带宽被压到 0 时也不出负数（负的 maxWidth 会让 dropOversized 判得莫名其妙） */
  alignOutside(RIGHT, 'anchor', { ...OPT, bandCap: 0 }).items
    .forEach((d) => assert.ok(d.maxWidth >= 0));
});

test('PIE-13：空入参不抛错，带宽为 0（全部扇区值为 null 时会走到这里）', () => {
  const { band, items } = alignOutside([], 'anchor', OPT);

  assert.deepEqual(items, []);
  assert.deepEqual(band, { left: 0, right: 0 });
});
