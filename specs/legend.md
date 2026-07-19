# 图例 · 规范（条目化索引）

> 权威源：`legend.md`（形态细节表述以原文为准）。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：所有多系列 / 需要图例说明的图表（柱、折线、饼、K 线组合等）。
> 分层：图例是 **L1 纯展示 + 事件 emit** 构件；系列的「隐藏 / 降透明度」由 L2 图形渲染执行，
> 图例本身不碰系列（见 LEGEND-05 / LEGEND-06 的实现列）。

## 容器与排布

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LEGEND-01 | 容器默认 **左对齐**、单行横排；行宽不足时 **flex-wrap 自动换行**（由容器宽度决定，不固定每行项数）。边距 `spacing-legend-container-v-top`（上）/ `spacing-legend-container-v-bottom`（下——即图例与 grid 的间距，frame 顶部不另留白）/ `spacing-legend-container-h`（左右）；THS 上 4 / 下 12；项水平间距 `spacing-legend-item-h`；换行行间距 `spacing-legend-row-v`。**对齐方式（左/中/右）无 token**，与主题一致默认左对齐 | `core/legend.js` → `renderLegend()`；`charts/styles.css` → `.dv-legend` | ✅ |
| LEGEND-04 | **单系列也必须显示图例**（哪怕一条系列），让用户知道数据含义；仅当图表本身完全无系列含义可言时才省略。**图例占位优先、给绘图区让位、不与绘图区重叠**（换行 / 分页增高时绘图区相应缩小，图例不覆盖数据线 / 柱） | 展示层原则；绘图区让位属 L2 布局约束（dev 预览体现，L2 组件建成时固化） | ✅ 展示层 |

## 图例项（marker + label）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LEGEND-02 | 每项 = 图例标记（marker）+ 图例标签（label）。标记容器（点击热区）`size-legend-marker`；标记与标签间距 `spacing-legend-marker-label`；标签字号 `font-size-legend`、行高 `line-height-legend`、颜色 `color-text-legend`、字体 `font-family-cn` | `renderLegend()`；`.dv-legend-item` / `.dv-legend-marker` / `.dv-legend-label` | ✅ |
| LEGEND-03 | **标记本体形状随主题分化**（形态，非 token）：<br>**THS —— 按图表类型**：柱/条 6×6 方（1px 圆角）· 折线 8×2 短横线（1px 圆角）· 饼/环/气泡/雷达 6×6 圆点 · 蜡烛 8×2 · 盒须 12×12 描边方 · 红绿柱 12×6 左右两色（涨跌固定色）· 其他 6×6 方。<br>**iFinD-PC —— 按图表类型（dvIcon）**：线 12×3 · 方 12 · 圆点。<br>**Ainvest —— 统一圆形 10×10**（不按类型区分）。<br>**标记颜色默认 `currentColor` 跟随对应系列的图表色**（求柱/折线/饼一致；红绿柱/盒须为涨跌固定色例外）。<br>**混合图表**：THS / iFinD 每系列 marker 独立跟随自身类型；Ainvest 统一圆形贯穿。<br>⚠️ 折线标记宽（8px）> 柱标记（6px），**不得统一成同一尺寸**（否则折线缩成点、看不出线形） | `tokens/behavior.json` → `legend-marker`；`renderLegend()` 的 `renderMarker()` | ✅ |

