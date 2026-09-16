# Tooltip / 提示框 · 规范（条目化索引）

> 本页是项目内 Tooltip 规则的权威定义；代码注释通过稳定 ID 回引本页。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：所有图表的 hover 提示链路：气泡卡片、位置档、指示线、轴标签高亮、交互行为。
> 其中**指示线（TOOLTIP-08 / TOOLTIP-12）与轴标签贴片（TOOLTIP-09 / TOOLTIP-12）只对有坐标轴的图成立**；
> 无坐标系图（饼 / 环）只用气泡，触发方式与位置档的差异见 [pie.md](pie.md) PIE-05。颜色具体值全部走 token（[tokens 目录](../tokens/)，明暗各一组），
> 参与几何计算的档位差异走 `tokens/behavior.json`。
> 分层：气泡 / 定位（`core/tooltip.js`）与指示线 / 轴贴片（`core/crosshair.js`）是 **L1 纯渲染**构件；
> 「hover 落在哪个类目、取哪些系列的值」由 L2 组装后传参（`charts/charts/cartesian/index.js`）。
> 本页的「无过渡动画」（TOOLTIP-05④ / TOOLTIP-10）是**交互态**的权威定义，图元的**入场生长动效**
> 是另一回事，见 [motion.md](motion.md)——它明确不波及 hover 链路，两页不重叠。

## 气泡卡片

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| TOOLTIP-01 | 气泡形态：背景 `color-visualization-tooltip` · 内边距 `spacing-tooltip-pad` · 圆角 `radius-tooltip` · 行间距 `spacing-tooltip-row` · 数据行两列最小间距 `spacing-tooltip-row-gap` · 宽度**自适应内容**（`width: max-content`，以最长一行为准），再受**三道各自独立的封顶**，取最小者：① 内容封顶 `size-tooltip-max-width`（**280px**，超出按 TOOLTIP-03 换行）；② 视口封顶（两侧各留 `spacing-24`，窄屏上气泡不顶边）；③ **容器封顶** = 容器宽 × `size-tooltip-max-container-ratio`（容器 = 图表根 `.dv-chart`，组件未挂该类时为气泡宿主本身；与 TOOLTIP-04 follow 档的 clamp 边界同一个定义）——**THS 移动端取 0.5，其余主题与 THS PC 端为 `none`**（不设此道）。<br>⚠️ ③ 的由来是 THS 的 **side-fixed 档**（TOOLTIP-06）：它按图表中点把气泡放到指针的对侧半区，气泡一旦宽过半个容器就会越过中线、盖住指针所在的那半边，这一档「躲开指针」的意义就没了。PC 容器宽（596–688px），280 远小于一半，从不触发；移动端容器 343px、半宽 171.5px，**瀑布图的读数（自然宽 183px）会触发**，其余图型实测 ≤131px 不触发——故验收必须拿瀑布图验，默认示例基本绕开这条。比例是取值（走 token 端分叉），合成在 `styles.css` 的 `min()`，`core/tooltip.js` 只在读宽度**之前**写入量好的容器宽 × 比例，本模块仍无 `if(theme)`。**各族一律不设专属宽度覆盖**，三道封顶对全部图型生效。注意桑基在移动端的「容器」是它可横向滚动的画布（实测 1144px），宽于可见外框，故半宽封顶在该族实际不收紧。<br>⚠️ **280 是量出来的**：全族 × 三主题实测自然宽 80–300px。**弦图 Ainvest 的弦看板**（英文「A → B」行名，如 `Power Equipment ↔ Non-bank Financials`）最宽 **299.6px，已超过 280、在封顶处折行**；其次桑基 Ainvest 英文节点名 264.7、瀑布图 Ainvest 复合读数 228，这两者仍单行。⚠️ 这正是 280 定值时预留的「出现更长读数」情形——**是否上调 280 待决（见待办）**，折行本身符合 TOOLTIP-03、数值未被挤出气泡；无论上调与否，**都不得为弦图另开宽度覆盖**；再宽的内容（如「超长名称」边界用例的 339px）本就该换行，而不是让气泡霸屏。**2026-09-15 前该值是 160px**，瀑布图与桑基图因此各自设有专属宽度覆盖；同类覆盖出现第二处，说明该改的是通用值，两处现已并入本条；**iFinD 特例叠加**：1px 边框 `color-visualization-tooltip-border` + 阴影 `shadow-tooltip` + 标题行下分割线 `color-visualization-tooltip-divider` + 字体 Arial（`font-family-tooltip`，Tooltip 内不用 YaHei）——THS / Ainvest 该组 token 置 transparent / none 自然无形 | `.dv-tooltip`（styles.css）· `core/tooltip.js` | ✅ |
| TOOLTIP-02 | 气泡内容：自上而下 = **日期 / 标题行**（第一行）→ **数据行**（每系列一行）。**标题行可省**；也可带一个装饰性实体图标（如股票 Logo，24px），不改变主体骨架。图标合同支持 `titleIconFallback`：实体图片缺失或加载失败时，在同一 24px 槽位显示圆形 `color-background-layer1` 页面一级背景 + `color-text-primary` 单字符，字体用 `font-family-cn` 与 `font-weight-bold`，light / dark 随主题 token。有真实图片地址时首帧直接显示图片，不先显示兜底等待 `load` 事件。数据行固定两列：marker + 系列名左对齐、数值右对齐；详情型数据行可显式隐藏 marker，但仍复用同一两列布局。**行序与图例一致**（声明序）、隐藏系列不出现；默认 marker 跟随图例 marker 形态。标题字色 `color-text-tooltip-title`、系列名 `color-text-tooltip-series`、数值 `color-text-tooltip-value`，字号 `font-size-tooltip`，数值字重 `font-weight-tooltip-value`；**数值格式与 Y 轴同源**，null 值显示 "-" | `core/tooltip.js` → `createTooltip()` 的 `show()` | ✅ |
| TOOLTIP-03 | 系列名过长换行三规则：① 数值 / marker **顶对齐系列名第一行**（不随多行高度居中）；② **只有系列名换行**，数值始终单行、贴右、不折行，且数值列 `flex:none` 不参与压缩；③ 系列名悬挂缩进——marker 只在第一行左侧出现一次，第 2 行起左边缘对齐**第一行文字起点**（marker 独立列 + 名称列 `min-width:0` / `overflow-wrap:anywhere` 实现）。无空格的英文长词也只能在名称列内断行，禁止溢入数值列 | `.dv-tooltip__row` / `__label` / `__value`（styles.css） | ✅ |

