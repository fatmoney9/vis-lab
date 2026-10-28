/*
 * L1 · 主题形态解析。
 * 值 token 走 CSS 变量（tokens/<theme>.json → tokens.css）；
 * 形态/行为走 tokens/behavior.json（本模块加载），供几何计算与分支逻辑消费。
 * 两条通道共用同一个开关：容器（或任意祖先）上的 data-theme 属性；
 * 同一元素上的 data-density 叠加密度覆盖层（tokens/density.json，两条通道同步生效）。
 * [AXIS-01][AXIS-02][AXIS-06] 的主题分化由此进入 L2 组件——demo / 使用者无入口。
 */
import { parseDensity, mergeLayer } from '../../tokens/density.mjs';

export const DEFAULT_THEME = 'ths';

/* no-store：形态文件极小，不值得为它吃一次缓存不一致的亏 */
const load = async (file) =>
  (await fetch(new URL(`../../tokens/${file}`, import.meta.url), { cache: 'no-store' })).json();
const [data, densityDoc] = await Promise.all([load('behavior.json'), load('density.json')]);
const { $meta, ...BEHAVIOR } = data;

/* 合同校验：全部主题必须覆盖同一套形态键，缺键立即抛错 */
{
  const names = Object.keys(BEHAVIOR);
  const base = Object.keys(BEHAVIOR[names[0]]).sort().join(',');
  for (const n of names) {
    if (Object.keys(BEHAVIOR[n]).sort().join(',') !== base) {
      throw new Error(`behavior.json 合同不一致：主题「${n}」与「${names[0]}」的键集合不同`);
    }
  }
}

/* 密度覆盖层（tokens/density.json 的 behavior 段）：加载时即合并、即校验——与构建器同一套规则，
   覆盖了不存在的形态键或子键对不上，在这里立刻抛错，而不是等某次几何计算算出 NaN */
const DENSITY = parseDensity(densityDoc, Object.keys(BEHAVIOR));
const DENSE = Object.fromEntries(Object.entries(DENSITY).map(([theme, levels]) => [
  theme,
  Object.fromEntries(Object.entries(levels).map(([d, layer]) => [
    d, mergeLayer(BEHAVIOR[theme], layer.behavior, `density:${theme}.${d}`, { strict: true }),
  ])),
]));

/* 端分叉展开：只有显式含 mobile/pc 键的对象才是分叉；
   其他对象（如 number-format 的参数包）原样透传 */
const unfold = (v, platform) =>
  v !== null && typeof v === 'object' && ('mobile' in v || 'pc' in v) ? v[platform] : v;

export function themeOf(host) {
  return host.closest('[data-theme]')?.dataset.theme ?? DEFAULT_THEME;
}

/* 密度档：**只读挂 data-theme 的那个元素**上的 data-density——CSS 作用域是
   [data-theme][data-density] 的同元素复合选择器，形态若改成「最近的 [data-density] 祖先」，
   两条通道就会在属性分挂两处时各说各话（值已紧凑、形态仍标准，或反之）。 */
export function densityOf(host) {
  return host.closest('[data-theme]')?.dataset.density ?? null;
}

/* 某主题声明了哪些密度档（供 L3 决定要不要露出开关；未声明的主题返回空数组） */
export const densitiesOf = (theme) => Object.keys(DENSITY[theme] ?? {});

/* [WATERMARK-04] light/dark 开关：最近 [data-mode] 祖先（缺省 light）——供选水印明暗资源 */
export function modeOf(host) {
  return host.closest('[data-mode]')?.dataset.mode ?? 'light';
}

/* 返回当前主题 × 端展开后的形态表（纯值，无嵌套） */
export function resolveBehavior(host, platform = 'pc') {
  const theme = themeOf(host);
  const profile = DENSE[theme]?.[densityOf(host)] ?? BEHAVIOR[theme] ?? BEHAVIOR[DEFAULT_THEME];
  return Object.fromEntries(Object.entries(profile).map(([k, v]) => [k, unfold(v, platform)]));
}
