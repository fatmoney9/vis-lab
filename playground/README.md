# Playground · 开发验收面

三主题横向并排的开发预览，用于规范验收和视觉目检。与根目录 `index.html`（对外站点）
是**同源不同展示**的两个主面：示例定义共用 `demos/examples.js` 一份，本目录只决定「怎么展示」。

- 入口：<http://localhost:8123/playground/preview.html>（需 HTTP 服务，见根 [README](../README.md)）
- 加示例 / 接新图表类型改 `demos/`，不改本目录——步骤见 `demos/examples.js` 文件头
- 分层与目录边界见 [WORKFLOW.md](../WORKFLOW.md)，本页不复述

本目录还有两个专项入口，**性质不同、别混为一谈**：

### <http://localhost:8123/playground/radar-preview.html>（`RadarChart · 对照面`）

雷达六个典型配置（基础 / 多数据 / 曲线轮廓 / 多边形网格 / 分区 / 可调节能力）× 三主题十八张图**同屏铺开**，
改一版 token 或几何能一眼看到全部影响。它们是视觉回归矩阵，不是六种互斥图表类型；对外分类为
标准雷达 / 多数据雷达 / 分区雷达；多数据是只读数据形态，不是新的组件 `variant`。对照面可全局切换维度标签的排列，默认「跟随示例」——六张卡同屏时逐卡高亮无处可放，故把示例自己的默认做成显式一档，可调节配置照旧环绕、其余照旧横排。
✅ 它**import `demos/examples.js`**、只负责「怎么摆」，且按 `chart === 'radar'` 筛示例而非写死 id，
故加示例仍然只改 `demos/`，**没有两处同步的代价**。要为某个图型另开对照面，照这个、不要照下面那个。

### <http://localhost:8123/playground/sankey-preview.html>（`SankeyChart · 独立预览`）

SANKEY-23 要求 812px 横版财报验收框，并按播放序列的最大所需高度建立统一视口；三主题并排卡片网格表达不了，故单开一面。
⚠️ 它**自带数据、不 import `demos/examples.js`**，是全库唯一脱离单一示例源的展示面——改桑基示例要两处同步。
这是「加示例只改 `demos/`」的**唯一例外**（雷达对照面不算——它 import 共享示例源），
理由与代价见 [WORKFLOW.md](../WORKFLOW.md) 第七节。

## 与对外站点的差异

| | 本页 | `index.html` |
|---|---|---|
| 主题 | 三主题横向并排对比 | 单主题一键切换（左栏常驻示例列表，换图不重置旋钮） |
| 旋钮 | 全套（含 `dataLabel` 等验收用开关） | 同一套，按 `CHART_CAPABILITIES` 显隐；**数据量除外**——见下一行 |
| 数据量 | **三档预设**（少量/中量/大量，`densityValues`）：要的是可复现的固定场景，便于截图对比与回归 | **连续滑杆**（`densityRange`，逐一取值）：要的是随手拉到任意一档看形变。两条通道都由 `buildConfig` 收口、共用同一份示例定义，见 [WORKFLOW.md](../WORKFLOW.md) 第四节 |
| 数据组数 | 不提供；保持示例默认系列数，便于三主题固定回归 | 仅带 `indexSeriesRange` 的多系列示例显示滑杆；它只增减假数据系列，不是图表能力 |
| 尺寸 | 卡片可拖拽 resize（`320×160` 下限）；**换示例时重置**拖出来的尺寸，动旋钮则保留 | 同样可拖拽、**同一下限**（`.stage__surface`）；详情页每次进入本就是新建，天然重置 |
| 示例 | `surfaces` 含 `playground` 的全部 | `surfaces` 含 `index` 的部分 |

## 卡片尺寸口径

卡片首次按端给默认宽度：PC 736px、移动端 390px。绘制区高度读主题 token——
**直角坐标图**读 `size-chart-region-height`（THS 160px、iFinD-PC / Ainvest 200px），口径按 `GRID-03`：
inside 为顶/底轴线间距，outside 为顶/底 Y 标签外缘间距，**不含** X 轴标签带、轴标题带、图例和卡片外壳；
**矩形树图**没有专属高度 token——它**填满整个容器**，容器没给高才退到同一个 `size-chart-region-height`（TREEMAP-08）；
**饼 / 环**读 `size-donut-container`（三主题均 160px），口径按 `PIE-02`——它**只是高度包络**、不约束宽度：
半径在这个高度内按 token 上限取值、放不下才等比收缩，而**画布宽由图元反推**
（无外侧标签时 = 2R；开了外侧标签则 = 左标签带 + 2R + 右标签带，而**带宽只看容器、不看文本**：
`min((容器宽 − 图例带)/2 − R, size-donut-label-band-max)`，两侧同值，PIE-13）。
故切换对齐档或改数据量时**环的大小和位置一动不动**，变的只是文字在固定带内的排布——这是 PIE-13 的验收点。
**半径与环宽按主题分化**：THS / iFinD-PC `70 / 28`、Ainvest `80 / 32`（比值都是 0.4），
故三主题横排时 Ainvest 的环明显大一圈，属预期。
**雷达**读 `size-radar-container`（THS / iFinD-PC 200px、Ainvest 220px），口径按 `RADAR-09`——
与饼环同一套「半径先按容器定、标签带吃剩下的」。横排档的标签带**横竖分开**：纵向带只装一行轴标签（约 20px，
开了 `axisValue` 则约 36px），横向带才吃剩余宽度并封顶 `size-radar-label-band`（56px）；环绕档沿外围弧线排维度名、忽略 `axisValue`。
故画布是 `2(R+横向带) × 2(R+纵向带)`、**不是正方形**。半径同样按主题分化（THS / iFinD-PC `80`、
Ainvest `90`），Ainvest 大一圈亦属预期；容器另有**最小高度**（由组件按「触底画布 + 图例 + 间距」
算出，`axisValue` 关 160px / 开 192px），低于它顶部轴标签会叠进图例，故到达后改为溢出滚动。

默认尺寸建立后可从卡片右下角双向拖拽，图表随容器宽高重排——用于验收 `GRID-03` 的容器自适应、
`AXIS-06` 的 X 标签碰撞与 `LABEL-06` 的数据标签碰撞。
