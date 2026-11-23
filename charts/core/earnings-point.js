/*
 * L1 · 财报预期对比点（earnings point）。权威规范见 specs/earnings.md（EARNINGS-01..07）。
 *
 * 一个点位 = 「预期环」+「实际点」两层：
 *   预期环 —— 以**预期值的 y** 为圆心，外径 size-earnings-estimate（20）、内描边
 *             size-earnings-estimate-stroke（1.5）、色 = 色板「其他」色（L2 写成 --dv-earnings-estimate）、无填充；
 *   实际点 —— 以**实际值的 y** 为圆心，直径 size-earnings-actual（16），色由状态定。
 * 两者各按自己的值定位，上下偏移由数据自然形成——不写固定偏移。
 * 尺寸沿用 Default，紧凑密度**不缩小**（density.json 不覆盖这几项）。
 *
 * 状态由数据决定（earningsState）；状态 → 颜色语义（tone）在本模块一处，
 * X 轴副标题、图例、tooltip 差值都从这里取，不各自再判一次。
 *
 * 纯函数（earningsState / earningsTone / earningsLegendTone）不碰 DOM，可被 node 直接加载单测；
 * 渲染函数只用调用方传入的 d3 selection 的方法，本模块不 import d3。
 */
import { tokenNum } from './tokens.js';
import { measureFontBox } from './measure.js';

const isNum = (v) => v != null && Number.isFinite(Number(v));
/* 「符合」判等：EPS 是两位小数的报告值，浮点算出的 1.62 - 1.62 可能不是 0 */
const EPS_EQUAL = 1e-9;

/*
 * [EARNINGS-02] 一个点位的状态：
 *   beat     超预期（actual > estimate）
 *   met      符合（actual = estimate）
 *   missed   未达预期（actual < estimate）
 *   pending  待公布（只有 estimate）
 *   unrated  无预期（只有 actual）
 *   null     两者都没有（该类目不画）
 */
export function earningsState(actual, estimate) {
  const a = isNum(actual);
  const e = isNum(estimate);
  if (!a && !e) return null;
  if (!a) return 'pending';
  if (!e) return 'unrated';
  const diff = Number(actual) - Number(estimate);
  if (Math.abs(diff) < EPS_EQUAL) return 'met';
  return diff > 0 ? 'beat' : 'missed';
}

/* [EARNINGS-03] 状态 → 颜色语义：up = 涨色 / down = 跌色 / muted = 次要文字色。
   实际点、X 轴副标题、tooltip 差值共用这一张表。 */
const TONE = { beat: 'up', met: 'up', missed: 'down', pending: 'muted', unrated: 'muted' };
export function earningsTone(state) {
  return TONE[state] ?? 'muted';
}

/*
 * [EARNINGS-05] 图例 Actual 的颜色语义：
 *   有超预期 / 符合 / 无预期的点 → up（涨色）
 *   有实际点但全部未达预期       → down（跌色）
 *   完全没有预期数据             → series（系列色 single-default）
 *   一个实际点都没有（全待公布）  → series（没有实际点可代表，退回系列色）
 */
export function earningsLegendTone(states) {
  const list = states.filter(Boolean);
  const hasEstimate = list.some((s) => s !== 'unrated');
  const actuals = list.filter((s) => s !== 'pending');
  if (!hasEstimate || actuals.length === 0) return 'series';
  if (actuals.some((s) => s !== 'missed')) return 'up';
  return 'down';
}

/*
 * [EARNINGS-08] 点位在值坐标之外还要占多少像素：上 / 下各一个预期环半径；有待公布点时上方再加
 * 「间距 + 标签行高」。L2 据此给刻度留呼吸位（SCALE-03），保证环与待公布标签都落在首末网格线之内。
 *   data —— 该系列的 [{ actual, estimate }]（可见窗口内）
 */
export function earningsPadding(host, data) {
  const ringR = (tokenNum(host, '--size-earnings-estimate') || 20) / 2;
  const hasPending = data.some((d) => earningsState(d?.actual, d?.estimate) === 'pending');
  const label = hasPending
    ? tokenNum(host, '--spacing-earnings-label-gap') + (tokenNum(host, '--line-height-earnings-label') || 12)
    : 0;
  return { top: ringR + label, bottom: ringR };
}

