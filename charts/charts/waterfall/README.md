# WaterfallChart · L1 复用声明

> 本页由 `hooks/lint-l1-declaration.mjs` 校验，并与本目录代码中的 L1 import 逐条对账。
> 瀑布图的产品规则与 API 见 `specs/waterfall.md`。

| L1 模块 | 状态 |
|---|---|
| `axis` | 用 |
| `axis-title` | 不用：时间标题是瀑布专属内容区，不是坐标轴标题 |
| `crosshair` | 用 |
| `datazoom` | 不用：叙事序列通常少量且必须完整展示，不做连续窗口裁切 |
| `format` | 用 |
| `frame` | 用 |
| `grid` | 用 |
| `highlight-state` | 不用：柱与连接线按 X 切片整列联动，没有单个图元的钉住态，也没有图元邻域可高亮 |
| `image-content` | 不用：柱与 Tooltip 均不包含图片内容块 |
| `label` | 用 |
| `legend` | 不用：增减含义由柱形与有符号语义表达，设计源未提供独立图例 |
| `legend-state` | 不用：没有图例，因此不存在图例驱动的筛选或强调状态 |
| `mark` | 不用：浮动柱、分段数据柱与箭头复合图元不是通用零基线柱 |
| `measure` | 用 |
| `motion` | 用 |
| `palette` | 用 |
| `polar-label` | 不用：直角坐标系里文字横平竖直排布，不存在按圆周方位决定对齐或生成弧线的问题 |
| `scale` | 用 |
| `split` | 用 |
| `theme` | 用 |
| `tokens` | 用 |
| `tooltip` | 用 |
| `visual-color` | 用 |
| `watermark` | 用 |

## L1 / L2 / L3 边界

- L1：画布与 resize、nice split / 线性比例尺、0 轴、X 标签碰撞、真实文字测量、格式化、通用数据标签、Tooltip / 十字线、水印、动效、系列主色与有符号语义色全部直接复用。
- L2 `model.js`：只负责瀑布累计公式、分段守恒与值域端点，零 DOM、零 d3，可单测。
- L2 `geometry.js`：集中保存 Figma 明确给出的跨主题固定尺寸，并负责槽宽到柱宽的专属几何换算；零 DOM、零主题判断，品牌分叉不放这里。
- L2 `render.js`：只装配无状态的瀑布专属 SVG 片段与展示文本，不持有重绘、动效或交互生命周期。
- L2 `index.js`：编排浮动柱、连接线、Ainvest 箭头复合图元、数据柱内部标签及交互生命周期。
- L0：Ainvest / THS / iFinD 的形态选择在 `tokens/behavior.json`；颜色、线宽、线型和透明度在三份主题 token 中保持同键合同。
- L3：规则 ID 在 `specs/waterfall.md`；示例、主题文案与旋钮装配在 `demos/`，两个预览入口不拼 SVG。
