"""Reproducible Blender source for the woodland workshop. Run Blender -b -P this_file.
Geometry is authored in website X/right, Y/up, Z/back coordinates, converted to Blender.
No downloaded models/textures. Exported materials share meshes to keep draw calls bounded.
"""
import bpy, math, random, pathlib
import numpy as np
from mathutils import Vector
R=random.Random(731)
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models/world'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
materials={}; buckets={}
def mat(name, color, texture=False, emission=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=.86
 if emission:
  p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
 if texture:
  n=512; y,x=np.mgrid[0:n,0:n]; rng=np.random.default_rng(15)
  grain=.8+.10*np.sin(y*.7+np.sin(x*.03)*3)+.07*np.sin(y*2.1+x*.015)+rng.random((n,n))*.09
  if name in ['River stone','Garden soil']:
   grain=.72+rng.random((n,n))*.25+.09*np.sin(x*.21+np.sin(y*.17)*2)*np.sin(y*.19)
  img=bpy.data.images.new(name+' grain',width=n,height=n)
  pixels=np.ones((n,n,4),dtype=np.float32)
  for i,c in enumerate(color): pixels[:,:,i]=np.clip(c*grain,0,1)
  img.pixels.foreach_set(pixels.ravel()); img.pack()
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img;m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
 materials[name]=m; buckets[name]=[[],[],[],[]]
 return name
cedar=mat('Weathered cedar',(.38,.25,.145),True)
trim=mat('Oak joinery',(.21,.14,.085),True)
roof=mat('Slate roof',(.16,.20,.22),True)
stone=mat('River stone',(.30,.33,.31),True)
soil=mat('Garden soil',(.12,.095,.06),True)
leaf=mat('Leaves',(.19,.32,.14)); needle=mat('Fir needles',(.105,.22,.16))
bark=mat('Bark',(.20,.135,.09),True)
glass=mat('Lamplight',(.95,.58,.23),emission=1.2)
windowglass=mat('Window glass',(.37,.42,.38))
wp=materials[windowglass].node_tree.nodes.get('Principled BSDF');wp.inputs['Alpha'].default_value=.08;wp.inputs['Roughness'].default_value=.18
materials[windowglass].surface_render_method='DITHERED'
metal=mat('Iron',(.06,.065,.06)); paper=mat('Book pages',(.67,.58,.40))
flower=mat('Wildflowers',(.53,.46,.70))
# Authored leaf albedo: each blade has its own UVs, a midrib and branching veins.
n=256; yy,xx=np.mgrid[0:n,0:n]; u=xx/(n-1);v=yy/(n-1)
midrib=np.exp(-((u-.5)/.018)**2)
veins=np.exp(-(np.sin((v-np.abs(u-.5)*.58)*math.pi*12)/.16)**2)*.20
edge=1-.14*np.abs(u-.5)*2
light=(.84+.14*v+.13*midrib+veins)*edge
img=bpy.data.images.new('Leaf venation',width=n,height=n)
pixels=np.ones((n,n,4),dtype=np.float32)
for channel,c in enumerate((.19,.32,.14)):pixels[:,:,channel]=c*light
img.pixels.foreach_set(pixels.ravel());img.pack()
nodes=materials[leaf].node_tree;tex=nodes.nodes.new('ShaderNodeTexImage');tex.image=img
nodes.links.new(tex.outputs['Color'],nodes.nodes.get('Principled BSDF').inputs['Base Color'])
def mesh(m,vs,fs,smooth=False,uvs=None):
 v,f,s,uv=buckets[m]; off=len(v);v.extend(vs);f.extend([tuple(off+i for i in face) for face in fs]);s.extend([smooth]*len(fs));uv.extend(uvs if uvs is not None else [None]*len(vs))
def box(m,c,d,ry=0):
 vs=[]
 for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
  x*=d[0]/2;y*=d[1]/2;z*=d[2]/2
  vs.append((c[0]+x*math.cos(ry)+z*math.sin(ry),c[1]+y,c[2]-x*math.sin(ry)+z*math.cos(ry)))
 mesh(m,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)])
