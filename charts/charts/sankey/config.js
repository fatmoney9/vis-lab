/*
 * [L2-LOCAL][SANKEY-03..09/13/15/18/23/24]
 * 桑基跨主题不变的几何、标签范围与播放参数。主题色和字体只引用全局 token。
 */
export const SANKEY_SETTINGS = Object.freeze({
  geometry: Object.freeze({
    'primary-node-width': 24,
    'node-width': 12,
    'primary-node-height': Object.freeze({ pc: 240, mobile: 120 }),
    'node-gap': Object.freeze({ pc: 24, mobile: 12 }),
    'multi-node-span-base-ratio': 0.7,
    'third-node-span-ratio': 0.3,
    'zero-flow-size': 1,
    'node-min-height': 1,
    'edge-min-thickness': 1,
    'canvas-min-height': Object.freeze({ pc: 288, mobile: 168 }),
    'canvas-recommended-height': Object.freeze({ pc: 384, mobile: 203 }),
    'sequence-height-step': 4,
    'canvas-padding-x': Object.freeze({ pc: 120, mobile: 84 }),
    'canvas-padding-y': 24,
    'label-gap': 8,
    'label-title-width': 96,
    'label-title-font-size-min': 10,
    'label-title-font-size-max': 12,
    'label-value-font-size-min': 11,
    'label-value-font-size-max': 14,
    'column-gap': 24,
    'legend-reserved-height': 40,
    'edge-opacity': 0.2,
    'edge-highlight-opacity': 0.64,
    'centerline-attraction': 0.8,
    'curve-tension': 0.5,
    'dense-edge-label-threshold': 8,
  }),
  motion: Object.freeze({
    'playback-label-lead-duration': 120,
    'playback-duration': 720,
    'playback-easing': 'cubic-out',
  }),
});

const unfold = (value, platform) => (
  value !== null
  && typeof value === 'object'
  && ('mobile' in value || 'pc' in value)
    ? value[platform]
    : value
);

function validateSettings() {
  const { geometry, motion } = SANKEY_SETTINGS;
  if (
    !Number.isFinite(motion['playback-label-lead-duration'])
    || motion['playback-label-lead-duration'] < 0
    || !Number.isFinite(motion['playback-duration'])
    || motion['playback-duration'] <= 0
    || motion['playback-easing'] !== 'cubic-out'
  ) {
    throw new Error('Sankey 配置：播放动效必须配置正时长与 cubic-out 缓动');
  }
  if (
    !Number.isFinite(geometry['centerline-attraction'])
    || geometry['centerline-attraction'] < 0
    || geometry['centerline-attraction'] > 1
  ) {
    throw new Error('Sankey 配置：centerline-attraction 必须是 0 到 1 之间的数值');
  }
  for (const key of ['multi-node-span-base-ratio', 'third-node-span-ratio']) {
    if (!Number.isFinite(geometry[key]) || geometry[key] <= 0) {
      throw new Error(`Sankey 配置：${key} 必须是正数`);
    }
  }
  if (
    !Number.isFinite(geometry['sequence-height-step'])
    || geometry['sequence-height-step'] <= 0
  ) {
    throw new Error('Sankey 配置：sequence-height-step 必须是正数');
  }
  for (const platform of ['pc', 'mobile']) {
    const profile = Object.fromEntries(
      Object.entries(geometry).map(([key, value]) => [key, unfold(value, platform)]),
    );
    for (const key of [
      'primary-node-height',
      'node-gap',
      'node-min-height',
      'edge-min-thickness',
      'canvas-min-height',
      'canvas-recommended-height',
    ]) {
      if (!Number.isFinite(profile[key]) || profile[key] <= 0) {
        throw new Error(`Sankey 配置：${platform}.${key} 必须是正数`);
      }
    }
    if (profile['canvas-recommended-height'] < profile['canvas-min-height']) {
      throw new Error(`Sankey 配置：${platform} 推荐高度不得小于最小高度`);
    }
  }
}

validateSettings();

export function resolveSankeySettings(platform) {
  if (!['pc', 'mobile'].includes(platform)) {
    throw new TypeError("SankeyChart：platform 仅支持 'pc' 或 'mobile'");
  }
  return {
    geometry: Object.fromEntries(
      Object.entries(SANKEY_SETTINGS.geometry)
        .map(([key, value]) => [key, unfold(value, platform)]),
    ),
    motion: SANKEY_SETTINGS.motion,
    colors: {
      income: 'var(--color-sankey-income)',
      expense: 'var(--color-sankey-expense)',
      profit: 'var(--color-sankey-profit)',
    },
  };
}
