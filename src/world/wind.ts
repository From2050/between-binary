import * as THREE from 'three';
/** A coherent travelling gust field. All scene responses use the same clock. */
export function sampleWind(time: number, x = 0, z = 0) {
  const phase=time*.65-x*.085-z*.045;
  const gust=.45+.32*Math.sin(phase)+.16*Math.sin(phase*.43+1.7);
  return { x: Math.max(.08,gust)*.89, z: Math.max(.08,gust)*.45 };
}
export function createWind() {
  const clock={value:0};
  const header=`
    uniform float uWindTime;
    vec2 worldWind(vec3 p) {
      float phase=uWindTime*.65-p.x*.085-p.z*.045;
      float gust=max(.08,.45+.32*sin(phase)+.16*sin(phase*.43+1.7));
      return vec2(.89,.45)*gust;
    }
  `;
  function install(mesh: THREE.Mesh, kind: 'grass'|'canopy'|'plant') {
    const deform=`
      vec4 anchor=vec4(position,1.0);
      #ifdef USE_INSTANCING
        anchor=instanceMatrix*anchor;
      #endif
      vec3 wp=(modelMatrix*anchor).xyz;
      vec2 flow=worldWind(wp);
      float rootHeight=(wp.x>4. && wp.x<8. && wp.z< -19. && wp.z> -27.) ? .46 : .045;
      float weight=${kind==='grass'?'pow(clamp(position.y/.32,0.,1.4),1.6)*.18':kind==='canopy'?'pow(max(wp.y-.3,0.)/12.,1.65)*.52':'pow(max(wp.y-rootHeight,0.),1.2)*.16'};
      float flutter=sin(uWindTime*2.7+wp.x*3.1+wp.z*2.3)*${kind==='canopy'?'.025':'.04'};
      vec3 offset=vec3(flow.x,0.,flow.y)*weight*(1.0+flutter);
      offset.y=-length(offset)*.14;
      // Convert a world-space bend into the mesh's local axes (including glTF rotation).
      vec3 local=vec3(dot(modelMatrix[0].xyz,offset)/dot(modelMatrix[0].xyz,modelMatrix[0].xyz),
        dot(modelMatrix[1].xyz,offset)/dot(modelMatrix[1].xyz,modelMatrix[1].xyz),
        dot(modelMatrix[2].xyz,offset)/dot(modelMatrix[2].xyz,modelMatrix[2].xyz));
      #ifdef USE_INSTANCING
        local=vec3(dot(instanceMatrix[0].xyz,local)/dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),
          dot(instanceMatrix[1].xyz,local)/dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),
          dot(instanceMatrix[2].xyz,local)/dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));
      #endif
      transformed+=local;
    `;
    const patch=(material: THREE.Material)=>{
      const previous=material.onBeforeCompile;
      material.onBeforeCompile=(shader,renderer)=>{
        previous.call(material,shader,renderer);
        shader.uniforms.uWindTime=clock;
        shader.vertexShader=header+shader.vertexShader;
        if(kind==='grass') shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
          vec4 normalAnchor=vec4(position,1.);
          #ifdef USE_INSTANCING
            normalAnchor=instanceMatrix*normalAnchor;
          #endif
          vec2 nf=worldWind((modelMatrix*normalAnchor).xyz);
          vec3 axis=normalize(vec3(nf.y,0.,-nf.x));
          #ifdef USE_INSTANCING
            axis=normalize(vec3(dot(instanceMatrix[0].xyz,axis),dot(instanceMatrix[1].xyz,axis),dot(instanceMatrix[2].xyz,axis)));
          #endif
          float tilt=atan(.95*pow(max(position.y/.32,0.),.6)*length(nf));
          objectNormal=objectNormal*cos(tilt)+cross(axis,objectNormal)*sin(tilt)+axis*dot(axis,objectNormal)*(1.-cos(tilt));
        `);
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${deform}`);
      };
      material.customProgramCacheKey=()=>`woodland-wind-${kind}-2`;
      material.needsUpdate=true;
    };
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]) patch(material);
    const source=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as THREE.MeshStandardMaterial;
    const cutout={map:source.map,alphaMap:source.alphaMap,alphaTest:source.alphaTest,side:THREE.DoubleSide};
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,...cutout});
    const distance=new THREE.MeshDistanceMaterial(cutout);
    patch(depth);patch(distance);mesh.customDepthMaterial=depth;mesh.customDistanceMaterial=distance;
    // Wind stays within these conservative bounds; shadows use identical deformation.
    mesh.geometry.computeBoundingSphere();
    if(mesh.geometry.boundingSphere) mesh.geometry.boundingSphere.radius+=1.5;
  }
  return {install,update(time:number){clock.value=time;}};
}
