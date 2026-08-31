/*
 * L3 · 两个预览入口共用的 Sankey 播放区 DOM 与宿主接线工具。
 *
 * 这里只收敛模板、主题图例占位换算与异步更新兜底，不持有播放状态，
 * 也不直接调用 SankeyChart.update()；图表更新和动画时序仍由各预览入口接线。
 */

import { tokenNum } from '../charts/core/tokens.js';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const idAttribute = (id) => (id ? ` id="${escapeHtml(id)}"` : '');

/* [SANKEY-29] iFinD 财报播放轴的 range 把手沿用 THS 形态；
 * 只切换把手自身的 token 作用域，不改变播放区其余 iFinD 样式。 */
export function sankeyPlaybackRangeTheme(theme = 'ths') {
  return theme === 'ifind' || theme === 'ifind-pc' ? 'ths' : theme;
}

/* [SANKEY-23] L2 提供序列画布高与跨主题最低图例兜底；真实图例占位由当前
 * L3 主题 token 决定。首次挂载前先算准外框，布局事件仍会在真实 DOM 换行时校正。 */
export function resolveSankeyPlaybackChartHeight(
  scope,
  viewport,
  readToken = tokenNum,
) {
  const canvasHeight = Number(viewport?.canvasHeight);
  if (!Number.isFinite(canvasHeight) || canvasHeight < 0) {
    throw new TypeError('桑基播放区：viewport.canvasHeight 必须是非负有限数');
  }
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

export function applySankeyPlaybackViewport(
  layout,
  scope,
  viewport,
  propertyName,
) {
  const chartHeight = resolveSankeyPlaybackChartHeight(scope, viewport);
  layout.style.setProperty(propertyName, `${chartHeight}px`);
  return chartHeight;
}

/* 两个 L3 入口共用同一条 Promise 兜底：update resolve false 表示暂停 / 取消，
 * 不触发回滚；只有 reject 才转为 false 并调用 onFailure 恢复业务状态。 */
export async function runSankeyPlaybackUpdate(update, {
  onError = (error) => console.error('桑基图播放更新失败', error),
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

export function sankeyPlaybackTicksMarkup(periods, currentIndex = 0) {
  const lastIndex = Math.max(0, periods.length - 1);
  return periods.map((period, index) => {
    const isCurrent = index === currentIndex;
    const left = lastIndex ? index / lastIndex * 100 : 0;
    return `
      <button
        class="sankey-playback__tick${isCurrent ? ' is-current' : ''}"
        type="button"
        data-period-index="${index}"
        style="left:${left}%"
        aria-label="${escapeHtml(period.period)}"
        aria-current="${isCurrent ? 'true' : 'false'}"
        title="${escapeHtml(period.period)}"
      >
        <span class="sankey-playback__tick-label sankey-playback__tick-label--full">${escapeHtml(period.timelinePeriod ?? period.period)}</span>
        <span class="sankey-playback__tick-label sankey-playback__tick-label--compact">${escapeHtml(period.shortPeriod)}</span>
      </button>`;
  }).join('');
}

export function sankeyPlaybackMarkup({
  periods,
  currentIndex = 0,
  copy,
  playIconSrc,
  idPrefix = '',
} = {}) {
  const safePeriods = Array.isArray(periods) ? periods : [];
  const safeIndex = safePeriods.length
    ? Math.max(0, Math.min(safePeriods.length - 1, Math.round(currentIndex)))
    : 0;
  const lastIndex = Math.max(0, safePeriods.length - 1);
  const id = (suffix = '') => idAttribute(idPrefix ? `${idPrefix}${suffix ? `-${suffix}` : ''}` : '');
  const currentPeriod = safePeriods[safeIndex]?.period ?? '';

  return `<div
    class="sankey-playback"
    ${id()}
    style="--sankey-playback-interval-count:${Math.max(1, lastIndex)}"
    aria-label="${escapeHtml(copy.timeline)}"
  >
    <div class="sankey-playback__timeline">
      <input
        class="sankey-playback__range"
        ${id('range')}
        type="range"
        min="0"
        max="${lastIndex}"
        step="1"
        value="${safeIndex}"
        aria-label="${escapeHtml(copy.progress)}"
      />
      <div class="sankey-playback__ticks"${id('ticks')}>${sankeyPlaybackTicksMarkup(safePeriods, safeIndex)}</div>
    </div>
    <div class="sankey-playback__controls">
      <button
        class="sankey-playback__primary"
        ${id('toggle')}
        type="button"
        aria-label="${escapeHtml(copy.play)}"
        title="${escapeHtml(copy.playTitle)}"
      >
        <img class="sankey-playback__play-icon" src="${escapeHtml(playIconSrc)}" alt="" aria-hidden="true" />
        <span class="sankey-playback__pause-icon" aria-hidden="true"></span>
      </button>
      <output class="sankey-playback__period"${id('period')} aria-live="polite">${escapeHtml(currentPeriod)}</output>
      <div class="sankey-playback__steps">
        <button class="sankey-playback__step sankey-playback__step--prev"${id('prev')} type="button">
          <span class="sankey-playback__period-arrow sankey-playback__period-arrow--prev" aria-hidden="true"></span>
          <span${id('prev-label')}>${escapeHtml(copy.previous)}</span>
        </button>
        <button class="sankey-playback__step sankey-playback__step--next"${id('next')} type="button">
          <span${id('next-label')}>${escapeHtml(copy.next)}</span>
          <span class="sankey-playback__period-arrow" aria-hidden="true"></span>
        </button>
      </div>
    </div>
  </div>`;
}
