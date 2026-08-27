# Design Tokens

`tokens/` 是图表主题值和主题行为配置的权威数据源。

## 文件分类

- `ths.json`：THS 主题的完整值 token；
- `ifind-pc.json`：iFinD-PC 主题的完整值 token；
- `ainvest.json`：Ainvest 主题的完整值 token；
- `behavior.json`：需要参与几何计算或逻辑分支的主题形态与行为配置；
- `palette.json`：系列色板（`bar-multi` / `line-multi` / `pie-multi` / `single-default` 等），由取色器
  `charts/core/palette.js` 消费写入 `--dv-series-N`，见 `specs/color.md`；
- `sankey.json`：**桑基专属**几何、数字字体链、播放时长与三主题语义色。它不参与 `build.mjs`
  构建，由 `charts/charts/sankey/style.js` 运行时直接 fetch 并自校验——是本目录唯一一条
  不走「JSON → tokens.css → CSS 变量」链路的通道。其中的语义色计划迁入各主题文件（届时可用
  `{color-price-up}` 一类别名，见 `specs/sankey.md` 待办）；几何与播放参数是图表常量，仍留本文件；
- `ths.json` / `ifind-pc.json` / `ainvest.json` 的 Treemap 分节保存变体高度、主题差异、布局阈值与
  透明度阶梯；通用字体、间距、圆角、反白文字和涨跌色直接复用前置公共 token；
- `build.mjs` → `tokens.css`：构建脚本与其生成物。`tokens.css` **是生成文件，不要手改**。

## 值 Token

值 token 包括颜色、字体、字号、行高、字重、间距、尺寸、圆角、透明度和动效时长等浏览器可以直接消费的值。

三份主题 JSON 必须覆盖同一套 token key。构建器负责将它们转换为作用域化的 CSS 自定义属性，组件通过以下方式消费：

```css
.dv-legend-label {
  color: var(--color-text-legend);
  font-size: var(--font-size-legend);
}
```

## 支持的值形态

```json
{
  "plain-value": "12px",
  "mode-value": { "light": "#000", "dark": "#fff" },
  "platform-value": { "mobile": "10px", "pc": "12px" },
  "alias-value": "{font-weight-medium}"
}
```

- 字符串或数字：所有端和颜色模式共用；
- `{light, dark}`：颜色模式分叉；
- `{mobile, pc}`：终端分叉，内部还可以嵌套明暗分叉；
- `"{token-name}"`：语义别名，构建后输出为 `var(--token-name)`。

## 圆角阶梯

三个主题共用以下基础圆角阶梯：

```text
radius-0 / 1 / 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16
radius-full = 50%
```

组件应优先使用语义 token，并由语义 token 引用基础阶梯，例如 `radius-tooltip: "{radius-4}"`。这样可以保留组件语义，同时避免重复维护相同的圆角字面量。

## 间距阶梯

三个主题共用以下基础间距阶梯：

```text
spacing-0 / 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24
```

组件应继续使用带有具体用途的语义 token，例如 `spacing-legend-item-h`，并由它引用对应的基础阶梯，例如 `"{spacing-12}"`。

## 作用域约定

- `data-theme="ths|ifind-pc|ainvest"`：业务主题；
- `data-platform="pc|mobile"`：终端；
- `data-mode="light|dark"`：颜色模式；
- 默认组合：THS + PC + Light。

## 行为配置

`behavior.json` 保存不适合放入 CSS 变量的配置，例如图例 marker 形态、坐标轴位置、碰撞策略和选择模式。它们由 `charts/core/theme.js` 解析，再作为参数传给组件。

## 图表类型分类

图表专用 token 按用途分段排列：

