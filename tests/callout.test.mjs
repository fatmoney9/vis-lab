import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALLOUT_DIRS,
  calloutBlockRect,
  calloutLeader,
  placeCallout,
  placeCallouts,
  rectNearestPoint,
  coverageFraction,
  rectWithin,
  rectsApart,
  scoreCandidate,
  segmentHitsRect,
  tokenizeForWrap,
  wrapByWidth,
} from '../charts/core/callout.js';

const anchor = { x: 300, y: 200 };
const size = { width: 120, height: 48 };
const bounds = { left: 0, right: 600, top: 0, bottom: 400 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/* 测量经参数注入（TESTING.md 的可测化手法）：每个字符 10px，空格也算 */
const fakeMeasure = (list) => list.map((s) => s.length * 10);

test('CALLOUT-05：8 方位 × 近/远两档共 16 例——块最近点到锚点的距离恒等于 d', () => {
  for (const d of [40, 80]) {
    for (const [dir] of CALLOUT_DIRS) {
      const rect = calloutBlockRect(anchor, dir, d, size);
      const n = rectNearestPoint(rect, anchor);
      assert.ok(near(dist(n, anchor), d), `${dir} @ d=${d} 实际 ${dist(n, anchor)}`);
    }
  }
});

test('CALLOUT-05：正向是近边中点、斜向是近角', () => {
  const n = calloutBlockRect(anchor, 'n', 40, size);
  /* 正北：块在锚点正上方、水平居中，底边中点距锚点 40 */
  assert.equal(n.x + n.width / 2, anchor.x);
  assert.equal(n.y + n.height, anchor.y - 40);

  const nw = calloutBlockRect(anchor, 'nw', 40, size);
  /* 西北：块的右下角就是接触点 */
  const corner = { x: nw.x + nw.width, y: nw.y + nw.height };
  assert.ok(near(dist(corner, anchor), 40));
  assert.ok(corner.x < anchor.x && corner.y < anchor.y);
});

test('CALLOUT-06：越界是硬淘汰（返回 null），不给惩罚分、不 clamp', () => {
  const ctx = { bounds, obstacles: [], placed: [], minGap: 0, dir: 'nw', far: false };
  /* 贴着左上角的锚点，西北向必然出界 */
  const out = calloutBlockRect({ x: 10, y: 10 }, 'nw', 40, size);
  assert.equal(scoreCandidate(out, { x: 10, y: 10 }, ctx), null);
  /* 同一块放到画布中间就合法 */
  const inside = calloutBlockRect(anchor, 'nw', 40, size);
  assert.ok(typeof scoreCandidate(inside, anchor, ctx) === 'number');
});

test('CALLOUT-06：贴边锚点会翻到另一侧，而不是被 clamp 回来', () => {
  const corner = { x: 12, y: 12 };
  const place = placeCallout(corner, size, { ringOuter: 6, lead: 32, bounds, obstacles: [], minGap: 4 });
  assert.ok(place, '应当选得出位置');
  assert.ok(rectWithin(place.rect, bounds), '结果必须整体在界内');
  /* 关键：是「换了方位」而不是「块被挪到贴着锚点」——最近点距离仍严格等于该档 d */
  const n = rectNearestPoint(place.rect, corner);
  assert.ok(near(dist(n, corner), place.distance), '距离不变 ⇒ 没有被 clamp');
  assert.ok(['se', 'e', 's', 'ne', 'sw'].includes(place.dir), `翻到了 ${place.dir}`);
});

test('CALLOUT-07：宁可摆到偏好更差的方位，也不压住图元（hit ≫ dir）', () => {
  /* 西北（偏好最优，bias 0）整块被一根柱盖住；东南（bias 1.5）干净 */
  const nw = calloutBlockRect(anchor, 'nw', 40, size);
  const bar = { x: nw.x, y: nw.y, width: nw.width, height: nw.height };
  const place = placeCallout(anchor, size, {
    ringOuter: 6, lead: 40, bounds, obstacles: [bar], minGap: 0,
  });
  assert.notEqual(place.dir, 'nw', '压住图元的最优方位必须被放弃');
});

test('CALLOUT-07：同等干净时优先近档（far 只有惩罚分、不是硬约束）', () => {
  const place = placeCallout(anchor, size, {
    ringOuter: 6, lead: 32, bounds, obstacles: [], minGap: 0,
  });
  assert.equal(place.far, false);
  assert.equal(place.distance, 6 + 32);
});

test('CALLOUT-08：第二条换方位；挤不开时整条丢弃，而第一条一步不动', () => {
  const two = [
    { anchor: { x: 300, y: 200 }, size },
    { anchor: { x: 305, y: 205 }, size },
  ];
  const roomy = placeCallouts(two, { ringOuter: 6, lead: 32, bounds, obstacles: [], minGap: 4 });
  assert.ok(roomy[0].place && roomy[1].place, '空间够时两条都在');
  assert.notEqual(roomy[0].place.dir, roomy[1].place.dir, '第二条必须换方位');

  /* 把画布压到只容得下一块 */
  const tight = { left: 250, right: 250 + size.width + 60, top: 150, bottom: 150 + size.height + 60 };
  const squeezed = placeCallouts(two, { ringOuter: 6, lead: 32, bounds: tight, obstacles: [], minGap: 4 });
  const first = placeCallouts([two[0]], { ringOuter: 6, lead: 32, bounds: tight, obstacles: [], minGap: 4 });
  assert.deepEqual(squeezed[0].place?.rect, first[0].place?.rect, '首条恒得全局最优位，不受后来者影响');
  assert.equal(squeezed[1].place, null, '挤不开 ⇒ 第二条整条丢弃');
});

test('CALLOUT-09：候选全灭即整条丢弃（不缩字号、不截断）', () => {
  const tiny = { left: 290, right: 310, top: 190, bottom: 210 };
  assert.equal(placeCallout(anchor, size, { ringOuter: 6, lead: 32, bounds: tiny }), null);
});

test('CALLOUT-11：起点、底边、尖端、锚点四点共线，且尖端恰在环外缘', () => {
  const rect = calloutBlockRect(anchor, 'nw', 40, size);
  const { start, base, tip } = calloutLeader(rect, anchor, { ringOuter: 7, gap: 4 });
  assert.ok(near(dist(tip, anchor), 7), '尖端到锚点 = 环外缘半径');
  /* 共线：叉积为 0 */
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  assert.ok(near(cross(start, base, tip), 0, 1e-6), '三点共线');
  assert.ok(near(cross(start, tip, anchor), 0, 1e-6), '四点共线');
  assert.ok(dist(base, anchor) > dist(tip, anchor), '底边比尖端更远离锚点');
});

test('CALLOUT-11：起点侧沿长轴离开、终点侧沿锚点方向到达（两端切向刻意不对称）', () => {
  /* 正西方位：块整个在锚点左侧，u 纯水平，两端恰好都水平——退化档 */
  const flat = calloutLeader({ x: 40, y: 150, width: 120, height: 48 }, { x: 400, y: 190 }, { ringOuter: 7, gap: 4 });
  assert.ok(near(flat.c1.y, flat.start.y), 'c1 与起点等高 ⇒ 水平离开文字块');
  assert.ok(near(flat.c2.y, flat.base.y), 'u 水平时 c2 也水平');
  assert.ok(flat.curve.startsWith('M') && flat.curve.includes('C'), '必须是三次贝塞尔');

  /* 斜向方位：这里两端切向**必须不同**——c1 仍轴对齐，c2 必须沿 u。
     早先 c2 也轴对齐，就是箭头变形的根因。 */
  const rect = calloutBlockRect(anchor, 'nw', 38, size);
  const l = calloutLeader(rect, anchor, { ringOuter: 6, gap: 4 });
  const startTan = { x: l.c1.x - l.start.x, y: l.c1.y - l.start.y };
  assert.ok(near(startTan.x * startTan.y, 0, 1e-6), '起点侧仍是轴对齐（某一个分量为 0）');
  const endTan = { x: l.base.x - l.c2.x, y: l.base.y - l.c2.y };
  assert.ok(Math.abs(endTan.x) > 1e-6 && Math.abs(endTan.y) > 1e-6,
    '斜向时终点侧必须是斜的，不能被轴对齐——否则箭头被压扁');
});

test('CALLOUT-12：箭头是正三角——尖端落在底边中点正前方，八个方位都不变形', () => {
  /* ⚠️ 这条刻意**不**断言「底边 ⊥ 末端切线」：早先那样写等于把实现抄一遍当测试，
     于是斜向方位下三角形被压扁成薄片（面积 ×cos45°）却全绿。2026-09-17 的回归。
     真正的要求是三角形自身的形状：等腰、尖端在底边中点正前方、高 = headH、底 = headW。 */
  const headW = 6;
  const headH = 5;
  for (const dir of CALLOUT_DIRS.map(([d]) => d)) {
    const rect = calloutBlockRect(anchor, dir, 38, size);
    const l = calloutLeader(rect, anchor, { ringOuter: 6, gap: 4, headW, headH });
    const [tx, ty, ax, ay, bx, by] = l.head.match(/-?\d+(\.\d+)?(e-?\d+)?/g).map(Number);

    const mid = { x: (ax + bx) / 2, y: (ay + by) / 2 };
    const edge = { x: bx - ax, y: by - ay };
    const axis = { x: tx - mid.x, y: ty - mid.y };

    assert.ok(near(Math.hypot(edge.x, edge.y), headW), `${dir} 底宽应为 ${headW}`);
    assert.ok(near(Math.hypot(axis.x, axis.y), headH), `${dir} 高应为 ${headH}`);
    /* 轴 ⊥ 底边 ⇒ 等腰且不歪斜 */
    assert.ok(near(axis.x * edge.x + axis.y * edge.y, 0, 1e-6), `${dir} 三角形歪了`);
    /* 面积 = 底 × 高 / 2，塌陷会立刻露馅 */
    const area = Math.abs((ax - tx) * (by - ty) - (bx - tx) * (ay - ty)) / 2;
    assert.ok(near(area, headW * headH / 2, 1e-6), `${dir} 面积 ${area}，应为 ${headW * headH / 2}`);
    /* 底边中点必须就是曲线末端，否则线头会从三角形里穿出来 */
    assert.ok(near(mid.x, l.base.x) && near(mid.y, l.base.y), `${dir} 底边中点 ≠ 曲线末端`);
    /* 尖端朝向锚点：轴向与「base→anchor」同向 */
    const toAnchor = { x: anchor.x - l.base.x, y: anchor.y - l.base.y };
    const cos = (axis.x * toAnchor.x + axis.y * toAnchor.y)
      / (Math.hypot(axis.x, axis.y) * Math.hypot(toAnchor.x, toAnchor.y));
    assert.ok(near(cos, 1, 1e-6), `${dir} 箭头没指向锚点（cos=${cos}）`);
  }
});

test('CALLOUT-11：曲线末端切线与箭头轴向一致（两端切向不对称是有意的）', () => {
  for (const dir of CALLOUT_DIRS.map(([d]) => d)) {
    const rect = calloutBlockRect(anchor, dir, 38, size);
    const l = calloutLeader(rect, anchor, { ringOuter: 6, gap: 4 });
    const tan = { x: l.base.x - l.c2.x, y: l.base.y - l.c2.y };
    const axis = { x: l.tip.x - l.base.x, y: l.tip.y - l.base.y };
    const cos = (tan.x * axis.x + tan.y * axis.y)
      / (Math.hypot(tan.x, tan.y) * Math.hypot(axis.x, axis.y));
    assert.ok(near(cos, 1, 1e-6), `${dir}：曲线到达方向与箭头轴向不一致，箭头会变形（cos=${cos}）`);
  }
});

test('CALLOUT-11：退化方位（正上 / 正左）不抛错、不产生 NaN', () => {
  for (const dir of ['n', 's', 'w', 'e']) {
    const rect = calloutBlockRect(anchor, dir, 40, size);
    const l = calloutLeader(rect, anchor, { ringOuter: 7, gap: 4 });
    const nums = `${l.curve}${l.head}`.match(/NaN|Infinity/);
    assert.equal(nums, null, `${dir} 产生了 ${nums}`);
  }
  /* 锚点落在块内部的极端退化：不得抛错 */
  assert.doesNotThrow(() => calloutLeader({ x: 280, y: 180, width: 60, height: 60 }, anchor, { ringOuter: 7, gap: 4 }));
});

test('CALLOUT-10：折行锚定宽常量——同一文案在不同可用空间下折行结果完全一致', () => {
  const text = 'If everyone lived like Qatar residents we would need eight extra Earths';
  const a = wrapByWidth([text], 200, fakeMeasure);
  const b = wrapByWidth([text], 200, fakeMeasure);
  assert.deepEqual(a, b);
  assert.ok(a[0].lines.length > 1, '长文案必须折行');
  assert.ok(a[0].width <= 200, '块宽不超过定宽');
  assert.equal(a[0].lines.join(' ').replace(/\s+/g, ' '), text, '折行不得丢字');
});

test('CALLOUT-10：短文案不撑满定宽（块宽取实际最宽行）', () => {
  const [one] = wrapByWidth(['ab'], 200, fakeMeasure);
  assert.equal(one.lines.length, 1);
  assert.equal(one.width, 20);
});

test('CALLOUT-03：CJK 按单字折、西文按词折；空文案有兜底', () => {
  assert.deepEqual(tokenizeForWrap('同比增长'), ['同', '比', '增', '长']);
  assert.deepEqual(tokenizeForWrap('net profit'), ['net ', 'profit']);
  const [empty] = wrapByWidth([''], 200, fakeMeasure);
  assert.deepEqual(empty.lines, ['']);
});

test('CALLOUT-10：单个单元本身超宽时独占一行、不硬切', () => {
  const [r] = wrapByWidth(['短 supercalifragilistic 短'], 100, fakeMeasure);
  assert.ok(r.lines.some((l) => l.includes('supercalifragilistic')), '长词整体保留');
  assert.equal(r.lines.filter((l) => l.includes('supercalifragilistic')).length, 1, '未被切成两半');
});

test('矩形基元：覆盖率 / 净距 / 包含 / 线段相交', () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  assert.equal(coverageFraction(a, [{ x: -1, y: -1, width: 12, height: 12 }]), 1, '整块被盖 ⇒ 1');
  assert.equal(coverageFraction(a, [{ x: 20, y: 0, width: 5, height: 5 }]), 0, '不相交 ⇒ 0');
  assert.equal(coverageFraction(a, []), 0, '无障碍物 ⇒ 0');
  assert.equal(rectsApart(a, { x: 14, y: 0, width: 5, height: 5 }, 4), true);
  assert.equal(rectsApart(a, { x: 12, y: 0, width: 5, height: 5 }, 4), false, '净距不足');
  assert.equal(rectWithin(a, { left: 0, right: 10, top: 0, bottom: 10 }), true, '贴边算在界内');
  assert.equal(segmentHitsRect({ x: -5, y: 5 }, { x: 15, y: 5 }, a), true, '横穿');
  assert.equal(segmentHitsRect({ x: -5, y: 50 }, { x: 15, y: 50 }, a), false, '不相干');
  assert.equal(segmentHitsRect({ x: -5, y: -5 }, { x: -1, y: -1 }, a), false, '同向但未够着');
});

