/*
 * [L2-LOCAL] 瀑布图专属数据模型：把有符号增减项展开为累计区间，分组数据柱进一步展开为段。
 * 本文件零 DOM / 零 d3，公式可由 node 单测直接验证。
 */
export const WATERFALL_VARIANTS = Object.freeze(['standard', 'data']);
export const WATERFALL_KINDS = Object.freeze(['total', 'delta', 'subtotal']);
export const WATERFALL_X_CONTENTS = Object.freeze(['name', 'name-value']);

const finite = (value, where) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`WaterfallChart：${where} 必须是有限数`);
  return number;
};

const closeEnough = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-9;

function normalizedSegments(item, index) {
  if (item.segments == null) return null;
  if (!Array.isArray(item.segments) || item.segments.length === 0) {
    throw new TypeError(`WaterfallChart：items[${index}].segments 必须是非空数组`);
  }
  const ids = new Set();
  return item.segments.map((segment, segmentIndex) => {
    if (!segment || typeof segment !== 'object') {
      throw new TypeError(`WaterfallChart：items[${index}].segments[${segmentIndex}] 必须是对象`);
    }
    const id = String(segment.id ?? `${item.id ?? index}-${segmentIndex}`);
    if (ids.has(id)) throw new TypeError(`WaterfallChart：items[${index}] 的 segment id「${id}」重复`);
    ids.add(id);
    return {
      ...segment,
      id,
      name: String(segment.name ?? ''),
      value: finite(segment.value, `items[${index}].segments[${segmentIndex}].value`),
    };
  });
}

/*
 * [WATERFALL-01/02/04]
 * delta：start = 上一项累计值，end = start + value；
 * total/subtotal：从 0 画到当前累计值，并要求与前一项累计结果相等；
 * segments：在该项自己的 start→end 区间内按声明序累计，和值必须等于 item.value。
 */
export function resolveWaterfall(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError('WaterfallChart：items 必须是非空数组');
  }
  const ids = new Set();
  let cursor = 0;
  const resolved = items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError(`WaterfallChart：items[${index}] 必须是对象`);
    const id = String(item.id ?? index);
    if (ids.has(id)) throw new TypeError(`WaterfallChart：item id「${id}」重复`);
    ids.add(id);
    const kind = item.kind;
    if (!WATERFALL_KINDS.includes(kind)) {
      throw new TypeError(`WaterfallChart：items[${index}].kind 仅支持 ${WATERFALL_KINDS.join(' / ')}`);
    }

    const sourceSegments = normalizedSegments(item, index);
    const segmentSum = sourceSegments?.reduce((sum, segment) => sum + segment.value, 0);
    const value = item.value == null && sourceSegments
      ? segmentSum
      : finite(item.value, `items[${index}].value`);
    if (sourceSegments && !closeEnough(value, segmentSum)) {
      throw new TypeError(`WaterfallChart：items[${index}] 的 value 必须等于 segments 有符号和值`);
    }

    const start = kind === 'delta' ? cursor : 0;
    const end = kind === 'delta' ? cursor + value : value;
    if (index > 0 && kind !== 'delta' && !closeEnough(end, cursor)) {
      throw new TypeError(`WaterfallChart：items[${index}] 的汇总值 ${end} 与当前累计值 ${cursor} 不一致`);
    }

    let segmentCursor = start;
    const segments = (sourceSegments ?? [{ id: `${id}-value`, name: item.name, value }]).map((segment) => {
      const segmentStart = segmentCursor;
      const segmentEnd = segmentStart + segment.value;
      segmentCursor = segmentEnd;
      return { ...segment, start: segmentStart, end: segmentEnd };
    });
    if (!closeEnough(segmentCursor, end)) {
      throw new TypeError(`WaterfallChart：items[${index}] 的分段终点与柱体终点不一致`);
    }

    cursor = end;
    return {
      ...item,
      id,
      name: String(item.name ?? ''),
      kind,
      value,
      start,
      end,
      segments,
      hasSegments: Boolean(sourceSegments),
    };
  });

  const connectors = resolved.slice(1).map((item, index) => ({
    id: `${resolved[index].id}->${item.id}`,
    source: resolved[index].id,
    target: item.id,
    level: resolved[index].end,
  }));
  return { items: resolved, connectors, total: cursor };
}

/* [WATERFALL-06] 比例尺覆盖所有浮动区间端点并显式并入 0 轴。 */
export function waterfallExtent(resolvedItems) {
  const values = [0];
  for (const item of resolvedItems) {
    values.push(item.start, item.end);
    for (const segment of item.segments ?? []) values.push(segment.start, segment.end);
  }
  return [Math.min(...values), Math.max(...values)];
}
