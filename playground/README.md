# Playground

用于存放图表组件的拼装、主题对比和开发预览页面。

## 启动

在仓库根目录运行：

```sh
python3 -m http.server 8123
```

然后访问 <http://localhost:8123/>。根目录 `index.html` 是正式页面；旧地址
<http://localhost:8123/playground/cartesian-preview.html> 仅保留兼容跳转。当前入口按「示例总览 → 单例详情」
组织 `CartesianChart` 的柱、堆叠、折线、折柱组合和双 Y：总览按图表族展示活预览，点击示例后
外露主题、PC/移动端、明暗、数据量、缩放轴、X 轴参考线和主线面积等语义配置，并可查看当前配置逻辑。
水印按主题规范恒开，不提供实例开关。

Preview 卡片首次按端提供默认宽度：PC 736px、移动端 390px；绘制区高度读取主题 token
`size-chart-region-height`：THS 160px、iFinD-PC/Ainvest 200px。高度口径按 `GRID-03`：inside 为
顶/底轴线间距，outside 为顶/底 Y 标签外缘间距，不含 X 轴标签带、图例和卡片外壳。默认尺寸建立后
仍可从卡片右下角双向拖拽，图表会随容器宽高重新排布。

## 在线预览

GitHub Pages：<https://fatmoney9.github.io/vis-lab/>。

站点从 `main` 分支的仓库根目录发布；根目录 `index.html` 直接承载 Preview。推送到 `main` 后，
以仓库 Actions 中 `pages build and deployment` 成功且上述公开地址返回正常页面为发布完成标准。

## 目录边界

- `charts/core/`：可复用的图表核心组件与计算逻辑。
- `charts/styles.css`：主题无关的图表结构样式。
- `tokens/`：主题值与行为配置的权威源。
- `playground/`：组合上述能力进行开发调试和视觉验收，不作为生产组件源码。

## 后续建议结构

```text
playground/
├── index.html          # Playground 入口（按需要增加）
├── legend/             # Legend 单组件或组合预览
├── axis/               # Axis 单组件或组合预览
├── charts/             # 拼装后的完整图表
├── themes/             # 多主题、多端、明暗模式对比
└── shared/             # 仅供 Playground 使用的公共代码与样式
```

Preview 页面应通过本地 HTTP 服务访问，不要直接使用 `file://` 打开，以保证 ES Module 和 JSON `fetch()` 正常工作。
