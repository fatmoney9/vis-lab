# Tooltip / 提示框 · 规范（条目化索引）

> 本页是项目内 Tooltip 规则的权威定义；代码注释通过稳定 ID 回引本页。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：直角坐标图（柱 / 线 / 折柱组合 / 双 Y）的 hover 提示链路：气泡卡片、位置档、
> 指示线、轴标签高亮、交互行为。颜色具体值全部走 token（[tokens 目录](../tokens/)，明暗各一组），
> 参与几何计算的档位差异走 `tokens/behavior.json`。
> 分层：气泡 / 定位（`core/tooltip.js`）与指示线 / 轴贴片（`core/crosshair.js`）是 **L1 纯渲染**构件；
> 「hover 落在哪个类目、取哪些系列的值」由 L2 组装后传参（`charts/charts/cartesian/index.js`）。

## 气泡卡片

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| TOOLTIP-01 | 气泡形态：背景 `color-visualization-tooltip` · 内边距 `spacing-tooltip-pad` · 圆角 `radius-tooltip` · 行间距 `spacing-tooltip-row` · 数据行两列最小间距 `spacing-tooltip-row-gap` · 默认最大宽度 `size-tooltip-max-width`（超出换行）；**iFinD 特例叠加**：1px 边框 `color-visualization-tooltip-border` + 阴影 `shadow-tooltip` + 标题行下分割线 `color-visualization-tooltip-divider` + 字体 Arial（`font-family-tooltip`，Tooltip 内不用 YaHei）——THS / Ainvest 该组 token 置 transparent / none 自然无形 | `.dv-tooltip`（styles.css）· `core/tooltip.js` | ✅ |
| TOOLTIP-02 | 气泡内容：自上而下 = **日期 / 标题行**（第一行）→ **数据行**（每系列一行）。数据行固定两列：marker + 系列名左对齐、数值右对齐（flex justify-between），宽度以最长一行为准；**行序与图例一致**（声明序）、隐藏系列不出现；marker 跟随图例 marker 形态（复用 legend `markerSpecFor`/`renderMarker`，THS 按图表类型分形、Ainvest 统一圆形）；标题字色 `color-text-tooltip-title`、系列名 `color-text-tooltip-series`、数值 `color-text-tooltip-value`，字号 `font-size-tooltip`，数值字重 `font-weight-tooltip-value`（THS medium、Ainvest regular）；**数值格式与 Y 轴同源**（FORMAT-01 同一 `makeFormatter`；percent 堆叠显示原值——决定项）；**null 值显示 "-"**（与图上断口对应——决定项） | `core/tooltip.js` → `renderTooltipContent()` | ✅ |
| TOOLTIP-03 | 系列名过长换行三规则：① 数值 / marker **顶对齐系列名第一行**（不随多行高度居中）；② **只有系列名换行**，数值始终单行、贴右、不折行；③ 系列名悬挂缩进——marker 只在第一行左侧出现一次，第 2 行起左边缘对齐**第一行文字起点**（marker 独立列 + 文本自然换行实现） | `.dv-tooltip__row`（styles.css：flex-start + marker 独立列） | ✅ |

## 位置档（形态定义，主题映射见 TOOLTIP-07）

