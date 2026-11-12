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
test('wing setup changes both drag and available turning grip at the same speed',()=>{
  const speed=vehicleForces(95,0,0,0,0,undefined,'speed');
  const grip=vehicleForces(95,0,0,0,0,undefined,'grip');
  assert.ok(grip.downforce>speed.downforce);
  assert.ok(grip.lateralGrip>speed.lateralGrip);
  assert.ok(speed.acceleration>grip.acceleration);
});

test('all 1,200 direct sweeps hit the unchanged cactus records from both directions',()=>{
  let checked=0;
  for(let chunk=0;chunk<6000;chunk+=600){
    for(const cactus of cactusRecords(chunk)){
      for(const dir of [-1,1]){
        const hits=sweptCactusHits(cactus.x-dir*6,cactus.z,cactus.x+dir*6,cactus.z);
        assert.ok(hits.some(hit=>hit.id===cactus.id),
          'missed '+cactus.id+' from direction '+dir);
        checked++;
      }
    }
  }
  assert.equal(checked,1200);
});
test('120 high-speed driving crossings include both sides of the 612m boundary',()=>{
  let checked=0;
  for(let chunk=0;chunk<6000;chunk+=600){
    for(const side of [-1,1]){
      const target=cactusRecords(chunk).find(c=>c.id==='c:'+chunk+':570:'+side+':near');
      assert.ok(target);
      assert.equal(target.z,chunk+612);
      for(const dir of [-1,1])for(const v of [50,100,145]){
        const state={...fresh(),x:target.x-dir*3,z:target.z,
          v,angle:dir*Math.PI/2,distance:target.z+30};
        step(state,{gas:true},.08);
        assert.ok(state.destroyedCacti.includes(target.id),
          'missed '+target.id+' at '+v+' m/s in '+dir+' direction');
        assert.ok(state.impacts.some(hit=>hit.id===target.id));
        checked++;
      }
    }
  }
  assert.equal(checked,120);
});
