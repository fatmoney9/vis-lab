# 横向柱状图 HBar · 规范（条目化索引）

> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：**横向条系图表**——类目在左（纵向 band）、值向横向生长。
> 与 [bar.md](bar.md) 的分工是那一页开篇就定下的：「横向柱状图（HBar）因类目轴逻辑与数值 Y 轴两套，
> **单独一篇 + 单独组件**」。两页共用的只有「柱系图元」那一层几何（见 HBAR-02）。
>
> 状态图例：✅ 已落地并验收 · ⏳ 已有地基、组件未落地 · 空 = 待办。
>
> 号段分区：**HBAR-01..09 几何与排布**（静态横向条也吃这几条）· **HBAR-10..20 排名播放形态**。

## 几何与排布

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| HBAR-01 | **横向条渲染**：名称在左列、条自左侧基线向右生长、数值贴条端右侧。`null` / 非数按 0 计——**仍占一个名次**，避免它凭空消失又出现（与 LABEL-07「null 不画」不同：那里丢的是标签，这里丢的会是一整行的身份） | `charts/hbar/model.js` → `rankItems` | ✅ |
| HBAR-02 | **圆角只在远离基线的那一端**：正值横条圆角在右端（`side:'right'`）、负值在左端（`'left'`），另一端保持尖角；`r=0` 退化为直角矩形，且与纵向共用同一行退化路径。<br>**圆角夹取按方向换轴**：竖向 `min(r, 柱宽/2, 柱高)`、横向 `min(r, 条厚/2, 条长)`——同一条规则「圆角不得超过厚度的一半，也不得超过长度」的两个方向。<br>**分档 token 沿用纵向柱系**（`radius-bar-top` / `-reduced` 与两档阈值），不新开 `radius-hbar-*`：这几个 token 表达的语义是「远离基线端的圆角 + 按条厚分档」，**方向无关**，名字带 `top` 是历史命名。新开一组等于宣称「横条可以与竖柱圆角不同」，没有任何设计源这么说。将来设计真的分叉了再加也只是一行 | `core/bar-geometry.js` → `barPath()` / `barRadius()` | ✅ |
| HBAR-04 | **名称列**宽封顶 `size-hbar-y-label-max`(80px)，超长按 `truncateBatch` 截断加省略号；右对齐、与条垂直居中、挂 `.dv-axis-label`——它就是类目轴标签的横向形态，字号字色随轴标签 token，不新开一套 | `charts/hbar/index.js` → `build()` | ✅ |
| HBAR-05 | **数值列**宽封顶 `size-hbar-data-label-max`(40px)，贴条端外侧 `spacing-data-label-gap`，挂 `.dv-data-label`。带宽只用于**预留右边距**，不做逐帧测量与碰撞过滤——每行独占一行，LABEL-06② 的「一次调用 = 同一行」前提不成立 | 同上 | ✅ |
| HBAR-06 | **值域 `niceSplit(0, max)`**，条长走 `linearY(split, 右, 左)` 的**反向 range**（`linearY` 的数学与方向无关，先例见 [radar.md](radar.md) 的「值→半径」）。**不画数值轴、不画网格线**——读数由条端常驻数值承担，再画一套刻度是同一份信息的第二遍 | `charts/hbar/index.js` → `build()` | ✅ |
| HBAR-07 | **系列色按 `items` 的声明序取槽位，与当前名次无关**。颜色只在结构级写进行 `<g>` 的 `color`，逐帧不动——这是「颜色跟随实体、不跟随排名」的物理保证。名次一变颜色就跟着变的话，读者会以为换了一个实体 | `charts/hbar/index.js`；`charts/hbar/model.js` → `slot` | ✅ |
| HBAR-08 | **画布高由行数推导**（行数 × 行容器上限）；容器给出高度时随容器，判据走 `core/frame.js` 的 `containerDrivesHeight`（三族共用，不另抄阈值） | `charts/hbar/index.js` → `build()` | ✅ |
| HBAR-09 | **本族不提供 tooltip 与指示线**：读数已由条端常驻数值承担，浮层只会遮住正在滑动的相邻行。这是判断不是遗漏；将来引入多指标再议 | —（`charts/hbar/README.md` 声明为「不用」） | ✅ |
| HBAR-03 | **行排布复用纵向柱系的单列几何**：条厚 = `singleBar(行高, 条厚上限, 容器上限, 条厚:留白比)`，条在行内垂直居中。band 传行高、返回的 `{offset, width}` 读作「行内纵向偏移 / 条厚」——**函数一行不用改**，这正是它从 `charts/charts/cartesian/layout.js` 下沉到 L1 的直接原因（`WORKFLOW.md` 第三节「两种以上图表都要遵守的规范 → 沉到 L1」机械触发）。<br>token 换成 `size-hbar-row-*` 一族；`size-hbar-row-max`(24px) 已备好，容器上限与留白比待 HBar 组件落地时补齐 | `core/bar-geometry.js` → `singleBar()` | ⏳ |

