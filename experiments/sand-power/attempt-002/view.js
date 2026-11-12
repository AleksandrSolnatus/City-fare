/* Sand Power 002: close camera and honest world-scale cues.
 * View only: never writes to the body, controls, simulation clock or terrain.
 * Landmarks and sand streaks are visual references, not collision/excavation.
 */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
const M=200/12,TAU=Math.PI*2;
const palettes=[[55,113,115],[50,100,108],[68,133,125],[55,112,124],[77,139,130]];
const rand=(x,y)=>{let a=Math.sin(x*127.1+y*311.7)*43758.5453;return a-Math.floor(a);};
class Scene{
 constructor(canvas,ctx){this.canvas=canvas;this.ctx=ctx;this.reset();}
 reset(){this.cam=null;this.traces=[];this.lastTraceTime=-1;this.metrics={};}
 frame(body,opt){
  const q=body.shape(),co=body.com(),mode=opt.mode,dt=Math.max(0,opt.dt);
  const close=mode==='close',study=mode==='study';
  // Average several front sections: do not bolt the camera to head oscillation.
  const a=close?{x:(q[5].x+q[7].x+q[9].x)/3,y:(q[5].y+q[7].y+q[9].y)/3}:co;
  let yaw=study?0:Math.atan2(q[2].y-q[14].y,q[2].x-q[14].x);
  if(!this.cam)this.cam={x:a.x,y:a.y,z:body.ground(a.x,a.y),yaw};
  const c=this.cam,turn=Math.atan2(Math.sin(yaw-c.yaw),Math.cos(yaw-c.yaw));
  c.yaw+=turn*(1-Math.exp(-dt*1.65));c.x=mix(c.x,a.x,1-Math.exp(-dt*4));c.y=mix(c.y,a.y,1-Math.exp(-dt*4));
  c.z=mix(c.z,body.ground(a.x,a.y),1-Math.exp(-dt*2));
  const fx=Math.cos(c.yaw),fy=Math.sin(c.yaw),back=close?2.7:study?3:10.5,side=close?1.02:0,up=close?1.65:study?20:10;
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
  sky.addColorStop(0,'#131d2b');sky.addColorStop(clamp(horizon/H,.05,.9),'#c59670');sky.addColorStop(1,'#6d5343');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  // Fixed world direction: turning changes the sun's screen position, not its position in the world.
  const sun=point(f.eye[0]+100,f.eye[1]+43,f.eye[2]+9),sr=Math.min(W,H)*.048;
  if(sun){const g=ctx.createRadialGradient(sun.x,sun.y,sr*.2,sun.x,sun.y,sr*4);g.addColorStop(0,'#ffd8a8aa');g.addColorStop(1,'#edb17a00');ctx.fillStyle=g;ctx.fillRect(sun.x-sr*4,sun.y-sr*4,sr*8,sr*8);ctx.fillStyle='#f2c18b';ctx.beginPath();ctx.arc(sun.x,sun.y,sr,0,TAU);ctx.fill();}
  const faces=[];let visibleLandmarks=0;
  const add=(raw,col,stroke=null,kind='world')=>{const p=poly(raw);if(p.length<3)return;
   const xs=p.map(v=>v.x),ys=p.map(v=>v.y);
   if(Math.max(...xs)<-40||Math.min(...xs)>W+40||Math.max(...ys)<-40||Math.min(...ys)>H+40)return;
   faces.push({p,d:p.reduce((s,v)=>s+v.d,0)/p.length,col,stroke,kind});};
  const ground=(x,y)=>body.ground(x,y),ix=Math.floor(f.eye[0]/1.8),iy=Math.floor(f.eye[1]/1.8);
  const groundColor=(x,y)=>{const slope=(ground(x+.15,y)-ground(x-.15,y))/.3,k=clamp(.82+slope*.57+ground(x,y)*.04,.58,1);return `rgb(${Math.round(184*k)},${Math.round(140*k)},${Math.round(100*k)})`;};
  // Fixed world lattice. The terrain/texture does not scroll independently of camera movement.
  for(let i=ix-22;i<=ix+22;i++)for(let j=iy-22;j<=iy+22;j++){
   const x=i*1.8,y=j*1.8,raw=[[x,y],[x+1.8,y],[x+1.8,y+1.8],[x,y+1.8]].map(([a,b])=>[a,b,ground(a,b)]),c=groundColor(x,y);add(raw,c,c,'terrain');
  }
  const box=(x,y,z,w,d,h,col)=>{
   const pts=[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2,y+b*d/2,z+c*h]);
   for(const [ids,color] of [[[0,1,5,4],col[0]],[[1,2,6,5],col[1]],[[2,3,7,6],col[0]],[[3,0,4,7],col[1]],[[4,5,6,7],col[2]]])add(ids.map(i=>pts[i]),color);
  };
  // Each scale reference is specified in actual model metres, not a screen-size sprite.
  if(landmarks){
   const gx=Math.floor(f.eye[0]/3),gy=Math.floor(f.eye[1]/3);
   for(let i=gx-12;i<=gx+12;i++)for(let j=gy-12;j<=gy+12;j++){
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
   for(let i=rx-22;i<=rx+22;i++)for(let j=ry-22;j<=ry+22;j++){
    const x=i*.45,y=j*.45+.1*rand(i,j),h=ground(x,y)+.009;
    add([[x-.12,y,h],[x+.12,y+.035,ground(x+.12,y+.035)+.009],[x+.12,y+.045,ground(x+.12,y+.045)+.009]],'#d2ac7f77',null,'trace');
   }
  }
  // Trace generation keyed to simulation time, not frame rate, and frozen on pause.
  if(body.time<this.lastTraceTime){this.traces=[];this.lastTraceTime=-1;}
  if(body.time-this.lastTraceTime>=.12){this.lastTraceTime=body.time;for(let i=3;i<25;i+=4){const p=q[i];if(body.p[i*2].contact>.2)this.traces.push({x:p.x,y:p.y,r:p.r,t:body.time});}if(this.traces.length>1600)this.traces.splice(0,this.traces.length-1600);}
  for(const p of this.traces){const r=p.r*.65;add([[p.x-.06,p.y-r],[p.x+.06,p.y-r],[p.x+.045,p.y+r]].map(([x,y])=>[x,y,ground(x,y)+.012]),'#614b3820',null,'trace');}
  const clipGround=raw=>{const out=[];for(let i=0;i<raw.length;i++){const a=raw[i],b=raw[(i+1)%raw.length],da=a[2]-ground(a[0],a[1]),db=b[2]-ground(b[0],b[1]);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,k)=>mix(v,b[k],t)));}}return out;};
  for(let i=24;i>=0;i--){const p=q[i],prev=q[Math.max(0,i-1)],next=q[Math.min(24,i+1)],ang=Math.atan2(prev.y-next.y,prev.x-next.x),tx=Math.cos(ang),ty=Math.sin(ang),nx=-ty,ny=tx,h=body.h[i];
   const ring=(a,b,r,half,z)=>[[-half,a],[half,a],[half,b],[-half,b]].map(([s,t])=>[p.x+tx*s+nx*Math.cos(t)*r,p.y+ty*s+ny*Math.cos(t)*r,h+z+Math.sin(t)*r]);
   for(let j=0;j<10;j++){const a=TAU*j/10,b=TAU*(j+1)/10,raw=clipGround(ring(a,b,p.r,.27,0));if(raw.length<3)continue;
    const cover=body.p[i*2].cover,shade=.65+.35*Math.max(0,Math.sin((a+b)/2)),rgb=palettes[i%5].map((v,k)=>Math.round(mix(v,[194,158,112][k],cover)*shade));add(raw,`rgb(${rgb})`,'#092c2725','body');}
   for(let j=0;j<5;j++){const a=.16+Math.PI*j/5,b=.16+Math.PI*(j+1)/5,raw=clipGround(ring(a,b,body.p[i*2].r*.86,.20,.10));if(raw.length<3)continue;
    const cover=body.p[i*2].cover,rgb=palettes[(i+2)%5].map((v,k)=>Math.round(mix(v+14,[205,170,125][k],cover)));add(raw,`rgb(${rgb})`,'#d4ae687a','body');}
  }
  // A layered painter, not a depth buffer: ground then cosmetic traces, then clipped body/props.
  // Ground intersection is applied to body facets above; no whole-tile foreground cuts.
  const layer=f=>f.kind==='terrain'?0:f.kind==='trace'?1:2;
  faces.sort((a,b)=>layer(a)-layer(b)||b.d-a.d);
  let bodyMinX=Infinity,bodyMinY=Infinity,bodyMaxX=-Infinity,bodyMaxY=-Infinity;
  for(const f of faces){ctx.beginPath();ctx.moveTo(f.p[0].x,f.p[0].y);for(let i=1;i<f.p.length;i++)ctx.lineTo(f.p[i].x,f.p[i].y);ctx.closePath();ctx.fillStyle=f.col;ctx.fill();if(f.stroke){ctx.lineWidth=.55;ctx.strokeStyle=f.stroke;ctx.stroke();}
   if(f.kind==='body')for(const p of f.p){bodyMinX=Math.min(bodyMinX,p.x);bodyMaxX=Math.max(bodyMaxX,p.x);bodyMinY=Math.min(bodyMinY,p.y);bodyMaxY=Math.max(bodyMaxY,p.y);}
  }
  const buried=q.filter((p,i)=>body.h[i]+p.r<ground(p.x,p.y)).length;
  if(buried>8||inspect){ctx.setLineDash(buried>8?[5,8]:[]);ctx.strokeStyle=buried>8?'#efe1b591':'#acf4e1';ctx.lineWidth=1.4;ctx.beginPath();let begun=false;
   for(let i=0;i<25;i++){const p=q[i],s=point(p.x,p.y,Math.max(body.h[i]+.13,ground(p.x,p.y)+.06));if(!s){begun=false;continue;}begun?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y);begun=true;}ctx.stroke();ctx.setLineDash([]);}
  if(inspect){for(let i=0;i<25;i++){const l=body.p[2*i],r=body.p[2*i+1],a=point(l.x,l.y,body.h[i]+.15),b=point(r.x,r.y,body.h[i]+.15);if(a&&b){ctx.strokeStyle=stiff>1&&i>8&&i<17?'#ffb787':'#b8f2df';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}}
  const rider=q[3],rh=body.h[3]+body.p[6].r+.12;
  if(rh>ground(rider.x,rider.y)+.1){const a=point(rider.x,rider.y,rh),b=point(rider.x,rider.y,rh+1.8/M);if(a&&b){const height=Math.abs(a.y-b.y);ctx.strokeStyle='#f9e9ba';ctx.lineWidth=Math.max(.5,height*.20);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='#f9e9ba';ctx.beginPath();ctx.arc(b.x,b.y,Math.max(.3,height*.11),0,TAU);ctx.fill();}}
  this.metrics.visibleLandmarks=visibleLandmarks;this.metrics.bodyScreenBounds=Number.isFinite(bodyMinX)?{left:bodyMinX,right:bodyMaxX,top:bodyMinY,bottom:bodyMaxY}:null;
  this.metrics.drawFaces=faces.length;this.metrics.traceCount=this.traces.length;
 }
}
root.SandScene=Scene;
if(typeof module!=='undefined')module.exports={Scene,MODEL_METRES:M};
})(typeof globalThis!=='undefined'?globalThis:this);
