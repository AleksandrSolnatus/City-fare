/* Authored NPC: a distance-history spine, not a tissue/animal solver. Metres, seconds. */
(function(root){
'use strict';
const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
const mix=(a,b,t)=>a+(b-a)*t;
const height=(w,x,y)=>w.terrain?w.terrain.height(x,y):w.height(x,y);
function pointDistance(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
 const u=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);
 return {distance:Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy,p.z-a.z-u*dz),u};
}
// The enclosing shapes are broadphase only. Actual contact uses the same
// exposed armour faces as the renderer, swept linearly during one fixed step.
// The skimmer and armour both use their shared visible surface geometry.
const Geometry=typeof module!=='undefined'&&module.exports?require('./geometry.js'):root.SDGeometry;
function closestTriangle(p,a,b,c){
 const sub=(a,b)=>a.map((n,i)=>n-b[i]),dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0),add=(a,b,t)=>a.map((n,i)=>n+b[i]*t);
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return a;
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b;
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return add(a,ab,d1/(d1-d3));
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c;
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return add(a,ac,d2/(d2-d6));
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)return add(b,sub(c,b),(d4-d3)/((d4-d3)+(d5-d6)));
 const den=1/(va+vb+vc);return a.map((n,i)=>n+ab[i]*vb*den+ac[i]*vc*den);
}
function distanceToFaces(p,faces,ground,exposedOnly=false){
 let best=Infinity,witness=null;
 for(const f of faces){const raw=exposedOnly?Geometry.clipGround(f.vertices,ground):f.vertices;
  for(let j=1;j<raw.length-1;j++){const q=closestTriangle(p,raw[0],raw[j],raw[j+1]);
   if(exposedOnly&&q[2]<ground(q[0],q[1])-1e-6)continue;
   const d=Math.hypot(...q.map((n,k)=>n-p[k]));if(d<best){best=d;witness=q;}
  }
 }return {distance:best,witness};
}
function insideArmour(p,faces){
 if(faces[0]?.label==='armour'){
  // The rendered barrel is convex; exact side/cap halfspaces avoid a ray test.
  const a=faces[0].vertices[0],b=faces[0].vertices[1],center=a.map((n,i)=>(n+faces[4].vertices[1][i])/2),axis=b.map((n,i)=>n-a[i]);
  const axis2=axis.reduce((v,n)=>v+n*n,0),along=p.reduce((v,n,i)=>v+(n-a[i])*axis[i],0);if(along<0||along>axis2)return false;
  for(let j=0;j<8;j++){const v=faces[j].vertices,u=v[1].map((n,i)=>n-v[0][i]),w=v[2].map((n,i)=>n-v[0][i]),normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],side=p.reduce((sum,n,i)=>sum+(n-v[0][i])*normal[i],0),inside=center.reduce((sum,n,i)=>sum+(n-v[0][i])*normal[i],0);if(side*inside<0)return false;}
  return true;
 }
 // Ray parity for the solid crown or barrel; decorative face layers are ignored.
 // Barrel end caps close the volume for occupancy, but are never contact faces.
 const shell=faces.filter(f=>['crown','rear-cap','nose-cap','armour'].includes(f.label)).map(f=>f.vertices),hits=[];
 if(faces[0]?.label==='armour'){
  shell.push(faces.slice(0,8).map(f=>f.vertices[0]));
  shell.push(faces.slice(0,8).map(f=>f.vertices[1]));
 }
 const dir=[.813,.371,.449],sub=(a,b)=>a.map((n,i)=>n-b[i]),dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 for(const raw of shell)for(let j=1;j<raw.length-1;j++){
  const a=raw[0],e1=sub(raw[j],a),e2=sub(raw[j+1],a),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-10)continue;
  const inv=1/det,s=sub(p,a),u=inv*dot(s,h);if(u<0||u>1)continue;const q=cross(s,e1),v=inv*dot(dir,q);if(v<0||u+v>1)continue;
  const t=inv*dot(e2,q);if(t>1e-8&&!hits.some(n=>Math.abs(n-t)<1e-6))hits.push(t);
 }
 return hits.length%2===1;
}
const sub3=(a,b)=>a.map((n,i)=>n-b[i]),dot3=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0),cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function segmentTriangle(p,q,a,b,c){
 const dir=sub3(q,p),e1=sub3(b,a),e2=sub3(c,a),h=cross3(dir,e2),det=dot3(e1,h);if(Math.abs(det)<1e-10)return null;
 const inv=1/det,s=sub3(p,a),u=inv*dot3(s,h);if(u<0||u>1)return null;const r=cross3(s,e1),v=inv*dot3(dir,r);if(v<0||u+v>1)return null;
 const t=inv*dot3(e2,r);return t>=0&&t<=1?p.map((n,i)=>n+dir[i]*t):null;
}
function segmentPair(a,b,c,d){
 const u=sub3(b,a),v=sub3(d,c),w=sub3(a,c),A=dot3(u,u),B=dot3(u,v),C=dot3(v,v),D=dot3(u,w),E=dot3(v,w),den=A*C-B*B;
 let s=den>1e-12?clamp((B*E-C*D)/den,0,1):0,t=C>1e-12?(B*s+E)/C:0;
 if(t<0){t=0;s=A>1e-12?clamp(-D/A,0,1):0;}else if(t>1){t=1;s=A>1e-12?clamp((B-D)/A,0,1):0;}
 const p=a.map((n,i)=>n+u[i]*s),q=c.map((n,i)=>n+v[i]*t);return {distance:Math.hypot(...sub3(p,q)),point:q};
}
function triangles(faces){const out=[];for(const f of faces)for(let i=1;i<f.vertices.length-1;i++)out.push([f.vertices[0],f.vertices[i],f.vertices[i+1]]);return out;}
function meshDistance(craft,armour,ground,exposedOnly=false){
 const bounds=t=>({t,min:[0,1,2].map(k=>Math.min(t[0][k],t[1][k],t[2][k])),max:[0,1,2].map(k=>Math.max(t[0][k],t[1][k],t[2][k]))});
 const aa=triangles(craft).map(bounds),bb=triangles(armour).map(bounds);
 let best=Infinity,witness=null;
 const consider=(d,p)=>{if(d<best&&(!exposedOnly||p[2]>=ground(p[0],p[1])-1e-6)){best=d;witness=p;}};
 for(const ax of aa)for(const bx of bb){
  const a=ax.t,b=bx.t,cuts=[];
  // AABB separation is a cheap lower bound before the exact triangle distance.
  let lower=0;for(let k=0;k<3;k++){const gap=Math.max(0,ax.min[k]-bx.max[k],bx.min[k]-ax.max[k]);lower+=gap*gap;}if(lower>=best*best)continue;
  for(let i=0;i<3;i++){
   let q=segmentTriangle(a[i],a[(i+1)%3],...b);if(q){if(!exposedOnly||q[2]>=ground(q[0],q[1])-1e-6)return {distance:0,witness:q};cuts.push(q);}
   q=segmentTriangle(b[i],b[(i+1)%3],...a);if(q){if(!exposedOnly||q[2]>=ground(q[0],q[1])-1e-6)return {distance:0,witness:q};cuts.push(q);}
   q=closestTriangle(a[i],...b);consider(Math.hypot(...sub3(a[i],q)),q);
   q=closestTriangle(b[i],...a);consider(Math.hypot(...sub3(b[i],q)),b[i]);
   for(let j=0;j<3;j++){const edge=segmentPair(a[i],a[(i+1)%3],b[j],b[(j+1)%3]);consider(edge.distance,edge.point);}
  }
  // Intersections can cross an exposed hollow even when their endpoints are buried.
  // Samples stay on the actual triangle/triangle intersection segment.
  if(exposedOnly&&cuts.length>1)for(let j=1;j<cuts.length;j++){const count=Math.max(1,Math.ceil(Math.hypot(...sub3(cuts[j],cuts[0]))/.25));for(let k=1;k<count;k++){const p=cuts[0].map((n,i)=>mix(n,cuts[j][i],k/count));if(p[2]>=ground(p[0],p[1])-1e-6)return {distance:0,witness:p};}}
 }return {distance:best,witness};
}
function sweptContact(pc,c,old,now,world){
 if(!old||!now||now.length<2)return null;
 const ground=(x,y)=>height(world,x,y),craft0=Geometry.skimmerMesh(pc),craft1=Geometry.skimmerMesh(c);
 const interpolate=(a,b,t)=>b.map((f,j)=>({...f,vertices:f.vertices.map((v,k)=>v.map((n,l)=>mix(a[j].vertices[k][l],n,t)))}));
 const vertexTravel=(a,b)=>{let result=0;for(let j=0;j<b.length;j++)for(let k=0;k<b[j].vertices.length;k++)result=Math.max(result,Math.hypot(...sub3(b[j].vertices[k],a[j].vertices[k])));return result;};
 const craftTravel=vertexTravel(craft0,craft1),craftBound=4.5;
 for(let i=0;i<now.length;i++){
  const a0=old[i]||now[i],a1=now[i],prev=old.length===now.length?old:now;
  const span=Math.max(Math.hypot((now[Math.max(0,i-1)].x-now[Math.min(i+1,now.length-1)].x),(now[Math.max(0,i-1)].y-now[Math.min(i+1,now.length-1)].y)),Math.hypot((prev[Math.max(0,i-1)].x-prev[Math.min(i+1,prev.length-1)].x),(prev[Math.max(0,i-1)].y-prev[Math.min(i+1,prev.length-1)].y)))*.26;
  const bound=(Geometry.sectionBound?Math.max(Geometry.sectionBound(prev,i),Geometry.sectionBound(now,i)):Math.max(a0.r,a1.r)+Math.max(5,span))+craftBound;
  const relative0={x:pc.x-a0.x,y:pc.y-a0.y,z:pc.z-a0.z},relative1={x:c.x-a1.x,y:c.y-a1.y,z:c.z-a1.z};
  if(pointDistance({x:0,y:0,z:0},relative0,relative1).distance>bound)continue;
  const f0=Geometry.sectionMesh(prev,i),f1=Geometry.sectionMesh(now,i),speed=craftTravel+vertexTravel(f0,f1);
  function gap(t){
   const center=[mix(pc.x,c.x,t),mix(pc.y,c.y,t),mix(pc.z,c.z,t)],faces=interpolate(f0,f1,t),craft=interpolate(craft0,craft1,t);
   // Lower-bound sphere only rejects separated geometry; it never awards damage.
   const broad=distanceToFaces(center,faces,ground).distance-craftBound;
   if(broad>0&&!insideArmour(center,faces))return {gap:broad};
   for(const f of craft)for(const p of f.vertices)if(p[2]>=ground(p[0],p[1])&&insideArmour(p,faces))return {gap:0,witness:p};
   const raw=meshDistance(craft,faces,ground);
   if(raw.distance>1e-7)return {gap:raw.distance};
   if(raw.witness&&raw.witness[2]>=ground(raw.witness[0],raw.witness[1])-1e-6)return {gap:raw.distance,witness:raw.witness};
   const exposed=meshDistance(craft,faces,ground,true);
   return {gap:raw.distance,witness:exposed.distance<=1e-7?exposed.witness:null};
  }
  const stack=[[0,1,0]];
  while(stack.length){const [lo,hi,depth]=stack.pop(),mid=(lo+hi)/2,g=gap(mid);
   if(g.witness)return {reason:'Exposed worm armour contact',section:i,time:mid,point:{x:g.witness[0],y:g.witness[1],z:g.witness[2]}};
   if(g.gap>speed*(hi-lo)/2+1e-8||speed<1e-10)continue;
   // Bounded swept-surface search: terminal relative travel <= 0.125m.
   // No overlap witness means no hit; extremely shallow sub-tolerance grazes may miss.
   if(depth<19&&speed*(hi-lo)>.125){stack.push([mid,hi,depth+1],[lo,mid,depth+1]);}
  }
 }
 return null;
}

