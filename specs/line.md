# 折线 · 规范（条目化索引）

> 权威源：`vis-design-system lite/references/charts/line.md`（形态细节以原文为准）。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：折线 mark（基础折线图、多折线图、折柱组合的「折」）。折柱组合的组装见 [bar.md](bar.md) BAR-07。

## 图元标记（折线 mark）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LINE-01 | 折线渲染：**直线**（数据点直连、无平滑）· **null 处断开**（不强连前后点）· 0 值正常连续；线宽 `size-line-stroke`；**默认带数据点**——直径 `size-line-point`（6px，含描边），描边宽 = 线宽、fill / 描边色 = 折线色（默认态实心点）；点走**类目中心**（`x(c)+bandwidth/2`），柱在 band 内分组时线穿中心 | `core/mark.js` → `renderLine()`；`.dv-line` / `.dv-line-point`（styles.css） | ✅ |

## 颜色

- 折线色是**系列色**，不走值 token（写死 hex，见 [color.md](color.md)）：单条 → 单系列默认色；多条 / 折柱组合 → 折线色板 `line-multi`（COLOR-05，柱线分色板、禁交叉）。
- 数据点 fill 默认 = 折线色；**hover / 选中态切白心**（描边保持折线色）→ 待办。

## 样式 token

线宽 `size-line-stroke`（THS 1.5 / iFinD 2 / Ainvest 2）· 多折线更细 `size-line-stroke-multi` ·
数据点直径 `size-line-point`（6px）。系列色见 [color.md](color.md)。

## 待办（line.md 其余条目，后续切片）

- [x] **数据点显隐分档**：**移动/PC 统一**——该线非 null 点数 > 13 隐藏所有点（决定：统一阈值规则取代原文「Web 碰撞隐藏」）。实现为纯渲染策略与交互解耦：点**留在 DOM**（带 `data-i` 类目序）、`points-muted` 类仅视觉静默（`mark.js` → `renderLine` 的 `showPoints` + styles.css）；「hover 十字准星唤出最近点 / 选中态即使隐藏也高亮当前点」归 tooltip/十字准星切片，CSS 契约已就绪（`.is-active` 压过静默）。
- [ ] **数据标签**（折线上方数值）：移动端 > 5 隐藏、Web 碰撞隐藏 → 依赖数据标签组件。
- [ ] **hover / 选中态**：数据点切白心（描边不变）；选中底色（`color-background-weak`）。
- [ ] **高密度降采样**：数据量大时降采样渲染避免卡顿（不影响趋势）。
- [ ] **主线渐变面积**：单条主线可在折线与基准轴间填充由浓到透的渐变。
- [ ] `size-line-stroke-multi`（多折线更细）在标准多折线图接入；组合折线当前用 `size-line-stroke`。
- [ ] 图与数据标签最大占画布高 95%（顶部 5% 喘息）——当前靠 niceSplit 取整余量，未显式预留。
