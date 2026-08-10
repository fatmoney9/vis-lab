# Project instructions

## 定位

这是一个以 design token 驱动的可视化规范原型：用 D3 辅助计算和 SVG DOM 装配，实现跨 THS、iFinD-PC、Ainvest 三主题的图表组件（当前有直角坐标图与饼 / 环两族）。

## 运行与验证

- 启动预览：`python3 -m http.server 8123`。对外站点 `http://localhost:8123/`；开发验收面 `http://localhost:8123/playground/preview.html`（三主题并排、旋钮更全）。
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
- `demos/` 是两个预览面共享的示例数据源：`examples.js`（示例清单 + 假数据 + 配置装配）与
  `registry.js`（图表类型 → L2 组件）。**加示例、加图表类型只改 `demos/`**，`index.html` 与
  `playground/` 都不用动；具体步骤见 `demos/examples.js` 文件头。
- `index.html` 是对外站点，`playground/` 是开发验收面；组件 API 只收数据与语义配置，不收样式参数。
- 详细分层、主题通道和规范变更流程以 `WORKFLOW.md` 为准。
- 多人分支、中文提交、验证和 PR 约定以 `CONTRIBUTING.md` 为准。

## 当前状态与下一步

当前有**两个 L2 图表组件**：

- **CartesianChart**（`charts/charts/cartesian/`）：柱、堆叠、折线、折柱组合、双 Y、hover/tooltip 链路、缩放轴（datazoom，见 `specs/datazoom.md`）、水印（watermark，见 `specs/watermark.md`）、数据标签（data label，见 `specs/data-label.md`）、轴标题（axis title，见 `specs/axis-title.md`，默认不显示）和入场生长动效（motion，见 `specs/motion.md`，默认开、仅实例首次挂载时播）。
- **PieChart**（`charts/charts/pie/`，见 `specs/pie.md` PIE-01..14）：饼与环**同一个组件**，靠 `variant: 'donut' | 'pie'` 分形态。无坐标轴，复用同一套图例 / 数据标签 / tooltip / 水印 / 动效 / 取色构件。要点：
  - 画布 = **图元的外接框**，不留富余——图元含圆外的引线与标签带；无外侧标签时退化为环的外接方框 2R。多出的画布会变成图元与图例之间随容器浮动的死空间（PIE-02）。**唯一的有意例外**：两侧标签带**恒等宽**（取较宽一侧所需，每侧封顶 `size-donut-label-band-max` 120），窄侧那截空白换来圆心不偏离画布中心（PIE-13）
  - 半径 = `clamp(默认半径 × 0.5, 短边/2, 默认半径)`——token 是上限，**收缩有底**（THS/iFinD 35、Ainvest 40）；触底后环溢出画布而非继续变小（PIE-02）
  - 两种图例布局：`legend: 'right'`（默认，左右结构）/ `'bottom'`（上下结构），间距 24px、整组居中，**图例块与环共享同一条中线**；两种结构都封顶 + 溢出滑动，上限左右 = 图元高 × 2（L2 算好写进 `--dv-pie-legend-max-h`）、上下 = 默认图元高 `size-donut-radius × 2`（纯 CSS，锚 token 是为断开「图例高 → 半径 → 图例上限」的循环）（PIE-09 / LEGEND-10/11）
  - 扇区取色走**扇区专用盘 `pie-multi`**（THS 11 色；未声明该盘的主题回落通用 `bar-multi`），单扇区仍取 `single-default`（COLOR-08）
  - 气泡恒走 `follow` 档（TOOLTIP-07 的无坐标系图特例，在 L2 定死、不进 behavior.json）
  - **数据标签默认不显示**（LABEL-05「一个类目一个值就出标签」原则的明确例外）。开启后有两种**互斥**形态：`labelLayout: 'outside'`（默认，外侧标签 + 引线，PIE-12/13/14）/ `'inside'`（扇区内，PIE-04）——引线与标签强绑定，所有丢弃都必须在画线前判完
  - 外侧标签 = **名称段 + 数值段**，两段各有自己的字号/行高 token（PIE-15）；**排布形态走 `behavior.json` 的 `pie-label-form`**：THS / iFinD-PC `inline` 同行、Ainvest `stacked` 名称在上数值在下。`inline` 档要求两段字号相同（异字号必须 stacked，否则同行混排会让单一 class 的测量系统性偏窄）
  - **超宽截名称、不丢整条**（PIE-16）：数值段恒完整（截断的数字是错的数字），保底 1 字 + `…`；连最短形态都放不下才回落丢弃。图例侧另有纯 CSS 截断 + `title` 兜底（LEGEND-13）
  - **标签带宽只看容器不看文本**（PIE-13）：`min((容器宽 − 图例带)/2 − R, size-donut-label-band-max)`，两侧同值。这是为切断「带宽由文本反推 ↔ 文本按带宽截断」的环——改动它前先读 PIE-13 的说明
  - 强调态外扩：hover 临时 + 点击常驻，外半径 +`size-donut-hover-expand`（仅 Ainvest 10px，另两主题 0）带 200ms 补间（PIE-10/11）

下一步以 `specs/*.md` 的未完成项和 `WORKFLOW.md` 第八节为准；未验证能力不要标为完成。
