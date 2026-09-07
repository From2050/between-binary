# The World — 3D entry at `/world/`

A game-style gateway to Between Binary: you stand on a path crossing open country
at night, under a sky made of the people who built what we know. It is a
**separate route**, not a replacement for the homepage — the content pages stay
plain static HTML so SEO, RSS and load time are untouched, and Three.js is only
ever downloaded by someone who walks in.

## Where the design comes from

The scene is a direct reading of the vision written in
`src/content/lab/civilization-star-map.mdx`:

> a walkway through open wilderness — no walls, no UI chrome, just terrain
> underfoot and sky overhead … Above you, the sky holds the people and moments
> who made each step possible.

So the world is **not** a plaza with buildings on it. It is a trail through
rolling country, with three places to stop at, each one the literal form of what
its collection actually is:

| Place | Form | Why that form |
|---|---|---|
| **Thoughts** | A campfire, with illustrated pages circling up on the heat | Long-form writing = stories told at a fire |
| **Garden** | A grove of a seedling, a sapling and a full evergreen | The collection's own growth model, `seedling → budding → evergreen`, made physical |
| **Lab** | A small lit log cabin with an ornate door | Experiments need a workshop, not a portal |

## Scene structure

Everything is procedural except the painted art listed below.

- **Terrain** — one displaced plane (300 units, 150×150 segments). Height comes
  from seeded value-noise FBM whose amplitude ramps up with distance, so the
  ground rolls nearby and rises into hills at the horizon. Displacement is
  damped toward zero near the path (`distToPath`), which keeps the walk level
  and lets every waypoint sit at exactly `y = 0`.
- **Sky** — a GLSL shader dome: three twinkling star layers, an FBM milky way
  with dust lanes, nebula patches, a low aurora curtain and a warm glow on one
  horizon. Resolution-independent, so it never shows texture blur.
- **Fire** — a shader, not a scaling sprite: upward-scrolling domain-warped
  noise eats into a teardrop body, so tongues actually break off. The logs
  underneath are painted art.
- **Post** — ACES tone mapping plus a deliberately restrained bloom
  (strength `0.42`, threshold `0.34`). The scene is meant to be dark; only
  genuinely hot things are allowed to glow.

### The one invariant worth protecting

**The sky is a single rigid body.** The dome mesh, the 45 civilization stars and
the moon are all children of `starsGroup`, and the only time-based rotation in
the entire file is:

```js
starsGroup.rotation.y = t * SKY_SPIN;
```

This is deliberate and was learned the hard way. Two earlier versions broke
immersion badly:

1. Giving each star its own orbital speed (some retrograde) made them read as
   nearby objects drifting around, not as distant stars.
2. Rotating the sky inside the shader *and* rotating the star group in JS meant
   two sign conventions had to agree — and they did not, so the stars visibly
   counter-rotated against the star field.

The fix was to stop reasoning about signs and make desync structurally
impossible: one parent, one transform, no per-object time rotation. **If you add
anything to the sky, add it to `starsGroup` and give it no rotation of its own.**

Terrestrial effects are the exception and must *not* wheel with the stars, so
the sky shader carries two directions: `vDir` (object space, turns with the sky
— stars, milky way, nebulae) and `vWorld` (world space, fixed to the ground —
horizon gradient, distant glow, aurora).

## Shared data, independent displays

`src/data/civilizationStars.ts` is the single source of truth for the 45
figures. Two displays map it into their own geometry and **must stay
independent**:

- `src/components/StarMap.tsx` — the homepage constellation. Maps each record
  onto an elliptical orbit in percent-of-container units. Stars deliberately
  swing far outside the viewport and are only clickable while an orbit carries
  them into the foreground. **This is intended behaviour, not a bug** — do not
  "fix" the wide travel.
- `src/pages/world/index.astro` — maps the same records onto the celestial
  sphere at radius 192, drawn as screen-space-sized points so they read as
  distant stars at any depth.

Add a figure once in the data module and both displays pick it up.

## Art assets — `public/images/world/` (~1.6 MB, loaded only on `/world/`)

Generated with an image model, then keyed off their black backgrounds locally.

| File | Use |
|---|---|
| `door.jpg` | The cabin door |
| `logs.png` | Burning logs under the shader flame |
| `moon.png` | The lunar disc |
| `plant-0/1/2.png` | Seedling, sapling, evergreen |
| `note-0…5.jpg` | The pages circling the fire |

**Cutting art off a black background** — two details decide whether it looks
right, both learned from getting them wrong first:

1. The alpha ramp must be **steep** (opaque by luminance ~30). A gentle ramp
   turns mid-tone interior pixels semi-transparent and punches holes through
   dark foliage.
2. Edge pixels arrive already multiplied by their coverage, so divide the colour
   back out (un-premultiply) or every cut-out gets a dark fringe.

## Not done yet

- Mobile: controls are pointer-drag only; touch works but the scene is not
  performance-tuned for phones, and there is no low-end fallback.
- The page renders continuously. On-demand rendering (only redraw when the
  camera moves or something animates) would cut battery use a lot.
- All 45 stars still link to the one star-map article. Per-figure pages are the
  natural next step, as noted in that article.
- `/world/` is `noindex` and is not linked from the site navigation yet.

---

## 繁體中文摘要

`/world/` 是獨立路由的 3D 入口,**不取代首頁**——文章頁維持靜態 HTML,SEO、RSS
與載入速度完全不受影響,Three.js 只有真的走進去的人才會下載。

場景是照 `civilization-star-map.mdx` 裡「曠野走道:沒有牆、沒有 UI,只有腳下的地
與頭上的天」的願景做的,所以不是「廣場加三棟建築」,而是一條穿過丘陵的夜路,沿途
三個駐足點各自是該分類的字面形體:**營火**(長文=圍著火說故事)、**樹叢**(幼苗→
成長中→常青,就是 Garden 的成長階段)、**小木屋**(實驗需要工坊)。

### 最需要守住的一條規則

**整片天空是單一剛體。** 天穹球體、45 顆星、月亮都是 `starsGroup` 的子物件,全檔案
唯一的時間旋轉就是 `starsGroup.rotation.y = t * SKY_SPIN`。這是踩過兩次坑換來的:
給每顆星獨立軌道速度會讓它們像近處飄浮物;shader 和 JS 各轉一次則因為矩陣符號慣例
不一致而真的反向自轉。解法不是再推一次符號,而是讓不同步在結構上不可能發生。
**之後要往天上加東西,就加進 `starsGroup` 並且不要給它自己的旋轉。**

地面現象(地平線暖光、極光)是例外,不該跟著星星轉,所以 shader 分成 `vDir`(天球)
與 `vWorld`(地面)兩個座標系。

### 資料共用、顯示獨立

`src/data/civilizationStars.ts` 是 45 位人物的唯一資料來源,首頁 `StarMap.tsx` 與
`/world/` 各自映射成自己的幾何。首頁星星會飛出畫面、只有軌道把它們帶到前台時才可
點擊——**這是設計,不是 bug,不要去「修」它**。

### 去背的兩個關鍵

alpha 曲線要**陡**(亮度約 30 就全不透明),否則深色葉片會被打穿成鏤空;邊緣像素要
做 un-premultiply,否則會有一圈暗框。
