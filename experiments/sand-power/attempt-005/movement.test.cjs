/* Direct arcade movement: deterministic controls act through bounded contact traction. */
const assert=require('node:assert/strict');
const {Body,DT}=require('./body.js');
const checks=[];
function check(name,fn){const result=fn();checks.push({name,result});console.log('PASS',name,result===undefined?'':JSON.stringify(result));}
function run(b,seconds,input){for(let i=0;i<Math.round(seconds/DT);i++)b.step(typeof input==='function'?input(i*DT):input);return b;}
function rotate(b,angle){const co=Math.cos(angle),si=Math.sin(angle);for(const p of b.p){const x=p.x,y=p.y;p.x=x*co-y*si;p.y=x*si+y*co;}const q=b.shape();for(let i=0;i<q.length;i++)b.h[i]=b.ground(q[i].x,q[i].y)-q[i].r*.2;b.start=b.com();b.last=b.com();}
function near(a,b,tol=1e-7){assert.ok(Math.abs(a-b)<tol,`${a} differs from ${b}`);}
function area(b,c){let a=0;for(let j=0;j<4;j++){const p=b.p[c.ids[j]],q=b.p[c.ids[(j+1)%4]];a+=p.x*q.y-q.x*p.y;}return a/2;}

check('W S A D each obey fixed world axes at eight initial body headings',()=>{
 let cases=0;
 for(let heading=0;heading<8;heading++)for(const [key,x,y] of [['forward',1,0],['backward',-1,0],['left',0,-1],['right',0,1]]){
  const b=new Body({depth:true});rotate(b,heading*Math.PI/4);run(b,.8,{[key]:true});
  const v=b.inspect().velocity;near(v.x,x*4.2,.02);near(v.y,y*4.2,.02);assert.ok(b.stats.finite);cases++;
 }
 return {cases};
});
check('Diagonals normalize and boost changes actual COM motion',()=>{
 for(const boost of [false,true])for(const side of ['left','right']){
  const b=new Body({depth:true});run(b,1,{forward:true,[side]:true,boost});const v=b.inspect();
  near(v.speed,boost?6.5:4.2,.01);near(v.velocity.x,(boost?6.5:4.2)/Math.SQRT2,.01);
  near(v.velocity.y,(side==='left'?-1:1)*(boost?6.5:4.2)/Math.SQRT2,.01);
 }
});
check('No direction, boost alone, and opposed keys stay at rest',()=>{
 for(const input of [{},{boost:true},{forward:true,backward:true},{left:true,right:true},{forward:true,backward:true,left:true,right:true,boost:true}]){
  const b=run(new Body({depth:true}),3,input);near(b.distance,0,1e-7);near(b.inspect().speed,0,1e-7);
 }
});
check('Release settles promptly; Space/brake overrides movement; reversing responds promptly',()=>{
 const values=[];
 for(const release of [{},{forward:true,boost:true,coast:true},{right:true,brake:true}]){
  const b=run(new Body({depth:true}),2,{forward:true,boost:true});run(b,.6,release);
  assert.ok(b.inspect().speed<.01);values.push(b.inspect().speed);
 }
 const b=run(new Body({depth:true}),2,{forward:true});run(b,.8,{backward:true});assert.ok(b.inspect().velocity.x< -4.18);
 return {releasedSpeeds:values};
});
check('Contact ablation preserves COM momentum despite directional commands and braking',()=>{
 for(const velocity of [[0,0],[.4,-.2]]){
  const b=new Body({contact:0,depth:true});const initialHeight=b.h.reduce((s,h)=>s+h,0)/b.n;for(const p of b.p){p.vx=velocity[0];p.vy=velocity[1];}
  run(b,5,t=>({forward:t<2,left:t>=2,boost:true,dive:t>1&&t<3,coast:t>4}));
  near(b.com().x,velocity[0]*5,1e-8);near(b.com().y,velocity[1]*5,1e-8);
  near(b.inspect().velocity.x,velocity[0],1e-8);near(b.inspect().velocity.y,velocity[1],1e-8);near(b.stats.driveForce,0);
  const steps=5/DT;near(b.h.reduce((s,h)=>s+h,0)/b.n,initialHeight-1.5*DT*DT*steps*(steps+1)/2,1e-8);
  near(b.vh.reduce((s,v)=>s+v,0)/b.n,-1.5*5,1e-8);
 }
 const air=new Body();for(const p of air.p)p.contact=0;run(air,2,{right:true,boost:true});near(air.inspect().speed,0,1e-8);
});
check('Dive remains independent of directional input; gait comparison ignores dive',()=>{
 const b=run(new Body({depth:true}),5,{dive:true});assert.ok(b.depthIntent.every(v=>v>.99));near(b.inspect().speed,0,1e-7);
 const a=run(new Body({depth:true,gait:'lateral'}),3,{forward:true,dive:true});
 const c=run(new Body({depth:true,gait:'lateral'}),3,{forward:true});assert.deepEqual(a.p,c.p);assert.deepEqual(a.h,c.h);
});
check('Two minutes mixed world directions, stiffness, dive and boost stay finite with bounded traction',()=>{
 const b=new Body({depth:true});let maxDriveForce=0,maxStep=0,minCellArea=Infinity;
 for(let k=0;k<240*120;k++){
  const t=k*DT;b.stiff=t%20>10?18:1;const direction=Math.floor(t/3)%4;
  const old=b.p.map(p=>({x:p.x,y:p.y}));
  b.step({forward:direction===0,backward:direction===2,left:direction===3,right:direction===1,boost:t%9<5,dive:t%13>7,coast:t%17>16});
  const mass=b.p.reduce((s,p)=>s+p.m,0);assert.ok(b.stats.driveForce<=mass*b.drive.tractionAcceleration*b.stats.contactFraction+1e-7);
  assert.ok(b.stats.finite);maxDriveForce=Math.max(maxDriveForce,b.stats.driveForce);
  for(let i=0;i<b.p.length;i++){
   near(b.p[i].x-old[i].x,b.p[i].vx*DT,1e-10);near(b.p[i].y-old[i].y,b.p[i].vy*DT,1e-10);
   maxStep=Math.max(maxStep,Math.hypot(b.p[i].x-old[i].x,b.p[i].y-old[i].y));
  }
  if(k%240===0)for(const c of b.cells)minCellArea=Math.min(minCellArea,area(b,c));
 }
 assert.ok(minCellArea>0);assert.ok(maxStep<.2);
 return {maxDriveForce,maxPointStep:maxStep,minSampledCellArea:minCellArea};
});
check('Identical directional input replay reproduces full tissue and control state',()=>{
 const replay=()=>run(new Body({depth:true}),12,t=>({forward:t<4,right:t>3&&t<6,backward:t>6&&t<8,left:t>8,boost:t>2&&t<9,dive:t>4&&t<8,coast:t>11}));
 const a=replay(),b=replay();assert.deepEqual(a,b);
});
console.log('TOTAL',checks.length,'direct movement checks passed');
