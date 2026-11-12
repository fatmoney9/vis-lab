/*
 * L3 · 数据量旋钮：离散三档与连续滑杆两种形态，及各示例的缺省值与夹取。
 * 由 demos/examples.js 统一转出；只装数据与纯函数，不 import d3、不碰 DOM。
 */

/* 数据密度 = 传给 cfg 的类目数（cfg 是 n 的函数，故新图表可自行解释「一个类目」的含义） */
export const DENSITY = { few: 4, mid: 16, many: 36 };
const DENSITY_LEVELS = [
  { id: 'few', label: '少量' },
  { id: 'mid', label: '中量' },
  { id: 'many', label: '大量' },
];

export const densityOptionsOf = (example) => ({ ...DENSITY, ...(example?.densityValues ?? {}) });

export const defaultDensityOf = (example) => example?.densityControl?.default ?? 'few';

export const densityControlOf = (example) => {
  const values = densityOptionsOf(example);
  const control = example.densityControl ?? {};
  return {
    label: control.label ?? '项数',
    hint: control.hint ?? '切换少量、中量与大量数据场景',
    default: defaultDensityOf(example),
    options: DENSITY_LEVELS.map(({ id, label }) => ({
      id,
      label: control.labels?.[id] ?? `${label} · ${values[id]}项`,
    })),
  };
};

/* ── 连续档：数据量作一根可拖的滑杆 ─────────────────────────────
   与三档预设**并存**、读同一份示例定义，不是两套数据：playground 两个面要的是
   「三个可复现的固定场景」（截图对比、回归），主站要的是「随手拉到任意一档看形变」。
   上下限默认 1–50，示例可各自收窄——**收窄是硬约束不是审美**：
   雷达低于 3 维 RadarChart 直接抛错（RADAR-01），高于 6 维示例也只有 6 个维度名。 */
const DENSITY_RANGE = { min: 1, max: 50 };
const densityRangeOf = (example) => ({ ...DENSITY_RANGE, ...(example?.densityRange ?? {}) });
export const densityUnitOf = (example) => example?.densityUnit ?? '类目';

export const clampDensity = (example, n) => {
  const { min, max } = densityRangeOf(example);
  const value = Math.round(Number(n));
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
};

/* 滑杆初值 = 该示例预设默认档的数值：同一个示例在三档面与滑杆面首屏一致，切面不跳 */
export const defaultDensityCountOf = (example) =>
  clampDensity(example, densityOptionsOf(example)[defaultDensityOf(example)]);

/* 连续档控件描述。与 densityControlOf 并列而不是取代它——后者仍是三档面的数据源。
   主站滑杆的说明保持简短；各示例的量程建议仍留在三档验收面。 */
export const densitySliderOf = (example) => {
  const { min, max } = densityRangeOf(example);
  const control = example?.densityControl ?? {};
  return {
    label: control.label ?? '项数',
    hint: '数据项数量',
    unit: densityUnitOf(example),
    min,
    max,
    value: defaultDensityCountOf(example),
  };
};
