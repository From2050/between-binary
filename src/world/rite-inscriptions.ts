import * as THREE from "three";
import { seeded, stoneGrain } from "./rite-memorials.ts";

/** Words cut into stone. Each face is drawn as a mask (white = cut away, or white = raised for a relief), then turned
 * into the stone's colour, its relief (a normal map, so your torch rakes across the cuts) and its roughness: the cuts
 * are darker and rough, worn unevenly, stained below where rain has run out of them; lichen grows over all of it.
 * A fill can sit in the cuts: red, as in Chinese rock inscriptions, or gold leaf, as on a granite headstone. */

export type Draw = (g: CanvasRenderingContext2D, W: number, H: number) => void;
export type CarvingOptions = { w: number; h: number; tint: string; seed: number; draw: Draw; relief?: Draw; fill?: "red" | "gold" | "fresh"; polish?: number; depth?: number; decal?: boolean; px?: number };

const canvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d", { willReadFrequently: true }); return c; };
function blurred(src: HTMLCanvasElement, px: number) { const c = canvas(src.width, src.height), g = c.getContext("2d")!; if ("filter" in g) g.filter = `blur(${px}px)`; g.drawImage(src, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; }

export function carving(o: CarvingOptions) {
  const W = o.px ?? 512, H = Math.min(1536, Math.round(W * o.h / o.w));
  const colour = canvas(W, H), normal = canvas(W, H), rough = canvas(W, H), metal = o.fill === "gold" ? canvas(W, H) : null;
  const tex = (c: HTMLCanvasElement, srgb: boolean) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const map = tex(colour, true), normalMap = tex(normal, false), roughnessMap = tex(rough, false), metalnessMap = metal ? tex(metal, false) : null;
  const material = new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(1.5, 1.5), roughnessMap, roughness: 1, metalness: metal ? 1 : 0, ...(metalnessMap ? { metalnessMap } : {}),
    transparent: !!o.decal, depthWrite: !o.decal, polygonOffset: !!o.decal, polygonOffsetFactor: o.decal ? -4 : 0 });
  // until it is cut, a face is plain stone
  { const c = colour.getContext("2d")!; c.fillStyle = o.tint; c.fillRect(0, 0, W, H); if (o.decal) c.clearRect(0, 0, W, H);
    const n = normal.getContext("2d")!; n.fillStyle = "rgb(128,128,255)"; n.fillRect(0, 0, W, H); const r = rough.getContext("2d")!; r.fillStyle = "#fff"; r.fillRect(0, 0, W, H); }
  function paint() {
    const cut = canvas(W, H), cg = cut.getContext("2d")!; cg.fillStyle = "#000"; cg.fillRect(0, 0, W, H); cg.fillStyle = cg.strokeStyle = "#fff"; o.draw(cg, W, H);
    const raise = canvas(W, H), rg = raise.getContext("2d")!; rg.fillStyle = "#000"; rg.fillRect(0, 0, W, H); rg.fillStyle = rg.strokeStyle = "#fff"; o.relief?.(rg, W, H);
    const sharp = cg.getImageData(0, 0, W, H).data, groove = blurred(cut, 1.6), soft = blurred(cut, 5), relief = blurred(raise, 2), halo = blurred(raise, 7), drip = (() => {
      // rain runs out of the cuts and down the face
      const c = canvas(W, H), g = c.getContext("2d")!; if ("filter" in g) g.filter = "blur(3px)"; for (let k = 1; k <= 8; k++) { g.globalAlpha = .1; g.drawImage(cut, 0, k * 5); } return g.getImageData(0, 0, W, H).data; })();
    const r = seeded(o.seed), noise = (() => { // value noise for wear, in three sizes
      const grids = [12, 40, 120].map(n => { const m = Math.ceil(n * H / W) + 1, a = new Float32Array((n + 1) * (m + 1)); for (let i = 0; i < a.length; i++) a[i] = r(); return { n, m, a }; });
      return (x: number, y: number) => grids.reduce((sum, { n, m, a }, k) => {
        const fx = x / W * n, fy = Math.min(m - .001, y / W * n), ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, i0 = iy * (n + 1) + Math.min(n - 1, ix);
        const v = (a[i0] * (1 - tx) + a[i0 + 1] * tx) * (1 - ty) + (a[i0 + n + 1] * (1 - tx) + a[i0 + n + 2] * tx) * ty;
        return sum + v * [.55, .3, .15][k]; }, 0); })();
    // the stone itself, its grain tiled under the tint
    const cc = colour.getContext("2d")!; cc.fillStyle = cc.createPattern(stoneGrain().image as HTMLCanvasElement, "repeat")!; cc.fillRect(0, 0, W, H);
    cc.globalCompositeOperation = "multiply"; cc.fillStyle = o.tint; cc.fillRect(0, 0, W, H); cc.globalCompositeOperation = "source-over";
    const base = cc.getImageData(0, 0, W, H), px = base.data, height = new Float32Array(W * H), wear = new Float32Array(W * H);
    const depth = o.depth ?? 1, fresh = o.fill === "fresh";
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, k = i * 4, n = noise(x, y), worn = fresh ? 1 : .55 + .45 * Math.min(1, n * 1.6); wear[i] = n;
      const g = groove[k] / 255, s = soft[k] / 255, rel = relief[k] / 255, inCut = sharp[k] / 255;
      height[i] = rel * .9 - g * depth * worn;
      // darker and dirtier in the cuts, a little stained below them, lichen in patches
      // a relief stands proud of the face: lit on top, a little shadow gathered round its foot
      let f = 1 - g * .42 * worn - s * .12 - (fresh ? 0 : drip[k] / 255 * .5) + rel * .16 - Math.max(0, halo[k] / 255 - rel) * .55;
      if (fresh) f += inCut * .22; // newly cut stone is paler than its weathered face
      let R = px[k] * f, G = px[k + 1] * f, B = px[k + 2] * f;
      if (o.fill === "red" && inCut > .3) { const a = Math.min(1, (inCut - .3) * 2) * (n > .3 ? 1 : .7); R = R * (1 - a) + 200 * a; G = G * (1 - a) + 44 * a; B = B * (1 - a) + 30 * a; } // vermilion, kept fresh by those who repaint it
      if (o.fill === "gold" && inCut > .4) { const a = Math.min(1, (inCut - .4) * 2); R = R * (1 - a) + 205 * a; G = G * (1 - a) + 160 * a; B = B * (1 - a) + 80 * a; }
      if (!fresh && n > .72 && o.fill !== "gold") { const l = Math.min(1, (n - .72) * 5) * .5; R = R * (1 - l) + 168 * l; G = G * (1 - l) + 172 * l; B = B * (1 - l) + 132 * l; }
      px[k] = Math.min(255, R); px[k + 1] = Math.min(255, G); px[k + 2] = Math.min(255, B);
      px[k + 3] = o.decal ? Math.min(255, (Math.max(inCut, g * 1.3)) * 255) : 255;
    }
    cc.putImageData(base, 0, 0);
    // relief, as a normal map: the slope of the height field; texture v runs up while canvas y runs down
    const nimg = normal.getContext("2d")!.createImageData(W, H), np = nimg.data, kk = 2.6;
    const rimg = rough.getContext("2d")!.createImageData(W, H), rp = rimg.data, polish = o.polish ?? 0;
    const mimg = metal?.getContext("2d")!.createImageData(W, H), mp = mimg?.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, l = height[y * W + Math.max(0, x - 1)], rr = height[y * W + Math.min(W - 1, x + 1)], u = height[Math.max(0, y - 1) * W + x], d = height[Math.min(H - 1, y + 1) * W + x];
      let nx = -(rr - l) * kk, ny = (d - u) * kk, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      np[i * 4] = (nx * .5 + .5) * 255; np[i * 4 + 1] = (ny * .5 + .5) * 255; np[i * 4 + 2] = (nz * .5 + .5) * 255; np[i * 4 + 3] = 255;
      const inCut = sharp[i * 4] / 255, gold = o.fill === "gold" && inCut > .4;
      const ro = gold ? .35 : (1 - polish * (1 - inCut)) * (.85 + .15 * wear[i]); rp[i * 4] = rp[i * 4 + 1] = rp[i * 4 + 2] = Math.min(255, ro * 255); rp[i * 4 + 3] = 255;
      if (mp) { const v = gold ? 255 : 0; mp[i * 4] = mp[i * 4 + 1] = mp[i * 4 + 2] = v; mp[i * 4 + 3] = 255; }
    }
    normal.getContext("2d")!.putImageData(nimg, 0, 0); rough.getContext("2d")!.putImageData(rimg, 0, 0); if (metal && mimg) metal.getContext("2d")!.putImageData(mimg, 0, 0);
    map.needsUpdate = normalMap.needsUpdate = roughnessMap.needsUpdate = true; if (metalnessMap) metalnessMap.needsUpdate = true;
  }
  return { material, paint, W, H };
}

