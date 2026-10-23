/** The walk — a rite of passage from the fire to a far ridge and home again. Pure data, testable without a renderer.
 * Arc: take fire from home → cross the threshold into deep time → walk the long road through history, honouring
 * the relics and gravestones of those who carried the fire → the ordeal of the ashes → at the end of the road, a
 * stone of your own → look back along every fire you lit for them → return home, changed. */
import { civilizationStars } from "../data/civilizationStars.ts";
import { riteFigures, type Bilingual } from "../data/riteFigures.ts";
import { riteLength, THRESHOLD, zones } from "./rite-path.ts";

export type Lang = "en" | "zh";
/** The fire you leave from, the memorials on the road (a relic of an age whose people left no names, or a
 * gravestone carved with a name and words), and, at the end, your own stone. */
export type StationKind = "fire" | "relic" | "stone" | "you";
/** How you honour each place: your fire, your hand, or kneeling to the earth. */
export type ActKind = "hold" | "offer" | "press" | "kneel" | "pass";
export type RiteStation = {
  kind: StationKind;
  /** the memorial: a figure id in riteFigures */
  id: string;
  /** metres along the road from the fire */
  s: number;
  /** the side of the road it stands on (+1 is your right as you walk away from home) and how far from the road */
  side: number; off: number;
  /** the moment it stands for, in years before the present (the year shown as you walk follows these) */
  yearsAgo: number;
  /** a relic's name; a gravestone's name and dates come from riteFigures */
  title?: Bilingual;
  /** heard when you stop here */
  lines: Bilingual[];
  act: Bilingual;
  actKind: ActKind;
  /** heard while their shadows turn around you; a gravestone's is the person's own story from riteFigures */
  after?: Bilingual;
  /** the star this memorial lights (riteFigures ids) */
  figures: string[];
  /** shadows that come out of the mist in front of you, and the people of the age turning around the rest of the ring */
  shadows: string[];
  crowd: string[];
  /** walked past: part of the country you cross; it lights no star and keeps no fire, so nothing on it asks to be stopped for */
  pass?: boolean;
  /** honoured together with the others of its group, at one place (`riteGroups`) */
  group?: string;
};
/** Several who belong together, standing in an arc beside the road, honoured one after another at one stop. */
export type RiteGroup = { s: number; side: number; lines: Bilingual[]; after: Bilingual };

const n = (en: string, zh: string): Bilingual => ({ en, zh });
/** This year: dates on the road are counted back from it. */
export const NOW = new Date().getFullYear();
const bce = (year: number) => NOW + year - 1, ce = (year: number) => NOW - year;
const offer = n("Offer your fire, and hold", "把火把靠近，按住");
const relic = (id: string, s: number, side: number, off: number, yearsAgo: number, title: Bilingual, lines: Bilingual[], after: Bilingual, shadows: string[], crowd: string[], act = offer, actKind: ActKind = "offer"): RiteStation =>
  ({ kind: "relic", id, s, side, off, yearsAgo, title, lines, act, actKind, after, figures: [id], shadows, crowd });
const stone = (id: string, s: number, side: number, yearsAgo: number, crowd: string[], lines: Bilingual[] = []): RiteStation =>
  ({ kind: "stone", id, s, side, off: 1.95, yearsAgo, lines, act: offer, actKind: "offer", figures: [id], shadows: [id], crowd });

/** The road from the fire to the far ridge. Memorials stand at uneven distances, as old graves do: relics of the
 * ages whose people we cannot name (bones by a fire, a hunter's spear, hands on a rock, a needle, a seed, a
 * doorway, a throne, a chariot wheel, an anchor, a candle among ruins) and the gravestones of those we can,
 * carved with their words. You honour each one with your fire; their shadows rise around you; their light goes
 * up and becomes a star. At the end of the road is a stone with nothing on it yet. */
