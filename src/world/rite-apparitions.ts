import * as THREE from "three";
import { shadowCanvas, SHADOW_ASPECT } from "./rite-shadows.ts";

/** Those you honour come out of the fire you give them. Sparks rise from the small fire at the memorial and gather
 * into the shape of the person, standing beside it in the dark: a figure of firelight with the cut-out patterns of
 * a shadow puppet, its edges smoking. After a while it loosens, and every spark streams up into one light, which
 * goes on to their star. The nameless people of their age stand farther off in the dark, faint and pale.
 *
 * Each figure is two things drawn from the same silhouette (rite-shadows.ts): a glowing image whose edges drift
 * like smoke, and a few thousand embers placed on its shape, animated entirely on the GPU. */

const GLOW = `
  uniform sampler2D uMask; uniform float uTime, uForm, uFade, uLevel, uSeed; uniform vec3 uWarm, uPale; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0., a = .5; for (int k = 0; k < 3; k++) { v += a * n2(p); p *= 2.13; a *= .5; } return v; }
  float mask(vec2 q){ return (q.x < 0. || q.x > 1. || q.y < 0. || q.y > 1.) ? 0. : texture2D(uMask, q).a; }
  void main(){
    float t = uTime + uSeed * 17.;
    vec2 uv = vUv; uv.y -= uFade * .16; // as it goes, the figure lifts
    // the edges drift like smoke, more towards the top and as it dissolves
    float w = .005 + .012 * smoothstep(.5, 1., uv.y) + .07 * uFade;
    vec2 q = uv + vec2(fbm(vec2(uv.x * 5., uv.y * 4. - t * .45)) - .5, fbm(vec2(uv.x * 6. + 7., uv.y * 5. - t * .6)) - .5) * w * 2.;
    float m = mask(q), r = .014, halo = 0.;
    for (int k = 0; k < 6; k++) { float a = float(k) * 1.0472 + t * .3; halo += mask(q + vec2(cos(a), sin(a) * .5) * r); }
    halo /= 6.;
    float shown = 1. - smoothstep(uForm * 1.3 - .3, uForm * 1.3, vUv.y);  // forms from the feet up
    float kept = smoothstep(uFade * 1.3 - .3, uFade * 1.3, vUv.y);       // and leaves from the feet up
    float flick = .86 + .14 * n2(vec2(t * 2.7, uSeed * 9.));
    float lit = mix(1.2, .72, vUv.y); // lit from the fire below
    float rim = max(0., halo - m * .85);
    float smoke = fbm(vec2(vUv.x * 3. + uSeed, vUv.y * 2.2 - t * .28)) * exp(-pow((vUv.x - .5) / .26, 2.)) * smoothstep(.0, .3, vUv.y) * (1. - smoothstep(.75, 1., vUv.y));
    // a body of dim firelight, so its cut-out patterns read as dark lace, with brighter edges
    vec3 col = uWarm * (m * (.2 + .1 * fbm(q * vec2(9., 14.) - t * .2)) * lit + rim * .75) + uPale * halo * .05 + uWarm * smoke * .04;
    gl_FragColor = vec4(col * shown * kept * uLevel * flick, 1.);
  }`;

const EMBER_VERTEX = `
  attribute vec3 aTarget; attribute vec4 aSeed; // delay, duration, random, height on the figure
  uniform float uT, uD, uTime, uScale, uLevel; uniform vec3 uFrom, uHead; varying float vA;
  void main(){
    float k = clamp((uT - aSeed.x) / aSeed.y, 0., 1.), e = k * k * (3. - 2. * k), ph = aSeed.z * 60.;
    // out of the fire, up in an arc, onto its place in the figure
    vec3 ctrl = mix(uFrom, aTarget, .3) + vec3((aSeed.z - .5) * .9, .7 + aSeed.z * .9, (fract(aSeed.z * 13.7) - .5) * .9);
    vec3 p = mix(mix(uFrom, ctrl, e), mix(ctrl, aTarget, e), e);
    p += vec3(sin(uTime * 1.3 + ph), sin(uTime * 1.9 + ph * 1.3), cos(uTime * 1.1 + ph * .7)) * .012 * e;
    float a = smoothstep(0., .25, k) * (.5 + .5 * sin(uTime * (1.5 + aSeed.z * 3.) + ph)) * (1. - .55 * e * fract(aSeed.z * 3.1));
    if (uD >= 0.) { // then up, all of them, into one light
      float d = clamp((uD - (1. - aSeed.w) * .45 - fract(aSeed.z * 7.3) * .3) / 1.15, 0., 1.), f = d * d * (3. - 2. * d);
      p = mix(p + vec3(0., d * .7, 0.), uHead, f * f); a = mix(a, 1., f) * (1. - smoothstep(.85, 1., d) * .7);
    }
    vA = a * uLevel;
    vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
    gl_PointSize = uScale * (.01 + .016 * aSeed.z) / max(.3, -mv.z);
  }`;