## 排名播放（竞赛形态）

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| HBAR-10 | **按值降序排名，同值按实体 key 稳定裁决**——并列的两条在相邻帧里不得换来换去，否则画面无端抖动。排序结果与输入顺序无关 | `charts/hbar/model.js` → `rankItems` | ✅ |
| HBAR-11 | **只显示前 N 名**（`topN`，默认 10，区间 2–30）。榜外的项仍留在模型里（`alpha:0`、座位 = 榜底外一行），供插值当「进出榜的起终点」用；N 是语义配置不是样式 token | `charts/hbar/config.js` → `clampTopN`；`model.js` | ✅ |
| HBAR-12 | **换位补间：值与名次同时线性插值，名次是「小数」** ⇒ 行位置连续、交叉时两条平滑对穿。<br>⚠️ **这是本族与 [sankey.md](sankey.md) SANKEY-24 的关键分叉，别照抄那边**：桑基的节点位置是流量的**连续函数**，插值 value 后重跑布局天然平滑；本族的行位置是**排序名次**，是值的**离散函数**——若每帧对插值后的值重新排序，交叉那一帧会整行**瞬跳**。<br>值域 `max` 也插值：值域突变会让所有条同时抽一下，比名次跳变更刺眼 | `charts/hbar/model.js` → `interpolateRanking` | ✅ |
| HBAR-13 | **进出榜是同一条 t 的副产品，不需要第二套时序**：某一端缺席的实体，在那端取「榜底外一行 + alpha 0 + 值 0」⇒ 进榜者名次自榜底滑入且淡入、掉榜者反向。渲染取 `rank <= topN`（含正在滑出那一行），行层挂 `clip-path` 裁到绘图区，滑动不越界 | `charts/hbar/model.js` → `visibleRows`；`index.js` 的 clipPath | ✅ |
| HBAR-14 | **数值滚动**：条端数值随插值后的值逐帧重排版，末帧精确落到目标期原值。<br>**本条显式覆盖 SANKEY-24 的「不做数字跳动」**，两条方向相反但都成立——[motion.md](motion.md) 页首允许图表页覆盖本页默认。分歧是真实的设计判断：桑基的数字是**节点标注**，读者要在拓扑上对账收支守恒，滚动会让「这个数现在是多少」全程不可读；竞赛图的数值是**叙事主体**，「谁涨上去了」就是由数字和条长一起说的，不滚动等于把叙事砍掉一半 | `charts/hbar/index.js` → `paint()` | ✅ |
| HBAR-15 | **一期时长 760ms、缓动 `cubicOut`**，不按名次变化幅度分档（同 MOTION-02 的节奏统一）。比入场的 480ms 长，因为这一帧里同时在变的东西更多（条长 + 行位置 + 数值 + 进出场透明度），太快看不清谁超过了谁。时长是**规范值常量**不是 token——三主题同值，且 [motion.md](motion.md) 的 480ms 只约束入场生长 | `charts/hbar/config.js` → `HBAR_SETTINGS` | ✅ |
| HBAR-16 | **暂停 = 冻结当前帧，不落终态**；恢复从冻结处继续。<br>这正是不能用 `core/motion.js` 的 `runGrowth` 的唯一理由——那个驱动被取消时会 `settle()` 到终态，而播放的暂停必须停在看到的那一帧。判例与 SANKEY-24 同源 | `charts/hbar/index.js` → `cancelMotion` | ✅ |
| HBAR-17 | **从当前显示态起补，不从上一期原值重来**：拖时间轴快速连点时不闪回。实现上是 `from` 取当前显示态（可能是被冻结的中间帧），先例是 [pie.md](pie.md) 的强调态补间。<br>由此产生一条**模型不变量**：`interpolateRanking` 的输出必须能原样再喂给它自己（每行都带 `seat`），否则链式插值算出 `NaN` | `charts/hbar/index.js` → `update()`；`model.js` | ✅ |
| HBAR-18 | **首次挂载仍按 MOTION-01 播一次入场生长**（条自左向右长）；**`update()` 的每一次补间都不是入场，不重放生长**。这是对 MOTION-04「只在首次挂载播一次」的 scope 澄清：那条约束的是入场，期间推进属于另一类动效 | `charts/hbar/index.js` → `firstBuild` | ✅ |
| HBAR-19 | **降级**：`prefers-reduced-motion: reduce` 或 `animation:false` 时，入场不播、**每期直接切到该期终态**，且**不自动起播**。<br>口径一句话：**关闭的是动画，不是播放；终态永远是「当前这一期」的终态，不是最后一期。** 一进页面就看到若干次硬切，对前庭功能障碍用户比连续位移更糟 | `charts/hbar/index.js` → `update()`；`demos/playback-controller.js` 的 `autoplay:false` | ✅ |
| HBAR-20 | **实例 API 与 `SankeyChart` 同形**：`update(config, { animate, onProgress }) => Promise<boolean>` / `pause()` / `destroy()`。这是硬要求——两个会播放的图表若形状不同，L3 的播放控制器就要为每个图型分叉，而那正是把它收敛成 `demos/playback-controller.js` 想消掉的东西 | `charts/hbar/index.js` | ✅ |

