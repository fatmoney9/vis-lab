/*
 * [L2-LOCAL][HBAR-15] 横向条系的跨主题不变量：播放时序与几何比例。
 * 零 import。这些是**规范值常量**不是 token——三主题同值，且 tokenNum 解析不出「比例」这种东西。
 *
 * 为什么播放时长不走 token：先例是 charts/charts/sankey/config.js。
 * `specs/motion.md` 页首写明「本页只管**入场**」，MOTION-02 的 480ms 只约束入场生长；
 * 期间推进属于该页待办里明写的**另一类**动效（数据更新动效），由各图表规范页自定并覆盖。
 */

export const HBAR_SETTINGS = Object.freeze({
  /* 一期推进的几何补间时长。比入场的 480ms 长，因为这一帧里同时在变的东西更多
     （条长 + 行位置 + 数值 + 进出场透明度），太快会看不清谁超过了谁。 */
  'playback-duration': 760,
  /* 缓动统一 cubicOut（MOTION-03），与入场同一条曲线，不另立。 */
  'playback-easing': 'cubic-out',
  /* 榜底外一行：掉榜 / 进榜的行在榜外的停靠位，以「行」为单位。
     取 1 表示正好一行之外——再远会让进场条从很远处飞入，反而抢戏。 */
  'roster-overflow-rows': 1,
});

const positive = (value, where) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new TypeError(`HBarChart：${where} 必须是大于 0 的有限数`);
  return n;
};

/* 与 sankey/config.js 同一条纪律：常量被人改坏时当场抛错，而不是画出一张诡异的图。 */
export function validateHBarSettings(settings = HBAR_SETTINGS) {
  positive(settings['playback-duration'], 'playback-duration');
  positive(settings['roster-overflow-rows'], 'roster-overflow-rows');
  if (settings['playback-easing'] !== 'cubic-out') {
    throw new TypeError('HBarChart：playback-easing 仅支持 cubic-out（MOTION-03 全站统一）');
  }
  return settings;
}

/* [HBAR-11] Top-N 的合法区间。低于 2 名就没有「排名」可言，高于 30 行会挤到看不清。 */
export const TOP_N_RANGE = Object.freeze({ min: 2, max: 30, default: 10 });

export function clampTopN(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return TOP_N_RANGE.default;
  return Math.max(TOP_N_RANGE.min, Math.min(TOP_N_RANGE.max, n));
}
