import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { walkTrees, ashTrunks, besideRoad, riteLength, zones, distToWalk, corridorLift, stationMeters } from "./rite-path.ts";
import type { createWind } from "./wind";

type Source = { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] };
export type Placement = { x: number; z: number; s: number; scale: [number, number, number]; ry: number; color?: THREE.Color; sink?: number; y?: number; rx?: number; rz?: number };
const CHUNK = 48;
const seeded = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

/** Everything that lines the long road: its forest, groves, grass, stones and the burnt country.
 * Instances are split into 48 m stretches so the renderer only draws what is near enough to matter. */
export function addRoadside(o: {
  scene: THREE.Scene; height: (x: number, z: number) => number; wind: ReturnType<typeof createWind>; small: boolean;
  forest?: THREE.Group; rock?: Source; grass?: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial };
  ferns?: Source[]; grasses?: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }[];
}) {
  const { scene, height, wind, small } = o;
  const group = new THREE.Group(); group.name = "The road's country"; scene.add(group);
  const chunks: { mesh: THREE.InstancedMesh; range: number }[] = [];
  const m = new THREE.Object3D();
  const ground = (x: number, z: number) => height(x, z) + corridorLift(x, z);

  function instance(parts: Source[], placements: Placement[], range: number, opts: { shadow: boolean; wind?: "canopy" | "grass" | "plant" }) {
    const byChunk = new Map<number, Placement[]>();
    for (const p of placements) { const k = Math.floor(p.s / CHUNK); byChunk.set(k, [...(byChunk.get(k) ?? []), p]); }
    for (const part of parts) {
      let first: THREE.InstancedMesh | null = null;
      for (const list of byChunk.values()) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        list.forEach((p, i) => {
          m.position.set(p.x, p.y ?? ground(p.x, p.z) - (p.sink ?? 0), p.z); m.rotation.set(p.rx ?? 0, p.ry, p.rz ?? 0); m.scale.set(...p.scale); m.updateMatrix(); mesh.setMatrixAt(i, m.matrix);
          if (p.color) mesh.setColorAt(i, p.color);
        });
        mesh.castShadow = opts.shadow; mesh.receiveShadow = true;
        if (opts.wind) {
          if (!first) { wind.install(mesh, opts.wind); first = mesh; }
          else { mesh.customDepthMaterial = first.customDepthMaterial; mesh.customDistanceMaterial = first.customDistanceMaterial; }
        }
        mesh.computeBoundingSphere(); group.add(mesh); chunks.push({ mesh, range });
      }
    }
  }

  // ─── Firs: the near ones in full detail, the rows behind as the distant silhouette ───
  if (o.forest) {
    o.forest.updateMatrixWorld(true);
    const variants = new Map<number, Source[]>();
    o.forest.children.forEach(variant => {
      const index = variant.name === "fir_distance" ? 3 : variant.name.includes("_a_") ? 0 : variant.name.includes("_b_") ? 1 : 2, parts: Source[] = [];
      variant.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        const material = (node.material as THREE.MeshStandardMaterial).clone();
        if (/twig/.test(material.name)) { material.alphaTest = .42; material.transparent = false; material.depthWrite = true; material.side = THREE.DoubleSide; material.roughness = .95; }
        if (material.map) material.map.anisotropy = 4;
        parts.push({ geometry: node.geometry.clone().applyMatrix4(node.matrixWorld), material });
      });
      variants.set(index, parts);
    });
    for (const [index, parts] of variants) {
      const placements = walkTrees.filter((t, i) => t[3] === index && (!small || index !== 3 || i % 2 === 0))
        .map(([x, z, scale, , s], i) => ({ x, z, s, scale: [scale, scale, scale] as [number, number, number], ry: i * 2.399 + index * .8, sink: .045 }));
      if (placements.length) instance(parts, placements, index === 3 ? 1200 : 170, { shadow: index !== 3, wind: "canopy" });
    }
    // Young firs between the trunks give the forest a middle height, so it closes in at eye level.
    const young = variants.get(2);
    if (young) {
      const random = seeded(808), placements: Placement[] = [];
      for (let s = zones.forest[0] + 8; s < 205; s += o.small ? 2.6 : 1.3) {
        if (s > 40 || random() > .5) continue;
        const side = random() > .5 ? 1 : -1, off = 3.3 + Math.pow(random(), 1.3) * 16, [x, z] = besideRoad(s, side, off);
        if (distToWalk(x, z) < 3 || walkTrees.some(t => Math.hypot(t[0] - x, t[1] - z) < 1.6)) continue;
        if (Math.abs(s - stationMeters[1]) < 6 && side > 0 && off < 7) continue; // the painted rock stays clear
        const k = .26 + random() * .26; placements.push({ x, z, s, scale: [k, k * (.9 + random() * .3), k], ry: random() * 6.28, sink: .02 });
      }
      instance(young, placements, 130, { shadow: true, wind: "canopy" });
    }
  }
  if (o.ferns?.length) {
    const random = seeded(919), lists = o.ferns.map(() => [] as Placement[]);
    for (let s = zones.forest[0] + 4; s < 190; s += o.small ? .5 : .22) {
      if (s > 40) continue;
      const side = random() > .5 ? 1 : -1, off = 1.7 + Math.pow(random(), 1.5) * 15, [x, z] = besideRoad(s, side, off);
      if (distToWalk(x, z) < 1.5) continue;
      const k = .55 + random() * .75; lists[Math.floor(random() * lists.length)].push({ x, z, s, scale: [k, k * (.85 + random() * .3), k], ry: random() * 6.28, sink: .01, color: new THREE.Color(.62 + random() * .2, .68 + random() * .15, .55) });
    }
    o.ferns.forEach((fern, i) => instance([fern], lists[i], o.small ? 45 : 65, { shadow: false, wind: "plant" }));
  }

  // ─── Grass: the moor is thick with it, in three heights, all moving in the same wind; dry and dark among the ashes ───
  if (o.grasses?.length) {
    const random = seeded(311), kinds = o.grasses, lists = kinds.map(() => [] as Placement[]), [fx, fz] = besideRoad(stationMeters[2], -1, 1.9);
    const weights = kinds.map(k => k.geometry.attributes.position.count > 900 ? .34 : k.geometry.attributes.position.count > 360 ? .46 : .2);
    const pick = () => { let r = random() * weights.reduce((a, b) => a + b, 0); for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; } return 0; };
    for (let s = 26; s < riteLength + 40; s += small ? .5 : .25) for (const side of [-1, 1]) for (let n = 0; n < (small ? 4 : 7); n++) {
      const ash = s > zones.ash[0] - 4 && s < zones.ash[1] + 2, zone = s < 40 ? .45 : ash ? .4 : 1;
      if (random() > zone) continue;
      const off = 1.05 + Math.pow(random(), 1.6) * 20, [bx, bz] = besideRoad(Math.min(s + random() * .35, riteLength), side, off), x = bx + (random() - .5) * .6, z = bz + (random() - .5) * .6;
      if (s > riteLength && off < 6) continue;
      if (distToWalk(x, z) < .95 || Math.hypot(x - fx, z - fz) < 27) continue;
      const patch = .55 + .45 * Math.sin(x * .21 + Math.sin(z * .17) * 2) * Math.sin(z * .23 + x * .07);
      if (random() > .35 + patch * .65) continue;
      const k = pick(), size = .75 + random() * .75;
      const color = ash ? new THREE.Color(.32 + random() * .1, .27, .2) : new THREE.Color(.74 + random() * .26, .78 + random() * .2, .58 + random() * .2);
      lists[k].push({ x, z, s, scale: [size, size * (.8 + random() * .45) * (ash ? .7 : 1), size], ry: random() * 6.28, color, sink: .012 });
    }
    kinds.forEach((kind, i) => instance([kind], lists[i], small ? 60 : 95, { shadow: false, wind: "grass" }));
  } else if (o.grass) {
    const random = seeded(311), placements: Placement[] = [], [fx, fz] = besideRoad(stationMeters[2], -1, 1.9);
    for (let s = 30; s < riteLength + 30; s += small ? 1.1 : .5) for (const side of [-1, 1]) {
      const zone = s < 40 ? .4 : s < zones.ash[0] ? 1 : s < zones.ash[1] ? .45 : .8;
      for (let k = 0; k < 3; k++) {
        if (random() > zone) continue;
        const off = 1.25 + Math.pow(random(), 1.7) * 17, [x, z] = besideRoad(Math.min(s + random() * .5, riteLength), side, off);
        if (s > riteLength && off < 6) continue;
        if (distToWalk(x, z) < 1.1 || Math.hypot(x - fx, z - fz) < 27) continue;
        const ash = s > zones.ash[0] - 4 && s < zones.ash[1] + 2, size = .7 + random() * .9;
        const color = ash ? new THREE.Color(.34 + random() * .1, .29, .22) : s < 40 ? new THREE.Color(.62 + random() * .2, .7, .56) : new THREE.Color(.78 + random() * .22, .8 + random() * .2, .62 + random() * .2);
        placements.push({ x, z, s, scale: [size, size * (.8 + random() * .4) * (ash ? .7 : 1), size], ry: random() * 6.28, color, sink: .012 });
      }
    }
    const material = o.grass.material.clone(); material.color.set(0xffffff);
    instance([{ geometry: o.grass.geometry, material }], placements, small ? 55 : 80, { shadow: false, wind: "grass" });
  }

  // ─── Stones: scattered all along, gathering on the bare slope below the ridge ───
  if (o.rock) {
    const random = seeded(77), placements: Placement[] = [];
    for (let s = 30; s < riteLength + 50; s += 2.2) {
      const many = s > zones.ascent[0] ? 3 : 1;
      for (let k = 0; k < many; k++) {
        if (random() > .45) continue;
        const off = 2 + Math.pow(random(), 1.2) * 30, [x, z] = besideRoad(Math.min(s, riteLength), random() > .5 ? 1 : -1, off);
        if (distToWalk(x, z) < 1.8) continue;
        const size = .25 + Math.pow(random(), 2) * (s > zones.ascent[0] ? 1.9 : 1.2);
        placements.push({ x, z, s, scale: [size, size * (.5 + random() * .4), size * (.8 + random() * .4)], ry: random() * 6.28, sink: size * .12 });
      }
    }
    instance([o.rock], placements, 260, { shadow: true });
  }

  // ─── The burnt country: dead snags with broken branches, a few fallen ───
  {
    const r = seeded(51), parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(.045, .17, 1, 8, 4).translate(0, .5, 0)];
    for (let k = 0; k < 4; k++) { const h = .35 + r() * .55, len = .12 + r() * .2, a = r() * 6.28;
      parts.push(new THREE.CylinderGeometry(.012, .03, len, 5).translate(0, len / 2, 0).rotateZ(.9 + r() * .5).rotateY(a).translate(0, h, 0)); }
    const trunk = mergeGeometries(parts.map(g => g.toNonIndexed()))!, tp = trunk.attributes.position;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) * (1 + Math.sin(y * 9 + i * .3) * .07)); }
    trunk.computeVertexNormals();
    const char = new THREE.MeshStandardMaterial({ color: 0x1d1a18, roughness: 1 });
    const placements: Placement[] = ashTrunks.map(([x, z, h, lean, s], i) => ({ x, z, s, scale: [1 + h * .06, h, 1 + h * .06] as [number, number, number], ry: i * 1.7, rz: lean, sink: .1 }));
    instance([{ geometry: trunk, material: char }], placements, 600, { shadow: true });
    // a few fallen and leaning ones, so it reads as a forest that burned
    const fallen: Placement[] = ashTrunks.filter((_, i) => i % 3 === 0).map(([x, z, h, , s], i) => ({ x: x + 1.2, z: z - .8, s, scale: [h * .8, 1.2, 1.2] as [number, number, number], ry: i * 2.3, sink: .05 }));
    const lying = trunk.clone().rotateZ(Math.PI / 2 - .06);
    instance([{ geometry: lying, material: char }], fallen, 400, { shadow: true });
  }

  const tmp = new THREE.Vector3();
  return {
    group,
    /** add more instances drawn in stretches (the cairns use this) */
    instance,
    /** draw only the stretches near enough to see */
    update(camera: THREE.Camera) {
      for (const c of chunks) { const b = c.mesh.boundingSphere; if (!b) continue; c.mesh.visible = tmp.copy(b.center).distanceTo(camera.position) - b.radius < c.range; }
    },
  };
}
