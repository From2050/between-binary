import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { lakeLevel } from './terrain';

/** A lightweight ridge profile gives the lake and horizon their shape immediately. */
function makeRidgeOutline(layer:number) {
  const spans:[number,number,number][]=[[-1050,1150,-360],[-1450,1450,-830],[-1800,1800,-1270]];
  const [left,right,z]=spans[layer];
  const samples=[180,220,240][layer];
  const positions=new Float32Array((samples+1)*2*3);
  const colors=new Float32Array(positions.length);
  const indices:number[]=[];
  const low=new THREE.Color([0x0b1823,0x0d1925,0x101b28][layer]);
  const high=new THREE.Color([0x263645,0x344556,0x405064][layer]);
  const frost=new THREE.Color(0x738092);
  const peaks:[number,number][]=[[-480,110],[-160,160],[240,210],[630,130],[1000,100]];
  for(let i=0;i<=samples;i++) {
    const x=left+(right-left)*i/samples;
    const edge=Math.min(1,i/9,(samples-i)/9);
    const folds=Math.sin(x*.012+layer*.8)*7+Math.sin(x*.029+layer*2.4)*3+Math.sin(x*.071)*1.3;
    const summits=layer===0?0:peaks.reduce((sum,[center,height])=>
      sum+height*Math.exp(-Math.pow((x-center-layer*65)/([85,125][layer-1]),2))*[0,.32,.40][layer],0);
    const height=(-.6+[19,36,53][layer]+folds+summits)*Math.max(0,edge);
    const bottom=i*6,top=bottom+3;
    positions.set([x,-22,z],bottom);
    positions.set([x,height,z],top);
    const crest=high.clone().lerp(frost,Math.max(0,Math.min(.45,(height-58)/145)));
    colors.set(low.toArray(),bottom);
    colors.set(crest.toArray(),top);
    if(i<samples){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,
    transparent:true,opacity:1,depthWrite:false,fog:false});
  const ridge=new THREE.Mesh(geometry,material);
  ridge.name=`Procedural distant ridge ${layer+1}`;
  ridge.frustumCulled=false;
  return ridge;
}

