/*
 * [L2-LOCAL][CALLOUT-02] 直角坐标系的标注锚点解析 + 障碍矩形换算。
 *
 * 这一层留在 L2 是 specs/callout.md 写死的分层边界：「哪个数据点 → 哪个像素」要懂
 * band 尺、双 Y、datazoom 窗口与图例隐藏，全是图表专属知识；L1 `core/callout.js`
 * 只认识**像素锚点与矩形**，不认识柱和线。
 *
 * **刻意不叫 callout.js**：charts/charts/pie/geometry.js 已经为「两处同名不同语义
 * 迟早会有人拿错」付过一次账（labelAnchor 那对）。文件名直接编码分层职责。
 *
 * 本文件不读 DOM、不碰 d3、不识别主题或业务字段，故整份可被 node --test 直接加载。
 */

/*
 * [CALLOUT-02] 把配置里的标注声明解析成像素锚点。
 *
 *   specs = [{ series?, category, value?, text, axis? }]
 *     series —— 给了就锚到该系列在该类目的**真实数据点**；不给则走 value 的任意数值坐标档
 *     axis   —— 仅任意数值坐标档有意义（'primary' | 'secondary'）
 *   ctx = { categories, hidden, markAt, bandCenter, valueToY }
 *     categories —— **当前可见窗口**内的类目名数组（datazoom 切片后的那份）
 *     hidden     —— 被图例关掉的系列名 Set
 *     markAt     —— Map，`${series}|${类目下标}` → { x, y, dot }，由 index.js 在
 *                   渲染柱 / 线时顺手填好。**它是锚点的唯一来源**，本模块不自己算槽位偏移
 *     bandCenter —— (类目名) => 类目中心 x 像素
 *     valueToY   —— (值, axis) => y 像素
 *
 * 三条丢弃规则（任一命中即整条不出，CALLOUT-01 的强绑定）：
 *   ① **类目不在当前窗口内**——用类目名声明而不是绝对索引，正是为了让这条判定天然成立：
 *      窗口滑走后 categories 里就没有它，无需换算相对下标（换算是 datazoom 最容易错的地方）；
 *   ② 所在系列被图例隐藏；
 *   ③ 该类目的值为 null（断口，同 LABEL-07 的口径：mark 不画则标注也不出）。
 */
export function resolveCalloutAnchors(specs, ctx) {
  const { categories, hidden, markAt, bandCenter, valueToY } = ctx;
  const out = [];
  (specs ?? []).forEach((spec) => {
    if (!spec || spec.text == null || spec.text === '') return;
    const j = categories.indexOf(spec.category);
    if (j < 0) return;                                        /* ① 不在可见窗口内 */

    if (spec.series != null) {
      if (hidden?.has(spec.series)) return;                   /* ② 系列被图例隐藏 */
      const mark = markAt.get(`${spec.series}|${j}`);
      if (!mark) return;                                      /* ③ 值为 null / 该系列未渲染 */
      out.push({ x: mark.x, y: mark.y, dot: mark.dot, text: spec.text });
      return;
    }

    /* 任意数值坐标档：类目中心是两种 band 模式下唯一无歧义的横向定义。
       值超出当前值域时像素会落在绘图区外，由 L1 的 bounds 硬约束（CALLOUT-06）
       自然淘汰——**此处不需要额外判定**，多写一处只会多一处口径。 */
    if (!Number.isFinite(spec.value)) return;
    const x = bandCenter(spec.category);
    if (!Number.isFinite(x)) return;
    const y = valueToY(spec.value, spec.axis ?? 'primary');
    if (!Number.isFinite(y)) return;                          /* 比例尺退化时不产生 NaN 坐标 */
    out.push({ x, y, dot: true, text: spec.text });           /* 这里没有既有图元，环里要自己补点 */
  });
  return out;
}

/*
 * [CALLOUT-07] 柱 → 障碍矩形。一根柱就是一个矩形，无需近似。
 *   values/base 与 categories 等长平行；null 不产生矩形（那里没画柱）。
 */
export function barObstacles(categories, values, base, x, yy, offset, width) {
  const out = [];
  categories.forEach((c, j) => {
    const v = values[j];
    if (v == null) return;
    const b = base?.[j] ?? 0;
    const y0 = yy(b + v);
    const y1 = yy(b);
    out.push({
      x: x(c) + offset,
      y: Math.min(y0, y1),
      width,
      height: Math.max(0, Math.abs(y1 - y0)),
    });
  });
  return out;
}

/*
 * [CALLOUT-07] 折线 → 障碍矩形：**相邻两点的线段包围盒**，四周外扩 pad（线宽/2 + 点半径）。
 *
 * ⚠️ 这是**保守代理**，不是精确表示：对角线段的 AABB 面积远大于线本身，所以标注会「多躲」。
 * 接受它的理由——便宜、纯几何、可单测，且多躲的方向是安全的（宁可绕开也不要压在线上）。
 * 若实测发现躲得太凶，正确修法是换成线段-矩形精确相交，而不是把 pad 调小。
 *
 * null 断口两侧不连线，故不产生跨越断口的矩形。
 *   cx —— (类目名) => 类目中心 x 像素（与折线数据点的横坐标同一口径）
 */
export function lineObstacles(categories, values, cx, yy, pad = 0) {
  const pts = categories.map((c, j) => (values[j] == null ? null : { x: cx(c), y: yy(values[j]) }));
  const out = [];
  for (let j = 0; j < pts.length - 1; j += 1) {
    const a = pts[j];
    const b = pts[j + 1];
    if (!a || !b) continue;
    out.push({
      x: Math.min(a.x, b.x) - pad,
      y: Math.min(a.y, b.y) - pad,
      width: Math.abs(b.x - a.x) + pad * 2,
      height: Math.abs(b.y - a.y) + pad * 2,
    });
  }
  return out;
}
