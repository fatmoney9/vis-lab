# SankeyChart · L1 复用声明

> 本页由 `hooks/lint-l1-declaration.mjs` 校验，并与本目录代码中的 L1 import 逐条对账。
> 桑基图的产品规则与 API 见 `specs/sankey.md`。

| L1 模块 | 状态 |
|---|---|
| `axis` | 不用：桑基图没有坐标轴标签与刻度 |
| `axis-title` | 不用：无坐标轴，也没有轴标题带 |
| `crosshair` | 不用：交互直接命中节点和流向，不使用坐标指示线 |
| `datazoom` | 不用：季度切换使用离散播放轴，不是连续类目开窗 |
| `format` | 用 |
| `frame` | 用 |
| `grid` | 不用：桑基节点与流向不依赖坐标网格 |
| `image-content` | 不用：节点看板没有图片内容，Tooltip 也不带实体图标 |
| `label` | 用 |
| `legend` | 用 |
| `legend-state` | 不用：桑基图例是静态业务角色色卡，不响应点击状态 |
| `mark` | 不用：节点矩形和贝塞尔流向不是柱线图元 |
| `measure` | 用 |
| `motion` | 用 |
| `palette` | 不用：颜色按收入、支出、利润业务角色解析，不按系列序号取色 |
| `scale` | 不用：流量几何由桑基守恒布局统一换算，不使用坐标比例尺 |
| `split` | 不用：无坐标刻度，不需要 nice split 数学 |
| `theme` | 用 |
| `tokens` | 用 |
| `tooltip` | 用 |
| `visual-color` | 不用：颜色跟随显式业务角色，不使用系列、强度或涨跌分档策略 |
| `watermark` | 不用：当前财报桑基规范没有水印层 |

## L1 / L2 / L3 边界

- L1：`frame.observeResize` 统一 resize 生命周期；`measure.createTextMeasurer` 统一真实 SVG
  文字测量；`motion.easeOutCubic` / `reducedMotion` 统一缓动曲线与减弱动效判断。格式化、标题省略、
  图例、主题行为、token 读取和 Tooltip 继续复用既有 L1。
- L2 `index.js`：只负责编排组件生命周期、SVG 装配、交互和季度播放时序。
- L2 `layout.js`：桑基专属 DAG 校验、守恒、节点 / 流带几何、高度与标签尺寸计算。
- L2 `model.js`：节点看板、直接邻域、同拓扑判断、季度数值插值，以及共享比例尺 / 序列视口装配；
  主轴识别与各期所需高度都复用 `layout.js` 的校验和布局结果，不包含 DOM，也不复制布局公式。
- L2 `config.js`：跨主题不变的桑基几何、字号范围与播放参数，并把主题色解析为全局 token 引用。
- L3：演示数据与配置装配放在 `demos/`；两个预览入口共用
  `demos/sankey-playback.js` 的播放区 DOM 与动态刻度模板，以及
  `demos/sankey-playback.css` 的播放区视觉。独立财报验收场景仍放在
  `playground/sankey-preview.html`，页面只保留各自的画板外框和状态接线；组件目录不保存业务样例
  或页面控制逻辑。
- 全局结构样式：`charts/styles.css` 的 `.dv-sankey` 命名空间。

主题业务色与字体来自全局 token；`config.js` 不承载品牌分叉。节点高度到字号的映射、数值缩字、
统一标签槽和所有纵向几何仍由桑基 L2 负责。季度播放保留原来的“文字先切换 → 120ms 停留 →
720ms 几何补间 → 暂停冻结当前帧”时序；它与 L1 `runGrowth` 的取消即落终态语义不同，因此只复用
L1 的曲线和减弱动效判断，不强行改用 `runGrowth`。
