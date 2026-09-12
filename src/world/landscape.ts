import * as THREE from 'three';
import { sampleWind } from './wind';
/** Clumped grasses and litter establish a continuous forest-floor transition. */
export function addLandscape(scene:THREE.Scene,height:(x:number,z:number)=>number,pathDistance:(x:number,z:number)=>number,random:()=>number,smallScreen:boolean) {
  const matrix=new THREE.Object3D(),color=new THREE.Color();
  // Irregular, partly embedded stones replace smooth spherical boulders.
  const rockGeo=new THREE.IcosahedronGeometry(1,2),rp=rockGeo.attributes.position;
  for(let i=0;i<rp.count;i++) {
    const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),n=1+.14*Math.sin(x*7+z*4)*Math.cos(y*8-z*3);
    rp.setXYZ(i,x*n,y*n*.68,z*n);
  }
  rockGeo.computeVertexNormals();
  const rock=new THREE.InstancedMesh(rockGeo,new THREE.MeshStandardMaterial({color:0x77796a,roughness:1}),170);
  for(let i=0;i<170;i++) {
    let x=(random()-.5)*80,z=15-random()*80;
    if(pathDistance(x,z)<1.4)x+=3;
    const size=.025+random()*.10;
    matrix.position.set(x,height(x,z)-size*.14,z);matrix.rotation.set(random(),random()*6,random());matrix.scale.set(size,size*.7,size*(.7+random()*.5));matrix.updateMatrix();rock.setMatrixAt(i,matrix.matrix);
    color.setHSL(.12, .06+random()*.08,.18+random()*.12);rock.setColorAt(i,color);
  }
  rock.receiveShadow=true;rock.castShadow=true;scene.add(rock);
  // Curling fallen leaves make the material readable at walking distance.
  const litterGeo=new THREE.PlaneGeometry(.11,.23,2,5);litterGeo.rotateX(-Math.PI/2);
  const lp=litterGeo.attributes.position;
  for(let i=0;i<lp.count;i++) {const z=lp.getZ(i),t=(z+.115)/.23;lp.setX(i,lp.getX(i)*Math.sin(t*Math.PI));lp.setY(i,Math.sin(t*Math.PI)*.019+Math.abs(lp.getX(i))*.14);}
  litterGeo.computeVertexNormals();
  const leafSurface=document.createElement('canvas');leafSurface.width=128;leafSurface.height=256;
  const ctx=leafSurface.getContext('2d')!;
  ctx.fillStyle='#bfae8c';ctx.fillRect(0,0,128,256);
  for(let i=0;i<700;i++) {
    ctx.fillStyle=random()>.5?'rgba(66,39,17,.18)':'rgba(230,208,167,.15)';
    ctx.fillRect(random()*128,random()*256,1+random()*5,1+random()*7);
  }
  ctx.strokeStyle='rgba(79,56,28,.5)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(64,0);ctx.lineTo(64,256);
  for(let y=30;y<245;y+=27) {ctx.moveTo(64,y);ctx.lineTo(6,y-28);ctx.moveTo(64,y);ctx.lineTo(122,y-28);}
  ctx.stroke();
  const leafMap=new THREE.CanvasTexture(leafSurface);leafMap.colorSpace=THREE.SRGBColorSpace;
  const litterMaterial=new THREE.MeshStandardMaterial({map:leafMap,color:0xffffff,roughness:1,side:THREE.DoubleSide});
  const litter=new THREE.InstancedMesh(litterGeo,litterMaterial,1200);
  let leafCount=0;
  for(let i=0;i<2500&&leafCount<1200;i++) {
    const x=(random()-.5)*40,z=10-random()*47;
    if((x>-4&&x<8&&z<-11&&z>-27)||Math.hypot(x+1,z+5)<2)continue;
    matrix.position.set(x,height(x,z)+.015,z);matrix.rotation.set(0,random()*6.28,0);matrix.scale.setScalar(.5+random()*1.1);matrix.updateMatrix();litter.setMatrixAt(leafCount,matrix.matrix);
    color.setHSL(.055+random()*.045,.30+random()*.20,.15+random()*.08);litter.setColorAt(leafCount++,color);
  }
  litter.count=leafCount;litter.receiveShadow=true;scene.add(litter);
  // A few loose dry leaves lift in gusts. Most litter stays on the ground.
  const airborne=new THREE.InstancedMesh(litterGeo,litterMaterial,24);
  const loose=Array.from({length:24},()=>({x:-13+random()*22,z:4-random()*14,
    y:0,vx:0,vz:0,vy:0,spin:random()*6.28,size:.6+random()*.5,rest:random()*6}));
  airborne.receiveShadow=true;airborne.frustumCulled=false;scene.add(airborne);
  for(let i=0;i<loose.length;i++) {
    color.setHSL(.065,.38,.20+random()*.07);airborne.setColorAt(i,color);
  }
  return {update(time:number,dt:number) {
    loose.forEach((leaf,i)=>{
      const flow=sampleWind(time,leaf.x,leaf.z),floor=height(leaf.x,leaf.z)+.015;
      if(dt>0) {
      if(leaf.y<=floor+.003) {
        leaf.y=floor;leaf.vy=0;leaf.vx*=.82;leaf.vz*=.82;leaf.rest-=dt;
        if(flow.x>.48&&leaf.rest<0) {leaf.vy=.7+flow.x*.8;leaf.rest=4+i*.23;}
      }
      if(leaf.y>floor+.003||leaf.vy>0) {
        leaf.vx+=(flow.x*2.2-leaf.vx)*dt*2;leaf.vz+=(flow.z*2.2-leaf.vz)*dt*2;
        leaf.vy-=1.4*dt;leaf.spin+=dt*(1.2+flow.x*2);
      }
      leaf.x+=leaf.vx*dt;leaf.z+=leaf.vz*dt;leaf.y=Math.max(floor,leaf.y+leaf.vy*dt);
      if(leaf.x>19||leaf.z>15) {leaf.x=-18;leaf.z=-20+i*.8;leaf.y=height(leaf.x,leaf.z)+.015;leaf.vx=leaf.vz=leaf.vy=0;}
      }
      leaf.y=Math.max(floor,leaf.y);
      matrix.position.set(leaf.x,leaf.y,leaf.z);
      const lift=Math.min(1,(leaf.y-floor)*5);
      matrix.rotation.set(Math.sin(leaf.spin)*lift*.7,leaf.spin,Math.cos(leaf.spin*.7)*lift*.5);
      matrix.scale.setScalar(leaf.size);matrix.updateMatrix();airborne.setMatrixAt(i,matrix.matrix);
    });
    airborne.instanceMatrix.needsUpdate=true;
  }};
}