- `Bar`：普通纵向柱状图；
- `Grouped Bar`：分组柱状图；
- `Line`：折线图；
- `HBar`：横向柱状图；
- `Donut`：环形图（`PieChart` 的两种形态共用这组：饼图复用 `size-donut-radius` 作外半径、内半径取 0，
  `size-donut-ring-width` 不参与；饼图是否需要独立尺寸见 [specs/pie.md](../specs/pie.md) 待办）。
  **尺寸按主题分化**：THS / iFinD-PC `70 / 28`、Ainvest `80 / 32`（环宽:半径比都是 0.4）。
  `size-donut-hover-expand` 是强调态外扩量（仅 Ainvest `10px`，另两主题 `0px` —— 0 即天然无形态，
  组件无需按主题分支，同 `radius-bar-top` 的先例）。
  **外侧标签的引线**（[specs/pie.md](../specs/pie.md) PIE-12/13）另有三项：`size-donut-label-line-radial`
  是自外半径沿法线外延到肘点的长度（THS / iFinD-PC `8px`、**Ainvest `16px`**，设计源给定）；
  `size-donut-label-line-lateral` 是肘点之后横段的基准长——**当前取与法线段等长是推断、非设计原意**
  （见 pie.md 待办），独立成 key 就是为了将来只动 JSON；`spacing-donut-label-gap`（三主题 `8px`）
  是引线末端到文字的净距。另有 `size-donut-label-band-max`（**三主题同为 `120px`**）＝ 每侧标签带
  的绝对上限：带宽两侧恒等（PIE-13，为的是圆心不偏离画布中心），故一条超长文本会把两侧一起撑宽，
  必须封顶，否则环被挤成小圆点。**不按主题分化**——它约束的是版面纪律而非主题观感。
  引线**线宽不设自有 token**，复用全库细线宽 `size-grid-line`。
  **外侧标签的两段排版**（[specs/pie.md](../specs/pie.md) PIE-15）另有四个键：
  `font-size-donut-label-name` / `line-height-donut-label-name` 与
  `font-size-donut-label-value` / `line-height-donut-label-value`——
  **THS 两段同为 12/16**、**Ainvest 名称 12/16 数值 14/18**（数值是读数，给更大的字重心）、
  **iFinD-PC 设计源未给值，四键别名回通用 `font-size-data-label` / `line-height-data-label` = 行为不变**。
  独立于通用标签字号是必需的：那个键全库共用（柱/线/饼共一个），改它会连柱线一起改。
  第五个键 `font-weight-donut-label-name`（三主题同为 `{font-weight-regular}`）同理：
  通用的 `font-weight-data-label` 三主题都是 medium，那是为**数值**定的，名称是正文、跟着会偏重
  （同色同字号下 500 比 400 多约 30% 墨量，看上去就是「颜色更深」）。
  **数值段不另开字重键**——它的字重恰好就是共用的那个 medium，再开一个只是纯别名。
  ⚠️ 行高两键**不进 CSS**——SVG `<text>` 不吃 `line-height`，它们是给 JS 读去算标签块高与碰撞区间的。
  两段是同行还是上下两行属**形态**，走 `behavior.json` 的 `pie-label-form`，不在本文件；
- 绘图区、网格线和引导线等跨图表值归入“图表公共”分类；
- 滑块高度、把手和选区圆角归入“缩放轴 Axes Navigator”；
- `size-legend-label-max`（三主题 `120px`）＝ 纵向单列图例的标签宽上限，超出省略号截断
  （[specs/legend.md](../specs/legend.md) LEGEND-13）。取固定值而非容器派生：图例宽参与「图 + 间距 + 图例」
  整组居中的布局计算，容器派生会让它随容器抖动；
- `Data Label`：数据标签（字号、档② 的两个前景色与净距）。**饼环外侧标签不用这里的字号**，
  它有自己的四个键（见上面 Donut 段与 PIE-15）；**档③ 不在此**——
  它直接用通用文字色、不另设 key：名称段 `color-text-secondary`、数值段 `color-text-primary`
  （[specs/data-label.md](../specs/data-label.md) LABEL-09）；
  `spacing-data-label-min-gap` 同时服务水平与垂直两个方向（LABEL-06②）；
- `Axis Title`：轴标题（色 / 字号 / 行高 / 字重均别名到轴标签同名项，仅带内间距自有）；
- `Motion`：动效。入场生长时长 `motion-duration-grow`（全站统一、三主题同值，MOTION-02）与
  交互强调时长 `motion-duration-emphasis`（三主题 200ms，用于饼环扇区外扩等**即时应答**类动效——
  刻意远短于入场，见 [specs/pie.md](../specs/pie.md) PIE-11）。缓动曲线不在此——`cubic-bezier` 的四个系数
  无法经 `tokenNum` 解析，作为规范值常量留在 `charts/core/motion.js`（见 [specs/motion.md](../specs/motion.md) MOTION-03）。

## Treemap token 溯源审查

2026-08-24 对原 Treemap 分节的 28 个 key 逐项复核。基线来源为《矩形树图规范文档（持续更新）20230309》；
AInvest 差异来源为 Figma《AInvest矩形树图规范》节点 `0:232`。审查结果是：18 个保留在 Treemap 分节，
5 个提升为 L1 公共 token，5 个因不属于主题视觉值而删除。

