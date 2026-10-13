import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** The memorials on the road: gravestones carved with a name and words, and the relics of the ages whose people
 * left no names. Everything here is built in the memorial's own frame: +z faces the road, y is up, 0 is the ground. */

export const seeded = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
export type Top = "round" | "arch" | "peak" | "flat" | "rough";

/** A weathered stone slab, its top cut round, arched, pointed, flat or broken. Its front face (+z) keeps box UVs,
 * so an inscription can be painted straight onto it. */
export function steleGeometry(w: number, h: number, d: number, top: Top, seed: number, detail = 1) {
  const geo = new THREE.BoxGeometry(w, h, d, Math.max(2, Math.round(6 * detail)), Math.max(3, Math.round(14 * detail)), 2).translate(0, h / 2, 0);
  const p = geo.attributes.position, r = seeded(seed), n1 = r() * 10, n2 = r() * 10;
  const capH = top === "round" ? w * .5 : top === "arch" ? w * .3 : top === "peak" ? w * .28 : w * .07, base = h - capH;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = Math.max(-1, Math.min(1, x / (w / 2)));
    const cap = top === "round" || top === "arch" ? base + capH * Math.sqrt(Math.max(0, 1 - u * u))
      : top === "peak" ? base + capH * (1 - Math.abs(u))
      : base + capH * (1 - .5 * u * u) - (top === "rough" ? capH * 2.4 * Math.max(0, Math.sin(u * 2.2 + n1)) ** 2 : 0);
    if (y > base) y = base + (y - base) / capH * (cap - base);
    // worn: a little uneven, the corners rounded off; the same point always moves the same way, so faces stay joined
    const wob = .011 * (Math.sin(x * 23 + y * 7 + n1) + Math.sin(y * 19 - z * 11 + n2));
    const corner = Math.min(1, (Math.abs(x) / (w / 2)) ** 8 + (Math.abs(z) / (d / 2)) ** 8);
    x *= (1 + wob) * (1 - .05 * y / h) * (1 - .05 * corner);
    z *= (1 + wob * 1.5) * (1 - .1 * corner * (y > base ? 1 : .5));
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Grey stone with grain, a few darker veins and pale lichen. */
let grain: THREE.CanvasTexture | null = null;
export function stoneGrain() {
  if (grain) return grain;
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d")!, r = seeded(17);
  g.fillStyle = "#8f8b84"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { const v = r(); g.fillStyle = v > .5 ? `rgba(255,250,240,${.04 + r() * .05})` : `rgba(30,26,22,${.05 + r() * .07})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
  for (let k = 0; k < 5; k++) { g.strokeStyle = `rgba(40,36,32,${.08 + r() * .08})`; g.lineWidth = .6 + r(); g.beginPath(); let x = r() * 256, y = r() * 256; g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (r() - .5) * 60; y += r() * 40; g.lineTo(x, y); } g.stroke(); }
  for (let k = 0; k < 40; k++) { const x = r() * 256, y = r() * 256, rad = 2 + r() * 9, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(196,198,160,${.16 + r() * .16})`); gr.addColorStop(1, "rgba(196,198,160,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  grain = new THREE.CanvasTexture(c); grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.colorSpace = THREE.SRGBColorSpace; grain.anisotropy = 4;
  return grain;
}
export const stoneMaterial = (tint = 0xffffff) => new THREE.MeshStandardMaterial({ map: stoneGrain(), color: tint, roughness: .96 });

/** The carved face of a gravestone: its words are cut into the stone, readable by your torch, and once you have
 * honoured it the cuts fill with a faint firelight. */
export function createInscription(w: number, h: number, tint = 0xffffff) {
  const W = 512, H = Math.min(1400, Math.round(W * h / w));
  const face = document.createElement("canvas"), glow = document.createElement("canvas"); face.width = glow.width = W; face.height = glow.height = H;
  const map = new THREE.CanvasTexture(face), emissiveMap = new THREE.CanvasTexture(glow); map.colorSpace = emissiveMap.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffa458, emissiveIntensity: 0, color: tint, roughness: .9 });
  type Row = { text: string; size: number; weight?: number; italic?: boolean; gap?: number; rule?: boolean };
  /** rows top to bottom, inside the part of the face below the stone's cap */
  function paint(rows: Row[], fonts: { serif: string }, topFraction: number, zh: boolean) {
    const g = face.getContext("2d")!, e = glow.getContext("2d")!;
    // the face: the stone's own grain, a little smoother where it was dressed, and a cut border
    const pattern = g.createPattern(stoneGrain().image as HTMLCanvasElement, "repeat")!;
    g.fillStyle = pattern; g.fillRect(0, 0, W, H); g.fillStyle = "rgba(255,250,240,.06)"; g.fillRect(24, H * topFraction * .6, W - 48, H * (1 - topFraction * .6) - 30);
    e.fillStyle = "#000"; e.fillRect(0, 0, W, H);
    const top = H * topFraction + 26, wrapW = W * .78;
    const lines: { text: string; size: number; font: string; gap: number; rule?: boolean }[] = [];
    for (const row of rows) {
      const font = `${row.italic ? "italic " : ""}${row.weight ?? 500} ${row.size}px ${fonts.serif}`;
      if (row.rule) { lines.push({ text: "", size: row.size, font, gap: row.gap ?? 1, rule: true }); continue; }
      g.font = font; const units = zh ? [...row.text] : row.text.split(" "); let line = "";
      for (const unit of units) {
        const test = line ? line + (zh ? "" : " ") + unit : unit;
        if (g.measureText(test).width > wrapW && line && !"，。、」』；：！？".includes(unit)) { lines.push({ text: line, size: row.size, font, gap: 1.45 }); line = unit; } else line = test;
      }
      lines.push({ text: line, size: row.size, font, gap: row.gap ?? 1.45 });
    }
    // fit: shrink everything a little if the words would run off the bottom of the stone
    const total = lines.reduce((a, l) => a + l.size * l.gap, 0), room = H - top - 40, k = Math.min(1, room / total);
    let y = top + Math.max(0, (room - total * k) * .18);
    g.textAlign = e.textAlign = "center"; g.textBaseline = e.textBaseline = "top";
    for (const l of lines) {
      const size = l.size * k, font = l.font.replace(`${l.size}px`, `${size.toFixed(1)}px`);
      if (l.rule) { const yy = y + size * .4; for (const [c, dy] of [["rgba(255,246,228,.2)", 1.5], ["rgba(26,22,18,.85)", 0]] as const) { g.fillStyle = c; g.fillRect(W / 2 - 46, yy + dy, 92, 2.4); } e.fillStyle = "#fff"; e.fillRect(W / 2 - 46, yy, 92, 2.4); y += size * l.gap; continue; }
      g.font = e.font = font;
      g.fillStyle = "rgba(255,246,228,.22)"; g.fillText(l.text, W / 2 + 1.6, y + 1.8);
      g.fillStyle = "rgba(0,0,0,.45)"; g.fillText(l.text, W / 2 - 1, y - 1);
      g.fillStyle = "rgba(30,26,22,.93)"; g.fillText(l.text, W / 2, y);
      e.shadowColor = "rgba(255,255,255,.9)"; e.shadowBlur = size * .25; e.fillStyle = "#fff"; e.fillText(l.text, W / 2, y);
      y += size * l.gap;
    }
    map.needsUpdate = emissiveMap.needsUpdate = true;
  }
  return { material, paint };
}

