# 颜色 · 系列取色规范（条目化索引）

> 权威源：各主题设计稿的「色板」章节（THS / iFinD-PC / Ainvest 各一套）。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：所有图表的**数据系列色**（柱 / 折线 / 饼扇区 / 散点 …）。饼环的扇区取色见 COLOR-08
> ——取色单位是扇区而非系列，但走的仍是这里的同一套色板与同一个取色器。
> **元素色**（网格线、文字、tooltip、涨跌语义色等）不在此篇——它们是值 token，见 [tokens 的 README](../tokens/README.md)。

## 系列色为什么独立于 token

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| COLOR-01 | **系列色是第三类主题数据，不进 tokens.css**：一律写死 hex、不走值 token；**light / dark 同色、无深色派生**；整套替换、绝不跨主题混用。原因：取色是**算法**（依赖图型 / 系列数 / 序号 / 柱线归属），CSS 变量表达不了；且设计源明确"写死 hex"。数据在 `tokens/palette.json`，取色器在 `charts/core/palette.js`（`build.mjs` 不读 palette.json，故不会被输出为 CSS 变量） | `tokens/palette.json` + `core/palette.js` | ✅ |
| COLOR-07 | **禁止引入色板外颜色**作为系列色（组件源码无 hex 字面量——hex 只在 palette.json；组件里只有 `currentColor` / `var(--dv-series-i)`） | 当前由约定与 review 保证；自动 token lint 见 `WORKFLOW.md` 待办 | ⚠️ 规则已满足，自动门禁待接入 |
| COLOR-06 | **涨跌色不在系列色板内**，走值 token `color-price-up` / `color-price-down`（红绿柱、盒须、K 线等语义色） | `tokens/*.json` | ✅ |

## 取色规则

| ID | 规则 | 实现 | 状态 |
|---|---|---|---|
| COLOR-02 | **按主题取色**（主题差异只在数据、取色器主题无关）：单系列 → `single-default`；多系列 → 该主题色板**按序号取、超出循环**。Ainvest（8 色）/ iFinD（24 色）本就按序号；**THS 多系列柱**取"末行固定第 N 色"前 N（`bar-multi`），与单系列不同色——"整套换"非"序号叠加" | `core/palette.js` → `resolveSeriesColors(host, { series })` | ✅ |
| COLOR-03 | **单系列默认色**：THS `#3366FF` · iFinD-PC `#4D5999` · Ainvest `#265FFC`。基础图单系列即用它，不进多系列色板序号 | `palette.json` 各主题 `single-default` | ✅ |
| COLOR-04 | **颜色跟随实体、不跟随排名**：图例显隐 / 数据过滤**不重排颜色**。取色使用**完整的声明系列列表**，不是当前可见系列——隐藏一个系列不会重新调用取色或改变其余系列的固定槽位 | `CartesianChart` 传入归一化后的 `series`，并按 `seriesIndex` 固定 `--dv-series-i` | ✅ |
| COLOR-05 | **折柱组合柱 / 线各走自己的子序列，禁交叉**（避免撞色）：柱走 `bar-multi`、折线走 `line-multi`（THS 橙灰 / Ainvest 橙灰 / iFinD 7 色浅盘避撞），各按自身类型序号取、互不套用。**`line-multi` 仅在组合（柱线混合声明）中使用**：纯折线（无柱声明）走通用 `bar-multi`——与多系列柱同一套色板按序号取 | `palette.json` 的 `line-multi` + `core/palette.js` 按类型取色（混合判定） | ✅ |
| COLOR-08 | **饼 / 环的扇区按序号占固定槽位**——取色单位是**扇区**而不是系列：一个饼环只有一组数据，但它的每个扇区都是一个独立实体，与「多系列柱的每根柱」同构。故 L2 把 N 个扇区当 N 个取色单位传入：`resolveSeriesColors(host, { series: items.map(() => ({ type: 'pie' })) })` —— 单扇区 → `single-default`（COLOR-03）、多扇区 → **`pie-multi`** 按序号取、超出循环（COLOR-02）。<br>**扇区自成一盘（`pie-multi`）而非借用 `bar-multi`**：饼环把全部槽位同时摆在一个圆里，相邻扇区直接接边、没有柱间距与轴带隔开，需要的色数也远多于分组柱（36 扇区是 demo 常态）——THS 因此在设计稿里给了**独立的 11 色扇区盘**（`#52BBFF` 起，较 `bar-multi` 的 7 色更长、色相分布更匀）。<br>**该键可选、缺省回落 `bar-multi`**：iFinD-PC（24 色）/ Ainvest（8 色）设计稿未另出扇区盘，不声明 `pie-multi` 即沿用通用盘，行为与本条落地前完全一致——「整套换」的边界是主题，不是图型。<br>**取色器只加一条分支**：`type: 'pie'` 走 `pie-multi ?? bar-multi` 的独立序号，与柱 / 线两个计数器互不干扰。<br>**隐藏扇区不重排颜色**（COLOR-04）：图例点掉一个扇区只让剩余扇区重算角度闭合 360°（[pie.md](pie.md) PIE-03），每个扇区的槽位与色值都不动 | `palette.json` 各主题可选 `pie-multi`；`core/palette.js` → `resolveSeriesColors()` 的 pie 分支；`charts/charts/pie/index.js` 按扇区传入 | ✅ |

## 样式 token / 数据边界

- **系列色**（本篇）：`tokens/palette.json`（写死 hex，不入 tokens.css）→ `core/palette.js` 取色 → L2 写成 `--dv-series-i`（host 上）→ 柱 / 图例 marker 用 `currentColor` / `var(--dv-series-i)`。
- **元素色**：值 token，走 `tokens/*.json` → `tokens.css`（明暗分叉、作用域化），见 axes / legend / tooltip 各篇。

## 待办

- [x] COLOR-05 折柱组合柱/线子序列 → `line-multi` 落地（iFinD 用 7 色浅盘避撞）。
- ~~THS「按系列数量整取第 N 行」基础表~~ —— **2026-08-18 撤销，不再计划**：该设想要求「几个系列就整套换一组配色」，但设计源只提供了末行（即现行 `bar-multi`），且其适用场景自相矛盾——原文写「用于基础柱」，而基础柱是单系列、直接走 `single-default`，根本用不到多系列色表；真正的多系列场景（分组柱）现行按序号取已覆盖。要重开需先由设计给出完整表数据**并**明确「哪种柱型用哪张表」。
- [ ] **Ainvest 动态条形图 16 色**（序列 8 + 浅色变体 8，按序号循环）。
- [x] **标准多折线图**（非组合）的折线色板：**决定不设独立色板**——纯折线走通用 `bar-multi`（COLOR-05 补充），`line-multi` 仅保留为折柱组合子序列（原设想的 `line-standard` 独立序列不再需要）。
- [x] **饼 / 环扇区取色** → COLOR-08：扇区即取色单位，按序号取自扇区盘 `pie-multi`（THS 11 色；未声明该盘的主题回落 `bar-multi`）。
- [ ] **iFinD-PC / Ainvest 的扇区盘**：等设计稿出独立 `pie-multi` 再补键，取色器与 spec 均无需再改（COLOR-08 的回落分支已就位）。
