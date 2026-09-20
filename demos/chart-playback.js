/*
 * L3 · 播放区的 DOM 模板与宿主接线工具，**所有带时间轴的图型共用**。
 *
 * 这里只收敛模板、主题图例占位换算与异步更新兜底：不持有播放状态，
 * 也不认识任何具体图型——「怎么画一期」由调用方注入（见 demos/playback-controller.js）。
 *
 * ⚠️ **命名必须保持中性**。本文件 2026-09-20 之前叫 sankey-playback.js、类名带 sankey 前缀，
 * 于是第二个要播放的图型接进来时，第一反应是「这是桑基的，我再写一份」——
 * 而那套状态机当时已经在 index.html 与 playground/sankey-preview.html 里逐行重复了两遍。
 * 往这里加东西时先问：它是不是只有某一个图型需要？是就别放进来。
 */

import { tokenNum } from '../charts/core/tokens.js';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const idAttribute = (id) => (id ? ` id="${escapeHtml(id)}"` : '');

/* [SANKEY-29] iFinD 播放轴的 range 把手沿用 THS 形态；只切换把手自身的 token 作用域，
 * 不改变播放区其余 iFinD 样式。规则由桑基立，但对所有播放轴一视同仁。 */
export function playbackRangeTheme(theme = 'ths') {
  return theme === 'ifind' || theme === 'ifind-pc' ? 'ths' : theme;
}

/* [SANKEY-23] 调用方提供序列画布高与跨主题最低图例兜底；真实图例占位由当前
 * L3 主题 token 决定。首次挂载前先算准外框，布局事件仍会在真实 DOM 换行时校正。
 * `legendFallbackHeight === null` 表示**本图型没有图例带**，整段图例预留跳过；
 * `undefined` 仍走既有分支（桑基不声明即原行为）。 */
