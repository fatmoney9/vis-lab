# Vis Lab · 可视化规范站

把设计稿里的可视化规范，迁移成**可交互、可回归、单一权威**的组件库与规范站。

在线预览：<https://fatmoney9.github.io/vis-lab/>

## 这是什么

一套 design token 驱动的图表组件：用 D3 做计算、项目代码显式装配 SVG、样式全部走 CSS 变量，
同一份组件代码横跨 **THS / iFinD-PC / Ainvest 三个主题** × PC/移动端 × 明暗。

核心约定是**「每条规范只有一个家」**：`specs/` 里每条规则有稳定 ID（`BAR-02`、`LABEL-05`…），
实现处的代码注释回引该 ID，提交前守卫校验回引有效。改规范时代码只该改一个地方。

## 快速开始

```bash
python3 -m http.server 8123     # 预览需 HTTP 服务，file:// 打不开（ES Module + fetch）
node tokens/build.mjs           # 改过 tokens/*.json 后重建 tokens.css
node --test tests/*.mjs         # 纯逻辑单测
```

| 地址 | 用途 |
|---|---|
| <http://localhost:8123/> | **对外站点**：画廊 + 详情页，单主题切换 |
| <http://localhost:8123/playground/cartesian-preview.html> | **开发验收面**：三主题横向并排、旋钮更全、卡片可拖拽 |

提交前门禁（`hooks/pre-commit` 会跑，不要绕过）：

```bash
node --test tests/*.mjs && sh hooks/lint-layers.sh && node hooks/lint-spec-ids.mjs
```

## 目录导览

| 目录 | 层 | 内容 |
|---|---|---|
| `tokens/` | L0 | 三主题值 token、行为矩阵、系列色板；`tokens.css` 是生成物，不要手改 |
| `charts/core/` | L1 | 跨图表共享构件：轴、轴标题、网格、图例、tooltip、缩放轴、水印、数据标签、动效、比例尺、格式化 |
| `charts/charts/` | L2 | 图表编排（当前 `cartesian`：柱 / 堆叠 / 折线 / 折柱组合 / 双 Y） |
| `specs/` | L3 | 条目化规范，规则 ID 的权威定义 |
| `demos/` | L3 | 两个预览面共享的示例数据源与图表类型注册表 |
| `index.html` · `playground/` | L3 | 两个预览面，只负责展示 |
| `tests/` · `hooks/` | — | 纯逻辑单测与提交前守卫 |

依赖方向只能向下：L3 → L2 → L1 → L0。

## 常见任务

| 我要… | 改哪里 |
|---|---|
| 加一个图表示例 | `demos/examples.js` 加一项（两个预览面自动生效） |
| 接一种新图表（饼 / 环 / 横条…） | `demos/registry.js` 登记组件 + `demos/examples.js` 声明能力与示例；步骤见该文件头 |
| 改颜色 / 字号 / 间距 | `tokens/<theme>.json` 后 `node tokens/build.mjs`；**源码里禁止色值字面量** |
| 改布局形态（轴位置、碰撞策略…） | `tokens/behavior.json`，L1 保持主题无关 |
| 改一条规范 | 先改 `specs/*.md` 的条目，再改对应的那一个模块 |

## 文档

| 文件 | 说什么 |
|---|---|
| [WORKFLOW.md](WORKFLOW.md) | **权威**：分层架构、拼接铁律、主题双通道机制、日常工作流 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 分支、提交、PR 与质量门禁 |
| [TESTING.md](TESTING.md) | 测试分层、覆盖矩阵、视觉基线规则 |
| [AGENTS.md](AGENTS.md) | 给 AI 会话的项目约定 |
| [specs/](specs/) | 各规范条目：[坐标轴](specs/axes.md) · [轴标题](specs/axis-title.md) · [柱](specs/bar.md) · [折线](specs/line.md) · [颜色](specs/color.md) · [图例](specs/legend.md) · [浮层](specs/tooltip.md) · [数值格式](specs/format.md) · [缩放轴](specs/datazoom.md) · [水印](specs/watermark.md) · [数据标签](specs/data-label.md) · [动效](specs/motion.md) |

当前进度与后续里程碑见 [WORKFLOW.md 第八节](WORKFLOW.md#八当前状态与后续里程碑)；
各规范页末尾的「待办」是未完成能力的权威清单——未验证的能力不标为完成。