## Do / Don't

- ✅ **Do**：改横条圆角 = 改 `radius-bar-top` 一族 token（纵向横向同时生效，这是有意的）；新方向接入 = 给 `barPath` 加档，不要在 L2 另写一条路径生成器。
- ❌ **Don't**：改 `barPath` 的 `'top'` / `'bottom'` 两支——它们被 `tests/bar-geometry.test.mjs` 的 golden value 逐字符锁死，那是「柱系几何下沉没动 cartesian 一个像素」的证据；真要改，先想清楚你在改的是全部纵向柱图。为横条新开 `radius-hbar-*` token（理由见 HBAR-02）。

## 待办

- [ ] **静态横向条形态尚无示例**：组件不给时间轴就是静态横向条（HBAR-20 的自然结果），
      但两面目前只接了竞赛示例，静态形态没有任何一处在跑，等于没被验收过。
      接一个静态示例即可，无需改组件。
- [ ] **数据标签 / 轴标题 / 图例尚未接入本族**：当前条端数值由本族自己画
      （`.dv-hbar__value`，走 `dv-data-label` 的样式），没有经过 [data-label.md](data-label.md)
      的碰撞过滤与超界回收，也没有轴标题与图例。
      [bar.md](bar.md)、[data-label.md](data-label.md)、[axis-title.md](axis-title.md)
      三页里以 HBar 为例的欠账指的就是这一项。
- [ ] **类目列宽目前是定值**：`size-hbar-y-label-max` 80px 封顶 + `truncateBatch` 截断，
      不按实际最长名称收窄。名称都很短时左侧会留出空白。纵向柱系的 Y 轴列宽同样是定值，
      两边要改一起改，别只改一族。
