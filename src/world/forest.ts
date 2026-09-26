import * as THREE from 'three';
import type { createWind } from './wind';
import { ridgeTrees } from './ridge-trees.ts';

// A sheltered clearing, with uneven groups of trunks rather than a perimeter fence.
export const forestTrees: [number,number,number,number][] = [
  [-6.4,3.6,.94,0],[18,12,.88,1],[-9,-5,1.05,2],[-13,-10,.97,0],
  [-14.3,-17,.83,1],[-14,-22,1.13,2],[-9,-28,.98,0],[-19,-6,1.18,1],
  [26,5,.88,2],[20,-21,1.06,0],[22,-31,1.1,1],[-10,-36,1.0,2],
  [-18,-33,1.13,0],[-27,-21,1.08,1],[19,-34,1.2,2],[27,-23,1.22,0],
  [-12,-42,1.1,1],[4,-45,1.12,0],[25,-43,1.1,2],[-28,5,1.1,0],
  [21,9,1.03,1],[-15,17,.95,2],[8,24,1.08,0],[-5,31,1.15,1],
];
export function populateForest(scene:THREE.Scene,forest:THREE.Group,details:THREE.Group,
  wind:ReturnType<typeof createWind>,height:(x:number,z:number)=>number,small:boolean,reflect?:(object:THREE.Object3D)=>void) {
  forest.updateMatrixWorld(true);details.updateMatrixWorld(true);
  const transform=new THREE.Object3D();
  const distantTrees: [number,number,number,number,number?][]=Array.from({length:small?26:42},(_,i)=>{
    const angle=i*2.399963, radius=46+Math.sin(i*7.31)*6+Math.cos(i*2.67)*4;
    return [Math.cos(angle)*radius,-14+Math.sin(angle)*radius,1.1+(Math.sin(i*3.8)+1)*.28,3] as [number,number,number,number];
  }).filter(([x,z])=>!(x>6&&z<-12)&&height(x,z)>-4);
  ridgeTrees.forEach(([x,y,z,scale],i)=>{if(!small||i%2===0)distantTrees.push([x,z,scale,3,y]);});
  forest.children.forEach(variant=>{
    const distant=variant.name==='fir_distance';
    const variantIndex=variant.name.includes('_a_')?0:variant.name.includes('_b_')?1:2;
    const placements=(distant?distantTrees:forestTrees.filter((p,i)=>p[3]===variantIndex&&(!small||![7,13,14,15,16,18].includes(i)))).filter(([x,z,_scale,_variant,y])=>y!==undefined||height(x,z)>-4);
    variant.traverse(node=>{
      if(!(node instanceof THREE.Mesh))return;
      const material=(node.material as THREE.MeshStandardMaterial).clone();
      const needles=/twig/.test(material.name);
      if(needles) {material.alphaTest=.42;material.transparent=false;material.depthWrite=true;material.side=THREE.DoubleSide;material.roughness=.95;}
      if(material.map) material.map.anisotropy=4;
      const geo=node.geometry.clone().applyMatrix4(node.matrixWorld);
      const instances=new THREE.InstancedMesh(geo,material,placements.length);
      placements.forEach(([x,z,scale,_variant,y],i)=>{
        transform.position.set(x,y??height(x,z)-.045,z);
        transform.rotation.set(0,i*2.399+variantIndex*.8,0);
        transform.scale.setScalar(scale);transform.updateMatrix();instances.setMatrixAt(i,transform.matrix);
      });
      instances.castShadow=!distant;instances.receiveShadow=!distant;
      wind.install(instances,'canopy');instances.computeBoundingSphere();scene.add(instances);
      if(distant)reflect?.(instances);
    });
  });
  const stonePlacements:[number,number,number][]=[[-4.3,.8,.48],[-6.8,-2,.7],[-13,-12,.8],
    [6.8,-6,.45],[11.9,-18,.7],[-4.9,-25,.58],[13,-29,.75],[-17,1,1],
    [-11,-33,1],[18,-12,.8],[5.8,6.8,.36],[-9.5,8,.72],[-3,8,.86],[10,5,.8],
    [14,-4,.9],[19,-15,.75],[22,-22,.85],[12,13,.7],[-6,12,1.2],[.3,3.5,.75],[7.7,1.8,.68],[8.7,-1,.48],
    [-2,5.8,.55],[-1,7.3,.45],[11,-6,1.05],[13,-10,.66],[14,-17,.83],[-1,1,.55],[2.8,.2,.5],[4,0,.9],[5,-3,.7],[-4,-1,.65]];
  const rocks=details.children.filter(n=>/rock/.test(n.name));
  rocks.forEach((source,index)=>{
    const placement=stonePlacements.filter((_,i)=>i%rocks.length===index);
    // The fire ring is built from differently rotated and buried scanned stones.
    for(let i=index;i<17;i+=rocks.length) {
      const a=i*Math.PI*2/17,r=1.07+.055*Math.sin(i*4.1);
      placement.push([-1+Math.cos(a)*r,-5+Math.sin(a)*r,.12+.016*Math.sin(i*2)]);
    }
    source.traverse(node=>{
      if(!(node instanceof THREE.Mesh))return;
      const geo=node.geometry.clone().applyMatrix4(node.matrixWorld);geo.computeBoundingBox();
      const box=geo.boundingBox!,center=box.getCenter(new THREE.Vector3());
      geo.translate(-center.x,-box.min.y,-center.z);
      const mesh=new THREE.InstancedMesh(geo,node.material,placement.length);
      placement.forEach(([x,z,scale],i)=>{
        transform.position.set(x,height(x,z)-scale*.10,z);transform.rotation.set(0,i*2.399+index,0);
        transform.scale.set(scale,scale*(.8+(i%3)*.13),scale);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
      });
      mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
    });
  });
  const stump=details.children.find(n=>/stump/.test(n.name));
  if(stump) for(const [x,z,scale] of [[-5.3,-5.8,1.1],[11.8,-23,.9]]) {
    if(height(x,z)<-4)continue;
    const clone=stump.clone(true);const box=new THREE.Box3().setFromObject(clone),center=box.getCenter(new THREE.Vector3());
    clone.position.set(x-center.x*scale,height(x,z)-box.min.y*scale-.025,z-center.z*scale);
    clone.scale.multiplyScalar(scale);clone.traverse(n=>{if(n instanceof THREE.Mesh){n.castShadow=true;n.receiveShadow=true;}});scene.add(clone);
  }
}
