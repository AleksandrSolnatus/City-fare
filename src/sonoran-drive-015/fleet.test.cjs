'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Arrival = require('./arrival.js');
const Visitor = require('./visitor.js');
const Buggy = require('./buggy.js');

function outing() {
 const game = new Visitor.VisitGame();
 const session = new Arrival.ArrivalSession(game);
 game.start();
 const [skimmer, buggy] = game.vehicles;
 return {game, session, skimmer, buggy};
}
function ticks(session, count, input = {}) {
 for (let i = 0; i < count; i++) session.step(input);
}
function waitFor(session, mode) {
 for (let i = 0; i < 250 && session.mode !== mode; i++) session.step();
 assert.equal(session.mode, mode, session.message || session.prompt());
}
function aim(session, target) {
 const {walker} = session;
 const yaw = Math.atan2(target.y - walker.y, target.x - walker.x);
 const delta = Math.atan2(Math.sin(yaw - walker.yaw), Math.cos(yaw - walker.yaw));
 for (let i = 0; i < 3; i++) session.look(delta / .009, 0);
}
function enter(session, car) {
 aim(session, car);
 assert.equal(session.selectedVehicle, car, session.prompt());
 assert.equal(session.interact(), true);
 assert.equal(session.occupiedVehicleId, null);
 assert.equal(session.pendingVehicleId, car.id);
 waitFor(session, 'drive');
 assert.equal(session.occupiedVehicleId, car.id);
 assert.equal(session.pendingVehicleId, null);
 assert.equal(session.armed, false);
}
function exit(session) {
 if (!session.canExit()) {
  assert.equal(session.interact(), false);
  ticks(session, 360, {brake:true});
  assert.equal(session.mode, 'drive', 'held brake cannot auto-exit');
  ticks(session, 2);
 }
 assert.equal(session.canExit(), true, session.exitStatus().message);
 assert.equal(session.interact(), true);
 waitFor(session, 'walk');
 assert.equal(session.occupiedVehicleId, null);
}
function walkTo(session, target) {
 ticks(session, 1);
 aim(session, target);
 for (let i = 0; i < 1100 && Math.hypot(session.walker.x - target.x, session.walker.y - target.y) > .085; i++) session.step({forward:true});
 assert(Math.hypot(session.walker.x - target.x, session.walker.y - target.y) < .1, JSON.stringify(session.walker));
}
const xy = ({x, y}) => [x, y];

test('100 complete two-way switches reuse the two physical bays and preserve the one outing', () => {
 const {game, session, skimmer, buggy} = outing();
 const initial = game.vehicles.map(xy), world = game.world, animals = [...game.worms], walkerStart = xy(session.walker);
 ticks(session, 180, {forward:true});
 assert.notDeepEqual(xy(session.walker), walkerStart);
 for (let i = 0; i < 100; i++) {
  for (const vehicle of [skimmer, buggy]) {
   const previousTrail = session.contact.trail;
   aim(session, vehicle);
   assert.equal(session.contact.trail, previousTrail, 'aim changes the selected prompt without resetting the walk');
   enter(session, vehicle);
   assert.equal(game.occupiedVehicle, vehicle);
   assert.equal(game.car, skimmer, 'legacy alias always means skimmer');
   exit(session);
  }
 }
 assert.deepEqual(game.vehicles, [skimmer, buggy]);
 assert.deepEqual(game.vehicles.map(xy), initial);
 assert.equal(game.world, world);
 assert.deepEqual(game.worms, animals);
 assert.equal(session.events.filter(e => e.type === 'drive').length, 200);
 assert.equal(session.events.filter(e => e.type === 'walk').length, 200);
});

test('both controllers share one fixed clock and independently recharge while parked', () => {
 const {game, session, skimmer, buggy} = outing();
 const counts = [0,0,0,0];
 const stepSand = game.world.stepSand.bind(game.world), sky = game.sky.step.bind(game.sky);
 game.world.stepSand = (...args) => {counts[3]++; return stepSand(...args);};
 game.sky.step = (...args) => {counts[2]++; return sky(...args);};
 game.worms.forEach((w, i) => {
  const step = w.step.bind(w);
  w.step = (...args) => {counts[i]++; return step(...args);};
 });
 skimmer.surge = .1;
 buggy.surge = .1;
 ticks(session, 60);
 assert(Math.abs(skimmer.surge - .2) < 1e-11);
 assert(Math.abs(buggy.surge - (.1 + 1 / Buggy.TUNING.rechargeSeconds)) < 1e-11);
 ticks(session, 540);
 assert(Math.abs(game.time - 10) < 1e-11);
 assert.deepEqual(counts, [600,600,600,600]);
 assert(game.vehicles.every(c => c.parked && c.throttle === 0 && !c.boosting));
});

