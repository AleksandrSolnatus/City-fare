'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('./game.js'),{World}=require('./world.js'),{ArrivalSession,ground}=require('./arrival.js'),{Contact}=require('./contact.js'),G=require('./geometry.js');
const near=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
function quietAnimal(w){w.sections=[];w.previousSections=[];w.step=()=>{};}
test('two independent sunworms share world coordinates and deterministic replay without spawning at the visitor',()=>{
 const a=new Game(701),b=new Game(701);assert.equal(a.worms.length,2);assert.equal(a.worm,a.worms[0]);assert.notEqual(a.worms[0],a.worms[1]);assert(a.worms.every(w=>w.world===a.world));assert.notEqual(a.worms[0].seed,a.worms[1].seed);assert(Math.hypot(a.worms[1].head.x-a.car.x,a.worms[1].head.y-a.car.y)>4000);
 a.start();b.start();a.parked=b.parked=true;const seen=[new Set(),new Set()],start=a.worms.map(w=>({...w.head}));
 for(let i=0;i<180*60;i++){a.step({brake:true});b.step({brake:true});for(let k=0;k<2;k++){const w=a.worms[k];seen[k].add(w.solarState);assert.equal(w.sections.length,61);near(w.sections[0].s-w.sections[60].s,600);assert(w.sections.every(p=>Number.isFinite(p.x+p.y+p.z)));}if(i%600===0)assert.deepEqual(a.snapshot(),b.snapshot());}
 assert.deepEqual(a.snapshot(),b.snapshot());for(let k=0;k<2;k++){assert.deepEqual([...seen[k]].sort(),['cooling','gathering']);assert(Math.hypot(a.worms[k].head.x-start[k].x,a.worms[k].head.y-start[k].y)>1000);assert.equal(a.worms[k].state,'roam');assert(a.worms[k].events.every(e=>!['notice','telegraph','commit'].includes(e.state)));}assert.equal(a.health,100);assert.equal(a.status,'playing');near(a.world.ledger().balance,0,1e-6);
});
test('collision comes from the second animal shared armour, with one damage event per continuous contact',()=>{
 const g=new Game();g.world.height=()=>0;g.world.terrain.height=()=>0;g.world.stepSand=()=>{};quietAnimal(g.worms[0]);const animal=g.worms[1],s=Array.from({length:12},(_,i)=>({x:-i*10,y:0,z:0,r:20}));animal.sections=s;animal.previousSections=s;animal.step=()=>{};g.car={...g.car,x:-30,y:0,z:2.5,yaw:0};g.start();for(let i=0;i<120;i++)g.step({brake:true});assert.equal(g.health,60);const damage=g.events.filter(e=>e.type==='damage');assert.equal(damage.length,1);assert.equal(damage[0].animal,'eastern');assert(damage[0].contact.point.z>=0);
});
test('walking and exit safety include the second crown and its taller solar frills',()=>{
 const g=new Game();g.start();g.car={...g.car,x:0,y:-1800,z:g.world.height(0,-1800)+2.5,yaw:0};const session=new ArrivalSession(g,{direct:true});assert(session.canExit());const animal=g.worms[1],p=session.exitPoint();animal.sections=Array.from({length:8},(_,i)=>({x:p.x-i*10,y:p.y,z:ground(g.world,p.x-i*10,p.y)-22,r:20}));animal.previousSections=[];assert(G.sectionMesh(animal.sections,2).some(f=>f.vertices.some(v=>v[2]>ground(g.world,v[0],v[1]))),'frill can emerge while barrel is buried');assert(!session.clearOfAnimal(p.x-20,p.y));assert(!session.canExit());assert.equal(session.exitStatus().reason,'nearby-animal');animal.sections=animal.sections.map(s=>({...s,z:s.z-70}));assert(session.canExit());
});
test('weak step feedback selects the responding second worm and remains separate from attacks',()=>{
 const g=new Game(),c=new Contact(g),s={mode:'walk',walker:{x:1800,y:-2450},contact:{footfalls:[]}};g.worms[1].state='listen';const cue=c.update(s,.1);assert.equal(cue.animal,'eastern');assert.equal(cue.state,'listening');assert(cue.strength>0);assert.equal(g.worm.state,'roam');assert.equal(g.worms[1].state,'listen');
});
test('a joint sand union never multiplies overlapping animals or steps parcel gravity twice',()=>{
 const a=new World(),b=new World(),p={x:0,y:-2000,z:a.height(0,-2000)-10,r:20},next={...p,x:-10},one={sections:[{...p,x:1},{...next,x:-9}],previousSections:[p,next]},duplicate={sections:one.sections.map(s=>({...s})),previousSections:one.previousSections.map(s=>({...s}))};a.parcels=[{x:0,y:-2000,z:1000,vx:0,vy:0,vz:0,volume:0}];b.parcels=a.parcels.map(p=>({...p}));a.stepSand(one,.13);b.stepSand([one,duplicate],.13);assert(a.excavated>0);near(a.excavated,b.excavated);assert.deepEqual([...a.edits],[...b.edits]);near(b.parcels[0].vz,-9.81*.13);near(b.ledger().balance,0);for(let i=0;i<1200;i++)b.stepSand(null,1/60);assert.equal(b.parcels.length,0);near(b.ledger().balance,0);assert([...b.edits.values()].some(v=>v<-.01));assert([...b.edits.values()].some(v=>v>.01));
});
test('only actual near-surface motion moves sand; airborne, deeply buried, idle and hard ground remain quiet',()=>{
 const w=new World(),x=0,y=-2000,floor=w.height(x,y);for(const z of [floor+100,floor-100]){const p={x,y,z,r:20};w.stepSand([{sections:[{...p,x:2}],previousSections:[p]}],.13);}const p={x,y,z:floor-10,r:20};w.stepSand([{sections:[p],previousSections:[p]}],.13);assert.equal(w.excavated,0);const rock={...w.start,z:w.height(w.start.x,w.start.y)-10,r:20};w.stepSand([{sections:[{...rock,x:rock.x+2}],previousSections:[rock]}],.13);assert.equal(w.excavated,0);assert.equal(w.edits.size,0);
});
test('opposed patrols bend around one another without head teleport, rigid-body rotation or frozen tracks',()=>{
 const {Worm}=require('./worm.js'),world={terrain:{height:()=>0},rocks:[],safe:()=>false},a=new Worm(world,701,{id:'a',spawn:{x:-1000,y:0,yaw:0},route:[{x:1000,y:0},{x:-1000,y:0}]}),b=new Worm(world,702,{id:'b',spawn:{x:1000,y:0,yaw:Math.PI},route:[{x:-1000,y:0},{x:1000,y:0}]});let closest=Infinity;
 for(let i=0;i<200*60;i++){const snap=[{id:a.id,sections:a.sections},{id:b.id,sections:b.sections}];for(const [k,w]of[a,b].entries()){w.neighbours=[snap[1-k]];const old={...w.head},distance=w.distance;w.step(1/60,{x:0,y:4000,parked:true},i/60);assert(w.distance>distance);assert(Math.hypot(w.head.x-old.x,w.head.y-old.y)<=18/60+1e-9);assert(Math.abs(w.head.yaw-old.yaw)<=.18/60+1e-9);assert.equal(w.sections[0].s-w.sections.at(-1).s,600);}if(i%60===0)for(const x of a.sections)for(const y of b.sections)closest=Math.min(closest,Math.hypot(x.x-y.x,x.y-y.y));}assert(closest>100,`sampled full tracks remain separated ${closest}`);
});

test('warning message and bearing choose the same priority animal; boundary warnings carry no creature bearing',()=>{
 const g=new Game();g.start();for(const w of g.worms)w.step=()=>{};const [nearby,distant]=g.worms;nearby.head={...nearby.head,x:g.car.x+100,y:g.car.y};distant.head={...distant.head,x:g.car.x+800,y:g.car.y};nearby.state='notice';distant.state='telegraph';g.step({brake:true});assert.equal(g.warningWorm,distant);assert.match(g.warning,/GROUND RISING/);
 distant.state='commit';g.step({brake:true});assert.equal(g.warningWorm,distant);assert.match(g.warning,/BODY CROSSING/);
 nearby.state='telegraph';distant.state='telegraph';g.step({brake:true});assert.equal(g.warningWorm,nearby);assert.match(g.warning,/GROUND RISING/);
 Object.assign(g.car,{x:3800,y:0,z:g.world.height(3800,0)+2.5,vx:0,vy:0});g.step({brake:true});assert.equal(g.warningWorm,null);assert.match(g.warning,/Escarpment/);
});
