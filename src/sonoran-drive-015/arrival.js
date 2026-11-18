/* A bounded, reversible walk on rendered terrain. Lift remains in the shared vehicle simulation. */
(function(root){'use strict';
const GPU=typeof module!=='undefined'&&module.exports?require('./gpu.js'):root.SDGPU;
const Geometry=typeof module!=='undefined'&&module.exports?require('./geometry.js'):root.SDGeometry;
const Buggy=typeof module!=='undefined'&&module.exports?require('./buggy.js'):root.SDBuggy;
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
const BAY_LAYOUT=Object.freeze([
 {id:'skimmer-bay',vehicleId:'skimmer-01',f:0,r:0,length:9.7,width:5.4},
 {id:'buggy-bay',vehicleId:'buggy-01',f:0,r:7.6,length:6.9,width:4.1}
].map(Object.freeze));
function bays(world){return BAY_LAYOUT.map(b=>{const p=point(b.f,b.r);return {...b,...p,yaw:ARRIVAL.yaw,z:ground(world,p.x,p.y)};});}
function vehicleBox(c){
 if(c.type==='buggy'){
  const {length,width,height,bottomOffset}=Buggy.BOUNDS;
  return {...c,length,width,height,z:c.z+bottomOffset};
 }
 return {...c,length:7.2,width:4,z:c.z-.8,height:2};
}
function boxesTouch(a,b){return a.z+a.height>b.z&&a.z<b.z+b.height&&overlap(a,b);}
const actions=['forward','backward','left','right','boost','brake','hop','descend','lookLeft','lookRight','lookUp','lookDown'];
const driveActions=actions.slice(0,8).filter(action=>action!=='brake');
const exits=c=>c.type==='buggy'?[[0,-3.5],[0,3.5],[-4.3,0],[4.3,0]]:[[0,4.1],[0,-4.1],[-5.7,0],[5.7,0]];
class ArrivalSession{
 constructor(game,{direct=false}={}){
  this.game=game;game.session=this;
  this.mode=direct?'drive':'walk';this.progress=direct?1:0;this.age=direct?2:0;this.armed=true;this.events=[];this.epoch=0;
  this.occupiedVehicleId=direct?game.car.id:null;this.lastVehicleId=this.occupiedVehicleId;this.pendingVehicleId=null;this.selectionId=null;
  this.observedCamera=null;this.transitionChase=null;this.chasePreset=0;this.parkingRequested=false;this.pathCache=new Map();
  this.solids=[...facilities(game.world),...stationSolids(game)];
  this.bounds=this.anchorBounds(direct?game.car:null);
  this.placeWalker(-11,5,game.car);
  if(Math.hypot(game.car.x-ARRIVAL.x,game.car.y-ARRIVAL.y)<1){this.placeWalker(-13,0,game.car);this.walker.yaw=ARRIVAL.yaw+.14;}
  this.message='';game.car.parked=!direct;this.resetContact();
 }
 get controlVehicle(){return this.game.focusVehicle;}
 get returnVehicle(){return this.game.vehicle(this.lastVehicleId);}
 get selectedVehicle(){return this.entryCandidate();}
 get flightAssist(){return !!this.game.occupiedVehicle?.flightAssist;}
 setFlightAssist(enabled){
  const c=this.game.occupiedVehicle;
  if(this.mode!=='drive'||!c||c.type!=='skimmer'||c.disabled||c.stranded)return false;
  const next=!!enabled;if(next===!!c.flightAssist)return true;
  c.flightAssist=next;c.flightLanding=!next;c.flightTarget=c.z;c.hopHeld=false;c.hopPending=0;
  if(next){this.parkingRequested=false;c.parked=false;}
  this.events.push({time:this.game.time,type:next?'flight-assist-on':'flight-assist-off',vehicleId:c.id});return true;
 }
 clearFlightAssist(c=this.controlVehicle){if(c.type==='skimmer'){c.flightAssist=false;c.flightLanding=false;c.flightTarget=null;}}
 anchorBounds(c){return {x:c?.x??ARRIVAL.x,y:c?.y??ARRIVAL.y,radius:ARRIVAL.walkRadius};}
 placeWalker(f,r,c=this.controlVehicle){const p=point(f,r,c);this.walker={...p,z:ground(this.game.world,p.x,p.y)+EYE,yaw:Math.atan2(c.y-p.y,c.x-p.x),pitch:.04};}
 release(fresh=false){
  this.armed=fresh;
  const c=this.controlVehicle;
  c.hopHeld=false;c.boosting=false;c.throttle=0;if(c.type==='skimmer')c.hopPending=0;
 }
 setMode(mode,c=this.controlVehicle,chase=null){
  this.transitionChase=chase;
  this.mode=mode;
  if(mode==='entering'){
   this.pendingVehicleId=c.id;this.clearFlightAssist(c);c.parked=false;
  }else if(mode==='drive'){
   this.occupiedVehicleId=c.id;this.lastVehicleId=c.id;this.pendingVehicleId=null;c.parked=false;
  }else if(mode==='exiting'){
   c.parked=true;this.clearFlightAssist(c);
  }else{
   this.occupiedVehicleId=null;this.pendingVehicleId=null;c.parked=true;this.clearFlightAssist(c);
  }
  this.selectionId=null;this.observedCamera=null;this.pathCache.clear();
  this.epoch++;this.release();
  this.events.push({time:this.game.time,type:mode,vehicleId:c.id,x:this.walker.x,y:this.walker.y});
 }
 look(dx,dy){if(this.mode!=='walk'||!Number.isFinite(dx)||!Number.isFinite(dy))return;this.walker.yaw+=clamp(dx,-400,400)*.003;this.walker.pitch=clamp(this.walker.pitch-clamp(dy,-400,400)*.003,-1.05,1.05);}
 clearOfAnimal(x,y){const w=this.game.world;for(const animal of this.game.worms||[this.game.worm])for(const sections of [animal.sections,animal.previousSections||[]])for(let i=0;i<sections.length;i++){
  const a=sections[i],b=sections[Math.min(i+1,sections.length-1)],ra=Geometry.sectionBound?Geometry.sectionBound(sections,i):a.r,rb=Geometry.sectionBound?Geometry.sectionBound(sections,Math.min(i+1,sections.length-1)):b.r,r=Math.max(ra,rb)+12;
  const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);if(Math.hypot(x-a.x-dx*t,y-a.y-dy*t)>=r)continue;
  if(a.z+ra<ground(w,a.x,a.y)-1&&b.z+rb<ground(w,b.x,b.y)-1)continue;return false;
 }return true;}
 walkable(x,y){const w=this.game.world,z=ground(w,x,y),e=.7;if(!Number.isFinite(z)||Math.max(Math.abs(x),Math.abs(y))>w.size/2-250)return false;const dx=(ground(w,x+e,y)-ground(w,x-e,y))/(2*e),dy=(ground(w,x,y+e)-ground(w,x,y-e))/(2*e);return Math.hypot(dx,dy)<=.65;}
 legal(x,y,{bounds=true,vehicle=true,ignoreVehicle=null}={}){
  const z=ground(this.game.world,x,y);
  if(!this.walkable(x,y)||!this.clearOfAnimal(x,y))return false;
  if(bounds&&Math.hypot(x-this.bounds.x,y-this.bounds.y)>this.bounds.radius)return false;
  const blocks=b=>z+EYE>b.z&&z<b.z+b.height&&rectangleDistance(x,y,b)<RADIUS;
  if(this.solids.some(blocks))return false;
  return !vehicle||!this.game.vehicles.some(c=>c.id!==ignoreVehicle&&blocks(vehicleBox(c)));
 }
 settled(target,c=this.controlVehicle){
  if(this.game.status!=='playing'||Math.hypot(c.vx,c.vy)>=.15||c.speed>=.15||Math.abs(c.vz)>=.25||c.hopPhase!=='hover'||!this.walkable(c.x,c.y))return false;
  if(c.type==='buggy')return c.grounded&&c.supportCount>=3&&!c.stranded&&Math.abs(c.z-Buggy.restHeight(this.game.world,c))<.25;
  const parked=c.parked?(c.parkClearance||.9):2.5;
  return Math.abs(c.z-this.game.world.height(c.x,c.y)-(target??parked))<.22;
 }
 resetContact(){const p=this.walker;this.contact={distance:0,moved:0,surface:this.game.world.metadata(p.x,p.y).substrate,footfalls:[],nextFootfall:1,trail:[{x:p.x,y:p.y,z:p.z-EYE}],returnDistance:0,returnClear:true};this.stride=0;this.routeClock=0;if(!this.returnVehicle&&Math.hypot(p.x-point(-13,0).x,p.y-point(-13,0).y)<1){this.contact.trail=[[0,4.1],[-4.8,4.1],[-4.8,0],[-13,0]].map(([f,r])=>{const q=point(f,r);return {...q,z:ground(this.game.world,q.x,q.y)};});}}
 returnSegmentClear(a,b,{ignoreVehicle=null,parkedBox=null}={}){
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(parkedBox ? .5 : 1)));
  for(let j=0;j<=steps;j++){
   const q=j/steps,x=mix(a.x,b.x,q),y=mix(a.y,b.y,q);
   if(!this.legal(x,y,{bounds:false,ignoreVehicle}))return false;
   if(parkedBox&&rectangleDistance(x,y,parkedBox)<RADIUS)return false;
  }
  return true;
 }
 returnRouteClear(){
  const points=[...this.contact.trail,this.walker];
  return points.every((p,i)=>this.returnSegmentClear(points[Math.max(0,i-1)],p));
 }
 recordWalk(previous,dt){const p=this.walker,c=this.contact,moved=Math.hypot(p.x-previous.x,p.y-previous.y);c.moved=moved;c.distance+=moved;c.surface=this.game.world.metadata(p.x,p.y).substrate;c.returnDistance=Math.hypot(p.x-this.bounds.x,p.y-this.bounds.y);this.stride+=moved;if(this.stride>=1.6){this.stride-=1.6;c.footfalls.push({id:c.nextFootfall++,time:this.game.time,x:p.x,y:p.y,z:p.z-EYE,surface:c.surface,speed:moved/dt});if(c.footfalls.length>80)c.footfalls.shift();}
  const t=c.trail,last=t[t.length-1];if(Math.hypot(p.x-last.x,p.y-last.y)>=.8){let near=-1;for(let i=t.length-3;i>=0;i--)if(Math.hypot(p.x-t[i].x,p.y-t[i].y)<.65){near=i;break;}if(near>=0)t.splice(near+1);t.push({x:p.x,y:p.y,z:p.z-EYE});}
  this.routeClock+=dt;if(this.routeClock>=.5){this.routeClock=0;c.returnClear=this.returnRouteClear();}
 }
 setChasePreset(index){
  if(![0,1,2].includes(index)||index===this.chasePreset)return;
  this.chasePreset=index;this.observedCamera=null;this.pathCache.clear();
  if(this.transitionChase)this.transitionChase=this.chaseFor(this.controlVehicle);
 }
 observeCamera(camera){
  if(camera&&Number.isFinite(camera.x)&&Number.isFinite(camera.y)&&Number.isFinite(camera.z)){
   this.observedCamera={...camera};this.observedVehicleId=this.controlVehicle.id;this.observedPreset=this.chasePreset;
  }
 }
 chasePresets(c=this.controlVehicle){
  const w=this.game.world,offsets=c.type==='buggy'?[[6.8,3.3],[8.8,4],[15,6.3]]:[[13,6.5],[18,8],[29,12]];
  return offsets.map(([back,up])=>{const x=c.x-Math.cos(c.yaw)*back,y=c.y-Math.sin(c.yaw)*back;return {x,y,z:Math.max(c.z+up,w.terrain.height(x,y)+4),yaw:c.yaw,anchorX:c.x,anchorY:c.y,verticalSpeed:0,yawSpeed:0};});
 }
 chaseFor(c){return (this.observedVehicleId===c.id&&this.observedPreset===this.chasePreset&&this.observedCamera)||this.chasePresets(c)[this.chasePreset];}
 obstacles(c){return [...this.solids,...this.game.vehicles.filter(v=>v.id!==c.id).map(vehicleBox)];}
 pathAllowed(walker,c=this.controlVehicle,chase=this.chaseFor(c),{cache=true}={}){
  // Cache static camera obstructions only. Another vehicle can be recalled, so
  // its current volume is checked against the admitted path on every query.
  const world=this.game.world,key=[c.id,...[walker.x,walker.y,walker.z,chase.x,chase.y,chase.z].map(v=>Math.round(v*100))].join(',');
  const extent=Math.hypot(chase.x-walker.x,chase.y-walker.y);
  const reaches=b=>Math.hypot(b.x-walker.x,b.y-walker.y)<extent+Math.max(b.length,b.width)+3;
  const clearOf=nearby=>{
   if(!nearby.length)return true;
   let previous=cameraPose(chase,{walker,driveBlend:0},world);
   for(let i=1;i<=64;i++){
    const next=cameraPose(chase,{walker,driveBlend:i/64},world);
    if(nearby.some(b=>segmentHitsSolid(previous,next,b)))return false;
    previous=next;
   }
   return true;
  };
  let clear=cache?this.pathCache.get(key):undefined;
  if(clear===undefined){
   clear=clearOf(this.solids.filter(reaches));
   if(cache){if(this.pathCache.size>128)this.pathCache.clear();this.pathCache.set(key,clear);}
  }
  return clear&&clearOf(this.game.vehicles.filter(v=>v.id!==c.id).map(vehicleBox).filter(reaches));
 }
 entryCandidate(){
  if(this.mode!=='walk'||!this.legal(this.walker.x,this.walker.y))return null;
  const p=this.walker;
  const candidates=this.game.vehicles.flatMap(c=>{
   const dx=c.x-p.x,dy=c.y-p.y,distance=Math.hypot(dx,dy);
   if(distance>6||rectangleDistance(p.x,p.y,vehicleBox(c))>2.4||c.disabled||c.stranded||!this.settled(undefined,c))return [];
   const target={x:c.x,y:c.y,z:c.z+.5};
   if(this.obstacles(c).some(b=>segmentHitsSolid(p,target,b,.06))||!this.pathAllowed(p,c))return [];
   const turn=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-p.yaw),Math.cos(Math.atan2(dy,dx)-p.yaw)));
   return [{c,score:distance+1.55*turn}];
  }).sort((a,b)=>a.score-b.score||a.c.id.localeCompare(b.c.id));
  const previous=candidates.find(x=>x.c.id===this.selectionId),first=candidates[0];
  return (previous&&previous.score<=first.score+.4?previous:first)?.c||null;
 }
 canEnter(){return !!this.selectedVehicle;}
 exitStatus(){
  const c=this.game.occupiedVehicle,w=this.game.world,fail=(reason,message)=>({ready:false,reason,message});
  if(this.mode!=='drive'||this.game.status!=='playing'||!c)return fail('settling','Wait for the vehicle transition to finish.');
  if(Math.hypot(c.vx,c.vy)>=.15||c.speed>=.15)return fail('moving',this.parkingRequested?'Braking to a stop · press E again once settled':'E · Brake and settle before stepping out');
  const target=c.parked?(c.parkClearance||this.game.parkingClearance(c)):2.5,clearance=c.z-w.height(c.x,c.y);
  if(c.hopPhase!=='hover'||(c.type==='skimmer'&&clearance>Math.max(3.5,target+1)))return fail('airborne','Airborne · wait for touchdown, then press E again');
  if(!this.walkable(c.x,c.y))return fail('steep','Ground too steep · use Recover at a station');
  if((this.parkingRequested&&!c.parked)||!this.settled(target,c))return fail('settling',c.name+' settling · press E again when ready');
  const parkedBottom=c.type==='buggy'?c.z+Buggy.BOUNDS.bottomOffset:w.height(c.x,c.y)+this.game.parkingClearance(c)-.8;
  let animal=false,obstruction=false;
  for(const [f,r]of exits(c)){
   const p=point(f,r,c),z=ground(w,p.x,p.y),walker={...p,z:z+EYE,yaw:Math.atan2(c.y-p.y,c.x-p.x),pitch:.04};
   if(!this.walkable(p.x,p.y)||Math.abs(parkedBottom-z)>1.3||![[.7,0],[-.7,0],[0,.7],[0,-.7]].every(([x,y])=>Math.abs(ground(w,p.x+x,p.y+y)-z)<.7))continue;
   if(!this.clearOfAnimal(p.x,p.y)){animal=true;continue;}
   if(!this.legal(p.x,p.y,{bounds:false})||!this.pathAllowed(walker,c)){obstruction=true;continue;}
   return {ready:true,reason:'ready',message:this.parkingRequested?'Parked and ready · press E to step out':'E · Settle and step out',point:walker};
  }
  if(animal)return fail('nearby-animal','Animal nearby · wait for a clear space beside the '+c.name.toLowerCase());
  if(obstruction)return fail('obstruction','Exit obstructed · move to open ground or use Recover');
  return fail('steep','No gentle supported step · use Recover at a station');
 }
 exitPoint(){return this.exitStatus().point||null;}
 canExit(){return this.exitStatus().ready;}
 requestStop(){
  if(this.mode!=='drive')return false;
  if(this.flightAssist)this.setFlightAssist(false);
  if(!this.parkingRequested){this.parkingRequested=true;this.release();}
  return true;
 }
 interact(){
  const c=this.selectedVehicle;
  if(c){
   this.parkingRequested=false;this.progress=0;
   this.setMode('entering',c,this.chaseFor(c));this.message='';return true;
  }
  if(this.mode==='drive'){
   const c=this.game.occupiedVehicle,status=this.exitStatus();
   if(status.ready){
    this.walker=status.point;this.bounds=this.anchorBounds(c);this.progress=1;this.resetContact();
    this.parkingRequested=false;this.setMode('exiting',c,this.chaseFor(c));this.message='';return true;
   }
   this.requestStop();this.message=status.message;
  }
  return false;
 }
 resolveMotion(before,c){
  // Bound the travel of any horizontal corner, including rotation.
  const motion=Math.hypot(c.x-before.x,c.y-before.y,c.z-before.z);
  const shape=vehicleBox(c),radius=Math.hypot(shape.length,shape.width)/2;
  const rotation=radius*Math.abs(c.yaw-before.yaw),travel=motion+rotation;
  if(travel<1e-8)return;
  const tests=Math.max(1,Math.ceil(travel/.5)),obstacles=this.obstacles(c).filter(b=>(c.type==='buggy'||!b.landmark&&!b.id.startsWith('landmark-'))&&Math.hypot(b.x-before.x,b.y-before.y)<=Math.hypot(b.length,b.width)/2+radius+travel+.1);
  if(!obstacles.length)return;
  let last=before;
  for(let i=1;i<=tests;i++){
   const t=i/tests,pose={...c,x:mix(before.x,c.x,t),y:mix(before.y,c.y,t),z:mix(before.z,c.z,t),yaw:mix(before.yaw,c.yaw,t)};
   if(obstacles.some(b=>boxesTouch(vehicleBox(pose),b))){
    Object.assign(c,{x:last.x,y:last.y,z:last.z,yaw:last.yaw,vx:0,vy:0,vz:0,speed:0,throttle:0,boosting:false});
    if(c.type==='buggy')Buggy.refreshContacts(this.game.world,c);
    return;
   }
   last=pose;
  }
 }
 relocationPoses(place,c){
  const yaw=place.yaw??Math.atan2(this.game.world.city.y-place.y,this.game.world.city.x-place.x);
  if(place.id==='dock')return bays(this.game.world).filter(b=>b.vehicleId===c.id).map(({x,y,yaw})=>({x,y,yaw}));
  const side=c.type==='buggy'?1:-1;
  return [[0,side*6],[0,side*14],[-16,side*8],[16,side*8],[-22,0],[22,0]].map(([f,r])=>({...point(f,r,{...place,yaw}),yaw}));
 }
 relocationSpace(pose,c,{walker=true,requireReturn=false}={}){
  const w=this.game.world;
  if(!this.walkable(pose.x,pose.y)||!this.clearOfAnimal(pose.x,pose.y))return null;
  const support=c.type==='buggy'?Buggy.supportPose(w,pose):null;
  if(support&&!support.supported)return null;
  const c1={...c,...pose,z:support?.z??w.height(pose.x,pose.y)+2.5,pitch:support?.pitch??0,roll:support?.roll??0};
  const box=vehicleBox(c1),parkedBox={...box,z:Math.min(box.z,ground(w,pose.x,pose.y)+.05),height:box.height+1};
  if(this.obstacles(c).some(b=>boxesTouch(parkedBox,b)))return null;
  const feet=walker?[this.walker]:[];
  if(feet.some(p=>p.z>parkedBox.z&&p.z-EYE<parkedBox.z+parkedBox.height&&rectangleDistance(p.x,p.y,parkedBox)<RADIUS))return null;
  for(const [f,r]of exits(c1)){
   const p=point(f,r,c1),eye={...p,z:ground(w,p.x,p.y)+EYE,yaw:Math.atan2(c1.y-p.y,c1.x-p.x),pitch:.04};
   if(!this.legal(p.x,p.y,{bounds:false,ignoreVehicle:c.id})||!this.pathAllowed(eye,c1,this.chasePresets(c1)[this.chasePreset],{cache:false}))continue;
   if(!requireReturn||this.returnSegmentClear(eye,this.walker,{ignoreVehicle:c.id,parkedBox}))return {pose:c1,eye};
  }
  return null;
 }
 canRecall(id){
  const c=this.game.vehicle(id);
  return !!c&&c!==this.game.occupiedVehicle&&c.id!==this.pendingVehicleId&&['walk','drive'].includes(this.mode)&&['playing','docked'].includes(this.game.status)&&!!this.game.nearby?.();
 }
 recall(id){
  if(!this.canRecall(id)){this.message='Reach a station to recall an unoccupied vehicle.';return false;}
  const c=this.game.vehicle(id),place=this.game.nearby(),isAnchor=this.mode==='walk'&&this.returnVehicle===c;
  const poses=this.relocationPoses(place,c).filter(p=>!isAnchor||Math.hypot(p.x-this.walker.x,p.y-this.walker.y)<ARRIVAL.walkRadius);
  const findDestination=requireReturn=>{
   for(const pose of poses){
    const candidate=this.relocationSpace(pose,c,{walker:this.mode==='walk',requireReturn});
    if(candidate)return candidate;
   }
   return null;
  };
  let destination=findDestination(false);
  if(!destination){this.message=c.name+' bay is blocked · clear the area and try again';return false;}
  if(isAnchor){
   destination=findDestination(true);
   if(!destination){this.message='Move to an open approach before recalling your '+c.name.toLowerCase();return false;}
  }
  const from={x:c.x,y:c.y,z:c.z};
  this.game.placeVehicle(c,destination.pose);c.parked=true;
  this.selectionId=null;this.observedCamera=null;this.pathCache.clear();
  if(isAnchor){
   this.bounds=this.anchorBounds(c);
   this.contact.returnDistance=Math.hypot(this.walker.x-c.x,this.walker.y-c.y);
   const {eye}=destination,{x,y,z}=this.walker;
   this.contact.trail=[{x:eye.x,y:eye.y,z:eye.z-EYE},{x,y,z:z-EYE}];
   this.contact.returnClear=this.returnRouteClear();
  }
  this.message=c.name+' recalled to '+place.name;
  this.game.events.push({time:this.game.time,type:'recall',vehicleId:c.id,place:place.id,from,to:{x:c.x,y:c.y,z:c.z}});
  this.epoch++;this.armed=false;
  return true;
 }
 recover(){
  const oldMode=this.mode,c=this.game.occupiedVehicle||this.returnVehicle;
  const place=this.game.safeStation?.();
  if(!place){
   this.clearFlightAssist();this.parkingRequested=false;this.setMode('drive',c||this.game.car);
   this.bounds=this.anchorBounds(this.controlVehicle);this.placeWalker(...exits(this.controlVehicle)[0]);this.resetContact();return true;
  }
  let destination;
  if(c)destination=this.relocationPoses(place,c).map(p=>this.relocationSpace(p,c,{walker:false})).find(Boolean);
  else {
   const yaw=ARRIVAL.yaw;
   const locations=(place.id==='dock'?[[-13,0],[-3,2],[-17,9]]:[[0,0],[-8,0],[8,0],[0,8],[0,-8]]).map(([f,r])=>point(f,r,{...place,yaw}));
   const p=locations.find(p=>this.legal(p.x,p.y,{bounds:false}));
   if(p)destination={eye:{...p,z:ground(this.game.world,p.x,p.y)+EYE,yaw:place.id==='dock'?yaw+.14:yaw,pitch:.04}};
  }
  if(!destination){this.message='Recovery area blocked · both vehicles stayed where they were';return false;}
  const pending=this.game.vehicle(this.pendingVehicleId);
  if(pending&&pending!==c)pending.parked=true;
  if(c){this.game.placeVehicle(c,destination.pose,{repair:true,refresh:true});c.parked=true;}
  this.game.completeRecovery(place,c);
  this.parkingRequested=false;this.walker=destination.eye;this.observedCamera=null;this.pathCache.clear();
  this.bounds=c?this.anchorBounds(c):{x:place.x,y:place.y,radius:ARRIVAL.walkRadius};
  const driving=!!c&&['drive','exiting'].includes(oldMode);
  this.progress=driving?1:0;this.age=2;
  this.setMode(driving?'drive':'walk',c||this.game.car);this.resetContact();this.message=this.game.message;
  return true;
 }
 step(input={},dt=1/60){
  dt=clamp(dt,0,.05);if(this.game.status!=='playing'||!dt)return;
  this.age+=dt;this.contact.moved=0;
  const wasArmed=this.armed;if(!this.armed&&!actions.some(k=>input[k]))this.armed=true;
  const active=wasArmed?input:{};
  const c=this.controlVehicle;
  // Parking is stopped only by a fresh deliberate command, and exit always
  // requires a fresh interaction after the vehicle has settled.
  if(this.mode==='drive'){
   if(this.parkingRequested&&!active.brake&&driveActions.some(k=>active[k])&&!c.disabled&&!c.stranded){
    if(c.type==='skimmer'&&c.parked&&active.hop)c.hopPending=1.2;
    this.parkingRequested=false;c.parked=false;this.message='';
   }
   if(this.parkingRequested)c.parked=Math.hypot(c.vx,c.vy)<.15&&c.hopPhase==='hover';
  }
  this.game.step(this.mode==='drive'&&!this.parkingRequested&&wasArmed?active:{brake:true},dt);
  if(this.mode==='entering'||this.mode==='exiting'){
   const entering=this.mode==='entering';
   if((entering&&c.disabled)||!this.legal(this.walker.x,this.walker.y)||!this.pathAllowed(this.walker,c,this.transitionChase)){
    this.progress=entering?0:1;
    this.setMode(entering?'walk':'drive',c);
    this.message='Approach changed · wait for a clear space';return;
   }
   this.progress=clamp(this.progress+(entering?1:-1)*dt/1.05,0,1);
   if(entering&&this.progress>=1&&this.settled(2.5,c))this.setMode('drive',c);
   if(!entering&&this.progress<=0&&this.settled(c.parkClearance||.9,c))this.setMode('walk',c);
   return;
  }
  if(this.mode!=='walk')return;
  const p=this.walker,previous={...p};p.z=ground(this.game.world,p.x,p.y)+EYE;
  p.yaw+=((active.lookRight?1:0)-(active.lookLeft?1:0))*1.65*dt;
  p.pitch=clamp(p.pitch+((active.lookUp?1:0)-(active.lookDown?1:0))*1.15*dt,-1.05,1.05);
  const f=(active.forward?1:0)-(active.backward?1:0),r=(active.right?1:0)-(active.left?1:0);
  const scale=3.4*dt/(Math.hypot(f,r)||1),dx=(Math.cos(p.yaw)*f-Math.sin(p.yaw)*r)*scale,dy=(Math.sin(p.yaw)*f+Math.cos(p.yaw)*r)*scale;
  // Sliding on each axis prevents snagging at corners and preserves the traversed trail.
  for(const axis of [0,1]){
   const x=p.x+(axis===0?dx:0),y=p.y+(axis===1?dy:0),z=ground(this.game.world,x,y)+EYE;
   if(this.legal(x,y)&&((this.contact.returnClear&&this.contact.trail.length<768)||Math.hypot(x-this.bounds.x,y-this.bounds.y)<Math.hypot(p.x-this.bounds.x,p.y-this.bounds.y))&&Math.abs(z-p.z)<.55){
    p.x=x;p.y=y;p.z=z;
   }
  }
  this.recordWalk(previous,dt);
  this.selectionId=this.selectedVehicle?.id||null;
 }
 prompt(candidate=this.selectedVehicle){
  const c=this.controlVehicle;
  if(this.mode==='entering')return 'Entering '+c.name.toLowerCase()+'…';
  if(this.mode==='exiting')return 'Stepping out…';
  if(this.mode==='drive'&&this.flightAssist)return 'Hold to climb · release to hold altitude · E to land';
  if(this.mode==='drive'&&c.flightLanding)return 'Descending gently · steer toward clear ground';
  if(this.mode==='drive'&&c.disabled)return c.name+' disabled · step out when safe or use Recover';
  if(this.mode==='drive'&&c.stranded)return c.name+' stranded · use Recover at a station';
  if(this.mode==='walk'){
   if(candidate)return 'E · Enter '+candidate.name.toLowerCase();
   if(!this.contact.returnClear)return 'Route disturbed · retrace clear ground or use Recover';
   if(this.contact.returnDistance>50)return this.returnVehicle?'Keep your '+this.returnVehicle.name.toLowerCase()+' in reach · follow your footprints back':'Stay near Lantern Dock · follow your footprints back';
   const nearby=this.game.vehicles.find(v=>Math.hypot(v.x-this.walker.x,v.y-this.walker.y)<5&&(v.disabled||v.stranded));
   if(nearby)return nearby.name+' unavailable · use Recall at a station';
   return 'Approach a vehicle';
  }
  return this.exitStatus().message;
 }
 camera(){return {mode:this.mode,chase:this.transitionChase?{...this.transitionChase}:null,walker:{...this.walker},driveBlend:smooth(this.progress),materialize:clamp(this.age/1.3,0,1),layout:ARRIVAL,vehicleId:this.controlVehicle.id};}
 snapshot(){const candidate=this.selectedVehicle,exit=this.exitStatus();return {...this.camera(),occupiedVehicleId:this.occupiedVehicleId,pendingVehicleId:this.pendingVehicleId,lastVehicleId:this.lastVehicleId,selectedVehicleId:candidate?.id||null,canEnter:!!candidate,canExit:exit.ready,exitStatus:exit,parkingRequested:this.parkingRequested,flightAssist:this.flightAssist,flightLanding:!!this.controlVehicle.flightLanding,prompt:this.prompt(candidate),bounds:{...this.bounds},armed:this.armed,contact:{...this.contact,footfalls:this.contact.footfalls.map(e=>({...e})),trail:this.contact.trail.map(p=>({...p}))},events:this.events.map(e=>({...e}))};}
}
const api={ArrivalSession,ARRIVAL,ground,point,facilities,cameraPose,segmentHitsSolid,stationSolids,rectangleDistance,overlap,bays,vehicleBox,EYE};root.SDArrival=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
