# 播放轴 playback · 规范（条目化索引）

> 适用范围：**带时间轴的图表共用的播放控件**——时间轴、播放 / 暂停、上一期 / 下一期、刻度跳转，
> 以及这套控件的三主题视觉。本页管「播放这件事本身」，**不管任何图型怎么画一期**。
>
> 分层：控件整体是 **L3**（`demos/playback/`），补间驱动是 **L1**（`core/motion.js` 的 `runTween`，
> 见 [motion.md](motion.md) MOTION-08）。**逐期怎么画由消费方注入**，控件不认识任何图型。
>
> **各图型自己的逐期规则不在本页**：桑基的拓扑插值与文字提前量见 [sankey.md](sankey.md) SANKEY-24，
> 竞赛图的名次插值与数值滚动见 [hbar.md](hbar.md) HBAR-12/14。两者对「数字要不要滚动」的判断相反
> （SANKEY-24 不滚、HBAR-14 滚），**这不是矛盾**：那是图型专属规则，本页不预设。
>
> ⚠️ **本页 2026-09-20 从 [sankey.md](sankey.md) 拆出**。此前播放件的代码已是中性公用件，
> 规则却仍挂在桑基那一页，于是「改一个两族共用的控件」要去动某一个图的规范页——
> 三主题播放键配色那次就是这么发生的。规范只有一个家（WORKFLOW §一），这里就是播放的家。

## 组成与边界

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PLAYBACK-01 | **控件由三件组成，职责不重叠**：<br>· `demos/playback/view.js`——DOM 模板、刻度模板、控件自身文案、主题映射、宿主高度换算<br>· `demos/playback/controller.js`——状态机：五个监听、播放循环、控件回显<br>· `demos/playback/playback.css`——全部视觉，含三主题覆盖<br>**本件不持有图表实例、不拼配置、不认识宿主 state**，「怎么画一期」经 `applyPeriod` 注入。<br>判据：往这里加东西前先问「是不是只有某一个图型需要」，是就别放进来 | `demos/playback/*` | ✅ |
| PLAYBACK-02 | **实例 API 的形状是硬要求**：消费方须提供 `update(config, { animate }) => Promise<boolean>` 与 `pause()`。<br>两个会播放的图表若形状不同，控制器就要为每个图型分叉——而收敛掉那种分叉正是本件存在的理由。<br>`update` resolve `true` = 跑完、`false` = 被暂停（**不是 reject**：暂停不是失败，循环据此停止而不回滚业务状态） | `demos/playback/controller.js`；消费方见 [hbar.md](hbar.md) HBAR-20 | ✅ |

## 时间轴与控制

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PLAYBACK-03 | **时间轴是离散的**：滑块只落在周期刻度上，**切换开始时直接跳到目标刻度，不随图形中间帧滑动**。<br>滑块与图形**不共享进度**——先推序号、先回显控件，**再** await 图表动画。<br>读者用滑块表达「我要看哪一期」，它不是动画进度条；跟着中间帧走会让「现在停在哪一期」全程不可读。<br>更新失败时回滚序号 | `demos/playback/controller.js` → `goTo()` | ✅ |
| PLAYBACK-04 | **五个入口**：播放 / 暂停、上一期、下一期、点刻度、拖滑块。<br>· 首期时「上一期」禁用、末期时「下一期」禁用<br>· 已在末期再点播放 → **回卷到第 0 期，且这一跳不播动画**（那是重置不是播放）<br>· 任一手动入口都先 `stop()` 再跳：手动操作**优先于**正在进行的自动播放 | `demos/playback/controller.js` | ✅ |
| PLAYBACK-05 | **暂停 = 冻结当前帧，不落终态**；恢复时**先把被打断的那一跳补完**，再继续往后走。<br>驱动器契约见 [motion.md](motion.md) MOTION-08——这正是不能用 `runGrowth` 的唯一理由（它被取消时会落终态）。<br>⚠️ 验收时**只断言「暂停后画面没变」是不够的**：「已经落到终态然后不动了」同样满足，必须同时断言它**不等于该期终态**；且暂停要打在动画中途，否则会落在两期之间的间隙上、几何本就是终态 | `demos/playback/controller.js` → `stop()` / `play()` | ✅ |
| PLAYBACK-06 | **不自动起播**（`autoplay` 缺省 `false`）。一进页面就自己动起来，对前庭功能障碍用户与只想看某一帧的人都是打扰；播放键就在那里，要看的人会点。<br>宿主可显式开启，但**画廊一类批量渲染的场合不得开**——那会在首页同时跑一堆动画 | `demos/playback/controller.js` | ✅ |
| PLAYBACK-07 | **减弱动效降级**：`prefers-reduced-motion: reduce` 时**不播动画，但播放能力不消失**——每期直接切到该期终态。<br>口径一句话：**关闭的是动画，不是播放**；终态永远是「当前这一期」的终态，不是最后一期 | 消费方的 `update(_, { animate:false })`；见 [hbar.md](hbar.md) HBAR-19 | ✅ |

