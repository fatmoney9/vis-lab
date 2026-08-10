import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXAMPLES,
  buildConfig,
  capabilitiesOf,
  describeConfig,
  financialSankeyPeriods,
} from '../demos/examples.js';
import { hasSameSankeyTopology } from '../charts/charts/sankey/playback.js';
import { assertSankeyConfig } from '../charts/charts/sankey/layout.js';

/*
 * demos/examples.js 是纯数据 + 配置装配（不 import d3、不碰 DOM），故可被 node 直接加载。
 * 本组守卫防的是**示例声明与图表形态不匹配**这一类静默错误：装配出的 cfg 与示例真实形态
 * 对不上时，预览面不会报错、只会少画点东西（曾漏过：双 Y 示例没写 y2 → 副轴标题静默不出）。
 *
 * 遍历范围一律**按能力过滤，不按「所有示例」**：轴标题只对声明了该能力的图表类型有意义，
 * 无脑遍历会在接入饼环一类无轴图时直接 TypeError（cfg 里既没有 series 也没有 axisTitle）。
 */

const titled = () => EXAMPLES.filter((e) => capabilitiesOf(e).axisTitle);
const isDual = (example) => example.cfg(4).series.some((s) => s.axis === 'secondary');

test('AXISTITLE-01：默认不显示——旋钮不开时 cfg 里没有 axisTitle', () => {
  for (const e of EXAMPLES) {
    assert.equal(buildConfig(e, {}).axisTitle, undefined, `示例「${e.id}」默认不该带 axisTitle`);
  }
});

test('AXISTITLE-03：声明了副轴的示例，开轴标题后必有 y2（漏写由兜底按形态自动补）', () => {
  const duals = titled().filter(isDual);
  assert.ok(duals.length > 0, 'EXAMPLES 里应至少有一个双 Y 示例，否则本守卫形同虚设');
  for (const e of duals) {
    const { axisTitle } = buildConfig(e, { axisTitle: true });
    assert.ok(axisTitle?.y2, `示例「${e.id}」是真·双量纲，但装配出的 axisTitle 缺 y2`);
  }
});

test('AXISTITLE-03：非双量纲示例不带 y2（误写也会被剔掉）', () => {
  for (const e of titled().filter((x) => !isDual(x))) {
    const { axisTitle } = buildConfig(e, { axisTitle: true });
    assert.equal(axisTitle.y2, undefined, `示例「${e.id}」不是双量纲，cfg 不该出现 y2`);
  }
});

/* 动效与其他旋钮方向相反：组件默认就播，故「cfg 里没有 animation」= 开，只有关才落进 cfg。
   写反了不会报错、只会让预览面永远不播（或永远播），是典型的静默错误。 */
test('MOTION-07：默认开——不传旋钮时 cfg 里没有 animation（= 走组件默认）', () => {
  for (const e of EXAMPLES.filter((example) => capabilitiesOf(example).animation)) {
    assert.equal(buildConfig(e, {}).animation, undefined, `示例「${e.id}」默认不该显式带 animation`);
    assert.equal(buildConfig(e, { animation: true }).animation, undefined, `示例「${e.id}」开着时也不必写进 cfg`);
  }
});

test('MOTION-07：关掉时必须显式落进 cfg，否则组件仍会播', () => {
  for (const e of EXAMPLES.filter((example) => capabilitiesOf(example).animation)) {
    assert.equal(buildConfig(e, { animation: false }).animation, false, `示例「${e.id}」关动效没落进 cfg`);
  }
});

test('SANKEY-01：桑基示例使用节点与流向数据，不声明坐标轴或饼环旋钮', () => {
  const sankey = EXAMPLES.find((example) => example.chart === 'sankey');
  assert.ok(sankey, 'EXAMPLES 中应注册桑基图示例');
  assert.deepEqual(capabilitiesOf(sankey), {
    density: false,
    zoom: false,
    dataLabel: false,
    axisTitle: false,
    animation: false,
    area: false,
    legend: false,
    labelLayout: false,
    labelAlign: false,
  });
  const cfg = buildConfig(sankey, { platform: 'mobile', animation: false });
  assert.equal(cfg.platform, 'mobile');
  assert.equal(cfg.animation, undefined);
  assert.equal(cfg.nodes.length, 15);
  assert.equal(cfg.links.length, 14);
});

