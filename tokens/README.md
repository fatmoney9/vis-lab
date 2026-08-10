# Design Tokens

`tokens/` 是图表主题值和主题行为配置的权威数据源。

## 文件分类

- `ths.json`：THS 主题的完整值 token；
- `ifind-pc.json`：iFinD-PC 主题的完整值 token；
- `ainvest.json`：Ainvest 主题的完整值 token；
- `behavior.json`：需要参与几何计算或逻辑分支的主题形态与行为配置。

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