export const riteStations: RiteStation[] = [
  { kind: "fire", id: "fire", s: 0, side: 0, off: 0, yearsAgo: -1, title: n("Fire", "火"),
    lines: [n("Tonight, you walk the path.", "今晚，你要走過那條路。"),
      n("Your civilization has walked it for three hundred thousand years.", "那是你的文明，走了三十萬年的路。"),
      n("Take the fire with you.", "帶上火。")],
    act: n("Hold the torch in the fire", "把火把伸進營火，按住"), actKind: "hold",
    after: n("The fire is yours now. On the road are those who carried it before you.", "火，在你手上了。路上，有在你之前帶著火的人。"),
    figures: [], shadows: [], crowd: [] },
  // ─── deep time: the people before names ───
  relic("hearth", 46, -1, 2.2, 200000, n("Bones by the fire", "火邊的骨頭"),
    [n("Three hundred thousand years ago, people like you appeared on the African grasslands.", "三十萬年前，非洲的草原上，出現了和你一樣的人。"),
      n("They sat around the fire, shared what they had hunted, and left the bones in the ashes.", "他們圍著火，分食獵物，把骨頭留在灰燼裡。")],
    n("Fire made the nights shorter, and the stories longer.", "火讓夜晚變短，讓故事變長。"), ["storyteller"], ["mother", "hunter", "mother"]),
  { ...relic("hunt", 69, 1, 2.6, 70000, n("Tusks and a spear", "象牙與長矛"),
    [n("With stone points on wooden shafts, they followed the herds.", "他們把石尖綁上木桿，追著獸群走。")],
    n("They walked out of Africa, across the ice, onto every continent.", "他們走出非洲，走過冰原，走到每一片大陸。"), ["hunter"], ["hunter", "mother", "hunter"]), pass: true, figures: [] },
  relic("painter", 100, 1, 3.4, 40000, n("Hands on the rock", "岩壁上的手"),
    [n("Forty thousand years ago, someone pressed a hand here and blew red ochre over it.", "四萬年前，有人把手按在這裡，吹上赭紅的顏料。"),
      n("It meant: I was here.", "那是在說：我曾在這裡。")],
    n("You were here, too.", "你也曾在這裡。"), ["painter", "shaman"], ["hunter", "mother", "storyteller"],
    n("Press your hand to the rock, and hold", "把你的手按在岩石上，按住"), "press"),
  { ...relic("needle", 126, -1, 2.3, 30000, n("A bone needle", "骨針"),
    [n("A needle of bone, a thread of sinew: clothes that fit, against the cold of the ice.", "一根骨針，一條獸筋：合身的衣服，擋住冰河的寒冷。")],
    n("They sang for their dead, and buried them with flowers.", "他們為死去的人唱歌，用花把他們埋葬。"), ["sewer"], ["mother", "hunter", "storyteller"]), pass: true, figures: [] },
  // ─── the first fields and towns ───
  relic("farmer", 172, -1, 1.9, 12000, n("Seed", "種子"),
    [n("Twelve thousand years ago, people buried seeds in the ground, and then they waited.", "一萬兩千年前，人們把種子埋進土裡，然後——等待。"),
      n("To wait is to believe in tomorrow.", "等待，意味著相信明天。")],
    n("A field remembers the hands that sowed it.", "田野記得播種的手。"), ["farmer"], ["harvester", "carrier", "harvester", "carrier"],
    n("Kneel, and hold the seed in the earth", "蹲下，把種子按進土裡"), "kneel"),
  { ...relic("builder", 203, 1, 3, bce(7000), n("A doorway", "一道門"),
    [n("Where there was a harvest, there were villages. Brick by brick, people raised walls.", "有了收成，就有了村莊。一塊磚一塊磚，人們砌起了牆。")],
    n("A door: on one side, home; on the other, the world.", "一道門：一邊是家，一邊是世界。"), ["builder"], ["carrier", "builder", "harvester"]), pass: true, figures: [] },
  { ...relic("ruler", 226, -1, 2.6, bce(3200), n("An empty throne", "空的王座"),
    [n("The cities had too much to remember. So there were kings, and there was writing.", "城市要記住的事，太多了。於是有了國王，有了文字。")],
    n("For the first time, memory left the body.", "記憶，第一次離開了人的身體。"), ["king", "scribe"], ["scribe", "builder", "carrier"]), pass: true, figures: [] },
  stone("enheduanna", 248, 1, bce(2285), ["scribe", "carrier", "builder"]),
  { ...relic("soldier", 271, -1, 2.8, bce(1300), n("A chariot wheel", "戰車的輪子"),
    [n("Beyond the walls, there were armies. Empires rose, and fell.", "城牆之外，有了軍隊。帝國興起，又倒下。")],
    n("Where the wheels went, the grass grew back.", "車輪輾過的地方，草又長了回來。"), ["soldier"], ["soldier", "refugee", "soldier"]), pass: true, figures: [] },
  // ─── the awakening: four who never met ───
  { ...stone("laozi", 322, -1, bce(530), ["traveller", "disciple"]), group: "axial" },
  { ...stone("confucius", 322, -1, bce(500), ["disciple", "traveller"]), group: "axial" },
  { ...stone("buddha", 322, -1, bce(450), ["disciple", "traveller"]), group: "axial" },
  { ...stone("socrates", 322, -1, bce(430), ["disciple", "traveller"]), group: "axial" },
  // ─── the heavens ───
  { ...stone("zhangheng", 360, -1, ce(132), ["stargazer", "scribe"]), pass: true, figures: [] },
  { ...relic("navigator", 381, 1, 2.6, ce(1522), n("An anchor", "船錨"),
    [n("Ships crossed every ocean. In 1522, one came home from the first voyage around the world.", "船越過了每一片海洋。1522 年，第一艘環繞世界一周的船回到了港口。")],
    n("From then on, the map had no edge.", "從此，地圖沒有了邊。"), ["navigator"], ["navigator", "stargazer", "traveller"]), pass: true, figures: [] },
  { ...stone("copernicus", 404, 1, ce(1543), ["stargazer", "navigator"]), group: "heavens" },
  { ...stone("galileo", 404, 1, ce(1610), ["stargazer", "navigator"]), group: "heavens" },
  { ...stone("newton", 404, 1, ce(1687), ["stargazer", "navigator"]), group: "heavens" },
  { ...stone("curie", 404, 1, ce(1898), ["stargazer", "traveller"]), group: "heavens" },
  // ─── ashes ───
  relic("war", 474, -1, 2.7, ce(1944), n("A candle in the ruins", "廢墟裡的蠟燭"),
    [n("But the same fire can burn everything.", "但同一把火，也能焚燒一切。"),
      n("Two world wars took tens of millions of lives.", "兩次世界大戰，奪走了數千萬人的生命。"),
      n("Your fire is almost out. Give what is left of it away.", "你的火快要熄了。把僅剩的火，傳出去。")],
    n("On the ruins, people wrote down a promise. Fire can burn, or it can light the way.", "在廢墟之上，人們寫下了一個承諾。火可以焚燒，也可以照亮。"), ["refugee"], ["refugee", "planter", "refugee", "planter"],
    n("Hold your torch to the candle, and pass the flame", "把火把靠近蠟燭，按住，把火傳過去"), "pass"),
  { ...stone("eleanor", 494, 1, ce(1948), ["planter", "refugee"]), group: "rights" },
  { ...stone("pcchang", 494, 1, ce(1948), ["planter", "refugee"]), group: "rights" },
  // ─── the end of the road: a stone with nothing on it yet ───
  { kind: "you", id: "you", s: riteLength, side: 0, off: 0, yearsAgo: 0, title: n("You", "你"),
    lines: [n("Three hundred thousand years. About twelve thousand generations.", "三十萬年，大約一萬兩千個世代。"),
      n("Each of them passed the fire to the next.", "每一個人，都把火傳給了下一個人。"),
      n("This stone has nothing carved on it yet.", "這塊石頭上，還沒有刻字。"),
      n("Now it is your turn.", "現在，輪到你了。")],
    act: n("Hold your torch to your stone", "把火把靠近你的石碑，按住"), actKind: "hold",
    after: n("{name}from today, you carry the fire, too.", "{name}從今天起，你也是傳火的人。"),
    figures: [], shadows: ["you"], crowd: ["painter", "farmer", "enheduanna", "confucius", "socrates", "galileo", "curie"] },
];

