/* One deterministic simulation owns input, hover, encounter, and recovery. */
(function(root){'use strict';
const W=typeof module!=='undefined'&&module.exports?require('./world.js'):root.SDWorld;
const N=typeof module!=='undefined'&&module.exports?require('./worm.js'):root.SDWorm;
const Flight=typeof module!=='undefined'&&module.exports?require('./flight.js'):root.SDFlight;
const Rare=typeof module!=='undefined'&&module.exports?require('./aggression.js'):root.SDAggression;
const G=typeof module!=='undefined'&&module.exports?require('./geometry.js'):root.SDGeometry;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Authored skimmer tuning; all physics remains metres and seconds.
const FLIGHT_ASSIST=Object.freeze({climb:12,descent:8,upAcceleration:12,downAcceleration:8,ceilingAboveGround:700,ceilingAbsolute:1600});
const HANDLING=Object.freeze({drag:0.31,cruiseSpeed:53.6448,surgeSpeed:80.4672,thrust:53.6448*0.31,surgeThrust:30,surgeSeconds:3.2,rechargeSeconds:10,reverseSpeed:9,brake:34,liftMax:80,downThrust:60,hoverRange:30,hopImpulse:12,landingHeight:5});
class Game{
 constructor(seed=701){this.seed=seed;this.reset();}
 reset(position){this.world=new W.World(this.seed);this.worm=new N.Worm(this.world,this.seed);this.worms=[this.worm,new N.Worm(this.world,this.seed+911,{id:'eastern',name:'Eastern sunworm',spawn:{x:1900,y:-2450,yaw:.65},solar:true,solarPhase:67,route:[{x:2700,y:-1300},{x:1650,y:-700},{x:900,y:-1700},{x:1700,y:-2850}]})];this.sky=new Flight.SkyRaker(this.world,this.seed);this.rare=new Rare.RareEncounter(this.seed);const p=position||this.world.start;this.car={x:p.x,y:p.y,z:this.world.height(p.x,p.y)+2.5,vx:0,vy:0,vz:0,yaw:Math.atan2(this.world.city.y-p.y,this.world.city.x-p.x),speed:0,radius:2.5,throttle:0,surge:1,boosting:false,boostLocked:false,hopHeld:false,hopPhase:'hover',hopClock:0,flightAssist:false,flightLanding:false,flightTarget:null,disturbance:0.15,lift:9.81};this.parked=false;this.footstepSignal=null;this.time=0;this.status='ready';this.health=100;this.message='Follow the broken road, or choose your own line.';this.warning='';this.damageReason='';this.events=[];this.inputEvents=[];this.checkpoint={x:p.x,y:p.y,name:position?.name||'Departure apron'};this.contactEpisode=false;this.clearContactTime=0;this.lastInput='';}
 parkingClearance(){const c=this.car;let z=this.world.height(c.x,c.y)+.9;for(const face of G.skimmerMesh({...c,z:0}))for(const p of face.vertices)z=Math.max(z,this.world.height(p[0],p[1])-p[2]+.12);return z-this.world.height(c.x,c.y);}
 start(){if(this.status==='ready'){this.status='playing';this.events.push({time:this.time,type:'start'});}}
 restart(checkpoint=false){const p=checkpoint?{...this.checkpoint}:null;this.reset(p);this.start();}
 step(input={},dt=1/60){if(this.status!=='playing'&&this.status!=='arrived')return;dt=clamp(dt,0,0.05);if(!dt)return;this.time+=dt;const keys=['forward','backward','left','right','boost','brake','hop'];if(this.car.flightAssist||this.car.flightLanding)keys.push('descend');const signature=keys.map(k=>input[k]?1:0).join('');if(signature!==this.lastInput){this.inputEvents.push({time:this.time,input:signature});this.lastInput=signature;}
 const c=this.car,previous={...c},fx=Math.cos(c.yaw),fy=Math.sin(c.yaw);let along=c.vx*fx+c.vy*fy;const steer=(input.right?1:0)-(input.left?1:0);c.yaw+=steer*(0.42+0.75/(1+Math.abs(along)/26))*dt;const nx=Math.cos(c.yaw),ny=Math.sin(c.yaw);if(!input.boost)c.boostLocked=false;c.boosting=!!input.boost&&!input.backward&&!input.brake&&!c.boostLocked&&c.surge>0;const forward=!input.backward&&(!!input.forward||c.boosting);c.throttle=input.backward?-0.5:forward?1:0;
 if(c.boosting&&c.surge<=dt/HANDLING.surgeSeconds)c.boostLocked=true;
 if(c.boosting)c.surge=Math.max(0,c.surge-dt/HANDLING.surgeSeconds);else c.surge=Math.min(1,c.surge+dt/HANDLING.rechargeSeconds);
 let thrust=forward?(c.boosting?HANDLING.surgeThrust:HANDLING.thrust):0;if(input.backward)thrust=along>0.7?-23:-6;
 // Directional thrust and finite lateral damping: steering never translates axes.
 const lateral=-c.vx*ny+c.vy*nx;const drag=HANDLING.drag;let ax=nx*thrust-c.vx*drag+ny*lateral*2.7,ay=ny*thrust-c.vy*drag-nx*lateral*2.7;
 if(input.brake){const speed=Math.hypot(c.vx,c.vy);if(speed>0){const decel=Math.min(speed/dt,HANDLING.brake);ax-=c.vx/speed*decel;ay-=c.vy/speed*decel;}}
 c.vx+=ax*dt;c.vy+=ay*dt;let speed=Math.hypot(c.vx,c.vy),cap=HANDLING.surgeSpeed;if(along<0&&!forward)cap=HANDLING.reverseSpeed;if(speed>cap){c.vx*=cap/speed;c.vy*=cap/speed;}c.x+=c.vx*dt;c.y+=c.vy*dt;c.speed=Math.hypot(c.vx,c.vy);
 // Bounded powered hover follows slope velocity and curvature. It is an authored
 // vehicle controller, not passive buoyancy; outside 30m ground range it free-falls.
 // Substep support at <=1/60s even for the public 0.05s simulation-step limit.
 const parkedFloor=this.parked?this.world.height(c.x,c.y)+this.parkingClearance():0;c.parkClearance=this.parked?parkedFloor-this.world.height(c.x,c.y):.9;
 const look=.25,initialFloor=this.world.height(previous.x,previous.y);
 const initialRate=(this.world.height(previous.x+c.vx*look,previous.y+c.vy*look)-this.world.height(previous.x-c.vx*look,previous.y-c.vy*look))/(2*look);
 if(input.brake&&c.flightAssist){c.flightAssist=false;c.flightLanding=true;c.flightTarget=null;this.events.push({time:this.time,type:'flight-landing',reason:'brake'});}
 const grounded=c.hopPhase==='hover'&&c.z-initialFloor>=1.5&&c.z-initialFloor<=3.5&&Math.abs(c.vz-initialRate)<3;
 if(!c.flightAssist&&!c.flightLanding&&input.hop&&!c.hopHeld&&grounded){c.vz=initialRate+HANDLING.hopImpulse;c.hopPhase='flight';c.hopClock=0;this.events.push({time:this.time,type:'hop',impulse:HANDLING.hopImpulse});}
 c.hopHeld=!!input.hop;c.hopClock+=dt;
 const hoverSteps=Math.ceil(dt*60),hoverDt=dt/hoverSteps;c.groundCorrection=0;
 for(let h=1;h<=hoverSteps;h++){
 const q=h/hoverSteps,x=previous.x+(c.x-previous.x)*q,y=previous.y+(c.y-previous.y)*q;
 const floor=this.world.height(x,y),target=this.parked?Math.max(floor+.9,parkedFloor):floor+2.5,ahead=this.world.height(x+c.vx*look,y+c.vy*look),behind=this.world.height(x-c.vx*look,y-c.vy*look);
 const floorRate=(ahead-behind)/(2*look),floorAcceleration=(ahead-2*floor+behind)/(look*look);
 const closing=Math.max(0,floorRate-c.vz),clearance=c.z-floor;
 const captureHeight=Math.min(HANDLING.hoverRange,Math.max(HANDLING.landingHeight,2.5+closing*.18+closing*closing/90+Math.max(0,floorAcceleration)*.1));
 if(c.flightAssist||c.flightLanding){
 // Optional powered observation flight. Gravity is still 9.81m/s²; finite
 // thrust changes vertical momentum. No altitude assignment or terrain snap.
 const assist=FLIGHT_ASSIST,ceiling=Math.max(floor+2.5,Math.min(floor+assist.ceilingAboveGround,assist.ceilingAbsolute));
 const landing=c.flightLanding||input.brake,climb=c.flightAssist&&!landing&&!!input.hop&&!input.descend,descend=c.flightAssist&&!landing&&!!input.descend&&!input.hop;
 if(!Number.isFinite(c.flightTarget))c.flightTarget=c.z;
 let wanted;
 if(landing)wanted=floorRate+clamp((2.5-clearance)*2,-assist.descent,assist.climb);
 else if(climb||descend){wanted=climb?assist.climb:-assist.descent;c.flightTarget=c.z+c.vz*Math.abs(c.vz)/(2*assist.downAcceleration);}
 else wanted=clamp((c.flightTarget-c.z)*2,-assist.descent,assist.climb);
 // A soft ceiling and ground cushion request velocity; the engine must still
 // accelerate to it. Ground changes do not teleport the craft or held altitude.
 wanted=Math.min(wanted,Math.sqrt(6*Math.max(0,ceiling-c.z)));
 if(c.z>ceiling)wanted=Math.min(wanted,(ceiling-c.z)*2);
 const groundVelocity=floorRate+clamp((2.5-clearance)*2,-assist.descent,assist.climb);
 wanted=Math.max(wanted,groundVelocity);
 c.lift=this.world.gravity+clamp((wanted-c.vz)*3,-assist.downAcceleration,assist.upAcceleration);
 if(clearance<HANDLING.hoverRange&&closing>0)c.lift=Math.max(c.lift,clamp(this.world.gravity+floorAcceleration+(floor+2.5-c.z)*20+(floorRate-c.vz)*10,0,HANDLING.liftMax));
 c.hopPhase=landing?'landing':'flight';
 if(landing&&Math.abs(clearance-2.5)<.3&&Math.abs(c.vz-floorRate)<.6){c.flightLanding=false;c.flightTarget=null;c.hopPhase='hover';}
 }else{
 if(c.hopPhase==='flight'&&c.hopClock>.2&&closing>0&&clearance<=captureHeight)c.hopPhase='landing';
 c.lift=c.hopPhase==='flight'||c.z-floor>HANDLING.hoverRange?0:clamp(this.world.gravity+floorAcceleration+(target-c.z)*20+(floorRate-c.vz)*10,-HANDLING.downThrust,HANDLING.liftMax);
 if(c.hopPhase==='landing'&&Math.abs(c.z-target)<.35&&Math.abs(c.vz-floorRate)<1)c.hopPhase='hover';
 // Cushion early enough for the measured relative closing speed; finite thrust,
 // never a position reset. Rising ground contributes to required support.
 if(c.hopPhase==='landing'&&closing>0&&clearance>2.5&&clearance<=HANDLING.hoverRange){const stopping=closing*closing/(2*Math.max(.25,clearance-2.5));c.lift=Math.min(HANDLING.liftMax,Math.max(c.lift,this.world.gravity+floorAcceleration+stopping));}
 }
 c.vz+=(c.lift-this.world.gravity)*hoverDt;c.z+=c.vz*hoverDt;
 const correction=Math.max(0,floor+0.8-c.z);c.groundCorrection+=correction;if(correction>0){c.z=floor+0.8;c.vz=Math.max(0,c.vz);}
 }
 c.disturbance=0.15+Math.abs(c.throttle)*0.55+(c.boosting?0.55:0)+Math.min(0.15,Math.abs(c.vz)*0.025);if(this.world.material(c.x,c.y)==='rock')c.disturbance*=0.2;if(c.flightAssist||c.flightLanding)c.disturbance*=Math.exp(-Math.max(0,c.z-this.world.height(c.x,c.y)-2.5)/45);
 c.parked=!!this.parked;if(this.parked)c.disturbance=0;
 this.rare.step(this);
 const traffic=this.worms.map(w=>({id:w.id,sections:w.sections}));for(const worm of this.worms){worm.neighbours=traffic.filter(w=>w.id!==worm.id);worm.step(dt,c,this.time,this.footstepSignal);}this.sky.step(dt,this.time);this.world.stepSand(this.worms,dt);
 let contact=null;for(const worm of this.worms){const hit=N.sweptContact(previous,c,worm.previousSections,worm.sections,this.world);if(hit&&(!contact||hit.time<contact.time))contact={...hit,animal:worm.id,warningAge:worm.warningAge};}
 if(contact){this.clearContactTime=0;if(!this.contactEpisode){this.contactEpisode=true;this.health=Math.max(0,this.health-40);this.damageReason=contact.reason||'Exposed worm body';this.message='Hull struck. Turn clear of the moving body.';this.events.push({time:this.time,type:'damage',reason:this.damageReason,health:this.health,warningAge:contact.warningAge,animal:contact.animal,contact:{section:contact.section,point:contact.point,timeFraction:contact.time}});if(this.health===0){this.status='failed';this.message='Hull disabled — retry from your last refuge.';}}}else{this.clearContactTime+=dt;if(this.clearContactTime>1)this.contactEpisode=false;}
 const edge=this.world.size/2-Math.max(Math.abs(c.x),Math.abs(c.y)),priority={telegraph:0,commit:1,pass:1,notice:2,investigate:2};
 // The message and direction identify the SAME highest-priority animal. A nearer
 // curious animal must not steal the bearing from a farther committed crossing.
 this.warningWorm=edge<250?null:this.worms.filter(w=>Object.hasOwn(priority,w.state)).sort((a,b)=>priority[a.state]-priority[b.state]||Math.hypot(a.head.x-c.x,a.head.y-c.y)-Math.hypot(b.head.x-c.x,b.head.y-c.y))[0]||null;
 const warningState=this.warningWorm?.state;this.warning=edge<250?'Escarpment ahead — turn back.':warningState==='telegraph'?'GROUND RISING — turn away from the ridge':warningState==='commit'||warningState==='pass'?'BODY CROSSING — give the whole creature room':warningState==='notice'||warningState==='investigate'?'Distant ground movement — watch the ridge':'';
 if(edge<8){this.status='failed';c.vx=c.vy=0;this.damageReason='World boundary';this.message='Escarpment reached. Retry from a refuge.';this.events.push({time:this.time,type:'boundary'});}
 if(this.world.safe(c.x,c.y,110)){const rock=this.world.rocks.reduce((best,r)=>Math.hypot(c.x-r.x,c.y-r.y)<Math.hypot(c.x-best.x,c.y-best.y)?r:best,this.world.rocks[0]);this.checkpoint={x:rock.x,y:rock.y,name:rock.name};}
 if(!this.nonterminalArrival&&this.status==='playing'&&Math.hypot(c.x-this.world.city.x,c.y-this.world.city.y)<105&&c.speed<12){this.status='arrived';this.message='City Fare delivered. You made the crossing.';this.events.push({time:this.time,type:'arrival'});}
 }
 snapshot(){return {worms:this.worms.map(w=>({id:w.id,name:w.name,seed:w.seed,state:w.state,basking:w.basking,solarState:w.solarState,head:{...w.head},sections:w.sections.map(s=>({...s})),previousSections:w.previousSections.map(s=>({...s})),target:w.target?{...w.target}:null,events:w.events.map(e=>({...e})),history:w.history.map(p=>({...p})),clock:{age:w.age,distance:w.distance,depth:w.depth,cooldown:w.cooldown,warningAge:w.warningAge,routeIndex:w.routeIndex}})),sky:this.sky.snapshot(),rare:this.rare.snapshot(),seed:this.seed,time:this.time,status:this.status,health:this.health,car:{...this.car},parked:!!this.parked,footContact:this.footContact?{...this.footContact}:null,checkpoint:{...this.checkpoint},warning:this.warning,damageReason:this.damageReason,worm:{state:this.worm.state,head:{...this.worm.head},target:this.worm.target?{...this.worm.target}:null},world:{edits:[...this.world.edits],parcels:this.world.parcels.map(p=>({...p})),relaxation:[...this.world.relaxation]},sections:this.worm.sections.map(s=>({...s})),wormEvents:this.worm.events.map(e=>({...e})),wormHistory:this.worm.history.map(p=>({...p})),wormClock:{age:this.worm.age,distance:this.worm.distance,depth:this.worm.depth,cooldown:this.worm.cooldown,warningAge:this.worm.warningAge},sand:this.world.ledger(),events:this.events.map(e=>({...e}))};}
}
const api={Game,HANDLING,FLIGHT_ASSIST};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.SDGame=api;
})(typeof globalThis!=='undefined'?globalThis:this);
