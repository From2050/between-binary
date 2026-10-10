import * as THREE from "three";
import { fireVertex, fireFragment } from "./shaders";
import { ritePoints, HILL } from "./rite-path.ts";
import { riteStations, riteUi, resolveFigure, say, chronologicalSky, type Lang, type RiteStation } from "./rite.ts";
import { createRiteSound } from "./rite-sound.ts";
import type { createWind } from "./wind";

/** What the walk needs from exploration (camera ownership, cards, return). */
export type ExplorationApi = {
  syncAngles(): void;
  showInfo(info: { eyebrow: string; title: string; description: string; href?: string; linkText?: string }): void;
  clearInfo(): void;
  announce(message: string): void;
  moveTo(position: readonly number[], target: readonly number[], done: () => void): void;
  returnToPath(instant?: boolean): void;
  readonly lastLook: number;
  readonly looking: boolean;
  readonly paused: boolean;
  readonly begun: boolean;
};
/** What exploration asks of the walk. */
export type RiteHooks = {
  active(): boolean;
  hover(ray: THREE.Raycaster): string | null;
  click(ray: THREE.Raycaster): boolean;
  press(ray: THREE.Raycaster): boolean;
  release(): void;
  pointer(down: boolean): void;
  open(): void;
  exit(): void;
};
type Options = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  glowTexture: THREE.Texture;
  height: (x: number, z: number) => number;
  wind: ReturnType<typeof createWind>;
  small: boolean;
  rock?: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] };
  grass?: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial };
  mirror: (object: THREE.Object3D) => THREE.Object3D;
  skyDim: { value: number };
  starDim: { value: number };
  moonLight: THREE.DirectionalLight;
  moonBounce: THREE.LightProbe;
  /** the shared civilization sky, woken at the summit */
  civ: { points: THREE.Points; group: THREE.Group };
};

const FIRE = new THREE.Vector3(-1, 0, -5);
const STAND = new THREE.Vector3(-1.5, 0, -2.4);
const STORE = "bb-rite";
const EYE = 1.7;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function seeded(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const glowSprite = (map: THREE.Texture, color: number, opacity = 1, fog = false) => new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog }));