export const riteGroups: Record<string, RiteGroup> = {
  axial: { s: 322, side: -1,
    lines: [n("Twenty-five centuries ago, people who never met looked up and asked the same question:", "兩千五百年前，彼此從未相遇的人，同時抬頭，問了同一個問題："),
      n("How should a person live?", "人，應該如何活著？")],
    after: n("They never met, yet they lit the same sky.", "他們從未相遇，卻點亮了同一片夜空。") },
  heavens: { s: 404, side: 1,
    lines: [n("For centuries we believed the Earth stood still at the centre of everything.", "千百年來，人們以為大地靜止於宇宙的中心。"),
      n("Until someone dared to look again.", "直到有人，敢再看一次天空。")],
    after: n("The universe can be understood.", "宇宙，是可以被理解的。") },
  rights: { s: 494, side: 1, lines: [],
    after: n("For the first time, everyone was written into the same promise.", "第一次，所有的人都被寫進了同一個承諾。") },
};

/** Where the road stops you: the fire, each memorial you honour on its own, each group, your stone. Walked-past
 * memorials are not stops. `stand` is where you stand, in metres along the road. */
export type RiteStop = { members: number[]; stand: number; group?: string };
export const riteStops: RiteStop[] = (() => {
  const out: RiteStop[] = [];
  riteStations.forEach((st, i) => {
    if (st.pass) return;
    if (st.group) { const last = out[out.length - 1]; if (last?.group === st.group) last.members.push(i); else out.push({ members: [i], stand: riteGroups[st.group].s, group: st.group }); return; }
    out.push({ members: [i], stand: st.kind === "fire" ? 0 : st.s - (st.kind === "you" ? 2.4 : st.kind === "stone" ? .4 : 2.1) });
  });
  return out;
})();