const EMBER_FRAGMENT = `varying float vA; void main(){ float r = length(gl_PointCoord - .5), a = smoothstep(.5, .05, r) * vA * .5; if (a < .003) discard; gl_FragColor = vec4(vec3(1., .6, .27) * a, 1.); }`;

type Figure = { mesh: THREE.Mesh; glow: THREE.ShaderMaterial; embers?: THREE.Points; ember?: THREE.ShaderMaterial; base: THREE.Vector3; head: THREE.Vector3;
  born: number; goneAt: number; crowd: boolean; level: number };

const textures = new WeakMap<HTMLCanvasElement, THREE.CanvasTexture>();
const samples = new WeakMap<HTMLCanvasElement, Float32Array>();
const texture = (c: HTMLCanvasElement) => { let t = textures.get(c); if (!t) { t = new THREE.CanvasTexture(c); t.anisotropy = 4; textures.set(c, t); } return t; };
/** points on the figure (u, v in 0…1, v up), found once per silhouette */
function pointsOn(c: HTMLCanvasElement) {
  let list = samples.get(c); if (list) return list;
  const { width: w, height: h } = c, data = c.getContext("2d")!.getImageData(0, 0, w, h).data, out: number[] = [];
  let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let tries = 0; out.length < 8000 && tries < 400000; tries++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); if (data[(y * w + x) * 4 + 3] > 140) out.push(x / w, 1 - y / h); }
  list = new Float32Array(out); samples.set(c, list); return list;
}

