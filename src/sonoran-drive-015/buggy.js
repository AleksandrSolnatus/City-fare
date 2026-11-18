/* Four vertical wheel contacts and a shared chassis. Metres and seconds, z up. */
(function(root){'use strict';
const Geometry=typeof module!=='undefined'&&module.exports?require('./geometry.js'):root.SDGeometry;
const GPU=typeof module!=='undefined'&&module.exports?require('./gpu.js'):root.SDGPU;
const {BUGGY_MOUNTS:mounts,BUGGY_WHEEL_RADIUS:radius}=Geometry;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const mix=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;
const BOUNDS=Object.freeze({length:4.6,width:3.0,height:2.8,bottomOffset:-1.3});
const TUNING=Object.freeze({
 maxExtension:.62,minExtension:.12,spring:15.5,damper:3.5,maxWheelLoad:8.5,
 speed:33.5,surgeSpeed:42.5,reverseSpeed:9,thrust:7.0,surgeThrust:10.5,
 surgeSeconds:2.5,rechargeSeconds:13,hopImpulse:4.55,maxParkSlope:.65,
 grip:Object.freeze({bedrock:1.04,hardpan:.85,gravel:.68,sand:.50})
});
const gravity=world=>world.gravity??9.81;
const clearance=normal=>radius/Math.max(.65,normal.z);

function supportPose(world,pose){
 const flat=Geometry.buggyFrame({...pose,z:0,pitch:0,roll:0});
 const level=mounts.map(([f,r])=>{
  const [x,y]=flat(f,r,0);
  return GPU.meshContact(world,x,y);
 });
 const front=(level[2].z+level[3].z)/2,rear=(level[0].z+level[1].z)/2;
 const right=(level[1].z+level[3].z)/2,left=(level[0].z+level[2].z)/2;
 const pitch=clamp(Math.atan2(front-rear,2.8),-.46,.46),roll=clamp(Math.atan2(right-left,2.04),-.40,.40);
 const tilted=Geometry.buggyFrame({...pose,z:0,pitch,roll});
 const samples=mounts.map(([f,r])=>{
  const [x,y,h]=tilted(f,r,0),ground=GPU.meshContact(world,x,y);
  return {base:ground.z+clearance(ground.normal)-h,normal:ground.normal};
 });
 const sag=gravity(world)/(4*TUNING.spring),desiredLength=TUNING.maxExtension-sag;
 const z=desiredLength+samples.reduce((sum,s)=>sum+s.base,0)/samples.length;
 const supported=samples.every(({base,normal})=>z-base>TUNING.minExtension+.02&&z-base<TUNING.maxExtension-.025&&
  Math.hypot(normal.x,normal.y)<=TUNING.maxParkSlope*normal.z);
 return {z,pitch,roll,supported};
}
const restHeight=(world,pose)=>supportPose(world,pose).z;

function wheelContacts(world,c){
 const at=Geometry.buggyFrame(c);
 return mounts.map(([f,r],index)=>{
  const [x,y,mountZ]=at(f,r,0),ground=GPU.meshContact(world,x,y),normal=ground.normal;
  const rawLength=mountZ-ground.z-clearance(normal);
  const length=clamp(rawLength,TUNING.minExtension,TUNING.maxExtension);
  const compression=TUNING.maxExtension-length,contact=rawLength<TUNING.maxExtension;
  const floorRate=-(normal.x*c.vx+normal.y*c.vy)/normal.z;
  // Positive extension velocity opens the suspension and reduces spring load.
  const supportRate=floorRate-f*c.pitchRate-r*c.rollRate,extensionRate=c.vz-supportRate;
  const load=contact?clamp(TUNING.spring*compression-TUNING.damper*extensionRate,0,TUNING.maxWheelLoad):0;
  return {x,y,z:mountZ-length,groundZ:ground.z,normal,substrate:ground.substrate,length,compression,contact,load,
   stopError:Math.max(0,TUNING.minExtension-rawLength),supportRate,spin:c.wheels?.[index]?.spin||0,
   rotation:c.wheels?.[index]?.rotation||0,steer:f>0?c.steerAngle:0};
 });
}
function publishContacts(c,wheels,dt=0){
 let loudest=null,count=0;
 c.wheels=wheels.map(w=>{
  if(w.contact){count++;if(!loudest||w.load>loudest.load)loudest=w;}
  const heading=c.yaw+w.steer;
  const spin=w.contact?(c.vx*Math.cos(heading)+c.vy*Math.sin(heading))/radius:w.spin*Math.exp(-.40*dt);
  return {...w,spin,rotation:(w.rotation+spin*dt)%TAU};
 });
 c.supportCount=count;
 c.grounded=count>0;
 c.hopPhase=c.grounded&&c.vz<=1.3?'hover':'flight';
 c.surface=loudest?.substrate||c.surface;
}
function refreshContacts(world,c){publishContacts(c,wheelContacts(world,c));}
function place(world,c,pose){
 const {x,y,yaw=0}=pose,rest=supportPose(world,{x,y,yaw});
 Object.assign(c,{x,y,yaw,z:rest.z,pitch:rest.pitch,roll:rest.roll,vx:0,vy:0,vz:0,speed:0,throttle:0,
  boostLocked:false,boosting:false,hopHeld:false,hopClock:0,hopPhase:'hover',flightAssist:false,
  flightLanding:false,flightTarget:null,steerAngle:0,pitchRate:0,rollRate:0,wheels:[],slip:0,
  disturbance:0,lift:gravity(world),groundCorrection:0,stranded:!rest.supported,
  landingSpeed:0,lastLandingSpeed:0,landingCount:c.landingCount||0});
 refreshContacts(world,c);
 return c;
}
function create(world,pose){
 return place(world,{id:'buggy-01',type:'buggy',radius:2.76,surge:1,parked:true},pose);
}

function drive(world,c,input,dt,parked){
 const g=gravity(world),wheels=wheelContacts(world,c);
 let support=0,grip=0,slopeX=0,slopeY=0;
 for(const w of wheels){
  support+=w.load;
  grip+=w.load*(TUNING.grip[w.substrate]??TUNING.grip.sand);
  slopeX+=w.load*w.normal.x*w.normal.z;
  slopeY+=w.load*w.normal.y*w.normal.z;
 }
 const groundScale=support>0?g/Math.max(g,support):0;
 slopeX*=groundScale;slopeY*=groundScale;
 const weight=clamp(support/g,0,1);
 const brake=parked||!!input.brake;
 const steer=brake?0:Number(!!input.right)-Number(!!input.left);
 const fx=Math.cos(c.yaw),fy=Math.sin(c.yaw),forwardSpeed=c.vx*fx+c.vy*fy;
 const authority=1/(1+Math.abs(forwardSpeed)/25);
 c.steerAngle=mix(c.steerAngle,.56*steer*authority,1-Math.exp(-12*dt));
 const bicycle=forwardSpeed*Math.tan(c.steerAngle)/2.8;
 const turningLimit=1.4*authority*clamp(Math.abs(forwardSpeed)/4,0,1);
 if(!parked)c.yaw+=clamp(bicycle,-turningLimit,turningLimit)*weight*dt;
 const nx=Math.cos(c.yaw),ny=Math.sin(c.yaw);
 const along=c.vx*nx+c.vy*ny,lateral=-c.vx*ny+c.vy*nx;
 if(!input.boost)c.boostLocked=false;
 c.boosting=!!input.boost&&!brake&&!input.backward&&!c.boostLocked&&c.surge>0&&weight>.15;
 c.surge=clamp(c.surge+(c.boosting?-1/TUNING.surgeSeconds:1/TUNING.rechargeSeconds)*dt,0,1);
 if(c.boosting&&c.surge===0)c.boostLocked=true;
 const reverse=!brake&&!!input.backward,forward=!brake&&!reverse&&(!!input.forward||c.boosting);
 c.throttle=reverse?-.65:forward?1:0;
 const drag=c.speed*(weight*.145+.025)+(c.speed>.01?.40*weight:0);
 const rollingX=c.speed>0?c.vx/c.speed*drag:0,rollingY=c.speed>0?c.vy/c.speed*drag:0;
 let thrust=0,sideForce=-lateral*4.6;
 if(brake){
  const holdX=-c.vx/dt-slopeX+rollingX,holdY=-c.vy/dt-slopeY+rollingY;
  thrust=holdX*nx+holdY*ny;
  sideForce=-holdX*ny+holdY*nx;
 }else if(reverse){
  thrust=along>.7?-11:-Math.min(4.8,Math.max(0,(TUNING.reverseSpeed+along)*4));
 }else if(forward){
  const limit=c.boosting?TUNING.surgeSpeed:TUNING.speed;
  thrust=Math.min(c.boosting?TUNING.surgeThrust:TUNING.thrust,Math.max(0,(limit-along)*5+drag));
 }
 const wanted=Math.hypot(thrust,sideForce),traction=wanted>0?Math.min(1,grip/wanted):0;
 c.slip=brake?0:clamp((Math.abs(lateral)*.13+(1-traction)*Math.min(1,wanted/9)*.55)*weight,0,1);
 c.vx+=(slopeX-rollingX+(nx*thrust-ny*sideForce)*traction)*dt;
 c.vy+=(slopeY-rollingY+(ny*thrust+nx*sideForce)*traction)*dt;
 if(parked||(brake&&Math.hypot(c.vx,c.vy)<1e-7))c.vx=c.vy=0;
 c.x+=c.vx*dt;c.y+=c.vy*dt;c.speed=Math.hypot(c.vx,c.vy);

 // Pitch/roll follow the contact plane, but the axis position remains a
 // separately integrated vertical degree of freedom. In air, weight is zero.
 const front=(wheels[2].groundZ+wheels[3].groundZ)/2,rear=(wheels[0].groundZ+wheels[1].groundZ)/2;
 const right=(wheels[1].groundZ+wheels[3].groundZ)/2,left=(wheels[0].groundZ+wheels[2].groundZ)/2;
 const pitchGoal=weight*clamp(Math.atan2(front-rear,2.8)-thrust*traction*.009,-.46,.46);
 const rollGoal=weight*clamp(Math.atan2(right-left,2.04)+sideForce*traction*.012,-.40,.40);
 const leanBlend=1-Math.exp(-(weight>0?4.5:.8)*dt);
 const pitch=c.pitch,roll=c.roll;
 c.pitch=mix(pitch,pitchGoal,leanBlend);c.roll=mix(roll,rollGoal,leanBlend);
 c.pitchRate=(c.pitch-pitch)/dt;c.rollRate=(c.roll-roll)/dt;

 const wasGrounded=c.grounded;
 c.lift=support;c.vz+=(support-g)*dt;c.z+=c.vz*dt;
 let after=wheelContacts(world,c);
 const bump=after.reduce((max,w)=>w.stopError>max.stopError?w:max);
 const impact=after.reduce((max,w)=>w.contact?Math.max(max,w.supportRate-c.vz):max,0);
 if(bump.stopError>0){
  // The hard lower travel stop is a unilateral collision constraint. Normal
  // support and crest flight use the spring above, with no rest-height snap.
  c.z+=bump.stopError;c.groundCorrection+=bump.stopError;c.vz=Math.max(bump.supportRate,c.vz);
  after=wheelContacts(world,c);
 }
 publishContacts(c,after,dt);
 if(!wasGrounded&&c.grounded&&impact>.85){
  c.landingSpeed=impact;c.lastLandingSpeed=impact;c.landingCount++;
 }
}
function step(world,c,input={},dt=1/60,parked=false){
 dt=clamp(dt,0,.05);
 if(!dt)return {hopped:false,landed:false,landingSpeed:0};
 const canHop=!parked&&!input.brake&&c.supportCount>=3&&Math.abs(c.vz)<1.25;
 const hopped=!!input.hop&&!c.hopHeld&&canHop;
 c.hopHeld=!!input.hop;
 c.parked=parked;
 c.landingSpeed=0;c.groundCorrection=0;
 if(hopped){c.vz+=TUNING.hopImpulse;c.hopClock=0;}
 c.hopClock+=dt;
 const count=Math.ceil(dt*60);
 for(let i=0;i<count;i++)drive(world,c,input,dt/count,parked);
 // Parked terrain can deform beneath the tyres. Mark unusable support for
 // recovery without moving the other vehicle or letting this one creep.
 c.stranded=parked&&!supportPose(world,c).supported;
 const moving=(c.grounded?.14+.35*Math.abs(c.throttle)+.25*c.slip+(c.boosting?.25:0):.05);
 c.disturbance=parked?0:moving*(c.surface==='bedrock'?.20:1);
 return {hopped,landed:c.landingSpeed>0,landingSpeed:c.landingSpeed};
}
const api={BOUNDS,TUNING,create,place,step,restHeight,supportPose,refreshContacts};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.SDBuggy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
