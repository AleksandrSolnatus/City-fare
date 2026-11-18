const test=require('node:test');
const assert=require('node:assert/strict');
const Buggy=require('./buggy.js');
const Geometry=require('./geometry.js');
const GPU=require('./gpu.js');
const {World}=require('./world.js');

const dt=1/60;
const world=(height=()=>0,substrate='bedrock')=>({terrain:{height},metadata:()=>({substrate})});
const spawn=(w,pose={x:0,y:0})=>Buggy.create(w,pose);
const near=(a,b,epsilon=1e-8)=>assert(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);
function run(w,c,steps,inputs={},parked=false){
 for(let i=0;i<steps;i++)Buggy.step(w,c,typeof inputs==='function'?inputs(i):inputs,dt,parked);
}

test('wheel contact uses the exact rendered triangles and reads current height edits',()=>{
 const heights=new Map([['0,0',0],['8,0',1],['0,8',2],['8,8',6],['4,4',1.5]]);
 let edit=0;
 const w={baseHeight:(x,y)=>heights.get(`${x},${y}`)??0,_delta:(x,y)=>x===8&&y===8?edit:0,metadata:()=>({substrate:'gravel'})};
 assert.equal(GPU.diagonal(w,0,0),1);
 const verify=(x,y,z,dx,dy)=>{
  const contact=GPU.meshContact(w,x,y),n=Math.hypot(dx,dy,1);
  assert.equal(contact.z,GPU.meshSample(w,x,y));
  near(contact.z,z);near(contact.normal.x,-dx/n);near(contact.normal.y,-dy/n);near(contact.normal.z,1/n);
  assert.equal(contact.substrate,'gravel');
 };
 verify(2,2,.75,1/8,2/8);
 verify(6,6,3.75,4/8,5/8);
 edit=4;
 assert.equal(GPU.diagonal(w,0,0),1);
 verify(6,6,5.75,8/8,9/8);
 const diagonalZero=world((x,y)=>.2*x+.3*y);
 for(const [x,y] of [[3,1],[1,3]]){
  const contact=GPU.meshContact(diagonalZero,x,y);
  near(contact.z,.2*x+.3*y);near(contact.normal.x,-.2/Math.hypot(.2,.3,1));near(contact.normal.y,-.3/Math.hypot(.2,.3,1));
 }
});

test('level rest holds four loaded contact points and the drawn tyres reach the ground',()=>{
 const w=world(),c=spawn(w),z=c.z;
 run(w,c,600);
 assert.equal(c.x,0);assert.equal(c.y,0);assert.equal(c.speed,0);
 near(c.z,z);near(c.vz,0);
 assert.equal(c.supportCount,4);
 near(c.wheels.reduce((sum,wheel)=>sum+wheel.load,0),9.81);
 for(const wheel of c.wheels){
  assert(wheel.compression>.125&&wheel.compression<.175);
  near(wheel.z-Geometry.BUGGY_WHEEL_RADIUS,0);
  assert.equal(wheel.substrate,'bedrock');
 }
 const mesh=Geometry.buggyMesh(c),verts=mesh.flatMap(face=>face.vertices);
 assert.equal(mesh.filter(face=>face.label==='buggy-tire').length,4*14);
 for(const p of verts)assert(p.every(Number.isFinite));
 near(Math.min(...verts.map(v=>v[2])),0);
 assert(Math.max(...verts.map(v=>v[2]))<2.4);
});

test('a diagonal ridge produces distinct wheel travel with articulated mounts',()=>{
 const w=world((x,y)=>x>=8&&y>=8?-1.2:0,'gravel'),c=spawn(w,{x:8,y:8});
 assert(Buggy.supportPose(w,c).supported);
 assert(Math.abs(c.pitch)>.03&&Math.abs(c.roll)>.02);
 assert(Math.max(...c.wheels.map(w=>w.length))-Math.min(...c.wheels.map(w=>w.length))>.07);
 for(const [i,wheel] of c.wheels.entries()){
  const mount=Geometry.buggyFrame(c)(...Geometry.BUGGY_MOUNTS[i],0);
  near(wheel.x,mount[0]);near(wheel.y,mount[1]);near(wheel.z,mount[2]-wheel.length);
  near(wheel.groundZ,GPU.meshSample(w,wheel.x,wheel.y));
 }
});

test('a held hop launches only once, applies gravity in air and settles after landing',()=>{
 const w=world(),c=spawn(w),rest=c.z;
 let hops=0,landings=0,apex=0,airTicks=0;
 for(let i=0;i<300;i++){
  const previousVZ=c.vz,wasAir=!c.grounded;
  const event=Buggy.step(w,c,{hop:true});
  hops+=event.hopped;landings+=event.landed;apex=Math.max(apex,c.z);
  if(wasAir&&!c.grounded){airTicks++;near(c.vz-previousVZ,-9.81*dt);assert(c.wheels.every(wheel=>wheel.load===0));}
  assert.equal(c.groundCorrection,0);
 }
 assert.equal(hops,1);assert.equal(landings,1);assert(airTicks>40);
 assert(apex-rest>.9&&apex-rest<1.15);
 near(c.z,rest);near(c.vz,0);
 assert.equal(c.landingCount,1);
 assert(c.lastLandingSpeed>3&&c.lastLandingSpeed<5);
 assert.equal(c.landingSpeed,0);
 Buggy.step(w,c,{});
 assert(Buggy.step(w,c,{hop:true}).hopped);
});

