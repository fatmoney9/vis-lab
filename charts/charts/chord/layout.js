/*
 * chord/layout.js —— 【矩阵校验 + 槽位 + 角度分配 + 外圈环带 / 弦路径 + 画布几何】
 * [CHORD-01..08/10/18]
 *
 * 干什么：把「每个实体占多少角、每条弦从哪连到哪、圆画多大」算成**纯数据**，
 * 交给 index.js 去画。不碰 DOM、不碰 d3、不碰 token；唯一的 import 是同样零依赖的
 * core/polar-label.js，故可被 `node --test` 直接加载（同 pie/geometry.js、radar/geometry.js）。
 *
 * **不使用 d3.chord() / d3.ribbon()**，判据与桑基不用 d3-sankey 相同，见 specs/chord.md
 * 「分层边界」：D3 在本仓库只做计算与 DOM 装配，不用它的高层图表封装。
 *
 * 角度约定由 core/polar-label.js 统一：0 弧度 = 12 点方向，正角顺时针。
 */
import { pointAt, labelBand } from '../../core/polar-label.js';

const TAU = Math.PI * 2;

const clamp = (lo, v, hi) => Math.max(lo, Math.min(v, hi));

/*
 * 路径坐标保留 3 位小数（≈0.001px，远细于显示精度）。
 * 三角函数会产出 17 位浮点，一张 n=10 的 directed 图有 90 条弦、近千个数字，
 * 不截断的 SVG 体积会大出数倍；截断不参与任何几何判定，只影响 d 属性的书写。
 */
const f = (v) => Number(v.toFixed(3));
const at = (a, r) => { const p = pointAt(a, r); return `${f(p.x)},${f(p.y)}`; };

/* [CHORD-07] 大弧标志：跨度超过半圈才置 1。
   ⚠️ 跨度 ≤ π 时取 0 或 1 画出来一模一样，**均匀数据永远测不出写错**——
   单测必须直接断言本函数，验收必须造「单实体占比 > 50%」的夹具。 */
const largeArc = (span) => (span > Math.PI ? 1 : 0);

/* [CHORD-01] 实体数下限。两个实体的往来用一对数字就说清了，构不成「相互流动」。 */
export const MIN_ENTITIES = 3;

export const CHORD_VARIANTS = Object.freeze(['undirected', 'directed']);
export const CHORD_LABEL_LAYOUTS = Object.freeze(['arc', 'horizontal']);

/*
 * [CHORD-01] 校验并归一化输入。返回 { entities, matrix, n, variant, entityLabelLayout }。
 *
 * 归零而不报错的三类：负值 / 非有限数 / null —— 口径对齐 PIE-01 与 RADAR-01
 * 「不占角也不进分母」。**对角线一律按 0**：实体流向自身在本族没有语义，
 * 画成自环只会挡住圆心。
 *
 * 会抛错的只有「结构不对」：不是数组、不是方阵、某一行长度不等、实体数不足、名称重复。
 * ⚠️ 行长度必须**逐行**校验——只看首行是这类校验的典型漏洞。
 */
