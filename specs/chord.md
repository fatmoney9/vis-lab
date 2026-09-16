# 弦图（ChordChart）

> 弦图表达**同一组实体之间的相互流动**：外圈一段弧代表一个实体，圈内的带（弦）代表两个实体之间的流量。
> 它与桑基图互补——桑基讲**纵向拆解**（一笔收入怎么一层层分成成本与利润），弦图讲**横向流转**
> （同一批实体之间谁流向谁）。二者都属流量型，但数据模型与几何没有任何共同部分，**不是同一个组件的两种形态**。
>
> 状态表示当前实现与规则的符合程度：已通过逻辑校验与对应验收的规则标记为 ✅，
> 仍等待浏览器视觉验证的规则标记为 ⏳。

## 分层边界

- **L1 `charts/core/`**：画布与 resize、token / behavior 解析、格式化、真实文字测量与截断、图例、Tooltip、动效、系列取色，以及**绕圆标签几何**（`polar-label.js`）与**hover / 钉住状态迁移**（`highlight-state.js`）。能力只接收通用参数，不认识弦图变体或业务字段。
- **L2 `charts/charts/chord/`**：矩阵校验、槽位与角度分配、外圈环带与弦的路径、画布几何、邻域与看板装配。**不维护颜色、字体、文字测量、绕圆标签几何或交互状态机的副本**。
- **L3 `demos/` 与预览面**：示例数据、业务字段到 `entities` / `matrix` 的映射、旋钮接线。

### 为什么不用 `d3.chord()` / `d3.ribbon()`

同一条判据让桑基没有用 `d3-sankey`：**D3 在本仓库只用于计算与 DOM 装配，不用它的高层图表封装**（`WORKFLOW.md` 第二节）。具体代价有两条：

1. **可测性**。本族的角度分配与路径生成住在零依赖的 `layout.js` 里，故能被 `node --test` 直接加载；一旦 import `d3`，整套几何就一行都测不了（`core/palette.js` 顶层 `await fetch`、`core/frame.js` import d3，都是同一个道理）。
2. **排序与留白的控制权**。`d3.chord()` 默认按值排序子分组，而本族**恒按声明序**（CHORD-02）——理由见那一条。

弦图的数学本身很短：行求和 → 按比例分角 → 两段圆弧 + 两段以圆心为控制点的二次贝塞尔。手写的成本远低于交出控制权的成本。

### 角度与半径：弦图和谁是一族

| | 角度 | 半径 |
|---|---|---|
| 饼 / 环（[pie.md](pie.md)） | **= 数据** | = 常量 |
| **弦（本页）** | **= 数据**（流量越大弧越长） | = 常量（容器 + token 算出的 R） |
| 雷达（[radar.md](radar.md)） | = 常量（`360/n` 均分） | **= 数据** |

本族与饼环同列、与雷达相反。这就是 [radar.md](radar.md) 「下沉点①（极坐标骨架）」**不被弦图触发**的书面依据——看着都是圆，数学不在同一格。

## 术语与语义

- **实体（entity）**：外圈上的一段弧，本族的顶层对象。示例场景里是一个申万一级行业。
- **矩阵（matrix）**：`matrix[i][j]` = 实体 i **流向** 实体 j 的量。行是流出、列是流入。
- **槽位（slot）**：一个实体的弧被切成若干段，每段对着一个对手方。槽位表是两档 `variant` 的**唯一差异**。
- **弦（ribbon）**：连接两个槽位的带。
- **净额（net）**：`流入 − 流出`，只出现在 Tooltip 看板里，不参与任何几何。