/* The same stencil technique as a cave painting: spray pigment, then lift the hand away. */
function handPath(g: CanvasRenderingContext2D, s: number, seed: number) {
  const r = seeded(seed); g.beginPath(); g.ellipse(0, 0, s * .52, s * .6, 0, 0, Math.PI * 2); g.fill(); g.fillRect(-s * .36, s * .2, s * .72, s * 1.05); g.lineCap = "round";
  for (const [bx, by, an, len, wd] of [[-.36, -.36, -.3, 1, .24], [-.12, -.48, -.08, 1.12, .25], [.12, -.48, .08, 1.05, .25], [.34, -.38, .27, .82, .22]]) {
    const a = an + (r() - .5) * .14; g.lineWidth = s * wd; g.beginPath(); g.moveTo(bx * s, by * s + s * .15); g.lineTo(bx * s + Math.sin(a) * len * s, by * s - Math.cos(a) * len * s); g.stroke();
  }
  const ta = -1.05 + (r() - .5) * .2; g.lineWidth = s * .28; g.beginPath(); g.moveTo(-s * .36, s * .18); g.lineTo(-s * .36 + Math.sin(ta) * s * .78, s * .18 - Math.cos(ta) * s * .78); g.stroke();
}
function stencil(rgb: string, seed: number, light: boolean) {
  return canvasTexture(384, 384, g => {
    const r = seeded(seed), size = 384, cx = size / 2, cy = size * .54, s = size * .17;
    for (let i = 0; i < (light ? 2600 : 3400); i++) {
      const a = r() * Math.PI * 2, rad = Math.pow(r(), .6) * size * .46, x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 1.05 - size * .04, dens = 1 - rad / (size * .46);
      g.fillStyle = `rgba(${rgb},${Math.min(1, (light ? .17 : .13) * (.3 + dens * 1.4) * (.5 + r()))})`; g.beginPath(); g.arc(x, y, (.6 + r() * 2.2) * size / 320 * (1 + dens * 2), 0, Math.PI * 2); g.fill();
    }
    const gr = g.createRadialGradient(cx, cy - size * .05, 0, cx, cy - size * .05, size * .42);
    gr.addColorStop(0, `rgba(${rgb},${light ? .8 : .85})`); gr.addColorStop(.5, `rgba(${rgb},${light ? .42 : .5})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000"; g.strokeStyle = "#000"; g.translate(cx, cy); handPath(g, s, seed);
  });
}
function decal(map: THREE.Texture, point: THREE.Vector3, normal: THREE.Vector3, size: number, glow: boolean) {
  const material = glow
    ? new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    : new THREE.MeshStandardMaterial({ map, transparent: true, opacity: 0, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.position.copy(point).addScaledVector(normal, .02); mesh.lookAt(point.clone().add(normal)); mesh.rotateZ((Math.random() - .5) * .5);
  return mesh;
}
const flameMaterial = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uWind: { value: 0 } }, vertexShader: fireVertex, fragmentShader: fireFragment });
/** World-space text that stands in the scene (station names) */
function textPlane(width: number, height: number) {
  const c = document.createElement("canvas"); c.width = 1024; c.height = Math.round(1024 * height / width);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }));
  const draw = (rows: { text: string; size: number; font: string; color: string; spacing?: number }[]) => {
    const g = c.getContext("2d")!; g.clearRect(0, 0, c.width, c.height); g.textAlign = "center"; g.textBaseline = "middle";
    let y = c.height / 2 - rows.reduce((h, r) => h + r.size * 1.45, 0) / 2;
    for (const r of rows) { g.font = r.font.replace("SIZE", `${r.size}px`); if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(r.spacing ?? 0) * r.size}px`;
      g.shadowColor = "rgba(0,0,0,.9)"; g.shadowBlur = r.size * .4; g.fillStyle = r.color; g.fillText(r.text, c.width / 2, y + r.size * .72); y += r.size * 1.45; }
    tex.needsUpdate = true;
  };
  return { mesh, draw };
}

export function createRite(o: Options) {
  const { scene, camera, glowTexture, height } = o;
  let lang: Lang = (() => {
    try { const v = localStorage.getItem("bb-lang"); if (v === "en" || v === "zh") return v; } catch { /* storage unavailable */ }
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  })();
  let api: ExplorationApi | null = null;
  const sound = createRiteSound();
  const serif = () => (lang === "zh" ? '"Noto Serif TC","Source Serif 4",serif' : '"Source Serif 4","Noto Serif TC",serif');

  // ─── The walk as a curve, walked by arc length ───
  const curve = new THREE.CatmullRomCurve3(ritePoints.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
  const length = curve.getLength();
  const at = (s: number) => { const p = curve.getPointAt(THREE.MathUtils.clamp(s / length, 0, 1)); p.y = height(p.x, p.z); return p; };
  const tangent = (s: number) => curve.getTangentAt(THREE.MathUtils.clamp(s / length, 0, 1)).setY(0).normalize();
  /** the side of the path facing away from the hill's centre */
  const outward = (s: number) => { const t = tangent(s), n = new THREE.Vector3(-t.z, 0, t.x), p = at(s); const away = p.clone().sub(new THREE.Vector3(HILL.x, 0, HILL.z)).setY(0).normalize(); return n.dot(away) > 0 ? n : n.negate(); };
  const beside = (s: number, side: number, off: number) => { const q = at(s).addScaledVector(outward(s), side * off); q.y = height(q.x, q.z); return q; };
  const stationS = riteStations.map(st => st.u * length);

  const root = new THREE.Group(); root.name = "The walk"; scene.add(root);
  const targets: THREE.Object3D[] = [];
  const stone = new THREE.MeshStandardMaterial({ color: 0x6d675d, roughness: 1 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: .95 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb48b52, metalness: .75, roughness: .38 });
  const rockMesh = (scale: THREE.Vector3) => {
    const mesh = o.rock ? new THREE.Mesh(o.rock.geometry, o.rock.material) : new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 3), stone);
    mesh.scale.copy(scale); mesh.castShadow = mesh.receiveShadow = true; return mesh;
  };
  const hitbox = (geo: THREE.BufferGeometry, kind: string, station: number) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false })); m.userData = { kind, station }; targets.push(m); return m; };

  // ─── The visible start: an unlit torch planted beside the fire, its head smouldering ───
  const stand = new THREE.Group(); stand.position.set(STAND.x, height(STAND.x, STAND.z), STAND.z); stand.rotation.z = -.1; root.add(stand);
  { const staff = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, 1.45, 8), darkWood); staff.position.y = .72; staff.castShadow = true; stand.add(staff);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(.06, .045, .2, 10), new THREE.MeshStandardMaterial({ color: 0x241810, roughness: 1, emissive: 0x5a1a04, emissiveIntensity: .6 })); head.position.y = 1.5; stand.add(head);
    const hit = hitbox(new THREE.CylinderGeometry(.4, .4, 1.9, 8), "stand", 0); hit.position.y = .9; stand.add(hit); }
  const standEmber = glowSprite(glowTexture, 0xff7a2a, .55); standEmber.position.set(STAND.x - .07, height(STAND.x, STAND.z) + 1.58, STAND.z); standEmber.scale.setScalar(.34); root.add(standEmber);
  const fireHit = hitbox(new THREE.CylinderGeometry(.5, 1.2, 1.6, 12), "gate", 0); fireHit.position.set(FIRE.x, height(FIRE.x, FIRE.z) + .8, FIRE.z); root.add(fireHit);

  // ─── The torch you carry: your only tool ───
  scene.add(camera);
  const torch = new THREE.Group(); torch.visible = false; camera.add(torch);
  const torchRest = new THREE.Vector3(.34, -.46, -.7), torchRaised = new THREE.Vector3(.16, -.02, -.62), torchOffered = new THREE.Vector3(.08, -.34, -.78);
  const torchFlame = flameMaterial();
  { const stick = new THREE.Mesh(new THREE.CylinderGeometry(.016, .022, .5, 8), darkWood); stick.position.y = -.2; torch.add(stick);
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(.03, .026, .07, 8), new THREE.MeshStandardMaterial({ color: 0x1a110a, emissive: 0x6a2406, emissiveIntensity: .5, roughness: 1 })); wrap.position.y = .04; torch.add(wrap);
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(.16, .25), torchFlame); flame.position.y = .17; torch.add(flame); }
  const torchLight = new THREE.PointLight(0xffa052, 0, 10, 2); camera.add(torchLight);
  const torchTip = () => torch.localToWorld(new THREE.Vector3(0, .17, 0));

  // ─── Cairns: one every few steps, catching fire from your torch as you pass ───
  const cairnFlame = flameMaterial();
  const groundGlow = new THREE.MeshBasicMaterial({ map: glowTexture, color: 0xff9a4a, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  type Cairn = { s: number; base: THREE.Vector3; flame: THREE.Mesh; glow: THREE.Mesh; lit: number };
  const cairns: Cairn[] = [];
  { const r = seeded(91), stoneGeo = new THREE.IcosahedronGeometry(1, 1), sp = stoneGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), k = 1 + .12 * Math.sin(x * 6 + z * 4) * Math.cos(y * 7); sp.setXYZ(i, x * k, y * k * .55, z * k); }
    stoneGeo.computeVertexNormals();
    for (let s = 3.4, k = 0; s < length - 2.5; s += 3.4, k++) {
      if (stationS.some((st, i) => i > 0 && Math.abs(st - s) < 2.4)) continue;
      const base = beside(s, k % 2 ? 1 : -1, 1.25), g = new THREE.Group(); g.position.copy(base); root.add(g);
      let y = 0; for (let j = 0; j < 3; j++) { const size = .19 - j * .045 + r() * .03, m = new THREE.Mesh(stoneGeo, stone); m.scale.setScalar(size); m.position.set((r() - .5) * .04, y + size * .5, (r() - .5) * .04); m.rotation.y = r() * 6; m.castShadow = m.receiveShadow = true; g.add(m); y += size * .95; }
      const flame = new THREE.Mesh(new THREE.PlaneGeometry(.3, .44), cairnFlame); flame.position.set(base.x, base.y + y + .16, base.z); flame.scale.setScalar(.001); root.add(flame);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), groundGlow); glow.rotation.x = -Math.PI / 2; glow.position.set(base.x, base.y + .03, base.z); glow.visible = false; root.add(glow);
      cairns.push({ s, base, flame, glow, lit: 0 });
    } }
  const pool = Array.from({ length: o.small ? 2 : 3 }, () => { const l = new THREE.PointLight(0xffa052, 0, 8, 2); root.add(l); return l; });

  // ─── Stations ───
  type Live = { st: RiteStation; i: number; s: number; pos: THREE.Vector3; group: THREE.Group; done: boolean; doneAt: number; focus: THREE.Vector3;
    title: ReturnType<typeof textPlane>; update?: (t: number, dt: number) => void; act?: (hit?: THREE.Intersection) => void };
  const live: Live[] = riteStations.map((st, i) => {
    const s = stationS[i], side = st.kind === "seed" || st.kind === "axial" ? 1 : -1, off = st.kind === "seed" ? 2.4 : 2.8;
    const pos = st.kind === "fire" ? FIRE.clone() : st.kind === "you" ? at(length).add(tangent(length).multiplyScalar(1.2)) : beside(s, side, off);
    pos.y = height(pos.x, pos.z);
    const group = new THREE.Group(); group.position.copy(pos); const look = at(s); group.lookAt(look.x, pos.y, look.z); root.add(group);
    const title = textPlane(2.3, .65); title.mesh.position.copy(pos).add(new THREE.Vector3(0, st.kind === "you" ? 2.7 : 2.45, 0)); title.mesh.renderOrder = 3; root.add(title.mesh);
    return { st, i, s, pos, group, done: false, doneAt: -1, focus: pos.clone().add(new THREE.Vector3(0, 1, 0)), title };
  });
  const paintTitles = () => live.forEach(L => { if (L.i === 0) return; L.title.draw([
    { text: `${L.st.number[lang]}　${L.st.title[lang]}`, size: 82, font: `600 SIZE ${serif()}`, color: "#f3dcae", spacing: lang === "zh" ? .25 : .04 },
    { text: L.st.era[lang], size: 42, font: `400 SIZE ${serif()}`, color: "#b8c6c0", spacing: .12 }]); });
  const myHands: THREE.Mesh[] = [];

  // 1 · the rock: ancestors' hands appear only in your torchlight; then yours, in light
  const ancestorHands: THREE.Mesh[] = [];
  { const L = live[1], rock = rockMesh(new THREE.Vector3(2.6, 2.3, 1.4)); rock.position.set(0, 0, -.7); L.group.add(rock); rock.userData = { kind: "gate", station: 1 }; targets.push(rock);
    L.focus.y = L.pos.y + 1.2; L.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), from = at(L.s).setY(at(L.s).y + 1.2), t = tangent(L.s);
    [["168,56,30", -.6, .7], ["132,34,20", .45, 1.35], ["176,72,36", .1, .5], ["214,196,168", -.25, 1.65], ["150,44,24", .7, .85]].forEach(([c, dx, dy], k) => {
      const aim = L.pos.clone().add(new THREE.Vector3(0, Number(dy), 0)).addScaledVector(t, Number(dx)), origin = from.clone().setY(aim.y).addScaledVector(t, Number(dx));
      ray.set(origin, aim.clone().sub(origin).normalize()); const hit = ray.intersectObject(rock)[0];
      if (hit && hit.face) { const d = decal(stencil(String(c), 100 + k, false), hit.point, hit.face.normal.clone().transformDirection(rock.matrixWorld), .55, false); root.add(d); ancestorHands.push(d); }
    });
    L.act = hit => {
      let point = L.focus.clone(), normal = at(L.s).sub(L.pos).setY(0).normalize();
      if (hit && hit.object === rock && hit.face) { point = hit.point.clone(); normal = hit.face.normal.clone().transformDirection(rock.matrixWorld); }
      const hand = decal(stencil("255,196,120", 501, true), point, normal, .72, true); hand.userData.born = time; root.add(hand); myHands.push(hand);
    }; }

  // 2 · the seed: kneel, press it into the earth, and a field of grain spreads from your hands
  { const L = live[2];
    const mound = new THREE.Mesh(new THREE.SphereGeometry(.6, 18, 8), new THREE.MeshStandardMaterial({ color: 0x2c2016, roughness: 1 })); mound.scale.y = .16; L.group.add(mound);
    const seed = glowSprite(glowTexture, 0xffd27a, .8, true); seed.position.y = .22; seed.scale.setScalar(.4); L.group.add(seed);
    const hit = hitbox(new THREE.SphereGeometry(.9, 10, 8), "gate", 2); hit.position.y = .4; L.group.add(hit); L.focus.y = L.pos.y + .2;
    let field: THREE.InstancedMesh | null = null; const plants: { x: number; z: number; y: number; r: number; h: number; ry: number }[] = [];
    if (o.grass) {
      const material = o.grass.material.clone(); material.color.set(0xe2bf72); material.emissive = new THREE.Color(0x6a4a12); material.emissiveIntensity = .85;
      field = new THREE.InstancedMesh(o.grass.geometry, material, o.small ? 420 : 820); const r = seeded(7);
      for (let k = 0; k < field.count; k++) { let x = 0, z = 0, rad = 0, tries = 0;
        do { const a = r() * Math.PI * 2; rad = .9 + Math.pow(r(), .8) * 9; x = L.pos.x + Math.cos(a) * rad; z = L.pos.z + Math.sin(a) * rad; } while (at(L.s).distanceTo(new THREE.Vector3(x, at(L.s).y, z)) < 1.4 && ++tries < 12);
        plants.push({ x, z, y: height(x, z) - .01, r: rad, h: 1.7 + r() * 1.1, ry: r() * 6.28 }); }
      const m = new THREE.Object3D(); plants.forEach((p, k) => { m.position.set(p.x, p.y, p.z); m.scale.set(1, .001, 1); m.updateMatrix(); field!.setMatrixAt(k, m.matrix); });
      field.receiveShadow = true; o.wind.install(field, "grass"); field.frustumCulled = false; root.add(field);
    }
    const m = new THREE.Object3D(); let grown = 0;
    L.update = t => { seed.material.opacity = L.done ? Math.max(0, 1 - (t - L.doneAt)) : .55 + .35 * Math.sin(t * 3);
      if (!field || !L.done || grown >= 1) return; const age = t - L.doneAt; grown = sm(0, 1, (age - 10) / 1);
      plants.forEach((p, k) => { const g = sm(0, 1, (age - p.r * .35) / 2.4); m.position.set(p.x, p.y, p.z); m.rotation.set(0, p.ry, 0); m.scale.set(.75, Math.max(.001, g * p.h), .75); m.updateMatrix(); field!.setMatrixAt(k, m.matrix); });
      field.instanceMatrix.needsUpdate = true; }; }

  // 3 · the clay: holding is writing — each moment of pressure presses another sign
  let pressed = 0, writeT = 0, name = "";
  let paintTablet = () => {};
  { const L = live[3], W = 600, H = 820, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!, tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const r = seeded(55), rows = Array.from({ length: 5 }, () => Array.from({ length: 6 }, () => String.fromCodePoint(0x12000 + Math.floor(r() * 0x300))));
    paintTablet = () => {
      const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, "#b38f64"); grd.addColorStop(1, "#8f6c48"); g.fillStyle = grd; g.fillRect(0, 0, W, H);
      const rr = seeded(3); for (let i = 0; i < 5000; i++) { g.fillStyle = rr() > .5 ? "rgba(255,240,215,.05)" : "rgba(40,24,12,.06)"; g.fillRect(rr() * W, rr() * H, 2, 2); }
      g.font = '62px "Noto Sans Cuneiform"'; g.textAlign = "center"; g.textBaseline = "middle";
      rows.forEach((row, y) => { row.forEach((ch, x) => { const X = 80 + x * 88, Y = 80 + y * 86; g.fillStyle = "rgba(255,236,208,.3)"; g.fillText(ch, X + 2, Y + 2); g.fillStyle = "rgba(58,36,20,.9)"; g.fillText(ch, X, Y); }); g.fillStyle = "rgba(60,40,24,.35)"; g.fillRect(30, 80 + y * 86 + 42, W - 60, 2); });
      const chars = [...(name || (lang === "zh" ? "我" : "I"))], size = Math.min(118, (W - 80) / Math.max(1, chars.length) / (lang === "zh" ? 1 : .62));
      g.font = `600 ${size}px "Noto Serif TC","Source Serif 4",serif`;
      const text = chars.slice(0, pressed).join(""); g.fillStyle = "rgba(255,236,208,.35)"; g.fillText(text, W / 2 + 3, H - 150 + 3); g.fillStyle = "rgba(52,30,16,.92)"; g.fillText(text, W / 2, H - 150);
      if (pressed > chars.length) { g.font = '500 32px "Noto Serif TC","Source Serif 4",serif'; g.fillStyle = "rgba(52,30,16,.7)"; g.fillText(lang === "zh" ? `西元 ${new Date().getFullYear()} 年` : `${new Date().getFullYear()} CE`, W / 2, H - 58); }
      tex.needsUpdate = true;
    };
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: .95 }), side = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.44, .16), [side, side, side, side, face, side]); slab.position.y = 1.3; slab.rotation.x = -.06; slab.castShadow = true; L.group.add(slab); slab.userData = { kind: "gate", station: 3 }; targets.push(slab);
    const plinth = rockMesh(new THREE.Vector3(1.5, .7, .8)); plinth.position.set(0, -.15, -.05); L.group.add(plinth); L.focus.y = L.pos.y + 1.25;
    document.fonts?.load('62px "Noto Sans Cuneiform"', "\u{12000}").then(() => paintTablet()).catch(() => paintTablet()); }

  // 4 · four stone seats in an opening of the trees
  const plinths: THREE.Vector3[] = [];
  { const L = live[4]; [-2.1, -.7, .7, 2.1].forEach(x => { const p = rockMesh(new THREE.Vector3(.75, .55, .75)); p.position.set(x, 0, -.4 + Math.abs(x) * .32); L.group.add(p); L.group.updateMatrixWorld(true); plinths.push(p.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .42, 0))); }); }

  // 5 · the armillary: geocentric loops relax into heliocentric orbits while you hold it
  let armK = 0;
  { const L = live[5], arm = new THREE.Group(); arm.position.y = 2.05; L.group.add(arm);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, 1.5, 10), darkWood); post.position.y = .75; post.castShadow = true; L.group.add(post);
    const rings = [[0, 0], [1.2, .3], [.4, 1.1]].map(([rx, ry]) => { const t = new THREE.Mesh(new THREE.TorusGeometry(.9, .012, 6, 96), brass); t.rotation.set(rx, ry, 0); t.castShadow = true; arm.add(t); return t; });
    const sun = glowSprite(glowTexture, 0xffc070, 1, true); sun.scale.setScalar(.4); arm.add(sun);
    const planets = [[.387, 0xbfae9a, .025], [.723, 0xecd6a8, .032], [1, 0x78aaee, .036], [1.524, 0xe07a5a, .028], [5.2, 0xdcc08e, .055]].map(([a, c, r], k) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: c })); arm.add(s);
      const trail = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(120 * 3), 3)), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }));
      trail.frustumCulled = false; arm.add(trail); return { a, s, trail, ph: k * 1.3 };
    });
    const hit = hitbox(new THREE.SphereGeometry(1.1, 12, 8), "gate", 5); hit.position.y = 2.05; L.group.add(hit); L.focus.y = L.pos.y + 2;
    const P = (p: { a: number; ph: number }, Y: number) => { const an = p.ph + Math.PI * 2 * Y / Math.pow(p.a, 1.5), r = Math.sqrt(p.a) * .33; return new THREE.Vector3(Math.cos(an) * r, 0, -Math.sin(an) * r); };
    L.update = (t, dt) => { const k = L.done ? 1 : armK, Y = t * .22, E = (y: number) => P(planets[2], y);
      rings.forEach((ring, j) => { ring.rotation.z += dt * (.05 + j * .03) * (1 + armK * 6); });
      sun.position.copy(E(Y)).multiplyScalar(-(1 - k));
      for (const p of planets) { p.s.position.copy(P(p, Y).sub(E(Y).multiplyScalar(1 - k))); const a = p.trail.geometry.attributes.position as THREE.BufferAttribute;
        for (let j = 0; j < 120; j++) { const y = Y - j / 120 * THREE.MathUtils.lerp(2.4, Math.min(2.4, Math.pow(p.a, 1.5) * .95), k); const q = P(p, y).sub(E(y).multiplyScalar(1 - k)); a.setXYZ(j, q.x, q.y, q.z); }
        a.needsUpdate = true; } }; }

  // 6 · ashes: a burnt clearing, falling cinders, a candle you can light only by giving your flame away
  let paintPlaque = () => {};
  const ash = (() => { const n = o.small ? 160 : 320, pos = new Float32Array(n * 3), seeds = Array.from({ length: n }, (_, i) => [seeded(i + 3)(), seeded(i + 900)(), seeded(i + 77)()]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xff8a50, size: .045, map: glowTexture, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; root.add(pts);
    return { pts, seeds, pos }; })();
  { const L = live[6], burnt = new THREE.MeshStandardMaterial({ color: 0x24201d, roughness: 1 });
    [[-1.6, 1, .2, 1.1, 2, .35], [-.45, .7, .1, 1, 1.4, .3], [.8, .5, -.25, 1.2, 1, .3], [1.85, .25, .4, .8, .5, .3]].forEach(([x, y, rz, w, h, d]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), burnt); b.position.set(x, y, -.9); b.rotation.z = rz; b.castShadow = b.receiveShadow = true; L.group.add(b); });
    for (const [x, z, h] of [[-3.2, -2.4, 2.6], [2.9, -2.8, 3.4], [-2.2, 1.6, 1.8]]) { const stump = new THREE.Mesh(new THREE.CylinderGeometry(.12, .2, h, 7), burnt); stump.position.set(x, h / 2, z); stump.rotation.z = (x > 0 ? -1 : 1) * .12; stump.castShadow = true; L.group.add(stump); }
    const block = rockMesh(new THREE.Vector3(.7, .7, .7)); block.position.set(0, 0, .2); L.group.add(block);
    block.geometry.computeBoundingBox(); const top = (block.geometry.boundingBox?.max.y ?? .7) * block.scale.y - .02;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .3, 12), new THREE.MeshStandardMaterial({ color: 0xe9dfca, roughness: .6, emissive: 0x6a4410, emissiveIntensity: 0 })); candle.position.set(0, top + .15, .2); L.group.add(candle);
    const hit = hitbox(new THREE.SphereGeometry(.55, 10, 8), "gate", 6); hit.position.set(0, top + .2, .2); L.group.add(hit); L.focus.copy(L.pos).add(new THREE.Vector3(0, top + .25, 0));
    const flameMat = flameMaterial(), flame = new THREE.Mesh(new THREE.PlaneGeometry(.12, .2), flameMat); flame.position.set(0, top + .38, .2); flame.visible = false; L.group.add(flame);
    const candleLight = new THREE.PointLight(0xffb060, 0, 7, 2); candleLight.position.set(0, top + .55, .3); L.group.add(candleLight);
    const plaqueTex = canvasTexture(1024, 300, () => {}), plaqueCanvas = plaqueTex.image as HTMLCanvasElement;
    paintPlaque = () => { const g = plaqueCanvas.getContext("2d")!; g.clearRect(0, 0, 1024, 300); g.textAlign = "center"; g.fillStyle = "#f3e2c2"; g.shadowColor = "#000"; g.shadowBlur = 12;
      const [quote, source] = riteUi.udhr[lang].split(lang === "zh" ? "——" : " — ");
      g.font = lang === "zh" ? '600 46px "Noto Serif TC",serif' : 'italic 40px "Source Serif 4",serif';
      const units = lang === "zh" ? [...quote] : quote.split(" "), lines: string[] = []; let row = "";
      for (const unit of units) { const test = row ? row + (lang === "zh" ? "" : " ") + unit : unit; if (g.measureText(test).width > 900 && row) { lines.push(row); row = unit; } else row = test; }
      lines.push(row); lines.forEach((r, k) => g.fillText(r, 512, 150 - (lines.length - 1) * 26 + k * 52));
      g.font = lang === "zh" ? '400 28px "Noto Serif TC",serif' : '400 26px "Outfit",sans-serif'; g.fillStyle = "#bfb39b"; g.fillText((lang === "zh" ? "——" : "— ") + source, 512, 252); plaqueTex.needsUpdate = true; };
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.8, .82), new THREE.MeshBasicMaterial({ map: plaqueTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); plaque.position.set(.2, 1.85, -.7); L.group.add(plaque);
    L.update = t => { const k = L.done ? sm(0, 1, (t - L.doneAt) / 1.5) : 0, fl = .85 + .15 * Math.sin(t * 13) * Math.sin(t * 5.7);
      flame.visible = k > 0; flameMat.uniforms.uTime.value = t; flameMat.uniforms.uIntensity.value = k * fl; candle.material.emissiveIntensity = k * .7; candleLight.intensity = k * 5 * fl;
      plaque.material.opacity = L.done ? sm(0, 1, (t - L.doneAt - 3) / 2) : 0; flame.lookAt(camera.position.x, flame.getWorldPosition(new THREE.Vector3()).y, camera.position.z); }; }

  // 7 · the summit: a stone, a smouldering beacon that can be seen from home, and the whole sky
  let altarRing: THREE.MeshBasicMaterial;
  const beacon = glowSprite(glowTexture, 0xff8a40, .5); root.add(beacon);
  { const L = live[7], altar = rockMesh(new THREE.Vector3(1.9, .55, 1.5)); L.group.add(altar); altar.userData = { kind: "gate", station: 7 }; targets.push(altar);
    const outline = canvasTexture(256, 256, g => { const h = document.createElement("canvas"); h.width = h.height = 256; const hx = h.getContext("2d")!; hx.translate(128, 140); hx.fillStyle = hx.strokeStyle = "#fff"; handPath(hx, 44, 7); g.shadowColor = "#ffd9a0"; g.shadowBlur = 16; g.drawImage(h, 0, 0); g.globalCompositeOperation = "destination-out"; g.shadowBlur = 0; g.drawImage(h, 4, 4, 248, 248); });
    altarRing = new THREE.MeshBasicMaterial({ map: outline, color: 0xffd090, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), altarRing); ring.rotation.x = -Math.PI / 2; ring.position.y = .5; L.group.add(ring);
    beacon.position.copy(L.pos).add(new THREE.Vector3(0, 1.1, 0)); beacon.scale.setScalar(1.6); L.focus.y = L.pos.y + .4; }

  // ─── The walk's stars: hung above their places, so from the fire they trace the path in the sky ───
  const flareTex = canvasTexture(128, 128, g => { const gr = g.createLinearGradient(0, 64, 128, 64); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(.5, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 62, 128, 4); g.save(); g.translate(64, 64); g.rotate(Math.PI / 2); g.translate(-64, -64); g.fillRect(0, 63, 128, 2.4); g.restore(); });
  const figureTex = canvasTexture(256, 512, g => { const gr = g.createLinearGradient(0, 40, 0, 512); gr.addColorStop(0, "rgba(255,240,210,1)"); gr.addColorStop(.6, "rgba(255,200,130,.55)"); gr.addColorStop(1, "rgba(255,170,90,0)"); g.fillStyle = gr; g.shadowColor = "rgba(255,200,140,.9)"; g.shadowBlur = 30;
    g.beginPath(); g.arc(128, 78, 30, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(104, 112); g.quadraticCurveTo(58, 118, 54, 170); g.lineTo(36, 500); g.lineTo(220, 500); g.lineTo(202, 170); g.quadraticCurveTo(198, 118, 152, 112); g.closePath(); g.fill(); });
  const beamTex = canvasTexture(16, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,.05)"); gr.addColorStop(.75, "rgba(255,255,255,.75)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 16, 256); });
  type Star = { ref: string; station: number; pos: THREE.Vector3; core: THREE.Sprite; halo: THREE.Sprite; flare: THREE.Sprite; figure: THREE.Sprite; beam: THREE.Mesh; metAt: number; raise: number };
  const sky = new THREE.Group(); sky.name = "The walk's stars"; root.add(sky);
  const stars: Star[] = [];
  live.forEach(L => L.st.figures.forEach((ref, k, all) => {
    const u = all.length > 1 ? k / (all.length - 1) - .5 : 0, wide = L.st.kind === "axial" ? 30 : 16;
    const pos = L.pos.clone().addScaledVector(tangent(L.s), u * wide).add(new THREE.Vector3(0, 24 + Math.cos(u * 3) * 4 + L.i * 1.4, 0)).addScaledVector(outward(L.s), -3);
    const halo = glowSprite(glowTexture, 0xffe6bf, .2); halo.position.copy(pos); halo.scale.setScalar(6); sky.add(halo);
    const flare = glowSprite(flareTex, 0xfff1d6, .35); flare.position.copy(pos); flare.scale.setScalar(5); sky.add(flare);
    const core = glowSprite(glowTexture, 0xfff6e6); core.position.copy(pos); core.scale.setScalar(1.3); sky.add(core);
    const hit = hitbox(new THREE.SphereGeometry(3.4, 8, 6), "star", L.i); hit.userData.index = stars.length; hit.position.copy(pos); root.add(hit);
    const foot = L.st.kind === "axial" ? plinths[k].clone() : L.pos.clone().addScaledVector(at(L.s).sub(L.pos).setY(0).normalize(), .3).addScaledVector(tangent(L.s), (k - (all.length - 1) / 2) * 1.05 + 1.7);
    if (L.st.kind !== "axial") foot.y = height(foot.x, foot.z);
    const figure = new THREE.Sprite(new THREE.SpriteMaterial({ map: figureTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })); figure.center.set(.5, 0); figure.scale.set(.74, 1.66, 1); figure.position.copy(foot); root.add(figure);
    const span = pos.distanceTo(foot), beam = new THREE.Mesh(new THREE.CylinderGeometry(.03, .16, span, 10, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: 0xffe0b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.copy(pos).add(foot).multiplyScalar(.5); beam.lookAt(pos); beam.rotateX(Math.PI / 2); beam.visible = false; root.add(beam);
    stars.push({ ref, station: L.i, pos, core, halo, flare, figure, beam, metAt: -1, raise: 0 });
  }));
  const constellation = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf6dcae, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  constellation.frustumCulled = false; root.add(constellation);
  const mine = glowSprite(glowTexture, 0xffc070, 0); mine.renderOrder = 2; sky.add(mine);
  const mineHalo = glowSprite(glowTexture, 0xffb060, 0); mineHalo.scale.setScalar(9); sky.add(mineHalo);
  const mineHit = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); mineHit.userData = { kind: "mine" }; mineHit.visible = false; root.add(mineHit);
  const trail = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  trail.frustumCulled = false; root.add(trail);
  const altarTop = live[7].pos.clone().add(new THREE.Vector3(0, .6, 0));
  const homeward = FIRE.clone().sub(live[7].pos).setY(0).normalize();
  const MINE = altarTop.clone().addScaledVector(homeward, -12).add(new THREE.Vector3(0, 30, 0));
  const reflection = o.mirror(sky);
  const syncReflection = () => sky.children.forEach((child, i) => { const m = reflection.children[i]; if (m) { m.position.copy(child.position); m.scale.copy(child.scale); } });
  // sparks: your fire, travelling to whatever it lights
  type Spark = { sprite: THREE.Sprite; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; done: () => void };
  const sparks: Spark[] = [];
  function spark(to: THREE.Vector3, dur: number, done: () => void) { const sprite = glowSprite(glowTexture, 0xffc27a, 1); sprite.scale.setScalar(.35); root.add(sprite); sparks.push({ sprite, from: torchTip(), to: to.clone(), t0: time, dur, done }); }

  // ─── The shared sky: the 45 civilization stars wake in the order history wrote them ───
  const civGeo = o.civ.points.geometry, civCount = civGeo.attributes.position.count;
  const civGlow = new THREE.BufferAttribute(new Float32Array(civCount), 1); civGeo.setAttribute("glow", civGlow);
  const civOrder = chronologicalSky();
  const civWeb = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(civCount * 6), 3)), new THREE.LineBasicMaterial({ color: 0xf2dcb0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  civWeb.frustumCulled = false; civWeb.geometry.setDrawRange(0, 0); o.civ.group.add(civWeb);
  const civTie = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  civTie.frustumCulled = false; root.add(civTie);
  let civWoken = 0;
  function wakeCiv(n: number) {
    const p = civGeo.attributes.position as THREE.BufferAttribute, w = civWeb.geometry.attributes.position as THREE.BufferAttribute;
    while (civWoken < n && civWoken < civOrder.length) {
      const i = civOrder[civWoken], a = new THREE.Vector3().fromBufferAttribute(p, i);
      if (civWoken > 0) { let best = 0, bd = Infinity; for (let k = 0; k < civWoken; k++) { const d = a.distanceTo(new THREE.Vector3().fromBufferAttribute(p, civOrder[k])); if (d < bd) { bd = d; best = civOrder[k]; } }
        const b = new THREE.Vector3().fromBufferAttribute(p, best); w.setXYZ((civWoken - 1) * 2, b.x, b.y, b.z); w.setXYZ((civWoken - 1) * 2 + 1, a.x, a.y, a.z); }
      civWoken++; if (civWoken % 4 === 1) sound.bell(79 + (civWoken % 9), .025);
    }
    w.needsUpdate = true; civWeb.geometry.setDrawRange(0, Math.max(0, civWoken - 1) * 2);
  }

  function rebuildConstellation() {
    const points = stars.filter(s => s.metAt >= 0).sort((a, b) => a.station - b.station || a.metAt - b.metAt).map(s => s.pos);
    if (mineAt >= 0 && time - mineAt > 7) points.push(mine.position.clone());
    constellation.geometry.dispose(); constellation.geometry = new THREE.BufferGeometry().setFromPoints(points.length > 1 ? points : []);
  }

  // ─── State ───
  let time = 0, state: "idle" | "intro" | "walk" | "finale" = "idle", index = 0, phase: "walk" | "narrate" | "act" | "after" = "walk", phaseAt = 0;
  let s = 0, holdAct = false, walkPointer = false, keyWalk = false, keyAct = false, holdT = 0, mineAt = -1, gloom = 0, finaleAt = -1, approach = 1, kneel = 0, raise = 0, offer = 0, lastStep = 0, raiseTarget = -1;
  let actHit: THREE.Intersection | undefined;
  const approachFrom = new THREE.Vector3();
  type Saved = { name: string; date: string };
  let saved: Saved | null = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) || "null"); } catch { saved = null; }
  const showMine = () => { mine.position.copy(MINE); mine.material.opacity = 1; mine.scale.setScalar(2.4); mineHalo.position.copy(MINE); mineHalo.material.opacity = .25; mineHit.position.copy(MINE); mineHit.visible = true; if (!targets.includes(mineHit)) targets.push(mineHit); };
  if (saved) showMine();

  // ─── DOM: a line of narration, a quiet hint, nothing else in the way ───
  const panel = el("rite-panel"), line = el("rite-line"), hint = el("rite-hint"), actBtn = el<HTMLButtonElement>("rite-act"), homeBtn = el<HTMLButtonElement>("rite-next"), leaveBtn = el<HTMLButtonElement>("rite-leave");
  const startCard = el("rite-start"), nameInput = el<HTMLInputElement>("rite-name"), beginBtn = el<HTMLButtonElement>("rite-begin"), fade = el("rite-fade"), langBtn = el<HTMLButtonElement>("lang-toggle");
  let lineText = "", hintText = "";
  function setLine(text: string) { if (text === lineText) return; lineText = text; line.classList.remove("show"); void line.offsetWidth; line.textContent = text; if (text) line.classList.add("show"); }
  function setHint(text: string) { if (text === hintText) return; hintText = text; hint.textContent = text; }
  function paintStatic() {
    document.documentElement.dataset.riteLang = lang;
    langBtn.textContent = lang === "zh" ? "EN" : "中文"; langBtn.setAttribute("aria-label", lang === "zh" ? "Switch to English" : "切換為中文");
    el("rite-start-eyebrow").textContent = riteUi.startEyebrow[lang]; el("rite-start-title").textContent = riteUi.startTitle[lang]; el("rite-start-text").textContent = riteUi.startText[lang];
    el("rite-name-label").textContent = riteUi.name[lang]; beginBtn.textContent = index > 0 ? riteUi.resume[lang] : riteUi.begin[lang];
    leaveBtn.textContent = riteUi.leave[lang]; homeBtn.textContent = riteUi.home[lang];
    const guide = document.getElementById("rite-guide-name"); if (guide) guide.textContent = riteUi.startTitle[lang];
    paintTitles(); paintTablet(); paintPlaque();
  }
  langBtn.addEventListener("click", () => { lang = lang === "zh" ? "en" : "zh"; try { localStorage.setItem("bb-lang", lang); } catch { /* ignore */ } paintStatic(); });
  function showFigure(i: number) {
    const star = stars[i], figure = resolveFigure(star.ref, lang); if (!figure || !api) return;
    const quote = figure.quote ? (lang === "zh" ? `\n\n「${figure.quote}」` : `\n\n“${figure.quote}”`) : "";
    api.showInfo({ eyebrow: `${riteUi.starHint[lang]} · ${figure.life}`, title: figure.name, description: figure.text + quote, href: figure.href, linkText: figure.href ? (lang === "zh" ? "關於這片星圖 ↗" : "About this constellation ↗") : undefined });
  }
  function wake(i: number, show: boolean) {
    const star = stars[i]; if (star.metAt >= 0) { if (show) showFigure(i); return; }
    star.metAt = time; star.beam.visible = true; rebuildConstellation(); sound.bell(72 + (i % 6) * 2, .055); if (show) showFigure(i);
    if (state === "walk" && index === 4 && !live[4].done && stars.every(x => x.station !== 4 || x.metAt >= 0)) setTimeout(() => complete(4), 1600);
  }
  const CHORDS = [[50, 57, 62, 65], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [41, 53, 60, 65, 69], [48, 55, 60, 64], [38, 45, 50, 53], [38, 45, 50, 54, 57]];
  function complete(i: number, hit?: THREE.Intersection) {
    const L = live[i]; if (L.done) return; L.done = true; L.doneAt = time; holdAct = false; holdT = 0;
    L.act?.(hit); sound.chord(CHORDS[i], 10); sound.boom(.25);
    if (i === 7) { mineAt = time; mine.position.copy(altarTop); mine.material.opacity = 1; state = "finale"; finaleAt = time; }
    phase = "after"; phaseAt = time; setLine(say(L.st.after, lang, name)); setHint("");
    const first = stars.findIndex(y => y.station === i);
    if (L.st.kind !== "axial") stars.forEach((x, k) => { if (x.station === i) setTimeout(() => spark(x.pos, 1.1, () => wake(k, k === first)), 900 + (k - first) * 700); });
    api?.announce(say(L.st.after, lang, name));
  }

  function begin() {
    sound.wake(); startCard.hidden = true; name = (nameInput.value || "").trim().slice(0, 10); pressed = 0; paintTablet();
    if (live.every(L => L.done)) { live.forEach(L => { L.done = false; }); index = 0; s = 0; mineAt = -1; finaleAt = -1; }
    state = "walk"; panel.hidden = false; leaveBtn.hidden = false; el("wayfinding").hidden = true; api?.clearInfo(); homeBtn.hidden = true;
    approachFrom.copy(camera.position); approach = 0; torch.visible = true; phase = "walk"; phaseAt = time;
  }
  function leave() {
    if (state === "idle") return; state = "idle"; panel.hidden = true; leaveBtn.hidden = true; startCard.hidden = true; setLine(""); setHint(""); el("wayfinding").hidden = false;
    walkPointer = keyWalk = holdAct = keyAct = false; torch.visible = false; fade.classList.add("on");
    setTimeout(() => { api?.returnToPath(true); fade.classList.remove("on"); }, api?.paused ? 0 : 900);
  }
  function finishHome() {
    try { saved = { name, date: new Date().toISOString().slice(0, 10) }; localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* ignore */ }
    showMine(); leave();
  }
  function open() {
    if (state === "walk" || state === "finale") return;
    sound.wake(); state = "intro"; startCard.hidden = false; panel.hidden = true; paintStatic();
    api?.moveTo([STAND.x + 1.6, 1.7, STAND.z + 2.2], [STAND.x, 1.2, STAND.z], () => { if (state === "intro") nameInput.focus({ preventScroll: true }); });
  }
  beginBtn.addEventListener("click", begin);
  nameInput.addEventListener("keydown", e => { if (e.key === "Enter") begin(); });
  leaveBtn.addEventListener("click", leave);
  homeBtn.addEventListener("click", finishHome);
  // Keyboard and assistive alternative: the act happens at once.
  actBtn.addEventListener("click", () => {
    if (state !== "walk" || phase !== "act") return; const st = live[index].st;
    if (st.actKind === "raise") { const k = stars.findIndex(x => x.station === index && x.metAt < 0 && x.raise >= 0); if (k >= 0) { stars[k].raise = -99; spark(stars[k].pos, .9, () => wake(k, true)); } }
    else if (st.actKind === "write") { pressed = [...(name || (lang === "zh" ? "我" : "I"))].length + 1; paintTablet(); complete(index); }
    else complete(index);
  });
  const editing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement;
  addEventListener("keydown", e => { if (state !== "walk" || editing(e)) return; sound.wake();
    if (e.code === "KeyW" || e.code === "Space") { keyWalk = true; e.preventDefault(); }
    if (e.code === "KeyE") keyAct = true; });
  addEventListener("keyup", e => { if (e.code === "KeyW" || e.code === "Space") keyWalk = false; if (e.code === "KeyE") keyAct = false; });
  paintStatic();

  // ─── Hooks for exploration ───
  const pickHit = (ray: THREE.Raycaster) => { ray.far = 400; const hit = ray.intersectObjects(targets, false)[0]; ray.far = Infinity; return hit; };
  const hooks: RiteHooks = {
    active: () => state === "walk" || state === "finale",
    hover(ray) {
      const hit = pickHit(ray); if (!hit) return null; const u = hit.object.userData;
      if (u.kind === "stand") return state === "idle" || state === "intro" ? riteUi.trailhead[lang] : null;
      if (u.kind === "star") { const f = resolveFigure(stars[u.index].ref, lang); return f ? `${f.name} · ${f.life}` : null; }
      if (u.kind === "mine") return `${riteUi.yourStar[lang]} · ${saved?.name || name || ""}`;
      if (u.kind === "gate" && state === "walk" && u.station === index && phase === "act") return live[index].st.act[lang];
      return null;
    },
    click(ray) {
      const hit = pickHit(ray); const u = hit?.object.userData;
      if (u?.kind === "stand" && (state === "idle" || state === "intro")) { open(); return true; }
      if (u?.kind === "mine") { api?.showInfo({ eyebrow: `${riteUi.yourStar[lang]} · ${saved?.date ?? ""}`, title: saved?.name || name || (lang === "zh" ? "你" : "You"), description: riteUi.carried[lang] }); return true; }
      if (u?.kind === "star" && !(state === "walk" && index === 4 && phase === "act")) { showFigure(u.index); return true; }
      return state === "walk" || state === "finale";
    },
    press(ray) {
      if (state !== "walk" || phase !== "act") return false;
      const hit = pickHit(ray); if (!hit) return false; const u = hit.object.userData, st = live[index].st;
      if (st.actKind === "raise" && u.kind === "star" && stars[u.index].station === index && stars[u.index].metAt < 0 && stars[u.index].raise >= 0) { raiseTarget = u.index; holdAct = true; return true; }
      if (u.kind === "gate" && u.station === index) { holdAct = true; actHit = hit; return true; }
      return false;
    },
    release() { holdAct = false; raiseTarget = -1; },
    pointer(down) { walkPointer = down && state === "walk"; if (down) sound.wake(); },
    open, exit: leave,
  };

  // ─── Frame update ───
  const tmp = new THREE.Vector3(), look = new THREE.PerspectiveCamera(), baseFog = (scene.fog as THREE.FogExp2).color.clone(), baseDensity = (scene.fog as THREE.FogExp2).density, moonBase = o.moonLight.intensity, bounceBase = o.moonBounce.intensity;
  function face(target: THREE.Vector3, rate: number) {
    if (!api || api.looking || performance.now() - api.lastLook < 2200) return;
    look.position.copy(camera.position); look.lookAt(target); camera.quaternion.slerp(look.quaternion, Math.min(1, rate)); api.syncAngles();
  }
  if (new URLSearchParams(location.search).has("ritedebug")) (window as unknown as { __rite: unknown }).__rite = {
    get state() { return { state, index, phase, s: +s.toFixed(1), length: +length.toFixed(1), gloom: +gloom.toFixed(2), cairnsLit: cairns.filter(c => c.lit > 0).length, cairns: cairns.length, met: stars.filter(x => x.metAt >= 0).length, civWoken }; },
    complete: (i: number) => complete(i), wake: (i: number) => wake(i, false), go: (d: number) => { s = d; },
  };
  return {
    hooks,
    attach(a: ExplorationApi) { api = a; },
    update(dt: number, sceneTime: number): boolean {
      time += dt; const t = time, still = !!api?.paused, L = live[index], st = L.st;
      const stop = index === 0 ? 0 : L.s - (st.kind === "you" ? 2.4 : 2.1);
      const fl = .84 + .16 * Math.sin(t * 11.3) * Math.sin(t * 5.1);
      // ── movement: hold to walk; the path itself stops you at each place
      let walking = false;
      if (state === "walk") {
        if (approach < 1) { approach = still ? 1 : Math.min(1, approach + dt / 2.2); camera.position.lerpVectors(approachFrom, at(0).add(new THREE.Vector3(0, EYE, 0)), sm(0, 1, approach)); face(live[0].focus, dt * 2.5); }
        else {
          if (phase === "walk" && L.done && index < live.length - 1) { index++; return true; }
          const wantWalk = (walkPointer || keyWalk) && phase === "walk";
          if (wantWalk && s < stop) { s = still ? stop : Math.min(stop, s + 1.3 * dt); walking = true; if (t - lastStep > .56) { lastStep = t; sound.step(at(s).y / 9); } }
          if (phase === "walk" && s >= stop - .01 && !L.done) { phase = "narrate"; phaseAt = t; }
          const p = at(s), eye = EYE - kneel * .75; camera.position.lerp(tmp.set(p.x, p.y + eye, p.z), still ? 1 : Math.min(1, dt * 6));
          if (walking) face(at(s + 5).add(new THREE.Vector3(0, EYE - .15 + (at(s + 5).y - p.y) * .4, 0)), dt * 1.8);
          else if (phase === "act" && st.actKind === "raise") { const k = raiseTarget >= 0 ? raiseTarget : stars.findIndex(x => x.station === index && x.metAt < 0); face(k >= 0 ? stars[k].pos : L.focus, dt * 1.2); }
          else if (phase !== "after" || st.kind !== "axial") face(L.focus, dt * 1.5);
        }
      }
      // ── narration and the act
      if (state === "walk" && phase === "narrate") { const k = Math.floor((t - phaseAt) / 4.4);
        if (k < st.lines.length) setLine((t - phaseAt) % 4.4 < 3.95 ? say(st.lines[k], lang, name) : "");
        else { phase = "act"; phaseAt = t; actBtn.textContent = st.act[lang]; } }
      if (state === "walk" && phase === "act") {
        setLine(st.act[lang]); setHint(holdAct || keyAct ? riteUi.holding[lang] : riteUi.holdKeys[lang]);
        const pressing = holdAct || keyAct;
        if (st.actKind === "write") { if (pressing) { writeT += dt; if (writeT > .45) { writeT = 0; pressed++; paintTablet(); sound.step(0); } } if (pressed > [...(name || (lang === "zh" ? "我" : "I"))].length) complete(index, actHit); }
        else if (st.actKind === "raise") { const k = raiseTarget >= 0 ? raiseTarget : keyAct ? stars.findIndex(x => x.station === index && x.metAt < 0 && x.raise >= 0) : -1;
          if (pressing && k >= 0) { stars[k].raise += dt; if (stars[k].raise > 1) { stars[k].raise = -99; const target = k; spark(stars[k].pos, .9, () => wake(target, true)); raiseTarget = -1; holdAct = false; } } }
        else { holdT = pressing ? holdT + dt : Math.max(0, holdT - dt * 2); if (st.kind === "heavens") armK = Math.min(1, holdT / 1.5); if (holdT > (st.kind === "you" ? 2.4 : st.kind === "fire" ? 1.8 : 1.5)) complete(index, actHit); }
      }
      if (state === "walk" && phase === "after" && t - phaseAt > 6) { phase = "walk"; phaseAt = t; setLine(""); }
      if (state === "walk" && phase === "walk") setHint(approach >= 1 && (live[index].done || s < stop) ? `${riteUi.walkHint[lang]} · ${riteUi.walkKeys[lang]}` : "");
      // ── body: kneel for the seed, raise the torch to the sky, offer it to the fire and the candle
      const acting = phase === "act" && (holdAct || keyAct);
      kneel += ((st.kind === "seed" && (acting || (phase === "after" && t - phaseAt < 2.5)) ? 1 : 0) - kneel) * Math.min(1, dt * 3);
      raise += (((st.actKind === "raise" && acting) || sparks.length > 0 ? 1 : 0) - raise) * Math.min(1, dt * 4);
      offer += (((st.actKind === "pass" || st.kind === "fire") && acting ? 1 : 0) - offer) * Math.min(1, dt * 4);
      torch.position.copy(torchRest).lerp(torchRaised, raise).lerp(torchOffered, offer); torch.rotation.z = -.12 + raise * .25;
      // ── fire: the torch, the cairns, a few pooled lights
      const ashL = live[6], gIn = sm(ashL.s - 22, ashL.s - 3, s), g = state === "idle" ? 0 : ashL.done ? gIn * (1 - sm(0, 1, (t - ashL.doneAt - 1) / 6)) : gIn;
      gloom = g;
      const lit = live[0].done ? THREE.MathUtils.lerp(1, .14, g) : index === 0 && phase === "act" ? Math.min(1, holdT / 1.8) : 0;
      torchFlame.uniforms.uTime.value = sceneTime; torchFlame.uniforms.uIntensity.value = lit * fl * (1 + raise * .3); torchLight.intensity = lit * 5.5 * fl; torchLight.position.copy(torch.position).add(new THREE.Vector3(0, .2, 0));
      cairnFlame.uniforms.uTime.value = sceneTime; cairnFlame.uniforms.uIntensity.value = (.95 + .1 * fl) * (1 - g * .7);
      for (const c of cairns) {
        if (live[0].done && state !== "idle" && c.lit === 0 && c.s < s + 1.5) { c.lit = .001; sound.ignite(); }
        if (c.lit > 0 && c.lit < 1) c.lit = Math.min(1, c.lit + dt * 1.4);
        if (c.lit > 0) { c.flame.scale.setScalar(Math.max(.001, sm(0, 1, c.lit))); c.glow.visible = true; c.glow.scale.setScalar(.4 + .6 * c.lit); c.flame.lookAt(camera.position.x, c.flame.position.y, camera.position.z); }
      }
      const near = cairns.filter(c => c.lit > 0).sort((a, b) => a.base.distanceToSquared(camera.position) - b.base.distanceToSquared(camera.position));
      pool.forEach((l, k) => { const c = near[k]; if (!c) { l.intensity = 0; return; } l.position.copy(c.flame.position).add(new THREE.Vector3(0, .15, 0)); l.intensity = 3.4 * c.lit * fl * (1 - g * .6); });
      // ── the war: smoke over the sky, the moon dims, cinders fall, your flame almost goes out
      o.skyDim.value = g; o.starDim.value = g;
      (scene.fog as THREE.FogExp2).color.lerpColors(baseFog, new THREE.Color(0x1a0f0c), g); (scene.fog as THREE.FogExp2).density = baseDensity + g * .03;
      o.moonLight.intensity = moonBase * (1 - g * .8); o.moonBounce.intensity = bounceBase * (1 - g * .65);
      (ash.pts.material as THREE.PointsMaterial).opacity = g * .8;
      if (g > 0) { for (let k = 0; k < ash.seeds.length; k++) { const [a, b, c] = ash.seeds[k]; ash.pos[k * 3] = camera.position.x + (a - .5) * 16 + Math.sin(t * .4 + c * 9) * .6; ash.pos[k * 3 + 1] = camera.position.y + 6 - ((t * (.35 + c * .5) + b * 9) % 9); ash.pos[k * 3 + 2] = camera.position.z + (b - .5) * 16; }
        ash.pts.geometry.attributes.position.needsUpdate = true; }
      if (state !== "idle") o.moonLight.target.position.set(camera.position.x, 0, camera.position.z); else o.moonLight.target.position.set(0, 0, -13);
      // ── places, hands, titles
      for (const P of live) P.update?.(t, dt);
      standEmber.material.opacity = (live[0].done || state === "walk") ? 0 : .35 + .25 * Math.sin(t * 2.1) * Math.sin(t * 3.7 + 1);
      for (const h of ancestorHands) (h.material as THREE.MeshStandardMaterial).opacity = (live[0].done ? sm(7.5, 2.5, h.position.distanceTo(camera.position)) : 0) * .95;
      for (const h of myHands) (h.material as THREE.MeshBasicMaterial).opacity = sm(0, 1, (t - h.userData.born) / 1.4);
      altarRing.opacity = .3 + .15 * Math.sin(t * 2) + (index === 7 ? holdT / 2.4 * .6 : 0);
      beacon.material.opacity = state === "finale" ? .9 : .35 + .15 * Math.sin(t * 1.3); beacon.scale.setScalar(state === "finale" ? 2.4 : 1.6);
      const lookingUp = sm(.35, .6, camera.getWorldDirection(tmp).y);
      for (const P of live) { if (P.i === 0) continue; const d = camera.position.distanceTo(P.pos), m = P.title.mesh.material as THREE.MeshBasicMaterial;
        m.opacity = state === "walk" ? sm(16, 8, d) * sm(3, 4.6, d) * (1 - lookingUp) * (P.done && s > P.s + 2 ? sm(P.s + 10, P.s + 3, s) : 1) : 0; P.title.mesh.visible = m.opacity > .01;
        P.title.mesh.lookAt(camera.position.x, P.title.mesh.position.y, camera.position.z); }
      // ── the walk's stars
      for (const x of stars) {
        const met = x.metAt >= 0, hidden = (x.station === 6 && !live[6].done) || (g > .4 && x.station !== 6), pulse = .9 + .1 * Math.sin(t * 1.7 + x.pos.x), charge = Math.max(0, x.raise);
        const a = hidden ? .04 : 1; x.core.material.opacity = a; x.halo.material.opacity = a * (met ? .26 : .14 + charge * .3); x.flare.material.opacity = a * (met ? .5 : .28 + charge * .4);
        x.core.scale.setScalar((met ? 1.45 : 1 + charge * .7) * pulse); x.halo.scale.setScalar((met ? 5 : 3.6 + charge * 1.5) * pulse); x.flare.scale.setScalar((met ? 4.6 : 3.4) * pulse); x.flare.material.rotation = t * .05;
        x.core.material.color.setRGB(1, met ? .86 : .96, met ? .62 : .88);
        x.figure.material.opacity = met ? sm(0, 1, (t - x.metAt - 1) / 2) * .5 * (1 - g * .6) : 0;
        const b = x.beam.material as THREE.MeshBasicMaterial; b.opacity = met ? .42 * Math.exp(-(t - x.metAt) * .45) + .022 : 0; x.beam.visible = b.opacity > .004;
      }
      constellation.material.opacity = .45 * (1 - g);
      // ── sparks of your fire
      for (let k = sparks.length - 1; k >= 0; k--) { const sp = sparks[k], u = Math.min(1, (t - sp.t0) / sp.dur), mid = sp.from.clone().lerp(sp.to, .5).add(new THREE.Vector3(0, 2, 0));
        sp.sprite.position.copy(sp.from).multiplyScalar((1 - u) * (1 - u)).addScaledVector(mid, 2 * u * (1 - u)).addScaledVector(sp.to, u * u); sp.sprite.scale.setScalar(.35 + u * .6);
        if (u >= 1) { root.remove(sp.sprite); sp.sprite.material.dispose(); sparks.splice(k, 1); sp.done(); } }
      // ── the summit: your star rises, the shared sky wakes, then you look back at home
      if (state === "finale") { const ft = t - finaleAt, k = sm(0, 1, ft / 7);
        mine.position.lerpVectors(altarTop, MINE, k); mine.scale.setScalar(THREE.MathUtils.lerp(.9, 2.6, k) * (.92 + .08 * Math.sin(t * 2))); mineHalo.position.copy(mine.position); mineHalo.material.opacity = .25 * k;
        const a = trail.geometry.attributes.position as THREE.BufferAttribute; a.setXYZ(0, altarTop.x, altarTop.y, altarTop.z); a.setXYZ(1, mine.position.x, mine.position.y, mine.position.z); a.needsUpdate = true;
        trail.material.opacity = .7 * Math.min(1, ft) * (1 - sm(9, 14, ft));
        if (ft > 7.1 && ft - dt <= 7.1) rebuildConstellation();
        if (ft < 7.5) face(mine.position, dt * 1.4);
        if (ft > 7.5 && ft < 18) { setLine(ft < 12.5 ? riteUi.together[lang] : riteUi.together2[lang]); wakeCiv(Math.floor((ft - 7.5) / 9 * civOrder.length) + 1); face(camera.position.clone().add(new THREE.Vector3(0, 30, 0)).addScaledVector(homeward, -18), dt * .6); }
        if (ft > 18) { face(FIRE.clone().add(new THREE.Vector3(0, 2, 0)), dt * .8); setLine(ft < 23 ? riteUi.lookBack[lang] : riteUi.lookBack2[lang]); if (ft > 22) homeBtn.hidden = false; }
        const glow = civGlow.array as Float32Array; for (let n = 0; n < civOrder.length; n++) glow[civOrder[n]] = n < civWoken ? Math.min(1, glow[civOrder[n]] + dt * 1.5) : 0; civGlow.needsUpdate = true;
        (civWeb.material as THREE.LineBasicMaterial).opacity = Math.max(0, Math.min(.38, (ft - 7.5) * .06));
        if (civWoken > 0) { o.civ.group.updateMatrixWorld(); const last = new THREE.Vector3().fromBufferAttribute(civGeo.attributes.position as THREE.BufferAttribute, civOrder[civWoken - 1]).applyMatrix4(o.civ.group.matrixWorld);
          const ta = civTie.geometry.attributes.position as THREE.BufferAttribute; ta.setXYZ(0, mine.position.x, mine.position.y, mine.position.z); ta.setXYZ(1, last.x, last.y, last.z); ta.needsUpdate = true; civTie.material.opacity = Math.max(0, Math.min(.35, (ft - 8) * .08)); }
      }
      sound.update(lit, g, dt);
      syncReflection();
      return state !== "idle" || sparks.length > 0 || stars.some(x => x.metAt >= 0 && time - x.metAt < 8);
    },
  };
}
