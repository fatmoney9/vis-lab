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

/* ── [LABEL-06②] 碰撞过滤（一条线上，轴无关） ────────────────────────── */

/* 字段是 start/size 而非 left/width：同一条贪心两个方向共用——
   柱线喂水平值（文本左沿 / 文本宽），饼环外侧标签喂垂直值（y−半行高 / 行高，PIE-14）。 */
const box = (start, size = 20) => ({ start, size });

test('LABEL-06②：净距足够 → 全部保留', () => {
  const boxes = [box(0), box(30), box(60)]; /* 净距 10 ≥ minGap 4 */
  assert.equal(dropCollisions(boxes, 4).length, 3);
});

test('LABEL-06②：净距不足 → 丢后者、保前者（首个恒留）', () => {
  const boxes = [box(0), box(22), box(60)]; /* 第二个净距 2 < 4 被丢；第三个与首个净距 40 保留 */
  assert.deepEqual(dropCollisions(boxes, 4).map((b) => b.start), [0, 60]);
});

test('LABEL-06②：连续拥挤时按「上一个保留者」而非「上一个」判定，避免隔一个留一个的抖动', () => {
  const boxes = [box(0), box(10), box(20), box(30), box(45)];
  /* 保留 0（远沿 20）后：10 重叠丢、20 净距 0 丢、30 净距 10 保留（远沿 50）、45 与 30 重叠丢。
     关键点：20 是与「保留者 0」比而不是与刚被丢掉的 10 比——否则会退化成隔一个留一个 */
  assert.deepEqual(dropCollisions(boxes, 4).map((b) => b.start), [0, 30]);
});

test('LABEL-06②：入参乱序也按 start 升序判定，且不改动入参', () => {
  const boxes = [box(60), box(0), box(22)];
  const snapshot = boxes.map((b) => b.start);
  assert.deepEqual(dropCollisions(boxes, 4).map((b) => b.start), [0, 60]);
  assert.deepEqual(boxes.map((b) => b.start), snapshot);
});

test('LABEL-06②：minGap = 0 → 仅真正重叠才丢（紧贴视为可接受）', () => {
  const boxes = [box(0), box(20), box(39)]; /* 20 恰好紧贴保留；39 与 20 重叠 1px 丢弃 */
  assert.deepEqual(dropCollisions(boxes, 0).map((b) => b.start), [0, 20]);
});

test('LABEL-06②：空数组与单个标签的边界', () => {
  assert.deepEqual(dropCollisions([], 4), []);
  assert.equal(dropCollisions([box(0, 500)], 4).length, 1); /* 单个再宽也留（限宽是 LABEL-06③ 的事） */
});

/*
 * [LABEL-06②][PIE-14] 轴无关：喂**垂直**值（饼环外侧标签的用法）行为与水平向逐字一致。
 * 这组存在的意义是把「同一条贪心两个方向共用」变成可执行断言——
 * 若哪天有人把 start/size 改回 left/width，或在 L2 另写一份纵向版，这里会先炸。
 */
const vbox = (y, lineH = 14) => ({ start: y - lineH / 2, size: lineH, y });

test('LABEL-06②：纵向同样成立——同一侧标签自上而下判，重叠即丢（不位移）', () => {
  /* 行高 14、minGap 4 ⇒ 相邻中心距 < 18 即判重叠 */
  const boxes = [vbox(-60), vbox(-50), vbox(-20), vbox(0)];
  /* −60 恒留；−50 与它中心距 10 < 18 丢；−20 距 −60 有 40 保留；0 距 −20 只有 20 ≥ 18 保留 */
  assert.deepEqual(dropCollisions(boxes, 4).map((b) => b.y), [-60, -20, 0]);
});

test('LABEL-06②：纵向的负坐标与乱序（扇区按角度出场，y 天然无序且跨越 0）', () => {
  const boxes = [vbox(30), vbox(-70), vbox(-64), vbox(35)];
  /* 升序为 −70 / −64 / 30 / 35：−70 留、−64 距 6 丢、30 留、35 距 5 丢 */
  assert.deepEqual(dropCollisions(boxes, 4).map((b) => b.y), [-70, 30]);
});

test('LABEL-06②：纵向也「变挤只会更少、不跳变」——放大行高只会丢得更多，保留集单调收缩', () => {
  const ys = [-60, -40, -20, 0, 20, 40];
  const keptOf = (lineH) => dropCollisions(ys.map((y) => vbox(y, lineH)), 4).map((b) => b.y);
  const loose = keptOf(10);   /* 中心距 20 > 10+4 → 全留 */
  const tight = keptOf(20);   /* 中心距 20 < 20+4 → 隔一个留一个 */

  assert.deepEqual(loose, ys);
  assert.ok(tight.length < loose.length);
  assert.ok(tight.every((y) => loose.includes(y)), '收紧后的保留集必须是放宽时的子集');
  assert.equal(tight[0], ys[0], '首个（最上面那个）恒留');
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