## 位置档（形态定义，主题映射见 TOOLTIP-07）

| ID | 档位 | 规则 | 实现 | 状态 |
|---|---|---|---|---|
| TOOLTIP-04 | **follow · 跟随式** | 默认显示在触发点**右下方**、连续跟随（**无半区反选规则**）；仅当右侧碰撞放不下时自动翻到触发点左侧躲避；水平与垂直都 clamp 在边界内。<br>**边界 = 图表根**（`.dv-chart`，即绘图区 + 间距 + 图例这一整块组件地盘），**不是绘图区**：气泡恒在光标 ±12px、而光标必然在图内，拿绘图区去夹防不住任何东西，只会在**绘图区紧裹图元**时把它平白挤扁——饼环左右结构下绘图区仅 291px 而图表根有 706px（[pie.md](pie.md) PIE-02：画布 = 图元外接框、绘图区贴着画布）。再往外的卡片是 L3 外壳、组件不该知道，差的就是外壳那圈内边距（实测每侧约 15px）。<br>边界由 `core/tooltip.js` **自己按档取**（`plotHost.closest('.dv-chart')`——组件自己挂的类，不依赖使用方 DOM），**不由调用方传**，见本页「位置档的边界」小节 | `core/tooltip.js` → `place('follow')` + `bounds()` | ✅ |
| TOOLTIP-05 | **top-anchor · 顶部锚定式** | 下三角 + 水平跟随触发点居中 + 垂直贴 grid 上沿外侧：① 三角尖端 x = 触发坐标 x（气泡贴不贴边都成立）；② 气泡底边 y = grid 上沿 − 三角高（与坐标 y 无关）；③ **水平 clamp 到绘图区**，贴边时气泡停、三角继续随坐标偏移——这条「气泡停、三角继续走」是本档的设计behaviour，而它只有在边界贴着图表时才够得着：边界一旦放宽到视口，桌面宽度下气泡从不碰边（实测 1600px 视口 / 706px 图表全程无接触），本条就成了永不触发的死代码；④ **垂直不 clamp**——② 明写「底边 y 与坐标 y 无关」，一夹这条就碎（三角会脱离气泡底边）。图表贴页顶且气泡很高时可能向上溢出屏幕，属 ⑤ 的自然结果；⑤ 无过渡动画（瞬移跟随）；⑥ 气泡是临时遮罩物，不为它预留 grid 顶间距。三角高 6px 为兜底常量（本档专属形态） | `core/tooltip.js` → `createTooltip()` 的 `place('top-anchor')` + `ARROW_H` | ✅ |
| TOOLTIP-06 | **side-fixed · 两侧固定式** | 固定绘制区上方左 / 右两侧、离散两档：以**图表中点**为基准触发点反选——左半区触发 → 显示在右上角、右半区 → 左上角（永远在触发点对侧，不遮挡在看的数据）；垂直顶对齐绘制区上沿、不随鼠标纵移、不跟随插值。**边界 = 绘制区**：本档不做 clamp，它直接贴 `grid` 的左 / 右上角，位置天然落在绘制区内 | `core/tooltip.js` → `createTooltip()` 的 `place('side-fixed')` | ✅ |
| TOOLTIP-07 | 主题 → 档位映射走 `tokens/behavior.json` `tooltip-position`：THS `side-fixed` · iFinD-PC `follow` · Ainvest `top-anchor`。<br>**图表形态特例压过主题映射**：**无坐标系图恒 `follow`**——饼 / 环、矩形树图与雷达图都适用。它们没有「最近类目」可锚，气泡跟指针走才对得上正在看的那个图元。<br>⚠️ 矩形树图 2026-08-26 前是 `side-fixed`（理由记作「节点密集时看板位于触发节点对侧」），已按产品决定改为 `follow`，与饼环归为同一条通则、不再是单独的例外。<br>**形态特例不进 `behavior.json`**：它是三主题一致的图表规则，不是主题分叉；故在对应 L2 里定死并回引本条 | behavior.json + `charts/charts/cartesian/index.js`；`charts/charts/pie/index.js`（PIE-05）；`charts/charts/treemap/index.js`（TREEMAP-07） | ✅ |
| TOOLTIP-12 | **浮层不被容器裁剪**：气泡是临时遮罩物，可**超出图表 frame 及任意祖先容器**显示——数据行多、气泡高过 grid 上方空间时向上溢出照常可见（top-anchor 尤其，TOOLTIP-05 ⑤ 不预留顶间距的自然结果），祖先 `overflow: hidden/auto`（如可缩放卡片容器）不得裁剪。实现：DOM 仍挂 plotHost（保 `data-theme` token 作用域与销毁清理），定位用 **`position: fixed` 视口坐标**——三档几何（TOOLTIP-04..06）仍在 plotHost 局部坐标计算、输出时叠加 plotHost 视口矩形。**各档的 clamp 边界互不相同**，见下节 | `.dv-tooltip`（styles.css `position: fixed`）· `core/tooltip.js` → `place()` 末尾视口换算 | ✅ |