// ─── Lettering ───
/** Classical Chinese, cut in columns from right to left, top to bottom, without punctuation. */
export function columns(g: CanvasRenderingContext2D, cols: string[], o: { right: number; top: number; size: number; font: string; gap?: number; lead?: number; weight?: number }) {
  g.font = `${o.weight ?? 700} ${o.size}px ${o.font}`; g.textAlign = "center"; g.textBaseline = "middle";
  cols.forEach((col, k) => { const chars = [...col.replace(/[，。、「」：；！？\s]/g, "")], x = o.right - k * o.size * (o.gap ?? 1.35);
    chars.forEach((ch, j) => g.fillText(ch, x, o.top + o.size * (.5 + j * (o.lead ?? 1.08)))); });
}
/** A centred line of capitals, letter-spaced the way stone cutters space them. */
export function line(g: CanvasRenderingContext2D, text: string, y: number, o: { size: number; font: string; W: number; spacing?: number; weight?: number; italic?: boolean; max?: number }) {
  g.font = `${o.italic ? "italic " : ""}${o.weight ?? 600} ${o.size}px ${o.font}`; g.textAlign = "center"; g.textBaseline = "middle";
  if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(o.spacing ?? .12) * o.size}px`;
  const max = o.max ?? o.W * .84, w = g.measureText(text).width, k = w > max ? max / w : 1;
  g.save(); g.translate(o.W / 2, y); g.scale(k, 1); g.fillText(text, 0, 0); g.restore();
  if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
}
/** a cut border, like the frame a mason scores round a panel */
export function frame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, width = 4, double = true) {
  g.lineWidth = width; g.strokeRect(x, y, w, h); if (double) { g.lineWidth = width * .6; g.strokeRect(x + width * 3, y + width * 3, w - width * 6, h - width * 6); }
}
/** a shadow-puppet silhouette drawn as a raised relief, if its image is ready */
export function silhouette(g: CanvasRenderingContext2D, image: HTMLCanvasElement | null, cx: number, bottom: number, height: number, mirror = false) {
  if (!image) return; const w = height * image.width / image.height; g.save(); g.translate(cx, bottom - height); if (mirror) { g.translate(w / 2, 0); g.scale(-1, 1); g.translate(-w / 2, 0); } else g.translate(-w / 2, 0);
  // the mask's alpha is the figure: draw it white on the black field
  const c = canvas(image.width, image.height), cg = c.getContext("2d")!; cg.drawImage(image, 0, 0); cg.globalCompositeOperation = "source-in"; cg.fillStyle = "#fff"; cg.fillRect(0, 0, c.width, c.height);
  g.drawImage(c, 0, 0, w, height); g.restore();
}
export const FONTS = {
  kai: '"LXGW WenKai TC","Noto Serif TC",serif',
  roman: '"Cinzel","Source Serif 4",serif',
  greek: '"Noto Sans","Source Serif 4",sans-serif',
  italic: '"Cormorant Garamond","Source Serif 4",serif',
  cuneiform: '"Noto Sans Cuneiform"',
  brahmi: '"Noto Sans Brahmi"',
};
/** load every face the carvings use, with the very characters they need */
export function loadCarvingFonts() {
  if (!document.fonts) return Promise.resolve();
  const need: [string, string][] = [
    [`700 64px "LXGW WenKai TC"`, "知人者智自知者明老子己所不欲勿施於人論語衛靈公至聖先師宇之表無極宙之端無窮漢張衡彭春生而自由在尊嚴和權利上一律平等他們賦有理性良心並應以兄弟關係的精神相對待年月日你做每一件事都會成為下代火種也是這個時豐碑傳"],
    [`600 64px "Cinzel"`, "ABCDEFGHIJKLMNOPQRSTUVWXYZ·–ÈŁ0123456789"], [`500 64px "Noto Sans"`, "ΣΩΚΡΑΤΗΦΟΝΙΥΛΠΕΘΔΒΞΓ"],
    [`italic 500 64px "Cormorant Garamond"`, "abcdefghijklmnopqrstuvwxyz,.?àé"], [`64px "Noto Sans Cuneiform"`, "𒂗𒃶𒌌𒀭𒈾𒋀𒆠"], [`64px "Noto Sans Brahmi"`, "𑀫𑀦𑁄𑀧𑀼𑀩𑁆𑀩𑀗𑁆𑀕𑀫𑀸𑀥"],
  ];
  return Promise.all(need.map(([font, text]) => document.fonts.load(font, text).catch(() => []))).then(() => undefined);
}
