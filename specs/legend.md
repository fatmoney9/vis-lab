# 图例 · 规范（条目化索引）

> 权威源：`legend.md`（形态细节表述以原文为准）。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：所有多系列 / 需要图例说明的图表（柱、折线、饼、K 线组合等）。
> 分层：图例是 **L1 纯展示 + 事件 emit** 构件；系列的「隐藏 / 降透明度」由 L2 图形渲染执行，
> 图例本身不碰系列（见 LEGEND-05 / LEGEND-06 的实现列）。

## 容器与排布

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LEGEND-01 | **排布有两种主轴方向**（本条是排布规则的唯一定义处）：<br>· **横排（`row`，默认）** —— 单行横排，行宽不足时 **flex-wrap 自动换行**（由容器宽度决定，不固定每行项数）；<br>· **纵向单列（`column`）** —— 一项一行、不换行，用于图例在绘图区侧旁的场景（方位见 LEGEND-10）。<br>**对齐（左/中/右）语义与方向无关、实现随方向走**：横排下是水平分布（`justify-content`）、纵列下是水平贴靠（`align-items`），两种方向下「左对齐」都指图例项靠左。容器默认 **左对齐**。<br>**项间距按方向分列两个 token，不共用**：横排用 `spacing-legend-item-h`（THS 12 / iFinD-PC 20 / Ainvest 16）、纵列用 `spacing-legend-item-v`（三主题 12）。<br>⚠️ 纵列的项距**不是** `spacing-legend-row-v`——那条是「横排放不下时**换行**的行距」（三主题 4px），是补偿性的兜底值；纵列里项距是主排布节奏，两者意图不同。CSS 上主轴转竖直后 `row-gap` 会自动接管项距，故必须显式覆盖，否则会静默套用 4px。<br>其余间距 token 两种方向共用：边距 `spacing-legend-container-v-top`（上）/ `spacing-legend-container-v-bottom`（下——即图例与 grid 的间距，frame 顶部不另留白）/ `spacing-legend-container-h`（左右）；THS 上 4 / 下 12；项水平间距 `spacing-legend-item-h`；换行行间距 `spacing-legend-row-v`。**对齐方式（左/中/右）无 token**，与主题一致默认左对齐 | `core/legend.js` → `renderLegend()` 的 `layout` / `align` 参数；`charts/styles.css` → `.dv-legend` / `.dv-legend--column` | ✅ |
| LEGEND-04 | **单系列也必须显示图例**（哪怕一条系列），让用户知道数据含义；仅当图表本身完全无系列含义可言时才省略。**图例占位优先、给绘图区让位、不与绘图区重叠**（换行 / 分页增高时绘图区相应缩小，图例不覆盖数据线 / 柱） | `charts/charts/cartesian/index.js`：先渲染图例，再按 `plotHost` 剩余高度创建 frame | ✅ |
| LEGEND-10 | **方位** —— 图例块相对绘图区的位置：`top` 图上方 · `right` 图右侧 · `bottom` 图下方。<br>**DOM 顺序恒为「绘图区 → 图例」**（阅读序 = 先看图、再看解释它的键），方位只由容器 flex 方向切，**不用 `row-reverse` 一类的视觉倒序**——那会让 DOM 序与视觉序脱节，Tab 焦点与读屏顺序都跟着错。<br>（`CartesianChart` 是历史例外：图例 DOM 在前 + 容器 `column` = 图例在上，等价于 `top`。）<br>**方位与排布（LEGEND-01）配套但不等同**，成品组合：`top`+横排 · `right`+纵列 · `bottom`+横排居中。<br>**图例块与绘图区的间距**：`top` 沿用 `spacing-legend-container-v-bottom`（图例在上、下边距即间距，LEGEND-01）；`right` / `bottom` 走 `spacing-legend-chart-gap`（三主题 24px），并把图例朝向图那一侧的容器内边距清零，避免两者叠加。<br>**不是主题分叉**（三主题同一套形态），故不进 `behavior.json`；**由调用方按场景选**（宽扁卡片走 `right`、窄高卡片走 `bottom`），属「要哪种形态」的语义配置而非样式参数（同 `variant` / `dataLabel`，WORKFLOW 铁律4）。<br>哪种图表支持哪几个方位、默认哪个，由各图表规范页定（饼环见 [pie.md](pie.md) PIE-09） | `charts/styles.css` → `.dv-chart--legend-right` / `.dv-chart--legend-bottom`；L2 挂修饰类 + 决定 DOM 顺序 | ✅ |

