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

## 多折线 / 堆叠折线（三旋钮组合，非新组件）

- **多折线** = 声明 ≥2 个 `type:'line'` 系列（判定按声明、与色板槽位一致）：**主线（首条声明线）
  保持 `size-line-stroke`**（THS 1.5），**其余线**切更细的 `size-line-stroke-multi`（THS 1，经
  `lines-multi` 类）——并非所有线都切细；**层级：主线最高、后续声明依次递减**（渲染按声明逆序，
  SVG 后画者在上）；**纯折线走通用 `bar-multi` 色板**（与多系列柱
  同一套按序号取）——`line-multi` 仅在折柱组合中作为折线子序列使用（COLOR-05）。
- **堆叠折线** = 折线系列 × `stack:normal/percent`：线沿**可见线**累计基线绘制——线堆线、柱堆柱
  各自独立累计（复用 `layout.js` `stackBars` 同一份累计逻辑，值域同步 `domain.js`）；
  每系列在**折线与其累计基线之间**填充**与线同色**的填充带，不透明度
  `opacity-line-stack-fill`（0.2，非渐变）；null 断口带同断；
  隐藏系列按可见重算（堆叠闭合、轴 refit）。
- **主线渐变面积**：`series` 级可开启配置 `area:true`（仅 `type:'line'` 且 `stack:'none'` 生效）——
  折线与 **grid 底部**之间填充渐变：最大值处 `opacity-line-area-from`（0.2）渐到 grid 底部
  `opacity-line-area-to`（0）；色随系列（currentColor）、null 断口面积同断、画在线下方。

## 样式 token

线宽 `size-line-stroke`（THS 1.5 / iFinD 2 / Ainvest 2）· 多折线非主线更细 `size-line-stroke-multi`（已接入，主线保持标准线宽）·
数据点直径 `size-line-point`（6px）· 渐变面积两端透明度 `opacity-line-area-from` / `-to`（0.2 → 0）·
堆叠填充带不透明度 `opacity-line-stack-fill`（0.2）。系列色见 [color.md](color.md)。

## 待办（line.md 其余条目，后续切片）

- [x] **数据点显隐分档**：**移动/PC 统一**——该线非 null 点数 > 13 隐藏所有点（决定：统一阈值规则取代原文「Web 碰撞隐藏」）。实现为纯渲染策略与交互解耦：点**留在 DOM**（带 `data-i` 类目序）、`points-muted` 类仅视觉静默（`mark.js` → `renderLine` 的 `showPoints` + styles.css）；「hover 十字准星唤出最近点 / 选中态即使隐藏也高亮当前点」归 tooltip/十字准星切片，CSS 契约已就绪（`.is-active` 压过静默）。
- [ ] **数据标签**（折线上方数值）：移动端 > 5 隐藏、Web 碰撞隐藏 → 依赖数据标签组件。
- [ ] **hover / 选中态**：数据点切白心（描边不变）；选中底色（`color-background-weak`）。
- [ ] **高密度降采样**：数据量大时降采样渲染避免卡顿（不影响趋势）。
- [x] **主线渐变面积**：series 级可开启配置 `area:true`（仅 stack:none）——渐变从**最大值**处 `opacity-line-area-from`（0.2）到 **grid 底部** `-to`（0），面积填至 grid 底部（决定：非 0 基准轴）；实现 `core/mark.js` `renderLine(opts.area)`。
- [x] `size-line-stroke-multi` 接入：声明 ≥2 条线时**仅非主线**切换（主线=首条声明线保持 `size-line-stroke`，含数据点描边同步）；组合折柱只有 1 条线时仍用 `size-line-stroke`。
- [ ] 图与数据标签最大占画布高 95%（顶部 5% 喘息）——当前靠 niceSplit 取整余量，未显式预留。
