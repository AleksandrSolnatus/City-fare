/* A directly rendered view of Body tissue state. No hidden head-driving path. */
(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('view'),ctx=canvas.getContext('2d',{alpha:false});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2, METERS=200/12, BODY_SCHEMA='city-fare-sand-power-motion-001/1';
let body=new SandBody({depth:true}),running=false,started=false,tick=0,acc=0,last=0,lostTime=0;
let keys=new Set(),pointers=new Map(),camera={x:0,y:0,angle:0},W=1,H=1,DPR=1;
let trace=[],lastTrace=0,inspect=false,viewMode=matchMedia('(prefers-reduced-motion: reduce)').matches?'study':'ride',stiff=1,frameTimes=[],renderCount=0;
let runs=[],events=[],lastInput='',toastTimer=null;
const palette=[[55,113,115],[50,100,108],[68,133,125],[55,112,124],[77,139,130]];
function note(text){$('notice').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('notice').textContent=''},5500);}
function size(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,1.65);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);}
addEventListener('resize',size);size();
function input(){const has=(...names)=>names.some(n=>keys.has(n)||[...pointers.values()].includes(n));return {surge:has('surge','KeyW','ArrowUp'),left:has('left','KeyA','ArrowLeft'),right:has('right','KeyD','ArrowRight'),dive:has('dive','KeyS','ArrowDown'),coast:has('coast','Space')};}
function release(){keys.clear();pointers.clear();document.querySelectorAll('[data-action]').forEach(e=>e.classList.remove('held'));}
function pause(){running=false;acc=0;last=0;release();$('pause').textContent='Resume';$('state').textContent='PAUSED';}
function play(){started=true;running=true;last=0;acc=0;$('welcome').hidden=true;$('pause').textContent='Pause';canvas.focus({preventScroll:true});}
$('camera').textContent=viewMode==='ride'?'Study view':'Ride view';
$('start').onclick=play;$('pause').onclick=()=>running?pause():play();
function stateSummary(){return {ticks:tick,parameters:{stiff,depth:true},inspection:body.inspect(),points:body.p.map(({x,y,vx,vy,m,cover,contact})=>({x,y,vx,vy,m,cover,contact})),height:[...body.h],verticalVelocity:[...body.vh],phase:body.phase,burial:body.burial,rise:body.rise,wasDive:body.wasDive,lostWallSeconds:lostTime};}
function newRun(){if(tick)runs.push({events:[...events],final:stateSummary()});events=[];lastInput='';body=new SandBody({depth:true,stiff});tick=0;trace=[];lastTrace=0;lostTime=0;camera={x:0,y:0,angle:0};release();play();note('Fresh run. Earlier attempts stay in this session’s export.');}
$('reset').onclick=newRun;
$('export').onclick=()=>{const data={schema:BODY_SCHEMA,kind:'local trial replay and state; not independent verification',notes:'Model units mapped to an illustrative 200 m rest length. No car saves are read or written.',runs:[...runs,{events:[...events],final:stateSummary()}]};const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download='City-Fare-Sand-Power-motion-001-run-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);note('Run exported. It includes inputs, settings and the final tissue state.');};
$('inspect').onclick=()=>{inspect=!inspect;$('inspect').setAttribute('aria-pressed',String(inspect));};
$('camera').onclick=()=>{viewMode=viewMode==='ride'?'study':'ride';$('camera').textContent=viewMode==='ride'?'Study view':'Ride view';};
for(const e of document.querySelectorAll('[data-stiff]'))e.onclick=()=>{stiff=Number(e.dataset.stiff);body.stiff=stiff;document.querySelectorAll('[data-stiff]').forEach(n=>{n.classList.toggle('selected',n===e);n.setAttribute('aria-pressed',String(n===e));});note(stiff>1?'The middle now resists bending. Muscle force stays the same.':'Middle released. Same muscles, more compliant tissue.');};
for(const e of document.querySelectorAll('[data-action]')){
 e.addEventListener('pointerdown',ev=>{ev.preventDefault();if(!started)play();if(!running)return;e.setPointerCapture(ev.pointerId);pointers.set(ev.pointerId,e.dataset.action);e.classList.add('held');});
 const up=ev=>{pointers.delete(ev.pointerId);if(![...pointers.values()].includes(e.dataset.action))e.classList.remove('held');};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])e.addEventListener(type,up);
}
const gameKeys=['KeyA','KeyD','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'];
addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(gameKeys.includes(e.code)){if(e.code==='Space'&&e.target.tagName==='BUTTON')return;e.preventDefault();if(running)keys.add(e.code);}if(e.code==='KeyP'&&!e.repeat){e.preventDefault();running?pause():play();}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{if(running)pause();else release();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause();});
function simulate(){const u=input(),key=JSON.stringify([u,stiff]);if(key!==lastInput){events.push({tick,input:u,stiff});lastInput=key;}body.step(u);tick++;
 if(tick-lastTrace>=18){lastTrace=tick;const q=body.shape();for(let i=2;i<q.length;i+=3){if(body.p[i*2].contact>.2&&Math.hypot(body.p[i*2].vx,body.p[i*2].vy)>.025)trace.push({x:q[i].x,y:q[i].y,r:q[i].r,time:body.time});}if(trace.length>2400)trace.splice(0,trace.length-2400);}
}
function projectSetup(dt){const center=body.com(),q=body.shape();let desired=Math.atan2(q[0].y-q[24].y,q[0].x-q[24].x);
 if(viewMode==='study')desired=0;
 let delta=Math.atan2(Math.sin(desired-camera.angle),Math.cos(desired-camera.angle));camera.angle+=delta*(1-Math.exp(-dt*.7));
 camera.x=mix(camera.x,center.x,1-Math.exp(-dt*3));camera.y=mix(camera.y,center.y,1-Math.exp(-dt*3));
 const fx=Math.cos(camera.angle),fy=Math.sin(camera.angle),height=body.ground(camera.x,camera.y);
 const back=viewMode==='study'?3:10.5,up=viewMode==='study'?20:10.0;
 const eye=[camera.x-fx*back,camera.y-fy*back,height+up];const focus=[camera.x+fx*1.5,camera.y+fy*1.5,height];
 let dx=focus[0]-eye[0],dy=focus[1]-eye[1],dz=focus[2]-eye[2],len=Math.hypot(dx,dy,dz);dx/=len;dy/=len;dz/=len;
 const right=[-fy,fx,0],vup=[-dz*fx,-dz*fy,Math.hypot(dx,dy)];
 const focal=Math.min(W*1.0,H*.85),cx=W*.5,cy=H*(H<W?.51:.49);
 return (x,y,z)=>{const v=[x-eye[0],y-eye[1],z-eye[2]],depth=v[0]*dx+v[1]*dy+v[2]*dz;if(depth<=.12)return null;return {x:cx+(v[0]*right[0]+v[1]*right[1])*focal/depth,y:cy-(v[0]*vup[0]+v[1]*vup[1]+v[2]*vup[2])*focal/depth,d:depth};};
}
function polygon(points,color,stroke){if(points.some(p=>!p))return;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke();}}
function rng(x,y){const a=Math.sin(x*127.1+y*311.7)*43758.5453;return a-Math.floor(a);}
function groundColor(x,y){const h=body.ground(x,y);const slope=(body.ground(x+.15,y)-body.ground(x-.15,y))/.3;const a=clamp(.75+slope*.65+h*.045,.55,1.0);return `rgb(${Math.round(189*a)},${Math.round(144*a)},${Math.round(104*a)})`;}
function clipGround(poly){let result=[];for(let i=0;i<poly.length;i++){
 const a=poly[i],b=poly[(i+1)%poly.length],da=a[2]-body.ground(a[0],a[1]),db=b[2]-body.ground(b[0],b[1]);
 if(da>=0)result.push(a);if((da>=0)!==(db>=0)){let t=da/(da-db);result.push(a.map((v,k)=>mix(v,b[k],t)));}
 }return result;}
