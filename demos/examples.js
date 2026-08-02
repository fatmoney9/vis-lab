/*
 * L3 · 示例数据源（唯一权威）。
 *
 * 两个预览面共享本模块，各自只负责「怎么展示」：
 *   index.html               对外站点：画廊 + 详情页、单主题切换
 *   playground/preview.html  开发验收：三主题横向并排、旋钮更全
 * 示例定义与数据生成函数只有这一份——加示例改一处，两面同时生效，不会漂移。
 *
 * 本模块**只装数据**：不 import d3、不 import 图表组件、不碰 DOM
 * （组件在 registry.js 里映射，见 WORKFLOW 铁律6：L3 永不直接 import d3）。
 *
 * ── 加一个新示例 ────────────────────────────────────────────────
 * 往 EXAMPLES 里加一项即可。必填 id / group / chart / title / spec / description / cfg；
 * surfaces 决定它出现在哪个面（缺省两面都进）；notes 是开发验收要点（只有 playground 显示）。
 *
 * ── 加一种新图表（饼 / 环 / 横向条形 / K 线…）──────────────────
 *   1. 在 registry.js 的 CHARTS 里登记「类型键 → L2 组件」（一行）
 *   2. 在 CHART_CAPABILITIES 里声明该类型支持哪些语义旋钮（决定两面各自显示哪几个开关）
 *   3. 往 EXAMPLES 里加示例，chart 写成新类型键
 * 两个预览面都不用改——它们按 chart 字段查表挂载、按能力声明画旋钮。
 */

/* ── 数据生成（示例专用假数据；固定公式、无随机数与当前时间，保证截图可复现）── */

const K = (values) => values.map((v) => (v == null ? null : v * 1000));

export const seq = (n) => Array.from({ length: n }, (_, i) => `${i + 1}`);

/* 基础波形：相位 p 让多系列彼此错开 */
export const wave = (n, p = 0) => K(Array.from(
  { length: n },
  (_, i) => Math.round(560 + 360 * Math.sin(i * 0.6 + p) + 140 * Math.cos(i * 1.7 + p)),
));

/* 含负值 / 0 / null 的单系列（基础柱专用：负值向下、0 值 1px 占位、null 断口全可见） */
export const signedWave = (n) => {
  const d = wave(n, 0.8).map((v) => v - 500000);
  if (n > 2) d[2] = 0;
  if (n > 4) d[4] = null;
  return d;
};

/* 多系列正值波形：按序相移 */
export const posSeries = (n, names) => names.map((name, k) => ({ name, data: wave(n, k * 0.9) }));

/* 负值系列（堆叠含负值用） */
export const negWave = (n) => wave(n, 2).map((v) => -Math.round(v * 0.4));

/* 折线：中途一个 null 断口；多数据（>13 点）整体下移、含负值区 */
export const lineWave = (n) => {
  const d = wave(n, 0.4).map((v) => (n > 13 ? v - 500000 : v));
  d[Math.floor(n / 3)] = null;
  return d;
};

/* 副轴增速（%）：小数量级、与柱不同量纲 */
export const growth = (n) => Array.from({ length: n }, (_, i) => Math.round(12 + 9 * Math.sin(i * 0.5)));

/* 饼 / 环扇区名：8 个业务名循环，超出加序号后缀（多扇区时压图例换行与色板循环） */
const SLICE_NAMES = ['主营业务', '投资收益', '其他业务', '政府补助', '资产处置', '公允价值变动', '汇兑损益', '营业外收入'];

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

/* ── 两面共用的展示维度 ──────────────────────────────────────── */

export const THEMES = [
  { id: 'ths', label: 'THS 同花顺', dot: '#3366FF' },
  { id: 'ifind-pc', label: 'iFinD PC', dot: '#4D5999' },
  { id: 'ainvest', label: 'Ainvest', dot: '#265FFC' },
];

/* 数据密度 = 传给 cfg 的类目数（cfg 是 n 的函数，故新图表可自行解释「一个类目」的含义） */
export const DENSITY = { few: 4, mid: 16, many: 36 };

export const INITIAL_ZOOM = { start: 0.35, end: 1 };

