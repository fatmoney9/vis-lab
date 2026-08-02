# 饼图 / 环形图 · 规范（条目化索引）

> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：**无坐标系的占比图**——饼图（实心）与环形图（中空）。两者不按名字分体，而是
> 同一个 `PieChart` 的一个旋钮 `variant`（`'donut'` / `'pie'`），沿用 [bar.md](bar.md) 的先例：
> 变体是取值组合，不是两份组件。
> 分层：本族**新开一套 L2 骨架**（`charts/charts/pie/`），与 `CartesianChart` 平级、互不依赖——
> 它没有类目轴、没有值域刻度、没有网格，`scale` / `grid` / `axis` / `datazoom` / `crosshair`
> 整条 L1 链路都不适用；但**通用构件全部原样复用**：图例、数据标签、tooltip、水印、取色、
> 格式化、主题解析、画布骨架。本页只写「扇区自己的规则」，通用规则各回其家：
> 取色 → [color.md](color.md) COLOR-08 · 图例 → [legend.md](legend.md) · 标签 → [data-label.md](data-label.md) ·
> 浮层 → [tooltip.md](tooltip.md) · 动效 → [motion.md](motion.md) · 水印 → [watermark.md](watermark.md)。

## 扇区几何

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PIE-01 | **值 → 角度**：每扇区角 = `v / 可见项之和 × 360°`，**起始 12 点方向、顺时针**。<br>**`null` 与 `≤ 0` 不占角、不画**（与 [bar.md](bar.md) BAR-01「null 跳过」同口径）：占比是「对总量的份额」，负份额没有几何表达；`0` 也**不占位**——柱有 `size-zero-bar-placeholder` 1px 贴基线的表达，扇区的对应物是「0 角度」= 不存在，与 BAR-05 堆叠段「0 不占位」同口径。它们同样不进分母。<br>**绘制序 = 声明序 = 图例序，不按值排序**：排序会让同一实体在数据变化时换色，与 COLOR-04「颜色跟随实体、不跟随排名」直接冲突。<br>扇区间**无间隙**（`padAngle = 0`）、**无圆角** | `charts/charts/pie/geometry.js` → `sliceAngles()`；`charts/charts/pie/index.js` | ✅ |
| PIE-02 | **半径与环宽**：圆心 = 绘图区中心；<br>**外半径 `R = min(--size-donut-radius, min(绘图区宽, 绘图区高) / 2)`** —— token 是上限，空间不足时收缩（同 BAR-03 柱宽「上限 + 放不下就收缩」的口径）；<br>**环宽等比跟随** `ring = --size-donut-ring-width × R / --size-donut-radius`，内半径 `innerR = R − ring`——收缩时保持本主题的环宽:半径比不变，与 BAR-02「柱与间距按同一比例等比缩小」同一先例。**尺寸按主题分化、比值不分化**：THS / iFinD-PC `70 / 28`、Ainvest `80 / 32`，两者的环宽:半径比都是 **0.4**，故等比收缩这条规则跨主题成立、L1 无需知道是哪个主题；<br>**`variant: 'pie'` → `innerR = 0`**（`ring` 不参与，退化为实心饼）；<br>**可用空间**：调用方明确给容器高度时按容器算，未给时用 `--size-donut-container`（三主题当前均 160px 方形）作默认包络，判定口径同 [axes.md](axes.md) GRID-03（`clientHeight >= 40`）。上下结构下还要先扣掉图例占位与间距，剩下的才是环可用的高。<br>**画布 = 环的外接方框（2R），不留任何富余**——半径被 token 封顶后，多出来的画布**不会让环变大，只会变成环与图例之间的死空间**，且随容器尺寸浮动，与 PIE-09「间距恒定」直接冲突。故画布尺寸由图元反推，而不是图元去适应画布。<br>两个后果：① 可用空间必须从**图表根元素**量，不能从绘图区量（绘图区已贴着画布，拿它当输入会形成「画布依赖画布」的循环）；② 创建画布时要关掉 `createFrame` 的最小网格高（`minGridHeight: 0`）——那个下限是轴图的可读性兜底，对无轴图只会把画布重新抬高、再造出死空间。<br>⚠️ **容器与半径当前不自洽**：容器要容下的是「圆 + 圆外的标签带」，即 `容器 ≥ 2×半径 + 标签带`。THS 160 vs 2×70=140 尚余每侧 10px；**Ainvest 160 vs 2×80=160 余量为 0**。本切片标签在扇区内、不吃圆外空间，故暂不影响渲染（`R = min(token, 短边/2)` 恰好取到 80）；外侧标签 + 引线落地时该值必须重取，见待办。<br>饼图不另设尺寸 token，共用 `size-donut-*`（见待办） | `charts/charts/pie/geometry.js` → `donutRadii()`；`tokens/*.json §20` | ✅ |

