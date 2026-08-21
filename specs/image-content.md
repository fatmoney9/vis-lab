# 图片内容块 · 规范（条目化索引）

> 图片内容块是 L1 共享能力，用于在图元内部按空间展示可选图片、标题和数值，也可把同一图片带入 Tooltip。它不定义任何业务字段和主题样式。

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| IMAGECONTENT-01 | 输入统一为 `{label,value,image?,details?}`。业务字段映射在 L3 完成；L1 不识别品牌、证券、行业或图表类型。缺图片时仍可展示文字。 | `core/image-content.js` → `normalizeImageContent()` | ✅ |
| IMAGECONTENT-02 | 自适应布局只消费调用方从 token 解析出的尺寸档，并按声明顺序从大到小尝试。完整内容放不下时，若存在实体图片则依次尝试“图片 + 标题”和“仅图片”，再回落标题或数值，最终才隐藏整个内容块；纯图片档按图片实际占用空间判断，不受文字档最小单元格尺寸限制。图片作为实体识别信息不应在紧凑档被优先丢弃。L1 不持有像素、字号或主题分支。 | `core/image-content.js` → `fitImageContent()` | ✅ |
| IMAGECONTENT-03 | SVG 结构统一为可选图片、标题、数值；L1 只装配结构与计算坐标，具体图表通过 class 和 CSS 自定义属性控制字体、颜色及字重。 | `core/image-content.js` → `renderImageContent()` | ✅ |
| IMAGECONTENT-04 | Tooltip 复用共享的 `titleIcon` 与无 marker 详情行合同；没有详情行时回落为单行标题和值。 | `core/image-content.js` → `imageContentTooltip()`；`core/tooltip.js` | ✅ |

## 边界

- 尺寸档、间距、字体和颜色来自调用图表的 token，不在本构件内新增样式参数默认值。
- 分组、面积、坐标、命中和主题选择属于调用图表或 behavior，不进入本构件。
- 图片资源地址由数据层提供；L1 不拼接品牌资产路径。
