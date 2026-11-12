# Project instructions

## 定位

这是一个以 design token 驱动的可视化规范原型：用 D3 辅助计算和 SVG DOM 装配，实现跨 THS、iFinD-PC、Ainvest 三主题的图表组件（当前有直角坐标图、排名对比图、饼 / 环、桑基、矩形树图、雷达图、瀑布图、弦图与全球热力图九族）。

## 运行与验证

- 启动预览：`python3 -m http.server 8123`。对外站点 `http://localhost:8123/`；开发验收面 `http://localhost:8123/playground/preview.html`（三主题并排、旋钮更全）。
- 线上预览：`https://fatmoney9.github.io/vis-lab/`；GitHub Pages 从 `main` 分支根目录发布。
- 质量门禁：`sh hooks/check.sh`（等价 `npm run check`）。这是**唯一一份检查清单**——token 重建、
  水印资源重建、语法、单测，外加分层、Spec ID、测试卫生、色值字面量、字体引用、L1 复用声明、预览面契约、分类图标、Ainvest 英文等守卫；`hooks/pre-commit` 与 CI 调的都是它。**条数与逐项顺序只看该脚本，文档一律不复述。**
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
| 解析主题 / 端形态 / 密度档 | `core/theme.js` | `themeOf` · `modeOf` · `densityOf` · `resolveBehavior`（已含密度覆盖层，L2 无需感知密度） |
| 数值格式化 | `core/format.js` | `makeFormatter` |
| **组件写死的文案（读屏描述 / 看板固定行名）** | `core/chart-text.js` | `resolveChartText`（缺省表 + `config.text` 整套替换）· `fillText`（`{key}` 模板）（[CHARTTEXT-01..03]）——别在 L2 拼中文模板字符串，Ainvest 的英文由 L3 注入 |
| 图例（渲染 / 点击状态） | `core/legend.js` · `core/legend-state.js` | `renderLegend` · `markerSpecFor` / `applyToggle` · `applyFocus` |
| **图元 hover / 点击钉住的状态** | `core/highlight-state.js` | `applyHover` · `applyLeave` · `applyPick` · `applyClear` · `activeTarget`（[SANKEY-10] / [SANKEY-20] / [TREEMAP-06]）——**钉位只有一个**，别在 L2 给每类图元各留一个变量再手工维持互斥 |
| **把文字摆在圆周上 / 求绕圆标签带宽** | `core/polar-label.js` | `pointAt`（极坐标→直角，**全库唯一三角公式**）· `labelAnchor`（八向对齐）· `labelArc`（可读弧线）· `labelBand`（带吃剩余并封顶）（[RADAR-07] / [RADAR-14] / [PIE-13]） |
| Tooltip 气泡 | `core/tooltip.js` | `createTooltip`（`place()` 自己算 clamp 边界，不要传容器尺寸）。**气泡宽度只在 TOOLTIP-01 一处定**（内容 / 视口 / 容器三道封顶）——不要给单个图型另写 `.dv-tooltip` 的 `max-width` 覆盖，内容放不下时先重量全族再调通用值 |
| 图片内容块（标准化 / 自适应 / SVG / Tooltip） | `core/image-content.js` | `normalizeImageContent` · `fitImageContent` · `renderImageContent` · `imageContentTooltip`（[IMAGECONTENT-01..04]） |
| 系列取色 | `core/palette.js` | `resolveSeriesColors` |
| 数据项取色（强度分档 / 涨跌 / 表现色阶） | `core/visual-color.js` | `intensityLevels` · `performanceColorRamp`（[COLOR-09/10]） |
| 比例尺与刻度 | `core/split.js`（刻度数学）· `core/scale.js`（像素换算） | `niceSplit` · `niceSplitDual` / `linearY` · `bandX` |
| 画布与 resize | `core/frame.js` | `createFrame` · `observeResize` · `verticalGeometry`（先于刻度问出绘图区高；`xBandLines` 声明多行 X 带）· **`containerDrivesHeight` / `containerTookOver`**（「高度由谁说了算」的两条判据，别再抄阈值）· `createBuildRetry`（容器塌陷时的下一帧重试，destroy 必须撤销） |
| 坐标轴 / 网格 / 轴标题 | `core/axis.js` · `core/grid.js` · `core/axis-title.js` | `renderYLabels` · `renderXLabels` · `axisLabelLines` / `renderAxisLabelLines` / `xAxisLabelTextLayout`（常态与高亮态共用的逐行内容与文字坐标）· `renderGrid` · `axisTitleBand` … |
| 数据标签（截断 / 碰撞 / 前景色） | `core/label.js` | `truncateBatch` · `dropCollisions` · `labelTone` |
| 图元（柱 / 线） | `core/mark.js` | `renderBars` · `renderLine` |
| **柱的 band 排布 / 堆叠累计 / 单根柱路径与圆角** | `core/bar-geometry.js` | `groupedBars` · `singleBar` · `stackBars` · `barPath`（四档方向：竖柱 `top`/`bottom` · 横条 `right`/`left`）· `barRadius`（[BAR-01/02/03/05/06] / [HBAR-02/03]）——零 import 故可单测；**`top`/`bottom` 被 golden value 锁死**，改之前先读 `specs/hbar.md` 的 Don't |
| **在图里指着某个点写一段说明**（环 + 文字 + 带箭头曲线引线） | `core/callout.js` | `renderCallouts`（位置自动选，不收方位参数）· `placeCallouts` / `scoreCandidate` / `calloutLeader` / `wrapByWidth`（均为纯几何，可单测）（[CALLOUT-01..16]）——**别和 `mark.js` 搞混**：那是柱/线图元，`MARK-` 前缀也是留给它的 |
| hover 指示线 / 轴高亮贴片 | `core/crosshair.js` | `renderCrosshairX` · `renderCrosshairY` · `renderCrosshairBlock` · `axisTagBox` / `renderAxisTag`（X 贴片，逐行内容和文字坐标复用 `axis.js`）· `renderYAxisTags`（Y 值徽标） |
| 缩放轴 | `core/datazoom.js` | `renderDataZoom` |
| 水印 | `core/watermark.js` | `watermarkAnchor` · `renderWatermark` |

