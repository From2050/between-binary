# 成年之路的聲音設計（配樂 cue sheet、Suno 提示詞、環境音清單）

現在聽到的是**原型**：`tools/compose-rite-music.py` 用程式合成的弦樂、無詞合唱、鋼琴、豎琴、鋼片琴與定音鼓，所有聲音都過同一個合成音樂廳殘響，沒有用任何取樣。之後可以一段一段換成 Suno 生成或真人錄音的版本，**檔名和長度對上即可，程式不用改**。

```sh
python tools/compose-rite-music.py            # 全部重做
python tools/compose-rite-music.py ash finale # 只重做其中幾段
```

輸出在 `public/audio/rite/`，`manifest.json` 記錄每段是否循環、長度與音量。

## 設計原則

1. **一個主題貫穿全程。** 「薪火主題」是 D 大調、每分鐘 56 拍的 8 小節旋律（D–A–G–F♯–E…）。它在不同時刻由不同的聲音唱出：
   - 營火旁：鋼琴獨奏
   - 灰燼過後：小提琴獨奏
   - 路的盡頭：合唱與全體弦樂
   - 回家：先是全體奏，最後回到鋼琴

   跟電影配樂的主導動機一樣：同一段旋律，人變了，聲音就變了。
2. **音樂跟著腳下的路走，不跟時間走。** 每一段歷史都是一個可以無縫循環的段落，依你走到的公尺數交叉淡入，交疊約 20 公尺。走得快就換得快；停下來聽旁白，音樂就停在那個時代。
3. **最安靜的地方是灰燼。** 灰燼段只剩低頻、一個不肯解決的不協和音和緩慢的心跳。把火傳給蠟燭之後，主題第一次以獨奏回來。這個對比是整段旅程的情緒轉折。
4. **終點與回家是一次性的樂段**，跟動畫同步：
   - 第 0–7 秒：星星升起，弦樂漸強。
   - 第 7.6 秒：「我們，不是獨自走到這裡的」，合唱唱出主題。
   - 第 18 秒：回頭看，換鋼琴接手。
   - 回家的滑行：全體奏，抵達營火時鋼琴輕聲收尾。
5. **原本的鋼琴錄音（Friday Morning）在儀式期間自動淡出，回到家後才回來**，兩者不會疊在一起。
6. **所有聲音都要先按「Sound on」才會播放**，音量跟著右上角的音量滑桿。

## 配樂 cue sheet

| 檔名 | 什麼時候 | 長度 | 循環 | 內容與情緒 |
|---|---|---|---|---|
| `ember` | 拿起火把、在營火旁點火 | 51.4 s | 是 | 鋼琴獨奏主題、極淡的弦樂。溫暖、私密、出發前的一口氣 |
| `forest` | 跨過立石 → 150 m（森林） | 48 s | 是 | 低音弦樂 D–A 持續音、大提琴獨奏下行句、零星低音鋼琴。黑暗、古老、謹慎 |
| `fields` | 150 → 300 m（麥田、村莊、城市） | 64 s | 是 | 溫暖弦樂和聲 D–Bm–G–A…、豎琴琶音、木笛吹出主題前半。開闊、第一次有「家以外的家」 |
| `voices` | 300 → 432 m（覺醒、天穹） | 56 s | 是 | 無詞合唱（ah／oh）、低音弦樂、像星星的鋼片琴。敬畏、思想、仰望 |
| `ash` | 432 m → 傳火給蠟燭 | 40 s | 是 | 次低頻、不協和弦樂叢集、定音鼓心跳、遠方破碎的鐘聲。壓抑、近乎無聲 |
| `candle` | 點亮蠟燭 → 506 m | 51.4 s | 是 | 小提琴獨奏主題、稀薄弦樂、鋼琴尾句。劫後的希望 |
| `ascent` | 506 m → 山脊（最後的上坡） | 48 s | 是 | 弦樂八分音符脈動、定音鼓心跳、持續上行的和聲。越往上越大聲 |
| `finale` | 手按上石頭那一刻起 | 約 64 s | 否 | 漸強、星星升起（7 s）、合唱主題（7.6 s）、鋼琴回望（18.4 s）、D add9 長音 |
| `hold` | 在山脊上等待按「回家」 | 32 s | 是 | 開放的 D 和弦在呼吸、零星鋼片琴 |
| `homeward` | 按下「回家」：滑行 38 s ＋ 抵家 | 約 56 s | 否 | 全體奏主題（弦樂、合唱、木笛、豎琴）；38.5 s 抵達營火時轉成鋼琴，以 D 大調和弦收尾 |

