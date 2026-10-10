import * as THREE from "three";
import { fireVertex, fireFragment } from "./shaders";
import { ritePoints } from "./rite-path.ts";
import { riteStations, riteUi, resolveFigure, stationLabel, say, RITE_LENGTH, type Lang, type RiteStation } from "./rite.ts";
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
};

const FIRE = new THREE.Vector3(-1, 0, -5);
const STAND = new THREE.Vector3(.55, 0, -6.4);
const STORE = "bb-rite";
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function seeded(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const additive = (map: THREE.Texture, color: number, opacity = 1) => new THREE.SpriteMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

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
    : new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.position.copy(point).addScaledVector(normal, .02); mesh.lookAt(point.clone().add(normal)); mesh.rotateZ((Math.random() - .5) * .5);
  return mesh;
}
function flameMaterial() {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uWind: { value: 0 } }, vertexShader: fireVertex, fragmentShader: fireFragment });
}

export function createRite(o: Options) {
  const { scene, camera, glowTexture, height } = o;
  let lang: Lang = (() => {
    try { const v = localStorage.getItem("bb-lang"); if (v === "en" || v === "zh") return v; } catch { /* storage unavailable */ }
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  })();
  let api: ExplorationApi | null = null;

  // ─── The path as a curve, walked by arc length ───
  const curve = new THREE.CatmullRomCurve3(ritePoints.map(([x, z]) => new THREE.Vector3(x, height(x, z), z)), false, "centripetal");
  const length = curve.getLength();
  const at = (s: number) => { const p = curve.getPointAt(THREE.MathUtils.clamp(s / RITE_LENGTH, 0, 1)); p.y = height(p.x, p.z); return p; };
  const tangent = (s: number) => curve.getTangentAt(THREE.MathUtils.clamp(s / RITE_LENGTH, 0, 1));
  const lakeward = (s: number) => {
    const t = tangent(s), n = new THREE.Vector3(-t.z, 0, t.x).normalize(), p = at(s);
    const towardLake = new THREE.Vector3(150, 0, -180).sub(p).setY(0).normalize();
    return n.dot(towardLake) > 0 ? n : n.negate();
  };
  const beside = (s: number, side: number, off: number) => { const q = at(s).addScaledVector(lakeward(s), side * off); q.y = height(q.x, q.z); return q; };

  const root = new THREE.Group(); root.name = "The walk"; scene.add(root);
  const targets: THREE.Object3D[] = [];
  const stone = new THREE.MeshStandardMaterial({ color: 0x6d675d, roughness: 1 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: .95 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb48b52, metalness: .75, roughness: .38 });
  const rockMesh = (scale: THREE.Vector3) => {
    const mesh = o.rock ? new THREE.Mesh(o.rock.geometry, o.rock.material) : new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 3), stone);
    mesh.scale.copy(scale); mesh.castShadow = mesh.receiveShadow = true; return mesh;
  };

  // ─── The visible start: a torch planted beside the fire ───
  let standEmber: THREE.Sprite;
  const stand = new THREE.Group(); stand.position.set(STAND.x, height(STAND.x, STAND.z), STAND.z); stand.rotation.z = -.08; root.add(stand);
  { const staff = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, 1.45, 8), darkWood); staff.position.y = .72; staff.castShadow = true; stand.add(staff);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(.06, .045, .2, 10), new THREE.MeshStandardMaterial({ color: 0x241810, roughness: 1 })); head.position.y = 1.5; stand.add(head);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 1.9, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .9; hit.userData = { kind: "stand" }; stand.add(hit); targets.push(hit);
    standEmber = new THREE.Sprite(additive(glowTexture, 0xff7a2a, .55)); standEmber.position.y = 1.56; standEmber.scale.setScalar(.32); stand.add(standEmber); }
  const fireHit = new THREE.Mesh(new THREE.CylinderGeometry(.5, 1.2, 1.6, 12), new THREE.MeshBasicMaterial({ visible: false }));
  fireHit.position.set(FIRE.x, height(FIRE.x, FIRE.z) + .8, FIRE.z); fireHit.userData = { kind: "gate", station: 0 }; root.add(fireHit); targets.push(fireHit);

  // ─── The torch you carry ───
  scene.add(camera);
  const torch = new THREE.Group(); torch.position.set(.34, -.46, -.7); torch.rotation.z = -.12; torch.visible = false; camera.add(torch);
  const torchFlame = flameMaterial();
  { const stick = new THREE.Mesh(new THREE.CylinderGeometry(.016, .022, .5, 8), darkWood); stick.position.y = -.2; torch.add(stick);
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(.03, .026, .07, 8), new THREE.MeshStandardMaterial({ color: 0x1a110a, emissive: 0x6a2406, emissiveIntensity: .5, roughness: 1 })); wrap.position.y = .04; torch.add(wrap);
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(.15, .24), torchFlame); flame.position.y = .17; torch.add(flame); }
  const torchLight = new THREE.PointLight(0xffa052, 0, 9, 2); torchLight.position.set(.3, -.1, -.6); camera.add(torchLight);

  // ─── Cairns along the shore, lit by your torch as you pass ───
  const cairnFlame = flameMaterial();
  const groundGlow = new THREE.MeshBasicMaterial({ map: glowTexture, color: 0xff9a4a, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  type Cairn = { s: number; base: THREE.Vector3; flame: THREE.Mesh; glow: THREE.Mesh; lit: number };
  const cairns: Cairn[] = [];
  { const r = seeded(91), stoneGeo = new THREE.IcosahedronGeometry(1, 1), sp = stoneGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), n = 1 + .12 * Math.sin(x * 6 + z * 4) * Math.cos(y * 7); sp.setXYZ(i, x * n, y * n * .55, z * n); }
    stoneGeo.computeVertexNormals();
    for (let s = 3.2, k = 0; s < length - 3; s += 6.4, k++) {
      if (riteStations.some(st => Math.abs(st.s - s) < 2.5 && st.kind !== "fire")) continue;
      const base = beside(s, k % 2 ? 1 : -1, 1.3), g = new THREE.Group(); g.position.copy(base); root.add(g);
      let y = 0; for (let j = 0; j < 3; j++) { const size = .2 - j * .045 + r() * .03, m = new THREE.Mesh(stoneGeo, stone); m.scale.setScalar(size); m.position.set((r() - .5) * .04, y + size * .5, (r() - .5) * .04); m.rotation.y = r() * 6; m.castShadow = m.receiveShadow = true; g.add(m); y += size * .95; }
      const flame = new THREE.Mesh(new THREE.PlaneGeometry(.3, .44), cairnFlame); flame.position.set(base.x, base.y + y + .16, base.z); flame.scale.setScalar(.001); root.add(flame);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), groundGlow); glow.rotation.x = -Math.PI / 2; glow.position.set(base.x, base.y + .03, base.z); glow.visible = false; root.add(glow);
      cairns.push({ s, base, flame, glow, lit: 0 });
    } }
  const pool = Array.from({ length: o.small ? 2 : 3 }, () => { const l = new THREE.PointLight(0xffa052, 0, 8, 2); root.add(l); return l; });

  // ─── Stations ───
  type Live = { st: RiteStation; i: number; pos: THREE.Vector3; group: THREE.Group; done: boolean; name?: string; doneAt: number; update?: (t: number, dt: number) => void; act?: (hit?: THREE.Intersection) => void; focus: THREE.Vector3 };
  const live: Live[] = riteStations.map((st, i) => {
    const side = st.kind === "you" ? 1 : -1, off = st.kind === "you" ? 2.4 : 3;
    const pos = st.kind === "fire" ? FIRE.clone().setY(height(FIRE.x, FIRE.z)) : beside(st.s, side, off);
    const group = new THREE.Group(); group.position.copy(pos);
    const look = at(st.s); group.lookAt(look.x, pos.y, look.z); root.add(group);
    return { st, i, pos, group, done: false, doneAt: -1, focus: pos.clone().add(new THREE.Vector3(0, 1.1, 0)) };
  });
  const gateTarget = (mesh: THREE.Object3D, i: number) => { mesh.userData = { kind: "gate", station: i }; targets.push(mesh); };
  const myHands: THREE.Mesh[] = [];

  // 1 · the hand rock: ancestors' ochre, then yours in light
  { const L1 = live[1], rock = rockMesh(new THREE.Vector3(2.4, 2.1, 1.3)); rock.position.set(0, 0, -.6); L1.group.add(rock); gateTarget(rock, 1);
    L1.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), from = at(L1.st.s).setY(at(L1.st.s).y + 1.2);
    [["168,56,30", -.45, .9], ["132,34,20", .35, 1.35], ["176,72,36", .05, .55], ["214,196,168", -.15, 1.6]].forEach(([c, dx, dy], k) => {
      const aim = L1.pos.clone().add(new THREE.Vector3(0, Number(dy), 0)).addScaledVector(tangent(L1.st.s), Number(dx));
      ray.set(from.clone().setY(aim.y), aim.clone().sub(from.clone().setY(aim.y)).normalize());
      const hit = ray.intersectObject(rock)[0];
      if (hit && hit.face) root.add(decal(stencil(String(c), 100 + k, false), hit.point, hit.face.normal.clone().transformDirection(rock.matrixWorld), .55, false));
    });
    L1.act = hit => {
      let point = L1.focus.clone(), normal = at(L1.st.s).sub(L1.pos).setY(0).normalize();
      if (hit && hit.object === rock && hit.face) { point = hit.point.clone(); normal = hit.face.normal.clone().transformDirection(rock.matrixWorld); }
      const hand = decal(stencil("255,196,120", 501, true), point, normal, .72, true); hand.userData.born = time; root.add(hand); myHands.push(hand);
    }; }

  // 2 · the seed: a field of light-gold grain grows outward from your hand
  { const L2 = live[2];
    const mound = new THREE.Mesh(new THREE.SphereGeometry(.7, 18, 8), new THREE.MeshStandardMaterial({ color: 0x2c2016, roughness: 1 })); mound.scale.y = .18; L2.group.add(mound);
    const seed = new THREE.Sprite(additive(glowTexture, 0xffd27a, .8)); seed.position.y = .25; seed.scale.setScalar(.45); L2.group.add(seed);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(.9, 10, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .4; L2.group.add(hit); gateTarget(hit, 2);
    let field: THREE.InstancedMesh | null = null; const plants: { x: number; z: number; y: number; r: number; h: number; ry: number }[] = [];
    if (o.grass) {
      const material = o.grass.material.clone(); material.color.set(0xe2bf72); material.emissive = new THREE.Color(0x6a4a12); material.emissiveIntensity = .85;
      field = new THREE.InstancedMesh(o.grass.geometry, material, o.small ? 380 : 700); const r = seeded(7);
      for (let k = 0; k < field.count; k++) { let x = 0, z = 0, rad = 0, tries = 0;
        do { const a = r() * Math.PI * 2; rad = 1 + Math.pow(r(), .8) * 7.5; x = L2.pos.x + Math.cos(a) * rad; z = L2.pos.z + Math.sin(a) * rad; } while (at(L2.st.s).distanceTo(new THREE.Vector3(x, at(L2.st.s).y, z)) < 1.6 && ++tries < 12);
        plants.push({ x, z, y: height(x, z) - .01, r: rad, h: 1.7 + r() * 1.1, ry: r() * 6.28 }); }
      const m = new THREE.Object3D(); plants.forEach((p, k) => { m.position.set(p.x, p.y, p.z); m.scale.set(1, .001, 1); m.updateMatrix(); field!.setMatrixAt(k, m.matrix); });
      field.receiveShadow = true; o.wind.install(field, "grass"); field.frustumCulled = false; root.add(field);
    }
    const m = new THREE.Object3D(); let grown = 0;
    L2.update = t => { seed.material.opacity = L2.done ? Math.max(0, 1 - (t - L2.doneAt)) : .55 + .35 * Math.sin(t * 3);
      if (!field || !L2.done || grown >= 1) return; const age = t - L2.doneAt; grown = sm(0, 1, (age - 9) / 1);
      plants.forEach((p, k) => { const g = sm(0, 1, (age - p.r * .35) / 2.4); m.position.set(p.x, p.y, p.z); m.rotation.set(0, p.ry, 0); m.scale.set(.75, Math.max(.001, g * p.h), .75); m.updateMatrix(); field!.setMatrixAt(k, m.matrix); });
      field.instanceMatrix.needsUpdate = true; }; }

  // 3 · the clay tablet: old wedges above, your name below
  let paintTablet = () => {};
  { const L3 = live[3], W = 600, H = 820, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!, tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const r = seeded(55), rows = Array.from({ length: 5 }, () => Array.from({ length: 6 }, () => String.fromCodePoint(0x12000 + Math.floor(r() * 0x300))));
    let pressed = 0;
    paintTablet = () => {
      const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, "#b38f64"); grd.addColorStop(1, "#8f6c48"); g.fillStyle = grd; g.fillRect(0, 0, W, H);
      const rr = seeded(3); for (let i = 0; i < 5000; i++) { g.fillStyle = rr() > .5 ? "rgba(255,240,215,.05)" : "rgba(40,24,12,.06)"; g.fillRect(rr() * W, rr() * H, 2, 2); }
      g.font = '62px "Noto Sans Cuneiform"'; g.textAlign = "center"; g.textBaseline = "middle";
      rows.forEach((row, y) => { row.forEach((ch, x) => { const X = 80 + x * 88, Y = 80 + y * 86; g.fillStyle = "rgba(255,236,208,.3)"; g.fillText(ch, X + 2, Y + 2); g.fillStyle = "rgba(58,36,20,.9)"; g.fillText(ch, X, Y); }); g.fillStyle = "rgba(60,40,24,.35)"; g.fillRect(30, 80 + y * 86 + 42, W - 60, 2); });
      const name = [...(L3.name || (lang === "zh" ? "我" : "I"))], size = Math.min(118, (W - 80) / Math.max(1, name.length) / (lang === "zh" ? 1 : .62));
      g.font = `600 ${size}px "Noto Serif TC","Source Serif 4",serif`;
      const text = name.slice(0, pressed).join(""); g.fillStyle = "rgba(255,236,208,.35)"; g.fillText(text, W / 2 + 3, H - 150 + 3); g.fillStyle = "rgba(52,30,16,.92)"; g.fillText(text, W / 2, H - 150);
      if (pressed >= name.length && pressed > 0) { g.font = '500 32px "Noto Serif TC","Source Serif 4",serif'; g.fillStyle = "rgba(52,30,16,.7)"; g.fillText(lang === "zh" ? `西元 ${new Date().getFullYear()} 年` : `${new Date().getFullYear()} CE`, W / 2, H - 58); }
      tex.needsUpdate = true;
    };
    (L3 as Live & { name?: string }).name = "";
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: .95 }), side = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.44, .16), [side, side, side, side, face, side]); slab.position.y = 1.3; slab.rotation.x = -.06; slab.castShadow = true; L3.group.add(slab); gateTarget(slab, 3);
    const plinth = rockMesh(new THREE.Vector3(1.5, .7, .8)); plinth.position.set(0, -.15, -.05); L3.group.add(plinth);
    let writing = false;
    L3.act = () => { if (writing) return; writing = true; const total = [...(L3.name || (lang === "zh" ? "我" : "I"))].length; const step = () => { pressed++; paintTablet(); if (pressed <= total) setTimeout(step, 420); else { writing = false; } }; step(); };
    document.fonts?.load('62px "Noto Sans Cuneiform"', "\u{12000}").then(() => paintTablet()).catch(() => paintTablet()); }

  // 4 · four plinths beneath four stars
  const plinths: THREE.Vector3[] = [];
  { const L4 = live[4]; [-1.9, -.65, .65, 1.9].forEach(x => { const p = rockMesh(new THREE.Vector3(.75, .55, .75)); p.position.set(x, 0, -.3 + Math.abs(x) * .3); L4.group.add(p); L4.group.updateMatrixWorld(true); plinths.push(p.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .42, 0))); }); }

  // 5 · the armillary: geocentric loops relax into heliocentric orbits
  { const L5 = live[5], arm = new THREE.Group(); arm.position.y = 2.1; L5.group.add(arm);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, 1.5, 10), darkWood); post.position.y = .75; post.castShadow = true; L5.group.add(post);
    const rings = [[0, 0], [1.2, .3], [.4, 1.1]].map(([rx, ry]) => { const t = new THREE.Mesh(new THREE.TorusGeometry(.9, .012, 6, 96), brass); t.rotation.set(rx, ry, 0); t.castShadow = true; arm.add(t); return t; });
    const sun = new THREE.Sprite(additive(glowTexture, 0xffc070)); sun.scale.setScalar(.4); arm.add(sun);
    const planets = [[.387, 0xbfae9a, .025], [.723, 0xecd6a8, .032], [1, 0x78aaee, .036], [1.524, 0xe07a5a, .028], [5.2, 0xdcc08e, .055]].map(([a, c, r], k) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: c })); arm.add(s);
      const trail = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(120 * 3), 3)), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }));
      trail.frustumCulled = false; arm.add(trail); return { a, s, trail, ph: k * 1.3 };
    });
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 2.1; L5.group.add(hit); gateTarget(hit, 5);
    const P = (p: { a: number; ph: number }, Y: number) => { const an = p.ph + Math.PI * 2 * Y / Math.pow(p.a, 1.5), r = Math.sqrt(p.a) * .33; return new THREE.Vector3(Math.cos(an) * r, 0, -Math.sin(an) * r); };
    L5.update = (t, dt) => { const k = L5.done ? sm(0, 1, (t - L5.doneAt) / 4) : 0, Y = t * .22, E = (y: number) => P(planets[2], y);
      rings.forEach((ring, j) => { ring.rotation.z += dt * (.05 + j * .03); });
      sun.position.copy(E(Y)).multiplyScalar(-(1 - k));
      for (const p of planets) { p.s.position.copy(P(p, Y).sub(E(Y).multiplyScalar(1 - k))); const a = p.trail.geometry.attributes.position as THREE.BufferAttribute;
        for (let j = 0; j < 120; j++) { const y = Y - j / 120 * THREE.MathUtils.lerp(2.4, Math.min(2.4, Math.pow(p.a, 1.5) * .95), k); const q = P(p, y).sub(E(y).multiplyScalar(1 - k)); a.setXYZ(j, q.x, q.y, q.z); }
        a.needsUpdate = true; } }; }

  // 6 · a difference engine: figure wheels that carry, one into the next
  { const L6 = live[6], frame = new THREE.Group(); L6.group.add(frame);
    for (const x of [-.42, .42]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.7, .08), darkWood); post.position.set(x, .85, 0); post.castShadow = true; frame.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.98, .08, .1), darkWood); beam.position.y = 1.72; frame.add(beam);
    const digits = canvasTexture(512, 64, g => { g.fillStyle = "#a07a45"; g.fillRect(0, 0, 512, 64); g.fillStyle = "#2a1c0e"; g.font = '600 40px "Source Serif 4",serif'; g.textAlign = "center"; g.textBaseline = "middle"; for (let d = 0; d < 10; d++) g.fillText(String(d), 25.6 + d * 51.2, 34); });
    digits.wrapS = THREE.RepeatWrapping;
    const wheelMat = [new THREE.MeshStandardMaterial({ map: digits, metalness: .6, roughness: .45 }), brass, brass];
    const wheels = Array.from({ length: 6 }, (_, j) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .11, 40), wheelMat); w.position.set(0, .45 + j * .2, 0); w.castShadow = true; frame.add(w); return { w, value: (j * 3) % 10, shown: (j * 3) % 10 }; });
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.3, 8), brass); axle.position.y = 1; frame.add(axle);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, .7), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .9; L6.group.add(hit); gateTarget(hit, 6);
    let ticks = 0, next = 0;
    L6.update = (t, dt) => { if (L6.done && ticks < 40 && t > next) { next = t + .32; ticks++; let carry = 1; for (const w of wheels) { if (!carry) break; w.value = (w.value + 1) % 10; carry = w.value === 0 ? 1 : 0; } }
      for (const w of wheels) { w.shown += (((w.value - w.shown + 15) % 10) - 5) * Math.min(1, dt * 8); w.w.rotation.y = -w.shown / 10 * Math.PI * 2; } }; }

  // 7 · ashes: a burnt wall, a candle, a promise
  let paintPlaque = () => {};
  { const L7 = live[7], burnt = new THREE.MeshStandardMaterial({ color: 0x24201d, roughness: 1 });
    [[-1.5, 1, .2, 1.1, 2, .35], [-.35, .7, .1, 1, 1.4, .3], [.85, .5, -.25, 1.2, 1, .3], [1.85, .25, .4, .8, .5, .3]].forEach(([x, y, rz, w, h, d]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), burnt); b.position.set(x, y, -.9); b.rotation.z = rz; b.castShadow = b.receiveShadow = true; L7.group.add(b); });
    const block = rockMesh(new THREE.Vector3(.7, .7, .7)); block.position.set(0, 0, .2); L7.group.add(block);
    // the candle stands on the stone, whatever shape the scanned rock has
    block.geometry.computeBoundingBox(); const top = (block.geometry.boundingBox?.max.y ?? .7) * block.scale.y - .02;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .3, 12), new THREE.MeshStandardMaterial({ color: 0xe9dfca, roughness: .6, emissive: 0x6a4410, emissiveIntensity: 0 })); candle.position.set(0, top + .15, .2); L7.group.add(candle); gateTarget(candle, 7);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(.5, 10, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, top + .2, .2); L7.group.add(hit); gateTarget(hit, 7);
    const flameMat = flameMaterial(), flame = new THREE.Mesh(new THREE.PlaneGeometry(.12, .2), flameMat); flame.position.set(0, top + .38, .2); flame.visible = false; L7.group.add(flame);
    const candleLight = new THREE.PointLight(0xffb060, 0, 6, 2); candleLight.position.set(0, top + .55, .3); L7.group.add(candleLight);
    const plaqueTex = canvasTexture(1024, 300, () => {}), plaqueCanvas = plaqueTex.image as HTMLCanvasElement;
    paintPlaque = () => { const g = plaqueCanvas.getContext("2d")!; g.clearRect(0, 0, 1024, 300); g.textAlign = "center"; g.fillStyle = "#f3e2c2"; g.shadowColor = "#000"; g.shadowBlur = 12;
      const [quote, source] = riteUi.udhr[lang].split(lang === "zh" ? "——" : " — ");
      g.font = lang === "zh" ? '600 46px "Noto Serif TC",serif' : 'italic 40px "Source Serif 4",serif';
      // wrap to the plaque width, by word in English and by character in Chinese
      const units = lang === "zh" ? [...quote] : quote.split(" "), rows: string[] = []; let row = "";
      for (const unit of units) { const test = row ? row + (lang === "zh" ? "" : " ") + unit : unit; if (g.measureText(test).width > 900 && row) { rows.push(row); row = unit; } else row = test; }
      rows.push(row); rows.forEach((r, k) => g.fillText(r, 512, 150 - (rows.length - 1) * 26 + k * 52));
      g.font = lang === "zh" ? '400 28px "Noto Serif TC",serif' : '400 26px "Outfit",sans-serif'; g.fillStyle = "#bfb39b"; g.fillText((lang === "zh" ? "——" : "— ") + source, 512, 252); plaqueTex.needsUpdate = true; };
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.8, .82), new THREE.MeshBasicMaterial({ map: plaqueTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); plaque.position.set(.2, 1.85, -.7); L7.group.add(plaque);
    L7.update = t => { const k = L7.done ? sm(0, 1, (t - L7.doneAt) / 1.5) : 0, fl = .85 + .15 * Math.sin(t * 13) * Math.sin(t * 5.7);
      flame.visible = k > 0; flameMat.uniforms.uTime.value = t; flameMat.uniforms.uIntensity.value = k * fl; candle.material.emissiveIntensity = k * .7; candleLight.intensity = k * 5 * fl;
      plaque.material.opacity = L7.done ? sm(0, 1, (t - L7.doneAt - 2.5) / 2) : 0; flame.lookAt(camera.position.x, flame.getWorldPosition(new THREE.Vector3()).y, camera.position.z); }; }

  // 8 · the network: a small world of nodes that wakes together
  { const L8 = live[8], net = new THREE.Group(); net.position.y = 1.35; L8.group.add(net);
    const pedestal = rockMesh(new THREE.Vector3(.8, .5, .8)); L8.group.add(pedestal);
    const N = 34, pts: THREE.Vector3[] = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) { const y = 1 - (i + .5) / N * 2, r = Math.sqrt(1 - y * y); pts.push(new THREE.Vector3(Math.cos(i * ga) * r, y, Math.sin(i * ga) * r).multiplyScalar(.6)); }
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: .25 });
    pts.forEach(p => { const n = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), nodeMat); n.position.copy(p); net.add(n); });
    const seg: number[] = []; pts.forEach((p, i) => pts.map((q, j) => [p.distanceTo(q), j] as [number, number]).filter(([, j]) => j !== i).sort((a, b) => a[0] - b[0]).slice(0, 3).forEach(([, j]) => { if (j > i) seg.push(p.x, p.y, p.z, pts[j].x, pts[j].y, pts[j].z); }));
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(seg, 3)), new THREE.LineBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false }));
    net.add(lines);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(.8, 10, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.35; L8.group.add(hit); gateTarget(hit, 8);
    L8.update = (t, dt) => { const k = L8.done ? sm(0, 1, (t - L8.doneAt) / 2.5) : 0; net.rotation.y += dt * (.12 + k * .2); nodeMat.opacity = .25 + .75 * k * (.8 + .2 * Math.sin(t * 4)); (lines.material as THREE.LineBasicMaterial).opacity = .08 + .5 * k; }; }

  // 9 · the stone on the shore: hold your hand there, and become a star
  let altarRing: THREE.MeshBasicMaterial;
  { const L9 = live[9], altar = rockMesh(new THREE.Vector3(1.9, .55, 1.5)); L9.group.add(altar); gateTarget(altar, 9);
    const outline = canvasTexture(256, 256, g => { const h = document.createElement("canvas"); h.width = h.height = 256; const hx = h.getContext("2d")!; hx.translate(128, 140); hx.fillStyle = hx.strokeStyle = "#fff"; handPath(hx, 44, 7); g.shadowColor = "#ffd9a0"; g.shadowBlur = 16; g.drawImage(h, 0, 0); g.globalCompositeOperation = "destination-out"; g.shadowBlur = 0; g.drawImage(h, 4, 4, 248, 248); });
    altarRing = new THREE.MeshBasicMaterial({ map: outline, color: 0xffd090, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), altarRing); ring.rotation.x = -Math.PI / 2; ring.position.y = .5; L9.group.add(ring); }

  // ─── The walk's own stars, hung above their stations; each wakes a figure of light ───
  const figureTex = canvasTexture(256, 512, g => { const gr = g.createLinearGradient(0, 40, 0, 512); gr.addColorStop(0, "rgba(255,240,210,1)"); gr.addColorStop(.6, "rgba(255,200,130,.55)"); gr.addColorStop(1, "rgba(255,170,90,0)"); g.fillStyle = gr; g.shadowColor = "rgba(255,200,140,.9)"; g.shadowBlur = 30;
    g.beginPath(); g.arc(128, 78, 30, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(104, 112); g.quadraticCurveTo(58, 118, 54, 170); g.lineTo(36, 500); g.lineTo(220, 500); g.lineTo(202, 170); g.quadraticCurveTo(198, 118, 152, 112); g.closePath(); g.fill(); });
  const beamTex = canvasTexture(16, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(.5, "rgba(255,255,255,.7)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 16, 256); });
  type Star = { ref: string; station: number; pos: THREE.Vector3; sprite: THREE.Sprite; hit: THREE.Mesh; figure: THREE.Sprite; beam: THREE.Mesh; metAt: number };
  const sky = new THREE.Group(); sky.name = "The walk's stars"; root.add(sky);
  const stars: Star[] = [];
  live.forEach(L => L.st.figures.forEach((ref, k, all) => {
    const u = all.length > 1 ? k / (all.length - 1) - .5 : 0, side = lakeward(L.st.s).negate();
    const pos = L.pos.clone().addScaledVector(side, -6).addScaledVector(tangent(L.st.s), u * 26).add(new THREE.Vector3(0, 34 + Math.cos(u * 3) * 5 + L.i * 1.2, 0));
    const sprite = new THREE.Sprite(additive(glowTexture, 0xfff1d6)); sprite.position.copy(pos); sprite.scale.setScalar(.7); sky.add(sprite);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.copy(pos); hit.userData = { kind: "star", index: stars.length }; root.add(hit); targets.push(hit);
    const foot = L.st.kind === "axial" ? plinths[k].clone() : beside(L.st.s + u * 4, -1, 1.9).add(new THREE.Vector3(0, 0, 0));
    if (L.st.kind !== "axial") { const toward = at(L.st.s).sub(L.pos).setY(0).normalize(); foot.copy(L.pos).addScaledVector(toward, .2).addScaledVector(tangent(L.st.s), (k - (all.length - 1) / 2) * 1.05 + (L.st.kind === "hand" ? 1.9 : 1.6)); foot.y = height(foot.x, foot.z); }
    const figure = new THREE.Sprite(new THREE.SpriteMaterial({ map: figureTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })); figure.center.set(.5, 0); figure.scale.set(.72, 1.62, 1); figure.position.copy(foot); root.add(figure);
    const span = pos.distanceTo(foot), beam = new THREE.Mesh(new THREE.CylinderGeometry(.02, .16, span, 8, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: 0xffe0b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.copy(pos).add(foot).multiplyScalar(.5); beam.lookAt(pos); beam.rotateX(Math.PI / 2); beam.visible = false; root.add(beam);
    stars.push({ ref, station: L.i, pos, sprite, hit, figure, beam, metAt: -1 });
  }));
  const constellation = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf6dcae, transparent: true, opacity: .42, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  constellation.frustumCulled = false; root.add(constellation);
  const mine = new THREE.Sprite(additive(glowTexture, 0xffc070, 0)); mine.renderOrder = 2; sky.add(mine);
  const mineHit = new THREE.Mesh(new THREE.SphereGeometry(3.6, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); mineHit.userData = { kind: "mine" }; mineHit.visible = false; root.add(mineHit);
  const trail = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  trail.frustumCulled = false; root.add(trail);
  const altarTop = live[9].pos.clone().add(new THREE.Vector3(0, .6, 0));
  const MINE = altarTop.clone().addScaledVector(lakeward(riteStations[9].s), 30).add(new THREE.Vector3(0, 36, 0));
  const reflection = o.mirror(sky); // the lake holds the same stars, yours included
  const syncReflection = () => sky.children.forEach((child, i) => { const m = reflection.children[i]; if (m) { m.position.copy(child.position); m.scale.copy(child.scale); } });
  function rebuildConstellation() {
    const points = stars.filter(s => s.metAt >= 0).sort((a, b) => a.station - b.station).map(s => s.pos);
    if (mineAt >= 0 && time - mineAt > 7) points.push(mine.position.clone());
    constellation.geometry.dispose(); constellation.geometry = new THREE.BufferGeometry().setFromPoints(points.length > 1 ? points : []);
  }

  // ─── State, persistence ───
  let time = 0, state: "idle" | "intro" | "walk" | "done" = "idle", index = 0, phase: "travel" | "narrate" | "act" | "after" | "free" = "travel", phaseAt = 0;
  let s = 0, holding = false, holdT = 0, mineAt = -1, gloom = 0, lookBackAt = -1, name = "", walkKey = false, autoWalk = false, approach = 0;
  const approachFrom = new THREE.Vector3();
  type Saved = { name: string; date: string };
  let saved: Saved | null = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) || "null"); } catch { saved = null; }
  if (saved) { mine.position.copy(MINE); mine.material.opacity = 1; mine.scale.setScalar(2.4); mineHit.position.copy(MINE); mineHit.visible = true; targets.push(mineHit); }

  // ─── DOM ───
  const panel = el("rite-panel"), eyebrow = el("rite-eyebrow"), line = el("rite-line"), actBtn = el<HTMLButtonElement>("rite-act"), nextBtn = el<HTMLButtonElement>("rite-next"), leaveBtn = el<HTMLButtonElement>("rite-leave");
  const startCard = el("rite-start"), nameInput = el<HTMLInputElement>("rite-name"), beginBtn = el<HTMLButtonElement>("rite-begin"), fade = el("rite-fade"), langBtn = el<HTMLButtonElement>("lang-toggle");
  function paintStatic() {
    document.documentElement.dataset.riteLang = lang;
    langBtn.textContent = lang === "zh" ? "EN" : "中文"; langBtn.setAttribute("aria-label", lang === "zh" ? "Switch to English" : "切換為中文");
    el("rite-start-eyebrow").textContent = riteUi.startEyebrow[lang]; el("rite-start-title").textContent = riteUi.startTitle[lang]; el("rite-start-text").textContent = riteUi.startText[lang];
    el("rite-name-label").textContent = riteUi.name[lang]; beginBtn.textContent = (state === "idle" || state === "intro") && index > 0 ? riteUi.resume[lang] : riteUi.begin[lang];
    leaveBtn.textContent = riteUi.leave[lang]; nextBtn.textContent = riteUi.next[lang];
    const guide = el("rite-guide-name"); if (guide) guide.textContent = riteUi.startTitle[lang];
    paintTablet(); paintPlaque(); render();
  }
  langBtn.addEventListener("click", () => { lang = lang === "zh" ? "en" : "zh"; try { localStorage.setItem("bb-lang", lang); } catch { /* ignore */ } paintStatic(); });
  let lineText = "";
  function setLine(text: string) { if (text === lineText) return; lineText = text; line.classList.remove("show"); void line.offsetWidth; line.textContent = text; if (text) line.classList.add("show"); }
  function render() {
    if (state !== "walk" && state !== "done") return;
    const st = riteStations[index];
    eyebrow.textContent = `${stationLabel(index, lang)} · ${st.title[lang]}`;
    actBtn.hidden = phase !== "act"; actBtn.textContent = st.act[lang];
    nextBtn.hidden = !(phase === "free" && index < riteStations.length - 1) && !(state === "done");
    nextBtn.textContent = state === "done" ? riteUi.home[lang] : riteUi.next[lang];
  }
  function showFigure(i: number) {
    const star = stars[i], figure = resolveFigure(star.ref, lang); if (!figure || !api) return;
    api.showInfo({ eyebrow: `${riteUi.starHint[lang]} · ${figure.life}`, title: figure.name, description: figure.quote ? `${figure.text}\n\n「${figure.quote}」`.replace("「", lang === "zh" ? "「" : "“").replace("」", lang === "zh" ? "」" : "”") : figure.text, href: figure.href, linkText: figure.href ? (lang === "zh" ? "關於這片星圖 ↗" : "About this constellation ↗") : undefined });
  }
  function wake(i: number, show = true) {
    const star = stars[i]; if (star.metAt < 0) { star.metAt = time; star.beam.visible = true; rebuildConstellation(); }
    if (show) showFigure(i);
    const ax = live[4]; if (state === "walk" && index === 4 && !ax.done && stars.every(x => x.station !== 4 || x.metAt >= 0)) setTimeout(() => complete(4), 1500);
  }
  function complete(i: number, hit?: THREE.Intersection) {
    const L = live[i]; if (L.done) return; L.done = true; L.doneAt = time; holding = false; holdT = 0;
    L.act?.(hit);
    if (i === 0) { torch.visible = true; stand.visible = false; }
    if (i === 9) { mineAt = time; mine.position.copy(altarTop); mine.material.opacity = 1; }
    phase = "after"; phaseAt = time; setLine(say(L.st.after, lang, name)); render();
    const own = stars.map((x, k) => [x, k] as const).filter(([x]) => x.station === i);
    own.forEach(([, k], n) => setTimeout(() => wake(k, n === 0), 1400 + n * 900));
    api?.announce(say(L.st.after, lang, name));
  }

  function begin() {
    startCard.hidden = true; name = (nameInput.value || "").trim().slice(0, 10); (live[3] as Live & { name?: string }).name = name; paintTablet();
    state = "walk"; panel.hidden = false; el("wayfinding").hidden = true; api?.clearInfo();
    if (live.every(L => L.done)) { live.forEach(L => { L.done = false; }); index = 0; s = 0; mineAt = -1; }
    approachFrom.copy(camera.position); approach = index === 0 && !live[0].done ? 0 : 1;
    if (live[index].done && index < riteStations.length - 1) index++;
    phase = "travel"; phaseAt = time; autoWalk = true; render();
  }
  function leave(home = true) {
    if (state === "idle") return; state = "idle"; panel.hidden = true; startCard.hidden = true; setLine(""); el("wayfinding").hidden = false; autoWalk = false;
    if (!home) return;
    fade.classList.add("on");
    setTimeout(() => { api?.returnToPath(true); fade.classList.remove("on"); }, api?.paused ? 0 : 900);
  }
  beginBtn.addEventListener("click", begin);
  nameInput.addEventListener("keydown", e => { if (e.key === "Enter") begin(); });
  leaveBtn.addEventListener("click", () => leave(true));
  actBtn.addEventListener("click", () => { if (phase === "act") complete(index); });
  nextBtn.addEventListener("click", () => { if (state === "done") { finishHome(); return; } if (phase === "free" && index < riteStations.length - 1) { index++; autoWalk = true; phase = "travel"; phaseAt = time; api?.clearInfo(); render(); } });
  addEventListener("keydown", e => { if (state === "walk" && (e.code === "KeyW") && !(e.target instanceof HTMLInputElement)) walkKey = true; });
  addEventListener("keyup", e => { if (e.code === "KeyW") walkKey = false; });
  function finishHome() {
    try { localStorage.setItem(STORE, JSON.stringify({ name, date: new Date().toISOString().slice(0, 10) })); saved = { name, date: new Date().toISOString().slice(0, 10) }; } catch { /* ignore */ }
    mineHit.position.copy(MINE); mineHit.visible = true; if (!targets.includes(mineHit)) targets.push(mineHit);
    leave(true);
  }
  function open() {
    if (state === "walk") return;
    state = "intro"; startCard.hidden = false; panel.hidden = true; paintStatic();
    api?.moveTo([2.4, 1.7, -3.6], [STAND.x, 1.1, STAND.z], () => { if (state === "intro") nameInput.focus({ preventScroll: true }); });
  }
  paintStatic();

  // ─── Hooks for exploration ───
  const ray2 = (ray: THREE.Raycaster) => { ray.far = 400; const hit = ray.intersectObjects(targets, false)[0]; ray.far = Infinity; return hit; };
  const hooks: RiteHooks = {
    active: () => state === "walk" || state === "done",
    hover(ray) {
      const hit = ray2(ray); if (!hit) return null; const u = hit.object.userData;
      if (u.kind === "stand") return state === "walk" ? null : riteUi.trailhead[lang];
      if (u.kind === "star") { const f = resolveFigure(stars[u.index].ref, lang); return f ? `${f.name} · ${f.life}` : null; }
      if (u.kind === "mine") return `${riteUi.yourStar[lang]} · ${saved?.name || name || ""}`;
      if (u.kind === "gate" && state === "walk" && u.station === index && phase === "act") return riteStations[index].act[lang];
      return null;
    },
    click(ray) {
      const hit = ray2(ray); if (!hit) return false; const u = hit.object.userData;
      if (u.kind === "stand") { if (state !== "walk") open(); return true; }
      if (u.kind === "star") { if (state === "walk" && (gloom < .5 || stars[u.index].station === 7)) wake(u.index); else showFigure(u.index); return true; }
      if (u.kind === "mine") { const who = saved?.name || name; api?.showInfo({ eyebrow: `${riteUi.yourStar[lang]} · ${saved?.date ?? ""}`, title: who || (lang === "zh" ? "你" : "You"), description: riteUi.carried[lang] }); return true; }
      if (u.kind === "gate" && state === "walk" && u.station === index) {
        if (phase === "narrate") { phase = "act"; phaseAt = time; setLine(riteStations[index].act[lang]); render(); return true; }
        if (phase === "act" && !riteStations[index].hold && index !== 4) { complete(index, hit); return true; }
        return true;
      }
      return state === "walk";
    },
    press(ray) {
      if (state !== "walk" || phase !== "act" || !riteStations[index].hold) return false;
      const hit = ray2(ray); if (!hit) return false; const u = hit.object.userData;
      if ((u.kind === "gate" && u.station === index) || (index === 0 && u.kind === "stand")) { holding = true; return true; }
      return false;
    },
    release() { holding = false; },
    open, exit: () => leave(true),
  };

  // ─── Frame update ───
  const tmp = new THREE.Vector3(), look = new THREE.PerspectiveCamera(), baseFog = (scene.fog as THREE.FogExp2).color.clone(), baseDensity = (scene.fog as THREE.FogExp2).density, moonBase = o.moonLight.intensity, bounceBase = o.moonBounce.intensity;
  function face(target: THREE.Vector3, rate: number) {
    if (!api || api.looking || performance.now() - api.lastLook < 2500) return;
    look.position.copy(camera.position); look.lookAt(target); camera.quaternion.slerp(look.quaternion, Math.min(1, rate)); api.syncAngles();
  }
  if (new URLSearchParams(location.search).has("ritedebug")) (window as unknown as { __rite: unknown }).__rite = {
    get state() { return { state, index, phase, s, gloom, cairnsLit: cairns.filter(c => c.lit > 0).length, met: stars.filter(x => x.metAt >= 0).length } },
    live, stars, root,
  };
  return {
    hooks,
    attach(a: ExplorationApi) { api = a; },
    update(dt: number, sceneTime: number): boolean {
      time += dt; const t = time, still = !!api?.paused;
      const next = live[index], st = next.st;
      // walking
      const stop = st.kind === "fire" ? 0 : st.s - (st.kind === "you" ? 1.6 : 2.2);
      let walking = false;
      if (state === "walk" && phase === "travel") {
        if (index === 0 && approach < 1) {
          approach = still ? 1 : Math.min(1, approach + dt / 2.4);
          const p = at(0).add(new THREE.Vector3(0, 1.7, 0)); camera.position.lerpVectors(approachFrom, p, sm(0, 1, approach)); face(next.focus, dt * 2);
          if (approach >= 1) { phase = "narrate"; phaseAt = t; }
          walking = true;
        } else if (s < stop) {
          if (autoWalk || walkKey) { s = still ? stop : Math.min(stop, s + 1.25 * dt); walking = true; }
          if (s >= stop) { phase = live[index].done ? "free" : "narrate"; phaseAt = t; render(); }
        } else { phase = live[index].done ? "free" : "narrate"; phaseAt = t; render(); }
      }
      if (state === "walk" && phase === "free" && walkKey) { index = Math.min(riteStations.length - 1, index + 1); phase = "travel"; phaseAt = t; autoWalk = false; render(); }
      if (state === "walk" && !(index === 0 && approach < 1)) {
        const p = at(s); camera.position.lerp(tmp.set(p.x, p.y + 1.7, p.z), still ? 1 : Math.min(1, dt * 6));
        if (walking) face(at(s + 6).add(new THREE.Vector3(0, 1.55, 0)), dt * 1.6);
        else if (phase !== "after" || index !== 4) face(index === 4 && phase === "act" ? stars.find(x => x.station === 4 && x.metAt < 0)?.pos ?? next.focus : next.focus, dt * 1.4);
      }
      // narration
      if (state === "walk" && phase === "narrate") { const k = Math.floor((t - phaseAt) / 4.6);
        if (k < st.lines.length) setLine((t - phaseAt) % 4.6 < 4.1 ? say(st.lines[k], lang, name) : "");
        else { phase = "act"; phaseAt = t; setLine(st.act[lang]); render(); } }
      if (state === "walk" && phase === "after" && t - phaseAt > 6) { if (index === 9) { state = "done"; lookBackAt = t; } else { phase = "free"; phaseAt = t; autoWalk = false; setLine(""); render(); } }
      if (state === "walk" && phase === "act") setLine(st.act[lang] + (holding ? ` · ${riteUi.holdHint[lang]}` : ""));
      // holds
      if (holding && phase === "act") { holdT += dt; if (holdT > 2) complete(index); } else holdT = Math.max(0, holdT - dt * 2);
      // torch, cairns, pooled light
      const ash = live[7], gIn = sm(0, 1, (s - (ash.st.s - 24)) / 18), g = state === "idle" ? 0 : ash.done ? gIn * (1 - sm(0, 1, (t - ash.doneAt - 1) / 6)) : gIn;
      gloom = g;
      const fl = .84 + .16 * Math.sin(t * 11.3) * Math.sin(t * 5.1), carry = torch.visible ? THREE.MathUtils.lerp(1, .22, g) : 0;
      torchFlame.uniforms.uTime.value = sceneTime; torchFlame.uniforms.uIntensity.value = carry * fl; torchLight.intensity = carry * 5 * fl;
      torch.visible = state !== "idle" && (live[0].done || (index === 0 && holdT > 0));
      if (index === 0 && !live[0].done) { torchFlame.uniforms.uIntensity.value = Math.min(1, holdT / 2) * fl; torchLight.intensity = holdT * 2; }
      cairnFlame.uniforms.uTime.value = sceneTime; cairnFlame.uniforms.uIntensity.value = (.95 + .1 * fl) * (1 - g * .7);
      for (const c of cairns) {
        if (live[0].done && c.lit < 1 && c.s < s + 1.6) c.lit = Math.min(1, c.lit + dt * 1.4);
        if (c.lit > 0) { c.flame.scale.setScalar(Math.max(.001, sm(0, 1, c.lit))); c.glow.visible = true; c.glow.scale.setScalar(.4 + .6 * c.lit); c.flame.lookAt(camera.position.x, c.flame.position.y, camera.position.z); }
      }
      const lit = cairns.filter(c => c.lit > 0).sort((a, b) => a.base.distanceToSquared(camera.position) - b.base.distanceToSquared(camera.position));
      pool.forEach((l, k) => { const c = lit[k]; if (!c) { l.intensity = 0; return; } l.position.copy(c.flame.position).add(new THREE.Vector3(0, .15, 0)); l.intensity = 3.2 * c.lit * fl * (1 - g * .6); });
      // the war darkens the sky, the moon and your fire
      o.skyDim.value = g; o.starDim.value = g;
      (scene.fog as THREE.FogExp2).color.lerpColors(baseFog, new THREE.Color(0x1a0f0c), g); (scene.fog as THREE.FogExp2).density = baseDensity + g * .03;
      o.moonLight.intensity = moonBase * (1 - g * .75); o.moonBounce.intensity = bounceBase * (1 - g * .6);
      // moonlight shadows follow the walker beyond the clearing
      if (state !== "idle") o.moonLight.target.position.set(camera.position.x, 0, camera.position.z); else o.moonLight.target.position.set(0, 0, -13);
      // stations
      for (const L of live) L.update?.(t, dt);
      standEmber.material.opacity = .35 + .25 * Math.sin(t * 2.1) * Math.sin(t * 3.7 + 1);
      for (const h of myHands) (h.material as THREE.MeshBasicMaterial).opacity = sm(0, 1, (t - h.userData.born) / 1.4);
      altarRing.opacity = .35 + .2 * Math.sin(t * 2) + holdT / 2 * .6;
      // stars & figures
      for (const x of stars) {
        const met = x.metAt >= 0, hidden = (x.station === 7 && !live[7].done) || (g > .4 && x.station !== 7);
        x.sprite.material.opacity = hidden ? .05 : 1; const pulse = .9 + .1 * Math.sin(t * 1.7 + x.pos.x);
        x.sprite.scale.setScalar((met ? 1.05 : .7) * pulse); x.sprite.material.color.setRGB(1, met ? .86 : .95, met ? .62 : .84);
        x.figure.material.opacity = met ? sm(0, 1, (t - x.metAt - 1) / 2) * .34 * (1 - g * .6) : 0;
        const b = x.beam.material as THREE.MeshBasicMaterial; b.opacity = met ? .24 * Math.exp(-(t - x.metAt) * .7) : 0; x.beam.visible = b.opacity > .004;
      }
      constellation.material.opacity = .42 * (1 - g);
      // your star rises
      if (mineAt >= 0) { const ft = t - mineAt, k = sm(0, 1, ft / 7); mine.position.lerpVectors(altarTop, MINE, k); mine.scale.setScalar(THREE.MathUtils.lerp(.9, 2.6, k) * (.92 + .08 * Math.sin(t * 2)));
        const a = trail.geometry.attributes.position as THREE.BufferAttribute; a.setXYZ(0, altarTop.x, altarTop.y, altarTop.z); a.setXYZ(1, mine.position.x, mine.position.y, mine.position.z); a.needsUpdate = true;
        trail.material.opacity = .7 * Math.min(1, ft) * (1 - sm(0, 1, (ft - 9) / 5));
        if (ft > 7.1 && ft - dt <= 7.1) rebuildConstellation();
        if (state === "walk" && index === 9) face(mine.position, dt * 1.2);
      }
      if (state === "done") { const lt = t - lookBackAt;
        if (lt < 2.5) face(mine.position, dt * 1.2);
        else if (lt < 14) { face(FIRE.clone().add(new THREE.Vector3(0, 4, 0)), dt * .7); setLine(riteUi.lookBack[lang]); }
        if (lt > 4) { nextBtn.hidden = false; nextBtn.textContent = riteUi.home[lang]; }
        cairns.forEach(c => { if (c.lit < 1 && (length - c.s) / 30 < lt) c.lit = Math.min(1, c.lit + dt); }); }
      syncReflection();
      return state !== "idle" || stars.some(x => x.metAt >= 0 && time - x.metAt < 8) || mineAt >= 0;
    },
  };
}
