# RadarChart · L1 复用声明

> 本页由 `hooks/lint-l1-declaration.mjs` 校验（质量门禁第 10 项）。表必须覆盖 `charts/core/` 下
> **每一个** L1 模块；「用」必须与代码里的 import **逐条对得上**，「不用」必须写清理由。
> 雷达图的产品规则与 API 见 `specs/radar.md`。

| L1 模块 | 状态 |
|---|---|
| `axis` | 不用：轴标签是绕圆的八向定位，不是直角坐标的行列宽度与碰撞模型 |
| `axis-title` | 不用：无坐标轴，也没有轴标题带可言 |
| `callout` | 不用：维度标签已环绕图形四周，暂无额外批注位 |
| `chart-text` | 用 |
| `crosshair` | 不用：本族的指示是扇形高亮，不存在 X / Y 向指示线与轴贴片 |
| `datazoom` | 不用：维度是并列的固定几项，没有可开窗的类目序列 |
| `format` | 用 |
| `frame` | 用 |
| `grid` | 不用：网格是同心环或正多边形，不是直角网格线与 0 轴基线 |
| `highlight-state` | 不用：选中态走 legend-state 的单选迁移，扇形高亮只作用于自身，没有邻域与钉住 |
| `image-content` | 不用：轴标签与气泡只承载名称和数值，没有图片内容块 |
| `label` | 用 |
| `legend` | 用 |
| `legend-state` | 用 |
| `mark` | 不用：该模块绘制柱与折线，本族图元是闭合多边形或闭合曲线 |
| `measure` | 用 |
| `motion` | 用 |
| `palette` | 用 |
| `polar-label` | 用 |
| `scale` | 用 |
| `split` | 用 |
| `theme` | 用 |
| `tokens` | 用 |
| `tooltip` | 用 |
| `visual-color` | 用 |
| `watermark` | 用 |

## 几处值得说明的复用

- **`scale`**：`linearY(split, R, 0)` 直接就是「值 → 半径」（min→0、max→R）。函数名带 Y 但数学是通用的，故**不在本族另写一份**——纪律见 `AGENTS.md`「参数化 L1，不要在 L2 另写一份」。
- **`split`**：`niceSplit(0, 数据max, { lineCount: segments + 1 })` 求网格环的 nice 上界与环数，**仅在调用方没给 `max` 时走**（[RADAR-04]）。它经参数注入进 `geometry.js`，那里因此保持零 import、`node --test` 可直接加载。
- **`label` / `measure`**：用 `truncateBatch` + `measureTexts` 截超长维度名（[RADAR-07]）；环绕档另用 `measureInk` 取得真实字形 ascent，让反向弧形标签与外圈保持相同视觉距离（[RADAR-14]）。**不用 `dropCollisions`**——轴标签环绕四周、本就不同行也不同列，两个方向的碰撞模型都不适用。
- **`legend`**：marker 传 `'dot'`，直接复用 `specs/legend.md` LEGEND-03 的「饼/环/气泡/**雷达** 6×6 圆点」规则，`behavior.json` 无需新增任何键。
- **可调节形态**：`editable` 只扩展本族的输入交互，继续使用同一份 `geometry.js`、`format`、`scale`、Tooltip 与 token 通道；没有新增或复制任何 L1 构件（[RADAR-18]）。
- **分区形态**：`performanceColorRamp()` 提供低表现→高表现的通用语义色阶；五档与六档是两套独立设计色，不互相抽样。连续渐变固定取五档，图内 SVG 与底部色条共用同一数组；离散档才以 `ratingBandLabels.length` 同时决定彩色环带、参考环线与底部色块数量，保证 5 / 6 段下数量、顺序与颜色都一致，不识别主题与色值（[RADAR-15] / [COLOR-10]）。

## 极坐标几何为什么留在本目录

`geometry.js` 标了 `[L2-LOCAL]`。**理由不是「雷达不用极坐标」**，而是饼环与雷达在极坐标里做的是相反的事——饼环「值 → 角度、半径恒定」，雷达「角度均分、值 → 半径」；两者真正共享的只有 `(角度, 半径) → (x, y)` 那个三角公式。

将来什么条件下该提到 L1、命中后怎么做，逐条写在 `specs/radar.md` 的「分层边界 → 三个下沉点」和 `geometry.js` 的文件头。**下一个做极坐标图型的人先读那两处**——尤其是仪表盘，它会命中「下沉点 ②」。
