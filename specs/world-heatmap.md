# 全球热力图规范（World Heatmap）

> 底图与国旗均为第三方数据，来源、固定版本与许可见[组件说明](../charts/charts/world-heatmap/README.md)。

## 规则

- **WORLD-HEATMAP-01 · 输入**：组件接收 `regions:[{ id, name, value }]`；`id` 使用底图收录的 ISO 3166-1 alpha-2 国家 / 地区码，同一地区不可重复。`value` 必须是有限的 JavaScript `number`，允许 `0` 与负数；不得以 `null`、`undefined`、空串、数字字符串、布尔或对象代替数值，`NaN` / `Infinity` 同样拒绝。数字字符串的解析由 L3 数据适配负责；缺数据地区应从 `regions` 中省略，空数组表示完整无数据地图。
- **WORLD-HEATMAP-02 · 底图**：底图运行时加载（WORLD-HEATMAP-09），以墨卡托投影铺入宽 1000 的视框，不绘制南极洲。完整等比缩放并居中，不因容器比例拉伸国家形状。容器未给高度时画布高取 `size-world-heatmap-height`（三主题 240px，紧凑档 140px），不随宽度变化；容器给了高度就随容器。地图比容器窄时左右留白。
- **WORLD-HEATMAP-03 · 强度**：有数据国家按数值秩等距映射至五档透明度；并列值同档，最高值恒为最深档。档位数学复用 L1 `visual-color.intensityLevels`。
- **WORLD-HEATMAP-04 · 主题**：默认 `tone:'primary'`，THS / iFinD-PC / Ainvest 使用各自地图主题色；另支持 `up` / `down` 两种涨跌语义色。颜色与透明度只能来自 token。
- **WORLD-HEATMAP-05 · 无数据**：无数据国家保留中性浅底与国界，不触发 Tooltip，也不进入键盘 Tab 顺序。
- **WORLD-HEATMAP-06 · Tooltip**：Web hover 或键盘 focus 时，命中国家显示选中描边色，线宽仍复用普通国境线的 `size-world-heatmap-border`，不得另行加粗。只将该国家的完整描边副本放在其他国家之上，副本不参与命中或键盘 focus；原国家 DOM 与 Tab 顺序始终保持固定，所有共享国境线与离岛边界均连续可见，不被后绘制邻国的常态描边覆盖。

  Tooltip 跟随命中点，通常单行展示圆形国旗 SVG 缩略图、国家名与格式化数值；长名称允许换行，数值始终完整、单行且不参与压缩。继续遵守 TOOLTIP-01 的共享宽度封顶，不为地图扩大气泡。国旗图片加载失败时以国家名首字回退，不使用系统 emoji。离开或失焦立即清除描边副本并隐藏 Tooltip，此图族规则覆盖 TOOLTIP-10 的默认延迟隐藏；页面或任意祖先容器滚动时按 TOOLTIP-10 立即清除 hover 展示状态。**持键盘焦点的国家例外**：Tab 到屏幕外时浏览器会自动滚动，此时清除等于让焦点指示消失，故焦点国家仍在可视范围内时保留描边、Tooltip 按新位置重放，滚出可视范围才清除，滚回时恢复。鼠标移开时若有国家持键盘焦点，同样回到该国家。

  键盘展示只认 `:focus-visible`：鼠标点击也会让国家获得焦点，但不得因此把 Tooltip 从指针处挪走。容器尺寸变化只更新画布尺寸与地图变换，不重建国家节点，以保持焦点与 Tab 位置。

  国旗默认经 jsDelivr 加载固定提交的 Circle Flags 资源，因此依赖外部网络；不可达时回退国家名首字，内网或离线部署应通过 `flagUrl` 提供自有地址。`flagUrl` 可显式覆盖默认图片。来源、固定版本与文件映射见[组件说明](../charts/charts/world-heatmap/README.md)。
- **WORLD-HEATMAP-07 · 可访问性**：有数据国家使用 `graphics-symbol`，读屏名称包含国家名与格式化数值；整图读屏名称来自配置 `name`。有数据时整图 `role="group"`（`img` 的后代会被辅助技术视为纯呈现，同 RADAR-18），无数据时没有可交互后代，保持 `img`。
- **WORLD-HEATMAP-08 · 端适配**：PC 与移动端共用地图和主题颜色；当前交互验收覆盖鼠标 hover 与键盘 focus，触摸端读取数据尚未完成跨设备验证，不能以浏览器默认 focus 行为视作触摸能力已完成。
- **WORLD-HEATMAP-09 · 底图与中国区域**：底图经 jsDelivr 加载固定提交的第三方全球数据，不进仓库、不在运行时改写几何。组件同步返回，国家在底图到达后绘制；`ready` 在绘制完成时兑现，加载失败或国家码不在底图内时拒绝，此时只留空画布。

  `CN` 统一承载中国大陆、台湾、香港、澳门：填充、五档透明度、国旗、读数、hover / focus 外边界与 Tab 入口均属于同一图元。`TW` / `HK` / `MO` 不是可单独传入的 ID，组件同步抛错，不静默改名或聚合业务数值，L3 应先准备统一的 `CN` 数据。地图表达不随品牌主题切换。

## API

```js
WorldHeatmapChart(host, {
  name: '全球市场热度',
  tone: 'primary', // primary | up | down
  platform: 'pc', // pc | mobile
  regions: [{ id: 'CN', name: '中国', value: 2.13 }], // flagUrl 可选，用于覆盖默认圆形国旗
});
```

## 不做

- 不接受经纬度、投影或任意 GeoJSON；当前组件是规范规定的完整世界视图。
- 不绘制常驻国家标签、色阶图例、缩放控件或点击钉住态；这些能力须有新增设计规则后再扩展。