| ID | 档位 | 规则 | 实现 | 状态 |
|---|---|---|---|---|
| TOOLTIP-04 | **follow · 跟随式** | 默认显示在触发点**右下方**、连续跟随（**无半区反选规则**）；仅当右侧与容器碰撞放不下时自动翻到触发点左侧躲避；垂直不超出绘制区顶部 / 底部（clamp） | `core/tooltip.js` → `placeTooltip('follow')` | ✅ |
| TOOLTIP-05 | **top-anchor · 顶部锚定式** | 下三角 + 水平跟随触发点居中 + 垂直贴 grid 上沿外侧：① 三角尖端 x = 触发坐标 x（气泡贴不贴边都成立）；② 气泡底边 y = grid 上沿 − 三角高（与坐标 y 无关）；③ 水平边缘 clamp——气泡不越出容器，贴边时气泡停、三角继续随坐标偏移；④ 无过渡动画（瞬移跟随）；⑤ 气泡是临时遮罩物，不为它预留 grid 顶间距。三角高 6px 为兜底常量（本档专属形态） | `core/tooltip.js` → `placeTooltip('top-anchor')` + `ARROW_H` | ✅ |
| TOOLTIP-06 | **side-fixed · 两侧固定式** | 固定绘制区上方左 / 右两侧、离散两档：以**图表中点**为基准触发点反选——左半区触发 → 显示在右上角、右半区 → 左上角（永远在触发点对侧，不遮挡在看的数据）；垂直顶对齐绘制区上沿、不随鼠标纵移、不跟随插值 | `core/tooltip.js` → `placeTooltip('side-fixed')` | ✅ |
| TOOLTIP-07 | 主题 → 档位映射走 `tokens/behavior.json` `tooltip-position`：THS `side-fixed` · iFinD-PC `follow` · Ainvest `top-anchor`。特例（无坐标系图 → `follow`，THS 饼环 / Ainvest 无轴图）随饼环切片再消费 | behavior.json + `charts/charts/cartesian/index.js` | ✅ |
| TOOLTIP-12 | **浮层不被容器裁剪**：气泡是临时遮罩物，可**超出图表 frame 及任意祖先容器**显示——数据行多、气泡高过 grid 上方空间时向上溢出照常可见（top-anchor 尤其，TOOLTIP-05 ⑤ 不预留顶间距的自然结果），祖先 `overflow: hidden/auto`（如可缩放卡片容器）不得裁剪。实现：DOM 仍挂 plotHost（保 `data-theme` token 作用域与销毁清理），定位用 **`position: fixed` 视口坐标**——三档几何（TOOLTIP-04..06）仍在 plotHost 局部坐标计算、输出时叠加 plotHost 视口矩形；水平 clamp 语义不变（仍以图表容器为界） | `.dv-tooltip`（styles.css `position: fixed`）· `core/tooltip.js` → `place()` 末尾视口换算 | ✅ |

## 指示线与轴标签高亮

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| TOOLTIP-08 | X 轴竖指示线：hover 即出（默认开）、贯穿 grid 全高，并**向下延伸出绘图区至轴标签区**（连接被高亮的轴标签贴片）；线色 `color-visualization-highlight-line`、线型 `dash-highlight-line`（iFinD 虚线 3 3 特例，THS / Ainvest 实线 none）；**纯分组柱不画竖线、换 block 形态**（TOOLTIP-11） | `core/crosshair.js` → `renderCrosshairX()` · `.dv-crosshair-x` | ✅ |
| TOOLTIP-09 | X 轴标签高亮贴片（默认开）：当前类目标签处出现完整贴片（背景比文字大一圈）——文字**字号 / 行高 / 字重与轴标签同源**（`font-size-axis` / `line-height-axis` / `font-weight-axis`）、字色 `color-text-highlight-tick`、背景 `color-visualization-highlight-background-tick`、圆角 `radius-axis-label-tag`、左右内边距 `spacing-axis-label-tag-pad-h`（THS 1px / Ainvest 3px）、上下由行高撑；**即使该标签被碰撞策略隐藏也照常显示**（贴片以类目中心定位、独立于 AXIS-06 结果） | `core/crosshair.js` → `renderAxisTag()` · `.dv-axis-tag-*` | ✅ |

