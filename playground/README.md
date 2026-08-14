# Playground · 开发验收面

三主题横向并排的开发预览，用于规范验收和视觉目检。与根目录 `index.html`（对外站点）
是**同源不同展示**的两个面：示例定义共用 `demos/examples.js` 一份，本目录只决定「怎么展示」。

- 入口：<http://localhost:8123/playground/preview.html>（需 HTTP 服务，见根 [README](../README.md)）
- 加示例 / 接新图表类型改 `demos/`，不改本目录——步骤见 `demos/examples.js` 文件头
- 分层与目录边界见 [WORKFLOW.md](../WORKFLOW.md)，本页不复述

本目录还有第二个入口 <http://localhost:8123/playground/sankey-preview.html>（`SankeyChart · 独立预览`）：
SANKEY-23 要求 812×375px 固定财报演示外框、桑基可视区恒 243px，三主题并排卡片网格表达不了，故单开一面。
⚠️ 它**自带数据、不 import `demos/examples.js`**，是全库唯一脱离单一示例源的展示面——改桑基示例要两处同步。
这是上面第二条的**唯一例外**，理由与代价见 [WORKFLOW.md](../WORKFLOW.md) 第七节。

## 与对外站点的差异

| | 本页 | `index.html` |
|---|---|---|
| 主题 | 三主题横向并排对比 | 单主题下拉切换 |
| 旋钮 | 全套（含 `dataLabel` 等验收用开关） | 同一套，按 `CHART_CAPABILITIES` 显隐 |
| 尺寸 | 卡片可拖拽 resize | 同样可拖拽；高度默认由图表撑开 |
| 示例 | `surfaces` 含 `playground` 的全部 | `surfaces` 含 `index` 的部分 |

## 卡片尺寸口径

卡片首次按端给默认宽度：PC 736px、移动端 390px。绘制区高度读主题 token——
**直角坐标图**读 `size-chart-region-height`（THS 160px、iFinD-PC / Ainvest 200px），口径按 `GRID-03`：
inside 为顶/底轴线间距，outside 为顶/底 Y 标签外缘间距，**不含** X 轴标签带、轴标题带、图例和卡片外壳；
**饼 / 环**读 `size-donut-container`（三主题均 160px），口径按 `PIE-02`——它**只是高度包络**、不约束宽度：
半径在这个高度内按 token 上限取值、放不下才等比收缩，而**画布宽由图元反推**
（无外侧标签时 = 2R；开了外侧标签则 = 左标签带 + 2R + 右标签带，而**带宽只看容器、不看文本**：
`min((容器宽 − 图例带)/2 − R, size-donut-label-band-max)`，两侧同值，PIE-13）。
故切换对齐档或改数据量时**环的大小和位置一动不动**，变的只是文字在固定带内的排布——这是 PIE-13 的验收点。
**半径与环宽按主题分化**：THS / iFinD-PC `70 / 28`、Ainvest `80 / 32`（比值都是 0.4），
故三主题横排时 Ainvest 的环明显大一圈，属预期。

默认尺寸建立后可从卡片右下角双向拖拽，图表随容器宽高重排——用于验收 `GRID-03` 的容器自适应、
`AXIS-06` 的 X 标签碰撞与 `LABEL-06` 的数据标签碰撞。
