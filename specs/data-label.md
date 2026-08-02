# 数据标签 data label · 规范（条目化索引）

> 权威源：原体系 `data-label.md`（位置策略 / 字号字体 / 颜色两档 / 默认显隐 / 隐藏规则以原文为准）+ 各图表篇的具体锚点。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：所有图表共用（柱 / 折线 / 折柱组合 / 堆叠及其延伸 / 饼 / 环；横条待各自骨架接入）。
> 饼 / 环的锚点与显隐口径在 [pie.md](pie.md) PIE-04，颜色与「放不下就不放」仍复用本页的 LABEL-04 / LABEL-06③。
> 分层：数据标签是 **L1 构件**（`core/label.js`，收「通用锚点数组」渲染文本 + 通用碰撞/对比度判定），
> **锚点几何与默认显隐由 L2 计算**（`charts/cartesian/index.js`）——位置策略逐图表不同，属图表专属计算。
>
> **主题分化只有字号一项**（LABEL-02）：位置策略、颜色、默认显隐、隐藏规则三主题完全一致，
> 故 `behavior.json` **没有也不应有**数据标签形态键。

## 排布与字体

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LABEL-01 | **位置策略**：通用原则 = 避开问答核心数据，**正值放图形上方、负值放下方**。逐图表锚点由 L2 算：**柱** = 柱顶外侧（正上 / 负下，柱中心水平居中）· **普通堆叠** = 段内垂直居中 · **折线** = 数据点正上方（类目中心）。空间不足时按 LABEL-06 隐藏，不做挤压位移。<br>**净距 `spacing-data-label-gap` 一律从图元边缘算起、不是从锚点值算起**：柱量到柱顶边；**折线量到数据点外缘**——要额外让开点的半高，否则 4px 净距会被点本身吃掉（THS 点直径 6px → 只剩 1px，视觉贴死）。点半高：circle = `size-line-point`/2；diamond（iFinD，正方形绕中心转 45°）= `size-line-point` × √2/2 | `charts/cartesian/index.js`（`labelGap` / `linePointH`）；`core/label.js` → `renderDataLabels` | ✅ |
| LABEL-02 | **字体三件套**：`font-family-number` + `font-weight-data-label`（= `font-weight-medium`，三主题同）+ **`font-size-data-label`——全篇唯一主题分化项**：THS / Ainvest `font-size-xxs`（10px）、iFinD-PC `font-size-extra-small`（12px）。数字等宽 `tabular-nums` 与轴标签同源 | `tokens/*.json §21`；`charts/styles.css` → `.dv-data-label` | ✅ |

## 颜色（两档，与主题无关）

> 判定顺序：先看该标签是否落在色块内 —— 落在图形外空白区走档①，压在填充上走档②。

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LABEL-03 | **档① · 图形外空白区**（柱顶上方 / 折点上方，不压任何填充）：**跟随该系列的图形色**。经所在 `<g>` 的 `color: var(--dv-series-i)` + `fill: currentColor` 取色，**不走 `color-text-*` token**——系列色是色板色（`tokens/palette.json`），见 [color.md](color.md) 与 WORKFLOW 铁律1 | `charts/cartesian/index.js`（`<g>` 上写 `--dv-series-i`）；`.dv-data-label` | ✅ |
| LABEL-04 | **档② · 落在色块内**（堆叠段内居中等）：按**局部背景对比度自动切换**——浅底深字 / 深底浅字。判据 = 该段系列色 hex 的 **WCAG 相对亮度**（sRGB 逆伽马 + 0.2126/0.7152/0.0722 加权），阈值取**黑白前景的对比度交叉点 √(1.05×0.05) − 0.05 ≈ 0.179**——**不是直觉的 0.5**：0.5 会把 `#52BBFF` 一类浅色系列判成深底、配浅色文字只剩约 2:1 对比。hex 由 L2 从 `resolveSeriesColors` 结果透传，修饰类 `--on-light` / `--on-dark` 承载，JS 内无色值字面量。<br>**两个前景 token 恒定、不随明暗模式翻转**（`color-text-data-label-on-light` = 各主题浅色模式的正文墨色定值 / `-on-dark` = `color-text-inverse-primary`，后者本就无明暗分叉）：标签的底是**系列色**不是页面底色，直接用会翻转的 `color-text-primary` 会让暗色模式下的浅色系列（如 iFinD `#F2D755`）拿到白字 → 白底白字 | `core/label.js` → `labelTone(hex)`；`tokens/*.json §21`；`.dv-data-label--on-light/-on-dark` | ✅ |