/*
 * 各图表类型支持哪些**语义旋钮**（≠ 样式参数，样式一律走 token）。
 * 预览面据此决定显示哪几个开关——新图表在这里声明，两面自动适配。
 *   zoom      缩放轴（DATAZOOM-01..07，需要类目轴）
 *   area      主线渐变面积（仅非堆叠且含折线的 cartesian 配置，见 supportsArea）
 *   dataLabel 数据标签三态（LABEL-05）
 *   axisTitle 轴标题开关（AXISTITLE-01，默认不显示；开时注入 { y, y2, x } 文案）
 *   animation 入场生长开关（MOTION-01/07，**默认开**——与其他旋钮相反，关掉才落进 cfg）
 */
export const CHART_CAPABILITIES = {
  cartesian: { zoom: true, area: true, dataLabel: true, axisTitle: true, animation: true },
  /* 饼 / 环无类目轴、无 Y 轴、无折线：zoom / area / axisTitle 一概不声明，
     两个预览面的对应旋钮据此自动不出现（见 specs/pie.md 活 demo 的验收点）。
     legend 是本族专属旋钮（PIE-09 的左右 / 上下两种结构），cartesian 不声明。 */
  pie: { dataLabel: true, animation: true, legend: true },
};

/* [AXISTITLE-01] 轴标题旋钮打开时注入的通用文案；示例可用自己的 axisTitle 字段覆盖（给更贴切的文案）。
   文案是内容不是样式——两面共用这一份，避免各写各的。
   **y2 是否落进最终 cfg 由 buildConfig 按图表形态实判**（见那里的注释），不靠逐示例记得写。 */
export const AXIS_TITLES = { y: '单位：元', y2: '副轴', x: '交易日' };

/* ── 示例清单 ────────────────────────────────────────────────── */

const BOTH = ['index', 'playground'];

