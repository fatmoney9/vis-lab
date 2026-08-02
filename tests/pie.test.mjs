import test from 'node:test';
import assert from 'node:assert/strict';

import { sliceAngles, donutRadii, labelAnchor } from '../charts/charts/pie/geometry.js';

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
