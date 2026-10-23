import * as THREE from "three";
import { fireFragment } from "./shaders";
import { pointAt, riteLength, THRESHOLD, zones, AXIS, distToWalk } from "./rite-path.ts";
import { riteStations, riteGroups, riteStops, riteUi, roadLines, resolveFigure, say, chronologicalSky, yearsAgoAt, yearLabel, torchbearer, type Lang, type RiteStation } from "./rite.ts";
import { createRiteSound, type RiteMix } from "./rite-sound.ts";
import { addRoadside, type Placement } from "./rite-land.ts";
import { addAtmosphere } from "./rite-atmos.ts";
import { loadShadowArt, shadowSpecs } from "./rite-shadows.ts";
import { createApparitions, type Figure } from "./rite-apparitions.ts";
import { gravestone, steleGeometry, stoneMaterial, bowl, flowerBunch, flowerMaterial, pebbleGeometry, hearth, hunt, needle, doorway, throne, wheel, anchor as anchorRelic, type Relic, type Top } from "./rite-memorials.ts";
import { overview } from "./journey.ts";
import type { createWind } from "./wind";

/** What the walk needs from exploration (camera ownership, cards, return). */
export type ExplorationApi = {
  syncAngles(): void;
  showInfo(info: { eyebrow: string; title: string; description: string; href?: string; linkText?: string }): void;
  clearInfo(): void;
  announce(message: string): void;
  moveTo(position: readonly number[], target: readonly number[], done: () => void): void;
  returnToPath(instant?: boolean): void;
  duckMusic(on: boolean): void;
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
  /** the clearing's firs and ferns, reused along the road */
  forest?: THREE.Group;
  ferns?: { geometry: THREE.BufferGeometry; material: THREE.Material }[];
  grasses?: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }[];
  /** the moon, so the walk's constellation keeps clear of it */
  moon?: THREE.Object3D;
  /** the final grade, which the walk steers through its moods */
  grade: { uVignette: { value: number }; uGrain: { value: number }; uSat: { value: number }; uTint: { value: THREE.Color }; uTime: { value: number } };
  skyDawn: { value: number };
  skyAurora: { value: number };
  mirror: (object: THREE.Object3D) => THREE.Object3D;
  skyDim: { value: number };
  starDim: { value: number };
  moonLight: THREE.DirectionalLight;
  moonBounce: THREE.LightProbe;
  /** the shared civilization sky, woken at the end of the road */
  civ: { points: THREE.Points; group: THREE.Group };
};

const FIRE = new THREE.Vector3(-1, 0, -5);
const STAND = new THREE.Vector3(-1.5, 0, -2.4);
const STORE = "bb-rite";
const EYE = 1.7;
const LEN = riteLength;
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
/** The world's fire shader, instanced: each flame has its own position, size and moment in the flicker. */
const instancedFire = {
  vertex: `
    attribute vec3 iPos; attribute float iLit; attribute float iSeed; attribute float iScale;
    varying vec2 vUv; varying float vInt; varying float vSeed;
    void main() {
      vUv = uv; float g = iLit * iLit * (3. - 2. * iLit); vInt = g; vSeed = iSeed;
      vec3 right = normalize(vec3(viewMatrix[0][0], 0., viewMatrix[2][0]) + vec3(1e-5, 0., 0.));
      vec3 world = iPos + right * position.x * g * iScale + vec3(0., position.y * g * iScale, 0.);
      gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
    }`,
  fragment: fireFragment
    .replace("uniform float uTime;", "uniform float uTime0; varying float vSeed;\n#define uTime (uTime0 + vSeed)")
    .replace("uniform float uIntensity;", "uniform float uGlobal; varying float vInt;\n#define uIntensity (vInt * uGlobal)"),
};
const flameMaterial = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uTime0: { value: 0 }, uGlobal: { value: 1 }, uWind: { value: 0 } }, vertexShader: instancedFire.vertex, fragmentShader: instancedFire.fragment });
/** A single flame, using the instanced shader with one instance. */
function singleFlame(width: number, height: number) {
  const plane = new THREE.PlaneGeometry(width, height).translate(0, height / 2, 0), geo = new THREE.InstancedBufferGeometry();
  geo.index = plane.index; geo.setAttribute("position", plane.attributes.position); geo.setAttribute("uv", plane.attributes.uv);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(3), 3), iLit = new THREE.InstancedBufferAttribute(new Float32Array(1), 1);
  geo.setAttribute("iPos", iPos); geo.setAttribute("iLit", iLit); geo.setAttribute("iSeed", new THREE.InstancedBufferAttribute(new Float32Array([Math.random() * 9]), 1)); geo.setAttribute("iScale", new THREE.InstancedBufferAttribute(new Float32Array([1]), 1)); geo.instanceCount = 1;
  const mesh = new THREE.Mesh(geo, flameMaterial()); mesh.frustumCulled = false;
  return { mesh, place(p: THREE.Vector3) { iPos.setXYZ(0, p.x, p.y, p.z); iPos.needsUpdate = true; }, set(v: number) { if (iLit.getX(0) !== v) { iLit.setX(0, v); iLit.needsUpdate = true; } }, material: mesh.material as THREE.ShaderMaterial };
}
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

/** The shape of each gravestone: older and eastern stones round-topped, Greek and European ones pointed or flat. */
const stoneForm: Record<string, { w: number; h: number; top: Top; tint?: number }> = {
  enheduanna: { w: .78, h: 1.78, top: "arch", tint: 0xe6dccb },
  laozi: { w: .82, h: 1.5, top: "round" }, confucius: { w: .86, h: 1.6, top: "round" }, buddha: { w: .82, h: 1.56, top: "arch", tint: 0xe4ddd0 }, socrates: { w: .84, h: 1.54, top: "peak", tint: 0xf2eee6 },
  zhangheng: { w: .84, h: 1.54, top: "round" }, copernicus: { w: .86, h: 1.5, top: "flat", tint: 0xdedad2 }, galileo: { w: .84, h: 1.5, top: "arch" }, newton: { w: .88, h: 1.56, top: "peak", tint: 0xe0ddd6 }, curie: { w: .82, h: 1.46, top: "flat" },
  eleanor: { w: .86, h: 1.5, top: "flat", tint: 0xf0ece6 }, pcchang: { w: .86, h: 1.56, top: "round" },
};

