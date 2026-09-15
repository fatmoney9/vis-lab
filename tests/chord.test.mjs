/*
 * 弦图几何的纯逻辑单测（specs/chord.md）。
 *
 * 测 charts/charts/chord/layout.js 与 config.js —— 不碰 DOM / d3 / token，
 * 唯一的 import 是同样零依赖的 core/polar-label.js，故可直接加载。
 *
 * 路径只断**不变量**（大弧标志、sweep、命令构成），不比对整串 d 文本：
 * 后者一改坐标精度就全红，是典型的脆测试。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_ENTITIES, assertChordConfig, chordSlots, chordAngles,
  chordRibbons, arcPath, ribbonPath, taperedSpan, chordFrame, layoutChord,
} from '../charts/charts/chord/layout.js';
import { CHORD_SETTINGS, resolveChordSettings } from '../charts/charts/chord/config.js';

const TAU = Math.PI * 2;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

const OPT = { padAngle: 0.035, padMaxShare: 0.12, minSlotAngle: 0.004 };

/* 不对称矩阵：A→B 与 B→A 不等，专门用来抓「两端写反」 */
const M4 = [
  [0, 10, 5, 1],
  [2, 0, 8, 3],
  [7, 4, 0, 6],
  [9, 1, 2, 0],
];
const E4 = ['电子', '银行', '医药', '汽车'];
const cfg4 = (extra = {}) => ({ entities: E4, matrix: M4, ...extra });

const gridN = (n) => Array.from({ length: n }, (_, i) => (
  Array.from({ length: n }, (_, j) => (i === j ? 0 : ((i * 7 + j * 3) % 11) + 1))
));
const namesN = (n) => Array.from({ length: n }, (_, i) => `行业${i + 1}`);

/* ── [CHORD-01] 校验与归零 ───────────────────────────────────── */

test('CHORD-01：非方阵、行长不齐、实体不足、名称重复都抛错', () => {
  assert.throws(() => assertChordConfig({ entities: E4, matrix: [[0, 1], [1, 0]] }), /方阵/);
  /* 逐行校验：首行长度正确、第 2 行短一列 —— 只看首行的实现会漏掉 */
  assert.throws(
    () => assertChordConfig({ entities: E4, matrix: [[0, 1, 2, 3], [1, 0, 2], [1, 2, 0, 3], [1, 2, 3, 0]] }),
    /第 1 行/,
  );
  assert.throws(() => assertChordConfig({ entities: ['甲', '乙'], matrix: [[0, 1], [1, 0]] }), /至少 3/);
  assert.throws(
    () => assertChordConfig({ entities: ['甲', '甲', '乙'], matrix: gridN(3) }),
    /唯一/,
  );
  assert.equal(MIN_ENTITIES, 3);
});

test('CHORD-01：负值 / NaN / Infinity / null 归零，且不进分母', () => {
  const matrix = [
    [0, -5, Number.NaN, 4],
    [Infinity, 0, 3, null],
    [2, 1, 0, 6],
    [1, 2, 3, 0],
  ];
  const { matrix: clean } = assertChordConfig({ entities: E4, matrix });
  assert.deepEqual(clean[0], [0, 0, 0, 4]);
  assert.deepEqual(clean[1], [0, 0, 3, 0]);
  const groups = chordSlots(clean, 'undirected');
  assert.equal(groups[0].total, 4, '归零的三项没有进入行和');
});

test('CHORD-01：对角线一律忽略，不产出自弦', () => {
  const matrix = [[99, 1, 2], [1, 88, 3], [2, 3, 77]];
  const { matrix: clean } = assertChordConfig({ entities: ['甲', '乙', '丙'], matrix });
  assert.deepEqual(clean.map((r, i) => r[i]), [0, 0, 0]);
  for (const variant of ['undirected', 'directed']) {
    const ribbons = chordRibbons(chordAngles(chordSlots(clean, variant), OPT).groups, variant);
    assert.equal(ribbons.filter((r) => r.i === r.j).length, 0, `${variant} 档不应出现自弦`);
  }
});

