# Playground

用于存放图表组件的拼装、主题对比和开发预览页面。

## 启动

在仓库根目录运行：

```sh
python3 -m http.server 8123
```

然后访问 <http://localhost:8123/playground/cartesian-preview.html>。当前入口展示
`CartesianChart` 的柱、堆叠、折线、折柱组合和双 Y，并支持三主题、PC/移动端、明暗和数据量切换。

## 在线预览

GitHub Pages：<https://amomonkey.github.io/vis-lab/>。

站点从 `main` 分支的仓库根目录发布；根目录 `index.html` 负责进入本 Preview。推送到 `main` 后，
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
