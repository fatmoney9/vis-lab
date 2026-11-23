/*
 * L3 · 数据场景（边界与极端情况）：把**任何一个示例**的配置推到某条边界上。
 *
 * 边界不再是一个单独的示例分类，而是 playground 的一个全局旋钮——切到哪张图，就看哪张图的边界表现。
 * 每族一份变换，只改数据、不改语义配置；变换作用在示例 cfg 产出之后、Ainvest 翻译之前
 * （见 config.js 的 buildConfig），所以长名称同样经词表转英文。
 *
 * 场景：
 *   normal   常规      示例原样
 *   long     超长名称  类目 / 系列 / 节点名换成真实的超长财务科目名（压截断、换行、图例撑高）
 *   extreme  极端值    一项独大（约 ×50～×100），其余被压扁（压窄扇区、细柱、标签碰撞）
 *   gaps     0 与 null 第 2 项为 0、第 4 项为 null（压断口、0 占位、取色槽位不重排）
 *   single   单项      只留一项（压单系列取色、单类目缩放轴、单节点布局）
 *   zero     全 0      全部值为 0（压「没有跨度的轴」：如财报图 0 居中只标 0，EARNINGS-09）
 *   empty    全空      全部 0 / null（压「不抛错、不留半个图」）
 *
 * **尊重各族的数据契约**：某族规定了缺值的表达方式（如世界地图「没有数据 = 不出现该国」、
 * 雷达至少 3 个维度），变换就按那个契约造边界，而不是故意喂非法输入——非法输入会被组件当场拒绝，
 * 那是校验，不是边界表现。确实无从构造的组合在 SCENARIO_NOTES 里写明，预览面照实显示。
 *
 * 只装数据与纯函数：不 import d3、不碰 DOM。
 */
import { LONG_NAMES } from './data/pie.js';
import { epsSubOf } from './data/earnings.js';

export const SCENARIOS = [
  { id: 'normal', label: '常规' },
  { id: 'long', label: '超长名称' },
  { id: 'extreme', label: '极端值' },
  { id: 'gaps', label: '0 与 null' },
  { id: 'single', label: '单项' },
  { id: 'zero', label: '全 0' },
  { id: 'empty', label: '全空' },
];

/* 第 i 个超长名（超出循环时加序号，保证唯一——图例 / 节点按名字做键） */
const longName = (i) => `${LONG_NAMES[i % LONG_NAMES.length]}${i >= LONG_NAMES.length ? Math.floor(i / LONG_NAMES.length) + 1 : ''}`;
/* 深拷贝数据、**保留函数引用**（如雷达的 onChange）：JSON 往返会把函数与 Infinity 静默丢掉 */
const clone = (v) => {
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
  return v;
};
const GAP_ZERO = 1; /* 第 2 项 */
const GAP_NULL = 3; /* 第 4 项 */
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/* 一个数据项的数值变换：普通数值直接变；财报点（{ actual, estimate }）两个值同变 */
const mapValue = (v, fn) => {
  if (v != null && typeof v === 'object') {
    return { ...v, actual: v.actual == null ? v.actual : fn(v.actual), estimate: v.estimate == null ? v.estimate : fn(v.estimate) };
  }
  return v == null ? v : fn(v);
};
const blankValue = (v) => (v != null && typeof v === 'object' ? { ...v, actual: null, estimate: null } : null);

/* ── 各族变换（cfg 已是深拷贝，可直接改）─────────────────────── */

const cartesian = {
  /* 财报点按设计稿「异常情况 02」造：实际值全为 0、没有预期 */
  zero(cfg) {
    cfg.series.forEach((s) => {
      s.data = s.data.map((v) => (v != null && typeof v === 'object' ? { ...v, actual: 0, estimate: null } : 0));
    });
  },
  long(cfg) {
    cfg.categories = cfg.categories.map((_, i) => longName(i));
    cfg.series.forEach((s, k) => { if (cfg.series.length > 1 || s.type !== 'earnings') s.name = longName(k + 1); });
  },
  extreme(cfg) {
    cfg.series.forEach((s) => { s.data = s.data.map((v, i) => (i === 0 ? mapValue(v, (x) => x * 60) : v)); });
  },
  gaps(cfg) {
    cfg.series.forEach((s) => {
      s.data = s.data.map((v, i) => (i === GAP_ZERO ? mapValue(v, () => 0) : i === GAP_NULL ? blankValue(v) : v));
    });
  },
  single(cfg) {
    cfg.categories = cfg.categories.slice(0, 1);
    cfg.series.forEach((s) => { s.data = s.data.slice(0, 1); });
    if (Array.isArray(cfg.xSub)) cfg.xSub = cfg.xSub.slice(0, 1);
  },
  empty(cfg) {
    cfg.series.forEach((s) => { s.data = s.data.map(blankValue); });
  },
};