def branch(m,a,b,r1,r2,n=10):
 a,b=Vector(a),Vector(b);axis=(b-a).normalized();u=axis.cross(Vector((0,1,0)))
 if u.length<.01:u=axis.cross(Vector((1,0,0)))
 u.normalize();w=axis.cross(u);vs=[]
 for p,r in [(a,r1),(b,r2)]:
  for i in range(n):vs.append(tuple(p+r*(u*math.cos(i*math.tau/n)+w*math.sin(i*math.tau/n))))
 fs=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh(m,vs,fs,True)
def pebble(c,d):
 vs=[];n=12;k=8
 for j in range(k+1):
  t=math.pi*j/k
  for i in range(n):
   a=i*math.tau/n;q=1+.09*math.sin(a*3+t*7)
   vs.append((c[0]+d[0]*math.sin(t)*math.cos(a)*q,c[1]+d[1]*math.cos(t),c[2]+d[2]*math.sin(t)*math.sin(a)*q))
 mesh(stone,vs,[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(k) for i in range(n)],True)
def blade(m,base,angle,length,width,rise,steps=9):
 x,y,z=base;u=Vector((math.cos(angle),0,math.sin(angle)));v=Vector((-math.sin(angle),0,math.cos(angle)));p=Vector(base)
 if m==needle:
  vs=[p,p+u*length*.45+v*width+Vector((0,rise*.7,0)),p+u*length+Vector((0,rise,0)),p+u*length*.45-v*width+Vector((0,rise*.7,0)),p+u*length*.5+Vector((0,rise*.8+.025,0))]
  mesh(m,[tuple(q) for q in vs],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],True)
 else:
  vs=[];fs=[];uvs=[]
  for i in range(steps+1):
   t=i/steps;w=width*math.sin(math.pi*t)**.8
   center=p+u*(length*t)+Vector((0,rise*t+math.sin(t*math.pi)*.07,0))
   vs.extend([tuple(center-v*w),tuple(center+Vector((0,w*.18,0))),tuple(center+v*w)])
   uvs.extend([(0,t),(.5,t),(1,t)])
  for i in range(steps):
   k=i*3;fs.extend([(k,k+3,k+4,k+1),(k+1,k+4,k+5,k+2)])
  mesh(m,vs,fs,True,uvs)

# Cabin: 7 x 5.6 m, front toward +Z, placed at -16.
Z=-16
box(stone,(0,.18,Z),(7.3,.36,5.9))
# Separate overlapping siding boards, with an actual doorway opening.
def spans(start,end,holes):
 result=[(start,end)]
 for low,high in holes:
  next=[]
  for a,b in result:
   if low>=b or high<=a:next.append((a,b));continue
   if a<low:next.append((a,low))
   if b>high:next.append((high,b))
  result=next
 return result
for row in range(14):
 y=.48+row*.20
 holes=([(.2,1.7)] if row<11 else [])+([(-2.55,-1.15)] if 1.2<y<2.6 else [])
 for a,b in spans(-3.5,3.5,holes):box(cedar,((a+b)/2,y,Z+2.8),(b-a,.215,.16))
 box(cedar,(0,y,Z-2.8),(7,.215,.16));box(cedar,(-3.5,y,Z),(.16,.215,5.6))
 sideholes=[(Z-.35,Z+.95),(Z-2.15,Z-.85)] if 1.2<y<2.6 else []
 for a,b in spans(Z-2.8,Z+2.8,sideholes):box(cedar,(3.5,y,(a+b)/2),(.16,.215,b-a))
for x in [-3.52,3.52]:
 for z in [Z-2.82,Z+2.82]:box(trim,(x,1.7,z),(.18,2.8,.18))
# Pitched roof, individually staggered shingles; closed gables.
for z in [Z-2.83,Z+2.83]:mesh(cedar,[(-3.5,3.18,z),(3.5,3.18,z),(0,5.1,z)],[(0,1,2)])
for side in [-1,1]:
 for row in range(10):
  a=row/10;b=(row+1.18)/10
  for col in range(17):
   z=Z-3.2+col*.4+(row%2)*.12
   vs=[(side*a*3.95,5.2-a*2.12,z),(side*b*3.95,5.2-b*2.12,z),(side*b*3.95,5.2-b*2.12,z+.405),(side*a*3.95,5.2-a*2.12,z+.405)]
   mesh(roof,vs,[(0,1,2,3)])