## 位置档的边界

三个档的气泡**锚在不同的东西上**，故 clamp 的边界也不同——按「锚在哪」定，而不是给三档硬套一个盒子：

| 档 | 气泡锚在 | clamp 边界 | 为什么 |
|---|---|---|---|
| `follow` | **光标** | **图表根**（`.dv-chart`） | 气泡恒在光标 ±12px、光标必在图内，边界只需框住组件自己那块地；用绘图区会在它紧裹图元时（饼环）把气泡挤扁 |
| `top-anchor` | **图表的类目** | **绘图区**（仅水平） | 「贴边后气泡停、三角继续走」（TOOLTIP-05 ③）要求边界贴着图表；放宽到视口后桌面宽度下永不触发，那条规则就废了。垂直不夹以保住 TOOLTIP-05 ② |
| `side-fixed` | **grid 的左 / 右上角** | 绘制区（不需 clamp） | 只有两个离散位置，天然在内 |

⚠️ **边界一律由 `core/tooltip.js` 自取，`place()` 不收容器尺寸参数**。这是有意收回来的：调用方手边最顺手的是 `frame` 的画布宽高，而**轴图下画布 == 绘图区 == 图表根**（同宽），三者恰好相等 → 传错也看不出来；饼环却三者都不等，于是「该传哪个」成了看不见、传错不报错、只在特定布局才现形的隐性契约（实测踩过：follow 的垂直上界被误设成画布高，指针过了半截高度气泡就钉住不动）。**参数删掉，这类错就不可能再发生**，新图表接入也不必知道有这回事。