test('CHORD-01：全零矩阵不抛错，只等分外圈占位', () => {
  const zero = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const angled = chordAngles(chordSlots(zero, 'undirected'), OPT);
  assert.equal(angled.empty, true);
  const spans = angled.groups.map((g) => g.a1 - g.a0);
  assert.ok(spans.every((s) => near(s, spans[0])), '等分');
  assert.ok(near(spans.reduce((a, b) => a + b, 0) + 3 * angled.pad, TAU));
});

test('CHORD-01：variant / entityLabelLayout 只认白名单', () => {
  assert.throws(() => assertChordConfig(cfg4({ variant: 'both' })), /variant/);
  assert.throws(() => assertChordConfig(cfg4({ entityLabelLayout: 'radial' })), /entityLabelLayout/);
  assert.equal(assertChordConfig(cfg4()).variant, 'undirected', '默认无向');
  assert.equal(assertChordConfig(cfg4()).entityLabelLayout, 'arc', '默认沿弧');
});

/* ── [CHORD-05] 槽位模型：两档的唯一差异 ────────────────────── */

test('CHORD-05：directed 的实体总量 = undirected 的总量 + 该实体列和', () => {
  /* **本文件最重要的一条**：一旦有人把两档改成两套平行模型，这里立刻红。 */
  const un = chordSlots(M4, 'undirected');
  const di = chordSlots(M4, 'directed');
  for (let i = 0; i < M4.length; i += 1) {
    const colSum = M4.reduce((s, row) => s + row[i], 0);
    assert.equal(di[i].total, un[i].total + colSum, `实体 ${i}`);
    assert.equal(un[i].total, M4[i].reduce((s, v) => s + v, 0), `实体 ${i} 无向档 = 行和`);
  }
});

test('CHORD-05：槽位数 —— 无向 n−1、有向 2(n−1)（全非零矩阵）', () => {
  const m = gridN(5);
  assert.equal(chordSlots(m, 'undirected')[0].slots.length, 4);
  assert.equal(chordSlots(m, 'directed')[0].slots.length, 8);
});

test('CHORD-05：单向流量在无向档保留零宽槽位，弦不会整条消失', () => {
  /* 甲→乙 有量、乙→甲 为 0：乙那侧必须仍有落点，否则这笔流量画不出来 */
  const m = [[0, 6, 0], [0, 0, 4], [3, 0, 0]];
  const groups = chordSlots(m, 'undirected');
  const back = groups[1].slots.find((s) => s.partner === 0);
  assert.ok(back, '乙朝甲的零宽槽位应当存在');
  assert.equal(back.value, 0);
  const ribbons = chordRibbons(chordAngles(groups, OPT).groups, 'undirected');
  assert.ok(ribbons.some((r) => r.i === 0 && r.j === 1), '单向弦仍然产出');
});

test('CHORD-02：槽位与实体恒按声明序，不随值重排', () => {
  const groups = chordSlots(M4, 'undirected');
  assert.deepEqual(groups.map((g) => g.index), [0, 1, 2, 3]);
  assert.deepEqual(groups[0].slots.map((s) => s.partner), [1, 2, 3], '按对手方声明序，不按值降序');
  /* 把最大值换到别处，顺序不应改变 */
  const swapped = M4.map((r) => r.slice());
  [swapped[0][1], swapped[0][3]] = [swapped[0][3], swapped[0][1]];
  assert.deepEqual(chordSlots(swapped, 'undirected')[0].slots.map((s) => s.partner), [1, 2, 3]);
});

/* ── [CHORD-03/04/18] 角度分配 ───────────────────────────────── */