/* 按名字列表做「一项」变换的通用件：items = [{ name, value }] */
const listOf = (key, { nameKey = 'name', valueKey = 'value', min = 1 } = {}) => ({
  long(cfg) { cfg[key].forEach((it, i) => { it[nameKey] = longName(i); }); },
  extreme(cfg) { cfg[key].forEach((it, i) => { if (i === 0 && isNum(it[valueKey])) it[valueKey] *= 100; }); },
  gaps(cfg) {
    cfg[key].forEach((it, i) => {
      if (i === GAP_ZERO) it[valueKey] = 0;
      if (i === GAP_NULL) it[valueKey] = null;
    });
  },
  single(cfg) { cfg[key] = cfg[key].slice(0, min); },
  zero(cfg) { cfg[key].forEach((it) => { it[valueKey] = 0; }); },
  empty(cfg) { cfg[key].forEach((it, i) => { it[valueKey] = i % 2 ? null : 0; }); },
});

const pie = listOf('items');

const hbar = {
  ...listOf('items'),
  single(cfg) { cfg.items = cfg.items.slice(0, 1); if (cfg.topN != null) cfg.topN = 1; },
};

const radar = {
  long(cfg) {
    cfg.dimensions = cfg.dimensions.map((_, i) => longName(i));
    cfg.series.forEach((s, k) => { s.name = longName(k + 2); });
  },
  /* 极端：首维顶满、其余贴底——轮廓成一根刺 */
  extreme(cfg) {
    const top = cfg.max ?? Math.max(...cfg.series.flatMap((s) => s.data).filter(isNum));
    cfg.series.forEach((s) => { s.data = s.data.map((v, i) => (v == null ? v : i === 0 ? top : 0)); });
  },
  gaps(cfg) {
    cfg.series.forEach((s) => { s.data = s.data.map((v, i) => (i === GAP_ZERO ? 0 : i === GAP_NULL ? null : v)); });
  },
  /* 雷达至少 3 个维度（组件契约）：单项 = 最少维度 + 单系列 */
  single(cfg) {
    cfg.dimensions = cfg.dimensions.slice(0, 3);
    cfg.series = cfg.series.slice(0, 1).map((s) => ({ ...s, data: s.data.slice(0, 3) }));
  },
  zero(cfg) { cfg.series.forEach((s) => { s.data = s.data.map(() => 0); }); },
  empty(cfg) { cfg.series.forEach((s) => { s.data = s.data.map(() => null); }); },
};

/* 矩形树图：叶子 = 有 value 的节点 */
const leaves = (node, out = []) => {
  if (Array.isArray(node.children) && node.children.length) node.children.forEach((c) => leaves(c, out));
  else out.push(node);
  return out;
};
const treemap = {
  long(cfg) {
    let i = 0;
    const walk = (node) => { node.name = longName(i++); (node.children ?? []).forEach(walk); };
    (cfg.root.children ?? []).forEach(walk);
  },
  extreme(cfg) { const [first] = leaves(cfg.root); if (first && isNum(first.value)) first.value *= 100; },
  gaps(cfg) {
    leaves(cfg.root).forEach((leaf, i) => {
      if (i === GAP_ZERO) leaf.value = 0;
      if (i === GAP_NULL) leaf.value = null;
    });
  },
  single(cfg) {
    const first = cfg.root.children?.[0];
    if (!first) return;
    cfg.root.children = [first.children?.length ? { ...first, children: first.children.slice(0, 1) } : first];
  },
  zero(cfg) { leaves(cfg.root).forEach((leaf) => { leaf.value = 0; }); },
  empty(cfg) { leaves(cfg.root).forEach((leaf, i) => { leaf.value = i % 2 ? null : 0; }); },
};

/* 桑基：只给「超长名称」。流量类边界（极端 / 0 / 单项 / 全空）会破坏财报恒等式，
   不适用的原因写在 SCENARIO_NOTES，预览面照实显示 */
const sankey = {
  long(cfg) { cfg.nodes.forEach((n, i) => { n.name = longName(i); }); },
};

const chord = {
  long(cfg) { cfg.entities = cfg.entities.map((_, i) => longName(i)); },
  extreme(cfg) { if (cfg.matrix[1]) cfg.matrix[1][0] = (cfg.matrix[1][0] || 1) * 100; },
  /* 0：第 2 个实体与谁都没有往来；null：第 4 行一格缺值 */
  gaps(cfg) {
    cfg.matrix = cfg.matrix.map((row, i) => row.map((v, j) => (i === GAP_ZERO || j === GAP_ZERO ? 0 : v)));
    if (cfg.matrix[GAP_NULL]) cfg.matrix[GAP_NULL][0] = null;
  },
  /* 弦图至少 3 个实体（CHORD 组件契约：更少的往来用一对数字就说清了）：单项 = 最少实体数 */
  single(cfg) {
    cfg.entities = cfg.entities.slice(0, 3);
    cfg.matrix = cfg.matrix.slice(0, 3).map((row) => row.slice(0, 3));
  },
  zero(cfg) { cfg.matrix = cfg.matrix.map((row) => row.map(() => 0)); },
  empty(cfg) { cfg.matrix = cfg.matrix.map((row) => row.map(() => null)); },
};

