import { themeOf, modeOf, DEFAULT_THEME } from './theme.js';

/*
 * L1 · 系列取色器。权威规则见 specs/color.md。
 * 系列色是「第三类主题数据」：不进 tokens.css（取色是算法、设计源写死 hex）。
 * 色板数据在 tokens/palette.json，本模块按主题声明的方式取色——**主题无关**，无 if(theme===…)：
 * 三主题差异只体现在数据（色盘内容、明暗是否分叉、用尽后怎么办），算法统一。
 *
 * 只回答「第 i 个实体是什么颜色」（按序号占槽位）。「这个值落在哪一档」（顺序 / 发散 / 强度）
 * 是另一类问法，在 core/visual-color.js。
 */

/* no-store：色板文件小，不值得吃缓存不一致的亏（同 theme.js） */
const data = await (
  await fetch(new URL('../../tokens/palette.json', import.meta.url), { cache: 'no-store' })
).json();

const MODES = ['light', 'dark'];
const OPTIONAL_RAMPS = ['pie-multi', 'combo-bar-multi', 'rank-multi'];
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isModed = (v) => isPlainObject(v) && MODES.every((m) => m in v);
/* $ 开头的键是注释（$meta / $source / $note），一律忽略 */
const stripNotes = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith('$')));

/* 色值：字符串（明暗同色）或 {light, dark} */
function normalizeColor(v, where) {
  if (typeof v === 'string') return { light: v, dark: v };
  if (isModed(v) && MODES.every((m) => typeof v[m] === 'string')) return { light: v.light, dark: v.dark };
  throw new Error(`palette.json：${where} 必须是颜色字符串或 { light, dark }`);
}

/* 色盘：数组 / {light,dark} 简写（超出循环），或 { colors, other?, overflow? } 完整写法 */
function normalizeRamp(raw, where) {
  const full = isPlainObject(raw) && 'colors' in raw;
  const spec = full ? stripNotes(raw) : { colors: raw };
  const colors = Array.isArray(spec.colors) ? { light: spec.colors, dark: spec.colors } : spec.colors;
  if (!isModed(colors) || MODES.some((m) => !Array.isArray(colors[m]) || colors[m].length === 0)) {
    throw new Error(`palette.json：${where} 必须是非空数组，或 light / dark 各一份非空数组`);
  }
  /* 同序号 = 同实体：明暗两份长度不等，切换明暗就会有实体换色盘位置 */
  if (colors.light.length !== colors.dark.length) {
    throw new Error(`palette.json：${where} 的 light / dark 长度不等（${colors.light.length} / ${colors.dark.length}）`);
  }
  const overflow = spec.overflow ?? 'cycle';
  const other = spec.other === undefined ? null : normalizeColor(spec.other, `${where}.other`);
  if (overflow === 'other' && !other) throw new Error(`palette.json：${where} 的 overflow 为 other 却没声明 other`);
  if (overflow !== 'cycle' && overflow !== 'other') {
    const k = overflow?.restart;
    if (!Number.isInteger(k) || k < 0 || k >= colors.light.length) {
      throw new Error(`palette.json：${where} 的 overflow 只能是 cycle / other / { restart: 0..长度-1 }`);
    }
  }
  return { colors, other, overflow };
}

/* 合同校验：每主题必备 single-default + bar-multi / line-multi；可选盘一旦声明也按同一合同校验 */
export function normalizePalette(doc) {
  return Object.fromEntries(Object.entries(stripNotes(doc)).map(([name, raw]) => {
    const p = stripNotes(raw);
    if (!('single-default' in p)) throw new Error(`palette.json：主题「${name}」缺 single-default`);
    for (const key of ['bar-multi', 'line-multi']) {
      if (!(key in p)) throw new Error(`palette.json：主题「${name}」缺 ${key}`);
    }
    const known = new Set(['single-default', 'bar-multi', 'line-multi', ...OPTIONAL_RAMPS]);
    const unknown = Object.keys(p).filter((k) => !known.has(k));
    if (unknown.length) throw new Error(`palette.json：主题「${name}」有未知键 ${unknown.join(', ')}`);
    const out = { 'single-default': normalizeColor(p['single-default'], `${name}.single-default`) };
    for (const key of ['bar-multi', 'line-multi', ...OPTIONAL_RAMPS]) {
      if (key in p) out[key] = normalizeRamp(p[key], `${name}.${key}`);
    }
    return [name, out];
  }));
}

const PALETTE = normalizePalette(data);

/* 色盘第 index 个槽位（从 0 计）：用尽后按 overflow 处理 */
export function rampColor(ramp, index, mode) {
  const list = ramp.colors[mode] ?? ramp.colors.light;
  if (index < list.length) return list[index];
  if (ramp.overflow === 'other') return ramp.other[mode] ?? ramp.other.light;
  if (ramp.overflow === 'cycle') return list[index % list.length];
  const k = ramp.overflow.restart;
  return list[k + ((index - list.length) % (list.length - k))];
}

/*
 * [COLOR-02..05, COLOR-08] 纯函数：给定一个主题的（已归一化）色板，按系列类型取色。
 *   单系列（length<=1） → [single-default]（[COLOR-03]，无论柱/线/单扇区）
 *   多系列，各类型走自己的色盘、各自的序号：
 *     饼环扇区 / 弦图实体（type:'pie'）→ pie-multi（[COLOR-08]）
 *     排名（type:'rank'）              → rank-multi
 *     折柱组合（柱线混合声明）的柱      → combo-bar-multi；线 → line-multi（[COLOR-05]，柱线禁交叉）
 *     其余（纯柱 / 纯线 / 雷达 / 树图…）→ bar-multi
 *   可选盘未声明即回落 bar-multi。
 */
export function pickSeriesColors(profile, series, mode = 'light') {
  const m = MODES.includes(mode) ? mode : 'light';
  if (series.length <= 1) return [profile['single-default'][m]];
  const mixed = series.some((s) => s.type === 'bar') && series.some((s) => s.type === 'line');
  const rampFor = (s) => {
    if (s.type === 'pie') return 'pie-multi';
    if (s.type === 'rank') return 'rank-multi';
    if (mixed && s.type === 'line') return 'line-multi';
    if (mixed && s.type === 'bar') return 'combo-bar-multi';
    return 'bar-multi';
  };
  /* 计数器按「类型」而非「实际落到的色盘」分：可选盘回落 bar-multi 时，序号仍各数各的 */
  const counters = new Map();
  return series.map((s) => {
    const key = rampFor(s);
    const i = counters.get(key) ?? 0;
    counters.set(key, i + 1);
    return rampColor(profile[key] ?? profile['bar-multi'], i, m);
  });
}

/*
 * 组件入口：按容器的 data-theme / data-mode 取色（返回 hex 数组，与系列一一对应）。
 * 入参 series = [{type}]，用**声明的系列**（图例隐藏/过滤不重排颜色，[COLOR-04]）。
 * 明暗只在构建时读一次——各预览面切换明暗都会重建图表。
 */
export function resolveSeriesColors(host, { series }) {
  const p = PALETTE[themeOf(host)] ?? PALETTE[DEFAULT_THEME];
  return pickSeriesColors(p, series, modeOf(host));
}