test('drive, park, and switch in one outing with safe walking and no residual controls', () => {
 const {game, session, skimmer, buggy} = outing();
 const skimmerStart = xy(skimmer), buggyStart = xy(buggy);
 ticks(session, 180, {forward:true});
 enter(session, skimmer);
 exit(session);
 enter(session, buggy);
 assert.equal(session.setFlightAssist(true), false);
 session.step({forward:true,boost:true,hop:true});
 assert(buggy.speed < .01 && buggy.throttle === 0 && !buggy.boosting && buggy.hopPhase === 'hover', 'first held input after entry stays blocked');
 ticks(session, 1);
 ticks(session, 130, {forward:true});
 assert(Math.hypot(buggy.x - buggyStart[0], buggy.y - buggyStart[1]) > 10);
 assert.deepEqual(xy(skimmer), skimmerStart);
 exit(session);
 const buggyParked = xy(buggy);
 walkTo(session, Arrival.point(0,4.1,skimmer));
 enter(session, skimmer);
 ticks(session,1);
 assert.equal(session.setFlightAssist(true), true);
 ticks(session, 45, {hop:true});
 assert(skimmer.z > game.world.height(skimmer.x, skimmer.y) + 3);
 assert.deepEqual(xy(buggy), buggyParked);
 assert.equal(buggy.parked,true);
 exit(session);
 walkTo(session, Arrival.point(0,-3.5,buggy));
 enter(session, buggy);
 assert.equal(buggy.parked,false);
 assert.deepEqual(xy(buggy),buggyParked);
 assert.equal(buggy.health,100);
});

test('alternate camera preset is shared by entry admission and the latched endpoint', () => {
 for (const [preset, expected] of [[1,8.8],[2,15]]) {
  const {session, skimmer, buggy} = outing();
  session.setChasePreset(preset);
  ticks(session, 180, {forward:true});
  enter(session, skimmer);
  exit(session);
  aim(session, buggy);
  session.observeCamera(session.chasePresets(skimmer)[preset]);
  assert.equal(session.interact(), true);
  let chase = session.camera().chase;
  assert(Math.abs(Math.hypot(chase.x - buggy.x, chase.y - buggy.y) - expected) < 1e-10);
  session.setChasePreset(0);
  chase = session.camera().chase;
  assert(Math.abs(Math.hypot(chase.x - buggy.x, chase.y - buggy.y) - 6.8) < 1e-10);
  waitFor(session, 'drive');
  assert.equal(session.occupiedVehicleId, buggy.id);
 }
});

test('recall refuses a blocked bay or unusable on-foot return route before relocating anything', () => {
 const {game, session, skimmer, buggy} = outing();
 game.placeVehicle(skimmer, {...Arrival.point(-30,3),yaw:Arrival.ARRIVAL.yaw});
 skimmer.parked = true;
 session.lastVehicleId = skimmer.id;
 session.bounds = session.anchorBounds(skimmer);
 const behind = Arrival.point(-16,2);
 session.walker = {...behind,z:Arrival.ground(game.world,behind.x,behind.y)+Arrival.EYE,yaw:0,pitch:0};
 session.resetContact();
 const start = game.snapshot().vehicles, route = session.contact;
 assert.equal(session.canRecall(skimmer.id),true);
 assert.equal(session.recall(skimmer.id),false);
 assert.match(session.message,/open approach/);
 assert.equal(session.contact,route);
 assert.deepEqual(game.snapshot().vehicles,start);
 const front = Arrival.point(2,-8);
 session.walker = {...front,z:Arrival.ground(game.world,front.x,front.y)+Arrival.EYE,yaw:0,pitch:0};
 session.resetContact();
 assert.equal(session.recall(skimmer.id),true);
 assert.equal(session.contact.returnClear,true);
 assert.equal(session.bounds.x,skimmer.x);
 assert.deepEqual(xy(skimmer),xy(Arrival.ARRIVAL));
 const b = Arrival.bays(game.world).find(v => v.vehicleId === buggy.id);
 game.placeVehicle(buggy,{...Arrival.point(30,7.6),yaw:b.yaw});
 session.solids.push({...b,id:'blocked-buggy-bay',z:b.z-.2,height:8});
 const blocked = game.snapshot().vehicles;
 assert.equal(session.recall(buggy.id),false);
 assert.match(session.message,/bay is blocked/);
 assert.deepEqual(game.snapshot().vehicles,blocked);
 assert.equal(game.events.filter(e => e.type === 'recall').length,1);
});

