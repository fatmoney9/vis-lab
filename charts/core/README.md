# Charts Core

`charts/core/` 存放可复用的图表基础构件、计算逻辑和主题行为解析能力。

## 构件清单

规则的**权威定义在 `specs/*.md`**，本表只说「哪个文件干什么」，不复述规则。

| 文件 | 职责 | 权威规范 |
|---|---|---|
| `frame.js` | 绘制区几何与 SVG 骨架、容器自适应 | axes.md（AXIS-01/04、GRID-03） |
| `scale.js` | 比例尺与刻度算法（含双轴 0 对齐） | axes.md（SCALE-01..04） |
| `grid.js` | 网格线与 0 轴基线 | axes.md（GRID-01/02） |
| `axis.js` | X / Y 轴标签、列宽与碰撞 | axes.md（AXIS-01..08） |
| `axis-title.js` | 轴标题带高、锚点与同带内让位（默认不显示） | axis-title.md（AXISTITLE-01..06） |
| `measure.js` | 渲染级文本测量，全库唯一测量源（零依赖，可被 node 加载） | axes.md（AXIS-08） |
| `mark.js` | 柱 / 线 / 数据点的图元渲染（返回逐帧重绘闭包供生长动效驱动） | bar.md、line.md、motion.md |
| `motion.js` | 缓动曲线与逐帧生长循环（零 DOM，rAF / 时钟可注入） | motion.md（MOTION-01..07） |
| `label.js` | 数据标签渲染、明暗反色与碰撞过滤 | data-label.md（LABEL-01..08） |
| `legend.js` | 图例渲染与显隐 / 弱化事件 | legend.md |
| `tooltip.js` · `crosshair.js` | 浮层气泡、指示线与轴贴片 | tooltip.md |
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