## 图例与显隐

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PIE-03 | **每个扇区一个图例项**（不是「每个系列一项」——饼环的一个扇区就是一个实体）。marker 类型传 `'dot'`，三主题天然命中 [legend.md](legend.md) LEGEND-03 已写明的「饼/环/气泡/雷达 6×6 圆点」：THS / iFinD-PC 走各自 `legend-marker.shapes.dot`、Ainvest 走 `unified` 恒圆点——**`behavior.json` 无需新增任何键**。<br>点击显隐复用 `applyToggle`（LEGEND-06 两模式）；**隐藏后剩余扇区按可见项重算角度、重新闭合 360°**（同 BAR-05「隐藏系列按可见重算」）；图例 hover 弱化其余扇区走 LEGEND-05 的 `opacity-visualization-dim`。<br>**颜色不随显隐重排**（COLOR-04 / COLOR-08）——隐藏一个扇区只改角度，不改任何扇区的颜色 | `charts/charts/pie/index.js`（复用 `core/legend.js` 的 `renderLegend` / `applyToggle`） | ✅ |

## 图例布局

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PIE-09 | **饼环支持两种图例布局**，形态定义见 [legend.md](legend.md)——排布方向 LEGEND-01、方位 LEGEND-10、纵列溢出滑动 LEGEND-11；本条只定「支持哪几种、默认哪种、各自怎么配」：<br>· **`legend: 'right'` —— 左右结构（饼与环的共同默认）**：图左、图例右，图例纵向单列从上到下、左对齐，整列与绘图区垂直居中对齐。**默认不因 `variant` 分化**——饼和环都从左右结构起步。<br>· **`legend: 'bottom'` —— 上下结构**：图上、图例下，图例横向**居中**、行宽不足自动换行。<br>**不支持 `top`**：图例在上是直角坐标图的形态（LEGEND-04），饼环的设计源里没有这种排布。<br>**图与图例的间距 = `spacing-legend-chart-gap`（三主题 24px）**，两种结构共用同一个 token；图例朝向图那一侧的容器内边距（`spacing-legend-container-*`）清零，避免与之叠加成双份。<br>**整组居中**：两种结构下绘图区都**不撑满剩余空间**，而是贴着环的外接方框成块（边长 2R，见 PIE-02），「图 + 间距 + 图例」作为一组在容器内居中——撑满的话图例会被推到容器边缘，且中间多出的空白随容器浮动，间距就不恒定了。左右结构额外把画布定成正方形（宽也传 2R）；上下结构只定高，宽度铺满、环在其中水平居中即为整体居中（横向富余不夹在环与图例之间，不影响间距）。<br>**由调用方按场景选**（宽扁卡片走 `right`、窄高卡片走 `bottom`），是「要哪种形态」的语义配置而非样式参数——同 `variant`，尺寸/间距/字号仍全走 token（WORKFLOW 铁律4）。**不进 `behavior.json`**：三主题同一套形态，不是主题分叉。<br>**DOM 顺序恒为「绘图区 → 图例」**，方位只由容器 flex 方向切（LEGEND-10）——这与 `CartesianChart` 相反（那边图例 DOM 在前 = 在上），是本族唯一的骨架差异 | `charts/charts/pie/index.js`（DOM 顺序 + `.dv-chart--legend-*` 修饰类 + 推导 `layout`/`align`）；`core/legend.js` → `renderLegend()` 的 `layout` | ✅ |

