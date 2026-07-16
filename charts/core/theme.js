/*
 * L1 · 主题形态解析。
 * 值 token 走 CSS 变量（tokens/<theme>.json → tokens.css）；
 * 形态/行为走 tokens/behavior.json（本模块加载），供几何计算与分支逻辑消费。
 * 两条通道共用同一个开关：容器（或任意祖先）上的 data-theme 属性。
 * [AXIS-01][AXIS-02][AXIS-06] 的主题分化由此进入 L2 组件——demo / 使用者无入口。
 */
export const DEFAULT_THEME = 'ths';

/* no-store：形态文件极小，不值得为它吃一次缓存不一致的亏 */
const data = await (
  await fetch(new URL('../../tokens/behavior.json', import.meta.url), { cache: 'no-store' })
).json();
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

/* 端分叉展开：只有显式含 mobile/pc 键的对象才是分叉；
   其他对象（如 number-format 的参数包）原样透传 */
const unfold = (v, platform) =>
  v !== null && typeof v === 'object' && ('mobile' in v || 'pc' in v) ? v[platform] : v;

export function themeOf(host) {
  return host.closest('[data-theme]')?.dataset.theme ?? DEFAULT_THEME;
}

/* 返回当前主题 × 端展开后的形态表（纯值，无嵌套） */
export function resolveBehavior(host, platform = 'pc') {
  const profile = BEHAVIOR[themeOf(host)] ?? BEHAVIOR[DEFAULT_THEME];
  return Object.fromEntries(Object.entries(profile).map(([k, v]) => [k, unfold(v, platform)]));
}
