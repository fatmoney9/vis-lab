/*
 * L3 · 两个预览入口共用的 Sankey 播放区 DOM。
 *
 * 这里只消除展示层模板重复，不持有播放状态，也不调用 SankeyChart.update()；
 * 图表更新与动画时序继续由各预览入口接线，L2 行为不受影响。
 */

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