/** The history heard between the memorials, at metres along the road. */
export const roadLines: { at: number; text: Bilingual }[] = [
  { at: 141, text: n("They learned to carry fire with them, wherever they went.", "他們學會了帶著火走，走到哪裡，帶到哪裡。") },
  { at: 186, text: n("Villages grew into towns.", "村莊，長成了城鎮。") },
  { at: 290, text: n("Every age believed it would last for ever.", "每一個時代，都以為自己會永遠存在。") },
  { at: 337, text: n("Their words were copied, translated and argued over for two thousand years.", "他們的話，被抄寫、翻譯、爭論了兩千年。") },
  { at: 368, text: n("Paper, the compass and printing travelled from east to west.", "紙、指南針和印刷術，從東方一路傳到西方。") },
  { at: 437, text: n("Telescopes, steam engines, electric light: the world began to accelerate.", "望遠鏡、蒸汽機、電燈——世界忽然加速。") },
  { at: 450, text: n("Then the air began to smell of smoke.", "然後，空氣裡開始有煙的味道。") },
  { at: 507, text: n("In 1969, people looked back at the Earth from the Moon.", "1969 年，人類第一次從月球回望地球。") },
  { at: 520, text: n("Networks let people a world apart speak to each other.", "網路，讓相隔萬里的人可以說話。") },
  { at: 533, text: n("Today eight billion people are alive. Every one of them is on this road.", "今天，地球上有八十億人。每一個人，都在這條路上。") },
  { at: 546, text: n("And countless more, whose names no stone remembers.", "還有更多的人，沒有一塊石頭記得他們的名字。") },
];

