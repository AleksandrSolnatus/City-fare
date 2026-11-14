/* Sky Raker: an original fictional animal; bounded three-degree-of-freedom
 * flight approximation, not validated animal aerodynamics. Metres/seconds/+Z. */
(function(root){'use strict';
const G=9.81, MASS=40000, AREA=1906, SPAN=100, MAX_POWER=4900000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
class SkyRaker{
 constructor(world,seed=701){
  this.world=world;this.seed=seed>>>0;this.clock=0;this.thermalIndex=0;this.routine='thermal';this.routineAge=0;
  // Fixed geography, never an observer-relative spawn or pursuit target.
  this.thermals=[{x:-1700,y:-1940,r:530,strength:4.1},{x:450,y:-1500,r:610,strength:4.5},{x:-650,y:180,r:520,strength:4.2}];
  const offset=((this.seed%97)-48)*.003;
  this.x=-1700+360*Math.sin(offset);this.y=-1940-360*Math.cos(offset);this.z=270+this.height(this.x,this.y);
  this.tailTurn=0;this.tailHeave=0;this.tailTipTurn=0;this.tailTipHeave=0;this.turnRate=0;
  this.heading=offset;this.bank=0;this.pitch=-.045;this.airspeed=27;this.flapPhase=0;this.flapEnvelope=0;this.burst=0;this.cooldown=0;this.power=0;this.lift=MASS*G;this.drag=0;this.cl=.5;this.thermal=0;this.contacts=0;this.vz=0;this.distance=0;this.poweredSeconds=0;this.glideSeconds=0;this.phase='thermal soaring';this.minimumClearance=Infinity;
 }
 height(x,y){return this.world.height?this.world.height(x,y):this.world.terrain.height(x,y);}
 updraft(x,y,z){let w=-.16;for(const t of this.thermals){const r2=((x-t.x)**2+(y-t.y)**2)/t.r**2;w+=t.strength*Math.exp(-r2*1.3)*clamp((900-z)/450,0,1);}return w;}
 step(dt,time){if(!Number.isFinite(dt)||dt<=0)return this.snapshot();let remaining=Math.min(dt,2);while(remaining>1e-9){const h=Math.min(remaining,1/60);this.integrate(h);remaining-=h;}return this.snapshot();}
 integrate(dt){
  this.clock+=dt;this.routineAge+=dt;let t=this.thermals[this.thermalIndex],r=Math.hypot(this.x-t.x,this.y-t.y);
  if(this.routine==='thermal'&&this.routineAge>95){this.thermalIndex=(this.thermalIndex+1)%this.thermals.length;this.routine='transit';this.routineAge=0;t=this.thermals[this.thermalIndex];r=Math.hypot(this.x-t.x,this.y-t.y);}
  if(this.routine==='transit'&&r<420){this.routine='thermal';this.routineAge=0;}
  const desired=this.routine==='thermal'?Math.atan2(this.y-t.y,this.x-t.x)+Math.PI/2+Math.atan((r-360)/190):Math.atan2(t.y-this.y,t.x-this.x);
  const turnFeed=this.routine==='thermal'?Math.atan(this.airspeed**2/(G*360)):0;
  const requestedBank=clamp(angle(desired-this.heading)*.85+turnFeed,-.55,.55);
  this.bank+=clamp(requestedBank-this.bank,-.19*dt,.19*dt);
  const terrain=this.height(this.x,this.y),lookX=this.x+Math.cos(this.heading)*this.airspeed*9,lookY=this.y+Math.sin(this.heading)*this.airspeed*9;
  const floor=Math.max(terrain,this.height(lookX,lookY))+190;
  this.thermal=this.updraft(this.x,this.y,this.z);
  this.cooldown=Math.max(0,this.cooldown-dt);
  if(this.burst<=0&&this.cooldown<=0&&(this.z<floor+30||this.airspeed<23)){this.burst=11;this.cooldown=27;}
  this.burst=Math.max(0,this.burst-dt);
  const active=this.burst>0;
  this.flapEnvelope+=(Number(active)-this.flapEnvelope)*(1-Math.exp(-dt/1.5));
  // One phase drives both the visible downstroke and propulsion. Extended
  // resting wings have zero thrust after the short muscle relaxation tail.
  this.flapPhase+=dt*2*Math.PI*.46;
  const stroke=.5+.5*Math.cos(this.flapPhase);
  this.power=MAX_POWER*this.flapEnvelope*(.25+.75*stroke);
  if(!active&&this.flapEnvelope<.001)this.flapEnvelope=0;
  const v=this.airspeed,q=.5*1.12*Math.exp(-this.z/8500)*v*v;
  const thrust=this.power/Math.max(v,12);
  const targetV=this.z>480?32:27;
  const estimatedDrag=q*AREA*(.027+.07*this.cl*this.cl);
  const targetPitch=clamp((v-targetV)*.06+(thrust-estimatedDrag)/(MASS*G),-.2,.22);
  const pitchRate=clamp((targetPitch-this.pitch)*.65,-.14,.14);
  const desiredLift=MASS*(G*Math.cos(this.pitch)+v*pitchRate)/Math.cos(this.bank);
  const requestedCl=clamp(desiredLift/(q*AREA),.12,1.35);
  this.cl+=(requestedCl-this.cl)*(1-Math.exp(-dt/1.1));
  this.lift=q*AREA*this.cl;
  this.drag=q*AREA*(.027+.07*this.cl*this.cl);
  // Standard point-mass force resolution: lift is normal to air velocity,
  // bank redirects it laterally; gravity drains glide potential energy.
  const dv=(thrust-this.drag)/MASS-G*Math.sin(this.pitch);
  const dPitch=(this.lift*Math.cos(this.bank)/MASS-G*Math.cos(this.pitch))/v;
  const dHeading=this.lift*Math.sin(this.bank)/(MASS*v*Math.cos(this.pitch));
  this.airspeed+=dv*dt;this.pitch+=dPitch*dt;this.heading=angle(this.heading+dHeading*dt);
  const horizontal=this.airspeed*Math.cos(this.pitch),wind=this.world.wind||{x:1,y:0};
  const vx=horizontal*Math.cos(this.heading)+wind.x*2.2,vy=horizontal*Math.sin(this.heading)+wind.y*2.2;
  this.vz=this.airspeed*Math.sin(this.pitch)+this.thermal;
  this.x+=vx*dt;this.y+=vy*dt;this.z+=this.vz*dt;this.distance+=Math.hypot(vx,vy)*dt;
  this.speed=Math.hypot(vx,vy,this.vz);
  this.turnRate=dHeading;this.updateTail(dt,dHeading);
  const clearance=this.z-this.height(this.x,this.y)-SPAN*.5*Math.abs(Math.sin(this.bank))-8;
  this.minimumClearance=Math.min(this.minimumClearance,clearance);if(clearance<=0)this.contacts++;
  this.phase=this.flapEnvelope>.08?'powered climb':this.routine==='thermal'?'thermal soaring':'glide';
  if(this.flapEnvelope>.08)this.poweredSeconds+=dt;else this.glideSeconds+=dt;
 }
 // Authored passive response to the actual integrated turn and vertical
 // velocity. Two cascaded lags carry the bend toward the tip; no clock-driven
 // wiggle and no feedback into the accepted lift/drag/propulsion model.
 updateTail(dt,turnRate){
  const turn=clamp(-turnRate*70-this.bank*1.2,-3.5,3.5);
  const heave=clamp(-this.vz*.18-this.pitch*3,-1.8,1.8);
  const rootGain=1-Math.exp(-dt/.65),tipGain=1-Math.exp(-dt/.95);
  this.tailTurn+=(turn-this.tailTurn)*rootGain;this.tailHeave+=(heave-this.tailHeave)*rootGain;
  this.tailTipTurn+=(this.tailTurn-this.tailTipTurn)*tipGain;this.tailTipHeave+=(this.tailHeave-this.tailTipHeave)*tipGain;
 }
 snapshot(){return {name:'Sky Raker',design:'Ribbonwake',tailTurn:this.tailTurn,tailHeave:this.tailHeave,tailTipTurn:this.tailTipTurn,tailTipHeave:this.tailTipHeave,turnRate:this.turnRate,x:this.x,y:this.y,z:this.z,heading:this.heading,bank:this.bank,pitch:this.pitch,speed:this.speed||this.airspeed,airspeed:this.airspeed,altitude:this.z,altitudeAGL:this.z-this.height(this.x,this.y),clearance:this.z-this.height(this.x,this.y)-SPAN*.5*Math.abs(Math.sin(this.bank))-8,minimumClearance:this.minimumClearance===Infinity?this.z-this.height(this.x,this.y)-8:this.minimumClearance,verticalSpeed:this.vz,phase:this.phase,routine:this.routine,thermalIndex:this.thermalIndex,thermal:this.thermal,lift:this.lift,drag:this.drag,power:this.power,mass:MASS,span:SPAN,wingArea:AREA,cl:this.cl,flapPhase:this.flapPhase,flapEnvelope:this.flapEnvelope,contacts:this.contacts,distance:this.distance,poweredSeconds:this.poweredSeconds,glideSeconds:this.glideSeconds,time:this.clock};}
 mesh(){return skyRakerMesh(this);}
}
function skyRakerMesh(b){
 const faces=[],ivory='#ddcbaa',light='#e9d8b7',ochre='#ad794e',edge='#4a4240',body='#80715b',dark='#292b2c';
 const ch=Math.cos(b.heading),sh=Math.sin(b.heading),cp=Math.cos(b.pitch),sp=Math.sin(b.pitch),cb=Math.cos(b.bank),sb=Math.sin(b.bank);
 // Local +X is forward, +Y left. Positive bank lowers the left wing.
 function world(v){const yy=v[1]*cb+v[2]*sb,rz=-v[1]*sb+v[2]*cb,xx=v[0]*cp-rz*sp,z=v[0]*sp+rz*cp;return [b.x+xx*ch-yy*sh,b.y+xx*sh+yy*ch,b.z+z];}
 const face=(vs,color,label,materialCoords)=>faces.push({vertices:vs.map(world),localVertices:vs.map(v=>v.slice()),...(materialCoords?{materialCoords:materialCoords.map(v=>v.slice())}:{}),color,label});
 function rod(a,c,r,color,label){const dx=c[0]-a[0],dy=c[1]-a[1],len=Math.hypot(dx,dy)||1,off=[-dy/len*r,dx/len*r,0];face([[a[0]+off[0],a[1]+off[1],a[2]],[c[0]+off[0],c[1]+off[1],c[2]],[c[0]-off[0],c[1]-off[1],c[2]],[a[0]-off[0],a[1]-off[1],a[2]]],color,label);}
 // A continuous shoulder/elbow/wrist spar tensions six broad membrane bays.
 // The foreplane is swept; the trailing edge is distinctly scalloped.
 const stations=[{y:3,lead:7,trail:-13},{y:12,lead:11,trail:-16},{y:24,lead:8,trail:-19},{y:35,lead:3,trail:-17},{y:44,lead:-4,trail:-13},{y:50,lead:-11,trail:-11.5}];
 for(const side of [-1,1]){
  const points=stations.map((s,i)=>{const fraction=s.y/50,stroke=-Math.sin(b.flapPhase)*b.flapEnvelope;const z=2+fraction*3+stroke*(fraction**1.4)*13;return {lead:[s.lead,side*s.y,z],trail:[s.trail,side*s.y,z-1.2-fraction*1.5],mid:[s.lead*.38+s.trail*.62,side*s.y,z+1.1]};});
  for(let i=0;i<points.length-1;i++){const a=points[i],c=points[i+1];face([a.lead,c.lead,c.mid,a.mid],i%2?light:ivory,'wing membrane');face([a.mid,c.mid,c.trail,a.trail],i%2?ivory:ochre,'trailing membrane');rod(a.lead,c.lead,.65,edge,'leading spar');rod(a.trail,c.trail,.34,edge,'scalloped trailing edge');rod(a.lead,a.mid,.23,edge,'tension ray');rod(a.mid,a.trail,.19,edge,'tension ray');
   // Fine fibers follow the membrane surface, two bounded veins per bay.
   for(const t of [.33,.67]){const mix=(p,q)=>p.map((v,k)=>v+(q[k]-v)*t),m=mix(a.mid,c.mid),v=mix(a.trail,c.trail);m[2]+=.035;v[2]+=.035;rod(m,v,.075,'#a89470','membrane vein');}}
  rod(points[4].lead,points[5].lead,.5,dark,'wrist tip');
 }
 // Faceted keel body, long upright neck, wedge head: no borrowed silhouette.
 const rings=[[-18,1.4,0,1.6],[-10,4,0,3.5],[1,4.6,1,4.4],[10,2.8,3,3.8],[18,1.7,5,2.4],[25,2,6,2.5],[31,.3,5.7,.7]];
 const ring=r=>Array.from({length:6},(_,i)=>[r[0],Math.cos(i*Math.PI/3)*r[1],r[2]+Math.sin(i*Math.PI/3)*r[3]]);
 for(let i=0;i<rings.length-1;i++){const a=ring(rings[i]),c=ring(rings[i+1]);for(let j=0;j<6;j++)face([a[j],c[j],c[(j+1)%6],a[(j+1)%6]],j<3?body:edge,'keel and neck');}
 // Selected Ribbonwake study 03: long twin curved sails and a narrow amber
 // dorsal stripe. Preserve its proportions, replacing the study's independent
 // sine animation with the filtered flight response above.
 const turn=Number.isFinite(b.tailTurn)?b.tailTurn:0,tipTurn=Number.isFinite(b.tailTipTurn)?b.tailTipTurn:turn;
 const heave=Number.isFinite(b.tailHeave)?b.tailHeave:0,tipHeave=Number.isFinite(b.tailTipHeave)?b.tailTipHeave:heave;
 const rest=(x,side,offset=0)=>{const q=clamp((-x-20)/60,0,1);return [x,side*(1+q*8)+offset,1+q*4];};
 const bend=(x,side)=>{const q=clamp((-x-20)/60,0,1),p=rest(x,side);return [x,p[1]+q*q*(turn*(1-q)+tipTurn*q),p[2]+q*q*(heave*(1-q)+tipHeave*q)];};
 let prev=[-17,0,0];
 for(let i=1;i<=9;i++){const x=-17-i*7,p=bend(x,0);rod(prev,p,1.4-i*.11,'#8b795b','articulated tail');prev=p;}
 for(const side of [-1,1]){
  for(let i=0;i<8;i++){
   const x=-22-i*7,q=i/8,r=(i+1)/8,a=bend(x,side),c=bend(x-7,side),wa=Math.sin(Math.PI*q)*4.4+.2,wc=Math.sin(Math.PI*r)*4.4+.2;
   const outerA=[a[0],a[1]+side*wa,a[2]],outerC=[c[0],c[1]+side*wc,c[2]],innerA=[a[0],a[1]-side*wa,a[2]],innerC=[c[0],c[1]-side*wc,c[2]];
   // Material coordinates describe the undeformed sail so grain flexes with it.
   face([innerA,innerC,outerC,outerA],i<3?'#b49b6c':'#d7c9a8','long tail sail',[rest(x,side,-side*wa),rest(x-7,side,-side*wc),rest(x-7,side,side*wc),rest(x,side,side*wa)]);
   rod(a,c,.3,'#5b5143','tail ray');rod(outerA,outerC,.12,'#8c7c61','tail sail edge');
   if(i>0&&i<7)rod(innerA,outerA,.09,'#a18c68','tail sail rib');
  }
  face([[22,side*1.9,6],[25,side*2.1,6.6],[25,side*2.15,5.8]],dark,'eye');rod([-5,side*3,-1],[-14,side*4,-4],.65,edge,'folded leg');
 }
 // Stripe sits on the upper hexagonal keel facets instead of floating above.
 const dorsal=[[-12,.7],[-3,.8],[8,.5],[12,.04]].map(([x,width])=>{const i=rings.findIndex((r,j)=>j<rings.length-1&&x>=r[0]&&x<=rings[j+1][0]),a=rings[i],c=rings[i+1],t=(x-a[0])/(c[0]-a[0]);return [x,width,a[2]+(c[2]-a[2])*t+Math.sin(Math.PI/3)*(a[3]+(c[3]-a[3])*t)+.06];});
 for(let i=0;i<dorsal.length-1;i++){const a=dorsal[i],c=dorsal[i+1];face([[a[0],-a[1],a[2]],[c[0],-c[1],c[2]],[c[0],c[1],c[2]],[a[0],a[1],a[2]]],'#d3a65c','amber dorsal marking');}

 return faces;
}
const api={SkyRaker,skyRakerMesh,constants:Object.freeze({gravity:G,mass:MASS,area:AREA,span:SPAN,maxPower:MAX_POWER})};root.SDFlight=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
