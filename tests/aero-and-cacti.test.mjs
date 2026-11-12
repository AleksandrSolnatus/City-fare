import test from 'node:test';
import assert from 'node:assert/strict';
import {AERO,activeWing,windAt,aeroForces,vehicleForces} from '../dist/aero.js';
import {fresh,step,cactusRecords,sweptCactusHits} from '../dist/road.js';

test('wind is deterministic and the car experiences direction-dependent air drag',()=>{
  assert.deepEqual(windAt(1200,600),windAt(1200,600));
  const tail=aeroForces(90,0,0,0,1),head=aeroForces(90,Math.PI,0,0,1);
  assert.ok(head.drag>tail.drag);
  assert.ok(Number.isFinite(head.apparent));
});
test('the active spoiler trades drag for downforce using a single shared setting',()=>{
  assert.equal(activeWing(0),0);
  assert.equal(activeWing(200),1);
  const low=aeroForces(100,0,0,0,0),high=aeroForces(100,0,0,0,1);
  assert.ok(high.drag>low.drag&&high.downforce>low.downforce);
  assert.ok(high.downforce/AERO.mass>0);
});
test('power competes with drag; sand has lower grip and speed-dependent resistance',()=>{
  const slow=vehicleForces(100,0,0,0,0);
  const fast=vehicleForces(120,0,0,0,0);
  const sand=vehicleForces(100,0,0,0,1);
  assert.ok(slow.acceleration>0,'100 m/s should still have drive');
  assert.ok(fast.acceleration<0,'120 m/s should exceed aero equilibrium');
  assert.ok(sand.lateralGrip<slow.lateralGrip);
  assert.ok(sand.resistance>slow.resistance);
});
test('car can cross the former 32m invisible wall without clamping or teleporting',()=>{
  const state={...fresh(),x:31,z:150,angle:Math.PI/2,v:45,distance:250};
  step(state,{gas:true},.1);
  assert.ok(state.x>32);
  assert.ok(state.v>0);
  assert.ok(Math.abs(state.z-150)<.001);
});
test('cactus shapes and swept hit records share stable identities',()=>{
  const c=cactusRecords(0)[0];
  assert.deepEqual(cactusRecords(0),cactusRecords(0));
  assert.ok(cactusRecords(0).some(item=>item.id.includes(':near')));
  const hits=sweptCactusHits(c.x-6,c.z,c.x+6,c.z);
  assert.ok(hits.some(hit=>hit.id===c.id),'swept high-speed crossing should hit');
  assert.ok(!sweptCactusHits(c.x-6,c.z,c.x+6,c.z,new Set([c.id]))
    .some(hit=>hit.id===c.id),'already destroyed cactus stays absent');
});
test('contact creates exactly one durable cactus event and a speed jolt',()=>{
  const c=cactusRecords(0)[0];
  const state={...fresh(),x:c.x-2.1,z:c.z,angle:Math.PI/2,v:50,distance:1000};
  const before=state.v;
  step(state,{gas:true},.1);
  assert.ok(state.destroyedCacti.includes(c.id));
  assert.ok(state.impacts.some(event=>event.id===c.id));
  assert.ok(state.v<before,'impact dampens speed');
  const hits=state.destroyedCacti.filter(id=>id===c.id).length;
  step(state,{gas:true},.1);
  assert.equal(state.destroyedCacti.filter(id=>id===c.id).length,hits);
});
test('replaying a fixed input sequence reproduces speed and impact history',()=>{
  const drive=()=>{
    const state={...fresh(),x:25,z:300,v:28,distance:300,angle:.3};
    for(let i=0;i<180;i++)step(state,{gas:true,right:i<45,left:i>125},1/60);
    return state;
  };
  assert.deepEqual(drive(),drive());
});