/** A stone with words on it: the slab, its carved face, and a small stone bowl at its foot for your fire. */
export function gravestone(o: { w: number; h: number; d: number; top: Top; seed: number; tint?: number }) {
  const geo = steleGeometry(o.w, o.h, o.d, o.top, o.seed), side = stoneMaterial(o.tint), inscription = createInscription(o.w, o.h, o.tint);
  const materials = [side, side, side, side, inscription.material, side]; // box groups: +x −x +y −y +z −z
  const mesh = new THREE.Mesh(geo, materials); mesh.castShadow = mesh.receiveShadow = true; mesh.position.y = -.12;
  const capFraction = (o.top === "round" ? o.w * .5 : o.top === "arch" ? o.w * .3 : o.top === "peak" ? o.w * .28 : o.w * .12) / o.h;
  return { mesh, inscription, capFraction };
}

/** A shallow stone bowl to hold a small fire. */
export function bowl() {
  const pts = [[0, 0], [.13, 0], [.17, .03], [.2, .1], [.17, .11], [.12, .06], [0, .06]].map(([x, y]) => new THREE.Vector2(x, y));
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), stoneMaterial(0xb8b0a4)); mesh.castShadow = mesh.receiveShadow = true; return mesh;
}

const bone = new THREE.MeshStandardMaterial({ color: 0x9f9380, roughness: .85 });
const ivory = new THREE.MeshStandardMaterial({ color: 0xb9a888, roughness: .7 });
const wood = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: .95 });
const bronze = new THREE.MeshStandardMaterial({ color: 0x6f5a3a, metalness: .55, roughness: .55 });
const iron = new THREE.MeshStandardMaterial({ color: 0x4d3b30, metalness: .35, roughness: .85 });
const mudBrick = new THREE.MeshStandardMaterial({ color: 0x5c4a38, roughness: 1 });
const shadowed = (m: THREE.Mesh) => { m.castShadow = m.receiveShadow = true; return m; };

