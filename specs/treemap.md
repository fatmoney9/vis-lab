# 矩形树图 · 规范（条目化索引）

> PRD 一级分类为入口类型、局部类型、整体类型；另含动态矩形树图。Vis Lab 将前三类作为
> 独立组件示例呈现，并沿用“入口型矩形树图 / 通用矩形树图 / 全局矩形树图”的产品名称。
> 校验基线为《矩形树图规范文档（持续更新）20230309》；多屏与动态形态暂未实现。
> AInvest 主题另以 Figma《AInvest矩形树图规范》节点 `0:232` 为准；主题只选择通用能力，行情字段映射留在 L3 示例数据层。

## 分层边界

- **L1 `charts/core/`**：画布与 resize、token / behavior 解析、格式化、真实文字测量、图片内容块、颜色策略、Tooltip、水印和动效。能力只接收通用参数，不认识矩形树图变体、主题名或业务字段。
- **L2 `charts/charts/treemap/`**：递归汇总与单画布面积切分、入口 / 通用 / 全局形态、标签降级顺序、层级下钻，以及把矩形节点语义装配给 L1。L2 不维护颜色、字体、文字宽度估算、图片渲染或 Tooltip 骨架的副本。
- **L3 `demos/` 与预览面**：示例数据、主题演示、股票 / 行业 / 行情等业务字段到通用 `presentation` 合同的映射，以及面板控件。公司图标文件统一放在图表无关的 `assets/company-icons/`，由 `demos/company-icons.js` 维护证券代码映射，供其他图表演示复用。

## 规则

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| TREEMAP-01 | 数据为递归 `{name,value?,children?}`。叶节点正值参与布局；`null`、非数、负值与 0 不生成面积。父节点由有效子节点递归汇总，声明序号保留用于固定色槽。 | `charts/charts/treemap/geometry.js` → `aggregateValue()` / `displayChildren()` | ✅ |
| TREEMAP-02 | 同一层只使用一种面积口径。`absolute` 保持真实比例；`approximate` 仅在跨度过大时统一做幂指数压缩，最大/最小面积比封顶于 `ratio-treemap-max-area-ratio`，默认把 `1,000,000:1` 压到 `100:1`。 | `geometry.js` → `ratioShares()`；`tokens/*.json §25` | ✅ |
| TREEMAP-03 | 默认使用 squarify，子节点按权重降序从左上沿短边填充。内部节点间距固定 2px；画板外角 4px，内部节点保持直角且不叠加描边。 | `index.js` → `tileFor()`；`size-treemap-gap` / `radius-treemap-canvas` | ✅ |
| TREEMAP-04 | 当前层每个节点占一个稳定系列色槽；具体使用调用方配置、系列、强度或有符号语义策略由 `behavior.json` 的 `treemap-profile.color-mode` 决定。无效项过滤、hover 与下钻均不重排同层声明色槽。 | `index.js`；`core/palette.js`；`core/visual-color.js`；`behavior.json` | ✅ |
| TREEMAP-05 | 通用树图名称默认 12px、最小 8px，系统字体；数值默认 12px、最小 6px，主题数字字体。四边安全距 4px，标题优先按“单行 → 两行 → 缩小单行 → 缩小两行 → 隐藏”降级；数值随后独立缩小，仍放不下则隐藏。默认整组居中，也支持左下对齐。L2 只决定降级顺序，实际宽度必须由 L1 `createTextMeasurer()` 按真实字体与字号测量。 | `geometry.js` → `fitTreemapLabel()`；`index.js`；`core/measure.js`；Treemap 字体 token | ✅ |
| TREEMAP-06 | 点击有子节点的矩形进入下一层；顶部路径显示完整层级并可返回任意祖先。下钻不改变原始数据，路径操作可逆。 | `index.js` → `currentPath` / breadcrumb | ✅ |
| TREEMAP-07 | hover 或点击叶节点时只在当前节点叠加共享的 `color-visualization-highlight-block` 遮罩并显示 Tooltip，不压暗其他节点。三主题直接复用 L1 `createTooltip()` 的主体看板骨架，并统一采用对侧固定式、保持在画板内；这是矩形树图共同的形态规则，不进入主题 behavior。节点可选图片与详情行通过 L1 图片内容合同进入，L2 不适配业务字段。所有节点支持 `Enter` / `Space`。 | `index.js`；`core/image-content.js`；`core/tooltip.js` | ✅ |
| TREEMAP-08 | 通用树图绘图区默认高度 160px，顶部路径复用全局 `line-height-extra-large`（24px）。移动端推荐画布为可用宽度（375px 屏幕下为 343px）× 160px；宽度变化只触发 squarify 重排，不按比例缩放文字或高度。调用方显式拖高后才使用容器剩余高度。 | `index.js` → `createFrame()` / `observeResize()`；`size-treemap-local-height` | ✅ |
| TREEMAP-09 | 当前入口型树图、通用树图与全局树图均为静态树图。首次入场与层级下钻沿用共享生长动效；PDF 中动态树图的 Resquarified 时序仍标注为待补充，不据此宣称时间序列动态树图已完成。 | `index.js`；`core/motion.js` → `runGrowth()` | ⏳ |
| TREEMAP-10 | 节点层之上依次为标签层与水印层；选中遮罩位于节点内部，标签与水印均不参与命中。 | `index.js`；`core/watermark.js` | ✅ |
| TREEMAP-11 | 入口型树图用于 3–8 项，当前示例取 6 项；两排固定等面积布局，不用业务值映射面积，名称与数值均固定 12px。 | `index.js` → `entryTile()`；entry 字体 token | ✅ |
| TREEMAP-12 | 全局矩形树图对应 PRD 整体类型，建议 30 项以上；当前覆盖 32 / 42 / 54 项，采用真实比例、16/14px 起始字号与 320px 验收高度。 | `demos/examples.js` → `treemap-overall`；`index.js` → `variant:overall`；overall token | ✅ |
| TREEMAP-13 | 入口、通用与全局树图作为三个独立示例注册，和堆叠图变体一样共享一个 L2 渲染内核、通过固定语义配置分形态；各自只保留本类型内部的项数档位。 | `demos/examples.js` → `treemap-entry` / `treemap-local` / `treemap-overall`；`registry.js` → `TreemapChart` | ✅ |
| TREEMAP-14 | PRD 的局部多屏为通用树图的横向滚动形态，默认内部画布 650×160px，可扩至 900px；整体多屏为全局树图的纵向滚动形态。两者均不作为新的一级类型。 | 待实现滚动视口与指示条 | ⏳ |
| TREEMAP-15 | 动态矩形树图属于时间变化形态，应使用稳定的 Resquarified 布局减少节点跳动，并配合时间控制。当前只沿用静态树图的入场与下钻动效。 | 待实现时间数据与稳定布局 | ⏳ |
| TREEMAP-16 | 单元格内名称与数值统一复用 `color-text-inverse-primary`（84% 白色）；名称使用全局中文字体，数值使用全局数字字体，THS 下解析为 `THSJinRongTi`。 | `charts/styles.css`；`color-text-inverse-primary` / `font-family-cn` / `font-family-number` | ✅ |
| TREEMAP-17 | 矩形树图不维护私有颜色值或私有颜色算法。`intensity` 将当前层面积值按秩映射全局五档透明度，并列值同档，最大值最深且随降序布局位于左上；`semantic-binned` 复用全局涨跌色与三档透明度；`semantic-flat` 同方向使用同一涨跌色和 100% 透明度；0 均复用中性灰。面积只由 `value` 决定，有符号颜色消费 `presentation.colorValue`。全部策略由 L1 COLOR-09 实现，L2 只完成参数装配。 | `core/visual-color.js`；`index.js`；全局涨跌色、透明度与阈值 token | ✅ |
| TREEMAP-18 | 三主题共用同一份单画布面积布局。AInvest 只通过 `content=image` 与 `semantic-binned` 选择通用图片内容和涨跌色能力；图片尺寸为 64/32/16/12px、名称 28→11px、数值 20→11px，空间不足时由 IMAGECONTENT-02 依次降级，紧凑节点优先保留 12px 公司图标。业务数据由 L3 映射为 `{label,value,image,colorValue,details}`，公司图标由 L3 资源映射提供，组件不识别主题、品牌、股票、行业分组或行情字段。 | `core/image-content.js`；`content.js`；`index.js`；`behavior.json`；`demos/examples.js`；`demos/company-icons.js` | ✅ |