## 图例项（marker + label）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LEGEND-02 | 每项 = 图例标记（marker）+ 图例标签（label）。标记容器（点击热区）`size-legend-marker`；标记与标签间距 `spacing-legend-marker-label`；标签字号 `font-size-legend`、行高 `line-height-legend`、颜色 `color-text-legend`、字体 `font-family-cn` | `renderLegend()`；`.dv-legend-item` / `.dv-legend-marker` / `.dv-legend-label` | ✅ |
| LEGEND-03 | **标记本体形状随主题分化**（形态，非 token）：<br>**THS —— 按图表类型**：柱/条 6×6 方（1px 圆角）· 折线 8×2 短横线（1px 圆角）· 饼/环/气泡/雷达 6×6 圆点 · 蜡烛 8×2 · 盒须 12×12 描边方 · 红绿柱 12×6 左右两色（涨跌固定色）· 其他 6×6 方。<br>**iFinD-PC —— 按图表类型（dvIcon）**：线 12×3 · 方 12 · 圆点。<br>**Ainvest —— 统一圆形 10×10**（不按类型区分）。<br>**标记颜色默认 `currentColor` 跟随对应系列的图表色**（求柱/折线/饼一致；红绿柱/盒须为涨跌固定色例外）。<br>**混合图表**：THS / iFinD 每系列 marker 独立跟随自身类型；Ainvest 统一圆形贯穿。<br>⚠️ 折线标记宽（8px）> 柱标记（6px），**不得统一成同一尺寸**（否则折线缩成点、看不出线形） | `tokens/behavior.json` → `legend-marker`；`renderLegend()` 的 `renderMarker()`；饼环按扇区传 `type:'dot'`（`charts/charts/pie/index.js`，见 [pie.md](pie.md) PIE-03） | ✅ |

## 图例交互

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LEGEND-05 | **hover 弱化（Web · 多系列）**：hover 某图例项 → 该系列图形保持原色，**其他系列图形不透明度降低**（THS 20% / iFinD 10% / Ainvest 20%）；**图例本身（文字 / marker）不变**；离开即恢复。适用多系列图（分组 / 堆叠 / 归一堆叠 / 多折线 / 线柱组合等）；单系列基础图、K 线**无此效**。**移动端通常无 hover**，交互只靠点击。<br>值 `--opacity-visualization-dim`（THS/Ainvest 0.2、iFinD 0.1）由 **L2 图形渲染消费**；L1 图例仅 `emit onHover(key\|null)` | `--opacity-visualization-dim`（值 token，三主题）；`renderLegend()` 的 `onHover` 回调 | ✅ |
| LEGEND-06 | **点击显隐 · 两模式**（L1 参数化 `selectMode`，主题经 `legend-select` 选定）：<br>**多选（分组）**：点击某项 → 该项文字 + marker 变 `color-text-quaternary`，对应系列**隐藏**；每项独立开关。<br>**单选**：点击某项 → 弱化并隐藏**其他**项对应系列（聚焦当前）；点其他项切换选择，点已选中项恢复原始。<br>弱化 = 文字 / marker 用 `color-text-quaternary`；隐藏 = 对应系列图形不渲染（L2 执行）。L1 仅渲染关闭态外观 + `emit onToggle(key)` | `tokens/behavior.json` → `legend-select`；`renderLegend()` 的 `onToggle` 回调、`.dv-legend-item--off` | ✅ |
| LEGEND-12 | **最后一个可见项不可关**（两模式共通，**全部图表**）：点击当前唯一亮着的图例项 → **原样返回**，该项保持彩色、图形保持渲染，等同没点。<br>**为什么不是「允许全隐」**：全隐对任何图表都不是有用的读数——饼环直接空白一片、轴图只剩一副空网格；而恢复的唯一入口恰恰是刚被点灰的那个图例项，用户很容易读成「图挂了」。单选模式（LEGEND-06）本就恒留一项，本条只是让多选与之一致，于是「全隐」这个状态在两个模式下都不存在。<br>**收在 L1 的 `applyToggle` 里、不给 L2 加开关**：加参数就等于每个新接入的图表都要记得传，而这条规则对谁都成立——同 [tooltip.md](tooltip.md)「位置档的边界」删掉容器尺寸参数的取舍 | `core/legend.js` → `applyToggle()` | ✅ |