/** What each relic needs from the walk: where its fire burns, how big, and where you look. */
export type Relic = { group: THREE.Group; lamp: THREE.Vector3; flame: number; focus: number; hit: THREE.Vector3 };
type Rock = (scale: THREE.Vector3) => THREE.Mesh;

function boneGeometry(len: number, r: number) {
  const parts = [new THREE.CylinderGeometry(r * .62, r * .75, len, 8).rotateZ(Math.PI / 2)];
  for (const s of [-1, 1]) parts.push(new THREE.SphereGeometry(r * 1.15, 8, 6).scale(.8, .8, 1.3).translate(s * len / 2, 0, 0));
  return mergeGeometries(parts.map(g => g.toNonIndexed()))!;
}
/** a tapering curved horn or tusk along a curve */
function tusk(points: THREE.Vector3[], radius: number) {
  const curve = new THREE.CatmullRomCurve3(points), segs = 28, radial = 10, geo = new THREE.TubeGeometry(curve, segs, radius, radial, false), p = geo.attributes.position;
  for (let i = 0; i <= segs; i++) { const c = curve.getPointAt(i / segs), k = 1 - .82 * (i / segs) ** 1.3; for (let j = 0; j <= radial; j++) { const v = i * (radial + 1) + j; p.setXYZ(v, c.x + (p.getX(v) - c.x) * k, c.y + (p.getY(v) - c.y) * k, c.z + (p.getZ(v) - c.z) * k); } }
  geo.computeVertexNormals(); return geo;
}

/** Bones by an old hearth: a ring of fire-cracked stones, ash, the bones of a meal. Your fire relights it. */
export function hearth(rock: Rock): Relic {
  const group = new THREE.Group(), r = seeded(31);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + r() * .25, s = .3 + r() * .14, st = rock(new THREE.Vector3(s, s * .6, s * .85)); st.position.set(Math.cos(a) * .62, -.03, Math.sin(a) * .62); st.rotation.y = r() * 6; group.add(st); }
  const ashTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!, gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, "rgba(24,20,18,1)"); gr.addColorStop(.55, "rgba(52,46,42,.9)"); gr.addColorStop(1, "rgba(60,54,48,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 400; i++) { g.fillStyle = r() > .6 ? "rgba(140,130,120,.35)" : "rgba(10,8,6,.5)"; g.beginPath(); g.arc(64 + (r() - .5) * 80, 64 + (r() - .5) * 80, .8 + r() * 2.2, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const ash = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ashTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })); ash.position.y = .02; ash.receiveShadow = true; group.add(ash);
  for (const [x, z, ry, len] of [[.95, .45, .4, .46], [-1, .15, 1.9, .38], [.3, -1.05, 2.6, .5], [-.45, .98, .9, .32], [.25, .2, 1.2, .26]]) { const b = shadowed(new THREE.Mesh(boneGeometry(len, .024), bone)); b.position.set(x, .025, z); b.rotation.set((r() - .5) * .3, ry, (r() - .5) * .3); group.add(b); }
  // a jaw, as a curve of bone with teeth
  const jaw = shadowed(new THREE.Mesh(tusk([new THREE.Vector3(-.16, 0, 0), new THREE.Vector3(0, 0, .12), new THREE.Vector3(.16, 0, 0)], .03), bone)); jaw.position.set(-1.05, .03, -.6); jaw.rotation.y = .7; group.add(jaw);
  return { group, lamp: new THREE.Vector3(0, .02, 0), flame: 1.5, focus: .4, hit: new THREE.Vector3(1.4, 1, 1.4) };
}

/** Two mammoth tusks planted as an arch, and a spear with a stone point leaning on a boulder. */
export function hunt(rock: Rock): Relic {
  const group = new THREE.Group();
  for (const s of [-1, 1]) { const t = shadowed(new THREE.Mesh(tusk([new THREE.Vector3(s * 1.05, -.2, 0), new THREE.Vector3(s * 1.12, .9, .05), new THREE.Vector3(s * .8, 1.9, .1), new THREE.Vector3(s * .14, 2.45, .05)], .13), ivory)); group.add(t); }
  const boulder = rock(new THREE.Vector3(.75, .55, .6)); boulder.position.set(1.7, -.1, -.4); group.add(boulder);
  const spear = new THREE.Group(); spear.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.018, .022, 2.3, 7).translate(0, 1.15, 0), wood)));
  const point = shadowed(new THREE.Mesh(new THREE.ConeGeometry(.045, .2, 5).translate(0, 2.4, 0), new THREE.MeshStandardMaterial({ color: 0x2c2724, roughness: .6 }))); point.scale.z = .45; spear.add(point);
  spear.position.set(1.15, 0, .1); spear.rotation.set(.05, 0, -.42); group.add(spear);
  return { group, lamp: new THREE.Vector3(0, .02, .25), flame: .8, focus: 1.2, hit: new THREE.Vector3(2.4, 2.6, 1.2) };
}

