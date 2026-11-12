/*
 * L3 · 饼环示例数据：扇区名，以及边界用例（超长名称、极端占比）的数据。
 * 由 demos/examples.js 统一转出；只装数据与纯函数，不 import d3、不碰 DOM。
 */

/* 饼 / 环扇区名：8 个业务名循环，超出加序号后缀（多扇区时压图例换行与色板循环） */
export const SLICE_NAMES = ['主营业务', '投资收益', '其他业务', '政府补助', '资产处置', '公允价值变动', '汇兑损益', '营业外收入'];

/* 饼 / 环扇区：递减占比的正值序列（固定公式、无随机数，保证截图可复现）。
   0 与 null 的位置对齐 signedWave 的先例——[PIE-01] 两者都**不占角也不进分母**，
   故 n=4 时可见 3 个扇区、n=16 时可见 14 个。 */
export const sliceItems = (n) => {
  const values = Array.from({ length: n }, (_, i) => Math.round(1200 / (i + 1.6) + 120));
  if (n > 2) values[2] = 0;
  if (n > 4) values[4] = null;
  return values.map((value, i) => ({
    name: i < SLICE_NAMES.length
      ? SLICE_NAMES[i]
      : `${SLICE_NAMES[i % SLICE_NAMES.length]}${Math.floor(i / SLICE_NAMES.length) + 1}`,
    value,
  }));
};

/* ── 边界与极端情况的数据（playground 专用）────────────────────
   这些不是「好看的示例」，是**把规则推到边界上**的夹具：长名称压截断、极端占比压窄扇区、
   单项压单系列取色、全空压不抛错。放 demos 而不是各写各的一次性页面，理由同 WORKFLOW §三——
   各预览面共享同一份数据源，验收用例也就只有一份。 */

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

/* 超长名称 + 大数值：压 PIE-16 名称截断、LEGEND-13 图例截断，以及「数值段恒完整」 */
export const longNameItems = (n) => Array.from({ length: n }, (_, i) => ({
  name: `${LONG_NAMES[i % LONG_NAMES.length]}${i >= LONG_NAMES.length ? Math.floor(i / LONG_NAMES.length) + 1 : ''}`,
  value: Math.round(987654321 / (i + 1.3)),
}));

/* 极端占比：首项独占约 98%，其余是几乎看不见的窄扇区 */
export const skewItems = (n) => Array.from({ length: n }, (_, i) => ({
  name: i === 0 ? '主营业务' : `${SLICE_NAMES[i % SLICE_NAMES.length]}${i}`,
  value: i === 0 ? 98000 : Math.max(1, Math.round(60 / i)),
}));