export const riteUi = {
  begin: n("Take the torch", "帶上火把"),
  resume: n("Continue the walk", "繼續這段路"),
  leave: n("Leave the walk", "離開這段路"),
  home: n("Return home", "回家"),
  startTitle: n("Passing the Fire", "傳火"),
  startEyebrow: n("05 / A rite of passage", "05 / 成年禮"),
  startText: n(
    "A torch stands by the fire. Take fire from home, and carry it along the old road — out across the open country under the aurora, to the far ridge. On the way are the memorials of three hundred thousand years of people who passed the fire on: honour each one with your fire. At the end of the road is a stone of your own. Then come home. About fifteen minutes. Headphones help.",
    "營火旁插著一支火把。從家裡取火，帶著它走上那條老路——走進極光下的曠野，一直走到遠方的山脊。路上，是三十萬年來傳火的人留下的遺物與墓碑，用你的火一一致敬。路的盡頭，有一塊屬於你的石碑。然後，回家。約十五分鐘，建議戴耳機。"),
  name: n("Your name (optional — it will be carved on your stone, and set in the sky)", "你的名字（選填，會刻在你的石碑上，也會成為一顆星）"),
  walkHint: n("Hold to walk · drag to look around", "按住前進 · 拖曳環顧"),
  walkKeys: n("or hold W / Space", "或按住 W / 空白鍵"),
  holdKeys: n("(or hold E)", "（或按住 E）"),
  figure: n("Everyone you met on the way, together in the sky: a figure holding up a fire.", "一路上你遇見的人，在天上連成了一個舉著火的人。"),
  flame: n("The flame at the top is you.", "最上面那團火，是你。"),
  together: n("We did not arrive here alone.", "我們，不是獨自走到這裡的。"),
  together2: n("Whatever you go on to do, you carry on what they began.", "無論你將來做什麼，你都在傳承他們。"),
  legacy: n("Whatever you do will be fire for the next generation, and a monument of this age.", "你做的每一件事，都會成為下一代的火種，也是這個時代的豐碑。"),
  lookBack: n("Look back.", "回頭看。"),
  lookBack2: n("Every fire you lit for them is still burning, all the way home.", "你為他們點的每一盞火都還亮著，一路亮回家。"),
  threshold: n("Beyond this stone, it is three hundred thousand years ago.", "跨過這兩塊石頭，就是三十萬年前。"),
  welcome: n("Welcome home.", "歡迎回家。"),
  welcome2: n("From tonight, when you look up, one of those lights is yours.", "從今晚起，你抬頭時，那些光裡有一顆是你。"),
  welcomeName: n("Welcome home, {name}.", "{name}歡迎回家。"),
  yourStar: n("Your star", "你的星"),
  carried: n("Walked the three-hundred-thousand-year path. From that day, carries the fire too.", "走過了三十萬年的路。從那天起，也是傳火的人。"),
  trailhead: n("Passing the Fire · Take the torch", "傳火 · 帶上火把"),
  starHint: n("A star on the walk", "這段路上的星"),
  holding: n("keep holding…", "繼續按住……"),
  anyone: n("Someone who carries the fire", "一個傳火的人"),
} as const;

/** The constellation the walk draws: everyone you stopped to honour, joined into one figure striding with a fire
 * held high. Deep time and the first fields are its legs, one bent at the hands on the rock, meeting at Enheduanna,
 * the first author known by name; the philosophers are its body and head; Copernicus is the arm swung back, and the
 * others who looked at the heavens the arm that reaches up; the survivors of the wars and the authors of human
 * rights the hand that holds the fire; and you the flame. [degrees right, degrees up] in a plane facing the viewer,
 * centred 40° above the horizon. */
export const torchbearer = {
  name: n("The Torchbearer", "持火者"),
  points: {
    hearth: [-8.2, 12], painter: [-4.8, 20.8], farmer: [8.4, 13], enheduanna: [0, 29.5],
    laozi: [.8, 35.2], confucius: [1.7, 40.6], buddha: [2.9, 45.2], socrates: [4.3, 51.6],
    copernicus: [-5.6, 37.4], galileo: [7.3, 47.2], newton: [9.7, 51.2], curie: [11.5, 55.2], war: [12.4, 58.4],
    eleanor: [12.4, 61.4], pcchang: [14.9, 60.4], you: [14.2, 67],
  } as Record<string, [number, number]>,
  edges: [["hearth", "painter"], ["painter", "enheduanna"], ["farmer", "enheduanna"], ["enheduanna", "laozi"], ["laozi", "confucius"],
    ["confucius", "buddha"], ["buddha", "socrates"], ["buddha", "copernicus"], ["buddha", "galileo"], ["galileo", "newton"], ["newton", "curie"],
    ["curie", "war"], ["war", "eleanor"], ["war", "pcchang"], ["eleanor", "pcchang"], ["eleanor", "you"], ["pcchang", "you"]] as [string, string][],
};

