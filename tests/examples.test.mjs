import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';

import {
  EXAMPLES,
  buildConfig,
  capabilitiesOf,
  defaultDensityCountOf,
  defaultDensityOf,
  densityControlOf,
  densityOptionsOf,
  densitySliderOf,
  describeConfig,
  examplesFor,
  financialSankeyPeriods,
  radarEditableOf,
  radarGridShapeOf,
  radarShapeOf,
  radarAxisLabelLayoutOf,
  treemapHierarchy,
} from '../demos/examples.js';
import { hasSameSankeyTopology } from '../charts/charts/sankey/model.js';
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
    callout: false,
    animation: false,
    area: false,
    legend: false,
    labelLayout: false,
    labelAlign: false,
    /* [LEGEND-06][LEGEND-14] 桑基的图例是静态色卡（renderLegend 不接 onToggle/onHover，
       且标了 role="list"），没有「点击图例发生什么」可言，故此档恒 false。 */
    legendSelect: false,
    /* [TOOLTIP-12] 桑基无 Y 轴，没有「这个高度相当于多少」可言，故恒 false。 */
    yIndicator: false,
    treemapColor: false,
    axisValue: false,
    radarGridShape: false,
    radarShape: false,
    ratingStyle: false,
    ratingBandCount: false,
    axisLabelLayout: false,
    chordVariant: false,
    chordLabelLayout: false,
    radarEditable: false,
    waterfallColor: false,
  });
  const cfg = buildConfig(sankey, { platform: 'mobile', animation: false });
  assert.equal(cfg.platform, 'mobile');
  assert.equal(cfg.animation, undefined);
  assert.equal(cfg.nodes.length, 15);
  assert.equal(cfg.links.length, 14);
});

test('SANKEY-27：共享示例仅在 Ainvest 主题输出英文财报文案', () => {
  const sankey = EXAMPLES.find((example) => example.id === 'sankey-financial');
  const ths = buildConfig(sankey, { theme: 'ths' });
  const ainvest = buildConfig(sankey, { theme: 'ainvest' });

  assert.equal(ths.nodes.find((node) => node.id === 'revenue').name, '营业收入');
  assert.equal(ainvest.nodes.find((node) => node.id === 'revenue').name, 'Revenue');
  assert.deepEqual(ainvest.legendLabels, { income: 'Income', expense: 'Expense', profit: 'Profit' });
  assert.deepEqual(
    ainvest.nodes.map((node) => node.id),
    ths.nodes.map((node) => node.id),
  );
  assert.deepEqual(ainvest.links, ths.links);
});

test('Ainvest：所有图表族的最终示例配置均使用英文内容，其他主题保持中文', () => {
  const cjk = /[\u3400-\u9fff]/u;
  const collectCjk = (value, path = 'cfg', found = []) => {
    if (typeof value === 'string' && cjk.test(value)) found.push(`${path}=${value}`);
    else if (Array.isArray(value)) value.forEach((item, index) => collectCjk(item, `${path}[${index}]`, found));
    else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => collectCjk(item, `${path}.${key}`, found));
    }
    return found;
  };

  for (const example of EXAMPLES) {
    const count = example.densityValues?.many ?? defaultDensityCountOf(example);
    const source = example.cfg(count, example.indexSeriesRange?.max);
    /* index 的“数据组数”也是这样先包装 cfg，再交给 buildConfig；用最大档覆盖完整名称池。 */
    const fullExample = { ...example, cfg: () => source };
    const config = buildConfig(fullExample, {
      theme: 'ainvest', axisTitle: true, labelLayout: 'outside', ratingStyle: 'bands',
    });
    assert.deepEqual(collectCjk(config), [], `${example.id} 的 Ainvest 图内仍有中文`);
  }

  const bar = EXAMPLES.find((example) => example.id === 'basic');
  assert.equal(buildConfig(bar, { theme: 'ths' }).series[0].name, '营业收入');
  assert.equal(buildConfig(bar, { theme: 'ifind-pc' }).series[0].name, '营业收入');
  assert.equal(buildConfig(bar, { theme: 'ainvest' }).series[0].name, 'Revenue');
  const radar = EXAMPLES.find((example) => example.id === 'radar-basic');
  assert.equal(buildConfig(radar, { theme: 'ainvest' }).dimensions[3], 'Funds Flow');
});

test('TOOLTIP-12：Y 向指示默认关，只有开才落进 cfg', () => {
  const cartesian = EXAMPLES.filter((example) => capabilitiesOf(example).yIndicator);
  assert.ok(cartesian.length, '应有直角坐标系示例声明 yIndicator 能力');
  for (const e of cartesian) {
    /* 默认关 = cfg 里根本没有这个字段（同 zoom / axisTitle 的口径，不写 false） */
    assert.equal(buildConfig(e).yIndicator, undefined, `示例「${e.id}」不开时不该落进 cfg`);
    assert.equal(buildConfig(e, { yIndicator: true }).yIndicator, true, `示例「${e.id}」开了没落进 cfg`);
  }
  /* 不声明该能力的图型（桑基）即便旋钮给了 true 也不该被塞进 cfg */
  const sankey = EXAMPLES.find((example) => example.chart === 'sankey');
  assert.equal(buildConfig(sankey, { yIndicator: true }).yIndicator, undefined);
});

