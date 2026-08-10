import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sliceAngles, donutRadii, labelAnchor, leaderElbow, alignOutside, labelBand,
} from '../charts/charts/pie/geometry.js';
import { truncateBatch } from '../charts/core/label.js';

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

/* ── PIE-13 三档对齐（带宽已改为入参，见 PIE-02/13）───────────────── */

const R = 70;
/* band 现在是**入参**：由容器算好、两侧同值（labelBand），alignOutside 只在带内排布。
   取 76 让下面几档都排得开，个别用例再单独收紧以验 maxWidth 的响应。 */
const OPT = { lateral: 8, gap: 8, R, band: 76 };
/* 三个右侧扇区。最远的肘点与最宽的文本刻意不在同一项——column 与 anchor 的末端才会分开。 */
const RIGHT = [
  { side: 'right', ex: 10, textWidth: 120 },
  { side: 'right', ex: 60, textWidth: 30 },
  { side: 'right', ex: 30, textWidth: 60 },
];

test('PIE-13 anchor：横段定长，末端 = 肘点 + lateral，文字紧跟其后 gap', () => {
  const items = alignOutside(RIGHT, 'anchor', OPT);

  assert.deepEqual(items.map((d) => d.lineEndX), [18, 68, 38]);
  assert.deepEqual(items.map((d) => d.textX), [26, 76, 46]);
  assert.ok(items.every((d) => d.anchor === 'start'), '右侧文字自锚点向右排');
});

test('PIE-13 column：同侧末端共线（取最远肘点 + lateral），文字内沿贴同一条线', () => {
  const items = alignOutside(RIGHT, 'column', OPT);

  assert.deepEqual(items.map((d) => d.lineEndX), [68, 68, 68], '同侧 lineEndX 必须全相等');
  assert.deepEqual(items.map((d) => d.textX), [76, 76, 76]);
});

test('PIE-13 edge：文字外沿共线（贴带宽外沿），横段反过来长短不一', () => {
  const items = alignOutside(RIGHT, 'edge', OPT);
  const outer = R + OPT.band;

  assert.ok(items.every((d) => d.anchor === 'end'), '右侧文字自外沿向左排');
  assert.deepEqual(items.map((d) => d.textX), [outer, outer, outer], '同侧文字外沿必须全相等');
  /* 末端 = 外沿 − 文本宽 − gap，故文本越短线越长；下限是自己那条定长横段（不折回） */
  assert.deepEqual(items.map((d) => d.lineEndX), [outer - 128, outer - 38, outer - 68]);
});

test('PIE-13：三档不再改变带宽 —— 带宽是入参，只有排布随档变', () => {
  const anchor = alignOutside(RIGHT, 'anchor', OPT);
  const column = alignOutside(RIGHT, 'column', OPT);
  const edge = alignOutside(RIGHT, 'edge', OPT);
  const outer = R + OPT.band;

  /* 三档的 maxWidth 都以同一条外沿为界：改的是文字起点，不是带的边 */
  for (const items of [anchor, column, edge]) {
    items.forEach((d) => assert.ok(d.maxWidth <= outer, '可用宽不得越过带宽外沿'));
  }
  /* column 的文字起点最靠外（共线于最远肘点）→ 可用宽最小，但带宽本身没变 */
  assert.ok(column[0].maxWidth < anchor[0].maxWidth, 'column 把近端标签的可用宽压小');
});

test('PIE-13：文本再长也不撑宽带 —— 撑宽的老行为已由 PIE-16 截断取代', () => {
  const huge = alignOutside([{ side: 'right', ex: 10, textWidth: 4000 }], 'anchor', OPT);

  closeTo(huge[0].maxWidth, R + OPT.band - (10 + 8 + 8));
  assert.ok(huge[0].maxWidth < 4000, '超宽文本只会得到一个更小的可用宽，而不是更宽的带');
});

test('PIE-13：左侧的横段与文字一律朝左（x 为负、anchor 反向）', () => {
  const items = alignOutside([{ side: 'left', ex: -30, textWidth: 50 }], 'anchor', OPT);

  assert.equal(items[0].lineEndX, -38);
  assert.equal(items[0].textX, -46);
  assert.equal(items[0].anchor, 'end', '左侧文字自锚点向左排');
});

test('PIE-13：带宽收紧只压缩 maxWidth，位置一概不动', () => {
  const free = alignOutside(RIGHT, 'anchor', OPT);
  const tight = alignOutside(RIGHT, 'anchor', { ...OPT, band: 20 });

  assert.deepEqual(tight.map((d) => d.lineEndX), free.map((d) => d.lineEndX));
  assert.deepEqual(tight.map((d) => d.textX), free.map((d) => d.textX));
  tight.forEach((d, i) => assert.ok(d.maxWidth < free[i].maxWidth, '可用宽必须变小'));
});

test('PIE-13：maxWidth 恰好是「文字起点 → 带宽外沿」的距离，且不为负', () => {
  const items = alignOutside(RIGHT, 'anchor', OPT);
  const outer = R + OPT.band;

  items.forEach((d) => closeTo(d.maxWidth, outer - d.textX));
  /* 带宽为 0 时也不出负数（负的 maxWidth 会让截断/丢弃判得莫名其妙） */
  alignOutside(RIGHT, 'anchor', { ...OPT, band: 0 })
    .forEach((d) => assert.ok(d.maxWidth >= 0));
});

test('PIE-13：空入参不抛错', () => {
  assert.deepEqual(alignOutside([], 'anchor', OPT), []);
});

/* ── PIE-02/13 标签带宽：只看容器 ──────────────────────────────── */

