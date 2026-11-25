# 财报预期对比点 earnings · 规范（条目化索引）

> 权威源：Figma「高密度 Design System」`Compact 图表/预期对比点 Earnings Point`（3325:66435），规则参照 F10 EPS 每股收益。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 分层：状态判定、颜色语义与图元渲染是 **L1 构件**（`core/earnings-point.js`）；直角坐标系以系列 `type: 'earnings'` 接入
> （`charts/cartesian/index.js` / `hover.js`）；X 轴副标题文案由 L3 示例按状态生成（[axes.md](axes.md) AXIS-09）。

## 图元与状态

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| EARNINGS-01 | **一个点位 = 预期环 + 实际点**。数据项 `{ actual, estimate }`。预期环以**预期值的 y** 为圆心：外径 20（`size-earnings-estimate`）、**内描边** 1.5（`size-earnings-estimate-stroke`，半径收进半个描边，外径恰为 20）、色 = **色板「其他」色**（`palette.json` 的 `bar-multi.other`：Ainvest 亮 `#858585` / 暗 `#7A7A7A`；主题未声明 other 时回落 `color-grey-05`），由 L2 经 `resolveOtherColor` 取色、写成容器上的 `--dv-earnings-estimate`，无填充。Figma 变量 `color-visualization-08` 为 `#808080`，与「其他」色亮色差 5 级，按色板统一、不另立 token。实际点以**实际值的 y** 为圆心、直径 16（`size-earnings-actual`）。两者各按自己的值定位，上下偏移由数据自然形成，不写固定偏移。**尺寸沿用 Default，紧凑密度不缩小**（`density.json` 不覆盖这几项）。Y 值域并入实际值与预期值（`domain.js`），刻度照常（5 条、含 0，0 在区间内才画 0 轴——`niceSplit` 恒含 0，故恒画） | `core/earnings-point.js` → `renderEarningsPoints`；`core/palette.js` → `resolveOtherColor`；`tokens/*.json`；`charts/cartesian/domain.js` | ✅ |
| EARNINGS-02 | **状态由数据决定**（`earningsState`）：实际 > 预期 = 超预期 `beat`；实际 = 预期 = 符合 `met`（判等容差 1e-9，防浮点噪声）；实际 < 预期 = 未达预期 `missed`；只有预期 = 待公布 `pending`；只有实际 = 无预期 `unrated`；两者都没有 = 该类目不画 | `core/earnings-point.js` → `earningsState` | ✅ |
| EARNINGS-03 | **实际点颜色**：超预期 / 符合 → `color-price-up`（超预期点在环上方、符合与环同心——由数值自然形成）；未达预期 → `color-price-down`（点在环下方）；无预期 → 系列色（单系列 = palette `single-default`）。状态 → 颜色语义（`up` / `down` / `muted`）只在 `earningsTone` 一处，副标题 / tooltip 差值都从这里取 | `core/earnings-point.js` → `earningsTone`；`charts/styles/earnings.css` | ✅ |
| EARNINGS-04 | **待公布**：只画预期环，环内填 `color-foreground-layer1`（盖住穿过环心的网格线）；环上方 4px（`spacing-earnings-label-gap`）标预期值，10 / 12 SemiBold（`font-size` / `line-height` / `font-weight-earnings-label`）、`color-text-secondary`。文字在 12px 行框内上下居中，行框底边离环外沿 = 4（同 AXIS-04 的排字口径） | `core/earnings-point.js`；`charts/styles/earnings.css` | ✅ |

