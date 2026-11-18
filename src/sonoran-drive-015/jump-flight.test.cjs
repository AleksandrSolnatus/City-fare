const test=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./evidence/input-harness.cjs');

function setup(options){
 const h=harness(options);
 h.drive();
 h.advance(.6);
 assert.equal(h.window.SonoranDrive.inspect().arrival.mode,'drive');
 return h;
}
function skimmer(h){return h.window.SonoranDrive.inspect().state.car;}

function tap(h){h.key('Space');h.key('Space','keyup');}

test('a keyboard tap shorter than a simulation tick still hops and lands',()=>{
 const h=setup(),floor=skimmer(h).z;
 tap(h);
 h.advance(.2);
 assert.equal(skimmer(h).hopPhase,'flight');
 assert.equal(skimmer(h).flightAssist,false);
 assert(skimmer(h).z>floor+1);
 h.advance(5);
 assert.equal(skimmer(h).hopPhase,'hover');
 assert(Math.abs(skimmer(h).z-floor)<.02);
});

test('holding Space flies above a tap jump, release holds altitude, X descends and E lands',()=>{
 const h=setup(),floor=skimmer(h).z;
 h.key('Space');h.advance(.3);
 assert.equal(skimmer(h).flightAssist,false);
 h.advance(3);h.key('Space','keyup');
 assert.equal(skimmer(h).flightAssist,true);
 assert(skimmer(h).z>floor+24);
 h.advance(5);const held=skimmer(h).z;
 h.advance(2);assert(Math.abs(skimmer(h).z-held)<.03);
 h.key('KeyX');h.advance(1.5);h.key('KeyX','keyup');
 assert(skimmer(h).z<held-5);
 h.key('KeyE');h.advance(12);h.key('KeyE','keyup');
 assert.equal(h.window.SonoranDrive.inspect().arrival.mode,'drive');
 assert.equal(skimmer(h).flightAssist,false);
 assert.equal(h.window.SonoranDrive.inspect().arrival.exitStatus.reason,'ready');
 h.key('KeyE');h.key('KeyE','keyup');h.advance(2);
 assert.equal(h.window.SonoranDrive.inspect().arrival.mode,'walk');
});

test('a touch tap jumps, cancelled capture cannot activate flight, and a fresh hold climbs',()=>{
 const h=setup({touch:true}),jump=h.controls.find(b=>b.dataset.action==='hop');
 jump.fire('pointerdown',{pointerId:12});jump.fire('pointercancel',{pointerId:12});
 h.advance(1);assert.equal(skimmer(h).hopPhase,'hover');
 jump.fire('pointerdown',{pointerId:13});jump.fire('pointerup',{pointerId:13});jump.fire('lostpointercapture',{pointerId:13});
 h.advance(.2);assert.equal(skimmer(h).hopPhase,'flight');
 h.advance(5);assert.equal(skimmer(h).hopPhase,'hover');
 jump.fire('pointerdown',{pointerId:14});h.advance(.3);jump.fire('lostpointercapture',{pointerId:14});
 h.advance(5);assert.equal(skimmer(h).flightAssist,false);
 jump.fire('pointerdown',{pointerId:15});h.advance(2);jump.fire('pointerup',{pointerId:15});
 assert.equal(skimmer(h).flightAssist,true);
 assert.equal(h.window.SonoranDrive.inspect().input.hop,false);
});

test('Pause discards both the queued jump and a partial hold',()=>{
 const h=setup();h.key('Space');h.advance(.3);
 h.key('KeyP');h.key('Space','keyup');h.advance(1);
 h.node('continue').click();h.advance(3);
 assert.equal(skimmer(h).flightAssist,false);
 assert.equal(skimmer(h).hopPhase,'hover');
});

test('holding jump through a stop request cannot rearm flight',()=>{
 const h=setup();
 h.key('Space');h.advance(.10);
 h.key('KeyE');h.advance(.05);h.key('KeyE','keyup');
 h.advance(1);
 let s=h.window.SonoranDrive.inspect();
 assert.equal(s.arrival.parkingRequested,true);
 assert.equal(s.arrival.armed,false);
 assert.equal(skimmer(h).flightAssist,false);
 h.key('Space','keyup');h.advance(4.5);
 s=h.window.SonoranDrive.inspect();
 assert.equal(s.arrival.armed,true);
 assert.equal(s.arrival.exitStatus.reason,'ready');
 h.key('Space');h.advance(2);
 assert.equal(skimmer(h).flightAssist,true);
});

test('a tap while parked raises the skimmer and performs one ordinary jump',()=>{
 const h=setup();
 h.key('KeyW');h.advance(.5);h.key('KeyW','keyup');
 h.key('KeyE');h.advance(4);h.key('KeyE','keyup');h.advance(.15);
 assert(skimmer(h).parked);
 tap(h);h.advance(1);
 const s=h.window.SonoranDrive.inspect();
 assert.equal(s.arrival.mode,'drive');
 assert.equal(s.state.car.flightAssist,false);
 assert.equal(s.state.events.filter(event=>event.type==='hop'&&event.vehicleId==='skimmer-01').length,1);
});
