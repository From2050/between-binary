import * as THREE from "three";
import { steleGeometry, stoneMaterial, seeded, type Top } from "./rite-memorials.ts";
import { carving, columns, line, frame, silhouette, FONTS, type CarvingOptions } from "./rite-inscriptions.ts";

/** The memorials of those we can name, each in the form their own people would have made it, carved in their own
 * script with their own words: a rock inscription for Laozi, a stele on a plinth for Confucius, a stupa for the
 * Buddha, an Attic grave stele for Socrates, the alabaster disc of Enheduanna, Renaissance and modern stones for the
 * astronomers, a granite headstone with gold letters for P. C. Chang. Each also has what they worked with.
 * Built in the memorial's frame: +z faces the road, y up, 0 the ground. */

export type Named = { group: THREE.Group; lamp: THREE.Vector3; focus: number; top: number; hit: THREE.Vector3; ghost: [number, number, number]; paint: (() => void)[] };
type Env = { rock: (scale: THREE.Vector3) => THREE.Mesh; shadow: (id: string) => HTMLCanvasElement | null };

const shadowed = <T extends THREE.Object3D>(m: T) => { m.traverse(n => { if ((n as THREE.Mesh).isMesh) { n.castShadow = true; n.receiveShadow = true; } }); return m; };
const mat = (color: number, roughness = .8, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const brass = () => mat(0x9a7a46, .4, .8);
/** a slab with a carved face: the face is the box's front (+z) */
function slab(w: number, h: number, d: number, top: Top, seed: number, face: THREE.Material, side: THREE.Material) {
  const m = new THREE.Mesh(steleGeometry(w, h, d, top, seed), [side, side, side, side, face, side]); m.castShadow = m.receiveShadow = true; return m;
}
const plinth = (w: number, h: number, d: number, side: THREE.Material, seed: number) => { const m = new THREE.Mesh(steleGeometry(w, h, d, "flat", seed, .5), side); m.castShadow = m.receiveShadow = true; return m; };
const placed = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };
const capOf = (top: Top, w: number) => top === "round" ? w * .5 : top === "arch" ? w * .3 : top === "peak" ? w * .28 : w * .07;

