/** The walk: out of the clearing, through the forest and across open country to a ridge more than half a
 * kilometre away. Distance is time — each step away from the fire is a step through history — so the road is
 * long and leads somewhere you can see, and from its end you can look back along everything you lit.
 * Kept free of three.js so terrain.ts, scene.ts and tests can import it directly. */
import { forestTrees } from "./trees.ts";

type P = [number, number];
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const seeded = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

/** West-south-west: from the ridge, home lies east, under the aurora, with the lake to its left. */
export const AXIS = (() => { const x = -14.6, z = -4.4, dx = -525, dz = 124, l = Math.hypot(dx, dz); return { x, z, dx: dx / l, dz: dz / l, length: 545 }; })();
const axisPoint = (u: number, v: number): P => [AXIS.x + AXIS.dx * u - AXIS.dz * v, AXIS.z + AXIS.dz * u + AXIS.dx * v];
/** A road that wanders a little, as old roads do, then runs straight up the last slope to the crest. */
const wander = (u: number) => sm(0, 70, u) * (1 - sm(455, 535, u)) * (17 * Math.sin(u / 92) + 8 * Math.sin(u / 36 + 1.2));

const control: P[] = [[-2.3, -2.4], [-8, -2.8], [-14.6, -4.4]];
for (let u = 24; u < AXIS.length; u += 24) control.push(axisPoint(u, wander(u)));
control.push(axisPoint(AXIS.length, 0));