**L1 有、但签名不合用时怎么办：参数化 L1，不要在 L2 另写一份。**
这是接 `PieChart` 时实测出来的结论（见 `docs/decisions.md`）——接新图型的 L1 成本几乎全部来自
「为轴图设的隐含假设被无轴图暴露」，正确修法是把假设收回 L1（如 tooltip `place()` 删掉容器尺寸参数），
而不是让新图型自带一份。判断粒度见 `WORKFLOW.md` 第三节。

**接新图型的硬要求：写一份 L1 复用声明**（`charts/charts/<名>/README.md` 的「L1 复用声明」小节），
把 `charts/core/` 下**每一个** L1 模块交代成「用」或「不用：<理由>」。由 `hooks/lint-l1-declaration.mjs`
校验，且**与代码里的 import 逐条对账**——说了用却没 import、或 import 了却没声明，门禁都会红，
所以这张表退化不成打勾的表格。声明结构可照抄现成的
`charts/charts/cartesian/README.md`、`charts/charts/pie/README.md` 或 `charts/charts/radar/README.md`；
模块总数由门禁读取 `charts/core/` 实时校验，文档不另存计数。

**接新图族还有两条硬要求，都由门禁拦（`hooks/check.sh` 的最后两条）**：

1. **必须配分类图标**（`demos/nav-icons.js`）。首页左栏的取法是
   `NAV_ICONS[分类名] ?? NAV_ICONS[族名] ?? ''`——**两级都取不到就渲染空串**，不报错、不留痕。
   建议两个键都加：只配分类名的话，将来改一次分类名图标就又静默消失。
   由 `hooks/lint-nav-icon.mjs` 校验。
2. **Ainvest 主题下图表内容必须是英文**。业务词加进 `demos/chart-presentation.js` 的 `AINVEST_TEXT`。
   由 `hooks/lint-ainvest-english.mjs` 校验**静态配置与逐期播放配置两条路**（遍历 `demos/themes.js` 里所有 `locale: 'en'` 的主题）。
   **L3 判断「要不要英文」一律走 `contentLocale()` / `isEnglishContent()`（`demos/themes.js`），不写 `theme === 'ainvest'`**——
   语言是主题的属性、不是主题身份；按 id 比较会在出现第二个英文主题 id 时静默落回中文。
   ⚠️ 该守卫查的是「词表翻得出来」，**查不到「某条路径绕开了 `buildConfig`」**——
   翻译只发生在装配线上，手拼 cfg 就会在那条路径上失效，而数据本身仍可翻译、守卫照样全绿。
   那一层由渲染断言兜（`tests/browser/hbar.browser.mjs` 的 Ainvest 段）。

这两条 2026-09-20 补进门禁，起因是两者当时都真的漏了：`排名变化` 族上线时左栏是个空位，
而首页播放的 `applyPeriod` 手拼 cfg，导致竞赛图「静止时是 Banking，一点播放就变回银行」。

## 技术栈

原生 ES Modules、D3 v7（预览页 import map）、SVG、CSS 自定义属性、Node.js token 构建脚本；无打包器。
根目录 `package.json` 只登记命令并声明 `"type": "module"`，**零依赖、无需 `npm install`**——所有脚本都能直接手敲。

## 目录与约定