export function namedMemorial(id: string, env: Env): Named | null {
  const group = new THREE.Group(), paint: (() => void)[] = [];
  const carve = (o: CarvingOptions) => { const c = carving(o); paint.push(c.paint); return c.material; };
  switch (id) {
    // ── Enheduanna: the alabaster disc of the priestess, her procession in relief, her name in cuneiform
    case "enheduanna": {
      const side = stoneMaterial(0xe2d6bc), R = .5;
      const face = carve({ w: 1, h: 1, tint: "#e8dcc2", seed: 21, polish: .3, px: 640,
        draw: (g, W, H) => { g.lineWidth = 7; g.beginPath(); g.arc(W / 2, H / 2, W * .47, 0, Math.PI * 2); g.stroke(); g.lineWidth = 5; for (const y of [.33, .67]) { g.beginPath(); g.moveTo(W * .07, H * y); g.lineTo(W * .93, H * y); g.stroke(); }
          g.font = `${W * .1}px ${FONTS.cuneiform}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("𒀭𒋀𒆠", W / 2, H * .2); g.fillText("𒂗𒃶𒌌𒀭𒈾", W / 2, H * .8); },
        relief: (g, W, H) => { silhouette(g, env.shadow("enheduanna"), W * .5, H * .665, H * .32); silhouette(g, env.shadow("scribe"), W * .24, H * .665, H * .22); silhouette(g, env.shadow("carrier"), W * .76, H * .665, H * .27, true); } });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, .1, 64).rotateY(-Math.PI / 2).rotateX(Math.PI / 2), [side, face, side]); disc.position.set(0, .4 + R, 0); // turned about its axis so its face reads upright
      disc.rotation.x = -.06; group.add(shadowed(disc));
      const base = plinth(.8, .4, .36, stoneMaterial(0xb9ab92), 22); group.add(base);
      const tablet = new THREE.Mesh(new THREE.BoxGeometry(.16, .2, .04), mat(0x9a7652, .95)); tablet.position.set(.3, .42, .12); tablet.rotation.set(-.25, -.3, 0); group.add(shadowed(tablet));
      return { group, lamp: new THREE.Vector3(-.28, 0, .42), focus: .9, top: 1.45, hit: new THREE.Vector3(1.2, 1.5, .7), ghost: [-1.05, 0, -.25], paint };
    }
    // ── Laozi: words cut into a boulder by the road and filled with red, as on Chinese mountainsides
    case "laozi": {
      const rock = env.rock(new THREE.Vector3(3.3, 4.6, 2.3)); rock.position.set(0, -.35, -.9); rock.rotation.y = .15; group.add(rock);
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(rock), mid = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      const face = carve({ w: 1, h: 1.3, tint: "#ffffff", seed: 31, fill: "red", decal: true, depth: 1.2,
        draw: (g, W, H) => { columns(g, ["知人者智", "自知者明"], { right: W * .74, top: H * .08, size: W * .26, font: FONTS.kai, gap: 1.25 }); columns(g, ["老子"], { right: W * .12, top: H * .62, size: W * .11, font: FONTS.kai }); } });
      // lay the inscription onto the rock's face, where the road looks at it
      const aimY = Math.min(1.1, box.min.y + size.y * .55), ray = new THREE.Raycaster(new THREE.Vector3(mid.x, aimY, 4), new THREE.Vector3(0, 0, -1)), hit = ray.intersectObject(rock)[0];
      const at = hit ? group.worldToLocal(hit.point.clone()) : new THREE.Vector3(0, 1, .3), normal = hit?.face ? hit.face.normal.clone().transformDirection(rock.matrixWorld) : new THREE.Vector3(0, 0, 1);
      const dw = Math.min(1.15, size.x * .6), decal = new THREE.Mesh(new THREE.PlaneGeometry(dw, dw * 1.3, 12, 16), face); decal.position.copy(at).addScaledVector(normal, .03); decal.lookAt(group.localToWorld(at.clone().add(normal)));
      // bend the plane onto the rock so it never floats
      { const p = decal.geometry.attributes.position, cast = new THREE.Raycaster(); decal.updateMatrixWorld(true); rock.updateMatrixWorld(true);
        for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i), p.getY(i), .6), w = decal.localToWorld(v.clone()), dir = decal.localToWorld(new THREE.Vector3(p.getX(i), p.getY(i), -1)).sub(w).normalize(); cast.set(w, dir); const h = cast.intersectObject(rock)[0];
          if (h) { const l = decal.worldToLocal(h.point.clone()); p.setZ(i, l.z + .015); } else p.setZ(i, 0); } p.needsUpdate = true; decal.geometry.computeVertexNormals(); }
      group.add(decal);
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(.018, .024, 1.7, 7).translate(0, .85, 0), mat(0x5a4330, .9)); staff.position.set(box.max.x - .2, -.05, box.max.z - .1); staff.rotation.z = .2; group.add(shadowed(staff));
      const gourd = new THREE.Group(); for (const [r, y] of [[.085, .09], [.06, .22]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat(0xb88a3c, .6)); b.position.y = y; gourd.add(b); } gourd.position.set(box.max.x - .45, 0, box.max.z + .1); group.add(shadowed(gourd));
      return { group, lamp: new THREE.Vector3(-.55, 0, box.max.z + .35), focus: Math.min(1.2, aimY), top: box.max.y, hit: new THREE.Vector3(size.x, box.max.y, size.z), ghost: [box.min.x - .7, 0, box.max.z - .2], paint };
    }
    // ── Confucius: a stele on a stepped plinth, a carved head with its title, his words in columns, bamboo slips beside it
    case "confucius": {
      const side = stoneMaterial(0xa9aaa4), w = .84, h = 1.6;
      const face = carve({ w, h, tint: "#b4b4ae", seed: 41, polish: .2,
        draw: (g, W, H) => { frame(g, W * .07, H * .04, W * .86, H * .92, 5); columns(g, ["己所不欲", "勿施於人"], { right: W * .64, top: H * .13, size: W * .25, font: FONTS.kai, gap: 1.15, lead: 1.12 });
          columns(g, ["論語 衛靈公"], { right: W * .2, top: H * .55, size: W * .075, font: FONTS.kai, weight: 400 }); } });
      group.add(placed(slab(w, h, .24, "flat", 42, face, side), 0, .32, 0));
      const head = carve({ w: .98, h: .6, tint: "#b0b0aa", seed: 43,
        draw: (g, W, H) => { frame(g, W * .34, H * .3, W * .32, H * .58, 4, false); columns(g, ["至聖", "先師"], { right: W * .56, top: H * .36, size: W * .09, font: FONTS.kai, gap: 1.2 }); },
        relief: (g, W, H) => { g.lineWidth = 9; for (let k = 0; k < 7; k++) { const x = W * (.12 + k * .126), y = H * (.48 + (k % 2) * .18); if (x > W * .3 && x < W * .7) continue; g.beginPath(); g.arc(x, y, W * .05, 0, Math.PI * 1.6); g.stroke(); g.beginPath(); g.arc(x, y, W * .022, Math.PI, Math.PI * 2.5); g.stroke(); } } });
      group.add(placed(slab(.98, .6, .3, "round", 44, head, side), 0, .32 + h - .02, 0));
      const base = plinth(1.25, .34, .72, stoneMaterial(0x98988f), 45); group.add(base); const step = plinth(1.45, .12, .92, stoneMaterial(0x8e8e86), 46); step.position.y = -.08; group.add(step);
      // bamboo slips, tied in a bundle
      const slips = new THREE.Group(); for (let k = 0; k < 14; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(.012, .005, .3), mat(k % 3 ? 0xc6a865 : 0xb6965a, .85)); s.position.x = (k - 6.5) * .013; slips.add(s); }
      for (const z of [-.08, .08]) { const c = new THREE.Mesh(new THREE.BoxGeometry(.2, .008, .008), mat(0x6a4a2a, .9)); c.position.set(0, .004, z); slips.add(c); }
      slips.position.set(.42, .345, .22); slips.rotation.y = .5; group.add(shadowed(slips));
      return { group, lamp: new THREE.Vector3(-.4, .34, .26), focus: 1.25, top: 2.5, hit: new THREE.Vector3(1.4, 2.5, .9), ghost: [-1.15, 0, -.3], paint };
    }
    // ── the Buddha: a small whitewashed stupa, and before it a stone with the first verse of the Dhammapada in Brahmi
    case "buddha": {
      const lime = mat(0xe9e4d8, .95);
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, .26, 1.3), lime); b1.position.set(0, .13, -.55); const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.05, .22, 1.05), lime); b2.position.set(0, .37, -.55);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), lime); dome.position.set(0, .48, -.55);
      const harmika = new THREE.Mesh(new THREE.BoxGeometry(.24, .18, .24), lime); harmika.position.set(0, 1.05, -.55);
      const spire = new THREE.Group(); spire.add(new THREE.Mesh(new THREE.CylinderGeometry(.022, .03, .5, 8).translate(0, .25, 0), mat(0xb09a6a, .5, .4)));
      [.16, .12, .085].forEach((r, k) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .025, 20), mat(0xb09a6a, .5, .4)); d.position.y = .12 + k * .13; spire.add(d); }); spire.position.set(0, 1.14, -.55);
      for (const m of [b1, b2, dome, harmika, spire]) group.add(shadowed(m));
      const side = stoneMaterial(0x9c968a);
      const face = carve({ w: .62, h: .44, tint: "#a29c90", seed: 51,
        draw: (g, W, H) => { frame(g, W * .05, H * .07, W * .9, H * .86, 4, false); g.font = `${W * .1}px ${FONTS.brahmi}`; g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("𑀫𑀦𑁄𑀧𑀼𑀩𑁆𑀩𑀗𑁆𑀕𑀫𑀸 𑀥𑀫𑁆𑀫𑀸", W / 2, H * .42); g.font = `${W * .07}px ${FONTS.brahmi}`; g.fillText("𑀩𑀼𑀤𑁆𑀥", W / 2, H * .7); },
        relief: (g, W, H) => { // a bodhi leaf above the verse
          g.beginPath(); g.moveTo(W * .5, H * .12); g.bezierCurveTo(W * .58, H * .2, W * .56, H * .27, W * .5, H * .28); g.bezierCurveTo(W * .44, H * .27, W * .42, H * .2, W * .5, H * .12); g.fill(); } });
      const tablet = slab(.62, .44, .1, "flat", 52, face, side); tablet.position.set(0, -.04, .32); tablet.rotation.x = -.18; group.add(tablet);
      const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.08, .005], [.12, .05], [.13, .09], [.12, .09], [.11, .05], [0, .02]].map(([x, y]) => new THREE.Vector2(x, y)), 18), mat(0x3a2a1e, .5)); bowl.position.set(.5, 0, .4); group.add(shadowed(bowl));
      const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.bezierCurveTo(.05, .03, .045, .08, 0, .12); leaf.bezierCurveTo(-.045, .08, -.05, .03, 0, 0);
      const leafGeo = new THREE.ShapeGeometry(leaf).rotateX(-Math.PI / 2), r = seeded(53); for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(leafGeo, mat(k % 2 ? 0x6b7a3a : 0x8a8a3e, .8, 0, { side: THREE.DoubleSide })); l.position.set(-.55 + r() * .4, .01, .45 + r() * .3); l.rotation.y = r() * 6; group.add(l); }
      return { group, lamp: new THREE.Vector3(-.42, 0, .5), focus: .55, top: 1.6, hit: new THREE.Vector3(1.4, 1.6, 1.6), ghost: [-1.25, 0, -.4], paint };
    }
    // ── Socrates: an Attic grave stele of white marble: his name, his father's, his deme; his figure in relief; his words
    case "socrates": {
      const side = stoneMaterial(0xf1ede4), w = .74, h = 1.9;
      const face = carve({ w, h, tint: "#f2eee6", seed: 61, polish: .45,
        draw: (g, W, H) => { const cap = capOf("peak", w) / h * H; line(g, "ΣΩΚΡΑΤΗΣ", cap + H * .06, { size: W * .14, font: FONTS.greek, W, weight: 500, spacing: .16 });
          line(g, "ΣΩΦΡΟΝΙΣΚΟΥ ΑΛΩΠΕΚΗΘΕΝ", cap + H * .115, { size: W * .055, font: FONTS.greek, W, weight: 500, spacing: .12 });
          g.lineWidth = 4; g.strokeRect(W * .12, cap + H * .15, W * .76, H * .5);
          line(g, "Ο ΔΕ ΑΝΕΞΕΤΑΣΤΟΣ ΒΙΟΣ", cap + H * .7, { size: W * .068, font: FONTS.greek, W, weight: 500, spacing: .1 }); line(g, "ΟΥ ΒΙΩΤΟΣ ΑΝΘΡΩΠΩΙ", cap + H * .745, { size: W * .068, font: FONTS.greek, W, weight: 500, spacing: .1 }); },
        relief: (g, W, H) => { const cap = capOf("peak", w) / h * H; silhouette(g, env.shadow("socrates"), W * .5, cap + H * .64, H * .46);
          g.lineWidth = 10; g.beginPath(); g.moveTo(W * .08, cap - 4); g.lineTo(W * .5, H * .015); g.lineTo(W * .92, cap - 4); g.stroke(); } });
      group.add(placed(slab(w, h, .15, "peak", 62, face, side), 0, .18, 0));
      const base = plinth(.95, .2, .4, stoneMaterial(0xd8d2c6), 63); group.add(base);
      const kylix = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.05, 0], [.015, .02], [.012, .06], [.1, .075], [.115, .09], [.105, .09], [.01, .07]].map(([x, y]) => new THREE.Vector2(x, y)), 20), mat(0x2a1c14, .4, 0, { side: THREE.DoubleSide }));
      kylix.position.set(.38, .2, .12); group.add(shadowed(kylix));
      return { group, lamp: new THREE.Vector3(-.3, .2, .12), focus: 1.25, top: 2.1, hit: new THREE.Vector3(1, 2.1, .6), ghost: [-1.0, 0, -.3], paint };
    }
    // ── Zhang Heng: a Han stele, its round top pierced, as Han steles were
    case "zhangheng": {
      const side = stoneMaterial(0x9e9c94), w = .82, h = 1.75;
      const face = carve({ w, h, tint: "#a8a69e", seed: 71,
        draw: (g, W, H) => { g.beginPath(); g.arc(W / 2, H * .17, W * .085, 0, Math.PI * 2); g.fill(); columns(g, ["宇之表無極", "宙之端無窮"], { right: W * .64, top: H * .3, size: W * .19, font: FONTS.kai, gap: 1.5, lead: 1.06 }); columns(g, ["漢 張衡"], { right: W * .18, top: H * .66, size: W * .08, font: FONTS.kai, weight: 400 }); } });
      group.add(placed(slab(w, h, .2, "round", 72, face, side), 0, .16, 0));
      group.add(plinth(1.05, .2, .5, stoneMaterial(0x8e8c84), 73));
      return { group, lamp: new THREE.Vector3(.38, .2, .18), focus: 1.1, top: 1.9, hit: new THREE.Vector3(1.1, 1.9, .6), ghost: [-1.05, 0, -.3], paint };
    }
    // ── Copernicus: a Renaissance tablet on a pedestal, the Sun at the centre of its circles, in Latin
    case "copernicus": {
      const side = stoneMaterial(0xcdbca2), w = .92, h = 1.3;
      const face = carve({ w, h, tint: "#d2c2a6", seed: 81,
        draw: (g, W, H) => { frame(g, W * .05, H * .04, W * .9, H * .92, 5); const cx = W / 2, cy = H * .3;
          g.lineWidth = 3; for (const r of [.07, .11, .15, .2, .25, .3]) { g.beginPath(); g.arc(cx, cy, W * r * .62, 0, Math.PI * 2); g.stroke(); }
          for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * W * .03, cy + Math.sin(a) * W * .03); g.lineTo(cx + Math.cos(a) * W * .05, cy + Math.sin(a) * W * .05); g.stroke(); }
          line(g, "NICOLAVS COPERNICVS", H * .56, { size: W * .075, font: FONTS.roman, W }); line(g, "MCDLXXIII · MDXLIII", H * .63, { size: W * .045, font: FONTS.roman, W, weight: 500 });
          line(g, "IN MEDIO VERO OMNIVM", H * .75, { size: W * .055, font: FONTS.roman, W, weight: 500 }); line(g, "RESIDET SOL", H * .82, { size: W * .055, font: FONTS.roman, W, weight: 500 }); },
        relief: (g, W, H) => { g.beginPath(); g.arc(W / 2, H * .3, W * .024, 0, Math.PI * 2); g.fill(); [[.11, .6], [.15, 2.2], [.2, 4], [.25, 5.2]].forEach(([r, a]) => { g.beginPath(); g.arc(W / 2 + Math.cos(a) * W * r * .62, H * .3 + Math.sin(a) * W * r * .62, W * .012, 0, Math.PI * 2); g.fill(); }); } });
      group.add(placed(slab(w, h, .16, "flat", 82, face, side), 0, .5, 0));
      group.add(plinth(1.05, .5, .42, stoneMaterial(0xb9a98e), 83));
      return { group, lamp: new THREE.Vector3(.42, 0, .4), focus: 1.15, top: 1.8, hit: new THREE.Vector3(1.1, 1.8, .6), ghost: [-1.1, 0, -.3], paint };
    }
    // ── Galileo: a slender pillar with Jupiter and its four moons, in Italian; his telescope leaning on the pedestal
    case "galileo": {
      const side = stoneMaterial(0xd4d1ca), w = .5, h = 2.1;
      const face = carve({ w, h, tint: "#d8d5ce", seed: 91, polish: .3,
        draw: (g, W, H) => { const cap = capOf("peak", w) / h * H; g.lineWidth = 4; g.beginPath(); g.arc(W / 2, cap + H * .1, W * .33, 0, Math.PI * 2); g.stroke();
          ["GALILEO", "GALILEI"].forEach((t, k) => line(g, t, cap + H * (.25 + k * .045), { size: W * .13, font: FONTS.roman, W }));
          ["MDLXIV", "MDCXLII"].forEach((t, k) => line(g, t, cap + H * (.36 + k * .035), { size: W * .085, font: FONTS.roman, W, weight: 500 }));
          ["EGLI È", "SCRITTO", "IN LINGVA", "MATEMATICA"].forEach((t, k) => line(g, t, cap + H * (.5 + k * .04), { size: W * .085, font: FONTS.roman, W, weight: 500 })); },
        relief: (g, W, H) => { const cap = capOf("peak", w) / h * H, y = cap + H * .1; g.beginPath(); g.arc(W / 2, y, W * .1, 0, Math.PI * 2); g.fill(); [-.25, -.17, .16, .26].forEach(x => { g.beginPath(); g.arc(W / 2 + x * W, y + (x > 0 ? -2 : 2), W * .025, 0, Math.PI * 2); g.fill(); }); } });
      group.add(placed(slab(w, h, .5, "peak", 92, face, side), 0, .42, 0));
      group.add(plinth(.78, .42, .78, stoneMaterial(0xbdb9b0), 93));
      const scope = new THREE.Group(); scope.add(new THREE.Mesh(new THREE.CylinderGeometry(.022, .034, 1.05, 14).translate(0, .52, 0), mat(0x5a3a24, .6)));
      for (const y of [.02, .5, 1.03]) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(.038, .038, .03, 14), brass()); ring.position.y = y; scope.add(ring); }
      scope.position.set(.48, 0, .3); scope.rotation.set(-.1, 0, .38); group.add(shadowed(scope));
      return { group, lamp: new THREE.Vector3(-.36, 0, .5), focus: 1.3, top: 2.55, hit: new THREE.Vector3(.9, 2.5, .9), ghost: [-.95, 0, -.3], paint };
    }
    // ── Newton: a classical tablet, a prism splitting light above his words; an apple and a glass prism on its base
    case "newton": {
      const side = stoneMaterial(0xdedad2), w = .9, h = 1.4;
      const face = carve({ w, h, tint: "#e0dcd4", seed: 101, polish: .35,
        draw: (g, W, H) => { const cap = capOf("arch", w) / h * H; frame(g, W * .06, cap, W * .88, H * .93 - cap, 4, false);
          g.lineWidth = 3; g.beginPath(); g.moveTo(W * .1, cap + H * .17); g.lineTo(W * .45, cap + H * .13); g.stroke(); for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(W * .55, cap + H * .13); g.lineTo(W * .9, cap + H * (.06 + k * .03)); g.stroke(); }
          line(g, "ISAAC NEWTON", cap + H * .3, { size: W * .09, font: FONTS.roman, W }); line(g, "MDCXLIII · MDCCXXVII", cap + H * .37, { size: W * .042, font: FONTS.roman, W, weight: 500 });
          ["IF I HAVE SEEN FURTHER", "IT IS BY STANDING ON", "THE SHOULDERS OF GIANTS"].forEach((t, k) => line(g, t, cap + H * (.48 + k * .06), { size: W * .052, font: FONTS.roman, W, weight: 500 })); },
        relief: (g, W, H) => { const cap = capOf("arch", w) / h * H; g.beginPath(); g.moveTo(W * .5, cap + H * .06); g.lineTo(W * .42, cap + H * .2); g.lineTo(W * .58, cap + H * .2); g.closePath(); g.fill(); } });
      group.add(placed(slab(w, h, .18, "arch", 102, face, side), 0, .3, 0));
      group.add(plinth(1.12, .3, .5, stoneMaterial(0xc8c4bc), 103));
      const apple = new THREE.Mesh(new THREE.SphereGeometry(.045, 16, 12), mat(0x8e1c18, .45)); apple.scale.y = .9; apple.position.set(.42, .34, .14); group.add(shadowed(apple));
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(.003, .004, .03, 5), mat(0x4a3220)); stalk.position.set(.42, .39, .14); group.add(stalk);
      const prism = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .16, 3).rotateZ(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xe8f0ff, roughness: .05, transmission: .9, thickness: .1, transparent: true, opacity: .75 }));
      prism.position.set(-.4, .345, .16); prism.rotation.y = .4; group.add(prism);
      return { group, lamp: new THREE.Vector3(.12, .3, .2), focus: 1.05, top: 1.7, hit: new THREE.Vector3(1.2, 1.7, .7), ghost: [-1.1, 0, -.3], paint };
    }
    // ── Marie Curie: a low granite stone, in French; on it a little glass of something that glows
    case "curie": {
      const side = stoneMaterial(0xb7a49e), w = 1.1, h = .95;
      const face = carve({ w, h, tint: "#bca8a2", seed: 111, polish: .55,
        draw: (g, W, H) => { line(g, "MARIE", H * .14, { size: W * .07, font: FONTS.roman, W }); line(g, "SKŁODOWSKA CURIE", H * .25, { size: W * .075, font: FONTS.roman, W }); line(g, "1867 – 1934", H * .35, { size: W * .042, font: FONTS.roman, W, weight: 500 });
          ["On ne fait jamais attention à ce qui a été fait ;", "on ne voit que ce qui reste à faire."].forEach((t, k) => line(g, t, H * (.53 + k * .085), { size: W * .042, font: FONTS.italic, W, weight: 500, italic: true, spacing: .02 }));
          line(g, "Po · Ra", H * .8, { size: W * .05, font: FONTS.roman, W, weight: 500 }); } });
      group.add(placed(slab(w, h, .2, "flat", 112, face, side), 0, .12, 0));
      group.add(plinth(1.3, .12, .5, stoneMaterial(0xa8968f), 113));
      const vial = new THREE.Group(); vial.add(new THREE.Mesh(new THREE.CylinderGeometry(.022, .026, .1, 14, 1, true).translate(0, .05, 0), new THREE.MeshPhysicalMaterial({ color: 0xdfe8e0, roughness: .05, transmission: .85, thickness: .02, transparent: true, opacity: .55, side: THREE.DoubleSide })));
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(.018, .02, .03, 12).translate(0, .016, 0), mat(0x9effc4, .4, 0, { emissive: 0x5cff9a, emissiveIntensity: 1.6 })); vial.add(glow);
      vial.position.set(.3, .12 + h - .07, 0); group.add(vial);
      return { group, lamp: new THREE.Vector3(-.4, .12, .22), focus: .65, top: 1.15, hit: new THREE.Vector3(1.4, 1.2, .7), ghost: [-1.25, 0, -.3], paint };
    }
    // ── Eleanor Roosevelt: a plain white marble headstone, her words where she said rights begin
    case "eleanor": {
      const side = stoneMaterial(0xf1efea), w = .82, h = 1.15;
      const face = carve({ w, h, tint: "#f3f1ec", seed: 121, polish: .5,
        draw: (g, W, H) => { const cap = capOf("round", w) / h * H * .7; line(g, "ELEANOR", cap + H * .1, { size: W * .1, font: FONTS.roman, W }); line(g, "ROOSEVELT", cap + H * .2, { size: W * .1, font: FONTS.roman, W }); line(g, "1884 – 1962", cap + H * .29, { size: W * .05, font: FONTS.roman, W, weight: 500 });
          ["Where, after all, do universal", "human rights begin?", "In small places, close to home."].forEach((t, k) => line(g, t, cap + H * (.42 + k * .075), { size: W * .055, font: FONTS.italic, W, weight: 500, italic: true, spacing: .02 })); } });
      group.add(placed(slab(w, h, .2, "round", 122, face, side), 0, .08, 0));
      group.add(plinth(1, .1, .45, stoneMaterial(0xdedad3), 123));
      const paper = new THREE.Mesh(new THREE.BoxGeometry(.21, .004, .28), mat(0xeee6d2, .9)); paper.position.set(.3, .02, .42); paper.rotation.y = .3; group.add(paper);
      const weight = new THREE.Mesh(new THREE.IcosahedronGeometry(.03, 1), stoneMaterial(0x9c968c)); weight.position.set(.32, .04, .4); weight.scale.y = .6; group.add(weight);
      return { group, lamp: new THREE.Vector3(-.36, 0, .42), focus: .75, top: 1.25, hit: new THREE.Vector3(1.1, 1.3, .6), ghost: [-1.05, 0, -.3], paint };
    }
    // ── P. C. Chang: polished dark granite with gold letters, his name in both scripts, Article 1 in Chinese
    case "pcchang": {
      const side = mat(0x2e2e30, .32), w = .86, h = 1.25;
      const face = carve({ w, h, tint: "#3a3a3d", seed: 131, polish: .85, fill: "gold", depth: .8,
        draw: (g, W, H) => { const cap = capOf("round", w) / h * H * .6; line(g, "張彭春", cap + H * .08, { size: W * .14, font: FONTS.kai, W, weight: 700, spacing: .2 }); line(g, "P. C. CHANG", cap + H * .17, { size: W * .065, font: FONTS.roman, W }); line(g, "1892 – 1957", cap + H * .23, { size: W * .045, font: FONTS.roman, W, weight: 500 });
          ["人人生而自由，在尊嚴和權利上", "一律平等。他們賦有理性和良心，", "並應以兄弟關係的精神相對待。"].forEach((t, k) => line(g, t, cap + H * (.36 + k * .075), { size: W * .06, font: FONTS.kai, W, weight: 400, spacing: .04 })); } });
      group.add(placed(slab(w, h, .2, "round", 132, face, side), 0, .1, 0));
      group.add(plinth(1.05, .12, .48, mat(0x2a2a2c, .4), 133));
      const book = new THREE.Group(); book.add(new THREE.Mesh(new THREE.BoxGeometry(.16, .035, .23), mat(0x2c3c5a, .8))); const pages = new THREE.Mesh(new THREE.BoxGeometry(.15, .028, .22), mat(0xe9e2d0, .9)); pages.position.x = .006; book.add(pages);
      book.position.set(.32, .14, .2); book.rotation.y = -.4; group.add(shadowed(book));
      return { group, lamp: new THREE.Vector3(-.36, .12, .24), focus: .8, top: 1.35, hit: new THREE.Vector3(1.1, 1.4, .6), ghost: [-1.05, 0, -.3], paint };
    }
  }
  return null;
}
