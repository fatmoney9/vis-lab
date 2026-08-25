# 图片内容块 · 规范（条目化索引）

> 图片内容块是 L1 共享能力，用于在图元内部按空间展示可选图片、标题和数值，也可把同一图片带入 Tooltip。它不定义任何业务字段和主题样式。

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| IMAGECONTENT-01 | 输入统一为 `{label,value,image?,imageFallback?,details?}`。`imageFallback` 是数据层提供的单字符实体缩写；业务字段映射在 L3 完成，L1 不识别品牌、证券、行业或图表类型。缺图片时仍可展示兜底标识与文字。 | `core/image-content.js` → `normalizeImageContent()` | ✅ |
| IMAGECONTENT-02 | 自适应布局只消费调用方从 token 解析出的图片、标题与数值尺寸上下限及字号差值，并根据图元扣除安全边距后的实际宽高连续缩小，最终尺寸取整数像素。实体图片或首字母兜底占用同一图片槽位；兜底字号与标题使用同一适配进度，不另造尺寸。图片与标题按同一适配进度求尺寸；数值优先字号为 `clamp(valueMin, 名称适配后的字号 - valueFontDeviation, valueMax)`，再结合实际宽高继续降级。`valueFontDeviation` 是减法中的差值，不是数值字号。文字宽度必须由调用方通过 `core/measure.js` 注入真实测量，缺失即报错，不提供字符数估算兜底。完整内容放不下时，若存在实体标识则依次尝试“标识 + 标题”和“仅标识”，再回落标题或数值，最终才隐藏整个内容块。实体标识不应在紧凑空间被优先丢弃。L1 不持有像素、字号、图表或主题分支。 | `core/image-content.js` → `fitImageContent()` | ✅ |
| IMAGECONTENT-03 | SVG 结构统一为可选图片或首字母兜底、标题、数值。首字母兜底为圆形，使用 `color-background-layer1` 页面一级背景、`color-text-primary` 文字、`font-family-cn` 默认字体与 `font-weight-bold` 字重，light / dark 由主题 token 自动切换。兜底只表达“无图片地址”或“图片加载失败”，不作为加载中占位；存在真实图片时从首帧直接显示图片，避免 resize 重绘时闪过兜底。L1 只装配结构与计算坐标，具体图表通过 class 和 CSS 自定义属性控制其余字体、颜色及字重。 | `core/image-content.js` → `renderImageContent()`；`charts/styles.css` | ✅ |
| IMAGECONTENT-04 | Tooltip 复用共享的 `titleIcon` / `titleIconFallback` 与无 marker 详情行合同；图片缺失或加载失败时同样展示主题自适应首字母兜底，有真实图片时不把兜底当作加载中占位；没有详情行时回落为单行标题和值。 | `core/image-content.js` → `imageContentTooltip()`；`core/tooltip.js` | ✅ |

## 边界

- 尺寸上下限、间距、字体和颜色来自调用图表的 token，不在本构件内新增样式参数默认值。
- 分组、面积、坐标、命中和主题选择属于调用图表或 behavior，不进入本构件。
- 图片资源地址与兜底字符由数据层提供；L1 不拼接品牌资产路径，也不从企业名称猜字符。