export function resolvePlaybackChartHeight(
  scope,
  viewport,
  readToken = tokenNum,
) {
  const canvasHeight = Number(viewport?.canvasHeight);
  if (!Number.isFinite(canvasHeight) || canvasHeight < 0) {
    throw new TypeError('播放区：viewport.canvasHeight 必须是非负有限数');
  }
  if (viewport?.legendFallbackHeight === null) return canvasHeight;   /* 无图例带的图型 */
  const fallbackHeight = Number(viewport?.legendFallbackHeight);
  const safeToken = (name) => {
    const value = Number(readToken(scope, name));
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const legendHeight = safeToken('--spacing-legend-container-v-top')
    + Math.max(
      safeToken('--line-height-legend'),
      safeToken('--size-legend-marker'),
    )
    + safeToken('--spacing-legend-container-v-bottom');

  return canvasHeight + Math.max(
    Number.isFinite(fallbackHeight) && fallbackHeight > 0 ? fallbackHeight : 0,
    legendHeight,
  );
}

export function applyPlaybackViewport(
  layout,
  scope,
  viewport,
  propertyName,
) {
  const chartHeight = resolvePlaybackChartHeight(scope, viewport);
  layout.style.setProperty(propertyName, `${chartHeight}px`);
  return chartHeight;
}

/* 所有 L3 入口共用同一条 Promise 兜底：update resolve false 表示暂停 / 取消，
 * 不触发回滚；只有 reject 才转为 false 并调用 onFailure 恢复业务状态。 */
export async function runPlaybackUpdate(update, {
  onError = (error) => console.error('播放更新失败', error),
  onFailure,
} = {}) {
  let failure = null;
  try {
    return await update();
  } catch (error) {
    failure = error;
    onError(error);
    return false;
  } finally {
    if (failure) onFailure?.(failure);
  }
}

/*
 * 播放区文案必须**整套**给全，缺键当场抛错——口径同 L1 `core/chart-text.js` 的
 * CHARTTEXT-01/02：宁可渲染时炸，也不要在英文面上残留半截中文或渲染出 `undefined`。
 * 文案内容本身仍留在各图型自己的 presentation 模块（那是业务文案，不上公用件）。
 */
const COPY_KEYS = Object.freeze([
  'timeline', 'progress', 'play', 'pause', 'playTitle', 'pauseTitle', 'previous', 'next',
]);

export function assertPlaybackCopy(copy, owner = '播放区') {
  const missing = COPY_KEYS.filter((k) => typeof copy?.[k] !== 'string' || !copy[k]);
  if (missing.length) {
    throw new TypeError(`${owner}：播放文案缺少 [${missing.join(', ')}]，必须整套提供`);
  }
  return copy;
}

/*
 * 带文字的刻度最多显示 LABELLED_TICKS 个：8 期时每期都带字，24 期时糊成一片。
 * **抽稀的只是文字，不是刻度本身**——每一期仍是一个可点的按钮（跳期能力不能因为期数多就残掉），
 * 只是不带文字的那些收窄成细标记。首期与末期恒带字，否则读者不知道轴的两端是什么。
 */
const LABELLED_TICKS = 8;

export const labelledTickCount = (count) => Math.min(count, LABELLED_TICKS);

const labelledAt = (count) => {
  if (count <= LABELLED_TICKS) return () => true;
  const step = (count - 1) / (LABELLED_TICKS - 1);
  const keep = new Set(Array.from({ length: LABELLED_TICKS }, (_, i) => Math.round(i * step)));
  return (index) => keep.has(index);
};

export function playbackTicksMarkup(periods, currentIndex = 0) {
  const lastIndex = Math.max(0, periods.length - 1);
  const labelled = labelledAt(periods.length);
  return periods.map((period, index) => {
    const isCurrent = index === currentIndex;
    const showLabel = labelled(index);
    const left = lastIndex ? index / lastIndex * 100 : 0;
    return `
      <button
        class="chart-playback__tick${isCurrent ? ' is-current' : ''}${showLabel ? '' : ' chart-playback__tick--bare'}"
        type="button"
        data-period-index="${index}"
        style="left:${left}%"
        aria-label="${escapeHtml(period.period)}"
        aria-current="${isCurrent ? 'true' : 'false'}"
        title="${escapeHtml(period.period)}"
      >
        <span class="chart-playback__tick-label chart-playback__tick-label--full">${escapeHtml(period.timelinePeriod ?? period.period)}</span>
        <span class="chart-playback__tick-label chart-playback__tick-label--compact">${escapeHtml(period.shortPeriod)}</span>
      </button>`;
  }).join('');
}

export function playbackMarkup({
  periods,
  currentIndex = 0,
  copy,
  playIconSrc,
  idPrefix = '',
} = {}) {
  assertPlaybackCopy(copy, 'playbackMarkup');
  const safePeriods = Array.isArray(periods) ? periods : [];
  const safeIndex = safePeriods.length
    ? Math.max(0, Math.min(safePeriods.length - 1, Math.round(currentIndex)))
    : 0;
  /* 标签可用宽按**带字的刻度数**算，不是按总期数：24 期时按 23 分母会把每个标签压成「2..」。
     刻度本身仍是 24 个（抽稀的只是文字，见 playbackTicksMarkup）。 */
  const lastIndex = Math.max(0, safePeriods.length - 1);
  const id = (suffix = '') => idAttribute(idPrefix ? `${idPrefix}${suffix ? `-${suffix}` : ''}` : '');
  const currentPeriod = safePeriods[safeIndex]?.period ?? '';

  return `<div
    class="chart-playback"
    ${id()}
    style="--chart-playback-interval-count:${Math.max(1, labelledTickCount(safePeriods.length) - 1)}"
    aria-label="${escapeHtml(copy.timeline)}"
  >
    <div class="chart-playback__timeline">
      <input
        class="chart-playback__range"
        ${id('range')}
        type="range"
        min="0"
        max="${lastIndex}"
        step="1"
        value="${safeIndex}"
        aria-label="${escapeHtml(copy.progress)}"
      />
      <div class="chart-playback__ticks"${id('ticks')}>${playbackTicksMarkup(safePeriods, safeIndex)}</div>
    </div>
    <div class="chart-playback__controls">
      <button
        class="chart-playback__primary"
        ${id('toggle')}
        type="button"
        aria-label="${escapeHtml(copy.play)}"
        title="${escapeHtml(copy.playTitle)}"
      >
        <img class="chart-playback__play-icon" src="${escapeHtml(playIconSrc)}" alt="" aria-hidden="true" />
        <span class="chart-playback__pause-icon" aria-hidden="true"></span>
      </button>
      <output class="chart-playback__period"${id('period')} aria-live="polite">${escapeHtml(currentPeriod)}</output>
      <div class="chart-playback__steps">
        <button class="chart-playback__step chart-playback__step--prev"${id('prev')} type="button">
          <span class="chart-playback__period-arrow chart-playback__period-arrow--prev" aria-hidden="true"></span>
          <span${id('prev-label')}>${escapeHtml(copy.previous)}</span>
        </button>
        <button class="chart-playback__step chart-playback__step--next"${id('next')} type="button">
          <span${id('next-label')}>${escapeHtml(copy.next)}</span>
          <span class="chart-playback__period-arrow" aria-hidden="true"></span>
        </button>
      </div>
    </div>
  </div>`;
}
