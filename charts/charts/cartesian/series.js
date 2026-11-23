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
/* [EARNINGS-05/06] 财报点的三个行名（图例 / tooltip）是**内容**，同系列名一样由配置给、由 L3 翻译；
   组件不留缺省文案——留了就是一份翻译够不着的中文（Ainvest 会漏）。缺了当场报错。 */
function earningsLabels(s) {
  const l = s.labels ?? {};
  for (const k of ['actual', 'estimate', 'diff']) {
    if (typeof l[k] !== 'string' || !l[k]) {
      throw new Error(`CartesianChart：财报系列「${s.name}」缺 labels.${k}（图例 / tooltip 行名由配置提供）`);
    }
  }
  return { actual: l.actual, estimate: l.estimate, diff: l.diff };
}

export function resolveSeries(series) {
  return series.map((s, i) => ({
    name: s.name,
    data: s.data,
    type: s.type ?? 'bar',      /* ② 旋钮：图元类型 */
    axis: s.axis ?? 'primary',  /* ③ 旋钮：绑哪根 Y */
    area: s.area ?? false,      /* 主线渐变面积装饰（可开启配置，仅 type:line 生效，specs/line.md） */
    /* [EARNINGS-01] type:'earnings' 时 data 为 [{ actual, estimate }]；labels 是图例 / tooltip 行名
       （文案即内容，由配置给，L3 负责翻译） */
    ...(s.type === 'earnings' ? { labels: earningsLabels(s) } : {}), /* 普通系列不带这个键，归一化结果与原来逐字段相同 */
    seriesIndex: i,             /* 声明序号（配色/槽位按它，隐藏不重排） */
    colorVar: `--dv-series-${i + 1}`,
  }));
}
