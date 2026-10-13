"""List the shadow images in public/images/rite/shadows so the walk uses them in place of its drawn shadows.
Run after adding or removing an image: python tools/update-shadow-manifest.py (see docs/RITE_ART.md)."""
import json, pathlib

folder = pathlib.Path(__file__).resolve().parents[1] / "public/images/rite/shadows"
folder.mkdir(parents=True, exist_ok=True)
ids = sorted(p.stem for p in folder.glob("*.png"))
(folder / "manifest.json").write_text(json.dumps(ids, indent=2) + "\n", encoding="utf-8")
print(f"{len(ids)} shadow image(s):", ", ".join(ids) or "none")
