/*
 * cartesian/series.js —— 【系列归一化】 · [L2-LOCAL] 图表专属，有意不下沉 L1
 *
 * 干什么：把使用方传入的「原始系列」（只有 name/data，type/axis 可省）补齐成统一的
 * 「resolved 系列」——填默认 type='bar'、axis='primary'，并带上声明序号 seriesIndex
 * 与配色 CSS 变量名 colorVar。
 *
 * 为什么单独一处：这是**默认值的唯一落点**。下游（index/domain/layout）一律读 resolved
 * 的字段（r.type / r.axis），不再各处散落 `?? 'bar'`——加旋钮取值只改这里。
 * 纯函数，不碰 DOM / 比例尺 / token。
 */
export function resolveSeries(series) {
  return series.map((s, i) => ({
    name: s.name,
    data: s.data,
    type: s.type ?? 'bar',      /* ② 旋钮：图元类型 */
    axis: s.axis ?? 'primary',  /* ③ 旋钮：绑哪根 Y */
    area: s.area ?? false,      /* 主线渐变面积装饰（可开启配置，仅 type:line 生效，specs/line.md） */
    seriesIndex: i,             /* 声明序号（配色/槽位按它，隐藏不重排） */
    colorVar: `--dv-series-${i + 1}`,
  }));
}