test('SANKEY-24：主站桑基示例携带八期同拓扑数据，且包含一个亏损季度', () => {
  const sankey = EXAMPLES.find((example) => example.id === 'sankey-financial');
  const periods = financialSankeyPeriods();

  assert.equal(periods.length, 8);
  assert.equal(sankey.playback.periods.length, periods.length);
  assert.equal(new Set(periods.map((period) => period.shortPeriod)).size, periods.length);
  assert.equal(periods.filter((period) => period.statusLabel === '亏损').length, 1);
  assert.ok(periods.find((period) => period.statusLabel === '亏损').links.some((link) => link.value < 0));
  const primaryMagnitudes = periods.map((period) => assertSankeyConfig(period).primary.magnitude);
  const sharedScaleMax = Math.max(...primaryMagnitudes);
  assert.equal(new Set(periods.map((period) => period.scaleMax)).size, 1);
  assert.equal(periods[0].scaleMax, sharedScaleMax);
  periods.forEach((period) => {
    const grossLink = period.links.find((link) => link.target === 'gross');
    assert.equal(period.nodes.length, 15);
    assert.equal(period.links.length, 14);
    assert.equal(grossLink.negativeSource, 'cost');
    assert.equal(hasSameSankeyTopology(periods[0], period), true);
    assert.doesNotThrow(() => assertSankeyConfig(period));
  });

  const lossPeriod = periods.find((period) => period.statusLabel === '亏损');
  const lossGraph = assertSankeyConfig(lossPeriod);
  const revenue = lossGraph.nodes.find((node) => node.id === 'revenue');
  const businessIncome = lossPeriod.links
    .filter((link) => link.target === 'revenue')
    .reduce((sum, link) => sum + link.value, 0);
  assert.equal(businessIncome, 8.92e8);
  assert.equal(revenue.value, businessIncome);
  assert.ok(revenue.magnitude / Math.abs(revenue.value) < 1.02,
    '亏损期毛利绝对值不应让营业收入节点明显大于前方业务收入');
});

test('AXISTITLE-01：主轴与 X 标题恒有文案（兜底或示例自带）', () => {
  for (const e of titled()) {
    const { axisTitle } = buildConfig(e, { axisTitle: true });
    assert.ok(axisTitle.y && axisTitle.x, `示例「${e.id}」开轴标题后 y / x 文案不全`);
  }
});

/*
 * 能力声明是两个预览面「画哪几个旋钮」的唯一依据，也是 buildConfig 装不装某字段的开关。
 * 给无轴图误开一个轴相关能力，面上会冒出一个点了没反应的旋钮、cfg 里会多一个组件不认识的字段——
 * 两者都不报错，故在这里拦。
 */
test('PIE-05/PIE-08：无坐标系图不得声明轴相关能力，旋钮开着也装不进 cfg', () => {
  const axisless = EXAMPLES.filter((e) => e.chart === 'pie');
  assert.ok(axisless.length > 0, 'EXAMPLES 里应至少有一个饼环示例，否则本守卫形同虚设');
  for (const e of axisless) {
    const caps = capabilitiesOf(e);
    assert.equal(caps.zoom, false, `示例「${e.id}」是无类目轴的图，不该声明缩放轴能力`);
    assert.equal(caps.axisTitle, false, `示例「${e.id}」没有轴，不该声明轴标题能力`);
    assert.equal(caps.area, false, `示例「${e.id}」没有折线，不该声明渐变面积能力`);

    const cfg = buildConfig(e, { zoom: true, axisTitle: true, area: true });
    assert.equal(cfg.zoom, undefined, `示例「${e.id}」开缩放轴旋钮不该装进 cfg`);
    assert.equal(cfg.axisTitle, undefined, `示例「${e.id}」开轴标题旋钮不该装进 cfg`);
  }
});

/* [PIE-09] 饼与环的默认布局相同（都是左右结构），且默认由**组件**给——
   示例不显式声明，故 cfg 里不该出现 legend。写进示例不会报错，只会让「默认是什么」
   在两处各说一遍，将来改默认时漏改一处就静默漂移。 */
