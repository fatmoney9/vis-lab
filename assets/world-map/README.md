# 全球热力图边界修正源

本目录保存中国市场全球热力图的边界修正来源与构建脚本。它是静态地理资产，不包含主题、颜色、业务数值或运行时国家判断。

## 来源与许可

- `china-boundary-source.json`：从 [JayMuShui/chinese-global-compliant-geodata](https://github.com/JayMuShui/chinese-global-compliant-geodata) 的 `src/geojson/globe/world.json` 提取 CN、IN 两个要素，保留完整 GeoJSON 几何。
- 固定提交：`3cf3485789876c37be6193bf2848cf9aaa40f758`。原始文件：[永久链接](https://raw.githubusercontent.com/JayMuShui/chinese-global-compliant-geodata/3cf3485789876c37be6193bf2848cf9aaa40f758/src/geojson/globe/world.json)。其 SHA-256 为 `66bfe44ff831b3cb705f7c66ef4fcccf2a85d1badc29c30852922204158fcbab`，亦记录在提取文件中。
- 打包仓库采用 MIT，版权归 JayMuShui；见 [LICENSE-MIT.txt](./LICENSE-MIT.txt)。上游 `globe/README.md` 将原始全球数据归于 Surbowl/world-geo-json-zh，并声明 Unlicense；见 [UNLICENSE.txt](./UNLICENSE.txt)。原仓库本次检索已不可访问，溯源依据是固定提交中的[数据来源说明](https://github.com/JayMuShui/chinese-global-compliant-geodata/blob/3cf3485789876c37be6193bf2848cf9aaa40f758/src/geojson/globe/README.md)。保留两份许可，不将社区数据称为官方审图数据。
- 既有世界地图路径仍来自 Figma 节点 `177:3142`，保存在 `charts/charts/world-heatmap/figma-world-map-data.js`；本目录不变更其原始来源。

## 提取与转换边界

`node assets/world-map/build.mjs` 使用固定源数据，生成 `charts/charts/world-heatmap/world-map-corrections.js`。公开模块 `world-map-data.js` 装配稳定地理数据集；运行时不请求第三方地图接口。

转换保留 Figma 全局投影及中国、印度的大部分既有路径，只将可追溯源中的藏南南界转换到同一画布坐标，并沿既有不丹、缅甸边界衔接，同时从印度几何中移除相应区域。台湾、香港、澳门的既有路径归并到 CN，共享其填色、描边、命中与 Tooltip 身份。归并的是静态几何，不自动合并业务数据值；调用方应提供已经按展示口径整理的 CN 数据。

构建脚本固定两份输入的 SHA-256，拒绝未经复核的底图更新。藏南南界按原画布的经度 / Mercator 纬度坐标转换，端点沿原不丹、缅甸轮廓对齐；端点校准距离封顶 0.4 个底图像素，中间点线性分配该微小校准差值。香港、澳门沿海岸线拼入大陆，去掉内部行政描边；台湾及离岛保留原轮廓。印度移除原 SVG 的重复填充路径，原第一条路径中的离岛保留，避免透明度二次叠加。

低分辨率南界首段与不丹原区域轮廓相交时，沿真实线段交点裁去侵入部分；中国、不丹与印度的衔接点及中印南界共用同一组坐标，不以画布矩形或手绘补丁扩大填充区域。

当前技术覆盖是台湾、港澳归并及藏南边界修正，不代表已验证中国全部疆域、世界其他争议地区或全部地图表达要求。不要在本文件、规范或 PR 中将其描述为“全领土完整”或“已通过审图”。

## 发布边界

地图表达参考[自然资源部标准地图服务](https://bzdt.tianditu.gov.cn/)和[《公开地图内容表示规范》](https://big5.www.gov.cn/gate/big5/www.gov.cn/gongbao/content/2023/content_5752310.htm)。社区源的开源许可、代码测试及局部边界修正均不等于地图审核批准。

正式公开发布前仍需核验适用的地图审核与标注要求，并对南海诸岛等尚未验证内容进行完整复核。不得借用标准地图审图号证明本转换资产已获批准。