function render(dt){const t0=performance.now(),proj=projectSetup(dt),q=body.shape();ctx.setTransform(DPR,0,0,DPR,0,0);
 let sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#171f2c');sky.addColorStop(.35,'#6f4e46');sky.addColorStop(.65,'#d0a078');sky.addColorStop(1,'#b18761');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 const sunX=W*.79,sunY=H*.20,r=Math.min(W,H)*.055;
 let glow=ctx.createRadialGradient(sunX,sunY,r*.2,sunX,sunY,r*4);glow.addColorStop(0,'#ffd19ca8');glow.addColorStop(1,'#e9976300');ctx.fillStyle=glow;ctx.fillRect(sunX-r*4,sunY-r*4,r*8,r*8);ctx.fillStyle='#e2b68c';ctx.beginPath();ctx.arc(sunX,sunY,r,0,TAU);ctx.fill();
 const faces=[],step=1.7,ix=Math.floor(camera.x/step),iy=Math.floor(camera.y/step),size=16;
 for(let i=ix-size;i<=ix+size;i++)for(let j=iy-size;j<=iy+size;j++){
  const x=i*step,y=j*step,raw=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]],p=raw.map(([a,b])=>proj(a,b,body.ground(a,b)));
  if(p.every(Boolean)&&p.some(a=>a.x>-300&&a.x<W+300&&a.y>-200&&a.y<H+200))faces.push({p,d:p.reduce((s,a)=>s+a.d,0)/4,col:groundColor(x,y)});
 }
 faces.sort((a,b)=>b.d-a.d);for(const f of faces){polygon(f.p,f.col,f.col);}
 // Ripples and small land markers carry scale; they are display geometry only.
 ctx.lineWidth=.6;
 for(let i=ix-14;i<ix+15;i+=1)for(let j=iy-14;j<iy+15;j+=2){
  const x=i*step+.6,y=j*step,rnd=rng(i,j);const a=proj(x-.35,y,body.ground(x-.35,y)+.008),b=proj(x+.35,y+.10,body.ground(x+.35,y+.10)+.008);
  if(a&&b){ctx.strokeStyle='#efc49b20';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  if(rnd>.78){const p=proj(x,y,body.ground(x,y)),u=proj(x,y,body.ground(x,y)+.09);if(p&&u){ctx.strokeStyle='#6c65526b';ctx.lineWidth=Math.max(1,18/p.d);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(u.x,u.y);ctx.stroke();}}
 }
 for(const p of trace){const a=proj(p.x,p.y,body.ground(p.x,p.y)+.008);if(a){ctx.fillStyle='#372c241c';ctx.beginPath();ctx.ellipse(a.x,a.y,Math.max(1,100*p.r/a.d),Math.max(.5,28*p.r/a.d),0,0,TAU);ctx.fill();}}
 // Explicit study guide, not an asserted terrain displacement or physical wake.
 const buriedCount=q.filter((p,i)=>body.h[i]+p.r<body.ground(p.x,p.y)).length;
 if(buriedCount>8){
  ctx.setLineDash([5,7]);ctx.lineWidth=2;ctx.strokeStyle='#ecd3a391';ctx.beginPath();
  for(let i=0;i<q.length;i++){const p=q[i],a=proj(p.x,p.y,body.ground(p.x,p.y)+.02);if(a){i?ctx.lineTo(a.x,a.y):ctx.moveTo(a.x,a.y);}}ctx.stroke();ctx.setLineDash([]);
 }
 const parts=[];
 for(let i=24;i>=0;i--){
  const p=q[i],prev=q[Math.max(0,i-1)],next=q[Math.min(24,i+1)],angle=Math.atan2(prev.y-next.y,prev.x-next.x),tx=Math.cos(angle),ty=Math.sin(angle),nx=-ty,ny=tx,h=body.h[i],width=p.r;
  // Draw a flexible tissue envelope from its actual cross-section state.
  for(let j=0;j<10;j++){
   const a=TAU*j/10,b=TAU*(j+1)/10;
   const vertices=[];for(const [long,ang] of [[-.27,a],[.27,a],[.27,b],[-.27,b]])vertices.push([p.x+tx*long+nx*Math.cos(ang)*width,p.y+ty*long+ny*Math.cos(ang)*width,h+Math.sin(ang)*width]);
   let visible=clipGround(vertices);if(visible.length<3)continue;const pp=visible.map(v=>proj(...v));if(pp.some(a=>!a))continue;
   const col=palette[i%palette.length],cover=body.p[i*2].cover,shade=.65+.35*Math.max(0,Math.sin((a+b)/2));
   const sand=[194,158,112],rgb=col.map((c,k)=>Math.round(mix(c,sand[k],cover)*shade));
   parts.push({p:pp,d:pp.reduce((s,a)=>s+a.d,0)/pp.length,c:`rgb(${rgb.join(',')})`,stroke:'#07252728'});
  }
  // Rigid short dorsal plates: fixed piece dimensions; they rotate and overlap,
  // they do not stretch to enforce the motion of the underlying tissue.
  const plateR=body.p[i*2].r*.86;
  for(let j=0;j<5;j++){
   const a=.16+Math.PI*j/5,b=.16+Math.PI*(j+1)/5;
   const verts=[];for(const [long,ang]of [[-.20,a],[.20,a],[.20,b],[-.20,b]])verts.push([p.x+tx*long+nx*Math.cos(ang)*plateR,p.y+ty*long+ny*Math.cos(ang)*plateR,h+.10+Math.sin(ang)*plateR]);
   let clip=clipGround(verts);if(clip.length<3)continue;const pp=clip.map(v=>proj(...v));if(pp.some(a=>!a))continue;
   const c=palette[(i+2)%5],cover=body.p[2*i].cover,rgb=c.map((v,k)=>Math.round(mix(v+14,[205,170,125][k],cover)));
   parts.push({p:pp,d:pp.reduce((s,a)=>s+a.d,0)/pp.length,c:`rgb(${rgb.join(',')})`,stroke:'#d4ae686b'});
  }
 }
 parts.sort((a,b)=>b.d-a.d);for(const f of parts)polygon(f.p,f.c,f.stroke);
 if(inspect){
  for(let i=0;i<25;i++){const l=body.p[2*i],r=body.p[2*i+1];const a=proj(l.x,l.y,body.h[i]+.1),b=proj(r.x,r.y,body.h[i]+.1);if(a&&b){ctx.strokeStyle=stiff>1&&i>8&&i<17?'#ffbb78':'#b4faf0';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
  for(const side of[0,1]){ctx.beginPath();for(let i=0;i<25;i++){const p=body.p[2*i+side],a=proj(p.x,p.y,body.h[i]+.13);if(a){i?ctx.lineTo(a.x,a.y):ctx.moveTo(a.x,a.y);}}ctx.strokeStyle='#abeee4b0';ctx.lineWidth=1;ctx.stroke();}
 }
 // Tiny rider is a marker. It disappears into the unmodelled refuge on burial.
 const rider=q[3],rh=body.h[3]+body.p[6].r+.12;
 if(rh>body.ground(rider.x,rider.y)+.1){const a=proj(rider.x,rider.y,rh),b=proj(rider.x,rider.y,rh+.108);if(a&&b){ctx.strokeStyle='#fff3c6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='#e4c99d';ctx.beginPath();ctx.arc(b.x,b.y,2,0,TAU);ctx.fill();}}
 if(running||!started){const v=body.inspect();$('speed').textContent=Math.round(v.speed*METERS*3.6);$('effort').style.width=(v.effort*100)+'%';$('distance').textContent=Math.round(body.distance*METERS)+' m';const sub=body.h.filter((h,i)=>h+q[i].r<body.ground(q[i].x,q[i].y)).length;$('state').textContent=sub>18?'BURIED · DOTTED STUDY GUIDE':input().dive?'DIVING':body.rise>0?'RISING':input().coast?'COASTING':'WHOLE BODY · IN MOTION';$('load').textContent=stiff>1?'STIFF MIDDLE':'SUPPLE BODY';}
 renderCount++;frameTimes.push(performance.now()-t0);if(frameTimes.length>180)frameTimes.shift();
}
function frame(t){const real=last?(t-last)/1000:0;last=t;if(running){if(real>.35){pause();note('Paused after a long frame. No catch-up jump.');}else{acc+=Math.max(0,real);let steps=0;try{while(acc>=1/240&&steps<24){simulate();acc-=1/240;steps++;}if(acc>=1/240){lostTime+=acc;acc=0;}}catch(e){pause();note('Trial stopped safely: '+e.message);console.error(e);}}}render(Math.min(.05,Math.max(.001,real)));requestAnimationFrame(frame);}
window.SandPower=Object.freeze({inspect:()=>({...body.inspect(),tick,running,started,stiff,depth:body.h.map((h,i)=>h-body.ground(body.shape()[i].x,body.shape()[i].y)),renderFrames:renderCount,meanRenderMs:frameTimes.reduce((s,v)=>s+v,0)/Math.max(1,frameTimes.length),lostWallSeconds:lostTime,inputs:input(),events:events.length,archivedRuns:runs.length}),exportState:()=>stateSummary()});
requestAnimationFrame(frame);
})();
