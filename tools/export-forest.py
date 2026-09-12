"""Re-export the prepared CC0 forest assets with Blender, without network access.
Source details: assets/world/SOURCES.md.
"""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
for name in ['forest','ground-details','understory']:
 bpy.ops.wm.open_mainfile(filepath=str(root/'assets/world'/f'{name}.blend'))
 bpy.ops.export_scene.gltf(filepath=str(root/'public/models/world'/f'{name}.glb'),
  export_format='GLB',export_draco_mesh_compression_enable=True,
  export_draco_mesh_compression_level=6,export_yup=True,
  export_cameras=False,export_lights=False,export_image_format='JPEG',export_jpeg_quality=82)