export const EXAMPLES = [
  {
    id: 'basic', group: '柱状图', chart: 'cartesian',
    title: '基础柱状图', spec: 'BAR-01 / BAR-03', surfaces: BOTH,
    description: '单系列柱状图，覆盖正负值、0 值占位与 null 断口。',
    notes: '单系列默认色（THS #3366FF）；含负值向下、0 值 1px 占位、null 断口。数据量↑看单柱容器收缩：step 跌破上限后柱按 2:1 等比收缩保侧白（BAR-03）、X 标签碰撞（AXIS-06）。',
    cfg: (n) => ({ categories: seq(n), series: [{ name: '营业收入', data: signedWave(n) }] }),
  },
  {
    id: 'grouped3', group: '柱状图', chart: 'cartesian',
    title: '三系列分组柱', spec: 'BAR-02', surfaces: BOTH,
    description: '三系列分组排布，系列颜色固定槽位，隐藏后重新居中。',
    notes: '一进多「整套换」：首色应变浅蓝 #52BBFF（≠ 单系列 #3366FF）；各主题按序号取色板。数据量↑看分组容器收缩（BAR-02）。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润']) }),
  },
  {
    id: 'grouped6', group: '柱状图', chart: 'cartesian',
    title: '多系列分组柱', spec: 'BAR-02 / COLOR-04', surfaces: BOTH,
    description: '六系列场景，用于检查色板循环、图例换行与显隐逻辑。',
    notes: '色板循环：点掉几个系列看剩余柱整组重新居中、颜色不重排（各系列色固定不跟随）。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润', '税费', '研发投入', '现金流']) }),
  },
  {
    id: 'stack', group: '堆叠图', chart: 'cartesian',
    title: '普通堆叠柱', spec: 'BAR-05', surfaces: BOTH,
    description: '正值逐段累计，段间直角，仅整根堆叠外端保留主题圆角。',
    notes: '段间直角、只最外端圆角（THS，正向最上/负向最下）；点掉一个系列看堆叠闭合、轴 refit。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润']), stack: 'normal' }),
  },
  {
    id: 'stackNeg', group: '堆叠图', chart: 'cartesian',
    title: '正负堆叠柱', spec: 'BAR-05', surfaces: BOTH,
    description: '正值向上累计、负值向下累计，分别闭合。',
    notes: '正值向上累计、负值向下累计（分开）。',
    cfg: (n) => ({
      categories: seq(n), stack: 'normal',
      series: [...posSeries(n, ['主营利润', '投资收益']), { name: '净亏损项', data: negWave(n) }],
    }),
  },
  {
    id: 'percent', group: '堆叠图', chart: 'cartesian',
    title: '归一化堆叠柱', spec: 'BAR-06', surfaces: BOTH,
    description: '每个类目归一到 100%，隐藏系列后占比重新计算。',
    notes: '每类目顶到 100%、Y 轴 0–100%；点掉系列看占比重算。数据标签默认不出（LABEL-05），开「全开」可看百分比标签。',
    cfg: (n) => ({ categories: seq(n), series: posSeries(n, ['营业收入', '成本', '利润']), stack: 'percent' }),
  },
  {
    id: 'line', group: '折线图', chart: 'cartesian',
    title: '基础折线图', spec: 'LINE-01', surfaces: BOTH,
    description: '折线直连，null 处断开；数据点显隐随密度分档。',
    notes: '数据点显隐分档（移动/PC 一致）：≤13 点常显（少）、>13 全隐（中/多），线仍连续；null 断口不强连。点留 DOM（data-i），hover 十字准星唤出最近点归 tooltip 切片。数据标签 >5 个类目整体不出（LABEL-06①）。',
    cfg: (n) => ({ categories: seq(n), series: [{ name: '指数', data: lineWave(n), type: 'line' }] }),
  },
  {
    id: 'line-multi', group: '折线图', chart: 'cartesian',
    title: '多折线图', spec: 'LINE-01 / COLOR-05', surfaces: BOTH,
    description: '主线保持标准线宽，其余线使用多折线细线 token。',
    notes: '声明 ≥2 条线：主线（首条声明线）保持 size-line-stroke（THS 1.5），其余线切 size-line-stroke-multi（THS 1）；纯折线走通用 bar-multi 色板（THS 首色浅蓝 #52BBFF，与分组柱同序）——line-multi 仅折柱组合用（COLOR-05）。点显隐分档同样生效。',
    cfg: (n) => ({
      categories: seq(n),
      series: posSeries(n, ['沪深300', '中证500', '创业板指']).map((s) => ({ ...s, type: 'line' })),
    }),
  },
  {
    id: 'line-stack', group: '折线图', chart: 'cartesian',
    title: '堆叠折线图', spec: 'LINE-01', surfaces: BOTH,
    description: '折线沿累计基线绘制，并在折线与基线之间填充同色区域。',
    notes: '线沿可见线累计基线绘制（线堆线，复用 stackBars 同一份累计）；每系列在线与其基线间填同色 0.2 填充带（opacity-line-stack-fill）；值域 = 累计总高；点掉系列看堆叠闭合、轴 refit。',
    cfg: (n) => ({
      categories: seq(n), stack: 'normal',
      series: posSeries(n, ['沪深300', '中证500', '创业板指']).map((s) => ({ ...s, type: 'line' })),
    }),
  },
  {
    id: 'combo', group: '组合图', chart: 'cartesian',
    title: '折柱组合 · 双 Y', spec: 'BAR-07 / SCALE-04', surfaces: BOTH,
    description: '柱走主轴、线走副轴，两轴共享网格并保持 0 轴对齐。',
    notes: '柱走主轴、线走副轴；两轴 0 对齐、刻度落同网格行。图例按真实 type 显方块/折线 marker。数据量中/多时副轴折线点也进入 >13 全隐档。两根柱=分组，故柱也不出数据标签。开轴标题：这是**真·双量纲**（声明了副轴），故三主题反侧都出 y2「增速（%）」（AXISTITLE-03）。对照基础柱状图在 iFinD-PC 上：反侧只是主轴镜像标签、没有第二根轴，那里就不出标题。',
    axisTitle: { y: '单位：元', y2: '增速（%）', x: '交易日' },
    cfg: (n) => ({
      categories: seq(n),
      series: [
        { name: '营业收入', data: wave(n), type: 'bar', axis: 'primary' },
        { name: '成本', data: wave(n, 0.9), type: 'bar', axis: 'primary' },
        { name: '营收增速', data: growth(n), type: 'line', axis: 'secondary' },
      ],
    }),
  },
  {
    id: 'combo-single', group: '组合图', chart: 'cartesian',
    title: '折柱组合 · 单柱 + 线', spec: 'BAR-07 / LABEL-05', surfaces: BOTH,
    description: '一柱一线的组合，数据标签只跟柱走。',
    notes: '一柱一线的组合：数据标签只跟柱走——柱是「一个类目一个值」故默认出标签，折线在有柱在场时不出（LABEL-05）。对比上一项（两柱=分组，柱也不出标签）。轴标题同样是真·双量纲，反侧出 y2「增速（%）」。',
    axisTitle: { y: '单位：元', y2: '增速（%）', x: '交易日' },
    cfg: (n) => ({
      categories: seq(n),
      series: [
        { name: '营业收入', data: wave(n), type: 'bar', axis: 'primary' },
        { name: '营收增速', data: growth(n), type: 'line', axis: 'secondary' },
      ],
    }),
  },
  {
    id: 'donut', group: '饼图与环形图', chart: 'pie',
    title: '环形图', spec: 'PIE-01 / PIE-02', surfaces: BOTH,
    description: '中空环形占比图，扇区按声明序固定取色，隐藏后重新闭合 360°。',
    notes: '**图例布局走组件默认「左右结构」**（PIE-09）：图左、图例右纵向单列，图与图例间距 24px（spacing-legend-chart-gap），**两块相邻成组、整组居中**；切旋钮可看「上下结构」。起始 12 点、顺时针；0 值与 null **不占角也不进分母**（PIE-01）——故「少 4」只见 3 个扇区、「中 16」见 14 个。点图例：剩余扇区重算闭合 360°、**颜色一个都不变**（COLOR-04/08 验收点）。hover 扇区：三主题气泡**都走 follow**（对照柱线示例的 THS side-fixed / Ainvest top-anchor，TOOLTIP-07 特例）、无指示线无轴贴片。图例 marker 三主题都是圆点（LEGEND-03）。Ainvest 的环比另两个主题大一圈（半径 80 vs 70，PIE-02）。**数据标签默认不出**（PIE-04 / LABEL-05 的例外——占比看扇形、名称看图例）；切右栏「全开」才画在扇区内，那时数据量↑可看它们按环宽/弧长几何逐个隐去。数据量↑还可看色板循环（THS 7 色到第 8 个扇区回首色）。36 扇区时纵向图例超出高度即**在图例区内滑动**（LEGEND-11），绘图区不受挤压；切到「上下」布局则回到横排换行，那条的溢出（分页器等）仍是 LEGEND-07 待办。拖卡片改尺寸看半径收缩、环宽等比跟随（PIE-02）。',
    cfg: (n) => ({ name: '营收构成', variant: 'donut', items: sliceItems(n) }),
  },
  {
    id: 'pie', group: '饼图与环形图', chart: 'pie',
    title: '饼图', spec: 'PIE-02 / COLOR-08', surfaces: BOTH,
    description: '实心饼图，与环形图同一组件、同一份数据，只差 variant 一个旋钮。',
    notes: '**图例布局与环形图一样走默认「左右结构」**（PIE-09——饼与环的默认相同，不因形态分化）；想看「上下结构」切右栏旋钮，两个示例都能切。数据完全相同，只把 variant 切成 pie（内半径 0）——变体不按名字分体，是取值组合（同 bar.md 先例）。数据标签同样默认不出；切「全开」后可见实心饼的径向厚度 = R，扇区内标签的可用宽比环形宽松（PIE-04 的 maxWidth 取「弧长 vs 径向厚度」较小者），同样数据下饼比环能多留住几个标签。入场同样是自 12 点顺时针扫掠（PIE-06），与同页柱线卡片同时起跑同时到达。',
    cfg: (n) => ({ name: '营收构成', variant: 'pie', items: sliceItems(n) }),
  },
];