## 层级、图例与交互

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| EARNINGS-05 | **层级**：实际点在预期环之上（两个 `<g>`，环先建）；整组画在 **0 轴之后**（压在 0 轴上）、数据标签之前，与柱 / 线同属数据图元层。不参与入场生长（点没有「长出来」的方向），首帧即终态。<br>**图例**拆两项，可分别显隐 / 弱化：**Actual** 的颜色按全量数据的状态构成定（`earningsLegendTone`）——有超预期 / 符合 / 无预期的点 → 涨色；有实际点且全部未达预期 → 跌色；完全没有预期数据（或一个实际点都没有）→ 系列色。**Estimate** 用空心环 marker（`ring`），色同预期环（`--dv-earnings-estimate`）。marker 尺寸沿用本主题图例（紧凑 6）。行名（Actual / Estimate / 差值）由配置 `labels` 给，组件不留缺省文案，缺了报错 | `charts/cartesian/index.js`；`core/legend.js` → `markerSpecFor('earnings-estimate')` / `renderMarker('ring')`；`charts/cartesian/series.js` | ✅ |
| EARNINGS-06 | **tooltip**：按类目切片（TOOLTIP-10），财报系列展开成 **Actual / Estimate / 差值** 三行。Actual 行 marker 按**该类目**的状态上色（与图例口径不同：图例看全量构成）；缺值显示「-」。差值 = 实际 − 预期，只在两者都有时出，带正负号（符合显示 0），**数值颜色随状态**（`valueTone` → `.dv-tooltip__value--up/down`）。数值精度走配置 `decimals`（EPS 两位） | `charts/cartesian/hover.js` → `earningsRows`；`core/tooltip.js`（`valueTone`） | ✅ |
| EARNINGS-07 | **X 轴副标题文案**（L3 生成，经 AXIS-09 上色）：超预期 Beat（up）· 符合 Met（up）· 未达预期 Missed（down）· 待公布 Upcoming 或公布日期（muted）· 无预期「--」（muted）。中文主题写「超预期 / 符合 / 未达预期 / 待公布」，Ainvest 经 `chart-presentation.js` 词表转英文。三段式碰撞规则照常适用：8 个标签放得下就全部显示 | `demos/data/earnings.js`；`demos/chart-presentation.js` | ✅ |
| EARNINGS-08 | **不出网格**：预期环、实际点与待公布标签都必须落在首末网格线之内。点位在值坐标之外的像素占用由 `earningsPadding` 给出——上下各一个预期环半径（10），有待公布点时上方再加「间距 4 + 标签行高 12」。**顶部**：与数据标签共用 SCALE-03 的呼吸位（`headroom` = 像素占用 ÷ 绘图区高，取两者较大者），刻度因此不顶格。**底部**：刻度恒含 0（SCALE-01），全正数据的下界被 0 卡住、`headroom` 管不到；故最低点（含半径）若会掉出末条网格线，就把值域下界扩到「最低值 − 半径对应的值」再算一次刻度——数据贴近 0 时轴上会多出一段负值刻度，这是不出界的唯一办法 | `core/earnings-point.js` → `earningsPadding`；`charts/cartesian/index.js`（呼吸位与下界扩展） | ✅ |
| EARNINGS-09 | **异常情况**（设计稿「异常情况 01–04」，只取规则）：<br>① **没有任何预期数据**：实际点全部用系列色（蓝），图例 Actual 同为系列色（EARNINGS-05）；Estimate 图例照常保留；副标题全是「--」。<br>② **某季度既无实际也无预期**：不画点，副标题照写「--」（不留空）。<br>③ **缺值的读数**：tooltip 中缺失的 Actual / Estimate 写「--」，与副标题同一记号；无差值时不出差值行。<br>④ **含负值**：照常按 SCALE-01 取整、0 轴保留（如 -0.5…1.5）——财报图不放开「0 恒在刻度上」。<br>⑤ **值全为 0**：没有可取整的跨度，0 放在垂直正中，上下各一条网格线、**只标 0**（不出 0~某间隔的整套刻度，那读起来像「有数据、只是很小」）；仅在图中全部系列都是财报点时生效。<br>⑥ **全部未达预期**：图例 Actual 变跌色；有超预期 / 符合时为涨色（EARNINGS-05，规则不变）。<br>playground「数据场景」的「全 0」按 ⑤ 的设计稿构造（实际全 0、无预期） | `charts/cartesian/hover.js`（「--」）；`charts/cartesian/index.js`（全 0 刻度：网格画 [-1, 0, 1]、标签只标 0）；`demos/data/earnings.js`（副标题）；`demos/scenarios.js`（全 0） | ✅ |

## 活 demo

- 示例 `eps-estimate`（分类「财报预期」）：8 个季度，五种状态俱全，最后一季待公布。按 Ainvest 紧凑档设计——
  首页选 Ainvest 主题 +「版式 · 紧凑」；playground 看「Ainvest · 紧凑」卡。
- 验收点：五种状态的点位与颜色；副标题颜色（Beat / Met 涨色、Missed 跌色、Upcoming / -- 次要色）；
  图例 Actual 为涨色（本数据有超预期）、Estimate 为灰色空心环；hover 时 tooltip 三行、差值随状态上色。

## 待办

- [ ] `color-foreground-layer1` 的**暗色值**未从设计稿取到（Figma 变量只读出亮色 `#FFFFFF`），暂定暗色 `#1A1A1A`，待设计确认
- [ ] Figma 的预期环色变量 `color-visualization-08`（`#808080`）待设计改指到色板「其他」色（代码已按「其他」色实现）
- [ ] Figma 中 `color-price-up` 为 `#009B67`，仓库 Ainvest 现为 `#00B53C`，待确认以哪个为准
