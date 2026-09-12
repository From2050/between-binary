# The World — a quiet path through Between Binary

`/world/` is an optional, standalone Three.js entrance. The ordinary homepage,
articles, feeds and content collections remain independent. This route is still
`noindex` and has not been added to the public navigation.

## Experience and intent

The world expresses the Civilization Star Map vision: open country at night,
the people who made our knowledge possible overhead, and places to continue our
own exploration below. Its interaction rhythm is **arrive → approach → stay →
choose whether to read**. Clicking an object must not immediately eject the
visitor into a different page.

- **The fire / Thoughts:** a front-yard fire ring, benches and a book; a place to stay.
- **The grove / Garden:** raised beds behind the east side of the house; seedlings,
  herbs and flowers share a sheltered growing space.
- **The workshop / Lab:** a timber workshop with a porch; making, testing, trying again.
- **The sky / Civilization:** 45 shared figures. Each can be selected directly
  in the scene or through a keyboard-accessible selector.

The arrival screen offers sound or silence. Direct object interaction is primary:
click the fire, the cabin or the visible garden arbor/beds. Hover lights and a
short contextual hint respond at the object. Bright civilization stars have an
18 CSS-pixel mouse target (26 on coarse pointers), with a ring and person hint;
background decorative stars are deliberately much fainter. The collapsed **Field
guide** retains a keyboard and touch alternative without a persistent destination bar.

The spatial plan is a small homestead: cabin at (-8, -16), fire in the open front
yard at (-1, -5), garden behind/east at (-2.4, -23), forest along the sides and rear.
An east-side route at x=1 reaches the garden without crossing the cabin. Scene
coordinates use Y up. Sky, moon and all figures still share one parent rotation.

The cabin, porch, interior workbench/bookshelves, roof, benches, raised beds,
garden leaves are authored through Blender (`tools/build-world.py`). Windows
have actual openings and transparent glass; the workshop's single warm light
sits inside at the desk rather than in front of an emissive window rectangle.
Wall openings and lintels meet to avoid light leaking around the frame.

The forest uses three CC0 Fir Tree 01 LOD2 variants from Poly Haven, grouped
into irregular near, middle and far stands. Scanned mossy rocks and two stumps
anchor the ground. Both the cabin and scanned assets retain editable Blender
sources. Source/licence details and download checksums are recorded in
`assets/world/SOURCES.md` and `assets/world/source-manifests.json`.
The ground uses CC0 Brown Mud Leaves 01 maps; weathered wood uses matching colour,
normal and roughness maps. See the credits under `public/textures/`.

The initial camera stands at (1, 1.7, 3), close to the fire, looking across the
lake with the cabin on the left. Vertical field of view starts at 60 degrees and
widens up to 86 degrees in portrait layouts to retain the near focal points.
Travel follows curve arc length at a walking-oriented pace
(with a maximum 18-second journey); reduced motion switches viewpoints without
animation. No idle camera shake or forced head bob is introduced.

