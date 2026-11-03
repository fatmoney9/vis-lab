/* [L2-LOCAL][WORLD-HEATMAP-09] Fixed geography, independent of runtime theme and data.
 * Provenance and reproducible transformation: assets/world-map/README.md.
 */
import { WORLD_MAP_FEATURES as FIGMA_FEATURES } from './figma-world-map-data.js';
import { WORLD_MAP_CORRECTIONS } from './world-map-corrections.js';
export { WORLD_MAP_VIEWBOX } from './figma-world-map-data.js';

const corrections = new Map(WORLD_MAP_CORRECTIONS.map((feature) => [feature.id, feature]));
const mergedRegions = new Set(['TW', 'HK', 'MO']);
export const WORLD_MAP_FEATURES = FIGMA_FEATURES
  .filter(({ id }) => !mergedRegions.has(id))
  .map((feature) => corrections.get(feature.id) ?? feature);
