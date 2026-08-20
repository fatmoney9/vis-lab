# 折线 · 规范（条目化索引）

> 本页是项目内折线规则的权威定义；代码注释通过稳定 ID 回引本页。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：折线 mark（基础折线图、多折线图、折柱组合的「折」）。折柱组合的组装见 [bar.md](bar.md) BAR-07。

## 图元标记（折线 mark）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| LINE-01 | 折线渲染：**直线**（数据点直连、无平滑）· **null 处断开**（不强连前后点）· 0 值正常连续；线宽 `size-line-stroke`；**默认带数据点**——尺寸 `size-line-point` 含描边（THS 6px / iFinD·Ainvest 8px），**形状随主题**（behavior `line-point-shape`）：circle 实心圆（THS / Ainvest）、diamond 正方形旋转 45°（iFinD，边长含描边）；描边宽 = 线宽、fill / 描边色 = 折线色（默认态实心点）；点走**类目中心**（`x(c)+bandwidth/2`），柱在 band 内分组时线穿中心 | `core/mark.js` → `renderLine()`（`pointShape` 参数）；`.dv-line` / `.dv-line-point`（styles.css） | ✅ |

## 颜色

- 折线色是**系列色**，不走值 token（色值只写在 `tokens/palette.json`，见 [color.md](color.md)）：单条 → 单系列默认色；纯多折线 → 通用 `bar-multi`；折柱组合中的折线 → `line-multi`（COLOR-05，柱线分色板、禁交叉）。
- 数据点 fill 默认 = 折线色；**hover 切白心/黑心已完成**（iFinD 保持实心）。
- **折线没有自己的选中态**——点击选中是[跨图型的交互](tooltip.md)（tooltip.md「点击分片选中」，未定），
  不是折线特性，故本页不再挂待办。此处曾有一条 `- [ ] 选中态：选中底色 color-background-weak`，
  已于 2026-08-20 删除，理由三条：① 它是引入时那条合并条目「hover / 选中态：数据点切白心；选中底色」
  被拆开后剩下的半截，原意是**数据点 fill 的状态表**（默认 / hover / 选中），不是「折线有点击选中」这个结论；
  ② [bar.md](bar.md) 里「选中」出现 0 次，而 tooltip.md 那条描述的恰是「类目 **block 柱状**高亮」——
  折线单独有、柱没有说不通；③ 真正有选中态的只有饼环，且 [pie.md](pie.md) PIE-03 明确写着它**就是**
  图例强调的那个 `selected`（LEGEND-14）、不是另开一个——饼环有得起是因为「一个扇区 = 一个实体」点得中，
  折线是一条连续路径，没有这种可点实体。<br>顺带消掉一个双头：那条待办写底色用 `color-background-weak`，
  tooltip.md 写 `color-visualization-highlight-block`，两者透明度差一倍半（0.04 / 0.1）；
  底色口径统一由 tooltip.md 那条定，本页不再给第二个值。

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
数据点尺寸 `size-line-point`（THS 6 / iFinD·Ainvest 8，含描边；形状走 behavior `line-point-shape`：circle / diamond）· 渐变面积两端透明度 `opacity-line-area-from` / `-to`（0.2 → 0）·
堆叠填充带不透明度 `opacity-line-stack-fill`（0.2）。系列色见 [color.md](color.md)。

## 待办（line.md 其余条目，后续切片）

- [x] **数据点显隐分档**：**移动/PC 统一**——该线非 null 点数 > 13 隐藏所有点（决定：统一阈值规则取代原文「Web 碰撞隐藏」）。实现为纯渲染策略与交互解耦：点**留在 DOM**（带 `data-i` 类目序）、`points-muted` 类仅视觉静默（`mark.js` → `renderLine` 的 `showPoints` + styles.css）；「hover 十字准星唤出最近点」已随 tooltip 落地（[tooltip.md](tooltip.md) TOOLTIP-10，L2 按类目给 `.dv-line-point[data-i]` 挂 `.is-active` 压过静默）；原文另有「选中态即使隐藏也高亮当前点」一句——**折线本身没有选中态**（见上「颜色」小节），
  该句是跨图型的点击选中落地后才谈得上的附带要求，随 [tooltip.md](tooltip.md)「点击分片选中」一并定，本页不单独挂账。
- [x] **数据标签**（折线上方数值）：已落地 [data-label.md](data-label.md)（LABEL-01..08）——**全端统一**「非 null 点数 > 5 隐藏该线全部标签」+ 未超阈值时碰撞过滤（决定：统一阈值取代原文「移动端计数 / Web 碰撞」端分叉，同本页数据点 >13 的处理）；该阈值**柱线通用**（非折线专属）。默认显隐：纯折线且单条才显示，多折线与折柱组合中的折线均不显示（标签让给柱）。
- [x] **hover 数据点中心填充**：十字准星唤出的当前点（`.is-active`）fill 切
  `color-visualization-line-point-hover`——THS / Ainvest 亮色 #FFF、暗色 #000（白心/黑心），
  iFinD = `currentColor`（保持实心不参与）；描边不变 = 系列色；层级压过指示线
  （tooltip.md TOOLTIP-10 副本层）。实现 styles.css `.dv-line-point.is-active`。
- [ ] **高密度降采样**：数据量大时降采样渲染避免卡顿（不影响趋势）。
- [x] **主线渐变面积**：series 级可开启配置 `area:true`（仅 stack:none）——渐变从**最大值**处 `opacity-line-area-from`（0.2）到 **grid 底部** `-to`（0），面积填至 grid 底部（决定：非 0 基准轴）；实现 `core/mark.js` `renderLine(opts.area)`。
- [x] `size-line-stroke-multi` 接入：声明 ≥2 条线时**仅非主线**切换（主线=首条声明线保持 `size-line-stroke`，含数据点描边同步）；组合折柱只有 1 条线时仍用 `size-line-stroke`。
- [x] 图与数据标签的顶部喘息空间 —— 2026-08-18 落地为 **[data-label.md](data-label.md) LABEL-10**。原设想的「最大占画布高 95%」**定不出来**：需求是像素量（放得下一个数据标签），而占比是比例，同一个百分比在不同高度的画布上换算出的像素完全不同；最终改为按 `标签高 ÷ 绘图区高` 现算的动态上限，交给 `niceSplit` 的 `headroom` 参数；
  已与 [data-label.md](data-label.md) 的「顶部空间预留」待办合并（SCALE-03 占比可达 100% 时标签越顶，
  现靠 svg `overflow:visible` 溢出到卡片留白）。
