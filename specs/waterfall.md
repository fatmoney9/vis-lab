# 瀑布图 · 规范（条目化索引）

> 设计源：[Ainvest 瀑布图规范（Figma，node 135:2840）](https://www.figma.com/design/Uv36h0PXzZG7ZhuHBHQ3qz/AInvest%E7%9F%A9%E5%BD%A2%E6%A0%91%E5%9B%BE%E8%A7%84%E8%8C%83?node-id=135-2840)；[交互态（node 135:2986）](https://www.figma.com/design/Uv36h0PXzZG7ZhuHBHQ3qz/AInvest%E7%9F%A9%E5%BD%A2%E6%A0%91%E5%9B%BE%E8%A7%84%E8%8C%83?node-id=135-2986)。
> 本页是仓库内规则 ID 的唯一权威；Figma 决定视觉与交互，L1 通用规范仍分别回引 axes / tooltip / motion / watermark。

## 规则

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| WATERFALL-01 | 数据声明序即叙事顺序。每项显式声明 `kind: total \| delta \| subtotal`；正负号表达对累计值的贡献方向，渲染器不按名称猜业务含义。 | `charts/charts/waterfall/model.js` → `resolveWaterfall()` | ✅ |
| WATERFALL-02 | 累计公式：`delta.end = previous.end + delta.value`；`total/subtotal` 从 0 画到当前累计值，且值必须与前序累计结果一致。配置不守恒时立即报错，不画一张数学关系错误的图。 | `model.js` → `resolveWaterfall()` | ✅ |
| WATERFALL-03 | 常规柱最大宽 64px；按「柱 : 间距 = 2 : 1」随槽宽缩小，单柱容器封顶 96px；四角直角。 | `geometry.js` → `WATERFALL_SETTINGS` / `waterfallBarWidth()` | ✅ |
| WATERFALL-04 | `variant:'data'` 为数据柱：宽度固定 110px；一项可含多个 `segments`，段按声明序在该项区间内累计，段有符号和值必须等于项值。每段之间不另留缝。 | `model.js`；`index.js` | ✅ |
| WATERFALL-05 | 相邻项必须用连接线串联，连接高度 = 前一项累计终点；连接线位于柱后、从前柱右缘延伸到后柱左缘。 | `index.js`；`charts/styles.css` | ✅ |
| WATERFALL-06 | 不显示 Y 轴标签与常规网格，只保留加深的 0 轴；比例尺仍覆盖所有区间端点并由 `niceSplit` 留出标签呼吸位。Y 标签虽然不渲染，X 标签带仍读取主题 `y-label-form`，与柱状图使用同一套 AXIS-04 纵向口径：`inside` 从 0 轴留 4px，`outside` 先避让半个轴行盒再留 4px；常态标签与点击贴片因此在同主题下等距。 | `tokens/behavior.json`；`core/frame.js`；`core/split.js` / `scale.js` / `grid.js`；`index.js` | ✅ |
| WATERFALL-07 | 常规柱数值标签必显并位于柱的上边界之外；可选百分比使用 10px 语义色徽标。数据柱标签放在段内，段高小于 36px 时整段标签隐藏。 | `geometry.js`；`render.js`；`index.js` | ✅ |
| WATERFALL-08 | 百分比不参与累计数学，只是附加读数；柱上徽标正负分别使用涨 / 跌语义色。Tooltip 数据看板中数值与涨幅必须合成单一 value，形如 `7.8B(5%)` / `1.2亿(5%)`，不拆成额外字段或列。合并读数允许本族 Tooltip 突破通用 160px 上限按内容自然扩宽，极端长度以视口两侧 `spacing-24` 安全边距封顶；名称仍按 TOOLTIP-03 换行，值不换行、两列不得重叠。 | `index.js`；`core/tooltip.js`；`charts/styles.css` | ✅ |
| WATERFALL-09 | Ainvest 增减项使用主题独占箭头柱：20% 浅底、从累计起点指向终点的箭头、起点侧 2px 端线；像素高 ≤4px 时只隐藏箭头，浅底和端线仍保留。THS / iFinD 回退为实心增减柱、无箭头。 | `tokens/behavior.json`；`tokens/*.json`；`index.js` | ✅ |
| WATERFALL-10 | 颜色模式是语义配置：`primary` 全部使用主题单系列主色；`semantic` 中增减项 / 中间汇总按有符号值取涨跌色，首末总计仍为主色。两套验收面按 Figma 只提供“主色 / 语义色”两档并默认主色；L2 被外部直接调用且未传时仍按主题 profile 兼容兜底：Ainvest 为 primary，THS / iFinD 为 semantic。 | `behavior.json`；`core/palette.js` / `visual-color.js`；`index.js`；`demos/examples.js` | ✅ |
| WATERFALL-11 | 时间标题占独立 22px 带，右对齐；绘图区默认高度继续由主题 `size-chart-region-height` 决定（Ainvest 200px），容器明确给高时跟随容器。 | `core/frame.js`；`index.js` | ✅ |
| WATERFALL-12 | X 轴是完整的等式叙事区，不套用普通轴图的 `segment3 / hide` 省项策略，也不加省略号。`xAxisContent:'name' \| 'name-value'` 配置仅显示名称或名称＋汇总值；值行复用数字字体并按 Figma 使用 bold。`showRelations` 配置是否显示节点间关系，具体符号由每项 `operatorBefore` 显式提供，二者只影响表达、不参与累计数学。名称按 Figma 节点宽（常规 64px、数据柱 110px；窄槽再收缩）经 L1 真实 SVG 测量，优先按词自动折为最多两行，长词 / 无空格文案才按字符兜底；数据显式分行仍可覆盖。多行带高复用 `frame.xBandLines`，常态与高亮态逐行 DOM 复用 `renderXLabels` / `renderAxisLabelLines`。 | `core/frame.js` / `axis.js` / `measure.js` / `crosshair.js`；`index.js` | ✅ |
| WATERFALL-13 | Web 与移动端交互一致：整列为命中区；hover 显示当前项 / 分段 Tooltip、贯穿绘图区的 X 指示线与 X 轴高亮贴片。贴片必须逐行复用常规 X 轴**自动或显式折行后的最终展示内容**，不得把两行名称重新拼成一行；高亮文字同时挂 `.dv-axis-label` 复用常态字体结构，`.dv-axis-tag-text` 只覆盖状态字色。贴片高度仍为行数 × 行高、无额外纵向 padding；文字的 y、基线与逐行间距必须和常态完全一致，交互只增加黑底并切换字色，不能为了视觉居中平移文字。黑底由 L1 按文字 em 排版盒中心定位——与 Y 值徽标（TOOLTIP-12）同源，故两者上下留白逐像素一致；贴片顶沿不随行数变化，多出的行高向下延伸。不在瀑布 L2 写固定像素修正。气泡位置、marker 和隐藏延时继续由主题 behavior / token 决定。 | `core/axis.js` / `tooltip.js` / `crosshair.js`；`index.js` | ✅ |
| WATERFALL-14 | 入场时每根柱从自己的累计起点生长到终点；连接线与标签在生长结束后出现。只在实例首次挂载时播放，并服从系统减弱动效。 | `core/motion.js`；`index.js` | ✅ |
| WATERFALL-15 | 层级顺序：0 轴 / 连接线 → 柱体 → 数据标签 → 水印 → hover 指示。水印锚定 `frame.grid`，品牌、明暗与位置继续只由主题行为决定。 | `core/watermark.js`；`index.js` | ✅ |

## 活 demo

`index.html` 与 `playground/preview.html` 的「瀑布图」分组包含两项：累计桥接与分组数据柱。两面共用 `demos/examples.js` 的数据与配置装配；开发面三主题并排，可切端、明暗、颜色模式与动效。`xAxisContent` / `showRelations` 保留为实例代码配置并在主站逻辑面板完整展示，不进入预览菜单；关系符本身仍在示例数据的 `operatorBefore` 中配置。

## API

```js
WaterfallChart(host, {
  name,
  period,
  variant: 'standard' | 'data',
  items: [{
    id, name, kind: 'total' | 'delta' | 'subtotal', value,
    operatorBefore, axisLabel, percent,
    segments: [{ id, name, value, percent }],
  }],
  colorMode: 'primary' | 'semantic',
  xAxisContent: 'name' | 'name-value',
  showRelations: true,
  platform: 'pc' | 'mobile',
  animation: true,
})
```

颜色值、字号、线宽、透明度、Tooltip 与水印均不作为实例样式参数暴露。

## Do / Don't

- Do：显式声明有符号贡献、汇总类型和等式运算符；连接线恒显示；分组段和值可校验。
- Don't：从名称猜增减类型；把瀑布图塞进普通堆叠柱；显示常规 Y 网格 / Y 标签；让 Ainvest 箭头形态泄漏到其他主题。
