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
