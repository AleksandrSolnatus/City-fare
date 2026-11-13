/* A bounded, reversible walk on rendered terrain. Lift remains in the shared vehicle simulation. */
(function(root){'use strict';
const GPU=typeof module!=='undefined'&&module.exports?require('./gpu.js'):root.SDGPU;
const Geometry=typeof module!=='undefined'&&module.exports?require('./geometry.js'):root.SDGeometry;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t,EYE=1.7,RADIUS=.35;
const ARRIVAL=Object.freeze({x:-2800,y:-2200,yaw:Math.atan2(3200,4800),walkRadius:65,apron:Object.freeze({f:-6,r:0,length:22,width:15}),solids:Object.freeze([
 {id:'rear-wall',f:-15.2,r:0,length:.4,width:9,height:3.6,base:0},
 {id:'side-left',f:-10.7,r:-4.5,length:9.4,width:.4,height:3.6,base:0},
 {id:'side-right',f:-10.7,r:4.5,length:9.4,width:.4,height:3.6,base:0},
 {id:'front-left',f:-6,r:-3.4,length:.4,width:2.2,height:3.6,base:0},
 {id:'front-right',f:-6,r:3.4,length:.4,width:2.2,height:3.6,base:0},
 {id:'roof',f:-10.6,r:0,length:10,width:9.8,height:.25,base:3.6},
 {id:'receiving-console',f:-12,r:-3.4,length:1.4,width:1,height:1,base:0},
 {id:'bench',f:-9.4,r:3.7,length:3,width:.65,height:.55,base:0},
 {id:'lantern',f:-5,r:-6,length:.35,width:.35,height:3.2,base:0}
].map(Object.freeze))});
function point(f,r,origin=ARRIVAL){const cs=Math.cos(origin.yaw),sn=Math.sin(origin.yaw);return {x:origin.x+f*cs-r*sn,y:origin.y+f*sn+r*cs};}
const ground=(world,x,y)=>GPU.meshSample(world,x,y);
function facilities(world){return ARRIVAL.solids.map(s=>{const p=point(s.f,s.r);return {...s,...p,z:ground(world,p.x,p.y)+s.base,yaw:ARRIVAL.yaw};});}
// Exact camera path shared by rendering and interaction admission.
function cameraPose(chase,arrival,world){
 chase=arrival?.chase||chase;
 const normal={...chase,pitch:-.16,near:.8};
 if(!arrival||!arrival.walker||arrival.driveBlend>=1)return normal;
 const eye=arrival.walker,t=clamp(arrival.driveBlend||0,0,1),move=clamp((t-.22)/.78,0,1),travel=move*move*(3-2*move),angle=Math.atan2(Math.sin(chase.yaw-eye.yaw),Math.cos(chase.yaw-eye.yaw));
 const cam={...normal,x:mix(eye.x,chase.x,travel),y:mix(eye.y,chase.y,travel),z:mix(eye.z,chase.z,t)+4*Math.sin(Math.PI*t)**2,yaw:eye.yaw+angle*t,pitch:mix(eye.pitch||0,-.16,t),near:mix(.12,.8,t)};
 if(t>0&&t<1)cam.z=Math.max(cam.z,ground(world,cam.x,cam.y)+1.7);
 return cam;
}
function segmentHitsSolid(a,b,solid,pad=.18){
 const local=p=>{const dx=p.x-solid.x,dy=p.y-solid.y,cs=Math.cos(solid.yaw),sn=Math.sin(solid.yaw);return [dx*cs+dy*sn,-dx*sn+dy*cs,p.z-solid.z];};
 const p=local(a),q=local(b),lo=[-solid.length/2-pad,-solid.width/2-pad,-pad],hi=[solid.length/2+pad,solid.width/2+pad,solid.height+pad];let enter=0,leave=1;
 for(let i=0;i<3;i++){const d=q[i]-p[i];if(Math.abs(d)<1e-9){if(p[i]<lo[i]||p[i]>hi[i])return false;}else{let x=(lo[i]-p[i])/d,y=(hi[i]-p[i])/d;if(x>y)[x,y]=[y,x];enter=Math.max(enter,x);leave=Math.min(leave,y);if(enter>leave)return false;}}return true;
}
// The renderer consumes these same legacy station/world boxes. They now also bound short walks.
function stationSolids(game){
 const out=[],w=game.world,g=(x,y)=>ground(w,x,y),noise=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
 const box=(id,x,y,z,length,width,height,colors,landmark=false)=>out.push({id,x,y,z,length,width,height,colors,yaw:0,landmark});
 for(const [i,p]of(w.landmarks||[]).entries()){if(p.type==='city')continue;const z=g(p.x,p.y),h=p.height||4,id='landmark-'+i;if(p.type==='cactus'){box(id,p.x,p.y,z,.65,.65,h,['#6d7661','#525e52','#a5a27b'],true);box(id+'-arm',p.x,p.y,z+h*.55,2.5,.45,.45,['#69735c','#525e52','#a5a27b']);box(id+'-tip',p.x+1,p.y,z+h*.55,.4,.4,h*.3,['#69735c','#525e52','#a5a27b']);}else if(p.type==='post'){box(id,p.x,p.y,z,.25,.25,h,['#b9ad8f','#796a5a','#eee0b3'],true);}else{box(id,p.x,p.y,z,7,5,h,['#c4a179','#967c67','#e6c59a'],true);box(id+'-roof',p.x,p.y,z+h,8,6,.3,['#866e5a','#66594e','#bba786']);}}
 for(const p of game.places||[]){if(p.kind==='city'||p.id==='dock')continue;const x=p.x+32,y=p.y+26,z=g(x,y),id=p.id;if(p.kind==='lookout'){box(id,x,y,z,18,3,1.2,['#847466','#695f59','#bba78c']);for(const dx of[-8,8])box(id+'-post'+dx,x+dx,y,z,1,1,4,['#9c8a71','#746b60','#d0bb95']);}else{box(id,x,y,z,16,8,6,['#c3a57d','#81796c','#e6cda0']);box(id+'-roof',x-6,y-9,g(x-6,y-9)+5,27,18,.5,['#897c68','#6c6860','#c0ae88']);for(const dx of[-18,6])box(id+'-post'+dx,x+dx,y-16,g(x+dx,y-16),.6,.6,5,['#a38f6e','#71695c','#dfbd86']);}const lit=game.visitor?.delivery==='delivered';box(id+'-lamp',p.x+18,p.y+12,g(p.x+18,p.y+12),.5,.5,5,['#827b68','#655f54','#b4a37e']);box(id+'-light',p.x+18,p.y+12,g(p.x+18,p.y+12)+4.5,1.3,1.3,.7,lit?['#f1c97d','#d3aa64','#ffe2a0']:['#799b9b','#577679','#b5c9be']);}
 const city=w.city;for(let i=0;i<32;i++){const a=noise(i,7)*Math.PI*2,r=55+noise(i,9)*290,x=city.x+Math.cos(a)*r,y=city.y+Math.sin(a)*r,h=28+noise(i,21)*82;box('city-'+i,x,y,g(x,y),18+noise(i,3)*22,22,h,['#b98d74','#826b70','#efc894']);if(i%3===0)box('city-top-'+i,x,y,g(x,y)+h,5,6,8,['#d2a47d','#ad8374','#f8d59e']);}
 box('city-gate-left',city.x-28,city.y-85,g(city.x-28,city.y-85),15,15,35,['#c49a7b','#8b7270','#f3d6a4']);box('city-gate-right',city.x+28,city.y-85,g(city.x+28,city.y-85),15,15,35,['#c49a7b','#8b7270','#f3d6a4']);box('city-gate-top',city.x,city.y-85,g(city.x,city.y-85)+30,65,14,7,['#d1a880','#947a76','#f5dba9']);return out;
}
function rectangleDistance(x,y,b){const dx=x-b.x,dy=y-b.y,cs=Math.cos(b.yaw),sn=Math.sin(b.yaw),f=dx*cs+dy*sn,r=-dx*sn+dy*cs;return Math.hypot(Math.max(0,Math.abs(f)-b.length/2),Math.max(0,Math.abs(r)-b.width/2));}
function overlap(a,b){
 const axes=[a.yaw,a.yaw+Math.PI/2,b.yaw,b.yaw+Math.PI/2];
 return axes.every(t=>{const extent=q=>Math.abs(Math.cos(t-q.yaw))*q.length/2+Math.abs(Math.sin(t-q.yaw))*q.width/2;return Math.abs((a.x-b.x)*Math.cos(t)+(a.y-b.y)*Math.sin(t))<extent(a)+extent(b)+.08;});
}
function skimmer(c){return {...c,length:7.2,width:4.0,z:c.z-.8,height:2.0};}
const actions=['forward','backward','left','right','boost','brake','hop','lookLeft','lookRight','lookUp','lookDown'];
class ArrivalSession{
 constructor(game,{direct=false}={}){this.game=game;this.mode=direct?'drive':'walk';this.progress=direct?1:0;this.age=direct?2:0;this.armed=true;this.events=[];this.epoch=0;this.observedCamera=null;this.transitionChase=null;this.parkingRequested=false;this.pathCache=new Map();this.bounds={x:game.car.x,y:game.car.y,radius:ARRIVAL.walkRadius};this.solids=[...facilities(game.world),...stationSolids(game)];this.walker={x:0,y:0,z:0,yaw:0,pitch:0};this.placeWalker(-11,5);if(Math.hypot(game.car.x-ARRIVAL.x,game.car.y-ARRIVAL.y)<1){this.placeWalker(-13,0);this.walker.yaw=ARRIVAL.yaw+.14;}this.message='';game.parked=!direct;this.resetContact();}
 placeWalker(f,r){const c=this.game.car,p=point(f,r,c);this.walker={...p,z:ground(this.game.world,p.x,p.y)+EYE,yaw:Math.atan2(c.y-p.y,c.x-p.x),pitch:.04};}
 release(fresh=false){this.armed=fresh;this.game.car.hopHeld=false;this.game.car.boosting=false;this.game.car.throttle=0;}
 setMode(mode){if(mode==='entering'||mode==='exiting')this.transitionChase={...(this.observedCamera||this.chasePresets()[0])};else this.transitionChase=null;this.mode=mode;this.game.parked=mode==='walk'||mode==='exiting';this.epoch++;this.release();this.events.push({time:this.game.time,type:mode,x:this.walker.x,y:this.walker.y});}
 look(dx,dy){if(this.mode!=='walk'||!Number.isFinite(dx)||!Number.isFinite(dy))return;this.walker.yaw+=clamp(dx,-400,400)*.003;this.walker.pitch=clamp(this.walker.pitch-clamp(dy,-400,400)*.003,-1.05,1.05);}
 clearOfAnimal(x,y){const w=this.game.world;for(const animal of this.game.worms||[this.game.worm])for(const sections of [animal.sections,animal.previousSections||[]])for(let i=0;i<sections.length;i++){
  const a=sections[i],b=sections[Math.min(i+1,sections.length-1)],ra=Geometry.sectionBound?Geometry.sectionBound(sections,i):a.r,rb=Geometry.sectionBound?Geometry.sectionBound(sections,Math.min(i+1,sections.length-1)):b.r,r=Math.max(ra,rb)+12;
  const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);if(Math.hypot(x-a.x-dx*t,y-a.y-dy*t)>=r)continue;
  if(a.z+ra<ground(w,a.x,a.y)-1&&b.z+rb<ground(w,b.x,b.y)-1)continue;return false;
 }return true;}
 walkable(x,y){const w=this.game.world,z=ground(w,x,y),e=.7;if(!Number.isFinite(z)||Math.max(Math.abs(x),Math.abs(y))>w.size/2-250)return false;const dx=(ground(w,x+e,y)-ground(w,x-e,y))/(2*e),dy=(ground(w,x,y+e)-ground(w,x,y-e))/(2*e);return Math.hypot(dx,dy)<=.65;}
 legal(x,y,{bounds=true,vehicle=true}={}){const w=this.game.world,z=ground(w,x,y);if(!this.walkable(x,y)||!this.clearOfAnimal(x,y))return false;if(bounds&&Math.hypot(x-this.bounds.x,y-this.bounds.y)>this.bounds.radius)return false;for(const b of this.solids){if(z+EYE>b.z&&z<b.z+b.height&&rectangleDistance(x,y,b)<RADIUS)return false;}if(vehicle&&rectangleDistance(x,y,skimmer(this.game.car))<RADIUS)return false;return true;}
 settled(target=this.game.parked?(this.game.car.parkClearance||.9):2.5){const c=this.game.car,clearance=c.z-this.game.world.height(c.x,c.y);return this.game.status==='playing'&&Math.hypot(c.vx,c.vy)<.15&&c.speed<.15&&Math.abs(c.vz)<.25&&c.hopPhase==='hover'&&Math.abs(clearance-target)<.22&&this.walkable(c.x,c.y);}
 resetContact(){const p=this.walker;this.contact={distance:0,moved:0,surface:this.game.world.metadata(p.x,p.y).substrate,footfalls:[],nextFootfall:1,trail:[{x:p.x,y:p.y,z:p.z-EYE}],returnDistance:0,returnClear:true};this.stride=0;this.routeClock=0;if(Math.hypot(this.game.car.x-ARRIVAL.x,this.game.car.y-ARRIVAL.y)<1&&Math.hypot(p.x-point(-13,0).x,p.y-point(-13,0).y)<1){this.contact.trail=[[0,4.1],[-4.8,4.1],[-4.8,0],[-13,0]].map(([f,r])=>{const q=point(f,r);return {...q,z:ground(this.game.world,q.x,q.y)};});}}
 returnRouteClear(){const t=[...this.contact.trail,{x:this.walker.x,y:this.walker.y}];for(let i=0;i<t.length;i++){const a=t[Math.max(0,i-1)],b=t[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));for(let j=0;j<=steps;j++){const q=j/steps;if(!this.legal(mix(a.x,b.x,q),mix(a.y,b.y,q),{bounds:false}))return false;}}return true;}
 recordWalk(previous,dt){const p=this.walker,c=this.contact,moved=Math.hypot(p.x-previous.x,p.y-previous.y);c.moved=moved;c.distance+=moved;c.surface=this.game.world.metadata(p.x,p.y).substrate;c.returnDistance=Math.hypot(p.x-this.game.car.x,p.y-this.game.car.y);this.stride+=moved;if(this.stride>=1.6){this.stride-=1.6;c.footfalls.push({id:c.nextFootfall++,time:this.game.time,x:p.x,y:p.y,z:p.z-EYE,surface:c.surface,speed:moved/dt});if(c.footfalls.length>80)c.footfalls.shift();}
  const t=c.trail,last=t[t.length-1];if(Math.hypot(p.x-last.x,p.y-last.y)>=.8){let near=-1;for(let i=t.length-3;i>=0;i--)if(Math.hypot(p.x-t[i].x,p.y-t[i].y)<.65){near=i;break;}if(near>=0)t.splice(near+1);t.push({x:p.x,y:p.y,z:p.z-EYE});}
  this.routeClock+=dt;if(this.routeClock>=.5){this.routeClock=0;c.returnClear=this.returnRouteClear();}
 }
 observeCamera(camera){if(camera&&Number.isFinite(camera.x)&&Number.isFinite(camera.y)&&Number.isFinite(camera.z))this.observedCamera={...camera};}
 chasePresets(){const c=this.game.car,w=this.game.world;return [[13,6.5],[18,8],[29,12]].map(([back,up])=>{const x=c.x-Math.cos(c.yaw)*back,y=c.y-Math.sin(c.yaw)*back;return {x,y,z:Math.max(c.z+up,w.terrain.height(x,y)+4),yaw:c.yaw,anchorX:c.x,anchorY:c.y,verticalSpeed:0,yawSpeed:0};});}
 pathAllowed(walker){
  // Admission tests the same pose that setMode freezes, not unused camera presets.
  const world=this.game.world,poses=[this.observedCamera||this.chasePresets()[0]];
  for(const chase of poses){const key=[walker.x,walker.y,walker.z,chase.x,chase.y,chase.z].map(v=>Math.round(v*100)).join(',');let clear=this.pathCache.get(key);if(clear===undefined){const nearby=this.solids.filter(b=>Math.hypot(b.x-walker.x,b.y-walker.y)<Math.hypot(chase.x-walker.x,chase.y-walker.y)+Math.max(b.length,b.width)+3);clear=true;let previous=cameraPose(chase,{walker,driveBlend:0},world);for(let i=1;i<=64&&clear;i++){const next=cameraPose(chase,{walker,driveBlend:i/64},world);if(nearby.some(b=>segmentHitsSolid(previous,next,b))){clear=false;break;}previous=next;}if(this.pathCache.size>128)this.pathCache.clear();this.pathCache.set(key,clear);}if(!clear)return false;}return true;
 }
 canEnter(){const c=this.game.car,p=this.walker;return this.mode==='walk'&&this.settled()&&Math.hypot(p.x-c.x,p.y-c.y)<=6&&rectangleDistance(p.x,p.y,skimmer(c))<=2.4&&this.legal(p.x,p.y)&&this.pathAllowed(p);}
 exitStatus(){
  const c=this.game.car,w=this.game.world,fail=(reason,message)=>({ready:false,reason,message});
  if(this.mode!=='drive'||this.game.status!=='playing')return fail('settling','Wait for the skimmer transition to finish.');
  if(Math.hypot(c.vx,c.vy)>=.15||c.speed>=.15)return fail('moving',this.parkingRequested?'Braking to a stop · press E again once settled':'E · Brake and settle before stepping out');
  const target=this.game.parked?(c.parkClearance||this.game.parkingClearance()):2.5,clearance=c.z-w.height(c.x,c.y);
  if(c.hopPhase!=='hover'||clearance>Math.max(3.5,target+1))return fail('airborne','Airborne · wait for touchdown, then press E again');
  if(!this.walkable(c.x,c.y))return fail('steep','Ground too steep · move to gentler ground');
  if((this.parkingRequested&&!this.game.parked)||!this.settled(target))return fail('settling','Skimmer settling · press E again when ready');
  // Keep the original flat-ground step allowance (2.1 minus the .8m hull bottom),
  // measured at each real exit instead of rejecting every side on a slope.
  const parkedBottom=w.height(c.x,c.y)+this.game.parkingClearance()-.8;
  let animal=false,obstruction=false;
  for(const [f,r]of [[0,4.1],[0,-4.1],[-5.7,0],[5.7,0]]){
   const p=point(f,r,c),z=ground(w,p.x,p.y),walker={...p,z:z+EYE,yaw:Math.atan2(c.y-p.y,c.x-p.x),pitch:.04};
   if(!this.walkable(p.x,p.y)||Math.abs(parkedBottom-z)>1.3||![[.7,0],[-.7,0],[0,.7],[0,-.7]].every(([x,y])=>Math.abs(ground(w,p.x+x,p.y+y)-z)<.7))continue;
   if(!this.clearOfAnimal(p.x,p.y)){animal=true;continue;}
   if(!this.legal(p.x,p.y,{bounds:false})||!this.pathAllowed(walker)){obstruction=true;continue;}
   return {ready:true,reason:'ready',message:this.parkingRequested?'Parked and ready · press E to step out':'E · Settle and step out',point:walker};
  }
  if(animal)return fail('nearby-animal','Animal nearby · wait for a clear space beside the skimmer');
  if(obstruction)return fail('obstruction','Exit obstructed · move to open ground or clear the camera approach');
  return fail('steep','No gentle supported step · move to more level ground');
 }
 exitPoint(){return this.exitStatus().point||null;}
 canExit(){return this.exitStatus().ready;}
 requestStop(){if(this.mode!=='drive')return false;if(!this.parkingRequested){this.parkingRequested=true;this.release();}return true;}
 interact(){if(this.canEnter()){this.parkingRequested=false;this.progress=0;this.setMode('entering');this.message='';return true;}if(this.mode==='drive'){const status=this.exitStatus();if(status.ready){this.walker=status.point;this.bounds={x:this.game.car.x,y:this.game.car.y,radius:ARRIVAL.walkRadius};this.progress=1;this.resetContact();this.parkingRequested=false;this.setMode('exiting');this.message='';return true;}this.requestStop();this.message=status.message;}return false;}

 recover(){this.parkingRequested=false;this.transitionChase=null;this.observedCamera=null;this.pathCache.clear();this.mode='drive';this.progress=1;this.age=2;this.bounds={x:this.game.car.x,y:this.game.car.y,radius:ARRIVAL.walkRadius};this.placeWalker(0,4.1);this.game.parked=false;this.resetContact();this.epoch++;this.release();}
 step(input={},dt=1/60){dt=clamp(dt,0,.05);if(this.game.status!=='playing')return;this.age+=dt;this.contact.moved=0;const wasArmed=this.armed;if(!this.armed&&!actions.some(k=>input[k]))this.armed=true;const active=wasArmed?input:{};
  // A stop request has no automatic exit. Controls held across the request must
  // first release; a subsequent deliberate drive command cancels parking.
  if(this.mode==='drive'&&this.parkingRequested&&!active.brake&&['forward','backward','left','right','boost','hop'].some(k=>active[k])){this.parkingRequested=false;this.game.parked=false;this.message='';}
  if(this.mode==='drive'&&this.parkingRequested){const c=this.game.car;this.game.parked=Math.hypot(c.vx,c.vy)<.15&&c.hopPhase==='hover';}
  const before={...this.game.car};this.game.step(this.mode==='drive'&&!this.parkingRequested?active:{brake:true},dt);
  // Collision footprints are shared with rendered facility solids; a craft can fly over them.
  const c=this.game.car;for(const b of this.solids){if(b.id.startsWith('landmark-'))continue;if(Math.hypot(b.x-c.x,b.y-c.y)>Math.max(b.length,b.width)+12)continue;const steps=Math.max(1,Math.ceil(Math.hypot(c.x-before.x,c.y-before.y)/.5));let hit=false;for(let i=1;i<=steps;i++){const t=i/steps,q=skimmer({...c,x:before.x+(c.x-before.x)*t,y:before.y+(c.y-before.y)*t,z:before.z+(c.z-before.z)*t,yaw:before.yaw+(c.yaw-before.yaw)*t});if(q.z+q.height>b.z&&q.z<b.z+b.height&&overlap(q,b)){hit=true;break;}}if(hit){Object.assign(c,{x:before.x,y:before.y,z:before.z,yaw:before.yaw,vx:0,vy:0,vz:0,speed:0,throttle:0,boosting:false});break;}}
  if(this.mode==='entering'){this.progress=clamp(this.progress+dt/1.05,0,1);if(this.progress>=1&&this.settled(2.5))this.setMode('drive');return;}
  if(this.mode==='exiting'){this.progress=clamp(this.progress-dt/1.05,0,1);if(this.progress<=0&&this.settled(this.game.car.parkClearance||.9))this.setMode('walk');return;}
  if(this.mode!=='walk')return;
  const p=this.walker,previous={...p};p.z=ground(this.game.world,p.x,p.y)+EYE;p.yaw+=((active.lookRight?1:0)-(active.lookLeft?1:0))*1.65*dt;p.pitch=clamp(p.pitch+((active.lookUp?1:0)-(active.lookDown?1:0))*1.15*dt,-1.05,1.05);
  const f=(active.forward?1:0)-(active.backward?1:0),r=(active.right?1:0)-(active.left?1:0),scale=3.4*dt/(Math.hypot(f,r)||1),dx=(Math.cos(p.yaw)*f-Math.sin(p.yaw)*r)*scale,dy=(Math.sin(p.yaw)*f+Math.cos(p.yaw)*r)*scale;
  // A dense, loop-erased route records traversed ground; it can be retraced to the craft.
  // Sliding on each axis prevents snagging on corners and never crosses a solid.
  for(const axis of [0,1]){const x=p.x+(axis===0?dx:0),y=p.y+(axis===1?dy:0);if(this.legal(x,y)&&((this.contact.returnClear&&this.contact.trail.length<768)||Math.hypot(x-this.game.car.x,y-this.game.car.y)<Math.hypot(p.x-this.game.car.x,p.y-this.game.car.y))&&Math.abs(ground(this.game.world,x,y)+EYE-p.z)<.55){p.x=x;p.y=y;p.z=ground(this.game.world,x,y)+EYE;}}
  this.recordWalk(previous,dt);
 }
 prompt(){if(this.mode==='entering')return 'Lift rising · settling into the skimmer…';if(this.mode==='exiting')return 'Skimmer settling · stepping onto the ground…';if(this.mode==='walk'&&!this.contact.returnClear)return 'Route disturbed · retrace clear ground or use Recover at a station';if(this.mode==='walk')return this.canEnter()?'E · Enter skimmer':Math.hypot(this.walker.x-this.game.car.x,this.walker.y-this.game.car.y)<6?'Move around the skimmer to an open approach':this.contact.returnDistance>50?'Keep your skimmer in reach · follow your footprints back':'WASD walk · drag to look · approach the waiting skimmer';return this.exitStatus().message;}
 camera(){return {mode:this.mode,chase:this.transitionChase?{...this.transitionChase}:null,walker:{...this.walker},driveBlend:smooth(this.progress),materialize:clamp(this.age/1.3,0,1),layout:ARRIVAL};}
 snapshot(){return {...this.camera(),canEnter:this.canEnter(),canExit:this.canExit(),exitStatus:this.exitStatus(),parkingRequested:this.parkingRequested,prompt:this.prompt(),bounds:{...this.bounds},armed:this.armed,contact:{...this.contact,footfalls:this.contact.footfalls.map(e=>({...e})),trail:this.contact.trail.map(p=>({...p}))},events:this.events.map(e=>({...e}))};}
}
const api={ArrivalSession,ARRIVAL,ground,point,facilities,cameraPose,segmentHitsSolid,stationSolids,rectangleDistance,overlap,EYE};root.SDArrival=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
