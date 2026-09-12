"""Prepare downloaded CC0 undergrowth. Blender -b -P this_file -- SOURCE_DIRECTORY.
SOURCES.md records licenses; runtime export never needs the original downloads.
"""
import bpy,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
src=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else Path('/private/tmp/forest-sources')
bpy.ops.wm.read_factory_settings(use_empty=True)
for name in ['grass_medium_01','fern_02']:
 with bpy.data.libraries.load(str(src/name/(name+'.blend')),link=False) as (available,loaded):
  loaded.objects=[n for n in available.objects if n in ['grass_medium_01_small_b_LOD2','grass_medium_01_mid_b_LOD2','grass_medium_01_large_a_LOD2'] or n.startswith('fern_02_')]
 for obj in loaded.objects:
  bpy.context.collection.objects.link(obj);obj.location=(0,0,0);obj.hide_set(False);obj.hide_render=False
 m=bpy.data.materials[name];m.use_nodes=True;nodes=m.node_tree.nodes;nodes.clear();links=m.node_tree.links
 output=nodes.new('ShaderNodeOutputMaterial');bsdf=nodes.new('ShaderNodeBsdfPrincipled');links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
 for suffix,socket in [('diff','Base Color'),('nor_gl','Normal'),('rough','Roughness'),('alpha','Alpha')]:
  path=next((src/name/'textures').glob(f'{name}_{suffix}_1k.*'))
  img=bpy.data.images.load(str(path),check_existing=True)
  if suffix!='diff':img.colorspace_settings.name='Non-Color'
  img.pack();tex=nodes.new('ShaderNodeTexImage');tex.image=img
  if suffix=='nor_gl':
   normal=nodes.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
  else:links.new(tex.outputs['Color'],bsdf.inputs[socket])
 m.surface_render_method='DITHERED';m.use_backface_culling=False
bpy.ops.outliner.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/world/understory.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/world/understory.glb'),export_format='GLB',
 export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
 export_image_format='JPEG',export_jpeg_quality=82,export_yup=True,export_cameras=False,export_lights=False)