## 指示线与轴标签高亮

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| TOOLTIP-08 | X 轴竖指示线：hover 即出（默认开）、贯穿 grid 全高，并**向下延伸出绘图区至轴标签区**（连接被高亮的轴标签贴片）；线色 `color-visualization-highlight-line`、线型 `dash-highlight-line`（iFinD 虚线 3 3 特例，THS / Ainvest 实线 none）；**纯分组柱不画竖线、换 block 形态**（TOOLTIP-11） | `core/crosshair.js` → `renderCrosshairX()` · `.dv-crosshair-x` | ✅ |
| TOOLTIP-09 | X 轴标签高亮贴片（默认开）：当前类目标签处出现完整贴片（背景比文字大一圈）。它是**常态 X 轴标签的高亮状态，不是第二套标签组件**：内容先与常态一起经 `axisLabelLines()` 标准化，二者都由 `renderAxisLabelLines()` 生成同构 `<tspan>`；高亮 `<text>` 同时挂 `.dv-axis-label` 直接继承字号 / 行高 / 字重 / 字体，`.dv-axis-tag-text` 只覆盖状态字色。背景 `color-visualization-highlight-background-tick`、圆角 `radius-axis-label-tag`、左右内边距 `spacing-axis-label-tag-pad-h`（THS 1px / Ainvest 3px），上下由行高撑；**多行标签逐行保持原轴标签结构**，背景高 = 行数 × 行高，不得在交互态拼回一行；**即使该标签被碰撞策略隐藏也照常显示**（状态贴片仍独立渲染，以类目中心定位、独立于 AXIS-06 结果）。<br>**纵向口径：状态切换不得移动文字**——高亮态与常态共同调用 `xAxisLabelTextLayout()`，使用完全相同的 `y = xBandTop`、`dominant-baseline: hanging`，首行 `dy = 0`、后续每行 `dy = line-height-axis`；点击 / hover 只增加背景并切换字色，不改文字坐标、字号或行距。AXIS-04 的 4px 净距约束的是文字起点；背景高仍为行数 × 行高，但其上沿通过 L1 `measureInk()` 的 Canvas `actualBoundingBoxAscent / Descent` 与 hanging 基线还原真实字形墨迹中心，使黑底与肉眼可见文字上下居中，因此可相对 `xBandTop` 略微上移或下移。SVG `getBBox()` 返回的是 em 排版盒，不能作为本规则的墨迹来源；偏移由当前字体实测产生，不写主题特例或固定像素值 | `core/measure.js` → `measureInk()`；`core/axis.js` → `axisLabelLines()` / `renderAxisLabelLines()` / `xAxisLabelTextLayout()`；`core/crosshair.js` → `axisTagBox()` / `renderAxisTag()` · `.dv-axis-label.dv-axis-tag-text` / `.dv-axis-tag-bg` | ✅ |