## 规则

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| CHORD-01 | 数据契约 `{ entities: string[], matrix: number[][], variant?, entityLabelLayout? }`。`matrix` 必须是 **n×n 方阵**且**逐行**等长（只校验首行是典型漏洞）；实体数 **≥3**，少于 3 构不成"相互流动"，两个实体的往来用一对数字就说清了。`null` / 非数 / `Infinity` / 负值一律按 0：**不占角也不进分母**，口径对齐 [pie.md](pie.md) PIE-01 与 [radar.md](radar.md) RADAR-01。**对角线 `matrix[i][i]` 一律忽略**——实体流向自身在本族没有语义，画成自环只会挡住圆心。全零矩阵**不抛错**，只画外圈占位（同 `radarDomain` 全空给 1 兜底的立场：空数据是正常读数，不是异常） | `layout.js` → `assertChordConfig()` | ✅ |
| CHORD-02 | 实体按 **`entities` 的声明序**顺时针排布，首个实体从 **12 点方向**起；槽位在实体弧内按**对手方的声明序**细分。角度约定与 `core/polar-label.js` 同源：`0 弧度 = 12 点，正角顺时针`。<br>**不提供按值排序**，这是刻意的取舍而非缺省：示例带"实体数"旋钮，4 → 10 拖动时若按值排序，每加一个实体整个环都会重排、颜色与位置全跳，**读者看不出"多了一个行业"这件事本身**。声明序下新实体只是插进它该在的位置，其余各就各位 | `layout.js` → `chordSlots()` / `chordAngles()` | ✅ |
| CHORD-03 | 实体弧的跨度 ∝ 该实体全部槽位之和；全图共用一个换算 `scale = (2π − n·pad) / Σ所有槽位`。不变量：`Σ弧跨度 + n·pad ≡ 2π` | `layout.js` → `chordAngles()` | ✅ |
| CHORD-04 | 实体之间留 `pad-angle` 的间隙，并按 `pad = min(padAngle, padMaxShare · 2π / n)` **夹取**。不夹的后果只在实体多时出现：n·pad 线性增长，图元角度被间隙一点点吃掉，而示例的实体数是可调的——**上限必须由公式保证，不能靠"默认值恰好不出事"** | `layout.js` → `chordAngles()`；`config.js` → `pad-angle` / `pad-angle-max-share` | ✅ |
| CHORD-05 | **两档 `variant` 的唯一差异是槽位表怎么列**：<br>· `'undirected'`：实体 i 有 n−1 个槽，值 = `matrix[i][j]`，故**弧跨度 = 该实体的总流出**；<br>· `'directed'`：实体 i 有 2(n−1) 个槽，出 `matrix[i][j]` 与入 `matrix[j][i]` 按对手方交替，故**弧跨度 = 总流出 + 总流入**。<br>角度分配、外圈路径、弦路径、标签、取色、交互、动效**一概与 variant 无关**。<br>⚠️ **同一份数据在两档下外圈弧长不同，这是槽位模型的必然结果，不是 bug**。写在这里是因为它一定会被当成缺陷报上来，而"修"它的方向（让两档弧长一致）只能靠再写一套布局。<br>❌ 不得出现第二个布局入口（`layoutUndirectedChord` / `layoutDirectedChord`），❌ 不得在 `index.js` 里按 variant 分叉绘制——那样 padAngle 夹取、大弧标志、标签预算、最小可见角会各修一遍，改一处漏一处 | `layout.js` → `chordSlots()` / `chordRibbons()` | ✅ |
| CHORD-06 | `variant: 'undirected'`（**默认**）：一对实体只画一条带，两端宽度分别等于 `matrix[i][j]` 与 `matrix[j][i]`，净流向靠两端粗细差读出。<br>`variant: 'directed'`：每个方向各一条带，两端等宽，方向由**目标端按 `directed-taper` 比例对称收窄**表达。<br>❌ **不使用 `<marker>` 箭头**：marker 要自带尺寸与颜色，等于为一档形态凭空多开两条 token 通道；`taper` 是纯比例量，三主题同值 | `layout.js` → `chordRibbons()` / `ribbonPath()`；`config.js` → `directed-taper` | ✅ |
| CHORD-07 | 路径手写，**不用 `d3.chord()` / `d3.ribbon()`**（判据见「分层边界」）。<br>· 外圈环带 = 外弧（`sweep=1`）+ 内弧（`sweep=0`）+ 闭合，两段共用按跨度取的大弧标志 `laf = 跨度 > π ? 1 : 0`；<br>· 弦 = 源端沿内圆的弧 → 二次贝塞尔 → 目标端沿内圆的弧 → 二次贝塞尔闭合，**两段贝塞尔的控制点恒为圆心 (0,0)**，故不需要任何张力参数。<br>⚠️ **大弧标志与 sweep 是本族最容易写错且最不容易被发现的两处**：跨度 ≤ π 时 `laf` 取 0 或 1 画出来一模一样，均匀数据永远测不出来；内弧写成 `sweep=1` 会得到一个自交的蝴蝶结。验收必须造"单实体占比 > 50%"的夹具 | `layout.js` → `arcPath()` / `ribbonPath()` | ✅ |
| CHORD-08 | 弦的填充是**两端实体色的线性渐变**：源端取源实体色、目标端取目标实体色，渐变轴 = 源端弧中点 → 目标端弧中点（都在内圆上；有向档取收窄后的中点）。<br>**为什么不是单色**：一条弦连的是两个**平权**的实体，单色只能表达其中一端，另一端的身份就丢了——而「谁和谁之间」恰恰是这张图要回答的问题。<br>⚠️ **与 [sankey.md](sankey.md) SANKEY-08「边使用目标节点颜色、禁止颜色渐变」有意不同，不要照它"修正"回单色**：桑基的边连接的是收入 / 支出 / 利润三种**业务角色**，颜色本身就是角色标识，渐变会让角色读不清；弦图的实体之间没有这种主从关系。两条规则各自成立，差别来自数据语义而非口味。<br>渐变的 `stop-color` 读 `--dv-series-N`，故色值仍不进源码；`linearGradient` 的 id 由实例序号 + 弦序号拼成（弦的 `key` 里带 `->`，直接做 `url(#…)` 引用不到）。CSS 侧保留单色兜底，渐变缺失时退成源端色而不是整条弦不可见。 | `layout.js` → `chordRibbons()` / `layoutChord()`（渐变轴）；`index.js`（`<linearGradient>`）；`charts/styles.css` → `--dv-chord-ribbon-fill` | ✅ |
| CHORD-09 | 实体色走 `resolveSeriesColors(host, { series: 逐实体 type:'pie' })`——弦图外圈实体与饼扇区是同一种东西（同一总量的并列组成部分、绕一圈排布），故复用扇区盘（[color.md](color.md) COLOR-08：主题未声明 `pie-multi` 时回落 `bar-multi`）。取色结果写成 `--dv-series-N` 由 CSS 消费；**组件 API 不收 color 参数**（拼接铁律 2）。<br>实体数超过当前主题扇区盘长度时**按声明序循环取色、不重排**（COLOR-04）。实测：THS 走 11 色扇区盘、iFinD-PC 回落 24 色，n=10 均不循环；**Ainvest 回落 8 色，第 9、10 个实体与第 1、2 个同色**——这是已知且被接受的行为，消歧靠环上位置不相邻 + 弧标签 + hover 压暗 + 看板实体名，见「待办」 | `index.js`；`core/palette.js` → `resolveSeriesColors()` | ✅ |
| CHORD-10 | 画布几何。**两档标签的画布形状不同，这不是可以统一的两种写法**：<br>· `arc` 档——文字沿圆周切向排布、四周占位一样宽，故画布是**正方形**，只吃 `min(容器宽, 容器高)`，带宽由文字墨迹决定。<br>· `horizontal` 档——文字径向摆出：左右两侧是**整串文字**（四个汉字 @12px 要 48px），上下只有**一行**。这与 [radar.md](radar.md) RADAR-09 的非对称完全相同，故也照它**横竖分开**：横向带 `labelBand(容器宽, R, --size-chord-label-band)` 吃宽度的剩余并封顶，纵向带由行高决定。<br>两档共同：`R = clamp(maxRadius × 50%, 可用半宽 − 带宽, maxRadius)`，画布是**图元外接框、不吃满容器**（同 PIE-02 / RADAR-09）。缩小容器时标签带先被挤掉、半径后缩；R 触到 50% 下限后改为**溢出**由调用方裁剪——「看得见但装不下，优于装得下但看不清」（PIE-02）。容器没给高时退到本族 `--size-chord-container`；**不占用三族共用的 `--size-chart-region-height`**。<br>⚠️ **两档曾共用「正方形 + min(宽,高)」，那是错的**：横排档的带宽因此由**高度**决定，容器没给高时退到 200px、带宽只剩 20px，四个汉字一个都放不下，整层标签渲染成空串——而当时门禁 11/11 与全部单测都是绿的。横排文字往左右伸，带宽就该看宽度。 | `layout.js` → `chordFrame()`；`core/polar-label.js` → `labelBand()` | ✅ |
| CHORD-11 | 实体标签两档，均**复用 L1 `core/polar-label.js`，本族不复制任何一份**：<br>· `entityLabelLayout: 'arc'`（**默认**）：名称沿外圈弧切向环绕，下半圆路径反向以保持文字正向，并按 L1 `measureInk()` 的**真实墨迹 ascent** 外移；**弧长就是截断预算**，显示几何与测量口径同一条弧（同 RADAR-14，不得统一按 `R + gap` 估一个数）。<br>· `entityLabelLayout: 'horizontal'`：走 L1 `labelAnchor()` 八向锚点径向摆出，预算是**横向**标签带宽（见 CHORD-10，由容器宽度而非 `min(宽,高)` 决定）。<br>两档都走 `truncateBatch` 截断而非丢弃；**一个字都放不下时给「…」而不是空串**（同桑基）——实体的身份不能悄悄消失，省略号至少告诉读者「这里有个名字，容器装不下」。<br>**横排档存在的理由是实测的**：n=10 时份额小的实体弧长只有十几 px，四字行业名在环绕档会被截到一两个字；这不是环绕档的缺陷，是弧长与文字长度的物理冲突，故给第二档而不是改第一档 | `index.js`；`core/polar-label.js` → `labelArc()` / `labelAnchor()`；`core/label.js` → `truncateBatch()`；`core/measure.js` → `measureInk()` | ✅ |
| CHORD-12 | hover / 点击 / 键盘聚焦**实体弧**时，高亮该实体、它的全部弦、以及这些弦另一端的实体；hover / 聚焦**弦**时只高亮该弦及其两端实体。**只含直接相邻，不做传递闭包**（同 [sankey.md](sankey.md) SANKEY-10）。其余图元压到 `opacity-visualization-dim` | `model.js` → `chordRelatedNeighborhood()`；`index.js` | ✅ |
| CHORD-13 | Tooltip 看板：实体看板列**流出 / 流入 / 净额**与对手方明细；弦看板列两个方向各一行 + 净额。位置**恒 `follow`**——消费 [tooltip.md](tooltip.md) TOOLTIP-07「无坐标系图恒跟随指针」这条通则，在 L2 定死并回引，**不给 `behavior.json` 加键**（同 PIE-05 / TREEMAP-07 / RADAR-10）。`place()` 不传容器尺寸，clamp 边界由 L1 自取 | `model.js` → `chordDashboard()`；`core/tooltip.js` | ✅ |
| CHORD-14 | 点击钉住：再点同一目标关闭、点别的移过去、点 SVG 内空白清除。hover 压过钉住，移出后回落到钉住态。**状态迁移走 L1 `core/highlight-state.js`**，本族只负责"把当前状态画出来"——钉位只有一个，跨类互斥由类型保证 | `core/highlight-state.js`；`index.js` | ✅ |
| CHORD-15 | 弧与弦均 `tabindex="0"` + `role="graphics-symbol"` + `aria-label`；focus 等同 hover、blur 不清钉住（与 CHORD-14 同一套迁移，故键盘与指针天然一致，不另写一份） | `index.js` | ✅ |
| CHORD-16 | 入场动效：弦按顺时针依次生长，出现时机由**单一进度值派生**，不给每条弦各自计时。**外圈弧与实体标签第 0 帧就位**——[motion.md](motion.md) MOTION-05「只有数据图元生长，坐标系与附属元素直接就位」，外圈环在本族的地位等同坐标轴。减弱动效下恒终态（MOTION-07） | `index.js`；`core/motion.js` → `easeOutCubic` / `reducedMotion` | ✅ |
| CHORD-17 | 弦默认 `opacity-chord-ribbon`、高亮 `opacity-chord-ribbon-active`、弱化 `opacity-visualization-dim`。**三档透明度走 token 而非 L2 常量**：它是会被某个主题单独调掉的**取值**（判据同 RADAR-03 那条 Ainvest 无底填充——取值差异不是形态差异，故进 `tokens/*.json` 不进 `behavior.json`），与 `opacity-radar-area` 同类 | `tokens/*.json`；`charts/styles.css` | ✅ |
| CHORD-18 | 值为 0 的槽位不占角（同 PIE-01）；**非零但极小的槽位不小于 `min-slot-angle`**，避免"有流量却看不见"——这是 SANKEY-12「最细非零边仍须可见」的角度版 | `layout.js` → `chordAngles()`；`config.js` → `min-slot-angle` | ✅ |
| CHORD-19 | **不渲染图例**。实体名已沿外圈逐个标注，图例是同一份信息的第二遍，且会吃掉正方形画布本就紧张的高度。<br>写成规则而不是"暂未实现"，是为了让下一个人知道这是**判断不是遗漏**；若将来确有需要，marker 传 `'dot'` 即命中 [legend.md](legend.md) LEGEND-03 的既有规则，`behavior.json` 无需新增键（同 PIE-03 / RADAR-08） | — | ✅ |
| CHORD-20 | 命中区由**透明粗描边**撑出（弦带 `stroke-opacity: 0`）与**透明填充矩形**承担（标签热区 `fill: transparent`），细弦也点得中。两者在默认 `visiblePainted` 下即可命中，故**不显式声明 `pointer-events`**：显式值优先于继承值，会盖掉容器关交互的开关（画廊预览卡片用的就是继承的 `pointer-events: none`） | `charts/styles.css` → `.dv-chord__ribbon-band` / `.dv-chord__label-hit` | ✅ |

