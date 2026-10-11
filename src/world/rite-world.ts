import * as THREE from "three";
import { fireFragment } from "./shaders";
import { pointAt, riteLength, stationMeters, THRESHOLD, zones } from "./rite-path.ts";
import { riteStations, riteUi, resolveFigure, say, chronologicalSky, yearsAgoAt, yearLabel, type Lang, type RiteStation } from "./rite.ts";
import { createRiteSound, type RiteMix } from "./rite-sound.ts";
import { addRoadside } from "./rite-land.ts";
import { addAtmosphere } from "./rite-atmos.ts";
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
    attribute vec3 iPos; attribute float iLit; attribute float iSeed;
    varying vec2 vUv; varying float vInt; varying float vSeed;
    void main() {
      vUv = uv; float g = iLit * iLit * (3. - 2. * iLit); vInt = g; vSeed = iSeed;
      vec3 right = normalize(vec3(viewMatrix[0][0], 0., viewMatrix[2][0]) + vec3(1e-5, 0., 0.));
      vec3 world = iPos + right * position.x * g + vec3(0., position.y * g, 0.);
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
  geo.setAttribute("iPos", iPos); geo.setAttribute("iLit", iLit); geo.setAttribute("iSeed", new THREE.InstancedBufferAttribute(new Float32Array([Math.random() * 9]), 1)); geo.instanceCount = 1;
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

  // ─── The road, walked by the metre ───
  const at = (s: number) => { const [x, z, tx, tz] = pointAt(Math.min(s, LEN)), over = Math.max(0, s - LEN); const p = new THREE.Vector3(x + tx * over, 0, z + tz * over); p.y = height(p.x, p.z); return p; };
  const tangent = (s: number) => { const [, , tx, tz] = pointAt(Math.max(0, Math.min(s, LEN - .5))); return new THREE.Vector3(tx, 0, tz); };
  /** side +1 is on your right as you walk away from home */
  const beside = (s: number, side: number, off: number) => { const t = tangent(s), p = at(s); p.x += -t.z * side * off; p.z += t.x * side * off; p.y = height(p.x, p.z); return p; };

  const root = new THREE.Group(); root.name = "The walk"; scene.add(root);
  const land = addRoadside({ scene, height, wind: o.wind, small: o.small, forest: o.forest, rock: o.rock, grass: o.grass, ferns: o.ferns });
  const air = addAtmosphere({ scene, height, small: o.small });
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
  stand.updateMatrixWorld(true);
  const standHead = stand.localToWorld(new THREE.Vector3(0, 1.58, 0));
  const standEmber = glowSprite(glowTexture, 0xff7a2a, .55); standEmber.position.copy(standHead); standEmber.scale.setScalar(.34); root.add(standEmber);
  // once you have come home, the torch you carried burns in its stand
  const standFlame = singleFlame(.22, .34); standFlame.place(standHead.clone().add(new THREE.Vector3(0, -.03, 0))); root.add(standFlame.mesh);
  const standLight = new THREE.PointLight(0xffa052, 0, 7, 2); standLight.position.copy(standHead).add(new THREE.Vector3(0, .3, 0)); root.add(standLight);
  const fireHit = hitbox(new THREE.CylinderGeometry(.5, 1.2, 1.6, 12), "gate", 0); fireHit.position.set(FIRE.x, height(FIRE.x, FIRE.z) + .8, FIRE.z); root.add(fireHit);
  // From far away, home is a warm glow rising through the trees.
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
  const torchTip = () => torch.localToWorld(new THREE.Vector3(0, .17, 0));

  // ─── Cairns: one every few steps for half a kilometre, catching fire from your torch as you pass ───
  type Cairn = { s: number; top: THREE.Vector3; lit: number; dead: boolean };
  const cairns: Cairn[] = [];
  const deadFrom = zones.ash[0] + 4, deadTo = stationMeters[6];
  const stoneGeo = new THREE.IcosahedronGeometry(1, 1);
  { const sp = stoneGeo.attributes.position; for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), k = 1 + .12 * Math.sin(x * 6 + z * 4) * Math.cos(y * 7); sp.setXYZ(i, x * k, y * k * .55, z * k); } stoneGeo.computeVertexNormals(); }
  const stoneMatrices: THREE.Matrix4[] = [];
  { const r = seeded(91), m = new THREE.Object3D();
    for (let s = 3.4, k = 0; s < LEN - 2.5; s += 3.4, k++) {
      if (stationMeters.some((st, i) => i > 0 && Math.abs(st - s) < 2.4) || Math.abs(s - THRESHOLD) < 1.4) continue;
      const base = beside(s, k % 2 ? 1 : -1, 1.3); let y = 0;
      for (let j = 0; j < 3; j++) { const size = .19 - j * .045 + r() * .03; m.position.set(base.x + (r() - .5) * .04, base.y + y + size * .5, base.z + (r() - .5) * .04); m.rotation.set(0, r() * 6, 0); m.scale.setScalar(size); m.updateMatrix(); stoneMatrices.push(m.matrix.clone()); y += size * .95; }
      cairns.push({ s, top: base.clone().setY(base.y + y - .05), lit: 0, dead: s > deadFrom && s < deadTo });
    } }
  const N = cairns.length;
  const stones = new THREE.InstancedMesh(stoneGeo, stone, stoneMatrices.length); stoneMatrices.forEach((mx, i) => stones.setMatrixAt(i, mx)); stones.castShadow = stones.receiveShadow = true; stones.computeBoundingSphere(); root.add(stones);
  const flameGeo = new THREE.InstancedBufferGeometry();
  { const plane = new THREE.PlaneGeometry(.3, .44).translate(0, .22, 0); flameGeo.index = plane.index; flameGeo.setAttribute("position", plane.attributes.position); flameGeo.setAttribute("uv", plane.attributes.uv); }
  const iPos = new Float32Array(N * 3), iLit = new Float32Array(N), iSeed = new Float32Array(N);
  cairns.forEach((c, i) => { iPos.set([c.top.x, c.top.y, c.top.z], i * 3); iSeed[i] = (i * 7.31) % 13; });
  const litAttr = new THREE.InstancedBufferAttribute(iLit, 1);
  flameGeo.setAttribute("iPos", new THREE.InstancedBufferAttribute(iPos, 3)); flameGeo.setAttribute("iLit", litAttr); flameGeo.setAttribute("iSeed", new THREE.InstancedBufferAttribute(iSeed, 1)); flameGeo.instanceCount = N;
  const cairnFlame = flameMaterial(), flames = new THREE.Mesh(flameGeo, cairnFlame); flames.frustumCulled = false; root.add(flames);
  // Seen from far away, each lit cairn is a point of fire that never shrinks below a few pixels; home is the brightest.
  const glowPos = new Float32Array((N + 1) * 3), glowLit = new Float32Array(N + 1), glowSize = new Float32Array(N + 1);
  cairns.forEach((c, i) => { glowPos.set([c.top.x, c.top.y + .2, c.top.z], i * 3); glowSize[i] = 1; });
  glowPos.set([FIRE.x, height(FIRE.x, FIRE.z) + .9, FIRE.z], N * 3); glowSize[N] = 2.4;
  const glowGeo = new THREE.BufferGeometry(); glowGeo.setAttribute("position", new THREE.BufferAttribute(glowPos, 3));
  const glowLitAttr = new THREE.BufferAttribute(glowLit, 1); glowGeo.setAttribute("lit", glowLitAttr); glowGeo.setAttribute("size", new THREE.BufferAttribute(glowSize, 1));
  const glowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uMap: { value: glowTexture }, uPx: { value: pixelRatio }, uDim: { value: 0 }, uHome: { value: 0 } },
    vertexShader: `attribute float lit; attribute float size; uniform float uPx; uniform float uDim; uniform float uHome; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; float d = max(.1, -mv.z);
        float home = step(1.5, size); vA = mix(lit, uHome, home) * (1. - uDim * .6) * mix(.22, 1., smoothstep(14., 90., d));
        gl_PointSize = uPx * max(2.6 * size, size * 110. / d); }`,
    fragmentShader: `uniform sampler2D uMap; varying float vA; void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; if (a < .004) discard; gl_FragColor = vec4(1., .58, .25, a); }` });
  const glowPoints = new THREE.Points(glowGeo, glowMat); glowPoints.frustumCulled = false; root.add(glowPoints);
  const groundGlow = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.6, 3.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture, color: 0xff9a4a, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), N);
  const gm = new THREE.Object3D();
  const placeGlow = (i: number) => { const c = cairns[i], k = sm(0, 1, c.lit); gm.position.set(c.top.x, height(c.top.x, c.top.z) + .03, c.top.z); gm.scale.setScalar(Math.max(.001, .4 + .6 * k) * (c.lit > 0 ? 1 : .001)); gm.updateMatrix(); groundGlow.setMatrixAt(i, gm.matrix); };
  for (let i = 0; i < N; i++) placeGlow(i);
  groundGlow.frustumCulled = false; root.add(groundGlow);
  const pool = Array.from({ length: o.small ? 2 : 3 }, () => { const l = new THREE.PointLight(0xffa052, 0, 8, 2); root.add(l); return l; });
  function setCairns(value: number) { cairns.forEach((c, i) => { c.lit = value; iLit[i] = glowLit[i] = value; placeGlow(i); }); litAttr.needsUpdate = glowLitAttr.needsUpdate = true; groundGlow.instanceMatrix.needsUpdate = true; }

  // ─── Those who walked before: faint figures beside the road, each carrying a small light ───
  const figureTex = canvasTexture(256, 512, g => {
    const body = () => { g.beginPath(); g.arc(128, 78, 30, 0, Math.PI * 2); g.moveTo(104, 112); g.quadraticCurveTo(58, 118, 54, 170); g.lineTo(40, 500); g.lineTo(216, 500); g.lineTo(202, 170); g.quadraticCurveTo(198, 118, 152, 112); g.closePath(); };
    const gr = g.createLinearGradient(0, 40, 0, 512); gr.addColorStop(0, "rgba(255,238,206,.62)"); gr.addColorStop(.55, "rgba(255,200,140,.3)"); gr.addColorStop(1, "rgba(255,170,90,0)");
    g.shadowColor = "rgba(255,196,130,.85)"; g.shadowBlur = 36; g.fillStyle = gr; body(); g.fill();
    const rim = g.createLinearGradient(0, 40, 0, 512); rim.addColorStop(0, "rgba(255,246,226,.9)"); rim.addColorStop(.7, "rgba(255,214,160,.25)"); rim.addColorStop(1, "rgba(255,190,120,0)");
    g.shadowBlur = 12; g.strokeStyle = rim; g.lineWidth = 4; body(); g.stroke(); g.shadowBlur = 0;
    const r = seeded(17); for (let i = 0; i < 260; i++) { const y = 20 + r() * 490, x = 128 + (r() - .5) * (60 + y * .42); g.fillStyle = `rgba(255,${210 + r() * 40},${150 + r() * 70},${(.15 + r() * .5) * (1 - y / 560)})`; g.fillRect(x, y, 1.5 + r() * 2, 1.5 + r() * 2); } });
  type Echo = { figure: THREE.Sprite; ember: THREE.Sprite; pos: THREE.Vector3; base: number };
  const echoes: Echo[] = [];
  { const r = seeded(300);
    for (const s of [38, 60, 82, 124, 142, 196, 218, 232, 272, 292, 346, 366, 418, 428, 516, 534, 552]) {
      const pos = beside(s, r() > .5 ? 1 : -1, 6 + r() * 9);
      const figure = new THREE.Sprite(new THREE.SpriteMaterial({ map: figureTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })); figure.center.set(.5, 0); figure.scale.set(.7, 1.62, 1); figure.position.copy(pos); root.add(figure);
      const ember = glowSprite(glowTexture, 0xff9a40, 0, true); ember.position.copy(pos).add(new THREE.Vector3(.28, 1.02, 0)); ember.scale.setScalar(.32); root.add(ember);
      echoes.push({ figure, ember, pos, base: .08 + r() * .05 });
    } }

  // ─── Stations ───
  type Live = { st: RiteStation; i: number; s: number; pos: THREE.Vector3; group: THREE.Group; done: boolean; doneAt: number; focus: THREE.Vector3;
    title: ReturnType<typeof textPlane>; update?: (t: number, dt: number) => void; act?: (hit?: THREE.Intersection) => void; reset?: () => void };
  const placeOf: Record<string, [number, number]> = { hand: [1, 3.4], seed: [-1, 1.9], tablet: [1, 2.7], axial: [-1, 3.2], heavens: [1, 3], ash: [-1, 2.7] };
  const live: Live[] = riteStations.map((st, i) => {
    const s = st.s, [side, off] = placeOf[st.kind] ?? [0, 0];
    const pos = st.kind === "fire" ? FIRE.clone() : st.kind === "you" ? at(LEN).add(tangent(LEN).multiplyScalar(1.6)) : beside(s, side, off);
    pos.y = height(pos.x, pos.z);
    const group = new THREE.Group(); group.position.copy(pos); const look = at(s); if (st.kind === "you") group.lookAt(at(LEN - 4).x, pos.y, at(LEN - 4).z); else group.lookAt(look.x, pos.y, look.z); root.add(group);
    const title = textPlane(2.3, .65); title.mesh.position.copy(pos).add(new THREE.Vector3(0, st.kind === "you" ? 2.7 : 2.45, 0)); title.mesh.renderOrder = 3; root.add(title.mesh);
    return { st, i, s, pos, group, done: false, doneAt: -1, focus: pos.clone().add(new THREE.Vector3(0, 1, 0)), title };
  });
  const paintTitles = () => live.forEach(L => { if (L.i === 0) return; L.title.draw([
    { text: `${L.st.number[lang]}　${L.st.title[lang]}`, size: 82, font: `600 SIZE ${serif()}`, color: "#f3dcae", spacing: lang === "zh" ? .25 : .04 },
    { text: L.st.era[lang], size: 42, font: `400 SIZE ${serif()}`, color: "#b8c6c0", spacing: .12 }]); });
  const myHands: THREE.Mesh[] = [];
  let time = 0;

  // 1 · the rock in the forest: ancestors' hands appear only in your torchlight; then yours, in light
  const ancestorHands: THREE.Mesh[] = [];
  { const L = live[1], rock = rockMesh(new THREE.Vector3(3.8, 3.1, 1.9)); rock.position.set(0, -.2, -.9); L.group.add(rock); rock.userData = { kind: "gate", station: 1 }; targets.push(rock);
    L.focus.y = L.pos.y + 1.2; L.group.updateMatrixWorld(true);
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

  // 2 · the seed: kneel, press it into the earth, and a field of grain spreads across the open land
  let growWheat = (_age: number) => {};
  { const L = live[2];
    const mound = new THREE.Mesh(new THREE.SphereGeometry(.45, 18, 8), new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 })); mound.scale.y = .2; L.group.add(mound);
    const seed = glowSprite(glowTexture, 0xffd27a, .8, true); seed.position.y = .22; seed.scale.setScalar(.4); L.group.add(seed);
    const hit = hitbox(new THREE.SphereGeometry(.9, 10, 8), "gate", 2); hit.position.y = .4; L.group.add(hit); L.focus.y = L.pos.y + .2;
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

  // 3 · the clay, among the low walls of the first cities: holding is writing — each moment of pressure presses another sign
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
    const brick = new THREE.MeshStandardMaterial({ color: 0x6e5a44, roughness: 1 });
    for (const [x, z, w, h, ry] of [[-3.2, -2.6, 3.4, .9, .1], [2.9, -3.2, 2.6, .6, -.15], [-4.6, .6, 2.2, .5, 1.45], [4.4, -.2, 1.8, 1.1, 1.62], [.2, -5.4, 4.2, .4, .04], [-1.6, -4.8, 1.2, 1.3, .3]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, .45), brick); wall.position.set(x, h / 2 - .08, z); wall.rotation.y = ry; wall.castShadow = wall.receiveShadow = true; L.group.add(wall); }
    document.fonts?.load('62px "Noto Sans Cuneiform"', "\u{12000}").then(() => paintTablet()).catch(() => paintTablet()); }

  // 4 · four stone seats on the knoll, under the widest sky
  const plinths: THREE.Vector3[] = [];
  { const L = live[4]; [-2.1, -.7, .7, 2.1].forEach(x => { const p = rockMesh(new THREE.Vector3(.75, .55, .75)); p.position.set(x, 0, -.4 + Math.abs(x) * .32); L.group.add(p); L.group.updateMatrixWorld(true); plinths.push(p.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .42, 0))); }); }

  // 5 · the armillary on its platform: geocentric loops relax into heliocentric orbits while you hold it
  let armK = 0;
  { const L = live[5], arm = new THREE.Group(); arm.position.y = 2.05; L.group.add(arm);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, .35, 28), stone); platform.position.y = .05; platform.receiveShadow = platform.castShadow = true; L.group.add(platform);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, 1.5, 10), darkWood); post.position.y = .95; post.castShadow = true; L.group.add(post);
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
        a.needsUpdate = true; } };
    L.reset = () => { armK = 0; }; }

  // 6 · ashes: the burnt country, falling cinders, a candle you can light only by giving your flame away
  let paintPlaque = () => {};
  const ash = (() => { const n = o.small ? 160 : 320, pos = new Float32Array(n * 3), seeds = Array.from({ length: n }, (_, i) => [seeded(i + 3)(), seeded(i + 900)(), seeded(i + 77)()]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xff8a50, size: .045, map: glowTexture, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; root.add(pts);
    return { pts, seeds, pos }; })();
  { const L = live[6], burnt = new THREE.MeshStandardMaterial({ color: 0x24201d, roughness: 1 });
    [[-1.6, 1, .2, 1.1, 2, .35], [-.45, .7, .1, 1, 1.4, .3], [.8, .5, -.25, 1.2, 1, .3], [1.85, .25, .4, .8, .5, .3]].forEach(([x, y, rz, w, h, d]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), burnt); b.position.set(x, y, -.9); b.rotation.z = rz; b.castShadow = b.receiveShadow = true; L.group.add(b); });
    const block = rockMesh(new THREE.Vector3(.7, .7, .7)); block.position.set(0, 0, .2); L.group.add(block);
    block.geometry.computeBoundingBox(); const top = (block.geometry.boundingBox?.max.y ?? .7) * block.scale.y - .02;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .3, 12), new THREE.MeshStandardMaterial({ color: 0xe9dfca, roughness: .6, emissive: 0x6a4410, emissiveIntensity: 0 })); candle.position.set(0, top + .15, .2); L.group.add(candle);
    const hit = hitbox(new THREE.SphereGeometry(.55, 10, 8), "gate", 6); hit.position.set(0, top + .2, .2); L.group.add(hit); L.focus.copy(L.pos).add(new THREE.Vector3(0, top + .25, 0));
    L.group.updateMatrixWorld(true);
    const flame = singleFlame(.12, .2); flame.place(L.group.localToWorld(new THREE.Vector3(0, top + .29, .2))); root.add(flame.mesh);
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
      flame.set(k); flame.material.uniforms.uTime0.value = t; flame.material.uniforms.uGlobal.value = fl; candle.material.emissiveIntensity = k * .7; candleLight.intensity = k * 5 * fl;
      plaque.material.opacity = L.done ? sm(0, 1, (t - L.doneAt - 3) / 2) : 0; }; }

  // 7 · the end of the road: a stone on the crest, a smouldering beacon you can see from far off, and the land beyond with no road
  let altarRing: THREE.MeshBasicMaterial;
  const beacon = glowSprite(glowTexture, 0xff8a40, .5); root.add(beacon);
  { const L = live[7], altar = rockMesh(new THREE.Vector3(1.9, .55, 1.5)); L.group.add(altar); altar.userData = { kind: "gate", station: 7 }; targets.push(altar);
    const outline = canvasTexture(256, 256, g => { const h = document.createElement("canvas"); h.width = h.height = 256; const hx = h.getContext("2d")!; hx.translate(128, 140); hx.fillStyle = hx.strokeStyle = "#fff"; handPath(hx, 44, 7); g.shadowColor = "#ffd9a0"; g.shadowBlur = 16; g.drawImage(h, 0, 0); g.globalCompositeOperation = "destination-out"; g.shadowBlur = 0; g.drawImage(h, 4, 4, 248, 248); });
    altarRing = new THREE.MeshBasicMaterial({ map: outline, color: 0xffd090, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), altarRing); ring.rotation.x = -Math.PI / 2; ring.position.y = .5; L.group.add(ring);
    beacon.position.copy(L.pos).add(new THREE.Vector3(0, 1.1, 0)); beacon.scale.setScalar(1.6); L.focus.y = L.pos.y + .4; }
  const crestFire = singleFlame(.75, 1.25); crestFire.place(live[7].pos.clone().add(tangent(LEN).multiplyScalar(1.4)).setY(height(live[7].pos.x, live[7].pos.z) + .05)); root.add(crestFire.mesh);
  const crestLight = new THREE.PointLight(0xffa052, 0, 22, 2); crestLight.position.copy(live[7].pos).add(new THREE.Vector3(0, 1.6, 0)); root.add(crestLight);
  let crestLit = 0;

  // ─── Embers rising from the fires near you; fireflies over the fields ───
  const motes = (count: number, size: number) => { const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3)); geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: glowTexture, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; root.add(pts); return pts; };
  const embers = motes(o.small ? 40 : 90, .06), emberState = Array.from({ length: (embers.geometry.attributes.position as THREE.BufferAttribute).count }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 9, life: 1 }));
  const flies = motes(o.small ? 24 : 48, .09), flySeed = Array.from({ length: (flies.geometry.attributes.position as THREE.BufferAttribute).count }, (_, i) => [seeded(i + 5)(), seeded(i + 55)(), seeded(i + 555)()]);
  const flyHome = new THREE.Vector3(); let flyAmount = 0;

  // ─── The walk's stars: hung above their places, so overhead they trace the road through the sky ───
  const flareTex = canvasTexture(128, 128, g => { const gr = g.createLinearGradient(0, 64, 128, 64); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(.5, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 62, 128, 4); g.save(); g.translate(64, 64); g.rotate(Math.PI / 2); g.translate(-64, -64); g.fillRect(0, 63, 128, 2.4); g.restore(); });
  const beamTex = canvasTexture(16, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,.05)"); gr.addColorStop(.75, "rgba(255,255,255,.75)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 16, 256); });
  type Star = { ref: string; station: number; pos: THREE.Vector3; core: THREE.Sprite; halo: THREE.Sprite; flare: THREE.Sprite; figure: THREE.Sprite; beam: THREE.Mesh; metAt: number; raise: number };
  const sky = new THREE.Group(); sky.name = "The walk's stars"; root.add(sky);
  const stars: Star[] = [];
  const STAR = 1.3; // sprite scale for stars about 30 m up
  live.forEach(L => L.st.figures.forEach((ref, k, all) => {
    const u = all.length > 1 ? k / (all.length - 1) - .5 : 0, wide = L.st.kind === "axial" ? 34 : 18;
    const pos = at(L.s).addScaledVector(tangent(L.s), u * wide).add(new THREE.Vector3(0, 29 + Math.cos(u * 3) * 4 + L.i * 1.4, 0));
    const halo = glowSprite(glowTexture, 0xffe6bf, .2); halo.position.copy(pos); halo.scale.setScalar(6 * STAR); sky.add(halo);
    const flare = glowSprite(flareTex, 0xfff1d6, .35); flare.position.copy(pos); flare.scale.setScalar(5 * STAR); sky.add(flare);
    const core = glowSprite(glowTexture, 0xfff6e6); core.position.copy(pos); core.scale.setScalar(1.3 * STAR); sky.add(core);
    const hit = hitbox(new THREE.SphereGeometry(4.4, 8, 6), "star", L.i); hit.userData.index = stars.length; hit.position.copy(pos); root.add(hit);
    const foot = L.st.kind === "axial" ? plinths[k].clone() : L.pos.clone().addScaledVector(at(L.s).sub(L.pos).setY(0).normalize(), .3).addScaledVector(tangent(L.s), (k - (all.length - 1) / 2) * 1.05 + 1.7);
    if (L.st.kind !== "axial") foot.y = height(foot.x, foot.z);
    const figure = new THREE.Sprite(new THREE.SpriteMaterial({ map: figureTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })); figure.center.set(.5, 0); figure.scale.set(.74, 1.66, 1); figure.position.copy(foot); root.add(figure);
    const span = pos.distanceTo(foot), beam = new THREE.Mesh(new THREE.CylinderGeometry(.04, .2, span, 10, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: 0xffe0b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.copy(pos).add(foot).multiplyScalar(.5); beam.lookAt(pos); beam.rotateX(Math.PI / 2); beam.visible = false; root.add(beam);
    stars.push({ ref, station: L.i, pos, core, halo, flare, figure, beam, metAt: -1, raise: 0 });
  }));
  const constellation = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf6dcae, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  constellation.frustumCulled = false; root.add(constellation);
  const reflection = o.mirror(sky);
  const syncReflection = () => sky.children.forEach((child, i) => { const m = reflection.children[i]; if (m) { m.position.copy(child.position); m.scale.copy(child.scale); } });

  // ─── Your star: it rises from your hand on the crest and takes its place in the shared sky, above the road not yet walked ───
  const skyGroup = o.civ.group;
  const mine = glowSprite(glowTexture, 0xffc070, 0), mineHalo = glowSprite(glowTexture, 0xffb060, 0); mine.renderOrder = 2; skyGroup.add(mine, mineHalo);
  const mineHit = new THREE.Mesh(new THREE.SphereGeometry(42, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); mineHit.userData = { kind: "mine" }; mineHit.visible = false; skyGroup.add(mineHit);
  const altarTop = live[7].pos.clone().add(new THREE.Vector3(0, .6, 0));
  const homeward = FIRE.clone().sub(live[7].pos).setY(0).normalize();
  const mineTarget = () => tangent(LEN).multiplyScalar(.56).add(new THREE.Vector3(0, .83, 0)).normalize().multiplyScalar(1880).add(camera.position);
  const mineWorld = new THREE.Vector3();
  function placeMine(world: THREE.Vector3, k: number) {
    mineWorld.copy(world); skyGroup.updateMatrixWorld(); const local = skyGroup.worldToLocal(world.clone()), d = world.distanceTo(camera.position);
    mine.position.copy(local); mineHalo.position.copy(local); mineHit.position.copy(local);
    mine.scale.setScalar(THREE.MathUtils.lerp(.9, d * .014, k)); mineHalo.scale.setScalar(THREE.MathUtils.lerp(3, d * .06, k));
  }
  const trail = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  trail.frustumCulled = false; root.add(trail);
  // sparks: your fire, travelling to whatever it lights
  type Spark = { sprite: THREE.Sprite; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; done: () => void };
  const sparks: Spark[] = [];
  function spark(to: THREE.Vector3, dur: number, done: () => void) { const sprite = glowSprite(glowTexture, 0xffc27a, 1); sprite.scale.setScalar(.35); root.add(sprite); sparks.push({ sprite, from: torchTip(), to: to.clone(), t0: time, dur, done }); }

  // ─── The shared sky: the 45 civilization stars wake in the order history wrote them ───
  const civGeo = o.civ.points.geometry, civCount = civGeo.attributes.position.count;
  const civGlow = new THREE.BufferAttribute(new Float32Array(civCount), 1); civGeo.setAttribute("glow", civGlow);
  const civOrder = chronologicalSky();
  const civWeb = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(civCount * 6), 3)), new THREE.LineBasicMaterial({ color: 0xf2dcb0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  civWeb.frustumCulled = false; civWeb.geometry.setDrawRange(0, 0); skyGroup.add(civWeb);
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

  let mineAt = -1;
  function rebuildConstellation() {
    const points = stars.filter(s => s.metAt > -1).sort((a, b) => a.station - b.station || a.metAt - b.metAt).map(s => s.pos);
    if (mineAt >= 0 && time - mineAt > 7) points.push(mineWorld.clone());
    constellation.geometry.dispose(); constellation.geometry = new THREE.BufferGeometry().setFromPoints(points.length > 1 ? points : []);
  }

  // ─── State ───
  type State = "idle" | "intro" | "walk" | "finale" | "return" | "home";
  let state: State = "idle", index = 0, phase: "walk" | "narrate" | "act" | "after" = "walk", phaseAt = 0;
  let s = 0, speed = 0, holdWalk = 0, stride = 0, holdAct = false, walkPointer = false, keyWalk = false, keyAct = false, holdT = 0, gloom = 0, finaleAt = -1, approach = 1, kneel = 0, raise = 0, offer = 0, raiseTarget = -1;
  let crossed = false, lineUntil = 0, returnAt = -1, homeAt = -1, standLit = 0;
  const passed = new Set<string>();
  let glide: THREE.CatmullRomCurve3 | null = null;
  let actHit: THREE.Intersection | undefined;
  const approachFrom = new THREE.Vector3();
  type Saved = { name: string; date: string };
  let saved: Saved | null = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) || "null"); } catch { saved = null; }
  const showMine = () => { placeMine(mineTarget(), 1); mine.material.opacity = 1; mineHalo.material.opacity = .22; mineHit.visible = true; if (!targets.includes(mineHit)) targets.push(mineHit); };
  /** After a completed walk, the road stays lit: every later visit begins with the fires you left. */
  function remembered() { showMine(); setCairns(1); crestLit = 1; live.forEach(L => { L.done = true; L.doneAt = -1000; }); growWheat(1000); stars.forEach(x => { x.metAt = -1000; }); standLit = 1; rebuildConstellation(); }
  if (saved) remembered();

  // ─── DOM: a line of narration, the year, a quiet hint, nothing else in the way ───
  const panel = el("rite-panel"), line = el("rite-line"), hint = el("rite-hint"), yearEl = el("rite-year"), actBtn = el<HTMLButtonElement>("rite-act"), homeBtn = el<HTMLButtonElement>("rite-next"), leaveBtn = el<HTMLButtonElement>("rite-leave");
  const startCard = el("rite-start"), nameInput = el<HTMLInputElement>("rite-name"), beginBtn = el<HTMLButtonElement>("rite-begin"), fade = el("rite-fade"), langBtn = el<HTMLButtonElement>("lang-toggle");
  let lineText = "", hintText = "", yearText = "";
  function setLine(text: string) { if (text === lineText) return; lineText = text; line.classList.remove("show"); void line.offsetWidth; line.textContent = text; if (text) line.classList.add("show"); }
  function setHint(text: string) { if (text === hintText) return; hintText = text; hint.textContent = text; }
  function setYear(text: string) { if (text === yearText) return; yearText = text; yearEl.textContent = text; yearEl.classList.toggle("on", !!text); }
  function paintStatic() {
    document.documentElement.dataset.riteLang = lang;
    langBtn.textContent = lang === "zh" ? "EN" : "中文"; langBtn.setAttribute("aria-label", lang === "zh" ? "Switch to English" : "切換為中文");
    el("rite-start-eyebrow").textContent = riteUi.startEyebrow[lang]; el("rite-start-title").textContent = riteUi.startTitle[lang]; el("rite-start-text").textContent = riteUi.startText[lang];
    el("rite-name-label").textContent = riteUi.name[lang]; beginBtn.textContent = index > 0 && state !== "idle" ? riteUi.resume[lang] : riteUi.begin[lang];
    leaveBtn.textContent = riteUi.leave[lang]; homeBtn.textContent = riteUi.home[lang];
    const guide = document.getElementById("rite-guide-name"); if (guide) guide.textContent = riteUi.startTitle[lang];
    yearText = "";
    paintTitles(); paintTablet(); paintPlaque();
  }
  langBtn.addEventListener("click", () => { lang = lang === "zh" ? "en" : "zh"; try { localStorage.setItem("bb-lang", lang); } catch { /* ignore */ } paintStatic(); });
  function showFigure(i: number) {
    const star = stars[i], figure = resolveFigure(star.ref, lang); if (!figure || !api) return;
    const quote = figure.quote ? (lang === "zh" ? `\n\n「${figure.quote}」` : `\n\n“${figure.quote}”`) : "";
    api.showInfo({ eyebrow: `${riteUi.starHint[lang]} · ${figure.life}`, title: figure.name, description: figure.text + quote, href: figure.href, linkText: figure.href ? (lang === "zh" ? "關於這片星圖 ↗" : "About this constellation ↗") : undefined });
  }
  function wake(i: number, show: boolean) {
    const star = stars[i]; if (star.metAt > -1) { if (show) showFigure(i); return; }
    star.metAt = time; star.beam.visible = true; rebuildConstellation(); sound.bell(72 + (i % 6) * 2, .055); if (show) showFigure(i);
    if (state === "walk" && index === 4 && !live[4].done && stars.every(x => x.station !== 4 || x.metAt > -1)) setTimeout(() => complete(4), 1600);
  }
  const CHORDS = [[50, 57, 62, 65], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [41, 53, 60, 65, 69], [48, 55, 60, 64], [38, 45, 50, 53], [38, 45, 50, 54, 57]];
  function complete(i: number, hit?: THREE.Intersection) {
    const L = live[i]; if (L.done) return; L.done = true; L.doneAt = time; holdAct = false; holdT = 0;
    L.act?.(hit); sound.chord(CHORDS[i], 10); sound.boom(.25);
    if (i === 7) { api?.clearInfo(); sound.cue("finale"); mineAt = time; mine.material.opacity = 1; mineHalo.material.opacity = 0; placeMine(altarTop, 0); state = "finale"; finaleAt = time; }
    phase = "after"; phaseAt = time; setLine(say(L.st.after, lang, name)); setHint(""); lineUntil = 0;
    const first = stars.findIndex(y => y.station === i);
    if (L.st.kind !== "axial") stars.forEach((x, k) => { if (x.station === i) setTimeout(() => spark(x.pos, 1.1, () => wake(k, k === first)), 900 + (k - first) * 700); });
    api?.announce(say(L.st.after, lang, name));
  }

  function resetWalk() {
    live.forEach(L => { L.done = false; L.doneAt = -1; L.reset?.(); }); index = 0; s = 0; mineAt = -1; finaleAt = -1; civWoken = 0; crossed = false; passed.clear();
    stars.forEach(x => { x.metAt = -1; x.raise = 0; x.beam.visible = false; }); rebuildConstellation(); setCairns(0);
    mine.material.opacity = mineHalo.material.opacity = 0; mineHit.visible = false; (civGlow.array as Float32Array).fill(0); civGlow.needsUpdate = true; civWeb.geometry.setDrawRange(0, 0);
    (civWeb.material as THREE.LineBasicMaterial).opacity = 0; civTie.material.opacity = 0; trail.material.opacity = 0; standLit = 0; crestLit = 0;
  }
  function begin() {
    sound.wake(); sound.hush(); startCard.hidden = true; name = (nameInput.value || "").trim().slice(0, 10); pressed = 0; paintTablet();
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
    try { saved = { name, date: new Date().toISOString().slice(0, 10) }; localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* ignore */ }
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
  actBtn.addEventListener("click", () => {
    if (state !== "walk" || phase !== "act") return; const st = live[index].st;
    if (st.actKind === "raise") { const k = stars.findIndex(x => x.station === index && x.metAt < 0 && x.raise >= 0); if (k >= 0) { stars[k].raise = -99; spark(stars[k].pos, .9, () => wake(k, true)); } }
    else if (st.actKind === "write") { pressed = [...(name || (lang === "zh" ? "我" : "I"))].length + 1; paintTablet(); complete(index); }
    else complete(index);
  });
  const editing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement;
  addEventListener("keydown", e => { if (state !== "walk" || editing(e)) return; sound.wake();
    if (e.code === "KeyW" || e.code === "Space" || e.code === "ArrowUp") { keyWalk = true; e.preventDefault(); }
    if (e.code === "KeyE") keyAct = true; });
  addEventListener("keyup", e => { if (e.code === "KeyW" || e.code === "Space" || e.code === "ArrowUp") keyWalk = false; if (e.code === "KeyE") keyAct = false; });
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
      if (u.kind === "gate" && state === "walk" && u.station === index && phase === "act") return live[index].st.act[lang];
      return null;
    },
    click(ray) {
      const hit = pickHit(ray); const u = hit?.object.userData;
      if (u?.kind === "stand" && (state === "idle" || state === "intro")) { open(); return true; }
      if (u?.kind === "mine") { api?.showInfo({ eyebrow: `${riteUi.yourStar[lang]} · ${saved?.date ?? ""}`, title: saved?.name || name || (lang === "zh" ? "你" : "You"), description: riteUi.carried[lang] }); return true; }
      if (u?.kind === "star" && !(state === "walk" && index === 4 && phase === "act")) { showFigure(u.index); return true; }
      return hooks.active();
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
  const tmp = new THREE.Vector3(), look = new THREE.PerspectiveCamera(), fog = scene.fog as THREE.FogExp2, baseFog = fog.color.clone(), baseDensity = fog.density, moonBase = o.moonLight.intensity, bounceBase = o.moonBounce.intensity;
  const overviewQ = (() => { const c = new THREE.PerspectiveCamera(); c.position.fromArray(overview.position); c.lookAt(new THREE.Vector3(...overview.target)); return c.quaternion.clone(); })();
  function face(target: THREE.Vector3, rate: number) {
    if (!api || api.looking || performance.now() - api.lastLook < 2200) return;
    look.position.copy(camera.position); look.lookAt(target); camera.quaternion.slerp(look.quaternion, Math.min(1, rate)); api.syncAngles();
  }
  if (new URLSearchParams(location.search).has("ritedebug")) (window as unknown as { __rite: unknown }).__rite = {
    get state() { return { state, index, phase, s: +s.toFixed(1), length: +LEN.toFixed(1), speed: +speed.toFixed(2), gloom: +gloom.toFixed(2), cairnsLit: cairns.filter(c => c.lit > 0).length, cairns: N, met: stars.filter(x => x.metAt > -1).length, civWoken, year: yearText, audio: sound.ready }; },
    complete: (i: number) => complete(i), wake: (i: number) => wake(i, false), go: (d: number) => { s = d; }, home: () => returnHome(),
  };
  let dirty = false, dawn = 0, aurora = 0, ducked = false;
  /** The score follows the road: a cue for each stretch of history, crossfaded over about twenty metres. */
  function scoreMix(t: number): RiteMix {
    const music: Record<string, number> = {}, ambience: Record<string, number> = {}, span = (from: number, to: number, w = 12) => sm(from - w, from + w, s) * (1 - sm(to - w, to + w, s));
    if (state === "intro" || (state === "walk" && s < THRESHOLD + 10)) { music.ember = 1 - (state === "walk" ? sm(THRESHOLD - 2, THRESHOLD + 10, s) : 0); ambience.forest = .5; }
    if (state === "walk") {
      const ashDone = live[6].done;
      music.forest = span(THRESHOLD + 4, 150); music.fields = span(150, 300); music.voices = span(300, 432);
      music.ash = ashDone ? 0 : sm(420, 440, s);
      music.candle = ashDone ? 1 - sm(494, 518, s) : 0;
      music.ascent = ashDone ? sm(494, 518, s) * (.55 + .45 * sm(zones.ascent[0], LEN, s)) : 0;
      ambience.forest = 1 - sm(140, 165, s); ambience.open = sm(140, 165, s) * (1 - sm(425, 440, s)); ambience.ash = sm(425, 440, s) * (1 - sm(500, 515, s)); ambience.crest = sm(500, 515, s);
    }
    if (state === "finale") { const ft = t - finaleAt; music.finale = 1; music.hold = sm(56, 63, ft); ambience.crest = 1 - sm(4, 20, ft) * .5; }
    if (state === "return") { const rt = t - returnAt; music.homeward = 1; music.finale = 1 - sm(0, 4, rt); music.hold = 0; ambience.open = .5 * (1 - sm(28, 38, rt)); }
    if (state === "home" || (state === "idle" && homeAt > 0 && t - homeAt < 24)) music.homeward = 1;
    return { music, ambience };
  }
  const mood = { sat: 1, vignette: 0, grain: 0, tint: new THREE.Color(1, 1, 1) };
  const COLD = new THREE.Color(.92, .98, 1.09), WARM = new THREE.Color(1.06, 1, .93), ASHEN = new THREE.Color(1.09, .94, .85), DAWN = new THREE.Color(1.07, 1, .94), tint = new THREE.Color();
  return {
    hooks,
    attach(a: ExplorationApi) { api = a; },
    update(dt: number, sceneTime: number): boolean {
      time += dt; const t = time, still = !!api?.paused, L = live[index], st = L.st;
      const stop = index === 0 ? 0 : L.s - (st.kind === "you" ? 2.4 : 2.1);
      const fl = .84 + .16 * Math.sin(t * 11.3) * Math.sin(t * 5.1);
      // ── movement: hold to walk; the road itself stops you at each place
      let walking = false;
      if (state === "walk") {
        if (approach < 1) { approach = still ? 1 : Math.min(1, approach + dt / 2.2); camera.position.lerpVectors(approachFrom, at(s).add(new THREE.Vector3(0, EYE, 0)), sm(0, 1, approach)); face(index === 0 ? live[0].focus : at(s + 9).add(new THREE.Vector3(0, EYE, 0)), dt * 2.5); }
        else {
          if (phase === "walk" && L.done && index < live.length - 1) { index++; return true; }
          const near = phase === "narrate" || s > stop - 14, wantWalk = (walkPointer || keyWalk) && (phase === "walk" || phase === "narrate") && !L.done && s < stop;
          holdWalk = wantWalk ? holdWalk + dt : 0;
          const ahead = at(s + 4), here = at(s), slope = Math.max(0, (ahead.y - here.y) / 4);
          const target = wantWalk ? (near ? 1.2 : 1.9 + 1.6 * sm(0, 1.8, holdWalk)) * (1 - .55 * gloom) * (1 - Math.min(.3, slope * 1.6)) : 0;
          speed += (target - speed) * Math.min(1, dt * (wantWalk ? 2.4 : 5));
          if (still && wantWalk) { s = stop; speed = 0; }
          else if (speed > .02) { const before = s; s = Math.min(stop, s + speed * dt); walking = s > before; stride += (s - before) / .78; if (Math.floor(stride) !== Math.floor(stride - (s - before) / .78)) sound.step(here.y / 20); }
          if (s >= stop - .01) speed = 0;
          if (phase === "walk" && !L.done && (s >= stop - .01 || (index > 0 && s > stop - 12))) { phase = "narrate"; phaseAt = t; lineUntil = 0; }
          const p = at(s), bob = walking && !still ? Math.sin(stride * Math.PI) * .028 * Math.min(1, speed / 2) : 0, eye = EYE - kneel * .75 + bob;
          camera.position.lerp(tmp.set(p.x, p.y + eye, p.z), still ? 1 : Math.min(1, dt * 6));
          if (walking) { const a = at(s + 9); face(a.add(new THREE.Vector3(0, EYE - .15 + (a.y - p.y) * .3, 0)), dt * 1.8); }
          else if (phase === "act" && st.actKind === "raise") { const k = raiseTarget >= 0 ? raiseTarget : stars.findIndex(x => x.station === index && x.metAt < 0); face(k >= 0 ? stars[k].pos : L.focus, dt * 1.2); }
          else if (phase !== "after" || st.kind !== "axial") { if (phase !== "walk") face(L.focus, dt * 1.5); }
        }
      }
      // ── crossing the threshold, and the history heard between the stations
      if (state === "walk" && !crossed && s >= THRESHOLD) { crossed = true; setLine(riteUi.threshold[lang]); lineUntil = t + 5.5; sound.bell(62, .06); sound.boom(.18); }
      if (state === "walk" && phase === "walk" && index > 0) {
        const prev = index - 1, lines = riteStations[prev].passing, from = prev === 0 ? THRESHOLD + 12 : stationMeters[prev] + 9, to = stationMeters[index] - 16;
        for (let k = 0; k < lines.length; k++) { const key = `${prev}:${k}`; if (passed.has(key) || t < lineUntil) continue;
          if (s >= from + (to - from) * k / lines.length) { passed.add(key); setLine(say(lines[k], lang, name)); lineUntil = t + 5.8; break; } }
        if (t > lineUntil && lineUntil > 0) { setLine(""); lineUntil = 0; }
      }
      // ── narration and the act
      if (state === "walk" && phase === "narrate") { const k = Math.floor((t - phaseAt) / 4.4);
        if (k < st.lines.length) setLine((t - phaseAt) % 4.4 < 3.95 ? say(st.lines[k], lang, name) : "");
        else if (s >= stop - .01) { phase = "act"; phaseAt = t; actBtn.textContent = st.act[lang]; }
        else setLine(""); }
      if (state === "walk" && phase === "act") {
        setLine(st.act[lang]); setHint(holdAct || keyAct ? riteUi.holding[lang] : riteUi.holdKeys[lang]);
        const pressing = holdAct || keyAct;
        if (st.actKind === "write") { if (pressing) { writeT += dt; if (writeT > .45) { writeT = 0; pressed++; paintTablet(); sound.step(0); } } if (pressed > [...(name || (lang === "zh" ? "我" : "I"))].length) complete(index, actHit); }
        else if (st.actKind === "raise") { const k = raiseTarget >= 0 ? raiseTarget : keyAct ? stars.findIndex(x => x.station === index && x.metAt < 0 && x.raise >= 0) : -1;
          if (pressing && k >= 0) { stars[k].raise += dt; if (stars[k].raise > 1) { stars[k].raise = -99; const target = k; spark(stars[k].pos, .9, () => wake(target, true)); raiseTarget = -1; holdAct = false; } } }
        else { holdT = pressing ? holdT + dt : Math.max(0, holdT - dt * 2); if (st.kind === "heavens") armK = Math.min(1, holdT / 1.5); if (holdT > (st.kind === "you" ? 2.4 : st.kind === "fire" ? 1.8 : 1.5)) complete(index, actHit); }
      }
      if (state === "walk" && phase === "after" && t - phaseAt > 6) { phase = "walk"; phaseAt = t; setLine(""); }
      if (state === "walk") setHint(phase === "act" ? hintText : approach >= 1 && s < stop - .01 && (phase === "walk" || phase === "narrate") ? `${riteUi.walkHint[lang]} · ${riteUi.walkKeys[lang]}` : "");
      if (state === "walk" || state === "finale") setYear(yearLabel(state === "finale" ? 0 : yearsAgoAt(s), lang));
      // ── body: kneel for the seed, raise the torch to the sky, offer it to the fire and the candle
      const acting = phase === "act" && (holdAct || keyAct);
      kneel += ((state === "walk" && st.kind === "seed" && (acting || (phase === "after" && t - phaseAt < 2.5)) ? 1 : 0) - kneel) * Math.min(1, dt * 3);
      raise += (((st.actKind === "raise" && acting) || sparks.length > 0 ? 1 : 0) - raise) * Math.min(1, dt * 4);
      offer += (((st.actKind === "pass" || st.kind === "fire") && acting ? 1 : 0) - offer) * Math.min(1, dt * 4);
      torch.position.copy(torchRest).lerp(torchRaised, raise).lerp(torchOffered, offer); torch.rotation.z = -.12 + raise * .25;
      // ── the ashes: dark from the edge of the burnt country to the candle; light returns once you have given your flame
      const ashL = live[6], walkingOn = state === "walk" || state === "finale";
      const gIn = sm(zones.ash[0] + 2, stationMeters[6] - 8, s), g = !walkingOn ? 0 : ashL.done ? gIn * (1 - sm(0, 1, (t - ashL.doneAt - 1) / 6)) : gIn;
      gloom = g;
      // ── fire: the torch, the cairns, a few pooled lights
      const lit = live[0].done && state !== "home" ? THREE.MathUtils.lerp(1, .14, g) : index === 0 && phase === "act" && state === "walk" ? Math.min(1, holdT / 1.8) : 0;
      torchFlame.uniforms.uTime0.value = sceneTime; torchFlame.uniforms.uGlobal.value = lit * fl * (1 + raise * .3); torchLight.intensity = lit * 5.5 * fl; torchLight.position.copy(torch.position).add(new THREE.Vector3(0, .2, 0));
      cairnFlame.uniforms.uTime0.value = sceneTime; cairnFlame.uniforms.uGlobal.value = (.95 + .1 * fl) * (1 - g * .7);
      for (let i = 0; i < N; i++) {
        const c = cairns[i];
        if (state === "walk" && live[0].done && c.lit === 0 && c.s < s + 5.5 && !(c.dead && !ashL.done)) { c.lit = .001; sound.ignite(); dirty = true; }
        if (c.dead && c.lit === 0 && ashL.done && ashL.doneAt > 0 && t > ashL.doneAt + 1.2 + (stationMeters[6] - c.s) / 9) { c.lit = .001; sound.ignite(); dirty = true; }
        if (c.lit > 0 && c.lit < 1) { c.lit = Math.min(1, c.lit + dt * 1.4); dirty = true; }
        if (dirty) { iLit[i] = glowLit[i] = c.lit; placeGlow(i); }
      }
      if (dirty) { litAttr.needsUpdate = glowLitAttr.needsUpdate = true; groundGlow.instanceMatrix.needsUpdate = true; dirty = cairns.some(c => c.lit > 0 && c.lit < 1); }
      glowMat.uniforms.uDim.value = g; glowMat.uniforms.uHome.value = sm(120, 260, camera.position.distanceTo(FIRE));
      homeGlow.material.opacity = .05 * sm(150, 320, camera.position.distanceTo(FIRE));
      const nearest: { c: Cairn; d: number }[] = [];
      for (const c of cairns) { if (c.lit <= 0) continue; const d = c.top.distanceToSquared(camera.position); if (d > 900) continue; nearest.push({ c, d }); }
      nearest.sort((a, b) => a.d - b.d);
      pool.forEach((l, k) => { const n = nearest[k]; if (!n) { l.intensity = 0; return; } l.position.copy(n.c.top).add(new THREE.Vector3(0, .35, 0)); l.intensity = 3.4 * n.c.lit * fl * (1 - g * .6); });
      standFlame.set(standLit); standFlame.material.uniforms.uTime0.value = sceneTime; standFlame.material.uniforms.uGlobal.value = fl; standLight.intensity = standLit * 2.6 * fl;
      // ── the war: smoke over the sky, the moon dims, cinders fall, your flame almost goes out; at the end of the road the air clears
      const clear = state === "finale" ? sm(18, 26, t - finaleAt) : state === "return" ? 1 - sm(0, 1, (t - returnAt) / 26) : 0;
      o.skyDim.value = g; o.starDim.value = g;
      fog.color.lerpColors(baseFog, new THREE.Color(0x1a0f0c), g); fog.density = (baseDensity + g * .03) * (1 - .55 * clear);
      o.moonLight.intensity = moonBase * (1 - g * .8); o.moonBounce.intensity = bounceBase * (1 - g * .65);
      (ash.pts.material as THREE.PointsMaterial).opacity = g * .8;
      if (g > 0) { for (let k = 0; k < ash.seeds.length; k++) { const [a, b, c] = ash.seeds[k]; ash.pos[k * 3] = camera.position.x + (a - .5) * 16 + Math.sin(t * .4 + c * 9) * .6; ash.pos[k * 3 + 1] = camera.position.y + 6 - ((t * (.35 + c * .5) + b * 9) % 9); ash.pos[k * 3 + 2] = camera.position.z + (b - .5) * 16; }
        ash.pts.geometry.attributes.position.needsUpdate = true; }
      if (state !== "idle" && state !== "intro") o.moonLight.target.position.set(camera.position.x, 0, camera.position.z); else o.moonLight.target.position.set(0, 0, -13);
      // ── places, hands, titles, the ones who walked before
      for (const P of live) P.update?.(t, dt);
      standEmber.material.opacity = (live[0].done || state === "walk" || standLit > 0) ? 0 : .35 + .25 * Math.sin(t * 2.1) * Math.sin(t * 3.7 + 1);
      for (const h of ancestorHands) (h.material as THREE.MeshStandardMaterial).opacity = (live[0].done && state !== "idle" ? sm(8, 2.5, h.position.distanceTo(camera.position)) : 0) * .95;
      for (const h of myHands) (h.material as THREE.MeshBasicMaterial).opacity = sm(0, 1, (t - h.userData.born) / 1.4);
      altarRing.opacity = .3 + .15 * Math.sin(t * 2) + (index === 7 ? holdT / 2.4 * .6 : 0);
      beacon.material.opacity = state === "finale" || state === "return" || standLit > 0 ? .9 : .35 + .15 * Math.sin(t * 1.3); beacon.scale.setScalar(state === "finale" ? 2.4 : 1.6 + sm(60, 400, camera.position.distanceTo(beacon.position)) * 5);
      const lookingUp = sm(.35, .6, camera.getWorldDirection(tmp).y);
      for (const P of live) { if (P.i === 0) continue; const d = camera.position.distanceTo(P.pos), m = P.title.mesh.material as THREE.MeshBasicMaterial;
        m.opacity = state === "walk" ? sm(18, 9, d) * sm(3, 4.6, d) * (1 - lookingUp) * (P.done && s > P.s + 2 ? sm(P.s + 10, P.s + 3, s) : 1) : 0; P.title.mesh.visible = m.opacity > .01;
        P.title.mesh.lookAt(camera.position.x, P.title.mesh.position.y, camera.position.z); }
      const journeying = state !== "idle" && state !== "intro";
      for (const e of echoes) { const d = e.pos.distanceTo(camera.position), a = journeying ? e.base * sm(8, 18, d) * sm(140, 60, d) * (1 - g) : 0; e.figure.material.opacity = a; e.ember.material.opacity = a * 2.2 * fl; e.figure.visible = e.ember.visible = a > .003; }
      // ── the walk's stars
      for (const x of stars) {
        const met = x.metAt > -1, hidden = (x.station === 6 && !live[6].done) || (g > .4 && x.station !== 6), pulse = .9 + .1 * Math.sin(t * 1.7 + x.pos.x), charge = Math.max(0, x.raise);
        const a = hidden ? .04 : 1; x.core.material.opacity = a; x.halo.material.opacity = a * (met ? .26 : .14 + charge * .3); x.flare.material.opacity = a * (met ? .5 : .28 + charge * .4);
        x.core.scale.setScalar(STAR * (met ? 1.45 : 1 + charge * .7) * pulse); x.halo.scale.setScalar(STAR * (met ? 5 : 3.6 + charge * 1.5) * pulse); x.flare.scale.setScalar(STAR * (met ? 4.6 : 3.4) * pulse); x.flare.material.rotation = t * .05;
        x.core.material.color.setRGB(1, met ? .86 : .96, met ? .62 : .88);
        x.figure.material.opacity = met ? sm(0, 1, (t - x.metAt - 1) / 2) * .27 * (1 - g * .6) : 0;
        const b = x.beam.material as THREE.MeshBasicMaterial; b.opacity = met ? .42 * Math.exp(-(t - x.metAt) * .45) + .022 + (state === "finale" || state === "return" ? .05 : 0) : 0; x.beam.visible = b.opacity > .004;
      }
      constellation.material.opacity = .45 * (1 - g);
      // ── sparks of your fire
      for (let k = sparks.length - 1; k >= 0; k--) { const sp = sparks[k], u = Math.min(1, (t - sp.t0) / sp.dur), mid = sp.from.clone().lerp(sp.to, .5).add(new THREE.Vector3(0, 2, 0));
        sp.sprite.position.copy(sp.from).multiplyScalar((1 - u) * (1 - u)).addScaledVector(mid, 2 * u * (1 - u)).addScaledVector(sp.to, u * u); sp.sprite.scale.setScalar(.35 + u * .6);
        if (u >= 1) { root.remove(sp.sprite); sp.sprite.material.dispose(); sparks.splice(k, 1); sp.done(); } }
      // ── the end of the road: your star rises into the shared sky, the sky wakes, then you turn and look back along everything you lit
      if (state === "finale") { const ft = t - finaleAt, k = sm(0, 1, ft / 7);
        if (ft < 7.2) placeMine(altarTop.clone().lerp(mineTarget(), Math.pow(k, 2.4)), k); mineHalo.material.opacity = .25 * k;
        const a = trail.geometry.attributes.position as THREE.BufferAttribute; a.setXYZ(0, altarTop.x, altarTop.y, altarTop.z); a.setXYZ(1, mineWorld.x, mineWorld.y, mineWorld.z); a.needsUpdate = true;
        trail.material.opacity = .7 * Math.min(1, ft) * (1 - sm(7, 11, ft));
        if (ft > 7.1 && ft - dt <= 7.1) { rebuildConstellation(); mineHit.visible = true; if (!targets.includes(mineHit)) targets.push(mineHit); }
        if (ft < 7.5) face(mineWorld, dt * 1.4);
        if (ft > 7.5 && ft < 18) { setLine(ft < 12.5 ? riteUi.together[lang] : riteUi.together2[lang]); wakeCiv(Math.floor((ft - 7.5) / 9 * civOrder.length) + 1); face(camera.position.clone().add(new THREE.Vector3(0, 30, 0)).addScaledVector(homeward, -18), dt * .6); }
        if (ft > 18) { face(FIRE.clone().add(new THREE.Vector3(0, 6, 0)), dt * .7); setLine(ft < 24 ? riteUi.lookBack[lang] : riteUi.lookBack2[lang]); if (ft > 27) homeBtn.hidden = false; }
      }
      if (state === "finale" || state === "return") {
        const glow = civGlow.array as Float32Array; for (let n = 0; n < civOrder.length; n++) glow[civOrder[n]] = n < civWoken ? Math.min(1, glow[civOrder[n]] + dt * 1.5) : 0; civGlow.needsUpdate = true;
        (civWeb.material as THREE.LineBasicMaterial).opacity = Math.max(0, Math.min(.38, (t - finaleAt - 7.5) * .06)) * (state === "return" ? 1 - sm(0, 1, (t - returnAt) / 20) : 1);
        if (civWoken > 0) { skyGroup.updateMatrixWorld(); const last = new THREE.Vector3().fromBufferAttribute(civGeo.attributes.position as THREE.BufferAttribute, civOrder[civWoken - 1]).applyMatrix4(skyGroup.matrixWorld);
          const ta = civTie.geometry.attributes.position as THREE.BufferAttribute; ta.setXYZ(0, mineWorld.x, mineWorld.y, mineWorld.z); ta.setXYZ(1, last.x, last.y, last.z); ta.needsUpdate = true; civTie.material.opacity = Math.max(0, Math.min(.35, (t - finaleAt - 8) * .08)) * (state === "return" ? 1 - sm(0, 1, (t - returnAt) / 20) : 1); }
      }
      // ── the glide home along the lit road
      if (state === "return" && glide) { const k = Math.min(1, (t - returnAt) / 38), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        camera.position.copy(glide.getPointAt(e)); const ahead = glide.getPointAt(Math.min(1, e + .03)).add(new THREE.Vector3(0, -1.1, 0));
        look.position.copy(camera.position); look.lookAt(ahead); const q = e > .9 ? look.quaternion.clone().slerp(overviewQ, sm(.9, 1, e)) : look.quaternion;
        camera.quaternion.slerp(q, Math.min(1, dt * 2.5)); api?.syncAngles();
        if (k >= 1) { camera.quaternion.copy(overviewQ); api?.syncAngles(); arrive(); } }
      if (state === "home") { const ht = t - homeAt; if (ht > 5.5) setLine(riteUi.welcome2[lang]); if (ht > 12) finishHome(); }
      if ((state === "finale" && t - finaleAt > 7) || state === "return") { skyGroup.updateMatrixWorld(); mineWorld.copy(mine.position).applyMatrix4(skyGroup.matrixWorld);
        const c = constellation.geometry.attributes.position as THREE.BufferAttribute | undefined; if (c && mineAt >= 0 && t - mineAt > 7) { c.setXYZ(c.count - 1, mineWorld.x, mineWorld.y, mineWorld.z); c.needsUpdate = true; } }
      // ── mood: the grade, the dawn behind home, the aurora, the air
      const inRite = journeying, ft = t - finaleAt;
      const forest = inRite ? 1 - sm(zones.forest[1] - 20, zones.forest[1] + 25, s) : 0, field = inRite ? sm(150, 178, s) * (1 - sm(240, 300, s)) : 0;
      const dawnTarget = state === "finale" ? sm(16, 32, ft) * .95 : state === "return" || state === "home" ? .95 : 0;
      dawn += (dawnTarget - dawn) * Math.min(1, dt * (dawnTarget > dawn ? .5 : .08)); o.skyDawn.value = dawn;
      const auroraTarget = state === "finale" ? sm(7, 20, ft) : state === "return" || state === "home" ? 1 : 0;
      aurora += (auroraTarget - aurora) * Math.min(1, dt * (auroraTarget > aurora ? .35 : .06)); o.skyAurora.value = aurora;
      tint.setRGB(1, 1, 1).lerp(COLD, forest * .8).lerp(WARM, field * .7).lerp(ASHEN, g).lerp(DAWN, dawn * .8);
      const k = Math.min(1, dt * 1.2);
      mood.sat += ((inRite ? 1 - forest * .14 - g * .55 + field * .06 + dawn * .06 : 1) - mood.sat) * k;
      mood.vignette += ((inRite ? .3 + forest * .14 + g * .3 : 0) - mood.vignette) * k;
      mood.grain += ((inRite ? .02 + g * .05 : 0) - mood.grain) * k;
      mood.tint.lerp(inRite ? tint : tint.setRGB(1, 1, 1), k);
      o.grade.uSat.value = mood.sat; o.grade.uVignette.value = mood.vignette; o.grade.uGrain.value = mood.grain; o.grade.uTint.value.copy(mood.tint); o.grade.uTime.value = t;
      const smoke = walkingOn ? sm(zones.ash[0] - 60, zones.ash[0] + 6, s) * (1 - sm(zones.ash[1], zones.ash[1] + 25, s)) * (ashL.done ? .4 : 1) : 0;
      air.update(t, { mist: inRite ? 1 : .45, smoke, war: walkingOn && !ashL.done ? sm(zones.ash[0] - 60, zones.ash[0] + 6, s) : 0 });
      // ── the crest's fire, lit once your star has risen
      crestLit += ((live[7].done ? 1 : 0) - crestLit) * Math.min(1, dt * .8); crestFire.set(crestLit); crestFire.material.uniforms.uTime0.value = sceneTime; crestFire.material.uniforms.uGlobal.value = fl; crestLight.intensity = crestLit * 7 * fl;
      // ── embers from the nearest fires and from your torch
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
      syncReflection();
      return state !== "idle" || sparks.length > 0 || stars.some(x => x.metAt > -1 && time - x.metAt < 8);
    },
  };
}
