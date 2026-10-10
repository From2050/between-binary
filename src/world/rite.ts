/** The walk — a rite of passage from the fire to the summit. Pure data, testable without a renderer.
 * Arc: leave the warmth → carry your own fire through the dark → meet those who carried it → become one of them → look back home. */
import { civilizationStars } from "../data/civilizationStars.ts";
import { riteFigures, type Bilingual } from "../data/riteFigures.ts";
import { stationFractions } from "./rite-path.ts";

export type Lang = "en" | "zh";
export type StationKind = "fire" | "hand" | "seed" | "tablet" | "axial" | "heavens" | "ash" | "you";
/** How the ritual act is performed in the scene: every act uses your hands or your fire. */
export type ActKind = "hold" | "write" | "raise" | "pass";
export type RiteStation = {
  kind: StationKind;
  /** position along the walk, 0 (the fire) … 1 (the summit) */
  u: number;
  number: Bilingual;
  title: Bilingual;
  era: Bilingual;
  lines: Bilingual[];
  act: Bilingual;
  actKind: ActKind;
  after: Bilingual;
  /** `civ:<id>` refers to civilizationStars; anything else to riteFigures */
  figures: string[];
};

const n = (en: string, zh: string): Bilingual => ({ en, zh });

export const riteStations: RiteStation[] = [
  { kind: "fire", u: stationFractions[0], number: n("The start", "起點"), title: n("Fire", "火"), era: n("Tonight", "今晚"),
    lines: [n("Tonight, you walk the path.", "今晚，你要走過那條路。"),
      n("Your civilization has walked it for three hundred thousand years.", "那是你的文明，走了三十萬年的路。"),
      n("Take the fire with you.", "帶上火。")],
    act: n("Hold the torch in the fire", "把火把伸進營火，按住"), actKind: "hold",
    after: n("The fire is yours now. Light the way as you go.", "火，在你手上了。邊走，邊把路點亮。"), figures: [] },
  { kind: "hand", u: stationFractions[1], number: n("Station one", "第一站"), title: n("Handprint", "印記"), era: n("About 40,000 years ago", "約四萬年前"),
    lines: [n("Bring your fire close to the rock.", "把你的火，靠近岩壁。"),
      n("Forty thousand years ago, someone pressed a hand here and blew red ochre over it.", "四萬年前，有人把手按在這裡，吹上赭紅的顏料。"),
      n("It meant: I was here.", "那是在說：我曾在這裡。")],
    act: n("Press your hand to the rock, and hold", "把你的手按在岩石上，按住"), actKind: "hold",
    after: n("You were here, too.", "你也曾在這裡。"), figures: ["painter"] },
  { kind: "seed", u: stationFractions[2], number: n("Station two", "第二站"), title: n("Seed", "大地"), era: n("About 12,000 years ago", "約一萬兩千年前"),
    lines: [n("People buried seeds in the ground — and then they waited.", "人們把種子埋進土裡，然後——等待。"),
      n("To wait is to believe in tomorrow.", "等待，意味著相信明天。")],
    act: n("Kneel, and hold the seed in the earth", "蹲下，把種子按進土裡"), actKind: "hold",
    after: n("A field remembers the hands that sowed it.", "田野記得播種的手。"), figures: ["farmer"] },
  { kind: "tablet", u: stationFractions[3], number: n("Station three", "第三站"), title: n("Writing", "文字"), era: n("About 3200 BCE", "約西元前 3200 年"),
    lines: [n("A reed pressed wedge after wedge into wet clay.", "蘆葦筆在濕泥上，壓出一個個楔形。"),
      n("For the first time, memory left the body.", "記憶，第一次離開了人的身體。")],
    act: n("Hold the clay to press your name into it", "按住泥板，把你的名字刻進去"), actKind: "write",
    after: n("Your name will outlive you now.", "從此，你的名字比你活得更久。"), figures: ["enheduanna"] },
  { kind: "axial", u: stationFractions[4], number: n("Station four", "第四站"), title: n("Awakening", "覺醒"), era: n("About 500 BCE", "約西元前 500 年"),
    lines: [n("Twenty-five centuries ago, people who never met looked up and asked the same question:", "兩千五百年前，彼此從未相遇的人，同時抬頭，問了同一個問題："),
      n("How should a person live?", "人，應該如何活著？")],
    act: n("Look up. Raise your fire to each of the four stars, and hold", "抬頭。把火舉向四顆星，按住"), actKind: "raise",
    after: n("They never met, yet they lit the same sky.", "他們從未相遇，卻點亮了同一片夜空。"), figures: ["confucius", "laozi", "buddha", "socrates"] },
  { kind: "heavens", u: stationFractions[5], number: n("Station five", "第五站"), title: n("The heavens", "天穹"), era: n("1543", "西元 1543 年"),
    lines: [n("For centuries we believed the Earth stood still at the centre of everything.", "千百年來，人們以為大地靜止於宇宙的中心。"),
      n("The planets wandered in loops no one could explain.", "於是天上的行星，走著難以理解的迴圈。"),
      n("Until someone dared to look again.", "直到有人，敢再看一次天空。")],
    act: n("Hold the armillary sphere, and put the Sun back at the centre", "握住渾天儀，讓太陽回到中心"), actKind: "hold",
    after: n("The universe can be understood.", "宇宙，是可以被理解的。"), figures: ["zhangheng", "copernicus", "galileo", "newton", "curie"] },
  { kind: "ash", u: stationFractions[6], number: n("Station six", "第六站"), title: n("Ashes", "灰燼"), era: n("1914 – 1948", "西元 1914 – 1948 年"),
    lines: [n("But the same fire can burn everything.", "但同一把火，也能焚燒一切。"),
      n("Two world wars took tens of millions of lives.", "兩次世界大戰，奪走了數千萬人的生命。"),
      n("Your fire is almost out. Give what is left of it away.", "你的火快要熄了。把僅剩的火，傳出去。")],
    act: n("Hold your torch to the candle, and pass the flame", "把火把靠近蠟燭，按住，把火傳過去"), actKind: "pass",
    after: n("On the ruins, people wrote down a promise. Fire can burn, or it can light the way.", "在廢墟之上，人們寫下了一個承諾。火可以焚燒，也可以照亮。"), figures: ["eleanor", "pcchang"] },
  { kind: "you", u: stationFractions[7], number: n("The summit", "山頂"), title: n("You", "你"), era: n("Today", "今天"),
    lines: [n("Three hundred thousand years. About twelve thousand generations.", "三十萬年，大約一萬兩千個世代。"),
      n("Each of them passed the fire to the next.", "每一個人，都把火傳給了下一個人。"),
      n("Now it is your turn.", "現在，輪到你了。")],
    act: n("Place your hand on the stone, and hold", "把手放在石上，按住"), actKind: "hold",
    after: n("{name}from today, you carry the fire, too.", "{name}從今天起，你也是傳火的人。"), figures: [] },
];

