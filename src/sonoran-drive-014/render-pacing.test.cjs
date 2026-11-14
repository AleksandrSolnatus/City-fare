'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const GPU=require('./gpu.js'),{VisitGame}=require('./visitor.js');
const ctx=()=>new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{},set:()=>true});
function captureView(){let submitted;class SurfaceGPU{metrics={};render(w,cam,opt,faces){submitted=structuredClone(faces);return {};}build(w){this.world=w;}}
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/view.js','utf8'),{module,require:n=>n==='./gpu.js'?{...GPU,SurfaceGPU}:require(n),document:{},performance});return {View:module.exports.View,faces:()=>submitted};}
test('sparse terrain upload detects exact changes, removals and new worlds without modifying sand',()=>{
 const w={edits:new Map([['0,0',.125],['10,-3',1.5]])},before=JSON.stringify([...w.edits]);let s=GPU.syncTerrainEdits(w);assert.deepEqual(s.dirty,{x:0,y:0,width:513,height:513});assert.equal(s.data[256*513+256],.125);assert.equal(s.padding,1.5);assert.equal(JSON.stringify([...w.edits]),before);
 s=GPU.syncTerrainEdits(w,s);assert.equal(s.dirty,null);w.edits.set('0,0',.5);s=GPU.syncTerrainEdits(w,s);assert.deepEqual(s.dirty,{x:256,y:256,width:1,height:1});assert.equal(s.data[256*513+256],.5);
 w.edits.delete('0,0');s=GPU.syncTerrainEdits(w,s);assert.deepEqual(s.dirty,{x:256,y:256,width:1,height:1});assert.equal(s.data[256*513+256],0);assert.deepEqual(s.bounds,[143,-65,177,-31]);
 const other={edits:new Map()};s=GPU.syncTerrainEdits(other,s);assert.equal(s.dirty.width,513);assert.equal(s.data.some(x=>x!==0),false);assert.equal(s.padding,0);
});
test('cached decal topology still follows live height and invalidates changed XY',()=>{
 let amount=0;const w={baseHeight:(x,y)=>x*.03-y*.02,_delta:()=>amount},raw=[[-3,-2,0],[19,-2,0],[19,11,0],[-3,11,0]];
 const first=GPU.drape(raw,w);amount=2.75;const changed=GPU.drape(raw,w);assert.equal(changed.length,first.length);for(let i=0;i<first.length;i++)for(let j=0;j<first[i].length;j++){assert.deepEqual(changed[i][j].slice(0,2),first[i][j].slice(0,2));assert(Math.abs(changed[i][j][2]-first[i][j][2]-2.75)<1e-10);}
 raw[1][0]+=9;const shifted=GPU.drape(raw,w);assert.notDeepEqual(shifted.map(p=>p.map(v=>v.slice(0,2))),changed.map(p=>p.map(v=>v.slice(0,2))));
});
test('conservative section and road culling preserves submitted faces across turns, high views and edited ground',()=>{
 const g=new VisitGame(701),c=captureView(),v=new c.View({},ctx());g.start();
 g.world.edits.set('-175,-138',12);g.world.edits.set('-174,-138',-1.8);
 const before=JSON.stringify(g.snapshot()),samples=[[-2800,-2200,80,.58,-.16],[-2800,-2200,80,Math.PI,-.16],[-2800,-2200,80,.58,1.35],[-2800,-2200,80,.58,-.75],[-1700,-1900,100,0,-.1],[1900,-2450,90,2.5,-.1]];
 for(const [x,y,z,yaw,pitch]of samples){const arrival={mode:'walk',driveBlend:0,materialize:1,walker:{x,y,z,yaw,pitch}},opt={W:960,H:540,DPR:1,dt:0,arrival};v.render(g,{...opt,noCull:true});const all=c.faces();v.render(g,opt);assert.equal(JSON.stringify(c.faces()),JSON.stringify(all),`faces at${[x,y,z,yaw,pitch]}`);}
 assert.equal(JSON.stringify(g.snapshot()),before);
});