export function assertChordConfig(config) {
  const entities = config?.entities;
  if (!Array.isArray(entities)) {
    throw new TypeError('ChordChart：entities 必须是字符串数组');
  }
  const n = entities.length;
  if (n < MIN_ENTITIES) {
    throw new RangeError(
      `ChordChart：实体数至少 ${MIN_ENTITIES} 个，当前 ${n} 个——更少的往来用一对数字就说清了`,
    );
  }
  entities.forEach((name, i) => {
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError(`ChordChart：entities[${i}] 必须是非空字符串`);
    }
  });
  if (new Set(entities).size !== n) {
    throw new RangeError('ChordChart：entities 名称必须唯一——它同时是实体的标识与标签');
  }

  const matrix = config?.matrix;
  if (!Array.isArray(matrix) || matrix.length !== n) {
    throw new RangeError(
      `ChordChart：matrix 必须是 ${n}×${n} 方阵，当前有 ${Array.isArray(matrix) ? matrix.length : '非数组'} 行`,
    );
  }
  const clean = matrix.map((row, i) => {
    if (!Array.isArray(row) || row.length !== n) {
      throw new RangeError(
        `ChordChart：matrix 第 ${i} 行长度应为 ${n}，实际 ${Array.isArray(row) ? row.length : '非数组'}`,
      );
    }
    return row.map((v, j) => (
      i === j || !Number.isFinite(v) || v <= 0 ? 0 : v
    ));
  });

  const variant = config?.variant ?? 'undirected';
  if (!CHORD_VARIANTS.includes(variant)) {
    throw new TypeError(`ChordChart：variant 仅支持 ${CHORD_VARIANTS.join(' / ')}`);
  }
  const entityLabelLayout = config?.entityLabelLayout ?? 'arc';
  if (!CHORD_LABEL_LAYOUTS.includes(entityLabelLayout)) {
    throw new TypeError(`ChordChart：entityLabelLayout 仅支持 ${CHORD_LABEL_LAYOUTS.join(' / ')}`);
  }

  return { entities, matrix: clean, n, variant, entityLabelLayout };
}

/*
 * [CHORD-05] 槽位表 —— **两档 variant 的唯一差异就在这里**。
 *
 *   undirected：实体 i 对每个对手方一个槽，值 = matrix[i][j]
 *               → 弧跨度 = 该实体的**总流出**
 *   directed  ：实体 i 对每个对手方两个槽（出 matrix[i][j]、入 matrix[j][i]），按对手方声明序交替
 *               → 弧跨度 = **总流出 + 总流入**
 *
 * ⚠️ 同一份数据两档下外圈弧长不同，这是模型的必然结果不是 bug（CHORD-05）。
 *
 * [CHORD-02] 槽位顺序恒按对手方声明序，**不按值排序**：示例的实体数可调，
 * 按值排序会让每加一个实体整个环重排，反而看不出「多了一个实体」这件事。
 *
 * undirected 下单向流量（matrix[i][j] > 0 而 matrix[j][i] === 0）仍要给对端留一个
 * **零宽槽位**：它不占角（CHORD-18），但给弦的末端提供落点，否则那笔流量整条画不出来。
 */
export function chordSlots(matrix, variant) {
  const n = matrix.length;
  return matrix.map((row, i) => {
    const slots = [];
    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      if (variant === 'directed') {
        if (matrix[i][j] > 0) slots.push({ partner: j, dir: 'out', value: matrix[i][j] });
        if (matrix[j][i] > 0) slots.push({ partner: j, dir: 'in', value: matrix[j][i] });
      } else if (matrix[i][j] > 0 || matrix[j][i] > 0) {
        slots.push({ partner: j, dir: 'out', value: matrix[i][j] });
      }
    }
    return {
      index: i,
      total: slots.reduce((sum, slot) => sum + slot.value, 0),
      slots,
    };
  });
}

/*
 * [CHORD-18] 把一组正值按比例摊到 total，同时保证每份不小于 minAngle。
 *
 * 做法：按比例分 → 低于下限的抬到下限并**钉住** → 用剩余空间重分其余 → 重复到稳定。
 * 每轮至少钉住一个，故至多 n 轮收敛；钉住集合只增不减，所以不会来回震荡。
 * 总和恒等于 total（钉住部分 + 剩余空间），这是 CHORD-03 那条不变量的前提。
 *
 * minAngle × 份数 ≥ total 时无解（下限本身就超额），退化为等分——
 * 这时图已经密到读不出，等分至少不会让某几份凭空消失。
 */