for (const n of [4, 10]) {
  for (const variant of ['undirected', 'directed']) {
    test(`CHORD-03：n=${n} ${variant} —— Σ弧跨度 + n·pad ≡ 2π`, () => {
      const angled = chordAngles(chordSlots(gridN(n), variant), OPT);
      const spans = angled.groups.reduce((s, g) => s + (g.a1 - g.a0), 0);
      assert.ok(near(spans + n * angled.pad, TAU), `实际 ${spans + n * angled.pad}`);
    });
  }
}

test('CHORD-02/03：首个实体从 12 点起，顺时针严格递增且互不重叠', () => {
  const angled = chordAngles(chordSlots(gridN(6), 'undirected'), OPT);
  assert.equal(angled.groups[0].a0, 0);
  for (let i = 1; i < angled.groups.length; i += 1) {
    assert.ok(angled.groups[i].a0 >= angled.groups[i - 1].a1, '不重叠');
    assert.ok(near(angled.groups[i].a0 - angled.groups[i - 1].a1, angled.pad), '间隙恒为 pad');
  }
});

test('CHORD-04：pad 被 padMaxShare 夹住 —— 实体多时间隙不吃掉图元', () => {
  const big = { padAngle: 1.0, padMaxShare: 0.12, minSlotAngle: 0 };
  for (const n of [4, 10, 24]) {
    const angled = chordAngles(chordSlots(gridN(n), 'undirected'), big);
    assert.ok(n * angled.pad <= 0.12 * TAU + 1e-12, `n=${n} 的间隙总量应被封顶`);
  }
  /* 不夹的话 n=10 时 10×1.0 = 10 rad 已经超过整圈 */
  assert.ok(chordAngles(chordSlots(gridN(10), 'undirected'), big).pad < 1.0);
});

test('CHORD-18：零值不占角；非零但极小的槽位被抬到下限', () => {
  const m = [
    [0, 1000, 0, 0.0001],
    [1000, 0, 0, 0],
    [0, 0, 0, 500],
    [0.0001, 0, 500, 0],
  ];
  const angled = chordAngles(chordSlots(m, 'undirected'), OPT);
  const all = angled.groups.flatMap((g) => g.slots);
  for (const s of all) {
    const span = s.a1 - s.a0;
    if (s.value === 0) assert.ok(near(span, 0), '零值不占角');
    else assert.ok(span >= OPT.minSlotAngle - 1e-12, `极小值 ${s.value} 应被抬到下限，实际 ${span}`);
  }
  const spans = angled.groups.reduce((s, g) => s + (g.a1 - g.a0), 0);
  assert.ok(near(spans + 4 * angled.pad, TAU), '抬升后总和仍守恒');
});

test('CHORD-18：下限本身超额时退化为等分，不让任何一份消失', () => {
  const angled = chordAngles(chordSlots(gridN(8), 'directed'), {
    padAngle: 0.01, padMaxShare: 0.12, minSlotAngle: 1,
  });
  const all = angled.groups.flatMap((g) => g.slots).filter((s) => s.value > 0);
  const spans = all.map((s) => s.a1 - s.a0);
  assert.ok(spans.every((s) => near(s, spans[0])), '等分');
  assert.ok(spans.every((s) => s > 0));
});

/* ── [CHORD-06/08] 配对与取色 ────────────────────────────────── */

test('CHORD-06：无向档弦数 = 非零无序对数，两端跨度比 = M[i][j] : M[j][i]', () => {
  const angled = chordAngles(chordSlots(M4, 'undirected'), { ...OPT, minSlotAngle: 0 });
  const ribbons = chordRibbons(angled.groups, 'undirected');
  assert.equal(ribbons.length, 6, '4 个实体两两成对 = 6 条');
  const r01 = ribbons.find((r) => r.i === 0 && r.j === 1);
  assert.equal(r01.sourceValue, M4[0][1]);
  assert.equal(r01.targetValue, M4[1][0]);
  const sSpan = r01.source.a1 - r01.source.a0;
  const tSpan = r01.target.a1 - r01.target.a0;
  assert.ok(near(sSpan / tSpan, M4[0][1] / M4[1][0], 1e-9), '两端粗细比即两个方向的量之比');
});

