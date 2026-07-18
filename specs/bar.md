# 柱状图 · 规范（条目化索引）

> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：**纵向柱系图表**（基础柱 / 分组 / 堆叠 / 归一化 / 折柱组合）。横向柱状图（HBar）
> 因类目轴逻辑与数值 Y 轴两套，**单独一篇 + 单独组件**，后续再做。
>
> 柱系变体不按名字分体，而是三个旋钮的组合（见 `CartesianChart` API）：
> **① `stack`**（none / normal / percent，作用于 bar 系列）· **② 每系列 `type`**（bar / line，混用=折柱组合）·
> **③ 每系列 `axis`**（primary / secondary，双 Y）。v1 覆盖 ①=none（基础+分组）、②全 bar、③单 Y。

## 图元标记（柱 mark）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| BAR-01 | 柱渲染：**`null` 跳过**（断口，不画）· **`0` → `size-zero-bar-placeholder`（1px）** 贴基线细线 · 正值从 0 基线**向上**、负值**向下** · 圆角 `radius-bar-top`（**仅远离基线的一端**：正值圆顶、负值圆底；THS=2、iFinD/Ainvest=0）· 填充 = 系列色（`currentColor`） | `core/mark.js` → `renderBars()`；`.dv-bar`（styles.css） | ✅ |

## 排布

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| BAR-02 | **分组排布**（`stack:none` 多柱系列，图表专属计算，留 L2）：x 走 `slot` 模式（band = 整格 step、**组间距最小 0**，同 BAR-03；组间距 = `step − 组内容` 为残量，数据少→容器封顶组间距变大、数据多→容器缩小组间距=0）。柱在 `container = min(step, size-bar-group-container-max)` 内、整组回 step 居中。柱宽上限 `size-bar-max`、柱间距上限 `size-bar-group-inner-gap-max`；**放不下时柱与间距按同一比例等比缩小**（恒保持 `size-bar-max : size-bar-group-inner-gap-max`，如 32:2；间距只在柱顶到 `size-bar-max` 时才是满值 2px，柱多则同比变窄）。**容器内左右留白**（`size-bar-group-gap-ratio`）：Ainvest `2:1`——内容块(柱+柱间距) : 两侧留白总和 = 2:1，内容块只占 container 的 2/3、进一步压小柱与间距（例：2 柱各 32 + 间距 2 = 66 内容块 → 两侧留白 33 → container 99）；THS/iFinD `0`——不留侧白、内容块铺满 container。**整组宽受 `size-bar-group-container-max` 上限**：iFinD/Ainvest `100px`（band 宽于它时组不铺满），**THS `none`=不设上限**（`size-bar-max` 仅 16px、组自然窄，无需封顶；代码将 none/非正值读作 `Infinity`）。**隐藏系列按可见重排**：槽位按当前可见柱数重算，剩余柱整组重新居中（宽度仍受上述双上限约束）。系列色由固定 `--dv-series-i` 决定、与可见性无关，故颜色不重排（COLOR-04 仍成立） | `charts/charts/cartesian/index.js`（可见过滤 + 读 token）+ `layout.js`（groupedBars(…, containerMax)） | ✅ |
| BAR-03 | **单系列（基础单柱）**：x 走 `slot` 模式（band = 整格 step、格间距最小 0，见 `bandX`）。**容器** = `min(step, size-bar-container-max)` = 「柱 + 左右侧白」；柱:两侧留白 = `size-bar-gap-ratio`（三主题 `2:1`）→ 柱占容器 2/3、再受 `size-bar-max` 封顶。**数据少**：step 大 → 容器封顶 `container-max`、柱满宽（`container-max·2/3 = size-bar-max` 恒成立：THS 24·2/3=16、iFinD/Ainvest 48·2/3=32），格间距 = step−容器 随之变大；**数据多**：step < `container-max` → 容器缩小、格间距=0、柱按 2:1 等比收缩保侧白（如 THS step=20 → 柱 13.3）。`ratio=0` 退化为 `min(step, size-bar-max)` | `charts/charts/cartesian/layout.js` → `singleBar()` + `core/scale.js` `bandX(mode:'slot')` | ✅ |
| BAR-05 | **堆叠**（`stack:normal`）：每类目**单列**（band 不分组，几何同基础单柱 `singleBar`——container 内留侧白 + `size-bar-max` 封顶、窄 band 等比收缩，见 BAR-03；所有系列段共用这一 `{offset,width}` 居中）；各系列段从上一段**累计基线**长起，**正值向上累计、负值向下累计**（分开）；**段间直角**，只有**整根堆叠的最外端**才圆角（沿用 BAR-01「远离基线端」：每类目正向**最上段**顶圆角、负向**最下段**底圆角；`radius-bar-top` → THS=2、iFinD/Ainvest=0，故仅 THS 可见；`stackBars` 逐类目算 `caps` 布尔喂 `renderBars(capped)`）；**0 不占位、null 跳过**（1px 占位是基础柱专属）；值域 = 堆叠总高（`niceSplit(min负累计, max正累计)`）。**隐藏系列按可见重算**（段闭合、轴 refit、caps 随可见段重定，与非堆叠的稳定轴不同） | `core/mark.js` 的 `base`/`capped` 参数 + `charts/charts/cartesian/layout.js` → `stackBars()` | ✅ |
| BAR-06 | **归一化堆叠**（`stack:percent`）：每类目缩放到 **100%**（占比 = `v / 类目正值和`，**假设正值**）；Y 轴固定 **0–100%**、百分比格式；其余同 BAR-05 | `charts/charts/cartesian/layout.js` `stackBars()` + `index.js` `pctFormat` | ✅ |