## 数据标签

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PIE-04 | **默认不显示**（`dataLabel: 'auto'`）——权威定义在 [data-label.md](data-label.md) LABEL-05（饼环是其「一个类目一个值就出标签」原则的明确例外：占比由扇形本身表达、名称由图例承载）。本条只定**开启后**怎么摆：<br>**锚点** = 扇区中线方向 × **环带中心半径** `rm = (R + innerR) / 2`（`variant:'pie'` 时即 `R / 2`，一条公式两种形态通吃）。<br>**走档②**（LABEL-04）：标签压在扇区填充上，按该扇区色的 WCAG 相对亮度自动切浅底深字 / 深底浅字。<br>**`collide: false`** —— 扇区标签环绕四周、本就不同行，同行碰撞过滤不适用（`core/label.js` 的 `collide` 开关正是为此预留）。<br>**「放不下就不放」由几何判定收口**（LABEL-06③）：`maxWidth = min(rm × Δθ, ring)` —— 取「切向弧长」与「环宽」的较小者，**与扇区落在钟面哪个方向无关**，故对任意角度都成立且偏保守；另外 `ring < --line-height-data-label` 时整层不出。<br>**不套用 LABEL-06① 的「非 null 值 > 5 整体不出」**：那条阈值是按类目宽度定的柱线经验值，对扇区没有对应含义——扇区能不能放下完全是几何问题，由上面一条判。THS 环宽仅 28px，长数值下标签自然大量隐去，属预期（同 LABEL-06③ 对 THS 16px 柱宽的既有说明）。<br>文本走与 tooltip 同一份 `makeFormatter`（LABEL-07 / [format.md](format.md) FORMAT-01）显示**原值**；占比数值见待办 | `charts/charts/pie/geometry.js` → `labelAnchor()`；`charts/charts/pie/index.js`；`core/label.js` → `renderDataLabels` | ✅ |

## hover 与浮层

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PIE-05 | **按扇区命中触发**（不是 [tooltip.md](tooltip.md) TOOLTIP-10 的「按 X 坐标最近类目」——无坐标轴，没有「最近类目」可言）：指针进入某扇区图元即触发该扇区，移出绘图区按 `--tooltip-hide-delay` 延迟隐藏、页面或祖先滚动时立即隐藏（这两条与 TOOLTIP-10 一致）。<br>**位置档恒 `follow`** —— 消费 TOOLTIP-07 的「无坐标系图 → follow」特例。**不进 `behavior.json`**：这是图表形态规则、不是主题分叉（三主题一致），故按 [axis-title.md](axis-title.md) / [data-label.md](data-label.md) 的先例在 L2 定死并回引 TOOLTIP-07。<br>**气泡内容**：标题行 = `cfg.name`（这组数据的名字，如「营收构成」）——**缺省时整行不渲染**（不是渲染空行：空标题行仍会占 `spacing-tooltip-row` 与 iFinD 的分割线边框，露出一条孤立横线）；数据行 = **命中扇区一行**，marker 圆点与图例同源、数值走同一份 `makeFormatter`（TOOLTIP-02）。<br>**无 X 指示线（TOOLTIP-08）、无轴标签贴片（TOOLTIP-09）**——无轴可指、无标签可贴 | `charts/charts/pie/index.js`（扇区事件 + `core/tooltip.js` 的 `createTooltip`） | ✅ |

| PIE-10 | **扇区强调态外扩（主题分化，走值 token）**：被强调的扇区**外半径 + `size-donut-hover-expand`**，**内半径不动** → 该扇区的环变厚、向外「鼓」出来。<br>**两个来源，任一命中即外扩**：<br>· **hover —— 临时态**：指针进入即扩、离开即还原；<br>· **点击 —— 常驻态**：点击选中后保持外扩，**单选**（再点自己取消、点别的移过去）。选中态**跨重建保留**——resize / 图例显隐会整树重绘，选中不该因此丢失（同 `hidden` 集合的处理）。<br>两者独立叠加：选中 A 时 hover B，A 与 B 同时外扩，指针离开 B 后只剩 A。<br>**Ainvest `10px`**（外半径 80 → 90）· **THS / iFinD-PC `0px`**（无此效果）。<br>**用值 token 而非 `behavior.json` 分叉**：0 即天然无形态，组件里不需要任何 `if (theme === …)`——沿用 BAR-01 的先例（`radius-bar-top` 在 iFinD / Ainvest 为 0，所有柱自然保持直角）。<br>**层级**：外扩的扇区会压住相邻扇区，故命中时把它抬到扇区层最上（DOM 序 = 绘制序，同 PIE-07）。<br>**画布不为外扩预留**：画布仍是常态环的外接方框（2R，PIE-02），外扩部分溢出画布绘制（`.dv-chart__plot > svg { overflow: visible }`）。若为它预留，静止状态下环与图例的间距就会变成 `24 + expand`，与 PIE-09「间距恒定 24」冲突——**静止态的正确性优先，hover 是临时态**。<br>**与入场扫掠共存**：外扩改的是 `outerRadius`、扫掠改的是角度，两者落在同一个逐帧闭包里；hover 重绘沿用当前扫掠进度，故动画途中 hover 不会让扇区瞬间跳到终态 | `charts/charts/pie/index.js`（`activeKey` + 逐扇区 `outerRadius`）；`tokens/*.json §20` | ✅ |