## 交互行为

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| TOOLTIP-10 | 三主题一致：**按 X 坐标最近类目触发**（鼠标移到该类目横向区间即触发，无需悬停在数据项上）——**此条限有坐标轴的图**；无坐标系图没有「最近类目」可言，改按图元本体命中（饼环见 [pie.md](pie.md) PIE-05），本条其余部分（延迟隐藏、滚动即隐、无过渡）对它们同样成立；**无过渡动画**（不淡入淡出、瞬移跟随）；移出绘图区按 `tooltip-hide-delay` 延迟隐藏（THS / iFinD 2000ms、Ainvest 0）；**页面或任意祖先滚动容器发生滚动时立即隐藏完整 hover 状态**（气泡 / 指示线或 block / 轴贴片 / 唤出点同步清除，不走延迟），避免 `position:fixed` 气泡脱离已滚走的图表；自动隐藏默认开启（常驻显示则关闭延迟——待办）；hover 同时唤出当前类目**所有可见折线的数据点**——`.is-active` 压过 `points-muted` 静默、中心填充切白心 token（样式归 specs/line.md），且**唤出点层级压过 X 指示线**（副本层实现：仅这些点抬层，指示线与 mark 的相对层级不动） | `charts/charts/cartesian/hover.js`（`bindHover`：交互层 + 延迟 timer + scroll 收口 + 唤出点副本层） | ✅ |
| TOOLTIP-11 | **hover 指示形态特例：纯分组柱 → block**（判定按声明：全系列 `type:bar` + `stack:none` + ≥2 系列）：hover 时 X 指示**竖线（TOOLTIP-08）换成 block 底色带**——填充 `color-visualization-highlight-block`、以类目中心定位、**宽 = 分组柱容器宽**（`min(band, size-bar-group-container-max)`，与 BAR-02 布局同一容器；THS 无上限 → 整格）、贯穿 grid 全高；**层级在网格之上、mark 之下**（是底色不是遮罩，故不在 hover 顶层）；随 hover 切片移动、与气泡 / 贴片同一 timer 延迟隐藏（TOOLTIP-10）；轴标签贴片（TOOLTIP-09）照常显示、竖线不再绘制。**其余图型（单柱 / 堆叠 / 折线 / 组合 / 双 Y）维持竖线** | `core/crosshair.js` → `renderCrosshairBlock()` · `.dv-crosshair-block`（styles.css）· `cartesian/hover.js` `bindHover` 按 `indicator` 分发 · 判定 + block 层创建 `cartesian/index.js` | ✅ |
| TOOLTIP-12 | **Y 轴横指示线 + Y 值徽标**（cfg `yIndicator`，**默认关**）：hover 时出一条水平线，并在 Y 标签位置贴出该高度对应的值。<br>**线与徽标强绑定、一个开关**（同 [pie.md](pie.md) PIE-12 引线与标签的关系）：一条不知代表什么值的横线、和一个不知指向哪的徽标，单独都读不出东西，「只出线」「只出徽标」不是合法状态。<br>**值 = 指针 y 的插值（`y.invert`），不是数据读数**——气泡回答「这个类目各系列是多少」，本徽标回答「指针停在这个高度相当于多少」，用来目测一个点大概落在什么量级；格式化与 Y 轴标签同源（`yFormat`，percent 档显原值）。<br>**徽标侧归属不另立规则：哪一侧画了 Y 标签，哪一侧就有徽标**（与 `renderYLabels` 同一个 `oppTicks` 判据，AXIS-02）。三种情形因此自动各就各位：单轴 1 个；**iFinD 镜像**（`y-dual-shared` 且非真双量纲）2 个、同一把标尺故**同值**；**真·双量纲** 2 个、各用自己的标尺故**不同值**——一条横线同时读出两个量纲各是多少，正是双 Y 图最难目测的那件事。<br>**样式与 TOOLTIP-09 的 X 贴片同源**：复用同一组 `.dv-axis-tag-bg` / `.dv-axis-tag-text` 与同一批 token，**不新增任何 token**（同一个「高亮读数」语义不该有两套外观）。本徽标用 `dominant-baseline: central` 而**不是 `middle`**（SVG 的 `middle` 对齐的是「字母基线 + 半个 x-height」，而徽标里是数字与汉字、高度远超 x-height，用 `middle` 三主题实测整体上浮 2.75~3.10px）；X 贴片则按 TOOLTIP-09 与常态 X 标签共用 `hanging` 基线，二者定位目标不同，不要求用同一基线算法。横线与竖线共用 `color-visualization-highlight-line` / `dash-highlight-line`（iFinD 3 3 虚线两向一致）。<br>**横向定位逐字对齐 `renderYLabels` 的四种情形**（inside/outside × left/right，含 AXIS-03 右列右对齐特例）——徽标必须落在标签本来在的地方，否则指向哪根轴读不出来；**纵向恒以指针为中心**，不模仿 inside 布局里 Y 标签「压在网格线上方」的摆法（那是为了不盖住网格线，而徽标跟的是指针不是刻度）。<br>横线贯穿 grid 全宽并向标签侧延伸至徽标外缘（同 TOOLTIP-08 竖线连到贴片上沿）。<br>**指针纵向出 grid 即整组不画**：grid 之外没有对应的值，硬画会显示超出值域的数字。X 向各构件不受影响（仍按最近类目照常触发）。<br>**关闭时零开销**：`yAxes` 为空即不建任何 DOM，几何一步不动 | `core/crosshair.js` → `renderCrosshairY()` / `renderYAxisTags()` · `.dv-crosshair-y`（styles.css）· `cartesian/hover.js` `bindHover` · 侧归属装配 `cartesian/index.js` | ✅ |

## 样式 token

