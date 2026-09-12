"""Editable 3D alpine ridges. Blender 5.x, deterministic geometry, no backdrop images."""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector, noise
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def height(x,z,layer):
 ridge_z=[-360,-830,-1270][layer]+math.sin(x*.005+layer)*[35,100,90][layer]+math.sin(x*.017)*[10,25,40][layer]
 width=[95,245,260][layer]
 envelope=math.exp(-((z-ridge_z)/width)**2)
 summits=[35,120,160][layer]
 peaks=[(-480,110),(-160,160),(240,210),(630,130),(1000,100)]
 if layer:
  summits+=sum(h*math.exp(-((x-c-layer*65)/[85,125][layer-1])**2) for c,h in peaks)*[0,.55,.68][layer]
 folded=noise.ridged_multi_fractal(Vector((x*.007+layer*14,z*.009,2.3+layer)),1.0,2.1,4,1.0,2.0)
 erosion=noise.ridged_multi_fractal(Vector((x*.017,z*.018+layer*27,8.1)),1.1,2.2,2,1.0,2.0)
 h=envelope*summits*(.42+folded*.36)
 h+=envelope*(erosion-.65)*[2,7,9][layer]
 return max(-.6,h-.6)*.55
material=bpy.data.materials.new('Alpine stone and snow');material.use_nodes=True
bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.19,.21,.23,1);bsdf.inputs['Roughness'].default_value=.94
for layer,(nx,nz,x0,x1,z0,z1) in enumerate([(257,81,-1050,1150,-550,-170),(385,161,-1450,1450,-1130,-430),(257,113,-1800,1800,-1600,-900)]):
 vertices=[];faces=[]
 for j in range(nz):
  z=z0+(z1-z0)*j/(nz-1)
  for i in range(nx):
   x=x0+(x1-x0)*i/(nx-1)
   edge=smooth(0,.07,i/(nx-1))*(1-smooth(.93,1,i/(nx-1)))*smooth(0,.09,j/(nz-1))*(1-smooth(.91,1,j/(nz-1)))
   vertices.append((x,-z,height(x,z,layer)*edge))
 for j in range(nz-1):
  for i in range(nx-1):
   a=j*nx+i;faces.append((a,a+nx,a+nx+1,a+1))
 mesh=bpy.data.meshes.new(f'Ridge {layer}');mesh.from_pydata(vertices,[],faces);mesh.update()
 obj=bpy.data.objects.new(f'Alpine ridge {layer}',mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(material)
 for face in mesh.polygons:face.use_smooth=True
 uv=mesh.uv_layers.new(name='Rock scale')
 for loop in mesh.loops:
  co=mesh.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(co.x/16,co.y/16)
source=ROOT/'assets/world/mountains.blend';source.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/world/mountains.glb'),export_format='GLB',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_yup=True,export_cameras=False,export_lights=False)
rng=random.Random(281);trees=[]
for i in range(420):
 x=rng.uniform(-220,650);z=rng.uniform(-288,-260);y=height(x,z,0)
 trees.append([round(x,3),round(y,3),round(z,3),round(rng.uniform(1.05,1.5),3)])
(ROOT/'src/world/ridge-trees.ts').write_text('/** Shoreline fir placements, generated alongside the Blender foothills. */\nexport const ridgeTrees: [number,number,number,number][] = '+json.dumps(trees,separators=(',',':'))+';\n')
print('MOUNTAIN_MESHES',len(bpy.data.objects),'FACES',sum(len(o.data.polygons) for o in bpy.data.objects))
