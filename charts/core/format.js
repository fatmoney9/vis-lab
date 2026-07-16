/*
 * [FORMAT-01] 数值显示格式（主题分化，权威定义见 specs/format.md）。
 * 参数来自 behavior.json 的 number-format 键；本模块把参数变成格式化函数，
 * 坐标轴 / tooltip / 数据标签共用。
 *   cn    —— 万 / 千万 / 亿 / 兆，1 万起换算
 *   en    —— K / M / B / T，min-abbr（默认 1 万）起缩写
 *   plain —— 千分位原值
 * 通用：负值取绝对值换算后加负号；去尾零；null/NaN → '—'。
 */
const CN_UNITS = [
  [1e12, '兆'],
  [1e8, '亿'],
  [1e7, '千万'],
  [1e4, '万'],
];
const EN_UNITS = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

export function makeFormatter(params = {}) {
  const system = params.system ?? 'plain';
  const decimals = params['max-decimals'] ?? 2;
  const minAbbr = params['min-abbr'] ?? 1e4;
  /* Intl 按上限舍入并去尾零；中文体系不加千分位，en/plain 加 */
  const nf = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    useGrouping: system !== 'cn',
  });
  const units = system === 'cn' ? CN_UNITS : system === 'en' ? EN_UNITS : null;
  const gate = system === 'cn' ? 1e4 : system === 'en' ? Math.max(minAbbr, 1e3) : Infinity;

  return (v) => {
    if (v == null || Number.isNaN(v)) return '—';
    const abs = Math.abs(v);
    if (units && abs >= gate) {
      for (const [factor, suffix] of units) {
        if (abs >= factor) return nf.format(v / factor) + suffix;
      }
    }
    return nf.format(v);
  };
}