/** A hide stretched on a frame of poles to dry, and on a flat stone in front of it, a bone needle. */
export function needle(rock: Rock): Relic {
  const group = new THREE.Group();
  for (const x of [-.78, .78]) { const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, 2.05, 7).translate(0, 1, 0), wood)); pole.position.set(x, -.05, 0); pole.rotation.z = -x * .04; group.add(pole); }
  const bar = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.85, 7).rotateZ(Math.PI / 2), wood)); bar.position.set(0, 1.82, 0); group.add(bar);
  const hideTex = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d")!, r = seeded(9);
    g.beginPath(); for (let k = 0; k <= 40; k++) { const a = k / 40 * Math.PI * 2, rad = 104 + Math.sin(a * 5) * 14 + (r() - .5) * 10 - (Math.abs(Math.sin(a * 2)) > .9 ? 20 : 0); const x = 128 + Math.cos(a) * rad * .92, y = 128 + Math.sin(a) * rad; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath();
    const gr = g.createRadialGradient(128, 120, 10, 128, 128, 130); gr.addColorStop(0, "#9b7a55"); gr.addColorStop(1, "#5e4329"); g.fillStyle = gr; g.fill();
    g.save(); g.clip(); for (let i = 0; i < 2600; i++) { g.strokeStyle = r() > .5 ? "rgba(40,26,14,.25)" : "rgba(200,170,130,.18)"; g.lineWidth = 1; const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 3, y + 4 + r() * 5); g.stroke(); } g.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const hideGeo = new THREE.PlaneGeometry(1.4, 1.35, 10, 10), hp = hideGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i); hp.setZ(i, -.08 * Math.cos(x * 2.2) * (.6 - y * .4) + .02 * Math.sin(y * 9)); } hideGeo.computeVertexNormals();
  const hide = shadowed(new THREE.Mesh(hideGeo, new THREE.MeshStandardMaterial({ map: hideTex, alphaTest: .5, side: THREE.DoubleSide, roughness: 1 }))); hide.position.set(0, 1.08, .02); group.add(hide);
  for (const x of [-.55, -.18, .2, .55]) { const tie = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .14, 4), wood); tie.position.set(x, 1.76, .02); group.add(tie); }
  const flat = rock(new THREE.Vector3(.7, .22, .55)); flat.position.set(.25, -.06, .72); group.add(flat);
  const pin = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.004, .008, .16, 6).rotateZ(Math.PI / 2 - .2), bone)); pin.position.set(.35, .13, .78); pin.rotation.y = .5; group.add(pin);
  return { group, lamp: new THREE.Vector3(-.3, .1, .8), flame: .7, focus: 1, hit: new THREE.Vector3(1.8, 2.1, 1.4) };
}

/** A doorway standing on its own: two jambs of mud brick under a stone lintel, more bricks fallen in the grass. */
export function doorway(rock: Rock): Relic {
  const group = new THREE.Group(), r = seeded(203);
  // sun-dried bricks, each a little different, worn at the corners; the jambs crumble towards the top
  const brick = (w: number, seed: number) => steleGeometry(w, .13, .3, "flat", seed, .35).translate(0, -.065, 0);
  const bricks = [0, 1, 2, 3].map(k => brick(.3 + k * .03, 300 + k));
  for (const x of [-.72, .72]) for (let k = 0; k < 11; k++) for (const dz of [-.08, .08]) {
    if (k > 8 && r() < .5) continue;
    const b = shadowed(new THREE.Mesh(bricks[Math.floor(r() * 4)], mudBrick)); b.position.set(x + (r() - .5) * .05 + ((k + (dz > 0 ? 1 : 0)) % 2 ? .06 : -.06), .065 + k * .135, dz + (r() - .5) * .03); b.rotation.set((r() - .5) * .05, (r() - .5) * .12 + (dz > 0 ? 0 : Math.PI), (r() - .5) * .05); group.add(b); }
  const lintel = rock(new THREE.Vector3(1.9, .3, .5)); lintel.position.set(0, 1.5, 0); lintel.rotation.z = .05; group.add(lintel);
  for (let k = 0; k < 12; k++) { const b = shadowed(new THREE.Mesh(bricks[k % 4], mudBrick)); b.position.set(-1.8 + r() * 3.6, .05, -.7 + r() * 1.1); b.rotation.set((r() - .5) * .5, r() * 3, (r() - .5) * .5); group.add(b); }
  return { group, lamp: new THREE.Vector3(0, .02, .05), flame: .75, focus: 1, hit: new THREE.Vector3(2, 1.9, .9) };
}

