
/** The people of the walk as silhouettes: shadow-puppet figures (皮影) cut from black on white. rite-apparitions.ts
 * turns them into figures of firelight and embers.
 *
 * Shadows are drawn here as shadow-puppet silhouettes. Any of them can be replaced by an image at
 * /images/rite/shadows/<id>.png (black figure on white, or on transparency), see docs/RITE_ART.md. */

type Arm = [number, number]; // [shoulder, elbow] in degrees: 0 hangs down, 90 points forward, 180 points up
type Prop = "staff" | "spear" | "tablet" | "stylus" | "wall" | "bag" | "seeds" | "sickle" | "basket" | "scroll" | "tree" | "urn" | "orbits" | "telescope" | "prism" | "flask" | "document" | "lectern" | "bundle" | "sapling" | "brick" | "sextant" | "point";
type Spec = {
  pose?: "stand" | "walk" | "kneel" | "sit" | "bow";
  lean?: number; robe?: number; flare?: number; sleeves?: boolean; size?: number; x?: number;
  arms: [Arm, Arm]; legs?: [Arm, Arm];
  head?: { hat?: "crown" | "cap" | "topknot" | "bun" | "long" | "wing" | "beret" | "ushnisha" | "short"; beard?: "short" | "long" };
  props?: Prop[];
  child?: Spec;
};

const W = 256, H = 512, GROUND = 498; // the drawing space of a shadow
const CW = 384, CH = 768; // one cell of the atlas: shadow images keep their fine cut-outs

