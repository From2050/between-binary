# Current implementation

The image-based vista below was rejected by the user. Runtime now uses original
procedural sky, Blender ridge meshes (`assets/world/mountains.blend`,
`public/models/world/mountains.glb`) and tileable Rock Face material from Poly Haven:
https://polyhaven.com/a/rock_face — Greg Zaal (photography), Dario Barresi (processing),
CC0. Original 2K files were verified against official API MD5; the manifest is
`assets/world/rock-face-manifest.json`. The old images are retained only for provenance.

# Lake vista assets — 2026-09-09

## Rejected image experiment — not loaded at runtime

- `public/textures/vista/eso0932a.jpg`: ESO/S. Brunier, The Milky Way panorama, 6000 × 3000. Downloaded from https://cdn.eso.org/images/large/eso0932a.jpg . Source https://www.eso.org/public/images/eso0932a/ . License CC BY 4.0, https://www.eso.org/public/outreach/copyright/ . Exposure and celestial orientation are adapted in the shader. This is photographic astronomical material, not our original or AI-generated photography. Attribution appears visibly on arrival and in Field guide.
- `public/textures/vista/eso0932a-mobile.jpg`: the same panorama downsampled to 3000 × 1500 with macOS sips. No crop or content replacement.
- `public/textures/vista/alpine-horizon.png`: 2172 × 724 RGBA, generated with the built-in image_gen tool. Curved distant matte, not a surveyed location or explorable mountain model. Original output: `exec-39201984-2910-4530-b42b-5ff4a3183a4d.png`.
- `public/textures/vista/milky-way.png`: 1774 × 887, generated sky study, **not loaded at runtime**. The browser review found its full-sphere resolution insufficient; it is retained to document the design work. Original output: `exec-1e9675fe-7860-477d-a8e1-2b149782a4d8.png`.

Both generated assets were produced by the built-in image tool, not the CLI/API fallback. The supplied user image informed composition and mood; it was not copied into the website.

## Archived mountain generation prompt

Use case: photorealistic-natural. Asset type: distant alpine mountain horizon matte painting for a real-time 3D scene, transparent PNG. A very wide panoramic strip, 3:1 aspect ratio. A continuous realistic mountain range seen from far away on a clear moonlit blue night: jagged asymmetrical rocky alpine summits with small irregular snow gullies; lower layered foothills densely covered with tiny dark conifer forest, subtle blue aerial perspective separating ridges. Dark navy slate and desaturated cool blue, realistic subdued night exposure with enough rock texture to read, NOT daylight. Entire mountain silhouette is isolated against a genuinely TRANSPARENT background; every pixel above the irregular mountain ridge must be transparent. The opaque land fills the bottom edge across the entire image. Mountain peaks vary between 25% and 55% from top; foothills at bottom. Fine realistic rock erosion detail and natural treeline. No sky, stars, moon, aurora, clouds, sun, water, cabin, people, text, border, foreground trees or framing. Left and right mountain edges similar low foothill height for tiling. This will be projected on a curved distant horizon in a 3D environment. Photographic landscape detail, not illustration or low-poly geometry.

## Sky study generation prompt

Use case: photorealistic-natural. Asset type: high-resolution equirectangular 360 by 180 degrees astronomy sky texture for an immersive Three.js alpine night scene. Generate a 2:1 aspect ratio full-sphere sky panorama, ideally 4096x2048. SKY ONLY, no landscape, ground, mountains, trees, buildings, water, people, text, moon, aurora or sun. Astrophotography-quality dense tiny varied stars, realistic luminous Milky Way with finely branching opaque brown charcoal dust lanes and delicate blue-white star clouds, restrained champagne-colored galactic core. Deep navy almost black open areas. The Milky Way forms an inclined great circle across the celestial sphere, strongest galactic core above the middle horizon band. Beautiful detailed natural astrophotography, fine grain not smooth painted clouds, avoid neon purple, no huge starbursts. Rectangular equirectangular projection suitable for UV mapping onto inside of a sphere, left/right edges continuous, poles smoothly distributed. This is an artistic sky texture, not a labeled scientific map. Make the star field and galactic dust resolvable at close zoom, nuanced high dynamic contrast with generous dark sky areas.
