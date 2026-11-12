/* A directly rendered view of Body tissue state. No hidden head-driving path. */
(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('view'),ctx=canvas.getContext('2d',{alpha:false});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2, METERS=200/12, BODY_SCHEMA='city-fare-sand-power-motion-002/1';
let body=new SandBody({depth:true}),running=false,started=false,tick=0,acc=0,last=0,lostTime=0;
let keys=new Set(),pointers=new Map(),camera={x:0,y:0,angle:0},W=1,H=1,DPR=1;
let trace=[],lastTrace=0,inspect=false,viewMode=matchMedia('(prefers-reduced-motion: reduce)').matches?'study':'close',stiff=1,frameTimes=[],renderCount=0;
let runs=[],events=[],lastInput='',toastTimer=null;
const scene=new SandScene(canvas,ctx);let landmarks=true;
const palette=[[55,113,115],[50,100,108],[68,133,125],[55,112,124],[77,139,130]];
function note(text){$('notice').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('notice').textContent=''},5500);}
function size(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,1.65);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);}
addEventListener('resize',size);size();
function input(){const has=(...names)=>names.some(n=>keys.has(n)||[...pointers.values()].includes(n));return {surge:has('surge','KeyW','ArrowUp'),left:has('left','KeyA','ArrowLeft'),right:has('right','KeyD','ArrowRight'),dive:has('dive','KeyS','ArrowDown'),coast:has('coast','Space')};}
function release(){keys.clear();pointers.clear();document.querySelectorAll('[data-action]').forEach(e=>e.classList.remove('held'));}
function pause(){running=false;acc=0;last=0;release();$('pause').textContent='Resume';$('state').textContent='PAUSED';}
function play(){started=true;running=true;last=0;acc=0;$('welcome').hidden=true;$('pause').textContent='Pause';canvas.focus({preventScroll:true});}
$('camera').textContent=viewMode==='close'?'View: close':viewMode==='wide'?'View: wide':'View: study';
$('start').onclick=play;$('pause').onclick=()=>running?pause():play();
function stateSummary(){return {ticks:tick,parameters:{stiff,depth:true},inspection:body.inspect(),points:body.p.map(({x,y,vx,vy,m,cover,contact})=>({x,y,vx,vy,m,cover,contact})),height:[...body.h],verticalVelocity:[...body.vh],phase:body.phase,burial:body.burial,rise:body.rise,wasDive:body.wasDive,lostWallSeconds:lostTime};}
function newRun(){if(tick)runs.push({events:[...events],final:stateSummary()});events=[];lastInput='';body=new SandBody({depth:true,stiff});tick=0;trace=[];lastTrace=0;lostTime=0;camera={x:0,y:0,angle:0};scene.reset();release();play();note('Fresh run. Earlier attempts stay in this session’s export.');}
$('reset').onclick=newRun;
$('export').onclick=()=>{const data={schema:BODY_SCHEMA,kind:'local trial replay and state; not independent verification',notes:'Model units mapped to an illustrative 200 m rest length. No car saves are read or written.',runs:[...runs,{events:[...events],final:stateSummary()}]};const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download='City-Fare-Sand-Power-motion-002-run-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);note('Run exported. It includes inputs, settings and the final tissue state.');};
$('inspect').onclick=()=>{inspect=!inspect;$('inspect').setAttribute('aria-pressed',String(inspect));};
$('camera').onclick=()=>{viewMode={close:'wide',wide:'study',study:'close'}[viewMode];$('camera').textContent='View: '+viewMode;};
$('landmarks').onclick=()=>{landmarks=!landmarks;$('landmarks').textContent='Landmarks: '+(landmarks?'on':'off');$('landmarks').setAttribute('aria-pressed',String(landmarks));};
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
function render(dt){
 const t0=performance.now();scene.render(body,{dt,W,H,DPR,mode:viewMode,landmarks,inspect,stiff});
 if(running||!started){const v=body.inspect(),q=body.shape();$('speed').textContent=Math.round(v.speed*METERS*3.6);$('effort').style.width=(v.effort*100)+'%';$('distance').textContent=Math.round(body.distance*METERS)+' m';const sub=body.h.filter((h,i)=>h+q[i].r<body.ground(q[i].x,q[i].y)).length;$('state').textContent=sub>18?'BURIED · STUDY OUTLINE':input().dive?'DIVING':body.rise>0?'RISING':input().coast?'COASTING':'SURFACE RUN';$('load').textContent=stiff>1?'STIFF MIDDLE':'SUPPLE BODY';}
 renderCount++;frameTimes.push(performance.now()-t0);if(frameTimes.length>180)frameTimes.shift();
}
function frame(t){const real=last?(t-last)/1000:0;last=t;if(running){if(real>.35){pause();note('Paused after a long frame. No catch-up jump.');}else{acc+=Math.max(0,real);let steps=0;try{while(acc>=1/240&&steps<24){simulate();acc-=1/240;steps++;}if(acc>=1/240){lostTime+=acc;acc=0;}}catch(e){pause();note('Trial stopped safely: '+e.message);console.error(e);}}}render(Math.min(.05,Math.max(.001,real)));requestAnimationFrame(frame);}
window.SandPower=Object.freeze({inspect:()=>({...body.inspect(),tick,running,started,stiff,view:{...scene.metrics},depth:body.h.map((h,i)=>h-body.ground(body.shape()[i].x,body.shape()[i].y)),renderFrames:renderCount,meanRenderMs:frameTimes.reduce((s,v)=>s+v,0)/Math.max(1,frameTimes.length),lostWallSeconds:lostTime,inputs:input(),events:events.length,archivedRuns:runs.length}),exportState:()=>stateSummary()});
requestAnimationFrame(frame);
})();
