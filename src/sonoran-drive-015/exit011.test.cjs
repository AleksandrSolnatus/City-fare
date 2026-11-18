'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('./arrival.js'),V=require('./visitor.js'),G=require('./geometry.js');
const setup=(p={x:-1700,y:-2350,yaw:0})=>{const g=new V.VisitGame();g.start();Object.assign(g.car,{...p,z:g.world.height(p.x,p.y)+2.5});return {g,s:new A.ArrivalSession(g,{direct:true})};};
const run=(s,seconds,input={})=>{for(let i=0;i<seconds*60;i++)s.step(input);};
const minimumGap=g=>Math.min(...G.skimmerMesh(g.car).flatMap(f=>f.vertices.map(([x,y,z])=>z-A.ground(g.world,x,y))));

test('010 actual dune failure now chooses the supported side, with no hull-ground penetration',()=>{
 const {g,s}=setup({x:500,y:-1900,yaw:0});assert(g.parkingClearance()>2.1);assert(s.settled());assert(s.canExit());assert.equal(s.exitPoint().y,-1904.1);
 s.requestStop();run(s,4);assert(s.canExit());assert(minimumGap(g)>.09);const car={...g.car};assert(s.interact());run(s,3);assert.equal(s.mode,'walk');assert.equal(g.car.x,car.x);assert.equal(g.car.y,car.y);assert(minimumGap(g)>.09);
});

test('real open sand, basin, bedrock and gravel support repeated exit/enter cycles',()=>{
 const samples=[{x:200,y:-1950,yaw:.38},{x:1350,y:-2650,yaw:1.3},{x:-1700,y:-2350,yaw:.25},{x:-1550,y:-1250,yaw:.75},{x:2050,y:1900,yaw:.8}];
 for(const p of samples){const {g,s}=setup(p),xy=[g.car.x,g.car.y];for(let i=0;i<3;i++){assert(s.canExit(),JSON.stringify({p,i,status:s.exitStatus()}));assert(s.interact());run(s,3);assert.equal(s.mode,'walk');assert(s.legal(s.walker.x,s.walker.y));assert(minimumGap(g)>0,'rendered hull must remain above rendered terrain');assert(s.canEnter());assert(s.interact());run(s,3);assert.equal(s.mode,'drive');assert.deepEqual([g.car.x,g.car.y],xy);assert.equal(g.health,100);}}
});

test('120 mph E request brakes strongly, settles, and never exits without another fresh interaction',()=>{
 const {g,s}=setup();Object.assign(g.car,{vx:53.6448,speed:53.6448});const x=g.car.x,z=g.car.z;assert.equal(s.exitStatus().reason,'moving');assert.equal(s.interact(),false);assert(s.parkingRequested);assert.equal(g.car.x,x);assert.equal(g.car.z,z);
 // Retained driving keys and a held E cannot cancel the stop or trigger exit.
 run(s,1,{forward:true,boost:true,hop:true,brake:true});assert(g.car.speed<14);run(s,5,{brake:true});assert(g.car.speed<.001);assert(g.car.x-x<40);assert.equal(s.mode,'drive');assert(s.game.parked);assert(s.canExit());assert.match(s.prompt(),/press E to step out/);assert(!s.events.some(e=>e.type==='exiting'));
 const xy=[g.car.x,g.car.y];assert(s.interact());run(s,3,{brake:true});assert.equal(s.mode,'walk');assert.deepEqual([g.car.x,g.car.y],xy);
});

test('stop latch requires release before deliberate drive resumes; steering resumes lift too',()=>{
 for(const action of ['forward','backward','left','right','boost','hop']){const {g,s}=setup();s.requestStop();run(s,3,{[action]:true});assert(s.parkingRequested);assert.equal(g.car.speed,0);run(s,.1);s.step({[action]:true});assert(!s.parkingRequested,action);assert(!g.parked,action);assert.equal(s.mode,'drive');}
});

test('distinct airborne, settling, steep, obstruction and nearby-animal reasons remain actionable',()=>{
 {const {g,s}=setup();g.car.hopPhase='flight';assert.equal(s.exitStatus().reason,'airborne');s.interact();run(s,5);assert.equal(s.mode,'drive');assert(s.canExit());}
 {const {g,s}=setup();g.car.vz=.4;assert.equal(s.exitStatus().reason,'settling');}
 {const {g,s}=setup({x:8,y:-2000,yaw:0});assert(g.world.addVolume(0,-125,10000));g.car.z=g.world.height(8,-2000)+2.5;assert(!s.walkable(8,-2000));assert.equal(s.exitStatus().reason,'steep');assert(!s.interact());}
 {const {g,s}=setup();s.solids.push({id:'test-roof',x:g.car.x,y:g.car.y,z:g.car.z+1,length:80,width:80,height:3,yaw:0});assert.equal(s.exitStatus().reason,'obstruction');assert(!s.interact());}
 {const {g,s}=setup();const c=g.car;g.worm.state='commit';g.worm.sections=[{x:c.x,y:c.y,z:c.z,r:10}];g.worm.previousSections=[];assert.equal(s.exitStatus().reason,'nearby-animal');g.worm.sections=[{x:c.x+1000,y:c.y,z:c.z,r:10}];assert(s.canExit(),'distant animal state must not globally veto exit');g.worm.sections=[{x:c.x,y:c.y,z:c.z,r:10}];assert(!s.interact());}
});

test('actual observed camera path remains collision checked; unused long preset cannot veto a safe transfer',()=>{
 const {g,s}=setup(),[actual,,unused]=s.chasePresets();s.observeCamera(actual);s.solids.push({id:'long-camera-block',...unused,z:unused.z-.5,length:1,width:1,height:1,yaw:0});assert(s.canExit());s.observeCamera(unused);assert(!s.canExit());assert.equal(s.exitStatus().reason,'obstruction');s.observeCamera(actual);assert(s.interact());assert.deepEqual(s.camera().chase,actual);
});

test('recovery cancels parking and blocked requests never schedule an exit',()=>{
 const {g,s}=setup();g.car.vx=g.car.speed=20;s.interact();run(s,6);assert.equal(s.mode,'drive');assert(s.parkingRequested);g.recover();s.recover();assert(!s.parkingRequested);assert(!g.parked);assert.equal(s.mode,'drive');assert.equal(s.armed,false);
});
