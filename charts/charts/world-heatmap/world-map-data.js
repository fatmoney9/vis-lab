/* [L2-LOCAL][WORLD-HEATMAP-02] 取第三方底图并投影成国家路径；数据来源见本目录 README。
 * 同页多张地图共用一次请求；失败不缓存，下一次挂载可以重试。 */
import { geoPath, geoTransform } from 'd3';
import { WORLD_MAP_URL, projectLonLat, worldMapRegions } from './model.js';

const toPath = geoPath(geoTransform({
  point(lon, lat) {
    const [x, y] = projectLonLat(lon, lat);
    this.stream.point(x, y);
  },
}));

let pending = null;

export function loadWorldMap() {
  pending ??= fetch(WORLD_MAP_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`WorldHeatmapChart：底图加载失败（HTTP ${response.status}）`);
      return response.json();
    })
    .then((geojson) => worldMapRegions(geojson).map(({ id, geometry }) => ({ id, paths: [toPath(geometry)] })))
    .catch((error) => {
      pending = null;
      throw error;
    });
  return pending;
}