test('PIE-09：饼环示例不自带 legend——默认布局由组件说了算', () => {
  const pies = EXAMPLES.filter((e) => e.chart === 'pie');
  assert.ok(pies.length > 0, 'EXAMPLES 里应至少有一个饼环示例，否则本守卫形同虚设');
  for (const e of pies) {
    assert.equal(e.cfg(4).legend, undefined, `示例「${e.id}」不该自带 legend（默认走组件的左右结构）`);
    assert.equal(buildConfig(e, {}).legend, undefined, `示例「${e.id}」旋钮为 auto 时不该装进 cfg`);
  }
});

test('PIE-09：旋钮给了具体值才落进 cfg，且只对声明了该能力的图表生效', () => {
  const donut = EXAMPLES.find((e) => e.id === 'donut');
  assert.equal(buildConfig(donut, { legend: 'bottom' }).legend, 'bottom', '旋钮给值应落进 cfg');
  assert.equal(buildConfig(donut, { legend: 'right' }).legend, 'right');
  /* 不支持该能力的图表类型，旋钮给了也不该混进 cfg */
  const bar = EXAMPLES.find((e) => e.id === 'basic');
  assert.equal(buildConfig(bar, { legend: 'bottom' }).legend, undefined, 'cartesian 未声明 legend 能力，不该装进 cfg');
});

/*
 * [PIE-12] 饼环的**显隐与形态合成一个旋钮**（关 / 引线 / 扇区内）——因为引线与标签强绑定，
 * 「显示但没形态」不是合法状态。这组守卫盯的是这个合成没被拆错：
 * 「关」必须什么都不落进 cfg（= 组件默认，LABEL-05 饼环本就不出），另两档必须**同时**给出
 * dataLabel 与 labelLayout。少给 dataLabel 会让组件按默认不画、旋钮点了没反应，且不报错。
 */
test('PIE-12：「关」= 走组件默认，dataLabel 与 labelLayout 一个都不落进 cfg', () => {
  const pies = EXAMPLES.filter((e) => e.chart === 'pie');
  assert.ok(pies.length > 0, 'EXAMPLES 里应至少有一个饼环示例，否则本守卫形同虚设');
  for (const e of pies) {
    assert.equal(e.cfg(4).labelLayout, undefined, `示例「${e.id}」不该自带 labelLayout`);
    for (const state of [{}, { labelLayout: 'off' }]) {
      const cfg = buildConfig(e, state);
      assert.equal(cfg.labelLayout, undefined, `示例「${e.id}」关档不该装 labelLayout`);
      assert.equal(cfg.dataLabel, undefined, `示例「${e.id}」关档不该装 dataLabel`);
      assert.equal(cfg.labelAlign, undefined, `示例「${e.id}」关档不该装 labelAlign`);
    }
  }
});

test('PIE-12：引线 / 扇区内两档都必须同时给出 dataLabel 与 labelLayout', () => {
  const donut = EXAMPLES.find((e) => e.id === 'donut');
  for (const layout of ['outside', 'inside']) {
    const cfg = buildConfig(donut, { labelLayout: layout });
    assert.equal(cfg.dataLabel, true, `${layout} 档缺 dataLabel，组件会按默认不画`);
    assert.equal(cfg.labelLayout, layout);
  }
});

/* [PIE-13] 对齐档只在引线形态下有意义——扇区内时装进 cfg 会给组件一个它用不上的字段，
   且会让「对齐只属于引线档」这条规则在配置里读不出来。 */
test('PIE-13：对齐档只在引线形态下落进 cfg', () => {
  const donut = EXAMPLES.find((e) => e.id === 'donut');
  assert.equal(buildConfig(donut, { labelLayout: 'outside', labelAlign: 'column' }).labelAlign, 'column');
  assert.equal(buildConfig(donut, { labelLayout: 'outside', labelAlign: 'edge' }).labelAlign, 'edge');
  assert.equal(buildConfig(donut, { labelLayout: 'inside', labelAlign: 'edge' }).labelAlign, undefined,
    '扇区内档不该带 labelAlign');
});

