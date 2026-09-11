# Project instructions

## 定位

这是一个以 design token 驱动的可视化规范原型：用 D3 辅助计算和 SVG DOM 装配，实现跨 THS、iFinD-PC、Ainvest 三主题的图表组件（当前有直角坐标图、饼 / 环、桑基、矩形树图与雷达图五族）。

## 运行与验证

- 启动预览：`python3 -m http.server 8123`。对外站点 `http://localhost:8123/`；开发验收面 `http://localhost:8123/playground/preview.html`（三主题并排、旋钮更全）。
- 线上预览：`https://fatmoney9.github.io/vis-lab/`；GitHub Pages 从 `main` 分支根目录发布。
- 质量门禁：`sh hooks/check.sh`（等价 `npm run check`）。这是**唯一一份检查清单**——token 重建、
  水印资源重建、语法、单测，外加分层、Spec ID、测试卫生、色值字面量、字体引用、L1 复用声明、预览面契约等守卫；`hooks/pre-commit` 与 CI 调的都是它。**条数与逐项顺序只看该脚本，文档一律不复述。**
  **新增检查项只改 `hooks/check.sh`，禁止在文档、PR 模板或 CI 里另抄一份命令。**
- 只跑单元测试：`node --test "tests/**/*.test.mjs"`（**引号不能去**，去掉后 `tests/` 子目录里的
  测试会被静默跳过）。只重建 token：`node tokens/build.mjs`。
- 仓库已配置 `core.hooksPath=hooks`；不要绕过 pre-commit。
- 完整测试分层、覆盖矩阵和基线规则见 `TESTING.md`。

## L1 能力索引（动手写计算或渲染前，先查这张表）

**L1 已经有的，禁止在 L2 重写一份。** 这是本项目最容易破、且机器最难查的一条纪律——
`hooks/lint-layers.sh` 自己就写着它查不出「语义重复」。索引放在这里，就是为了让写代码的人
（含 AI 会话）在动手前有一处可查，而不是回头靠 review 抓。

> **权威构件清单在 `charts/core/README.md`**（按文件列职责与对应规范）。本表只做「任务 → 模块」
> 的路由：写代码的人手上有的是任务（「我要量文字宽度」），不是文件名。**新增或改名 L1 模块时
> 两处都要更新**——这是本表已知的维护成本，为换取 AI 会话在 AGENTS.md 里就能查到而接受。

| 我要… | 用 L1 的 | 关键导出 |
|---|---|---|
| **量文字渲染宽度 / 墨迹上下边** | `core/measure.js` | `measureTexts` · `createTextMeasurer`（宽，走真实 SVG 级联）· `measureInk`（墨迹上下边，走 Canvas）—— **全库唯一测量源**（[AXIS-08] / [TREEMAP-05] / [SANKEY-18]），不要另起一份。两类测量使用不同手段的理由见模块注释 |
| **缓动曲线 / 逐帧动画 / 减弱动效判断** | `core/motion.js` | `easeOutCubic`（[MOTION-03]）· `runGrowth` · `reducedMotion`（[MOTION-07]） |
| 读 CSS token 值 | `core/tokens.js` | `tokenStr` · `tokenNum` |
| 解析主题 / 端形态 | `core/theme.js` | `themeOf` · `modeOf` · `resolveBehavior` |
| 数值格式化 | `core/format.js` | `makeFormatter` |
| 图例（渲染 / 点击状态） | `core/legend.js` · `core/legend-state.js` | `renderLegend` · `markerSpecFor` / `applyToggle` · `applyFocus` |
| Tooltip 气泡 | `core/tooltip.js` | `createTooltip`（`place()` 自己算 clamp 边界，不要传容器尺寸） |
| 图片内容块（标准化 / 自适应 / SVG / Tooltip） | `core/image-content.js` | `normalizeImageContent` · `fitImageContent` · `renderImageContent` · `imageContentTooltip`（[IMAGECONTENT-01..04]） |
| 系列取色 | `core/palette.js` | `resolveSeriesColors` |
| 比例尺与刻度 | `core/split.js`（刻度数学）· `core/scale.js`（像素换算） | `niceSplit` · `niceSplitDual` / `linearY` · `bandX` |
| 画布与 resize | `core/frame.js` | `createFrame` · `observeResize` · `verticalGeometry`（先于刻度问出绘图区高）· **`containerDrivesHeight` / `containerTookOver`**（「高度由谁说了算」的两条判据，三族共用，别再抄阈值） |
| 坐标轴 / 网格 / 轴标题 | `core/axis.js` · `core/grid.js` · `core/axis-title.js` | `renderYLabels` · `renderGrid` · `axisTitleBand` … |
| 数据标签（截断 / 碰撞 / 前景色） | `core/label.js` | `truncateBatch` · `dropCollisions` · `labelTone` |
| 图元（柱 / 线） | `core/mark.js` | `renderBars` · `renderLine` |
| hover 指示线 / 轴高亮贴片 | `core/crosshair.js` | `renderCrosshairX` · `renderCrosshairY` · `renderCrosshairBlock` · `renderAxisTag`（X 贴片）· `renderYAxisTags`（Y 值徽标） |
| 缩放轴 | `core/datazoom.js` | `renderDataZoom` |
| 水印 | `core/watermark.js` | `watermarkAnchor` · `renderWatermark` |