气泡：`color-visualization-tooltip` · `color-text-tooltip-title/-series/-value` · `font-size-tooltip` ·
`font-family-tooltip` · `font-weight-tooltip-value` · `spacing-tooltip-pad` · `spacing-tooltip-row` ·
`spacing-tooltip-row-gap` · `radius-tooltip` · `size-tooltip-max-width` · `size-tooltip-max-container-ratio`（端分叉，目前仅 THS 移动端 0.5）；iFinD 特例组
`color-visualization-tooltip-border` / `shadow-tooltip` / `color-visualization-tooltip-divider`。
指示线：`color-visualization-highlight-line` · `dash-highlight-line`（X 竖线与 Y 横线共用，TOOLTIP-08/12）。
指示 block（TOOLTIP-11 纯分组柱 hover）：`color-visualization-highlight-block`（明暗各一组，三主题同值）。
轴贴片：`color-visualization-highlight-background-tick` · `color-text-highlight-tick` ·
`radius-axis-label-tag` · `spacing-axis-label-tag-pad-h`（X 贴片与 Y 值徽标共用同一组，TOOLTIP-09/12——
Y 徽标**未新增任何 token**）。
行为：`tooltip-hide-delay`（值 token，L2 经 `tokenNum` 读取）· `tooltip-position`（behavior）。

## 占位待定值（源文档「待定」，预览校准后回填）

- iFinD：`font-weight-tooltip-value` 暂 regular · `color-visualization-tooltip-border` dark 暂同 light（#ECECF7）·
  `shadow-tooltip` 暂 `0 2px 8px rgba(0,0,0,0.15)` · `color-visualization-tooltip-divider` 暂同边框色 ·
  `spacing-axis-label-tag-pad-h` 暂 1px。
- 移动端气泡最大宽度：**THS 已按 1/2 容器宽落地**，权威口径见 TOOLTIP-01 ③（2026-09-15）。本处原写「三主题一致、无 token」（2026-07-19 的占位）；落地时只确认了 THS，故改走端分叉 token，**iFinD / Ainvest 移动端是否同样取 1/2 仍待设计确认**（当前为 `none`，不设容器封顶）。

## 待办（后续切片）

- [ ] **点击分片选中**：点击 → 类目 block 柱状高亮 `color-visualization-highlight-block`（选中态 + 展示该点其他数据表现），与 hover 指示线独立。
  **本条是「选中态」在全项目的唯一出处**——[line.md](line.md) 原有的折线选中待办已于 2026-08-20 删除并指回本条
  （折线是连续路径、没有可点的实体；真正有选中态的饼环，其选中就是图例强调的 `selected`，见 [pie.md](pie.md) PIE-03）。
  **动工前先解决两件事**：① **与 TOOLTIP-11 的形态冲突**——那条已定死 block 仅**纯分组柱**专属、其余图型（单柱 /
  堆叠 / 折线 / 组合 / 双 Y）维持竖线，故本条不能不加区分地给所有图型出 block；② **底色只留一个值**——本条用
  `color-visualization-highlight-block`（0.1），line.md 原写 `color-background-weak`（0.04），透明度差一倍半，
  已按语义取前者（后者归 §10 弱背景填充，现用处是缩放轴轨道底；前者才是 §10 的高亮反馈组）。
- [ ] **移动端触摸**：触摸点即触发点（档位形态两端一致）；touch 事件接线。（气泡最大宽度那半已拆出：THS 移动端 1/2 容器宽见 TOOLTIP-01 ③；iFinD / Ainvest 待定，见上方占位待定值。）
- [ ] **是否上调内容封顶 280px**：弦图 Ainvest 弦看板自然宽 299.6px，现已在封顶处折行（名称两行、数值完整）。上调前先按「全族 × 三主题」重量，含弦图 n=4–10 的全部弦看板，不要只量示例默认档。
- [ ] **常驻显示（always-show）**：开启后关闭自动隐藏与延迟。
- [x] **无坐标系图 → follow 档特例**（TOOLTIP-07）：随 `PieChart` 落地，在 L2 定死、未给 behavior 加键。
- [ ] **饼环气泡的占比数值**：当前数据行只显示原值（与轴 / 标签同一份 `makeFormatter`）。饼环的核心读数是占比，
      但显示形式（`32%` 还是 `1,234（32%）`）、小数位与配平规则设计源均未表述，见 [pie.md](pie.md) 待办。
