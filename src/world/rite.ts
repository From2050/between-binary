/** The walk — a rite of passage along the shore. Pure data, testable without a renderer.
 * Only the campfire is shared with the rest of /world/; every station is its own place. */
import { civilizationStars } from "../data/civilizationStars.ts";
import { riteFigures, type Bilingual } from "../data/riteFigures.ts";

export type Lang = "en" | "zh";
export type StationKind = "fire" | "hand" | "seed" | "tablet" | "axial" | "heavens" | "engine" | "ash" | "network" | "you";
export type RiteStation = {
  kind: StationKind;
  /** distance along the walk, metres */
  s: number;
  title: Bilingual;
  era: Bilingual;
  lines: Bilingual[];
  act: Bilingual;
  after: Bilingual;
  /** the ritual act is a press-and-hold in the scene (a click on the button also completes it) */
  hold?: boolean;
  /** `civ:<id>` refers to civilizationStars; anything else to riteFigures */
  figures: string[];
};

export const RITE_LENGTH = 129.2;

export const riteStations: RiteStation[] = [
  { kind: "fire", s: 0,
    title: { en: "The fire", zh: "火" }, era: { en: "Tonight", zh: "今晚" },
    lines: [
      { en: "Tonight, you walk the path.", zh: "今晚，你要走過那條路。" },
      { en: "Your civilization has walked it for three hundred thousand years.", zh: "那是你的文明，走了三十萬年的路。" },
      { en: "Take the fire with you.", zh: "帶上火。" },
    ],
    act: { en: "Hold the torch in the fire to light it", zh: "把火把伸進營火，按住點燃" },
    after: { en: "The fire is in your hands now. Light the way as you go.", zh: "火，在你手上了。邊走，邊把路點亮。" },
    hold: true, figures: [] },
  { kind: "hand", s: 13,
    title: { en: "Handprint", zh: "印記" }, era: { en: "About 40,000 years ago", zh: "約四萬年前" },
    lines: [
      { en: "Forty thousand years ago, someone pressed a hand to the rock and blew red ochre over it.", zh: "四萬年前，有人把手按在岩壁上，吹上赭紅的顏料。" },
      { en: "It meant: I was here.", zh: "那是在說：我曾在這裡。" },
    ],
    act: { en: "Press your hand to the rock", zh: "把你的手，也按在岩石上" },
    after: { en: "You were here, too.", zh: "你也曾在這裡。" },
    figures: ["painter"] },
  { kind: "seed", s: 26,
    title: { en: "Seed", zh: "大地" }, era: { en: "About 12,000 years ago", zh: "約一萬兩千年前" },
    lines: [
      { en: "People buried seeds in the ground — and then they waited.", zh: "人們把種子埋進土裡，然後——等待。" },
      { en: "To wait is to believe in tomorrow.", zh: "等待，意味著相信明天。" },
    ],
    act: { en: "Plant the seed", zh: "種下種子" },
    after: { en: "A field remembers the hands that sowed it.", zh: "田野記得播種的手。" },
    figures: ["farmer"] },
  { kind: "tablet", s: 40,
    title: { en: "Writing", zh: "文字" }, era: { en: "About 3200 BCE", zh: "約西元前 3200 年" },
    lines: [
      { en: "A reed pressed wedge after wedge into wet clay.", zh: "蘆葦筆在濕泥上，壓出一個個楔形。" },
      { en: "For the first time, memory left the body.", zh: "記憶，第一次離開了人的身體。" },
    ],
    act: { en: "Write your name in the clay", zh: "在泥板上，刻下你的名字" },
    after: { en: "Your name will outlive you now.", zh: "從此，你的名字比你活得更久。" },
    figures: ["enheduanna"] },
  { kind: "axial", s: 54,
    title: { en: "Awakening", zh: "覺醒" }, era: { en: "About 500 BCE", zh: "約西元前 500 年" },
    lines: [
      { en: "Twenty-five centuries ago, people who never met looked up and asked the same question:", zh: "兩千五百年前，彼此從未相遇的人，同時抬頭，問了同一個問題：" },
      { en: "How should a person live?", zh: "人，應該如何活著？" },
    ],
    act: { en: "Look up, and wake the four stars above you", zh: "抬頭，點亮你頭上的四顆星" },
    after: { en: "They never met, yet they lit the same sky.", zh: "他們從未相遇，卻點亮了同一片夜空。" },
    figures: ["confucius", "laozi", "buddha", "socrates"] },
  { kind: "heavens", s: 68,
    title: { en: "The heavens", zh: "天穹" }, era: { en: "1543", zh: "西元 1543 年" },
    lines: [
      { en: "For centuries we believed the Earth stood still at the centre of everything.", zh: "千百年來，人們以為大地靜止於宇宙的中心。" },
      { en: "Until someone dared to look at the sky again.", zh: "直到有人，敢再看一次天空。" },
    ],
    act: { en: "Touch the armillary sphere, and return the Sun to the centre", zh: "碰一下渾天儀，讓太陽回到中心" },
    after: { en: "The universe can be understood.", zh: "宇宙，是可以被理解的。" },
    figures: ["zhangheng", "copernicus", "galileo", "newton", "curie"] },
  { kind: "engine", s: 82,
    title: { en: "Machines", zh: "機器" }, era: { en: "1837", zh: "西元 1837 年" },
    lines: [
      { en: "A mathematician drew an engine that could follow instructions.", zh: "一位數學家，畫出了一台能照著指令運轉的機器。" },
      { en: "Another saw that it could work with symbols, not only numbers.", zh: "另一個人看見，它能處理的不只是數字，還有符號。" },
    ],
    act: { en: "Turn the engine", zh: "轉動這台機器" },
    after: { en: "Thought could now be built.", zh: "思想，第一次可以被建造。" },
    figures: ["civ:babbage", "civ:lovelace", "civ:tesla"] },
  { kind: "ash", s: 97,
    title: { en: "Ashes", zh: "灰燼" }, era: { en: "1914 – 1948", zh: "西元 1914 – 1948 年" },
    lines: [
      { en: "But the same fire can burn everything.", zh: "但同一把火，也能焚燒一切。" },
      { en: "Two world wars took tens of millions of lives, and some of these machines were first built to win them.", zh: "兩次世界大戰奪走了數千萬人的生命，而有些機器，最初就是為了打贏戰爭而造。" },
      { en: "On the ruins, people wrote down a promise.", zh: "在廢墟之上，人們寫下了一個承諾。" },
    ],
    act: { en: "Light the candle with what is left of your fire", zh: "用你僅剩的火，點亮那支蠟燭" },
    after: { en: "Fire can burn, or it can light the way. The choice is always ours.", zh: "火可以焚燒，也可以照亮。選擇它的，始終是人。" },
    figures: ["civ:turing", "eleanor", "pcchang"] },
  { kind: "network", s: 112,
    title: { en: "Connection", zh: "連結" }, era: { en: "1969 – today", zh: "西元 1969 年 – 今天" },
    lines: [
      { en: "In 1969, two computers spoke to each other for the first time.", zh: "1969 年，兩台電腦第一次對話。" },
      { en: "Today, billions of minds share one web, and we are teaching machines to understand us.", zh: "今天，幾十億人連上同一張網，我們甚至開始教機器理解我們。" },
    ],
    act: { en: "Wake the network", zh: "點亮這張網" },
    after: { en: "And the oldest questions are still waiting: who are we, and where are we going?", zh: "而那些最古老的問題仍在等待：我們是誰？我們要往哪裡去？" },
    figures: ["civ:hopper", "civ:berners-lee", "civ:feifei", "civ:hinton"] },
  { kind: "you", s: 127.4,
    title: { en: "You", zh: "你" }, era: { en: "Today", zh: "今天" },
    lines: [
      { en: "Three hundred thousand years. About twelve thousand generations.", zh: "三十萬年，大約一萬兩千個世代。" },
      { en: "Each of them passed the fire to the next.", zh: "每一個人，都把火傳給了下一個人。" },
      { en: "Now it is your turn.", zh: "現在，輪到你了。" },
    ],
    act: { en: "Place your hand on the stone, and hold", zh: "把手放在石上，按住" },
    after: { en: "From today, you carry the fire, too.", zh: "從今天起，你也是傳火的人。" },
    hold: true, figures: [] },
];

