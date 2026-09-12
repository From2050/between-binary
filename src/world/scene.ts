import {
  skyVertex,
  skyFragment,
  starsVertex,
  starsFragment,
  fireVertex,
  fireFragment,
} from "./shaders";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { civilizationStars } from "../data/civilizationStars";

import { createExploration } from "./exploration";
import { createWind, sampleWind } from "./wind";
import { starDirections } from "./celestial";
import { addLandscape } from "./landscape";
import { populateForest } from "./forest";
import { populateUnderstory } from "./understory";
import { terrainHeight, distToPath } from "./terrain";
import { addVista } from "./vista";

export async function initWorld() {
  let needsRender = true;
  let contextLost = false;
  const smallScreen = window.matchMedia("(max-width: 700px)").matches;

  // ─── Renderer / scene / camera ───
  const canvas = document.getElementById("world-canvas") as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, smallScreen ? 1.15 : 1.5),
  );
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1423, 0.0035);

  const camera = new THREE.PerspectiveCamera(
    Math.max(60, Math.min(86, THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.PI/6)/(innerWidth/innerHeight))))),
    window.innerWidth / window.innerHeight,
    0.1,
    3000,
  );
  camera.position.set(0, 1.7, 6);
  camera.rotation.order = "YXZ";

  const renderTarget = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {type: THREE.HalfFloatType});
  renderTarget.samples = smallScreen ? 0 : 4;
  const composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.16, // strength — restrained, so only genuinely hot things bloom
    0.6, // radius
    0.9, // threshold
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ─── Seeded noise (terrain + scatter) ───
  function hash2(x: number, y: number) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function vnoise2(x: number, y: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  function fbm2(x: number, y: number, oct = 4) {
    let s = 0;
    let a = 0.5;
    let f = 1;
    for (let i = 0; i < oct; i++) {
      s += a * vnoise2(x * f, y * f);
      f *= 2.07;
      a *= 0.5;
    }
    return s;
  }
  const rng = (() => {
    let s = 42;
    return () => ((s = (s * 16807) % 2147483647), s / 2147483647);
  })();
  const smoothstep = (e0: number, e1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  // ─── The path: where the walk goes, and what it keeps flat ───
  const FIRE_POS = new THREE.Vector3(-1, 0, -5);
  const GROVE_POS = new THREE.Vector3(-2.4, 0, -23);
  const GATE_POS = new THREE.Vector3(-8, 0, -16);

  // Photographic forest floor. One continuous surface with a worn path mask,
  // avoiding overlapping ribbons and rows of identical circular stones.
  const soilLoader = new THREE.TextureLoader();
  const floorTextures = await Promise.all(["color", "normal", "roughness"].map(name =>
    soilLoader.loadAsync(`/textures/forest-floor/${name}.jpg`)));
  floorTextures.forEach(texture => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  });
  floorTextures[0].colorSpace = THREE.SRGBColorSpace;
  function makeGround(size: number, segments: number, far = false) {
    const geo = new THREE.PlaneGeometry(size,size,segments,segments);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const colors = new Float32Array(pos.count*3);
    const wear = new Float32Array(pos.count);
    for (let i=0;i<pos.count;i++) {
      const x=pos.getX(i), z=-pos.getY(i);
      pos.setZ(i,terrainHeight(x,z));
      uv.setXY(i,x/2.6,z/2.6);
      const shade=.55+fbm2(x*.21+8,z*.21+4)*.65;
      colors.set([shade,shade*.94,shade*.83],i*3);
      const jitter=(vnoise2(x*2,z*2)-.5)*.45;
      const path=1-smoothstep(.42,1.25,distToPath(x,z)+jitter);
      const yard=1-smoothstep(2.2,3.5,Math.hypot(x+1,z+5));
      wear[i]=Math.max(path,yard*.85);
    }
    if (far) {
      const source=geo.index!;const indices=[];
      for(let i=0;i<source.count;i+=3) {
        const ids=[source.getX(i),source.getX(i+1),source.getX(i+2)];
        // Both grids meet exactly at +/-50, without z-fighting.
        const x=ids.reduce((sum,id)=>sum+pos.getX(id),0)/3;
        const z=ids.reduce((sum,id)=>sum-pos.getY(id),0)/3;
        if(Math.abs(x)>=50 || Math.abs(z)>=50) indices.push(...ids);
      }
      geo.setIndex(indices);
    }
    geo.setAttribute("color",new THREE.BufferAttribute(colors,3));
    geo.setAttribute("pathWear",new THREE.BufferAttribute(wear,1));
    geo.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({
      map:floorTextures[0],normalMap:floorTextures[1],roughnessMap:floorTextures[2],
      normalScale:new THREE.Vector2(.7,.7),roughness:1,vertexColors:true,
    });
    material.onBeforeCompile = shader => {
      shader.vertexShader="attribute float pathWear; varying float vPathWear;\n"+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvPathWear=pathWear;");
      shader.fragmentShader=`varying float vPathWear;
        float groundNoise(vec2 p) {
          vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
          vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),
            dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+vec2(1,1),vec2(127.1,311.7))))*43758.5453);
          return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
        }
        vec4 floorSample(sampler2D tex,vec2 uv) {
          float blend=smoothstep(.2,.8,groundNoise(uv*.43));
          return mix(texture2D(tex,uv),texture2D(tex,uv+vec2(.37,.63)),blend);
        }
      `+shader.fragmentShader;
      // Matching offsets in all three maps keep colour and relief registered.
      shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",
        THREE.ShaderChunk.map_fragment.replace("texture2D( map, vMapUv )","floorSample(map,vMapUv)"));
      shader.fragmentShader=shader.fragmentShader.replace("#include <normal_fragment_maps>",
        THREE.ShaderChunk.normal_fragment_maps.replaceAll("texture2D( normalMap, vNormalMapUv )","floorSample(normalMap,vNormalMapUv)"));
      shader.fragmentShader=shader.fragmentShader.replace("#include <roughnessmap_fragment>",
        THREE.ShaderChunk.roughnessmap_fragment.replace("texture2D( roughnessMap, vRoughnessMapUv )","floorSample(roughnessMap,vRoughnessMapUv)"));
      shader.fragmentShader=shader.fragmentShader.replace("diffuseColor *= sampledDiffuseColor;",`diffuseColor *= sampledDiffuseColor;
        float grain=dot(diffuseColor.rgb,vec3(.299,.587,.114));
        vec3 trodden=vec3(.17,.12,.073)*(.55+grain*1.7);
        diffuseColor.rgb=mix(diffuseColor.rgb,trodden,vPathWear*.28);`);
    };
    material.customProgramCacheKey=()=>"forest-floor-wear-v2";
    const ground=new THREE.Mesh(geo,material);
    ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  }
  makeGround(100,250);
  makeGround(1400,280,true);

  // ─── Lights ───
  // Three direct sources. A low-energy light probe approximates their missing
  // diffuse moon/sky bounce; it is not an additional directional source or lamp.
  const moonBounce = new THREE.LightProbe();
  moonBounce.sh.coefficients[0].set(.13,.18,.26);
  moonBounce.intensity = 1;
  scene.add(moonBounce);
  const wind = createWind();
  const landscape=addLandscape(scene, terrainHeight, distToPath, rng, smallScreen);
  const moonLight = new THREE.DirectionalLight(0xc4d4ed, .65);
  moonLight.position.set(-45, 40, -35);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(smallScreen ? 1024 : 2048, smallScreen ? 1024 : 2048);
  moonLight.shadow.normalBias = .025;
  moonLight.shadow.radius = 2;
  moonLight.shadow.autoUpdate = false;
  Object.assign(moonLight.shadow.camera, {left:-26,right:26,top:26,bottom:-26,near:1,far:110});
  moonLight.target.position.set(0,0,-13);
  moonLight.shadow.bias = -0.0004;
  scene.add(moonLight.target);
  scene.add(moonLight);

  // ─── Sky: fully procedural GLSL ───
  // ─── The celestial sphere ───
  // The painted dome, the civilization stars and the moon are all children of
  // this one group, so they turn as a single rigid body. Nothing in the sky can
  // drift against anything else in it, because nothing rotates on its own.
  const SKY_SPIN = 0.0018;
  const starsGroup = new THREE.Group();
  scene.add(starsGroup);
  const skyUniforms = { uTime: { value: 0 } };
  {
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
    });
    starsGroup.add(
      new THREE.Mesh(new THREE.SphereGeometry(2000, 64, 32), skyMat),
    );
  }

  // ─── Texture loading (AI-generated art lives in public/images/world/) ───
  const loadingEl = document.getElementById("loading")!;
  let modelReady = false;
  function ready() {
    if (!modelReady) return;
    needsRender = true;
    loadingEl.classList.add("done");
    const enter = document.getElementById("enter-sound") as HTMLButtonElement;
    enter.disabled = false;
    enter.textContent = "Enter with sound";
    (document.getElementById("enter-quiet") as HTMLButtonElement).disabled =
      false;
  }
  const texManager = new THREE.LoadingManager(ready, undefined, () => {
    needsRender = true;
  });
  // Textures are enhancements: the route remains usable if an image fails.
  const loadingTimeout = window.setTimeout(ready, 6000);
  window.addEventListener("pagehide", () => clearTimeout(loadingTimeout), {
    once: true,
  });
  const texLoader = new THREE.TextureLoader(texManager);
  function loadArt(url: string) {
    const tex = texLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeGlowTexture() {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const ctx = cv.getContext("2d")!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.8)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }
  const glowTexture = makeGlowTexture();

  // ─── The sky's people: distant pinpoints, not nearby orbs ───
  // Screen-space sized (sizeAttenuation off) so they read as stars at any depth.
  const STAR_RADIUS = 1920;

  // Fixed to the celestial sphere: their only motion is the sky's own rotation,
  // which is what keeps them reading as far away. Brightness twinkles per star —
  // that part is real; independent drift is not, and made them look nearby.
  const civMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: glowTexture },
      uSize: { value: 10 * renderer.getPixelRatio() },
    },
    vertexShader: starsVertex,
    fragmentShader: starsFragment,
  });
  {
    const n = civilizationStars.length;
    const pos = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    const c = new THREE.Color();
    const directions=starDirections(n);
    civilizationStars.forEach((star, i) => {
      pos.set(directions[i].map(value=>value*STAR_RADIUS),i*3);
      phase[i] = rng();
      c.set(star.color).lerp(new THREE.Color(0xfff4d9), 0.55);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    const points = new THREE.Points(geo, civMat);
    points.name = "civ-stars";
    points.frustumCulled = false;
    starsGroup.add(points);
  }

  let moonDisc: THREE.Sprite;
  // The moon, far off behind the hills
  {
    // Side/front moonlight opens the inhabited clearing and garden while the
    // forest behind the workshop remains a darker spatial boundary.
    const az = 0.78;
    const el = 0.84;
    const p = new THREE.Vector3(
      STAR_RADIUS * Math.cos(el) * Math.cos(az),
      STAR_RADIUS * Math.sin(el),
      STAR_RADIUS * Math.cos(el) * Math.sin(az),
    );
    // a real lunar disc, not a light bulb — dimmed so it doesn't bloom out
    const disc = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: loadArt("/images/world/moon.png"),
        color: 0x9aa4b8, // knock the exposure down; bloom does the rest
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    moonDisc = disc;
    disc.position.copy(p);
    disc.scale.set(75, 75, 1);
    starsGroup.add(disc);

    // the faintest atmosphere around it
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x8fa4d8,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    halo.position.copy(p);
    halo.scale.set(160, 160, 1);
    starsGroup.add(halo);
  }

  const vista=await addVista(scene,starsGroup,smallScreen,moonLight,moonBounce);

  // ─── Places ───
  type Place = {
    group: THREE.Group;
    hitBox: THREE.Mesh;
    lights: THREE.PointLight[];
    baseIntensity: number[];
    label: THREE.Sprite;
    href: string;
    hint: string;
  };
  const places: Place[] = [];

  function makeLabel(text: string, color: string) {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 128;
    const ctx = cv.getContext("2d")!;
    ctx.font = '500 44px "Space Grotesk", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "10px";
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 64);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(cv),
        transparent: true,
        opacity: 0.42, // quiet until you look at it
        depthWrite: false,
        fog: false,
      }),
    );
    sprite.scale.set(4.4, 1.1, 1);
    sprite.visible = false;
    return sprite;
  }

  function registerPlace(
    group: THREE.Group,
    href: string,
    hint: string,
    lights: THREE.PointLight[],
    label: THREE.Sprite,
    hitSize: [number, number, number],
    hitCenterY: number,
  ) {
    const hitBox = new THREE.Mesh(
      href === "/thoughts/"
        ? new THREE.CylinderGeometry(.22, 1.3, 1.9, 16)
        : new THREE.BoxGeometry(...hitSize),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitBox.position.y = hitCenterY;
    group.add(hitBox);
    group.add(label);
    places.push({
      group,
      hitBox,
      lights,
      baseIntensity: lights.map((l) => l.intensity),
      label,
      href,
      hint,
    });
    scene.add(group);
  }

  // ── The fire: where the long-form writing is told ──
  let flameMesh: THREE.Mesh;
  let flameMat: THREE.ShaderMaterial;
  let fireLight: THREE.PointLight;
  const emberGeo = new THREE.BufferGeometry();
  const EMBER_COUNT = 32;
  const emberSeed = new Float32Array(EMBER_COUNT * 3);
  {
    const g = new THREE.Group();
    g.position.copy(FIRE_POS);

    // The flame is drawn, not scaled: upward-scrolling domain-warped noise
    // eats into a teardrop body, so the shape actually churns and licks.
    flameMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      fog: false,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uWind: {value:0} },
      vertexShader: fireVertex,
      fragmentShader: fireFragment,
    });
    flameMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.65), flameMat);
    flameMesh.position.y = 1.05;
    // cylindrical billboard: face the viewer, stay upright
    flameMesh.rotation.y = Math.atan2(
      camera.position.x - FIRE_POS.x,
      camera.position.z - FIRE_POS.z,
    );
    g.add(flameMesh);

    fireLight = new THREE.PointLight(0xffa052, 38, 24, 2);
    fireLight.position.set(0, 1.1, 0);
    fireLight.castShadow = true;
    fireLight.shadow.mapSize.set(smallScreen ? 256 : 512,smallScreen ? 256 : 512);
    fireLight.shadow.camera.near=.15;fireLight.shadow.camera.far=24;
    fireLight.shadow.normalBias=.025;fireLight.shadow.bias=-.00015;
    fireLight.shadow.autoUpdate=false;
    g.add(fireLight);

    // embers rising from the flame
    {
      const pos = new Float32Array(EMBER_COUNT * 3);
      for (let i = 0; i < EMBER_COUNT; i++) {
        emberSeed[i * 3] = rng() * Math.PI * 2; // angle
        emberSeed[i * 3 + 1] = rng(); // phase
        emberSeed[i * 3 + 2] = 0.35 + rng() * 0.5; // speed
        pos[i * 3] = 0;
        pos[i * 3 + 1] = 1;
        pos[i * 3 + 2] = 0;
      }
      emberGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const embers = new THREE.Points(
        emberGeo,
        new THREE.PointsMaterial({
          color: 0xffb765,
          size: 0.075,
          map: glowTexture,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      embers.frustumCulled = false;
      g.add(embers);
    }

    const label = makeLabel("THOUGHTS", "#ffd7a8");
    label.position.set(0, 4.6, 0);
    registerPlace(
      g,
      "/thoughts/",
      "Sit by the fire — long-form writing",
      [fireLight],
      label,
      [2.5, 1.9, 2.5],
      .9,
    );
  }

  // ── The grove: seedling → budding → evergreen, the garden's own growth model ──

  {
    const g = new THREE.Group();
    g.position.copy(GROVE_POS);

    const label = makeLabel("GARDEN", "#9df5cf");
    label.position.set(0, 6.6, 0);
    registerPlace(
      g,
      "/garden/",
      "Into the grove — notes that keep growing",
      [],
      label,
      [5, 3.5, 8],
      1.5,
    );
  }

  // ── The workshop: a lit hut where the experiments actually happen ──
  let doorGlowMat: THREE.SpriteMaterial;
  let gateLight: THREE.PointLight;
  let windowMat: THREE.MeshBasicMaterial;
  {
    const g = new THREE.Group();
    g.position.copy(GATE_POS);
    const W=7, D=5.6, WALL=3.2, RISE=2;
    // light spilling out onto the ground, not blasting the whole field
    doorGlowMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffb066,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spill = new THREE.Sprite(doorGlowMat);
    spill.position.set(-0.3, 1.2, D / 2 + 0.5);
    spill.scale.set(5.5, 4, 1);
    g.add(spill);

    gateLight = new THREE.PointLight(0xffb066, 5.5, 20, 2);
    gateLight.position.set(-1.4, 2.05, 2.05);
    gateLight.intensity=26;
    gateLight.castShadow=true;
    gateLight.shadow.mapSize.set(smallScreen ? 256 : 512,smallScreen ? 256 : 512);
    gateLight.shadow.camera.near=.1;gateLight.shadow.camera.far=20;
    gateLight.shadow.normalBias=.02;gateLight.shadow.bias=-.00015;
    gateLight.shadow.autoUpdate=false;
    g.add(gateLight);

    const label = makeLabel("LAB", "#ffd08a");
    label.position.set(0, WALL + RISE + 1.5, 0);
    registerPlace(
      g,
      "/lab/",
      "Knock on the workshop — experiments in progress",
      [gateLight],
      label,
      [W + 1, WALL + RISE + 0.5, D + 1],
      (WALL + RISE) / 2,
    );
  }

  const decoder = new DRACOLoader().setDecoderPath("/models/decoder/");
  const modelLoader = new GLTFLoader().setDRACOLoader(decoder);
  try {
    const [model,forest,details,understory,wood]=await Promise.all([
      modelLoader.loadAsync('/models/world/woodland.glb'),
      modelLoader.loadAsync('/models/world/forest.glb'),
      modelLoader.loadAsync('/models/world/ground-details.glb'),
      modelLoader.loadAsync('/models/world/understory.glb'),
      Promise.all(['color','normal','roughness'].map(name=>soilLoader.loadAsync(`/textures/weathered-wood/${name}.jpg`))),
    ]);
    wood.forEach(texture=>{texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;});
    wood[0].colorSpace=THREE.SRGBColorSpace;
    await vista.useRockSurface();
    populateForest(scene,forest.scene,details.scene,wind,terrainHeight,smallScreen,object=>vista.reflect(object));
    populateUnderstory(scene,understory.scene,wind,terrainHeight,distToPath,smallScreen);
    model.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        const names=mats.map(mat=>mat.name).join(" ");
        if(names.includes('Window glass')) {object.castShadow=false;object.receiveShadow=false;}
        for(const material of mats) {
          if(/Weathered cedar|Oak joinery|Bark/.test(material.name)) {
            material.map=wood[0];material.normalMap=wood[1];material.roughnessMap=wood[2];
            material.normalScale=new THREE.Vector2(.4,.4);material.color.set(0x95836b);
          }
        }
        if (/Fir needles|Bark/.test(names)) wind.install(object,"canopy");
        else if (/Leaves|Wildflowers/.test(names)) wind.install(object,"plant");
        for (const mat of mats) if (mat.map) mat.map.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());
      }
    });
    scene.add(model.scene);
    renderer.shadowMap.autoUpdate = true;
    fireLight.shadow.needsUpdate=true;gateLight.shadow.needsUpdate=true;moonLight.shadow.needsUpdate=true;
    renderer.shadowMap.needsUpdate = true;
    modelReady = true;
  } finally { decoder.dispose(); }

  // ─── Fireflies over the open ground ───
  const fireflyCount = smallScreen ? 16 : 28;
  const fireflyBase = new Float32Array(fireflyCount * 3);
  const fireflyPhase = new Float32Array(fireflyCount);
  const fireflyGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(fireflyCount * 3);
    for (let i = 0; i < fireflyCount; i++) {
      const a = rng() * Math.PI * 2;
      const d = 3 + rng() * 26;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d - 10;
      fireflyBase[i * 3] = x;
      fireflyBase[i * 3 + 1] = terrainHeight(x, z) + 0.5 + rng() * 2.4;
      fireflyBase[i * 3 + 2] = z;
      fireflyPhase[i] = rng() * Math.PI * 2;
      pos.set(fireflyBase.subarray(i * 3, i * 3 + 3), i * 3);
    }
    fireflyGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const flies = new THREE.Points(
      fireflyGeo,
      new THREE.PointsMaterial({
        color: 0xffe9a3,
        size: 0.11,
        map: glowTexture,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    flies.frustumCulled = false;
    scene.add(flies);
  }

  // ─── Shooting stars ───
  type Meteor = {
    line: THREE.Line;
    mat: THREE.LineBasicMaterial;
    start: THREE.Vector3;
    dir: THREE.Vector3;
    t: number;
    life: number;
    active: boolean;
  };
  const meteors: Meteor[] = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.LineBasicMaterial({
      color: 0xcfe8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    scene.add(line);
    meteors.push({
      line,
      mat,
      start: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      t: 0,
      life: 0.9,
      active: false,
    });
  }
  let nextMeteorAt = 4;
  function spawnMeteor(now: number) {
    const m = meteors.find((mm) => !mm.active);
    if (!m) return;
    const az = rng() * Math.PI * 2;
    const el = 0.5 + rng() * 0.6;
    const r = 150;
    m.start.set(
      r * Math.cos(el) * Math.cos(az),
      r * Math.sin(el),
      r * Math.cos(el) * Math.sin(az),
    );
    m.dir
      .set(Math.cos(az + 2), -0.5 - rng() * 0.3, Math.sin(az + 2))
      .normalize()
      .multiplyScalar(70 + rng() * 40);
    m.t = now;
    m.life = 0.7 + rng() * 0.5;
    m.active = true;
  }

  // Exploration owns camera movement, focus, cards, and audio.
  ready();
  const exploration = createExploration(camera, canvas, starsGroup, places);
  for (const event of [
    "pointermove",
    "pointerdown",
    "pointerup",
    "keydown",
    "click",
    "input",
  ])
    window.addEventListener(event, () => {
      needsRender = true;
    });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(frameId);
    exploration.dispose();
    document.getElementById("fallback")!.hidden = false;
    document.getElementById("arrival")!.hidden = true;
    document.getElementById("wayfinding")!.hidden = true;
    document.getElementById("world-controls")!.hidden = true;
  });
  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov=Math.max(60,Math.min(86,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.PI/6)/camera.aspect))));
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    needsRender = true;
  });

  // ─── Render loop ───
  const clock = new THREE.Clock();
  let lastMoonShadowTime=-1, lastLocalShadowTime=-1;
  let sceneTime = 0,
    frameId = 0,
    lastRender = 0;
  function frame(now = performance.now()) {
    if (document.hidden || contextLost) return;
    frameId = requestAnimationFrame(frame);
    if (now - lastRender < 1000 / (smallScreen ? 30 : 45)) return;
    lastRender = now;
    const dt = Math.min(clock.getDelta(), 0.08);
    exploration.update(dt);
    if (exploration.paused && !needsRender) return;
    if (!exploration.paused) sceneTime += dt;
    const t = sceneTime;
    wind.update(t);
    vista.update(t);
    landscape.update(t,exploration.paused?0:dt);
    const breeze=sampleWind(t,FIRE_POS.x,FIRE_POS.z);

    needsRender = false;
    flameMesh.rotation.y = Math.atan2(
      camera.position.x - FIRE_POS.x,
      camera.position.z - FIRE_POS.z,
    );
    // Project the world wind onto the billboard right axis as the viewpoint changes.
    flameMat.uniforms.uWind.value=breeze.x*Math.cos(flameMesh.rotation.y)-breeze.z*Math.sin(flameMesh.rotation.y);
    if (!exploration.paused) {
      skyUniforms.uTime.value = t;
      civMat.uniforms.uTime.value = t;
      // the whole sky wheels as one piece — sky shader and stars share SKY_SPIN
      starsGroup.rotation.y = t * SKY_SPIN;

      // fireflies
      const fp = fireflyGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < fireflyCount; i++) {
        const ph = fireflyPhase[i];
        fp[i * 3] = fireflyBase[i * 3] + Math.sin(t * 0.4 + ph) * 0.9;
        fp[i * 3 + 1] =
          fireflyBase[i * 3 + 1] + Math.sin(t * 0.7 + ph * 2) * 0.35;
        fp[i * 3 + 2] = fireflyBase[i * 3 + 2] + Math.cos(t * 0.3 + ph) * 0.9;
      }
      fireflyGeo.attributes.position.needsUpdate = true;

      // fire: flicker, breathing flame, embers climbing
      const flicker =
        0.84 +
        0.16 * Math.sin(t * 11.3) * Math.sin(t * 5.1) +
        0.06 * Math.sin(t * 23.7);
      fireLight.intensity = 38 * flicker;
      flameMat.uniforms.uTime.value = t;
      flameMat.uniforms.uIntensity.value = 0.9 + flicker * 0.16;
      {
        const ep = emberGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < EMBER_COUNT; i++) {
          const a = emberSeed[i * 3];
          const life = (t * emberSeed[i * 3 + 2] + emberSeed[i * 3 + 1]) % 1;
          const rise = life * 2.8;
          const spread = 0.18 + life * 0.9;
          ep[i * 3] = Math.cos(a + life * 2.6) * spread + breeze.x*life*life*3;
          ep[i * 3 + 1] = 0.75 + rise;
          ep[i * 3 + 2] = Math.sin(a + life * 2.6) * spread + breeze.z*life*life*3;
        }
        emberGeo.attributes.position.needsUpdate = true;
      }

      if (t > nextMeteorAt) {
        spawnMeteor(t);
        nextMeteorAt = t + 4 + rng() * 6;
      }
      for (const m of meteors) {
        if (!m.active) continue;
        const age = t - m.t;
        if (age > m.life) {
          m.active = false;
          m.mat.opacity = 0;
          continue;
        }
        const head = m.start.clone().addScaledVector(m.dir, age);
        const tail = head.clone().addScaledVector(m.dir, -0.1);
        const arr = m.line.geometry.attributes.position.array as Float32Array;
        arr[0] = tail.x;
        arr[1] = tail.y;
        arr[2] = tail.z;
        arr[3] = head.x;
        arr[4] = head.y;
        arr[5] = head.z;
        m.line.geometry.attributes.position.needsUpdate = true;
        m.mat.opacity = Math.sin(Math.PI * (age / m.life)) * 0.9;
      }
    }

    // Track the visible lunar disc, including the sky group's rotation.
    starsGroup.updateMatrixWorld(true);
    const moonDirection=moonDisc.getWorldPosition(new THREE.Vector3()).normalize();
    moonLight.position.copy(moonDirection.multiplyScalar(70)).add(moonLight.target.position);
    if (t-lastMoonShadowTime>(smallScreen?.4:.18) || lastMoonShadowTime<0) {
      moonLight.shadow.needsUpdate=true;
      lastMoonShadowTime=t;
    }

    if(t-lastLocalShadowTime>(smallScreen?1.0:.6)||lastLocalShadowTime<0) {
      fireLight.shadow.needsUpdate=true;gateLight.shadow.needsUpdate=true;lastLocalShadowTime=t;
    }
    composer.render();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(frameId);
    } else {
      clock.getDelta();
      needsRender = true;
      frame();
    }
  });
  window.addEventListener(
    "pagehide",
    () => {
      cancelAnimationFrame(frameId);
      vista.dispose();
      renderer.dispose();
      composer.dispose();
    },
    { once: true },
  );
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) location.reload();
  });
  frame();
}
