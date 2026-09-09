/*
 * L1 · 数据项视觉颜色解析。权威规则见 specs/color.md COLOR-06/09。
 *
 * 只认识通用颜色语义：系列槽位、强度和有符号语义值；不知道图表类型、主题或业务字段。
 * 主题值由上游 palette / token 提供，调用方只传已经归一化的数值数组。
 */

export const ITEM_COLOR_MODES = ['series', 'intensity', 'semantic-binned', 'semantic-flat'];
export const PERFORMANCE_COLOR_LEVELS = 6;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const levelOpacity = (level) => `var(--opacity-visualization-intensity-level-${level})`;

/* [COLOR-10] 从低表现到高表现的通用六级语义色阶。调用方可请求任意档数；
 * 少于 / 多于六档时按归一化位置投影到最近的权威色阶，不在 L2 复制档位算法。
 * 返回 CSS token 引用而不是解析后的色值，明暗与主题切换继续交给级联。
 *
 * ⚠️ 正中间那一档（投影落在 x.5）**向下取**，不用 Math.round 的向上取整：
 * 五档时向上会得到 1/2/4/5/6，既跳过中性黄 level-3、又留下 level-5 与 level-6 两档
 * 肉眼难分的绿——离散色带因此少一个可读台阶，且「0%」这种中性档拿到偏正面的黄绿。
 * 向下取得到 1/2/3/5/6：中性档回到黄，被合并的是本就相近的那对绿。 */
const nearestLevel = (position) => Math.ceil(position - 0.5);

export function performanceColorRamp(levelCount = PERFORMANCE_COLOR_LEVELS) {
  const count = Math.max(2, Math.floor(Number(levelCount) || PERFORMANCE_COLOR_LEVELS));
  return Array.from({ length: count }, (_, index) => {
    const level = 1 + nearestLevel((index / (count - 1)) * (PERFORMANCE_COLOR_LEVELS - 1));
    return `var(--color-performance-level-${level})`;
  });
}

/* [COLOR-09] 数值秩等距分入最多五档；并列值同档，最高值恒为最深档。 */
export function intensityLevels(values, levelCount = 5) {
  const count = Math.max(1, Math.floor(levelCount));
  const metrics = values.map((value) => finite(value));
  const unique = [...new Set(metrics)].sort((a, b) => a - b);
  if (unique.length <= 1) return metrics.map(() => count);
  const ranks = new Map(unique.map((value, index) => [value, index]));
  return metrics.map((value) => 1 + Math.round(
    (ranks.get(value) / (unique.length - 1)) * (count - 1),
  ));
}

function semanticFlatFill(value) {
  if (value === 0) return 'var(--color-price-even-gradient)';
  return `var(--color-price-${value > 0 ? 'up' : 'down'}-gradient-1)`;
}

function semanticLevel(value, thresholds) {
  if (value === 0) return null;
  const magnitude = Math.abs(value);
  if (magnitude <= thresholds[0]) return 3;
  if (magnitude <= thresholds[1]) return 2;
  return 1;
}

function semanticGradientFill(value, thresholds) {
  if (value === 0) return 'var(--color-price-even-gradient)';
  const direction = value > 0 ? 'up' : 'down';
  return `var(--color-price-${direction}-gradient-${semanticLevel(value, thresholds)})`;
}

/*
 * [COLOR-09] 返回与 values 一一对应的 { fill, opacity, semanticValue }。
 * mode 只表达通用视觉策略；字段提取与模式选择分别归数据适配层和 behavior。
 */
export function resolveItemColors({
  mode,
  values,
  semanticValues = [],
  seriesColors = [],
  primaryColor,
  thresholds,
}) {
  if (!ITEM_COLOR_MODES.includes(mode)) throw new TypeError(`不支持的数据项颜色模式：${mode}`);
  if (!Array.isArray(values)) throw new TypeError('数据项颜色必须接收 values 数组');
  if (mode === 'series' && seriesColors.length < values.length) {
    throw new TypeError('series 模式缺少与数据项一一对应的系列色');
  }
  if (mode === 'intensity' && typeof primaryColor !== 'string') {
    throw new TypeError('intensity 模式必须传入主题单系列主色');
  }
  const semanticMode = mode === 'semantic-binned' || mode === 'semantic-flat';
  if (semanticMode && (!Array.isArray(semanticValues) || semanticValues.length !== values.length)) {
    throw new TypeError('语义颜色模式必须传入与 values 等长的 semanticValues');
  }
  if (mode === 'semantic-binned') {
    const [lower, upper] = Array.isArray(thresholds) ? thresholds.map(Number) : [];
    if (
      thresholds?.length !== 2
      || !Number.isFinite(lower)
      || !Number.isFinite(upper)
      || !(lower > 0 && lower < upper)
    ) {
      throw new TypeError('semantic-binned 模式必须传入两个有限、递增的正数业务阈值');
    }
  }

  const semantics = values.map((_, index) => {
    const rawSemanticValue = semanticValues[index];
    const semanticValue = Number(rawSemanticValue);
    if (
      semanticMode
      && (
        rawSemanticValue == null
        || (typeof rawSemanticValue === 'string' && rawSemanticValue.trim() === '')
        || !Number.isFinite(semanticValue)
      )
    ) {
      throw new TypeError(`语义颜色模式的 semanticValues[${index}] 必须是有限数`);
    }
    return Number.isFinite(semanticValue) ? semanticValue : 0;
  });
  if (mode === 'series') {
    return values.map((_, index) => ({
      fill: seriesColors[index], opacity: null, semanticValue: semantics[index],
    }));
  }
  if (mode === 'intensity') {
    const levels = intensityLevels(values);
    return values.map((_, index) => ({
      fill: primaryColor, opacity: levelOpacity(levels[index]), semanticValue: semantics[index],
    }));
  }
  return semantics.map((semanticValue) => ({
    fill: mode === 'semantic-binned'
      ? semanticGradientFill(semanticValue, thresholds)
      : semanticFlatFill(semanticValue),
    opacity: null,
    semanticValue,
  }));
}