test('CHORD-06：有向档弦数 = 非零有序对数，taper 前两端等宽', () => {
  const angled = chordAngles(chordSlots(M4, 'directed'), { ...OPT, minSlotAngle: 0 });
  const ribbons = chordRibbons(angled.groups, 'directed');
  assert.equal(ribbons.length, 12, '4×3 个有序对');
  for (const r of ribbons) {
    assert.equal(r.sourceValue, r.targetValue, '同一笔流量的两端');
    assert.ok(near(r.source.a1 - r.source.a0, r.target.a1 - r.target.a0), 'taper 前等宽');
  }
});

test('CHORD-08：弦不取单色 —— 两端各自记着自己的实体序号', () => {
  /* 取色规则 2026-09-15 改为两端渐变：单色带只能表达其中一端，另一端的身份就丢了。
     故 chordRibbons 不再算「哪端更宽」，只把 i / j 交出去，由渲染层生成渐变。 */
  const ribbons = chordRibbons(chordAngles(chordSlots(M4, 'undirected'), OPT).groups, 'undirected');
  assert.ok(ribbons.every((r) => !('colorIndex' in r)), '不应再有单色的 colorIndex');
  const r01 = ribbons.find((r) => r.i === 0 && r.j === 1);
  assert.equal(r01.i, 0);
  assert.equal(r01.j, 1);
});

test('CHORD-08：渐变轴两端落在内圆上，且分别是两端弧的中点', () => {
  const out = layoutChord(cfg4(), { width: 320, height: 320 }, STYLE);
  const onInner = (x, y) => Math.abs(Math.hypot(x, y) - out.rInner) < 1e-6;
  for (const r of out.ribbons) {
    const g = r.gradient;
    assert.ok(onInner(g.x1, g.y1), `弦 ${r.key} 的渐变起点不在内圆上`);
    assert.ok(onInner(g.x2, g.y2), `弦 ${r.key} 的渐变终点不在内圆上`);
    /* 两端不可重合，否则渐变退化成单色——正是本条要消掉的病 */
    assert.ok(Math.hypot(g.x1 - g.x2, g.y1 - g.y2) > 1e-6, `弦 ${r.key} 的渐变轴退化成一个点`);
  }
});

test('CHORD-06/08：有向档的渐变终点取**收窄后**的中点', () => {
  /* taper 只动目标端；若渐变仍按收窄前的区间取中点，颜色的交界会偏出带子 */
  const un = layoutChord(cfg4({ variant: 'undirected' }), { width: 320, height: 320 }, STYLE);
  const di = layoutChord(cfg4({ variant: 'directed' }), { width: 320, height: 320 }, STYLE);
  assert.ok(un.ribbons.length && di.ribbons.length);
  for (const r of di.ribbons) {
    const mid = (r.target.a0 + r.target.a1) / 2;
    /* 对称收窄不改中点，故终点角度应与收窄前一致——这条同时证明 taper 没有把中点带偏 */
    const expected = { x: Math.sin(mid) * di.rInner, y: -Math.cos(mid) * di.rInner };
    assert.ok(Math.abs(r.gradient.x2 - expected.x) < 1e-9
      && Math.abs(r.gradient.y2 - expected.y) < 1e-9, `弦 ${r.key} 渐变终点偏了`);
  }
});

/* ── [CHORD-07] 路径不变量 ───────────────────────────────────── */

test('CHORD-07：大弧标志随跨度翻转 —— 跨度 > π 才置 1', () => {
  assert.match(arcPath(0, Math.PI * 0.5, 80, 70), /A80,80 0 0 1/, '四分之一圈 → 0');
  assert.match(arcPath(0, Math.PI * 1.5, 80, 70), /A80,80 0 1 1/, '四分之三圈 → 1');
  /* 恰好半圈是边界：不超过 π 即 0 */
  assert.match(arcPath(0, Math.PI, 80, 70), /A80,80 0 0 1/);
});

