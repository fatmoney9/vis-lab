/*
 * L3 · 图表类型注册表：示例声明的 `chart` 字段 → L2 组件。
 *
 * 为什么单独一处：两个预览面（index.html / playground）都按类型键查表挂载，
 * 新增图表类型只在这里加一行，两面自动支持——面里不出现任何 `if (chart === …)`。
 *
 * 依赖方向 L3 → L2（WORKFLOW §三）。示例数据在 examples.js，本文件只管「谁来画」。
 *
 * 新增一种图表（饼 / 环 / 横向条形 / K 线…）：
 *   1. import 它的 L2 组件
 *   2. 在 CHARTS 里登记类型键
 *   3. examples.js 的 CHART_CAPABILITIES 声明它支持哪些语义旋钮 + 加示例
 */
import { CartesianChart } from '../charts/charts/cartesian/index.js';
import { PieChart } from '../charts/charts/pie/index.js';
import { SankeyChart } from '../charts/charts/sankey/index.js';
import { buildConfig } from './examples.js';

export const CHARTS = {
  cartesian: CartesianChart,
  pie: PieChart, /* 饼 + 环（variant 旋钮分形态，见 specs/pie.md） */
  sankey: SankeyChart,
};

/*
 * 挂载一个示例：按 chart 查组件、用共用装配器算 cfg（铁律3：面不自己拼配置）。
 * 返回 { instance, cfg } —— cfg 供「逻辑」面板原样展示，保证展示的和真正传进去的是同一份。
 * 未登记的类型抛错而不是静默跳过：漏登记要当场看见。
 */
export function mountExample(host, example, state) {
  const Chart = CHARTS[example.chart];
  if (!Chart) throw new Error(`registry：示例「${example.id}」声明的图表类型 ${example.chart} 未登记`);
  const cfg = buildConfig(example, state);
  return { instance: Chart(host, cfg), cfg };
}
