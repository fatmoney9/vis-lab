# 缩放轴 datazoom · 规范（条目化索引）

> 权威源：原体系 `datazoom.md`（尺寸 / 对齐 / 手柄 / 轨道 A-B-C-D / 提示 / 交互的形态表述以原文为准）。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：所有 x/y 轴坐标图表（柱、折线及延伸图表）需要范围缩放导航时。
> 分层：datazoom 是 **L1 构件**（`core/datazoom.js`，画轨道/阴影/手柄 + emit 窗口变化），
> **窗口切片与 Y 轴重算由 L2 执行**（`charts/cartesian/index.js`）；联动数学沿用 [axes.md](axes.md) 的 **SCALE-02**。
>
> ⚠️ **手柄不加载 SVG 图片资源**：原体系把手柄做成生产级 `.svg` 直接加载；本仓库渲染层就是原生 SVG、
> 颜色全走 token（WORKFLOW §二/§四 铁律1），故手柄由 `core/datazoom.js` 用 `<rect>/<circle>/<line>`
> **代码现画**（见 DATAZOOM-03）。形态参数在 `behavior.json`、颜色在 `tokens/*.json §13`。

## 尺寸与布局

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| DATAZOOM-01 | **宽 = 绘制区宽、与网格 / X 轴对齐**：取 `frame.grid` 左右沿——inside 布局网格铺满画布故 = 容器宽；**outside 不含 Y 标签列宽与其 8px 间距**（`createFrame` 已把它们扣进 `pad`，`grid.width` 天然不含）。**高 = `size-slider-height`**（THS 24 / iFinD 16 / Ainvest 4），非主题分化。缩放带位于 **X 标签带下方**（`frame.navTop`），带高 `navH = 6 + max(轨道高, 手柄高) + 6` 由 L2 预留，上下各留 6px。**绘图 SVG `overflow:visible`**：贴边手柄的居中描边外半 + 投影会溢出无标签侧的视口边，放行渲染进卡片内边距、不被切平 | `core/frame.js` → `createFrame({navH})`（返回 `navTop/navBottom`）；L2 算 `navH`；`.dv-chart__plot > svg { overflow: visible }` | ✅ |

## 滑块对齐（DATAZOOM-02）与手柄形态（DATAZOOM-03）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| DATAZOOM-02 | **手柄对齐主题分化**：`center` = 手柄中心贴窗口边界（THS / iFinD，中段跨越边界）；`edge` = 手柄内缘贴边界、整只落窗口内侧，全窗时贴齐绘制区左右两端（**Ainvest**）。<br>**center 对齐时轨道有效宽 = 绘制区宽 − 一个手柄宽**（左右各内缩半个手柄），使手柄中心贴边界时整只落在轨道内、不溢出；edge 对齐用满宽 | `tokens/behavior.json` → `datazoom-align`；`core/datazoom.js` → `pad`/`handleX()` | ✅ |
| DATAZOOM-03 | **手柄代码现画（非 SVG 资源）**：形态取 `behavior.datazoom-handle` = `{shape, w, h, r?, grip:{n,h,gap}}`。THS 24×24 圆角方（`radius-slider-handle`=6）· iFinD 16×16 圆角方（品牌填充）· Ainvest **32 圆**（白/深底）。grip = **n 根等距竖条**（中心间距 gap、竖条高 h、粗细 1.5 结构常量）：THS 3 条·高 8、iFinD 1 条·高 8、Ainvest 3 条·高 10。填充 `color-datazoom-handle`、描边色 `-handle-border`、**描边宽 `size-slider-handle-border`**（THS 0.5 / iFinD·Ainvest 1）、grip 色 `-handle-grip`、**投影 `shadow-datazoom-handle`**（仅 Ainvest = `drop-shadow(0 0 8px 000/8%)`，THS·iFinD `none`；经 CSS `filter`）（三主题 §13，明暗各一组）。⚠️ iFinD 原体系缺 SVG——现画不受阻 | `tokens/behavior.json` → `datazoom-handle`；`tokens/*.json §13`；`core/datazoom.js` → `drawHandle()`；`.dv-datazoom-handle/-grip` | ✅ |

## 轨道数据区（DATAZOOM-04）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| DATAZOOM-04 | 四区（色走 §13 token）：**A 背景** `color-background-weak`（全轨）· **B 未选中数据** `datazoom-data-bg`（整条迷你阴影）· **C 选区填充** `datazoom-filler`（窗口）· **D 选中数据** `datazoom-data-select`（窗口内阴影描亮，裁剪叠加）。**是否画数据阴影主题分化**：THS / iFinD `datazoom-data-shadow:true`（双色 B+D）；**Ainvest false**——纯轨道，只有 A + C（`showDataShadow:false`，无 B / D）。迷你阴影 = 每类目取**可见系列 `|值|` 包络**缩放进轨道高（L2 算 `shadowVals` 传入，L1 不依赖 domain.js）。**数据阴影裁进圆角轨道内**（外层 group clip 圆角轨道形 + D 再叠窗口矩形 clip）——趋势不溢出 mask 圆角 | `tokens/behavior.json` → `datazoom-data-shadow`；`tokens/*.json §13`；`core/datazoom.js`；`.dv-datazoom-bg/-data/-data-select/-filler` | ✅ |