test('CHORD-07：环带内外弧 sweep 一正一反，否则自交成蝴蝶结', () => {
  const d = arcPath(0, Math.PI * 1.5, 80, 70);
  const arcs = [...d.matchAll(/A[\d.]+,[\d.]+ 0 (\d) (\d)/g)].map((m) => [m[1], m[2]]);
  assert.equal(arcs.length, 2);
  assert.deepEqual(arcs[0], ['1', '1'], '外弧顺时针');
  assert.deepEqual(arcs[1], ['1', '0'], '内弧反向回来');
  assert.ok(d.endsWith('Z'));
});

test('CHORD-07：弦恰好由 2 段弧 + 2 段二次贝塞尔构成，控制点恒为圆心', () => {
  const d = ribbonPath({ a0: 0, a1: 0.4 }, { a0: 2, a1: 2.5 }, 70);
  assert.ok(d.startsWith('M'));
  assert.ok(d.endsWith('Z'));
  assert.equal((d.match(/A/g) ?? []).length, 2);
  assert.equal((d.match(/Q/g) ?? []).length, 2);
  assert.equal((d.match(/Q0,0 /g) ?? []).length, 2, '两段贝塞尔的控制点都是 (0,0)');
});

test('CHORD-06：taper=1 是恒等元；taper<1 绕中点对称收窄', () => {
  const span = { a0: 1, a1: 2 };
  assert.deepEqual(taperedSpan(span, 1), { a0: 1, a1: 2 });
  const half = taperedSpan(span, 0.5);
  assert.ok(near(half.a1 - half.a0, 0.5), '跨度减半');
  assert.ok(near((half.a0 + half.a1) / 2, 1.5), '中点不动');
  /* 恒等元意味着无向档与有向档走同一条代码路径 */
  assert.equal(ribbonPath(span, { a0: 3, a1: 4 }, 70, 1), ribbonPath(span, { a0: 3, a1: 4 }, 70));
});

/* ── [CHORD-10] 画布几何 ─────────────────────────────────────── */

test('CHORD-10：R 被 maxRadius 封顶，且不低于其 50%', () => {
  const opts = { maxRadius: 80, ring: 10, minRadiusRatio: 0.5 };
  assert.equal(chordFrame(2000, 2000, opts).R, 80, '容器再大也不超 token 上限');
  assert.equal(chordFrame(40, 40, opts).R, 40, '容器极小时触底于 80×50%');
  assert.ok(chordFrame(120, 120, opts).R < 80, '中间尺寸按容器收缩');
});

test('CHORD-10：画布是正方形外接框，R 未触底时不超过容器', () => {
  const opts = { maxRadius: 80, ring: 10, minRadiusRatio: 0.5, inkBand: 16 };
  const f = chordFrame(300, 220, opts);
  assert.equal(f.width, f.height, '正方形');
  assert.ok(f.width <= 220, '吃的是 min(宽,高)，不是容器宽');
  assert.equal(f.rInner, f.R - 10, '内半径 = R − 环宽');
});

test('CHORD-10：horizontal 档的标签带吃剩余并封顶，不出负数', () => {
  const opts = { maxRadius: 70, ring: 10, minRadiusRatio: 0.5, labelLayout: 'horizontal', maxBand: 56 };
  assert.equal(chordFrame(400, 400, opts).band, 56, '宽容器下被封顶');
  assert.ok(chordFrame(160, 160, opts).band < 56, '紧容器下按剩余');
  assert.equal(chordFrame(60, 60, opts).band, 0, '容器比图元还窄 → 带宽 0');
});