function shareWithMinimum(values, total, minAngle) {
  const count = values.length;
  if (count === 0) return [];
  if (minAngle * count >= total) return values.map(() => total / count);

  const out = values.slice();
  const pinned = new Array(count).fill(false);
  for (let pass = 0; pass < count; pass += 1) {
    let pinnedSum = 0;
    let freeSum = 0;
    for (let i = 0; i < count; i += 1) {
      if (pinned[i]) pinnedSum += out[i];
      else freeSum += out[i];
    }
    const room = total - pinnedSum;
    const k = freeSum > 0 ? room / freeSum : 0;
    let changed = false;
    for (let i = 0; i < count; i += 1) {
      if (pinned[i]) continue;
      const scaled = out[i] * k;
      if (scaled < minAngle) {
        out[i] = minAngle;
        pinned[i] = true;
        changed = true;
      } else {
        out[i] = scaled;
      }
    }
    if (!changed) break;
  }
  return out;
}

/*
 * [CHORD-03][CHORD-04] 角度分配。首个实体从 0 弧度（12 点）起顺时针累加。
 *
 * pad 必须夹取：n·pad 随实体数线性增长，而实体数是示例旋钮可调的——
 * **上限要由公式保证，不能靠「默认值恰好不出事」**。
 *
 * 不变量：Σ(实体弧跨度) + n·pad ≡ 2π。
 */
export function chordAngles(groups, { padAngle, padMaxShare, minSlotAngle = 0 }) {
  const n = groups.length;
  const pad = Math.min(padAngle, (padMaxShare * TAU) / n);
  const available = TAU - n * pad;

  /* 全零矩阵：没有任何正值槽位，实体等分整圈只画外圈占位（CHORD-01 不抛错） */
  const positive = groups.flatMap((g) => g.slots.filter((s) => s.value > 0));
  const sum = positive.reduce((acc, s) => acc + s.value, 0);
  if (sum <= 0) {
    let cursor = 0;
    const span = available / n;
    return {
      pad,
      empty: true,
      groups: groups.map((g) => {
        const a0 = cursor;
        const a1 = a0 + span;
        cursor = a1 + pad;
        return { ...g, a0, a1, slots: g.slots.map((s) => ({ ...s, a0, a1: a0 })) };
      }),
    };
  }

  const shared = shareWithMinimum(positive.map((s) => s.value), available, minSlotAngle);
  const angleOf = new Map();
  positive.forEach((slot, i) => angleOf.set(slot, shared[i]));

  let cursor = 0;
  const laidOut = groups.map((g) => {
    const a0 = cursor;
    let slotCursor = a0;
    const slots = g.slots.map((slot) => {
      const span = angleOf.get(slot) ?? 0;
      const s0 = slotCursor;
      slotCursor += span;
      return { ...slot, a0: s0, a1: slotCursor };
    });
    const a1 = slotCursor;
    cursor = a1 + pad;
    return { ...g, a0, a1, slots };
  });

  return { pad, empty: false, groups: laidOut };
}

/*
 * [CHORD-07] 外圈环带：外弧顺时针 + 内弧逆时针回来 + 闭合。
 * ⚠️ 内弧 sweep 必须是 0（反向）；写成 1 会得到一个自交的蝴蝶结。
 */
export function arcPath(a0, a1, rOuter, rInner) {
  const laf = largeArc(a1 - a0);
  return `M${at(a0, rOuter)}A${f(rOuter)},${f(rOuter)} 0 ${laf} 1 ${at(a1, rOuter)}`
    + `L${at(a1, rInner)}A${f(rInner)},${f(rInner)} 0 ${laf} 0 ${at(a0, rInner)}Z`;
}

/* 一段弧的中点落在半径 r 上的坐标。渐变轴的两个端点都由它给。 */
const midpointOf = ({ a0, a1 }, r) => pointAt((a0 + a1) / 2, r);

/*
 * [CHORD-06] 目标端按比例绕中点对称收窄。taper = 1 是**恒等元**，
 * 故 undirected 档走的是同一条代码路径，不是另一个分支。
 */
