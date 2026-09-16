# 组件固定文案（Chart Text）

> 组件自己写死的文字——无障碍描述、看板固定行名、列表分隔符——的来源与替换方式。
> 实现在 `charts/core/chart-text.js`（L1，零 import）。
>
> 与示例内容语言的分工：系列名、实体名、节点名等**示例数据**由 L3 在装配配置时翻译
> （`demos/chart-presentation.js`，见 AGENTS.md）；本规范管的是**配置里没有、组件自己写的那几句**。
> 两者合起来，Ainvest 图表内部（图面、看板、读屏）才没有中文。

## 规则

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| CHARTTEXT-01 | 组件固定文案由各族 L2 的**缺省表**给出（中文），调用方经 `config.text` 替换。**L1 / L2 不判断语言或品牌**，语言由 L3 presentation 决定：Ainvest 注入英文表，THS / iFinD-PC 不传、走缺省。❌ 不得在 L2 写 `theme === 'ainvest'` 之类的分支，也不得把文案做成 token 或 behavior 键——它不是视觉规范 | `core/chart-text.js` → `resolveChartText()`；各族缺省表见下 | ✅ |
| CHARTTEXT-02 | `text` **整套替换**：键集必须与缺省表完全一致、值全是字符串，缺键 / 多键 / 非字符串当场抛错。不做逐键合并——逐键合并时漏翻一句不报错，只会在英文图面里悄悄混进一句中文。缺省表新增键时，同一次改动必须补齐 L3 的对应表 | `core/chart-text.js` → `resolveChartText()` | ✅ |
| CHARTTEXT-03 | 带变量的句子写成 `{key}` 模板，由 L2 填入**已格式化**的文本（数值先过 `core/format.js`）。整句作为一个模板交给翻译方，不拆成「词 + 标点」拼接——中英文语序、标点不同，拼接只能迁就一种语言。未提供的占位原样保留，拼错的键一眼可见 | `core/chart-text.js` → `fillText()` | ✅ |

## 各族缺省表

| 图型 | 缺省表 | 覆盖的文案 | Ainvest 英文表 |
|---|---|---|---|
| 弦图 | `chord/model.js` → `CHORD_TEXT` | 整图描述、弧 / 弦描述、看板「流出 / 流入 / 净额」 | `demos/chart-presentation.js` |
| 雷达图 | `radar/index.js` → `RADAR_TEXT` | 可调手柄描述、评级色阶描述的分隔符（两句只有标点是固定的，混进英文同样是中文） | `demos/chart-presentation.js` |
| 桑基图 | `sankey/config.js` → `SANKEY_TEXT` | 整图描述、图例描述、节点 / 流向描述 | `demos/sankey-presentation.js`（与图例、期间文案同处） |
| 矩形树图 | `treemap/content.js` → `TREEMAP_TEXT` | 整图描述（含缺名兜底）、叶子描述 | `demos/chart-presentation.js` |

图例文字另有 `legendLabels`（SANKEY 既有 API，逐键可选），不并入 `text`。

直角坐标图、饼 / 环、瀑布图的组件内没有写死的文案（文字全部来自配置），不设缺省表。

## 验收

`tests/chart-text.test.mjs` 钉住整套替换与模板填充的合同，并逐族核对 Ainvest 英文表与 L2 缺省表键集一致、
英文表不含中文字符（含中文标点）。缺省表住在 `index.js` 的族（雷达）因 d3 依赖无法被 node 加载，
由 `resolveChartText` 的运行时整套校验兜底：键集对不上时 Ainvest 渲染当场抛错。
