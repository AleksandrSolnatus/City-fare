import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeCactusHistory,decodeCactusHistory,generatedCactusBit,MAX_CACTUS_IDS}
  from '../dist/cactus-ledger.js';
import {cactusRecords,fresh,step,ROUTE_LENGTH} from '../dist/road.js';
import {TripSave,TRIP_SAVE_KEY} from '../dist/trip-save.js';

const allIds=(count,skipChunk0=false)=>{
  const ids=[];
  for(let start=skipChunk0?600:0;ids.length<count;start+=600)
    for(const c of cactusRecords(start)){
      ids.push(c.id);
      if(ids.length===count)break;
    }
  return ids;
};
const storage=()=>({
  records:new Map(),
  getItem(key){return this.records.get(key)??null;},
  setItem(key,value){this.records.set(key,value);}
});
const checkpoint=(ids,distance=ROUTE_LENGTH/2)=>({
  ...fresh(),x:1.8,z:500,v:80,distance,destroyedCacti:ids
});

test('one hundred percent of 10,001 distinct cactus IDs survive compact save/reload',()=>{
  const ids=allIds(10001),set=new Set(ids);
  assert.equal(set.size,10001);
  const db=storage(),save=new TripSave(db);
  assert.equal(save.load().status,'empty');
  assert.equal(save.save(checkpoint(ids)).status,'saved');
  const raw=db.getItem(TRIP_SAVE_KEY),stored=JSON.parse(raw);
  assert.ok(stored.state.destroyedCactusBits.length>160);
  assert.ok(!('destroyedCacti' in stored.state));
  assert.ok(raw.length<7000,'compact encoding should be far below full string array size');
  const restored=new TripSave(db).load();
  assert.equal(restored.status,'saved');
  assert.equal(restored.checkpoint.state.destroyedCacti.length,10001);
  assert.deepEqual(new Set(restored.checkpoint.state.destroyedCacti),set);
  assert.equal(restored.checkpoint.state.v,0);
});

test('the 10,001st contact from the actual driving code still allows checkpoint writes',()=>{
  const ids=allIds(10000,true);
  const cactus=cactusRecords(600*172)[0];
  assert.ok(!ids.includes(cactus.id));
  const db=storage(),save=new TripSave(db);
  assert.equal(save.load().status,'empty');
  const state={...checkpoint(ids,170000),x:cactus.x-3,z:cactus.z,
    angle:Math.PI/2,v:145};
  assert.equal(save.save(state).status,'saved');
  const before=db.getItem(TRIP_SAVE_KEY);
  step(state,{gas:true},.08);
  assert.ok(state.destroyedCacti.includes(cactus.id));
  assert.ok(state.destroyedCacti.length>=10001);
  assert.equal(save.save(state).status,'saved');
  const after=db.getItem(TRIP_SAVE_KEY);
  assert.notEqual(after,before);
  const reloaded=new TripSave(db).load();
  assert.equal(reloaded.status,'saved');
  assert.equal(reloaded.checkpoint.state.destroyedCacti.length,
    state.destroyedCacti.length);
  assert.ok(reloaded.checkpoint.state.destroyedCacti.includes(cactus.id));
});

test('an old 008 or early 009 ID-array checkpoint loads without rewriting its original bytes',()=>{
  const db=storage(),ids=allIds(10000);
  const legacy=JSON.stringify({version:1,route:'sonoran-007',
    routeLength:ROUTE_LENGTH,savedAt:1794180000000,
    state:{x:1.8,z:500,angle:0,distance:170000,finished:false,
      destroyedCacti:ids}});
  db.setItem(TRIP_SAVE_KEY,legacy);
  const save=new TripSave(db),read=save.load();
  assert.equal(read.status,'saved');
  assert.equal(db.getItem(TRIP_SAVE_KEY),legacy,'loading must not silently migrate');
  assert.deepEqual(new Set(read.checkpoint.state.destroyedCacti),new Set(ids));
  assert.equal(save.save(read.checkpoint.state).status,'saved');
  assert.ok(JSON.parse(db.getItem(TRIP_SAVE_KEY)).state.destroyedCactusBits);
  assert.equal(new TripSave(db).load().checkpoint.state.destroyedCacti.length,10000);
});

test('legacy unusual IDs survive losslessly without being converted to different objects',()=>{
  const unusual=['c:5:15:-1:near','c:000:030:1:0','c:-9999:123:1:1'];
  for(const id of unusual)assert.equal(generatedCactusBit(id),null);
  const original=[...allIds(35),...unusual];
  const compact=encodeCactusHistory(original);
  assert.deepEqual(compact.destroyedCactusExtras,unusual);
  const restored=decodeCactusHistory(compact);
  assert.equal(restored.length,original.length);
  assert.deepEqual(new Set(restored),new Set(original));
});

test('compact records reject corrupt masks, duplicate chunks and ambiguous representations',()=>{
  const sample=encodeCactusHistory(allIds(60));
  const corrupt=[
    {destroyedCactusBits:[[0,'000000000000000']]},
    {destroyedCactusBits:[[0,'1000000000000000']]},
    {destroyedCactusBits:[[0,'00000000000000g']]},
    {destroyedCactusBits:[[0,'000000000000001'],[0,'000000000000002']]},
    {destroyedCactusBits:[[1,'000000000000001'],[0,'000000000000002']]},
    {destroyedCactusBits:[[6000000,'000000000000001']]},
    {destroyedCactusBits:[[0,'000000000000001']],
      destroyedCacti:['c:0:30:-1:0']},
    {...sample,destroyedCactusExtras:['c:0:30:-1:0']},
    {destroyedCactusExtras:['c:0:30:-1:0']}
  ];
  for(const candidate of corrupt)assert.equal(decodeCactusHistory(candidate),null);
});

test('full geometry capacity fits compactly without truncation',()=>{
  const maxChunk=Math.ceil(ROUTE_LENGTH/600);
  const count=60*(maxChunk+2);
  const ids=[];
  for(let chunk=-1;chunk<=maxChunk;chunk++)
    for(const c of cactusRecords(chunk*600))ids.push(c.id);
  assert.equal(ids.length,count);
  assert.ok(ids.length<MAX_CACTUS_IDS);
  const compact=encodeCactusHistory(ids);
  assert.equal(compact.destroyedCactusBits.length,maxChunk+2);
  const raw=JSON.stringify(compact);
  assert.ok(raw.length<160000);
  const restored=decodeCactusHistory(compact);
  assert.equal(restored.length,ids.length);
  assert.equal(restored.at(0),cactusRecords(-600)[0].id);
  assert.equal(new Set(restored).size,ids.length);
});
