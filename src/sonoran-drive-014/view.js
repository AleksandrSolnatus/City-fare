/* Sonoran Drive: view-owned fixed-lens chase camera and Canvas sky with a world-anchored WebGL2 depth surface.
   Geometry is in metres. Actors and terrain share hardware depth; no object visibility exemption. */
(function(root){'use strict';
const GPU=typeof module!=='undefined'?require('./gpu.js'):root.SDGPU;
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
const noise=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
// World-space visual detail only. Neither these features nor their LOD alter geology.
const SUN={x:.912,y:.267,z:.31};
function triangleNormal(a,b,c){const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(n[2]<0)n=n.map(v=>-v);const l=Math.hypot(...n)||1;return {x:n[0]/l,y:n[1]/l,z:n[2]/l};}
function surfaceColor(meta,n,distance=0){
 const material=meta.substrate||'sand',salt=meta.overlay==='salt_crust';
 const albedo=salt?[224,210,174]:material==='bedrock'?[111,100,91]:material==='gravel'?[157,136,111]:material==='hardpan'?[191,171,136]:[215,165,104];
 const light=.61+.84*Math.max(0,n.x*SUN.x+n.y*SUN.y+n.z*SUN.z),cool=clamp((.28-(n.x*SUN.x+n.y*SUN.y+n.z*SUN.z))*.33,0,.18);
 return `rgb(${albedo.map((v,i)=>Math.round(clamp(v*light+(i===2?36:i===0?-22:0)*cool,0,255))).join(',')})`;
}
function detailCell(ix,iy,meta,wind={x:.93,y:.37}){
 const size=12,x=(ix+.5)*size,y=(iy+.5)*size,jitter=(noise(ix,iy)-.5)*2,features=[],line=(points,width,color)=>features.push({points,width,color});
 if(meta.substrate==='sand'){
  for(let k=0;k<3;k++){const u=(k-1)*3.7+jitter,v=(noise(ix+k,iy+9)-.5)*3,pts=[];for(let q=0;q<5;q++){const t=(q-2)*2.2,curve=.5*Math.cos(q*.9+noise(ix,iy)*TAU);pts.push([x+wind.x*(u+curve)-wind.y*(t+v),y+wind.y*(u+curve)+wind.x*(t+v)]);}line(pts,.085,'#87683f');}
 }else if(meta.substrate==='hardpan'){
  if(meta.overlay==='salt_crust'||noise(ix,iy)>.67){
   // Shared perturbed lattice corners keep adjoining crust cells connected.
   const corner=(a,b)=>[a*size+(noise(a,b)-.5)*4,b*size+(noise(a+31,b+17)-.5)*4],a=corner(ix,iy),b=corner(ix+1,iy),c=corner(ix+1,iy+1),d=corner(ix,iy+1);
   line([a,b,c],.11,'#9c8b70');line([a,d],.11,'#9c8b70');if(noise(ix,iy+12)>.65)line([a,[x+jitter,y-jitter],c],.07,'#ac9878');
  }
 }else if(meta.substrate==='gravel'){
  for(let k=0;k<5;k++){const px=x+(noise(ix*7+k,iy)-.5)*11,py=y+(noise(ix,iy*7+k)-.5)*11,r=.15+noise(ix+k,iy-k)*.38;line([[px-r,py],[px,py-r*.7],[px+r,py+.15]],r*.7,k%2?'#766956':'#b9a080');}
 }else if(meta.substrate==='bedrock'){
  const a=(noise(ix,iy)-.5)*3;line([[x-6,y+a],[x-2,y+a+1.3],[x+2,y+a+.6],[x+6,y+a+2]],.18,'#4d4944');if(noise(ix+5,iy)>.3)line([[x-2,y+a+1.3],[x-.4,y+6]],.14,'#60564a');
 }
 return features;
}
// Geometry-independent map detail is immutable for one authored world. Cache
// only its XY/layout/material; every displayed height still samples live sand.
const surfaceLayouts=new WeakMap();
function surfaceLayout(world){
 let c=surfaceLayouts.get(world);if(c)return c;
 c={detail:new Map(),roads:[]};surfaceLayouts.set(world,c);
 const staticWorld=world.baseHeight?{baseHeight:world.baseHeight.bind(world)}:null;
 const metadata=(x,y)=>world.metadata?world.metadata(x,y):{substrate:world.material(x,y)==='rock'?'bedrock':'sand',roadExposure:1};
 for(const road of world.roads||[])for(let k=1;k<road.length;k++){
  const a=road[k-1],b=road[k],len=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.ceil(len/12),nx=-(b.y-a.y)/len*(world.roadWidth||28)/2,ny=(b.x-a.x)/len*(world.roadWidth||28)/2;
  for(let j=0;j<steps;j++){
   const u=j/steps,t=(j+1)/steps,x=mix(a.x,b.x,u),y=mix(a.y,b.y,u),xx=mix(a.x,b.x,t),yy=mix(a.y,b.y,t),mx=(x+xx)/2,my=(y+yy)/2,m=metadata(mx,my),exposure=m.roadExposure??1;
   if(exposure<.04||(j+k*3)%17===0)continue;const width=clamp(exposure,0,1),raw=[[x+nx*width,y+ny*width],[x-nx*width,y-ny*width],[xx-nx*width,yy-ny*width],[xx+nx*width,yy+ny*width]];
   const center=[mx,my,0],corners=raw.map(([x,y])=>[x,y,0]);
   const base=staticWorld?[center,...corners].map(([x,y])=>[x,y,GPU.meshSample(staticWorld,x,y)]):null,z=base?base[0][2]:0;
   const bound=base?{x:mx,y:my,z,radius:Math.max(...base.map(p=>Math.hypot(p[0]-mx,p[1]-my,p[2]-z)))+.04}:null;
   c.roads.push({x:mx,y:my,bound,exposure,color:m.roadCondition==='washed'?'#96806a':m.substrate==='bedrock'?'#70685f':'#a08c72',center,corners,faces:corners.map((p,q)=>[center,p,corners[(q+1)%4]])});
  }
 }return c;
}
function cachedDetail(world,layout,a,b,metadata){
 const key=a+','+b;let cell=layout.detail.get(key);if(cell)return cell;
 const meta=metadata((a+.5)*12,(b+.5)*12);
 cell={road:meta.overlay==='road'&&(meta.roadExposure??1)>.6,features:detailCell(a,b,meta,world.wind)};
 // Finite nearby-layout working set; revisiting an evicted cell reconstructs
// exactly the same pattern. This cache owns no terrain or physical material.
 if(layout.detail.size>=2048)layout.detail.delete(layout.detail.keys().next().value);
 layout.detail.set(key,cell);return cell;
}
const Geometry=typeof module!=='undefined'?require('./geometry.js'):root.SDGeometry;
const {headMesh}=Geometry;
const Arrival=typeof module!=='undefined'?require('./arrival.js'):root.SDArrival;
// Keep the 006 chase integrator independent. Arrival is only a view transform:
// a real standing eye, then one finite raised arc to the existing chase endpoint.
function arrivalCamera(chase,arrival,world){return Arrival.cameraPose(chase,arrival,world);}
// All structural solids come directly from the walking collision contract.
function receivingGeometry(world){return Arrival.facilities(world);}
// A single cosmetic dust ribbon can disclose shallow buried motion. It is not
// excavation or displaced volume: no world writes, no new actor, no encounter cue.
function subsurfaceClue(game,animal=game.worm){
 const w=game.world,head=animal?.sections?.[0],previous=animal?.previousSections?.[0];if(!head||!previous)return null;
 const dx=head.x-previous.x,dy=head.y-previous.y,moved=Math.hypot(dx,dy),depth=w.terrain.height(head.x,head.y)-(head.z+head.r),meta=w.metadata?.(head.x,head.y);
 if(moved<.005||depth<=1||depth>=14||meta?.substrate==='bedrock'||(!meta&&w.material?.(head.x,head.y)==='rock'))return null;
 const pulse=Math.max(0,Math.sin((game.time||0)*.22))**2,alpha=.18*clamp((14-depth)/8,0,1)*clamp(moved/.15,0,1)*pulse;if(alpha<.008)return null;
 const fx=dx/moved,fy=dy/moved,rx=-fy,ry=fx,at=(f,r,h)=>{const x=head.x+fx*f+rx*r,y=head.y+fy*f+ry*r;return [x,y,GPU.meshSample(w,x,y)+h];};
 return {raw:[at(-18,-1,.08),at(-7,-2,.14),at(8,-.6,.08),at(4,1,.35),at(-6,1.2,.7),at(-15,1,.3)],alpha,depth,source:[head.x,head.y,head.z],label:'cosmetic dust over actual shallow buried moving head; no displaced volume'};
}

// The legs telescope as the actual hull descends; their pads meet the same
// rendered ground as the visitor. No separate cosmetic lift offsets the craft.
function landingSupports(game){
 const c=game.car,w=game.world,centerFloor=w.terrain.height(c.x,c.y),clearance=c.z-centerFloor,restClearance=clamp(typeof game.parkingClearance==='function'?game.parkingClearance():(c.parkClearance||.9),.9,2.1),deployment=clamp((2.5-clearance)/Math.max(.4,2.5-restClearance),0,1),out=[];if(deployment<.025)return out;
 const cs=Math.cos(c.yaw),sn=Math.sin(c.yaw);
 for(const f of[-2.1,2.0])for(const r of[-1.35,1.35]){const x=c.x+f*cs-r*sn,y=c.y+f*sn+r*cs,top=c.z-.46,floor=GPU.meshSample(w,x,y)+.025,restTop=centerFloor+restClearance-.46,extension=Math.max(0,restTop-floor)*deployment,bottom=Math.max(floor,top-extension);if(top>bottom)out.push({x,y,top,bottom,deployment,ground:floor,yaw:c.yaw});}return out;
}
// Tiny temporary scuffs disclose individual contact, not an expanding terrain
// wave. They are cosmetic marks tied to one observed footfall, with no sand ledger.
function footfallMark(game){
 const s=game.footContact?.lastStep;if(!s||s.surface!=='sand')return null;const age=game.time-s.time;if(age<0||age>2.2)return null;
 const yaw=Number.isFinite(s.yaw)?s.yaw:0,cs=Math.cos(yaw),sn=Math.sin(yaw),at=(f,r)=>{const x=s.x+f*cs-r*sn,y=s.y+f*sn+r*cs;return [x,y,GPU.meshSample(game.world,x,y)+.027];};
 return {raw:[at(-.16,-.075),at(.17,-.06),at(.2,.05),at(-.13,.085)],alpha:.26*(1-age/2.2),id:s.id,source:[s.x,s.y],label:'temporary cosmetic foot scuff; no displaced volume'};
}

// Cosmetic look is applied to the resolved eye, never the chase integrator.
function driveLook(cam,arrival,look){
 if(arrival&&arrival.mode!=='drive'||!look)return cam;
 return {...cam,yaw:cam.yaw+clamp(Number.isFinite(look.yaw)?look.yaw:0,-Math.PI,Math.PI),pitch:clamp(cam.pitch+(Number.isFinite(look.pitch)?look.pitch:0),-.8,80*Math.PI/180)};
}
// Both creatures use the same restrained, two-sided low-sun material response.
function actorColor(face){const n=triangleNormal(...face.vertices.slice(0,3)),sun=Math.max(0,n.x*SUN.x+n.y*SUN.y+n.z*SUN.z),light=.82+.3*sun;return 'rgb('+GPU.parseColor(face.color).map(v=>Math.round(clamp(v*255*light,0,255))).join(',')+')';}
//012: colour only, evaluated on the exact shared contact faces. No time-driven glow.
// Broad mineral variation and a restrained grazing reflection respond to actual sun/view.
// Two mineral colour families; sun/view angles reveal solar-tissue structural colour.
// This is an authored optical approximation, not a photosynthetic energy model.
function wormColor(face,index,eye,palette='copper'){
 const n=triangleNormal(...face.vertices.slice(0,3)),rgb=GPU.parseColor(face.color),sage=palette==='sage';
 const ivory=face.finish==='ivory'||['ivory','ivory-lip','brow','nose-cap','frill-rib'].includes(face.label);
 const mineral=face.finish==='mineral'||['crown-mark','mineral-inset','mineral-band'].includes(face.label);
 const shell=!ivory&&!mineral&&['armour','crown','rear-cap','tail-cap'].includes(face.label);
 const center=face.vertices[0].map((_,k)=>face.vertices.reduce((sum,v)=>sum+v[k],0)/face.vertices.length);
 const toEye=[eye.x-center[0],eye.y-center[1],eye.z-center[2]],distance=Math.hypot(...toEye)||1;
 const viewCos=Math.abs((n.x*toEye[0]+n.y*toEye[1]+n.z*toEye[2])/distance),sunCos=n.x*SUN.x+n.y*SUN.y+n.z*SUN.z;
 let base=rgb;
 if(shell){const band=.5+.5*Math.sin(index*.71+.4),tint=sage?[.70,1.00,.91]:[.99,.76,.64];base=rgb.map((c,k)=>c*tint[k]+(sage?[.01,.025,.018]:[.022,.013,.006])[k]*band);}
 else if(ivory)base=sage?[.72,.75,.63]:[.82,.71,.51];
 else if(mineral)base=sage?[.34,.51,.47]:[.59,.37,.20];
 else if(['mouth-seam','sensory-seam'].includes(face.label))base=[.035,.065,.075];
 else if(face.label==='solar-frill'){
  const shift=clamp((1-viewCos)*.88+(1-Math.abs(sunCos))*.12,0,1),stops=sage?[[.24,.50,.43],[.52,.61,.36],[.33,.43,.61]]:[[.66,.37,.17],[.52,.32,.43],[.22,.56,.53]];
  const q=shift*2,k=Math.min(1,Math.floor(q)),u=q-k,t=u*u*(3-2*u),vein=.94+.06*Math.sin(index*.53);
  base=stops[k].map((v,i)=>mix(v,stops[k+1][i],t)*vein);
 }
 const half=[SUN.x+toEye[0]/distance,SUN.y+toEye[1]/distance,SUN.z+toEye[2]/distance],hl=Math.hypot(...half)||1;
 const solar=face.label==='solar-frill',sun=Math.max(0,sunCos),shine=Math.pow(Math.max(0,(n.x*half[0]+n.y*half[1]+n.z*half[2])/hl),solar?9:shell?14:22)*(solar?.21:shell?.16:ivory?.07:.025)*sun;
 const light=solar?.64+.48*Math.abs(sunCos):.72+.48*sun;
 return 'rgb('+base.map((c,k)=>Math.round(clamp(c*light+shine*[1,.79,.48][k],0,1)*255)).join(',')+')';
}
// Texture coordinates follow the actual rigid section frame, never the camera.
function actorMaterialCoords(vertices,origin,yaw=0,pitch=0){const cs=Math.cos(yaw),sn=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);return vertices.map(v=>{const x=(v[0]-origin.x)*cs+(v[1]-origin.y)*sn,y=-(v[0]-origin.x)*sn+(v[1]-origin.y)*cs,z=v[2]-origin.z;return [x*cp+z*sp,y,-x*sp+z*cp]});}
function mountainMesh(){const faces=[];
 for(const band of[{r:11300,z:1350,color:'#807988'},{r:8200,z:1080,color:'#756e7a'},{r:6100,z:760,color:'#6d6870'}])for(let i=0;i<90;i++){
  const a=i*TAU/90,b=(i+1)*TAU/90,peak=k=>band.z*(.38+.34*noise(k,8)+.28*noise(k,19)),v=(t,z,r=band.r)=>[Math.cos(t)*r,Math.sin(t)*r,z];
  const base=GPU.parseColor(band.color),warm=GPU.parseColor('#b0937b'),color='rgb('+base.map((c,k)=>Math.round(mix(c,warm[k],.12)*255)).join(',')+')';
  // Partition the wall at the sun facet. No coplanar overlays, depth bias or
  // mountain z-fighting, even with a walking eye's small near plane.
  const ab=v(a,-60),at=v(a,peak(i)),bt=v(b,peak((i+1)%90)),bb=v(b,-60),t=1-.006/(TAU/90),mid=[mix(ab[0],bb[0],t),mix(ab[1],bb[1],t),80];
  for(const raw of [[ab,at,mid],[ab,mid,bb],[mid,bt,bb]])faces.push({raw,color:band.color});
  faces.push({raw:[at,bt,mid],color});
 }return faces;
}
const MOUNTAINS=mountainMesh();
// Six short peripheral wind traces: no blur, shake, lens change or central mask.
function speedStreaks(game,opt,arrival){
 if(!opt.speedEffects||opt.reduced||arrival&&arrival.mode!=='drive')return [];
 const strength=clamp((Math.abs(game.car.speed||0)-28)/70,0,1);if(!strength)return [];
 const W=opt.W,H=opt.H,time=game.time||0,out=[];
 for(const side of[-1,1])for(let k=0;k<3;k++){
  const phase=(time*.52+k*.317)%1,y=H*(.52+k*.135),x=W*(side<0?.025:.975),length=W*(.012+.024*strength)*(.5+.5*phase);
  out.push({x1:x,y1:y,x2:x+side*length,y2:y+H*.008*phase,alpha:.035+.075*strength,width:.7+.5*strength});
 }return out;
}

class View{
 constructor(canvas,ctx){this.canvas=canvas;this.ctx=ctx;this.reset();}
 reset(){this.camera=null;this.flightBlend=0;this.metrics={};}
 prepare(game){if(typeof document!=='undefined'){if(!this.gpu)this.gpu=new GPU.SurfaceGPU();if(this.gpu.world!==game.world)this.gpu.build(game.world);}}
 frame(game,opt){
  const arrival=typeof opt.arrival?.camera==='function'?opt.arrival.camera():opt.arrival;
  const fixedChase=arrival?.chase&&['entering','exiting'].includes(arrival.mode);
  const c=game.car,w=game.world,H=opt.H,W=opt.W,dt=fixedChase?0:clamp(opt.dt||0,0,.1),portrait=W/H<.8;
  // A checked transition holds its actual chase endpoint, including heading lag.
  // Resuming the same integrator state avoids a snap when the handover finishes.
  if(fixedChase)this.camera={...arrival.chase};
  // Flight is an observation platform: ease the framing, retain independent free look.
  const flight=!!(c.flightAssist||c.flightLanding);this.flightBlend+=(Number(flight)-this.flightBlend)*(1-Math.exp(-dt/1.4));
  const back=mix(opt.wide?29:portrait?18:13,opt.wide?33:portrait?23:21,this.flightBlend),up=mix(opt.wide?12:portrait?8:6.5,opt.wide?10:portrait?7:5.2,this.flightBlend);
  // Translation, orbit heading and height have separate state. In particular,
  // the orbit uses the CAMERA heading, so a stationary pivot cannot pull the
  // sightline sideways or contract its radius while a second yaw filter catches up.
  const targetZ=c.z+up,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  if(!this.camera)this.camera={x:c.x-Math.cos(c.yaw)*back,y:c.y-Math.sin(c.yaw)*back,z:targetZ,yaw:c.yaw,anchorX:c.x,anchorY:c.y,verticalSpeed:0,yawSpeed:0};
  let cam=this.camera;const substeps=Math.max(1,Math.ceil(dt*60)),step=dt/substeps;
  let clearanceCorrection=0;
  for(let i=0;i<substeps&&!fixedChase;i++){
   const move=1-Math.exp(-step*7);
   cam.anchorX=mix(cam.anchorX,c.x,move);cam.anchorY=mix(cam.anchorY,c.y,move);
   const yawAcceleration=clamp(wrap(c.yaw-cam.yaw)*64-16*cam.yawSpeed,-8,8);
   cam.yawSpeed=clamp(cam.yawSpeed+yawAcceleration*step,-2.2,2.2);cam.yaw+=cam.yawSpeed*step;
   cam.x=cam.anchorX-Math.cos(cam.yaw)*back;cam.y=cam.anchorY-Math.sin(cam.yaw)*back;
   // Terrain velocity feedforward lets the height spring follow a climbing or
   // descending surface without waiting for position error to build into a clamp.
   const floor=w.terrain.height(cam.x,cam.y)+3;
   const vx=c.vx||0,vy=c.vy||0,look=.18;
   const groundRate=(w.terrain.height(cam.x+vx*look,cam.y+vy*look)-w.terrain.height(cam.x-vx*look,cam.y-vy*look))/(2*look);
   const desiredZ=Math.max(targetZ,floor+1),desiredVelocity=targetZ>=floor+1?(c.vz||0):groundRate;
   const acceleration=clamp((desiredZ-cam.z)*49+14*(desiredVelocity-cam.verticalSpeed),-45,45);
   cam.verticalSpeed=clamp(cam.verticalSpeed+acceleration*step,-60,60);cam.z+=cam.verticalSpeed*step;
   // Real terrain still wins over smoothing. Expose this exceptional safety
   // correction in metrics, never hide a camera below the surface.
   if(cam.z<floor){clearanceCorrection+=floor-cam.z;cam.z=floor;cam.verticalSpeed=Math.max(0,cam.verticalSpeed);}
  }
  cam=arrivalCamera(cam,arrival,w);if(!arrival||arrival.mode==='drive')cam.pitch=mix(cam.pitch,-.075,this.flightBlend);cam=driveLook(cam,arrival,opt.look);
  // Walking looks freely in pitch; the unmodified drive endpoint stays world-up.
  const pitch=cam.pitch,near=cam.near,cp=Math.cos(pitch),sp=Math.sin(pitch),cx=Math.cos(cam.yaw),sy=Math.sin(cam.yaw);
  const forward=[cx*cp,sy*cp,sp],right=[-sy,cx,0],vertical=[-cx*sp,-sy*sp,cp],focal=H/(2*Math.tan(Math.PI/6));
  const local=p=>{const a=[p[0]-cam.x,p[1]-cam.y,p[2]-cam.z];return [a[0]*right[0]+a[1]*right[1],a[0]*vertical[0]+a[1]*vertical[1]+a[2]*vertical[2],a[0]*forward[0]+a[1]*forward[1]+a[2]*forward[2]];};
  const screen=p=>({x:W*.5+p[0]*focal/p[2],y:H*.43-p[1]*focal/p[2],d:p[2]});
  const point=(x,y,z)=>{const p=local([x,y,z]);return p[2]>near?screen(p):null;};
  const poly=raw=>{const p=raw.map(local),out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(a[2]>=near)out.push(a);if((a[2]>=near)!==(b[2]>=near)){const t=(near-a[2])/(b[2]-a[2]);out.push(a.map((v,k)=>mix(v,b[k],t)));}}return out.map(screen);};
  this.metrics={flightCameraBlend:this.flightBlend,eye:[cam.x,cam.y,cam.z],cameraHeightAboveTerrainM:cam.z-w.terrain.height(cam.x,cam.y),verticalFovDeg:60,horizonPx:H*.43+focal*Math.tan(pitch),cameraYaw:cam.yaw,cameraPitch:pitch,cameraNearM:near,arrivalMode:arrival?.mode||'drive',driveBlend:arrival?.driveBlend??1,cameraYawSpeed:cam.yawSpeed,cameraVerticalSpeed:cam.verticalSpeed,cameraClearanceCorrectionM:clearanceCorrection,cameraAnchor:[cam.anchorX,cam.anchorY],rendererMutatesTerrain:false,physicsChanged:false,framingPreset:portrait?'portrait':'landscape',shipLengthM:7,groundClipViolations:0};
  return {point,poly,cam,focal,arrival};
 }
 render(game,opt){
  const started=typeof performance!=='undefined'?performance.now():Date.now();
  const {W,H}=opt,ctx=this.ctx,w=game.world,c=game.car,{point,poly,cam,focal,arrival}=this.frame(game,opt),ground=(x,y)=>GPU.meshSample(w,x,y),faces=[];
  ctx.setTransform(opt.DPR||1,0,0,opt.DPR||1,0,0);
  const horizon=this.metrics.horizonPx,sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#34445b');sky.addColorStop(.29,'#8c7e8b');sky.addColorStop(.49,'#efa36a');sky.addColorStop(1,'#ac7046');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  const sun=point(cam.x+SUN.x*7000,cam.y+SUN.y*7000,cam.z+SUN.z*7000);
  if(sun){const r=H*.025,g=ctx.createRadialGradient(sun.x,sun.y,0,sun.x,sun.y,r*7);g.addColorStop(0,'#ffba6770');g.addColorStop(1,'#ffae5300');ctx.fillStyle=g;ctx.fillRect(sun.x-r*7,sun.y-r*7,r*14,r*14);ctx.fillStyle='#ffa45b';ctx.beginPath();ctx.arc(sun.x,sun.y,r,0,TAU);ctx.fill();}
  const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
  const add=(raw,color,kind='world',alpha=1,material=0,materialCoords=null)=>{const p=poly(raw);if(p.length<3)return;if(kind==='ship')for(const a of p){bounds.left=Math.min(bounds.left,a.x);bounds.right=Math.max(bounds.right,a.x);bounds.top=Math.min(bounds.top,a.y);bounds.bottom=Math.max(bounds.bottom,a.y);}if(p.some(a=>!Number.isFinite(a.x+a.y+a.d)))throw Error('Non-finite projected geometry');if(Math.max(...p.map(a=>a.x))<0||Math.min(...p.map(a=>a.x))>W||Math.max(...p.map(a=>a.y))<0||Math.min(...p.map(a=>a.y))>H)return;faces.push({raw,p,color,kind,alpha,material,materialCoords,d:p.reduce((s,a)=>s+a.d,0)/p.length});};

  for(const f of MOUNTAINS)add(f.raw,f.color,'mountain');

  const fx=Math.cos(cam.yaw),fy=Math.sin(cam.yaw),rx=-fy,ry=fx;
  const metadata=(x,y)=>w.metadata?w.metadata(x,y):{substrate:w.material(x,y)==='rock'?'bedrock':'sand',overlay:w.material(x,y)==='road'?'road':'none',roadExposure:1};
  const tiles=1024*1024,layout=surfaceLayout(w);let detailFeatures=0,roadPatches=0;const materialTiles={};
  // Detail is generated from stable 12m world cells, then faded by distance.
  // It follows current sparse deformation at every point; no stale normal cache.
  if(opt.groundDetail!==false){const radius=opt.reduced?75:115,ix=Math.floor(cam.x/12),iy=Math.floor(cam.y/12),n=Math.ceil(radius/12);
   for(let a=ix-n;a<=ix+n;a++)for(let b=iy-n;b<=iy+n;b++){const x=(a+.5)*12,y=(b+.5)*12,dx=x-cam.x,dy=y-cam.y,d=Math.hypot(dx,dy),forward=dx*fx+dy*fy;if(d>radius||forward<-12)continue;
    const cell=cachedDetail(w,layout,a,b,metadata);if(cell.road)continue;const alpha=clamp((radius-d)/35,0,1)*.42;
    for(const f of cell.features){for(let j=1;j<f.points.length;j++){const p=f.points[j-1],q=f.points[j],len=Math.hypot(q[0]-p[0],q[1]-p[1])||1,nx=-(q[1]-p[1])/len*f.width,ny=(q[0]-p[0])/len*f.width;
      add([[p[0]+nx,p[1]+ny],[p[0]-nx,p[1]-ny],[q[0]-nx,q[1]-ny],[q[0]+nx,q[1]+ny]].map(([x,y])=>[x,y,ground(x,y)+.025]),f.color,'groundDetail',alpha);
     }detailFeatures++;}
   }
  }
  // Subdivided road overlay shares ground at its edges and centre. Dune deposit
  // controls burial, while selected deterministic segments remain washed/broken.
  let editPadding=0;for(const delta of w.edits?.values()||[])editPadding=Math.max(editPadding,Math.abs(delta));
  for(const p of layout.roads){
   if(!opt.noCull&&p.bound&&!GPU.chunkVisible(p.bound,cam,opt,editPadding))continue;
   const dx=p.x-cam.x,dy=p.y-cam.y;if(dx*fx+dy*fy<0||Math.hypot(dx,dy)>3300)continue;
   p.center[2]=ground(p.x,p.y)+.035;for(const q of p.corners)q[2]=ground(q[0],q[1])+.035;
   for(const raw of p.faces)add(raw,p.color,'groundOverlay',.78*p.exposure);roadPatches++;
  }
  const box=(x,y,z,dx,dy,h,colors,kind='world',yaw=0)=>{const cs=Math.cos(yaw),sn=Math.sin(yaw),p=[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*dx/2*cs-b*dy/2*sn,y+a*dx/2*sn+b*dy/2*cs,z+c*h]);for(const [ids,col] of [[[0,1,5,4],colors[0]],[[1,2,6,5],colors[1]],[[2,3,7,6],colors[1]],[[3,0,4,7],colors[0]],[[4,5,6,7],colors[2]]])add(ids.map(i=>p[i]),col,kind,1,['world','receiving'].includes(kind)?3:0,ids.map(i=>p[i]));};
  let landmarks=0;
  for(const s of Arrival.stationSolids(game)){box(s.x,s.y,s.z,s.length,s.width,s.height,s.colors,'world',s.yaw);if(s.landmark)landmarks++;}
  // A small wayside portal room. The threshold rests on the existing rock;
  // architecture and walking collision use the same compact structural boxes.
  let receivingSolids=0;
  if((game.places||[]).some(p=>p.id==='dock')){
   const layout=Arrival.ARRIVAL,cs=Math.cos(layout.yaw),sn=Math.sin(layout.yaw);
   const local=(f,r,h=0)=>{const x=layout.x+f*cs-r*sn,y=layout.y+f*sn+r*cs;return [x,y,ground(x,y)+h];};
   const slab=(f,r,length,width,color,alpha=1)=>add([[f-length/2,r-width/2],[f+length/2,r-width/2],[f+length/2,r+width/2],[f-length/2,r+width/2]].map(([f,r])=>local(f,r,.03)),color,'groundOverlay',alpha);
   const solids=receivingGeometry(w),rear=solids.find(s=>s.id==='rear-wall'),roof=solids.find(s=>s.id==='roof'),console=solids.find(s=>s.id==='receiving-console'),lantern=solids.find(s=>s.id==='lantern'),front=solids.find(s=>s.id==='front-left');
   // Only the little room and doorstep are surfaced. No runway or parking grid.
   if(roof)slab(roof.f,roof.r,roof.length-.7,roof.width-1.1,'#b5ad92',.78);
   if(front){slab(front.f+.6,0,1.4,5.2,'#b5ad92',.78);for(const r of[-2.5,2.5])slab(front.f+.6,r,1.35,.09,'#d5cfaf',.9);}
   // A thin broken green line leads out of the portal, not across the desert.
   if(rear)for(const offset of[1.9,3,4.1])slab(rear.f+offset,rear.r-1.25,.48,.065,'#7ca68b',.7);
   const palette={roof:['#7b8173','#58695e','#bdbaa1'],bench:['#a29379','#726e60','#c7b897'],'receiving-console':['#6d8074','#415c51','#b7bc9c'],lantern:['#66786b','#42594f','#a9b89d']};
   for(const solid of solids){const colors=palette[solid.id]||['#b6ab8e','#847e6b','#d7ceb0'];box(solid.x,solid.y,solid.z,solid.length,solid.width,solid.height,colors,'receiving',solid.yaw);receivingSolids++;}
   if(roof){const underside=[[-roof.length/2,-roof.width/2],[roof.length/2,-roof.width/2],[roof.length/2,roof.width/2],[-roof.length/2,roof.width/2]].map(([f,r])=>[roof.x+f*cs-r*sn,roof.y+f*sn+r*cs,roof.z]);add(underside,'#777f6a','receiving');}
   if(rear){
    const plane=(offset,coords,color,alpha=1)=>add(coords.map(([r,h])=>{const p=local(rear.f+rear.length/2+offset,rear.r+r);p[2]=rear.z+h;return p;}),color,'portal',alpha);
    // A recessed mineral aperture with a thin light-bearing rim, not a painted door.
    const outline=[[-.82,.10],[.82,.10],[1.24,.52],[1.24,2.48],[.82,2.96],[-.82,2.96],[-1.24,2.48],[-1.24,.52]];
    const contour=(sx,sz)=>outline.map(([r,h])=>[r*sx,1.53+(h-1.53)*sz]);
    plane(.015,contour(1.14,1.06),'#304d43');
    plane(.025,outline,'#7dbb91');
    plane(.035,contour(.955,.963),'#102e29');
    plane(.045,contour(.90,.92),'#225f44');
    plane(.055,contour(.865,.893),'#061f21');
    // A few slow rising ribbons stay inside the portal. Fixed topology and depth.
    const portalTime=opt.reduced?0:(game.time||0);
    for(let j=0;j<4;j++){
     const h=.45+((j*.47+portalTime*.055)%1.9),r=.29*Math.sin(j*1.9+portalTime*.12),width=.51-.05*j;
     plane(.065+j*.001,[[r-width,h],[r+width,h+.12],[r+width*.77,h+.145],[r-width*.8,h+.035]],j%2?'#387e5d':'#285f4c');
    }
    plane(.08,[[-1.20,.62],[-1.17,.62],[-1.17,2.39],[-1.20,2.39]],'#b8e6ac');
    for(const h of[.75,1.0,1.8])plane(.10,[[1.54,h],[1.72,h],[1.72,h+.045],[1.54,h+.045]],'#a4c8a2');
    slab(rear.f+rear.length/2+.65,rear.r,1,2.5,'#659278',.18);
   }
   if(console){const p=[console.x,console.y,console.z+console.height+.015];box(...p,.95,.55,.025,['#7ba58d','#7ba58d','#a0c3a1'],'receiving',layout.yaw);}
   if(lantern){box(lantern.x,lantern.y,lantern.z+lantern.height-.4,.45,.45,.3,['#d9bd81','#c5af78','#eed6a1'],'receiving',layout.yaw);}
   // A modest outside nameplate: three original notches, not text at unreadable scale.
   if(front){const z=front.z+2.2;for(let k=0;k<3;k++){const p=local(front.f+front.length/2+.015,front.r-.15+k*.22);add([[p[0],p[1],z],[p[0]-.03*sn,p[1]+.03*cs,z],[p[0]-.03*sn,p[1]+.03*cs,z+.22+k*.07],[p[0],p[1],z+.22+k*.07]],'#536f5c','receiving');}}
  }
  let exposed=0,headFaces=0,physicalSections=0;const animals=game.worms||[game.worm],wormCounts=[];
  for(const [animalIndex,animal] of animals.entries()){const sections=animal?.sections||[];physicalSections+=sections.length;const before=faces.length;let animalExposed=0;
   for(let i=sections.length-1;i>=0;i--){
    const section=sections[i];if(!opt.noCull&&!GPU.chunkVisible({...section,radius:Geometry.sectionBound(sections,i)},cam,opt))continue;
    const mesh=Geometry.sectionMesh(sections,i);if(mesh.some(f=>f.vertices.some(v=>v[2]>w.terrain.height(v[0],v[1])))){exposed++;animalExposed++;}
    const front=sections[Math.max(0,i-1)],rear=sections[Math.min(sections.length-1,i+1)],dx=i===0?sections[0].x-rear.x:front.x-rear.x,dy=i===0?sections[0].y-rear.y:front.y-rear.y,dz=i===0?sections[0].z-rear.z:front.z-rear.z,angle=Math.atan2(dy,dx),pitch=Math.atan2(dz,Math.hypot(dx,dy));
    for(const f of mesh){const shell=['armour','crown','rear-cap','tail-cap'].includes(f.label),ivory=f.finish==='ivory'||['ivory','ivory-lip','brow','nose-cap','frill-rib'].includes(f.label),material=f.label==='solar-frill'?9:ivory?8:shell?(i===0?7:6):0;
     add(f.vertices,opt.wormFinish===false?actorColor(f):wormColor(f,i,cam,animalIndex===0?'copper':'sage'),i===0?'wormHead':'worm',1,material,actorMaterialCoords(f.vertices,sections[i],angle,pitch));if(i===0)headFaces++;
    }
   }
   wormCounts.push({id:animal?.id||'worm',palette:animalIndex===0?'copper':'sage',facesInFrustum:faces.length-before,exposedSections:animalExposed});
  }
  const skyMesh=game.sky?.mesh?.()||[];for(const f of skyMesh)add(f.vertices,actorColor(f),'skyCreature',1,/membrane|tail sail|tail vane/.test(f.label)?5:0,f.materialCoords||f.localVertices||null);
  const clues=animals.map(a=>subsurfaceClue(game,a)).filter(Boolean);for(const clue of clues)add(clue.raw,'#d4b48a','subsurfaceClue',clue.alpha);const clue=clues[0];
  // Shared visible craft surfaces are also the contact narrowphase.
  // Soft contact shadow follows the light and actual hull height; no terrain writes.
  let sx=c.x,sy=c.y;for(let k=0;k<3;k++){const h=clamp(c.z-ground(sx,sy),0,40);sx=c.x-SUN.x*h/SUN.z;sy=c.y-SUN.y*h/SUN.z;}const shadowHeight=Math.max(0,c.z-ground(sx,sy));for(let ring=4;ring>=0;ring--){const shadow=[],spread=1+ring*.18+Math.min(shadowHeight,20)*.013;for(let i=0;i<24;i++){const a=i*TAU/24,x=sx+Math.cos(a)*4.2*spread,y=sy+Math.sin(a)*2.6*spread;shadow.push([x,y,ground(x,y)+.03]);}add(shadow,'#463e32','shadow',.047/(1+shadowHeight*.025));}
  for(const f of Geometry.skimmerMesh(c)){const glass=['#42646b','#78969b','#35535d','#73a9ac','#b5e8df','#547f85'].includes(f.color);add(f.vertices,f.color,'ship',1,glass?0:4,actorMaterialCoords(f.vertices,c,c.yaw));}
  const supports=landingSupports(game);for(const p of supports){box(p.x,p.y,p.bottom,.09,.09,p.top-p.bottom,['#7c806e','#545e53','#adb29a'],'support',p.yaw);box(p.x,p.y,p.bottom,.38,.26,.045,['#7e806d','#525d51','#b2b397'],'support',p.yaw);}
  const footmark=footfallMark(game);if(footmark)add(footmark.raw,'#8b7154','footContact',footmark.alpha);
  let parcels=0;
  if(!opt.reduced)for(const p of (w.parcels||[]).slice(0,100)){if(p.z<ground(p.x,p.y))continue;const s=point(p.x,p.y,p.z);if(!s||s.d<15)continue;const r=Math.min(.5,s.d*2/focal);add([[p.x-r,p.y,p.z],[p.x+r,p.y,p.z],[p.x,p.y,p.z+r]],'#e8c796','parcel',.35);parcels++;}
  // Terrain and all objects share real per-pixel depth. No skimmer exemption.

  const depth={scale:1};
  if(typeof document!=='undefined'){
   if(!this.gpu)this.gpu=new GPU.SurfaceGPU();
   const ready=performance.now();this.metrics.faceAssemblyMs=ready-started;
   const surface=this.gpu.render(w,cam,opt,faces);
   const submitted=performance.now();this.metrics.gpuSubmissionMs=submitted-ready;ctx.drawImage(surface,0,0,W,H);this.metrics.gpuCompositeMs=performance.now()-submitted;
   Object.assign(this.metrics,this.gpu.metrics);
  }else{this.metrics.renderer='geometry-only test; no GPU';}
  this.metrics.surfacePassBeforeActors=true;

  // One arrival halo, expanding out of view and fading within1.3s. No flash,
  // camera impulse or ongoing overlay; reduced effects use only a quiet rim wash.
  if(arrival&&arrival.materialize<1){
   const t=clamp(arrival.materialize,0,1),amount=(1-t)*(1-t),radius=H*(.23+t*.8),outer=radius+H*.10;
   const halo=ctx.createRadialGradient(W*.5,H*.50,Math.max(0,radius-H*.08),W*.5,H*.50,outer);
   halo.addColorStop(0,'rgba(56,188,122,0)');halo.addColorStop(.46,`rgba(81,203,135,${amount*(opt.reduced?.07:.19)})`);halo.addColorStop(1,'rgba(31,131,98,0)');
   ctx.fillStyle=halo;ctx.fillRect(0,0,W,H);
  }
  const streaks=speedStreaks(game,opt,arrival);for(const s of streaks){ctx.globalAlpha=s.alpha;ctx.strokeStyle='#e7d8bc';ctx.lineWidth=s.width;ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();}
  ctx.globalAlpha=1;
  this.metrics={...this.metrics,materials:opt.materials!==false?'anchored procedural surfaces':'baseline albedo',skyFacesSubmitted:skyMesh.length,skyFacesInFrustum:faces.filter(f=>f.kind==='skyCreature').length,mountainFacesInFrustum:faces.filter(f=>f.kind==='mountain').length,creatureLighting:'shared low-sun material response and GPU depth fog',mountainDepth:'opaque world geometry in shared hardware depth',speedFeedback:{enabled:!!opt.speedEffects&&!opt.reduced,streaks:streaks.length,centerUnchanged:true,fovDeltaDeg:0},landingSupports:supports.length,footfallMark:footmark?{id:footmark.id,source:footmark.source,label:footmark.label}:null,subsurfaceClue:clue?{source:clue.source,depth:clue.depth,label:clue.label}:null,receivingSolids,arrivalLight:arrival?clamp(1-arrival.materialize,0,1):0,drawFaces:faces.length,terrainTiles:tiles,submittedLandmarks:landmarks,exposedSections:exposed,exposureScope:'frustum-candidate sections; not a global surface census',headFacesSubmitted:headFaces,headDesign:'eyeless Hammer Crown; broad closed digging lobes; dorsal solar frills; shared contact geometry',wormFinish:opt.wormFinish===false?'011 colours':'013 obsidian, ivory and copper solar membranes',physicalSections,wormCounts,visibleParcels:parcels,shipScreenBounds:bounds,framing:{shipFits:bounds.left>=0&&bounds.right<=W&&bounds.top>=0&&bounds.bottom<=H},terrainSource:'world.terrain.height; world.metadata; fixed world grid; canonical normals',materialTiles,detailFeatures,roadPatches,occlusionCounters:'not instrumented; hardware depth verified by browser pixel checks',terrainDepthPixelSize:depth.scale,groundDetail:opt.groundDetail!==false,renderMs:(typeof performance!=='undefined'?performance.now():Date.now())-started,effects:'quiet actual parcels; optional cosmetic shallow-motion dust; no displaced-volume claim'};
 }
}
root.SDView={View,actorMaterialCoords,driveLook,actorColor,wormColor,mountainMesh,speedStreaks};if(typeof module!=='undefined')module.exports={View,actorMaterialCoords,Scene:View,headMesh,wormColor,triangleNormal,surfaceColor,detailCell,arrivalCamera,receivingGeometry,subsurfaceClue,landingSupports,footfallMark,driveLook,actorColor,mountainMesh,speedStreaks};
})(typeof globalThis!=='undefined'?globalThis:this);
