# Playground · 开发验收面

三主题横向并排的开发预览，用于规范验收和视觉目检；声明了密度档的主题在其标准卡下方多一张密度档卡
（当前为「Ainvest · 紧凑」，见 [tokens/README.md](../tokens/README.md)「密度覆盖层」）。与根目录 `index.html`（对外站点）
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

## 卡片尺寸

卡片首次按端给默认宽度（PC 736px、移动端 390px），高度由各图型的主题 token 决定，口径以各自规范为准（直角坐标图 GRID-03、矩形树图 TREEMAP-08、饼环 PIE-02、雷达 RADAR-09）。
默认尺寸建立后可从卡片右下角双向拖拽，图表随容器宽高重排——用于验收 `GRID-03` 的容器自适应、
`AXIS-06` 的 X 标签碰撞与 `LABEL-06` 的数据标签碰撞。