## 活 demo

- 对外站点 `index.html` → 「弦图 · 行业资金流向」：实体数 4–10 连续可调，`variant` 与 `entityLabelLayout` 各一个分段旋钮。
- 开发验收面 `playground/preview.html`：三主题并排，同样两个旋钮。

**不另建 `playground/chord-preview.html`**：本族是正方形画布、无固定外框硬需求，三主题卡片网格表达得了。桑基那个独立面是 SANKEY-23 的 812px 报表框逼出来的例外，`WORKFLOW.md` 第七节明令「新图型若无类似硬需求，不要照抄这条路径」。

## API

```js
ChordChart(host, {
  entities,                      // string[]，实体名，≥3；顺序即 12 点起顺时针（CHORD-01/02）
  matrix,                        // number[][]，n×n；matrix[i][j] = i 流向 j 的量（CHORD-01）
  name,                          // 可选：整图名称，作 tooltip 标题行；不给则整行不渲染（同 PIE-05）
  variant = 'undirected',        // 形态语义：'undirected' 一对一条带 / 'directed' 每向一条（CHORD-05/06）
  entityLabelLayout = 'arc',     // 形态语义：'arc' 沿弧环绕 / 'horizontal' 径向横排（CHORD-11）
  platform = 'pc',
  animation = true,              // 弦顺时针依次生长；减弱动效下恒终态（CHORD-16）
  text,                          // 可选：固定文案整套替换，缺省 model.js 的 CHORD_TEXT（CHARTTEXT-01/02）
})
```

