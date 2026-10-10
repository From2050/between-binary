import * as THREE from "three";
import { walkTrees, ashTrunks, besideRoad, riteLength, zones, distToWalk, corridorLift, stationMeters } from "./rite-path.ts";
import type { createWind } from "./wind";

type Source = { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] };
type Placement = { x: number; z: number; s: number; scale: [number, number, number]; ry: number; color?: THREE.Color; sink?: number };
const CHUNK = 48;
const seeded = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

/** Everything that lines the long road: its forest, groves, grass, stones and the burnt country.
 * Instances are split into 48 m stretches so the renderer only draws what is near enough to matter. */
export function addRoadside(o: {
  scene: THREE.Scene; height: (x: number, z: number) => number; wind: ReturnType<typeof createWind>; small: boolean;
  forest?: THREE.Group; rock?: Source; grass?: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial };
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
          m.position.set(p.x, ground(p.x, p.z) - (p.sink ?? 0), p.z); m.rotation.set(0, p.ry, 0); m.scale.set(...p.scale); m.updateMatrix(); mesh.setMatrixAt(i, m.matrix);
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
  }

  // ─── Grass: thick in the open country, thin under the trees, dry and dark among the ashes ───
  if (o.grass) {
    const random = seeded(311), placements: Placement[] = [], [fx, fz] = besideRoad(stationMeters[2], -1, 1.9);
    for (let s = 30; s < riteLength + 30; s += small ? 1.1 : .5) for (const side of [-1, 1]) {
      const zone = s < zones.forest[1] ? .3 : s < zones.ash[0] ? 1 : s < zones.ash[1] ? .45 : .8;
      for (let k = 0; k < 3; k++) {
        if (random() > zone) continue;
        const off = 1.25 + Math.pow(random(), 1.7) * 17, [x, z] = besideRoad(Math.min(s + random() * .5, riteLength), side, off);
        if (s > riteLength && off < 6) continue;
        if (distToWalk(x, z) < 1.1 || Math.hypot(x - fx, z - fz) < 27) continue;
        const ash = s > zones.ash[0] - 4 && s < zones.ash[1] + 2, size = .7 + random() * .9;
        const color = ash ? new THREE.Color(.34 + random() * .1, .29, .22) : s < zones.forest[1] ? new THREE.Color(.62 + random() * .2, .7, .56) : new THREE.Color(.78 + random() * .22, .8 + random() * .2, .62 + random() * .2);
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

  // ─── The burnt country: standing dead trunks and broken snags ───
  {
    const trunk = new THREE.CylinderGeometry(.07, .17, 1, 7, 3).translate(0, .5, 0), tp = trunk.attributes.position;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) * (1 + Math.sin(y * 9 + i) * .08)); }
    trunk.computeVertexNormals();
    const char = new THREE.MeshStandardMaterial({ color: 0x1d1a18, roughness: 1 });
    const placements: Placement[] = ashTrunks.map(([x, z, h, lean, s], i) => ({ x, z, s, scale: [1 + h * .05, h, 1 + h * .05] as [number, number, number], ry: i * 1.7, sink: .1 }));
    instance([{ geometry: trunk, material: char }], placements, 600, { shadow: true });
    // a few fallen and leaning ones, so it reads as a forest that burned
    const fallen: Placement[] = ashTrunks.filter((_, i) => i % 3 === 0).map(([x, z, h, , s], i) => ({ x: x + 1.2, z: z - .8, s, scale: [h * .8, 1.2, 1.2] as [number, number, number], ry: i * 2.3, sink: .05 }));
    const lying = trunk.clone().rotateZ(Math.PI / 2 - .06);
    instance([{ geometry: lying, material: char }], fallen, 400, { shadow: true });
  }

  const tmp = new THREE.Vector3();
  return {
    group,
    /** draw only the stretches near enough to see */
    update(camera: THREE.Camera) {
      for (const c of chunks) { const b = c.mesh.boundingSphere; if (!b) continue; c.mesh.visible = tmp.copy(b.center).distanceTo(camera.position) - b.radius < c.range; }
    },
  };
}
