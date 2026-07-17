import { themeOf, DEFAULT_THEME } from './theme.js';

/*
 * L1 · 系列取色器。权威规则见 specs/color.md。
 * 系列色是「第三类主题数据」：不进 tokens.css（取色是算法、不参与明暗分叉、设计源写死 hex）。
 * 色板数据在 tokens/palette.json，本模块按主题声明的方式取色——**主题无关**，无 if(theme===…)：
 * 三主题差异只体现在数据（single-default 与 bar-multi 的取值），算法统一。
 */

/* no-store：色板文件小，不值得吃缓存不一致的亏（同 theme.js） */
const data = await (
  await fetch(new URL('../../tokens/palette.json', import.meta.url), { cache: 'no-store' })
).json();
const { $meta, ...PALETTE } = data;

/* 合同校验：每主题必备 single-default（字符串）+ bar-multi / line-multi（非空数组），缺即抛错 */
for (const [name, p] of Object.entries(PALETTE)) {
  if (typeof p['single-default'] !== 'string') throw new Error(`palette.json：主题「${name}」缺 single-default`);
  for (const key of ['bar-multi', 'line-multi']) {
    if (!Array.isArray(p[key]) || p[key].length === 0) {
      throw new Error(`palette.json：主题「${name}」的 ${key} 必须是非空数组`);
    }
  }
}

/*
 * [COLOR-02..05] 按系列类型取色（返回 hex 数组，与系列一一对应）。
 *   单系列（length<=1） → [single-default]（[COLOR-03]，无论柱/线）
 *   多系列 → 柱系列走 bar-multi、线系列走 line-multi，**各按自己类型的序号取、超出循环**，
 *            柱线分色板、禁交叉（[COLOR-05]）。
 * 入参 series = [{type}]，用**声明的系列**（图例隐藏/过滤不重排颜色，[COLOR-04]）。
 */
export function resolveSeriesColors(host, { series }) {
  const p = PALETTE[themeOf(host)] ?? PALETTE[DEFAULT_THEME];
  if (series.length <= 1) return [p['single-default']];
  let bi = 0;
  let li = 0;
  return series.map((s) => (s.type === 'line'
    ? p['line-multi'][li++ % p['line-multi'].length]
    : p['bar-multi'][bi++ % p['bar-multi'].length]));
}
