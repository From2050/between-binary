/** Shared physical ground for paths, foliage, rocks and the lakeshore. */
export const lakeLevel = -5.5;
export const pathSegments: [number, number, number, number][] = [
  [1, 5, 1, -24], [1, -8, -7, -8], [1, -24, -2.4, -24],
  [1, -2, -1, -5], [1, -1.4, 1.8, -1.4],
];
export function smoothstep(a:number,b:number,x:number) {
  const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);
}
function hash(x:number,y:number) {
  let h=Math.imul(x,374761393)+Math.imul(y,668265263);
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
}
export function noise(x:number,y:number) {
  const a=Math.floor(x),b=Math.floor(y),u=smoothstep(0,1,x-a),v=smoothstep(0,1,y-b);
  return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;
}
export function distToPath(x:number,z:number) {
  let best=Infinity;
  for(const [a,b,c,d] of pathSegments) {
    const dx=c-a,dz=d-b,t=Math.max(0,Math.min(1,((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz)));
    best=Math.min(best,Math.hypot(x-a-dx*t,z-b-dz*t));
  }
  return best;
}
function boxDistance(x:number,z:number,cx:number,cz:number,hx:number,hz:number) {
  return Math.hypot(Math.max(0,Math.abs(x-cx)-hx),Math.max(0,Math.abs(z-cz)-hz));
}
export function terrainHeight(x:number,z:number) {
  // An inhabited shelf above a real basin, with a continuous irregular shore.
  const basin=Math.hypot((x-150)/230,(z+180)/220);
  const edge=basin+(noise(x*.035,z*.035)-.5)*.035;
  const water=(1-smoothstep(.90,1.055,edge))*smoothstep(6,20,x+Math.max(0,-z-22)*.55);
  const broad=(noise(x*.072+7,z*.072+8)-.5)*1.3;
  const crags=Math.pow(noise(x*.31+13,z*.31+9),2)*.55;
  const detail=(noise(x*2.4+7,z*2.4+9)-.5)*.065;
  const shelf=broad+crags-water*11;
  const pad=Math.min(boxDistance(x,z,-8,-15,4.3,5.7),boxDistance(x,z,-2.4,-23,2.8,4.3),
    Math.max(0,Math.hypot(x+1,z+5)-3),distToPath(x,z));
  return shelf*smoothstep(.9,4,pad)+detail;
}