branch(trim,(0,5.2,Z-3.3),(0,5.2,Z+3.6),.09,.09,12)
# Door, warm panels, deep window frames with sill and crossbars.
box(trim,(.95,1.48,Z+2.89),(1.4,2.15,.16))
for y in [.85,1.85]:box(cedar,(.95,y,Z+2.99),(1.13,.8,.055))
branch(metal,(1.42,1.45,Z+3.04),(1.42,1.45,Z+3.14),.05,.05)
for x,z,rot in [(-1.85,Z+2.96,0),(3.61,Z+.3,math.pi/2),(3.61,Z-1.5,math.pi/2)]:
 box(windowglass,(x,1.95,z),(1.3,1.25,.012),rot)
 for dx in [-.72,0,.72]:box(trim,(x+dx*math.cos(rot),1.95,z-dx*math.sin(rot)),(.085,1.4,.15),rot)
 for dy in [-.7,0,.7]:box(trim,(x,1.95+dy,z),(1.52,.09,.18),rot)
box(trim,(-1.85,1.22,Z+3.0),(1.62,.16,.32))
box(trim,(-1.85,2.65,Z+2.96),(1.62,.18,.18))
# A real room behind the window: visible tabletop, notebooks and shelving.
box(cedar,(0,.42,Z),(6.8,.12,5.4))
box(cedar,(-1.8,1.22,Z+1.65),(2.2,.10,.85))
for x in [-2.65,-.95]:
 for z in [Z+1.3,Z+1.98]:box(trim,(x,.84,z),(.07,.75,.07))
for j in range(4):box(paper,(-2.2+j*.10,1.3+j*.012,Z+1.65),(.35,.025,.27),.12)
for y in [1.0,1.65,2.3]:box(cedar,(-1.7,y,Z+.25),(2.5,.07,.38))
for j in range(15):
 h=R.uniform(.18,.35);box(trim if j%3 else paper,(-2.65+j*.135,1.7+h/2,Z+.25),(.10,h,.21))
box(glass,(-1.4,2.05,Z+2.05),(.09,.18,.09))
branch(metal,(-1.4,1.3,Z+2.05),(-1.4,1.98,Z+2.05),.018,.012)
# Porch boards, stair treads, posts and bench.
for i in range(30):box(cedar,(-3.48+i*.24,.38,Z+3.62),(.23,.14,1.65))
for y,z,w in [(.11,Z+5,2.6),(.23,Z+4.65,2.3)]:box(stone,(.9,y,z),(w,.22,.45))
for x in [-3.1,3.1]:
 box(trim,(x,1.8,Z+4.2),(.15,2.8,.15));branch(trim,(x,2.3,Z+4.2),(x*.76,3.13,Z+4.2),.065,.065)
box(trim,(0,3.18,Z+4.2),(6.4,.18,.18))
# Small porch overhang.
box(roof,(0,3.26,Z+3.75),(7.8,.12,1.3))
box(cedar,(-2, .83,Z+3.8),(1.6,.12,.5));box(cedar,(-2,1.2,Z+3.52),(1.6,.65,.08))
for x in [-2.6,-1.4]:box(trim,(x,.58,Z+3.8),(.12,.45,.45))
# Chimney masonry.
for row in range(9):
 for col in range(2):box(stone,(-2.0+col*.35,3.35+row*.23,Z-.7),(.34,.22,.68))
# Lanterns: restrained glass in metal cages.
def lantern(x,y,z):
 box(glass,(x,y,z),(.15,.25,.15))
 for dy in [-.16,.16]:box(metal,(x,y+dy,z),(.24,.045,.24))
 for dx in [-.095,.095]:
  for dz in [-.095,.095]:box(metal,(x+dx,y,z+dz),(.02,.3,.02))
