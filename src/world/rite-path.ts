/** The walk: away from the fire, behind the cabin into the trees, then spiralling up a hill
 * whose summit opens the whole sky and looks back down on home, the lake and the aurora.
 * Kept free of three.js so terrain.ts, forest.ts and tests can import it directly. */
export const HILL = { x: -32, z: -32.5, height: 9, sigma: 9.5 };
export function hillHeight(x: number, z: number) {
  const d2 = (x - HILL.x) ** 2 + (z - HILL.z) ** 2;
  return HILL.height * Math.exp(-d2 / (2 * HILL.sigma * HILL.sigma));
}

const approach: [number, number][] = [
  [-2.3, -2.4], [-8, -2.8], [-14.6, -4.8], [-18.6, -10.5], [-20.5, -17.5],
];
const spiral: [number, number][] = (() => {
  const [ex, ez] = approach[approach.length - 1];
  const start = Math.atan2(ez - HILL.z, ex - HILL.x), r0 = Math.hypot(ex - HILL.x, ez - HILL.z);
  const points: [number, number][] = [], steps = 32, sweep = (470 / 180) * Math.PI;
  for (let k = 1; k <= steps; k++) {
    const t = k / steps, angle = start - sweep * t, r = r0 + (2.2 - r0) * Math.pow(t, 1.15);
    points.push([HILL.x + Math.cos(angle) * r, HILL.z + Math.sin(angle) * r]);
  }
  return points;
})();
export const ritePoints: [number, number][] = [...approach, ...spiral];
export const riteSegments: [number, number, number, number][] = ritePoints
  .slice(1)
  .map((point, i) => [ritePoints[i][0], ritePoints[i][1], point[0], point[1]]);

/** Polyline distance to the walk (the drawn curve stays within ~0.3 m of it). */
export function distToWalk(x: number, z: number) {
  let best = Infinity;
  for (const [a, b, c, d] of riteSegments) {
    const dx = c - a, dz = d - b, t = Math.max(0, Math.min(1, ((x - a) * dx + (z - b) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a - dx * t, z - b - dz * t));
  }
  return best;
}

/** Places along the walk, as a fraction of its length. Openings in the trees are kept at the sky stations. */
export const stationFractions = [0, .13, .27, .41, .56, .7, .84, 1];
export const openings = [4, 5, 7];

/** A forest that closes in around the walk: firs both sides, clear of the path, the cabin and the yard. */
export const walkTrees: [number, number, number, number][] = (() => {
  let seed = 2026;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const trees: [number, number, number, number][] = [];
  const len = riteSegments.reduce((sum, [a, b, c, d]) => sum + Math.hypot(c - a, d - b), 0);
  const pointAt = (s: number): [number, number, number, number] => {
    let left = s;
    for (const [a, b, c, d] of riteSegments) {
      const l = Math.hypot(c - a, d - b);
      if (left <= l) { const t = left / l; return [a + (c - a) * t, b + (d - b) * t, (c - a) / l, (d - b) / l]; }
      left -= l;
    }
    const [a, b, c, d] = riteSegments[riteSegments.length - 1]; const l = Math.hypot(c - a, d - b); return [c, d, (c - a) / l, (d - b) / l];
  };
  const stationPoints = stationFractions.map(f => pointAt(f * len));
  for (let s = 5; s < len - 3; s += 1.7) {
    for (const side of [-1, 1]) {
      const [x, z, tx, tz] = pointAt(s + random() * 1.5), off = 3.8 + Math.pow(random(), 1.4) * 9;
      const px = x - tz * side * off + (random() - .5) * 1.5, pz = z + tx * side * off + (random() - .5) * 1.5;
      if (distToWalk(px, pz) < 3.6) continue;
      if (Math.abs(px + 8) < 7 && Math.abs(pz + 16) < 8.5) continue; // cabin and its porch
      if (Math.hypot(px + 1, pz + 5) < 7 || pz > -1 && px > -12) continue; // the fire yard and its benches
      if (openings.some(i => Math.hypot(px - stationPoints[i][0], pz - stationPoints[i][1]) < 8.5)) continue;
      if (trees.some(([qx, qz]) => Math.hypot(px - qx, pz - qz) < 2.8)) continue;
      if (Math.abs(px) > 48 || Math.abs(pz) > 48) continue;
      trees.push([+px.toFixed(2), +pz.toFixed(2), +(.85 + random() * .4).toFixed(2), trees.length % 3]);
    }
  }
  return trees;
})();
