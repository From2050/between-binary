import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { lakeLevel } from './terrain';

/** Real ridge geometry and water. The reflected scene shares the same moon and sky. */
export async function addVista(scene:THREE.Scene,sky:THREE.Group,small:boolean,
  moon:THREE.DirectionalLight,bounce:THREE.LightProbe) {
  const decoder=new DRACOLoader().setDecoderPath('/models/decoder/');
  const loader=new GLTFLoader().setDRACOLoader(decoder);
  let range:THREE.Group;
  try {range=(await loader.loadAsync('/models/world/mountains.glb')).scene;} finally {decoder.dispose();}
  range.name='Three dimensional alpine ridges';scene.add(range);
  const reflectedScene=new THREE.Scene();
  reflectedScene.background=new THREE.Color(0x050a11);
  const reflectedSky=sky.clone(true);reflectedScene.add(reflectedSky);
  const reflectedRange=range.clone(true);reflectedScene.add(reflectedRange);
  const reflectedMoon=new THREE.DirectionalLight(moon.color,moon.intensity);
  reflectedScene.add(reflectedMoon,reflectedMoon.target);
  reflectedScene.add(new THREE.LightProbe(bounce.sh.clone(),bounce.intensity));
  let mountainMaterial:THREE.MeshStandardMaterial;
  const rockTextures:THREE.Texture[]=[];
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
          // A capillary ripple breaks reflections sideways, without moving the coastline.
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
  return {
    reflect(object:THREE.Object3D){reflectedScene.add(object.clone());},
    async useRockSurface(){
      const textures=await Promise.all(['color','normal','roughness'].map(name=>
        new THREE.TextureLoader().loadAsync(`/textures/alpine-rock/${name}.jpg`)));
      textures[0].colorSpace=THREE.SRGBColorSpace;
      for(const texture of textures){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;}
      rockTextures.push(...textures);
      mountainMaterial=new THREE.MeshStandardMaterial({map:textures[0],normalMap:textures[1],
        roughnessMap:textures[2],roughness:.95,color:0xffffff,fog:false});
      mountainMaterial.normalScale.set(.7,.7);
      mountainMaterial.onBeforeCompile=shader=>{
        shader.vertexShader='varying vec3 vRidgePosition;varying vec3 vRidgeNormal;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvRidgePosition=(modelMatrix*vec4(position,1.)).xyz;vRidgeNormal=mat3(modelMatrix)*normal;');
        shader.fragmentShader='varying vec3 vRidgePosition;varying vec3 vRidgeNormal;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          float grain=dot(diffuseColor.rgb,vec3(.299,.587,.114));
          vec3 stone=vec3(.15,.17,.19)*(.65+grain*2.);
          float brokenLine=sin(vRidgePosition.x*.037+sin(vRidgePosition.z*.018)*2.)*14.;
          float snow=smoothstep(80.,115.,vRidgePosition.y+brokenLine)*smoothstep(.45,.82,normalize(vRidgeNormal).y);
          diffuseColor.rgb=mix(stone,vec3(.40,.44,.49),snow);`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
          float haze=1.-exp(-pow(length(cameraPosition-vRidgePosition)*.0008,1.1));
          gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.003,.006,.012),haze);`);
      };
      mountainMaterial.customProgramCacheKey=()=> 'alpine-geology-v1';
      for(const group of [range,reflectedRange]) group.traverse(node=>{
        if(node instanceof THREE.Mesh){node.material=mountainMaterial;node.castShadow=false;node.receiveShadow=false;}
      });
    },
    update(time:number){(water.material as THREE.ShaderMaterial).uniforms.uTime.value=time;},
    dispose(){water.dispose();water.geometry.dispose();
      range.traverse(node=>{if(node instanceof THREE.Mesh)node.geometry.dispose();});
      mountainMaterial?.dispose();rockTextures.forEach(texture=>texture.dispose());},
  };
}