/** Centripetal Catmull–Rom through the control points, then resampled to equal steps of about a metre. */
function smooth(points: P[], per = 24): P[] {
  const ext: P[] = [[2 * points[0][0] - points[1][0], 2 * points[0][1] - points[1][1]], ...points,
    [2 * points[points.length - 1][0] - points[points.length - 2][0], 2 * points[points.length - 1][1] - points[points.length - 2][1]]];
  const out: P[] = [];
  const knot = (t: number, a: P, b: P) => t + Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  const mix = (a: P, b: P, ta: number, tb: number, t: number): P => { const k = (t - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [ext[i], ext[i + 1], ext[i + 2], ext[i + 3]];
    const t0 = 0, t1 = knot(t0, p0, p1), t2 = knot(t1, p1, p2), t3 = knot(t2, p2, p3);
    for (let k = 0; k < per; k++) {
      const t = t1 + (t2 - t1) * k / per;
      const a1 = mix(p0, p1, t0, t1, t), a2 = mix(p1, p2, t1, t2, t), a3 = mix(p2, p3, t2, t3, t);
      const b1 = mix(a1, a2, t0, t2, t), b2 = mix(a2, a3, t1, t3, t);
      out.push(mix(b1, b2, t1, t2, t));
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
function resample(line: P[]) {
  const cum = [0]; for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const total = cum[cum.length - 1], n = Math.ceil(total), step = total / n, out: P[] = [];
  for (let k = 0, j = 0; k <= n; k++) {
    const s = k * step; while (j < line.length - 2 && cum[j + 1] < s) j++;
    const t = (s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    out.push([line[j][0] + (line[j + 1][0] - line[j][0]) * t, line[j][1] + (line[j + 1][1] - line[j][1]) * t]);
  }
  return { points: out, step, total };
}
const walk = resample(smooth(control));
/** The road, one point about every metre: index × riteStep = metres walked from the fire. */
export const ritePoints: P[] = walk.points;
export const riteStep = walk.step;
export const riteLength = walk.total;

/** Position and heading on the road at s metres. */
export function pointAt(s: number): [number, number, number, number] {
  const f = Math.max(0, Math.min(ritePoints.length - 1.0001, s / riteStep)), i = Math.floor(f), t = f - i;
  const [ax, az] = ritePoints[i], [bx, bz] = ritePoints[i + 1], l = Math.hypot(bx - ax, bz - az) || 1;
  return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / l, (bz - az) / l];
}
/** A point beside the road; side +1 is on your right as you walk away from home. */
export function besideRoad(s: number, side: number, off: number): P {
  const [x, z, tx, tz] = pointAt(s); return [x - tz * side * off, z + tx * side * off];
}

/** Where things happen, in metres from the fire. */
export const THRESHOLD = 22;
export const stationMeters = [0, 100, 172, 248, 322, 398, 474, riteLength];
/** `forest` is the first, darkest stretch of open moor beyond home (the name is kept for the cues that use it). */
export const zones = { forest: [12, 150] as const, field: [150, 205] as const, ash: [432, 506] as const, ascent: [506, riteLength] as const };
const station = (i: number) => pointAt(stationMeters[i]);

/** The land rises gently towards the far ridge and falls away beyond it. The fourth station sits on a low knoll. */
export function riteRise(x: number, z: number) {
  const ox = x - AXIS.x, oz = z - AXIS.z, u = ox * AXIS.dx + oz * AXIS.dz, v = -ox * AXIS.dz + oz * AXIS.dx;
  const rise = (5 * sm(130, 400, u) + 15 * sm(390, 545, u)) * (1 - .8 * sm(550, 720, u)) * Math.exp(-((v / 170) ** 2));
  const [kx, kz] = station(4);
  return rise + 2.2 * Math.exp(-((x - kx) ** 2 + (z - kz) ** 2) / (2 * 11 * 11));
}
/** The road keeps close ground detail all the way to the ridge: rows across it about every metre, finer near the
 * road. Its outer band sinks just below the coarse open-country ground, which takes over without seams. */
export const CORRIDOR = 46;
export function corridorGrid() {
  const offsets = [0, .6, 1.2, 1.8, 2.5, 3.3, 4.2, 5.2, 6.4, 7.8, 9.4, 11.2, 13.4, 16, 19, 22.5, 26.5, 31, 36, 41, CORRIDOR];
  const cols = [...offsets.slice(1).reverse().map(o => -o), ...offsets], rows: number[] = [];
  for (let s = 24; s <= riteLength + 70; s += s > riteLength ? 1.5 : 1) rows.push(s);
  const positions = new Float32Array(rows.length * cols.length * 3), index: number[] = [];
  rows.forEach((s, r) => {
    const [ex, ez, tx, tz] = pointAt(Math.min(s, riteLength)), over = Math.max(0, s - riteLength), x0 = ex + tx * over, z0 = ez + tz * over;
    cols.forEach((o, c) => { const k = (r * cols.length + c) * 3; positions[k] = x0 - tz * o; positions[k + 2] = z0 + tx * o; });
  });
  const C = cols.length;
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < C - 1; c++) { const a = r * C + c, b = a + 1, d = a + C, e = d + 1; index.push(a, b, d, b, e, d); }
  return { positions, index };
}
export function corridorLift(x: number, z: number) {
  const edge = Math.max(Math.abs(x), Math.abs(z));
  return -.6 * sm(28, 34, distToWalk(x, z, 60)) - (edge < 51.5 ? .03 : 0);
}

/** The burnt country around the sixth station, darker underfoot (0 … 1). */
export function ashAmount(x: number, z: number) {
  const [cx, cz] = pointAt((zones.ash[0] + zones.ash[1]) / 2);
  return sm(46, 24, Math.hypot(x - cx, z - cz));
}

/** Distance to the road. A coarse polyline (4 m chords of a gentle curve) indexed in a grid,
 * exact up to `range` metres; anything farther reports at least `range`. */
const chord = ritePoints.filter((_, i) => i % 4 === 0 || i === ritePoints.length - 1);
export const riteSegments: [number, number, number, number][] = chord.slice(1).map((p, i) => [chord[i][0], chord[i][1], p[0], p[1]]);
function grid(range: number, cell: number) {
  const cells = new Map<string, number[]>();
  riteSegments.forEach(([a, b, c, d], i) => {
    for (let gx = Math.floor((Math.min(a, c) - range) / cell); gx <= Math.floor((Math.max(a, c) + range) / cell); gx++)
      for (let gz = Math.floor((Math.min(b, d) - range) / cell); gz <= Math.floor((Math.max(b, d) + range) / cell); gz++) {
        const key = gx + "," + gz; let list = cells.get(key); if (!list) cells.set(key, list = []); list.push(i);
      }
  });
  return (x: number, z: number) => {
    const list = cells.get(Math.floor(x / cell) + "," + Math.floor(z / cell)); if (!list) return range;
    let best = range;
    for (const i of list) {
      const [a, b, c, d] = riteSegments[i], dx = c - a, dz = d - b, t = Math.max(0, Math.min(1, ((x - a) * dx + (z - b) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - a - dx * t, z - b - dz * t));
    }
    return best;
  };
}
const nearGrid = grid(8, 10), wideGrid = grid(60, 30);
export function distToWalk(x: number, z: number, range = 8) { return range <= 8 ? nearGrid(x, z) : wideGrid(x, z); }

/** The paths of the homestead, which the walk's trees must also keep clear of. */
const homePaths: [number, number, number, number][] = [[1, 5, 1, -24], [1, -8, -7, -8], [1, -24, -2.4, -24], [1, -2, -1, -5], [1, -1.4, 1.8, -1.4], [-1.9, -3.6, -2.3, -2.4]];
const distHome = (x: number, z: number) => Math.min(...homePaths.map(([a, b, c, d]) => {
  const dx = c - a, dz = d - b, t = Math.max(0, Math.min(1, ((x - a) * dx + (z - b) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - a - dx * t, z - b - dz * t);
}));

/** The road's trees: [x, z, scale, variant, s]. Variants 0–2 are the near firs, 3 the distant silhouette.
 * The road leaves the trees around home and crosses open country under the whole sky: a few lone firs and
 * small groves, none in the burnt country, almost none on the bare slope to the crest. */
export const walkTrees: [number, number, number, number, number][] = (() => {
  const random = seeded(2026), trees: [number, number, number, number, number][] = [];
  const clear = [2, 4, 5].map((i, k) => [...station(i).slice(0, 2), [30, 25, 14][k]]);
  const grove = (s: number) => Math.pow(Math.max(0, Math.sin(s / 31 + .6) * Math.sin(s / 11.5)), 2);
  const density = (s: number) => s < 40 ? .7 - sm(20, 40, s) * .5 : s < zones.ash[0] ? .015 + .28 * grove(s) : s < zones.ascent[0] ? 0 : .02;
  const cellOf = (x: number, z: number) => Math.floor(x / 4) + "," + Math.floor(z / 4), taken = new Map<string, P[]>();
  const add = (x: number, z: number) => { const key = cellOf(x, z); taken.set(key, [...(taken.get(key) ?? []), [x, z]]); };
  const crowded = (x: number, z: number) => { const gx = Math.floor(x / 4), gz = Math.floor(z / 4);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [qx, qz] of taken.get((gx + i) + "," + (gz + j)) ?? []) if (Math.hypot(x - qx, z - qz) < 2.9) return true;
    return false; };
  for (const [x, z] of forestTrees) add(x, z);
  for (let s = zones.forest[0]; s < riteLength + 40; s += 1.15) for (const side of [-1, 1]) for (const row of [0, 1]) {
    if (random() > density(Math.min(s, riteLength)) * (row ? .8 : 1)) continue;
    const off = row ? 11 + Math.pow(random(), 1.1) * 26 : 3.9 + random() * 7, [bx, bz] = besideRoad(Math.min(s + random(), riteLength), side, off);
    const x = bx + (random() - .5) * 2, z = bz + (random() - .5) * 2;
    if (s > riteLength && off < 25) continue;
    if (distToWalk(x, z) < 3.9 || distHome(x, z) < 3.2) continue;
    if (Math.abs(x + 8) < 7 && Math.abs(z + 16) < 8.5) continue; // the cabin and its porch
    if (Math.hypot(x + 1, z + 5) < 7 || (z > -1 && x > -12 && x < 30)) continue; // the fire yard and its benches
    if (x > -2) continue; // the lake side of the clearing stays as it was
    if (clear.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) continue;
    if (s > zones.ash[0] - 6 && s < zones.ash[1] + 4) continue;
    if (crowded(x, z)) continue;
    add(x, z);
    trees.push([+x.toFixed(2), +z.toFixed(2), +(.85 + random() * .45).toFixed(2), off > 11.5 ? 3 : [2, 2, 1, 1, 0][Math.floor(random() * 5)], +s.toFixed(1)]);
  }
  return trees;
})();

/** The burnt country: standing dead trunks, [x, z, height, lean, s]. */
export const ashTrunks: [number, number, number, number, number][] = (() => {
  const random = seeded(1914), out: [number, number, number, number, number][] = [];
  for (let s = zones.ash[0] - 4; s < zones.ash[1] + 2; s += .9) {
    if (random() > .6) continue;
    const side = random() > .5 ? 1 : -1, off = 3 + Math.pow(random(), 1.3) * 34, [x, z] = besideRoad(s, side, off);
    if (Math.abs(s - stationMeters[6]) < 7 && off < 9) continue;
    if (distToWalk(x, z) < 2.6 || out.some(([qx, qz]) => Math.hypot(x - qx, z - qz) < 2.2)) continue;
    out.push([+x.toFixed(2), +z.toFixed(2), +(1.4 + random() * 6).toFixed(2), +((random() - .5) * .35).toFixed(3), +s.toFixed(1)]);
  }
  return out;
})();
