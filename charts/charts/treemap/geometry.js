/*
 * treemap/geometry.js -- [L2-LOCAL] 矩形树图的纯数据几何。
 *
 * 本文件不碰 DOM / d3：递归汇总、比例压缩与文字适配是矩形树图独有的规则，留在本族内，
 * 同时让 node --test 能直接验证比例与降级顺序。
 */

/* [TREEMAP-01] 父节点未显式给 value 时由可用子节点递归汇总；null / 负值不参与布局。 */
export function aggregateValue(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node.children) && node.children.length) {
    const values = node.children.map(aggregateValue).filter((value) => value != null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }
  if (node.value == null || node.value === '') return null;
  const value = Number(node.value);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/* [TREEMAP-01] 保留声明序号：过滤项目不能导致其余节点颜色槽位重排。 */
export function displayChildren(node) {
  if (!Array.isArray(node?.children)) return [];
  return node.children
    .map((child, index) => ({ node: child, index, value: aggregateValue(child) }))
    .filter((item) => item.value != null && item.value > 0);
}

/*
 * [TREEMAP-02] 同层统一使用一种面积比例。
 * absolute 保持真实比例；approximate 仅在最大/最小值超过上限时，用统一幂指数把跨度压到上限。
 * 例如 1,000,000:1 在 maxRatio=100 时压成 100:1，顺序不变、同层不混用两套尺度。
 */
export function ratioShares(values, mode = 'approximate', maxRatio) {
  if (!values.length) return [];
  if (!['absolute', 'approximate'].includes(mode)) throw new TypeError('ratioMode 仅支持 absolute 或 approximate');
  if (mode === 'approximate' && !(Number(maxRatio) > 0)) {
    throw new TypeError('approximate 面积模式必须传入正数 maxRatio token');
  }
  const safe = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const positive = safe.filter((value) => value > 0);
  if (!positive.length) return safe.map(() => 0);

  let exponent = 1;
  if (mode === 'approximate') {
    const ratio = Math.max(...positive) / Math.min(...positive);
    const limit = Math.max(1, Number(maxRatio));
    if (ratio > limit) exponent = Math.log(limit) / Math.log(ratio);
  }
  const weights = safe.map((value) => value > 0 ? value ** exponent : 0);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const shares = weights.map((value) => value / total);
  const delta = 1 - shares.reduce((sum, value) => sum + value, 0);
  const largest = safe.indexOf(Math.max(...safe));
  shares[largest] += delta;
  return shares;
}

/* [TREEMAP-11] 入口型最多两排，单排内等宽；6 项形成稳定的 3×2 等面积入口。 */
export function entryCells(count, width, height) {
  if (count <= 0) return [];
  const split = Math.ceil(count / 2);
  const rowSizes = count > 3 ? [split, count - split] : [count];
  const rowHeight = height / rowSizes.length;
  let offset = 0;
  const cells = [];
  rowSizes.forEach((rowSize, rowIndex) => {
    const itemWidth = width / rowSize;
    for (let itemIndex = 0; itemIndex < rowSize; itemIndex += 1) {
      cells.push({
        index: offset + itemIndex,
        x0: itemWidth * itemIndex,
        x1: itemIndex === rowSize - 1 ? width : itemWidth * (itemIndex + 1),
        y0: rowHeight * rowIndex,
        y1: rowIndex === rowSizes.length - 1 ? height : rowHeight * (rowIndex + 1),
      });
    }
    offset += rowSize;
  });
  return cells;
}

function balancedLines(text, size, width, measure) {
  const chars = Array.from(text);
  let best = null;
  for (let index = 1; index < chars.length; index += 1) {
    const lines = [chars.slice(0, index).join(''), chars.slice(index).join('')];
    const widths = lines.map((line) => measure(line, size));
    const widest = Math.max(...widths);
    if (widest <= width && (!best || widest < best.widest)) best = { lines, widest };
  }
  return best?.lines ?? null;
}

/*
 * [TREEMAP-05] 静态局部树图的标题优先降级：默认单行 → 默认两行 → 缩小单行 → 缩小两行。
 * 标题稳定后才尝试数值；数值最小 6px，空间不够时隐藏并让标题单独居中。
 */
export function fitTreemapLabel({
  name,
  value,
  width,
  height,
  padding,
  gap,
  nameMax,
  nameMin,
  valueMax,
  valueMin,
  lineExtra,
  valueFontDeviation,
  allowWrap = true,
  includeValue = true,
  measureName,
  measureValue = measureName,
}) {
  if (typeof measureName !== 'function' || typeof measureValue !== 'function') {
    throw new TypeError('fitTreemapLabel 必须由 L1 注入文字测量函数');
  }
  const positive = { nameMax, nameMin, valueMax, valueMin };
  for (const [key, metric] of Object.entries(positive)) {
    if (!(Number(metric) > 0)) throw new TypeError(`fitTreemapLabel 缺少正数 ${key} token`);
  }
  const nonNegative = { padding, gap, lineExtra, valueFontDeviation };
  for (const [key, metric] of Object.entries(nonNegative)) {
    if (!Number.isFinite(Number(metric)) || Number(metric) < 0) {
      throw new TypeError(`fitTreemapLabel 缺少非负 ${key} token`);
    }
  }
  const text = String(name ?? '');
  const valueText = String(value ?? '');
  const availableWidth = Math.max(0, width - padding * 2);
  const availableHeight = Math.max(0, height - padding * 2);
  const maxNameSize = Math.max(nameMin, nameMax);
  const minNameSize = Math.min(nameMin, maxNameSize);
  if (!text || availableWidth <= 0 || availableHeight <= 0) return null;

  const minimumSample = Array.from(text).slice(0, Math.min(2, Array.from(text).length)).join('');
  if (measureName(minimumSample, minNameSize) > availableWidth) return null;

  const sizes = [];
  for (let size = Math.floor(maxNameSize) - 1; size >= Math.ceil(minNameSize); size -= 1) sizes.push(size);
  const attempts = [
    [maxNameSize, 1],
    ...(allowWrap ? [[maxNameSize, 2]] : []),
    ...sizes.map((size) => [size, 1]),
    ...(allowWrap ? sizes.map((size) => [size, 2]) : []),
  ];

  let title = null;
  for (const [size, lineCount] of attempts) {
    const lines = lineCount === 1
      ? (measureName(text, size) <= availableWidth ? [text] : null)
      : balancedLines(text, size, availableWidth, measureName);
    const lineHeight = size + lineExtra;
    if (lines && lines.length * lineHeight <= availableHeight) {
      title = { lines, size, lineHeight, height: lines.length * lineHeight };
      break;
    }
  }
  if (!title) return null;

  let fittedValue = null;
  if (includeValue && valueText) {
    const preferred = Math.min(valueMax, Math.max(valueMin, title.size - valueFontDeviation));
    for (let size = Math.floor(preferred); size >= Math.ceil(valueMin); size -= 1) {
      const lineHeight = size + lineExtra;
      if (measureValue(valueText, size) <= availableWidth
        && title.height + gap + lineHeight <= availableHeight) {
        fittedValue = { text: valueText, size, lineHeight };
        break;
      }
    }
  }

  return {
    nameLines: title.lines,
    nameSize: title.size,
    nameLineHeight: title.lineHeight,
    valueText: fittedValue?.text ?? null,
    valueSize: fittedValue?.size ?? null,
    valueLineHeight: fittedValue?.lineHeight ?? 0,
    blockHeight: title.height + (fittedValue ? gap + fittedValue.lineHeight : 0),
  };
}

export function resolvePath(root, indexes = []) {
  let node = root;
  for (const index of indexes) {
    if (!Array.isArray(node?.children) || !node.children[index]) return root;
    node = node.children[index];
  }
  return node;
}

export function pathNames(root, indexes = []) {
  const names = [root?.name ?? '全部'];
  let node = root;
  for (const index of indexes) {
    node = node?.children?.[index];
    if (!node) break;
    names.push(node.name);
  }
  return names;
}