test('SANKEY-24/26：主站桑基八期同拓扑，并共享最大主轴比例尺', () => {
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
    const operatingLink = period.links.find((link) => link.target === 'operating-profit');
    const netLink = period.links.find((link) => link.target === 'net-profit');
    const parentLink = period.links.find((link) => link.target === 'parent-profit');
    assert.equal(period.nodes.length, 15);
    assert.equal(period.links.length, 14);
    assert.equal(grossLink.negativeSource, 'cost');
    assert.equal(operatingLink.negativeSource, 'operating-expense');
    assert.equal(netLink.negativeSource, 'income-tax');
    assert.equal(parentLink.negativeSource, 'minority-interest');
    assert.equal(hasSameSankeyTopology(periods[0], period), true);
    assert.doesNotThrow(() => assertSankeyConfig(period));
  });

  const lossPeriod = periods.find((period) => period.statusLabel === '亏损');
  const lossGraph = assertSankeyConfig(lossPeriod);
  const revenue = lossGraph.nodes.find((node) => node.id === 'revenue');
  const businessIncome = lossPeriod.links
    .filter((link) => link.target === 'revenue')
    .reduce((sum, link) => sum + link.value, 0);
  assert.equal(businessIncome, 273e8);
  assert.equal(revenue.value, businessIncome);
  assert.equal(revenue.magnitude, Math.abs(revenue.value));
  assert.equal(lossPeriod.links.find((link) => link.target === 'cost').value, 295e8);
  assert.equal(lossPeriod.links.find((link) => link.target === 'gross').value, -22e8);
  assert.equal(
    lossPeriod.links.find((link) => link.target === 'operating-expense').value,
    32e8,
  );
  assert.equal(
    lossPeriod.links.find((link) => link.target === 'operating-profit').value,
    -54e8,
  );
  assert.equal(lossPeriod.links.find((link) => link.target === 'total-profit').value, -57e8);
  assert.equal(lossPeriod.links.find((link) => link.target === 'net-profit').value, -57.7e8);
  assert.equal(lossPeriod.links.find((link) => link.target === 'parent-profit').value, -59.7e8);
  assert.equal(sankey.playback.viewport.mobile.legendFallbackHeight, 40);
  assert.equal('totalHeight' in sankey.playback.viewport.mobile, false);
  assert.equal(sankey.playback.viewport.mobile.canvasHeight % 4, 0);
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
/* ⚠️ **这是全库唯一一处硬编码图表类型清单**（其余判定都按 cfg 形态或能力声明走）。
   接入新的无坐标系图型时必须加进来——**漏了不会报错**，守卫只是静悄悄地不覆盖它。 */
const AXISLESS_CHARTS = ['pie', 'treemap', 'radar', 'chord'];

