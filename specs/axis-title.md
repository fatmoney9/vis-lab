# 轴标题 axis title · 规范（条目化索引）

> 权威源：原体系 `axis-title.md`（默认显隐 / 位置 / 对齐 / 样式取值以原文为准，本页记录两处偏差）。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：所有 x/y 轴坐标图表。轴标题**属坐标轴体系的一部分**——轴标签 / 刻度线 / Y 轴内外布局
> 见 [axes.md](axes.md)，本页只管标题本身（形态 + 样式 + 显隐都在这里，不在别处复述）。
> 分层：轴标题是 **L1 构件**（`core/axis-title.js` 带高/锚点纯几何 + 渲染；`core/frame.js` 预留标题带），
> **文案由调用方给、哪根轴出标题由 L2 判定**（`charts/cartesian/index.js`）。
>
> **默认不显示**（AXISTITLE-01）：不给文案就没有标题，带高为 0、几何与改动前逐像素一致。
> **形态无主题分化**（带结构、跟随侧、对齐口径三主题一致），故 `behavior.json` **没有也不应有**
> 轴标题形态键（同 [data-label.md](data-label.md) 的判断）。**样式则完全复用 Y 轴标签那一套**——色 / 字号 /
> 行高 / 字重逐一别名到 `*-axis` 同名 token，主题 × 端 × 明暗的分叉全部由轴标签自带（AXISTITLE-05）。

## 显隐与 API

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| AXISTITLE-01 | **默认不显示**——主题默认没有轴标题，仅在需要标注轴含义（单位 / 量纲 / 时间口径）时启用。API 收 `axisTitle: { y, y2, x }` 三个**可选文案**，**各自独立显隐**：给了文案该轴才出标题，三者互不牵连。文案是**内容不是样式**（同 `zoom` / `dataLabel` 一类语义配置，WORKFLOW 铁律4）；字号 / 颜色 / 间距一律走 token，API 不收。<br>**边界**：图表标题 / 卡片标题不属本组件（在 L3 外壳里），本页只管轴标题 | `charts/cartesian/index.js`（`axisTitle` 解构与归一化） | ✅ |

## 位置与带结构

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| AXISTITLE-02 | **各自成带，不侵占图表内布局**：Y 标题在 **Y 轴标签带上方**另起一带、X 标题在 **X 标签带下方**另起一带（同 AXIS-04「X 标签自成容器带」的思路）。**带高 = `line-height-axis-title` + 上下各一份 `spacing-axis-title-gap`**（4px + 行高 + 4px，上下对称）；**无标题即带高 0**。<br>容器高度口径同缩放轴带（DATAZOOM-01）：**未给容器高度时**图表高度包络（GRID-03）不变、SVG 整体变高；**容器定高时**绘图区让出带高。<br>纵向顺序：`Y 标题带 → Y 标签带/绘图区 → X 标签带 → X 标题带 → 缩放轴带`（缩放轴恒在最下） | `core/axis-title.js` → `axisTitleBand()`；`core/frame.js` → `createFrame()` 的 `titleTopH` / `titleBottomH` | ✅ |
| AXISTITLE-03 | **跟随各自的轴**：Y 标题在**主 Y 轴那一侧**（THS / iFinD-PC 左、Ainvest 右，随 AXIS-02 的 `y-main-side`）；`y2` 在**反侧**，且**仅真·双量纲（声明了 `axis:'secondary'`）时出**——iFinD 的镜像模式（`y-dual-shared && !dual`）反侧只是主轴同一套刻度的镜像、不是第二根轴，故不出 `y2`。X 标题在**右侧**（最新数据一端） | `charts/cartesian/index.js`（`ySide` / `oppSide` / `showY2Title`） | ✅ |
| AXISTITLE-04 | **对齐：标题贴自己那一侧的画布外缘**，三主题一律如此，口径只由「轴在哪一侧」决定：<br>· **左侧轴 → 左对齐画布左缘**（`x=0`，`text-anchor: start`）<br>· **右侧轴 → 右对齐画布右缘**（`x=frame.width`，`text-anchor: end`）<br>双 Y 时主副各贴一侧（`y` 在 `y-main-side`、`y2` 在反侧），天然分踞两端。<br>**不依赖** Y 标签布局（inside/outside）、`y-label-align` 特例或最长标签宽——故轴标题**不参与** AXIS-08 的列宽测量。<br>**为什么不按原设计稿的「以最长轴标签为准右对齐」**：左侧轴上那条右沿距画布左缘只有一个标签列宽（`inside` 尤其窄，如 THS 的「24万」仅 26px），标题一旦比最长标签宽，左端就顶成负数、跑出 SVG 视口被裁（实测 THS 越界 21px、iFinD 越界 1px）。贴外缘则**标题多长都不会被裁**。<br>X 标题右对齐**绘图区右缘** `grid.right`（X 标签带的横向范围就是 grid，AXIS-05），它向左延展、不存在裁切问题 | `core/axis-title.js` → `axisTitleAnchor()` | ✅ |

