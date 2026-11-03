/*
 * world-heatmap/index.js -- [L2] 全球分级设色图编排器。
 *
 * API 只接收国家语义数据：
 *   { name, regions:[{id,name,value}], tone='primary', platform='pc' }
 * id 使用底图收录的国家 / 地区码；几何运行时取自第三方数据（WORLD-HEATMAP-09）。
 * 五档强度、主题色、无数据底色、国界与 hover 描边全部由 L1 / token 决定。
 * 底图异步加载：返回值的 ready 在国家画完后兑现，加载失败或国家码不在底图内时拒绝。
 */
import { pointer, select } from 'd3';
import { createFrame, observeResize, containerDrivesHeight, containerTookOver } from '../../core/frame.js';
import { makeFormatter } from '../../core/format.js';
import { tokenNum } from '../../core/tokens.js';
import { createTooltip } from '../../core/tooltip.js';
import { resolveBehavior } from '../../core/theme.js';
import {
  normalizeWorldRegions, assertWorldHeatmapTone, countryFlagThumbnail, WORLD_MAP_VIEWBOX, REGIONS_MERGED_INTO_CN,
} from './model.js';
import { loadWorldMap } from './world-map-data.js';

const toneColor = (tone) => `var(--color-world-heatmap-${tone})`;

export function WorldHeatmapChart(host, cfg) {
  const {
    name,
    regions,
    tone = 'primary',
    platform = 'pc',
  } = cfg;
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('WorldHeatmapChart：name 必须是非空字符串');
  }
  if (!['pc', 'mobile'].includes(platform)) {
    throw new TypeError("WorldHeatmapChart：platform 仅支持 'pc' 或 'mobile'");
  }
  assertWorldHeatmapTone(tone);
  const normalized = normalizeWorldRegions(regions);
  /* [WORLD-HEATMAP-09] 这几个不必等底图就能拒绝，且不得静默聚合进 CN 的读数。 */
  const merged = normalized.filter(({ id }) => REGIONS_MERGED_INTO_CN.includes(id)).map(({ id }) => id);
  if (merged.length) throw new TypeError(`WorldHeatmapChart：地图中不存在国家码 ${merged.join(', ')}`);

  const initialHostHeight = host.clientHeight;
  host.replaceChildren();
  host.classList.add('dv-chart', 'dv-chart--world-heatmap');
  host.dataset.worldHeatmapTone = tone;
  const plotHost = select(host).append('div').attr('class', 'dv-chart__plot').node();
  const behavior = resolveBehavior(host, platform);
  const format = makeFormatter(behavior['number-format']);
  let selfHeight = initialHostHeight;
  let usesContainerHeight = containerDrivesHeight(initialHostHeight);
  let frame = null;
  let layer = null;

  /* [WORLD-HEATMAP-06] 尺寸变化只改画布与地图变换，国家节点不动：重建会把键盘焦点丢回 body。 */
  function layout() {
    /* 先收起旧画布再量：svg 还撑着时，flex / grid 里的容器缩不回去。只改尺寸属性，不摘节点，焦点才保得住。 */
    frame?.svg.attr('width', 0);
    if (usesContainerHeight) frame?.svg.attr('height', 0);
    const width = Math.max(1, plotHost.clientWidth || host.clientWidth);
    const height = usesContainerHeight
      ? Math.max(1, host.clientHeight)
      : tokenNum(host, '--size-world-heatmap-height') || 240; /* [WORLD-HEATMAP-02] */
    frame = createFrame(plotHost, { width, height, xBand: false, minGridHeight: 0, svg: frame?.svg });
    frame.svg
      .attr('class', 'dv-world-heatmap')
      /* [WORLD-HEATMAP-07] img 的后代会被辅助技术视为纯呈现，有可聚焦国家时不能用（同 RADAR-18）。 */
      .attr('role', normalized.length ? 'group' : 'img')
      .attr('aria-label', name);

    const [mapX, mapY, mapWidth, mapHeight] = WORLD_MAP_VIEWBOX;
    const scale = Math.min(frame.grid.width / mapWidth, frame.grid.height / mapHeight);
    const offsetX = frame.grid.left + (frame.grid.width - mapWidth * scale) / 2;
    const offsetY = frame.grid.top + (frame.grid.height - mapHeight * scale) / 2;
    layer ??= frame.svg.append('g').attr('class', 'dv-world-heatmap__map');
    layer.attr('transform', `translate(${offsetX},${offsetY}) scale(${scale}) translate(${-mapX},${-mapY})`);
    selfHeight = host.clientHeight;
  }

  layout();
  const dataById = new Map(normalized.map((region) => [region.id, region]));

  /* 底图到达前是空选择集：期间的 resize / 滚动只走布局与空操作。 */
  const countriesLayer = layer.append('g').attr('class', 'dv-world-heatmap__countries');
  let countries = countriesLayer.selectAll('g.dv-world-heatmap__country');

  /* [WORLD-HEATMAP-06/07] 只把非交互描边副本画在国家层之上。
     原国家节点不移动：重排可聚焦节点会改变 Tab 顺序，甚至导致 focus 丢失。
     副本不填充、不参与命中与读屏，也不会二次叠加国家的透明底色。 */
  const highlight = layer.append('g')
    .attr('class', 'dv-world-heatmap__highlight')
    .attr('aria-hidden', 'true');
  const tooltip = createTooltip(plotHost);
  let activeId = null;
  const show = (event, feature, localOverride) => {
    const region = dataById.get(feature.id);
    if (!region) return;
    /* [WORLD-HEATMAP-06] 国家未变时只更新位置，不在每次 mousemove 重建内容或重设国旗 src。 */
    if (activeId !== feature.id) {
      activeId = feature.id;
      countries.classed('is-active', ({ id }) => id === feature.id);
      highlight.selectAll('path')
        .data(feature.paths)
        .join('path')
        .attr('class', 'dv-world-heatmap__outline')
        .attr('d', (pathData) => pathData);
      tooltip.show({
        title: region.name,
        titleIcon: region.flagUrl ?? countryFlagThumbnail(region.id),
        titleIconFallback: [...region.name][0],
        titleValue: format(region.value),
        rows: [],
      }, behavior['legend-marker']);
    }
    const local = localOverride ?? pointer(event, plotHost);
    tooltip.place('follow', {
      grid: frame.grid,
      cx: local[0],
      pointer: { x: local[0], y: local[1] },
    });
  };
  const hide = () => {
    activeId = null;
    countries.classed('is-active', false);
    highlight.selectAll('path').remove();
    tooltip.hide();
  };
  const showAtCountry = (node) => {
    const countryBox = node.getBoundingClientRect();
    const plotBox = plotHost.getBoundingClientRect();
    show(null, select(node).datum(), [
      countryBox.left - plotBox.left + countryBox.width / 2,
      countryBox.top - plotBox.top + countryBox.height / 2,
    ]);
  };
  /* 只认键盘焦点：鼠标点击也会让国家获得焦点，但那时气泡该留在指针处。 */
  const keyboardFocused = () => {
    const node = document.activeElement;
    return node && plotHost.contains(node) && node.matches('.dv-world-heatmap__country:focus-visible')
      ? node : null;
  };
  /* 气泡是 fixed、不受祖先裁剪，滚出可视范围要自己判断（视口 + 各级裁剪祖先）。 */
  const inView = (node) => {
    const box = node.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const within = (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    if (!within({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight })) return false;
    for (let el = plotHost.parentElement; el && el !== document.body; el = el.parentElement) {
      if (getComputedStyle(el).overflow !== 'visible' && !within(el.getBoundingClientRect())) return false;
    }
    return true;
  };
  /* hover 结束、滚动、尺寸变化后的归位：有键盘焦点就回到焦点国家，否则清空。 */
  const settle = () => {
    const node = keyboardFocused();
    if (node && inView(node)) showAtCountry(node);
    else hide();
  };
  function renderCountries(features) {
    const known = new Set(features.map(({ id }) => id));
    const unknown = normalized.filter(({ id }) => !known.has(id)).map(({ id }) => id);
    if (unknown.length) throw new TypeError(`WorldHeatmapChart：地图中不存在国家码 ${unknown.join(', ')}`);
    countries = countries
      .data(features, ({ id }) => id)
      .join('g')
      .attr('class', ({ id }) => `dv-world-heatmap__country${dataById.has(id) ? ' has-data' : ''}`)
      .attr('data-region', ({ id }) => id)
      .style('--dv-world-heatmap-fill', ({ id }) => dataById.has(id)
        ? toneColor(tone)
        : 'var(--color-world-heatmap-empty)')
      .style('--dv-world-heatmap-opacity', ({ id }) => {
        const region = dataById.get(id);
        return region ? `var(--opacity-world-heatmap-level-${region.level})` : 1;
      })
      .attr('tabindex', ({ id }) => dataById.has(id) ? 0 : null)
      .attr('role', ({ id }) => dataById.has(id) ? 'graphics-symbol' : null)
      .attr('aria-label', ({ id }) => {
        const region = dataById.get(id);
        return region ? `${region.name}, ${format(region.value)}` : null;
      });
    countries.each(function (feature) {
      select(this).selectAll('path')
        .data(feature.paths)
        .join('path')
        .attr('class', 'dv-world-heatmap__shape')
        .attr('d', (pathData) => pathData);
    });
    countries.filter(({ id }) => dataById.has(id))
      .on('mouseenter', show)
      .on('mousemove', show)
      .on('mouseleave', settle)
      .on('focus', function () {
        if (this.matches(':focus-visible')) showAtCountry(this);
      })
      .on('blur', hide);
  }
  let destroyed = false;
  const ready = loadWorldMap().then((features) => {
    if (!destroyed) renderCountries(features);
  });
  /* [TOOLTIP-10] scroll 不冒泡；capture 覆盖页面与任意祖先滚动容器。销毁时必须移除。 */
  window.addEventListener('scroll', settle, { capture: true, passive: true });

  const stopResize = observeResize(host, () => {
    if (!usesContainerHeight && containerTookOver(host.clientHeight, selfHeight)) usesContainerHeight = true;
    layout();
    settle();
  });
  return {
    ready,
    destroy() {
      destroyed = true;
      window.removeEventListener('scroll', settle, true);
      hide();
      stopResize();
      host.classList.remove('dv-chart', 'dv-chart--world-heatmap');
      delete host.dataset.worldHeatmapTone;
      host.replaceChildren();
    },
  };
}
