# 雷达图 · 规范（条目化索引）

> 设计源在两处自相矛盾，均已在下表逐条裁决并写明理由（RADAR-07 的轴标签数值、RADAR-09 的半径）。
> 可调节态的文字环绕标签（RADAR-14）与分区雷达（RADAR-15）已实现；虚线与加载态尚未实现，见「待办」。

## 分层边界

- **L1 `charts/core/`**：画布与 resize、token / behavior 解析、格式化、真实文字测量与截断、刻度数学、值→像素比例尺、图例、Tooltip、水印、动效，以及**绕圆标签几何**（`polar-label.js`：极坐标→直角、八向锚点、可读弧线、标签带宽）。能力只接收通用参数，不认识雷达变体、主题名或业务字段。
- **L2 `charts/charts/radar/`**：本族专属的极坐标几何（轴角均分、值→半径、同心环、扇形命中）与闭合形状装配，以及把维度语义交给 L1。L2 不维护颜色、字体、文字宽度估算、绕圆标签几何或 Tooltip 骨架的副本。
- **L3 `demos/` 与预览面**：示例数据、主题演示、业务字段到 `dimensions` / `series` 的映射，以及面板控件。

### 极坐标系 ≠ 雷达图

**雷达图是图表类型，极坐标是坐标系**——后者上面还能画玫瑰图、极坐标柱状图、气泡图，饼环本质上也是。二者不可互换指代。

真正决定分族的不是坐标系，而是**数据映射到哪个维度**：

| | 角度 | 半径 |
|---|---|---|
| 饼 / 环（[pie.md](pie.md)） | **= 数据**（值越大扇区越宽） | = 常量（容器 + token 算出的 R） |
| 雷达（本页） | = 常量（`360/n` 均分） | **= 数据**（值越大点越远） |
| 弦（[chord.md](chord.md)） | **= 数据**（流量越大弧越长） | = 常量（容器 + token 算出的 R） |

三者在极坐标里做的不是同一件事：弦图与饼环同列、与雷达恰好相反。**这张表就是下沉点①至今未命中的书面依据**——弦图看着也是个圆，数学上却不占「角度均分、数据映射到半径」那一格。

真正跨族共享的只有 `(角度, 半径) → (x, y)` 那个三角公式，它与绕圆标签几何一起住在 `charts/core/polar-label.js`。**仍然不叫 `core/polar.js`**：那个名字暗示整个极坐标系都已下沉，而实际下沉的只有「绕圆摆文字」及其基元；叫错名字，下一个人就不会再来读下面这三条判断条件了。

### 三个下沉点

**下沉点 ①：极坐标骨架**（`axisAngles` / `seriesPoints` / `ringRadii`）—— ⏳ **未命中，仍在 `radar/geometry.js`**
**判断条件**：仓库里出现**第二个**「角度按 `360/n` 均分、数据映射到半径」的图型。
- 会触发：玫瑰图 / 南丁格尔图——扇区等角、半径随值变，同一套数学。
- **不会触发：极坐标柱状图**。它的角度方向是**一根真正的轴**（一根 `angleAxis` 上排若干类目），不是均分出来的常量位置；看着像，数学不是一回事。
- **不会触发：弦图**。见上表——角度∝数据、半径=常量，与本族相反。
- 命中后：三个函数移到 `charts/core/`，两族共用；补 `charts/core/README.md` 构件清单，并给当时每一族 L2 的 L1 复用声明各加一行。

**下沉点 ②：绕圆标签几何**（`labelAnchor` / `labelArc`）—— ✅ **已命中并下沉**
**命中者：`ChordChart`**（[chord.md](chord.md)）。弦图的实体名沿外圈弧切向环绕，要回答的问题与雷达维度标签完全相同：*我在圆的哪一侧 → 用什么对齐方式、弧线是否需要反向*。
- **落点 `charts/core/polar-label.js`**（零 import，故 pie / radar / chord 三族的几何模块仍可被 `node --test` 直接加载）。随两项标签几何一并搬走的还有基元 `pointAt()` —— 留在 L2 就等于让弦图写出全库第三份三角式（`pie/geometry.js` 曾内联一份）。
- **按当年写下的判断执行，没有重写**：两个函数的签名一个字没改，单测断言原样通过。这正是当初把签名定成「只收角度、半径等纯几何参数」的目的。
- 原判断里提到的**仪表盘**仍未出现；它出现时直接 import 同一份，不再是新的下沉点。
- **饼环从来不算第二方**：`pie/geometry.js` 的 `labelAnchor(a0, a1, R, innerR)` 吃的是一个扇区的两个角、返回 `{x, y, maxWidth}`，外侧标签只分左右两侧，没有八向逻辑。两个同名函数**不是一回事**，别互相替换。

