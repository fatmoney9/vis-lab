# 矩形树图 · 规范（条目化索引）

> PRD 一级分类为入口类型、局部类型、整体类型；另含动态矩形树图。Vis Lab 将前三类作为
> 独立组件示例呈现，并沿用“入口型矩形树图 / 通用矩形树图 / 全局矩形树图”的产品名称。
> 校验基线为《矩形树图规范文档（持续更新）20230309》；多屏与动态形态暂未实现。
> AInvest 主题另以 [Figma《AInvest矩形树图规范》节点 0:232](https://www.figma.com/design/Uv36h0PXzZG7ZhuHBHQ3qz/AInvest%E7%9F%A9%E5%BD%A2%E6%A0%91%E5%9B%BE%E8%A7%84%E8%8C%83?node-id=0-232&t=yGNxXzGoUFEajZTV-4) 为准；主题只选择通用能力，行情字段映射留在 L3 示例数据层。

## 分层边界

- **L1 `charts/core/`**：画布与 resize、token / behavior 解析、格式化、真实文字测量、图片内容块、颜色策略、Tooltip、水印和动效。能力只接收通用参数，不认识矩形树图变体、主题名或业务字段。
- **L2 `charts/charts/treemap/`**：递归汇总与单画布面积切分、入口 / 通用 / 全局形态、标签降级顺序，以及把矩形节点语义装配给 L1。L2 不维护颜色、字体、文字宽度估算、图片渲染或 Tooltip 骨架的副本。
- **L3 `demos/` 与预览面**：示例数据、主题演示、股票 / 行业 / 行情等业务字段到通用 `presentation` 合同的映射，以及面板控件。公司图标文件统一放在图表无关的 `assets/company-icons/`，由 `demos/company-icons.js` 维护证券代码映射，供其他图表演示复用。

## 规则

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| TREEMAP-01 | 数据为递归 `{name,value?,children?}`。叶节点正值参与布局；`null`、非数、负值与 0 不生成面积。父节点由有效子节点递归汇总，声明序号保留用于固定色槽。 | `charts/charts/treemap/geometry.js` → `aggregateValue()` / `displayChildren()` | ✅ |
| TREEMAP-02 | 当前面积严格按原始正值占比计算，不为长尾节点伪造面积。基线 PDF 另提出“尽量真实”概念，但未给出压缩算法或定量阈值；在设计源补充前不实现、不暴露配置，也不以工程常量代替规范。 | `geometry.js` → `ratioShares()` | ⏳ |
| TREEMAP-03 | 默认使用 squarify，子节点按权重降序从左上沿短边填充。THS / iFinD 基线 PDF 的内部节点间距为 2px、画板外角为 4px；AInvest Figma 实例的间距为 1px、外角为 6px。内部节点均保持直角且不叠加描边。差异由主题 token 表达，布局器不得硬编码统一值。 | `index.js` → `tileFor()`；`size-treemap-gap` / `radius-treemap-canvas` | ✅ |
| TREEMAP-04 | 当前层每个节点占一个稳定系列色槽；具体使用调用方配置、系列、强度或有符号语义策略由 `behavior.json` 的 `treemap-profile.color-mode` 决定。无效项过滤、hover 与下钻均不重排同层声明色槽。 | `index.js`；`core/palette.js`；`core/visual-color.js`；`behavior.json` | ✅ |
| TREEMAP-05 | 通用文本树图名称默认 12px、最小 8px，系统字体；数值默认 12px、最小 6px，主题数字字体。四边安全距 4px，标题优先按“单行 → 两行 → 缩小单行 → 缩小两行 → 隐藏”降级；数值从 `clamp(valueMin, 名称字号 - size-treemap-value-font-deviation, valueMax)` 起继续缩小，仍放不下则隐藏。THS / iFinD 依据基线文档取 2px；入口型名称与数值均固定 12px，故钳制后仍同号。AInvest 图片内容按 TREEMAP-18 使用独立范围，该主题 token 为 0。默认整组居中，也支持左下对齐。L2 只决定降级顺序，实际宽度必须由 L1 `createTextMeasurer()` 按真实字体与字号测量。 | `geometry.js` → `fitTreemapLabel()`；`index.js`；`core/measure.js`；`size-treemap-value-font-deviation` | ✅ |
| TREEMAP-06 | **单层展示，无层级下钻，也没有顶部路径条**。数据仍可以是递归结构，但深层只用于**汇总父节点的值**，不作为可进入的层级；点击矩形只钉住 / 取消钉住 Tooltip（TREEMAP-07）。<br>本条 2026-08-26 由「点击进入下一层 + 顶部路径返回」整体改为无下钻——产品层面不设面包屑，而面包屑是下钻后唯一的返回通道，两者只能同去同留；留下单向下钻会让人进得去出不来。随之退场的还有 `behavior.json` 的 `root-breadcrumb` 键与 `.dv-treemap-breadcrumb*` 样式，**不留残键**。 | `index.js`（点击仅走 `activate` 钉住 Tooltip）；`core/highlight-state.js` → `applyHover` / `applyLeave` / `applyPick` / `activeTarget`（hover 与钉住的状态迁移，与桑基共用一份） | ✅ |
| TREEMAP-07 | hover 或点击叶节点时只在当前节点叠加共享的 `color-visualization-highlight-block` 遮罩并显示 Tooltip，不压暗其他节点。三主题直接复用 L1 `createTooltip()` 的主体看板骨架，**位置档统一 `follow`**（跟随指针）；这是矩形树图共同的形态规则，不进入主题 behavior，与饼环同属 [tooltip.md](tooltip.md) TOOLTIP-07 的「无坐标系图恒 follow」通则。<br>⚠️ 2026-08-26 前本条写的是「对侧固定式」（`side-fixed`），已按产品决定改为 `follow`。节点可选图片与详情行通过 L1 图片内容合同进入，L2 不适配业务字段。所有节点支持 `Enter` / `Space`。 | `index.js`；`core/image-content.js`；`core/tooltip.js` | ✅ |
| TREEMAP-08 | **高度恒由容器决定、图面填满整个容器**——与 cartesian / pie 同一模型。本族是单层展示（TREEMAP-06 已移除顶部路径），容器内没有别的带要让位，故**图面高 = 容器高**。<br>容器没给高时**退到主题 token `--size-chart-region-height`**（THS 160 / iFinD·Ainvest 200，与另两族共用同一个默认高度）；它表达的同样是容器高度。两者都取不到才抛错——那是真正的配置缺失，要当场看见。<br>**容器塌到不可用高度时推迟到下一帧重画、不抛错**（与 cartesian / pie 的 `clientHeight < 40 → requestAnimationFrame(build)` 同一处置）：容器高在真实页面里会短暂为 0（标签页切换、折叠面板展开、懒布局首帧），那不是配置错误，抛异常会把整张图打没且不会自己回来。<br>Vis Lab 通用树图验收实例采用基线 160px；移动端推荐图面为可用宽度（375px 屏幕下为 343px）× 160px。宽度或高度变化均触发 squarify 重排，文字继续按节点实际空间适配。<br>⚠️ 2026-08-26 前的做法是 L3 用 `host.style.setProperty('--dv-chart-region-height')` 把图面高注入组件——那是一条既非组件 API、也非设计 token 的 L3→L2 私有通道，且没写进任何文档。已整体移除。根因是 `.dv-chart--treemap > .dv-chart__plot` 当时带 `flex: none`，绘图区不吸满容器高，才被迫另开通道。 | `index.js` → `createFrame()` / `observeResize()`；`geometry.js` → `treemapPlotHeight()`；`tokens/*.json` → `size-chart-region-height`（兜底）；`demos/examples.js` → `regionHeight`（容器高） | ✅ |
| TREEMAP-09 | 当前入口型树图、通用树图与全局树图均为静态树图。首次入场沿用共享生长动效（自画布中心展开；无下钻，故没有「从被点方块放大」的起点）；PDF 中动态树图的 Resquarified 时序仍标注为待补充，不据此宣称时间序列动态树图已完成。 | `index.js`；`core/motion.js` → `runGrowth()` | ⏳ |
| TREEMAP-10 | 节点层之上依次为标签层与水印层；选中遮罩位于节点内部，标签与水印均不参与命中。 | `index.js`；`core/watermark.js` | ✅ |
| TREEMAP-11 | 入口型树图用于 3–8 项，当前示例取 6 项；两排固定等面积布局，不用业务值映射面积。THS / iFinD 文本入口名称与数值均固定 12px；AInvest 图片入口按 TREEMAP-18 连续适配。AInvest Figma 的入口组件总高 161px 由外部标题 18px、间距 4px、热力图图面 139px 组成；Vis Lab L3 验收实例只把 139px 交给图面，不把标题算进去。 | `index.js` → `entryTile()`；entry 字体 token | ✅ |
| TREEMAP-12 | 全局矩形树图对应 PRD 整体类型，建议 30 项以上；当前覆盖 32 / 42 / 54 项，采用真实比例、16/14px 起始字号。基线说明整体类型高度自适应，三个形态**都不设本族专属的高度 token**，实际业务以外层容器高度为准（容器缺高时退到三族共用的 `--size-chart-region-height`，见 TREEMAP-08）。<br>⚠️ 曾在 L3 示例上保留过初始验收高（THS / iFinD 320px 实验室值、AInvest 383px 来自 Figma 实例）；高度模型改为「容器决定」后该字段再无消费方，已于 2026-08-26 清除。**演示面因此三个形态同高**——要重新拉开尺寸差异，应当由演示面给容器定高，而不是把这几个数变回 token。 | `index.js` → `variant:overall` | ✅ |
| TREEMAP-13 | 入口、通用与全局树图作为三个独立示例注册，和堆叠图变体一样共享一个 L2 渲染内核、通过固定语义配置分形态；各自只保留本类型内部的项数档位。 | `demos/examples.js` → `treemap-entry` / `treemap-local` / `treemap-overall`；`registry.js` → `TreemapChart` | ✅ |
| TREEMAP-14 | PRD 的局部多屏为通用树图的横向滚动形态，默认内部画布 650×160px，可扩至 900px；整体多屏为全局树图的纵向滚动形态。两者均不作为新的一级类型。 | 待实现滚动视口与指示条 | ⏳ |
| TREEMAP-15 | 动态矩形树图属于时间变化形态，应使用稳定的 Resquarified 布局减少节点跳动，并配合时间控制。当前只沿用静态树图的入场动效。 | 待实现时间数据与稳定布局 | ⏳ |
| TREEMAP-16 | 单元格内名称与数值统一复用 `color-text-inverse-primary`（84% 白色）；名称使用全局中文字体，数值使用全局数字字体，THS 下解析为 `THSJinRongTi`。 | `charts/styles.css`；`color-text-inverse-primary` / `font-family-cn` / `font-family-number` | ✅ |
| TREEMAP-17 | 矩形树图不维护私有颜色值或私有颜色算法。`intensity` 将当前层面积值按秩映射全局五档透明度，并列值同档，最大值最深且随降序布局位于左上；`semantic-binned` 使用主题最终的三档涨跌色，透明度若存在已包含在颜色 token 内，L1 / L2 均不再叠加；`semantic-flat` 固定使用同方向 `gradient-1`，0 使用 `color-price-even-gradient`。THS 三档是 COLOR-ADR-01 记录的 100% / 75% / 55%；AInvest 使用 Figma 的完整 light / dark 色值。面积只由 `value` 决定，有符号颜色必须消费有限的 `presentation.colorValue`，缺失或非法时不得伪装成平盘。两处分档阈值由调用方按业务口径传入 `colorThresholds`，且必须严格递增；当前 AInvest 演示的 `[1, 2]` 对应 Figma 范围条示例。全部策略由 L1 COLOR-09 实现，L2 只完成参数装配。 | `core/visual-color.js`；`index.js`；`color-price-{up\|down}-gradient-1..3` / `color-price-even-gradient`；`demos/examples.js` | ✅ |
| TREEMAP-18 | 三主题共用同一份单画布面积布局。AInvest 只通过 `content=image` 与 `semantic-binned` 选择通用图片内容和涨跌色能力；内容根据面积布局产出的实际矩形宽高连续适配，而不直接消费业务数值：四边安全距 4px，图片 64→12px，股票代码 28→11px / semibold，涨跌幅、现价或市值 20→11px / medium（设备无该字重时禁用伪造字重并回落最近的实际字重）。数值优先字号统一按“名称适配后的字号 − `size-treemap-value-font-deviation`”计算，再钳制于数值字号上下限；THS / iFinD 的差值为 2px，AInvest 的差值为 0px。这里的 2px / 0px 是计算差值，不是数值字号。空间不足时由 IMAGECONTENT-02 依次降级，紧凑节点优先保留 12px 企业标识。真实公司图标缺失或加载失败时，不得借用 Apple 等其他企业图标；改用圆形 `color-background-layer1` 页面一级背景 + 企业名称首字母，文字使用主题默认字体、`font-weight-bold` 字重与 `color-text-primary`，明暗模式由 token 自动适配。业务数据由 L3 映射为 `{label,value,image,imageFallback,colorValue,details}`，公司图标及名称首字母由 L3 资源映射提供，组件不识别主题、品牌、股票、行业分组或行情字段。 | [Figma 节点 `0:232`](https://www.figma.com/design/Uv36h0PXzZG7ZhuHBHQ3qz/AInvest%E7%9F%A9%E5%BD%A2%E6%A0%91%E5%9B%BE%E8%A7%84%E8%8C%83?node-id=0-232&t=yGNxXzGoUFEajZTV-4)；`core/image-content.js`；`content.js`；`index.js`；`behavior.json`；`demos/examples.js`；`demos/company-icons.js` | ✅ |

## 活 demo

`index.html` 与 `playground/preview.html` 的矩形树图分组：

- `#treemap-entry`：默认 6 个等面积入口节点；点击一级行业进入子行业，顶部路径可返回“全部行业”。
- `#treemap-local`：默认 18 个节点，覆盖真实比例、两行标题和极小值文字隐藏。
- `#treemap-overall`：默认 42 个节点，覆盖真实比例、左下标签、16/14px 起始字号与长尾隐藏。
- 标题最多两行并从 12px 缩至 8px；数值从 12px 缩至 6px，空间不足时依次隐藏。
- hover 或点击节点显示当前节点遮罩与 Tooltip；拖动容器宽高时矩形、标签与水印重排。
- THS 主题右侧可切换“程度 / 涨跌（分档） / 涨跌（不分档）”；iFinD 保留系列色。
- AInvest 主题固定为行情涨跌三档：入口型为等分股票块，通用型与全局型均和 THS、iFinD 共用单画布面积布局。

## API

```js
TreemapChart(host, {
  name,                           // 可选：图表语义名称
  root: { name, value, children },
  variant = 'local',              // 'entry' | 'local' | 'overall'
  direction = 'squarify',         // 'squarify' | 'horizontal' | 'vertical'
  labelType = 'twoLineCenter',    // 'twoLineCenter' | 'twoLineLeftBottom' | 'staticCenter'
  colorMode = 'intensity',        // 'series' | 'intensity' | 'semantic-binned' | 'semantic-flat'
  colorThresholds,                // semantic-binned 的两个正数业务阈值，如 [1, 2]
  platform = 'pc',
  animation = true,
})
```

节点可选声明 `presentation: { label, value, image, imageFallback, colorValue, details }`。这是通用显示合同；`imageFallback` 由数据层从企业名称提取单个首字母，股票代码、行业、价格等业务字段也应在数据层转换后再传入。

颜色、间距、圆角与文字尺寸均走 token，API 不接收像素样式参数。图面高度由宿主容器 CSS 决定，容器没给高时退到主题 token `--size-chart-region-height`（见 TREEMAP-08）。

## Do / Don't

- ✅ 用矩形树图表达“整体 → 分组”一层的占比构成；更深的层级只参与父节点求和，不可进入。
- ✅ 同层按真实比例计算面积；Tooltip 始终展示原值。
- ✅ 静态局部树图优先保留标题，空间不足时隐藏尾部文字或单元。
- ❌ 不给 0 值或不可读极小项伪造与业务数值无关的固定面积。
- ❌ 不混用两种面积口径、不截断数值、不按当前数值重排颜色。

## 待办

- [ ] 通用矩形树图：局部多屏横向滚动、固定内部画布和滚动指示条（TREEMAP-14）。
- [ ] 全局矩形树图：整体多屏纵向滚动与闲置时滚动条淡出（TREEMAP-14）。
- [ ] 动态矩形树图：时间控制与 Resquarified 稳定过渡（TREEMAP-15）。