## 刻度与文案

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PLAYBACK-08 | **带文字的刻度最多 8 个，首末两期恒带字**。8 期时每期都带字，24 期时糊成一片。<br>⚠️ **抽稀的只是文字，不是刻度本身**——每一期仍是一个可点的按钮，跳期能力不能因为期数多就残掉；不带文字的收窄成细标记。<br>标签可用宽按**带字的刻度数**算、不是按总期数：24 期按 23 做分母会把每个标签压成「2..」 | `demos/playback/view.js` → `playbackTicksMarkup` / `labelledTickCount` | ✅ |
| PLAYBACK-09 | **控件文案必须整套给全，缺键当场抛错**（口径同 L1 `core/chart-text.js` 的 CHARTTEXT-01/02：宁可渲染时炸，也不要在英文面上残留半截中文或渲染出 `undefined`）。<br>**本件只持有控件自身的 chrome 文案**（播放 / 暂停 / 上一期…），按主题语言切换；<br>**业务文案留在各图型自己的 presentation 模块**——期次怎么称呼由示例数据自带，本件只负责显示，不认识它的含义 | `demos/playback/view.js` → `playbackCopy` / `assertPlaybackCopy` | ✅ |
| PLAYBACK-10 | **宿主高度换算**：调用方提供序列画布高与跨主题最低图例兜底，真实图例占位由当前 L3 主题 token 决定。<br>`legendFallbackHeight === null` 表示**本图型没有图例带**，整段图例预留跳过。<br>各图型自己的外框尺寸不在本页（桑基的 812px 报表框见 [sankey.md](sankey.md) SANKEY-23） | `demos/playback/view.js` → `resolvePlaybackChartHeight` | ✅ |

