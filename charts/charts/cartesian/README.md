# CartesianChart · L1 复用声明

> 本页由 `hooks/lint-l1-declaration.mjs` 校验（质量门禁第 10 项）。表必须覆盖 `charts/core/` 下
> **每一个** L1 模块；「用」必须与代码里的 import **逐条对得上**，「不用」必须写清理由。
> **代码变了而本页没跟，门禁立刻红**——所以这张表退化不成打勾的表格。
>
> 为什么要有这一节：**「悄悄不用一个 L1」是 L2 长成第二套 L1 的起点**，而它本身不会报错。
> 判断粒度见 `WORKFLOW.md` 第三节，能力索引见 `AGENTS.md`「L1 能力索引」。

| L1 模块 | 状态 |
|---|---|
| `axis` | 用 |
| `axis-title` | 用 |
| `bar-geometry` | 用 |
| `callout` | 用 |
| `chart-text` | 不用：组件内没有写死的文案，系列名、轴标题、图例文字全部来自配置 |
| `crosshair` | 用 |
| `datazoom` | 用 |
| `format` | 用 |
| `frame` | 用 |
| `grid` | 用 |
| `highlight-state` | 不用：hover 按 X 坐标整列切片联动，没有单个图元的钉住态，也没有图元邻域可高亮 |
| `image-content` | 不用：轴图当前只展示文字型系列，没有节点图片内容块 |
| `label` | 用 |
| `legend` | 用 |
| `legend-state` | 用 |
| `mark` | 用 |
| `math` | 用 |
| `measure` | 不用：经 `axis.js` 间接用到（`measureYLabelWidth` / `yLabelInset` 内部调它），本层不直接依赖；轴标签类名由 `axis.js` 一处固定，L2 再调一次只会多出第二个类名口径 |
| `motion` | 用 |
| `palette` | 用 |
| `polar-label` | 不用：直角坐标系里文字横平竖直排布，不存在按圆周方位决定对齐或生成弧线的问题 |
| `scale` | 用 |
| `split` | 用 |
| `theme` | 用 |
| `tokens` | 用 |
| `tooltip` | 用 |
| `visual-color` | 不用：轴图颜色按系列分配，不需要逐数据项强度或有符号语义色 |
| `watermark` | 用 |


## 要点（改本族代码前先读）

> 2026-11-09 从 `AGENTS.md` 迁入。规则本身以规范页为准，这里记的是设计取舍与踩过的坑。

**CartesianChart**（`charts/charts/cartesian/`）：柱、堆叠、折线、折柱组合、双 Y、hover/tooltip 链路、缩放轴（datazoom，见 `specs/datazoom.md`）、水印（watermark，见 `specs/watermark.md`）、数据标签（data label，见 `specs/data-label.md`）、图表标注（callout，见 `specs/callout.md`，默认不显示，位置自动选、不移动任何下层元素）、轴标题（axis title，见 `specs/axis-title.md`，默认不显示）和入场生长动效（motion，见 `specs/motion.md`，默认开、仅实例首次挂载时播）。

**直角坐标系与饼环两族共用的图例点击语义**（`legendSelect`，见 `specs/legend.md` LEGEND-06 / LEGEND-14；**桑基不适用**——其图例是静态色卡）：`'multi'`（默认，点谁隐谁）/ `'single'`（只留该项）/ `'focus'`（**不隐藏**，只把其余项与其图形压到 `opacity-visualization-dim`）。前两档改数据构成（饼环重算 360°、轴图重算值域），第三档不改。**这个键 2026-08-12 前住在 `behavior.json` 的 `legend-select` 上，已迁出**——它不是品牌分叉（源文档从未指定各主题默认），判例同 LEGEND-10「方位」。纯状态迁移在 `charts/core/legend-state.js`（**与 `legend.js` 分开只为可测**：那边 import d3，`node --test` 加载不了）。
