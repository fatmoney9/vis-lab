import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChartText, fillText } from '../charts/core/chart-text.js';
import {
  CHORD_TEXT, chordArcLabel, chordRibbonLabel, chordEntityDashboard, chordRibbonDashboard,
} from '../charts/charts/chord/model.js';
import { SANKEY_TEXT } from '../charts/charts/sankey/config.js';
import { TREEMAP_TEXT } from '../charts/charts/treemap/content.js';
import { ainvestComponentText, chartContentPresentation } from '../demos/chart-presentation.js';
import { financialSankeyPresentation } from '../demos/sankey-presentation.js';

/* 中文字符 + 中文标点 + 全角符号：英文表里混进一个「，」也算没翻干净 */
const CJK = /[　-〿㐀-鿿＀-￯]/u;
const plain = (v) => String(v);

test('CHARTTEXT-02：不给 text 走缺省表', () => {
  assert.strictEqual(resolveChartText(CHORD_TEXT, undefined, 'ChordChart'), CHORD_TEXT);
  assert.strictEqual(resolveChartText(CHORD_TEXT, null, 'ChordChart'), CHORD_TEXT);
});

test('CHARTTEXT-02：整套替换返回副本，不改入参', () => {
  const overrides = { a: 'A', b: 'B' };
  const resolved = resolveChartText({ a: '甲', b: '乙' }, overrides, 'X');
  assert.deepEqual(resolved, overrides);
  assert.notStrictEqual(resolved, overrides);
});

test('CHARTTEXT-02：缺键、多键、非字符串、非对象一律当场抛错', () => {
  const defaults = { a: '甲', b: '乙' };
  assert.throws(() => resolveChartText(defaults, { a: 'A' }, 'X'), /缺少 b/);
  assert.throws(() => resolveChartText(defaults, { a: 'A', b: 'B', c: 'C' }, 'X'), /未知键 c/);
  assert.throws(() => resolveChartText(defaults, { a: 'A', b: 2 }, 'X'), /缺少 b/);
  assert.throws(() => resolveChartText(defaults, ['A', 'B'], 'X'), /必须是对象/);
  assert.throws(() => resolveChartText(defaults, 'A', 'X'), /必须是对象/);
});

test('CHARTTEXT-03：填充占位；未提供的占位原样保留', () => {
  assert.equal(fillText('{name}, value {value}', { name: 'Revenue', value: 12 }), 'Revenue, value 12');
  assert.equal(fillText('{name}，{typo}', { name: '营收' }), '营收，{typo}');
  assert.equal(fillText('{a}{a}', { a: 'x' }), 'xx');
});

/* 缺省表住在 node 能加载的文件里的族，逐族核对英文表与缺省表键集一致。
   雷达的缺省表在 index.js（依赖 d3），由组件运行时的整套校验兜底，这里只查英文表本身。 */
const FAMILIES = [
  ['chord', CHORD_TEXT, ainvestComponentText('chord')],
  ['treemap', TREEMAP_TEXT, ainvestComponentText('treemap')],
  ['sankey', SANKEY_TEXT, financialSankeyPresentation({ nodes: [] }, { theme: 'ainvest' }).text],
];

for (const [family, defaults, english] of FAMILIES) {
  test(`CHARTTEXT-02：${family} 的 Ainvest 英文表与 L2 缺省表键集一致`, () => {
    assert.ok(english, `${family} 缺少 Ainvest 英文表`);
    assert.deepEqual(Object.keys(english).sort(), Object.keys(defaults).sort());
    assert.doesNotThrow(() => resolveChartText(defaults, english, family));
  });
}

test('CHARTTEXT-01：各族 Ainvest 英文表不含中文字符与中文标点', () => {
  const tables = { ...Object.fromEntries(FAMILIES.map(([f, , en]) => [f, en])), radar: ainvestComponentText('radar') };
  for (const [family, table] of Object.entries(tables)) {
    assert.ok(table, `${family} 缺少 Ainvest 英文表`);
    for (const [key, value] of Object.entries(table)) {
      assert.ok(!CJK.test(value), `${family}.${key} 仍含中文：${value}`);
    }
  }
});

test('CHARTTEXT-01：只有 Ainvest 注入 text，其他主题原样返回、走组件缺省', () => {
  const cfg = { entities: ['电子', '银行', '汽车'], matrix: [[0, 1, 1], [1, 0, 1], [1, 1, 0]] };
  assert.strictEqual(chartContentPresentation(cfg, { theme: 'ths', chart: 'chord' }), cfg);
  assert.strictEqual(chartContentPresentation(cfg, { theme: 'ifind-pc', chart: 'chord' }), cfg);
  const ainvest = chartContentPresentation(cfg, { theme: 'ainvest', chart: 'chord' });
  assert.deepEqual(ainvest.text, ainvestComponentText('chord'));
  /* 没有固定文案的族不挂 text——组件也不会收到一个空对象去触发整套校验 */
  assert.equal(chartContentPresentation({ series: [] }, { theme: 'ainvest', chart: 'cartesian' }).text, undefined);
});

/* 回归锚：缺省表必须逐字还原接入前的中文输出，下沉是搬位置，不是改文案 */
const GRAPH = { entities: ['电子', '银行', '汽车'], matrix: [[0, 20, 5], [8, 0, 3], [4, 6, 0]] };
const GROUP = { index: 0, name: '电子', outflow: 25, inflow: 12 };
const RIBBON = { i: 0, j: 1, sourceValue: 20, targetValue: 8 };

test('CHORD-13/15：缺省表下的中文描述与看板逐字不变', () => {
  assert.equal(chordArcLabel(GROUP, plain), '电子，流出 25，流入 12');
  assert.equal(chordRibbonLabel(RIBBON, GRAPH, plain), '电子 与 银行 之间的流量：电子 流向 银行 20，银行 流向 电子 8');
  assert.deepEqual(chordEntityDashboard(GROUP, GRAPH, plain).rows.slice(0, 3).map((r) => r.label), ['流出', '流入', '净额']);
  assert.equal(chordRibbonDashboard(RIBBON, GRAPH, plain).rows[2].label, '净额');
});

test('CHORD-13/15：注入英文表后描述与看板固定行名全为英文', () => {
  const text = ainvestComponentText('chord');
  const graph = { entities: ['Electronics', 'Banks', 'Autos'], matrix: GRAPH.matrix };
  const group = { ...GROUP, name: 'Electronics' };
  assert.equal(chordArcLabel(group, plain, text), 'Electronics, outflow 25, inflow 12');
  assert.equal(
    chordRibbonLabel(RIBBON, graph, plain, text),
    'Flow between Electronics and Banks: Electronics to Banks 20, Banks to Electronics 8',
  );
  const labels = [
    ...chordEntityDashboard(group, graph, plain, text).rows,
    ...chordRibbonDashboard(RIBBON, graph, plain, text).rows,
  ].map((r) => r.label);
  for (const label of labels) assert.ok(!CJK.test(label), `看板行名仍含中文：${label}`);
});