## 图例溢出

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LEGEND-11 | **纵向单列排布（LEGEND-01 的 `column`）的溢出 = 容器内纵向滑动**：项数超出可用高度时图例区自身滚动，**不分页、不截断、不换列**，绘图区尺寸不受影响。<br>三主题一致——纵列是「图例在侧旁」这种布局的固有形态，溢出方式不随品牌分化，故**不进 `behavior.json`**。<br>与 LEGEND-07 的关系：那条管的是**横排换行**之后仍放不下的情形（分页器 / 滑动按主题分化），两者管的是不同排布方向，互不覆盖 | `charts/styles.css` → `.dv-legend--column { overflow-y: auto }` + `.dv-chart__legend` 的可压缩约束 | ✅ |

## 图例溢出 · 横排方向（📋 待办，下一条规范单）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LEGEND-07 | 「图例溢出」是「自动换行」之上的**补充逻辑**：换行后**超过 2 行**仍裁不下时的处理（主题分化）。**仅针对横排排布**——纵列的溢出已由 LEGEND-11 定为滑动：THS —— 移动端 **滑动**、Web/PC **分页器**（`1/3` + 翻页箭头）；iFinD-PC —— **分页器**；Ainvest —— **仅换行**（不滑动、不分页）。⚠️ 图例占位优先、给绘图区让位、不与绘图区重叠 | `tokens/behavior.json` → `legend-overflow`（键未加，随本条实现时新增三主题） | 📋 待办 |
| LEGEND-08 | 分页器（THS Web/PC · iFinD-PC）：文字 `1/3` 走 `font-size-legend`/`color-text-legend`/`font-family-cn`；翻页图标 12×12（SVG 替换）；元素间距统一 4px（无 token） | 随 LEGEND-07 | 📋 待办 |
| LEGEND-09 | 右侧下拉（可选）：图例区右端可配一个下拉选项（文字 + 下箭头，`font-size-legend`/`font-family-cn`/`font-weight-regular`/`color-text-primary`），用于切换指标或周期 | — | 📋 待办 |

## 样式 token（主题 × 端差异收在 tokens）

字号 `font-size-legend` · 行高 `line-height-legend` · 颜色 `color-text-legend` ·
标记容器 `size-legend-marker` · 标记-标签间距 `spacing-legend-marker-label` ·
横排项间距 `spacing-legend-item-h` · **纵列项间距 `spacing-legend-item-v`（三主题 12px）** ·
横排换行行距 `spacing-legend-row-v` ·
容器边距 `spacing-legend-container-v-top` / `-v-bottom` / `spacing-legend-container-h` ·
图例与绘图区间距（`right` / `bottom` 方位）`spacing-legend-chart-gap`（三主题 24px）·
关闭态文字/标记 `color-text-quaternary` · hover 弱化不透明度 `opacity-visualization-dim`。

**标记本体尺寸 / 形状不是 token**（形态规范，走 `behavior.json` 的 `legend-marker`，见 LEGEND-03）。
**对齐方式不是 token**（默认左对齐，L2 可传 `align`）。
**排布方向不是 token**（横排 / 纵列，L2 传 `layout`，见 LEGEND-01）。
**方位不是 token、也不是主题分叉**（LEGEND-10，由调用方按场景选，L2 挂 `.dv-chart--legend-*`）。

## 待办

- [ ] LEGEND-07 / LEGEND-08 图例溢出与分页器（含「给绘图区让位」的 L2 高度协商）——下一条规范单，届时给 `behavior.json` 三主题补 `legend-overflow` 键。
- [ ] LEGEND-09 右侧下拉选项。
- [ ] `legend-select` 的 **per-主题 单选/多选映射**：源文档只列出两种模式、未指明各主题默认，暂三主题全 `multi`（L1 两模式均已实现，改 behavior 即切换）。
- [ ] iFinD-PC `legend-marker` dvIcon 精确尺寸核对（源文档尺寸表述略糊，现取 线 12×3 / 方 12×12 / 圆点 8×8 占位）。
- [x] 系列色板已由 `tokens/palette.json` + `core/palette.js` 接入固定槽位，marker 复用系列 `colorVar`（COLOR 规范）。
- [x] `tokens.css` 构建已接入；playground 提供三主题明暗切换用于目检。