## 样式 token

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| AXISTITLE-05 | **轴标题与 Y 轴标签共用同一套文字样式规则**——四个 token 逐一别名到轴标签的对应项，标题侧不另立取值：<br>· 颜色 `color-text-axis-title` = `{color-text-axis}`<br>· 字号 `font-size-axis-title` = `{font-size-axis}`<br>· 行高 `line-height-axis-title` = `{line-height-axis}`（标题带高随之，AXISTITLE-02）<br>· 字重 `font-weight-axis-title` = `{font-weight-axis}`<br>于是**主题 × 端 × 明暗的全部分叉都由轴标签那一套自带**（如 Ainvest 颜色的 mobile/pc × light/dark 四角、THS 字号的端分叉、iFinD 的 14px 不分端），别名一行即整套继承：**改轴标签样式，标题自动跟着改**，这正是「同一套规则」的落点。仅间距 `spacing-axis-title-gap`（`spacing-4`）是标题自己的，因为轴标签没有对应项。<br>**唯一不跟的是字体**：轴标签走 `font-family-number` + `tabular-nums`（为数值等宽），标题是**文案不是数值**，故走 `font-family-cn`（与图例文本同源）——THS 的 `font-family-number` 是金融数字字体，中文标题落它身上会掉回退字体。<br>保留 `*-axis-title` 这组语义名（而非 CSS 里直接写 `--font-size-axis`）：将来若标题真要与标签分家，改 token 一行即可，组件与 CSS 不动（同 §21 数据标签的别名先例） | `tokens/*.json §22`；`charts/styles.css` → `.dv-axis-title` | ✅ |

## 隐藏规则

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| AXISTITLE-06 | **放不下就不放**（同 LABEL-06③ 先例，不缩字号 / 不换行 / 不裁字）：`y` 与 `y2` 共处同一条顶部标题带、分踞两端，渲染级测量后两者净距 < `spacing-axis-title-gap` → **副轴标题不出**（主轴优先，与"颜色跟随实体"同理：谁是主轴由声明定，不随窗口宽度跳变）。X 标题独占自己的带，不参与该判定 | `core/axis-title.js` → `renderAxisTitles()` | ✅ |

## 与原体系文档的偏差（本仓库取值）

1. **上下间距 2px → 4px**：原文写「上下间距 默认 2px」，本仓库取**上下各 4px**（`spacing-4`，带高 = 4 + 行高 + 4）。
   2px 在 12px 行高的标题下贴得过死，且与 X 标签带既有的 4px 上下间距（AXIS-04）不成体系；统一到 4px 后
   标题带与标签带的呼吸一致。改回只需改 token（三主题同步）。
2. **补 `y2` 副轴标题**：原文只写了 Y / X 两个标题。本仓库已有真实双 Y 图表（[bar.md](bar.md) BAR-07 /
   [axes.md](axes.md) SCALE-04），副轴同样需要标注量纲，故补 `y2`（规则见 AXISTITLE-03/06）。