export const riteUi = {
  begin: { en: "Begin the walk", zh: "開始這段路" },
  resume: { en: "Continue the walk", zh: "繼續這段路" },
  next: { en: "Walk on", zh: "繼續往前走" },
  leave: { en: "Leave the walk", zh: "離開這段路" },
  home: { en: "Return to the fire", zh: "回到營火" },
  station: { en: "Station", zh: "第" },
  of: { en: "of", zh: "站，共" },
  startTitle: { en: "The walk", zh: "成年之路" },
  startEyebrow: { en: "05 / A rite of passage", zh: "05 / 成年禮" },
  startText: {
    en: "A torch stands by the fire. Take it, and walk the shore through three hundred thousand years of people who passed the fire on. About ten minutes. The bright stars above each place are theirs; you can touch them at any time.",
    zh: "營火旁插著一支火把。帶上它，沿著湖岸走過三十萬年來傳火的人。約十分鐘。每一站上方較亮的星，是他們；隨時都可以點。",
  },
  name: { en: "Your name (optional, it will be written in clay and in the sky)", zh: "你的名字（選填，會刻在泥板上，也會成為一顆星）" },
  look: { en: "Look back.", zh: "回頭看。" },
  lookBack: { en: "Look back: every light on the shore is one you lit.", zh: "回頭看：湖岸上每一盞火，都是你點亮的。" },
  yourStar: { en: "Your star", zh: "你的星" },
  carried: { en: "Walked the three-hundred-thousand-year path. From today, carries the fire too.", zh: "走過了三十萬年的路。從今天起，也是傳火的人。" },
  walking: { en: "Walking… drag to look around, or hold W to walk yourself.", zh: "前進中……拖曳可環顧，按住 W 可自己走。" },
  holdHint: { en: "keep holding…", zh: "繼續按住……" },
  udhr: {
    en: "“All human beings are born free and equal in dignity and rights.” — Universal Declaration of Human Rights, Article 1, 1948",
    zh: "「人人生而自由，在尊嚴和權利上一律平等。」——《世界人權宣言》第一條，1948",
  },
  trailhead: { en: "The walk · Take the torch", zh: "成年之路 · 帶上火把" },
  starHint: { en: "A star on the walk", zh: "這段路上的星" },
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

export function stationLabel(index: number, lang: Lang) {
  const station = riteStations[index];
  return lang === "zh"
    ? `第 ${index} 站 · ${station.era.zh}`
    : `${index === 0 ? "Start" : `Station ${index}`} · ${station.era.en}`;
}

/** Fill `{name}` and pick the language. */
export function say(text: Bilingual, lang: Lang, name = "") {
  return text[lang].replace("{name}", name);
}