/* ── 查询与配置装配（两面共用，避免各写一份而漂移）──────────── */

/* 某个面要展示的示例（surfaces 缺省 = 两面都进） */
export const examplesFor = (surface) =>
  EXAMPLES.filter((e) => (e.surfaces ?? BOTH).includes(surface));

/* 该面示例的分组名（按 EXAMPLES 声明序，自动去重） */
export const groupsFor = (surface) => [...new Set(examplesFor(surface).map((e) => e.group))];

/* 渐变面积只对「非堆叠且含折线」的配置有意义——按 cfg 实际形态判，不是按图表类型 */
export const supportsArea = (example) => {
  if (!CHART_CAPABILITIES[example.chart]?.area) return false;
  const cfg = example.cfg(4);
  return cfg.stack == null && cfg.series.some((s) => s.type === 'line');
};

/* 该示例实际可用的旋钮（图表类型能力 ∩ 本示例配置形态） */
export const capabilitiesOf = (example) => {
  const caps = CHART_CAPABILITIES[example.chart] ?? {};
  return {
    zoom: !!caps.zoom, dataLabel: !!caps.dataLabel, axisTitle: !!caps.axisTitle,
    animation: !!caps.animation, area: supportsArea(example), legend: !!caps.legend,
  };
};

/*
 * 示例 + 当前旋钮状态 → 传给 L2 组件的最终配置。
 * 铁律3/4：只装配**数据与语义配置**，样式一律走 token；预览面不得在此之外自加参数。
 *   state = { density='few', platform='pc', zoom, area, dataLabel, axisTitle, animation } —— 各项皆可缺省
 * 主题与明暗不进 cfg：它们写在容器的 data-theme / data-mode 上，走 CSS 级联 + behavior 解析。
 */