**下沉点 ③：标签带「吃剩下的」公式**（`clamp(0, (avail − 2R)/2, maxBand)`）—— ✅ **已命中并下沉**
**第三个消费方：`ChordChart` 的 `entityLabelLayout: 'horizontal'`**。
- **落点同为 `charts/core/polar-label.js` 的 `labelBand()`**，不另开模块：三个消费方全是径向图，公式里的 `2R` 就是直径，它天生属于极坐标画布几何；而每新增一个 L1 模块都会让**全部** L2 的复用声明各加一行，能付一次就不付两次。
- **不能落在 `core/frame.js`**：它 `import 'd3'`，而 `pie/geometry.js` 与 `radar/geometry.js` 被 `node --test` 直接加载，一旦接上 d3 链路两族单测立刻全红。
- 调用形态的差异留在各自 L2：饼环在外层取整（[PIE-13]「让画布落在整像素上」，函数名 `labelBandPx` 以示区别）、雷达横竖分开只有横向带走它、弦图四周等宽。

**三个下沉点互相独立**，命中 ② 不代表 ① 也该动。

## 规则

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| RADAR-01 | 数据契约 `{ dimensions: string[], series: [{name, data[]}], max?, segments? }`。维度数 **≥3**（并列维度须大于 2），少于 3 抛错——两根轴构不成面积，读不出任何形状。`data` 与 `dimensions` 等长。**负值不支持**，`null` 与负值按 0 参与闭合但不参与自动求 max，口径对齐 [pie.md](pie.md) PIE-01「不占角也不进分母」。`dimensions` 是**纯字符串数组**，理由见 RADAR-17 | `charts/charts/radar/index.js`；`geometry.js` | ✅ |
| RADAR-02 | 径向轴表示维度，为穿过中心的线段，**长度 = R**。**首轴恒在 12 点方向**，其余按 `360/n` 均分、**顺时针**排列。角度约定与 `pie/geometry.js` 同源：`0 弧度 = 12 点，正角顺时针`，故任一角 `a` 处半径 `r` 的点为 `(sin(a)·r, −cos(a)·r)` | `geometry.js` → `axisAngles()` | ✅ |
| RADAR-03 | 网格线用作数据参考，**默认同心圆**（`gridShape: 'circle'`），可切正多边形（`'polygon'`，数据项超过 6 个时建议使用）。分段数 `segments` **默认 5、最少 2**（下限 2 是硬约束，5 是设计确定的默认值）。**默认 5 环是为了配 0–5 量程时每环恰好 1 分**，环与刻度读数一一对应；4 环时每环 1.25 分，环上读不出整数。<br>⚠️ 2026-09-02 由 4 改 5。改的是**组件默认值**（`index.js` 与 `geometry.js` 的形参默认、示例统一走 `RADAR_SEGMENTS` 常量），不是只改示例——不传该参数的新图也是 5 环。**间隔填充是「一环一色」的环带**——相邻两环之间的那圈，不是整圆；**最外圈不填、保持页面底色**。<br>⚠️ 实现上必须是「外轮廓 + 内轮廓 + `fill-rule="evenodd"`」把内圈挖空。直接给整圆上 `fill` 是错的：内圈的圆会盖住外圈，填充一路铺到圆心，看起来像「中间几环全被涂满」——2026-09-02 就是这么错过一版，且**门禁全绿、单测全过**（几何是对的，错的是绘制方式），只能靠眼睛发现。<br>**`gridShape` 是组件配置而非主题分叉**——同一主题下圆形与直线两种都要提供，说明它是图表形态选择、不是品牌差异，故不进 `behavior.json`（判据同 [legend.md](legend.md) LEGEND-10）。<br>⚠️ **间隔填充按主题分化**：THS / iFinD-PC 用 `color-background-weak` 的浅底，**Ainvest 为 `transparent`（无底）**，只留环线。这是**取值差异不是形态差异**——三家画的都是「环带」这一种东西，只是 Ainvest 那份取值为空，故走 `tokens/<theme>.json` 而**不进 `behavior.json`**（判据同上）；实现侧一行 `if` 都不加 | `geometry.js` → `ringRadii()` / `gridPath()`；`color-radar-grid` / `color-radar-grid-fill` | ✅ |
| RADAR-04 | **值域上界两条路**：给了 `cfg.max` 就以它为准、`[0, max]` 均分 `segments` 段；没给才走 `niceSplit(0, 数据max, { lineCount: segments + 1 })`。<br>**为什么必须留 `max` 这个口子**（实测）：`niceSplit(0, 5, { lineCount: 4 })` 得到 `max 5.4 / interval 1.8`——一个「0–5 分综合评分」雷达会被画成 0–5.4，且**两张图数据不同时量程不同、形状不可比**，而横向对比正是雷达图存在的理由。评分类量程是业务口径，不是算出来的。<br>**坐标轴刻度数字默认不展示**——刻度值受分段影响，不建议使用，故 `niceSplit` 在本族的产出**只用来定上界与环数，不渲染文字** | `geometry.js` → `radarDomain()`（`niceSplit` 经参数注入）；`core/scale.js` → `linearY(split, R, 0)` | ✅ |
| RADAR-05 | 连接各维度数据点形成**闭合多边形**。`shape: 'straight'`（默认，直线闭合）/ `'curve'`（曲线闭合，AInvest 默认形态）。**曲线态默认隐藏数据圆点** | `geometry.js` → `seriesPoints()`；`index.js`（`d3.curveCardinalClosed`） | ✅ |
| RADAR-06 | 多边形支持色彩填充：**默认态填充 10% 不透明度**（用于突出主体数据）；**选中整组时填充本色、非选中态压到 24%**。描边恒为系列本色、不随填充变化。<br>**描边宽度对齐折线族**：`size-radar-area-stroke` 别名 `size-line-stroke`（THS 1.5 / iFinD-PC 2 / Ainvest 2）。<br>⚠️ 2026-09-03 修正：此前别名的是 `size-grid-line`（PC 1px / 移动 0.5px），把**数据图元**按**网格发丝线**画细了——闭合多边形是这个族的数据线，和折线是同一种角色，理应同宽。数据点 `size-radar-point` 早已别名 `size-line-point`，本次是把线宽补齐到同一口径。<br>**不套用 `size-line-stroke-multi` 的「主线粗、其余细」**：那条建立在「首条声明线是主线」的层级上，而本族各系列是**平权的对比对象**（见 RADAR-17：共用一把标尺就是为了比形状与面积），给首条加粗会凭空造出一个数据里没有的主次。<br>**层级：面全在下、线全在上，层内声明在前的系列压在最上。**<br>⚠️ 2026-09-03 修正：此前是逐系列一个 `<g>`、面与线一起叠，于是**后一个系列那层 10% 的面盖在前一个系列的线上**，线被冲淡一档——谁被冲淡纯看声明顺序，是个说不出道理的差别。改为面、线各自成层：没有任何线会被面压；层内倒序追加，声明在前的系列画在最上。<br>⚠️ 分层的连带代价有两处，改动时不要漏：① 面不再是系列 `<g>` 的后代，**取色要自己写一份**（`currentColor` 继承不到）；② 弱化要**两层各压一次**，只压系列 `<g>` 会出现「线淡了面没淡」 | `opacity-radar-area` / `opacity-radar-area-dim`；`size-radar-area-stroke`；`charts/styles.css` | ✅ |
| RADAR-07 | 轴标签展示维度名称，**从 12 点方向起顺时针排列**。`axisLabelLayout: 'horizontal' \| 'arc'` 控制排列：常规雷达缺省为 `horizontal`，用八向锚点横排在径向轴外 **4px**；`arc` 的环绕几何见 RADAR-14。两档整体均不超出图内区域，超宽走 `truncateBatch` 截断而非丢弃。<br>标签字重由雷达专属 `font-weight-radar-label` 控制：THS / iFinD-PC 保持 regular（400），Ainvest 为 bold（600）；它不复用直角坐标系的 `font-weight-axis`，因此不会误改其他图表的 X / Y 轴。名称与可选数值行共用该字重。<br>`axisValue`（默认 `false`）只在横排常规标签下于名称下方加一行数值；环绕档不叠第二条数值弧，可调节态则以 slider 气泡与 `aria-valuenow` 呈现当前值。<br>⚠️ **有两条早期限制本页不采纳**：「仅 1~2 组数据时可展示数值」与「展示数值时雷达图不可交互，仅做数据展示」。两条均已被后续设计推翻——横排下三组数据的轴标签同样可带数值，且照常具备 hover 与扇形高亮 | `core/polar-label.js` → `labelAnchor()`；`core/label.js` → `truncateBatch()`；`core/measure.js`；`font-weight-radar-label` | ✅ |
| RADAR-08 | 图例默认位于图表**上方左对齐**（默认上下布局），**单系列时可省略**。marker 类型传 `'dot'`，三主题天然命中 [legend.md](legend.md) LEGEND-03 已写明的「饼/环/气泡/**雷达** 6×6 圆点」——**`behavior.json` 无需新增任何键**（同 [pie.md](pie.md) PIE-03）。点击语义复用 `legendSelect` 三档（LEGEND-06 / LEGEND-14） | `core/legend.js` → `renderLegend()`；`core/legend-state.js` | ✅ |
| RADAR-09 | 高度由宿主容器决定；容器没给时退到**本族自己的** `--size-radar-container`（同饼环的 `--size-donut-container`，**不占用三族共用的 `--size-chart-region-height`**）。容器塌到不可用高度时推迟到下一帧重画、**不抛错**。判据统一用 `containerDrivesHeight()` / `containerTookOver()`。<br>**几何与饼环 PIE-02 / PIE-13 同一口径：半径先按容器定，标签带吃剩下的，且横竖分开**（PIE-02 原文即不对称：「宽 = 2×标签带 + 2R、高 = 2×max(R, 最外标签的 \|y\|)」）。四步，无循环依赖：<br>① `bandV = 间距 + 名称行高 + (axisValue ? 数值行高 : 0)` —— 上下两根轴的标签只是**一行字**，高度看文字本身、与容器无关；<br>② `R = clamp(maxRadius × 50%, min(宽/2, (高 − 2·bandV)/2), maxRadius)`；<br>③ `bandH = clamp(0, (宽 − 2R)/2, --size-radar-label-band)` —— 横向带**吃剩余宽度、token 是上限不是定值**；<br>④ 画布 = `2(R + bandH) × 2(R + bandV)`，即**图元外接框，不吃满容器**。<br>**为什么横竖必须分开**：左右标签是整串横排（四个汉字 @12px 要 48px），上下只有一行。共用一个带的话，要么左右截断、要么上下白白多出一截空带。<br>**容器最小高度 = 图元触底时的画布 + 图例 + 间距**，由 L2 算出后写成 `--dv-radar-min-h`、约束由 `charts/styles.css` 的 `min-height` 表达（值归 L2、约束归 CSS，同饼环 `--dv-pie-legend-max-h` 的分工）。**它随标签内容自适应**：`axisValue` 关时 160px、开时 192px（纵向带 20 → 36）。低于这个高度，顶部轴标签会**叠进图例**（实测容器 158px 时叠 9px）；到达后容器再被拖小就溢出滚动、不再压缩图元。<br>**缩小时标签带先被挤掉、半径后缩**，故画布始终不超过容器；R 触到 50% 下限后改为溢出画布，由调用方裁剪（PIE-02「看得见但装不下，优于装得下但看不清」）。收缩下限**取比例不取像素**。<br>各主题：THS / iFinD-PC 半径 **80**、Ainvest **90**；横向带上限三家同为 56；容器 = `2 × (半径 + bandV)` = 200 / 200 / 220。<br>⚠️ **本条 2026-09-02 修正过两次**。其一：兜底曾接三族共用的 `--size-chart-region-height`，扣掉标签带后半径被压死，`size-radar-radius` 改什么都不生效——**症状是「改了 token 没反应」而不是报错**。其二：曾「固定扣 2×40 的带再 clamp R、画布宽吃满容器宽」，后果是容器一小就**过早溢出**（实测 280×220 即溢出，饼环同尺寸安好），且宽方向多出的画布变成随容器浮动的**死空间**——正是 PIE-02 明令禁止的那条。两次的共同教训：**无坐标系图的画布几何照抄饼环，不要另发明** | `index.js` → `createFrame()` / `observeResize()`；`geometry.js` → `radarFrame()`；`size-radar-container` / `size-radar-radius` / `size-radar-label-band` | ✅ |
| RADAR-10 | **hover 热区是扇形**（以该维度径向轴为中线的等分扇区），不是数据点——热区是径向轴区域，照数据点命中等于要求像素级瞄准。命中时该扇形叠加共享的 `color-visualization-highlight-block` 并显示气泡，气泡列出**该维度在各系列的值**。<br>**热区外缘跟着 `gridShape` 走**：圆形档是圆弧，多边形档必须沿多边形的两条半边（正多边形的角平分线恰过邻边中点，故外缘 = 前一条边中点 → 顶点 → 后一条边中点）。⚠️ 两档不能共用圆弧——多边形档照画弧，高亮块会鼓出网格之外、和边对不齐。<br>**位置档恒 `follow`**：消费 [tooltip.md](tooltip.md) TOOLTIP-07 的「无坐标系图恒 follow」通则。**不进 `behavior.json`**——这是三主题一致的图表形态规则、不是主题分叉，故在 L2 定死并回引该条（同 PIE-05 / TREEMAP-07）。移出绘图区按 `--tooltip-hide-delay` 延迟隐藏。所有扇区支持 `Enter` / `Space` | `index.js`；`geometry.js` → `sectorAt()` / `sectorCorners()`；`core/tooltip.js` → `createTooltip()` | ✅ |
| RADAR-11 | **单系列钉住**：点击某系列的多边形或其图例项 → 该系列填充本色、其余系列压到 `opacity-visualization-dim`，气泡改列**该系列在全部维度**的值。再点取消。与 RADAR-10 的扇形 hover 互不冲突——一个问「这个维度各系列多少」，一个问「这个系列各维度多少」 | `index.js`；`core/legend-state.js` → `applyFocus()` | ✅ |
| RADAR-12 | 入场动效：数据**按顺时针方向依次出现**。逐维度的出现时机由单一进度值派生（`easeOutCubic`），不各自计时；系统「减弱动态效果」下恒终态。<br>**只有闭合形状生长；网格、径向轴与轴标签自始至终可见**——这正是 [motion.md](motion.md) **MOTION-05 的主句**「只有数据图元生长，坐标系与附属元素直接就位」：轴标签在本族的地位等同直角坐标系的轴标签，是图元赖以被读懂的**参照系**，回答「这张图有哪几个维度」，与数据无关。<br>MOTION-05 那条「**数据标签**整层先藏、结束后出现」的例外**不适用于本族**——本族没有数据标签；`axisValue` 的数值是轴标签的第二行、与名称同生共死，跟着参照系一起在第 0 帧就位 | `core/motion.js` → `runGrowth()` / `easeOutCubic()` / `reducedMotion()` | ✅ |
| RADAR-13 | 虚线系列显示 | 待实现 | ⏳ |
| RADAR-14 | `axisLabelLayout: 'arc'` 时，**维度名称沿外围圆弧环绕排布**；该选项对全部雷达形态可用，可调节态为保持既有视觉默认采用此档，仍可显式切回 `horizontal`。每段标签弧占相邻轴夹角的 76%，三轴时封顶 60°，以保留轴间断口；下半圆的路径反向以保持文字正向，并由 L1 `measureInk()` 按每条文字的**真实墨迹 ascent** 外移，使标签墨迹内缘都从 `R + 4px` 开始。不得按整行高补偿——行高大于实际墨迹，会让下方标签显得更远。弧长就是 `truncateBatch` 的宽度上限，显示几何与测量口径一致。<br>⚠️ **上限取「这个标签自己那条弧」的长度，不是统一按 `R + gap` 估一个数**：下半圆的弧按字形 ascent 外移，半径大一圈、弧就长一截（实测 R80 / gap4 / 60° / ascent12 时相差 **12.6px**），统一预算会把下半圆的标签白白截短。<br>⚠️ **字形墨迹必须量未截断的原文**：拿截断后的串再量会得到另一个 ascent，于是预算与渲染又用上了两套几何——正是本条要消掉的病。实现上截断与渲染共用同一个 `arcFor(i)`，不可能再漂 | `core/measure.js` → `measureInk()`；`core/polar-label.js` → `labelArc()`；`index.js` → `<textPath>` | ✅ |
| RADAR-15 | **分区雷达图**使用 `variant: 'rating'`，只替换网格背景，不改变统一量程、图例、hover、钉住与动效链路。`ratingStyle: 'gradient'`（默认）从圆心的风险红连续过渡至外缘的优秀绿；`'bands'` 按底部阈值说明的档数均分离散同心色带。**分段档的数量只有一个来源：`ratingBandLabels.length` 同时决定彩色环带、参考环线与底部色块数量**；即使调用方另传了不同的 `segments`，组件也以说明档数为准，避免图面与说明失配。预览面提供 5 / 6 段控制，并把同一个值同时装进 `segments` 与对应说明数组：5 段为 `-2% / -1% / 0% / +1% / >+2%`，6 段为 `>-3% / -2% / -1% / +1% / +2% / >+2%`，默认 6 段。两档分别使用 [color.md](color.md) COLOR-10 的独立五档 / 六档色阶；**档数只对离散档有意义**。连续渐变固定取五档色阶（`#FF1919 / #FF8C19 / #FFE225 / #A9E010 / #03D345`），不跟随 `ratingBandLabels` 的 5 / 6 段选择变化；图内 SVG 与底部渐变条直接共用同一份五色数组，避免两处失配。六段离散色阶为 `#E50000 / #FF6619 / #FFC61A / #BFE500 / #00CC22 / #00B239`。**分区背景已承担表现色语义，数据折线及直线档数据点固定为黑色，系列面积不再填充**，避免覆盖色使图内色阶与底部纯色色块失配。圆形与多边形网格都可用：背景裁在 `gridShape` 的最外轮廓内，环线和径向轴画在背景上方保持可读。<br>**分区说明是组件内容，不是预览面装饰**：恒在雷达下方，色条上缘距雷达最外轮廓 24px；这段净距从圆 / 多边形本身计算，SVG 内为维度标签预留的下方带不重复计入。⚠️ **24px 是下限不是定值，扣减必须夹住**：标签带比它高时（`axisValue` 开启，带高 20 → 36）以标签带为准、再让开一个 `size-radar-label-gap`，而不是继续相减。曾经直接写 `24 − 带高`，开了轴标签数值即得 −12px 的负 margin，正下方那条轴标签的数值行被压在渐变条上（实测重叠 10.4px）。渐变档画同源连续色条并显示 `ratingRangeLabels` 两端文案（默认 `Risk / Excellent`）；分段档逐块显示同源颜色与 `ratingBandLabels`，每档固定 36×8px，文字与对应色块同轴居中。两项都允许调用方替换业务文案，但不允许传色值。预览面的「分区」控件只对本示例开放，默认渐变不重复写入最终 cfg | `index.js`；`demos/examples.js`；`core/visual-color.js` → `performanceColorRamp()`；`color-performance-{five\|six}-level-*`；`color-radar-rating-line`；`size/spacing-radar-rating-scale-*` | ✅ |
| RADAR-16 | 数据加载态（分布式加载组件样式）与异常态（暂无数据 / 网络异常） | 待实现 | ⏳ |
| RADAR-17 | **n 根径向轴共用一把标尺 `[0, max]`**，不做逐轴归一化。前提是调用方已把各指标归到同量纲（如都是 0–5 分）。<br>**理由是可读性，不是省事**：逐轴各自归一化（ECharts `indicator:[{name,max}]` 那种）能让不同量纲同图，但**图形面积就此失去意义**，且很容易靠调各轴量程把形状「调好看」；雷达图读的就是形状与面积。<br>故 `dimensions` 保持 `string[]`，**不预留 `{name, max}` 对象形态**——预留一个不打算实现的字段比不预留更误导。这是**明确的非目标，不是待办**；要改需先推翻本条 | `index.js`（单一 `split` 贯穿全部维度） | ✅ |
| RADAR-18 | **可调节雷达图（Adjustable Radar Chart）**是现有雷达的输入能力，不是另一套图族：`editable: true` 时在每个数据点叠加径向手柄，拖动或方向键可修改值；Home / End 直达量程两端。<br>**命名不用“交互式雷达图”**：基础形态已经有 hover、扇形高亮与点击钉住，“交互式”无法区分是否可改数据。API 也不占 `variant`：`basic / rating` 表达网格视觉变体，`editable` 与 `gridShape / shape / axisLabelLayout` 可正交组合；`shape: 'straight' | 'curve'` **两种闭合形态都支持拖动**，维度标签也可在横排 / 环绕间切换。曲线档只替换数据轮廓的插值方式，手柄仍锚同一组真实数据点；曲线与手柄内缘的接点叠加一个 **4×4px** 编辑锚点，颜色取 `color-text-tertiary`。<br>可调节态以轴上 slider 为唯一主交互，**不渲染 RADAR-10 的扇形 hover 热区**，因此鼠标经过雷达区域不会出现灰色高亮块或维度 hover 气泡；拖动 / 键盘调值时仍显示当前维度数值气泡。只支持**单系列**，多系列直接抛错——同轴多组手柄会重叠，无法辨认编辑对象。指针值取「圆心→指针向量在目标径向轴上的正交投影」，而不是到圆心的斜距；只沿轴方向的位移改变值，最终夹在统一 `[0,max]` 量程。<br>⚠️ **可调节态的量程一经建立即冻结，不随编辑结果重算**：`editable` 会原地改数据，而重建（拖容器 / 切旋钮）本会按当前数据重求上界——两者相乘的后果是用户把各点拖低后一次 resize 就把标尺缩小，已设好的值跳到外圈、`aria-valuemax` 一起变，输入控件的标尺在用户手底下漂。故首次建立后复用同一把标尺。**基础形态不冻结**，那里数据只读，重算才跟得上图例显隐带来的值域变化。给了 `max` 时两条路本就一致，此约束只对省略 `max` 的自动档有意义。**数据焦点落在手柄朝圆心一侧的圆周边缘，不在圆心**：36px 手柄的圆心沿轴向外偏 18px，反算值时扣回同一偏移；手柄与内部双箭头整体旋转到和所在径向轴一致。内部两枚实心三角形均为**底边 12px、高 5px**，相邻底边的净间距为 **2px**，整体关于手柄圆心对称。标准雷达手柄使用 `color-radar-handle-background` / `opacity-radar-handle`（grey-80 / 80%）；**分区雷达手柄改用 `color-radar-rating-handle-background` / `opacity-radar-rating-handle`（纯黑 / 50%）**，内部箭头仍为 100% 白色。手柄是数据图元，**轴标签仍按 RADAR-07/14 的 4px 间距定位，不为手柄额外预留空间**。hover、按下与键盘焦点均不改变手柄颜色或透明度。`editStep` 可选吸附；不给时拖动连续、键盘以一个网格环为步长。组件复制输入数组，不反向修改调用方数据；每次变化通过 `onChange({ series, dimension, seriesIndex, dimensionIndex, value, data })` 上抛，实例的 `getData()` 可读取当前副本。手柄使用 `role="slider"` 与 `aria-value*` | `geometry.js` → `radarValueAt()` / `snapRadarValue()`；`index.js`；`size-radar-handle-*` / `color-radar-handle-*` / `color/opacity-radar-rating-handle` | ✅ |

## 活 demo

三个面都能看，示例数据同源（`demos/examples.js`）：

- `index.html` 详情页与 `playground/preview.html` 的雷达图分组——**一次看一条**，旋钮最全。
- `playground/radar-preview.html`——**雷达专用对照面**，六个典型配置 × 三主题十八张图同屏铺开，改一版 token 或几何能一眼看到全部影响。它们是回归矩阵，**不是六种互斥图表类型**；页面 import 共享示例源，故不像桑基独立面那样有「改示例要改两处」的漂移代价（见 [WORKFLOW](../WORKFLOW.md) 第七节）。

对外示例分三类（组件 `variant` 仍只有 `basic / rating`；多数据由 `series` 数量表达）：

- `#radar-basic`：**标准雷达图**，单系列、固定 `max: 5`；可组合圆形 / 多边形网格、直线 / 曲线轮廓、横排 / 环绕标签与只读 / 可调节能力。
- `#radar-multi`：**多数据雷达图**，多系列共用同一组维度与量程，只读且不提供可调节能力；仅 index 详情页提供“数据组数”滑块，在 2–10 组间增减示例系列，不改变维度轴数量，也不是组件能力。
- `#radar-rating`：**分区雷达图**，在相同配置维度上增加渐变 / 分段背景选项。

专项对照面的六个典型配置：

- `#radar-basic`：单系列圆形网格 + 直线闭合，固定 `max: 5`（评分类常态）。
- `#radar-multi`：多系列圆形网格 + 直线闭合，共用固定 `max: 5`，不开放编辑能力。
- `#radar-curve`：圆形网格 + 曲线闭合，固定 `max: 5`；曲线态不出圆点。
- `#radar-polygon`：正多边形网格 + 直线闭合，**不给 `max`**，走 `niceSplit` 自动档——与前两条并排即可看出固定量程的意义。
- `#radar-rating`：分区背景 + 单系列轮廓，默认连续渐变；「分区」控件可切为离散同心色带。
- `#radar-adjustable`：单系列可调节形态，拖动轴上手柄或聚焦后用方向键调值；固定 `max: 5`、`editStep: 0.1`。
- 维度数旋钮三档 3 / 5 / 6 轴，覆盖维度数建议范围的两端；**3 轴档是轴标签八向定位最容易崩的一档**，验收必看。
- 网格默认 **5 环**；配 `max: 5` 时每环 1 分，最外环恰为 R（THS / iFinD 80、Ainvest 90）。
- hover 扇形出高亮与气泡；点击系列进钉住态；拖动容器宽高时网格、标签与水印重排。
- `网格形态`、`闭合轮廓` 与 `维度标签排列` 在三类中都可组合；`可调节能力` 只在标准 / 分区两个单系列示例中出现，多数据示例保持只读。
- `维度标签排列` 可在横排 / 环绕之间切换；常规雷达默认横排，可调节雷达默认环绕，两类都允许显式覆盖（RADAR-07/14）。
- `轴标签数值` 旋钮开启后名称下方出数值，**且 hover 照常工作**（RADAR-07 刻意偏离早期限制的那条）。

## API

```js
RadarChart(host, {
 name,             // 可选：这组数据的名称，作 tooltip 标题行；不给则整行不渲染（同 PIE-05）
 dimensions,          // string[]，维度名，≥3；顺序即 12 点起顺时针（RADAR-01/02/17）
 series,            // [{ name, data: number[] }]，data 与 dimensions 等长
 max,              // 可选：径向上界；不给则 niceSplit(0, 数据max)（RADAR-04）
 segments = 5,         // 网格环数，默认 5，最少 2（RADAR-03/04）
 gridShape = 'circle',     // 形态语义：'circle' 同心圆 / 'polygon' 正多边形（RADAR-03）
 shape = 'straight',      // 形态语义：'straight' 直线闭合 / 'curve' 曲线闭合，curve 隐点（RADAR-05）
 variant = 'basic',       // 形态语义：'basic' / 'rating' 分区背景（RADAR-15）
 ratingStyle = 'gradient', // 分区背景：'gradient' 连续渐变 / 'bands' 离散色带（RADAR-15）
 ratingRangeLabels,       // 渐变标尺两端文案，默认 ['Risk', 'Excellent']
 ratingBandLabels,        // 分段标尺各档阈值文案，默认 Figma 六档
 axisLabelLayout,         // 'horizontal' 横排 / 'arc' 环绕；常规默认横排，editable 默认环绕（RADAR-07/14）
 axisValue = false,       // 横排常规雷达：轴标签是否带数值；环绕 / editable 时忽略（RADAR-07/14/18）
 editable = false,        // 单系列可调值：径向拖动 + 键盘 slider（RADAR-18）
 editStep,               // 可选吸附步长；不给时拖动连续、键盘按一个网格环递增
 onChange,               // 可选：({series, dimension, seriesIndex, dimensionIndex, value, data}) => void
 legendSelect = 'multi',    // 'multi' | 'single' | 'focus'（LEGEND-06/14）
 platform = 'pc',
 animation = true,       // 入场顺时针依次出现；减弱动效下恒终态（MOTION-07）
})
```

返回实例除 `destroy()` 外还提供 `getData()`，用于读取可调节形态的当前系列副本。

颜色按固定色槽分配、不接受配置（拼接铁律 2）；尺寸、间距与字号均走 token，API 不收样式参数（铁律 4）。图面高度由宿主容器 CSS 决定，容器没给高时退到 `--size-radar-container`（RADAR-09；THS / iFinD-PC 200、Ainvest 220）。

## Do / Don't

- ✅ 用雷达图做**多指标综合对比**；各指标先归到同量纲再传入（RADAR-17）。
- ✅ 评分类场景显式给 `max`，让多张图形状可比（RADAR-04）。
- ✅ 维度数控制在 3–6：少于 3 构不成面积，多于 6 可读性下降。
- ❌ 不给不同量纲的指标各配一个量程——面积会失去意义，且能靠调量程把形状「调好看」。
- ❌ 不用雷达图表达含负值的数据系列，改用其他图表。
- ❌ 不默认展示坐标轴刻度数字——刻度值受分段影响，不建议展示。

## 待办

- [ ] 虚线系列显示（RADAR-13）。
- [x] 分区雷达 `variant: 'rating'` 的连续渐变与离散同心色带（RADAR-15）。
- [ ] 数据加载态与异常态（RADAR-16）。
- [ ] 宽高压缩 / 拉伸的适配细则尚未逐条对照验证。
