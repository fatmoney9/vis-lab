/*
 * L1 · 动效（motion）。权威规范见 specs/motion.md。
 * 与 label.js / axis-title.js / watermark.js 一致：本模块**不 import d3**、也**不 import frame.js**
 * ——保证纯函数可被 node --test 直接加载；连逐帧循环也做到可测（rAF / 时钟经 opts 注入，
 * 缺省才取全局），否则动画收尾是否精确落在终态就只能靠肉眼验收。
 * 无 if(theme===…)：动效形态三主题一致，时长走 token（MOTION-02）、曲线是规范值常量（MOTION-03）。
 * 本模块只提供「什么曲线、怎么逐帧推进」；**画什么由调用方的 draw(t) 决定**，
 * 故柱 / 线 / 将来的饼环共用同一套驱动——时长统一（MOTION-02），无需按图表类型分派。
 */

/*
 * [MOTION-03] 缓动 cubicOut = easeOutCubic = cubic-bezier(0.33, 1, 0.68, 1)（先快后慢、自然减速）。
 * 系数是规范值常量而非 token：三主题同值、不参与主题分化（同 scale.js 的 Y_SPLIT_LINES 先例），
 * 且 tokenNum 只解析单个数值、取不出四个系数。此处导出供跨端实现对齐口径（CSS / ECharts 写法见规范页）。
 */
export const EASE_GROW = Object.freeze([0.33, 1, 0.68, 1]);

/* [MOTION-03] cubic-bezier(0.33, 1, 0.68, 1) 的等价闭式 */
export function easeOutCubic(t) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

/* [MOTION-07] 系统级「减弱动态效果」——无障碍底线，命中即直接终态、不提供绕过 */
export function reducedMotion(view = globalThis) {
  return !!view.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

/*
 * [MOTION-01] 逐帧推进一次生长：按 easeOutCubic 把进度 0→1 喂给 onFrame，返回 cancel。
 *   duration  毫秒；≤ 0 或环境无 rAF（如 node）→ 同步落终态
 *   onFrame   (t) => void，t 是**已缓动**的进度；调用方在这里重写几何属性
 *   opts      { raf, cancel, now, onDone }，前三个缺省取全局（注入是为可测）
 * 两条不变量（动画的正确性全靠它们）：
 *   ① onFrame(1) 恰好被调用一次且必定是最后一次 —— 不能停在 0.98，终态必须逐像素精确；
 *   ② cancel 后不再有任何回调 —— [MOTION-04] 被打断（如动画未完就拖缩放轴）立即落终态、不半途回退。
 */
export function runGrowth(duration, onFrame, opts = {}) {
  const {
    raf = globalThis.requestAnimationFrame,
    cancel = globalThis.cancelAnimationFrame,
    now = () => globalThis.performance?.now() ?? Date.now(),
    onDone = () => {},
  } = opts;

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    onFrame(1);
    onDone();
  };

  if (!(duration > 0) || typeof raf !== 'function') {
    settle();
    return () => {};
  }

  const t0 = now();
  let id = raf(function step() {
    if (settled) return;
    const t = Math.min(1, (now() - t0) / duration);
    if (t >= 1) return settle();
    onFrame(easeOutCubic(t));
    id = raf(step);
  });

  return () => {
    if (settled) return;
    if (typeof cancel === 'function') cancel(id);
    settle();
  };
}
