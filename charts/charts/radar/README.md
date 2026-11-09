# RadarChart · L1 复用声明

> 本页由 `hooks/lint-l1-declaration.mjs` 校验（质量门禁第 10 项）。表必须覆盖 `charts/core/` 下
> **每一个** L1 模块；「用」必须与代码里的 import **逐条对得上**，「不用」必须写清理由。
> 雷达图的产品规则与 API 见 `specs/radar.md`。

| L1 模块 | 状态 |
|---|---|
| `axis` | 不用：轴标签是绕圆的八向定位，不是直角坐标的行列宽度与碰撞模型 |
| `axis-title` | 不用：无坐标轴，也没有轴标题带可言 |
| `bar-geometry` | 不用：辐条按维数均分圆周，极坐标几何在本族 geometry.js |
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


## 要点（改本族代码前先读）

> 2026-11-09 从 `AGENTS.md` 迁入。规则本身以规范页为准，这里记的是设计取舍与踩过的坑。

**RadarChart**（`charts/charts/radar/`，见 `specs/radar.md` RADAR-01..18）：多指标综合对比图。无坐标轴、无直角网格，`axis`/`axis-title`/`grid`/`crosshair`/`datazoom` 整条链路不适用；既有通用构件继续复用，分区形态通过 L1 `visual-color.js` 取得通用表现色阶。要点：
- **极坐标 ≠ 雷达**：饼环也画在极坐标里，但两者做的是**相反**的事——饼环「值 → 角度、半径恒定」，雷达「角度均分（`360/n`）、值 → 半径」。真正共享的只有 `(角度,半径)→(x,y)` 那个三角公式，故**没有 `core/polar.js`**；极坐标几何在 `radar/geometry.js` 标 `[L2-LOCAL]`。**将来三个下沉点的判断条件写在 `specs/radar.md` 的「分层边界」与 `geometry.js` 文件头**——做仪表盘的人先读那两处，它会命中「下沉点 ②」（绕圆标签几何 `labelAnchor` / `labelArc`），正确做法是提到 L1 两边共用，**不是照抄一份**
- **值域上界两条路**（RADAR-04）：给了 `max` 就定死、`[0,max]` 均分；不给才走 `niceSplit`。留这个口子是因为 `niceSplit(0, 5, {lineCount:4})` 会得出 5.4——0–5 评分被画成 0–5.4，且两张图数据不同时量程不同、形状不可比
- **n 根轴共用一把标尺**（RADAR-17）：不做逐轴归一化。这是**明确的非目标不是待办**——逐轴各自量程会让图形面积失去意义，且容易靠调量程把形状「调好看」
- **常规雷达的 hover 热区是扇形不是数据点**（RADAR-10，基线 9.1 的 0728 更新）；气泡恒 `follow`（TOOLTIP-07 无坐标系图特例，L2 定死、不进 behavior.json）。点系列进钉住态（RADAR-11）：一个问「这个维度各系列多少」，一个问「这个系列各维度多少」
- **可调节雷达图**是 `editable: true` 的单系列输入能力（RADAR-18），不是新图族也不占 `variant`；手柄沿径向轴拖动、可键盘调值，仍共用 `[0,max]` 标尺。它不渲染常规扇形 hover 热区；多系列直接抛错，避免同轴手柄重叠后编辑对象不明
- 对外示例分**标准雷达 / 多数据雷达 / 分区雷达**，但组件视觉变体仍只有 `variant: 'basic' | 'rating'`，多数据只由 `series` 数量表达且不开放可调节能力；仅 index 详情页用“数据组数”滑块选择 2–10 条示例系列，它不是 `CHART_CAPABILITIES` 或组件配置。网格形状（圆 / 正多边形）、闭合形状（直线 / 曲线）与维度标签排列（横排 / 环绕）是可正交组合的组件 cfg；可调节能力只用于单系列。主预览面用旋钮组合，专项面对六个典型配置做三主题回归。维度标签用 `axisLabelLayout: 'horizontal' | 'arc'`，常规默认横排、editable 默认环绕，两者均可显式覆盖。分区示例用 `ratingStyle` 在连续渐变（默认）与离散色带间切换；渐变固定取独立五档色阶，离散档支持独立的 5 / 6 段色阶，`ratingBandLabels.length` 同时控制图内色带、环线与底部色块，阈值文案可配置、色值不可配置