**L1 有、但签名不合用时怎么办：参数化 L1，不要在 L2 另写一份。**
这是 `WORKFLOW.md` 第八节用 `PieChart` 实测出来的结论——接新图型的 L1 成本几乎全部来自
「为轴图设的隐含假设被无轴图暴露」，正确修法是把假设收回 L1（如 tooltip `place()` 删掉容器尺寸参数），
而不是让新图型自带一份。判断粒度见 `WORKFLOW.md` 第三节。

**接新图型的硬要求：写一份 L1 复用声明**（`charts/charts/<名>/README.md` 的「L1 复用声明」小节），
把 `charts/core/` 下**每一个** L1 模块交代成「用」或「不用：<理由>」。由 `hooks/lint-l1-declaration.mjs`
校验，且**与代码里的 import 逐条对账**——说了用却没 import、或 import 了却没声明，门禁都会红，
所以这张表退化不成打勾的表格。声明结构可照抄现成的
`charts/charts/cartesian/README.md`、`charts/charts/pie/README.md` 或 `charts/charts/radar/README.md`；
模块总数由门禁读取 `charts/core/` 实时校验，文档不另存计数。

## 技术栈

原生 ES Modules、D3 v7（预览页 import map）、SVG、CSS 自定义属性、Node.js token 构建脚本；无打包器。
根目录 `package.json` 只登记命令并声明 `"type": "module"`，**零依赖、无需 `npm install`**——所有脚本都能直接手敲。

## 目录与约定

- `tokens/` 是主题值、行为和系列色板的权威源；不要手改生成的 `tokens/tokens.css`。
- `charts/core/` 是 L1 共享构件，`charts/charts/` 是 L2 图表编排，`specs/` 是规则 ID 权威定义。
- `demos/` 是各预览面共享的示例数据源：`examples.js`（示例清单 + 假数据 + 配置装配）与
  `registry.js`（图表类型 → L2 组件）。**加示例、加图表类型只改 `demos/`**，`index.html` 与
  `playground/` 都不用动；具体步骤见 `demos/examples.js` 文件头。
  **唯一已知例外是桑基**：因 SANKEY-23 的 812px 横版财报外框与序列统一高度，另有 `playground/sankey-preview.html`
  独立面（**自带数据、不 import `demos/examples.js`**），且两个预览面里有专属样式与旋钮接线。
- **另有 `playground/radar-preview.html`**（雷达专用对照面，六个典型配置 × 三主题同屏；是回归矩阵、不是六种图表分类）。它与桑基那条**性质不同**：
  **它 import `demos/examples.js`、只负责「怎么摆」**，故没有「改示例要改两处」的漂移代价，加示例仍然只改 `demos/`。
  想为某个图型另开对照面时照它、不要照桑基。
  这是硬需求逼出来的特例，不是可照抄的范式——理由与代价见 `WORKFLOW.md` 第七节。
