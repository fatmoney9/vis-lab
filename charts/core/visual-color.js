/*
 * L1 · 数据项视觉颜色解析。权威规则见 specs/color.md COLOR-06/09。
 *
 * 只认识通用颜色语义：系列槽位、强度和有符号语义值；不知道图表类型、主题或业务字段。
 * 主题值由上游 palette / token 提供，调用方只传已经归一化的数值数组。
 */

export const ITEM_COLOR_MODES = ['series', 'intensity', 'semantic-binned', 'semantic-flat'];

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const levelOpacity = (level) => `var(--opacity-visualization-level-${level})`;

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

function semanticFill(value) {
  if (value === 0) return 'var(--color-grey-05)';
  return `var(--color-price-${value > 0 ? 'up' : 'down'})`;
}

function semanticLevel(value, thresholds) {
  if (value === 0) return 5;
  const magnitude = Math.abs(value);
  if (magnitude <= thresholds[0]) return 1;
  if (magnitude <= thresholds[1]) return 3;
  return 5;
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
  if (
    mode === 'semantic-binned'
    && (!Array.isArray(thresholds) || thresholds.length !== 2 || thresholds.some((value) => !(value > 0)))
  ) {
    throw new TypeError('semantic-binned 模式必须传入两个正数阈值 token');
  }

  const semantics = values.map((_, index) => finite(semanticValues[index]));
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
    fill: semanticFill(semanticValue),
    opacity: levelOpacity(mode === 'semantic-binned' ? semanticLevel(semanticValue, thresholds) : 5),
    semanticValue,
  }));
}