/* 瀑布：组件要求「汇总项 = 当前累计值」「带分段的项 value = 分段和」（WATERFALL-01/02/04），
   故改完增减项后按同一规则把汇总项重算一遍——边界造在数据上，等式照样成立 */
const itemValue = (it) => (Array.isArray(it.segments) ? it.segments.reduce((sum, seg) => sum + (seg.value ?? 0), 0) : it.value ?? 0);
function setItemValue(it, v) {
  if (Array.isArray(it.segments)) {
    if (v === 0) it.segments.forEach((seg) => { seg.value = 0; });
    else it.segments[0].value += v - itemValue(it);
    if (it.value != null) it.value = itemValue(it);
  } else {
    it.value = v;
  }
}
function rebalance(items) {
  let cursor = 0;
  items.forEach((it, i) => {
    if (it.kind === 'delta') cursor += itemValue(it);
    else if (i === 0) cursor = itemValue(it);
    else setItemValue(it, cursor);
  });
}
const firstDelta = (cfg) => cfg.items.find((it) => it.kind === 'delta');
const waterfall = {
  long(cfg) {
    cfg.items.forEach((it, i) => {
      it.name = longName(i);
      if (Array.isArray(it.axisLabel)) it.axisLabel = [it.name];
    });
  },
  extreme(cfg) {
    const d = firstDelta(cfg);
    if (d) { setItemValue(d, itemValue(d) * 50); rebalance(cfg.items); }
  },
  gaps(cfg) {
    const d = firstDelta(cfg);
    if (d) { setItemValue(d, 0); rebalance(cfg.items); }
  },
  single(cfg) { cfg.items = cfg.items.slice(0, 1); },
  zero(cfg) { cfg.items.forEach((it) => setItemValue(it, 0)); rebalance(cfg.items); },
  /* 瀑布组件拒绝缺值，全空与全 0 同构 */
  empty(cfg) { cfg.items.forEach((it) => setItemValue(it, 0)); rebalance(cfg.items); },
};

/* 世界地图：组件拒绝缺值（WORLD-HEATMAP-01），「没有数据」的契约是**不出现该国** */
const worldHeatmap = {
  long(cfg) { cfg.regions.forEach((r, i) => { r.name = longName(i); }); },
  extreme(cfg) { if (cfg.regions[0]) cfg.regions[0].value *= 100; },
  gaps(cfg) {
    if (cfg.regions[GAP_ZERO]) cfg.regions[GAP_ZERO].value = 0;
    cfg.regions = cfg.regions.filter((_, i) => i !== GAP_NULL);
  },
  single(cfg) { cfg.regions = cfg.regions.slice(0, 1); },
  zero(cfg) { cfg.regions.forEach((r) => { r.value = 0; }); },
  empty(cfg) { cfg.regions = []; },
};

/* 财报点的 X 轴副标题由数据状态决定（AXIS-09）：数据被场景改过，副标题必须按新数据重算，
   否则会出现「点已经是符合、副标题还写 Missed」 */
const cartesianWithSub = Object.fromEntries(Object.entries(cartesian).map(([id, fn]) => [id, (cfg) => {
  fn(cfg);
  const earnings = cfg.series.find((s) => s.type === 'earnings');
  if (earnings && Array.isArray(cfg.xSub)) cfg.xSub = earnings.data.map((d) => epsSubOf(d ?? {}));
}]));

const TRANSFORMS = {
  cartesian: cartesianWithSub, hbar, pie, radar, treemap, sankey, chord, waterfall, 'world-heatmap': worldHeatmap,
};

/* 无从构造的组合：说明原因，预览面照实显示（不静默显示成「常规」） */
export const SCENARIO_NOTES = {
  sankey: {
    extreme: '桑基的流量必须满足财报恒等式（收入 = 成本 + 毛利…），单独放大一条会被组件拒绝；极端占比请在 sankey-preview 用真实季度数据看',
    gaps: '同上：置 0 / null 会破坏恒等式',
    single: '同上：只留一条流量不构成财报结构',
    zero: '同上：全 0 不构成财报结构',
    empty: '同上：全空不构成财报结构',
  },
};

export function scenarioNote(chart, scenario) {
  if (!scenario || scenario === 'normal') return null;
  if (SCENARIO_NOTES[chart]?.[scenario]) return SCENARIO_NOTES[chart][scenario];
  if (!TRANSFORMS[chart]?.[scenario]) return '该图族尚未定义这个场景';
  return null;
}

/* 主入口：返回新 cfg（不改入参）；normal / 不适用时原样返回 */
export function applyScenario(chart, cfg, scenario = 'normal') {
  const fn = scenario && scenario !== 'normal' ? TRANSFORMS[chart]?.[scenario] : null;
  if (!fn) return cfg;
  const next = clone(cfg);
  fn(next);
  return next;
}
