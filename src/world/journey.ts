/** World destinations are interaction metadata, independent of article content. */
export const destinations = {
  fire: {
    number: "01",
    name: "The fire",
    collection: "Thoughts",
    title: "Some thoughts need a little warmth.",
    description:
      "A place for stories, questions, and the things we are still making sense of.",
    href: "/thoughts/",
    action: "Read the thoughts",
    position: [1.8, 1.7, -1.4],
    target: [-1, 1, -5],
  },
  grove: {
    number: "02",
    name: "The grove",
    collection: "Garden",
    title: "Understanding grows slowly.",
    description:
      "Behind the workshop, seedlings and herbs grow at their own pace. There is room here for knowledge at every stage.",
    href: "/garden/",
    action: "Explore the notes",
    position: [1, 1.7, -22],
    target: [-2.4, 1, -23],
  },
  workshop: {
    number: "03",
    name: "The workshop",
    collection: "Lab",
    title: "There is a light on inside.",
    description:
      "Experiments in progress. Ideas made tangible, tested, and tried again.",
    href: "/lab/",
    action: "Visit the lab",
    position: [-7, 1.7, -8],
    target: [-9.6, 1.9, -13.3],
  },
  sky: {
    number: "04",
    name: "The sky",
    collection: "Civilization",
    title: "We did not arrive here alone.",
    description:
      "Forty-five points of light. People whose work made room for what comes next. Choose a star to meet someone.",
    href: "/lab/civilization-star-map/",
    action: "About this constellation",
    position: [2, 1.7, 5],
    target: [-15, 55, -65],
  },
} as const;
export type DestinationId = keyof typeof destinations;
export const overview = {
  position: [1, 1.7, 3],
  target: [-2, 7, -35],
} as const;
export function easeJourney(t: number) {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

/** Route both entering and leaving the rear garden along the cabin's east side. */
export function journeyPoints(from: readonly number[], end: readonly number[]): [number, number, number][] {
  const points: [number, number, number][] = [[from[0], 1.7, from[2]]];
  if (from[2] < -11 || end[2] < -11) {
    points.push([1, 1.7, from[2]]);
    if ((from[2] < -11) !== (end[2] < -11)) points.push([1, 1.7, -8]);
    points.push([1, 1.7, end[2]]);
  }
  if (from[2] >= -11 && end[2] >= -11 && (from[0] < -4 || end[0] < -4)) points.push([1, 1.7, -8]);
  points.push([end[0], 1.7, end[2]]);
  return points.filter((point, index) => index === 0 || Math.hypot(point[0] - points[index-1][0], point[2] - points[index-1][2]) > 0.1);
}
