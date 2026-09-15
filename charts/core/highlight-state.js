/*
 * L1 · 关系型图的 hover / 钉住**状态迁移**（纯逻辑，无 DOM、无 d3、无 token）。
 * 权威规范见 specs/sankey.md（SANKEY-10 / SANKEY-20）。
 *
 * 为什么单开一个文件：与 legend-state.js 同一条理由——这套迁移原本住在 L2 的 index.js 里，
 * 而那里顶部 `import 'd3'`，`node --test` 环境没有 d3，**只要住在那个文件里就一行测不了**。
 * 「再点关闭」「钉住后移出要回落而不是清空」都是有真实分支的判定，却因此长期零覆盖。
 *
 * ── 职责边界 ──────────────────────────────────────────────────────
 * 本模块只回答一件事：**此刻该高亮哪个图元**。它不认识节点、边、弧、弦，
 * 只认 { kind, key } 这个二元组；kind 由调用方自己定名（如 'node' / 'edge'）。
 * 三件事留在 L2，本模块一概不做：
 *   ① 邻域怎么算（一跳？两端？）② class 怎么贴 ③ 该不该出 tooltip、出什么内容
 * 正因如此，同一套迁移能同时服务纵向流量图与绕圆关系图，而它们的几何毫无共同之处。
 *
 * ── 状态形状 ──────────────────────────────────────────────────────
 *   { pinned: {kind, key} | null, hovered: {kind, key} | null }
 *
 * **钉位只有一个**，互斥由类型保证。早先的写法是每类图元各一个钉位变量、靠「设这个、
 * 顺手清那个」手工维持互斥——漏清一次就会同时钉住两个，而这种状态没有任何视觉表现，
 * 只会让下一次 leave 回落到一个说不清是谁的目标。
 *
 * 所有迁移**返回新对象、不改入参**（同 legend-state.js 的纪律）。
 */

const same = (a, b) => a != null && b != null && a.kind === b.kind && a.key === b.key;

/* 初始状态。调用方每次 build 重新取一份，或把已有状态透传过来以跨重渲保持钉住。 */
export function createHighlightState() {
  return { pinned: null, hovered: null };
}

/*
 * [SANKEY-10] 指针进入（或键盘 focus 进入）一个图元。
 *
 * **hover 压过钉住**：钉着 A 时把指针移到 B，高亮跟着走到 B——否则钉住会变成
 * 「图表卡在某个状态上不动」，用户读不到别处。回落由 applyLeave 负责。
 */
export function applyHover(state, kind, key) {
  return { pinned: state.pinned, hovered: { kind, key } };
}

/*
 * [SANKEY-10] 指针移出（或 blur）。
 *
 * 只清 hover，**不动钉住**——所以钉着 A 时扫过 B 再移开，会回落到 A 而不是清空。
 * 这正是「钉住」相对于「hover」的全部意义；调用方读 activeTarget() 拿回落结果。
 */
export function applyLeave(state) {
  return { pinned: state.pinned, hovered: null };
}

/*
 * [SANKEY-20] 点击一个图元：点当前钉住的那个 → 关闭；点别的 → 钉位移过去。
 *
 * **关闭时连 hover 一并清空**，尽管指针此刻仍停在该图元上。这是刻意的：
 * 「再点一次关掉」若只退回 hover 态，画面几乎没有变化，用户会以为没点上。
 * 想重新看，移开再移回即可（pointerenter 会再次触发）。
 *
 * 跨类互斥也在这里：钉着一个节点时点一条边，钉位整体移到边上，不会两个都钉着。
 */
export function applyPick(state, kind, key) {
  const target = { kind, key };
  if (same(state.pinned, target)) return { pinned: null, hovered: null };
  return { pinned: target, hovered: target };
}

/* [SANKEY-20] 点空白：钉住与 hover 一起清掉。 */
export function applyClear() {
  return { pinned: null, hovered: null };
}

/*
 * 当前该高亮谁：**hover 优先，其次钉住，都没有则 null**。
 * 这一条式子就是「钉住」与「hover」的全部关系，别在调用方再写一遍分支。
 */
export function activeTarget(state) {
  return state.hovered ?? state.pinned ?? null;
}

/* 某个图元此刻是否被钉住（调用方用来决定要不要给它加持久态的类名）。 */
export function isPinned(state, kind, key) {
  return same(state.pinned, { kind, key });
}