export function buildConfig(example, state = {}) {
  const {
    density = 'few', platform = 'pc', zoom = false, area = false,
    dataLabel = 'auto', axisTitle = false, animation = true, legend = 'auto',
  } = state;
  const caps = capabilitiesOf(example);
  const cfg = { ...example.cfg(DENSITY[density] ?? DENSITY.few), platform };

  if (caps.zoom && zoom) cfg.zoom = { ...INITIAL_ZOOM };
  /* [AXISTITLE-01/03] 默认不显示；旋钮打开才注入文案（示例自带的 axisTitle 优先，可给更贴切的措辞）。
     **y2 按 cfg 的实际形态判、不按示例记得没记得写**（同 supportsArea 的做法）：
     真·双量纲才留 y2、否则删掉。两个方向都兜住——双 Y 示例漏写 y2 不会静默丢标题，
     非双 Y 示例误写 y2 也不会混进 cfg（组件侧 showY2Title 还有一道，但预览面的
     「逻辑」面板直接展示这份 cfg，展示的必须就是真正生效的）。 */
  if (caps.axisTitle && axisTitle) {
    const titles = { ...(example.axisTitle ?? AXIS_TITLES) };
    if (!cfg.series.some((s) => s.axis === 'secondary')) delete titles.y2;
    cfg.axisTitle = titles;
  }
  if (caps.area && area) {
    const mainLine = cfg.series.find((s) => s.type === 'line');
    if (mainLine) mainLine.area = true;
  }
  if (caps.dataLabel && dataLabel !== 'auto') cfg.dataLabel = dataLabel === true || dataLabel === 'on';
  /* [PIE-09] 图例布局：'auto' = 用示例自己声明的（两个示例各展一种，不动旋钮就能同屏对比）；
     旋钮给了具体值才覆盖。示例没声明也不写进 cfg —— 让组件默认（'right'）说话。 */
  if (caps.legend && legend !== 'auto') cfg.legend = legend;
  /* [MOTION-07] 组件默认就播，故只有**关**才落进 cfg——「逻辑」面板里 cfg 无 animation = 走默认（开）。
     与 zoom / axisTitle「有才开」的方向相反，这里是「有才关」。 */
  if (caps.animation && animation === false) cfg.animation = false;
  return cfg;
}

/*
 * 数组字段的展示摘要：长数组或原始值数组折成 `Array(n)`，短对象数组保留但去掉数组字段
 * （series 的 data 一折就是几十个数字，刷屏且无信息）。
 * **按值的形状判，不按字段名判**——故 cartesian 的 series 与饼环的 items 走同一条规则，
 * 面里和这里都不出现 `if (chart === …)`。
 */
const briefValue = (v) => {
  if (!Array.isArray(v)) return v;
  if (v.length > 6 || v.some((x) => x == null || typeof x !== 'object')) return `Array(${v.length})`;
  return v.map((o) => Object.fromEntries(Object.entries(o).filter(([, x]) => !Array.isArray(x))));
};

/*
 * 「逻辑」面板要展示的配置摘要。**内部调的就是同一个 buildConfig**，
 * 保证展示的和真正传进组件的是同一份（examples.js 上方注释里的承诺）。
 * 因此这里**不补任何默认值**：cfg 里没有 stack / animation 就是「走组件默认」，
 * 面板照实不显示——比印一个 `stack: 'none'` 更接近真相（那个值组件里才产生）。
 * 主题 / 明暗不在此：它们不进 cfg，走容器的 data-* 属性 + CSS 级联。
 */
export function describeConfig(example, state = {}) {
  return Object.fromEntries(
    Object.entries(buildConfig(example, state)).map(([k, v]) => [k, briefValue(v)]),
  );
}
