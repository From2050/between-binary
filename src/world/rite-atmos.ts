import * as THREE from "three";
import { besideRoad, riteLength, zones, stationMeters, pointAt } from "./rite-path.ts";

const seeded = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

/** The air along the road: low mist in the forest and the hollows, smoke over the burnt country, a sea of
 * mist in the dark land beyond the crest. Soft camera-facing cards, one instanced draw. */
export function addAtmosphere(o: { scene: THREE.Scene; height: (x: number, z: number) => number; small: boolean }) {
  const random = seeded(4242);
  // a cloudy blot: many soft discs, so no card reads as a circle
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  { const g = canvas.getContext("2d")!;
    for (let i = 0; i < 46; i++) { const a = random() * Math.PI * 2, r = Math.pow(random(), .7) * 34, x = 64 + Math.cos(a) * r * 1.25, y = 64 + Math.sin(a) * r * .7, size = 14 + random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, size); gr.addColorStop(0, "rgba(255,255,255,.16)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    const fade = g.createRadialGradient(64, 64, 30, 64, 64, 64); fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out"; g.fillStyle = fade; g.fillRect(0, 0, 128, 128); }
  const map = new THREE.CanvasTexture(canvas);

  type Card = { x: number; y: number; z: number; w: number; h: number; kind: number };
  const cards: Card[] = [];
  const mist = (s: number, side: number, off: number, w: number, lift = 0) => { const [x, z] = besideRoad(Math.min(s, riteLength), side, off); cards.push({ x, z, y: o.height(x, z) + w * .16 + lift, w, h: w * .42, kind: 0 }); };
  const thin = o.small ? 2 : 1;
  for (let s = 18; s < zones.forest[1]; s += 2.6 * thin) mist(s, random() > .5 ? 1 : -1, 3 + random() * 26, 7 + random() * 9);
  for (let s = zones.forest[1]; s < zones.ash[0]; s += 4.2 * thin) mist(s, random() > .5 ? 1 : -1, 6 + random() * 38, 10 + random() * 14);
  for (let s = zones.ascent[0]; s < riteLength; s += 7 * thin) mist(s, random() > .5 ? 1 : -1, 14 + random() * 40, 12 + random() * 12);
  // beyond the crest: the land falls away into a sea of mist with no road through it
  { const [ex, ez, tx, tz] = pointAt(riteLength);
    for (let k = 0; k < (o.small ? 26 : 50); k++) { const d = 60 + random() * 260, side = (random() - .5) * 2 * (40 + d * .9), x = ex + tx * d - tz * side, z = ez + tz * d + tx * side, w = 40 + random() * 50;
      cards.push({ x, z, y: o.height(x, z) + w * .1, w, h: w * .3, kind: 0 }); } }
  // smoke rising from the burnt country
  for (let k = 0; k < 14; k++) { const s = zones.ash[0] + random() * (zones.ash[1] - zones.ash[0]), [x, z] = besideRoad(s, random() > .5 ? 1 : -1, 8 + random() * 40);
    for (let j = 0; j < (o.small ? 3 : 5); j++) cards.push({ x, z, y: o.height(x, z) + 1, w: 6 + random() * 5, h: 6 + random() * 5, kind: 1 + j / 5 }); }

  const plane = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry();
  geo.index = plane.index; geo.setAttribute("position", plane.attributes.position); geo.setAttribute("uv", plane.attributes.uv);
  geo.setAttribute("iPos", new THREE.InstancedBufferAttribute(new Float32Array(cards.flatMap(c => [c.x, c.y, c.z])), 3));
  geo.setAttribute("iSize", new THREE.InstancedBufferAttribute(new Float32Array(cards.flatMap(c => [c.w, c.h])), 2));
  geo.setAttribute("iSeed", new THREE.InstancedBufferAttribute(new Float32Array(cards.map(() => random())), 1));
  geo.setAttribute("iKind", new THREE.InstancedBufferAttribute(new Float32Array(cards.map(c => c.kind)), 1));
  geo.instanceCount = cards.length;
  const uniforms = { uMap: { value: map }, uTime: { value: 0 }, uMist: { value: 1 }, uSmoke: { value: 0 }, uMistColor: { value: new THREE.Color(.02, .026, .04) }, uSmokeColor: { value: new THREE.Color(.018, .014, .012) } };
  const material = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, fog: false,
    vertexShader: `attribute vec3 iPos; attribute vec2 iSize; attribute float iSeed; attribute float iKind;
      uniform float uTime, uMist, uSmoke; varying vec2 vUv; varying float vA; varying float vSmoke;
      void main(){
        vUv = uv; vec3 c = iPos; vec2 size = iSize; float a;
        if (iKind > .5) { float age = fract(uTime * .03 + iSeed + iKind * 3.7); c.y += age * 26.; c.x += age * age * 9.; size *= .5 + age * 1.9;
          a = smoothstep(0., .18, age) * (1. - smoothstep(.5, 1., age)) * uSmoke * .55; vSmoke = 1.; }
        else { c.x += sin(uTime * .03 + iSeed * 6.28) * 2.2; c.z += cos(uTime * .024 + iSeed * 4.1) * 2.2; a = uMist * (.55 + .45 * sin(uTime * .09 + iSeed * 9.)) * mix(1., .45, smoothstep(30., 80., size.x)); vSmoke = 0.; }
        vec3 right = normalize(vec3(viewMatrix[0][0], 0., viewMatrix[2][0]) + vec3(1e-5, 0., 0.));
        vec3 world = c + right * position.x * size.x + vec3(0., position.y * size.y, 0.);
        float d = distance(world, cameraPosition);
        vA = a * smoothstep(2.5, 11., d) * (1. - smoothstep(320., 520., d));
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uMistColor, uSmokeColor; uniform float uTime; varying vec2 vUv; varying float vA; varying float vSmoke;
      void main(){ vec2 uv = vUv + vec2(sin(uTime * .05 + vUv.y * 3.) * .03, 0.); float a = texture2D(uMap, uv).a * vA; if (a < .002) discard;
        gl_FragColor = vec4(mix(uMistColor, uSmokeColor, vSmoke), a); }` });
  const cardsMesh = new THREE.Mesh(geo, material); cardsMesh.frustumCulled = false; cardsMesh.renderOrder = 1; o.scene.add(cardsMesh);

  // the war beyond the hills: a low red glow on the horizon while you are in the ashes
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlow(), color: 0xa03a12, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  { const [x, z, tx, tz] = pointAt(stationMeters[6]); glow.position.set(x + tx * 260 + tz * 140, o.height(x, z) + 6, z + tz * 260 - tx * 140); glow.scale.set(420, 70, 1); o.scene.add(glow); }

  return {
    /** mist, smoke and the war's glow: 0…1 */
    update(time: number, k: { mist: number; smoke: number; war: number }) {
      uniforms.uTime.value = time; uniforms.uMist.value = k.mist; uniforms.uSmoke.value = k.smoke;
      glow.material.opacity = k.war * (.32 + .1 * Math.sin(time * .7) * Math.sin(time * 1.9));
    },
  };
}
function makeGlow() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.4, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
