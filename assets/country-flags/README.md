# 圆形国旗缩略图

本目录是全球热力图 Tooltip 使用的本地 SVG 资源。文件名使用小写国家 / 地区码，随本站发布；运行时不向 HatScripts 请求图片，也无需安装 npm 包。

## 来源与版本

- 上游：[HatScripts / circle-flags](https://github.com/HatScripts/circle-flags)
- 来源目录：`flags/`
- 固定提交：[`379588b5da95482d6bbf10bd45644a35b0609ea6`](https://github.com/HatScripts/circle-flags/tree/379588b5da95482d6bbf10bd45644a35b0609ea6/flags)
- 导入日期：2026-10-09
- 许可：MIT，原始版权与许可全文保存在 [LICENSE.md](LICENSE.md)

只收录 `WORLD_MAP_FEATURES` 覆盖的国家 / 地区所需资源。SVG 保留上游图案与配色，不套用图表主题色。

## 地区映射

`charts/charts/world-heatmap/model.js` 的 `countryFlagThumbnail()` 根据国家码返回本地资源 URL；通过 `import.meta.url` 保留 localhost 与 GitHub Pages 的部署路径前缀。

| 地图 ID | 使用的资源 | 说明 |
|---|---|---|
| 普通 alpha-2 / `XK` | 对应的小写码 `.svg` | 使用上游国家 / 地区图标 |
| `GO` / `JU` | `tf.svg` | Glorioso / Juan de Nova 属于 French Southern and Antarctic Lands；[地理归属来源](https://www.cia.gov/the-world-factbook/static/7eba4dcc5104474d583fd3ee253d08e7/world_pol_03102025.pdf) |
| `UM-*` | `um.svg` | 美国本土外小岛屿共用所属地区图标 |

上游有部分资源使用 Git 符号链接。本目录将它们保存为目标 SVG 的完整内容，以便静态 HTTP 服务直接读取：

| 本地文件 | 上游实际图案文件 |
|---|---|
| `bq.svg` | `flags/bq-bo.svg` |
| `bv.svg` / `sj.svg` | `flags/no.svg` |
| `hm.svg` | `flags/au.svg` |
| `sh.svg` | `flags/sh-hl.svg` |
| `um.svg` | `flags/us.svg` |

实例可用 `regions[].flagUrl` 指定自己的图片地址。图片加载失败时，共享 Tooltip 显示国家名首字。

## 更新方式

1. 选择明确的上游提交，按地图国家码读取该提交下的 `flags/` 资源。
2. 将符号链接解析为同一提交下的目标 SVG 内容，保留本目录的小写码文件名。
3. 同步该提交的 `LICENSE.md`，更新本页的固定提交、导入日期及映射记录。
4. 按仓库统一验证流程验收；全球热力图现有测试会核对每个地图地区都有可读取的本地 SVG。
