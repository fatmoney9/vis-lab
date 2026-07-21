# 颜色 · 系列取色规范（条目化索引）

> 权威源：各主题设计稿的「色板」章节（THS / iFinD-PC / Ainvest 各一套）。
> 本页职责：给每条规则一个稳定 ID + 指向实现位置，供代码注释回引与修订检索。
> 适用范围：所有图表的**数据系列色**（柱 / 折线 / 饼扇区 / 散点 …）。
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

## 样式 token / 数据边界

- **系列色**（本篇）：`tokens/palette.json`（写死 hex，不入 tokens.css）→ `core/palette.js` 取色 → L2 写成 `--dv-series-i`（host 上）→ 柱 / 图例 marker 用 `currentColor` / `var(--dv-series-i)`。
- **元素色**：值 token，走 `tokens/*.json` → `tokens.css`（明暗分叉、作用域化），见 axes / legend / tooltip 各篇。

## 待办

- [x] COLOR-05 折柱组合柱/线子序列 → `line-multi` 落地（iFinD 用 7 色浅盘避撞）。
- [ ] **THS「按系列数量整取第 N 行」基础表**（当前多系列用末行固定第 N 色，覆盖分组柱；基础表用于基础柱等场景，届时给 palette.json 加 `by-count` 结构 + resolver 加模式）。
- [ ] **Ainvest 动态条形图 16 色**（序列 8 + 浅色变体 8，按序号循环）。
- [x] **标准多折线图**（非组合）的折线色板：**决定不设独立色板**——纯折线走通用 `bar-multi`（COLOR-05 补充），`line-multi` 仅保留为折柱组合子序列（原设想的 `line-standard` 独立序列不再需要）。
