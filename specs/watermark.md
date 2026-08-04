# 水印 watermark · 规范（条目化索引）

> 权威源：原体系 `watermark.md`（水印通用机制唯一权威：适用范围 / 锚定 / 层级 / 资源协议 / 反例以原文为准）+ 各主题 §水印（尺寸 / 锚角 / 偏移）。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：所有图表主图各一枚（柱 / 折线及延伸）；主副图仅主图贴水印，副图不贴（本仓库当前仅 cartesian 主图）。
> 分层：水印是 **L1 构件**（`core/watermark.js`，按锚角算像素 + append `<image>`），
> **恒开、由 L2 在 `build()` 末尾追加**（`charts/cartesian/index.js`）；资源为**生成物**（`core/watermark-assets.js`，源 `assets/watermarks/*.svg`）。
>
> ⚠️ **水印必须直接加载真实 SVG，不得代码还原**：水印是含多条 `<path>` 字形的品牌 logo，任何 `<rect>+<text>` 手绘都不对（与 datazoom 手柄相反——手柄是可 token 化简单形状故现画，见 [datazoom.md](datazoom.md)；水印是那条规则的显式例外）。颜色 / 透明度**烘焙在 SVG 内、明暗各一份**，故**不走 token 链路**（铁律1 只约束"代码里写色值"，此处无代码色值）。

## 资源与加载

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| WATERMARK-01 | **真实 SVG 直载（不代码还原）**：4 个源 `assets/watermarks/{ths,ainvest}-watermark-{light,dark}.svg` 为唯一可编辑源；因本仓库无打包器、原生 ESM 无法 import `.svg` 文本、且 `build()` 同步、引擎需可嵌入不耦合相对路径——由 `assets/build-watermark-assets.mjs` 内联为 `data:image/svg+xml,<encodeURIComponent>`（原体系推荐兜底写法，file:// / 跨域 / CSP 均安全）产出 `core/watermark-assets.js`（`{id:{w,h,light,dark}}`，尺寸从根 `<svg>` 解析、不写死）。组件只 import 该生成物。缺资源 / 缺尺寸 → 生成退出码 1 拦截 | `assets/watermarks/*.svg`；`assets/build-watermark-assets.mjs`；`core/watermark-assets.js`；`core/watermark.js` → `renderWatermark` | ✅ |
| WATERMARK-04 | **明暗资源按 `data-mode` 选**：`modeOf(host)` 取最近 `[data-mode]`（缺省 light），选 `asset.light` / `asset.dark`。THS light=black 6% / dark=white 6%；Ainvest light=black 5% / dark=white 20%（透明度烘焙在各 SVG，本仓库不再设色） | `core/theme.js` → `modeOf`；L2 传 `mode`；`core/watermark.js` | ✅ |

## 锚定与主题身份

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| WATERMARK-02 | **锚定 `frame.grid` 绘图区角、偏移相对 grid 物理边**（≠ 容器边、≠ 10% 数据框边——窗口 / resize 时不与 X 标签 / 数据图形位置绑死）。纯几何 `watermarkAnchor(anchor, grid, size, offset)`：`anchor = {top\|bottom}-{left\|right}`；left/top 锚 = 从 grid 边内推 offset；right/bottom 锚 = 内退 offset + 尺寸使该边贴齐。锚 `frame.grid` = 绘图区（在 datazoom nav 带之上），与缩放带无关 | `core/watermark.js` → `watermarkAnchor`；`core/frame.js` → `grid` | ✅ |
| WATERMARK-03 | **主题身份（平台通用，无 mobile/pc 分叉）**：THS **右下角、距 grid 右侧 36px、距底部网格线 24px**、36×10；**iFinD-PC 复用 THS 资源**（`asset:"ths"`）同锚同偏移；**Ainvest 左下角、距 grid 左侧 4px、距底部网格线 2px**、96×20。形态在 `behavior.json → watermark`（`{asset, anchor, offset}`），键位对齐契约强制三主题俱全 | `tokens/behavior.json` → `watermark`；`core/theme.js` → `resolveBehavior`（unfold 原样透传）；L2 `wm = b['watermark']` | ✅ |

## 层级与命中

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| WATERMARK-05 | **置顶不被裁剪、不抢命中**：本仓库层级 = DOM 追加顺序，L2 在 `build()` **末尾**追加水印 `<g>` → 贴所有数据图形之上、不被裁剪 / 遮罩 / 移除（对应原体系"水印置顶"意图）。水印低透明（5–6%）不遮挡数据；`.dv-watermark { pointer-events:none }` 永不抢鼠标，hover / tooltip 命中数据不受影响。resize / 窗口变经既有 `observeResize → build()` 自动随 grid 角重排，组件不自加监听 | `charts/cartesian/index.js` → `build()` 末尾 `renderWatermark(...)`；`charts/styles.css` → `.dv-watermark` | ✅ |

## 活 demo

`playground/preview.html` 三主题横向卡片天然各显其水印：THS / iFinD-PC 右下角淡 logo（右缘距 grid 右沿约 36px）、Ainvest 左上角 logo；右栏切 dark 三主题转白色变体。水印恒开、无开关（见 API）。

## Do / Don't

- ✅ **Do**：换 logo / 明暗 = 改 `assets/watermarks/*.svg` 后 `node assets/build-watermark-assets.mjs` 重生成；改锚角 / 偏移 / 资源指向 = 改 `behavior.json → watermark`（三主题）。
- ❌ **Don't**：用 `<rect>+<text>` 手绘水印（WATERMARK-01）；在组件源码 / CSS 写水印色值（色在 SVG 内）；给 `CartesianChart` API 加水印开关（水印恒开，避免铁律4 样式参数）；把水印锚到容器边 / 数据框边（WATERMARK-02）；手改 `core/watermark-assets.js`（生成物）。

## API

无。水印按原体系"所有主图各一枚"**恒开**，不暴露任何配置——形态一律来自主题（`behavior.json → watermark`）+ 资源（`assets/watermarks/*.svg` → 生成物）。

## 待办

- [x] **饼环骨架接入**：`PieChart` 在 `build()` 末尾追加同一 `renderWatermark`，锚 `frame.grid`
      （无轴带占位时 grid 即整块画布），三主题锚角与偏移仍只由 `behavior.json` 一处决定（[pie.md](pie.md) PIE-07）。
- [ ] 副图（多图联动）接入时同样在末尾追加 `renderWatermark`——**主图贴、副图不贴**。
- [ ] `offset.right = 36` 等偏移为原体系定值常量，暂随 `behavior.json` 携带（datazoom nav 留白同属"待 token 化"一类）。
- [ ] 极小容器下 Ainvest 96×20 于左上角可能压近数据——如需按 grid 宽比例缩放 / 隐藏，待原体系明确后补 ID。