test('CALLOUT-01：空批次 / 全空文案返回空结果，不抛错', () => {
  assert.deepEqual(placeCallouts([], { bounds }), []);
  const [blank] = wrapByWidth(['   '], 200, fakeMeasure);
  assert.deepEqual(blank.lines, ['']);
});

/* [CALLOUT-07] 覆盖率必须是**并集**语义。这条是 2026-09-16 实测出来的回归：
   早先用「重叠面积求和 ÷ 块面积」，折线的逐段包围盒彼此重叠会重复计数，
   密集数据下所有候选一起饱和到 1、失去区分度，选位改由方位偏好决定。 */
test('CALLOUT-07：重叠的障碍物不重复计数（并集语义），候选之间保持区分度', () => {
  const rect = { x: 0, y: 0, width: 100, height: 100 };
  /* 同一块区域被三个互相重叠的障碍物盖住，覆盖率仍不得超过 1 */
  const piled = [
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 10, y: 10, width: 90, height: 90 },
    { x: 20, y: 20, width: 80, height: 80 },
  ];
  assert.equal(coverageFraction(rect, piled), 1, '堆叠障碍物不得把覆盖率推过 1');

  /* 盖住左半 vs 盖住整块：必须分得出高下 */
  const half = coverageFraction(rect, [{ x: 0, y: 0, width: 50, height: 100 }]);
  assert.ok(half > 0.3 && half < 0.7, `半覆盖应在 0.5 附近，实际 ${half}`);
  assert.ok(half < coverageFraction(rect, piled), '半覆盖必须优于全覆盖');
});
