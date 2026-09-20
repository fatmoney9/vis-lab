# 横向柱状图 HBar · 规范（条目化索引）

> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：**横向条系图表**——类目在左（纵向 band）、值向横向生长。
> 与 [bar.md](bar.md) 的分工是那一页开篇就定下的：「横向柱状图（HBar）因类目轴逻辑与数值 Y 轴两套，
> **单独一篇 + 单独组件**」。两页共用的只有「柱系图元」那一层几何（见 HBAR-02）。
>
> 状态图例：✅ 已落地并验收 · ⏳ 已有地基、组件未落地 · 空 = 待办。
>
> **本页当前只覆盖几何地基**（`charts/core/bar-geometry.js`）。`HBarChart` 组件本体、
> 排名播放形态（条形图竞赛）与数据标签接入尚未落地，条目见文末待办。

## 图元几何（与纵向柱系共用同一份实现）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| HBAR-02 | **圆角只在远离基线的那一端**：正值横条圆角在右端（`side:'right'`）、负值在左端（`'left'`），另一端保持尖角；`r=0` 退化为直角矩形，且与纵向共用同一行退化路径。<br>**圆角夹取按方向换轴**：竖向 `min(r, 柱宽/2, 柱高)`、横向 `min(r, 条厚/2, 条长)`——同一条规则「圆角不得超过厚度的一半，也不得超过长度」的两个方向。<br>**分档 token 沿用纵向柱系**（`radius-bar-top` / `-reduced` 与两档阈值），不新开 `radius-hbar-*`：这几个 token 表达的语义是「远离基线端的圆角 + 按条厚分档」，**方向无关**，名字带 `top` 是历史命名。新开一组等于宣称「横条可以与竖柱圆角不同」，没有任何设计源这么说。将来设计真的分叉了再加也只是一行 | `core/bar-geometry.js` → `barPath()` / `barRadius()` | ✅ |
| HBAR-03 | **行排布复用纵向柱系的单列几何**：条厚 = `singleBar(行高, 条厚上限, 容器上限, 条厚:留白比)`，条在行内垂直居中。band 传行高、返回的 `{offset, width}` 读作「行内纵向偏移 / 条厚」——**函数一行不用改**，这正是它从 `charts/charts/cartesian/layout.js` 下沉到 L1 的直接原因（`WORKFLOW.md` 第三节「两种以上图表都要遵守的规范 → 沉到 L1」机械触发）。<br>token 换成 `size-hbar-row-*` 一族；`size-hbar-row-max`(24px) 已备好，容器上限与留白比待 HBar 组件落地时补齐 | `core/bar-geometry.js` → `singleBar()` | ⏳ |

## Do / Don't

- ✅ **Do**：改横条圆角 = 改 `radius-bar-top` 一族 token（纵向横向同时生效，这是有意的）；新方向接入 = 给 `barPath` 加档，不要在 L2 另写一条路径生成器。
- ❌ **Don't**：改 `barPath` 的 `'top'` / `'bottom'` 两支——它们被 `tests/bar-geometry.test.mjs` 的 golden value 逐字符锁死，那是「柱系几何下沉没动 cartesian 一个像素」的证据；真要改，先想清楚你在改的是全部纵向柱图。为横条新开 `radius-hbar-*` token（理由见 HBAR-02）。

## 待办

- [ ] **`HBarChart` 组件本体**：类目列（`size-hbar-y-label-max` 80px 已备好，超长按 `truncateBatch` 截断）、
      值域与条长比例尺（`linearY(split, 右, 左)` 的反向 range，先例见 `specs/radar.md` 的「值→半径」）、
      条端数值标签（`size-hbar-data-label-max` 40px 已备好，见 [data-label.md](data-label.md) 那条同名待办）、
      画布高度按行数推导。
- [ ] **条厚相关 token**：容器上限与条厚:留白比（喂 HBAR-03 的 `singleBar`）。
      建议保持纵向柱系的不变式「容器上限 × ratio/(ratio+1) = 条厚上限」，于是「行少→容器封顶、行多→容器缩」
      的行为与纵向同构。
- [ ] **排名播放形态（条形图竞赛）**：按值排序、Top-N 截断、名次与数值同时插值（**小数名次**，
      于是交叉时两条平滑对穿而不是整行瞬跳）、进出榜的滑入滑出与淡入淡出、可暂停的时间轴。
      这一组需要一个可冻结的补间驱动（`runGrowth` 的取消语义是落终态，播放的暂停要冻结当前帧）。
- [ ] **本族的 L1 复用声明**：`charts/charts/hbar/README.md` 随组件落地时建。