## 活 demo

`index.html` 与 `playground/preview.html` 的矩形树图分组：

- `#treemap-entry`：默认 6 个等面积入口节点；点击一级行业进入子行业，顶部路径可返回“全部行业”。
- `#treemap-local`：默认 18 个节点，覆盖近似真实比例、两行标题和极小值文字隐藏。
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
  ratioMode = 'approximate',      // 'approximate' | 'absolute'
  labelType = 'twoLineCenter',    // 'twoLineCenter' | 'twoLineLeftBottom' | 'staticCenter'
  colorMode = 'intensity',        // 'series' | 'intensity' | 'semantic-binned' | 'semantic-flat'
  platform = 'pc',
  animation = true,
})
```

节点可选声明 `presentation: { label, value, image, colorValue, details }`。这是通用显示合同；股票代码、行业、价格等业务字段应在数据层转换后再传入。

颜色、间距、圆角、文字尺寸与面积跨度均走 token，API 不接收像素样式参数。

## Do / Don't

- ✅ 用矩形树图表达“整体 → 分组 → 子项”的层级占比，并提供可逆下钻。
- ✅ 同层统一选择真实比例或近似比例；Tooltip 始终展示原值。
- ✅ 静态局部树图优先保留标题，空间不足时隐藏尾部文字或单元。
- ❌ 不给 0 值或不可读极小项伪造与业务数值无关的固定面积。
- ❌ 不混用两种面积口径、不截断数值、不按当前数值重排颜色。

## 待办

- [ ] 通用矩形树图：局部多屏横向滚动、固定内部画布和滚动指示条（TREEMAP-14）。
- [ ] 全局矩形树图：整体多屏纵向滚动与闲置时滚动条淡出（TREEMAP-14）。
- [ ] 动态矩形树图：时间控制与 Resquarified 稳定过渡（TREEMAP-15）。