export function createApparitions(o: { scene: THREE.Scene; height: (x: number, z: number) => number; small: boolean; pixelRatio: number }) {
  const figures: Figure[] = [];
  const plane = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
  let time = 0;
  const WARM = new THREE.Color(1, .62, .3), PALE = new THREE.Color(.56, .6, .7);

  function figure(id: string, base: THREE.Vector3, toward: THREE.Vector3, height: number, crowd: boolean, from?: THREE.Vector3): Figure | null {
    const c = shadowCanvas(id); if (!c) return null;
    const width = height * SHADOW_ASPECT, yaw = Math.atan2(toward.x - base.x, toward.z - base.z);
    const glow = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uMask: { value: texture(c) }, uTime: { value: 0 }, uForm: { value: 0 }, uFade: { value: 0 }, uLevel: { value: 0 }, uSeed: { value: Math.random() },
        uWarm: { value: crowd ? PALE.clone().multiplyScalar(.9) : WARM.clone() }, uPale: { value: PALE.clone() } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`, fragmentShader: GLOW });
    const mesh = new THREE.Mesh(plane, glow); mesh.position.copy(base); mesh.rotation.y = yaw; mesh.scale.set(width, height, 1); mesh.renderOrder = 3; mesh.frustumCulled = false; o.scene.add(mesh);
    const head = base.clone().add(new THREE.Vector3(0, height * .95, 0));
    const f: Figure = { mesh, glow, base: base.clone(), head, born: time, goneAt: -1, crowd, level: crowd ? .2 : 1 };
    if (!crowd && from) {
      const pts = pointsOn(c), n = Math.min(pts.length / 2, o.small ? 700 : 1300), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), depth = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const target = new Float32Array(n * 3), seed = new Float32Array(n * 4);
      for (let k = 0; k < n; k++) { const j = Math.floor(Math.random() * pts.length / 2), u = pts[j * 2], v = pts[j * 2 + 1], p = base.clone().addScaledVector(right, (u - .5) * width).addScaledVector(depth, (Math.random() - .5) * .08); p.y += v * height;
        target.set([p.x, p.y, p.z], k * 3); seed.set([.1 + v * .9 + Math.random() * .5, .8 + Math.random() * .6, Math.random(), v], k * 4); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(target, 3)); geo.setAttribute("aTarget", new THREE.BufferAttribute(target, 3)); geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
      const ember = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, vertexShader: EMBER_VERTEX, fragmentShader: EMBER_FRAGMENT,
        uniforms: { uT: { value: 0 }, uD: { value: -1 }, uTime: { value: 0 }, uScale: { value: 1 }, uLevel: { value: 1 }, uFrom: { value: from.clone() }, uHead: { value: head.clone() } } });
      const embers = new THREE.Points(geo, ember); embers.frustumCulled = false; embers.renderOrder = 4; o.scene.add(embers);
      f.embers = embers; f.ember = ember;
    }
    figures.push(f); return f;
  }
  function remove(f: Figure) {
    o.scene.remove(f.mesh); f.glow.dispose();
    if (f.embers) { o.scene.remove(f.embers); f.embers.geometry.dispose(); f.ember!.dispose(); }
    figures.splice(figures.indexOf(f), 1);
  }

  return {
    /** the people a memorial remembers gather out of its fire, side by side at `base`, facing `toward` */
    summon(ids: string[], base: THREE.Vector3, toward: THREE.Vector3, from: THREE.Vector3, height = 2.15) {
      const across = new THREE.Vector3().subVectors(toward, base).setY(0).normalize(), side = new THREE.Vector3(across.z, 0, -across.x), gap = height * SHADOW_ASPECT * .78;
      ids.forEach((id, k) => { const p = base.clone().addScaledVector(side, (k - (ids.length - 1) / 2) * gap); p.y = o.height(p.x, p.z); figure(id, p, toward, height, false, from); });
    },
    /** the nameless people of the age, standing farther off in the dark */
    crowd(ids: string[], around: THREE.Vector3, toward: THREE.Vector3, spread = 1) {
      const away = Math.atan2(around.x - toward.x, around.z - toward.z);
      ids.forEach((id, k) => {
        const a = away + ((k + .5) / ids.length - .5) * 2.3 * spread + (Math.random() - .5) * .25, d = 8 + Math.random() * 7 + (k % 2) * 3;
        const p = new THREE.Vector3(around.x + Math.sin(a) * d, 0, around.z + Math.cos(a) * d); p.y = o.height(p.x, p.z) - .05;
        const f = figure(id, p, toward, 1.95 + Math.random() * .2, true); if (f) f.born = time + k * .5;
      });
    },
    /** let them go: the embers stream into one light at `into` (or above their heads), which is returned */
    release(into?: THREE.Vector3) {
      const main = figures.filter(f => !f.crowd && f.goneAt < 0), head = into?.clone() ?? (main.length ? main.reduce((a, f) => a.add(f.head), new THREE.Vector3()).multiplyScalar(1 / main.length).add(new THREE.Vector3(0, .35, 0)) : null);
      for (const f of figures) if (f.goneAt < 0) { f.goneAt = time; if (head && f.ember) f.ember.uniforms.uHead.value.copy(head); }
      return head;
    },
    clear() { while (figures.length) remove(figures[0]); },
    update(dt: number, camera: THREE.PerspectiveCamera, flicker: number) {
      time += dt;
      const scale = window.innerHeight * o.pixelRatio / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      for (const f of [...figures]) {
        const age = time - f.born, gone = f.goneAt < 0 ? -1 : time - f.goneAt, far = f.base.distanceTo(camera.position);
        if (f.goneAt < 0 && far > (f.crowd ? 30 : 16)) { f.goneAt = time; }
        const g = f.glow.uniforms;
        g.uTime.value = time;
        g.uForm.value = f.crowd ? Math.min(1, Math.max(0, age) / 3) : Math.min(1, Math.max(0, age - .5) / 2.1);
        g.uFade.value = gone < 0 ? 0 : Math.min(1, gone / (f.crowd ? 2.6 : 1.6));
        g.uLevel.value = f.level * (f.crowd ? .85 + .15 * Math.sin(time * .7 + f.born) : flicker) * (f.crowd ? Math.min(1, Math.max(0, age) / 2) : 1);
        if (f.ember) { const u = f.ember.uniforms; u.uT.value = age; u.uD.value = gone; u.uTime.value = time; u.uScale.value = scale; u.uLevel.value = flicker; }
        if (gone > (f.crowd ? 2.8 : 2.3)) remove(f);
      }
    },
  };
}
