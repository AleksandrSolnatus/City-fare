/* Visitor progress, not a serialized living world. Metres/seconds stay internal. */
(function(root){'use strict';
const Base=typeof module!=='undefined'&&module.exports?require('./game.js'):root.SDGame;
const Arrival=typeof module!=='undefined'&&module.exports?require('./arrival.js'):root.SDArrival;
const SCHEMA='city-fare-visitor',VERSION=1,BUILD='sonoran-drive-015',KEY='city-fare.visitor.015.v1';
const PRIOR_KEYS=['city-fare.visitor.014.v1','city-fare.visitor.013.v1'];
const PLACES=Object.freeze([
 {id:'dock',name:'Lantern Dock',x:-2800,y:-2200,radius:70,kind:'dock',message:'The lamps stay on. Take any road you like; there is room here when you return.'},
 {id:'lookout',name:'Quiet Mesa',x:-650,y:150,radius:65,kind:'lookout',message:'Let the engine rest. The basin is wide enough to watch without following.'},
 {id:'waystation',name:'East Shelf Station',x:650,y:700,radius:65,kind:'station',message:'A windbreak, a kettle, and a light for the next traveller.'},
 {id:'city',name:'City Gate',x:2000,y:1000,radius:105,kind:'city',message:'You made the crossing. The gates are open, and so is the way back.'}
].map(Object.freeze));
const ids=PLACES.map(p=>p.id),copy=x=>JSON.parse(JSON.stringify(x));
function fresh(){return {schema:SCHEMA,version:VERSION,build:BUILD,tier:'visitor-progress',visited:[],delivery:'available',lastSafe:'dock',settings:{units:'imperial',reduced:false,wide:false}};}
function validate(raw){
 if(typeof raw==='string'){if(raw.length>16000)throw Error('Visitor file is too large (16 KB maximum).');try{raw=JSON.parse(raw);}catch{throw Error('This is not valid JSON. Your text has been retained.');}}
 const fail=m=>{throw Error(m);};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('Expected a visitor record object.');
 const keys=['schema','version','build','tier','visited','delivery','lastSafe','settings'];
 if(Object.keys(raw).length!==keys.length||keys.some(k=>!Object.hasOwn(raw,k)))fail('Visitor record fields are incomplete or unsupported.');
 if(raw.schema!==SCHEMA||raw.version!==VERSION||![BUILD,'sonoran-drive-014','sonoran-drive-013','sonoran-drive-012','sonoran-drive-011','sonoran-drive-010','sonoran-drive-009','sonoran-drive-008','sonoran-drive-007','sonoran-drive-006'].includes(raw.build)||raw.tier!=='visitor-progress')fail('Unsupported visitor schema, version, build or persistence tier. Journey evidence is not a visitor save.');
 if(!Array.isArray(raw.visited)||raw.visited.length>ids.length||new Set(raw.visited).size!==raw.visited.length||raw.visited.some(v=>!ids.includes(v)))fail('Invalid visited places.');
 if(!['available','carrying','delivered'].includes(raw.delivery)||!ids.includes(raw.lastSafe))fail('Invalid delivery or safe station.');
 if(!raw.settings||typeof raw.settings!=='object'||Array.isArray(raw.settings)||Object.keys(raw.settings).sort().join(',')!=='reduced,units,wide'||raw.settings.units!=='imperial'||typeof raw.settings.reduced!=='boolean'||typeof raw.settings.wide!=='boolean')fail('Invalid display settings.');
 if(raw.lastSafe!=='dock'&&!raw.visited.includes(raw.lastSafe))fail('The safe station must be a visited place.');
 if(raw.delivery!=='available'&&!raw.visited.includes('dock'))fail('A carried parcel must originate at the dock.');
 if(raw.delivery==='delivered'&&!raw.visited.includes('waystation'))fail('A delivered parcel requires a waystation visit.');
 return {...copy(raw),build:BUILD};
}
class VisitGame extends Base.Game{
 constructor(seed=701,record=null){
  super(seed);
  this.nonterminalArrival=true;this.visitor=record?validate(record):fresh();this.places=PLACES;
  this.dockedAt=null;this.visitRevision=0;this.destination='waystation';
  this.addBuggy(Arrival.bays(this.world).find(b=>b.vehicleId==='buggy-01'));
  this.message='A quiet station, a green door, and the desert beyond.';
 }
 station(id){return PLACES.find(p=>p.id===id)||null;}
 safeStation(){return this.station(this.visitor.lastSafe);}
 park(id){
  // Initial placement, before the outing has been created by the app.
  const p=this.station(id);if(!p)throw Error('Unknown station');
  const yaw=Math.atan2(this.world.city.y-p.y,this.world.city.x-p.x);
  this.placeVehicle(this.car,{x:p.x,y:p.y,yaw},{refresh:true});
  this.lastInput='';this.checkpoint={x:p.x,y:p.y,name:p.name};
 }
 remember(id){
  if(!this.visitor.visited.includes(id)){
   this.visitor.visited.push(id);this.visitRevision++;
   this.events.push({time:this.time,type:'visit',place:id,vehicleId:this.occupiedVehicle?.id||null});
   this.message=this.station(id).message;
  }
 }
 nearby(position=this.session?.mode==='walk'?this.session.walker:this.focusVehicle){
  return PLACES.find(p=>Math.hypot(p.x-position.x,p.y-position.y)<=p.radius)||null;
 }
 canDock(){
  if(this.status!=='playing'||!this.nearby())return false;
  if(this.session?.mode==='walk')return this.world.safe(this.session.walker.x,this.session.walker.y,110);
  const c=this.occupiedVehicle;
  if(!c||this.session&&this.session.mode!=='drive'||c.hopPhase!=='hover'||c.speed>=2||Math.abs(c.vz)>=1||!this.world.safe(c.x,c.y,110))return false;
  if(c.type==='buggy')return c.grounded&&c.supportCount>=3&&!c.stranded;
  const clearance=c.z-this.world.height(c.x,c.y);
  return clearance>=(c.parked?.8:1.5)&&clearance<=4;
 }
 dock(){
  if(!this.canDock())return false;
  const p=this.nearby(),c=this.occupiedVehicle;
  this.remember(p.id);this.visitor.lastSafe=p.id;this.visitRevision++;this.status='docked';this.dockedAt=p.id;
  if(c){c.vx=c.vy=c.vz=c.speed=c.throttle=0;c.boosting=false;}
  this.events.push({time:this.time,type:'dock',place:p.id,vehicleId:c?.id||null});return true;
 }
 leave(){
  if(this.status!=='docked')return false;
  this.status='playing';this.dockedAt=null;this.message='Nothing is on a timer. Choose your next direction.';
  this.events.push({time:this.time,type:'undock'});return true;
 }
 repair(id=this.focusVehicle.id){
  if(this.status!=='docked')return false;
  const c=this.vehicle(id),p=this.station(this.dockedAt);
  if(!c||Math.hypot(c.x-p.x,c.y-p.y)>p.radius)return false;
  c.health=100;c.disabled=false;c.damageReason='';
  this.message=c.name+' hull restored. No charge; come back when you need to.';
  this.events.push({time:this.time,type:'repair',place:p.id,vehicleId:c.id});return true;
 }
 parcel(){if(this.status!=='docked')return false;const v=this.visitor;if(this.dockedAt==='dock'&&v.delivery==='available'){v.delivery='carrying';this.message='A small tin of tea for East Shelf. No hurry, and no required route.';}else if(this.dockedAt==='waystation'&&v.delivery==='carrying'){v.delivery='delivered';this.message='Tea received. The station lamp is lit for you. Stay for a moment.';}else return false;this.visitRevision++;this.events.push({time:this.time,type:'parcel',state:v.delivery});return true;}
 completeRecovery(place,c){
  this.failureReason='';this.status='playing';this.dockedAt=null;this.warning='';
  this.checkpoint={x:place.x,y:place.y,name:place.name};
  this.message='Recovered at '+place.name+'. This outing and its tracks remain.';
  this.events.push({time:this.time,type:'recovery',place:place.id,vehicleId:c?.id||null,relocation:true,to:c?{x:c.x,y:c.y,z:c.z}:null});
 }
 recover(){
  if(this.session)return this.session.recover();
  const place=this.safeStation(),c=this.car;
  this.park(place.id);c.health=100;c.disabled=false;c.damageReason='';
  this.completeRecovery(place,c);return true;
 }
 step(input={},dt=1/60){
  super.step(input,dt);
  if(this.status==='arrived'){this.status='playing';this.remember('city');this.events=this.events.filter(e=>e.type!=='arrival');}
  if(this.status==='playing'){
   const p=this.nearby();
   if(p&&(this.occupiedVehicle?.speed||0)<12)this.remember(p.id);
  }
 }
 snapshot(){return {...super.snapshot(),visitor:copy(this.visitor),dockedAt:this.dockedAt,destination:this.destination};}
}
/* The only checkpoint namespace touched is this attempt's. Invalid originals are never replaced. */
class Store{
 constructor(storage){this.storage=storage;this.blocked=false;this.retainedRaw=null;this.status='Portable export is available.';}
 load(){try{let raw=this.storage?.getItem(KEY);for(const key of PRIOR_KEYS){if(raw!=null)break;raw=this.storage?.getItem(key);}if(raw==null){this.status='No local visitor record yet. Export a file to keep a portable copy.';return null;}this.retainedRaw=raw;const v=validate(raw);this.status='Remembered locally. Reload begins a fresh outing at Lantern Dock.';return v;}catch(e){this.blocked=true;this.status='Local record unavailable or invalid; original retained. '+e.message;return null;}}
 save(v){const value=JSON.stringify(validate(v));if(this.blocked)return false;try{if(!this.storage)throw Error('Browser storage unavailable');this.storage.setItem(KEY,value);this.status='Visitor remembered locally · portable export recommended.';return true;}catch(e){this.status='Local save unavailable. Export a visitor file. '+e.message;return false;}}
}
const api={VisitGame,PLACES,fresh,validate,Store,KEY,mph:v=>v/.44704,distance:v=>v>=1609.344?(v/1609.344).toFixed(1)+' mi':Math.round(v/0.3048)+' ft'};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.SDVisitor=api;
})(typeof globalThis!=='undefined'?globalThis:this);