export function taperedSpan({ a0, a1 }, taper) {
  const mid = (a0 + a1) / 2;
  const half = ((a1 - a0) / 2) * clamp(0, taper, 1);
  return { a0: mid - half, a1: mid + half };
}

/*
 * [CHORD-07] 弦：两段沿内圆的弧 + 两段**以圆心为唯一控制点**的二次贝塞尔。
 * 比桑基的三次贝塞尔带更简单——向心收束是弦图的固有形态，不需要张力参数。
 */
export function ribbonPath(source, target, r, taper = 1) {
  const t = taperedSpan(target, taper);
  return `M${at(source.a0, r)}`
    + `A${f(r)},${f(r)} 0 ${largeArc(source.a1 - source.a0)} 1 ${at(source.a1, r)}`
    + `Q0,0 ${at(t.a0, r)}`
    + `A${f(r)},${f(r)} 0 ${largeArc(t.a1 - t.a0)} 1 ${at(t.a1, r)}`
    + `Q0,0 ${at(source.a0, r)}Z`;
}

/*
 * [CHORD-06][CHORD-08] 配对。
 *   undirected：每个无序对 (i<j) 一条弦，两端分别是 i、j 各自朝对方的槽位
 *   directed  ：每个有序对 (i,j) 一条弦，源 = i 的出槽、目标 = j 的入槽（两端等宽）
 *
 * [CHORD-08] 弦不取单色：两端各自带着自己实体的颜色，沿弦渐变（渐变轴见 layoutChord）。
 * 故这里不再算「哪一端更宽」——i 与 j 就是两端的实体序号，取色交给渲染层。
 */
export function chordRibbons(groups, variant) {
  const slotOf = (i, partner, dir) => groups[i]?.slots
    .find((s) => s.partner === partner && s.dir === dir);
  const ribbons = [];
  const n = groups.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const directed = variant === 'directed';
      if (!directed && j < i) continue;
      const source = slotOf(i, j, 'out');
      const target = directed ? slotOf(j, i, 'in') : slotOf(j, i, 'out');
      if (!source || !target) continue;
      if (source.value <= 0 && target.value <= 0) continue;
      ribbons.push({
        i,
        j,
        source,
        target,
        sourceValue: source.value,
        targetValue: target.value,
        key: directed ? `${i}->${j}` : `${i}-${j}`,
      });
    }
  }
  return ribbons;
}

/*
 * [CHORD-10] 画布几何。**两档标签的画布形状不同**，这不是可以统一的两种写法：
 *
 *   arc 档 —— 文字沿圆周切向排布，四周占位一样宽，故画布是**正方形**，只吃 min(宽, 高)。
 *   horizontal 档 —— 文字径向摆出：左右两侧是**整串文字**（四个汉字 @12px 要 48px），
 *     上下只有**一行**（约一个行高）。这与雷达 RADAR-09 的非对称完全相同，故也照它
 *     **横竖分开**：横向带吃宽度的剩余并封顶，纵向带由文字行高决定。
 *
 * ⚠️ 早先两档共用「正方形 + min(宽,高)」，结果横排档的带宽被**高度**决定——容器没给高时
 * 退到 --size-chord-container(200)，带宽只剩 20px，四个汉字一个都放不下、整层标签渲染成空。
 * 横排档的文字往左右伸，带宽就该由宽度定，与高度无关。
 *
 * 两档共同的顺序（无循环依赖）：
 *   ① 带宽 —— arc 由文字墨迹定；horizontal 的横向带吃剩余并封顶
 *   ② R = clamp(下限, 可用半宽 − 带宽, maxRadius)
 *   ③ 画布 = 图元外接框，**不吃满容器**
 *
 * 缩小容器时标签带先被挤掉、半径后缩；R 触到 50% 下限后改为溢出由调用方裁剪
 * （PIE-02「看得见但装不下，优于装得下但看不清」）。
 */
