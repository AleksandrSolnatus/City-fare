/* Metres, seconds, z up. Sparse cell-volume sand model, authored geology. */
(function(root){'use strict';
const G=9.81, CELL=16, AREA=CELL*CELL;
const Geometry=typeof module!=='undefined'&&module.exports?require('./geometry.js'):root.SDGeometry;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const ellipse=(x,y,cx,cy,rx,ry)=>Math.hypot((x-cx)/rx,(y-cy)/ry);
function distanceSegment(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);}
class World{
 constructor(seed=701){this.seed=seed;this.size=8000;this.gravity=G;this.cellSize=CELL;this.roadWidth=28;this.start={x:-2800,y:-2200};this.city={x:2000,y:1000};this.rocks=[{...this.start,r:320,name:'Departure apron'},{x:-1550,y:-1250,r:310,name:'Copper shelf'},{x:-650,y:150,r:340,name:'Quiet mesa'},{x:650,y:700,r:300,name:'East shelf'},{...this.city,r:550,name:'City bedrock'}];this.roads=[[this.start,{x:-1800,y:-1700},{x:-500,y:-1200},{x:850,y:-100},this.city],[this.start,{x:-2200,y:-1500},this.rocks[1],{x:-1350,y:-400},this.rocks[2],{x:0,y:500},this.rocks[3],this.city]];this.wind={x:0.93,y:Math.sqrt(1-0.93*0.93)};
 // Authored deposits: u is downwind; v runs along the crest. The broad
 // windward half and narrow lee half share a rounded, C1 crest.
 this.dunes=[
  {x:450,y:-1900,h:64,span:530,stoss:460,lee:185,bend:145,form:'crescent'},
  {x:1100,y:-1350,h:77,span:610,stoss:530,lee:215,bend:170,form:'crescent'},
  {x:1750,y:-800,h:62,span:490,stoss:450,lee:175,bend:135,form:'crescent'},
  {x:1400,y:-2600,h:81,span:1050,stoss:560,lee:230,bend:40,form:'long_ridge'},
  {x:2450,y:-2000,h:88,span:1130,stoss:590,lee:250,bend:65,form:'long_ridge'},
  {x:-1000,y:-1450,h:19,span:420,stoss:270,lee:110,bend:95,form:'spillover'}
 ];
 this.stations={basin:{x:-1700,y:-2350,yaw:.25},dunes:{x:200,y:-1950,yaw:.38},longRidge:{x:1350,y:-2650,yaw:1.3},fan:{x:2050,y:1900,yaw:.8},rock:{x:-1550,y:-1250,yaw:.75}};
 this.landmarks=this.rocks.map((r,i)=>({x:r.x+50,y:r.y+45,type:i===4?'city':'shelter',height:i===4?90:6,name:r.name}));for(const road of this.roads)for(let i=1;i<road.length;i++){const a=road[i-1],b=road[i],length=Math.hypot(b.x-a.x,b.y-a.y);for(let d=180;d<length;d+=240){const t=d/length;this.landmarks.push({x:a.x+(b.x-a.x)*t-(b.y-a.y)/length*24,y:a.y+(b.y-a.y)*t+(b.x-a.x)/length*24,type:'post',height:3,name:'Service marker'});}}let plantSeed=seed>>>0;const random=()=>{plantSeed=(Math.imul(plantSeed,1664525)+1013904223)>>>0;return plantSeed/4294967296;};for(let i=0;i<110;i++){const x=random()*6800-3400,y=random()*6800-3400;if(this.material(x,y)==='sand')this.landmarks.push({x,y,type:'cactus',height:3+random()*3,name:'Desert cactus'});}this.edits=new Map();this.relaxation=new Set();this.parcels=[];this.excavated=0;this.deposited=0;this.sandClock=0;this.sandSamples=new WeakMap();this.terrain={height:(x,y)=>this.height(x,y)};}
 rockClearance(x,y){let best=-Infinity;for(const r of this.rocks)best=Math.max(best,r.r-Math.hypot(x-r.x,y-r.y));return best;}
 safe(x,y,margin=75){return this.rockClearance(x,y)>=margin;}
 _fields(x,y){
  const clearance=this.rockClearance(x,y);
  // A large localized sand sea plus a narrow tongue crossing the service road.
  const primary=1-smooth((ellipse(x,y,1370,-1680,2230,1580)-.7)/.3);
  const tongue=1-smooth((ellipse(x,y,-1100,-1450,1100,380)-.62)/.38);
  const sand=1-(1-primary)*(1-tongue);
  const fanNE=1-smooth((ellipse(x,y,2800,2450,2050,2100)-.38)/.62);
  const fanNW=1-smooth((ellipse(x,y,-3100,2350,1550,2050)-.38)/.62);
  const fan=Math.max(fanNE,fanNW)*(1-sand);
  const rock=1-smooth((-clearance)/145);
  let deposit=0,form='interdune';
  if(sand>0){
   let highest=0;
   for(const d of this.dunes){
    const dx=x-d.x,dy=y-d.y,u=dx*this.wind.x+dy*this.wind.y,v=-dx*this.wind.y+dy*this.wind.x;
    const t=v/d.span;if(Math.abs(t)>=1)continue;
    const crest=d.bend*t*t+(d.form==='long_ridge'?40*Math.sin(v/390):0);
    const q=u-crest,w=q<0?d.stoss:d.lee;
    if(Math.abs(q)>=w)continue;
    const taper=1-smooth((Math.abs(t)-.48)/.52);
    const h=d.h*taper*.5*(1+Math.cos(Math.PI*q/w));
    deposit+=h;if(h>highest){highest=h;form=d.form;}
   }
   deposit=(deposit+3.5*sand)*sand*(1-rock);
  }
  return {clearance,sand,fan,fanNE,fanNW,rock,deposit,form};
 }
 _road(x,y){for(const road of this.roads)for(let i=1;i<road.length;i++)if(distanceSegment(x,y,road[i-1],road[i])<this.roadWidth/2)return true;return false;}
 _metadata(x,y,f){
  const substrate=f.clearance>=0?'bedrock':f.sand>.16?'sand':f.fan>.32?'gravel':'hardpan';
  const onRoad=this._road(x,y),salt=substrate==='hardpan'&&ellipse(x,y,-1250,-2100,1550,1050)<1;
  const bedrock=f.rock,dune=f.sand*(1-bedrock),fan=f.fan*(1-bedrock),basin=Math.max(0,1-bedrock-dune-fan);
  return {landform:substrate==='bedrock'?'bedrock':substrate==='sand'?'dune':substrate==='gravel'?'fan':'basin',substrate,overlay:onRoad?'road':salt?'salt_crust':'none',sandDepth:substrate==='sand'?Math.max(0,1.8+this._delta(x,y)):null,refugeClearance:f.clearance,biomeWeights:{basin,dune,fan,bedrock},duneDeposit:f.deposit,duneForm:f.form,roadExposure:clamp(1-f.deposit/28),roadCondition:substrate==='bedrock'?'intact':substrate==='gravel'?'washed':f.deposit>6?'drifted':'faded',wind:this.wind};
 }
 metadata(x,y){return this._metadata(x,y,this._fields(x,y));}
 // sandDepth is the 1.8m editable surface layer plus live edits, not the
 // immutable authored dune body represented separately by duneDeposit.
 // Compatibility strings encode overlay and refuge only. Canonical substrate
 // is required for excavation; legacy "sand" also includes unsafe hardpan/gravel.
 material(x,y){if(this.rockClearance(x,y)>=0)return 'rock';return this._road(x,y)?'road':'sand';}
 _baseHeight(x,y,f){
  const basin=8+0.00000022*((x+1050)**2+(y+1550)**2)+.35*Math.sin(x/680)*Math.sin(y/820);
  let fanHeight=0;
  for(const [cx,weight]of [[2800,f.fanNE],[-3100,f.fanNW]]){
   if(weight<=0)continue;
   let wash=0;
   // Branches diverge downslope from the mountain front, cutting the apron.
   for(const branch of [-.6,-.18,.25,.66]){const axis=cx+(y-3100)*branch+35*Math.sin(y/310+branch*4),d=Math.abs(x-axis),width=28+clamp((3100-y)/2500)*30;if(d<width*2)wash=Math.max(wash,5*(1-smooth(d/(width*2))));}
   fanHeight+=weight*(Math.max(0,16+(y+400)*.023)-wash);
  }
  let shelf=0;
  for(let i=0;i<this.rocks.length;i++){
   const r=this.rocks[i],dx=x-r.x,dy=y-r.y,d=Math.hypot(dx,dy),apron=1-smooth((d-r.r*.56)/(r.r*.44+145));
   // Sloping, weathered rock shelves retain the exact refuge boundary.
   shelf+=(i===4?51:30+i*6)*apron*(1+.12*(dx*.7-dy*.3)/r.r)+.7*apron*Math.sin((dx+dy*.25)/82)*Math.sin(dy/105);
  }
  const edge=smooth((Math.max(Math.abs(x),Math.abs(y))-3450)/550);
  return basin+fanHeight*(1-f.sand)+f.deposit+shelf+180*edge;
 }
 baseHeight(x,y){return this._baseHeight(x,y,this._fields(x,y));}
 _delta(x,y){if(!this.edits||!this.edits.size)return 0;const ix=Math.floor(x/CELL),iy=Math.floor(y/CELL),fx=x/CELL-ix,fy=y/CELL-iy,d=(a,b)=>this.edits.get(a+','+b)||0;return d(ix,iy)*(1-fx)*(1-fy)+d(ix+1,iy)*fx*(1-fy)+d(ix,iy+1)*(1-fx)*fy+d(ix+1,iy+1)*fx*fy;}
 height(x,y){return this.baseHeight(x,y)+this._delta(x,y);}
 sampleGround(x,y){const f=this._fields(x,y),z=this._baseHeight(x,y,f)+this._delta(x,y),e=1,dx=(this.height(x+e,y)-this.height(x-e,y))/(2*e),dy=(this.height(x,y+e)-this.height(x,y-e))/(2*e),n=Math.hypot(dx,dy,1);return {...this._metadata(x,y,f),z,normal:{x:-dx/n,y:-dy/n,z:1/n}};}
 editableNode(ix,iy){
  // A bilinear hat has a full 32m square support and integral CELL². Admit
  // the whole support conservatively: never clip it later at a material edge.
  const x=ix*CELL,y=iy*CELL,pad=CELL*Math.SQRT2;
  if(Math.abs(x)>this.size/2-pad||Math.abs(y)>this.size/2-pad||this.rockClearance(x,y)>-pad)return false;
  // q is 1/minRadius-Lipschitz in world metres. q+pad/minRadius
  // bounds every point of the square, including where two fields overlap.
  // These conservative cutoffs satisfy sand weight > .16 exactly.
  const primary=ellipse(x,y,1370,-1680,2230,1580)+pad/1580<.924;
  const tongue=ellipse(x,y,-1100,-1450,1100,380)+pad/380<.903;
  if(!primary&&!tongue)return false;
  return true;
 }
 addVolume(ix,iy,volume){if(!this.editableNode(ix,iy))return false;const key=ix+','+iy;this.edits.set(key,(this.edits.get(key)||0)+volume/AREA);this.relaxation.add(key);return true;}
 depositNear(x,y,volume){let ix=Math.round(x/CELL),iy=Math.round(y/CELL);if(this.addVolume(ix,iy,volume)){this.deposited+=volume;return;}for(let ring=1;ring<=Math.ceil(this.size/CELL);ring++)for(let k=0;k<16;k++){const a=k*Math.PI/8,nx=ix+Math.round(Math.cos(a)*ring),ny=iy+Math.round(Math.sin(a)*ring);if(this.addVolume(nx,ny,volume)){this.deposited+=volume;return;}}throw Error('No sand destination within model region');}
 relaxSand(dt){
  // Relax only deformation differences, leaving authored dune slopes intact.
  // Each bounded transfer has exactly one donor and one receiver.
  const batch=[...this.relaxation].slice(0,48);
  for(const key of batch){this.relaxation.delete(key);const [ix,iy]=key.split(',').map(Number);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=ix+dx,ny=iy+dy;if(!this.editableNode(nx,ny))continue;const here=this.edits.get(key)||0,there=this.edits.get(nx+','+ny)||0,difference=here-there;if(difference<=1.2)continue;const volume=Math.min((difference-1.2)*AREA*0.5,dt*AREA*1.5);this.addVolume(ix,iy,-volume);this.addVolume(nx,ny,volume);}}
 }
 stepSand(animals,dt){
  // One shared material clock, even with multiple animals. Coarse parcels own
  // their volume until deposition; a full visual budget deposits new sand directly.
  for(let i=this.parcels.length-1;i>=0;i--){const p=this.parcels[i];p.vz-=G*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.z<=this.height(p.x,p.y)){this.depositNear(p.x,p.y,p.volume);this.parcels.splice(i,1);}}
  this.relaxSand(dt);
  const worms=(Array.isArray(animals)?animals:animals?[animals]:[]).filter(w=>w.sections&&w.previousSections);
  if(!worms.length)return;
  this.sandClock+=dt;if(this.sandClock<.12)return;this.sandClock=0;
  // Build ONE union over all moving body sections and both animals. Overlap is
  // maximum local displacement, never summed displacement. The editable1.8m
  // surface layer remains separate from body occupancy and cosmetic dust.
  const footprint=new Map();
  for(const worm of worms){
   const sampled=this.sandSamples.get(worm)||worm.previousSections;
   worm.sections.forEach((s,i)=>{
    const p=sampled[i];if(!p)return;const move=Math.hypot(s.x-p.x,s.y-p.y,s.z-p.z);if(move<.001)return;
    const floor=this.height(s.x,s.y),depth=Math.abs(s.z-floor),core=i===0?s.r*1.1:s.r;
    // Airborne or deeply buried sections cannot excavate the surface layer.
    if(depth>core+2)return;
    const neighbour=worm.sections[Math.min(i+1,worm.sections.length-1)],head=i===0&&Math.hypot(s.x-neighbour.x,s.y-neighbour.y)>.001;
    const cross=Math.sqrt(Math.max(.06,1-(depth/(core+2))**2));
    const halfWidth=(head&&Geometry?.headSpan?Geometry.headSpan(s.r):s.r*.95)*cross,halfLength=head?s.r*1.25:Math.max(halfWidth,8);
    let dx=head?s.x-neighbour.x:s.x-p.x,dy=head?s.y-neighbour.y:s.y-p.y;if(Math.hypot(dx,dy)<.001){dx=1;dy=0;}const len=Math.hypot(dx,dy),fx=dx/len,fy=dy/len;
    const radius=Math.max(halfWidth,halfLength),ix=Math.floor(s.x/CELL),iy=Math.floor(s.y/CELL),n=Math.ceil(radius/CELL)+1;
    for(let a=ix-n;a<=ix+n;a++)for(let b=iy-n;b<=iy+n;b++){
     const x=a*CELL-s.x,y=b*CELL-s.y,u=x*fx+y*fy,v=-x*fy+y*fx;
     if(Math.hypot(u/halfLength,v/halfWidth)>1||!this.editableNode(a,b))continue;
     const key=a+','+b,previous=footprint.get(key);if(!previous||previous.move<move)footprint.set(key,{a,b,move,s,p,width:halfWidth});
    }
   });
   this.sandSamples.set(worm,worm.sections.map(s=>({...s})));
  }
  for(const [key,f]of footprint){
   const old=this.edits.get(key)||0,cut=Math.min(Math.max(0,old+1.8),Math.min(.12,f.move*.12));if(cut<=0)continue;
   const volume=cut*AREA;this.addVolume(f.a,f.b,-volume);this.excavated+=volume;
   const dx=f.s.x-f.p.x,dy=f.s.y-f.p.y,len=Math.hypot(dx,dy)||1,side=((f.a+f.b)&1)?1:-1;
   const x=f.a*CELL-dy/len*(f.width+CELL*1.5)*side,y=f.b*CELL+dx/len*(f.width+CELL*1.5)*side;
   const airborne=this.parcels.length<80?volume*.08:0;this.depositNear(x,y,volume-airborne);
   if(airborne)this.parcels.push({x:f.a*CELL,y:f.b*CELL,z:this.height(f.a*CELL,f.b*CELL)+.7,vx:-dy/len*3*side,vy:dx/len*3*side,vz:3.2,volume:airborne});
  }
 }
 ledger(){let terrain=0;for(const d of this.edits.values())terrain+=d*AREA;const airborne=this.parcels.reduce((s,p)=>s+p.volume,0);return {excavated:this.excavated,deposited:this.deposited,terrain,airborne,balance:terrain+airborne,cells:this.edits.size,parcels:this.parcels.length,gravity:G};}
}
const api={World,GRAVITY:G};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.SDWorld=api;
})(typeof globalThis!=='undefined'?globalThis:this);
