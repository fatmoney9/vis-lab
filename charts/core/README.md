# Charts Core

`charts/core/` 存放可复用的图表基础构件、计算逻辑和主题行为解析能力。

## 构件清单

规则的**权威定义在 `specs/*.md`**，本表只说「哪个文件干什么」，不复述规则。

| 文件 | 职责 | 权威规范 |
|---|---|---|
| `frame.js` | 绘制区几何与 SVG 骨架、容器自适应（`xBand:false` 即无轴画布，`minGridHeight:0` 关掉轴图的最小高兜底，供饼环用）。另导出 `verticalGeometry()`：上下留白与绘图区高度的**纯计算**，与刻度无关故可在算刻度前先问出来（LABEL-10 的呼吸位需要它），`createFrame` 内部也调它、公式只此一份 | axes.md（AXIS-01/04、GRID-03）、pie.md（PIE-02/PIE-08）、data-label.md（LABEL-10） |
| `split.js` | **刻度三件套的纯数学**（min/max/interval、0 恒落线、占比最大化、双轴共享分割线）。零依赖，故可被 node 加载、有单测 | axes.md（SCALE-01/03/04） |
| `scale.js` | 值 → 像素的比例尺（`linearY` / `bandX`，依赖 d3）。**刻度数学不在这里**——见 `split.js`，拆开只为可测 | axes.md（SCALE-02） |
| `grid.js` | 网格线与 0 轴基线 | axes.md（GRID-01/02） |
| `axis.js` | X / Y 轴标签、列宽与碰撞 | axes.md（AXIS-01..08） |
| `axis-title.js` | 轴标题带高、锚点与同带内让位（默认不显示） | axis-title.md（AXISTITLE-01..06） |
| `measure.js` | 文本测量，全库唯一测量源（零 import，可被 node 加载）。`measureTexts` 量**宽**——走隐藏 SVG + 真实类名，因为宽度受 `tabular-nums` / `letter-spacing` 等 Canvas 表达不了的 CSS 特性影响；`measureInk` 量**墨迹上下边**——走 Canvas，因为 SVG 的 `getBBox()` 对 text 返回的是 em 盒不是墨迹（字体仍从 `getComputedStyle` 读，不猜） | axes.md（AXIS-01 / AXIS-08） |
| `mark.js` | 柱 / 线 / 数据点的图元渲染（返回逐帧重绘闭包供生长动效驱动） | bar.md、line.md、motion.md |
| `motion.js` | 缓动曲线与逐帧生长循环（零 DOM，rAF / 时钟可注入） | motion.md（MOTION-01..07） |
| `label.js` | 数据标签渲染、三档前景色（跟随系列色 / 按底色反色 / 中性）与碰撞过滤（`dropCollisions` 收 `{start,size}`，**两个方向共用**：柱线判行、饼环外侧标签判列） | data-label.md（LABEL-01..09） |
| `legend.js` | 图例渲染与显隐 / 弱化事件；排布方向可参数化（横排换行 / 纵向单列） | legend.md（LEGEND-01/10/11） |
| `legend-state.js` | 图例点击的状态迁移：`applyToggle`（筛，改 hidden）/ `applyFocus`（强调，改 selected）。**与 legend.js 分开只为一件事**——那边 import d3，住在里面就一行测不了 | legend.md（LEGEND-06/12/14） |
| `tooltip.js` · `crosshair.js` | 浮层气泡、**X / Y 两向**指示线与轴高亮贴片（气泡标题行可省，供无坐标系图用；**三个位置档的 clamp 边界由本模块按档自取**，`place()` 不收容器尺寸——见 tooltip.md「位置档的边界」；Y 向横线 + Y 值徽标默认关，见 TOOLTIP-12） | tooltip.md |
| `datazoom.js` | 缩放轴轨道 / 手柄与窗口事件 | datazoom.md |
| `watermark.js` · `watermark-assets.js` | 品牌水印（资源为生成物，勿手改） | watermark.md |
| `palette.js` | 系列取色器 | color.md |
| `format.js` | 数值格式化 | format.md |
| `theme.js` | 主题行为解析（behavior.json → 参数） | WORKFLOW 第六节 |
| `tokens.js` | 从计算样式读取 CSS 自定义属性 | — |

## 边界

- 本目录放置可复用的生产逻辑，不放具体 Preview 页面和演示数据（示例数据在 `demos/`）。
- 组件结构样式集中在 `charts/styles.css`。
- 颜色、字号、间距和尺寸等主题值来自 `tokens/` 生成的 CSS 变量。
- 参与几何计算或逻辑分支的主题差异来自 `tokens/behavior.json`。
- Core 组件不应硬编码具体主题判断；主题配置应先解析为参数，再传给组件。
- Playground 中出现可复用的计算或渲染逻辑时，应回收到本目录。

## 设计原则

Core 构件应尽量保持纯函数、参数化和幂等渲染。同一份组件实现需要支持不同主题、端和颜色模式，而不是复制多套主题组件。

