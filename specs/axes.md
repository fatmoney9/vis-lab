# 直角坐标系 · 轴与网格规范（条目化索引）

> 权威源：`vis-design-system lite/references/components/axes.md`（形态细节表述以原文为准）。
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
| GRID-03 | **容器自适应**：容器宽/高变化时几何整体重排——绘制区随容器、分割线数量不变（SCALE-01 不受尺寸影响）、X 轴标签碰撞重新判定 | `core/frame.js` → `observeResize()` + 重建 | ✅ |

## Y 轴标签

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| AXIS-01 | 两种布局，代码取值 `inside` / `outside`（对应原文形式 A / B），**默认 `inside`**。<br>**inside（形式 A，网格内部 + 避让网格线）**：网格左右铺满画布，Y 标签紧贴网格侧边、不设内部偏移；最顶标签顶对齐贴顶线向下（不得高过绘制区上沿——最常见错误）；其余标签底对齐贴线上方；0/最底标签不越下沿；**数据让位**：有标签一侧数据边界收缩「最长标签宽 + 安全间距」。<br>**outside（形式 B，网格外部 + 与网格线居中）**：标签在绘制区外侧，与网格线上下居中，距网格 **8px**；顶/底标签允许超出绘制区约半个行高（上下留白由 frame 预留）；不收数据范围 | `core/axis.js` → `renderYLabels()` + `yLabelInset()`；留白在 `core/frame.js` | ✅ |
| AXIS-02 | Y 轴位置（主题默认）：主 Y —— THS 左 / iFinD-PC 左 / **Ainvest 右**；副 Y 相反侧。双 Y：iFinD-PC **左右两侧共用一份标签**（非两根轴）。**副 Y 出现条件**：多系列量纲/数量级不同，或线柱组合（柱/折线各一轴）；量纲相同共用主 Y | 主题→位置/形式映射经 `tokens/behavior.json` + `core/theme.js` 生效；双 Y 已实现（副 Y 反侧 + 双侧标签列/数据让位 + SCALE-04 刻度对齐）；iFinD 两侧共用一份未实现 | ✅ / 📋 iFinD 镜像 |
| AXIS-03 | 标签对齐**贴轴线一侧**、随位置自动（内/外、左/右均适用） | `renderYLabels()` 的 anchor 逻辑 | ✅ |
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

- [ ] inside 安全间距（8px）→ token 化候选（outside 列宽策略已定为 AXIS-08 一次性渲染测量）
- [ ] `--font-weight-axis` 并入 token 合同（当前 99 个 key 不含它，需三主题补齐）
- [ ] AXIS-02 遗留：iFinD 双 Y「两侧共用一份标签」镜像模式；「副 Y 出现条件」（量纲判断）的自动化留给 L2 组件
- [ ] inside 布局下 0 轴标签是否省略——沿用"不越下沿"规则，暂不省略
- [ ] 缩放轴（datazoom）本体的规范化组件（SCALE-02 联动逻辑已验证，夹具已随 dev 预览移除）
- [ ] AXIS-07 刻度线方向：inside 布局网格铺满画布，刻度线只能向内画（向外会被裁）——方向规则待规范确认