/** The detailed ridge arrives after the nearby world is usable. */
export function addVista(scene:THREE.Scene,sky:THREE.Group,small:boolean,
  moon:THREE.DirectionalLight,bounce:THREE.LightProbe) {
  const outline=new THREE.Group();
  const outlineMaterials:THREE.MeshBasicMaterial[]=[];
  for(let layer=2;layer>=0;layer--) {
    const ridge=makeRidgeOutline(layer);
    outlineMaterials.push(ridge.material as THREE.MeshBasicMaterial);
    outline.add(ridge);
  }
  scene.add(outline);
  const reflectedScene=new THREE.Scene();
  reflectedScene.background=new THREE.Color(0x050a11);
  const reflectedSky=sky.clone(true);reflectedScene.add(reflectedSky);
  const reflectedOutline=outline.clone(true);reflectedScene.add(reflectedOutline);
  const reflectedMoon=new THREE.DirectionalLight(moon.color,moon.intensity);
  reflectedScene.add(reflectedMoon,reflectedMoon.target);
  reflectedScene.add(new THREE.LightProbe(bounce.sh.clone(),bounce.intensity));
  const water=new Reflector(new THREE.PlaneGeometry(1400,1400),{
    textureWidth:small?384:768,textureHeight:small?256:512,multisample:0,clipBias:.003,
    shader:{
      uniforms:{tDiffuse:{value:null},textureMatrix:{value:new THREE.Matrix4()},color:{value:new THREE.Color()},uTime:{value:0}},
      vertexShader:`uniform mat4 textureMatrix;
        varying vec4 vReflect; varying vec3 vWater;
        void main(){vReflect=textureMatrix*vec4(position,1.);
          vWater=(modelMatrix*vec4(position,1.)).xyz;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;
        varying vec4 vReflect;varying vec3 vWater;
        void main(){
          vec2 p=vWater.xz;
          float wave=sin(p.x*1.4+p.y*.48-uTime*.8)*.5+sin(p.x*2.7-p.y*.32-uTime*1.2)*.24;
          vec2 uv=vReflect.xy/vReflect.w;
          uv+=vec2(wave*.0017,sin(p.y*1.8+uTime*.6)*.00045);
          vec3 reflection=texture2D(tDiffuse,uv).rgb;
          float facing=abs(normalize(cameraPosition-vWater).y);
          float fresnel=.035+.965*pow(1.-facing,5.);
          vec3 col=mix(vec3(.004,.011,.017),reflection*.72,fresnel*.78+.14);
          col+=vec3(.002,.003,.004)*wave;
          gl_FragColor=vec4(col,1.);
        }`,
    },
  });
  water.name='Alpine lake';water.rotation.x=-Math.PI/2;water.position.set(180,lakeLevel,-180);
  const renderReflection=water.onBeforeRender;
  water.onBeforeRender=(renderer,_scene,camera,geometry,material,group)=>{
    reflectedSky.rotation.copy(sky.rotation);
    reflectedMoon.position.copy(moon.position);reflectedMoon.target.position.copy(moon.target.position);
    renderReflection.call(water,renderer,reflectedScene,camera,geometry,material,group);
  };
  scene.add(water);

  let range:THREE.Group|undefined;
  let material:THREE.MeshStandardMaterial|undefined;
  let detailPromise:Promise<void>|undefined;
  let transitionStart=0;
  let disposed=false;
  return {
    reflect(object:THREE.Object3D){reflectedScene.add(object.clone());},
    loadDetails(){
      if(detailPromise)return detailPromise;
      detailPromise=(async()=>{
        const decoder=new DRACOLoader().setDecoderPath('/models/decoder/');
        const loader=new GLTFLoader().setDRACOLoader(decoder);
        let loaded:THREE.Group;
        try {loaded=(await loader.loadAsync('/models/world/mountains.glb')).scene;}
        finally {decoder.dispose();}
        if(disposed){loaded.traverse(node=>{if(node instanceof THREE.Mesh)node.geometry.dispose();});return;}
        material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,fog:false,
          transparent:true,opacity:0,depthWrite:false});
        material.onBeforeCompile=shader=>{
          shader.vertexShader='varying vec3 vRidgePosition;varying vec3 vRidgeNormal;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
            '#include <begin_vertex>\nvRidgePosition=(modelMatrix*vec4(position,1.)).xyz;vRidgeNormal=mat3(modelMatrix)*normal;');
          shader.fragmentShader='varying vec3 vRidgePosition;varying vec3 vRidgeNormal;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
            float stratum=sin(vRidgePosition.x*.034+sin(vRidgePosition.z*.014)*2.1);
            float grain=sin(vRidgePosition.x*.13+vRidgePosition.z*.08)*sin(vRidgePosition.z*.11);
            vec3 stone=vec3(.19,.22,.25)*(1.+stratum*.10+grain*.055);
            float brokenLine=sin(vRidgePosition.x*.037+sin(vRidgePosition.z*.018)*2.)*14.;
            float snow=smoothstep(80.,115.,vRidgePosition.y+brokenLine)*smoothstep(.45,.82,normalize(vRidgeNormal).y);
            diffuseColor.rgb=mix(stone,vec3(.40,.44,.49),snow);`);
          shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
            float haze=1.-exp(-pow(length(cameraPosition-vRidgePosition)*.0008,1.1));
            gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.003,.006,.012),haze);`);
        };
        material.customProgramCacheKey=()=> 'alpine-procedural-v1';
        loaded.traverse(node=>{if(node instanceof THREE.Mesh){node.material=material!;node.castShadow=false;node.receiveShadow=false;}});
        loaded.name='Three dimensional alpine ridges';
        range=loaded;
        scene.add(loaded);
        reflectedScene.add(loaded.clone(true));
        transitionStart=performance.now();
        window.dispatchEvent(new Event('world-detail-loaded'));
      })();
      return detailPromise;
    },
    update(time:number){
      (water.material as THREE.ShaderMaterial).uniforms.uTime.value=time;
      if(!transitionStart||!material)return false;
      const fade=Math.min(1,(performance.now()-transitionStart)/1800);
      material.opacity=fade;
      for(const ridge of outlineMaterials)ridge.opacity=1-fade;
      if(fade>=1){
        outline.visible=reflectedOutline.visible=false;
        material.transparent=false;material.depthWrite=true;material.needsUpdate=true;
        transitionStart=0;
      }
      return fade<1;
    },
    dispose(){
      disposed=true;
      water.dispose();water.geometry.dispose();
      outline.traverse(node=>{if(node instanceof THREE.Mesh)node.geometry.dispose();});
      outlineMaterials.forEach(value=>value.dispose());
      range?.traverse(node=>{if(node instanceof THREE.Mesh)node.geometry.dispose();});
      material?.dispose();
    },
  };
}
