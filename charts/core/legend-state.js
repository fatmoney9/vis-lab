/*
 * L1 · 图例点击的**状态迁移**（纯逻辑，无 DOM、无 d3、无 token）。权威规范见 specs/legend.md。
 *
 * 为什么单开一个文件、不留在 legend.js 里：那边顶部 `import { select } from 'd3'`，
 * 而 `node --test` 环境没有 d3——**只要住在那个文件里就一行测不了**。
 * LEGEND-06 的模式分流与 LEGEND-12 的「最后一项不可关」都是有真实分支的判定，
 * 却因此长期零覆盖。本模块与 pie/geometry.js、cartesian/layout.js 同一条纪律：
 * 纯函数模块不碰第三方依赖，故可被测试直接加载。
 *
 * 两条互不相干的状态线，各自一个纯函数：
 *   applyToggle —— 改 hidden 集合（「筛」：隐藏项退出数据构成，角度 / 值域按可见项重算）
 *   applyFocus  —— 改 selected 键（「强调」：数据构成一点不动，只改视觉权重）
 * 两者**不合并成一个函数**：返回值类型就不同（Set / key|null），
 * 合并等于让调用方每次都判一次「这次返回的是哪种东西」。
 */

/*
 * [LEGEND-06] 「筛」的两档模式（L1 唯一实现，L2 在 onToggle 里调用后重渲）。
 *   multi ——独立开关：命中项在 hidden 中增删。
 *   single——单选保留：点非唯一可见项 → 只留该项（其余全 hidden）；点当前唯一可见项 → 恢复全显。
 *
 * [LEGEND-12] **最后一个可见项不可关**：点它原样返回（外观与图形都不变，等同没点）。
 * 单选模式本就恒留一项，本条让多选与之一致，「全隐」这个状态两模式下都不存在——
 * 它对任何图表都不是有用的读数（饼环直接空白一片，轴图只剩空网格），
 * 而恢复的唯一入口又正是刚被点灰的那个图例项，容易读成「图挂了」。
 * 收在这里而不是给 L2 加开关：加参数就等于每个新图表都要记得传，而这条对谁都成立。
 *
 * 返回新的 hidden Set（不改入参）。selectMode 由 cfg 的 legendSelect 决定（LEGEND-06）。
 */
export function applyToggle(hidden, key, allKeys, selectMode = 'multi') {
  if (selectMode === 'single') {
    const visible = allKeys.filter((k) => !hidden.has(k));
    const soleVisible = visible.length === 1 && visible[0] === key;
    return soleVisible ? new Set() : new Set(allKeys.filter((k) => k !== key));
  }
  const next = new Set(hidden);
  if (next.has(key)) {
    next.delete(key);          /* 打开恒可行 */
    return next;
  }
  /* [LEGEND-12] 要关的正是最后一个亮着的 → 不动 */
  if (allKeys.filter((k) => !next.has(k)).length <= 1) return next;
  next.add(key);
  return next;
}

/*
 * [LEGEND-14] 「强调」档的状态迁移：单选，再点自己取消、点别的移过去。
 *
 * **不产生 hidden**——这正是本档与 LEGEND-06 两档的分水岭：数据构成一点不动，
 * 故饼环仍是完整的 360°、轴图值域不变，只有视觉权重变了。
 * 也因此 LEGEND-12「最后一项不可关」在本档**不适用**：这里从来没有「关」这回事，
 * 取消强调回到的是「全部同权」而不是「全部隐藏」，那是个正常读数。
 *
 * 与饼环 PIE-10 的扇区点击**共用同一个状态**（图例项是第四个入口，前三个是
 * 扇区面 / 引线 / 外侧标签，见 PIE-17），故迁移规则必须与那边逐字一致——
 * 两处各写一份 `sel === key ? null : key` 迟早会在某次改动里岔开。
 *
 * 返回新的 selected（key 或 null，不改入参）。
 */
export function applyFocus(selected, key) {
  return selected === key ? null : key;
}
