/** The walk: from a trailhead beside the fire, out to the lake edge, then north-west along the shore.
 * Every point was checked against terrainHeight: dry shelf, 4.5–7.5 m from open water.
 * Kept free of three.js so terrain.ts and tests can import it directly. */
export const ritePoints: [number, number][] = [
  [1.6, -5.4], [5.2, -9.5], [7.4, -15], [7.6, -21], [5.6, -27], [1.8, -33], [-2.6, -39],
  [-7.4, -45.5], [-12.2, -53], [-16.6, -61], [-21, -69.5], [-25.6, -78], [-30, -86.5],
  [-34.8, -95], [-39.4, -103.5], [-43.6, -111], [-47.4, -118],
];
export const riteSegments: [number, number, number, number][] = ritePoints
  .slice(1)
  .map((point, i) => [ritePoints[i][0], ritePoints[i][1], point[0], point[1]]);
/** A second detailed ground patch carries the walk beyond the original ±50 m clearing.
 * Bounds are multiples of 5 m (the far grid) and on the near grid's 0.4 m lattice. */
export const riteGround = { minX: -70, maxX: 0, minZ: -130, maxZ: -50 };