/** An empty throne of stone, worn and cracked, a clay tablet leaning against its seat. */
export function throne(tablet: THREE.Material): Relic {
  const group = new THREE.Group(), m = stoneMaterial(0xc8bfb0);
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) => { const b = shadowed(new THREE.Mesh(steleGeometry(w, h, d, "flat", Math.round(x * 100 + y * 10 + 7), .5), m)); b.position.set(x, y, z); b.rotation.z = rz; group.add(b); return b; };
  box(1.1, .5, .8, 0, -.05, 0); box(1.1, 1.25, .2, 0, .4, -.32); box(.16, .36, .66, -.5, .42, .04, .02); box(.16, .3, .66, .5, .42, .04, -.05);
  const step = box(1.4, .14, .5, 0, -.08, .58);
  void step;
  const t = shadowed(new THREE.Mesh(new THREE.BoxGeometry(.32, .44, .06), [m, m, m, m, tablet, m])); t.position.set(.18, .62, .2); t.rotation.set(-.35, -.15, .04); group.add(t);
  return { group, lamp: new THREE.Vector3(-.35, .08, .6), flame: .7, focus: .9, hit: new THREE.Vector3(1.5, 1.8, 1.6) };
}

/** A chariot wheel half sunk in the ground, and spears thrust in around it. */
export function wheel(): Relic {
  const group = new THREE.Group(), w = new THREE.Group();
  w.add(shadowed(new THREE.Mesh(new THREE.TorusGeometry(.62, .045, 8, 40), wood)));
  w.add(shadowed(new THREE.Mesh(new THREE.TorusGeometry(.64, .018, 6, 40), bronze)));
  for (let k = 0; k < 6; k++) { const sp = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.018, .022, 1.2, 6), wood)); sp.rotation.z = k / 6 * Math.PI; w.add(sp); }
  w.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .3, 12).rotateX(Math.PI / 2), bronze)));
  w.position.set(0, .38, 0); w.rotation.set(-.08, .35, .32); group.add(w);
  for (const [x, z, rx, rz] of [[-.9, -.3, .12, .3], [-1.15, .1, -.1, .12], [.95, -.45, .05, -.25]]) {
    const s = new THREE.Group(); s.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.016, .02, 2.1, 6).translate(0, 1.05, 0), wood)));
    s.add(shadowed(new THREE.Mesh(new THREE.ConeGeometry(.04, .24, 6).translate(0, 2.2, 0), bronze))); s.position.set(x, -.2, z); s.rotation.set(rx, 0, rz); group.add(s);
  }
  return { group, lamp: new THREE.Vector3(.1, .02, .55), flame: .75, focus: .7, hit: new THREE.Vector3(2.4, 2, 1.4) };
}

/** An anchor, far from any sea, half buried and leaning, crusted with rust. */
export function anchor(): Relic {
  const group = new THREE.Group(), a = new THREE.Group();
  a.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.055, .07, 2.3, 10).translate(0, 1.15, 0), iron)));
  const ring = shadowed(new THREE.Mesh(new THREE.TorusGeometry(.16, .03, 8, 20), iron)); ring.position.y = 2.42; a.add(ring);
  const stock = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 1.3, 8).rotateX(Math.PI / 2), iron)); stock.position.y = 2.05; a.add(stock);
  const arms = shadowed(new THREE.Mesh(new THREE.TorusGeometry(.72, .06, 8, 28, Math.PI).rotateZ(Math.PI), iron)); arms.position.y = .72; a.add(arms);
  for (const s of [-1, 1]) { const fluke = shadowed(new THREE.Mesh(new THREE.ConeGeometry(.15, .34, 4), iron)); fluke.scale.z = .3; fluke.position.set(s * .74, .86, 0); fluke.rotation.z = -s * .35; a.add(fluke); }
  a.position.set(0, -.55, 0); a.rotation.set(.1, .5, .42); group.add(a);
  return { group, lamp: new THREE.Vector3(-.25, .02, .55), flame: .75, focus: 1, hit: new THREE.Vector3(2, 2.4, 1.2) };
}
