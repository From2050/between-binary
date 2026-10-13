# 走馬燈剪影：Codex 生圖提示詞

成年之路每一站完成後，你的火會照亮身邊一圈霧，那個時代的人化成剪影，繞著你緩緩轉動，就像走馬燈。現在的剪影是 `src/world/rite-shadows.ts` 用程式畫的**暫代版本**。

把生成好的圖放進 `public/images/rite/shadows/`，執行下面的指令，就會自動換掉暫代版本，不用改程式：

```sh
python tools/update-shadow-manifest.py
```

## 每張圖的共同規格（每次都貼這一段）

```
Traditional Chinese shadow puppet (皮影戲) silhouette, a single full-body figure in side profile facing right,
solid pure black (#000000) figure on a pure white (#FFFFFF) background, crisp clean edges,
elegant flowing lines, delicate ornamental cut-out patterns inside the clothing (small white lace-like holes,
as in real leather shadow puppets), expressive hands and gesture, feet touching the bottom edge of the image,
figure fills about 85% of the image height, no ground line, no shadow, no frame, no text, no colour.
Portrait image, aspect ratio 1:2 (for example 1024 × 2048).
```

- 背景一定要是純白，或者透明；人物一定要是純黑。程式會把白色當成光、黑色當成影子。
- 衣服裡的鏤空花紋（白色小洞）在霧裡會變成透光的圖案，這正是皮影最美的地方，可以多一點。
- 人物面向右。成群的路人有一半會被程式自動左右翻轉，不用另外畫。
- 檔名用下表的 `id`，例如 `galileo.png`。

## 有名字的人（14 張）

| id | 人物 | 姿勢與道具（接在共同規格後面） |
|---|---|---|
| `painter` | 無名的先人，約四萬年前 | `an Ice Age woman kneeling before a cave wall, one hand pressed flat on the rock, the other hand at her mouth blowing pigment through a hollow bone; long loose hair, fur wrap; the rock wall rises at the right edge with three hand stencils cut out of it` |
| `farmer` | 無名的農人，約一萬兩千年前 | `a Neolithic farmer striding forward, sowing seeds from a pouch at his hip with a wide sweep of the arm, seeds falling in an arc; simple tunic, bare legs; a few stalks of wild wheat at his feet` |
| `enheduanna` | 恩赫杜安娜，約西元前 2300 年 | `Enheduanna, Sumerian high priestess, standing tall in a long flounced robe, a tall rimmed headdress, holding a clay tablet against her chest and a reed stylus raised in the other hand` |
| `confucius` | 孔子 | `Confucius as an elderly scholar bowing courteously, hands joined inside very wide long sleeves, flowing robe, scholar's cap, long beard` |
| `laozi` | 老子 | `Laozi, the old sage, riding slowly on a water buffalo, long white beard, holding a staff, loose robe flowing` |
| `buddha` | 佛陀 | `the Buddha seated in meditation, legs crossed, hands resting in his lap, serene, beneath the wide spreading branches of a bodhi tree whose leaves have ornamental cut-outs` |
| `socrates` | 蘇格拉底 | `Socrates standing barefoot in a draped Greek himation, short beard, one hand raised in a questioning gesture as if asking a question to someone` |
| `zhangheng` | 張衡 | `Zhang Heng, Han dynasty astronomer, in an official's robe and winged hat, one hand pointing at his bronze seismoscope: an urn with eight dragons holding balls above eight toads` |
| `copernicus` | 哥白尼 | `Copernicus in a Renaissance scholar's gown and cap, holding up a model of the heliocentric system: the sun at the centre, planets on concentric rings` |
| `galileo` | 伽利略 | `Galileo in a cloak with a short beard, looking up through a long telescope raised toward the sky` |
| `newton` | 牛頓 | `Isaac Newton in a long coat and wig, holding up a glass prism; a thin beam of light enters it and fans out into a spectrum (beam and spectrum as white cut-out lines)` |
| `curie` | 瑪麗·居禮 | `Marie Curie in a long dark dress, hair in a bun, holding a laboratory flask that glows (the glow as a white cut-out halo around the flask)` |
| `eleanor` | 愛蓮娜·羅斯福 | `Eleanor Roosevelt in a 1940s dress, holding up a large document, the Universal Declaration of Human Rights, its lines of text as white cut-out lines` |
| `pcchang` | 張彭春 | `Peng Chun Chang, Chinese diplomat in a 1940s suit, standing at a lectern, one open hand extended as he speaks` |

## 無名的人（12 張，每個時代一起轉的人群）

| id | 時代 | 姿勢與道具 |
|---|---|---|
| `hunter` | 遠古 | `a prehistoric hunter walking with a long spear, fur clothing` |
| `mother` | 遠古 | `a prehistoric mother standing, holding the hand of a small child beside her` |
| `harvester` | 農業 | `a farmer bent over cutting wheat with a sickle, a sheaf of wheat in the other arm` |
| `carrier` | 農業 | `a woman walking with a woven basket balanced on her head` |
| `builder` | 城市 | `an ancient builder walking with a mud brick carried on his shoulder` |
| `scribe` | 城市 | `an ancient scribe seated cross-legged writing on a clay tablet` |
| `disciple` | 軸心時代 | `a young student seated, listening attentively, hands in his lap` |
| `traveller` | 軸心時代 | `a traveller walking with a staff and a bundle on his back, long robe` |
| `navigator` | 天文 | `a sailor of the age of discovery taking a sighting of the stars with a sextant` |
| `stargazer` | 天文 | `a child pointing up at the sky, looking up in wonder` |
| `refugee` | 戰爭 | `a refugee walking with a bundle on his back, leading a small child by the hand` |
| `planter` | 戰後 | `a person kneeling to plant a young tree sapling in the ground` |

## 如果想換風格

只要共同規格保持「黑色人物、白色背景、面向右、腳貼底邊、1:2 直式」，風格可以換，例如：
- 剪紙（papercut）
- 版畫（woodcut）
- 敦煌壁畫線描的剪影

同一批圖請用同一種風格，轉起來才會一致。
