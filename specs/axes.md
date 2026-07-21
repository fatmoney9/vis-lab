# 直角坐标系 · 轴与网格规范（条目化索引）

> 本页是项目内轴与网格规则的权威定义；代码注释通过稳定 ID 回引本页。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：所有 x/y 轴坐标图表（柱状图、折线图及延伸图表）。

## 比例尺 / 刻度

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| SCALE-01 | Y 轴分割线默认 5 条，min/max/interval 三件套对齐。**两条硬约束**：interval 必须取自间隔数组 `INTERVAL_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8]`（×10ⁿ，规范值）；**0 恒落在某条分割线上**。数组密度决定占比下限（≈ 1/最大相邻档位比，当前 ≈75%，典型 85%+）：加档位抬占比、删档位保圆整。K 线仅 3 档为例外，刻度数与网格线绑定 | `core/scale.js` → `niceSplit(min, max)` | ✅ |
| SCALE-02 | **缩放轴（navigator）联动**：可见窗口变化时，Y 轴按窗口内可见数据的值域重算 niceSplit；分割线数量不变 | 组合调用：窗口内可见数据 extent → `niceSplit` / `niceSplitDual` 重算 + 重绘（无专用代码；验收夹具已随 dev 预览移除） | ✅ 已验证 |
| SCALE-03 | **占比最大化（硬约束内）**：跨零时枚举「负值段数」把 4 段按正负值域比例分配，每个段数取间隔数组内能覆盖数据的最小 interval，选占比最高者。值域不预加呼吸空间（预扩会把 interval 顶过档位），余量由取整自然提供。注：两条硬约束下占比无法保证 ≥90%（如负:正 ≈ 1:2 的数据上限约 77%），属数学上限而非实现缺陷 | `core/scale.js` → `niceSplit()` | ✅ |
| SCALE-04 | **双 Y 轴：共享分割线 + 0 轴恒对齐**。两轴共用同一组分割线（同数量、同像素位置），0 永远落在同一条分割线上——两轴**共享负值段数**，interval 各自从间隔数组取（SCALE-01 对两轴分别成立）；在可行负值段数交集内选「较差一侧占比」最大的组合。**必然代价**：一轴全正、另一轴跨零时，全正轴出现空的负值段（0 对齐所致，非缺陷） | `core/scale.js` → `niceSplitDual()` | ✅ |

## 网格线

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| GRID-01 | 横向网格线：`color-visualization-divider`，0 轴加深 `color-visualization-divider-deep`，线宽 `size-grid-line` | `core/grid.js` → `renderGrid()` | ✅ |
| GRID-02 | X 轴分割线（纵线）默认不显示，特例经 `showXSplit` 显式开启 | 同上 | ✅ |
| GRID-03 | **默认图表高度包络 + 容器自适应**：调用方未提供明确高度时，Y 方向图表高度取主题 token `size-chart-region-height`（THS 160px、iFinD-PC/Ainvest 200px）。`inside` 的口径是最顶部轴线到最底部轴线；`outside` 的口径是最顶部 Y 标签外缘到最底部 Y 标签外缘（两端标签以轴线为中心，故轴线间距 = token − 两端半行高）。X 轴标签带、图例、卡片标题和外壳 padding 均不计入该高度。调用方提供明确高度后，SVG 随容器可用高度适配；容器宽/高变化时几何整体重排，分割线数量不变（SCALE-01 不受尺寸影响），X 轴标签碰撞重新判定 | `charts/charts/cartesian/index.js`（默认/容器高度判定）+ `core/frame.js` → `createFrame()` / `observeResize()` | ✅ |

## Y 轴标签

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| AXIS-01 | 两种布局：`inside` / `outside`，**默认 `inside`**。<br>**inside（网格内部 + 避让网格线）**：网格左右铺满画布，Y 标签紧贴网格侧边、不设内部偏移；最顶标签顶对齐贴顶线向下（不得高过绘制区上沿——最常见错误）；其余标签底对齐贴线上方；0/最底标签不越下沿；**数据让位**：有标签一侧数据边界收缩「最长标签宽 + 安全间距」。<br>**outside（网格外部 + 与网格线居中）**：标签在绘制区外侧，与网格线上下居中，距网格 **8px**——8px 仅是「标签 ↔ 网格」间距，**无标签一侧网格贴画布边缘、不留边缘留白**（如 Ainvest PC 单主轴的左侧）；顶/底标签允许超出绘制区约半个行高（上下留白由 frame 预留）；不收数据范围 | `core/axis.js` → `renderYLabels()` + `yLabelInset()`；留白在 `core/frame.js` | ✅ |
| AXIS-02 | Y 轴位置（主题默认）：主 Y —— THS 左 / iFinD-PC 左 / **Ainvest 右**；副 Y 相反侧。iFinD-PC 在**未声明副轴时**于反侧镜像主轴同一套标签；真·双量纲仍是两根轴、两侧显示各自刻度。**副 Y 出现条件**：多系列量纲/数量级不同，或线柱组合（柱/折线各一轴）；量纲相同共用主 Y | 主题→位置/形式映射经 `tokens/behavior.json` + `core/theme.js`；**标准双 Y 已在 L2 落地**（`charts/charts/cartesian/index.js`：每系列 `axis` 绑定 + `niceSplitDual` 刻度对齐 + 副轴反侧标签列/数据让位，见 [bar.md](bar.md) BAR-07）；**iFinD 单轴镜像已落地**（`y-dual-shared` 开关：非双量纲时反侧镜像主轴同一套刻度 `mirror = y-dual-shared && !dual`，统一为 `oppTicks`；真·双量纲仍走标准 dual 两侧各一套） | ✅ |
| AXIS-03 | 标签对齐：默认**贴轴线一侧**、随位置自动（内/外、左/右均适用）；**Ainvest 特例 = 全部右对齐**（behavior `y-label-align`: auto / right）——只需改 outside 右列（anchor 切 end、贴标签列外沿），inside 右侧与 outside 左列本就右对齐 | `renderYLabels()` 的 anchor 逻辑（`align` 参数） | ✅ |
| AXIS-08 | **outside 标签列宽**：每次重绘按当前刻度**一次性渲染测量**（隐藏 SVG 真实类名量宽，含 tabular-nums 等 Canvas 表达不了的特性，无估算误差、不裁字），**精确贴合、不附加余量**；缩放轴联动时列宽随标签变化即时调整。inside 布局的数据让位、X 轴标签碰撞判定（AXIS-06）的宽度测量**同源**（渲染级测量是唯一测量源，Canvas 估算路径已移除） | `core/axis.js` → `measureYLabelWidth()` + `measureRendered()` | ✅ |

