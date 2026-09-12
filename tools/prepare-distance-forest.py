"""Add a low-cost distant fir to the prepared environment source."""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/world/forest.blend'))
if not bpy.data.objects.get('fir_distance'):
 source=bpy.data.objects['fir_tree_01_c_LOD2'];obj=source.copy();obj.data=source.data.copy();obj.name='fir_distance'
 bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj;obj.select_set(True)
 mod=obj.modifiers.new('Distance simplification','DECIMATE');mod.ratio=.22;mod.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=mod.name)
 print('DISTANT_FIR_POLYGONS',len(obj.data.polygons),flush=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/world/forest.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/world/forest.glb'),export_format='GLB',export_draco_mesh_compression_enable=True,
 export_draco_mesh_compression_level=6,export_image_format='JPEG',export_jpeg_quality=82,export_yup=True,export_cameras=False,export_lights=False)
