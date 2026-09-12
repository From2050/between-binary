# Woodland source assets

Prepared on 2026-09-09 from Poly Haven's official public asset API. All sources
below are CC0: https://polyhaven.com/license . These are external art assets,
not original Between Binary modelling.

- Fir Tree 01: https://polyhaven.com/a/fir_tree_01
- Tree Stump 01: https://polyhaven.com/a/tree_stump_01
- Rock Moss Set 01: https://polyhaven.com/a/rock_moss_set_01
- Weathered Brown Planks: https://polyhaven.com/a/weathered_brown_planks

Downloads were checked against official API MD5 checksums.
`forest.blend` contains three LOD2 fir variants, normalized origins and standard
PBR bark/needle materials. Needle alpha is retained. `ground-details.blend`
contains a stump and six scanned rocks. These prepared editable sources replace
the full-resolution downloads. `woodland.blend` is the separately authored cabin,
interior, benches and garden, reproducible through `tools/build-world.py`.

Run Blender with `tools/export-forest.py` to regenerate the two runtime GLBs.
Export uses Draco and JPEG quality 82 for opaque textures; alpha textures retain
PNG. Runtime uses needle alpha cutout and matching animated shadow materials.
Tree placement and instancing are authored in `src/world/forest.ts`.
Original download manifests are retained in `source-manifests.json` for source
URLs, sizes and checksums. Original large downloads are not served.


## Ground cover

- Grass Medium 01: https://polyhaven.com/a/grass_medium_01 — Rico Cilliers (model), Rob Tuytel (photography), CC0.
- Fern 02: https://polyhaven.com/a/fern_02 — Poly Haven, CC0.

`understory.blend` contains three standalone LOD2 grass tufts and four fern crowns,
with standard PBR materials and retained leaf alpha. It deliberately excludes the
source's geometry-node preview sphere. `tools/prepare-understory.py` can prepare
these again from the source download directory; `tools/export-forest.py` exports
all three prepared environment files without downloading anything.

A fourth simplified distant fir is prepared from variant C with `tools/prepare-distance-forest.py`; it shares the original textures. Runtime distant trees omit shadow-map rendering and sit outside the inhabited clearing.
