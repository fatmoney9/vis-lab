# 数值格式（Format）

> 数值显示格式**随主题分化**，且跨组件共用：坐标轴标签、tooltip 数值、柱顶数据标签
> 用的是同一套格式化。参数经 `tokens/behavior.json` 的 `number-format` 键下发，
> 实现在 `charts/core/format.js`（L1），消费方一律通过 `makeFormatter()` 获得格式化函数。

## FORMAT-01 · 主题数值格式

| 主题 | system | 规则 | 示例 |
|---|---|---|---|
| THS | `cn` | 中文单位换算：**万（1e4）/ 千万（1e7）/ 亿（1e8）/ 兆（1e12）**（无"百万"档）；从 1 万起换算；换算后最多 **2 位小数**（去尾零）；整数部分最多 4 位由单位阶梯保证；1 万以下原值；**全程不加千分位** | 9999 · 82万 · 500万 · 2.5千万 · 9999.99亿 · 2兆 |
| iFinD-PC | `plain` | **占位待定**（后期补充规则后修订本行），当前千分位 + 最多 2 位小数 | 820,000 |
| Ainvest | `en` | 北美缩写：**K（1e3）/ M（1e6）/ B（1e9）/ T（1e12）**；**从 10K（1e4）起缩写**，以下千分位原值；最多 **1 位小数**（去尾零） | 9,999 · 10K · 12.5K · 1M · 2.5B · 3T |

通用规则（全主题）：

- 负值：对绝对值应用规则后加负号（-34万 / -12.5K）
- 0 → `0`；null/NaN → `—`（无数据占位，与 0 值语义区分）
- 去尾零：12.0K → 12K，2.50百万 → 2.5百万

## 参数下发（behavior.json）

```json
"number-format": { "system": "cn | en | plain", "max-decimals": 2, "min-abbr": 10000 }
```

- `system`：单位体系；`max-decimals`：换算后最多小数位；`min-abbr`：缩写起始阈值（en 用）
- 整个对象可按端分叉：`{ "mobile": {...}, "pc": {...} }`
- 键受 behavior 合同校验约束：任一主题缺 `number-format` 即加载报错

## 待办

- [ ] iFinD-PC 正式规则（当前 plain 占位）
- [x] tooltip 已通过 `makeFormatter()` 接入同一格式化（`core/tooltip.js` 由 L2 传入格式化后的值）
- [x] 数据标签已通过 `makeFormatter()` 接入同一格式化（[data-label.md](data-label.md) LABEL-07，L2 传入格式化后的文本；归一堆叠强开时走百分比格式）
- [x] 轴标签列宽策略与本规范联动 → 已定为一次性渲染测量、精确贴合（specs/axes.md · AXIS-08），不固定宽度