| PIE-11 | **外扩带过渡，不硬切**：强调态的外扩量以 `motion-duration-emphasis`（三主题 200ms）+ `cubicOut`（MOTION-03 同一条曲线）补间。<br>**从当前值补间、不从 0 重来**：快速划过一排扇区时，每个扇区都从它此刻的外扩量接着走，不会先跳回原位再长——故实现上逐扇区记录「当前外扩量」，渲染只读这个数，不读布尔状态。<br>⚠️ **与 `runGrowth` 的打断语义有冲突，接线顺序要紧**：`runGrowth` 的 cancel 是「立即落终态」（MOTION-04 为**一次性入场**定的：被打断即刻到位、不半途回退）。强调态却会被反复打断，若先 cancel 再读当前值，读到的是上一轮的**终点**，新补间从终点起步 = 肉眼可见的硬切。正确顺序：**先读当前值 → cancel → 把被落到终态的量改回打断瞬间 → 从那里补间**。这条不改 L1（入场依赖原语义），在 L2 消化。<br>**重建不补间**：resize / 图例显隐会整树重绘，那是重新出图不是状态切换，选中的扇区应当**已经**是外扩的（外扩量初值直接取目标值）。<br>**时长远短于入场**（480ms）：入场是一次性的叙事，hover 反馈是即时应答，拖到半秒会显得迟钝。<br>[MOTION-07] 系统「减弱动态效果」下时长归零、直接落终态。<br>⚠️ 本条**不与 [tooltip.md](tooltip.md) TOOLTIP-10「无过渡动画」冲突**：那条管的是气泡 / 指示线 / 轴贴片这条浮层链路（瞬移跟随），本条管的是**图元自身的几何**，属 [motion.md](motion.md) 所说「由各图表规范页自行定义的图表专属动效」 | `charts/charts/pie/index.js`（`animateEmphasis` + 逐扇区外扩量）；`core/motion.js` → `runGrowth`；`tokens/*.json §23` | ✅ |

## 入场生长

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PIE-06 | **角度扫掠**：所有扇区的起止角**同乘进度 `t`**，于是整环作为一个整体从 12 点顺时针扫开，各扇区在生长前沿扫过时依次显形、**全程占比正确**。这与 MOTION-06「堆叠整根一起长」是同一条思路（值空间同乘 t），不是逐扇区接力——接力会让每扇区只分到几十毫秒、且**扇区数变化时节奏不一致**。<br>**不用半径生长**（从圆心涨大）：那会让第 0 帧到中途的占比读数全是错的，而角度扫掠的任意一帧都是真实占比的子集。<br>`draw(t)` 交给同一个 `runGrowth`、时长读同一个 `--motion-duration-grow`（MOTION-02「新图表接入无需登记任何东西」的兑现）；图例 / 水印不参与、数据标签整层先藏结束后出现（MOTION-05）；`animation: false` 与系统「减弱动态效果」直接终态（MOTION-07） | `charts/charts/pie/index.js`（扇区渲染返回的 `draw(t)`）；`core/motion.js` → `runGrowth` | ✅ |

## 层级与水印

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PIE-07 | **层级 = DOM 追加顺序**（与 LABEL-08 / WATERMARK-05 同一约定）：扇区 → 数据标签层 → 水印层。<br>**水印**在 `build()` 末尾追加同一个 `renderWatermark`，锚 `frame.grid`（本族的 grid = 整块画布，因为没有轴带占位）——消费 [watermark.md](watermark.md) 的「饼环等非 cartesian 骨架接入」待办，三主题锚角与偏移仍只由 `behavior.json` 的 `watermark` 一处决定 | `charts/charts/pie/index.js` → `build()` 末段；`core/watermark.js` | ✅ |

