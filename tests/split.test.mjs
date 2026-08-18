import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERVAL_STEPS,
  Y_SPLIT_LINES,
  niceSplit,
  niceSplitDual,
} from '../charts/core/split.js';

/* interval 必须是「数组档位 × 10ⁿ」——SCALE-01 的硬约束① */
const intervalFromSteps = (iv) => INTERVAL_STEPS.some((s) => {
  for (let e = -12; e <= 12; e += 1) {
    if (Math.abs(s * 10 ** e - iv) < Math.max(Math.abs(iv), 1e-9) * 1e-9) return true;
  }
  return false;
});

const CASES = [
  ['全正', 0, 416000], ['全正顶格', 0, 400000], ['全正小量级', 0, 40],
  ['全负', -299000, 0], ['全负顶格', -320000, 0],
  ['跨零', -300000, 400000], ['跨零偏正', -12, 880],
  ['极小值', 0, 0.0004], ['极大值', 0, 9.9e9],
  ['单点非零', 7, 7], ['全零', 0, 0],
];

test('SCALE-01：分割线恒为 5 条（4 段），且 interval 取自 INTERVAL_STEPS × 10ⁿ', () => {
  for (const [name, lo, hi] of CASES) {
    const s = niceSplit(lo, hi);
    assert.equal(s.ticks.length, Y_SPLIT_LINES, `${name}：分割线数`);
    assert.ok(intervalFromSteps(s.interval), `${name}：interval ${s.interval} 不在档位数组内`);
  }
});

test('SCALE-01：0 恒落在某条分割线上', () => {
  for (const [name, lo, hi] of CASES) {
    const s = niceSplit(lo, hi);
    assert.ok(s.ticks.some((t) => t === 0), `${name}：刻度 ${s.ticks} 里没有精确的 0`);
  }
});

test('SCALE-01：刻度等距，且 0 点无浮点残差（按段数×interval 构造而非 min 累加）', () => {
  for (const [name, lo, hi] of CASES) {
    const s = niceSplit(lo, hi);
    for (let i = 1; i < s.ticks.length; i += 1) {
      const gap = s.ticks[i] - s.ticks[i - 1];
      assert.ok(Math.abs(gap - s.interval) < s.interval * 1e-9, `${name}：第 ${i} 段不等距`);
    }
    const zeroIndex = s.ticks.indexOf(0);
    assert.notEqual(zeroIndex, -1, `${name}：0 必须精确存在`);
  }
});

test('SCALE-03：轴值域必须完整覆盖数据（含 0 并入）', () => {
  for (const [name, lo, hi] of CASES) {
    const s = niceSplit(lo, hi);
    assert.ok(s.min <= Math.min(0, lo) + 1e-9, `${name}：轴底 ${s.min} 没盖住 ${lo}`);
    assert.ok(s.max >= Math.max(0, hi) - 1e-9, `${name}：轴顶 ${s.max} 没盖住 ${hi}`);
  }
});

test('SCALE-03：占比最大化——所选方案的占比不低于任何可行的负值段数方案', () => {
  const S = Y_SPLIT_LINES - 1;
  for (const [name, lo, hi] of CASES) {
    const L = Math.min(0, lo);
    let H = Math.max(0, hi);
    if (H - L < 1e-9) H = L + 1;
    const chosen = niceSplit(lo, hi);
    const chosenUtil = (H - L) / (chosen.max - chosen.min);
    for (let neg = L < 0 ? 1 : 0; neg <= (H > 0 ? S - 1 : S); neg += 1) {
      const pos = S - neg;
      const need = Math.max(neg ? -L / neg : 0, pos ? H / pos : 0);
      if (!(need > 0)) continue;
      const mag = 10 ** Math.floor(Math.log10(need));
      let iv = null;
      for (const st of INTERVAL_STEPS) {
        const v = Number((st * mag).toPrecision(12));
        if (v >= need - 1e-9) { iv = v; break; }
      }
      if (iv == null) continue;
      const util = (H - L) / (iv * S);
      assert.ok(chosenUtil >= util - 1e-9, `${name}：负段=${neg} 的占比 ${util} 高于所选 ${chosenUtil}`);
    }
  }
});

test('SCALE-03：档位数组最大相邻比 1.33 → 正值场景占比下限约 75%', () => {
  const utils = [];
  for (let hi = 100; hi <= 1000; hi += 3) {
    const s = niceSplit(0, hi);
    utils.push(hi / (s.max - s.min));
  }
  const lowest = Math.min(...utils);
  assert.ok(lowest > 0.7, `实测最低占比 ${lowest}，低于文档声称的 ≈75%`);
  assert.ok(lowest < 0.8, `实测最低占比 ${lowest}，高于预期区间——档位数组可能已改，请同步 SCALE-01 的说明`);
});

test('SCALE-03：退化值域（min === max）不产生零宽轴', () => {
  for (const [lo, hi] of [[0, 0], [7, 7], [-3, -3]]) {
    const s = niceSplit(lo, hi);
    assert.ok(s.max > s.min, `${lo}~${hi}：轴宽必须为正`);
    assert.ok(Number.isFinite(s.interval) && s.interval > 0, `${lo}~${hi}：interval 必须为正有限数`);
  }
});

test('SCALE-04：双 Y 共享分割线——两轴 0 落在同一条线上、段数一致', () => {
  const pairs = [
    [[0, 400], [0, 90]],
    [[-300, 400], [0, 90]],
    [[-50, 50], [-2, 8]],
    [[0, 1e6], [0, 3]],
  ];
  for (const [a, b] of pairs) {
    const { primary, secondary } = niceSplitDual(a, b);
    assert.equal(primary.ticks.length, secondary.ticks.length, `${a}/${b}：分割线数不等`);
    assert.equal(
      primary.ticks.indexOf(0),
      secondary.ticks.indexOf(0),
      `${a}/${b}：0 不在同一条线上（primary ${primary.ticks} vs secondary ${secondary.ticks}）`,
    );
    assert.ok(intervalFromSteps(primary.interval), `${a}/${b}：主轴 interval 不在档位数组内`);
    assert.ok(intervalFromSteps(secondary.interval), `${a}/${b}：副轴 interval 不在档位数组内`);
  }
});

test('SCALE-04：双 Y 各自覆盖自己的数据', () => {
  const { primary, secondary } = niceSplitDual([-300, 400], [0, 90]);
  assert.ok(primary.min <= -300 && primary.max >= 400);
  assert.ok(secondary.min <= 0 && secondary.max >= 90);
});