## 图例交互

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LEGEND-05 | **hover 弱化（Web · 多系列）**：hover 某图例项 → 该系列图形保持原色，**其他系列图形不透明度降低**（THS 20% / iFinD 10% / Ainvest 20%）；**图例本身（文字 / marker）不变**；离开即恢复。适用多系列图（分组 / 堆叠 / 归一堆叠 / 多折线 / 线柱组合等）；单系列基础图、K 线**无此效**。**移动端通常无 hover**，交互只靠点击。<br>值 `--opacity-visualization-dim`（THS/Ainvest 0.2、iFinD 0.1）由 **L2 图形渲染消费**；L1 图例仅 `emit onHover(key\|null)` | `--opacity-visualization-dim`（值 token，三主题）；`renderLegend()` 的 `onHover` 回调 | ✅ |
| LEGEND-06 | **点击显隐 · 两模式**（L1 参数化 `selectMode`，主题经 `legend-select` 选定）：<br>**多选（分组）**：点击某项 → 该项文字 + marker 变 `color-text-quaternary`，对应系列**隐藏**；每项独立开关。<br>**单选**：点击某项 → 弱化并隐藏**其他**项对应系列（聚焦当前）；点其他项切换选择，点已选中项恢复原始。<br>弱化 = 文字 / marker 用 `color-text-quaternary`；隐藏 = 对应系列图形不渲染（L2 执行）。L1 仅渲染关闭态外观 + `emit onToggle(key)` | `tokens/behavior.json` → `legend-select`；`renderLegend()` 的 `onToggle` 回调、`.dv-legend-item--off` | ✅ |

## 图例溢出（📋 待办，下一条规范单）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LEGEND-07 | 「图例溢出」是「自动换行」之上的**补充逻辑**：换行后**超过 2 行**仍裁不下时的处理（主题分化）：THS —— 移动端 **滑动**、Web/PC **分页器**（`1/3` + 翻页箭头）；iFinD-PC —— **分页器**；Ainvest —— **仅换行**（不滑动、不分页）。⚠️ 图例占位优先、给绘图区让位、不与绘图区重叠 | `tokens/behavior.json` → `legend-overflow`（键未加，随本条实现时新增三主题） | 📋 待办 |
| LEGEND-08 | 分页器（THS Web/PC · iFinD-PC）：文字 `1/3` 走 `font-size-legend`/`color-text-legend`/`font-family-cn`；翻页图标 12×12（SVG 替换）；元素间距统一 4px（无 token） | 随 LEGEND-07 | 📋 待办 |
| LEGEND-09 | 右侧下拉（可选）：图例区右端可配一个下拉选项（文字 + 下箭头，`font-size-legend`/`font-family-cn`/`font-weight-regular`/`color-text-primary`），用于切换指标或周期 | — | 📋 待办 |

## 样式 token（主题 × 端差异收在 tokens）

字号 `font-size-legend` · 行高 `line-height-legend` · 颜色 `color-text-legend` ·
标记容器 `size-legend-marker` · 标记-标签间距 `spacing-legend-marker-label` ·
项间距 `spacing-legend-item-h` · 行间距 `spacing-legend-row-v` ·
容器边距 `spacing-legend-container-v-top` / `-v-bottom` / `spacing-legend-container-h` ·
关闭态文字/标记 `color-text-quaternary` · hover 弱化不透明度 `opacity-visualization-dim`。

**标记本体尺寸 / 形状不是 token**（形态规范，走 `behavior.json` 的 `legend-marker`，见 LEGEND-03）。
**对齐方式不是 token**（默认左对齐，L2 可传 `align`）。

## 待办

- [ ] LEGEND-07 / LEGEND-08 图例溢出与分页器（含「给绘图区让位」的 L2 高度协商）——下一条规范单，届时给 `behavior.json` 三主题补 `legend-overflow` 键。
- [ ] LEGEND-09 右侧下拉选项。
- [ ] `legend-select` 的 **per-主题 单选/多选映射**：源文档只列出两种模式、未指明各主题默认，暂三主题全 `multi`（L1 两模式均已实现，改 behavior 即切换）。
- [ ] iFinD-PC `legend-marker` dvIcon 精确尺寸核对（源文档尺寸表述略糊，现取 线 12×3 / 方 12×12 / 圆点 8×8 占位）。
- [ ] 系列色板未定稿：marker 的 `currentColor` 现由使用方传入系列色变量；色板入库后接入固定槽位（COLOR 规范）。
- [ ] 暗色目检 / tokens.css 构建接入（全站统一，非图例专属）。
