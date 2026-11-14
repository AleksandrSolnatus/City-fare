/* Authored contact cues. Audio is presentation; sensing is deterministic without audio. */
(function(root){'use strict';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const transmission=Object.freeze({sand:1,hardpan:.32,gravel:.16,bedrock:0});
class Contact{
 constructor(game){this.game=game;this.lastId=-1;this.energy=0;this.lastStep=null;this.soundSteps=[];}
 update(session,dt){
  const game=this.game,c=session.contact||{},walking=session.mode==='walk';if(this.record!==c){this.record=c;this.lastId=-1;this.energy=0;this.lastStep=null;}this.energy*=Math.exp(-dt/2.4);this.soundSteps=[];
  for(const step of c.footfalls||[]){if(step.id<=this.lastId)continue;this.lastId=step.id;if(!walking)continue;this.lastStep={...step};this.soundSteps.push({...step});const t=transmission[step.surface]||0;this.energy=clamp(this.energy+.36*t,0,1.6);if(t===0)this.energy=0;}
  if(!walking){this.energy=0;game.footstepSignal=null;}else if(this.lastStep&&this.energy>.01){game.footstepSignal={x:this.lastStep.x,y:this.lastStep.y,time:this.lastStep.time,strength:this.energy,surface:this.lastStep.surface};}else game.footstepSignal=null;
  const p=session.walker||game.car,animals=game.worms||[game.worm],responsive=animals.filter(w=>w.state==='listen'||w.state==='foot-investigate'),w=(responsive.length?responsive:animals).reduce((best,w)=>Math.hypot(w.head.x-p.x,w.head.y-p.y)<Math.hypot(best.head.x-p.x,best.head.y-p.y)?w:best),d=Math.hypot(w.head.x-p.x,w.head.y-p.y),state=w.state==='listen'?'listening':w.state==='foot-investigate'?'approaching':'quiet';
  game.footContact={state,animal:w.id||'western',strength:state==='quiet'?0:clamp(1-d/520),distance:d,bearing:Math.atan2(w.head.y-p.y,w.head.x-p.x),lastStep:this.lastStep?{...this.lastStep}:null,surface:game.world.metadata(p.x,p.y).substrate,returnDistance:Math.hypot(p.x-game.car.x,p.y-game.car.y),energy:this.energy,walking};
  return game.footContact;
 }
}
// Read-only presentation mapping. No input, physics, worm or contact mutation.
function skimmerAudioState(game,mode,previous=null){
 const c=game?.car||{},finite=n=>Number.isFinite(n)?n:0;
 const live=!!game&&(game.status==='playing'||game.status==='arrived');
 const engine=live&&!game.parked&&!c.parked&&(mode==='drive'||mode==='entering'||mode===undefined);
 const speed=clamp(Math.hypot(finite(c.vx),finite(c.vy))/80.4672),effort=engine?clamp(Math.abs(finite(c.throttle))):0;
 const time=finite(game?.time),dt=previous?time-previous.time:0,phase=engine?(c.hopPhase||'hover'):'parked';
 // Real deceleration, not a keypress approximation: coasting and braking share a regenerative whirr.
 const slowing=engine&&previous?.engine&&phase==='hover'&&previous.phase==='hover'&&finite(c.throttle)<=0&&speed>.008&&dt>0&&dt<=.2?clamp((previous.speed-speed)*80.4672/dt/34):0;
 return {engine,time,speed:engine?speed:0,effort,slowing,surge:engine&&!!c.boosting,phase,vertical:engine?clamp(Math.abs(finite(c.vz))/12):0};
}
function skimmerAudioEdges(previous,next){
 const p=previous||{engine:false,surge:false,phase:'parked'},events=[];
 if(!p.engine&&next.engine)events.push('startup');
 if(p.engine&&!next.engine)events.push('shutdown');
 if(next.engine&&next.surge&&!p.surge)events.push('surge');
 if(next.engine&&p.engine&&next.phase==='flight'&&p.phase!=='flight')events.push('hop');
 if(next.engine&&p.engine&&['flight','landing'].includes(p.phase)&&next.phase==='hover')events.push('landing');
 return events;
}
// Authored wildlife voices follow world-time cycles. Listening never changes an animal.
function creatureAudioState(game,observer){
 if(!game||!Number.isFinite(game.time)||!observer)return [];
 const finite=n=>Number.isFinite(n)?n:0,descriptors=[];
 const animals=(game.worms||(game.worm?[game.worm]:[])).slice(0,2).map((w,i)=>({id:w.id||'worm-'+i,kind:'worm',point:w.head,radius:w.sections?.[0]?.r||20,period:i?43:41}));
 if(game.sky)animals.push({id:'ribbonhawk',kind:'sky',point:game.sky,radius:0,period:37});
 for(const animal of animals){
  const p=animal.point;if(!p||![p.x,p.y,p.z].every(Number.isFinite))continue;
  let hash=(game.seed||0)>>>0;for(const c of animal.id)hash=(Math.imul(hash,33)+c.charCodeAt(0))>>>0;
  const phase=hash%animal.period,cycle=Math.floor((game.time+phase)/animal.period),at=cycle*animal.period-phase;
  const dx=p.x-finite(observer.x),dy=p.y-finite(observer.y),dz=p.z-finite(observer.z),distance=Math.hypot(dx,dy,dz),range=animal.kind==='worm'?1400:2000;
  const floor=game.world?.height?game.world.height(p.x,p.y):game.world?.terrain?.height?.(p.x,p.y)||0;
  const burial=animal.kind==='worm'?Math.max(0,floor-p.z-animal.radius):0;
  const distanceGain=distance>=range?0:(1-(distance/range)**2)**2/(1+distance/400);
  const gain=distanceGain*(burial>28?0:Math.exp(-burial/7)),pan=Math.sin(Math.atan2(dy,dx)-finite(observer.yaw))*.65;
  descriptors.push({id:animal.id,kind:animal.kind,period:animal.period,cycle,at,distance,burial,gain,pan});
 }
 return descriptors;
}
class ContactAudio{
 constructor({context=null,offline=false}={}){this.context=context;this.offline=offline;this._enabled=true;this.active=false;this.failed=false;this.ready=offline;this.sources=new Set();this.previous=null;this._injected=!!context;this._activationManaged=false;this._epoch=0;this._pending=0;this._sessionClaim=null;this._suspending=null;this.creatureClock=null;this.creatureGame=null;this.creatureCycles=new Map();this.creatureCalls={worm:0,sky:0};this.lastCreatureCalls=[];if(context)this.init();}
 get enabled(){return this._enabled;}
 set enabled(value){this._enabled=!!value;if(!this._enabled){this._epoch++;this.deactivate();}}
 get time(){return this.offline?(this.renderTime||0):this.context.currentTime;}
 wantsAudio(){return this.enabled&&(this.active||(this._injected&&!this._activationManaged));}
 init(){if(this.master)return;const a=this.context;this.master=a.createGain();this.master.gain.value=0;this.master.connect(a.destination);if(!this.offline){const changed=()=>{this.syncState();if(!this.wantsAudio())this.deactivate();};if(a.addEventListener)a.addEventListener('statechange',changed);else a.onstatechange=changed;}}
 syncState(){
  const wasReady=this.ready;this.ready=this.offline||this.context?.state==='running';
  // A browser interruption is temporary; a recovered context must not stay latched silent.
  if(this.ready)this.failed=false;else if(wasReady)this.silence();
  return this.ready;
 }
 claimSession(){
  if(this.offline||!this.active||!this.enabled||this._sessionClaim)return;
  try{const session=root.navigator?.audioSession;if(!session)return;const previous=session.type;if(previous==='playback')return;session.type='playback';this._sessionClaim={session,previous};}catch{/* Optional platform API; ordinary Web Audio remains available. */}
 }
 releaseSession(){
  const claim=this._sessionClaim;this._sessionClaim=null;
  if(claim)try{if(claim.session.type==='playback')claim.session.type=claim.previous;}catch{/* Do not make silence depend on platform category support. */}
 }
 suspendContext(){
  const a=this.context;if(this.offline||!a||!a.suspend||a.state==='closed'||a.state==='suspended'||this._suspending)return;
  const token={};this._suspending=token;
  try{Promise.resolve(a.suspend()).then(()=>{if(this._suspending===token)this._suspending=null;this.syncState();},()=>{if(this._suspending===token)this._suspending=null;});}catch{if(this._suspending===token)this._suspending=null;}
 }
 deactivate(){this.silence();this.releaseSession();this.suspendContext();}
 unlock(){
  // Only the app's real gesture handlers call this. Never restart from a statechange.
  if(!this.wantsAudio())return Promise.resolve(false);
  if(this.offline)return Promise.resolve(true);
  const epoch=++this._epoch;let counted=false;
  try{
   const Audio=root.AudioContext||root.webkitAudioContext;
   if(!this.context){if(!Audio){this.failed=true;return Promise.resolve(false);}this.context=new Audio();}
   this.init();this.claimSession();const a=this.context;this._pending++;counted=true;
   const settled=()=>{this._pending=Math.max(0,this._pending-1);if(!this.wantsAudio()){this.deactivate();return false;}if(epoch!==this._epoch)return false;return this.syncState();};
   return Promise.resolve(a.resume()).then(settled,()=>{this._pending=Math.max(0,this._pending-1);if(epoch!==this._epoch){if(!this.wantsAudio())this.deactivate();return false;}this.failed=true;this.ready=false;this.deactivate();return false;});
  }catch{if(counted)this._pending=Math.max(0,this._pending-1);this.failed=true;this.ready=false;this.deactivate();return Promise.resolve(false);}
 }
 inspect(){let sessionType='unsupported';try{sessionType=root.navigator?.audioSession?.type||'unsupported';}catch{}return {enabled:this.enabled,active:this.active,state:this.offline?'offline':this.context?.state||'unavailable',ready:this.ready,failed:this.failed,sessionType,sources:this.sources.size,pending:this._pending,creatureCalls:{...this.creatureCalls},lastCreatureCalls:this.lastCreatureCalls.map(c=>({...c}))};}
 // Opt-in recording tap: no context creation, resume, or speaker change.
 captureStream(){if(!this.context||!this.master||!this.context.createMediaStreamDestination)return null;if(!this.capture){this.capture=this.context.createMediaStreamDestination();this.master.connect(this.capture);}return this.capture.stream;}
 releaseCapture(){if(!this.capture)return;this.master.disconnect(this.capture);for(const track of this.capture.stream.getTracks())track.stop();this.capture=null;}
 setActive(active){this._activationManaged=true;this.active=!!active;if(!this.active){this._epoch++;this.deactivate();}}
 target(param,value,t,lag=.08){param.setTargetAtTime(value,t,lag);}
 stopVoice(voice,t=this.time){if(!voice||voice.stopped)return;voice.stopped=true;if(voice.endTime<=t)return;const gain=voice.gain.gain;if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(t);else gain.cancelScheduledValues(t);this.target(gain,0,t,.025);try{voice.source.stop(Math.min(voice.endTime??Infinity,t+.14));}catch{}}
 silence(){this.creatureClock=null;this.creatureGame=null;this.creatureCycles.clear();if(!this.context||!this.master)return;const t=this.time;this.master.gain.cancelScheduledValues(t);this.target(this.master.gain,0,t,.015);for(const v of this.sources)this.stopVoice(v,t);this.engine=null;this.rumble=null;this.previous=null;}
 voice(type,frequency,filterType,cutoff,t,pan=null){
  const a=this.context,source=type==='noise'?a.createBufferSource():a.createOscillator(),gain=a.createGain(),filter=filterType?a.createBiquadFilter():null;
  if(type==='noise'){if(!this.noise){this.noise=a.createBuffer(1,a.sampleRate*2,a.sampleRate);const data=this.noise.getChannelData(0);let seed=9009;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}}source.buffer=this.noise;source.loop=true;}else{source.type=type;source.frequency.value=frequency;}
  gain.gain.value=0;if(filter){filter.type=filterType;filter.frequency.value=cutoff;filter.Q.value=.65;source.connect(filter);filter.connect(gain);}else source.connect(gain);const panner=pan!==null&&a.createStereoPanner?a.createStereoPanner():null;if(panner){panner.pan.value=clamp(pan,-1,1);gain.connect(panner);panner.connect(this.master);}else gain.connect(this.master);
  const voice={source,gain,filter,panner,stopped:false};this.sources.add(voice);source.onended=()=>{source.disconnect();filter?.disconnect();gain.disconnect();panner?.disconnect();this.sources.delete(voice);};source.start(t);return voice;
 }
 tone(from,to,level,duration,t,type='sine',pan=null,attack=.035){
  const v=this.voice(type,from,null,0,t,pan);v.source.frequency.setValueAtTime(from,t);v.source.frequency.exponentialRampToValueAtTime(to,t+duration);v.gain.gain.setValueAtTime(0,t);v.gain.gain.linearRampToValueAtTime(level,t+attack);v.gain.gain.exponentialRampToValueAtTime(.00001,t+duration);v.endTime=t+duration+.02;v.source.stop(v.endTime);
 }
 puff(from,to,level,duration,t,pan=null,attack=.04){const v=this.voice('noise',0,'bandpass',from,t,pan);v.filter.frequency.setValueAtTime(from,t);v.filter.frequency.exponentialRampToValueAtTime(to,t+duration);v.gain.gain.setValueAtTime(0,t);v.gain.gain.linearRampToValueAtTime(level,t+attack);v.gain.gain.exponentialRampToValueAtTime(.00001,t+duration);v.endTime=t+duration+.02;v.source.stop(v.endTime);}
 cue(kind,t){
  if(kind==='startup'){this.tone(48,112,.065,.7,t,'triangle');this.tone(190,336,.016,.9,t+.06);this.puff(180,800,.025,.65,t);}
  if(kind==='shutdown'){this.tone(105,38,.07,.6,t,'triangle');this.tone(260,95,.023,.5,t);this.puff(700,120,.025,.55,t);}
  if(kind==='surge'){this.tone(150,340,.052,.55,t);this.tone(225,510,.019,.65,t);this.puff(430,1300,.045,.62,t);}
  if(kind==='hop'){this.tone(100,260,.05,.3,t);this.puff(240,1600,.13,.5,t);}
  if(kind==='landing'){this.tone(105,46,.13,.32,t);this.tone(230,95,.035,.25,t);this.puff(650,130,.11,.32,t);}
 }
 engineUpdate(state,t){
  const edges=skimmerAudioEdges(this.previous,state);for(const event of edges)this.cue(event,t);this.previous=state;
  if(!state.engine){if(this.engine){for(const v of Object.values(this.engine))this.stopVoice(v,t);this.engine=null;}return;}
  if(!this.engine)this.engine={regen:this.voice('triangle',220,'lowpass',850,t),regenUpper:this.voice('sine',440,null,0,t),undertone:this.voice('triangle',60,'lowpass',230,t),undertoneOctave:this.voice('sine',120,null,0,t),body:this.voice('triangle',70,'lowpass',650,t),overtone:this.voice('sine',141,null,0,t),rotor:this.voice('sine',213,null,0,t),wind:this.voice('noise',0,'lowpass',180,t),surge:this.voice('sine',420,null,0,t),surgeHigh:this.voice('sine',633,null,0,t)};
  const e=this.engine,flight=state.phase==='flight',f=80+state.effort*18+state.speed*16;
  // A nearly steady low motor floor carries weight; its octave survives small speakers.
  const bass=60+state.effort*8+state.speed*3;
  this.target(e.undertone.source.frequency,bass,t,.22);this.target(e.undertoneOctave.source.frequency,bass*2.004,t,.22);
  this.target(e.undertone.gain.gain,(.046+state.effort*.012)*(flight?.6:1),t,.12);
  this.target(e.undertoneOctave.gain.gain,(.018+state.effort*.005)*(flight?.6:1),t,.12);
  this.target(e.body.source.frequency,f,t,.13);this.target(e.overtone.source.frequency,f*2.013,t,.16);this.target(e.rotor.source.frequency,f*3.006,t,.18);
  this.target(e.body.filter.frequency,210+state.effort*130+state.speed*80,t,.14);
  this.target(e.body.gain.gain,(.022+state.effort*.012)*(flight?.4:1),t);
  this.target(e.overtone.gain.gain,(.004+state.effort*.003)*(flight?.45:1),t);
  this.target(e.rotor.gain.gain,.0005+state.effort*.001,t);
  // Air is a low, distant texture. No idle fan; the electric body owns the mix.
  this.target(e.wind.filter.frequency,180+state.speed*420+(flight?100:0),t,.24);
  this.target(e.wind.gain.gain,.008*state.speed**2+(flight?.002+state.vertical*.002:0),t,.24);
  const regen=180+state.speed*240;this.target(e.regen.source.frequency,regen,t,.12);this.target(e.regenUpper.source.frequency,regen*2.003,t,.14);
  this.target(e.regen.gain.gain,state.slowing*.044,t,.12);this.target(e.regenUpper.gain.gain,state.slowing*.010,t,.14);
  this.target(e.surge.source.frequency,310+state.speed*230,t,.1);this.target(e.surgeHigh.source.frequency,465+state.speed*345,t,.1);
  this.target(e.surge.gain.gain,state.surge?.030:0,t,.1);this.target(e.surgeHigh.gain.gain,state.surge?.012:0,t,.12);
 }
 creatureUpdate(game,observer,t){
  const states=creatureAudioState(game,observer),now=game.time,delta=this.creatureClock===null?Infinity:now-this.creatureClock;
  const uninterrupted=this.creatureGame===game&&delta>0&&delta<=.5;
  for(const state of states){
   const previous=this.creatureCycles.get(state.id);this.creatureCycles.set(state.id,state.cycle);
   // First hearing, gaps, re-entry and inaudible crossings never cause catch-up calls.
   if(!uninterrupted||previous===undefined||state.cycle!==previous+1||state.gain<.004)continue;
   this.creatureCall(state,t);this.creatureCalls[state.kind]++;
   this.lastCreatureCalls.push({id:state.id,kind:state.kind,time:state.at,gain:state.gain,pan:state.pan});if(this.lastCreatureCalls.length>4)this.lastCreatureCalls.shift();
  }
  this.creatureClock=now;this.creatureGame=game;
 }
 creatureCall(state,t){
  const g=state.gain,p=state.pan;
  if(state.kind==='worm'){
   // A long exhalation under a mineral chest resonance; no roar on approach.
   this.puff(190,85,.12*g,2.7,t,p,.45);
   this.tone(59,43,.10*g,2.5,t,'sine',p,.4);
   this.tone(128,91,.042*g,2.2,t+.18,'sine',p,.35);
  }else{
   // Two airy phrases belonging to one call, carried across the basin.
   this.tone(430,620,.060*g,.85,t,'sine',p,.14);
   this.puff(1400,700,.045*g,1.05,t,p,.18);
   this.tone(590,390,.050*g,1.2,t+.63,'sine',p,.18);
   this.puff(1100,520,.030*g,1.25,t+.62,p,.2);
  }
 }
 update(contact={},steps=[],game,sessionMode,observer){
  if(!this.context||!this.master||!this.syncState())return;
  const a=this.context,t=this.time,on=this.active&&this.enabled;
  if(!on)return;this.target(this.master.gain,.38,t,.05);
  if(game){this.engineUpdate(skimmerAudioState(game,sessionMode,this.previous),t);if(observer)this.creatureUpdate(game,observer,t);}
  // Contact sensing/cadence remains 008. Foot textures use two restrained physical contacts, no pitched chirp.
  const strength=contact.walking?clamp(contact.strength||0)*.07:0;
  if(strength>.0001&&!this.rumble)this.rumble=this.voice('sine',48,null,0,t);
  if(this.rumble){this.target(this.rumble.gain.gain,strength,t,.25);if(!strength){this.stopVoice(this.rumble,t);this.rumble=null;}}
  for(const step of steps){
   const soft=step.surface==='sand',duration=soft?.19:.15,b=a.createBuffer(1,Math.ceil(a.sampleRate*duration),a.sampleRate),samples=b.getChannelData(0);let seed=(step.id+1)*1709,low=0;
   for(let i=0;i<samples.length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1,x=i/a.sampleRate;low=low*.82+noise*.18;
    // Sand: rounded weight into a short dragging grain tail. Firm: heel, then a softer sole tap 54 ms later.
    if(soft){const weight=(1-Math.exp(-x/.007))*Math.exp(-x/.032),scuff=Math.sin(Math.PI*clamp((x-.027)/.16))**2*.23;samples[i]=(noise*.42+low*1.6)*(weight+scuff)*(1-x/duration);}
    else{const contact=age=>age<0?0:(1-Math.exp(-age/.0012))*Math.exp(-age/.011);const heel=contact(x),sole=contact(x-.054);samples[i]=(noise*.57+low*1.9)*(heel+sole*.62);}
   }
   const source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain();source.buffer=b;filter.type='lowpass';filter.frequency.value=soft?1050:2300;gain.gain.value=soft?.2:.17;source.connect(filter);filter.connect(gain);gain.connect(this.master);const voice={source,gain,filter,stopped:false};this.sources.add(voice);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.sources.delete(voice);};source.start(t);
  }
 }
}
const api={Contact,ContactAudio,transmission,skimmerAudioState,skimmerAudioEdges,creatureAudioState};root.SDContact=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