- `index.html` 是对外站点，`playground/` 是开发验收面；组件 API 只收数据与语义配置，不收样式参数。
- 详细分层、主题通道和规范变更流程以 `WORKFLOW.md` 为准。
- 多人分支、中文提交、验证和 PR 约定以 `CONTRIBUTING.md` 为准。

## 当前状态与下一步

当前有**五个 L2 图表组件**：

- **CartesianChart**（`charts/charts/cartesian/`）：柱、堆叠、折线、折柱组合、双 Y、hover/tooltip 链路、缩放轴（datazoom，见 `specs/datazoom.md`）、水印（watermark，见 `specs/watermark.md`）、数据标签（data label，见 `specs/data-label.md`）、轴标题（axis title，见 `specs/axis-title.md`，默认不显示）和入场生长动效（motion，见 `specs/motion.md`，默认开、仅实例首次挂载时播）。

**直角坐标系与饼环两族共用的图例点击语义**（`legendSelect`，见 `specs/legend.md` LEGEND-06 / LEGEND-14；**桑基不适用**——其图例是静态色卡，见下）：`'multi'`（默认，点谁隐谁）/ `'single'`（只留该项）/ `'focus'`（**不隐藏**，只把其余项与其图形压到 `opacity-visualization-dim`）。前两档改数据构成（饼环重算 360°、轴图重算值域），第三档不改。**这个键 2026-08-12 前住在 `behavior.json` 的 `legend-select` 上，已迁出**——它不是品牌分叉（源文档从未指定各主题默认），判例同 LEGEND-10「方位」。纯状态迁移在 `charts/core/legend-state.js`（**与 `legend.js` 分开只为可测**：那边 import d3，`node --test` 加载不了）。
- **PieChart**（`charts/charts/pie/`，见 `specs/pie.md` PIE-01..17）：饼与环**同一个组件**，靠 `variant: 'donut' | 'pie'` 分形态。无坐标轴，复用同一套图例 / 数据标签 / tooltip / 水印 / 动效 / 取色构件。要点：
  - 画布 = **图元的外接框**，不留富余——图元含圆外的引线与标签带；无外侧标签时退化为环的外接方框 2R。多出的画布会变成图元与图例之间随容器浮动的死空间（PIE-02）。**有意的例外只有标签带**：它锚容器不锚文本（见下条 PIE-13）、且**两侧恒等宽**，文本短时带内会留白——换来的是环不随数据量 / 对齐档 / 名称长短跳动，圆心也不偏离画布中心
  - 半径 = `clamp(默认半径 × 0.5, 短边/2, 默认半径)`——token 是上限，**收缩有底**（THS/iFinD 35、Ainvest 40）；触底后环溢出画布而非继续变小（PIE-02）
  - 两种图例布局：`legend: 'right'`（默认，左右结构）/ `'bottom'`（上下结构），间距 24px、整组居中，**图例块与环共享同一条中线**；两种结构都封顶 + 溢出滑动，上限左右 = 图元高 × 2（L2 算好写进 `--dv-pie-legend-max-h`）、上下 = 默认图元高 `size-donut-radius × 2`（纯 CSS，锚 token 是为断开「图例高 → 半径 → 图例上限」的循环）（PIE-09 / LEGEND-10/11）
  - 扇区取色走**扇区专用盘 `pie-multi`**（THS 11 色；未声明该盘的主题回落通用 `bar-multi`），单扇区仍取 `single-default`（COLOR-08）
  - 气泡恒走 `follow` 档（TOOLTIP-07 的无坐标系图特例，在 L2 定死、不进 behavior.json）
  - **数据标签默认不显示**（LABEL-05「一个类目一个值就出标签」原则的明确例外）。开启后有两种**互斥**形态：`labelLayout: 'outside'`（默认，外侧标签 + 引线，PIE-12/13/14）/ `'inside'`（扇区内，PIE-04）——引线与标签强绑定，所有丢弃都必须在画线前判完
  - 外侧标签 = **名称段 + 数值段**，两段各有自己的字号 / 行高 token，名称段另有自己的**字重**（regular）与**颜色**（`color-text-secondary`，数值段 primary）；渲染恒为**两个 `<text>`**（一个 `<text>` 只能一个 fill）。排布形态走 `behavior.json` 的 `pie-label-form`：THS / iFinD-PC `inline` 同行、Ainvest `stacked` 上下两行；`inline` 要求两段字号相同（异字号必须 stacked，否则单一 class 的测量会系统性偏窄）（PIE-15）
  - ⚠️ **`.dv-data-label` 通用 token 的隐含前提是「标签内容是数字」**（medium 字重、`font-family-number`、`tabular-nums`）。名称段是全库第一个非数字消费者——再往这套类上挂非数字文本，先逐项复核
  - **可命中面 = 扇区面 + 引线 + 外侧标签**，三者共用同一套绑定（接在扇区 `<g>` 上，标签层复用同一个函数），引线另叠透明命中带。**外侧标签放行 `pointer-events` 是 LABEL-08 的例外**（落在环外、不压图元）；**扇区内档必须保持 `none`**，否则在扇区中间挖出死区（PIE-17）
  - **超宽截名称、不丢整条**（PIE-16）：数值段恒完整（截断的数字是错的数字），保底 1 字 + `…`；连最短形态都放不下才回落丢弃。图例侧另有纯 CSS 截断 + `title` 兜底（LEGEND-13）
  - **标签带宽只看容器不看文本**（PIE-13）：`min((容器宽 − 图例带)/2 − R, size-donut-label-band-max)`，两侧同值。这是为切断「带宽由文本反推 ↔ 文本按带宽截断」的环——改动它前先读 PIE-13 的说明
  - 强调态**两条视觉通道**：① 外扩——hover 临时 + 点击常驻，外半径 +`size-donut-hover-expand`（仅 Ainvest 10px，另两主题 0）带 200ms 补间（PIE-10/11）；② 不透明度弱化——**不随主题归零**，故 THS / iFinD-PC 只有在 `legendSelect: 'focus'` 档才看得见「点击选中」（LEGEND-14）。⚠️ 另两档下点扇区在那两个主题确实毫无反应，那是「0 即天然无形态」的预期结果，**不是缺陷、不要去补**。focus 档下图例项是扇区面 / 引线 / 标签之外的**第四个**入口，四者共用同一个 selected