## 配色与交互

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| BAR-04 | 系列配色按 **COLOR** 规范固定槽位（[color.md](color.md)，L2 写 `--dv-series-i`）；**hover 弱化**其他系列（LEGEND-05，系列 `<g>` opacity=`opacity-visualization-dim`）；**点击显隐**（LEGEND-06，隐藏系列不画其 `<g>`） | `charts/charts/cartesian/index.js`（复用 legend.js 的 `renderLegend` / `applyToggle`） | ✅ |
| BAR-07 | **折柱组合**（`type` 混用 + `axis` 绑定）：柱、折线同图；柱走 band 内分组、折线走类目中心叠加（[line.md](line.md) LINE-01）；柱线**分色板、禁交叉**（COLOR-05）。多量纲用**双 Y**——每系列 `axis: primary/secondary`，两轴 `niceSplitDual` 共享刻度 + 0 对齐（AXIS-02/SCALE-04），主轴在 `y-main-side`、副轴反侧。图例按各系列真实 type 显柱 / 线 marker（LEGEND-03） | `charts/charts/cartesian/index.js`（按 axis→type 双重分区）+ `core/mark.js` `renderLine` | ✅ 主测 stack:none |

## 样式 token

柱最大宽 `size-bar-max` · 单柱容器上限 `size-bar-container-max` + 单柱留白比 `size-bar-gap-ratio`（柱:两侧留白，三主题 `2:1`；`0`=不留侧白） · 圆角 `radius-bar-top` ·
0 值占位 `size-zero-bar-placeholder` · 分组容器上限 `size-bar-group-container-max`（iFinD/Ainvest `100px`；THS `none`=无上限）·
分组柱间距上限 `size-bar-group-inner-gap-max`（柱与间距同比缩小、仅柱顶到 `size-bar-max` 时取满值）· 容器内左右留白比 `size-bar-group-gap-ratio`（内容块:两侧留白=Ainvest `2:1`；THS/iFinD `0`=不留侧白）。
系列色见 [color.md](color.md)（不是值 token）。

## 待办

- [x] **堆叠 + 归一化**（`stack: normal / percent`）→ BAR-05 / BAR-06。
- [ ] **归一化正负混合**：BAR-06 当前假设正值（负值按 0 计入占比）；真正正负混合的归一化语义待定。
- [x] **折柱组合 + 双 Y**（`type: line` + `axis: secondary`）→ BAR-07 + [line.md](line.md)。主测 `stack:none`；`percent + 组合`、per-轴 unit（% 后缀）、折线数据点密度隐藏/数据标签见各篇待办。
- [ ] **横向柱状图 HBar** 独立组件（类目轴、`size-hbar-*`）。
- [x] `size-bar-group-container-max` 上限接入（groupedBars 受限区域 + band 内居中）→ BAR-02。
- [x] 分组柱间距改为**柱与间距同比缩小**（间距上限 `size-bar-group-inner-gap-max`，仅柱顶到 `size-bar-max` 时取满值）；容器内左右留白比接入 `size-bar-group-gap-ratio`：内容块(柱+间距) : 两侧留白 = Ainvest `2:1`（内容块占 container 的 2/3）、THS/iFinD `0`（不留侧白）→ BAR-02。
- [x] `size-bar-container-max`（单柱容器）+ 新增 `size-bar-gap-ratio`（柱:两侧留白，三主题 `2:1`）接入：**基础单柱 + 堆叠单列**在 container 内留侧白居中、窄 band 等比收缩（宽/常规 band 因 `container-max·2/3 = bar-max` 仍满宽、视觉同旧）→ BAR-03/05 `singleBar()`。分组柱（≥2 声明）仍走 `size-bar-group-*`，隐藏到 1 根不切单柱容器。
- [x] 堆叠段圆角：**段间直角**，只给「整根堆叠的最外端」圆角（正向最上段顶 / 负向最下段底，沿用 BAR-01 远离基线端 `radius-bar-top`，仅 THS=2 可见）→ BAR-05。
- [x] 隐藏系列时 Y 轴：**非堆叠**用全声明的稳定轴；**堆叠**按可见系列重算 refit。