/*
 * [EARNINGS-01..04] 渲染一批点位。
 *   ringG / dotG —— 调用方建好的两个 <g>：**ringG 先建、dotG 后建**，实际点因此压在预期环之上
 *                   （层级 = DOM 顺序）。两个 g 分开，图例才能分别弱化 Actual / Estimate。
 *   items        —— [{ i, cx, actual, estimate }]（i = 类目下标，写进 data-i 供 hover 对齐）
 *   y            —— linearY 比例尺
 *   format       —— 待公布标签的数值格式化（与轴 / tooltip 同一份）
 * 实际点颜色只挂类名（.dv-earnings-actual--up / --down / --series），色值在 styles/earnings.css；
 * --series 读 dotG 上 color 下发的系列色。
 */
export function renderEarningsPoints(ringG, dotG, frame, { items, y, format = String }) {
  const host = frame.host;
  const ringD = tokenNum(host, '--size-earnings-estimate') || 20;
  const ringStroke = tokenNum(host, '--size-earnings-estimate-stroke') || 1.5;
  const dotD = tokenNum(host, '--size-earnings-actual') || 16;
  const labelGap = tokenNum(host, '--spacing-earnings-label-gap');
  const labelLineH = tokenNum(host, '--line-height-earnings-label') || 12;

  const points = items
    .map((d) => ({ ...d, state: earningsState(d.actual, d.estimate) }))
    .filter((d) => d.state);

  /* 内描边：SVG 描边骑在路径两侧，故半径收进半个描边宽，外径才恰好 = size-earnings-estimate */
  const ringR = Math.max(0, ringD / 2 - ringStroke / 2);
  const rings = points.filter((d) => d.state !== 'unrated');
  ringG.selectAll('circle.dv-earnings-estimate')
    .data(rings, (d) => d.i)
    .join('circle')
    .attr('class', (d) => `dv-earnings-estimate${d.state === 'pending' ? ' dv-earnings-estimate--pending' : ''}`)
    .attr('data-i', (d) => d.i)
    .attr('cx', (d) => d.cx)
    .attr('cy', (d) => y(Number(d.estimate)))
    .attr('r', ringR)
    .attr('stroke-width', ringStroke);

  /* [EARNINGS-04] 待公布：环上方 spacing-earnings-label-gap 处标预期值。
     与 X 轴标签同一排字口径（AXIS-04）：文字在 line-height-earnings-label 行框内上下居中，
     行框底边离环外沿 = gap。字体度量走 L1 measureFontBox，不猜。 */
  const pending = rings.filter((d) => d.state === 'pending');
  const fontBox = pending.length ? measureFontBox(host, 'dv-earnings-estimate-label') : null;
  const baselineInBox = fontBox
    ? (labelLineH - fontBox.ascent - fontBox.descent) / 2 + fontBox.ascent
    : labelLineH;
  ringG.selectAll('text.dv-earnings-estimate-label')
    .data(pending, (d) => d.i)
    .join('text')
    .attr('class', 'dv-earnings-estimate-label')
    .attr('data-i', (d) => d.i)
    .attr('x', (d) => d.cx)
    .attr('y', (d) => y(Number(d.estimate)) - ringD / 2 - labelGap - labelLineH + baselineInBox)
    .attr('text-anchor', 'middle')
    .text((d) => format(Number(d.estimate)));

  const dots = points.filter((d) => d.state !== 'pending');
  const toneClass = (d) => (d.state === 'unrated' ? 'series' : earningsTone(d.state));
  dotG.selectAll('circle.dv-earnings-actual')
    .data(dots, (d) => d.i)
    .join('circle')
    .attr('class', (d) => `dv-earnings-actual dv-earnings-actual--${toneClass(d)}`)
    .attr('data-i', (d) => d.i)
    .attr('cx', (d) => d.cx)
    .attr('cy', (d) => y(Number(d.actual)))
    .attr('r', dotD / 2);

  return points;
}