- **SankeyChart**（`charts/charts/sankey/`，见 `specs/sankey.md` SANKEY-01..26）：表达节点间的**流向与流量**，**不属于堆叠图表族**。无坐标轴、无 band。要点：
  - **`role`（业务角色，定颜色）与 `stage`（横向阶段）必须由数据显式声明**——渲染器**不得**从「第几列」或「值是不是负数」反推。终止节点也不等同于最右列节点
  - 节点高与边宽只用**几何量 `magnitude = abs(value)`**，符号只表达贡献方向；最小 1px 只放大可见线宽，**不反写**原始值、节点比例、标签数值或会计守恒（SANKEY-17/25）
  - 主节点中心恒定在画板**垂直中轴**，后续列按流入重心逐级回拉中轴（SANKEY-21）
  - **季度播放**（SANKEY-24/26）：仅在相邻周期节点 ID 与 `source→target` **完全同拓扑**时插值，否则立即切换；滑块只落离散刻度、不沿轨道补间。同序列可声明统一 `scaleMax` 共享比例尺
  - 图例是**静态色卡**（`renderLegend` 不接 `onToggle`/`onHover`、标 `role="list"`），没有点击可言，故本族**不声明 `legendSelect` / `dataLabel` 等旋钮——不是漏了**（见 `demos/examples.js` `CHART_CAPABILITIES` 注释）