export function chordFrame(width, height, {
  maxRadius, ring, labelLayout = 'arc', inkBand = 0, maxBand = Infinity, minRadiusRatio = 0.5,
}) {
  const floor = Math.max(0, maxRadius) * minRadiusRatio;
  const band = Math.max(0, inkBand);
  let R;
  let bandH;
  let bandV;

  if (labelLayout === 'horizontal') {
    bandV = band; /* 上下只有一行字：由行高决定，与容器无关 */
    R = clamp(floor, Math.min(width / 2, (height - 2 * bandV) / 2), maxRadius);
    bandH = labelBand(width, R, maxBand); /* 横向带吃宽度的剩余，封顶而非定值 */
  } else {
    const avail = Math.min(width, height);
    R = clamp(floor, avail / 2 - band, maxRadius);
    bandH = band;
    bandV = band;
  }

  return {
    R,
    rOuter: R,
    rInner: Math.max(0, R - Math.max(0, ring)),
    /* band = 标签的**可用宽度预算**，横排档即横向带；arc 档的预算是各自那条弧，不用它 */
    band: bandH,
    bandV,
    width: 2 * (R + bandH),
    height: 2 * (R + bandV),
    /* 图元触底时的高度，调用方拿它推容器下限——免得在别处再抄一遍 50% 这个比例 */
    minSize: 2 * (floor + bandV),
  };
}

/*
 * 顶层装配：校验 → 槽位 → 角度 → 配对 → 画布。纯数据，零 DOM。
 * bounds = { width, height, inkBand? }；style = resolveChordSettings(platform) + token 尺寸
 */
export function layoutChord(config, bounds, style) {
  const { entities, matrix, n, variant, entityLabelLayout } = assertChordConfig(config);
  const geometry = style.geometry;
  const angled = chordAngles(chordSlots(matrix, variant), {
    padAngle: geometry['pad-angle'],
    padMaxShare: geometry['pad-angle-max-share'],
    minSlotAngle: geometry['min-slot-angle'],
  });
  const frame = chordFrame(bounds.width, bounds.height, {
    maxRadius: style.maxRadius,
    ring: style.ring,
    labelLayout: entityLabelLayout,
    inkBand: bounds.inkBand ?? 0,
    maxBand: style.maxBand ?? Infinity,
    minRadiusRatio: geometry['min-radius-ratio'],
  });
  const ribbons = angled.empty ? [] : chordRibbons(angled.groups, variant);

  return {
    entities,
    matrix,
    n,
    variant,
    entityLabelLayout,
    empty: angled.empty,
    pad: angled.pad,
    ...frame,
    groups: angled.groups.map((g) => ({
      ...g,
      name: entities[g.index],
      path: arcPath(g.a0, g.a1, frame.rOuter, frame.rInner),
      /* 行和 / 列和：看板要用，几何不用。放在这里是为了让 model.js 不必再遍历一次矩阵 */
      outflow: matrix[g.index].reduce((s, v) => s + v, 0),
      inflow: matrix.reduce((s, row) => s + row[g.index], 0),
    })),
    ribbons: ribbons.map((r) => {
      const taper = variant === 'directed' ? geometry['directed-taper'] : 1;
      /* [CHORD-08] 渐变轴 = 源端弧中点 → 目标端弧中点，都落在内圆上。
         取**两端各自的中点**而不是圆心或包围盒对角：弦是贴着内圆两段弧之间的带，
         只有这条轴上的两个端点才真的是「这一端」和「那一端」，换别的轴会让某一端
         的颜色在自己那头就已经混掉。有向档目标端收窄，故用收窄后的区间取中点。 */
      const source = midpointOf(r.source, frame.rInner);
      const target = midpointOf(taperedSpan(r.target, taper), frame.rInner);
      return {
        ...r,
        path: ribbonPath(r.source, r.target, frame.rInner, taper),
        gradient: { x1: source.x, y1: source.y, x2: target.x, y2: target.y },
      };
    }),
  };
}