| key | 处理 | 来源与语义 |
|---|---|---|
| `size-treemap-entry-height` | 删除 | 高度是实例容器几何，由宿主容器决定；容器没给高时退到三族共用的 `size-chart-region-height`。（曾短暂迁到 L3 `regionHeight`，2026-08-26 一并清除——高度模型改为「容器决定」后它再无消费方。） |
| `size-treemap-local-height` | 删除 | 同上：组件恒消费实际容器高度，缺高时退到 `size-chart-region-height`。 |
| `size-treemap-overall-height` | 删除 | 基线规定整体类型高度自适应，故不设 token。原 320 / 383px 验收高曾降为 L3 `regionHeight`，现已一并清除（见上）。 |
| `size-treemap-gap` / `radius-treemap-canvas` | 保留 | 基线为 2px / 4px；AInvest Figma 图面实例为 1px / 6px，主题差异真实存在。 |
| `size-treemap-value-font-deviation` | 保留 | 它是公式中的差值，不是最终字号：THS / iFinD 为“名称适配字号 − 2px”；AInvest 原稿没有减小逻辑，故为“名称适配字号 − 0px”。 |
| `font-size-treemap-entry-label-{name\|value}{-min}` | 保留 | 基线文本入口名称 / 数值固定 12px；AInvest 图片内容名称 28→11px、数值 20→11px。 |
| `font-size-treemap-local-label-{name\|value}{-min}` | 保留 | 基线名称 12→8px、数值 12→6px；AInvest 图片内容名称 28→11px、数值 20→11px。 |
| `font-size-treemap-overall-label-{name\|value}{-min}` | 保留 | 基线名称 16→8px、数值 14→6px；AInvest 图片内容名称 28→11px、数值 20→11px。 |
| `font-weight-treemap-name` | 保留语义别名 | 基线文本主题使用 regular；AInvest 的 semibold 直接别名到已有 `font-weight-bold = 600`，不再制造同值的 `font-weight-semibold`。数值继续复用公共 `font-weight-data-label = medium`。 |
| `size-treemap-content-image-{max\|min}` | 保留 | AInvest Figma 明示图片 64→12px；缺图时“圆形页面一级背景 + 企业名称首字母”占用同一尺寸槽位。键集合为三主题同构；`content=text` 的主题不会消费它。 |
| `opacity-visualization-intensity-level-1..5` | 移出 Treemap 分节并收窄命名 | 55% / 65% / 75% / 85% / 100% 来自基线强度阶梯，仅供 L1 `intensity` 强度模式消费，不能伪装成 Treemap 私有值；语义色不再叠加该透明度。 |
| `ratio-visualization-semantic-bin-1/2` | 删除 | AInvest Figma 只说明区间可配置，未规定全产品统一阈值；阈值属于数据业务口径，改由 `colorThresholds` 传入。演示值 `[1, 2]` 只复现 Figma 范围条示例。 |

公共颜色分节使用 `color-price-{up|down}-gradient-1..3` 与 `color-price-even-gradient` 保存语义模式的
最终颜色，core 只选档，不再另写 `fill-opacity`。THS 三档将基线五档透明度阶梯等距投影为
100% / 75% / 55%（端点 + 中点）：1 档别名基础涨跌色，2 / 3 档直接保存带 alpha 的 RGBA；
AInvest 不走透明度近似，直接保存 Figma 的完整 light / dark 色值；iFinD 当前 `color-mode=series`，
未启用语义分档，等设计源补齐前各档只别名基础涨跌色。`semantic-flat` 固定消费 1 档。

构建器除合同、分叉和别名校验外，还校验值域：`opacity-*` 的最终叶值必须位于 0..1；
`color-*` 只接受本仓库支持的 hex、`rgb(a)`、颜色关键字或 token 别名。非法值在生成 CSS 前即失败，
避免浏览器静默忽略后才在视觉验收中暴露。

## 修改要求

- 不要直接修改自动生成的 CSS 产物，应修改本目录的 JSON 权威源并重新构建；
- `$meta` 与 `$section-*` 是说明性元数据；构建器和 token 合同校验必须忽略所有以 `$` 开头的顶层字段；
- 新增值 token 时，必须同时补齐三个主题；
- 新增行为键时，也必须保证所有主题覆盖相同的键集合；
- 系列色板由图表层按主题、图表类型和系列数量选择，不作为普通组件 token 处理；
- 构建器应拒绝缺失 key、非法分叉、悬空别名和循环别名。

## 待办

- [ ] **切主题必须触发重渲染，不能只改属性。** 值 token（颜色/字号/间距等）随 `data-theme` / `data-platform` / `data-mode` 属性变化经 CSS 级联自动更新；但 marker 的 `by-type`/`unified` 模式与 `w/h/r`、图例选择行为等来自 `behavior.json` 的**形态**是 JS/SVG 计算出来的，**不会**随属性自动更新。主题切换应由 Frame（`charts/core/`）提供统一入口：先改属性、再触发图表重渲，否则会出现“颜色已切、marker 仍是旧主题几何”。当前尚无主题切换器，落地 Frame 时遵守。
- [ ] **端 / 明暗目前是双通道开关。** 值 token 走 `data-platform` / `data-mode` 属性，而 behavior 形态仍走 `resolveBehavior(host, platform)` 的 JS 参数（明暗尚未接入 behavior）。可让 `theme.js` 也从 `host.closest('[data-platform]')` / `[data-mode]` 读取，真正“共用一个开关”。
- [ ] **是否输出 `:root` 兜底待定。** 目前一切 token 只在 `[data-theme=…]` 作用域下定义，未挂主题的元素拿不到值（有意让其显式暴露而非静默套用 THS）。若需“无属性时回落到默认主题”，给 `build.mjs` 增发一个 `:root = THS / PC / Light` 块。