3. **对齐改为「贴所在侧的画布外缘」**（AXISTITLE-04）：原文写「对齐 | 与最长的轴标签为准，**右对齐**」。
   照此实现后**左侧轴标题会被裁**：那条右沿距画布左缘只有一个标签列宽，标题比最长标签宽就顶成负数
   （实测 THS `inside` 越界 21px、iFinD `outside` 越界 1px；`overflow:visible` 只能把它画进卡片内边距，
   边距用完即裁）。改为**左侧轴左对齐画布左缘、右侧轴右对齐画布右缘**后，标题多长都不会被裁，
   且口径不再依赖 `inside/outside`、`y-label-align` 与标签宽——三主题同一套。
4. **样式改为复用轴标签那一套**（AXISTITLE-05）：原文明确写「轴标题**未复用**轴标签语义 token
   （`font-size-axis` 等），因为 `font-size-axis` 在 iFinD 的取值与轴标题不同，故走通用刻度 token
   （移动端 `font-size-xxs` / PC `font-size-extra-small`）」。本仓库**反过来取**：标题的色 / 字号 / 行高 / 字重
   全部别名到轴标签同名项——标题与它标注的那根轴同气质，是更强的一致性；主题 × 端 × 明暗的分叉也不必在
   标题侧重抄一遍。**代价是接受各主题轴标签的既有取值**：iFinD-PC 标题 12px → **14px**（其 `font-size-axis`
   不分端，移动端同样 14px）、Ainvest PC 12px → **11px**、THS 不变（10 / 12px）。
   若某主题的标题字号确需与其轴标签脱钩，改 `font-size-axis-title` 的别名即可，代码不动。

## 活 demo

`playground/cartesian-preview.html` 与 `index.html` 的 **轴标题** 旋钮（`axisTitle` 开 / 关）：

- **关**（默认）：三主题与不带标题时逐像素一致——零回归的验收点。
- **开**：`基础柱状图` 一次看全三种对齐口径——THS `inside`（标题右沿贴最长 Y 标签末端）、
  iFinD-PC `outside` 左列、Ainvest `outside` 右列 + 全部右对齐；X 标题在 X 标签带下方、右对齐绘图区右缘。
- `折柱组合 · 双 Y`：THS / Ainvest 反侧出 `y2`（增速），**iFinD-PC 不出**——它的反侧是镜像不是第二根轴（AXISTITLE-03）。
- **标题与同卡片的 Y 轴标签逐项同款**（AXISTITLE-05）——三主题横排时最直观：色、字号、行高、字重都一致
  （iFinD-PC 标题与其 `#87879C` / 14px 标签同款、Ainvest PC 与其纯黑 / 11px 标签同款）；端切移动端时
  THS / Ainvest 的标题跟着标签一起缩到 10px、Ainvest 的色同时转成 60% 灰，而 iFinD 的标签字号本就不分端、
  标题也就不变；明暗切换两者一起翻；开缩放轴看 X 标题带与缩放轴带的上下顺序。

## Do / Don't

- ✅ **Do**：改字号 / 颜色 / 间距 = 改 `tokens/*.json §22`（三主题同步，合同校验会拦）；
  新骨架（横向条形 / K 线）接入 = 各自 L2 算好带高与锚点后调同一个 `renderAxisTitles`。
- ❌ **Don't**：给 `axis-title.js` 写 `if (theme === …)`（形态无主题分化）；为轴标题往 `behavior.json` 加形态键；
  把标题画进绘图区内部（它自成带、不侵占图表内布局）；给 API 加字号 / 颜色 / 位置参数（样式走 token）；
  为放下 `y2` 而缩字号或换行（规则是隐藏）。

## API

`CartesianChart(host, { axisTitle })` —— `{ y, y2, x }` 三个可选字符串，缺省不显示。
`y2` 仅在声明了副轴（`axis:'secondary'`）的图表上生效。

## 待办

- [ ] 移动端与窄容器下 X 标题与最右侧 X 标签的**横向**关系：当前 X 标题独占一带、不与 X 标签同行，
      故无碰撞；若将来改回同行方案需补一条让位规则。
- [ ] 竖排 / 旋转 90° 的 Y 轴标题（部分产品的"单位"写法）——原体系未定，暂不支持。
- [ ] 轴标题的 hover / 点击（如点单位切换量纲）——交互未定义，当前 `pointer-events` 随默认。