## X 轴标签

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| AXIS-04 | X 轴标签自成**容器带**（非一根基线）：带高 = 行高 + 上下间距；调间距 = 调带高。上间距跟随 Y 布局——**Y 为 outside 时增大**，防 Y 底标签溢入 | `core/frame.js`（`xBandTop` 计算） | ✅ |
| AXIS-05 | 对齐：中间标签居中；**首尾标签是否贴绘制区边缘取决于数据是否贴边**（如折线满幅时首尾贴边对齐）；居中标签越界时向内回收 | `core/axis.js` → `renderXLabels()` 的 `flushFirst/flushLast` | ✅ |
| AXIS-06 | 碰撞处理（相邻净距 < **8px** 触发，主题分化）：<br>THS / Ainvest —— 整体改 **3 段式**（只留首/中/尾）；<br>iFinD-PC —— **隐藏碰撞标签**（后来者让位，首尾始终保留） | `renderXLabels()` 的 `collision: 'segment3' \| 'hide'` | ✅ |

## 轴刻度线（Tick Marks）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| AXIS-07 | 默认**不显示**（全主题）。启用时：长 3px；粗细走 `size-grid-line`、颜色走 `color-visualization-divider`（与网格线同源） | `core/grid.js` → `renderTicks()` | ✅ |

## 样式 token（X / Y 共用，主题 × 端差异收在 tokens）

字号 `font-size-axis` · 行高 `line-height-axis` · 颜色 `color-text-axis` ·
字重按主题分化（THS/iFinD `font-weight-medium`、Ainvest `font-weight-regular`），
实现经 `--font-weight-axis` 读取。

**数值显示格式随主题分化**（THS 万/亿、Ainvest K/M/B/T）：见 [format.md](format.md)
的 FORMAT-01，参数经 behavior.json 的 `number-format` 键下发。

## 待办

- [x] 轴标签级间距 token 化：`SAFE_GAP` → `--spacing-axis-y-inset-gap`（AXIS-01 inside 数据让位安全间距）、`MIN_X_GAP` → `--spacing-axis-x-label-min-gap`（AXIS-06 X 碰撞阈值），三主题以 `{spacing-8}` 别名录入 `$section-08`，值不变。**frame.js 绘制区几何留白**（`Y_LABEL_GAP_OUTSIDE` / `X_GAP_TOP_INSIDE` / `X_GAP_TOP_OUTSIDE_EXTRA` / `X_GAP_BOTTOM` / `EDGE_PAD`）本轮不并入，保留字面量——注：ainvest 的 X 带上间距规范为 4px（现常量统一 6px），token 化时一并按主题分叉修正
- [ ] frame.js 绘制区几何留白 token 化（承上，含 ainvest X 带上间距 6→4 的主题分叉修正）。注：`EDGE_PAD` 已整体移除——outside 无标签侧、xBand:false 底部、inside 顶部全部归零（贴边）；图例与 grid 的间距由图例容器 padding（`--spacing-legend-container-v-bottom`）唯一承担，frame 不重复垫
- [x] `--font-weight-axis` 并入 token 合同：三主题以别名录入（THS/iFinD `{font-weight-medium}`、Ainvest `{font-weight-regular}`），经 `tokens/build.mjs` 输出为 `var(--font-weight-*)`
- [x] AXIS-02 iFinD 双 Y「两侧共用一份标签」镜像模式：`y-dual-shared` 开关驱动，`mirror = y-dual-shared && !dual`（单系列/同量纲时反侧镜像主轴同一套；真·双量纲走标准 dual 两侧各一套不同值——已按此决定落地并预览验证）
- [ ] AXIS-02 遗留：「副 Y 出现条件」（量纲/数量级判断）的自动化——当前靠调用方显式声明 `axis:'secondary'`，自动判定留给 L2 组件
- [ ] inside 布局下 0 轴标签是否省略——沿用"不越下沿"规则，暂不省略
- [ ] 缩放轴（datazoom）本体的规范化组件（SCALE-02 联动逻辑已验证，夹具已随 dev 预览移除）
- [ ] AXIS-07 刻度线方向：inside 布局网格铺满画布，刻度线只能向内画（向外会被裁）——方向规则待规范确认
