import { themeOf } from '../../core/theme.js';

const raw = await (
  await fetch(new URL('../../../tokens/sankey.json', import.meta.url), { cache: 'no-store' })
).json();

const { $meta, geometry, typography, motion, ...themes } = raw;

const unfold = (value, platform) => (
  value !== null
  && typeof value === 'object'
  && ('mobile' in value || 'pc' in value)
    ? value[platform]
    : value
);

if (typeof typography?.['number-font-family'] !== 'string') {
  throw new Error('sankey.json：缺少桑基数值字体回退链');
}
if (
  !Number.isFinite(motion?.['playback-label-lead-duration'])
  || motion['playback-label-lead-duration'] < 0
  || !Number.isFinite(motion?.['playback-duration'])
  || motion['playback-duration'] <= 0
  || motion['playback-easing'] !== 'cubic-out'
) {
  throw new Error('sankey.json：播放动效必须配置正时长与 cubic-out 缓动');
}
if (
  !Number.isFinite(geometry?.['centerline-attraction'])
  || geometry['centerline-attraction'] < 0
  || geometry['centerline-attraction'] > 1
) {
  throw new Error('sankey.json：centerline-attraction 必须是 0 到 1 之间的数值');
}
for (const key of ['multi-node-span-base-ratio', 'third-node-span-ratio']) {
  if (!Number.isFinite(geometry?.[key]) || geometry[key] <= 0) {
    throw new Error(`sankey.json：${key} 必须是正数`);
  }
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
      throw new Error(`sankey.json：${platform}.${key} 必须是正数`);
    }
  }
  if (profile['canvas-recommended-height'] < profile['canvas-min-height']) {
    throw new Error(`sankey.json：${platform} 推荐高度不得小于最小高度`);
  }
  if (
    profile['canvas-max-height'] !== null
    && (
      !Number.isFinite(profile['canvas-max-height'])
      || profile['canvas-max-height'] < profile['canvas-recommended-height']
    )
  ) {
    throw new Error(`sankey.json：${platform} 最大高度不得小于推荐高度`);
  }
}

for (const name of ['base', 'ths', 'ifind-pc', 'ainvest']) {
  const profile = themes[name];
  if (
    !profile
    || !['income', 'expense', 'profit']
      .every((key) => typeof profile[key] === 'string')
  ) {
    throw new Error(`sankey.json：主题「${name}」缺少完整的桑基语义色`);
  }
}

export function resolveSankeyStyle(host, platform) {
  return {
    geometry: Object.fromEntries(
      Object.entries(geometry).map(([key, value]) => [key, unfold(value, platform)]),
    ),
    typography,
    motion,
    colors: themes[themeOf(host)] ?? themes.base,
  };
}
