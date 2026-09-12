import * as THREE from 'three';
import type { createWind } from './wind';
/** Textured low ground cover: varied tufts and fronds, rooted in the same terrain. */
export function populateUnderstory(scene:THREE.Scene,model:THREE.Group,wind:ReturnType<typeof createWind>,
  height:(x:number,z:number)=>number,pathDistance:(x:number,z:number)=>number,small:boolean) {
  let seed=4731;const random=()=>((seed=(seed*16807)%2147483647)/2147483647);
  const matrix=new THREE.Object3D(),tint=new THREE.Color();
  model.updateMatrixWorld(true);
  const isOccupied=(x:number,z:number)=>Math.hypot(x+1,z+5)<3 ||
    (Math.abs(x+8)<4.2&&z<-10.5&&z>-19.5)||(x>-4&&x<0&&z<-19&&z>-27);
  model.children.forEach(source=>{
    const fern=source.name.startsWith('fern');
    source.traverse(node=>{
      if(!(node instanceof THREE.Mesh))return;
      const material=(node.material as THREE.MeshStandardMaterial).clone();
      material.alphaTest=.42;material.transparent=false;material.depthWrite=true;
      material.side=THREE.DoubleSide;material.roughness=.92;material.normalScale.set(.6,.6);
      if(material.map)material.map.anisotropy=4;
      const geo=node.geometry.clone().applyMatrix4(node.matrixWorld);geo.computeBoundingBox();
      const box=geo.boundingBox!,center=box.getCenter(new THREE.Vector3());
      geo.translate(-center.x,-box.min.y,-center.z);
      if(!fern)geo.scale(1.5,1.5,1.5);
      const broad=source.name.includes('large');
      const total=fern?(small?9:15):broad?(small?160:300):(small?400:900);
      const clumps=new THREE.InstancedMesh(geo,material,total);let count=0;
      for(let attempt=0;attempt<30000&&count<total;attempt++) {
        const x=(random()-.5)*38,z=12-random()*48;
        if(height(x,z)<-4||isOccupied(x,z)||pathDistance(x,z)<(fern?1.8:.75+random()*.65))continue;
        // Ferns prefer the sheltered edge; grass thins gradually toward walked ground.
        if(fern && x>-4.8 && x<10)continue;
        const patch=.5+.3*Math.sin(x*.67+Math.sin(z*.31)*2)+.2*Math.sin(z*.81+x*.24);
        if(random()>patch*.83)continue;
        matrix.position.set(x,height(x,z)-.012,z);matrix.rotation.set(0,random()*Math.PI*2,0);
        const scale=fern?.65+random()*.65:.75+random()*.8;
        matrix.scale.set(scale,scale*(.85+random()*.3),scale);matrix.updateMatrix();
        clumps.setMatrixAt(count,matrix.matrix);
        tint.setRGB(.75+random()*.25,.77+random()*.23,.64+random()*.22);
        clumps.setColorAt(count++,tint);
      }
      clumps.count=count;clumps.receiveShadow=true;clumps.castShadow=fern;
      wind.install(clumps,fern?'plant':'grass');clumps.computeBoundingSphere();scene.add(clumps);
    });
  });
}