## Suno 提示詞

建議流程：

1. **先固定主題。** 在 Suno 用「Upload Audio」上傳 `public/audio/rite/ember.mp3`（原型的鋼琴主題），再用 **Cover** 或 **Extend** 生成，這樣每一段都會沿用同一段旋律。如果直接從文字生成，每段的旋律會不一樣，主導動機就不成立了。
2. 每一段都選 **Instrumental**。把下面的 Style 貼到「Style of Music」，Lyrics 欄只放結構標籤。
3. 每段生成 2–4 個版本，挑出最符合「情緒」那一欄的版本。需要循環的段落，挑一段開頭和結尾都在 D 和弦上的 40–60 秒（我可以幫你剪成無縫循環）。
4. 授權提醒：Suno 免費方案生成的音樂不能商用；付費方案訂閱期間生成的作品可以商用。網站如果有營利性質，請用付費方案生成。

---

**1 · ember（營火、出發）**
- Style: `cinematic solo piano, intimate, warm, slow 56 bpm, D major, sparse left hand open fifths, soft felt piano, distant string pad, campfire night, hopeful and tender, film score, no drums, no vocals`
- Lyrics:
  ```
  [Instrumental]
  [Intro: solo piano, very soft]
  [Main theme: piano melody, gentle string pad underneath]
  [Outro: piano holds D major chord, fade]
  ```

**2 · forest（森林、遠古）**
- Style: `dark ambient film score, low cello solo, sustained double bass drone on D and A, sparse low piano notes, D dorian, 56 bpm, mysterious, ancient, night forest, slow and cautious, wide reverb, no drums, no vocals`
- Lyrics:
  ```
  [Instrumental]
  [Drone: low strings, barely audible]
  [Cello solo: slow descending phrase]
  [Sparse piano notes, long silences]
  [Drone continues, seamless loop]
  ```

**3 · fields（麥田、村莊、城市）**
- Style: `warm orchestral film score, lush string ensemble, harp arpeggios, wooden flute melody, D major, chords D Bm G A, 56 bpm, pastoral, golden fields at night, sense of beginning, gentle swell, no drums, no vocals`
- Lyrics:
  ```
  [Instrumental]
  [Strings enter warmly]
  [Harp arpeggios]
  [Flute plays the main theme, first half]
  [Strings swell, return to D]
  ```

**4 · voices（覺醒、天穹）**
- Style: `ethereal wordless choir, ahh and ooh vowels, celesta twinkles like stars, low string bed, Gmaj7 to D to Em9 to Asus4, 56 bpm, awe, wonder, philosophers under the night sky, sacred but not religious, huge reverb, no drums, no lyrics`
- Lyrics:
  ```
  [Instrumental]
  [Wordless choir, soft entry]
  [Celesta like distant stars]
  [Choir swells on the third chord]
  [Return to stillness]
  ```

**5 · ash（灰燼、戰爭）**
- Style: `dark minimal film score, deep sub bass drone, unresolved dissonant string cluster, slow heartbeat on muffled timpani, distant broken bell, almost silence, grief, war, smoke, 1914 to 1945, tense and hollow, no melody, no vocals`
- Lyrics:
  ```
  [Instrumental]
  [Sub drone and heartbeat only]
  [Dissonant strings, very quiet, never resolve]
  [Distant bell, decaying]
  [Heartbeat continues]
  ```