export const riteUi = {
  begin: n("Take the torch", "帶上火把"),
  resume: n("Continue the walk", "繼續這段路"),
  leave: n("Leave the walk", "離開這段路"),
  home: n("Walk home to the fire", "回到營火"),
  startTitle: n("The walk", "成年之路"),
  startEyebrow: n("05 / A rite of passage", "05 / 成年禮"),
  startText: n(
    "A torch stands by the fire. Take it, and carry it through the trees and up the hill, through three hundred thousand years of people who passed the fire on. About ten minutes. Headphones help.",
    "營火旁插著一支火把。帶上它，穿過樹林、爬上山丘，走過三十萬年來傳火的人。約十分鐘，建議戴耳機。"),
  name: n("Your name (optional — it will be pressed into clay, and set in the sky)", "你的名字（選填，會刻進泥板，也會成為一顆星）"),
  walkHint: n("Hold to walk · drag to look around", "按住前進 · 拖曳環顧"),
  walkKeys: n("or hold W / Space", "或按住 W / 空白鍵"),
  holdKeys: n("(or hold E)", "（或按住 E）"),
  together: n("We did not arrive here alone.", "我們，不是獨自走到這裡的。"),
  together2: n("Every point of light above you made room for the next.", "頭上的每一點光，都為下一個人騰出了位置。"),
  lookBack: n("Look back.", "回頭看。"),
  lookBack2: n("Every light on the hill is one you lit. Home is still there.", "山坡上每一盞火，都是你點亮的。家，還在那裡。"),
  yourStar: n("Your star", "你的星"),
  carried: n("Walked the three-hundred-thousand-year path. From that day, carries the fire too.", "走過了三十萬年的路。從那天起，也是傳火的人。"),
  udhr: n("“All human beings are born free and equal in dignity and rights.” — Universal Declaration of Human Rights, Article 1, 1948",
    "「人人生而自由，在尊嚴和權利上一律平等。」——《世界人權宣言》第一條，1948"),
  trailhead: n("The walk · Take the torch", "成年之路 · 帶上火把"),
  starHint: n("A star on the walk", "這段路上的星"),
  holding: n("keep holding…", "繼續按住……"),
} as const;

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

export function say(text: Bilingual, lang: Lang, name = "") {
  return text[lang].replace("{name}", name ? (lang === "zh" ? `${name}，` : `${name}, `) : "")
    .replace(/^from/, lang === "en" && !name ? "From" : "from");
}