颜色按固定色槽分配、不接受配置（拼接铁律 2）；尺寸、间距与字号均走 token，API 不收样式参数（铁律 4）。图面尺寸由宿主容器 CSS 决定，容器没给高时退到 `--size-chord-container`（CHORD-10）。

## Do / Don't

- ✅ 用弦图表达**同一组实体之间的相互流动**：谁流向谁、净流向是谁。
- ✅ 实体数控制在 **4–8**：3 是下限（再少就不必用图），10 已接近可读上限（`undirected` 最多 45 条弦，`directed` 最多 90 条）。
- ✅ 方向语义重要时用 `variant: 'directed'`；只关心总往来强度时用默认的 `'undirected'`，图面干净得多。
- ✅ 实体名较长、或实体数接近上限时切 `entityLabelLayout: 'horizontal'`，别让名字被截成一两个字。
- ❌ 不用弦图表达**分层拆解**（一笔总量逐级分成若干部分）——那是桑基图，见 [sankey.md](sankey.md)。
- ❌ 不用弦图表达**单向无环的流程**：没有回流时弦图退化成一个绕圈的桑基，读起来更费劲。
- ❌ 不把弦改回单色——两端渐变是 CHORD-08 的结论，不是没来得及做的简化。
- ❌ 不喂负值或自流（对角线）——前者按 0 处理，后者被忽略，都不会报错，但说明数据口径没对齐。

