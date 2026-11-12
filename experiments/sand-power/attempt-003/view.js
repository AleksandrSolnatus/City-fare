/* Sand Power 003: Deep Current — a dry-armoured desert ride.
 * View only: never writes to the body, controls, simulation clock or terrain.
 * Landmarks and sand streaks are visual references, not collision/excavation.
 */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
const M=200/12,TAU=Math.PI*2;
const palettes=[[43,104,106],[46,119,118],[67,134,124],[40,95,105],[88,143,129]];
const rand=(x,y)=>{let a=Math.sin(x*127.1+y*311.7)*43758.5453;return a-Math.floor(a);};
class Scene{
 constructor(canvas,ctx){this.canvas=canvas;this.ctx=ctx;this.reset();}
 reset(){this.cam=null;this.traces=[];this.lastTraceTime=-1;this.particles=[];this.lastParticleTime=-1;this.lastMode=null;this.metrics={};}
 frame(body,opt){
  const q=body.shape(),co=body.com(),mode=opt.mode,dt=opt.running===false&&this.lastMode===opt.mode?0:(opt.reduced?1:Math.min(.05,Math.max(0,opt.dt)));
  if(this.lastMode!==mode)this.cam=null;this.lastMode=mode;
  const close=mode==='close',study=mode==='study';
  // Average several front sections: do not bolt the camera to head oscillation.
  const a=close?{x:(q[5].x+q[7].x+q[9].x)/3,y:(q[5].y+q[7].y+q[9].y)/3}:co;
  let yaw=study?0:Math.atan2(q[2].y-q[14].y,q[2].x-q[14].x);
  if(!this.cam)this.cam={x:a.x,y:a.y,z:body.ground(a.x,a.y),yaw};
  const c=this.cam,turn=Math.atan2(Math.sin(yaw-c.yaw),Math.cos(yaw-c.yaw));
  c.yaw+=turn*(1-Math.exp(-dt*1.65));c.x=mix(c.x,a.x,1-Math.exp(-dt*4));c.y=mix(c.y,a.y,1-Math.exp(-dt*4));
  c.z=mix(c.z,body.ground(a.x,a.y),1-Math.exp(-dt*2));
  const fx=Math.cos(c.yaw),fy=Math.sin(c.yaw),back=close?3.6:study?3:11.5,side=close?1.35:0,up=close?1.75:study?19:7.4;
  const eye=[c.x-fx*back-fy*side,c.y-fy*back+fx*side,c.z+up];
  eye[2]=Math.max(eye[2],body.ground(eye[0],eye[1])+(close?.75:1));
  const focus=[c.x+fx*(close?7:1.5),c.y+fy*(close?7:1.5),c.z+(close?.1:0)];
  const d=focus.map((v,i)=>v-eye[i]),len=Math.hypot(...d);for(let i=0;i<3;i++)d[i]/=len;
  const h=Math.hypot(d[0],d[1]),right=[-d[1]/h,d[0]/h,0],vu=[-d[2]*d[0]/h,-d[2]*d[1]/h,h];
  // Close view has a fixed 62-degree vertical field of view. No speed zoom.
  const focal=close?opt.H/(2*Math.tan(31*Math.PI/180)):Math.min(opt.W,opt.H*.85);
  const cx=opt.W*.5,cy=opt.H*(close?.47:(opt.H<opt.W?.51:.49)),near=.12;
  const local=p=>{const v=p.map((x,i)=>x-eye[i]);return [v.reduce((s,x,i)=>s+x*right[i],0),v.reduce((s,x,i)=>s+x*vu[i],0),v.reduce((s,x,i)=>s+x*d[i],0)];};
  const screen=p=>({x:cx+p[0]*focal/p[2],y:cy-p[1]*focal/p[2],d:p[2]});
  const point=(x,y,z)=>{const p=local([x,y,z]);return p[2]>=near?screen(p):null;};
  // Clip at the near plane instead of deleting a whole close-up plate/ground quad.
  const poly=pts=>{const raw=pts.map(local),out=[];for(let i=0;i<raw.length;i++){const a=raw[i],b=raw[(i+1)%raw.length],ina=a[2]>=near,inb=b[2]>=near;if(ina)out.push(a);if(ina!==inb){const t=(near-a[2])/(b[2]-a[2]);out.push(a.map((v,k)=>mix(v,b[k],t)));}}return out.map(screen);};
  const horizon=cy+focal*d[2]/Math.max(.001,h);
  this.metrics={mode,cameraHeightAboveTerrainM:(eye[2]-body.ground(eye[0],eye[1]))*M,nominalCameraHeightM:up*M,
   eye:eye.map(v=>v*M),verticalFovDeg:2*Math.atan(opt.H/(2*focal))*180/Math.PI,horizonPx:horizon,
   landmarks:!!opt.landmarks,referenceSizesM:{post:2,shelterHeight:4,shelterLength:6.5,cactusMin:3,cactusMax:5},
   terrainChanged:false,physicsChanged:false};
  return {q,eye,point,poly,horizon,camera:c};
 }
 render(body,opt){
  const {W,H,DPR,mode,landmarks,inspect,stiff}=opt,ctx=this.ctx;
  const f=this.frame(body,opt),q=f.q,point=f.point,poly=f.poly;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const horizon=clamp(f.horizon,.06*H,.8*H),sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#172f3a');sky.addColorStop(clamp(horizon/H,.05,.9),'#d68b6b');sky.addColorStop(1,'#b6744f');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  // The lower haze fills beyond the bounded terrain mesh without a hard world edge.
  const haze=ctx.createLinearGradient(0,horizon,0,H);haze.addColorStop(0,'#c78d6b');haze.addColorStop(1,'#9f6346');ctx.fillStyle=haze;ctx.fillRect(0,horizon,W,H-horizon);
  // Fixed world direction: turning changes the sun's screen position, not its position in the world.
  const sun=point(f.eye[0]+100,f.eye[1]+43,f.eye[2]+9),sr=Math.min(W,H)*.048;
  if(sun){const g=ctx.createRadialGradient(sun.x,sun.y,sr*.2,sun.x,sun.y,sr*4);g.addColorStop(0,'#ffd8a8aa');g.addColorStop(1,'#edb17a00');ctx.fillStyle=g;ctx.fillRect(sun.x-sr*4,sun.y-sr*4,sr*8,sr*8);ctx.fillStyle='#f2c18b';ctx.beginPath();ctx.arc(sun.x,sun.y,sr,0,TAU);ctx.fill();}
  // Directional mesa silhouettes form distant horizon scenery, not navigable terrain.
  for(let i=-8;i<=8;i++){
   const a=i*.39,dx=Math.cos(a)*150,dy=Math.sin(a)*150;
   const peak=point(f.eye[0]+dx,f.eye[1]+dy,4+rand(i,63)*8);
   const base=point(f.eye[0]+dx,f.eye[1]+dy,-2);
   if(!peak||!base)continue;
   const width=(14+rand(i,32)*22)*M/base.d;
   ctx.fillStyle=i%2?'#886c65':'#9d7668';ctx.beginPath();ctx.moveTo(peak.x-width*1.8,base.y);ctx.lineTo(peak.x-width*.75,peak.y);ctx.lineTo(peak.x+width*.55,peak.y+width*.14);ctx.lineTo(peak.x+width*1.7,base.y);ctx.closePath();ctx.fill();
  }
  const faces=[];let visibleLandmarks=0;
  const add=(raw,col,stroke=null,kind='world')=>{const p=poly(raw);if(p.length<3)return;
   const xs=p.map(v=>v.x),ys=p.map(v=>v.y);
   if(Math.max(...xs)<-40||Math.min(...xs)>W+40||Math.max(...ys)<-40||Math.min(...ys)>H+40)return;
   faces.push({p,d:p.reduce((s,v)=>s+v.d,0)/p.length,col,stroke,kind});};
  const ground=(x,y)=>body.ground(x,y),ix=Math.floor(f.eye[0]/2),iy=Math.floor(f.eye[1]/2);
  const groundColor=(x,y)=>{const slope=(ground(x+.15,y)-ground(x-.15,y))/.3,k=clamp(.88+slope*.82+ground(x,y)*.035,.60,1.08);return `rgb(${Math.round(194*k)},${Math.round(135*k)},${Math.round(88*k)})`;};
  // Fixed world lattice. The terrain/texture does not scroll independently of camera movement.
  const terrainTile=(x,y,size)=>{const raw=[[x,y],[x+size,y],[x+size,y+size],[x,y+size]].map(([a,b])=>[a,b,ground(a,b)]),c=groundColor(x,y);add(raw,c,c,'terrain');};
  // Coarse outer tiles and detailed local tiles share one fixed lattice.
  const tx=Math.floor(ix/4)*8,ty=Math.floor(iy/4)*8;
  for(let i=-7;i<=7;i++)for(let j=-7;j<=7;j++)if(Math.abs(i)>2||Math.abs(j)>2)terrainTile(tx+i*8,ty+j*8,8);
  for(let i=-8;i<12;i++)for(let j=-8;j<12;j++)terrainTile(tx+i*2,ty+j*2,2);
  const box=(x,y,z,w,d,h,col)=>{
   const pts=[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2,y+b*d/2,z+c*h]);
   for(const [ids,color] of [[[0,1,5,4],col[0]],[[1,2,6,5],col[1]],[[2,3,7,6],col[0]],[[3,0,4,7],col[1]],[[4,5,6,7],col[2]]])add(ids.map(i=>pts[i]),color);
  };
  // Each scale reference is specified in actual model metres, not a screen-size sprite.
  if(landmarks){
   const gx=Math.floor(f.eye[0]/3),gy=Math.floor(f.eye[1]/3);
   for(let i=gx-9;i<=gx+9;i++)for(let j=gy-9;j<=gy+9;j++){
    const rnd=rand(i,j);if(rnd<.73)continue;
    const x=i*3+.8*rand(i+14,j),y=j*3+.8*rand(i,j+14),g=ground(x,y),p=point(x,y,g);
    if(!p||p.x< -150||p.x>W+150||p.y< -80||p.y>H+200)continue;
    visibleLandmarks++;
    if(rnd>.87){const h=(3+2*rand(i+4,j))/M,w=.40/M;box(x,y,g,w,w,h,['#596453','#3d5145','#8c9972']);box(x,y+.56/M,g+h*.52,.32/M,1.25/M,.31/M,['#58614c','#465642','#8f9774']);box(x,y+.98/M,g+h*.52,.30/M,.30/M,h*.24,['#58614c','#465642','#8f9774']);}
    else{const h=(4+7*rand(i+29,j))/M,r=h*.4;add([[x-r,y-r,g],[x+r,y-r,g],[x+r*.5,y,g+h],[x-r*.6,y,g+h*.86]],'#8c6952');add([[x+r,y-r,g],[x+r,y+r,g],[x+r*.2,y+r*.3,g+h*.8],[x+r*.5,y,g+h]],'#6e5447');add([[x-r*.6,y,g+h*.86],[x+r*.5,y,g+h],[x+r*.2,y+r*.3,g+h*.8]],'#c49e74');}
   }
   // Survey lane is a visual yardstick, not a road constraint. Two-metre posts, 40 m apart.
   for(let i=Math.floor(f.eye[0]*M/40)-16;i<=Math.floor(f.eye[0]*M/40)+28;i++)for(const side of[-1,1]){
    const x=i*40/M,y=side*30/M,g=ground(x,y);box(x,y,g,.16/M,.16/M,2/M,['#c1b89c','#a9a18a','#e4d6b5']);box(x,y,g+1.65/M,.40/M,.30/M,.25/M,['#b36c4e','#875341','#dca77a']);
   }
   // Sparse abandoned shelters (4m high, 6.5m long) supply a familiar fixed scale.
   for(let i=Math.floor(f.eye[0]/18)-3;i<=Math.floor(f.eye[0]/18)+4;i++){
    const x=10+i*18,y=(i%2===0?1:-1)*4,g=ground(x,y),w=6.5/M,d=4.5/M,h=4/M;
    box(x,y,g,w,d,h,['#bd9977','#8e735c','#e0be95']);
    add([[x-w/2-.025,y-d/2-.025,g+h],[x+w/2+.025,y-d/2-.025,g+h],[x+w/2+.025,y+d/2+.025,g+h+.06],[x-w/2-.025,y+d/2+.025,g+h+.06]],'#7b6960');
    add([[x-w/2-.001,y-.055,g],[x-w/2-.001,y+.055,g],[x-w/2-.001,y+.055,g+2.1/M],[x-w/2-.001,y-.055,g+2.1/M]],'#343631');
   }
   // Near-field ripples/tiny pebbles: world-anchored, no time-based animation.
   const rx=Math.floor(f.eye[0]/.45),ry=Math.floor(f.eye[1]/.45);
   for(let i=rx-13;i<=rx+13;i++)for(let j=ry-13;j<=ry+13;j++){
    const x=i*.45,y=j*.45+.1*rand(i,j),h=ground(x,y)+.009;
    add([[x-.12,y,h],[x+.12,y+.035,ground(x+.12,y+.035)+.009],[x+.12,y+.045,ground(x+.12,y+.045)+.009]],'#e2bd8245',null,'trace');
   }
  }
  // Resonator markers are fixed world geometry. Their visible halo shows the
  // survey capture radius; the game's controller decides when an encounter counts.
  if(opt.target){
   const t=opt.target,x=t.x,y=t.y,g=ground(x,y),deep=t.kind==='dive',col=deep?'#8ce7dc':'#ffd48e';
   for(let i=0;i<32;i++){
    const a=i*TAU/32,b=(i+1)*TAU/32,r=t.radius??1.8;
    add([[x+Math.cos(a)*r,y+Math.sin(a)*r,g+.035],[x+Math.cos(b)*r,y+Math.sin(b)*r,g+.035],[x+Math.cos(b)*(r-.055),y+Math.sin(b)*(r-.055),g+.035],[x+Math.cos(a)*(r-.055),y+Math.sin(a)*(r-.055),g+.035]],col,null,'trace');
   }
   for(const side of[-1,1]){
    const px=x,py=y+side*1.23,pg=ground(px,py);
    box(px,py,pg,.20,.28,3.6,['#796452','#544e48','#c49a68']);
    box(px-.012,py-.16,pg+.20,.09,.04,3.55,[col,col,col]);
    add([[px-.24,py-.28,pg+3.6],[px+.24,py-.28,pg+3.6],[px+.15,py+.28,pg+4],[px-.15,py+.28,pg+4]],'#dfb780');
   }
   const z=g+3.25,pts=[[x,y,z+.42],[x,y-.28,z],[x,y,z-.42],[x,y+.28,z]];
   add(pts,col,'#fff4c2','marker');
   this.metrics.targetScreen=point(x,y,g+4.45);
  }
  // Trace generation keyed to simulation time, not frame rate, and frozen on pause.
  if(body.time<this.lastTraceTime){this.traces=[];this.lastTraceTime=-1;this.particles=[];this.lastParticleTime=-1;}
  if(body.time-this.lastTraceTime>=.12){this.lastTraceTime=body.time;for(let i=3;i<25;i+=4){const p=q[i];if(body.p[i*2].contact>.2&&Math.hypot(body.p[i*2].vx,body.p[i*2].vy)>.04)this.traces.push({x:p.x,y:p.y,r:p.r,t:body.time});}if(this.traces.length>650)this.traces.splice(0,this.traces.length-650);}
  this.traces=this.traces.filter(p=>body.time-p.t<16);
  for(const p of this.traces){const r=p.r*.65;add([[p.x-.06,p.y-r],[p.x+.06,p.y-r],[p.x+.045,p.y+r]].map(([x,y])=>[x,y,ground(x,y)+.012]),'#633e3029',null,'trace');}
  if(!opt.reduced&&body.time-this.lastParticleTime>=.08){
   this.lastParticleTime=body.time;
   for(let i=1;i<25;i+=3){
    const p=q[i],node=body.p[i*2],g=ground(p.x,p.y),rise=body.vh[i],speed=Math.hypot(node.vx,node.vy);
    if(body.h[i]+p.r<g-.04||node.contact<.12||speed<.04&&rise<.18)continue;
    for(const side of[-1,1]){
     const prev=q[Math.max(0,i-1)],next=q[Math.min(24,i+1)],angle=Math.atan2(prev.y-next.y,prev.x-next.x),nx=-Math.sin(angle)*side,ny=Math.cos(angle)*side;
     const r=rand(i+body.time,side),v=.3+Math.max(0,rise)*.5;
     this.particles.push({x:p.x+nx*p.r*.8,y:p.y+ny*p.r*.8,z:g+.04,vx:nx*v-node.vx*.14,vy:ny*v-node.vy*.14,vz:.35+Math.max(0,rise)*.75+r*.25,t:body.time,life:.65+r*.45,r:.04+r*.035});
    }
   }
   if(this.particles.length>180)this.particles.splice(0,this.particles.length-180);
  }
  this.particles=this.particles.filter(p=>body.time-p.t<p.life);
  if(!opt.reduced)for(const p of this.particles){
   const age=body.time-p.t,x=p.x+p.vx*age,y=p.y+p.vy*age,z=p.z+p.vz*age-.65*age*age,r=p.r*(1+age*.6);
   if(z<ground(x,y))continue;
   add([[x-r,y,z],[x+r,y,z],[x,y+r,z+r]],'#eac18b8c',null,'dust');
  }
  const clipGround=raw=>{const out=[];for(let i=0;i<raw.length;i++){const a=raw[i],b=raw[(i+1)%raw.length],da=a[2]-ground(a[0],a[1]),db=b[2]-ground(b[0],b[1]);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,k)=>mix(v,b[k],t)));}}return out;};
  for(let i=24;i>=0;i--){const p=q[i],prev=q[Math.max(0,i-1)],next=q[Math.min(24,i+1)],ang=Math.atan2(prev.y-next.y,prev.x-next.x),tx=Math.cos(ang),ty=Math.sin(ang),nx=-ty,ny=tx,h=body.h[i];
   const ring=(a,b,r,half,z)=>[[-half,a],[half,a],[half,b],[-half,b]].map(([s,t])=>[p.x+tx*s+nx*Math.cos(t)*r,p.y+ty*s+ny*Math.cos(t)*r,h+z+Math.sin(t)*r]);
   for(let j=0;j<10;j++){const a=TAU*j/10,b=TAU*(j+1)/10,raw=clipGround(ring(a,b,p.r,.27,0));if(raw.length<3)continue;
    const cover=body.p[i*2].cover,shade=.65+.35*Math.max(0,Math.sin((a+b)/2)),rgb=palettes[i%5].map((v,k)=>Math.round(mix(v,[201,161,105][k],cover)*shade));add(raw,`rgb(${rgb})`,'#092c2725','body');}
   for(let j=0;j<5;j++){const a=.16+Math.PI*j/5,b=.16+Math.PI*(j+1)/5,raw=clipGround(ring(a,b,body.p[i*2].r*.86,.20,.10));if(raw.length<3)continue;
    const cover=body.p[i*2].cover,rgb=palettes[(i+2)%5].map((v,k)=>Math.round(mix(v+14,[217,176,116][k],cover)));add(raw,`rgb(${rgb})`,'#c68c51','body');}
  }
  // A low shield-shaped head closes the open tissue cylinder. Its plates remain
  // rigid local geometry, with no independently animated spine or head path.
  {const p=q[0],n=q[1],angle=Math.atan2(p.y-n.y,p.x-n.x),tx=Math.cos(angle),ty=Math.sin(angle),nx=-ty,ny=tx,r=p.r,h=body.h[0];
   const at=(a,b,c)=>[p.x+tx*a+nx*b,p.y+ty*a+ny*b,h+c];
   const sand=body.p[0].cover,col=sand>.6?'#c9a26f':'#418a88';
   add(clipGround([at(.28,-r*.8,0),at(.28,0,r*.93),at(.28,r*.8,0),at(.28,0,-r*.5)]),col,'#c08c55','body');
   for(const side of[-1,1])add(clipGround([at(.29,side*r*.2,r*.46),at(.29,side*r*.65,r*.31),at(.295,side*r*.65,r*.23),at(.295,side*r*.2,r*.36)]),'#193e43',null,'body');
  }
  // A layered painter, not a depth buffer: ground then cosmetic traces, then clipped body/props.
  // Ground intersection is applied to body facets above; no whole-tile foreground cuts.
  const layer=f=>f.kind==='terrain'?0:f.kind==='trace'?1:2;
  faces.sort((a,b)=>layer(a)-layer(b)||b.d-a.d);
  let bodyMinX=Infinity,bodyMinY=Infinity,bodyMaxX=-Infinity,bodyMaxY=-Infinity;
  for(const f of faces){ctx.beginPath();ctx.moveTo(f.p[0].x,f.p[0].y);for(let i=1;i<f.p.length;i++)ctx.lineTo(f.p[i].x,f.p[i].y);ctx.closePath();ctx.globalAlpha=f.kind==='terrain'?1:clamp(1-Math.max(0,f.d-18)/95,.30,1);ctx.fillStyle=f.col;ctx.fill();if(f.stroke){ctx.lineWidth=.55;ctx.strokeStyle=f.stroke;ctx.stroke();}
   if(f.kind==='body')for(const p of f.p){bodyMinX=Math.min(bodyMinX,p.x);bodyMaxX=Math.max(bodyMaxX,p.x);bodyMinY=Math.min(bodyMinY,p.y);bodyMaxY=Math.max(bodyMaxY,p.y);}
  }
  ctx.globalAlpha=1;
  const buried=q.filter((p,i)=>body.h[i]+p.r<ground(p.x,p.y)).length;
  if(buried>8||inspect){ctx.setLineDash(buried>8?[5,8]:[]);ctx.strokeStyle=buried>8?'#efe1b591':'#acf4e1';ctx.lineWidth=1.4;ctx.beginPath();let begun=false;
   for(let i=0;i<25;i++){const p=q[i],s=point(p.x,p.y,Math.max(body.h[i]+.13,ground(p.x,p.y)+.06));if(!s){begun=false;continue;}begun?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y);begun=true;}ctx.stroke();ctx.setLineDash([]);}
  if(inspect){for(let i=0;i<25;i++){const l=body.p[2*i],r=body.p[2*i+1],a=point(l.x,l.y,body.h[i]+.15),b=point(r.x,r.y,body.h[i]+.15);if(a&&b){ctx.strokeStyle=stiff>1&&i>8&&i<17?'#ffb787':'#b8f2df';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}}
  const rider=q[3],rh=body.h[3]+body.p[6].r+.12;
  if(rh>ground(rider.x,rider.y)+.1){const a=point(rider.x,rider.y,rh),b=point(rider.x,rider.y,rh+1.8/M);if(a&&b){const height=Math.abs(a.y-b.y);ctx.strokeStyle='#f9e9ba';ctx.lineWidth=Math.max(.5,height*.20);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='#f9e9ba';ctx.beginPath();ctx.arc(b.x,b.y,Math.max(.3,height*.11),0,TAU);ctx.fill();}}
  this.metrics.visibleLandmarks=visibleLandmarks;this.metrics.bodyScreenBounds=Number.isFinite(bodyMinX)?{left:bodyMinX,right:bodyMaxX,top:bodyMinY,bottom:bodyMaxY}:null;
  // A subtle lens vignette frames the near ride without hiding the controls.
  const vignette=ctx.createRadialGradient(W*.5,H*.5,Math.min(W,H)*.28,W*.5,H*.5,Math.max(W,H)*.72);vignette.addColorStop(0,'#112c3400');vignette.addColorStop(1,'#112c3445');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  this.metrics.drawFaces=faces.length;this.metrics.traceCount=this.traces.length;this.metrics.particleCount=this.particles.length;
  this.metrics.effects='cosmetic, simulation-timed; no terrain excavation';
 }
}
root.SandScene=Scene;
if(typeof module!=='undefined')module.exports={Scene,MODEL_METRES:M};
})(typeof globalThis!=='undefined'?globalThis:this);