export type ResolvedFigure = { name: string; life: string; text: string; quote?: string; href?: string };

/** Look up a figure by reference without duplicating records. */
export function resolveFigure(ref: string, lang: Lang): ResolvedFigure | null {
  if (ref.startsWith("civ:")) {
    const star = civilizationStars.find(item => item.id === ref.slice(4));
    if (!star) return null;
    const zh = lang === "zh" ? star.zh : undefined;
    const text = zh ? `${zh.role}：${zh.desc}` : `${star.role}${star.role.endsWith(".") ? "" : "."} ${star.desc}`;
    return { name: zh?.name ?? star.name, life: star.year, text, href: "/lab/civilization-star-map/" };
  }
  const figure = riteFigures.find(item => item.id === ref);
  if (!figure) return null;
  return { name: figure.name[lang], life: figure.life[lang], text: figure.text[lang], quote: figure.quote?.[lang] };
}

/** The finale wakes the shared sky in the order history wrote it. */
export function chronologicalSky() {
  return civilizationStars.map((star, index) => ({ index, year: parseInt(star.year, 10) }))
    .sort((a, b) => a.year - b.year || a.index - b.index).map(item => item.index);
}

/** Where you stand to honour a memorial (or pass it), which shows the moment it stands for. A group shows its
 * first member where you stand, and its last a few steps on. */
export const standAt = (i: number) => { const st = riteStations[i]; if (st.pass) return st.s; const stop = riteStops.find(x => x.members.includes(i))!; return stop.stand + (stop.group ? stop.members.indexOf(i) / Math.max(1, stop.members.length - 1) * 6 : 0); };
export const yearMarks: [number, number][] = [[THRESHOLD, 300000] as [number, number],
  ...riteStations.slice(1).map((st, i) => [standAt(i + 1), st.yearsAgo] as [number, number]),
  [zones.ash[0], NOW - 1914] as [number, number]].sort((a, b) => a[0] - b[0]);
export function yearsAgoAt(s: number) {
  if (s < THRESHOLD) return -1;
  const k = yearMarks.findIndex(([at]) => at >= s);
  if (k <= 0) return k === 0 ? yearMarks[0][1] : 0;
  const [s0, y0] = yearMarks[k - 1], [s1, y1] = yearMarks[k], t = (s - s0) / (s1 - s0);
  return Math.max(0, Math.exp(Math.log(y0 + 1) + (Math.log(y1 + 1) - Math.log(y0 + 1)) * t) - 1);
}
export function yearLabel(yearsAgo: number, lang: Lang) {
  if (yearsAgo < 0) return "";
  const group = (v: number) => v.toLocaleString("en-US");
  if (yearsAgo >= 10000) { const v = group(Math.round(yearsAgo / 100) * 100); return lang === "zh" ? `約 ${v} 年前` : `about ${v} years ago`; }
  const year = Math.round(NOW - yearsAgo);
  if (year >= NOW) return lang === "zh" ? "今天" : "Today";
  if (year <= 0) { const r = group(1 - year); return lang === "zh" ? `西元前 ${r} 年` : `${r} BCE`; }
  return lang === "zh" ? `西元 ${year} 年` : `${year} CE`;
}

export function say(text: Bilingual, lang: Lang, name = "") {
  return text[lang].replace("{name}", name ? (lang === "zh" ? `${name}，` : `${name}, `) : "")
    .replace(/^from/, lang === "en" && !name ? "From" : "from");
}