Rebuild assets with Blender (output goes to `public/models/world/woodland.glb`):

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/build-world.py
```

The GLB uses Draco compression and a locally hosted decoder. Blender source is
kept outside `public`, so visitors never download the authoring file.

## Controls

- Drag the scene to look around; arrow keys do the same when the canvas is focused.
- Click a scene object to approach it; destination buttons are inside Field guide.
- Drag during an approach to stop the journey and look around.
- A visible **Back to clearing** button remains available after approaching any place,
  including after closing its card or interrupting movement. It disappears only
  once the return completes. **Escape** and the guide's **The path** do the same.
- Close an information card to stay in the scene with an unobstructed view.
- **The sky** exposes a selector and next-person button for all 45 figures.
- **Pause motion** freezes environmental animation and makes travel immediate.
- `prefers-reduced-motion` starts in this still mode and updates when the system
  preference changes. No forced head bob or automatic camera sweep is applied.
- **Sound off/on** and the volume slider remain visitor-controlled; the mobile
  volume slider appears when sound is enabled.

## Architecture

| File | Responsibility |
| --- | --- |
| `src/pages/world/index.astro` | Accessible HTML shell, loading and fallback paths, lazy scene import |
| `src/world/world.css` | Arrival, wayfinding, information cards, responsive layout |
| `src/world/journey.ts` | Destination metadata, viewpoints, transition easing |
| `src/world/exploration.ts` | Camera journeys, picking, keyboard/pointer input, focus, information and audio controls |
| `src/world/scene.ts` | Renderer, terrain, celestial group, places, effects and render lifecycle |
| `src/world/landscape.ts` | Fallen leaves, loose wind-driven litter and small stones |
| `src/world/terrain.ts` | Continuous inhabited shelf, dry paths, lake basin and ground height |
| `src/world/vista.ts` | Distant alpine horizon and ripple-distorted planar water reflection |
| `tools/build-world.py` | Blender mesh/material authoring and compressed GLB export |
| `src/world/shaders.ts` | Sky, star and fire GLSL sources |
| `src/world/soundscape.ts` | Consented playback, fades, volume and visibility lifecycle |
| `src/data/civilizationStars.ts` | Shared figure records, unchanged |

### The sky invariant

The dome, civilization points and moon remain children of `starsGroup`. The
entire sky rotates through **one parent transform**. Individual objects must not
acquire separate orbital animation in this scene. The sky shader keeps object
space for celestial features and world space for the horizon/aurora.

The homepage `StarMap.tsx` is a separate display with independent orbital motion.
Its wide travel is intentional. This work does not change that component or the
shared figure records.

## Recorded music

The previous synthesized drones, wind noise and crackles have been removed.
The scene now plays **Friday Morning — Kevin MacLeod**, a recorded solo piano
piece, downloaded from the author's site under CC BY 4.0. Full provenance is in
`public/audio/CREDITS.md`; source/author/license links also appear in Field guide.
The original recording is unedited and locally hosted. No runtime third-party
music service is required. Volume starts at 22%, with a 1.2-second fade.

No audio element or audio request exists until consent. Muting fades then pauses;
hiding the page pauses immediately. A muted page never resumes itself. Failed
playback can be retried. The recording loops at its natural ending; it is not
represented as a seamless studio loop. No extra noise layer is mixed underneath.

## Performance and resilience

- World code is dynamically imported; regular content routes do not load Three.js.
- Pixel ratio is capped at 1.5 on desktop / 1.15 on small screens at initialization.
- Rendering is capped at 45 / 30 fps respectively; these are caps, not guaranteed frame rates.
- Grass, three tree variants and scanned rocks use instancing. Up to 24 near trees
  and 42 / 26 distant placements are filtered against the lake and view corridor; they omit shadow-map rendering. Blender cabin geometry
  is combined by material. Needle alpha cutouts also apply to animated shadows.
- Desktop uses four-sample MSAA and a 2048px moon-shadow map. Small screens use
  1024px moon shadows and omit MSAA. Fire/window shadow maps are 512px / 256px.
- The visible moon drives the directional light. Its shadow refreshes every
  0.18s / 0.4s (desktop / small screen); local fire/window shadows refresh every
  0.6s / 1s to follow moving vegetation. Depth and distance shadow materials use
  the same wind deformation as the visible foliage. All three sources cast shadows.
- There are three direct light sources: moon, fire and workshop. A low-energy
  spherical-harmonic light probe approximates diffuse moon/sky reflection in
  shadows. This is an artistic indirect-light approximation, not a full GI simulation.
- The moon sits high on the front/right side of the clearing. Warm fire/window
  pools attract attention, moonlit ground provides orientation, and the deeper
  forest remains darker. Exposure is fixed at 1.4; bloom is restrained to protect
  highlight detail. No camera-dependent exposure pumping or adaptation delay is used.
- Aurora uses the original soft FBM cloud field, green/cyan palette, slow drift,
  elevation envelope and side-of-sky placement. The later repeating striped
  curtain was reverted after visual review. It is a sky shader effect and adds
  no terrain light. The separate decorative warm horizon glow remains removed.
  Pause motion freezes the aurora.
- Garden lamps, hover light boosts and path halos remain absent.
- Floor color, OpenGL normal and roughness maps use matching 2.6m UV tiles,
  large-scale color variation and a feathered wear mask in one surface. There
  are no overlapping path ribbons or uniformly spaced cylinder stepping stones.
  Two offset samples blend with a broad noise field in colour, normal and roughness
  together, reducing obvious tile repetition without misaligning their details.
- Photographic ground cover uses three Grass Medium 01 LOD2 tufts (up to 2,100
  clumps desktop / 960 small screen) and four Fern 02 crowns (60 / 36).
  Their alpha, normal and roughness maps preserve leaf detail at walking distance.
  They replace the single-colour blade geometry and radial procedural ferns.
  Grass and fronds form irregular patches away from paths, beds and the cabin.
  Embedded scanned stones and curling dry leaves add detail at other scales.
- `wind.ts` supplies one travelling gust field to grass, tree crowns, garden plants,
  flame lean and ember drift. Grass bends from fixed roots and its shading normals
  turn with the blades; tree response grows toward the crown. A small set of 24
  loose leaves can lift and settle in stronger gusts; most litter stays still.
  This is an art-directed wind response, not a fluid simulation. Pause/reduced
  motion freezes it alongside the sky. No synthesized wind noise was added.
- Civilization stars use a dedicated seeded irregular hemispherical distribution,
  independent of landscape random calls. No fixed altitude rows remain.
- In still mode, scene rendering is skipped until input, resize or texture loading
  requires it. Hidden pages stop scheduling frames.
- Initialization failure or WebGL context loss presents ordinary content links.
  Visitors can also bypass the scene when JavaScript is disabled.
- UI controls expose focus states, pressed states and live journey feedback.

## Validation

```sh
npm run build
node --experimental-strip-types --test tests/world.test.ts
node node_modules/typescript/bin/tsc --noEmit --target es2022 --module esnext \
  --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck --lib dom,es2022 src/world/*.ts
```

Tests cover round trips between every viewpoint staying outside the cabin, bounded journey easing and the audio consent/mute/visibility/disposal
contract and rejected-play retry using a simulated media element, plus deterministic,
spatially coherent wind with bounded direction and changing gust strength. Browser checks cover actual rendering,
place approach, information cards, star selection, motion/sound controls and
mobile layout. Simulated audio tests do not establish subjective listening quality.

## Remaining scope

This is guided movement between viewpoints, not unrestricted WASD locomotion or
a WebXR headset implementation. The 45 records still link to the shared star-map
article; per-person writing can be added separately. Low-end phone GPU performance
and listening balance across real headphones/speakers still need device testing.
The scene remains an authored real-time night environment; its appearance and
performance still need review on visitors’ actual displays and mobile GPUs.
Blender improves editable geometry and material detail; final art direction and
subjective listening quality remain part of the visitor review.

## HCI references

- [W3C: Animation from interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- [W3C: Pause, stop, hide](https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html)
- [MDN: Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

## Scene review, September 2026

The reading panel sits below the approached object's focal area, with a smaller
footprint, bounded scroll height and a 44px close target. Opening the field guide
hides the card while its alternative navigation is in use. The screen vignette
was reduced from 72% to 18% black at the bottom: material detail near the visitor
should not disappear behind a dark UI overlay. This does not add a scene light.
East-side trees leave a moonlight opening above the garden. The right-hand bench
is set away from the route to the workshop, whose arrival view faces the window
and interior workbench rather than a close-up of the closed door.


## Lake composition revision — 2026-09-09

The supplied alpine-cabin reference exposed a composition problem: flat ground,
central objects and a tree perimeter were making the scene read as a model display.
The new plan uses a close fire, a cabin set west into the trees, an irregular shelf
that descends into a lake, and a distant alpine horizon. The Blender build shifts
all disconnected house/garden geometry west by 8m; hit targets, lights, garden
viewpoints, terrain pads, foliage exclusions and return routes move with it.

`terrain.ts` is the shared height source for mesh, rocks and foliage. The lake
surface is at -5.5m; visitor paths stay on the dry shelf near 0m. Tests sample
all routes for ground clearance as well as cabin/trunk clearance. The two ground
grids meet at +/-50m, with the far grid extending to +/-700m.

The original procedural sky and approved aurora have been restored. The generated
panorama and photographic all-sky experiment were rejected in visual review and
are not loaded by the scene. Their provenance remains archived as design history.

The distant environment uses three real Blender ridge meshes in `mountains.glb`,
with a reproducible source in `tools/build-mountains.py` / `mountains.blend`.
They have smooth normals, world-scale tileable CC0 Rock Face PBR maps and a restrained
height/slope snow mask. Do not repeat photogrammetry UV-atlas textures over these
surfaces: they are not tileable. Ridged noise frequencies are bounded to the mesh
sampling density to avoid aliased spikes. The mountain mesh compresses to under
0.5 MB. It is an authored landscape, not a reconstruction of a surveyed location.

Shoreline fir placements are generated with the same foothill height function and
stored in `ridge-trees.ts`; 420 / 210 distant trees augment the existing stands.
The lake reflection uses the same sky, ridge geometry, distant forest and lunar
direction. Near meshes and their shadows are excluded from this lightweight pass.
The reflection target is 768x512 / 384x256, without MSAA. Small ripples distort
reflections, and pause motion freezes the water. Mountain surfaces use directional
shading and depth haze, but no far-range shadow map: the detailed shadow budget
is retained for the nearby cabin, fire and vegetation.

Moon direct intensity is 0.65, fire 38 with flicker and the cabin lamp 26.
The diffuse light probe has L0 RGB (0.13, 0.18, 0.26); no additional direct lights
or artificial ground halos were introduced. Exposure remains 1.4. Mountains respond to the same moving moon direction as the foreground.
Source files, generation prompts and license records are in
`assets/world/vista/SOURCES.md`.


The campfire picking volume tapers from the stone ring toward the flame. A full
box used to intercept clicks aimed at the cabin behind it. The workshop approach
uses an east-side waypoint before crossing in front of the porch, leaving benches
and the building clear. Narrow layouts retain the cabin window in the starting view.