## 显隐

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LABEL-05 | **默认显隐（`dataLabel:'auto'`）**：原则 = **只在「一个类目对一个值」时默认出标签**，一格里挤多个数字既读不清也遮图形。<br>**柱**：仅**单柱系列**（声明 1 个 `bar` 系列，含折柱组合里的唯一柱）显示；**分组柱**（≥2 柱系列）、**普通堆叠**、**归一化堆叠**一律**不显示**。<br>**折线**：仅**纯折线且单条**显示；**多折线**不显示；**折柱组合里的折线不显示**——有柱在场时标签让给柱。<br>**饼 / 环**：**一律不显示**。这是上述原则的**明确例外**——扇区确实是「一个类目一个值」，但占比已由扇形面积本身表达、名称由图例承载，扇区内再压一层数字属冗余；且环宽有限（THS 28px），默认开等于默认在窄环里塞一批随时会被 LABEL-06③ 判掉的数字。<br>`dataLabel:true` 全开（分组 / 堆叠也画，仍受 LABEL-06 三条约束）、`false` 全关——开关是**语义配置**（同 `zoom`），不是样式参数 | `charts/cartesian/index.js` → `showBarLabel` / `showLineLabel`；`charts/pie/index.js` → `showLabel` | ✅ |
| LABEL-06 | **隐藏规则**（三条，先后独立）：① **密度阈值（柱与线统一）**：某系列在**当前可见窗口**内的非 null 值 > 5 → 该系列标签**整体不出**（不是挑着显示）。**全端统一**，取代原文「移动端计数 / Web 碰撞」的端分叉，与 [line.md](line.md) 数据点 >13 的处理同一先例；缩放后窗口内 ≤5 会重新出现（口径同 SCALE-02）。**本条只对有类目轴的图成立**——阈值 5 是按「一个类目占多宽」定的经验值，对扇区没有对应含义，故饼 / 环不套用，改由 ③ 的几何判定收口（[pie.md](pie.md) PIE-04）；② 未触发 ① 时按**渲染级测量**做水平碰撞过滤——同一行内相邻净距 < `spacing-data-label-min-gap` 则丢后者、**首个恒留**（贪心，结果与遍历顺序无关地稳定）；③ **放不下就不放**（两个方向，均不缩字号不外移）：段高 < `line-height-data-label` → 不出；**文本宽 > 所在色块宽（`maxWidth`）→ 不出**——档② 的字一旦横向溢出色块，溢出部分落到画布底色上（浅底白字 / 深底黑字）直接看不见，比不画更糟。THS 柱宽上限仅 16px，长数值下堆叠段内标签自然全隐属预期 | `core/label.js` → `dropOversized()` / `dropCollisions()` + `renderDataLabels`（一次测量供两道过滤共用）；`charts/cartesian/index.js`（① 与段高判定） | ✅ |
| LABEL-07 | **0 值与空值**：`0` **正常显示「0」**（不特殊处理、不省略）；`null` **不出标签**（与 mark 不画图元一致）。数值格式**复用 [format.md](format.md) FORMAT-01 的 `makeFormatter()`**，与轴标签 / tooltip 同一份格式化；归一化堆叠强开时走百分比格式 | `core/format.js` → `makeFormatter()`；`charts/cartesian/index.js` | ✅ |
| LABEL-08 | **层级与命中**：标签层在**所有 mark 之后、水印之前**追加（本仓库层级 = DOM 追加顺序，同 [watermark.md](watermark.md) WATERMARK-05）——压在柱 / 线之上不被遮，又在水印之下。`.dv-data-label { pointer-events:none }` 永不抢命中，hover / tooltip 不受影响；图例隐藏的系列不出标签（L2 取的就是可见系列） | `charts/cartesian/index.js` → `build()` 末段；`charts/styles.css` | ✅ |

