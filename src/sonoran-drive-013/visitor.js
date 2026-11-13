/* Visitor progress, not a serialized living world. Metres/seconds stay internal. */
(function(root){'use strict';
const Base=typeof module!=='undefined'&&module.exports?require('./game.js'):root.SDGame;
const SCHEMA='city-fare-visitor',VERSION=1,BUILD='sonoran-drive-013',KEY='city-fare.visitor.013.v1';
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
 if(raw.schema!==SCHEMA||raw.version!==VERSION||![BUILD,'sonoran-drive-012','sonoran-drive-011','sonoran-drive-010','sonoran-drive-009','sonoran-drive-008','sonoran-drive-007','sonoran-drive-006'].includes(raw.build)||raw.tier!=='visitor-progress')fail('Unsupported visitor schema, version, build or persistence tier. Journey evidence is not a visitor save.');
 if(!Array.isArray(raw.visited)||raw.visited.length>ids.length||new Set(raw.visited).size!==raw.visited.length||raw.visited.some(v=>!ids.includes(v)))fail('Invalid visited places.');
 if(!['available','carrying','delivered'].includes(raw.delivery)||!ids.includes(raw.lastSafe))fail('Invalid delivery or safe station.');
 if(!raw.settings||typeof raw.settings!=='object'||Array.isArray(raw.settings)||Object.keys(raw.settings).sort().join(',')!=='reduced,units,wide'||raw.settings.units!=='imperial'||typeof raw.settings.reduced!=='boolean'||typeof raw.settings.wide!=='boolean')fail('Invalid display settings.');
 if(raw.lastSafe!=='dock'&&!raw.visited.includes(raw.lastSafe))fail('The safe station must be a visited place.');
 if(raw.delivery!=='available'&&!raw.visited.includes('dock'))fail('A carried parcel must originate at the dock.');
 if(raw.delivery==='delivered'&&!raw.visited.includes('waystation'))fail('A delivered parcel requires a waystation visit.');
 return {...copy(raw),build:BUILD};
}
class VisitGame extends Base.Game{
 constructor(seed=701,record=null){super(seed);this.nonterminalArrival=true;this.visitor=record?validate(record):fresh();this.places=PLACES;this.dockedAt=null;this.visitRevision=0;this.destination='waystation';this.message='A quiet station, a green door, and the desert beyond.';if(record)this.park(this.visitor.lastSafe);}
 park(id){const p=PLACES.find(p=>p.id===id);if(!p)throw Error('Unknown station');Object.assign(this.car,{x:p.x,y:p.y,z:this.world.height(p.x,p.y)+2.5,vx:0,vy:0,vz:0,speed:0,throttle:0,boosting:false,boostLocked:false,hopHeld:false,hopPhase:'hover',hopClock:0,surge:1});this.contactEpisode=false;this.clearContactTime=0;this.lastInput='';this.checkpoint={x:p.x,y:p.y,name:p.name};}
 remember(id){if(!this.visitor.visited.includes(id)){this.visitor.visited.push(id);this.visitRevision++;this.events.push({time:this.time,type:'visit',place:id});this.message=PLACES.find(p=>p.id===id).message;}}
 nearby(){return PLACES.find(p=>Math.hypot(p.x-this.car.x,p.y-this.car.y)<=p.radius)||null;}
 canDock(){const clearance=this.car.z-this.world.height(this.car.x,this.car.y);return this.status==='playing'&&this.car.hopPhase==='hover'&&this.car.speed<2&&Math.abs(this.car.vz)<1&&clearance>=(this.parked?.8:1.5)&&clearance<=4&&!!this.nearby()&&this.world.safe(this.car.x,this.car.y,110);}
 dock(){if(!this.canDock())return false;const p=this.nearby();this.remember(p.id);this.visitor.lastSafe=p.id;this.visitRevision++;this.status='docked';this.dockedAt=p.id;this.car.vx=this.car.vy=this.car.vz=this.car.speed=0;this.car.throttle=0;this.car.boosting=false;this.events.push({time:this.time,type:'dock',place:p.id});return true;}
 leave(){if(this.status!=='docked')return false;this.status='playing';this.dockedAt=null;this.message='Nothing is on a timer. Choose your next direction.';this.events.push({time:this.time,type:'undock'});return true;}
 repair(){if(this.status!=='docked')return false;this.health=100;this.damageReason='';this.message='Hull restored. No charge; come back when you need to.';this.events.push({time:this.time,type:'repair',place:this.dockedAt});return true;}
 parcel(){if(this.status!=='docked')return false;const v=this.visitor;if(this.dockedAt==='dock'&&v.delivery==='available'){v.delivery='carrying';this.message='A small tin of tea for East Shelf. No hurry, and no required route.';}else if(this.dockedAt==='waystation'&&v.delivery==='carrying'){v.delivery='delivered';this.message='Tea received. The station lamp is lit for you. Stay for a moment.';}else return false;this.visitRevision++;this.events.push({time:this.time,type:'parcel',state:v.delivery});return true;}
 recover(){this.park(this.visitor.lastSafe);this.health=100;this.damageReason='';this.status='playing';this.dockedAt=null;this.warning='';this.message='Recovered at '+PLACES.find(p=>p.id===this.visitor.lastSafe).name+'. This outing and its tracks remain.';this.events.push({time:this.time,type:'recovery',place:this.visitor.lastSafe,relocation:true});}
 step(input={},dt=1/60){super.step(input,dt);if(this.status==='arrived'){this.status='playing';this.remember('city');this.events=this.events.filter(e=>e.type!=='arrival');}if(this.status==='playing'){const p=this.nearby();if(p&&this.car.speed<12)this.remember(p.id);}}
 snapshot(){return {...super.snapshot(),visitor:copy(this.visitor),dockedAt:this.dockedAt,destination:this.destination};}
}
/* The only checkpoint namespace touched is this attempt's. Invalid originals are never replaced. */
class Store{
 constructor(storage){this.storage=storage;this.blocked=false;this.retainedRaw=null;this.status='Portable export is available.';}
 load(){try{const raw=this.storage?.getItem(KEY);if(raw==null){this.status='No local visitor record yet. Export a file to keep a portable copy.';return null;}this.retainedRaw=raw;const v=validate(raw);this.status='Remembered locally. Reload begins a new outing at your safe station.';return v;}catch(e){this.blocked=true;this.status='Local record unavailable or invalid; original retained. '+e.message;return null;}}
 save(v){const value=JSON.stringify(validate(v));if(this.blocked)return false;try{if(!this.storage)throw Error('Browser storage unavailable');this.storage.setItem(KEY,value);this.status='Visitor remembered locally · portable export recommended.';return true;}catch(e){this.status='Local save unavailable. Export a visitor file. '+e.message;return false;}}
}
const api={VisitGame,PLACES,fresh,validate,Store,KEY,mph:v=>v/.44704,distance:v=>v>=1609.344?(v/1609.344).toFixed(1)+' mi':Math.round(v/0.3048)+' ft'};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.SDVisitor=api;
})(typeof globalThis!=='undefined'?globalThis:this);