## 画布

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PIE-08 | **无轴画布**：复用同一个 `createFrame`，传 `xBand: false`——四周留白全部为 0，`grid` 即整块画布（该分支早已在 `core/frame.js` 实现并注释，本族是它的第一个消费者）。**不新建 L1 画布模块**：饼环与 cartesian 共用同一份画布几何与 `observeResize` 重建链路，差别只是「不预留任何轴带」，属参数取值不属新构件（WORKFLOW §三「不为将来可能用到提前抽象」）。<br>图例仍在上、绘图区在下各占其高（LEGEND-04），与 cartesian 同一套 DOM 骨架 | `core/frame.js` → `createFrame({ xBand: false })`；`charts/charts/pie/index.js` | ✅ |

## 活 demo

`index.html` 与 `playground/preview.html` 的 **饼图与环形图** 分组（两个示例：`环形图` / `饼图`）：

- **三主题横排**：**Ainvest 的环明显比 THS / iFinD-PC 大一圈**（半径 80 vs 70、环宽 32 vs 28，PIE-02），
  但三者的环宽:半径比都是 0.4，粗细观感一致；扇区色各走自家色板——
  THS 从 `bar-multi` 首色浅蓝 `#52BBFF` 起、iFinD 24 色盘、Ainvest 8 色盘（COLOR-08）；
  图例 marker 三主题**都是圆点**（与柱状图示例的方块 / 折线短横对照，LEGEND-03）。
- **数据标签默认不出**（PIE-04 / LABEL-05 的例外）：右栏 **数据标签** 旋钮「默认」与「全关」
  对饼环表现一致，切「全开」才在扇区内画（档② 按扇区色反色）。
- **数据量 少 4 / 中 16 / 多 36**：36 扇区压色板循环（THS 7 色循环到第 8 个扇区回到首色）；
  扇区数变化不改变动效节奏（MOTION-02）。开着标签时数据量↑可看它们按环宽 / 弧长逐个隐去（PIE-04）。
- **点图例**：隐藏一个扇区 → 剩余扇区重算闭合 360°，**其余扇区颜色一个都不变**（PIE-03 / COLOR-04 的验收点）；
  hover 图例项 → 其余扇区降到 `opacity-visualization-dim`。
- **hover 扇区**：三主题气泡**都走 follow**（与柱线示例的 THS `side-fixed` / Ainvest `top-anchor` 形成对照，
  这是 TOOLTIP-07 特例的验收点）；无指示线、无轴贴片。
- **入场动效**：顺时针扫掠，与同页柱线卡片**同时起跑同时到达**（MOTION-02）；关掉后与不带动效逐像素一致。
- **图例布局**（PIE-09）：两个示例都不带 `legend`，走组件默认的**左右结构**——
  图与图例相邻成组、**整组水平居中**，间距 24px；环形与饼图默认一致，不因 `variant` 分化。
  playground 右栏 **图例** 旋钮切 `上下` 可看另一种：图上、图例下横向居中换行。
  **图例永远在图之后**（DOM 与视觉都是），没有「图例在上」这一档——那是直角坐标图的形态。
- **旋钮显隐**：本族详情页**不出现**缩放轴 / 轴标题 / 渐变面积开关（`CHART_CAPABILITIES` 未声明），
  只剩数据标签、图例布局与入场动效——这是两个预览面「按能力画旋钮」的验收点。
- **拖拽卡片改尺寸**（playground）：半径按 PIE-02 收缩、环宽等比跟随，环宽:半径比全程不变。

## Do / Don't

- ✅ **Do**：改环的尺寸 = 改 `tokens/*.json §20` 的 `size-donut-*`（三主题同步，合同校验会拦）；
  改扇区取色 = 改 `tokens/palette.json` 或 [color.md](color.md) COLOR-08，不是给 API 加参数；
  新增的扇区专属几何留在 `charts/charts/pie/geometry.js`（标 `[L2-LOCAL]`）并保持纯函数可单测。
- ❌ **Don't**：把扇区几何下沉 `core/`（只有这一个 L2 用得上，WORKFLOW §三）；
  为「无坐标系图用 follow」给 `behavior.json` 加键（那不是主题分叉，见 PIE-05）；
  按值给扇区排序（COLOR-04）；用半径生长做入场（PIE-06）；
  给 API 加 `startAngle` / `padAngle` / `innerRadius` 一类的样式参数（铁律4——`variant` 是形态语义、
  尺寸走 token）；把「放不下就不放」的判定复制进 L2（通用规则在 `core/label.js` 内置，L2 只给 `maxWidth`）。

