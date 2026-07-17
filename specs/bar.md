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
| BAR-02 | **分组排布**（`stack:none` 多柱系列，图表专属计算，留 L2）：band 内 n 根等分、组居中；柱宽不超 `size-bar-max`，系列间距 `size-bar-group-inner-gap-max`。**隐藏系列槽位保留**（位置稳定、不重排，配合 COLOR-04） | `charts/cartesian.js`（分组偏移计算） | ✅ |
| BAR-03 | **单系列**：柱居中于 band，宽 = `min(band, size-bar-max)` | `charts/cartesian.js` | ✅ |
| BAR-05 | **堆叠**（`stack:normal`）：每类目**单列**（band 不分组，宽 `min(band, size-bar-max)` 居中）；各系列段从上一段**累计基线**长起，**正值向上累计、负值向下累计**（分开）；段**直角**（圆角只给基础/分组柱）；**0 不占位、null 跳过**（1px 占位是基础柱专属）；值域 = 堆叠总高（`niceSplit(min负累计, max正累计)`）。**隐藏系列按可见重算**（段闭合、轴 refit，与非堆叠的稳定轴不同） | `core/mark.js` 的 `base` 参数 + `charts/cartesian.js` → `stackData()` | ✅ |
| BAR-06 | **归一化堆叠**（`stack:percent`）：每类目缩放到 **100%**（占比 = `v / 类目正值和`，**假设正值**）；Y 轴固定 **0–100%**、百分比格式；其余同 BAR-05 | `charts/cartesian.js` → `stackData()` + `pctFormat` | ✅ |

## 配色与交互

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| BAR-04 | 系列配色按 **COLOR** 规范固定槽位（[color.md](color.md)，L2 写 `--dv-series-i`）；**hover 弱化**其他系列（LEGEND-05，分组 `<g>` opacity=`opacity-visualization-dim`）；**点击显隐**（LEGEND-06，隐藏系列不画其 `<g>`，Y 轴 v1 用全声明系列的稳定轴不重算） | `charts/cartesian.js`（复用 legend.js 的 `renderLegend` / `applyToggle`） | ✅ v1 |

## 样式 token

柱最大宽 `size-bar-max` · 单柱容器上限 `size-bar-container-max` · 圆角 `radius-bar-top` ·
0 值占位 `size-zero-bar-placeholder` · 分组容器上限 `size-bar-group-container-max` ·
分组内间距 `size-bar-group-inner-gap-max` · 柱:gap 比 `size-bar-bar-gap-ratio`。
系列色见 [color.md](color.md)（不是值 token）。

## 待办

- [x] **堆叠 + 归一化**（`stack: normal / percent`）→ BAR-05 / BAR-06。
- [ ] **归一化正负混合**：BAR-06 当前假设正值（负值按 0 计入占比）；真正正负混合的归一化语义待定。
- [ ] **v3 折柱组合 + 双 Y**（`type: line` + `axis: secondary`）：折线 / 点 mark（`core/mark.js` 扩展）+ `niceSplitDual`（SCALE-04 已就绪）+ COLOR-05 柱线子序列。
- [ ] **横向柱状图 HBar** 独立组件（类目轴、`size-hbar-*`）。
- [ ] `size-bar-bar-gap-ratio`（2:1）与 `size-bar-group-inner-gap-max` 的精确取舍（当前用固定内间距）；`size-bar-group-container-max` / `size-bar-container-max` 上限接入。
- [ ] 堆叠段圆角：当前一律直角；是否给「整根堆叠的最外端」加圆角待定。
- [x] 隐藏系列时 Y 轴：**非堆叠**用全声明的稳定轴；**堆叠**按可见系列重算 refit。