class Worm{
 constructor(world,seed=701,options={}){
  this.world=world;this.seed=seed;this.id=options.id||'western';this.name=options.name||'Western sunworm';this.route=options.route||null;this.routeIndex=0;this.solar=options.solar!==false;this.solarPhase=options.solarPhase||0;this.basking=false;this.solarState='cooling';this.neighbours=[];this.state='roam';this.age=0;this.time=0;this.distance=0;this.cooldown=0;this.warningAge=0;this.events=[];this.eventLog=this.events;this.target=null;
  const spawn=options.spawn||{x:-500,y:-1400,yaw:2.8};this.head={x:spawn.x,y:spawn.y,z:height(world,spawn.x,spawn.y)-43,yaw:spawn.yaw};this.speed=18;this.depth=-43;
  this.history=[];
  for(let d=650;d>=0;d-=2){const x=this.head.x-Math.cos(this.head.yaw)*d,y=this.head.y-Math.sin(this.head.yaw)*d;this.history.push({x,y,z:height(world,x,y)-43,s:-d});}
  this.sections=this.sample();this.previousSections=this.sections.map(p=>({...p}));
 }
 change(state){this.state=state;this.age=0;this.events.push({time:this.time,state});if(this.events.length>80)this.events.shift();}
 sample(){
  const points=[];let j=this.history.length-1;
  for(let i=0;i<=60;i++){
   const s=this.distance-i*10;
   while(j>0&&this.history[j-1].s>s)j--;
   const a=this.history[Math.max(0,j-1)],b=this.history[j];
   const t=clamp((s-a.s)/(b.s-a.s||1),0,1);
   points.push({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t),r:20-10*Math.pow(i/60,3),s});
  }return points;
 }
 legal(x,y,extra=0){
  if(Math.abs(x)>3850-extra||Math.abs(y)>3850-extra)return false;
  if((this.world.rocks||[]).some(r=>Math.hypot(x-r.x,y-r.y)<r.r+34+extra))return false;
  // A local traffic exclusion prevents the advancing crown entering another
  // body's occupied track. It is authored avoidance, not a soft-body solver.
  for(const other of this.neighbours||[])for(let i=0;i<other.sections.length;i+=2){const p=other.sections[i];if(Math.hypot(x-p.x,y-p.y)<p.r+38+extra)return false;}return true;
 }
 step(dt,car,time,footstep=null){
  this.previousSections=this.sections.map(p=>({...p}));this.time=time;this.age+=dt;this.cooldown=Math.max(0,this.cooldown-dt);
  const d=Math.hypot(car.x-this.head.x,car.y-this.head.y),signal=clamp(car.disturbance==null?.6:car.disturbance,.08,1.5);
  const sensed=!car.parked&&d<650+signal*550 && !(this.world.safe&&this.world.safe(car.x,car.y,60));
  // Footsteps are a separate weak, episodic source. This is authored curiosity,
  // not biological hearing: never promote a foot target into the vehicle attack.
  const footDistance=footstep?Math.hypot(footstep.x-this.head.x,footstep.y-this.head.y):Infinity;
  const audible=footstep&&footstep.strength>=.55&&time-footstep.time<3&&footDistance<450&&!(this.world.safe&&this.world.safe(footstep.x,footstep.y,0));
  if(this.state==='roam'&&this.cooldown===0&&audible&&time>=25){this.target={x:footstep.x,y:footstep.y};this.lastFootTime=footstep.time;this.warningAge=0;this.change('listen');}
  if(this.state==='listen'||this.state==='foot-investigate'){
   if(audible){this.target={x:footstep.x,y:footstep.y};this.lastFootTime=footstep.time;}
   const quiet=time-(this.lastFootTime??-Infinity)>5,near=this.target&&Math.hypot(this.target.x-this.head.x,this.target.y-this.head.y)<140;
   if(quiet||near||this.age>12){this.target=null;this.cooldown=10;this.change('roam');}
   else if(this.state==='listen'&&this.age>2.2)this.change('foot-investigate');
  }
  if(this.state!=='roam')this.warningAge+=dt;
  if(time>=25&&this.state==='roam'&&this.cooldown===0&&sensed){this.target={x:car.x,y:car.y};this.warningAge=0;this.change('notice');}
  if(this.state==='notice'&&this.age>2)this.change('investigate');
  if(this.state==='investigate'){
   if(Math.floor(this.age*0.5)!==Math.floor((this.age-dt)*0.5)&&sensed)this.target={x:car.x,y:car.y};
   if(this.age>5&&sensed&&d<900)this.change('telegraph');
   else if(this.age>12){this.cooldown=20;this.change('recover');}
  }
  if(this.state==='telegraph'&&this.age>=5){
   const lead=clamp(d/this.speed,3,12);
   this.target=Object.freeze({x:car.x+(car.vx||0)*lead,y:car.y+(car.vy||0)*lead});
   this.commitYaw=Math.atan2(this.target.y-this.head.y,this.target.x-this.head.x);this.commitDistance=this.distance;this.change('commit');
  }
  if(this.state==='commit'&&this.age>=16){this.passDistance=this.distance;this.change('pass');}
  if(this.state==='pass'&&this.distance-this.passDistance>=620){this.cooldown=35;this.change('recover');}
  if(this.state==='recover'&&this.age>12){this.target=null;this.change('roam');}
  let desired=this.head.yaw;
  if(this.state==='commit'||this.state==='pass')desired=this.commitYaw;
  else if(['notice','investigate','telegraph','foot-investigate'].includes(this.state)&&this.target)desired=Math.atan2(this.target.y-this.head.y,this.target.x-this.head.x);
  else if(this.route){
   let p=this.route[this.routeIndex];if(Math.hypot(p.x-this.head.x,p.y-this.head.y)<210){this.routeIndex=(this.routeIndex+1)%this.route.length;p=this.route[this.routeIndex];}
   desired=Math.atan2(p.y-this.head.y,p.x-this.head.x);
  }else desired=2.8+.25*Math.sin(time/37+this.seed*.001);
  // Read the same pre-step traffic snapshot for both animals. Initiate a broad
  // tangent turn early; the bounded head turn and history remain authoritative.
  let closest=null,nearest=Infinity;
  for(const other of this.neighbours||[])for(let i=0;i<other.sections.length;i+=3){const p=other.sections[i],rd=Math.hypot(p.x-this.head.x,p.y-this.head.y),bearing=Math.atan2(p.y-this.head.y,p.x-this.head.x);if(rd<nearest&&rd<280&&Math.abs(angle(desired-bearing))<1.35){closest={p,rd,bearing};nearest=rd;}}
  if(closest){const side=angle(this.head.yaw-closest.bearing)>=0?1:-1;desired=closest.bearing+side*Math.asin(clamp((closest.p.r+110)/closest.rd,0,1));}
  // Anticipate obstacles beyond minimum turn radius (~100m), selecting a
  // tangent-side heading. History carries the whole body along the legal path.
  for(const rock of this.world.rocks||[]){
   const rx=rock.x-this.head.x,ry=rock.y-this.head.y,rd=Math.hypot(rx,ry),bearing=Math.atan2(ry,rx);
   if(rd<rock.r+280&&Math.abs(angle(desired-bearing))<1.4){
    const side=angle(this.head.yaw-bearing)>=0?1:-1;
    desired=bearing+side*Math.asin(clamp((rock.r+130)/rd,0,1));
   }
  }
  if(Math.abs(this.head.x)>3500||Math.abs(this.head.y)>3500)desired=Math.atan2(-this.head.y,-this.head.x);
  if(this.avoidUntil>time)desired=this.avoidYaw;
  const turn=clamp(angle(desired-this.head.yaw),-.18*dt,.18*dt);this.head.yaw+=turn;
  this.speed=(this.state==='commit'||this.state==='pass')?21:18;
  let move=this.speed*dt,nx=this.head.x+Math.cos(this.head.yaw)*move,ny=this.head.y+Math.sin(this.head.yaw)*move;
  // A legal prefix, never a projection/teleport across rock. A stalled head
  // rotates at the same bounded rate until it can continue into open sand.
  if(!this.legal(nx,ny)){move=0;nx=this.head.x;ny=this.head.y;if(!(this.avoidUntil>time)){this.avoidYaw=this.head.yaw+Math.PI/2;this.avoidUntil=time+14;}}
  let depthGoal=-43;this.basking=false;this.solarState='cooling';
  if(time>=25){
   if(this.state==='telegraph')depthGoal=-27;
   if(this.state==='commit'||this.state==='pass')depthGoal=2+5*Math.sin(this.distance/95);
   if(this.state==='recover')depthGoal=-43;
   if(this.state==='roam'){depthGoal=-28+5*Math.sin(time/13);if(this.solar){const phase=(time+this.solarPhase)%150;this.basking=phase>=42&&phase<83;depthGoal=this.basking?-11:-43;this.solarState=this.basking?'gathering':'cooling';}}
   if(this.state==='listen'||this.state==='foot-investigate')depthGoal=-24+2*Math.sin(time/7);
  }
  if(move>0)this.depth+=clamp(depthGoal-this.depth,-3*dt,3*dt);
  this.head.x=nx;this.head.y=ny;if(move>0)this.head.z=height(this.world,nx,ny)+this.depth;
  if(move>0){this.distance+=move;this.history.push({x:nx,y:ny,z:this.head.z,s:this.distance});}
  // Preserve <=2m history spacing while limiting memory to actual body length.
  if(this.history.length>3){const n=this.history.length;if(this.history[n-2].s-this.history[n-3].s<2)this.history.splice(n-2,1);}
  while(this.history.length>2&&this.history[1].s<this.distance-650)this.history.shift();
  this.sections=this.sample();
 }
}
const api={Worm,sweptContact};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.SDWorm=api;
})(typeof globalThis!=='undefined'?globalThis:this);
