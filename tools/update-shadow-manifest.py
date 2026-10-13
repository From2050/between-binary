"""Prepare the walk's shadow images and list them, so they replace the drawn shadows (see docs/RITE_ART.md).

Put the full-size originals (black figure on white, 1:2 portrait) in assets/shadows/<id>.png, then run:
    python tools/update-shadow-manifest.py
Each is reduced to a 512 × 1024 greyscale PNG in public/images/rite/shadows/, and manifest.json lists them.
Images placed directly in public/images/rite/shadows/ are reduced in place the same way."""
import json, pathlib
from PIL import Image

root = pathlib.Path(__file__).resolve().parents[1]
source, folder = root / "assets/shadows", root / "public/images/rite/shadows"
source.mkdir(parents=True, exist_ok=True); folder.mkdir(parents=True, exist_ok=True)
for original in list(source.glob("*.png")) + [p for p in folder.glob("*.png") if not (source / p.name).exists()]:
    target = folder / original.name
    image = Image.open(original)
    if original.parent == folder and image.mode == "L" and image.size == (512, 1024): continue
    if original.parent == folder: image.save(source / original.name)  # keep the original
    grey = image.convert("L")
    w, h = grey.size; k = min(512 / w, 1024 / h)
    grey = grey.resize((round(w * k), round(h * k)), Image.LANCZOS)
    canvas = Image.new("L", (512, 1024), 255); canvas.paste(grey, ((512 - grey.width) // 2, 1024 - grey.height))
    canvas.save(target, optimize=True)
ids = sorted(p.stem for p in folder.glob("*.png"))
(folder / "manifest.json").write_text(json.dumps(ids, indent=2) + "\n", encoding="utf-8")
print(f"{len(ids)} shadow image(s):", ", ".join(ids) or "none")
