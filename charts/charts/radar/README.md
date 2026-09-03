# RadarChart · L1 复用声明

> 本页由 `hooks/lint-l1-declaration.mjs` 校验（质量门禁第 10 项）。表必须覆盖 `charts/core/` 下
> **每一个** L1 模块；「用」必须与代码里的 import **逐条对得上**，「不用」必须写清理由。
> 雷达图的产品规则与 API 见 `specs/radar.md`。

| L1 模块 | 状态 |
|---|---|
| `axis` | 不用：轴标签是绕圆的八向定位，不是直角坐标的行列宽度与碰撞模型 |
| `axis-title` | 不用：无坐标轴，也没有轴标题带可言 |
| `crosshair` | 不用：本族的指示是扇形高亮，不存在 X / Y 向指示线与轴贴片 |
| `datazoom` | 不用：维度是并列的固定几项，没有可开窗的类目序列 |
| `format` | 用 |
| `frame` | 用 |
| `grid` | 不用：网格是同心环或正多边形，不是直角网格线与 0 轴基线 |
| `image-content` | 不用：轴标签与气泡只承载名称和数值，没有图片内容块 |
| `label` | 用 |
| `legend` | 用 |
| `legend-state` | 用 |
| `mark` | 不用：该模块绘制柱与折线，本族图元是闭合多边形或闭合曲线 |
| `measure` | 用 |
| `motion` | 用 |
| `palette` | 用 |
| `scale` | 用 |
| `split` | 用 |
| `theme` | 用 |
| `tokens` | 用 |
| `tooltip` | 用 |
| `visual-color` | 不用：本期只按系列固定色槽取色；评级形态（RADAR-15）接入时改为「用」 |
| `watermark` | 用 |

## 几处值得说明的复用

- **`scale`**：`linearY(split, R, 0)` 直接就是「值 → 半径」（min→0、max→R）。函数名带 Y 但数学是通用的，故**不在本族另写一份**——纪律见 `AGENTS.md`「参数化 L1，不要在 L2 另写一份」。
- **`split`**：`niceSplit(0, 数据max, { lineCount: segments + 1 })` 求网格环的 nice 上界与环数，**仅在调用方没给 `max` 时走**（[RADAR-04]）。它经参数注入进 `geometry.js`，那里因此保持零 import、`node --test` 可直接加载。
- **`label`**：只用 `truncateBatch` 截超长维度名（[RADAR-07]）。**不用 `dropCollisions`**——轴标签环绕四周、本就不同行也不同列，两个方向的碰撞模型都不适用。
- **`legend`**：marker 传 `'dot'`，三主题天然命中 `specs/legend.md` LEGEND-03 已写明的「饼/环/气泡/**雷达** 6×6 圆点」，`behavior.json` 无需新增任何键。

## 极坐标几何为什么留在本目录

`geometry.js` 标了 `[L2-LOCAL]`。**理由不是「雷达不用极坐标」**，而是饼环与雷达在极坐标里做的是相反的事——饼环「值 → 角度、半径恒定」，雷达「角度均分、值 → 半径」；两者真正共享的只有 `(角度, 半径) → (x, y)` 那个三角公式。

将来什么条件下该提到 L1、命中后怎么做，逐条写在 `specs/radar.md` 的「分层边界 → 两个下沉点」和 `geometry.js` 的文件头。**下一个做极坐标图型的人先读那两处**——尤其是仪表盘，它会命中「下沉点 ②」。
