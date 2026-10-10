# 全球热力图规范（World Heatmap）

> 设计源：AInvest Figma `Uv36h0PXzZG7ZhuHBHQ3qz`，节点 `177:3129`；地图几何节点 `177:3142`。

## 规则

- **WORLD-HEATMAP-01 · 输入**：组件接收 `regions:[{ id, name, value }]`；`id` 使用底图收录的 ISO 3166-1 alpha-2 国家 / 地区码，另兼容底图特殊 ID `XK`、`GO`、`JU`、`UM-DQ`、`UM-FQ`、`UM-HQ`、`UM-JQ`、`UM-MQ`、`UM-WQ`，同一地区不可重复。`value` 必须是有限的 JavaScript `number`，允许 `0` 与负数；不得以 `null`、`undefined`、空串、数字字符串、布尔或对象代替数值，`NaN` / `Infinity` 同样拒绝。数字字符串的解析由 L3 数据适配负责；缺数据地区应从 `regions` 中省略，空数组表示完整无数据地图。
- **WORLD-HEATMAP-02 · 底图**：世界地图使用设计源的 1000×600 矢量几何，完整等比缩放并居中，不因容器比例拉伸国家形状。
- **WORLD-HEATMAP-03 · 强度**：有数据国家按数值秩等距映射至五档透明度；并列值同档，最高值恒为最深档。档位数学复用 L1 `visual-color.intensityLevels`。
- **WORLD-HEATMAP-04 · 主题**：默认 `tone:'primary'`，THS / iFinD-PC / Ainvest 使用各自地图主题色；另支持 `up` / `down` 两种涨跌语义色。颜色与透明度只能来自 token。
- **WORLD-HEATMAP-05 · 无数据**：无数据国家保留中性浅底与国界，不触发 Tooltip，也不进入键盘 Tab 顺序。
- **WORLD-HEATMAP-06 · Tooltip**：Web hover 或键盘 focus 时，命中国家显示选中描边色，线宽仍复用普通国境线的 `size-world-heatmap-border`，不得另行加粗。只将该国家的完整描边副本放在其他国家之上，副本不参与命中或键盘 focus；原国家 DOM 与 Tab 顺序始终保持固定，所有共享国境线与离岛边界均连续可见，不被后绘制邻国的常态描边覆盖。

  Tooltip 跟随命中点，通常单行展示圆形国旗 SVG 缩略图、国家名与格式化数值；长名称允许换行，数值始终完整、单行且不参与压缩。继续遵守 TOOLTIP-01 的共享宽度封顶，不为地图扩大气泡。国旗图片加载失败时以国家名首字回退，不使用系统 emoji。离开或失焦立即清除描边副本并隐藏 Tooltip，此图族规则覆盖 TOOLTIP-10 的默认延迟隐藏；页面或任意祖先容器滚动时按 TOOLTIP-10 立即清除完整 hover / focus 展示状态。

  国旗默认使用仓库内 `assets/country-flags/` 的 Circle Flags 资源，随本站发布，不依赖第三方图片服务；地址按模块位置解析以兼容部署子路径。`flagUrl` 可显式覆盖默认图片。地图地区码 `GO` / `JU` 使用 `TF` 图标，`UM-*` 使用 `UM` 图标；资源来源、固定版本与许可证见 [资源说明](../assets/country-flags/README.md)。
- **WORLD-HEATMAP-07 · 可访问性**：有数据国家使用 `graphics-symbol`，读屏名称包含国家名与格式化数值；整图读屏名称来自配置 `name`。
- **WORLD-HEATMAP-08 · 端适配**：PC 与移动端共用地图和主题颜色；当前交互验收覆盖鼠标 hover 与键盘 focus，触摸端读取数据尚未完成跨设备验证，不能以浏览器默认 focus 行为视作触摸能力已完成。

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