export function createRite(o: Options) {
  const { scene, camera, glowTexture, height } = o;
  let lang: Lang = (() => {
    try { const v = localStorage.getItem("bb-lang"); if (v === "en" || v === "zh") return v; } catch { /* storage unavailable */ }
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  })();
  let api: ExplorationApi | null = null;
  const sound = createRiteSound();
  const serif = () => (lang === "zh" ? '"Noto Serif TC","Source Serif 4",serif' : '"Source Serif 4","Noto Serif TC",serif');
  const pixelRatio = Math.min(window.devicePixelRatio || 1, o.small ? 1.15 : 1.5);
  let time = 0;
  /** things that happen a moment later, on the walk's own clock */
  const pending: { at: number; run: () => void }[] = [];
  const later = (delay: number, run: () => void) => { pending.push({ at: time + delay, run }); };

  // ─── The road, walked by the metre ───
  const at = (s: number) => { const [x, z, tx, tz] = pointAt(Math.min(s, LEN)), over = Math.max(0, s - LEN); const p = new THREE.Vector3(x + tx * over, 0, z + tz * over); p.y = height(p.x, p.z); return p; };
  const tangent = (s: number) => { const [, , tx, tz] = pointAt(Math.max(0, Math.min(s, LEN - .5))); return new THREE.Vector3(tx, 0, tz); };
  /** side +1 is on your right as you walk away from home */
  const beside = (s: number, side: number, off: number) => { const t = tangent(s), p = at(s); p.x += -t.z * side * off; p.z += t.x * side * off; p.y = height(p.x, p.z); return p; };

  const root = new THREE.Group(); root.name = "The walk"; scene.add(root);
  /** where each memorial stands: beside the road, or in an arc facing the place where its group is honoured,
   * the oldest on your left */
  const groupOut = (g: string) => { const G = riteGroups[g], t = tangent(G.s); return new THREE.Vector3(-t.z * G.side, 0, t.x * G.side); };
  function placeOf(i: number): { pos: THREE.Vector3; look: THREE.Vector3 } {
    const st = riteStations[i];
    if (st.kind === "fire") return { pos: FIRE.clone(), look: at(0) };
    if (st.kind === "you") return { pos: at(LEN).add(tangent(LEN).multiplyScalar(1.6)), look: at(LEN - 4) };
    if (st.group) {
      const members = riteStations.map((x, j) => x.group === st.group ? j : -1).filter(j => j >= 0), k = members.indexOf(i), n = members.length;
      const P = at(riteGroups[st.group].s), out = groupOut(st.group), right = new THREE.Vector3(-out.z, 0, out.x), a = (k - (n - 1) / 2) * (n > 2 ? .6 : .7), r = n > 2 ? 3.7 : 3.1;
      const pos = P.clone().addScaledVector(out, Math.cos(a) * r).addScaledVector(right, Math.sin(a) * r); pos.y = height(pos.x, pos.z); return { pos, look: P };
    }
    return { pos: beside(st.s, st.side, st.off), look: at(st.s) };
  }
  const armillaryAt = at(riteGroups.heavens.s).addScaledVector(groupOut("heavens"), 6.6); armillaryAt.y = height(armillaryAt.x, armillaryAt.z);
  // around each memorial, around each place on the road where you stand to honour one, and around the armillary
  const clear: [number, number, number][] = [[armillaryAt.x, armillaryAt.z, 3]];
  riteStations.forEach((st, i) => { if (st.kind !== "relic" && st.kind !== "stone") return; const q = placeOf(i).pos; clear.push([q.x, q.z, st.id === "painter" ? 5 : 3.2]); if (st.pass) { const r = at(st.s); clear.push([r.x, r.z, 2.6]); } });
  riteStops.forEach(stop => { const q = at(stop.stand); clear.push([q.x, q.z, 3.4]); });
  const land = addRoadside({ scene, height, wind: o.wind, small: o.small, forest: o.forest, rock: o.rock, grass: o.grass, ferns: o.ferns, grasses: o.grasses, clear });
  const air = addAtmosphere({ scene, height, small: o.small });
  const targets: THREE.Object3D[] = [];
  const stone = new THREE.MeshStandardMaterial({ color: 0x6d675d, roughness: 1 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: .95 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb48b52, metalness: .75, roughness: .38 });
  const rockMesh = (scale: THREE.Vector3) => {
    const mesh = o.rock ? new THREE.Mesh(o.rock.geometry, o.rock.material) : new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 3), stone);
    mesh.scale.copy(scale); mesh.castShadow = mesh.receiveShadow = true; return mesh;
  };
  const rockHeight = (() => { if (!o.rock) return 1.1; o.rock.geometry.computeBoundingBox(); return Math.max(.2, o.rock.geometry.boundingBox!.max.y); })();
  const hitbox = (geo: THREE.BufferGeometry, kind: string, station: number) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false })); m.userData = { kind, station }; targets.push(m); return m; };

  // ─── The visible start: an unlit torch planted beside the fire, its head smouldering ───
  const stand = new THREE.Group(); stand.position.set(STAND.x, height(STAND.x, STAND.z), STAND.z); stand.rotation.z = -.1; root.add(stand);
  { const staff = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, 1.45, 8), darkWood); staff.position.y = .72; staff.castShadow = true; stand.add(staff);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(.06, .045, .2, 10), new THREE.MeshStandardMaterial({ color: 0x241810, roughness: 1, emissive: 0x5a1a04, emissiveIntensity: .6 })); head.position.y = 1.5; stand.add(head);
    const hit = hitbox(new THREE.CylinderGeometry(.4, .4, 1.9, 8), "stand", 0); hit.position.y = .9; stand.add(hit); }
  stand.updateMatrixWorld(true);
  const standHead = stand.localToWorld(new THREE.Vector3(0, 1.58, 0));
  const standEmber = glowSprite(glowTexture, 0xff7a2a, .55); standEmber.position.copy(standHead); standEmber.scale.setScalar(.34); root.add(standEmber);
  // once you have come home, the torch you carried burns in its stand
  const standFlame = singleFlame(.22, .34); standFlame.place(standHead.clone().add(new THREE.Vector3(0, -.03, 0))); root.add(standFlame.mesh);
  const standLight = new THREE.PointLight(0xffa052, 0, 7, 2); standLight.position.copy(standHead).add(new THREE.Vector3(0, .3, 0)); root.add(standLight);
  const fireHit = hitbox(new THREE.CylinderGeometry(.5, 1.2, 1.6, 12), "gate", 0); fireHit.position.set(FIRE.x, height(FIRE.x, FIRE.z) + .8, FIRE.z); root.add(fireHit);
  // From far away, home is a warm glow on the horizon.
  const homeGlow = glowSprite(glowTexture, 0xff9a50, 0); homeGlow.position.set(FIRE.x, 13, FIRE.z); homeGlow.scale.setScalar(46); root.add(homeGlow);

  // ─── The threshold: two standing stones where the clearing ends and deep time begins ───
  for (const side of [-1, 1]) { const p = beside(THRESHOLD, side, 1.95), r = rockMesh(new THREE.Vector3(.8, 2.4, .62)); r.position.copy(p).add(new THREE.Vector3(0, -.15, 0)); r.lookAt(at(THRESHOLD).setY(p.y)); r.rotateY(Math.PI / 2); root.add(r); }

  // ─── The torch you carry: your only tool ───
  scene.add(camera);
  const torch = new THREE.Group(); torch.visible = false; camera.add(torch);
  const torchRest = new THREE.Vector3(.34, -.46, -.7), torchRaised = new THREE.Vector3(.16, -.02, -.62), torchOffered = new THREE.Vector3(.08, -.34, -.78);
  const torchFlame = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uTime0: { value: 0 }, uGlobal: { value: 1 }, uWind: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying float vInt; varying float vSeed; void main(){ vUv = uv; vInt = 1.; vSeed = 0.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`, fragmentShader: instancedFire.fragment });
  { const stick = new THREE.Mesh(new THREE.CylinderGeometry(.016, .022, .5, 8), darkWood); stick.position.y = -.2; torch.add(stick);
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(.03, .026, .07, 8), new THREE.MeshStandardMaterial({ color: 0x1a110a, emissive: 0x6a2406, emissiveIntensity: .5, roughness: 1 })); wrap.position.y = .04; torch.add(wrap);
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(.16, .25), torchFlame); flame.position.y = .17; torch.add(flame); }
  const torchLight = new THREE.PointLight(0xffa052, 0, 11, 2); camera.add(torchLight);

  // ─── Those you honour: they gather out of the fire you give them, and leave as the light that becomes their star ───
  const apparitions = createApparitions({ scene, height, small: o.small, pixelRatio });
  void loadShadowArt(Object.keys(shadowSpecs));

  // ─── The places on the road: the fire, the memorials, your stone ───
  type Live = { st: RiteStation; i: number; s: number; pos: THREE.Vector3; group: THREE.Group; done: boolean; doneAt: number; focus: THREE.Vector3; top: number;
    title?: ReturnType<typeof textPlane>; lamp?: number; glow?: THREE.MeshStandardMaterial; paint?: () => void; ghost: THREE.Vector3; presence?: Figure | null;
    update?: (t: number, dt: number) => void; act?: (hit?: THREE.Intersection) => void; reset?: () => void };
  const live: Live[] = riteStations.map((st, i) => {
    const s = st.s, { pos, look } = placeOf(i);
    pos.y = height(pos.x, pos.z);
    const group = new THREE.Group(); group.position.copy(pos); group.lookAt(look.x, pos.y, look.z); root.add(group);
    return { st, i, s, pos, group, done: false, doneAt: -1, focus: pos.clone().add(new THREE.Vector3(0, 1, 0)), top: 1.4, ghost: new THREE.Vector3(0, 0, -1.1) };
  });
  const byId = (id: string) => live.find(L => L.st.id === id)!;
  const figureOf = (L: Live) => resolveFigure(L.st.id, lang);
  /** where each memorial's small fire burns, in the memorial's own frame, and how big */
  const lampSpots: { L?: Live; local: THREE.Vector3; world?: THREE.Vector3; flame: number; pool: number; bowl: boolean; light?: number }[] = [];
  const myHands: THREE.Mesh[] = [];

  // the gravestones: a name, the years, their words
  for (const L of live) {
    const form = stoneForm[L.st.id]; if (L.st.kind !== "stone" || !form) continue;
    const g = gravestone({ ...form, d: .17, seed: L.i * 13 + 5 }); g.mesh.rotation.set(0, (L.i % 3 - 1) * .06, (L.i % 2 ? 1 : -1) * .018); L.group.add(g.mesh);
    const hit = hitbox(new THREE.BoxGeometry(form.w + .3, form.h + .2, .8), "gate", L.i); hit.position.y = form.h / 2; L.group.add(hit);
    L.glow = g.inscription.material; L.top = form.h; L.focus.y = L.pos.y + form.h * .52; L.ghost.set(-(form.w / 2 + .62), 0, -.3);
    L.paint = () => { const f = figureOf(L); if (!f) return; const zh = lang === "zh";
      g.inscription.paint([{ text: f.name, size: zh ? 78 : 58, weight: 700, gap: zh ? 1.45 : 1.25 }, { text: f.life, size: zh ? 30 : 29, weight: 500, gap: 1.55 }, { text: "", size: 34, rule: true, gap: 1.25 },
        ...(f.quote ? [{ text: zh ? `「${f.quote}」` : `“${f.quote}”`, size: zh ? 42 : 37, italic: !zh, weight: 600 }] : [])], { serif: serif() }, g.capFraction, zh); };
    lampSpots.push({ L, local: new THREE.Vector3(form.w * .38, 0, .4), flame: .62, pool: .8, bowl: true, light: .4 }); // a softer light, so the carved face is not washed out
  }
  // the relics of the ages without names
  const relicTitle = (L: Live, y: number) => { const title = textPlane(2.3, .65); title.mesh.position.copy(L.pos).add(new THREE.Vector3(0, y, 0)); title.mesh.renderOrder = 3; root.add(title.mesh); L.title = title; };
  const addRelic = (id: string, relic: Relic) => {
    const L = byId(id); L.group.add(relic.group); L.focus.y = L.pos.y + relic.focus; L.top = relic.hit.y;
    const hit = hitbox(new THREE.BoxGeometry(relic.hit.x, relic.hit.y, relic.hit.z), "gate", L.i); hit.position.y = relic.hit.y / 2; L.group.add(hit);
    lampSpots.push({ L, local: relic.lamp, flame: relic.flame, pool: relic.flame > 1 ? 1.5 : .85, bowl: relic.flame <= 1 });
    relicTitle(L, Math.max(2.3, relic.hit.y + .45));
  };
  /** where their people stand, in each relic's frame: beside it or within it, never hidden behind it */
  const ghostAt: Record<string, [number, number, number]> = { hearth: [0, 0, -1.05], hunt: [0, 0, -.25], painter: [-2.75, 0, .5], needle: [1.4, 0, -.3], farmer: [0, 0, -1.3],
    builder: [0, 0, -.05], ruler: [1.55, 0, -.35], soldier: [0, 0, -1.15], navigator: [0, 0, -1.3], war: [0, 0, -1.8], you: [1.3, 0, .15] };
  addRelic("hearth", hearth(rockMesh));
  addRelic("hunt", hunt(rockMesh));
  addRelic("needle", needle(rockMesh));
  addRelic("builder", doorway(rockMesh));
  addRelic("soldier", wheel());
  addRelic("navigator", anchorRelic());

  // · the rock with the hands: ancestors' hands appear only in your torchlight; then yours, in light
  const ancestorHands: THREE.Mesh[] = [];
  { const L = byId("painter"), rock = rockMesh(new THREE.Vector3(3.8, 3.1, 1.9)); rock.position.set(0, -.2, -.9); L.group.add(rock); rock.userData = { kind: "gate", station: L.i }; targets.push(rock);
    for (const [x, z, k, ry] of [[-3.6, -2.2, 1.6, .4], [3.4, -1.6, 1.1, 1.9], [-1.4, -3.6, 2.2, 2.6], [4.8, -3.8, 1.8, .9], [-5.2, .6, .9, 1.2]]) { const b = rockMesh(new THREE.Vector3(k, k * .7, k * .9)); b.position.set(x, -.12 * k, z); b.rotation.y = ry; L.group.add(b); }
    L.focus.y = L.pos.y + 1.2; L.top = 2.6; L.group.updateMatrixWorld(true); relicTitle(L, 3.3);
    lampSpots.push({ L, local: new THREE.Vector3(-.9, 0, .55), flame: .7, pool: .9, bowl: true });
    const ray = new THREE.Raycaster(), from = at(L.s).setY(at(L.s).y + 1.2), t = tangent(L.s);
    [["168,56,30", -.6, .7], ["132,34,20", .45, 1.35], ["176,72,36", .1, .5], ["214,196,168", -.25, 1.65], ["150,44,24", .7, .85], ["160,52,28", -1.05, 1.15]].forEach(([c, dx, dy], k) => {
      const aim = L.pos.clone().add(new THREE.Vector3(0, Number(dy), 0)).addScaledVector(t, Number(dx)), origin = from.clone().setY(aim.y).addScaledVector(t, Number(dx));
      ray.set(origin, aim.clone().sub(origin).normalize()); const hit = ray.intersectObject(rock)[0];
      if (hit && hit.face) { const d = decal(stencil(String(c), 100 + k, false), hit.point, hit.face.normal.clone().transformDirection(rock.matrixWorld), .55, false); root.add(d); ancestorHands.push(d); }
    });
    L.act = hit => {
      let point = L.focus.clone(), normal = at(L.s).sub(L.pos).setY(0).normalize();
      if (hit && hit.object === rock && hit.face) { point = hit.point.clone(); normal = hit.face.normal.clone().transformDirection(rock.matrixWorld); }
      const hand = decal(stencil("255,196,120", 501, true), point, normal, .72, true); hand.userData.born = time; root.add(hand); myHands.push(hand);
    };
    L.reset = () => { for (const h of myHands.splice(0)) { root.remove(h); (h.material as THREE.Material).dispose(); } }; }

  // · the seed: kneel, press it into the earth, and a field of grain spreads across the open land
  let growWheat = (_age: number) => {};
  { const L = byId("farmer");
    const mound = new THREE.Mesh(new THREE.SphereGeometry(.45, 18, 8), new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 })); mound.scale.y = .2; L.group.add(mound);
    const seed = glowSprite(glowTexture, 0xffd27a, .8, true); seed.position.y = .22; seed.scale.setScalar(.4); L.group.add(seed);
    const quern = rockMesh(new THREE.Vector3(.7, .2, .5)); quern.position.set(.85, -.05, -.2); L.group.add(quern);
    const rubber = rockMesh(new THREE.Vector3(.26, .16, .22)); rubber.position.set(.8, .1, -.2); L.group.add(rubber);
    const hit = hitbox(new THREE.SphereGeometry(.9, 10, 8), "gate", L.i); hit.position.y = .4; L.group.add(hit); L.focus.y = L.pos.y + .2; L.top = .6; relicTitle(L, 2.1);
    lampSpots.push({ L, local: new THREE.Vector3(-.7, 0, .25), flame: .65, pool: .85, bowl: true });
    // A clump of six stalks with ripe ears, cheap enough for thousands. Built a third of its height so the shared
    // grass wind bends the whole stalk; the instance scale stretches it back up.
    const SQUASH = .32;
    const clump = (() => { const pos: number[] = [], col: number[] = [], idx: number[] = [], r = seeded(12);
      const quad = (a: number[], b: number[], c: number[], d: number[], ca: number[], cb: number[]) => { const n = pos.length / 3; pos.push(...a, ...b, ...c, ...d); col.push(...ca, ...ca, ...cb, ...cb); idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); };
      for (let k = 0; k < 6; k++) { const x = (r() - .5) * .32, z = (r() - .5) * .32, h = .8 + r() * .3, lean = (r() - .5) * .08, ry = r() * Math.PI;
        const cx = Math.cos(ry), cz = Math.sin(ry), stem = [.5, .5, .26], straw = [.86, .7, .38], ripe = [.98, .78, .38], tip = [1, .9, .58];
        const P = (u: number, w: number, ax: number, az: number) => [x + lean * u * u - ax * w, h * u * SQUASH, z - az * w];
        for (const [ax, az] of [[cx, cz], [-cz, cx]]) {
          quad(P(0, .005, ax, az), P(0, -.005, ax, az), P(.76, .004, ax, az), P(.76, -.004, ax, az), stem, straw);
          quad(P(.76, .009, ax, az), P(.76, -.009, ax, az), P(.88, .016, ax, az), P(.88, -.016, ax, az), ripe, ripe);
          quad(P(.88, .016, ax, az), P(.88, -.016, ax, az), P(1, .003, ax, az), P(1, -.003, ax, az), ripe, tip);
        } }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: THREE.DoubleSide, emissive: 0x7a5414, emissiveIntensity: .55 });
    const count = o.small ? 3200 : 7000, field = new THREE.InstancedMesh(clump, material, count), r = seeded(7), plants: { x: number; z: number; y: number; r: number; h: number; ry: number }[] = [];
    const road = at(L.s);
    for (let k = 0; k < count; k++) { let x = 0, z = 0, rad = 0, tries = 0;
      do { const a = r() * Math.PI * 2; rad = .9 + Math.sqrt(r()) * 28; x = L.pos.x + Math.cos(a) * rad; z = L.pos.z + Math.sin(a) * rad * .8; } while (++tries < 12 && (Math.abs((x - road.x) * tangent(L.s).z - (z - road.z) * tangent(L.s).x) < 1.5));
      plants.push({ x, z, y: height(x, z) - .02, r: rad, h: (.85 + r() * .4) * (1 - sm(22, 29, rad) * .5), ry: r() * 6.28 }); }
    const m = new THREE.Object3D();
    growWheat = (age: number) => { plants.forEach((p, k) => { const g = sm(0, 1, (age - p.r * .32) / 2.6); m.position.set(p.x, p.y, p.z); m.rotation.set(0, p.ry, 0); m.scale.set(1, Math.max(.001, g * p.h / SQUASH), 1); m.updateMatrix(); field.setMatrixAt(k, m.matrix); }); field.instanceMatrix.needsUpdate = true; };
    growWheat(0); field.receiveShadow = true; o.wind.install(field, "grass"); field.computeBoundingSphere(); root.add(field);
    let grown = 0;
    L.update = t => { seed.material.opacity = L.done ? Math.max(0, 1 - (t - L.doneAt)) : .55 + .35 * Math.sin(t * 3);
      if (!L.done || grown >= 1) return; const age = t - L.doneAt; grown = sm(0, 1, (age - 12) / 1); growWheat(age); };
    L.reset = () => { grown = 0; growWheat(0); }; }

  // · the throne, among the low walls of the first cities; on its seat a clay tablet nobody can read any more
  { const W = 300, H = 410, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!, tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const r = seeded(55), rows = Array.from({ length: 5 }, () => Array.from({ length: 4 }, () => String.fromCodePoint(0x12000 + Math.floor(r() * 0x300))));
    const paintTablet = () => {
      const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, "#b38f64"); grd.addColorStop(1, "#8f6c48"); g.fillStyle = grd; g.fillRect(0, 0, W, H);
      const rr = seeded(3); for (let i = 0; i < 2000; i++) { g.fillStyle = rr() > .5 ? "rgba(255,240,215,.05)" : "rgba(40,24,12,.06)"; g.fillRect(rr() * W, rr() * H, 2, 2); }
      g.font = '46px "Noto Sans Cuneiform"'; g.textAlign = "center"; g.textBaseline = "middle";
      rows.forEach((row, y) => { row.forEach((ch, x) => { const X = 50 + x * 66, Y = 50 + y * 76; g.fillStyle = "rgba(255,236,208,.3)"; g.fillText(ch, X + 2, Y + 2); g.fillStyle = "rgba(58,36,20,.9)"; g.fillText(ch, X, Y); }); g.fillStyle = "rgba(60,40,24,.35)"; g.fillRect(20, 50 + y * 76 + 36, W - 40, 2); });
      tex.needsUpdate = true;
    };
    paintTablet(); document.fonts?.load('46px "Noto Sans Cuneiform"', "\u{12000}").then(paintTablet).catch(() => {});
    addRelic("ruler", throne(new THREE.MeshStandardMaterial({ map: tex, roughness: .95 })));
    const L = byId("ruler"), brick = new THREE.MeshStandardMaterial({ color: 0x6e5a44, roughness: 1 }); void brick;
    for (const [x, z, w, h, ry] of [[-3.2, -2.6, 3.4, .9, .1], [2.9, -3.2, 2.6, .6, -.15], [-4.6, .6, 2.2, .5, 1.45], [4.4, -.2, 1.8, 1.1, 1.62], [.2, -5.4, 4.2, .4, .04]]) {
      // the footing of a wall that fell long ago: a line of worn stones, some still stacked
      const along = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry)), count = Math.max(2, Math.round(w / .55)), wr = seeded(Math.round(x * 31 + z * 7));
      for (let k = 0; k < count; k++) for (let layer = 0; layer < (h > .7 && wr() > .4 ? 2 : 1); layer++) {
        const sz = .42 + wr() * .22, st = rockMesh(new THREE.Vector3(sz, sz * .55, sz * .8)), p = along.clone().multiplyScalar((k / (count - 1) - .5) * w);
        st.position.set(x + p.x + (wr() - .5) * .12, -.1 + layer * sz * .4, z + p.z + (wr() - .5) * .12); st.rotation.set((wr() - .5) * .2, ry + (wr() - .5) * .6, (wr() - .5) * .2); L.group.add(st); } } }

  // · behind the astronomers, an armillary on its platform: once you have honoured him, its loops relax into orbits round the Sun
  let armK = 0;
  { const L = byId("copernicus"), base = new THREE.Group(), centre = at(riteGroups.heavens.s); base.position.copy(armillaryAt); base.lookAt(centre.x, armillaryAt.y, centre.z); root.add(base);
    const arm = new THREE.Group(); arm.position.y = 2.05; base.add(arm);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, .35, 28), stone); platform.position.y = .05; platform.receiveShadow = platform.castShadow = true; base.add(platform);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, 1.5, 10), darkWood); post.position.y = .95; post.castShadow = true; base.add(post);
    const rings = [[0, 0], [1.2, .3], [.4, 1.1]].map(([rx, ry]) => { const t = new THREE.Mesh(new THREE.TorusGeometry(.9, .012, 6, 96), brass); t.rotation.set(rx, ry, 0); t.castShadow = true; arm.add(t); return t; });
    const sun = glowSprite(glowTexture, 0xffc070, 1, true); sun.scale.setScalar(.4); arm.add(sun);
    const planets = [[.387, 0xbfae9a, .025], [.723, 0xecd6a8, .032], [1, 0x78aaee, .036], [1.524, 0xe07a5a, .028], [5.2, 0xdcc08e, .055]].map(([a, c, r], k) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: c })); arm.add(s);
      const trail = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(120 * 3), 3)), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }));
      trail.frustumCulled = false; arm.add(trail); return { a, s, trail, ph: k * 1.3 };
    });
    const P = (q: { a: number; ph: number }, Y: number) => { const an = q.ph + Math.PI * 2 * Y / Math.pow(q.a, 1.5), r = Math.sqrt(q.a) * .33; return new THREE.Vector3(Math.cos(an) * r, 0, -Math.sin(an) * r); };
    const near = new THREE.Vector3();
    L.update = (t, dt) => {
      armK = L.done ? sm(0, 1, (t - L.doneAt - 1.5) / 3) : 0;
      if (near.copy(base.position).distanceTo(camera.position) > 60) return;
      const k = armK, Y = t * .22, E = (y: number) => P(planets[2], y);
      rings.forEach((ring, j) => { ring.rotation.z += dt * (.05 + j * .03) * (1 + (k > 0 && k < 1 ? 6 : 0)); });
      sun.position.copy(E(Y)).multiplyScalar(-(1 - k));
      for (const q of planets) { q.s.position.copy(P(q, Y).sub(E(Y).multiplyScalar(1 - k))); const a = q.trail.geometry.attributes.position as THREE.BufferAttribute;
        for (let j = 0; j < 120; j++) { const y = Y - j / 120 * THREE.MathUtils.lerp(2.4, Math.min(2.4, Math.pow(q.a, 1.5) * .95), k); const v = P(q, y).sub(E(y).multiplyScalar(1 - k)); a.setXYZ(j, v.x, v.y, v.z); }
        a.needsUpdate = true; } }; }

  // · ashes: the burnt country, falling cinders, a candle you can light only by giving your flame away
  const ash = (() => { const n = o.small ? 160 : 320, pos = new Float32Array(n * 3), seeds = Array.from({ length: n }, (_, i) => [seeded(i + 3)(), seeded(i + 900)(), seeded(i + 77)()]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xff8a50, size: .045, map: glowTexture, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; root.add(pts);
    return { pts, seeds, pos }; })();
  const warL = byId("war");
  { const L = warL, burnt = new THREE.MeshStandardMaterial({ color: 0x24201d, roughness: 1 });
    // a fallen house: blackened stones heaped where its walls stood, and two charred beams
    const char = o.rock ? (Array.isArray(o.rock.material) ? o.rock.material[0] : o.rock.material).clone() as THREE.MeshStandardMaterial : burnt; if (char !== burnt) char.color.multiplyScalar(.28);
    { const rr = seeded(1939); for (let k = 0; k < 16; k++) { const sz = .3 + rr() * .5, st = rockMesh(new THREE.Vector3(sz, sz * .6, sz * .85)); st.material = char; st.position.set(-2.4 + rr() * 4.8, -.08 + (rr() > .7 ? .2 : 0), -1.4 + rr() * 1.1); st.rotation.set(rr() - .5, rr() * 6, rr() - .5); L.group.add(st); } }
    for (const [x, rz, len] of [[-1.2, .5, 2.4], [1.1, -.9, 1.9]]) { const beam = new THREE.Mesh(new THREE.BoxGeometry(len, .16, .18), burnt); beam.position.set(x, .35, -1); beam.rotation.set(.1, .3, rz); beam.castShadow = true; L.group.add(beam); }
    const block = rockMesh(new THREE.Vector3(.7, .7, .7)); block.position.set(0, 0, .2); L.group.add(block);
    block.geometry.computeBoundingBox(); const top = (block.geometry.boundingBox?.max.y ?? .7) * block.scale.y - .02;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .3, 12), new THREE.MeshStandardMaterial({ color: 0xe9dfca, roughness: .6, emissive: 0x6a4410, emissiveIntensity: 0 })); candle.position.set(0, top + .15, .2); L.group.add(candle);
    const hit = hitbox(new THREE.SphereGeometry(.7, 10, 8), "gate", L.i); hit.position.set(0, top + .2, .2); L.group.add(hit); L.focus.copy(L.pos).add(new THREE.Vector3(0, top + .25, 0)); L.top = top + .4; relicTitle(L, 2.3);
    lampSpots.push({ L, local: new THREE.Vector3(0, top + .3, .2), flame: .34, pool: .6, bowl: false });
    L.update = t => { candle.material.emissiveIntensity = L.done ? sm(0, 1, (t - L.doneAt) / 1.5) * .7 : 0; }; }

  // · the end of the road: a tall stone on the crest with nothing on it yet; your name will be carved there
  const youL = byId("you");
  const monument = gravestone({ w: 1.15, h: 2.35, d: .34, top: "rough", seed: 2026, tint: 0xe6ddd0 });
  youL.group.add(monument.mesh); youL.glow = monument.inscription.material; youL.top = 2.35; youL.focus.y = youL.pos.y + 1.35;
  { const hit = hitbox(new THREE.BoxGeometry(1.5, 2.5, 1), "gate", youL.i); hit.position.y = 1.2; youL.group.add(hit); }
  let carved = -1, carveAt = -1, carvedName = "", carvedDate = "";
  const today = () => new Date().toISOString().slice(0, 10);
  const dateText = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return lang === "zh" ? `${y} 年 ${m} 月 ${d} 日` : `${d} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`; };
  /** carve the first `chars` letters of the name; one more step adds the date and the words beneath */
  function paintMonument(chars: number) {
    carved = chars; const zh = lang === "zh", nameText = carvedName || riteUi.anyone[lang], letters = [...nameText], all = chars > letters.length;
    const rows = chars <= 0 ? [] : [{ text: letters.slice(0, chars).join(""), size: zh ? (letters.length > 6 ? 62 : 84) : 64, weight: 600, gap: 1.5 },
      ...(all ? [{ text: dateText(carvedDate || today()), size: 24, gap: 1.6 }, { text: "", size: 30, rule: true, gap: 1.4 }, { text: riteUi.legacy[lang], size: zh ? 36 : 32, italic: !zh, weight: 600 }] : [])];
    monument.inscription.paint(rows, { serif: serif() }, monument.capFraction + .06, zh);
  }
  youL.paint = () => paintMonument(carved < 0 ? 0 : carved);
  youL.reset = () => { carveAt = -1; carvedName = ""; paintMonument(0); };
  // behind it a beacon you can see from far off, and the fire that is lit once your name is carved
  const crestAt = youL.pos.clone().add(tangent(LEN).multiplyScalar(1.5)); crestAt.y = height(crestAt.x, crestAt.z) + .05;
  const beacon = glowSprite(glowTexture, 0xff8a40, .5); beacon.position.copy(crestAt).add(new THREE.Vector3(0, .9, 0)); beacon.scale.setScalar(1.6); root.add(beacon);
  const crestFire = singleFlame(.75, 1.25); crestFire.place(crestAt); root.add(crestFire.mesh);
  const crestLight = new THREE.PointLight(0xffa052, 0, 22, 2); crestLight.position.copy(crestAt).add(new THREE.Vector3(0, 1.4, 0)); root.add(crestLight);

  // ─── Countless others: the stones of those no one remembers by name, few in deep time, more with every age ───
  // here and there someone has left a candle burning in front of one, so the road is never wholly dark
  const strays: THREE.Vector3[] = [];
  { const r = seeded(4242), rough: Placement[] = [], steles: Placement[][] = [[], [], []], tops: Top[] = ["round", "flat", "peak"];
    const keep = live.filter(L => L.st.kind !== "fire").map(L => L.pos);
    const clear = (x: number, z: number, near: number) => distToWalk(x, z) > near && keep.every(p => Math.hypot(p.x - x, p.z - z) > (p === youL.pos ? 7 : 4.5));
    const density = (s: number) => s < 60 ? .01 : s < zones.ash[0] ? .015 + .05 * sm(60, zones.ash[0], s) : s < zones.ash[1] ? .03 : .1 + .45 * sm(zones.ash[1], LEN - 20, s);
    for (let s = THRESHOLD + 12; s < LEN + 26; s += o.small ? .9 : .5) for (const side of [-1, 1]) {
      const late = sm(zones.ash[1], LEN, s), off = 3.2 + Math.pow(r(), .9 + late * .6) * (36 - late * 8), [x, z] = [beside(Math.min(s, LEN), side, off)].map(p => [p.x, p.z])[0];
      const patch = .5 + .5 * Math.sin(x * .11 + Math.sin(z * .07) * 2.4) * Math.sin(z * .13 - x * .05);
      if (r() > density(s) * (.3 + 1.4 * patch) || !clear(x, z, 3)) continue;
      const tall = .55 + r() * .55;
      if (s < 230 && r() < .8) rough.push({ x, z, s, scale: [(.28 + r() * .2) / 1, tall / rockHeight, .24 + r() * .14], ry: r() * 6.28, rz: (r() - .5) * .2, sink: .1 });
      else { if (s > 50 && off < 16 && r() < (o.small ? .1 : .2)) { const toRoad = at(s).sub(new THREE.Vector3(x, 0, z)).setY(0).normalize(); strays.push(new THREE.Vector3(x + toRoad.x * .32, 0, z + toRoad.z * .32)); }
        steles[Math.floor(r() * 3)].push({ x, z, s, scale: [.75 + r() * .5, tall * (.8 + r() * .5), 1], ry: Math.atan2(-(x - at(s).x), -(z - at(s).z)) + (r() - .5) * .9, rx: (r() - .5) * .12, rz: (r() - .5) * .16, sink: .08, color: new THREE.Color().setScalar(.62 + r() * .3) }); }
    }
    // after the wars, row on row of small stones on the far side of the road
    const rows = o.small ? 5 : 8;
    for (let s = zones.ash[0] + 8; s < zones.ash[1] - 6; s += 1.75) for (let row = 0; row < rows; row++) {
      if (r() < .14) continue;
      const p = beside(s, -warL.st.side, 6.5 + row * 2.3); if (!clear(p.x, p.z, 4)) continue;
      steles[1].push({ x: p.x, z: p.z, s, scale: [.55, .5 + r() * .06, .9], ry: Math.atan2(tangent(s).x, tangent(s).z) + Math.PI / 2 * -warL.st.side + (r() - .5) * .05, rz: (r() - .5) * .05, sink: .06, color: new THREE.Color().setScalar(.55 + r() * .12) });
    }
    if (o.rock && rough.length) land.instance([o.rock], rough, 220, { shadow: true });
    const unnamed = stoneMaterial(0xc9c1b4);
    steles.forEach((list, k) => { if (list.length) land.instance([{ geometry: steleGeometry(.5, 1, .14, tops[k], 70 + k, .4), material: unnamed }], list, 200, { shadow: true }); }); }

  // ─── The small fires: one at each memorial, burning low until you honour it; and the candles others left ───
  for (const L of live) { L.group.updateMatrixWorld(true); const g = ghostAt[L.st.id]; if (g) L.ghost.set(...g); L.ghost = L.group.localToWorld(L.ghost.clone()); L.ghost.y = height(L.ghost.x, L.ghost.z); }
  const LOW = .48; // a memorial's fire before you come: someone has kept it burning
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: .6, emissive: 0x6a4410, emissiveIntensity: .35 });
  for (const w of strays.slice(0, o.small ? 8 : 16)) lampSpots.push({ world: w, local: new THREE.Vector3(), flame: .3, pool: .45, bowl: false, light: .5 });
  type Lamp = { L?: Live; top: THREE.Vector3; lit: number; want: number };
  const lamps: Lamp[] = lampSpots.map(spot => {
    const top = spot.world ? spot.world.clone() : spot.L!.group.localToWorld(spot.local.clone()); if (spot.world || spot.local.y < .05) top.y = height(top.x, top.z) + .02;
    if (spot.bowl) { const b = bowl(); b.position.copy(top).add(new THREE.Vector3(0, -.03, 0)); root.add(b); top.y += .07; }
    if (spot.world) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.024, .028, .13, 10).translate(0, .065, 0), candleMat); c.position.copy(top).add(new THREE.Vector3(0, -.03, 0)); root.add(c); top.y += .11; }
    const base = spot.L ? LOW : .5;
    return { L: spot.L, top, lit: base, want: base };
  });
  lamps.forEach((lamp, k) => { if (lamp.L) lamp.L.lamp = k; });
  const N = lamps.length;
  const flameGeo = new THREE.InstancedBufferGeometry();
  { const plane = new THREE.PlaneGeometry(.34, .52).translate(0, .26, 0); flameGeo.index = plane.index; flameGeo.setAttribute("position", plane.attributes.position); flameGeo.setAttribute("uv", plane.attributes.uv); }
  const iPos = new Float32Array(N * 3), iLit = new Float32Array(N), iSeed = new Float32Array(N);
  lamps.forEach((c, i) => { iPos.set([c.top.x, c.top.y, c.top.z], i * 3); iSeed[i] = (i * 7.31) % 13; });
  const litAttr = new THREE.InstancedBufferAttribute(iLit, 1);
  flameGeo.setAttribute("iPos", new THREE.InstancedBufferAttribute(iPos, 3)); flameGeo.setAttribute("iLit", litAttr); flameGeo.setAttribute("iSeed", new THREE.InstancedBufferAttribute(iSeed, 1)); flameGeo.setAttribute("iScale", new THREE.InstancedBufferAttribute(new Float32Array(lampSpots.map(x => x.flame)), 1)); flameGeo.instanceCount = N;
  const lampFlame = flameMaterial(), flames = new THREE.Mesh(flameGeo, lampFlame); flames.frustumCulled = false; root.add(flames);
  // Seen from far away, each lit memorial is a point of fire that never shrinks below a few pixels; home is the brightest.
  const glowPos = new Float32Array((N + 1) * 3), glowLit = new Float32Array(N + 1), glowSize = new Float32Array(N + 1);
  lamps.forEach((c, i) => { glowPos.set([c.top.x, c.top.y + .2, c.top.z], i * 3); glowSize[i] = Math.min(1.4, .6 + lampSpots[i].flame * .6); });
  glowPos.set([FIRE.x, height(FIRE.x, FIRE.z) + .9, FIRE.z], N * 3); glowSize[N] = 2.4;
  const glowGeo = new THREE.BufferGeometry(); glowGeo.setAttribute("position", new THREE.BufferAttribute(glowPos, 3));
  const glowLitAttr = new THREE.BufferAttribute(glowLit, 1); glowGeo.setAttribute("lit", glowLitAttr); glowGeo.setAttribute("size", new THREE.BufferAttribute(glowSize, 1));
  const glowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uMap: { value: glowTexture }, uPx: { value: pixelRatio }, uDim: { value: 0 }, uHome: { value: 0 } },
    vertexShader: `attribute float lit; attribute float size; uniform float uPx; uniform float uDim; uniform float uHome; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; float d = max(.1, -mv.z);
        float home = step(2., size); vA = mix(lit, uHome, home) * (1. - uDim * .6) * mix(.22, 1., smoothstep(14., 90., d));
        gl_PointSize = uPx * max(2.6 * size, size * 110. / d); }`,
    fragmentShader: `uniform sampler2D uMap; varying float vA; void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; if (a < .004) discard; gl_FragColor = vec4(1., .58, .25, a); }` });
  const glowPoints = new THREE.Points(glowGeo, glowMat); glowPoints.frustumCulled = false; root.add(glowPoints);
  const pool = canvasTexture(128, 128, g => { const r = seeded(4); for (let i = 0; i < 26; i++) { const x = 64 + (r() - .5) * 46, y = 64 + (r() - .5) * 40, rad = 18 + r() * 34, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, "rgba(255,255,255,.14)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    const fade = g.createRadialGradient(64, 64, 20, 64, 64, 64); fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,1)"); g.globalCompositeOperation = "destination-out"; g.fillStyle = fade; g.fillRect(0, 0, 128, 128); });
  // each fire's pool of light on the ground follows the ground, so no part of it sinks out of sight on a slope
  const POOL = 8, poolVerts = (POOL + 1) * (POOL + 1);
  const poolGeo = (() => { const pos: number[] = [], uv: number[] = [], index: number[] = [];
    lamps.forEach((c, i) => { const size = 5 * lampSpots[i].pool, a = i * 2.1, ca = Math.cos(a), sa = Math.sin(a), base = i * poolVerts;
      for (let gz = 0; gz <= POOL; gz++) for (let gx = 0; gx <= POOL; gx++) { const u = (gx / POOL - .5) * size, v = (gz / POOL - .5) * size, x = c.top.x + u * ca - v * sa, z = c.top.z + u * sa + v * ca;
        pos.push(x, height(x, z) + .045, z); uv.push(gx / POOL, gz / POOL); }
      for (let gz = 0; gz < POOL; gz++) for (let gx = 0; gx < POOL; gx++) { const k = base + gz * (POOL + 1) + gx; index.push(k, k + POOL + 1, k + 1, k + 1, k + POOL + 1, k + POOL + 2); } });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3)); g.setIndex(index); return g; })();
  const poolColor = poolGeo.attributes.color as THREE.BufferAttribute;
  const groundGlow = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({ map: pool, color: 0xff9248, vertexColors: true, transparent: true, opacity: .38, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  const placeGlow = (i: number) => { const k = sm(0, 1, lamps[i].lit); for (let v = 0; v < poolVerts; v++) poolColor.setXYZ(i * poolVerts + v, k, k, k); };
  groundGlow.frustumCulled = false; root.add(groundGlow);
  const lights = Array.from({ length: o.small ? 2 : 4 }, () => { const l = new THREE.PointLight(0xffa052, 0, 9, 2); root.add(l); return l; });
  let dirty = false;
  /** set the memorials' fires (the candles others left keep burning as they are) */
  function setLamps(value: number) { lamps.forEach((c, i) => { if (c.L) c.lit = c.want = value; iLit[i] = glowLit[i] = c.lit; placeGlow(i); }); litAttr.needsUpdate = glowLitAttr.needsUpdate = poolColor.needsUpdate = true; }
  setLamps(LOW);

  // ─── What others have left: flowers at every memorial, pebbles on the gravestones ───
  { const palettes: [number, number, number][] = [[.96, .94, .88], [.98, .84, .4], [.8, .22, .24], [.68, .52, .9], [.94, .62, .7]];
    const geos = palettes.map((c, k) => flowerBunch(c, 40 + k * 7)), fmat = flowerMaterial(), lists: THREE.Matrix4[][] = geos.map(() => []), pebbles: THREE.Matrix4[] = [];
    const m = new THREE.Object3D(), r = seeded(977), put = (L: Live, local: THREE.Vector3, ground: boolean) => { const w = L.group.localToWorld(local.clone()); if (ground) w.y = height(w.x, w.z) - .01; return w; };
    for (const L of live) {
      if (L.st.kind !== "relic" && L.st.kind !== "stone") continue;
      const form = stoneForm[L.st.id], wide = form ? form.w / 2 + .15 : 1, palette = Math.floor(r() * geos.length);
      for (let k = 0, n = 2 + Math.floor(r() * 3); k < n; k++) {
        const local = new THREE.Vector3((r() - .5) * wide * 2, 0, (form ? .14 : .35) + r() * .45);
        if (form && local.x > form.w * .2 && local.z < .6) local.x -= form.w * .55; // not in the bowl
        m.position.copy(put(L, local, true)); m.rotation.set(0, r() * 6.28, 0); m.scale.setScalar(.85 + r() * .5); m.updateMatrix(); lists[(palette + (k % 2)) % geos.length].push(m.matrix.clone());
      }
      for (let k = 0, n = 3 + Math.floor(r() * 4); k < n; k++) { const sz = .028 + r() * .03; m.position.copy(put(L, new THREE.Vector3((r() - .5) * wide * 1.6, 0, .1 + r() * .5), true)).add(new THREE.Vector3(0, sz * .3, 0)); m.rotation.set(0, r() * 6.28, 0); m.scale.set(sz * 1.2, sz, sz); m.updateMatrix(); pebbles.push(m.matrix.clone()); }
      if (form && form.top === "flat") for (let k = 0, n = 2 + Math.floor(r() * 3); k < n; k++) { const sz = .026 + r() * .02; m.position.copy(put(L, new THREE.Vector3((r() - .5) * form.w * .7, form.h - .135 + sz * .3, (r() - .5) * .06), false)); m.rotation.set(0, r() * 6.28, 0); m.scale.set(sz * 1.2, sz, sz); m.updateMatrix(); pebbles.push(m.matrix.clone()); }
    }
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[]) => { if (!list.length) return; const mesh = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((x, k) => mesh.setMatrixAt(k, x)); mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh); };
    geos.forEach((geo, k) => add(geo, fmat, lists[k]));
    add(pebbleGeometry(), stoneMaterial(0xd8d2c6), pebbles); }

  // ─── Embers rising from the fires near you; fireflies over the fields ───
  const motes = (count: number, size: number) => { const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3)); geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: glowTexture, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; root.add(pts); return pts; };
  const embers = motes(o.small ? 40 : 90, .06), emberState = Array.from({ length: (embers.geometry.attributes.position as THREE.BufferAttribute).count }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 9, life: 1 }));
  const flies = motes(o.small ? 24 : 48, .09), flySeed = Array.from({ length: (flies.geometry.attributes.position as THREE.BufferAttribute).count }, (_, i) => [seeded(i + 5)(), seeded(i + 55)(), seeded(i + 555)()]);
  const flyHome = new THREE.Vector3(); let flyAmount = 0;

  // ─── The walk's stars: one constellation, the Torchbearer, fixed in the turning sky ───
  // Each memorial's light rises into its star; a ribbon of light joins it to those already lit; at the end your star is the flame.
  const flareTex = canvasTexture(128, 128, g => { const gr = g.createLinearGradient(0, 64, 128, 64); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(.5, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 62, 128, 4); g.save(); g.translate(64, 64); g.rotate(Math.PI / 2); g.translate(-64, -64); g.fillRect(0, 63, 128, 2.4); g.restore(); });
  const ribbonTex = canvasTexture(64, 4, g => { const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(.5, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 4); });
  const skyGroup = o.civ.group, R = 1850;
  type Star = { ref: string; station: number; core: THREE.Sprite; halo: THREE.Sprite; flare: THREE.Sprite; hit: THREE.Mesh; metAt: number };
  const stars: Star[] = [];
  const layout = new Map<string, THREE.Vector3>();
  /** Lay the figure out in the sky's own frame so that, at the moment the walk begins, it stands ahead of you and a
   * little to the right; the sky's turning then carries it across the road ahead over the length of the walk. */
  function anchor() {
    const theta = skyGroup.rotation.y, el = THREE.MathUtils.degToRad(33), toSky = new THREE.Matrix4().makeRotationY(-theta);
    const moon = o.moon ? o.moon.position.clone().normalize() : null, centre = (offset: number) => { const a = Math.atan2(AXIS.dz, AXIS.dx) + THREE.MathUtils.degToRad(offset); return new THREE.Vector3(Math.cos(el) * Math.cos(a), Math.sin(el), Math.cos(el) * Math.sin(a)); };
    const offset = [32, 20, 44, 8, 56, -6, 68, -20].find(d => !moon || centre(d).applyMatrix4(toSky).angleTo(moon) > THREE.MathUtils.degToRad(46)) ?? 32;
    const az = Math.atan2(AXIS.dz, AXIS.dx) + THREE.MathUtils.degToRad(offset), C = centre(offset), SCALE = .62;
    const left = new THREE.Vector3(Math.sin(az), 0, -Math.cos(az)), up = new THREE.Vector3(0, 1, 0).addScaledVector(C, -C.y).normalize();
    for (const [ref, [u, v]] of Object.entries(torchbearer.points)) layout.set(ref, C.clone().addScaledVector(left, Math.tan(THREE.MathUtils.degToRad(u * SCALE))).addScaledVector(up, Math.tan(THREE.MathUtils.degToRad((v - 40) * SCALE))).normalize().applyMatrix4(toSky));
    for (const x of stars) { const p = layout.get(x.ref)!.clone().multiplyScalar(R); x.core.position.copy(p); x.halo.position.copy(p); x.flare.position.copy(p); x.hit.position.copy(p); }
  }
  const skyPoint = (ref: string) => { skyGroup.updateMatrixWorld(); return skyGroup.localToWorld(layout.get(ref)!.clone().multiplyScalar(R)); };
  const starWorld = (i: number) => skyPoint(stars[i].ref);
  live.forEach(L => L.st.figures.forEach(ref => {
    const halo = glowSprite(glowTexture, 0xffe6bf, 0); skyGroup.add(halo);
    const flare = glowSprite(flareTex, 0xfff1d6, 0); skyGroup.add(flare);
    const core = glowSprite(glowTexture, 0xfff6e6, 0); skyGroup.add(core);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(R * .024, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.userData = { kind: "star", station: L.i, index: stars.length }; targets.push(hit); skyGroup.add(hit);
    stars.push({ ref, station: L.i, core, halo, flare, hit, metAt: -1 });
  }));
  // ribbons of light between the people, drawn from whoever was lit first to whoever has just been lit
  const edges = torchbearer.edges.map(([a, b]) => ({ a, b, from: a, p: 0 }));
  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edges.length * 12), 3));
  ribbonGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(edges.length * 12), 3));
  ribbonGeo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(edges.flatMap(() => [0, 0, 1, 0, 0, 1, 1, 1])), 2));
  ribbonGeo.setIndex(edges.flatMap((_, i) => [i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2]));
  const ribbons = new THREE.Mesh(ribbonGeo, new THREE.MeshBasicMaterial({ map: ribbonTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
  ribbons.frustumCulled = false; skyGroup.add(ribbons);
  const isLit = (ref: string) => ref === "you" ? mineAt >= 0 && time - mineAt > 6.6 || mineRemembered : stars.find(x => x.ref === ref)!.metAt > -1;
  const litAt = (ref: string) => ref === "you" ? (mineRemembered ? -1000 : mineAt + 6.6) : stars.find(x => x.ref === ref)!.metAt;
  let figureGlow = 0, mineRemembered = false, ribbonFade = 1;
  function rebuildConstellation() {
    for (const e of edges) {
      if (!isLit(e.a) || !isLit(e.b)) { e.p = 0; continue; }
      if (e.p === 0) { e.from = litAt(e.a) <= litAt(e.b) ? e.a : e.b; e.p = Math.min(litAt(e.a), litAt(e.b)) < -100 && Math.max(litAt(e.a), litAt(e.b)) < -100 ? 1 : .001; }
    }
  }
  function drawRibbons(dt: number, dim: number) {
    const pos = ribbonGeo.attributes.position as THREE.BufferAttribute, col = ribbonGeo.attributes.color as THREE.BufferAttribute, half = R * .0007 * (1 + figureGlow * .3);
    edges.forEach((e, i) => {
      if (e.p > 0 && e.p < 1) e.p = Math.min(1, e.p + dt / 1.8);
      const A = layout.get(e.from)!.clone().multiplyScalar(R), B = layout.get(e.from === e.a ? e.b : e.a)!.clone().multiplyScalar(R), end = A.clone().lerp(B, sm(0, 1, e.p));
      const side = new THREE.Vector3().crossVectors(B.clone().sub(A), A.clone().add(B)).normalize().multiplyScalar(half);
      [A.clone().sub(side), A.clone().add(side), end.clone().sub(side), end.clone().add(side)].forEach((v, k) => pos.setXYZ(i * 4 + k, v.x, v.y, v.z));
      const a = (e.p > 0 ? .3 + .35 * figureGlow : 0) * (1 - dim) * ribbonFade, warm = e.a === "you" || e.b === "you" ? 1 : 0;
      for (let k = 0; k < 4; k++) col.setXYZ(i * 4 + k, a * 1, a * (.84 - warm * .14), a * (.62 - warm * .22));
    });
    pos.needsUpdate = col.needsUpdate = true;
  }

  // ─── Your star: it rises from your stone on the crest and becomes the flame the Torchbearer holds up ───
  const mine = glowSprite(glowTexture, 0xffc070, 0), mineHalo = glowSprite(glowTexture, 0xffb060, 0); mine.renderOrder = 2; skyGroup.add(mine, mineHalo);
  const mineHit = new THREE.Mesh(new THREE.SphereGeometry(R * .026, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); mineHit.userData = { kind: "mine" }; mineHit.visible = false; skyGroup.add(mineHit);
  const altarTop = youL.pos.clone().add(new THREE.Vector3(0, 2.45, 0));
  const homeward = FIRE.clone().sub(youL.pos).setY(0).normalize();
  const mineTarget = () => skyPoint("you");
  const mineWorld = new THREE.Vector3();
  function placeMine(world: THREE.Vector3, k: number) {
    mineWorld.copy(world); skyGroup.updateMatrixWorld(); const local = skyGroup.worldToLocal(world.clone()), d = world.distanceTo(camera.position);
    mine.position.copy(local); mineHalo.position.copy(local); mineHit.position.copy(local);
    mine.scale.setScalar(THREE.MathUtils.lerp(.9, d * .016, k)); mineHalo.scale.setScalar(THREE.MathUtils.lerp(3, d * .07, k));
  }
  anchor();
  const trail = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  trail.frustumCulled = false; root.add(trail);
  // their light: once their shadows have turned, a light lifts from the memorial, slowly, then all at once into its star
  type Ascent = { sprite: THREE.Sprite; tail: THREE.Sprite[]; path: THREE.Vector3[]; from: THREE.Vector3; k: number; t0: number; dur: number };
  const ascents: Ascent[] = [];
  const ascentAt = new THREE.Vector3();
  function ascend(from: THREE.Vector3, k: number) {
    const sprite = glowSprite(glowTexture, 0xffe2b0, 1); sprite.renderOrder = 4; root.add(sprite);
    const tail = Array.from({ length: 22 }, () => { const sp = glowSprite(glowTexture, 0xffbe78, 0); root.add(sp); return sp; });
    ascents.push({ sprite, tail, path: [], from: from.clone(), k, t0: time, dur: 3.1 }); sound.bell(67 + (k % 5) * 2, .03);
  }

  // ─── The shared sky: the 45 civilization stars wake in the order history wrote them ───
  const civGeo = o.civ.points.geometry, civCount = civGeo.attributes.position.count;
  const civGlow = new THREE.BufferAttribute(new Float32Array(civCount), 1); civGeo.setAttribute("glow", civGlow);
  const civOrder = chronologicalSky();
  let civWoken = 0;
  // as each shared star wakes, a streak of its light travels across the sky into the Torchbearer's flame
  type Gift = { sprites: THREE.Sprite[]; from: THREE.Vector3; t0: number };
  const gifts: Gift[] = [];
  function wakeCiv(n: number) {
    const p = civGeo.attributes.position as THREE.BufferAttribute;
    while (civWoken < n && civWoken < civOrder.length) {
      const sprites = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(() => { const sp = glowSprite(glowTexture, 0xffe8c4, 0); skyGroup.add(sp); return sp; });
      gifts.push({ sprites, from: new THREE.Vector3().fromBufferAttribute(p, civOrder[civWoken]).normalize(), t0: time });
      civWoken++; if (civWoken % 4 === 1) sound.bell(79 + (civWoken % 9), .025);
    }
  }
  let flamePulse = 0;
  function flyGifts() {
    const to = layout.get("you")!;
    for (let k = gifts.length - 1; k >= 0; k--) {
      const gift = gifts[k], u = Math.min(1, (time - gift.t0) / 2.6);
      gift.sprites.forEach((sp, j) => { const v = Math.max(0, u - j * .007), e = v * v * (3 - 2 * v);
        sp.position.copy(gift.from).lerp(to, e).normalize().multiplyScalar(R * .99); sp.material.opacity = Math.pow(Math.sin(Math.PI * Math.min(1, v)), .7) * .5 * (1 - j * .075);
        sp.scale.setScalar(R * (.0075 - e * .003) * (1 - j * .07)); });
      if (u >= 1) { gift.sprites.forEach(sp => { skyGroup.remove(sp); sp.material.dispose(); }); gifts.splice(k, 1); flamePulse = 1; }
    }
    flamePulse = Math.max(0, flamePulse - .03);
  }

  let mineAt = -1;

  // ─── State ───
  type State = "idle" | "intro" | "walk" | "finale" | "return" | "home";
  let state: State = "idle", index = 0, phase: "walk" | "narrate" | "act" | "after" = "walk", phaseAt = 0, afterFor = 6, actReady = 0, actLineUntil = 0;
  /** where the road stops you: a fire, a memorial, a group honoured together, your stone */
  const stops = riteStops.map(stop => ({ ...stop, members: stop.members.map(i => live[i]) }));
  /** the memorial at the current stop that is waiting to be honoured (or the last one, once they all are) */
  const current = () => { const S = stops[index]; return S.members.find(m => !m.done) ?? S.members[S.members.length - 1]; };
  const passers = live.filter(L => L.st.pass);
  let s = 0, speed = 0, holdWalk = 0, stride = 0, holdAct = false, walkPointer = false, keyWalk = false, keyAct = false, holdT = 0, gloom = 0, finaleAt = -1, approach = 1, kneel = 0, raise = 0, offer = 0;
  let crossed = false, lineUntil = 0, returnAt = -1, homeAt = -1, standLit = 0, name = "";
  const passed = new Set<string>();
  let glide: THREE.CatmullRomCurve3 | null = null;
  let actHit: THREE.Intersection | undefined;
  const approachFrom = new THREE.Vector3();
  type Saved = { name: string; date: string };
  let saved: Saved | null = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) || "null"); } catch { saved = null; }
  const showMine = () => { placeMine(mineTarget(), 1); mine.material.opacity = 1; mineHalo.material.opacity = .22; mineHit.visible = true; if (!targets.includes(mineHit)) targets.push(mineHit); };
  /** After a completed walk, the road stays lit: every later visit begins with the fires you left, and your stone carved. */
  function remembered() {
    showMine(); setLamps(1); index = 0; crestLit = 1; live.forEach(L => { L.done = true; L.doneAt = -1000; }); growWheat(1000); stars.forEach(x => { x.metAt = -1000; }); standLit = 1; mineRemembered = true; figureGlow = .7; rebuildConstellation();
    carvedName = saved?.name ?? ""; carvedDate = saved?.date ?? ""; paintMonument(99);
  }

  // ─── DOM: a line of narration, the year, a quiet hint, nothing else in the way ───
  const panel = el("rite-panel"), line = el("rite-line"), hint = el("rite-hint"), yearEl = el("rite-year"), actBtn = el<HTMLButtonElement>("rite-act"), homeBtn = el<HTMLButtonElement>("rite-next"), leaveBtn = el<HTMLButtonElement>("rite-leave");
  const startCard = el("rite-start"), nameInput = el<HTMLInputElement>("rite-name"), beginBtn = el<HTMLButtonElement>("rite-begin"), fade = el("rite-fade"), langBtn = el<HTMLButtonElement>("lang-toggle");
  let lineText = "", hintText = "", yearText = "";
  function setLine(text: string) { if (text === lineText) return; lineText = text; line.classList.remove("show"); void line.offsetWidth; line.textContent = text; if (text) line.classList.add("show"); }
  function setHint(text: string) { if (text === hintText) return; hintText = text; hint.textContent = text; }
  function setYear(text: string) { if (text === yearText) return; yearText = text; yearEl.textContent = text; yearEl.classList.toggle("on", !!text); }
  const paintTitles = () => live.forEach(L => { if (!L.title) return; const f = figureOf(L); L.title.draw([
    { text: L.st.title?.[lang] ?? "", size: 82, font: `600 SIZE ${serif()}`, color: "#f3dcae", spacing: lang === "zh" ? .25 : .04 },
    { text: f?.life ?? "", size: 42, font: `400 SIZE ${serif()}`, color: "#b8c6c0", spacing: .12 }]); });
  function paintStatic() {
    document.documentElement.dataset.riteLang = lang;
    langBtn.textContent = lang === "zh" ? "EN" : "中文"; langBtn.setAttribute("aria-label", lang === "zh" ? "Switch to English" : "切換為中文");
    el("rite-start-eyebrow").textContent = riteUi.startEyebrow[lang]; el("rite-start-title").textContent = riteUi.startTitle[lang]; el("rite-start-text").textContent = riteUi.startText[lang];
    el("rite-name-label").textContent = riteUi.name[lang]; beginBtn.textContent = index > 0 && state !== "idle" ? riteUi.resume[lang] : riteUi.begin[lang];
    leaveBtn.textContent = riteUi.leave[lang]; homeBtn.textContent = riteUi.home[lang];
    const guide = document.getElementById("rite-guide-name"); if (guide) guide.textContent = riteUi.startTitle[lang];
    yearText = "";
    paintTitles(); live.forEach(L => L.paint?.());
  }
  langBtn.addEventListener("click", () => { lang = lang === "zh" ? "en" : "zh"; try { localStorage.setItem("bb-lang", lang); } catch { /* ignore */ } paintStatic(); });
  document.fonts?.ready.then(() => paintStatic()).catch(() => {});
  function showFigure(i: number) {
    const star = stars[i], figure = resolveFigure(star.ref, lang); if (!figure || !api) return;
    const quote = figure.quote ? (lang === "zh" ? `\n\n「${figure.quote}」` : `\n\n“${figure.quote}”`) : "";
    api.showInfo({ eyebrow: `${riteUi.starHint[lang]} · ${figure.life}`, title: figure.name, description: figure.text + quote, href: figure.href, linkText: figure.href ? (lang === "zh" ? "關於這片星圖 ↗" : "About this constellation ↗") : undefined });
  }
  function wake(i: number, show: boolean) {
    const star = stars[i]; if (star.metAt > -1) { if (show) showFigure(i); return; }
    star.metAt = time; rebuildConstellation(); sound.bell(72 + (i % 6) * 2, .055); if (show) showFigure(i);
  }
  /** what you hear while their shadows turn: a gravestone's person in their own story, a relic's age in a line */
  const afterText = (L: Live) => L.st.kind === "stone" ? figureOf(L)?.text ?? "" : L.st.after ? say(L.st.after, lang, name) : "";
  const CHORDS = [[50, 57, 62, 65], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [41, 53, 60, 65, 69], [48, 55, 60, 64], [38, 45, 50, 53], [38, 45, 50, 54, 57]];
  const starOf = (L: Live) => stars.findIndex(x => x.station === L.i);
  /** You have honoured this place: its fire is lit, its people gather out of it, and then their light goes up to their star.
   * In a group, each gathers as you honour them, and they all go up together once you have honoured the last. */
  function complete(i: number, hit?: THREE.Intersection) {
    const L = live[i]; if (L.done) return; L.done = true; L.doneAt = time; holdAct = false; holdT = 0;
    L.act?.(hit); sound.chord(CHORDS[i % CHORDS.length], 10); sound.boom(.2);
    if (L.lamp !== undefined) { lamps[L.lamp].want = 1; dirty = true; sound.ignite(); }
    const S = stops.find(x => x.members.includes(L));
    if (S?.group) {
      const viewer = camera.position.clone().setY(L.ghost.y + 1.4), from = L.lamp !== undefined ? lamps[L.lamp].top.clone().add(new THREE.Vector3(0, .15, 0)) : L.focus.clone();
      later(.2, () => apparitions.summon(L.st.shadows, L.ghost, viewer, from));
      const text = afterText(L); setLine(text); actLineUntil = time + 3.2; api?.announce(text);
      if (S.members.some(m => !m.done)) { actReady = time + .7; return; }
      // the last of them: the people of their age come too, and then they all go up together
      const G = riteGroups[S.group], n = S.members.length;
      later(1.4, () => apparitions.crowd([...new Set(S.members.flatMap(m => m.st.crowd))].slice(0, 3), S.members[Math.floor(n / 2)].ghost, viewer));
      phase = "after"; phaseAt = time; lineUntil = 0; setHint(""); afterFor = 3.4 + 3 + .4 * n + 3.2;
      later(3.2, () => setLine(say(G.after, lang, name)));
      later(3.4 + 2.6, () => { const heads = apparitions.release(); S.members.forEach((m, j) => { const k = starOf(m); if (k >= 0) later(.9 + j * .4, () => ascend(heads[j] ?? m.pos.clone().add(new THREE.Vector3(0, m.top + .2, 0)), k)); }); });
      return;
    }
    phase = "after"; phaseAt = time; lineUntil = 0; setHint(""); afterFor = L.st.kind === "fire" ? 6 : 10;
    const text = afterText(L); setLine(text); api?.announce(text);
    if (L.st.kind === "fire") return;
    const viewer = camera.position.clone().setY(L.ghost.y + 1.4), crowd = [...new Set(L.st.crowd)];
    if (L.st.kind === "you") {
      carveAt = time; carvedName = name; carvedDate = today();
      later(1.2, () => apparitions.summon(L.st.shadows, L.ghost, viewer, crestAt.clone().add(new THREE.Vector3(0, .6, 0))));
      later(2.4, () => apparitions.crowd(crowd, L.ghost, viewer, 1.5));
      later(9.5, startFinale); return;
    }
    const from = L.lamp !== undefined ? lamps[L.lamp].top.clone().add(new THREE.Vector3(0, .15, 0)) : L.focus.clone();
    later(.3, () => apparitions.summon(L.st.shadows, L.ghost, viewer, from));
    later(1.3, () => apparitions.crowd(crowd.slice(0, 3), L.ghost, viewer));
    const k = starOf(L);
    later(5.8, () => { const head = apparitions.release()[0]; if (k >= 0) later(.95, () => ascend(head ?? L.pos.clone().add(new THREE.Vector3(0, L.top + .2, 0)), k)); });
  }
  /** A memorial you walk past: its fire brightens as your torch goes by, the faint figure beside it lifts away, and its light goes up. */
  function passBy(L: Live) {
    if (L.done) return; L.done = true; L.doneAt = time;
    if (L.lamp !== undefined) { lamps[L.lamp].want = 1; dirty = true; sound.ignite(); }
    if (L.presence) { apparitions.dismiss(L.presence); L.presence = null; }
    const k = starOf(L); if (k >= 0) later(.6, () => ascend(L.pos.clone().add(new THREE.Vector3(0, L.top + .3, 0)), k));
  }
  const passLine = (L: Live) => { if (L.st.kind === "stone") { const f = figureOf(L); return f ? `${f.name}${f.quote ? (lang === "zh" ? `：「${f.quote}」` : `: “${f.quote}”`) : ""}` : ""; } return L.st.lines[0] ? say(L.st.lines[0], lang, name) : ""; };
  /** Your name is on your stone; now your star rises from it, the shared sky wakes, and you look back. */
  function startFinale() {
    if (state !== "walk") return;
    api?.clearInfo(); sound.cue("finale"); mineAt = time; mine.material.opacity = 1; mineHalo.material.opacity = 0; placeMine(altarTop, 0); state = "finale"; finaleAt = time; apparitions.release(altarTop);
  }

  function resetWalk() {
    live.forEach(L => { L.done = false; L.doneAt = -1; L.reset?.(); }); index = 0; s = 0; mineAt = -1; finaleAt = -1; civWoken = 0; crossed = false; passed.clear(); pending.length = 0;
    stars.forEach(x => { x.metAt = -1; }); apparitions.clear(); live.forEach(L => { L.presence = undefined; }); mineRemembered = false; figureGlow = 0; anchor(); rebuildConstellation(); setLamps(LOW);
    mine.material.opacity = mineHalo.material.opacity = 0; mineHit.visible = false; (civGlow.array as Float32Array).fill(0); civGlow.needsUpdate = true;
    trail.material.opacity = 0; standLit = 0; crestLit = 0;
  }
  function begin() {
    sound.wake(); sound.hush(); startCard.hidden = true; name = (nameInput.value || "").trim().slice(0, 10);
    if (index === 0 || live.every(L => L.done)) resetWalk();
    state = "walk"; panel.hidden = false; leaveBtn.hidden = false; el("wayfinding").hidden = true; api?.clearInfo(); homeBtn.hidden = true;
    approachFrom.copy(camera.position); approach = 0; torch.visible = true; phase = "walk"; phaseAt = time; speed = 0;
  }
  function end() {
    state = "idle"; panel.hidden = true; leaveBtn.hidden = true; startCard.hidden = true; setLine(""); setHint(""); setYear(""); el("wayfinding").hidden = false;
    walkPointer = keyWalk = holdAct = keyAct = false; torch.visible = false; glide = null;
  }
  function leave() {
    if (state === "idle" || state === "intro") { if (state === "intro") { state = "idle"; startCard.hidden = true; } return; }
    if (finaleAt >= 0) { finishHome(true); return; }
    end(); fade.classList.add("on");
    setTimeout(() => { api?.returnToPath(true); fade.classList.remove("on"); }, api?.paused ? 0 : 900);
  }
  /** Save the walk, light the torch in its stand, and give the world back to exploration. */
  function finishHome(cut = false) {
    try { saved = { name, date: carvedDate || today() }; localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* ignore */ }
    standLit = 1; end(); showMine(); rebuildConstellation();
    if (cut) { fade.classList.add("on"); setTimeout(() => { api?.returnToPath(true); fade.classList.remove("on"); }, api?.paused ? 0 : 900); }
    else api?.returnToPath(true);
  }
  /** The way back is quick, because it is lit: a long glide home above the fires. */
  function returnHome() {
    if (state !== "finale") return;
    homeBtn.hidden = true; setLine(""); setHint(""); setYear(""); state = "return"; returnAt = time; sound.chord([38, 45, 50, 54, 57, 62], 14, .016); sound.cue("homeward");
    const points: THREE.Vector3[] = [camera.position.clone()];
    for (let d = LEN - 18; d > 12; d -= 22) { const p = at(d); p.y += EYE + 3.4 + 3.5 * Math.sin(Math.PI * d / LEN); points.push(p); }
    points.push(at(4).add(new THREE.Vector3(0, EYE + .8, 0)), new THREE.Vector3(...overview.position));
    glide = new THREE.CatmullRomCurve3(points, false, "centripetal");
    if (api?.paused) { fade.classList.add("on"); setTimeout(() => { camera.position.fromArray(overview.position); camera.lookAt(new THREE.Vector3(...overview.target)); api?.syncAngles(); arrive(); fade.classList.remove("on"); }, 0); }
  }
  function arrive() {
    state = "home"; homeAt = time; glide = null; torch.visible = false; standLit = 1;
    setLine(name ? (lang === "zh" ? say(riteUi.welcomeName, lang, name) : `Welcome home, ${name}.`) : riteUi.welcome[lang]);
    sound.chord([50, 57, 62, 66, 69], 12, .02); sound.bell(74, .05); setYear("");
  }
  function open() {
    if (state !== "idle" && state !== "intro") return;
    sound.wake(); state = "intro"; startCard.hidden = false; panel.hidden = true; paintStatic();
    api?.moveTo([STAND.x + 1.6, 1.7, STAND.z + 2.2], [STAND.x, 1.2, STAND.z], () => { if (state === "intro") nameInput.focus({ preventScroll: true }); });
  }
  beginBtn.addEventListener("click", begin);
  nameInput.addEventListener("keydown", e => { if (e.key === "Enter") begin(); });
  leaveBtn.addEventListener("click", leave);
  homeBtn.addEventListener("click", returnHome);
  // Keyboard and assistive alternative: the act happens at once.
  actBtn.addEventListener("click", () => { if (state === "walk" && phase === "act") complete(current().i); });
  const editing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement;
  addEventListener("keydown", e => { if (state !== "walk" || editing(e)) return; sound.wake();
    if (e.code === "KeyW" || e.code === "Space" || e.code === "ArrowUp") { keyWalk = true; e.preventDefault(); }
    if (e.code === "KeyE") keyAct = true; });
  addEventListener("keyup", e => { if (e.code === "KeyW" || e.code === "Space" || e.code === "ArrowUp") keyWalk = false; if (e.code === "KeyE") keyAct = false; });
  let crestLit = 0;
  if (saved) remembered(); else paintMonument(0);
  paintStatic();

  // ─── Hooks for exploration ───
  const pickHit = (ray: THREE.Raycaster) => { ray.far = 2500; const hit = ray.intersectObjects(targets, false)[0]; ray.far = Infinity; return hit; };
  const hooks: RiteHooks = {
    active: () => state === "walk" || state === "finale" || state === "return" || state === "home",
    hover(ray) {
      const hit = pickHit(ray); if (!hit) return null; const u = hit.object.userData;
      if (u.kind === "stand") return state === "idle" || state === "intro" ? riteUi.trailhead[lang] : null;
      if (u.kind === "star") { const f = resolveFigure(stars[u.index].ref, lang); return f ? `${f.name} · ${f.life}` : null; }
      if (u.kind === "mine") return `${riteUi.yourStar[lang]} · ${saved?.name || name || ""}`;
      if (u.kind === "gate" && state === "walk" && u.station === current().i && phase === "act") return live[u.station].st.act[lang];
      if (u.kind === "gate" && u.station > 0 && live[u.station].st.kind !== "you") { const L = live[u.station], f = figureOf(L); return f ? `${L.st.kind === "relic" ? L.st.title?.[lang] : f.name} · ${f.life}` : null; }
      return null;
    },
    click(ray) {
      const hit = pickHit(ray); const u = hit?.object.userData;
      if (u?.kind === "stand" && (state === "idle" || state === "intro")) { open(); return true; }
      if (u?.kind === "mine") { api?.showInfo({ eyebrow: `${riteUi.yourStar[lang]} · ${saved?.date ?? ""}`, title: saved?.name || name || (lang === "zh" ? "你" : "You"), description: riteUi.carried[lang] }); return true; }
      if (u?.kind === "star") { showFigure(u.index); return true; }
      if (u?.kind === "gate" && !(state === "walk" && phase === "act" && u.station === current().i)) { const k = stars.findIndex(x => x.station === u.station); if (k >= 0) { showFigure(k); return true; } }
      return hooks.active();
    },
    press(ray) {
      if (state !== "walk" || phase !== "act") return false;
      const hit = pickHit(ray); if (!hit) return false; const u = hit.object.userData;
      if (u.kind === "gate" && u.station === current().i) { holdAct = true; actHit = hit; return true; }
      return false;
    },
    release() { holdAct = false; },
    pointer(down) { walkPointer = down && state === "walk"; if (down) sound.wake(); },
    open, exit: leave,
  };

  // ─── Frame update ───
  const tmp = new THREE.Vector3(), look = new THREE.PerspectiveCamera(), fog = scene.fog as THREE.FogExp2, baseFog = fog.color.clone(), baseDensity = fog.density, moonBase = o.moonLight.intensity, bounceBase = o.moonBounce.intensity;
  const overviewQ = (() => { const c = new THREE.PerspectiveCamera(); c.position.fromArray(overview.position); c.lookAt(new THREE.Vector3(...overview.target)); return c.quaternion.clone(); })();
  function face(target: THREE.Vector3, rate: number) {
    if (!api || api.looking || performance.now() - api.lastLook < 2200) return;
    look.position.copy(camera.position); look.lookAt(target); camera.quaternion.slerp(look.quaternion, Math.min(1, rate)); api.syncAngles();
  }
  if (new URLSearchParams(location.search).has("ritedebug")) (window as unknown as { __rite: unknown }).__rite = {
    get state() { return { state, index, stops: stops.length, memorial: current().st.id, at: +stops[index].stand.toFixed(1), phase, s: +s.toFixed(1), length: +LEN.toFixed(1), speed: +speed.toFixed(2), gloom: +gloom.toFixed(2), lampsLit: lamps.filter(c => c.lit > 0).length, lamps: N, met: stars.filter(x => x.metAt > -1).length, stars: stars.length, civWoken, year: yearText, audio: sound.ready, sky: +o.civ.group.rotation.y.toFixed(4), ft: finaleAt >= 0 ? +(time - finaleAt).toFixed(1) : -1 }; },
    complete: (i: number) => complete(i), wake: (i: number) => wake(i, false), go: (d: number) => { s = d; }, home: () => returnHome(),
    /** skip to a stop, as if everything before it had been honoured */
    goStop: (k: number) => { for (let j = 1; j < k; j++) stops[j].members.forEach(m => { m.done = true; m.doneAt = time; }); passers.forEach(P => { if (P.s < stops[k].stand - 12) { P.done = true; P.presence = null; } }); index = k; s = Math.max(0, stops[k].stand - 10); phase = "walk"; },
    scene,
    /** what is under a point of the screen (normalised device coordinates) */
    pick: (x: number, y: number) => { const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(x, y), camera); return r.intersectObjects(scene.children, true).filter(h => h.object.type === "Mesh" || h.object.type === "InstancedMesh").slice(0, 4).map(h => { const m = h.object as THREE.Mesh, w = m.getWorldPosition(new THREE.Vector3()); return `${m.type}:${m.name || m.parent?.name || ""}:${(m.material as THREE.Material).type}:${m.geometry.type}:${m.geometry.attributes.position.count}:inst${h.instanceId ?? ""}:d${h.distance.toFixed(2)}:at${w.toArray().map(v => v.toFixed(1))}:s${m.scale.toArray().map(v => v.toFixed(2))}:col${((m.material as THREE.MeshStandardMaterial).color?.getHexString?.() ?? "")}:vis${(m.material as THREE.Material).visible}`; }); },
  };
  let dawn = 0, aurora = 0, ducked = false;
  /** The score follows the road: a cue for each stretch of history, crossfaded over about twenty metres. */
  function scoreMix(t: number): RiteMix {
    const music: Record<string, number> = {}, ambience: Record<string, number> = {}, span = (from: number, to: number, w = 12) => sm(from - w, from + w, s) * (1 - sm(to - w, to + w, s));
    if (state === "intro" || (state === "walk" && s < THRESHOLD + 10)) { music.ember = 1 - (state === "walk" ? sm(THRESHOLD - 2, THRESHOLD + 10, s) : 0); ambience.forest = .5; }
    if (state === "walk") {
      const ashDone = warL.done;
      music.forest = span(THRESHOLD + 4, 150); music.fields = span(150, 300); music.voices = span(300, 432);
      music.ash = ashDone ? 0 : sm(420, 440, s);
      music.candle = ashDone ? 1 - sm(494, 518, s) : 0;
      music.ascent = ashDone ? sm(494, 518, s) * (.55 + .45 * sm(zones.ascent[0], LEN, s)) : 0;
      ambience.forest = 1 - sm(28, 56, s); ambience.open = sm(28, 56, s) * (1 - sm(425, 440, s)); ambience.ash = sm(425, 440, s) * (1 - sm(500, 515, s)); ambience.crest = sm(500, 515, s);
    }
    if (state === "finale") { const ft = t - finaleAt; music.finale = 1; music.hold = sm(68, 75, ft); ambience.crest = 1 - sm(4, 20, ft) * .5; }
    if (state === "return") { const rt = t - returnAt; music.homeward = 1; music.finale = 1 - sm(0, 4, rt); music.hold = 0; ambience.open = .5 * (1 - sm(28, 38, rt)); }
    if (state === "home" || (state === "idle" && homeAt > 0 && t - homeAt < 24)) music.homeward = 1;
    return { music, ambience };
  }
  const mood = { sat: 1, vignette: 0, grain: 0, tint: new THREE.Color(1, 1, 1) };
  const COLD = new THREE.Color(.92, .98, 1.09), WARM = new THREE.Color(1.06, 1, .93), ASHEN = new THREE.Color(1.09, .94, .85), DAWN = new THREE.Color(1.07, 1, .94), tint = new THREE.Color();
  const holdFor = (st: RiteStation) => st.kind === "you" ? 2.4 : st.kind === "fire" ? 1.8 : 1.4;
  return {
    hooks,
    attach(a: ExplorationApi) { api = a; },
    update(dt: number, sceneTime: number): boolean {
      time += dt; const t = time, still = !!api?.paused, S = stops[index], L = current(), st = L.st, G = S.group ? riteGroups[S.group] : null;
      for (let k = pending.length - 1; k >= 0; k--) if (pending[k].at <= t) { const job = pending.splice(k, 1)[0]; job.run(); }
      const stop = S.stand, stopDone = S.members.every(m => m.done), stopLines = G ? G.lines : S.members[0].st.lines;
      const fl = .84 + .16 * Math.sin(t * 11.3) * Math.sin(t * 5.1);
      // ── movement: hold to walk; the road itself stops you at each memorial
      let walking = false;
      if (state === "walk") {
        if (approach < 1) { approach = still ? 1 : Math.min(1, approach + dt / 2.2); camera.position.lerpVectors(approachFrom, at(s).add(new THREE.Vector3(0, EYE, 0)), sm(0, 1, approach)); face(index === 0 ? live[0].focus : at(s + 9).add(new THREE.Vector3(0, EYE, 0)), dt * 2.5); }
        else {
          if (phase === "walk" && stopDone && index < stops.length - 1) { index++; return true; }
          const passing = passers.some(P => !P.done && P.s - s < 9 && P.s - s > -1);
          const near = phase === "narrate" || s > stop - 7, wantWalk = (walkPointer || keyWalk) && (phase === "walk" || phase === "narrate") && !stopDone && s < stop;
          holdWalk = wantWalk ? holdWalk + dt : 0;
          const ahead = at(s + 4), here = at(s), slope = Math.max(0, (ahead.y - here.y) / 4);
          const target = wantWalk ? (near ? 1.2 : (1.9 + 1.6 * sm(0, 1.8, holdWalk)) * (passing ? .62 : 1)) * (1 - .55 * gloom) * (1 - Math.min(.3, slope * 1.6)) : 0;
          speed += (target - speed) * Math.min(1, dt * (wantWalk ? 2.4 : 5));
          if (still && wantWalk) { s = stop; speed = 0; }
          else if (speed > .02) { const before = s; s = Math.min(stop, s + speed * dt); walking = s > before; stride += (s - before) / .78; if (Math.floor(stride) !== Math.floor(stride - (s - before) / .78)) sound.step(here.y / 20); }
          if (s >= stop - .01) speed = 0;
          if (phase === "walk" && !stopDone) {
            if (stopLines.length && (s >= stop - .01 || (index > 0 && s > stop - 12))) { phase = "narrate"; phaseAt = t; lineUntil = 0; }
            else if (!stopLines.length && s >= stop - .01) { phase = "act"; phaseAt = t; actBtn.textContent = st.act[lang]; }
          }
          const p = at(s), bob = walking && !still ? Math.sin(stride * Math.PI) * .028 * Math.min(1, speed / 2) : 0, eye = EYE - kneel * .75 + bob;
          camera.position.lerp(tmp.set(p.x, p.y + eye, p.z), still ? 1 : Math.min(1, dt * 6));
          if (ascents.length) face(ascentAt, dt * 1.8);
          else if (walking) { const a = at(s + 9); face(a.add(new THREE.Vector3(0, EYE - .15 + (a.y - p.y) * .3, 0)), dt * 1.8); }
          else if (phase === "narrate" || phase === "act") face(L.focus, dt * 1.5);
          else if (phase === "after" && G) face(tmp.copy(S.members[Math.floor((S.members.length - 1) / 2)].focus).lerp(S.members[Math.ceil((S.members.length - 1) / 2)].focus, .5).add(new THREE.Vector3(0, .6, 0)), dt * 1.2);
          else if (phase === "after" && t - phaseAt < 6.6) face(tmp.copy(L.focus).lerp(L.ghost.clone().setY(L.ghost.y + 1.15), sm(.4, 2.2, t - phaseAt)), dt * 1.3);
        }
      }
      // ── crossing the threshold, and the history heard on the road between the memorials
      if (state === "walk" && !crossed && s >= THRESHOLD) { crossed = true; setLine(riteUi.threshold[lang]); lineUntil = t + 5.5; sound.bell(62, .06); sound.boom(.18); }
      if (state === "walk" && phase === "walk" && index > 0) {
        for (let k = 0; k < roadLines.length; k++) { const key = `road:${k}`, rl = roadLines[k]; if (passed.has(key) || t < lineUntil || s < rl.at) continue;
          passed.add(key); if (s - rl.at > 30) continue; setLine(say(rl.text, lang, name)); lineUntil = t + 5.8; break; }
        if (t > lineUntil && lineUntil > 0) { setLine(""); lineUntil = 0; }
      }
      // ── memorials walked past: a faint figure beside each as you come near, and its light going up as you pass
      if (state === "walk" && live[0].done) for (const P of passers) {
        if (P.done) continue; const d = P.s - s;
        if (P.presence === undefined && d < 15) { P.presence = apparitions.presence(P.st.shadows[0], P.ghost, at(P.s - 4).add(new THREE.Vector3(0, EYE, 0))); }
        if (d < 12 && !passed.has(`pass:${P.st.id}`) && phase === "walk") { passed.add(`pass:${P.st.id}`); const text = passLine(P); if (text) { setLine(text); lineUntil = t + 5.6; } }
        if (d < .6) passBy(P);
      }
      // ── at a stop: what is said there, then the act
      if (state === "walk" && phase === "narrate") { const k = Math.floor((t - phaseAt) / 4.4);
        if (k < stopLines.length) setLine((t - phaseAt) % 4.4 < 3.95 ? say(stopLines[k], lang, name) : "");
        else if (s >= stop - .01) { phase = "act"; phaseAt = t; actBtn.textContent = st.act[lang]; }
        else setLine(""); }
      if (state === "walk" && phase === "act") {
        const f = st.kind === "stone" ? figureOf(L) : null, left = S.members.filter(m => !m.done).length;
        if (t > actLineUntil) setLine(f ? f.name : st.act[lang]);
        setHint(holdAct || keyAct ? riteUi.holding[lang] : `${f ? st.act[lang] + " " : ""}${riteUi.holdKeys[lang]}${G && left > 1 ? (lang === "zh" ? `　還有 ${left - 1} 位` : `  · ${left - 1} more`) : ""}`);
        const pressing = (holdAct || keyAct) && t > actReady;
        holdT = pressing ? holdT + dt : Math.max(0, holdT - dt * 2);
        if (holdT > (G ? 1 : holdFor(st))) complete(L.i, actHit);
      }
      if (state === "walk" && phase === "after" && st.kind !== "you" && t - phaseAt > afterFor) { phase = "walk"; phaseAt = t; setLine(""); }
      if (state === "walk") setHint(phase === "act" ? hintText : approach >= 1 && s < stop - .01 && (phase === "walk" || phase === "narrate") ? `${riteUi.walkHint[lang]} · ${riteUi.walkKeys[lang]}` : "");
      // in a group, the year is that of whoever you are honouring
      const honouring = G && (phase === "act" || phase === "after") ? (phase === "after" ? S.members[S.members.length - 1] : L) : null;
      if (state === "walk" || state === "finale") setYear(yearLabel(state === "finale" ? 0 : honouring ? honouring.st.yearsAgo : yearsAgoAt(s), lang));
      // ── body: kneel for the seed, hold the torch out to the fire you are giving
      const acting = phase === "act" && (holdAct || keyAct);
      kneel += ((state === "walk" && st.actKind === "kneel" && (acting || (phase === "after" && t - phaseAt < 2.5)) ? 1 : 0) - kneel) * Math.min(1, dt * 3);
      raise += (0 - raise) * Math.min(1, dt * 3);
      offer += (((st.actKind === "offer" || st.actKind === "pass" || st.actKind === "hold") && acting ? 1 : 0) - offer) * Math.min(1, dt * 4);
      torch.position.copy(torchRest).lerp(torchRaised, raise * .6).lerp(torchOffered, offer); torch.rotation.z = -.12 + raise * .15;
      // ── the ashes: dark from the edge of the burnt country to the candle; light returns once you have given your flame
      const walkingOn = state === "walk" || state === "finale";
      const gIn = sm(zones.ash[0] + 2, warL.s - 8, s), g = !walkingOn ? 0 : warL.done ? gIn * (1 - sm(0, 1, (t - warL.doneAt - 1) / 6)) : gIn;
      gloom = g;
      // ── fire: the torch, the memorials' small fires, a few pooled lights
      const lit = live[0].done && state !== "home" ? THREE.MathUtils.lerp(1, .14, g) : index === 0 && phase === "act" && state === "walk" ? Math.min(1, holdT / 1.8) : 0;
      torchFlame.uniforms.uTime0.value = sceneTime; torchFlame.uniforms.uGlobal.value = lit * fl * (1 + raise * .2); torchLight.intensity = lit * 5.5 * fl; torchLight.position.copy(torch.position).add(new THREE.Vector3(0, .2, 0));
      lampFlame.uniforms.uTime0.value = sceneTime; lampFlame.uniforms.uGlobal.value = (.95 + .1 * fl) * (1 - g * .7); lampFlame.uniforms.uWind.value = .25 + .35 * Math.sin(sceneTime * .65) * Math.sin(sceneTime * .23 + 1);
      for (let i = 0; i < N; i++) { const c = lamps[i]; if (c.lit !== c.want) { c.lit = c.lit < c.want ? Math.min(c.want, c.lit + dt * 1.1) : Math.max(c.want, c.lit - dt); dirty = true; } if (dirty) { iLit[i] = glowLit[i] = c.lit; placeGlow(i); } }
      if (dirty) { litAttr.needsUpdate = glowLitAttr.needsUpdate = poolColor.needsUpdate = true; dirty = lamps.some(c => c.lit !== c.want); }
      glowMat.uniforms.uDim.value = g; glowMat.uniforms.uHome.value = sm(120, 260, camera.position.distanceTo(FIRE));
      homeGlow.material.opacity = .05 * sm(150, 320, camera.position.distanceTo(FIRE));
      const nearest: { c: Lamp; d: number }[] = [];
      for (const c of lamps) { if (c.lit <= 0) continue; const d = c.top.distanceToSquared(camera.position); if (d > 900) continue; nearest.push({ c, d }); }
      nearest.sort((a, b) => a.d - b.d);
      lights.forEach((l, k) => { const n = nearest[k]; if (!n) { l.intensity = 0; return; } l.position.copy(n.c.top).add(new THREE.Vector3(0, .35, 0)); const spot = lampSpots[lamps.indexOf(n.c)]; l.intensity = 3 * n.c.lit * fl * (1 - g * .6) * Math.min(1.4, spot.flame + .3) * (spot.light ?? 1); });
      standFlame.set(standLit); standFlame.material.uniforms.uTime0.value = sceneTime; standFlame.material.uniforms.uGlobal.value = fl; standLight.intensity = standLit * 2.6 * fl;
      // ── the war: smoke over the sky, the moon dims, cinders fall, your flame almost goes out; at the end of the road the air clears
      const clear = state === "finale" ? sm(24, 32, t - finaleAt) : state === "return" ? 1 - sm(0, 1, (t - returnAt) / 26) : 0;
      o.skyDim.value = g; o.starDim.value = g;
      fog.color.lerpColors(baseFog, new THREE.Color(0x1a0f0c), g); fog.density = (baseDensity + g * .03) * (1 - .55 * clear);
      o.moonLight.intensity = moonBase * (1 - g * .8); o.moonBounce.intensity = bounceBase * (1 - g * .65);
      (ash.pts.material as THREE.PointsMaterial).opacity = g * .8;
      if (g > 0) { for (let k = 0; k < ash.seeds.length; k++) { const [a, b, c] = ash.seeds[k]; ash.pos[k * 3] = camera.position.x + (a - .5) * 16 + Math.sin(t * .4 + c * 9) * .6; ash.pos[k * 3 + 1] = camera.position.y + 6 - ((t * (.35 + c * .5) + b * 9) % 9); ash.pos[k * 3 + 2] = camera.position.z + (b - .5) * 16; }
        ash.pts.geometry.attributes.position.needsUpdate = true; }
      if (state !== "idle" && state !== "intro") o.moonLight.target.position.set(camera.position.x, 0, camera.position.z); else o.moonLight.target.position.set(0, 0, -13);
      // ── the memorials: hands, carved words catching the firelight, titles
      for (const P of live) P.update?.(t, dt);
      for (const P of live) if (P.glow) P.glow.emissiveIntensity = P.done ? sm(0, 1, (t - P.doneAt - .4) / 2.6) * (.62 + .1 * fl) * (1 - g * .5) : 0;
      if (carveAt >= 0 && youL.done) { const letters = [...(carvedName || riteUi.anyone[lang])].length, want = Math.min(letters + 1, Math.floor((t - carveAt - .6) / .34) + 1); if (want !== carved && want >= 0) paintMonument(want); }
      standEmber.material.opacity = (live[0].done || state === "walk" || standLit > 0) ? 0 : .35 + .25 * Math.sin(t * 2.1) * Math.sin(t * 3.7 + 1);
      for (const h of ancestorHands) (h.material as THREE.MeshStandardMaterial).opacity = (live[0].done && state !== "idle" ? sm(8, 2.5, h.position.distanceTo(camera.position)) : 0) * .95;
      for (const h of myHands) (h.material as THREE.MeshBasicMaterial).opacity = sm(0, 1, (t - h.userData.born) / 1.4);
      beacon.material.opacity = state === "finale" || state === "return" || standLit > 0 ? .9 : .35 + .15 * Math.sin(t * 1.3); beacon.scale.setScalar(state === "finale" ? 2.4 : 1.6 + sm(60, 400, camera.position.distanceTo(beacon.position)) * 5);
      const lookingUp = sm(.35, .6, camera.getWorldDirection(tmp).y);
      for (const P of live) { if (!P.title) continue; const d = camera.position.distanceTo(P.pos), m = P.title.mesh.material as THREE.MeshBasicMaterial;
        m.opacity = state === "walk" ? sm(20, 11, d) * sm(5, 7.5, d) * (1 - lookingUp) * (P.done && s > P.s + 2 ? sm(P.s + 10, P.s + 3, s) : 1) : 0; P.title.mesh.visible = m.opacity > .01;
        P.title.mesh.lookAt(camera.position.x, P.title.mesh.position.y, camera.position.z); }
      const journeying = state !== "idle" && state !== "intro";
      apparitions.update(dt, camera, fl * (1 - g * .4));
      // ── their light rising into the sky
      for (let k = ascents.length - 1; k >= 0; k--) {
        const a = ascents[k], u = Math.min(1, (t - a.t0) / a.dur), lift = a.from.clone().add(new THREE.Vector3(0, 3.5, 0)), S = starWorld(a.k);
        let p: THREE.Vector3;
        if (u < .36) { const v = sm(0, 1, u / .36); p = a.from.clone().lerp(lift, v); p.x += Math.sin(t * 2.6) * .08 * v; p.z += Math.cos(t * 2.1) * .08 * v; }
        else { const v = (u - .36) / .64; p = lift.clone().lerp(S, v * v * v); }
        a.sprite.position.copy(p); ascentAt.copy(p);
        const d = p.distanceTo(camera.position); a.sprite.scale.setScalar(Math.max(.3, d * THREE.MathUtils.lerp(.045, .016, u)) * (1 + .12 * Math.sin(t * 9))); a.sprite.material.opacity = Math.min(1, u * 8);
        // the tail: points along the way it has come, closer together than the frames are apart
        const prev = a.path[0]; if (prev) for (let j = 1; j <= 3; j++) a.path.unshift(prev.clone().lerp(p, j / 3)); else a.path.unshift(p.clone()); while (a.path.length > 70) a.path.pop();
        a.tail.forEach((sp, j) => { const q = a.path[Math.min(a.path.length - 1, (j + 1) * 3)]; sp.position.copy(q); const f = 1 - j / a.tail.length; sp.scale.setScalar(Math.max(.18, q.distanceTo(camera.position) * .035 * f)); sp.material.opacity = .32 * f * f * Math.min(1, u * 6); });
        if (u >= 1) { root.remove(a.sprite); a.sprite.material.dispose(); a.tail.forEach(sp => { root.remove(sp); sp.material.dispose(); }); ascents.splice(k, 1); wake(a.k, false); }
      }
      // ── the walk's stars
      if (state !== "finale") figureGlow += ((mineRemembered || youL.done ? .7 : 0) - figureGlow) * Math.min(1, dt * .5);
      stars.forEach((x, i) => {
        const met = x.metAt > -1, hidden = g > .4 && x.ref !== "war", pulse = .9 + .1 * Math.sin(t * 1.3 + i * 2.1), born = met ? sm(0, 1, (t - x.metAt) / .6) : 0, flash = met ? Math.max(0, 1 - (t - x.metAt) / 1.6) : 0;
        const a = hidden ? .05 : 1, glow = 1 + figureGlow * .25 + flash * 1.2;
        x.core.material.opacity = a * (met ? .5 + .5 * born : .42); x.halo.material.opacity = a * (met ? .22 + figureGlow * .1 + flash * .4 : .05); x.flare.material.opacity = a * (met ? .5 + flash * .5 : .08);
        x.core.scale.setScalar(R * (met ? .0105 * glow : .0055) * pulse); x.halo.scale.setScalar(R * (met ? .034 * glow : .018) * pulse); x.flare.scale.setScalar(R * (met ? .04 * (1 + flash) : .022) * pulse); x.flare.material.rotation = t * .04 + i;
        x.core.material.color.setRGB(1, met ? .86 : .95, met ? .62 : .9);
      });
      ribbonFade = state === "finale" ? 1 - sm(25, 31, t - finaleAt) : state === "return" || state === "home" || mineRemembered ? 0 : 1; ribbons.visible = ribbonFade > .01;
      drawRibbons(dt, g);
      // ── the end of the road: your star rises into the shared sky, the sky wakes, then you turn and look back along everything you lit
      if (state === "finale") { const ft = t - finaleAt, k = sm(0, 1, ft / 7);
        if (ft < 7.2) placeMine(altarTop.clone().lerp(mineTarget(), Math.pow(k, 2.4)), k); mineHalo.material.opacity = .25 * k;
        const a = trail.geometry.attributes.position as THREE.BufferAttribute; a.setXYZ(0, altarTop.x, altarTop.y, altarTop.z); a.setXYZ(1, mineWorld.x, mineWorld.y, mineWorld.z); a.needsUpdate = true;
        trail.material.opacity = .7 * Math.min(1, ft) * (1 - sm(7, 11, ft));
        if (ft > 6.6 && ft - dt <= 6.6) { rebuildConstellation(); mineHit.visible = true; if (!targets.includes(mineHit)) targets.push(mineHit); sound.bell(86, .05); }
        figureGlow = sm(7.5, 10, ft) * (1 - sm(26, 34, ft) * .3);
        // the flame joins the hand; the whole figure brightens; then the shared sky wakes; then you turn for home
        if (ft < 7.5) face(mineWorld, dt * 1.4);
        else if (ft < 18) face(skyPoint("confucius"), dt * .9);
        if (ft > 7.5 && ft < 13) setLine(riteUi.figure[lang]); else if (ft >= 13 && ft < 18) setLine(riteUi.flame[lang]);
        if (ft > 18 && ft < 25) { setLine(ft < 21.5 ? riteUi.together[lang] : riteUi.together2[lang]); wakeCiv(Math.floor((ft - 18) / 6 * civOrder.length) + 1); face(camera.position.clone().add(new THREE.Vector3(0, 30, 0)).addScaledVector(homeward, -18), dt * .6); }
        if (ft > 25) { face(FIRE.clone().add(new THREE.Vector3(0, 6, 0)), dt * .7); setLine(ft < 29.5 ? riteUi.lookBack[lang] : ft < 35 ? riteUi.lookBack2[lang] : riteUi.legacy[lang]); if (ft > 35) homeBtn.hidden = false; }
      }
      if (state === "finale" || state === "return") {
        const glow = civGlow.array as Float32Array; for (let n = 0; n < civOrder.length; n++) glow[civOrder[n]] = n < civWoken ? Math.min(1, glow[civOrder[n]] + dt * 1.5) : 0; civGlow.needsUpdate = true;
        flyGifts();
        if (t - finaleAt > 7.2) { const local = layout.get("you")!.clone().multiplyScalar(R), pulse = 1 + flamePulse * .35 + .06 * Math.sin(t * 2.3); mine.position.copy(local); mineHalo.position.copy(local); mine.scale.setScalar(R * .016 * pulse); mineHalo.scale.setScalar(R * .07 * (1 + flamePulse * .5)); }
      }
      // ── the glide home along the lit road
      if (state === "return" && glide) { const k = Math.min(1, (t - returnAt) / 38), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        camera.position.copy(glide.getPointAt(e)); const ahead = glide.getPointAt(Math.min(1, e + .03)).add(new THREE.Vector3(0, -1.1, 0));
        look.position.copy(camera.position); look.lookAt(ahead); const q = e > .9 ? look.quaternion.clone().slerp(overviewQ, sm(.9, 1, e)) : look.quaternion;
        camera.quaternion.slerp(q, Math.min(1, dt * 2.5)); api?.syncAngles();
        if (k >= 1) { camera.quaternion.copy(overviewQ); api?.syncAngles(); arrive(); } }
      if (state === "home") { const ht = t - homeAt; if (ht > 5.5) setLine(riteUi.welcome2[lang]); if (ht > 12) finishHome(); }
      if ((state === "finale" && t - finaleAt > 7.2) || state === "return") { skyGroup.updateMatrixWorld(); mineWorld.copy(mine.position).applyMatrix4(skyGroup.matrixWorld); }
      // ── mood: the grade, the dawn behind home, the aurora, the air
      const inRite = journeying, ft = t - finaleAt;
      const forest = inRite ? 1 - sm(zones.forest[1] - 20, zones.forest[1] + 25, s) : 0, field = inRite ? sm(150, 178, s) * (1 - sm(240, 300, s)) : 0;
      const dawnTarget = state === "finale" ? sm(22, 38, ft) * .95 : state === "return" || state === "home" ? .95 : 0;
      dawn += (dawnTarget - dawn) * Math.min(1, dt * (dawnTarget > dawn ? .5 : .08)); o.skyDawn.value = dawn;
      const auroraTarget = state === "finale" ? sm(12, 26, ft) : state === "return" || state === "home" ? 1 : 0;
      aurora += (auroraTarget - aurora) * Math.min(1, dt * (auroraTarget > aurora ? .35 : .06)); o.skyAurora.value = aurora;
      tint.setRGB(1, 1, 1).lerp(COLD, forest * .8).lerp(WARM, field * .7).lerp(ASHEN, g).lerp(DAWN, dawn * .8);
      const k = Math.min(1, dt * 1.2);
      mood.sat += ((inRite ? 1 - forest * .14 - g * .55 + field * .06 + dawn * .06 : 1) - mood.sat) * k;
      mood.vignette += ((inRite ? .3 + forest * .14 + g * .3 : 0) - mood.vignette) * k;
      mood.grain += ((inRite ? .02 + g * .05 : 0) - mood.grain) * k;
      mood.tint.lerp(inRite ? tint : tint.setRGB(1, 1, 1), k);
      o.grade.uSat.value = mood.sat; o.grade.uVignette.value = mood.vignette; o.grade.uGrain.value = mood.grain; o.grade.uTint.value.copy(mood.tint); o.grade.uTime.value = t;
      const smoke = walkingOn ? sm(zones.ash[0] - 60, zones.ash[0] + 6, s) * (1 - sm(zones.ash[1], zones.ash[1] + 25, s)) * (warL.done ? .4 : 1) : 0;
      air.update(t, { mist: inRite ? 1 : .45, smoke, war: walkingOn && !warL.done ? sm(zones.ash[0] - 60, zones.ash[0] + 6, s) : 0 });
      // ── the crest's fire behind your stone, lit once your name is on it
      crestLit += ((youL.done ? 1 : 0) - crestLit) * Math.min(1, dt * .8); crestFire.set(crestLit); crestFire.material.uniforms.uTime0.value = sceneTime; crestFire.material.uniforms.uGlobal.value = fl; crestLight.intensity = crestLit * 7 * fl;
      // ── embers from the nearest fires
      { const pos = embers.geometry.attributes.position as THREE.BufferAttribute, col = embers.geometry.attributes.color as THREE.BufferAttribute, sources = nearest.filter(n => n.d > 12).slice(0, 6);
        emberState.forEach((e, i) => {
          e.age += dt;
          if (e.age > e.life) {
            const source = sources.length ? sources[Math.floor(Math.random() * sources.length)].c.top.clone().add(new THREE.Vector3(0, .25, 0)) : null;
            if (source && Math.random() < dt * 30) { e.p.copy(source).add(new THREE.Vector3((Math.random() - .5) * .12, 0, (Math.random() - .5) * .12)); e.v.set((Math.random() - .5) * .25, .45 + Math.random() * .7, (Math.random() - .5) * .25); e.age = 0; e.life = 1 + Math.random() * 1.8; }
          }
          const u = e.age / e.life, a = e.age < e.life ? Math.sin(Math.PI * Math.min(1, u)) * (.6 + .4 * Math.sin(t * 23 + i)) * (1 - g * .5) : 0;
          e.p.addScaledVector(e.v, dt); e.p.x += Math.sin(t * 2 + i) * dt * .12; e.v.y *= 1 - dt * .4;
          pos.setXYZ(i, e.p.x, e.p.y, e.p.z); col.setXYZ(i, a, a * .46, a * .14);
        });
        pos.needsUpdate = col.needsUpdate = true; }
      // ── fireflies over the fields and the open country
      { flyAmount += (((state === "walk" && s > 150 && s < 330) || state === "home" ? 1 : 0) - flyAmount) * Math.min(1, dt * .5);
        if (flyHome.distanceTo(camera.position) > 18) flyHome.copy(camera.position).add(camera.getWorldDirection(tmp).setY(0).normalize().multiplyScalar(9));
        const pos = flies.geometry.attributes.position as THREE.BufferAttribute, col = flies.geometry.attributes.color as THREE.BufferAttribute;
        flySeed.forEach(([a, b, c], i) => { const x = flyHome.x + (a - .5) * 30 + Math.sin(t * .3 + c * 9) * 1.4, z = flyHome.z + (b - .5) * 30 + Math.cos(t * .27 + a * 7) * 1.4, y = height(x, z) + .4 + c * 1.6 + Math.sin(t * .8 + b * 5) * .25;
          const blink = Math.pow(Math.max(0, Math.sin(t * (1 + c) + a * 40)), 8) * flyAmount; pos.setXYZ(i, x, y, z); col.setXYZ(i, blink * .55, blink, blink * .35); });
        pos.needsUpdate = col.needsUpdate = true; }
      sound.update(lit, g, s > zones.forest[1] && state === "walk" ? 1 : 0, scoreMix(t));
      const ducking = state !== "idle" || (homeAt > 0 && t - homeAt < 24); if (ducking !== ducked) { ducked = ducking; api?.duckMusic(ducking); }
      land.update(camera);
      return state !== "idle" || ascents.length > 0 || stars.some(x => x.metAt > -1 && time - x.metAt < 8);
    },
  };
}