## API

```js
PieChart(host, {
  name,                     // 可选：这组数据的名字，tooltip 标题行（缺省不渲染标题行，PIE-05）
  items: [{ name, value }], // 扇区列表；null / ≤0 不占角（PIE-01）
  variant = 'donut',        // 'donut' 环 / 'pie' 饼 —— 形态语义，非样式参数
  legend = 'right',         // 'right' 左右结构 / 'bottom' 上下结构（PIE-09）—— 同上，形态语义
  platform = 'pc',          // 参与 behavior 解析
  dataLabel = 'auto',       // 'auto' 按 PIE-04 默认 / true 全开 / false 全关
  animation = true,         // 入场生长开关（MOTION-07）
})
```

颜色、半径、环宽、字号、间距一律走 token 与色板，API 一概不收（铁律4）。

## 待办

- [ ] **外侧标签 + 引线**：设计源写的是「标签在环外、`color-text-primary`、引线跟随扇区色」
      （见 [data-label.md](data-label.md) 待办）。落地需要三样东西：一档新的标签前景色（现只有
      LABEL-03 档① 跟随系列色 / LABEL-04 档② 按底色反色）、引线图元与其样式、以及左右分栏的纵向避让算法。
      本切片先走扇区内档②（PIE-04），外侧标签整块留作下一刀。
- [ ] **占比数值**：当前标签与气泡都显示**原值**（与轴 / tooltip 同一份 `makeFormatter`，FORMAT-01）。
      饼环的核心读数是占比，但「显示成 `32%` 还是 `1,234（32%）`、小数位取几位、四舍五入后不足/超过 100% 怎么配平」
      设计源均无表述，凭空定会和将来的设计稿打架。待设计源明确后落，届时给 `format.md` 补一条占比口径。
- [ ] **环形中心文案**：环中心常放总计 / 标题，仓库无对应 token、设计源亦无表述。待设计源给出
      字号 / 字重 / 颜色后落，届时给三主题 `$section-20` 同步补键。
- [ ] **`size-donut-container` 与半径的自洽性**（随外侧标签 + 引线一并定）：容器的职责是「圆 + 圆外标签带」，
      即 `容器 ≥ 2×半径 + 标签带`。当前 THS 160 vs 2×70=140（每侧余 10px）、**Ainvest 160 vs 2×80=160（余量 0）**——
      Ainvest 这一组在引线落地后必然放不下。本切片标签在扇区内、不占圆外空间，故暂不影响渲染，先不猜值。
      届时两条一起定：容器取多大、标签带占多宽。
      **注意容器不是纯装饰**：它同时是组件未拿到显式高度时的默认高度包络（同 cartesian 的 `size-chart-region-height`），
      改它会直接改变默认渲染尺寸。
- [ ] **饼图独立尺寸 token**：当前饼图复用 `size-donut-radius` 作外半径（`ring-width` 不参与）。
      设计源只记录了环形图的尺寸。若将来给出饼图自己的尺寸，补一个 `$section` 并三主题同步。
- [ ] **扇区圆角与间隙**：当前 `padAngle = 0`、扇区端无圆角。原体系未定义，待设计源。
- [x] **扇区强调态外扩** → PIE-10（hover 临时 + 点击常驻单选；Ainvest 外半径 +10、另两主题不扩，走值 token）。
- [ ] **选中态的余项**：当前点击只改几何（外扩）。是否要同时联动别的表现——如未选中扇区降透明度、
      气泡常驻、与 [tooltip.md](tooltip.md) 的「点击分片选中」对齐——原体系未表述；多选、以及
      「选中的扇区被图例隐藏后选中态如何处理」也未定义（当前：该扇区不渲染，选中键仍留着，
      再显示出来仍是选中）。
- [ ] **小占比合并为「其他」**：36 扇区时尾部大量极窄扇区既读不出也点不中。合并阈值与「其他」的
      命名 / 取色原体系未定义。
- [ ] **移动端触摸**：扇区命中的触摸接线随 [tooltip.md](tooltip.md) 的移动端触摸切片一并落。