**6 · candle（傳火之後）**
- Style: `solo violin film score, tender and hopeful, main theme on violin, thin string pad, soft piano, D major with B minor color, 56 bpm, after the war, rebuilding, a single candle in the dark, intimate, no drums, no vocals`
- Lyrics:
  ```
  [Instrumental]
  [Solo violin plays the main theme]
  [Thin strings support]
  [Soft piano answers]
  ```

**7 · ascent（最後的上坡）**
- Style: `building cinematic orchestral, pulsing string ostinato in eighth notes, heartbeat timpani, rising chord progression D A/C# Bm F#m G D/F# Em A, 112 bpm pulse, determination, climbing toward the summit, epic but restrained, no vocals`
- Lyrics:
  ```
  [Instrumental]
  [String ostinato starts]
  [Timpani heartbeat joins]
  [Chords climb, gradual crescendo]
  [Hold before the peak]
  ```

**8 · finale（路的盡頭，約 64 秒，要跟畫面同步）**
- Style: `epic emotional film score climax, full string orchestra and wordless choir, main theme in D major, harp glissando, celesta sparkle, timpani, swelling crescendo then tender piano reprise, catharsis, becoming one of the stars, ending on sustained D add9, no lyrics`
- Lyrics:
  ```
  [Instrumental]
  [Swell: strings rise from silence, 7 seconds]
  [Harp glissando and bell: a star rises]
  [Choir and full strings sing the main theme]
  [Piano reprise, gentle, looking back home]
  [Long sustained D chord, fading]
  ```
  剪輯對位：合唱主題約在 7.5 秒進來，鋼琴約在 18 秒接手。

**9 · homeward（回家，約 56 秒）**
- Style: `soaring orchestral film score, main theme in full, strings choir flute and harp, flying home over a road of fire at night, joyful and grateful, D major, broad 56 bpm, then quiet solo piano ending, warm resolution, no drums, no vocals`
- Lyrics:
  ```
  [Instrumental]
  [Full orchestra sings the main theme, soaring]
  [Harp and flute ornaments]
  [Arrival: orchestra fades, solo piano plays the opening phrase]
  [Final D major chord rings]
  ```

## 環境音：目前合成，之後可換成真實錄音

| 檔名 | 用在哪裡 | 目前合成的內容 | 想換成的真實錄音（CC0，Freesound 可篩選授權） |
|---|---|---|---|
| `amb-forest` | 營火旁、森林段 | 樹冠風聲、針葉沙沙、少量蟋蟀、兩聲貓頭鷹 | 北方針葉林夜晚，60 s 以上可循環。關鍵字：`night forest ambience conifer`、`boreal forest night`。另要 1–2 段貓頭鷹（灰林鴞或烏林鴞）：`tawny owl`、`ural owl` |
| `amb-open` | 麥田、曠野 | 草原風、蟋蟀群 | 夏夜草原，蟋蟀與微風：`summer night meadow crickets`、`field night ambience` |
| `amb-ash` | 灰燼段 | 低沉的風、餘燼劈啪聲 | 餘燼與燜燒聲、低沉陣風：`embers crackling smoulder`、`wind howl low`。可另加極遠的悶雷或砲聲（音量很小）：`distant thunder rumble` |
| `amb-crest` | 最後的上坡與山脊 | 高處的風、口哨般的風聲 | 山脊或高原的風：`mountain wind ridge`、`windy plateau` |
| `steps` | 腳步聲（每 0.5 秒一步，共 8 步的切片） | 低頻落地＋細碎沙土 | 走在森林土路與落葉上的腳步，8–10 步，間隔清楚：`footsteps forest path dirt`、`footsteps leaves walking` |
| （程式即時合成） | 火把與石堆的劈啪聲、點燃聲、鐘聲 | 合成 | 營火劈啪聲循環 30 s：`campfire crackle close`；火把揮動或點燃：`torch ignite whoosh` |

給錄音的規格：WAV 或 FLAC、44.1 kHz 以上，盡量沒有人聲、車聲、飛機聲。下載後放進 `assets/audio-raw/` 給我，我會剪成可循環的段落、統一音量，再換掉合成版本。