test('PIE-12/PIE-13：cartesian 未声明这两个能力，旋钮误给也混不进它的 cfg', () => {
  const bar = EXAMPLES.find((e) => e.id === 'basic');
  const cfg = buildConfig(bar, { labelLayout: 'outside', labelAlign: 'edge' });
  assert.equal(cfg.labelLayout, undefined);
  assert.equal(cfg.labelAlign, undefined);
  /* 且不该被饼环那条分支顺手写上 dataLabel:true——那会把分组柱/堆叠的标签强开出来 */
  assert.equal(cfg.dataLabel, undefined);
});

/* [LABEL-05] 直角坐标系的数据标签旋钮 = 默认 / 强开两档：
   「默认」= 'auto' = 按图表类型默认（单柱出、分组柱与堆叠不出），故**什么都不落进 cfg**；
   「强开」= true = 分组柱与堆叠也画。写反了不会报错，只会让默认渲染悄悄变。
   'off'（全关）仍是组件 API 的合法取值、只是当前旋钮没有这一档，故一并守着不让它退化。 */
test('LABEL-05：数据标签 默认 / 强开 —— 默认不落 cfg、强开落 true', () => {
  const bar = EXAMPLES.find((e) => e.id === 'basic');
  assert.equal(buildConfig(bar, { dataLabel: 'auto' }).dataLabel, undefined, '默认 = 按类型默认，不落 cfg');
  assert.equal(buildConfig(bar, { dataLabel: 'on' }).dataLabel, true, '强开必须落 true');
  assert.equal(buildConfig(bar, { dataLabel: 'off' }).dataLabel, false, '全关仍落 false（API 保留档）');
  /* 饼环不声明 dataLabel 能力：它的显隐归 labelLayout 管，直角系的旋钮值混不进来 */
  const donut = EXAMPLES.find((e) => e.id === 'donut');
  assert.equal(buildConfig(donut, { dataLabel: 'on' }).dataLabel, undefined);
});

/* [PIE-01] 扇区数据的形状守卫：组件按 items[].value 算角度，名字进图例。
   写成 cartesian 的 {name,data} 不会报错，只会让整张图空白。 */
test('PIE-01：饼环示例的 cfg 是 { items:[{name,value}] } 形状', () => {
  for (const e of EXAMPLES.filter((x) => x.chart === 'pie')) {
    const cfg = e.cfg(4);
    assert.ok(Array.isArray(cfg.items), `示例「${e.id}」缺 items 数组`);
    assert.equal(cfg.series, undefined, `示例「${e.id}」不该有 series——扇区不是系列`);
    for (const it of cfg.items) {
      assert.equal(typeof it.name, 'string', `示例「${e.id}」的扇区缺 name`);
      assert.ok('value' in it, `示例「${e.id}」的扇区缺 value`);
    }
  }
});

/*
 * 「逻辑」面板展示的必须就是真正生效的那一份 cfg（examples.js 文件头的承诺）。
 * describeConfig 只做长数组折叠，不得增删字段、不得补默认值——
 * 补一个 cfg 里本来没有的 `stack:'none'` 会让面板说谎（那个默认值是组件里才产生的）。
 */
test('describeConfig：字段集合与 buildConfig 完全一致，不补默认值', () => {
  for (const e of EXAMPLES) {
    const state = { density: 'mid', zoom: true, axisTitle: true, animation: false };
    assert.deepEqual(
      Object.keys(describeConfig(e, state)),
      Object.keys(buildConfig(e, state)),
      `示例「${e.id}」的展示摘要与真实 cfg 字段集合不一致`,
    );
  }
});

test('describeConfig：长数组折成 Array(n)，短对象数组去掉逐点数据', () => {
  const bar = EXAMPLES.find((e) => e.id === 'basic');
  const shown = describeConfig(bar, { density: 'mid' });

  assert.equal(shown.categories, 'Array(16)', 'categories 应折叠');
  assert.deepEqual(shown.series, [{ name: '营业收入' }], 'series 保留但去掉 data');

  const donut = EXAMPLES.find((e) => e.id === 'donut');
  assert.equal(describeConfig(donut, { density: 'many' }).items, 'Array(36)', '多扇区应折叠');
  assert.ok(Array.isArray(describeConfig(donut, { density: 'few' }).items), '少扇区应保留明细');
});
