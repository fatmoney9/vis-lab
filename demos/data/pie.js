/*
 * L3 · 饼环示例数据：扇区名，以及全族共用的超长名称夹具（数据场景「超长名称」用，见 demos/scenarios.js）。
 * 由 demos/examples.js 统一转出；只装数据与纯函数，不 import d3、不碰 DOM。
 */

/* 饼 / 环扇区名：8 个业务名循环，超出加序号后缀（多扇区时压图例换行与色板循环） */
export const SLICE_NAMES = ['主营业务', '投资收益', '其他业务', '政府补助', '资产处置', '公允价值变动', '汇兑损益', '营业外收入'];

/* 饼 / 环扇区：递减占比的正值序列（固定公式、无随机数，保证截图可复现）。
   默认示例**全部为正**：0 / null 不画扇区却仍占取色槽位（PIE-01 绘制序 = 声明序 = 图例序），
   放在默认示例里会让环上的颜色跳一格（如蓝、橙、黄，中间少了青），看起来像色板顺序错了。
   这类边界交给 playground 的「数据场景」旋钮（demos/scenarios.js）。 */
const sliceName = (i) => (i < SLICE_NAMES.length
  ? SLICE_NAMES[i]
  : `${SLICE_NAMES[i % SLICE_NAMES.length]}${Math.floor(i / SLICE_NAMES.length) + 1}`);
const sliceValue = (i) => Math.round(1200 / (i + 1.6) + 120);

export const sliceItems = (n) => Array.from({ length: n }, (_, i) => ({ name: sliceName(i), value: sliceValue(i) }));

/* ── 超长名称夹具（全族共用）──────────────────────────────────
   边界与极端情况已改为 playground 的全局「数据场景」旋钮（demos/scenarios.js），对任何一张图生效；
   这里只留各族都要用的真实超长名。 */

/* 真实业务里会出现的超长财务科目名（不是「aaaa…」这种假串——假串量出来的宽度不真实） */
export const LONG_NAMES = [
  '归属于母公司所有者的净利润扣除非经常性损益后',
  '经营活动产生的现金流量净额',
  '可供出售金融资产公允价值变动损益',
  '以摊余成本计量的金融资产终止确认收益',
  '对联营企业和合营企业的投资收益',
  '递延所得税资产',
  '短名',
];