- `tokens/` 是主题值、行为和系列色板的权威源；不要手改生成的 `tokens/tokens.css`。
  **密度档（如 Ainvest 紧凑）不是新主题**：`data-theme` 不变、同元素加 `data-density`，差异只写在 `tokens/density.json`（理由与合同见 `tokens/README.md`「密度覆盖层」）。
- `charts/core/` 是 L1 共享构件，`charts/charts/` 是 L2 图表编排，`specs/` 是规则 ID 权威定义。
- `demos/` 是各预览面共享的示例数据源：`examples.js`（示例清单，并统一转出 `data/` 假数据、`density.js` 数据量档位、`capabilities.js` 能力声明、`config.js` 配置装配——**import 一律走 `examples.js`**）、
  `themes.js`（主题清单 + 各主题图表内容语言 `locale`，L3 判断要不要英文的唯一出处）、
  `registry.js`（图表类型 → L2 组件）、`nav-icons.js`（首页左栏分类图标，门禁要 import 它核对）、
  `chart-presentation.js`（Ainvest 英文词表），以及 `playback/`（带时间轴图型共用的播放件，
  规则见 `specs/playback.md`）。**加示例、加图表类型只改 `demos/`**，`index.html` 与
  `playground/` 都不用动；具体步骤见 `demos/examples.js` 文件头（**五步，后两步由门禁拦**）。
  Ainvest 的**图表内部示例内容统一为英文**，由 `demos/chart-presentation.js` 在最终配置装配时转换；
  站点导航与配置面板仍保持中文。语言属于 L3 展示数据，不得把品牌或中英文判断写进 L2 组件。
  组件自己写死的文案（无障碍描述、看板固定行名）配置里没有、翻译够不着，走 L1 `core/chart-text.js`：
  L2 给中文缺省表，L3 经 `config.text` **整套**注入英文（`specs/chart-text.md`）。新增这类文案时两边同一次改齐，
  否则 Ainvest 渲染当场抛错。
  **唯一已知例外是桑基**：因 SANKEY-23 的 812px 横版财报外框与序列统一高度，另有 `playground/sankey-preview.html`
  独立面（**自带数据、不 import `demos/examples.js`**），且两个预览面里有专属样式与旋钮接线。
- **另有 `playground/radar-preview.html`**（雷达专用对照面，六个典型配置 × 三主题同屏；是回归矩阵、不是六种图表分类）。它与桑基那条**性质不同**：
  **它 import `demos/examples.js`、只负责「怎么摆」**，故没有「改示例要改两处」的漂移代价，加示例仍然只改 `demos/`。
  想为某个图型另开对照面时照它、不要照桑基。
  这是硬需求逼出来的特例，不是可照抄的范式——理由与代价见 `WORKFLOW.md` 第七节。
- `index.html` 是对外站点，`playground/` 是开发验收面；组件 API 只收数据与语义配置，不收样式参数。
  画廊卡片靠 `.example-card__preview .chart-host { pointer-events: none }` **继承**关掉交互，所以
  **组件样式不得给命中元素显式声明 `pointer-events`**——显式值优先于继承值，写死就等于在预览卡片里
  把鼠标要回来（2026-09-16 弦图与桑基图实测如此）。透明粗描边与 `fill: transparent` 的热区默认就能命中，不必声明。
- 详细分层、主题通道和规范变更流程以 `WORKFLOW.md` 为准。
- 多人分支、中文提交、验证和 PR 约定以 `CONTRIBUTING.md` 为准。

## 当前状态与下一步

当前有**九个 L2 图表组件**。每族的设计取舍与踩过的坑写在各自 README 的「要点」一节，**改某一族前先读那一节**；规则本身以规范页为准。

| 组件 | 目录（含要点） | 规范 |
|---|---|---|
| `CartesianChart` | `charts/charts/cartesian/README.md` | `specs/bar.md · specs/line.md` |
| `HBarChart` | `charts/charts/hbar/README.md` | `specs/hbar.md` |
| `PieChart` | `charts/charts/pie/README.md` | `specs/pie.md` |
| `SankeyChart` | `charts/charts/sankey/README.md` | `specs/sankey.md` |
| `TreemapChart` | `charts/charts/treemap/README.md` | `specs/treemap.md` |
| `WaterfallChart` | `charts/charts/waterfall/README.md` | `specs/waterfall.md` |
| `RadarChart` | `charts/charts/radar/README.md` | `specs/radar.md` |
| `ChordChart` | `charts/charts/chord/README.md` | `specs/chord.md` |
| `WorldHeatmapChart` | `charts/charts/world-heatmap/README.md` | `specs/world-heatmap.md` |

直角坐标系与饼环共用图例点击语义 `legendSelect`（`multi` / `single` / `focus`），见 `specs/legend.md` LEGEND-06 / LEGEND-14。

下一步以 `specs/*.md` 的未完成项和 `WORKFLOW.md` 第八节的里程碑为准；未验证能力不要标为完成。
