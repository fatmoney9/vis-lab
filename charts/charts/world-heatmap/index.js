/*
 * world-heatmap/index.js -- [L2] 全球分级设色图编排器。
 *
 * API 只接收国家语义数据：
 *   { name, regions:[{id,name,value}], tone='primary', platform='pc' }
 * id 使用规范收录的国家 / 地区码；几何为 Figma 基础图加离线地区校准（WORLD-HEATMAP-09）。
 * 五档强度、主题色、无数据底色、国界与 hover 描边全部由 L1 / token 决定。
 */
import { pointer, select } from 'd3';
import { createFrame, observeResize, containerDrivesHeight, containerTookOver } from '../../core/frame.js';
import { makeFormatter } from '../../core/format.js';
import { createTooltip } from '../../core/tooltip.js';
import { resolveBehavior } from '../../core/theme.js';
import { normalizeWorldRegions, assertWorldHeatmapTone, countryFlagThumbnail } from './model.js';
import { WORLD_MAP_FEATURES, WORLD_MAP_VIEWBOX } from './world-map-data.js';

const FEATURE_BY_ID = new Map(WORLD_MAP_FEATURES.map((feature) => [feature.id, feature]));
const MAP_RATIO = WORLD_MAP_VIEWBOX[3] / WORLD_MAP_VIEWBOX[2];

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
  const unknown = normalized.filter(({ id }) => !FEATURE_BY_ID.has(id)).map(({ id }) => id);
  if (unknown.length) throw new TypeError(`WorldHeatmapChart：地图中不存在国家码 ${unknown.join(', ')}`);

  const initialHostHeight = host.clientHeight;
  host.replaceChildren();
  host.classList.add('dv-chart', 'dv-chart--world-heatmap');
  host.dataset.worldHeatmapTone = tone;
  const plotHost = select(host).append('div').attr('class', 'dv-chart__plot').node();
  const behavior = resolveBehavior(host, platform);
  const format = makeFormatter(behavior['number-format']);
  let selfHeight = initialHostHeight;
  let usesContainerHeight = containerDrivesHeight(initialHostHeight);
  let stopInteraction = () => {};

  function build() {
    stopInteraction();
    stopInteraction = () => {};
    plotHost.replaceChildren();
    const width = Math.max(1, plotHost.clientWidth || host.clientWidth);
    const height = usesContainerHeight
      ? Math.max(1, host.clientHeight)
      : Math.max(1, Math.round(width * MAP_RATIO));
    const frame = createFrame(plotHost, { width, height, xBand: false, minGridHeight: 0 });
    frame.svg
      .attr('class', 'dv-world-heatmap')
      .attr('role', 'img')
      .attr('aria-label', name);

    const [mapX, mapY, mapWidth, mapHeight] = WORLD_MAP_VIEWBOX;
    const scale = Math.min(frame.grid.width / mapWidth, frame.grid.height / mapHeight);
    const offsetX = frame.grid.left + (frame.grid.width - mapWidth * scale) / 2;
    const offsetY = frame.grid.top + (frame.grid.height - mapHeight * scale) / 2;
    const layer = frame.svg.append('g')
      .attr('class', 'dv-world-heatmap__map')
      .attr('transform', `translate(${offsetX},${offsetY}) scale(${scale}) translate(${-mapX},${-mapY})`);
    const dataById = new Map(normalized.map((region) => [region.id, region]));

    const countries = layer.selectAll('g.dv-world-heatmap__country')
      .data(WORLD_MAP_FEATURES, ({ id }) => id)
      .join('g')
      .attr('class', ({ id }) => `dv-world-heatmap__country${dataById.has(id) ? ' has-data' : ''}`)
      .attr('data-region', ({ id }) => id)
      .attr('transform', ({ x, y }) => `translate(${x},${y})`)
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
        highlight.attr('transform', `translate(${feature.x},${feature.y})`)
          .selectAll('path')
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
    countries.filter(({ id }) => dataById.has(id))
      .on('mouseenter', show)
      .on('mousemove', show)
      .on('mouseleave', hide)
      .on('focus', function (event, feature) {
        const countryBox = this.getBoundingClientRect();
        const plotBox = plotHost.getBoundingClientRect();
        show(event, feature, [
          countryBox.left - plotBox.left + countryBox.width / 2,
          countryBox.top - plotBox.top + countryBox.height / 2,
        ]);
      })
      .on('blur', hide);
    /* [TOOLTIP-10] scroll 不冒泡；capture 覆盖页面与任意祖先滚动容器。
       描边与 fixed 气泡一起清理，重绘/销毁必须移除上一轮监听。 */
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    stopInteraction = () => {
      window.removeEventListener('scroll', hide, true);
      hide();
    };
    selfHeight = host.clientHeight;
  }

  build();
  const stopResize = observeResize(host, () => {
    if (!usesContainerHeight && containerTookOver(host.clientHeight, selfHeight)) usesContainerHeight = true;
    build();
  });
  return {
    destroy() {
      stopInteraction();
      stopResize();
      host.classList.remove('dv-chart', 'dv-chart--world-heatmap');
      delete host.dataset.worldHeatmapTone;
      host.replaceChildren();
    },
  };
}