test('CHORD-10：horizontal 档的带宽由**宽度**决定，与容器高度无关', () => {
  /* 这条守的是一个真实翻过的车：两档共用「正方形 + min(宽,高)」时，横排档的带宽被
     高度决定——容器没给高时退到 200，带宽只剩 20px，四个汉字一个都放不下，
     整层标签渲染成空串，而门禁与单测当时全绿。横排文字往左右伸，带宽就该看宽度。 */
  const opts = { maxRadius: 80, ring: 10, minRadiusRatio: 0.5, labelLayout: 'horizontal', maxBand: 56, inkBand: 16 };
  const wide = chordFrame(680, 200, opts);
  assert.equal(wide.band, 56, '宽容器下横向带应吃满封顶，哪怕容器很矮');
  const square = chordFrame(200, 200, opts);
  assert.ok(square.band < 56 && square.band > 0, '窄容器下按宽度的剩余');
  assert.ok(wide.band > square.band, '带宽随**宽度**增长');
  /* arc 档不受影响：四周等宽，仍吃 min(宽, 高) */
  const arc = chordFrame(680, 200, { ...opts, labelLayout: 'arc' });
  assert.equal(arc.width, arc.height, 'arc 档画布是正方形');
  assert.equal(arc.band, 16, 'arc 档的带宽就是文字墨迹，不吃容器剩余');
});

/* ── 顶层装配 ────────────────────────────────────────────────── */

const STYLE = {
  ...resolveChordSettings('pc'),
  maxRadius: 80,
  ring: 10,
  maxBand: 56,
};

test('layoutChord：两档都产出完整几何，且实体名与声明序对齐', () => {
  for (const variant of ['undirected', 'directed']) {
    const out = layoutChord(cfg4({ variant }), { width: 320, height: 320 }, STYLE);
    assert.equal(out.n, 4);
    assert.deepEqual(out.groups.map((g) => g.name), E4);
    assert.ok(out.groups.every((g) => g.path.startsWith('M') && g.path.endsWith('Z')));
    assert.ok(out.ribbons.every((r) => r.path.startsWith('M') && r.path.endsWith('Z')));
    assert.equal(out.ribbons.length, variant === 'directed' ? 12 : 6);
  }
});

test('layoutChord：看板要的行和 / 列和随实体一起给出', () => {
  const out = layoutChord(cfg4(), { width: 320, height: 320 }, STYLE);
  assert.equal(out.groups[0].outflow, M4[0].reduce((s, v) => s + v, 0));
  assert.equal(out.groups[0].inflow, M4.reduce((s, r) => s + r[0], 0));
});

test('layoutChord：n=10 两档都不抛错，且守恒仍成立', () => {
  for (const variant of ['undirected', 'directed']) {
    const out = layoutChord(
      { entities: namesN(10), matrix: gridN(10), variant },
      { width: 400, height: 400 },
      STYLE,
    );
    const spans = out.groups.reduce((s, g) => s + (g.a1 - g.a0), 0);
    assert.ok(near(spans + 10 * out.pad, TAU), `${variant} 档守恒`);
    assert.equal(out.ribbons.length, variant === 'directed' ? 90 : 45);
  }
});

/* ── config ──────────────────────────────────────────────────── */

test('Chord 配置：只承载跨主题不变的比例量，不含颜色或像素级主题量', () => {
  const flat = JSON.stringify(CHORD_SETTINGS);
  assert.ok(!/#[0-9a-fA-F]{3,8}|rgba?\(|var\(--/.test(flat), '不得出现任何色值或 token 引用');
  /* 像素级主题量（半径、环宽、字号、标签带）都在 tokens/*.json，这里只有比例与弧度 */
  for (const [key, value] of Object.entries(CHORD_SETTINGS.geometry)) {
    assert.ok(Number.isFinite(value), `${key} 应是纯数值`);
    assert.ok(value <= 1, `${key}=${value} 看起来是像素量——像素归 tokens/*.json`);
  }
});

test('Chord 配置：platform 只认 pc / mobile', () => {
  assert.throws(() => resolveChordSettings('tablet'), /platform/);
  assert.ok(resolveChordSettings('pc').geometry);
  assert.ok(resolveChordSettings('mobile').motion);
});