## 待办

- [ ] **Ainvest 扇区盘只有 8 色**，n ≥ 9 时循环（CHORD-09）。**连带后果**：两端恰好撞到同一个色槽的弦，CHORD-08 的渐变会退化成单色（实测 n=10 的 Ainvest 有 2 条如此）——这不是渐变没生效，是色板不够长。补齐需要设计源给出的色值，**不得自行编写 hex**——`lint-color-literals.mjs` 只扫 `charts/`，`tokens/palette.json` 里写死颜色是合法的，所以门禁拦不住编色，这恰恰是最危险的地方。
- [ ] 移动端形态（`platform: 'mobile'`）的半径、字号与标签档默认值尚未按设计源逐条对照。
- [ ] **Ainvest 的英文实体名在两档下都大量截断**（实测 n=10 时 10 个里截 9 个）：`--size-chord-label-band` 现取 56px（沿用雷达），对 `Non-bank Financials` 这类长名不够。是加宽本族的带、还是接受截断，需要设计判断；**不要只为这一条把三主题的带一起加宽**。
- [ ] 弦的三档透明度现取 `0.2 / 0.64 / dim`（沿用桑基流带的口径）。弦图在小圆里叠的带比桑基多，实测 n=10 时单条弦偏淡；是否为本族单独调高，同样是设计判断。
- [ ] 弦数接近上限时的可读性：若实测 n=10 读不出，正确动作是**收窄示例的 `densityRange.max` 并在 `densityControl.hint` 写清理由**（同 radar 的做法），而不是给 API 加过滤参数。
- [ ] 数据加载态与异常态。
