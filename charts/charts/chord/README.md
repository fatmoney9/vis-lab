# ChordChart · L1 复用声明

> 本页由 `hooks/lint-l1-declaration.mjs` 校验（质量门禁第 10 项）。表必须覆盖 `charts/core/` 下
> **每一个** L1 模块；「用」必须与代码里的 import **逐条对得上**，「不用」必须写清理由。
> 弦图的产品规则与 API 见 `specs/chord.md`。

| L1 模块 | 状态 |
|---|---|
| `axis` | 不用：无坐标轴，实体沿圆周排布，不存在行列宽度与轴标签碰撞模型 |
| `axis-title` | 不用：无坐标轴，也没有轴标题带可言 |
| `chart-text` | 用 |
| `crosshair` | 不用：本族的指示是邻域高亮，不存在 X / Y 向指示线与轴贴片 |
| `datazoom` | 不用：实体是并列的固定几项，没有可开窗的类目序列 |
| `format` | 用 |
| `frame` | 用 |
| `grid` | 不用：圈内是弦，没有网格线与 0 轴基线 |
| `highlight-state` | 用 |
| `image-content` | 不用：实体标签与看板只承载名称和数值，没有图片内容块 |
| `label` | 用 |
| `legend` | 不用：实体名已沿外圈逐个标注，图例是同一份信息的第二遍（CHORD-19 写明这是判断不是遗漏） |
| `legend-state` | 不用：没有图例，也就没有图例点击的筛选与强调状态 |
| `mark` | 不用：该模块绘制柱与折线，本族图元是环带与向心收束的弦 |
| `measure` | 用 |
| `motion` | 用 |
| `palette` | 用 |
| `polar-label` | 用 |
| `scale` | 不用：值映射到**角度**而非像素长度，换算是 `(2π − n·pad) / Σ值`，不是值→像素比例尺 |
| `split` | 不用：没有坐标刻度，不需要 nice split 数学 |
| `theme` | 用 |
| `tokens` | 用 |
| `tooltip` | 用 |
| `visual-color` | 不用：实体按稳定系列色槽取色，不需要逐数据项强度或有符号语义色 |
| `watermark` | 用 |

## 几处值得说明的复用

- **`polar-label`**：本族是 `specs/radar.md` 里「下沉点②③」的**命中者**。绕圆标签的八向锚点（`labelAnchor`，horizontal 档）、可读弧线（`labelArc`，arc 档）与标签带宽（`labelBand`）三项全部来自 L1，**本族一份都不复制**；`pointAt` 同样如此，故全库只有一处三角公式。
- **`highlight-state`**：hover / 钉住的状态迁移走 L1，本族只负责「把当前状态画出来」——邻域怎么算（`model.js`）、class 怎么贴、出不出看板留在这一层。钉位只有一个，实体弧与弦的互斥由类型保证。
- **`measure` / `label`**：`measureInk` 取真实字形 ascent，让 arc 档的标签墨迹内缘都从 `R + gap` 开始；`truncateBatch` 的宽度上限取**每个标签自己那条弧**的长度（下半圆的弧因外移而更长），显示几何与测量口径同一条弧（同 [RADAR-14]）。
- **`palette`**：实体色按 `type: 'pie'` 走扇区盘——外圈实体与饼扇区是同一种东西（同一总量的并列组成部分、绕一圈排布），故复用 COLOR-08 的盘而**不新增色板键**。
- **`motion`**：只复用 `easeOutCubic` 与 `reducedMotion`。**不用 `runGrowth`**：本族的生长是「一条时间线派生出 N 条弦各自的出现时机」，而 `runGrowth` 的模型是「一个进度值驱动一批图元同步生长」，形态对不上；复用曲线与减弱动效判断即可，不强行改用。

## L1 / L2 / L3 边界

- L2 `layout.js`：矩阵校验、槽位、角度分配、环带与弦的路径、画布几何。只 import `core/polar-label.js`，**不 import d3**，故可被 `node --test` 直接加载。
- L2 `model.js`：邻域集合与看板装配。`[L2-LOCAL]`、零 import。
- L2 `config.js`：跨主题不变的**比例量与弧度**（pad、taper、半径下限比例、最小可见角、播放参数）。`[L2-LOCAL]`。像素、颜色、字号、透明度一律不在这里——它们在 `tokens/*.json`。
- L2 `index.js`：只负责编排生命周期、SVG 装配、交互接线与入场动效。
- L3：示例数据与配置装配在 `demos/`；**不另建专属预览面**——本族是正方形画布、无固定外框硬需求，两个通用面表达得了（`specs/chord.md`「活 demo」）。
- 全局结构样式：`charts/styles.css` 的 `.dv-chord` 命名空间。