## 提示文本与交互

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| DATAZOOM-05 | **提示文本（滑块侧标签）主题分化**：**仅 iFinD-PC 渲染**（`datazoom-label:true`），在两手柄**外侧**显示起 / 终类目；**THS / Ainvest 不渲染**；**移动端一律不渲染**。**非常显**——默认隐藏，**hover 缩放轴或拖动时才显示**（CSS：`.dv-datazoom:hover` / 拖动期间 plotHost 挂 `.dz-dragging`，跨重绘存活）。与手柄**固定 8px 间距、不夹取**（贴边时靠 SVG `overflow:visible` 溢出渲染，间距恒定不塌陷） | `tokens/behavior.json` → `datazoom-label`；`core/datazoom.js`（渲染 + `.dz-dragging` 开关）；`.dv-datazoom-label` / `.dv-datazoom:hover` | ✅ |
| DATAZOOM-06 | **交互**：拖左 / 右手柄改窗口对应边界；拖选区（filler）整窗平移、保持宽度；点击轨道空处 → 窗口整体跳到点击类目（保持宽度）后可继续拖动。像素↔类目吸附整数索引；**仅吸附后的窗口整数变化才回调**（省重绘、免抖动）。指针映射用持久锚点 `plotHost` 矩形 + 起拖几何，window 级 pointermove/up 存活于整图重绘之上 | `core/datazoom.js`（`onChange`）；L2 `onChange:(w)=>{win=w; build();}` | ✅ |
| DATAZOOM-07 | **联动（引用 [axes.md](axes.md) SCALE-02）**：窗口变 → 主图**只渲染窗口内类目 / 数据** → Y 轴按可见值域重算 `niceSplit`（分割线数不变）、X 标签碰撞 AXIS-06 重判、outside 列宽 AXIS-08 即时调整。缩放轴本体始终拿**全量**数据画迷你阴影 | `charts/cartesian/index.js` → `build()` 顶部 `viewCats/viewResolved` 切片，下游全用切片 | ✅ |

## 活 demo

`playground/cartesian-preview.html` 右栏「缩放轴 开/关」：开启给图表挂 `zoom:{start:0.35,end:1}`（初始窗口后 65% 类目）。
三主题横向对比：THS/iFinD 轨道内双色迷你阴影、Ainvest 纯轨道；数据量「中 16 / 多 36」下窗口 + Y 轴联动最明显。

## Do / Don't

- ✅ **Do**：形态（对齐 / 手柄 / 是否阴影）改 `behavior.json`；颜色 / 尺寸改 `tokens/*.json §13`；组件按 ID 现画。
- ❌ **Don't**：在组件源码 / CSS 写色值字面量（铁律1）；给 API 加样式参数（铁律4）；在 demo 手绘缩放轴（铁律3）；
  引入 `.svg` 图片资源当手柄（破坏 token 链路、明暗需多份、iFinD 缺图）。

## API

`CartesianChart(host, { …, zoom })`——`zoom` 是**语义配置**（WORKFLOW §四 铁律4 允许 `initialZoom` 一类），不暴露样式：

| 取值 | 含义 |
|---|---|
| 省略 / 假值 | 不启用缩放轴，布局与原状逐像素一致 |
| `true` | 启用，初始全窗 |
| `{ start, end }` | 启用，初始窗口 = `[start, end]`（0..1 比例，映射到类目整数窗口） |

样式 / 形态一律来自主题：`datazoom-align` / `datazoom-data-shadow` / `datazoom-handle`（behavior）+ §13 值 token。

## 样式 token（§13 缩放轴 Axes Navigator）

尺寸 `size-slider-height` · 手柄圆角 `radius-slider-handle` · 选区圆角 `radius-slider-mask` ·
轨道背景 `color-background-weak` · 未选中数据 `color-datazoom-data-bg` ·
选区填充 `color-datazoom-filler` · 选中数据 `color-datazoom-data-select` ·
手柄填充 `color-datazoom-handle` · 手柄描边色 `-handle-border` · 手柄描边宽 `size-slider-handle-border` · grip 色 `-handle-grip` · 手柄投影 `shadow-datazoom-handle`。

## 待办

- [ ] 提示文本贴近画布两端时的溢出/截断（DATAZOOM-05 现为**固定 8px 间距 + SVG overflow:visible**、不再夹取；极端贴边时标签可能溢出卡片，文字截断未做）
- [ ] `navH` 上下留白（现 **6 / 6**）与 frame.js X 带间距（现 4）一并 token 化（见 axes.md 待办）
- [ ] iFinD 手柄尺寸原体系「待核定」（现取 16，behavior 可调）；Ainvest 已按原体系 **32** 对齐
