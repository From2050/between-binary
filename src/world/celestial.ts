/** Repeatable, irregular directions; independent of terrain generation and record order. */
export function starDirections(count: number, seed = 2047): [number, number, number][] {
  let state=seed;
  const random=()=>((state=Math.imul(1664525,state)+1013904223>>>0)/4294967296);
  const directions: [number, number, number][]=[];
  for (let i=0;i<count;i++) {
    let point: [number, number, number];
    let attempts=0;
    do {
      const az=random()*Math.PI*2;
      const y=.20+random()*.77;
      const r=Math.sqrt(1-y*y);
      point=[Math.cos(az)*r,y,Math.sin(az)*r];
    } while (++attempts<80 && directions.some(other=>other[0]*point[0]+other[1]*point[1]+other[2]*point[2] > .9985));
    directions.push(point);
  }
  return directions;
}
