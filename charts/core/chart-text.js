/*
 * core/chart-text.js —— 【组件固定文案】缺省表 + 整套替换 + `{key}` 模板填充
 * [CHARTTEXT-01..03]
 *
 * ⚠️ 零 import：chord/model.js、sankey/config.js、treemap/content.js 都被 `node --test` 直接加载，
 * 这里一旦接上 d3 或顶层 await，三族单测立刻全红（同 core/measure.js / core/polar-label.js）。
 *
 * 管的是**组件自己写死的那几句话**——无障碍描述、看板固定行名、列表分隔符。它们不在示例配置里，
 * L3 翻译配置数据时够不着，于是 Ainvest 的图面是英文、读屏和看板却还是中文。
 *
 * 语言由 L3 决定（demos/*-presentation.js 注入 `config.text`）；**本模块与 L2 都不认识语言或品牌**，
 * 只认「缺省表」和「调用方给的整套替换」。
 */

/*
 * [CHARTTEXT-02] 不给 → 用 L2 缺省表；给了 → 必须整套、键集完全一致、值全是字符串。
 * 整套而非逐键合并：逐键合并时漏翻一句不会报错，只会在英文图面里悄悄冒出一句中文——
 * 恰恰是这个模块要消灭的情形。缺省表加了新键而 L3 没跟，当场报错比静默混排好查。
 */
export function resolveChartText(defaults, overrides, owner) {
  if (overrides == null) return defaults;
  if (typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError(`${owner}：text 必须是对象`);
  }
  const unknown = Object.keys(overrides).filter((key) => !Object.hasOwn(defaults, key));
  if (unknown.length) throw new TypeError(`${owner}：text 含未知键 ${unknown.join(', ')}`);
  const missing = Object.keys(defaults).filter((key) => typeof overrides[key] !== 'string');
  if (missing.length) throw new TypeError(`${owner}：text 必须整套提供，缺少 ${missing.join(', ')}`);
  return { ...overrides };
}

/*
 * [CHARTTEXT-03] `{key}` 占位填充。值由 L2 给出**已格式化**的文本（数值先过 core/format.js）。
 * 没提供的占位**原样保留**：拼错的键在图面上一眼可见，而不是被吞成空串、读起来少半句还不报错。
 */
export function fillText(template, values) {
  return template.replace(/\{(\w+)\}/g, (whole, key) => (
    Object.hasOwn(values, key) ? String(values[key]) : whole
  ));
}
