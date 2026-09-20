/*
 * L3 · 首页左栏的分类图标。
 *
 * ⚠️ **住在这里而不是 index.html 里**，是为了让门禁能 import 它：
 * `hooks/lint-nav-icon.mjs` 要逐族核对「有没有图标」，靠正则去 HTML 里捞是猜，
 * 猜错了守卫会假绿。新增图族时忘记配图标，2026-09-20 真实发生过一次
 * （排名变化族在首页左栏是一个空位），当时没有任何东西会报错。
 */

/* 分类图标：**按分类名取、取不到回落到族的图表类型**。
   只按名字取的话，改一个分类名图标就静默消失；回落到 chart 后最差也只是同族共用一枚，
   不会开天窗。图标一律 currentColor + fill:none，跟着字色走，不自带颜色。 */
export const ICON = (d, extra = '') =>
  `<svg class="nav-item__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra}</svg>`;
export const NAV_ICONS = {
  /* 柱：三根不等高的竖条 */
  '柱状图': ICON('<path d="M3.5 13V7M8 13V3.5M12.5 13V9.5"/>'),
  /* 堆叠：一根竖条被分成三段 */
  '堆叠图': ICON('<rect x="4" y="3" width="8" height="10" rx="1"/><path d="M4 6.5h8M4 9.5h8"/>'),
  /* 折线：一条折线 */
  '折线图': ICON('<path d="M2.5 11l3.5-4 3 2.5L13.5 4"/>'),
  /* 组合：两根柱 + 一条线 */
  '组合图': ICON('<path d="M3.5 13V8.5M12.5 13V6"/><path d="M2.5 5.5l4 2 3-2.5 4 1.5"/>'),
  /* 瀑布：三个**逐级悬空**的块拼成阶梯。
     ⚠️ 两条都是试出来的，别退回去：
     ① **不画三根等底的竖条**——那就是柱状图的图标，两族会撞；瀑布的辨识点是「柱不落在同一条底线上」。
     ② **不画虚线连接线**——语义上对，但 svg 继承了 stroke-linecap:round，
        1.5 长的 dash 在 16px 下被磨成一串灰点，整个图标糊成一团。
     悬空这一点由块的错位表达就够了，不需要连接线。 */
  '瀑布图': ICON('<rect x="2.8" y="9" width="3" height="4" rx=".6"/><rect x="6.5" y="6" width="3" height="4" rx=".6"/><rect x="10.2" y="3" width="3" height="4" rx=".6"/>'),
  /* 桑基：左右两侧节点 + 中间流带 */
  '桑基图': ICON('<path d="M2.5 3.5v3M2.5 9.5v3M13.5 5.5v5"/><path d="M2.5 5C6 5 7 8 13.5 8M2.5 11C6 11 7 8 13.5 8"/>'),
  /* 树图：一个矩形被切成大小不等的块 */
  '矩形树图': ICON('<rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="M8.5 3v10M8.5 8h5"/>'),
  /* 雷达：正五边形 + 中心辐条 */
  '雷达图': ICON('<path d="M8 2.5l5.2 3.8-2 6.2H4.8l-2-6.2z"/><path d="M8 2.5v5.4M8 7.9l5.2-1.6M8 7.9l-5.2-1.6M8 7.9l3.2 4.6M8 7.9l-3.2 4.6" stroke-opacity=".45"/>'),
  /* 饼环：圆 + 一条切分线 */
  '饼图与环形图': ICON('<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5V8h5.5"/>'),
  /* 弦图：圆环 + 两条向心收束的弦 */
  '弦图': ICON('<circle cx="8" cy="8" r="5.5"/><path d="M3.6 5.1C7.2 8.4 8.8 8.4 12.4 5.1M4.4 11.4C7 8 9.6 7.2 13.2 9.2" stroke-opacity=".55"/>'),
  /* 排名变化：三根**左对齐、逐级变短**的横条——竞赛图读的是「谁更长、谁在上」。
     ⚠️ 不能画成竖条：那是柱状图的图标，两族会撞（同 瀑布图 那条的教训）。 */
  '排名变化': ICON('<rect x="2.5" y="3" width="11" height="2.6" rx=".6"/><rect x="2.5" y="6.7" width="7.5" height="2.6" rx=".6"/><rect x="2.5" y="10.4" width="4.5" height="2.6" rx=".6"/>'),
  /* 族级回落 */
  cartesian: ICON('<path d="M3.5 13V7M8 13V3.5M12.5 13V9.5"/>'),
  sankey: ICON('<path d="M2.5 3.5v3M2.5 9.5v3M13.5 5.5v5"/><path d="M2.5 5C6 5 7 8 13.5 8M2.5 11C6 11 7 8 13.5 8"/>'),
  treemap: ICON('<rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="M8.5 3v10M8.5 8h5"/>'),
  radar: ICON('<path d="M8 2.5l5.2 3.8-2 6.2H4.8l-2-6.2z"/>'),
  pie: ICON('<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5V8h5.5"/>'),
  waterfall: ICON('<rect x="2.8" y="9" width="3" height="4" rx=".6"/><rect x="6.5" y="6" width="3" height="4" rx=".6"/><rect x="10.2" y="3" width="3" height="4" rx=".6"/>'),
  hbar: ICON('<rect x="2.5" y="3" width="11" height="2.6" rx=".6"/><rect x="2.5" y="6.7" width="7.5" height="2.6" rx=".6"/><rect x="2.5" y="10.4" width="4.5" height="2.6" rx=".6"/>'),
  chord: ICON('<circle cx="8" cy="8" r="5.5"/><path d="M3.6 5.1C7.2 8.4 8.8 8.4 12.4 5.1"/>'),
  /* 跨族入口：田字格 */
  __all: ICON('<rect x="2.5" y="2.5" width="5" height="5" rx="1"/><rect x="8.5" y="2.5" width="5" height="5" rx="1"/><rect x="2.5" y="8.5" width="5" height="5" rx="1"/><rect x="8.5" y="8.5" width="5" height="5" rx="1"/>'),
};
