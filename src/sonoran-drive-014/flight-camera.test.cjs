const test=require('node:test'),assert=require('node:assert/strict'),{View}=require('./view.js');
const opt={W:1280,H:720,dt:1/60,arrival:{mode:'drive',driveBlend:1}};
function game(){return {car:{x:0,y:0,z:500,yaw:0,vx:0,vy:0,vz:0},world:{terrain:{height:()=>0}}};}
test('observation framing eases outward and returns without changing the skimmer',()=>{
 const g=game(),v=new View({},{});v.frame(g,opt);assert.equal(v.metrics.flightCameraBlend,0);const groundEye=[...v.metrics.eye];g.car.flightAssist=true;const state=JSON.stringify(g.car);let prev=groundEye;
 for(let i=0;i<600;i++){v.frame(g,opt);assert(Math.hypot(...v.metrics.eye.map((n,k)=>n-prev[k]))<.2);prev=[...v.metrics.eye];}
 assert.equal(JSON.stringify(g.car),state);assert(v.metrics.eye[0]<-20.9);assert(v.metrics.cameraPitch>-.08);assert(v.metrics.cameraHeightAboveTerrainM>500);
 g.car.flightAssist=false;for(let i=0;i<600;i++)v.frame(g,opt);assert(Math.abs(v.metrics.eye[0]-groundEye[0])<.02);assert(Math.abs(v.metrics.cameraPitch+.16)<.001);
});
test('high and backward observation changes only the resolved eye, never vehicle heading',()=>{
 const g=game(),v=new View({},{});g.car.flightAssist=true;for(let i=0;i<200;i++)v.frame(g,opt);const heading=g.car.yaw;
 v.frame(g,{...opt,look:{yaw:Math.PI,pitch:1.3}});assert.equal(g.car.yaw,heading);assert(Math.abs(v.metrics.cameraYaw-Math.PI)<1e-10);assert(v.metrics.cameraPitch>1);assert(v.metrics.cameraPitch<Math.PI/2);
});