## 交互行为

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| TOOLTIP-10 | 三主题一致：**按 X 坐标最近类目触发**（鼠标移到该类目横向区间即触发，无需悬停在数据项上）；**无过渡动画**（不淡入淡出、瞬移跟随）；移出绘图区按 `tooltip-hide-delay` 延迟隐藏（THS / iFinD 2000ms、Ainvest 0）；**页面或任意祖先滚动容器发生滚动时立即隐藏完整 hover 状态**（气泡 / 指示线或 block / 轴贴片 / 唤出点同步清除，不走延迟），避免 `position:fixed` 气泡脱离已滚走的图表；自动隐藏默认开启（常驻显示则关闭延迟——待办）；hover 同时唤出当前类目**所有可见折线的数据点**——`.is-active` 压过 `points-muted` 静默、中心填充切白心 token（样式归 specs/line.md），且**唤出点层级压过 X 指示线**（副本层实现：仅这些点抬层，指示线与 mark 的相对层级不动） | `charts/charts/cartesian/hover.js`（`bindHover`：交互层 + 延迟 timer + scroll 收口 + 唤出点副本层） | ✅ |
| TOOLTIP-11 | **hover 指示形态特例：纯分组柱 → block**（判定按声明：全系列 `type:bar` + `stack:none` + ≥2 系列）：hover 时 X 指示**竖线（TOOLTIP-08）换成 block 底色带**——填充 `color-visualization-highlight-block`、以类目中心定位、**宽 = 分组柱容器宽**（`min(band, size-bar-group-container-max)`，与 BAR-02 布局同一容器；THS 无上限 → 整格）、贯穿 grid 全高；**层级在网格之上、mark 之下**（是底色不是遮罩，故不在 hover 顶层）；随 hover 切片移动、与气泡 / 贴片同一 timer 延迟隐藏（TOOLTIP-10）；轴标签贴片（TOOLTIP-09）照常显示、竖线不再绘制。**其余图型（单柱 / 堆叠 / 折线 / 组合 / 双 Y）维持竖线** | `core/crosshair.js` → `renderCrosshairBlock()` · `.dv-crosshair-block`（styles.css）· `cartesian/hover.js` `bindHover` 按 `indicator` 分发 · 判定 + block 层创建 `cartesian/index.js` | ✅ |

## 样式 token

气泡：`color-visualization-tooltip` · `color-text-tooltip-title/-series/-value` · `font-size-tooltip` ·
`font-family-tooltip` · `font-weight-tooltip-value` · `spacing-tooltip-pad` · `spacing-tooltip-row` ·
`spacing-tooltip-row-gap` · `radius-tooltip` · `size-tooltip-max-width`；iFinD 特例组
`color-visualization-tooltip-border` / `shadow-tooltip` / `color-visualization-tooltip-divider`。
指示线：`color-visualization-highlight-line` · `dash-highlight-line`。
指示 block（TOOLTIP-11 纯分组柱 hover）：`color-visualization-highlight-block`（明暗各一组，三主题同值）。
轴贴片：`color-visualization-highlight-background-tick` · `color-text-highlight-tick` ·
`radius-axis-label-tag` · `spacing-axis-label-tag-pad-h`。
行为：`tooltip-hide-delay`（值 token，L2 经 `tokenNum` 读取）· `tooltip-position`（behavior）。

## 占位待定值（源文档「待定」，预览校准后回填）

- iFinD：`font-weight-tooltip-value` 暂 regular · `color-visualization-tooltip-border` dark 暂同 light（#ECECF7）·
  `shadow-tooltip` 暂 `0 2px 8px rgba(0,0,0,0.15)` · `color-visualization-tooltip-divider` 暂同边框色 ·
  `spacing-axis-label-tag-pad-h` 暂 1px。
- 移动端气泡最大宽度 = 1/2 图表宽度（三主题一致、无 token）——移动端触摸切片一并落。

## 待办（后续切片）

- [ ] **Y 轴横向指示线 + Y 值徽标**：hover 水平线（可配置、默认关）+ 对应 Y 轴标签高亮徽标（样式与 TOOLTIP-09 同源、跟随鼠标 y 插值取值）；双轴 / 镜像轴的徽标侧归属一并定。
- [ ] **点击分片选中**：点击 → 类目 block 柱状高亮 `color-visualization-highlight-block`（选中态 + 展示该点其他数据表现），与 hover 指示线独立。
- [ ] **移动端触摸**：触摸点即触发点（档位形态两端一致）；气泡最大宽度切 1/2 图表宽度；touch 事件接线。
- [ ] **常驻显示（always-show）**：开启后关闭自动隐藏与延迟。
- [ ] **无坐标系图 → follow 档特例**（TOOLTIP-07）：THS 饼环 / Ainvest 无轴图，随饼环组件消费。