- **TreemapChart**（`charts/charts/treemap/`，见 `specs/treemap.md` TREEMAP-01..18）：入口型、通用、全局三种矩形树图共用一个 L2 内核和单画布面积布局；L2 只编排面积与标签降级顺序（**单层展示、无下钻**，TREEMAP-06），文字测量复用 L1 `measure.js`，图片内容复用 L1 `image-content.js`，颜色复用 L1 `visual-color.js`。业务字段统一在 `demos/` 映射为 `presentation`，不得在组件内识别主题、品牌、股票、行业分组或行情字段。

- **RadarChart**（`charts/charts/radar/`，见 `specs/radar.md` RADAR-01..18）：多指标综合对比图。无坐标轴、无直角网格，`axis`/`axis-title`/`grid`/`crosshair`/`datazoom` 整条链路不适用；既有通用构件继续复用，分区形态通过 L1 `visual-color.js` 取得通用表现色阶。要点：
  - **极坐标 ≠ 雷达**：饼环也画在极坐标里，但两者做的是**相反**的事——饼环「值 → 角度、半径恒定」，雷达「角度均分（`360/n`）、值 → 半径」。真正共享的只有 `(角度,半径)→(x,y)` 那个三角公式，故**没有 `core/polar.js`**；极坐标几何在 `radar/geometry.js` 标 `[L2-LOCAL]`。**将来三个下沉点的判断条件写在 `specs/radar.md` 的「分层边界」与 `geometry.js` 文件头**——做仪表盘的人先读那两处，它会命中「下沉点 ②」（绕圆标签几何 `labelAnchor` / `labelArc`），正确做法是提到 L1 两边共用，**不是照抄一份**
  - **值域上界两条路**（RADAR-04）：给了 `max` 就定死、`[0,max]` 均分；不给才走 `niceSplit`。留这个口子是因为 `niceSplit(0, 5, {lineCount:4})` 会得出 5.4——0–5 评分被画成 0–5.4，且两张图数据不同时量程不同、形状不可比
  - **n 根轴共用一把标尺**（RADAR-17）：不做逐轴归一化。这是**明确的非目标不是待办**——逐轴各自量程会让图形面积失去意义，且容易靠调量程把形状「调好看」
  - **常规雷达的 hover 热区是扇形不是数据点**（RADAR-10，基线 9.1 的 0728 更新）；气泡恒 `follow`（TOOLTIP-07 无坐标系图特例，L2 定死、不进 behavior.json）。点系列进钉住态（RADAR-11）：一个问「这个维度各系列多少」，一个问「这个系列各维度多少」
  - **可调节雷达图**是 `editable: true` 的单系列输入能力（RADAR-18），不是新图族也不占 `variant`；手柄沿径向轴拖动、可键盘调值，仍共用 `[0,max]` 标尺。它不渲染常规扇形 hover 热区；多系列直接抛错，避免同轴手柄重叠后编辑对象不明
  - 对外示例分**标准雷达 / 多数据雷达 / 分区雷达**，但组件视觉变体仍只有 `variant: 'basic' | 'rating'`，多数据只由 `series` 数量表达且不开放可调节能力；仅 index 详情页用“数据组数”滑块选择 2–10 条示例系列，它不是 `CHART_CAPABILITIES` 或组件配置。网格形状（圆 / 正多边形）、闭合形状（直线 / 曲线）与维度标签排列（横排 / 环绕）是可正交组合的组件 cfg；可调节能力只用于单系列。主预览面用旋钮组合，专项面对六个典型配置做三主题回归。维度标签用 `axisLabelLayout: 'horizontal' | 'arc'`，常规默认横排、editable 默认环绕，两者均可显式覆盖。分区示例用 `ratingStyle` 在连续渐变（默认）与离散色带间切换；渐变固定取独立五档色阶，离散档支持独立的 5 / 6 段色阶，`ratingBandLabels.length` 同时控制图内色带、环线与底部色块，阈值文案可配置、色值不可配置

下一步以 `specs/*.md` 的未完成项和 `WORKFLOW.md` 第八节为准；未验证能力不要标为完成。