/** The people of the walk, and the anonymous people of each age. */
export const shadowSpecs: Record<string, Spec> = {
  painter: { pose: "kneel", lean: 14, robe: .35, arms: [[62, 115], [96, -6]], head: { hat: "long" }, props: ["wall"] },
  farmer: { pose: "walk", robe: .5, arms: [[-22, 14], [104, -24]], legs: [[-24, 16], [26, 6]], head: { hat: "short" }, props: ["bag", "seeds"] },
  enheduanna: { robe: 1, flare: 118, arms: [[42, 74], [66, 92]], head: { hat: "crown" }, props: ["tablet", "stylus"] },
  confucius: { pose: "bow", lean: 24, robe: 1, flare: 132, sleeves: true, arms: [[58, 34], [62, 30]], head: { hat: "cap", beard: "long" } },
  laozi: { pose: "walk", lean: 12, robe: 1, flare: 112, sleeves: true, arms: [[8, 12], [56, -14]], legs: [[-14, 8], [16, 4]], head: { hat: "topknot", beard: "long" }, props: ["staff"] },
  buddha: { pose: "sit", robe: 1, arms: [[22, 74], [24, 70]], head: { hat: "ushnisha" }, props: ["tree"] },
  socrates: { robe: 1, flare: 104, arms: [[6, 10], [122, 32]], head: { hat: "short", beard: "short" } },
  zhangheng: { robe: 1, flare: 116, sleeves: true, arms: [[30, 58], [84, 18]], head: { hat: "wing", beard: "short" }, props: ["urn"] },
  copernicus: { robe: .95, flare: 98, arms: [[10, 18], [146, 8]], head: { hat: "beret" }, props: ["orbits"] },
  galileo: { robe: .8, flare: 100, arms: [[96, 64], [124, 44]], head: { hat: "short", beard: "short" }, props: ["telescope"] },
  newton: { robe: .45, flare: 70, arms: [[8, 10], [102, 14]], head: { hat: "long" }, props: ["prism"] },
  curie: { robe: 1, flare: 96, arms: [[12, 18], [80, 66]], head: { hat: "bun" }, props: ["flask"] },
  eleanor: { robe: .9, flare: 92, arms: [[148, 16], [154, -6]], head: { hat: "bun" }, props: ["document"] },
  pcchang: { robe: 0, arms: [[6, 4], [84, -2]], head: { hat: "short" }, props: ["lectern"] },
  // the many whose names we do not know
  hunter: { pose: "walk", robe: .4, arms: [[-30, 20], [70, 70]], legs: [[-26, 18], [28, 6]], head: { hat: "long" }, props: ["spear"] },
  mother: { robe: .9, flare: 90, arms: [[40, 60], [30, 60]], head: { hat: "long" }, child: { size: .55, x: 196, robe: .5, arms: [[150, 10], [20, 10]], head: { hat: "short" } } },
  harvester: { pose: "bow", lean: 34, robe: .55, arms: [[50, 30], [76, 20]], head: { hat: "short" }, props: ["sickle"] },
  carrier: { pose: "walk", robe: .7, arms: [[160, 10], [-10, 10]], legs: [[-20, 12], [22, 4]], head: { hat: "long" }, props: ["basket"] },
  builder: { pose: "walk", lean: 10, robe: .45, arms: [[150, 40], [20, 20]], legs: [[-22, 14], [24, 6]], head: { hat: "short" }, props: ["brick"] },
  scribe: { pose: "sit", robe: .9, arms: [[50, 60], [70, 50]], head: { hat: "short" }, props: ["tablet"] },
  disciple: { pose: "sit", lean: 8, robe: 1, arms: [[30, 70], [34, 66]], head: { hat: "topknot" } },
  traveller: { pose: "walk", lean: 8, robe: .9, arms: [[-12, 10], [52, -10]], legs: [[-20, 10], [22, 4]], head: { hat: "beret" }, props: ["staff", "bundle"] },
  navigator: { robe: .6, arms: [[110, 60], [118, 50]], head: { hat: "short", beard: "short" }, props: ["sextant"] },
  stargazer: { size: .6, robe: .5, arms: [[8, 6], [150, 0]], head: { hat: "short" }, props: ["point"] },
  refugee: { pose: "walk", lean: 16, robe: .8, arms: [[-6, 10], [40, 50]], legs: [[-18, 12], [20, 4]], head: { hat: "long" }, props: ["bundle"], child: { size: .5, x: 70, pose: "walk", robe: .5, arms: [[60, 20], [10, 10]], legs: [[-18, 10], [20, 4]], head: { hat: "short" } } },
  planter: { pose: "kneel", lean: 26, robe: .5, arms: [[70, 20], [80, 14]], head: { hat: "short" }, props: ["sapling"] },
  storyteller: { pose: "sit", robe: .6, arms: [[120, 20], [110, 30]], head: { hat: "long", beard: "long" } },
  shaman: { pose: "walk", robe: .6, arms: [[150, 20], [140, 30]], legs: [[-10, 40], [20, 4]], head: { hat: "long" } },
  sewer: { pose: "sit", robe: .9, arms: [[50, 40], [80, 30]], head: { hat: "bun" } },
  king: { robe: 1, flare: 110, arms: [[20, 10], [60, 40]], head: { hat: "crown", beard: "long" }, props: ["staff"] },
  soldier: { pose: "walk", robe: .4, arms: [[30, 40], [70, 70]], legs: [[-24, 16], [26, 6]], head: { hat: "cap" }, props: ["spear"] },
  you: { arms: [[6, 10], [168, 0]], head: { hat: "short" }, props: ["point"] },
};
function drawFigure(g: CanvasRenderingContext2D, spec: Spec) {
  const s = spec.size ?? 1, x0 = spec.x ?? 112, pose = spec.pose ?? "stand", rad = (d: number) => d * Math.PI / 180;
  const legLen = 190 * s, torso = 132 * s, headR = 25 * s, up = 70 * s, fore = 62 * s;
  const hipY = pose === "kneel" ? GROUND - 96 * s : pose === "sit" ? GROUND - 34 * s : GROUND - legLen + (pose === "walk" ? 8 * s : 0);
  const lean = rad(spec.lean ?? 0), hip = { x: x0, y: hipY };
  const shoulder = { x: hip.x + Math.sin(lean) * torso, y: hip.y - Math.cos(lean) * torso };
  const neck = { x: shoulder.x + Math.sin(lean) * 10 * s, y: shoulder.y - Math.cos(lean) * 10 * s };
  const head = { x: neck.x + Math.sin(lean * 1.2) * (headR + 6 * s), y: neck.y - Math.cos(lean * 1.2) * (headR + 6 * s) };
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }, w1: number, w2: number) => {
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    g.beginPath(); g.moveTo(a.x + nx * w1 / 2, a.y + ny * w1 / 2); g.lineTo(b.x + nx * w2 / 2, b.y + ny * w2 / 2); g.lineTo(b.x - nx * w2 / 2, b.y - ny * w2 / 2); g.lineTo(a.x - nx * w1 / 2, a.y - ny * w1 / 2); g.closePath(); g.fill();
    g.beginPath(); g.arc(a.x, a.y, w1 / 2, 0, Math.PI * 2); g.arc(b.x, b.y, w2 / 2, 0, Math.PI * 2); g.fill();
  };
  const limb = (from: { x: number; y: number }, [a1, a2]: Arm, l1: number, l2: number, w: [number, number, number]) => {
    const j = { x: from.x + Math.sin(rad(a1)) * l1, y: from.y + Math.cos(rad(a1)) * l1 }, e = { x: j.x + Math.sin(rad(a1 + a2)) * l2, y: j.y + Math.cos(rad(a1 + a2)) * l2 };
    seg(from, j, w[0] * s, w[1] * s); seg(j, e, w[1] * s, w[2] * s); return e;
  };
  const arm = (k: 0 | 1) => limb({ x: shoulder.x + (k ? 6 : -6) * s, y: shoulder.y + 8 * s }, spec.arms[k], up, fore, spec.sleeves ? [30, 30, 20] : [17, 13, 10]);
  const leg = (k: 0 | 1) => {
    if (pose === "kneel") { const knee = { x: hip.x + (k ? 70 : -4) * s, y: k ? GROUND - 92 * s + 92 * s : GROUND - 8 * s };
      if (k) { seg(hip, { x: hip.x + 68 * s, y: hip.y + 4 * s }, 28 * s, 20 * s); seg({ x: hip.x + 68 * s, y: hip.y + 4 * s }, { x: hip.x + 70 * s, y: GROUND - 6 * s }, 20 * s, 14 * s); }
      else { seg(hip, { x: hip.x - 6 * s, y: GROUND - 10 * s }, 28 * s, 20 * s); seg({ x: hip.x - 6 * s, y: GROUND - 10 * s }, { x: hip.x - 80 * s, y: GROUND - 8 * s }, 20 * s, 12 * s); }
      return knee; }
    if (pose === "sit") { g.beginPath(); g.ellipse(hip.x + 6 * s, GROUND - 18 * s, 78 * s, 22 * s, 0, 0, Math.PI * 2); g.fill(); return hip; }
    return limb(hip, spec.legs?.[k] ?? [k ? 4 : -4, 0], 98 * s, 92 * s, [28, 19, 13]);
  };
  const props = new Set(spec.props ?? []);
  g.fillStyle = "#000"; g.strokeStyle = "#000"; g.lineCap = "round"; g.lineJoin = "round";
  // behind the figure
  if (props.has("tree")) { g.fillRect(28, 150, 22, GROUND - 150); for (const [cx, cy, r] of [[40, 120, 70], [92, 86, 60], [150, 100, 64], [196, 132, 50], [70, 176, 50]]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); } }
  if (props.has("wall")) { g.beginPath(); g.moveTo(256, 90); let y = 90; while (y < GROUND) { g.lineTo(206 + Math.sin(y * .07) * 9 + Math.sin(y * .23) * 4, y); y += 14; } g.lineTo(256, GROUND); g.closePath(); g.fill(); }
  arm(0); leg(0);
  // the body: a robe that falls from the shoulders, or a short tunic over the legs
  const robe = spec.robe ?? .5, hemY = pose === "sit" ? GROUND - 10 * s : pose === "kneel" ? GROUND - 30 * s : hip.y + (GROUND - hip.y) * robe, flare = (spec.flare ?? 80) * s * (pose === "sit" ? 1.5 : 1);
  g.beginPath(); g.moveTo(shoulder.x - 30 * s, shoulder.y + 4 * s); g.lineTo(shoulder.x + 30 * s, shoulder.y + 4 * s);
  g.quadraticCurveTo(hip.x + 30 * s, hip.y - 20 * s, hip.x + flare / 2 + (pose === "walk" ? 10 * s : 0), Math.max(hip.y, hemY));
  g.lineTo(hip.x - flare / 2, Math.max(hip.y, hemY)); g.quadraticCurveTo(hip.x - 28 * s, hip.y - 20 * s, shoulder.x - 30 * s, shoulder.y + 4 * s); g.closePath(); g.fill();
  if (robe < .9 || pose === "walk") leg(1); else if (pose !== "sit") { const f = limb(hip, spec.legs?.[1] ?? [4, 0], 98 * s, 92 * s, [24, 18, 13]); void f; }
  seg(shoulder, neck, 18 * s, 15 * s);
  const hands = [arm(0), arm(1)];
  // the head and what is on it
  g.beginPath(); g.arc(head.x, head.y, headR, 0, Math.PI * 2); g.fill();
  const hat = spec.head?.hat;
  if (hat === "crown") { g.beginPath(); g.moveTo(head.x - 26 * s, head.y - 14 * s); g.lineTo(head.x - 20 * s, head.y - 62 * s); g.lineTo(head.x + 20 * s, head.y - 62 * s); g.lineTo(head.x + 26 * s, head.y - 14 * s); g.closePath(); g.fill(); g.fillRect(head.x - 32 * s, head.y - 18 * s, 64 * s, 8 * s); }
  if (hat === "cap") { g.fillRect(head.x - 18 * s, head.y - 44 * s, 30 * s, 24 * s); g.beginPath(); g.moveTo(head.x - 18 * s, head.y - 40 * s); g.lineTo(head.x - 40 * s, head.y - 30 * s); g.lineTo(head.x - 16 * s, head.y - 30 * s); g.fill(); }
  if (hat === "wing") { g.fillRect(head.x - 20 * s, head.y - 40 * s, 40 * s, 22 * s); g.fillRect(head.x - 52 * s, head.y - 34 * s, 104 * s, 5 * s); }
  if (hat === "topknot" || hat === "ushnisha") { g.beginPath(); g.arc(head.x - 2 * s, head.y - headR - 8 * s, (hat === "ushnisha" ? 13 : 10) * s, 0, Math.PI * 2); g.fill(); }
  if (hat === "bun") { g.beginPath(); g.arc(head.x - 22 * s, head.y - 10 * s, 14 * s, 0, Math.PI * 2); g.fill(); }
  if (hat === "long") { g.beginPath(); g.moveTo(head.x - 6 * s, head.y - headR); g.quadraticCurveTo(head.x - 40 * s, head.y, head.x - 34 * s, head.y + 60 * s); g.lineTo(head.x - 8 * s, head.y + 30 * s); g.closePath(); g.fill(); }
  if (hat === "beret") { g.beginPath(); g.ellipse(head.x - 4 * s, head.y - 20 * s, 34 * s, 14 * s, -.15, 0, Math.PI * 2); g.fill(); }
  if (spec.head?.beard) { const long = spec.head.beard === "long"; g.beginPath(); g.moveTo(head.x + 4 * s, head.y + 14 * s); g.quadraticCurveTo(head.x + 26 * s, head.y + 18 * s, head.x + (long ? 14 : 18) * s, head.y + (long ? 70 : 38) * s); g.lineTo(head.x - 10 * s, head.y + 20 * s); g.closePath(); g.fill(); }
  // nose, so every face looks where it goes
  g.beginPath(); g.moveTo(head.x + headR - 3 * s, head.y - 6 * s); g.lineTo(head.x + headR + 7 * s, head.y + 4 * s); g.lineTo(head.x + headR - 2 * s, head.y + 8 * s); g.fill();
  // in the hands
  const [back, front] = hands; g.lineWidth = 6 * s;
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, w: number) => { g.lineWidth = w * s; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
  if (props.has("staff")) line({ x: front.x + 4 * s, y: front.y - 60 * s }, { x: front.x + 20 * s, y: GROUND }, 7);
  if (props.has("spear")) { line({ x: front.x - 60 * s, y: front.y + 50 * s }, { x: front.x + 70 * s, y: front.y - 150 * s }, 6); g.beginPath(); g.moveTo(front.x + 70 * s, front.y - 150 * s); g.lineTo(front.x + 62 * s, front.y - 126 * s); g.lineTo(front.x + 84 * s, front.y - 134 * s); g.fill(); }
  if (props.has("tablet")) { g.save(); g.translate(back.x + 10 * s, back.y - 10 * s); g.rotate(-.2); g.fillRect(-20 * s, -30 * s, 44 * s, 58 * s); g.restore(); }
  if (props.has("stylus")) line(front, { x: front.x + 26 * s, y: front.y - 44 * s }, 5);
  if (props.has("bag")) { g.beginPath(); g.ellipse(back.x, back.y + 18 * s, 26 * s, 32 * s, 0, 0, Math.PI * 2); g.fill(); }
  if (props.has("seeds")) for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(front.x + 18 * s + k * 9 * s, front.y + 10 * s + k * k * 2.2 * s, 3.4 * s, 0, Math.PI * 2); g.fill(); }
  if (props.has("sickle")) { g.lineWidth = 6 * s; g.beginPath(); g.arc(front.x + 22 * s, front.y + 8 * s, 22 * s, -2.2, .6); g.stroke(); }
  if (props.has("basket")) { g.beginPath(); g.ellipse(head.x - 4 * s, head.y - headR - 22 * s, 46 * s, 22 * s, 0, 0, Math.PI * 2); g.fill(); }
  if (props.has("brick")) g.fillRect(back.x - 30 * s, back.y - 34 * s, 62 * s, 30 * s);
  if (props.has("bundle")) { g.beginPath(); g.ellipse(shoulder.x - 40 * s, shoulder.y + 26 * s, 34 * s, 40 * s, .3, 0, Math.PI * 2); g.fill(); }
  if (props.has("urn")) { g.beginPath(); g.moveTo(186, GROUND); g.quadraticCurveTo(160, GROUND - 90, 196, GROUND - 120); g.lineTo(226, GROUND - 120); g.quadraticCurveTo(262, GROUND - 90, 236, GROUND); g.closePath(); g.fill(); g.fillRect(200, GROUND - 140, 22, 22); for (const a of [0, 1, 2]) { g.beginPath(); g.arc(178 + a * 32, GROUND - 4, 8, 0, Math.PI * 2); g.fill(); } }
  if (props.has("lectern")) { g.fillRect(186, GROUND - 210, 14, 210); g.beginPath(); g.moveTo(166, GROUND - 210); g.lineTo(232, GROUND - 236); g.lineTo(236, GROUND - 216); g.lineTo(170, GROUND - 196); g.closePath(); g.fill(); g.fillRect(164, GROUND - 10, 60, 10); }
  if (props.has("telescope")) { const a = { x: head.x + 8 * s, y: head.y - 2 * s }, b = { x: head.x + 118 * s, y: head.y - 96 * s }; seg(a, b, 11 * s, 20 * s); }
  if (props.has("sextant")) { g.lineWidth = 5 * s; g.beginPath(); g.moveTo(head.x + 20 * s, head.y); g.arc(head.x + 20 * s, head.y, 40 * s, -1.4, -.4); g.closePath(); g.stroke(); }
  if (props.has("sapling")) { line({ x: front.x + 14 * s, y: GROUND }, { x: front.x + 14 * s, y: GROUND - 70 * s }, 4); for (const [dx, dy] of [[-14, -60], [14, -48], [-10, -34], [16, -76]]) { g.beginPath(); g.ellipse(front.x + 14 * s + dx * s, GROUND + dy * s, 11 * s, 5 * s, dx > 0 ? -.5 : .5, 0, Math.PI * 2); g.fill(); } }
  if (props.has("scroll")) g.fillRect(front.x - 6 * s, front.y - 30 * s, 12 * s, 60 * s);
  if (props.has("point")) line(front, { x: front.x + 6 * s, y: front.y - 10 * s }, 5);
  if (props.has("orbits")) { g.lineWidth = 3.5 * s; for (const r of [20, 34, 48]) { g.beginPath(); g.ellipse(front.x + 8 * s, front.y - 52 * s, r * s, r * .42 * s, -.25, 0, Math.PI * 2); g.stroke(); } line(front, { x: front.x + 6 * s, y: front.y - 40 * s }, 5); }
  if (props.has("prism")) { g.beginPath(); g.moveTo(front.x - 4 * s, front.y - 34 * s); g.lineTo(front.x - 26 * s, front.y + 8 * s); g.lineTo(front.x + 18 * s, front.y + 8 * s); g.closePath(); g.fill(); }
  if (props.has("flask")) { g.beginPath(); g.arc(front.x + 6 * s, front.y - 6 * s, 20 * s, 0, Math.PI * 2); g.fill(); g.fillRect(front.x - 1 * s, front.y - 46 * s, 14 * s, 28 * s); }
  if (props.has("document")) { g.save(); g.translate((front.x + back.x) / 2, (front.y + back.y) / 2 - 36 * s); g.rotate(.06); g.fillRect(-46 * s, -58 * s, 92 * s, 116 * s); g.restore(); }
  if (spec.child) drawFigure(g, spec.child);
  // light that belongs to the scene: cut out of the shadow, as a puppet maker would
  g.save(); g.globalCompositeOperation = "destination-out";
  if (props.has("flask")) { const gr = g.createRadialGradient(front.x + 6 * s, front.y - 6 * s, 0, front.x + 6 * s, front.y - 6 * s, 26 * s); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(front.x - 30 * s, front.y - 40 * s, 72 * s, 72 * s); }
  if (props.has("prism")) { g.lineWidth = 3 * s; g.beginPath(); g.moveTo(front.x - 100 * s, front.y - 40 * s); g.lineTo(front.x - 6 * s, front.y - 10 * s); g.stroke(); for (let k = 0; k < 5; k++) { g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(front.x + 4 * s, front.y - 8 * s); g.lineTo(front.x + 150 * s, front.y - 30 * s + k * 12 * s); g.stroke(); } }
  if (props.has("document")) { g.save(); g.translate((front.x + back.x) / 2, (front.y + back.y) / 2 - 36 * s); g.rotate(.06); for (let k = 0; k < 7; k++) g.fillRect(-34 * s, -44 * s + k * 13 * s, (k === 6 ? 40 : 68) * s, 3.4 * s); g.restore(); }
  if (props.has("orbits")) { g.beginPath(); g.arc(front.x + 8 * s, front.y - 52 * s, 7 * s, 0, Math.PI * 2); g.fill(); }
  if (props.has("wall")) for (const [hx, hy] of [[226, 170], [236, 240], [222, 300]]) { g.beginPath(); g.ellipse(hx, hy, 9, 13, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/** One cell of the atlas: the drawn shadow, or the image that replaces it. */
const overrides = new Map<string, HTMLCanvasElement>();
export async function loadShadowArt(ids: string[]) {
  // only the images listed in the folder's manifest are fetched, so a missing one never costs a request
  let listed: string[] = [];
  try { listed = await (await fetch("/images/rite/shadows/manifest.json")).json() as string[]; } catch { return; }
  return Promise.all(ids.filter(id => listed.includes(id)).map(id => new Promise<void>(resolve => {
    const img = new Image(); img.onload = () => {
      const c = document.createElement("canvas"); c.width = CW; c.height = CH; const g = c.getContext("2d")!;
      const k = Math.min(CW / img.width, CH / img.height); g.drawImage(img, (CW - img.width * k) / 2, CH - img.height * k, img.width * k, img.height * k);
      const data = g.getImageData(0, 0, CW, CH), px = data.data; let opaque = true;
      for (let i = 3; i < px.length; i += 4 * 97) if (px[i] < 250) { opaque = false; break; }
      for (let i = 0; i < px.length; i += 4) { const a = opaque ? 255 - (px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11) : px[i + 3] * (1 - (px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11) / 255 * .8); px[i] = px[i + 1] = px[i + 2] = 0; px[i + 3] = Math.max(0, Math.min(255, (a - 24) * 1.15)); }
      g.putImageData(data, 0, 0); overrides.set(id, c); resolve();
    }; img.onerror = () => resolve(); img.src = `/images/rite/shadows/${id}.png`;
  })));
}

/** A shadow as a mask (alpha = the figure), CW × CH: its image if there is one, otherwise the drawn silhouette. */
const drawn = new Map<string, HTMLCanvasElement>();
export function shadowCanvas(id: string): HTMLCanvasElement | null {
  const art = overrides.get(id); if (art) return art;
  if (!shadowSpecs[id]) return null;
  let c = drawn.get(id);
  if (!c) { c = document.createElement("canvas"); c.width = CW; c.height = CH; const g = c.getContext("2d")!; if ("filter" in g) g.filter = "blur(2px)"; g.scale(CW / W, CH / H); drawFigure(g, shadowSpecs[id]); drawn.set(id, c); }
  return c;
}
export const SHADOW_ASPECT = CW / CH;
