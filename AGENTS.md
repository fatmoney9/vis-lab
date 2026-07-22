# Project instructions

## 定位

这是一个以 design token 驱动的可视化规范原型：用 D3 辅助计算和 SVG DOM 装配，实现跨 THS、iFinD-PC、Ainvest 三主题的直角坐标图。

## 运行与验证

- 启动预览：`python3 -m http.server 8123`，访问 `http://localhost:8123/playground/cartesian-preview.html`。
- 线上预览：`https://fatmoney9.github.io/vis-lab/`；GitHub Pages 从 `main` 分支根目录发布。
- 重建 token：`node tokens/build.mjs`。
- 运行单元测试：`node --test tests/*.mjs`。
- 提交前门禁：`node --test tests/*.mjs && sh hooks/lint-layers.sh && node hooks/lint-spec-ids.mjs`。
- 仓库已配置 `core.hooksPath=hooks`；不要绕过 pre-commit。
- 完整测试分层、覆盖矩阵和基线规则见 `TESTING.md`。

## 技术栈

原生 ES Modules、D3 v7（预览页 import map）、SVG、CSS 自定义属性、Node.js token 构建脚本；无 package manager 和打包器。

## 目录与约定

- `tokens/` 是主题值、行为和系列色板的权威源；不要手改生成的 `tokens/tokens.css`。
- `charts/core/` 是 L1 共享构件，`charts/charts/` 是 L2 图表编排，`specs/` 是规则 ID 权威定义。
- `playground/` 只做开发预览；组件 API 只收数据与语义配置，不收样式参数。
- 详细分层、主题通道和规范变更流程以 `WORKFLOW.md` 为准。
- 多人分支、中文提交、验证和 PR 约定以 `CONTRIBUTING.md` 为准。

## 当前状态与下一步

当前已实现 CartesianChart 的柱、堆叠、折线、折柱组合、双 Y、hover/tooltip 链路和缩放轴（datazoom，见 `specs/datazoom.md`）。下一步以 `specs/*.md` 的未完成项和 `WORKFLOW.md` 第八节为准；未验证能力不要标为完成。
