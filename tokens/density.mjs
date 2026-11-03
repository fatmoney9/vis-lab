/*
 * L0 · 密度覆盖层：tokens/density.json 的解析与合并（纯函数，零 import）。
 * 构建脚本（Node，值 token → tokens.css）与 charts/core/theme.js（浏览器，形态 → resolveBehavior）
 * 共用这一份——两边各写一份合并规则，就会出现「CSS 已紧凑、形态仍是标准」的半套状态。
 *
 * 密度不是主题：品牌身份（data-theme）不变，只在承载尺寸的两条通道上叠一层差异。
 * 之所以不另开主题 id：色板、水印、播放件样式与 L3 语言都按品牌 id 取，
 * 新 id 会在这些地方静默回落（色板落到 THS、播放件丢掉 Ainvest 样式），CSS 选择器也无从「继承」。
 *
 * 文件形态：{ <theme>: { <density>: { tokens: {…}, behavior: {…} } } }，$ 前缀键为说明。
 * 合同（fail-fast）：
 *   ① 主题必须已存在、密度名必须登记在 DENSITIES；
 *   ② 覆盖键必须是该主题**已有**的键——覆盖层只改值、不加键，拼错的键会被当成新 token 静默生效；
 *   ③ 形态覆盖的值必须与原值同构（同类型、对象键集递归一致）——形态值参与几何计算，
 *      少一个子键（如 grip.gap）在运行时就是 NaN。
 */
export const DENSITIES = ['compact'];

const strip = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => !k.startsWith('$')));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function sameShape(a, b) {
  if (isObj(a) !== isObj(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  if (!isObj(a)) return Array.isArray(a) || typeof a === typeof b;
  const ka = Object.keys(a).sort().join(',');
  return ka === Object.keys(b).sort().join(',') && Object.keys(a).every((k) => sameShape(a[k], b[k]));
}

/* 文档 → { theme: { density: { tokens, behavior } } }，剥掉 $ 说明键并校验 ① */
export function parseDensity(doc, themes) {
  const out = {};
  for (const [theme, levels] of Object.entries(strip(doc))) {
    if (!themes.includes(theme)) throw new Error(`density.json：未知主题「${theme}」（已知 ${themes.join(' / ')}）`);
    out[theme] = {};
    for (const [density, layer] of Object.entries(strip(levels))) {
      if (!DENSITIES.includes(density)) {
        throw new Error(`density.json：${theme} 的密度「${density}」未登记（允许 ${DENSITIES.join(' / ')}）`);
      }
      out[theme][density] = { tokens: strip(layer.tokens), behavior: strip(layer.behavior) };
    }
  }
  return out;
}

/*
 * 基准 + 覆盖 → 合并后的完整表（不改入参）。校验 ②；strict 时再校验 ③。
 * 值 token 不做 ③：`"12px"` 换成 `{mobile, pc}` 分叉是合法覆盖，分叉形态由构建器的 assertShape 管。
 */
export function mergeLayer(base, override, where, { strict = false } = {}) {
  for (const [k, v] of Object.entries(override)) {
    if (!(k in base)) throw new Error(`${where}：覆盖键「${k}」不是基准已有的键（覆盖层只改值、不加键）`);
    if (strict && !sameShape(base[k], v)) {
      throw new Error(`${where}：「${k}」的覆盖值与基准不同构（类型或子键不一致）`);
    }
  }
  return { ...base, ...override };
}
