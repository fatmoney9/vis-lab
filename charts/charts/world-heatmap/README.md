# WorldHeatmapChart · L1 复用声明

> 本页由 `hooks/lint-l1-declaration.mjs` 校验。全球热力图的产品规则与 API 见 `specs/world-heatmap.md`。

| L1 模块 | 状态 |
|---|---|
| `axis` | 不用：地图无直角坐标轴 |
| `axis-title` | 不用：地图没有轴标题带 |
| `bar-geometry` | 不用：国家区域由既定地图矢量决定，不存在柱的 band 排布 |
| `callout` | 不用：当前规范只定义国家 hover Tooltip，没有图内批注 |
| `chart-text` | 不用：可见名称与读屏文案全部来自配置数据，没有组件固定文案 |
| `crosshair` | 不用：交互直接命中国家区域，不需要坐标指示线 |
| `datazoom` | 不用：当前规范是完整世界视图，不提供轴缩放窗口 |
| `format` | 用 |
| `frame` | 用 |
| `grid` | 不用：国界就是地图结构，不绘制直角网格 |
| `highlight-state` | 不用：规范只有瞬时 hover / focus，没有点击钉住状态 |
| `image-content` | 不用：圆形国旗只使用共享 Tooltip 已有的标题图片槽，不承载自适应图片内容块 |
| `label` | 不用：地图内不渲染常驻数据标签 |
| `legend` | 不用：当前规范以国家明暗表达强度，不单列色阶图例 |
| `legend-state` | 不用：没有可交互图例 |
| `mark` | 不用：该模块只绘制柱与折线，国家矢量由本族地图数据装配 |
| `measure` | 不用：图内没有需要测量或截断的文字 |
| `motion` | 不用：规范未定义地图入场或切换动效 |
| `palette` | 不用：地图主题色由专用值 token 提供，不占用系列色槽位 |
| `polar-label` | 不用：地图不是极坐标图，也没有圆周标签 |
| `scale` | 不用：国家位置由固定矢量坐标决定，数据只映射五档强度 |
| `split` | 不用：无数值轴刻度，不需要 nice split |
| `theme` | 用 |
| `tokens` | 不用：本族只通过 CSS 变量消费值 token，不在 JS 中读取数值 token |
| `tooltip` | 用 |
| `visual-color` | 用 |
| `watermark` | 不用：Figma 地图规范未展示品牌水印 |

## 分层说明

- 国家路径只表达稳定的地理底图，不包含颜色、业务名称或数值。
- 原始 Figma 底图与离线地区校准分开保存；[来源、许可及重建过程](../../../assets/world-map/README.md)可追溯。`CN` 包含台湾、港澳及本次校准的藏南区域，共用一份语义数据和外边界；不保留独立 `TW` / `HK` / `MO` 图元或内部行政描边，传入这些旧 ID 会明确拒绝，不自动聚合读数。地图归属不随主题切换。
- `model.js` 校验底图国家 / 地区码（包含规范列明的特殊 ID）与有限 `number`，复用 L1 五档强度算法；数字字符串解析和缺数据筛选由 L3 数据适配完成，不将空值隐式转为零。主题身份通过 CSS token 注入。
- 无数据国家仍绘制为中性底色，但不进入 Tab 顺序、不触发 Tooltip。
- 国旗缩略图默认按底图国家 / 地区码读取仓库内的 `assets/country-flags/`（[资源来源与更新说明](../../../assets/country-flags/README.md)）；URL 相对模块解析，兼容部署子路径，不请求外部国旗站点。实例可用 `flagUrl` 覆盖，加载失败时只回退国家名首字，不使用 emoji。
- hover / focus 的置顶层只包含不参与交互的国家描边副本，原国家 DOM 和 Tab 顺序不变；离开、失焦或滚动时立即清除副本并隐藏共享 Tooltip。
- Tooltip 名称可换行、数值保持完整，宽度继续遵守 L1 共享封顶；触摸端交互尚未完成跨设备验收。