test('a crest produces airtime without hop, steering traction or an automatic second launch',()=>{
 const grade=.20,w=world(x=>Math.max(0,8-grade*Math.abs(x))),c=spawn(w,{x:-14,y:0});
 c.speed=c.vx=20;c.vz=20*grade;
 Buggy.refreshContacts(w,c);
 let aired=0,touchdowns=0,correction=0;
 for(let i=0;i<300;i++){
  const yaw=c.yaw,wasAir=!c.grounded;
  const r=Buggy.step(w,c,{forward:true,right:wasAir});
  assert.equal(r.hopped,false);
  if(wasAir){aired++;near(c.yaw,yaw);}
  touchdowns+=r.landed;correction+=c.groundCorrection;
 }
 assert(aired>50);assert.equal(touchdowns,1);
 assert(correction<.05,`bump-stop correction ${correction} m`);
 assert.equal(c.supportCount,4);assert(Math.abs(c.vz)<.03);
});

test('a three-metre drop reaches a bounded bump stop and dampens to equilibrium',()=>{
 const w=world(),c=spawn(w),rest=c.z;
 c.z+=3;Buggy.refreshContacts(w,c);
 let landings=0,compression=0;
 for(let i=0;i<420;i++){
  landings+=Buggy.step(w,c,{}).landed;
  compression=Math.max(compression,c.groundCorrection);
  assert(c.z>=Geometry.BUGGY_WHEEL_RADIUS+Buggy.TUNING.minExtension-1e-8);
  assert(c.wheels.every(wheel=>wheel.load<=Buggy.TUNING.maxWheelLoad));
 }
 assert.equal(landings,1);assert(compression>0&&compression<.05);
 near(c.z,rest);near(c.vz,0);
});

test('surface grip changes acceleration, steering turns the front wheels, and brake competes for grip',()=>{
 const rock=world(),sand=world(undefined,'sand'),a=spawn(rock),b=spawn(sand);
 run(rock,a,900,{forward:true});run(sand,b,900,{forward:true});
 near(a.speed,Buggy.TUNING.speed,1e-5);
 assert(a.speed-b.speed>7);assert(b.slip>a.slip);assert.equal(b.surface,'sand');
 run(rock,a,90,{forward:true,boost:true,right:true});
 assert(a.surge<1&&a.boosting&&a.yaw>0);
 assert(a.wheels[0].steer===0&&a.wheels[1].steer===0&&a.wheels[2].steer>0&&a.wheels[3].steer>0);
 assert(a.wheels.some(wheel=>Math.abs(wheel.rotation)>.001));
 run(rock,a,400,{brake:true});near(a.speed,0);
 run(rock,a,400,{forward:true,backward:true,boost:true});
 assert(a.speed<=Buggy.TUNING.reverseSpeed);assert.equal(a.boosting,false);
 assert(a.vx*Math.cos(a.yaw)+a.vy*Math.sin(a.yaw)<0);
});

test('park keeps the vehicle fixed and checks terrain changes without an instantaneous surge refill',()=>{
 let edit=0;
 const w=world((x,y)=>x*.12+(x>=8&&y>=8?edit:0)),pose={x:8,y:8,yaw:.13},c=spawn(w,pose);
 c.surge=.3;c.steerAngle=.24;
 run(w,c,60,{forward:true,boost:true,hop:true,right:true},true);
 near(c.x,pose.x);near(c.y,pose.y);near(c.yaw,pose.yaw);
 near(c.surge,.3+1/Buggy.TUNING.rechargeSeconds);
 assert(c.parked);assert(!c.stranded);assert(!c.boosting);assert.equal(c.disturbance,0);
 edit=-7;
 run(w,c,180,{},true);
 assert(c.stranded);
 near(c.x,pose.x);near(c.y,pose.y);
 c.health=42;const reserve=c.surge;
 Buggy.place(w,c,{x:-12,y:0,yaw:.5});
 assert.equal(c.id,'buggy-01');assert.equal(c.health,42);assert.equal(c.surge,reserve);
 assert(!c.stranded);assert(!c.hopHeld);assert.equal(c.supportCount,4);
});

test('tick-addressed inputs yield identical buggy state when grouped at different paint cadences',()=>{
 const form=i=>({forward:i<720,boost:i>=240&&i<380,hop:i>=100&&i<160,right:i>=360&&i<420,brake:i>=720});
 const trace=chunks=>{
  const w=new World(),c=spawn(w,{x:-2800,y:-2192,yaw:.6});
  for(let i=0,frame=0;i<1020;frame++){
   const end=Math.min(i+chunks[frame%chunks.length],1020);
   for(;i<end;i++)Buggy.step(w,c,form(i));
  }
  assert(Math.hypot(c.x+2800,c.y+2192)>100);
  return c;
 };
 assert.deepEqual(trace([2]),trace([1,4,2,3]));
});