## 活 demo

`playground/preview.html`（右栏 **数据标签** 旋钮 = `dataLabel` 三态）：

- **默认**：基础柱带柱顶标签（色 = 系列色，负值在柱下方、0 显示「0」、null 无标签）；分组柱 / 堆叠 / 归一堆叠无标签；单折线有、多折线无；「折柱组合 · 单柱 + 线」只有柱有（对照两柱的组合分类，柱也没有）。
- **数据量**拖到 中16 / 多36 → 柱与线的标签**都整体消失**（LABEL-06①）；开缩放轴把窗口收到 ≤5 个类目又会回来。
- **全开**：分组柱各柱头都有；堆叠段内居中、深浅段自动反色（Ainvest 32px 柱放得下，THS 16px 柱按 LABEL-06③ 全隐）；归一堆叠出百分比。
- 三主题切换可见字号差（THS / Ainvest 10px vs iFinD-PC 12px），明暗切换验证档② 的两个前景色不随模式翻转。

## Do / Don't

- ✅ **Do**：改字号 / 间距 = 改 `tokens/*.json §21`（三主题同步，合同校验会拦）；改位置策略 = 改对应 L2 的锚点计算并更新 LABEL-01；新骨架（饼 / 环 / 横条）接入 = 各自 L2 算锚点后调同一个 `renderDataLabels`。
- ❌ **Don't**：给 `label.js` 写 `if (theme === …)`（主题分化只有字号，且走值 token）；为数据标签往 `behavior.json` 加形态键；在 JS / CSS 里写标签色值字面量（档① 走 `currentColor`、档② 走 `color-text-*`）；把碰撞过滤复制进 L2（通用规则在 L1 内置）；为放下标签而缩字号或位移（规则是隐藏）。

## API

`CartesianChart(host, { dataLabel })` —— `'auto'`（默认，按 LABEL-05 的图表类型默认）/ `true`（全开）/ `false`（全关）。
显隐是语义配置，样式（字号 / 颜色 / 间距）一律走 token，API 不收。

## 待办

- [ ] **顶部空间预留**（合并 [line.md](line.md) 的「图与数据标签最大占画布高 95%」）：`SCALE-03` 明确**不预加呼吸空间**，数据圆整时占比可达 100%（如 hi=400 / 4 段 → interval=100 → 轴顶=400），此时柱顶标签越过 grid 顶沿——当前靠 `.dv-chart__plot > svg { overflow:visible }` 画进卡片留白，未显式留位。
- [ ] `spacing-data-label-gap` / `spacing-data-label-min-gap` **暂定 4px**：原体系未给净距数值，待设计确认后改 token（三主题同步）。
- [ ] **跨系列碰撞**：LABEL-06② 的一次调用 = 一个系列跨类目（同一行），故**同一类目内相邻系列**的标签不参与彼此的碰撞判定。默认显隐下分组柱不出标签、遇不到；仅 `dataLabel:true` 强开分组柱时可见相邻柱头数字贴近。要覆盖需把同组多系列并进一次调用（届时补 LABEL-06④）。
- [ ] **饼 / 环外侧标签 + 引线**（`color-text-primary` + 引线跟随扇区色，见 [color.md](color.md)）：`PieChart` 已落地，
      但**当前走的是扇区内档②**（[pie.md](pie.md) PIE-04）。改成设计源写的外侧形态需要三样东西：一档新的前景色
      （现只有档① 跟随系列色 / 档② 按底色反色）、引线图元与其样式、以及左右分栏的纵向避让算法——整块留作下一刀。
- [ ] 横向条形图右侧标签（`size-hbar-data-label-max` 40px 已备好）——待 HBar 骨架。
- [ ] 移动端触碰 / hover / 选中态下的标签高亮与临时显形（原体系未定，随 tooltip 选中切片一并明确）。