lantern(1.95,2.3,Z+3.06)
# Fire at (-1, -5), safe open front courtyard, seating and a book.
FX,FZ=-1,-5
for i in range(6):
 a=i*1.7;branch(bark,(FX+math.cos(a)*.78,.24,FZ+math.sin(a)*.78),(FX-math.cos(a)*.78,.35,FZ-math.sin(a)*.78),.13,.16,14)
for cx,cz,rot in [(-3.5,-4.5,-.3),(2.5,-6.8,-.7)]:
 box(cedar,(cx,.58,cz),(1.7,.13,.45),rot)
 for dx in [-.6,.6]:box(trim,(cx+dx*math.cos(rot),.29,cz-dx*math.sin(rot)),(.17,.55,.35),rot)
box(trim,(-3.45,.68,-4.5),(.45,.06,.32),-.3);box(paper,(-3.45,.72,-4.5),(.40,.035,.29),-.3)
# Garden behind and to the right: distinct seedlings, herbs, established small tree.
for row in range(3):
 cx,cz=5.6,-20.8-row*2.2
 box(soil,(cx,.25,cz),(2.2,.45,1.5))
 for dx in [-1.16,1.16]:box(cedar,(cx+dx,.28,cz),(.12,.5,1.75))
 for dz in [-.83,.83]:box(cedar,(cx,.28,cz+dz),(2.4,.5,.12))
 for i in range(12):
  if R.random()<.12:continue
  x=cx-.85+(i%4)*.56+R.uniform(-.11,.11);z=cz-.5+(i//4)*.5+R.uniform(-.08,.08)
  h=(.22+row*.16)*R.uniform(.65,1.35);lean=R.uniform(-.08,.08)
  branch(leaf,(x,.46,z),(x+lean,.5+h,z),.012,.004,6)
  for j in range(4+row*2):
   t=(j+1)/(5+row*2);size=h*(.85-t*.35)*R.uniform(.8,1.2)
   blade(leaf,(x+lean*t,.5+h*t,z),j*2.399+R.uniform(-.3,.3),size,.045+row*.018,size*R.uniform(-.15,.35))
  if row==1 and i%3==0:
   for j in range(5):blade(flower,(x+lean,.5+h,z),j*math.tau/5,.085,.035,.025,5)
# Arbor is a visible invitation along the side of the house.
for x in [4.2,7.8]:box(trim,(x,1.35,-19.8),(.13,2.7,.13))
for z in [-19.45,-20.1]:box(trim,(6,2.73,z),(4.1,.13,.11))
for x in [4.4,5.1,5.8,6.5,7.2,7.8]:box(trim,(x,2.83,-19.8),(.075,.09,1.2))
# Forest trees now come from the prepared CC0 cold-climate tree collection.
# Ground-cover ferns are now prepared separately from CC0 photographic sources.
# Shift the separate cabin/garden structures 8m west, keeping the campfire in the clearing.
# Material buckets export as a small number of draw calls, with real UVs and bevels.
for name,(vs,fs,smooth,custom_uv) in buckets.items():
 if not vs:continue
 me=bpy.data.meshes.new(name);me.from_pydata([(x-8 if z < -10.3 else x,-z,y) for x,y,z in vs],[],fs);me.update()
 ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(materials[name])
 uv=me.uv_layers.new(name='Grain UV')
 for poly,sm in zip(me.polygons,smooth):
  poly.use_smooth=sm
  normal=poly.normal;dominant=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=dominant]
  for li in poly.loop_indices:
   vi=me.loops[li].vertex_index;co=me.vertices[vi].co
   uv.data[li].uv=custom_uv[vi] if custom_uv[vi] is not None else (co[axes[0]]*.32,co[axes[1]]*.32)
 if name in [cedar,trim,metal]:
  bpy.context.view_layer.objects.active=ob
  mod=ob.modifiers.new('Soft worked edges','BEVEL');mod.width=.012;mod.segments=2
  bpy.ops.object.modifier_apply(modifier=mod.name)
 if name in [leaf,needle,flower]:materials[name].use_backface_culling=False
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/world/woodland.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'woodland.glb'),export_format='GLB',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
print('WORLD_ASSET_COMPLETE',len(bpy.data.objects),'objects',sum(len(o.data.polygons) for o in bpy.data.objects if o.type=='MESH'),'polygons')