test('PIE-05/PIE-08/TREEMAP-08/RADAR-07/CHORD-19：无坐标系图不得声明轴相关能力，旋钮开着也装不进 cfg', () => {
  const axisless = EXAMPLES.filter((e) => AXISLESS_CHARTS.includes(e.chart));
  assert.ok(axisless.length > 0, 'EXAMPLES 里应至少有一个无坐标系示例，否则本守卫形同虚设');
  /* 名单里的每一类都得真有示例，否则「加了类型键但忘了加示例」会让这一类静默失覆盖 */
  for (const chart of AXISLESS_CHARTS) {
    assert.ok(axisless.some((e) => e.chart === chart), `无坐标系名单里的 ${chart} 在 EXAMPLES 里没有示例`);
  }
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

test('CHORD 分类：对外只出一个弦图示例，两档形态由旋钮切而不是各出一条', () => {
  assert.deepEqual(
    examplesFor('index').filter((item) => item.chart === 'chord').map((item) => item.id),
    ['chord-sector-flow'],
  );
});

test('CHORD-02：行业数旋钮拖动时，已有格子的流量值不变 —— 新增行业只是多一段弧', () => {
  /* 这条保的是旋钮的可比性：若示例数据用 Math.random()，每拖一格整张图都会变成
     另一份数据，"加了一个行业"这件事本身就看不出来了。 */
  const [small, large] = [
    EXAMPLES.find((e) => e.id === 'chord-sector-flow').cfg(4),
    EXAMPLES.find((e) => e.id === 'chord-sector-flow').cfg(10),
  ];
  assert.deepEqual(small.entities, large.entities.slice(0, 4), '前 4 个行业与顺序不变');
  for (let i = 0; i < 4; i += 1) {
    assert.deepEqual(small.matrix[i], large.matrix[i].slice(0, 4), `第 ${i} 行的已有格子不变`);
  }
});

test('CHORD-05/CHORD-11：两档形态都是默认时不落进 cfg，选非默认档才写字段', () => {
  const example = EXAMPLES.find((e) => e.id === 'chord-sector-flow');
  const base = buildConfig(example, {});
  assert.equal(base.variant, undefined, "'undirected' 是组件默认，不该出现在 cfg 里");
  assert.equal(base.entityLabelLayout, undefined, "'arc' 是组件默认，不该出现在 cfg 里");
  const switched = buildConfig(example, { chordVariant: 'directed', chordLabelLayout: 'horizontal' });
  assert.equal(switched.variant, 'directed');
  assert.equal(switched.entityLabelLayout, 'horizontal');
});

test('RADAR 分类：对外分标准 / 多数据 / 分区，专项面保留六个典型配置', () => {
  assert.deepEqual(
    examplesFor('index').filter((item) => item.chart === 'radar').map((item) => item.id),
    ['radar-basic', 'radar-multi', 'radar-rating'],
  );
  assert.deepEqual(
    examplesFor('radar-preview').filter((item) => item.chart === 'radar').map((item) => item.id),
    ['radar-basic', 'radar-multi', 'radar-curve', 'radar-polygon', 'radar-rating', 'radar-adjustable'],
  );
});

test('BAR-01：柱状图独立提供基础正值与跨零负值用例', () => {
  assert.deepEqual(
    examplesFor('index').filter((item) => item.group === '柱状图').map((item) => item.id),
    ['basic', 'bar-negative', 'grouped3'],
  );

  const basicData = EXAMPLES.find((item) => item.id === 'basic').cfg(8).series[0].data;
  assert.ok(basicData.every((value) => value > 0), '基础柱状图应保持纯正值，避免与负值用例职责重叠');

  const defaultSignedData = EXAMPLES.find((item) => item.id === 'bar-negative').cfg(4).series[0].data;
  assert.ok(defaultSignedData.some((value) => value > 0), '默认首屏应包含正值');
  assert.ok(defaultSignedData.some((value) => value < 0), '默认首屏应直接看见负值');
  assert.ok(defaultSignedData.includes(0), '默认首屏应覆盖 0 值占位');
  assert.ok(
    EXAMPLES.find((item) => item.id === 'bar-negative').cfg(8).series[0].data.includes(null),
    '扩展数据量后应覆盖 null 断口',
  );
});

test('LINE-01：折线图独立提供基础正值与跨零负值用例', () => {
  assert.deepEqual(
    examplesFor('index').filter((item) => item.group === '折线图').map((item) => item.id),
    ['line', 'line-negative', 'line-multi', 'line-stack'],
  );

  const basicData = EXAMPLES.find((item) => item.id === 'line').cfg(16).series[0].data;
  assert.ok(basicData.every((value) => value == null || value > 0), '基础折线图应保持正值与 null 断点');

  const defaultSignedData = EXAMPLES.find((item) => item.id === 'line-negative').cfg(4).series[0].data;
  assert.ok(defaultSignedData.some((value) => value > 0), '默认首屏应包含正值');
  assert.ok(defaultSignedData.some((value) => value < 0), '默认首屏应直接看见负值');
  assert.ok(defaultSignedData.includes(0), '默认首屏应覆盖 0 值点');
  assert.ok(
    EXAMPLES.find((item) => item.id === 'line-negative').cfg(8).series[0].data.includes(null),
    '扩展数据量后应覆盖 null 断点',
  );
});

test('RADAR-03/05/18：网格与轮廓可组合，可调节能力只开放给单系列示例', () => {
  for (const id of ['radar-basic', 'radar-rating']) {
    const example = EXAMPLES.find((item) => item.id === id);
    const caps = capabilitiesOf(example);
    assert.equal(caps.radarGridShape, true);
    assert.equal(caps.radarShape, true);
    assert.equal(caps.radarEditable, true);
    const cfg = buildConfig(example, {
      density: 'mid', radarGridShape: 'polygon', radarShape: 'curve', radarEditable: 'on',
    });
    assert.equal(cfg.gridShape, 'polygon');
    assert.equal(cfg.shape, 'curve');
    assert.equal(cfg.editable, true);
    assert.equal(cfg.series.length, 1, '编辑能力开启后须收敛为单系列');
    assert.equal(cfg.editStep, 0.1);
    assert.equal(cfg.series[0].data.length, cfg.dimensions.length);
  }

  const basic = EXAMPLES.find((item) => item.id === 'radar-basic');
  const multi = EXAMPLES.find((item) => item.id === 'radar-multi');
  assert.equal(radarGridShapeOf(basic), 'circle');
  assert.equal(radarShapeOf(basic), 'straight');
  assert.equal(radarEditableOf(basic), false);
  assert.equal(radarEditableOf(basic, 'on'), true);
  assert.equal(capabilitiesOf(multi).radarEditable, false);
  assert.equal(radarEditableOf(multi, 'on'), false);
  const multiCfg = buildConfig(multi, { density: 'mid', radarEditable: 'on' });
  assert.equal(multiCfg.editable, undefined);
  assert.equal(multiCfg.series.length, 2);
  assert.deepEqual(multi.indexSeriesRange, { min: 2, max: 10, default: 2 });
  assert.equal(multi.cfg(5, 10).series.length, 10);
  assert.equal(buildConfig(basic, { seriesCount: 5 }).series.length, 1, 'index 控件值不得进入共享配置装配');
});

test('index 数据组数滑块：合并重复分组柱，并覆盖堆叠、折线、组合与多数据雷达夹具', () => {
  assert.equal(EXAMPLES.some((item) => item.id === 'grouped6'), false, '重复的六系列分组柱用例应移除');
  const ranges = {
    grouped3: [2, 12, 3],
    stack: [2, 12, 3],
    stackNeg: [2, 10, 3],
    percent: [2, 12, 3],
    'line-multi': [2, 12, 3],
    'line-stack': [2, 12, 3],
    combo: [2, 10, 3],
    'radar-multi': [2, 10, 2],
  };
  for (const [id, [min, max, defaultCount]] of Object.entries(ranges)) {
    const example = EXAMPLES.find((item) => item.id === id);
    assert.deepEqual(example.indexSeriesRange, { min, max, default: defaultCount });
    assert.equal(example.cfg(5).series.length, defaultCount, `${id} 默认系列数应保持稳定`);
    assert.equal(example.cfg(5, min).series.length, min, `${id} 滑块下限未生效`);
    assert.equal(example.cfg(5, max).series.length, max, `${id} 滑块上限未生效`);
  }

  const signedStack = EXAMPLES.find((item) => item.id === 'stackNeg').cfg(5, 2);
  assert.ok(signedStack.series.some((series) => series.data.some((value) => value < 0)), '最小档仍须保留负值系列');
  const combo = EXAMPLES.find((item) => item.id === 'combo').cfg(5, 2);
  assert.deepEqual(combo.series.map((series) => series.type), ['bar', 'line'], '最小档仍须保持折柱组合语义');
  assert.equal(buildConfig(EXAMPLES.find((item) => item.id === 'grouped3'), { seriesCount: 6 }).series.length, 3,
    '数据组数是 index 包装示例的控件，不应成为 buildConfig / 组件能力');
});

/* 相位按 index × 0.9 一路递增时，第 8 条落到 6.3、与 2π 只差 0.017，与第 1 条几乎同轨
   （实测 Δmax 仅为量程的 0.72%），而 7 色板恰好也在第 8 条循环回第 1 色 —— 同色又同高。
   故本条**遍历每一个带滑块的示例**，而不是只守最先发现问题的那一个：波形池是共用的，
   只守一处等于把规则写下来却只在六分之一的地方生效。
   阈值 3% 的来历：出问题那次是 0.72%，当前最紧的一对是 radar-multi 手写数据的 5.56%，
   3% 落在两者之间——够抓住相位绕回，又不会把正当的「相近对比组」判成重复。 */
test('示例数据池：任何两条系列都不得在最大档重复轨迹', () => {
  const withSlider = EXAMPLES.filter((item) => item.indexSeriesRange);
  assert.ok(withSlider.length >= 8, '带数据组数滑块的示例应全部纳入本条守卫');

  for (const example of withSlider) {
    const { max } = example.indexSeriesRange;
    const series = example.cfg(20, max).series;
    assert.equal(series.length, max, `${example.id} 最大档应取满 ${max} 条`);

    const points = series.flatMap((s) => s.data.map(Number)).filter(Number.isFinite);
    const span = Math.max(...points) - Math.min(...points);
    for (let i = 0; i < series.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        const greatestDelta = Math.max(...series[i].data.map((value, point) => {
          const a = Number(value);
          const bValue = Number(series[j].data[point]);
          return Number.isFinite(a) && Number.isFinite(bValue) ? Math.abs(a - bValue) : Infinity;
        }));
        assert.ok(greatestDelta > span * 0.03,
          `${example.id}：第 ${i + 1} 条「${series[i].name}」与第 ${j + 1} 条「${series[j].name}」轨迹重复`
          + `（Δmax 仅为量程的 ${(greatestDelta / span * 100).toFixed(2)}%）`);
      }
    }
  }
});

test('RADAR-18：专项可调节配置仍保留既有回归默认', () => {
  const example = EXAMPLES.find((item) => item.id === 'radar-adjustable');
  const cfg = buildConfig(example, { density: 'mid' });
  assert.equal(cfg.editable, true);
  assert.equal(cfg.series.length, 1);
  assert.equal(cfg.max, 5);
  assert.equal(cfg.editStep, 0.1);
  assert.equal(cfg.axisLabelLayout, 'arc');
  assert.equal(buildConfig(example, { density: 'mid', axisValue: true }).axisValue, undefined);
});

test('RADAR-07/14：维度轴排列可在横排与环绕间切换，环绕档不装第二行数值', () => {
  const basic = EXAMPLES.find((item) => item.id === 'radar-basic');
  const adjustable = EXAMPLES.find((item) => item.id === 'radar-adjustable');
  assert.equal(capabilitiesOf(basic).axisLabelLayout, true);
  assert.equal(radarAxisLabelLayoutOf(basic), 'horizontal');
  assert.equal(radarAxisLabelLayoutOf(adjustable), 'arc');
  assert.equal(radarAxisLabelLayoutOf(basic, 'auto', 'on'), 'arc');
  assert.equal(buildConfig(basic).axisLabelLayout, undefined);
  assert.equal(buildConfig(basic, { axisLabelLayout: 'arc' }).axisLabelLayout, 'arc');
  assert.equal(buildConfig(adjustable, { axisLabelLayout: 'horizontal' }).axisLabelLayout, 'horizontal');
  assert.equal(buildConfig(basic, { axisLabelLayout: 'horizontal', axisValue: true }).axisValue, true);
  assert.equal(buildConfig(basic, { axisLabelLayout: 'arc', axisValue: true }).axisValue, undefined);
});

test('RADAR-15：分区雷达默认渐变，分段数量同步控制图面与底部说明', () => {
  const rating = EXAMPLES.find((item) => item.id === 'radar-rating');
  assert.ok(rating, 'EXAMPLES 中应注册分区雷达图示例');
  const cfg = buildConfig(rating, { density: 'mid' });
  assert.equal(cfg.variant, 'rating');
  assert.equal(cfg.ratingStyle, undefined, '渐变是组件默认，不重复写入 cfg');
  assert.equal(capabilitiesOf(rating).ratingStyle, true);
  assert.equal(capabilitiesOf(rating).ratingBandCount, true);
  const fiveBands = buildConfig(rating, { ratingStyle: 'bands', ratingBandCount: '5' });
  assert.equal(fiveBands.ratingStyle, 'bands');
  assert.equal(fiveBands.segments, 5);
  assert.deepEqual(fiveBands.ratingBandLabels, ['-2%', '-1%', '0%', '+1%', '>+2%']);
  const sixBands = buildConfig(rating, { ratingStyle: 'bands', ratingBandCount: '6' });
  assert.equal(sixBands.segments, 6);
  assert.deepEqual(sixBands.ratingBandLabels, ['>-3%', '-2%', '-1%', '+1%', '+2%', '>+2%']);

  const basic = EXAMPLES.find((item) => item.id === 'radar-basic');
  assert.equal(capabilitiesOf(basic).ratingStyle, false);
  assert.equal(capabilitiesOf(basic).ratingBandCount, false);
  assert.equal(buildConfig(basic, { ratingStyle: 'bands', ratingBandCount: '5' }).ratingStyle, undefined);
  assert.equal(buildConfig(basic, { ratingStyle: 'bands', ratingBandCount: '5' }).ratingBandLabels, undefined);
});

/* [TREEMAP-06] 数据仍是递归结构，但深层只用于**汇总父节点的值**——无下钻后
   子节点不再是可进入的层级，这条断言守的是「求和口径」而不是「导航层级」。 */
test('TREEMAP-01：矩形树图示例使用递归层级数据，深层只参与汇总', () => {
  const example = EXAMPLES.find((item) => item.id === 'treemap-entry');
  assert.ok(example, 'EXAMPLES 中应注册矩形树图示例');
  const cfg = buildConfig(example, { platform: 'mobile' });
  assert.equal(cfg.platform, 'mobile');
  assert.equal(cfg.root.name, '全部行业');
  assert.equal(cfg.root.children.length, 6);
  assert.ok(cfg.root.children.every((node) => node.children.length >= 3));
  const entryValues = cfg.root.children.map((node) => node.children
    .reduce((sum, child) => sum + child.value, 0));
  assert.deepEqual(entryValues, [...entryValues].sort((a, b) => b - a), '入口节点应按程度值降序声明');
  assert.deepEqual(cfg.root, treemapHierarchy());
  assert.deepEqual(capabilitiesOf(example), {
    density: true,
    zoom: false,
    dataLabel: false,
    axisTitle: false,
    callout: false,
    animation: true,
    area: false,
    legend: false,
    labelLayout: false,
    labelAlign: false,
    legendSelect: false,
    yIndicator: false,
    treemapColor: true,
    axisValue: false,
    radarGridShape: false,
    radarShape: false,
    ratingStyle: false,
    ratingBandCount: false,
    axisLabelLayout: false,
    chordVariant: false,
    chordLabelLayout: false,
    radarEditable: false,
    waterfallColor: false,
  });
});

test('WATERFALL-10/12：瀑布颜色走预览旋钮，X 轴内容与关系保留为代码配置', () => {
  const bridge = EXAMPLES.find((item) => item.id === 'waterfall-bridge');
  const data = EXAMPLES.find((item) => item.id === 'waterfall-data');
  const bar = EXAMPLES.find((item) => item.id === 'basic');
  assert.ok(bridge && data, 'EXAMPLES 中应同时注册两种瀑布图形态');
  assert.equal(buildConfig(bridge).colorMode, 'primary');
  assert.equal(buildConfig(bridge, { waterfallColor: 'primary' }).colorMode, 'primary');
  assert.equal(buildConfig(bridge, { waterfallColor: 'semantic' }).colorMode, 'semantic');
  assert.equal(buildConfig(data).xAxisContent, 'name');
  assert.equal(buildConfig(data).showRelations, true);
  const codeConfigured = {
    ...data,
    cfg: () => ({ ...data.cfg(), xAxisContent: 'name-value', showRelations: false }),
  };
  assert.equal(buildConfig(codeConfigured).xAxisContent, 'name-value');
  assert.equal(buildConfig(codeConfigured).showRelations, false);
  assert.equal(buildConfig(bar, { waterfallColor: 'semantic' }).colorMode, undefined);
  assert.equal(buildConfig(bar).xAxisContent, undefined);
});

test('WATERFALL-01/04：瀑布示例完整透出类型、运算符与分段数据，并为 Ainvest 映射英文', () => {
  const bridge = EXAMPLES.find((item) => item.id === 'waterfall-bridge');
  const data = EXAMPLES.find((item) => item.id === 'waterfall-data');
  const ths = buildConfig(bridge, { theme: 'ths' });
  const ainvest = buildConfig(bridge, { theme: 'ainvest' });
  assert.ok(ths.items.every((item) => item.kind && 'value' in item));
  assert.equal(ths.items[1].operatorBefore, '+');
  assert.equal(ainvest.period, '2024 Q3');
  assert.equal(ainvest.items[0].name, 'Revenue');
  assert.deepEqual(ainvest.items[1].axisLabel, ['Cost of', 'sales']);
  assert.deepEqual(ainvest.items[3].axisLabel, ['Other', 'Expenses']);
  const dataCfg = buildConfig(data, { theme: 'ainvest' });
  assert.equal(dataCfg.items[0].segments.length, 2);
  assert.equal(dataCfg.items[0].segments[0].name, 'Current Assets');
});

test('TREEMAP-17/COLOR-09：颜色策略只装进矩形树图配置，强度模式走组件默认', () => {
  const treemap = EXAMPLES.find((item) => item.id === 'treemap-overall');
  const bar = EXAMPLES.find((item) => item.id === 'basic');
  assert.equal(buildConfig(treemap, { treemapColor: 'intensity' }).colorMode, undefined);
  assert.equal(buildConfig(treemap, { treemapColor: 'semantic-binned' }).colorMode, 'semantic-binned');
  assert.equal(buildConfig(treemap, { treemapColor: 'semantic-flat' }).colorMode, 'semantic-flat');
  assert.deepEqual(buildConfig(treemap).colorThresholds, [1, 2]);
  assert.equal(buildConfig(bar, { treemapColor: 'semantic-binned' }).colorMode, undefined);
});

test('TREEMAP-18：业务数据在 L3 归一化为通用 presentation 合同', () => {
  const children = treemapHierarchy(18).children;
  assert.equal(children[0].name, '信息技术');
  assert.equal(children[0].value, 4280);
  assert.equal(children[0].presentation.label, 'AAPL');
  assert.match(children[0].presentation.image, /\/aapl\.png$/);
  assert.ok(children.every((node) => Number.isFinite(node.presentation.colorValue)
    && node.presentation.details.length === 3));
  assert.deepEqual(
    Object.fromEntries(children.map((node) => [
      node.presentation.label,
      node.presentation.image
        ? new URL(node.presentation.image).pathname.split('/').at(-1)
        : null,
    ])),
    {
      AAPL: 'aapl.png', WSM: 'wsm.png', DOLE: 'dole.png', YSG: 'ysg.png',
      VKTX: 'vktx.png', YMM: 'ymm.png', CSCO: 'csco.png', MAR: 'mar.png',
      TEAM: 'team.png', ADMA: 'adma.png', BTSG: 'btsg.png', GLTO: 'glto.png',
      GSAT: 'gsat.png', MSFT: null, NVDA: null, GOOG: null, AMZN: null, META: null,
    },
    '只使用企业自己的真实图标，不借用 Apple 图标占位',
  );
  assert.deepEqual(
    Object.fromEntries(children.map((node) => [
      node.presentation.label,
      node.presentation.imageFallback,
    ])),
    {
      AAPL: 'A', WSM: 'W', DOLE: 'D', YSG: 'Y', VKTX: 'V', YMM: 'F', CSCO: 'C',
      MAR: 'M', TEAM: 'A', ADMA: 'A', BTSG: 'B', GLTO: 'G', GSAT: 'G', MSFT: 'M',
      NVDA: 'N', GOOG: 'A', AMZN: 'A', META: 'M',
    },
    '首字母必须来自企业名称；例如 Alphabet= A、Atlassian= A、Full Truck Alliance= F',
  );
  assert.ok(children.filter((node) => node.presentation.image)
    .every((node) => statSync(new URL(node.presentation.image)).size > 1000),
    '公司图标不应退化为空白或透明占位文件');
});

test('TREEMAP-11/12/13：入口、通用与全局树图是三个独立示例', () => {
  const examples = EXAMPLES.filter((item) => item.chart === 'treemap');
  assert.deepEqual(examples.map(({ id }) => id), ['treemap-entry', 'treemap-local', 'treemap-overall']);
  /* [TREEMAP-08] 三个形态**都不带高度元数据**：高度恒由宿主容器决定，容器没给就退到
     三族共用的主题 token --size-chart-region-height。曾有过 regionHeight /
     compactRegionHeight 两个字段（被删掉的三个高度 token 的迁移落点），
     在高度模型改成「容器决定」后再无消费方，已一并清除，不留没人读的配置。 */
  assert.ok(
    examples.every((e) => e.regionHeight === undefined && e.compactRegionHeight === undefined),
    '示例不应再携带高度元数据',
  );

  const expected = [
    {
      id: 'treemap-entry', variant: 'entry', values: { few: 3, mid: 6, many: 8 },
      hint: 'PRD 建议 3–8 个入口模块', labelType: 'twoLineCenter',
    },
    {
      id: 'treemap-local', variant: 'local', values: { few: 10, mid: 18, many: 30 },
      hint: 'PRD 建议不超过 30 项', labelType: 'twoLineCenter',
    },
    {
      id: 'treemap-overall', variant: 'overall', values: { few: 32, mid: 42, many: 54 },
      hint: 'PRD 建议 30 项以上', labelType: 'twoLineLeftBottom',
    },
  ];

  expected.forEach(({ id, variant, values, hint, labelType }) => {
    const example = examples.find((item) => item.id === id);
    assert.deepEqual(densityOptionsOf(example), values);
    assert.equal(defaultDensityOf(example), 'mid');
    assert.deepEqual(densityControlOf(example), {
      label: '项数', hint, default: 'mid',
      options: [
        { id: 'few', label: `${values.few}项` },
        { id: 'mid', label: `${values.mid}项` },
        { id: 'many', label: `${values.many}项` },
      ],
    });
    const cfg = buildConfig(example);
    assert.equal(cfg.variant, variant);
    assert.equal(cfg.root.children.length, values.mid);
    assert.equal(cfg.labelType, labelType);
  });
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
 * 数据量有两条并存的通道：三档预设 id（playground 两个面）与连续档数字（主站滑杆）。
 * 本组守卫防的是「滑杆能拉到组件拒收的区间」——那不是画少一点，而是**当场抛错**：
 * RadarChart 在 dimensions < 3 时直接 throw（RADAR-01「少于此构不成面积」）。
 * 夹取写在 buildConfig 里而不是各面自己夹，所以只在这里测一次就覆盖所有面。
 */
test('RADAR-01：连续档的上下限落在组件收得下的区间内，滑杆拉到两端都不抛', () => {
  for (const example of EXAMPLES) {
    if (!capabilitiesOf(example).density) continue;
    const { min, max, unit } = densitySliderOf(example);
    assert.ok(min >= 1 && max >= min, `示例「${example.id}」的连续档区间不合法`);
    assert.ok(unit.length > 0, `示例「${example.id}」缺数据量单位`);

    for (const value of [min, max]) {
      const cfg = buildConfig(example, { density: value });
      /* 雷达是唯一有硬下限的族：轴数即维度数，低于 3 组件抛错、高于 6 无更多维度名 */
      if (example.chart === 'radar') {
        assert.ok(cfg.dimensions.length >= 3, `示例「${example.id}」在 ${value} 档跌破维度下限`);
        assert.equal(cfg.dimensions.length, cfg.series[0].data.length, '维度与数据长度须一致');
      }
    }
  }
});

test('连续档越界即夹取：低于下限取下限、高于上限取上限，不静默截断也不抛', () => {
  const radar = EXAMPLES.find((e) => e.id === 'radar-basic');
  const { min, max } = densitySliderOf(radar);
  assert.deepEqual([min, max], [3, 6], '雷达连续档应收窄到 3–6');
  assert.equal(buildConfig(radar, { density: 1 }).dimensions.length, min);
  assert.equal(buildConfig(radar, { density: 99 }).dimensions.length, max);

  const bar = EXAMPLES.find((e) => e.id === 'basic');
  assert.equal(buildConfig(bar, { density: 0 }).categories.length, 1, '缺省下限为 1');
  assert.equal(buildConfig(bar, { density: 999 }).categories.length, 50, '缺省上限为 50');
});

test('两条通道同源：档位 id 与它对应的数字装配出同一份 cfg', () => {
  for (const example of EXAMPLES) {
    if (!capabilitiesOf(example).density) continue;
    const values = densityOptionsOf(example);
    for (const id of ['few', 'mid', 'many']) {
      assert.deepEqual(
        buildConfig(example, { density: values[id] }),
        buildConfig(example, { density: id }),
        `示例「${example.id}」的 ${id} 档在两条通道下装配结果不一致`,
      );
    }
    /* 滑杆初值必须等于该示例预设默认档的数值，否则同一个示例在两种面上首屏不同 */
    assert.equal(defaultDensityCountOf(example), values[defaultDensityOf(example)]);
  }
});

/*
 * 「逻辑」面板展示的必须就是真正生效的那一份 cfg（examples.js 文件头的承诺）。
 * describeConfig 必须完整保留数组与嵌套数据，不得增删字段、不得补默认值——
 * 补一个 cfg 里本来没有的 `stack:'none'` 会让面板说谎（那个默认值是组件里才产生的）。
 */
test('describeConfig：与 buildConfig 完全一致，不折叠数据或补默认值', () => {
  for (const e of EXAMPLES) {
    const state = { density: 'mid', zoom: true, axisTitle: true, animation: false };
    assert.deepEqual(
      describeConfig(e, state),
      buildConfig(e, state),
      `示例「${e.id}」的完整展示与真实 cfg 不一致`,
    );
  }
});

test('describeConfig：完整透出 Sankey 节点分层与流向数据', () => {
  const sankey = EXAMPLES.find((e) => e.id === 'sankey-financial');
  const shown = describeConfig(sankey, { theme: 'ths', platform: 'pc' });

  assert.equal(shown.nodes.length, 15);
  assert.equal(shown.links.length, 14);
  assert.ok(
    shown.nodes.every((node) => (
      'id' in node && 'name' in node && 'role' in node && 'stage' in node && 'order' in node
    )),
    '每个节点都应完整展示身份、业务角色、阶段和同层顺序',
  );
  assert.ok(
    shown.links.every((link) => (
      'source' in link && 'target' in link && 'value' in link
    )),
    '每条流向都应完整展示来源、目标和有符号值',
  );
  assert.ok(
    shown.links.some((link) => 'negativeSource' in link),
    '财务差额流向的同层视觉来源也必须透出',
  );
});

/* [CALLOUT-02] 带标注的示例，其锚点必须在**默认密度档**解析得出来。
   拖到更低的数据组数时会消失，那是「类目不在可见窗口内就不出」的活演示、是预期行为；
   但默认档一进来就看不见标注，那是示例坏了。 */
test('CALLOUT-02：带标注的示例锚点在默认密度档存在，且两档锚点都有覆盖', () => {
  const hosts = EXAMPLES.filter((e) => Array.isArray(e.cfg(defaultDensityCountOf(e)).callout));
  assert.ok(hosts.length >= 2, '至少要有两个示例携带标注内容');

  const modes = new Set();
  for (const ex of hosts) {
    const cfg = buildConfig(ex, { theme: 'ths' });
    for (const c of cfg.callout) {
      assert.ok(cfg.categories.includes(c.category), `${ex.id} 的锚点类目 ${c.category} 必须在默认密度档存在`);
      assert.ok(c.text, `${ex.id} 的每条标注都要有文案`);
      if (c.series != null) {
        modes.add('series');
        const r = cfg.series.find((x) => x.name === c.series);
        assert.ok(r, `${ex.id} 标注引用的系列 ${c.series} 必须存在`);
        assert.notEqual(r.data[cfg.categories.indexOf(c.category)], null, `${ex.id} 锚点处不得是 null 断口`);
      } else {
        modes.add('value');
        assert.ok(Number.isFinite(c.value), `${ex.id} 任意坐标档必须给有限数值`);
      }
    }
  }
  assert.deepEqual([...modes].sort(), ['series', 'value'], '真实数据点档与任意数值坐标档都要被示例覆盖');
});

/* [CALLOUT-01] 旋钮语义：内容由示例携带、默认显示，**只有关掉才动 cfg**（方向同 animation）。
   做成「开才加内容」是不可能的——那句话不在 state 里，旋钮造不出来。 */
test('CALLOUT-01：标注旋钮默认开，关掉才把 callout 从 cfg 摘掉', () => {
  const host = EXAMPLES.find((e) => Array.isArray(e.cfg(defaultDensityCountOf(e)).callout));
  assert.ok(Array.isArray(buildConfig(host, {}).callout), '缺省即显示');
  assert.ok(Array.isArray(buildConfig(host, { callout: true }).callout), '显式开仍显示');
  assert.equal(buildConfig(host, { callout: false }).callout, undefined, '关掉必须整个摘掉');

  /* 没声明标注内容的示例不出这个旋钮（按示例条件化） */
  const bare = EXAMPLES.find((e) => e.chart === 'cartesian' && !e.cfg(defaultDensityCountOf(e)).callout);
  assert.ok(bare, '应当存在不带标注的直角坐标系示例');
  assert.equal(capabilitiesOf(bare).callout, false, '没内容就不该出旋钮');
  assert.equal(capabilitiesOf(host).callout, true, '有内容才出旋钮');
});

/* [CALLOUT-03] Ainvest 走整句替换：中文词条漏了会让英文面上残留中文。 */
test('CALLOUT-03：Ainvest 下标注文案与被引用的系列名同时英文化', () => {
  const hosts = EXAMPLES.filter((e) => Array.isArray(e.cfg(defaultDensityCountOf(e)).callout));
  for (const ex of hosts) {
    const en = buildConfig(ex, { theme: 'ainvest' });
    for (const c of en.callout) {
      assert.ok(!/[\u4e00-\u9fff]/.test(c.text), `${ex.id} 的标注文案仍是中文：${c.text}`);
      if (c.series == null) continue;
      assert.ok(en.series.some((r) => r.name === c.series),
        `${ex.id}：系列名英文化后，标注里的 series 引用必须跟着改，否则锚点解析不到`);
    }
  }
});