test('initial walking recovery preserves both vehicles and driven recovery repairs just the last vehicle', () => {
 const {game, session, skimmer, buggy} = outing();
 const initial = game.snapshot().vehicles;
 game.visitor.lastSafe = 'lookout';
 assert.equal(session.recover(),true);
 assert.equal(session.mode,'walk');
 assert.equal(session.returnVehicle,null);
 assert.deepEqual(game.snapshot().vehicles,initial);
 assert(Math.hypot(session.walker.x + 650, session.walker.y - 150) < 10);
 game.visitor.lastSafe = 'dock';
 assert.equal(session.recover(),true);
 ticks(session,1);
 ticks(session,180,{forward:true});
 enter(session,skimmer);
 exit(session);
 enter(session,buggy);
 const other = game.snapshot().vehicles[0];
 buggy.health = 22;
 assert.equal(session.recover(),true);
 assert.equal(session.mode,'drive');
 assert.equal(game.occupiedVehicle,buggy);
 assert.equal(buggy.health,100);
 assert.deepEqual(game.snapshot().vehicles[0],other);
 assert(game.events.some(e => e.type === 'recovery' && e.vehicleId === buggy.id));
});

test('a disabled buggy leaves its driver a safe exit without failing the outing or damaging the skimmer', () => {
 const {game, session, skimmer, buggy} = outing();
 ticks(session,180,{forward:true});
 enter(session,skimmer);
 exit(session);
 enter(session,buggy);
 buggy.health=40;
 const animal=game.worms[1],old=animal.previousSections,sections=animal.sections;
 const fixture=Array.from({length:12},(_,i)=>({x:buggy.x+30-i*10,y:buggy.y,z:buggy.z-1,r:20}));
 animal.sections=animal.previousSections=fixture;
 game.resolveContact({...buggy},buggy,1/60);
 animal.sections=sections;animal.previousSections=old;
 assert.equal(buggy.health,0);
 assert.equal(buggy.disabled,true);
 assert.equal(game.status,'playing');
 assert.equal(skimmer.health,100);
 ticks(session,45,{forward:true,boost:true});
 assert(Math.abs(buggy.speed)<.01);
 exit(session);
 enter(session,skimmer);
 assert.equal(game.occupiedVehicle,skimmer);
 assert(game.time>0);
});

test('a parked vehicle and a rotational corner sweep both stop a moving chassis', () => {
 const {game, session, skimmer, buggy} = outing();
 const through = {...skimmer};
 Object.assign(skimmer, Arrival.point(-12,7.6),{yaw:Arrival.ARRIVAL.yaw});
 const before = {...skimmer};
 Object.assign(skimmer,Arrival.point(12,7.6),{vx:80,speed:80});
 session.resolveMotion(before,skimmer);
 assert.equal(skimmer.speed,0);
 assert(Math.hypot(skimmer.x-buggy.x,skimmer.y-buggy.y) > 3);
 Object.assign(skimmer,through);
 Object.assign(buggy,{x:-2680,y:-2270,yaw:0});
 const turn = {...buggy};
 session.solids.push({id:'sweep-test',x:buggy.x,y:buggy.y+2.24,z:buggy.z-.9,length:.45,width:.25,height:3,yaw:0});
 buggy.yaw=Math.PI/2;
 session.resolveMotion(turn,buggy);
 assert(buggy.yaw < Math.PI/2);
});

test('015 reads visitor progress from 014 and writes only its own key', () => {
 const oldKey='city-fare.visitor.014.v1';
 const original=JSON.stringify({...Visitor.fresh(),build:'sonoran-drive-014',visited:['dock','lookout'],lastSafe:'lookout'});
 const data=new Map([[oldKey,original]]);
 const store=new Visitor.Store({getItem:k=>data.get(k),setItem:(k,value)=>data.set(k,value)});
 const record=store.load();
 assert.equal(record.build,'sonoran-drive-015');
 assert.equal(record.lastSafe,'lookout');
 assert.match(store.status,/fresh outing at Lantern Dock/);
 assert.equal(store.save(record),true);
 assert.equal(data.get(oldKey),original);
 assert(data.has(Visitor.KEY));
});

test('a fresh tap from the low parking position queues one jump, and pause clears the queue', () => {
 for (const pause of [false,true]) {
  const {game,session,skimmer} = outing();
  ticks(session,180,{forward:true});
  enter(session,skimmer);
  assert(session.requestStop());
  ticks(session,180);
  assert(skimmer.parked);
  assert(skimmer.z-game.world.height(skimmer.x,skimmer.y)<1.5);
  session.step({hop:true});
  assert(skimmer.hopPending>0);
  if(pause)session.release(true);
  ticks(session,130);
  assert.equal(skimmer.hopPending,0);
  assert.equal(game.events.filter(e=>e.type==='hop').length,pause?0:1);
 }
});