## 三主题视觉

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| PLAYBACK-11 | **播放键在三个主题上都显示**，底色分两态：<br>· 待播 = 各主题的**控件强调色**（`color-playback-primary-bg`：THS `#FF2436`、iFinD `#1B63D9`/`#3371FF`、Ainvest `#165DFF`/`#3371FF`）<br>· 播放中 = **中性灰**（`color-playback-primary-paused-bg` → `color-grey-05` `#858585`，三主题同值）。强调色留给「可以开始播」这一个动作，正在播时它不该继续抢注意力；白色暂停竖条对比度 3.69:1，过非文字元件 3:1 的线<br>⚠️ **底色不得接在涨跌色上**。2026-09-20 之前它直接引用 `color-price-up`，于是播放键跟着「涨」色走、iFinD 因此是红的——涨跌色与「能不能点」没有任何语义关系 | `demos/playback/playback.css` · `tokens/*.json` | ✅ |
| PLAYBACK-12 | **Ainvest 外壳**以 PC Figma `Uv36h0PXzZG7ZhuHBHQ3qz / 110:2941` 为来源，PC / 移动端共用：组件总高 110px、上下内边距 6px、时间轴 46px、时间轴与按钮行间距 16px；轨道位于时间轴顶部 14px、铺满、高 4px、圆角 2px，刻度 2×4px。滑块保持 `behavior.datazoom-handle` 的 32px 圆形、三根 10px grip、主题描边与投影；**时间轴必须允许滑块描边与投影溢出**，不得裁切滑块上沿。<br>Previous / Next 为高 36px 的自适应宽度胶囊，水平内边距 16px、间距 16px，用语义 token `radius-playback-step = 18px` 与该节点的 16px 原始箭头资源。**固定 18px = 控件高的一半**，保证两端半圆、中段直边；禁止改用 `radius-full = 50%`——百分比圆角作用于可变宽按钮会形成椭圆。时间轴文案用 `Q1 ’25` 形式的英文短年表示，11px / 16px Regular。<br>⚠️ **播放键一项与该 Figma 节点不同**：该节点及 2026-08-27 的产品确认均为「全端隐藏播放键」，2026-09-20 起按需求改为显示（PLAYBACK-11）——播放能力不应因主题而缺失。按钮尺寸仍取本主题的 36px 控件高 | `demos/playback/playback.css` | ✅ |
| PLAYBACK-13 | **iFinD 的滑块把手复用 THS 形态**：24×24px 白色圆角矩形、三线 grip、THS 描边与明暗模式。<br>这是原生 range 控件的 L3 局部覆盖，**只在把手自身建立 THS token 作用域**；轨道、刻度、播放键与 Previous / Next 仍走 iFinD 主题，不修改全局 iFinD-PC DataZoom 规范。<br>三个 L3 面必须复用同一份主题映射 | `demos/playback/view.js` → `playbackRangeTheme` | ✅ |

## 活 demo

三个 L3 面都在跑同一份播放件：

- `index.html` 的**财报收支拆解**与**行业市值排名**：单实例播放。
- `playground/preview.html`：**一条轴驱动三张主题卡**，三卡同时起跑同时收束（多实例同步）。
- `playground/sankey-preview.html`：812px 报表框下的播放（那个面的存在理由是 SANKEY-23，不是播放）。

验收要点：推进 / 暂停冻结 / 跳刻度 / 拖滑块 / 切主题后控件仍在 / 三主题×明暗播放键两态配色。
**拖完数据量滑杆后播放键仍然可用**——宿主重挂图表时必须连播放接线一起重挂（否则拖一次滑杆播放就永久失灵）。

## Do / Don't

- ✅ **Do**：新图型接入 = 提供 `update` / `pause` 两个方法并注入 `applyPeriod`（PLAYBACK-02），
  控件一行不用改；多实例同步 = 在 `applyPeriod` 里 `Promise.all` 后 `every(Boolean)`；
  改播放区任何东西之前先想它影响的是**全部**消费方。
- ❌ **Don't**：把只有某一个图型需要的东西放进本件（判据见 PLAYBACK-01）；
  让滑块跟着图形中间帧滑动（PLAYBACK-03）；把控件底色接在业务语义色上（PLAYBACK-11 的教训）；
  在页面内复制一份主题覆盖（三个面必须共用 `playback.css`）；
  给画廊那种批量渲染的场合开 `autoplay`（PLAYBACK-06）。

## 待办

- [ ] **测试仍分散**：`tests/playback.test.mjs` 收了纯逻辑部分，浏览器合同在
      `tests/browser/playback.browser.mjs` 与 `tests/browser/playground-playback.browser.mjs`；
      而 `tests/sankey.test.mjs` 里仍有若干播放相关断言与桑基自身的序列高度纠缠在一起（SANKEY-23 那组），
      拆不干净是因为那组本来就是桑基的外框规则，只是顺带用到了播放序列。
- [ ] **CSS 类名仍是 `.chart-playback__*`**：本次只搬文件与规范，没有连类名一起改——
      类名改动会同时波及三个面、三主题覆盖与多份浏览器合同的选择器，风险与收益不成比例。
      若将来要改，须与选择器、合同一次性同步。
