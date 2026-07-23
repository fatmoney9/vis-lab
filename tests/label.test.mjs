import test from 'node:test';
import assert from 'node:assert/strict';

import { labelTone, relativeLuminance, dropCollisions, dropOversized } from '../charts/core/label.js';

/* ── [LABEL-04] 档② 明暗反色 ──────────────────────────────────────────── */

test('LABEL-04：深色系列色 → on-dark（配浅色文字）', () => {
  assert.equal(labelTone('#3366FF'), 'on-dark');  /* THS single-default，L≈0.174 */
  assert.equal(labelTone('#265FFC'), 'on-dark');  /* Ainvest single-default */
  assert.equal(labelTone('#4D5999'), 'on-dark');  /* iFinD single-default */
  assert.equal(labelTone('#000000'), 'on-dark');
});

test('LABEL-04：浅色系列色 → on-light（配深色文字）', () => {
  assert.equal(labelTone('#52BBFF'), 'on-light'); /* THS bar-multi[0]，L≈0.445：0.5 阈值会误判成深底 */
  assert.equal(labelTone('#F2D755'), 'on-light'); /* iFinD 黄 */
  assert.equal(labelTone('#FFFFFF'), 'on-light');
});

test('LABEL-04：阈值 = 黑白对比度交叉点 √(1.05×0.05)−0.05 ≈ 0.179，两侧各一例', () => {
  const crossover = Math.sqrt(1.05 * 0.05) - 0.05;
  const below = '#757575'; /* L≈0.17789，略低于交叉点 */
  const above = '#767676'; /* L≈0.18116，略高于交叉点 */
  assert.ok(relativeLuminance(below) < crossover);
  assert.ok(relativeLuminance(above) > crossover);
  assert.equal(labelTone(below), 'on-dark');
  assert.equal(labelTone(above), 'on-light');
});

test('LABEL-04：#RGB 简写与大小写等价；非法色值按浅底兜底（回落常规正文色）', () => {
  assert.equal(labelTone('#fff'), labelTone('#FFFFFF'));
  assert.equal(labelTone('#036'), labelTone('#003366'));
  assert.equal(relativeLuminance('not-a-color'), null);
  assert.equal(labelTone(undefined), 'on-light');
  assert.equal(labelTone('#12345'), 'on-light');
});

/* ── [LABEL-06②] 同行碰撞过滤 ────────────────────────────────────────── */

const box = (left, width = 20) => ({ left, width });

test('LABEL-06②：净距足够 → 全部保留', () => {
  const boxes = [box(0), box(30), box(60)]; /* 净距 10 ≥ minGap 4 */
  assert.equal(dropCollisions(boxes, 4).length, 3);
});

test('LABEL-06②：净距不足 → 丢后者、保前者（首个恒留）', () => {
  const boxes = [box(0), box(22), box(60)]; /* 第二个净距 2 < 4 被丢；第三个与首个净距 40 保留 */
  assert.deepEqual(dropCollisions(boxes, 4).map((b) => b.left), [0, 60]);
});

test('LABEL-06②：连续拥挤时按「上一个保留者」而非「上一个」判定，避免隔一个留一个的抖动', () => {
  const boxes = [box(0), box(10), box(20), box(30), box(45)];
  /* 保留 0（右沿 20）后：10 重叠丢、20 净距 0 丢、30 净距 10 保留（右沿 50）、45 与 30 重叠丢。
     关键点：20 是与「保留者 0」比而不是与刚被丢掉的 10 比——否则会退化成隔一个留一个 */
  assert.deepEqual(dropCollisions(boxes, 4).map((b) => b.left), [0, 30]);
});

test('LABEL-06②：入参乱序也按 left 升序判定，且不改动入参', () => {
  const boxes = [box(60), box(0), box(22)];
  const snapshot = boxes.map((b) => b.left);
  assert.deepEqual(dropCollisions(boxes, 4).map((b) => b.left), [0, 60]);
  assert.deepEqual(boxes.map((b) => b.left), snapshot);
});

test('LABEL-06②：minGap = 0 → 仅真正重叠才丢（紧贴视为可接受）', () => {
  const boxes = [box(0), box(20), box(39)]; /* 20 恰好紧贴保留；39 与 20 重叠 1px 丢弃 */
  assert.deepEqual(dropCollisions(boxes, 0).map((b) => b.left), [0, 20]);
});

test('LABEL-06②：空数组与单个标签的边界', () => {
  assert.deepEqual(dropCollisions([], 4), []);
  assert.equal(dropCollisions([box(0, 500)], 4).length, 1); /* 单个再宽也留（限宽是 LABEL-06③ 的事） */
});

/* ── [LABEL-06③] 放不下就不放（宽度方向） ────────────────────────────── */

test('LABEL-06③：宽度超过所在色块 → 丢弃（THS 16px 柱放不下长数值）', () => {
  const boxes = [
    { width: 34, maxWidth: 16, tag: '70万' },   /* 溢出柱宽，溢出部分会白底白字 */
    { width: 12, maxWidth: 16, tag: '5' },
  ];
  assert.deepEqual(dropOversized(boxes).map((b) => b.tag), ['5']);
});

test('LABEL-06③：恰好等宽算放得下；maxWidth 缺省 = 不限宽（档① 柱顶 / 折线不限）', () => {
  assert.equal(dropOversized([{ width: 16, maxWidth: 16 }]).length, 1);
  assert.equal(dropOversized([{ width: 999 }]).length, 1);
  assert.equal(dropOversized([{ width: 999, maxWidth: undefined }]).length, 1);
});
