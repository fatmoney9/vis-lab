/* [WORLD-HEATMAP-09] Offline, dependency-free correction of the fixed Figma map.
 * This is asset tooling, NOT a runtime projection or a theme-specific geography switch.
 * Original shared edges are retained; only the documented southern arc is replaced.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { WORLD_MAP_FEATURES } from '../../charts/charts/world-heatmap/figma-world-map-data.js';

const sourceText = await readFile(new URL('./china-boundary-source.json', import.meta.url), 'utf8');
// Pin both asset inputs: source updates require explicit review of anchors and transformation.
assert.equal(createHash('sha256').update(sourceText).digest('hex'),
  '8b9a70bdf748b46612a914bd91644aba3a3f9b9df59cce0e1f2df9ee3c38c2bb', 'Boundary source changed');
assert.equal(createHash('sha256').update(await readFile(new URL(
  '../../charts/charts/world-heatmap/figma-world-map-data.js', import.meta.url))).digest('hex'),
  '46cbc9be28c0ca2b030817a6ccb471e543550f28a8dbe086e29d5aace531a9a0', 'Original Figma geometry changed');
const source = JSON.parse(sourceText);
const feature = (id) => WORLD_MAP_FEATURES.find((item) => item.id === id);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// The Figma export uses absolute M/L/H/V/Z only. Reject new commands rather than silently losing geometry.
function rings({ x: offsetX, y: offsetY, paths }) {
  const output = [];
  for (const path of paths) {
    assert.ok((path.match(/[a-df-z]/gi) ?? []).every((command) => 'MLHVZ'.includes(command)),
      'Unsupported SVG command');
    const tokens = path.match(/[MLHVZ]|-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi);
    let command, ring, x = 0, y = 0, index = 0;
    while (index < tokens.length) {
      if (/^[MLHVZ]$/.test(tokens[index])) command = tokens[index++];
      if (command === 'Z') {
        if (ring.length > 1 && distance(ring[0], ring.at(-1)) < 1e-5) ring.pop();
        continue;
      }
      if (command === 'M' || command === 'L') {
        x = Number(tokens[index++]); y = Number(tokens[index++]);
        if (command === 'M') { ring = []; output.push(ring); command = 'L'; }
      } else if (command === 'H') x = Number(tokens[index++]);
      else if (command === 'V') y = Number(tokens[index++]);
      ring.push([x + offsetX, y + offsetY]);
    }
  }
  return output;
}

function nearest(ring, point, maxDistance = 1) {
  let index = 0;
  ring.forEach((candidate, i) => { if (distance(candidate, point) < distance(ring[index], point)) index = i; });
  assert.ok(distance(ring[index], point) <= maxDistance, `Map anchor drifted: ${JSON.stringify(point)}`);
  return index;
}
function arc(ring, start, end) {
  const output = [ring[start]];
  for (let index = start; index !== end;) {
    index = (index + 1) % ring.length;
    output.push(ring[index]);
  }
  return output;
}
function replaceArc(ring, start, end, replacement) {
  assert.ok(start < end, 'Expected a non-wrapping local arc');
  return [...ring.slice(0, start), ...replacement, ...ring.slice(end + 1)];
}
function mainland(allRings) { return allRings.reduce((a, b) => a.length > b.length ? a : b); }
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
function intersection(a, b, c, d) {
  const r = subtract(b, a), s = subtract(d, c), denominator = cross(r, s);
  if (Math.abs(denominator) < 1e-12) return null;
  const offset = subtract(c, a), t = cross(offset, s) / denominator, u = cross(offset, r) / denominator;
  if (t <= 1e-9 || t > 1 || u < 0 || u > 1) return null;
  return { t, point: a.map((value, axis) => value + t * r[axis]) };
}
function insertJoin(ring, point) {
  let best;
  ring.forEach((a, index) => {
    const b = ring[(index + 1) % ring.length], vector = subtract(b, a);
    const t = Math.max(0, Math.min(1, subtract(point, a)
      .reduce((sum, value, axis) => sum + value * vector[axis], 0)
      / (vector[0] ** 2 + vector[1] ** 2)));
    const projectedPoint = a.map((value, axis) => value + t * vector[axis]);
    const error = distance(projectedPoint, point);
    if (!best || error < best.error) best = { index, error };
  });
  assert.ok(best.error < 0.02, 'Original neighbouring shared edge no longer aligns');
  return { ring: [...ring.slice(0, best.index + 1), point, ...ring.slice(best.index + 1)], index: best.index + 1 };
}

// Calibration of the design's longitude/Mercator-latitude coordinates; not an instance API.
const project = ([longitude, latitude]) => [
  474.69 + 2.798 * longitude,
  420.30 - 145.39 * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)),
];
const upstreamCN = source.features.find(({ properties }) => properties.iso_a2 === 'CN');
const geographicRing = mainland(upstreamCN.geometry.coordinates.flat());
const geographicWest = [91.99834, 26.85498];
const geographicEast = [97.086778, 27.7475];
const geographicArc = arc(geographicRing,
  nearest(geographicRing, geographicWest, 1e-6), nearest(geographicRing, geographicEast, 1e-6));
assert.equal(geographicArc.length, 11, 'Pinned upstream southern boundary changed');

const chinaRings = rings(feature('CN'));
let chinaMain = mainland(chinaRings);
// IN's second SVG path duplicates the same mainland/islands with a different subpath split.
const indiaRings = rings({ ...feature('IN'), paths: feature('IN').paths.slice(0, 1) });
const indiaMain = mainland(indiaRings);
const bhutan = mainland(rings(feature('BT')));
const myanmar = mainland(rings(feature('MM')));
const oldEast = chinaMain[nearest(chinaMain, [747.5297, 345.6978], 0.001)];
const oldWest = chinaMain[nearest(chinaMain, [731.5714, 347.0123], 0.001)];
const west = bhutan[nearest(bhutan, project(geographicWest))];
const east = myanmar[nearest(myanmar, project(geographicEast))];
assert.ok(distance(west, project(geographicWest)) < 0.4
  && distance(east, project(geographicEast)) < 0.4, 'Subpixel endpoint calibration exceeded its bound');

// Snap the two ends to ORIGINAL neighbouring geometry. Interpolate the subpixel calibration
// delta along the sourced arc, preserving its shape without inventing boundary control points.
const projected = geographicArc.map(project);
let southernArc = projected.map((point, index) => {
  const t = index / (projected.length - 1);
  return point.map((value, axis) => value
    + (west[axis] - projected[0][axis]) * (1 - t)
    + (east[axis] - projected.at(-1)[axis]) * t);
});
southernArc[0] = west; southernArc[southernArc.length - 1] = east;
// A coarse upstream endpoint may lie west of the original Bhutan coast's last bulge.
// Cut at the actual final exit, rather than letting a straight sourced segment cut through Bhutan.
const exits = [];
southernArc.slice(0, -1).forEach((a, segment) => {
  bhutan.forEach((c, boundaryIndex) => {
    const hit = intersection(a, southernArc[segment + 1], c, bhutan[(boundaryIndex + 1) % bhutan.length]);
    if (hit) exits.push({ ...hit, segment, boundaryIndex });
  });
});
const exit = exits.sort((a, b) => (a.segment + a.t) - (b.segment + b.t)).at(-1);
assert.ok(exit && exit.segment === 0, 'Expected the pinned western Bhutan boundary intersection');
southernArc = [exit.point, ...southernArc.slice(exit.segment + 1)];
const myanmarEdge = arc(myanmar, nearest(myanmar, east), nearest(myanmar, oldEast)).reverse();
const bhutanEdge = [...arc(bhutan, nearest(bhutan, oldWest), exit.boundaryIndex), exit.point].reverse();
// Reuse CN's exact former tripoints, not the slightly rounded neighbouring duplicates.
myanmarEdge[0] = oldEast; bhutanEdge[bhutanEdge.length - 1] = oldWest;
chinaMain = replaceArc(chinaMain, nearest(chinaMain, oldEast), nearest(chinaMain, oldWest),
  [...myanmarEdge, ...southernArc.slice(0, -1).reverse(), ...bhutanEdge.slice(1)]);
const indiaJoin = insertJoin(indiaMain, exit.point);
const correctedIndiaMain = replaceArc(indiaJoin.ring, indiaJoin.index, nearest(indiaJoin.ring, east), southernArc);

// Merge HK/MO coastlines into the mainland: do NOT retain internal administrative strokes.
const hongKongRings = rings(feature('HK'));
const hongKongCoast = hongKongRings[0].slice(0, 16);
const hkStart = nearest(chinaMain, hongKongCoast[0]);
const hkEnd = nearest(chinaMain, hongKongCoast.at(-1));
hongKongCoast[0] = chinaMain[hkStart]; hongKongCoast[hongKongCoast.length - 1] = chinaMain[hkEnd];
chinaMain = replaceArc(chinaMain, hkStart, hkEnd, hongKongCoast);
const macao = rings(feature('MO'))[0];
const macaoCoast = [...macao.slice(4), macao[0]];
const moStart = nearest(chinaMain, macaoCoast[0]);
const moEnd = nearest(chinaMain, macaoCoast.at(-1));
macaoCoast[0] = chinaMain[moStart]; macaoCoast[macaoCoast.length - 1] = chinaMain[moEnd];
chinaMain = replaceArc(chinaMain, moStart, moEnd, macaoCoast);

function serialize(id, allRings) {
  const { x, y } = feature(id);
  const number = (value) => Number(value.toFixed(5));
  return { id, x, y, paths: [allRings.map((ring) => ring.map(([px, py], i) =>
    `${i ? 'L' : 'M'}${number(px - x)} ${number(py - y)}`).join('') + 'Z').join('')] };
}
const corrections = [
  serialize('CN', [
    ...chinaRings.filter((ring) => ring !== mainland(chinaRings)), chinaMain,
    ...hongKongRings.slice(1), ...rings(feature('TW')),
  ]),
  serialize('IN', indiaRings.map((ring) => ring === indiaMain ? correctedIndiaMain : ring)),
];
const output = `/* [L2-LOCAL][WORLD-HEATMAP-09] Generated by assets/world-map/build.mjs. Do not edit. */\n`
  + `export const WORLD_MAP_CORRECTIONS = ${JSON.stringify(corrections)};\n`;
const target = new URL('../../charts/charts/world-heatmap/world-map-corrections.js', import.meta.url);
if (process.argv.includes('--check')) {
  assert.equal(await readFile(target, 'utf8'), output, 'World map corrections are stale');
} else await writeFile(target, output);
console.log('✓ 全球底图校准：CN 台湾/港澳/藏南 + IN 同步边界，原邻国路径保持不变');