test('PIE-13：带宽 = (可用宽 − 2R) / 2，容器越宽带越宽', () => {
  assert.equal(labelBand(400, 70, Infinity), 130);   /* (400−140)/2 */
  assert.equal(labelBand(500, 70, Infinity), 180);
  assert.ok(labelBand(500, 70, Infinity) > labelBand(400, 70, Infinity), '单调不减');
});

test('PIE-13：带宽封顶 size-donut-label-band-max，且不出负数', () => {
  assert.equal(labelBand(400, 70, 120), 120, '(400−140)/2=130 → 被 120 封顶');
  assert.equal(labelBand(200, 70, 120), 30, '容器紧时按容器，封顶不生效');
  assert.equal(labelBand(100, 70, 120), 0, '容器比环还窄 → 带宽 0，不出负数');
  assert.equal(labelBand(-50, 70, 120), 0);
});

test('PIE-13：带宽与文本完全解耦 —— 这是截断不会引起震荡的根据', () => {
  /* 端到端地证：同一容器下，文本宽差 100 倍，每个标签拿到的可用宽也一模一样。
     可用宽不随文本变 ⇒ 截断改变文本后不会反过来改可用宽 ⇒ 不存在「截了又要再截」的环。 */
  const band = labelBand(400, R, 120);
  const narrow = alignOutside([{ side: 'right', ex: 10, textWidth: 20 }], 'anchor', { ...OPT, band });
  const wide = alignOutside([{ side: 'right', ex: 10, textWidth: 2000 }], 'anchor', { ...OPT, band });

  assert.equal(narrow[0].maxWidth, wide[0].maxWidth);
  assert.equal(narrow[0].textX, wide[0].textX, '文字起点同样不随文本宽变');
});

/* ── PIE-16 省略号截断 ──────────────────────────────────────────── */

/* 假测量：每字符 10px、省略号 10px —— 纯逻辑测试不碰 DOM（同 motion.js 注入时钟的做法） */
const fakeMeasure = (texts) => texts.map((t) => Array.from(String(t)).length * 10);

test('PIE-16：装得下的原样返回，不打省略号', () => {
  const out = truncateBatch([{ text: '营业收入', maxWidth: 100 }], fakeMeasure);

  assert.equal(out[0].text, '营业收入');
  assert.equal(out[0].truncated, false);
  assert.equal(out[0].width, 40);
});

test('PIE-16：超宽时截到「装得下的最多字数 + …」', () => {
  /* 可用 45 → 4 字+… = 50 放不下，3 字+… = 40 放得下 */
  const out = truncateBatch([{ text: '营业外收入合计', maxWidth: 45 }], fakeMeasure);

  assert.equal(out[0].text, '营业外…');
  assert.equal(out[0].truncated, true);
  assert.ok(out[0].width <= 45, '截断后必须真的装得下');
});

test('PIE-16：截断结果恰好是最长的可行前缀（不多截一个字）', () => {
  const out = truncateBatch([{ text: '一二三四五六七八九十', maxWidth: 70 }], fakeMeasure);

  assert.equal(out[0].text, '一二三四五六…', '6 字+…=70 恰好装下');
  const plusOne = fakeMeasure(['一二三四五六七…'])[0];
  assert.ok(plusOne > 70, '再多一个字就超了 —— 证明没有保守多截');
});

test('PIE-16：连「1 字 + …」都放不下 → text 为 null，调用方整条丢（含引线，PIE-12）', () => {
  const out = truncateBatch([{ text: '营业收入', maxWidth: 15 }], fakeMeasure);

  assert.equal(out[0].text, null, '1 字+… = 20 > 15');
  assert.equal(out[0].truncated, true);
});

test('PIE-16：maxWidth 缺省 = 不限宽，原样返回', () => {
  const out = truncateBatch([{ text: '很长很长很长的名称' }], fakeMeasure);

  assert.equal(out[0].text, '很长很长很长的名称');
  assert.equal(out[0].truncated, false);
});

test('PIE-16：一批混合 —— 装得下的、要截的、放不下的各归各位，顺序不乱', () => {
  const out = truncateBatch([
    { text: '短', maxWidth: 100 },
    { text: '需要截断的长名称', maxWidth: 45 },
    { text: '放不下', maxWidth: 5 },
    { text: '也短', maxWidth: 100 },
  ], fakeMeasure);

  assert.deepEqual(out.map((d) => d.text), ['短', '需要截…', null, '也短']);
  assert.deepEqual(out.map((d) => d.truncated), [false, true, true, false]);
});

test('PIE-16：按轮批量测量 —— 测量次数随轮数增长，不随标签数增长', () => {
  let calls = 0;
  const counting = (texts) => { calls += 1; return fakeMeasure(texts); };
  const many = Array.from({ length: 36 }, (_, i) => ({ text: '名'.repeat(20 + i), maxWidth: 45 }));

  truncateBatch(many, counting);

  /* 36 个标签若逐条二分要 36×约5=180 次；按轮批量应在个位数 */
  assert.ok(calls <= 8, `测量调用应为个位数（按轮批量），实际 ${calls}`);
});

test('PIE-16：按码点切，不劈开代理对（emoji 名称不会被截成半个字符）', () => {
  const out = truncateBatch([{ text: '📈📉📊📈📉', maxWidth: 35 }], fakeMeasure);

  assert.ok(out[0].text.endsWith('…'));
  /* 截出来的每个码点都还原封不动 —— 用 Array.from 而非 slice 的意义 */
  assert.ok(Array.from(out[0].text).every((c) => c === '…' || '📈📉📊'.includes(c)));
});
