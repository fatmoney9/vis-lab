# TreemapChart · L1 复用声明

> 本页由 `hooks/lint-l1-declaration.mjs` 校验（质量门禁第 10 项）。表必须覆盖 `charts/core/` 下
> **每一个** L1 模块；「用」必须与代码里的 import **逐条对得上**，「不用」必须写清理由。
> 矩形树图的产品规则与 API 见 `specs/treemap.md`。

| L1 模块 | 状态 |
|---|---|
| `axis` | 不用：矩形树图无坐标轴，节点读数由块内标签与 Tooltip 承担 |
| `axis-title` | 不用：无坐标轴，也没有轴标题带 |
| `chart-text` | 用 |
| `crosshair` | 不用：交互直接命中矩形节点，不存在最近类目指示线 |
| `datazoom` | 不用：单画布单层展示，没有可开窗的类目序列 |
| `format` | 用 |
| `frame` | 用 |
| `grid` | 不用：矩形分区本身就是图元，不绘制坐标网格 |
| `highlight-state` | 用 |
| `image-content` | 用 |
| `label` | 不用：本族需要名称换行、字号降级和名称/数值联合排布，不是通用数据标签的截断与碰撞模型 |
| `legend` | 不用：当前矩形节点直接承载类别与颜色，没有独立图例区 |
| `legend-state` | 不用：没有图例，也没有图例驱动的显隐或聚焦状态 |
| `mark` | 不用：该模块绘制柱与折线，矩形节点由 D3 treemap 坐标直接装配 |
| `measure` | 用 |
| `motion` | 用 |
| `palette` | 用 |
| `polar-label` | 不用：标签排在矩形块内，与圆周方位和弧线无关 |
| `scale` | 不用：面积由同层占比交给 D3 treemap 切分，不做坐标值到像素的线性映射 |
| `split` | 不用：无坐标刻度，不需要 nice split 数学 |
| `theme` | 用 |
| `tokens` | 用 |
| `tooltip` | 用 |
| `visual-color` | 用 |
| `watermark` | 用 |

## 几处值得说明的复用

- **`highlight-state`**：矩形块的 hover 与「点击钉住 / 再点关闭」走 L1 的状态迁移（[TREEMAP-06]），与桑基共用同一份。本族只有一类图元、也没有邻域可算，故 `kind` 恒为 `'leaf'`、`key` 直接用 leaf 对象本身；状态活在 `build()` 内，重渲即重置。**即便只有一个钉位，也不在本族另留一个变量**——「移出要回落到钉住态而不是清空」这类判定一旦各写一份，迟早会在某次改动里岔开。
