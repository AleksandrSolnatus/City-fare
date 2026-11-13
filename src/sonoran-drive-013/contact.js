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
 if(next.engine&&p.engine&&p.phase==='flight'&&next.phase!=='flight')events.push('landing');
 return events;
}
class ContactAudio{
 constructor({context=null,offline=false}={}){this.context=context;this.offline=offline;this._enabled=true;this.active=false;this.failed=false;this.ready=offline;this.sources=new Set();this.previous=null;if(context)this.init();}
 get enabled(){return this._enabled;}
 set enabled(value){this._enabled=!!value;if(!this._enabled)this.silence();}
 get time(){return this.offline?(this.renderTime||0):this.context.currentTime;}
 init(){if(this.master)return;const a=this.context;this.master=a.createGain();this.master.gain.value=0;this.master.connect(a.destination);}
 unlock(){
  // Called only by a real user action. A denied resume is contained and retryable.
  try{const Audio=root.AudioContext||root.webkitAudioContext;if(!this.context){if(!Audio)return Promise.resolve(false);this.context=new Audio();}this.init();return Promise.resolve(this.context.resume()).then(()=>{this.ready=this.context.state==='running';this.failed=!this.ready;return this.ready;},()=>{this.failed=true;this.ready=false;this.silence();return false;});}
  catch{this.failed=true;this.ready=false;this.silence();return Promise.resolve(false);}
 }
 // Opt-in recording tap: no context creation, resume, or speaker change.
 captureStream(){if(!this.context||!this.master||!this.context.createMediaStreamDestination)return null;if(!this.capture){this.capture=this.context.createMediaStreamDestination();this.master.connect(this.capture);}return this.capture.stream;}
 releaseCapture(){if(!this.capture)return;this.master.disconnect(this.capture);for(const track of this.capture.stream.getTracks())track.stop();this.capture=null;}
 setActive(active){this.active=!!active;if(!this.active)this.silence();}
 target(param,value,t,lag=.08){param.setTargetAtTime(value,t,lag);}
 stopVoice(voice,t=this.time){if(!voice||voice.stopped)return;voice.stopped=true;if(voice.endTime<=t)return;const gain=voice.gain.gain;if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(t);else gain.cancelScheduledValues(t);this.target(gain,0,t,.025);try{voice.source.stop(Math.min(voice.endTime??Infinity,t+.14));}catch{}}
 silence(){if(!this.context||!this.master)return;const t=this.time;this.master.gain.cancelScheduledValues(t);this.target(this.master.gain,0,t,.015);for(const v of this.sources)this.stopVoice(v,t);this.engine=null;this.rumble=null;this.previous=null;}
 voice(type,frequency,filterType,cutoff,t){
  const a=this.context,source=type==='noise'?a.createBufferSource():a.createOscillator(),gain=a.createGain(),filter=filterType?a.createBiquadFilter():null;
  if(type==='noise'){if(!this.noise){this.noise=a.createBuffer(1,a.sampleRate*2,a.sampleRate);const data=this.noise.getChannelData(0);let seed=9009;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}}source.buffer=this.noise;source.loop=true;}else{source.type=type;source.frequency.value=frequency;}
  gain.gain.value=0;if(filter){filter.type=filterType;filter.frequency.value=cutoff;filter.Q.value=.65;source.connect(filter);filter.connect(gain);}else source.connect(gain);gain.connect(this.master);
  const voice={source,gain,filter,stopped:false};this.sources.add(voice);source.onended=()=>{source.disconnect();filter?.disconnect();gain.disconnect();this.sources.delete(voice);};source.start(t);return voice;
 }
 tone(from,to,level,duration,t,type='sine'){
  const v=this.voice(type,from,null,0,t);v.source.frequency.setValueAtTime(from,t);v.source.frequency.exponentialRampToValueAtTime(to,t+duration);v.gain.gain.setValueAtTime(0,t);v.gain.gain.linearRampToValueAtTime(level,t+.035);v.gain.gain.exponentialRampToValueAtTime(.00001,t+duration);v.endTime=t+duration+.02;v.source.stop(v.endTime);
 }
 puff(from,to,level,duration,t){const v=this.voice('noise',0,'bandpass',from,t);v.filter.frequency.setValueAtTime(from,t);v.filter.frequency.exponentialRampToValueAtTime(to,t+duration);v.gain.gain.setValueAtTime(0,t);v.gain.gain.linearRampToValueAtTime(level,t+.04);v.gain.gain.exponentialRampToValueAtTime(.00001,t+duration);v.endTime=t+duration+.02;v.source.stop(v.endTime);}
 cue(kind,t){
  if(kind==='startup'){this.tone(48,112,.065,.7,t,'triangle');this.tone(190,336,.016,.9,t+.06);this.puff(180,800,.025,.65,t);}
  if(kind==='shutdown'){this.tone(105,38,.07,.6,t,'triangle');this.tone(260,95,.023,.5,t);this.puff(700,120,.025,.55,t);}
  if(kind==='surge'){this.tone(180,460,.075,.45,t);this.tone(270,690,.033,.55,t);this.puff(650,2100,.08,.48,t);}
  if(kind==='hop'){this.tone(100,260,.05,.3,t);this.puff(240,1600,.13,.5,t);}
  if(kind==='landing'){this.tone(105,46,.13,.32,t);this.tone(230,95,.035,.25,t);this.puff(650,130,.11,.32,t);}
 }
 engineUpdate(state,t){
  const edges=skimmerAudioEdges(this.previous,state);for(const event of edges)this.cue(event,t);this.previous=state;
  if(!state.engine){if(this.engine){for(const v of Object.values(this.engine))this.stopVoice(v,t);this.engine=null;}return;}
  if(!this.engine)this.engine={regen:this.voice('triangle',220,'lowpass',1250,t),regenUpper:this.voice('sine',440,null,0,t),undertone:this.voice('triangle',60,'lowpass',230,t),undertoneOctave:this.voice('sine',120,null,0,t),body:this.voice('triangle',70,'lowpass',650,t),overtone:this.voice('sine',141,null,0,t),rotor:this.voice('sine',213,null,0,t),wind:this.voice('noise',0,'bandpass',900,t),surge:this.voice('sine',420,null,0,t),surgeHigh:this.voice('sine',633,null,0,t)};
  const e=this.engine,flight=state.phase==='flight',f=80+state.effort*18+state.speed*16;
  // A nearly steady low motor floor carries weight; its octave survives small speakers.
  const bass=60+state.effort*8+state.speed*3;
  this.target(e.undertone.source.frequency,bass,t,.22);this.target(e.undertoneOctave.source.frequency,bass*2.004,t,.22);
  this.target(e.undertone.gain.gain,(.046+state.effort*.012)*(flight?.6:1),t,.12);
  this.target(e.undertoneOctave.gain.gain,(.018+state.effort*.005)*(flight?.6:1),t,.12);
  this.target(e.body.source.frequency,f,t,.13);this.target(e.overtone.source.frequency,f*2.013,t,.16);this.target(e.rotor.source.frequency,f*3.006,t,.18);
  this.target(e.body.filter.frequency,210+state.effort*130+state.speed*80,t,.14);
  this.target(e.body.gain.gain,(.022+state.effort*.012)*(flight?.4:1),t);
  this.target(e.overtone.gain.gain,(.007+state.effort*.006)*(flight?.45:1),t);
  this.target(e.rotor.gain.gain,.003+state.effort*.004,t);
  this.target(e.wind.filter.frequency,260+state.speed*2400+(flight?600:0),t,.18);
  this.target(e.wind.gain.gain,.006+.085*state.speed**1.5+(flight?.028+state.vertical*.02:0),t,.18);
  const regen=180+state.speed*240;this.target(e.regen.source.frequency,regen,t,.12);this.target(e.regenUpper.source.frequency,regen*2.003,t,.14);
  this.target(e.regen.gain.gain,state.slowing*.056,t,.09);this.target(e.regenUpper.gain.gain,state.slowing*.019,t,.09);
  this.target(e.surge.source.frequency,310+state.speed*230,t,.1);this.target(e.surgeHigh.source.frequency,465+state.speed*345,t,.1);
  this.target(e.surge.gain.gain,state.surge?.038:0,t,.06);this.target(e.surgeHigh.gain.gain,state.surge?.021:0,t,.06);
 }
 update(contact={},steps=[],game,sessionMode){
  if(!this.context||!this.master||!this.ready||this.failed)return;
  const a=this.context,t=this.time,on=this.active&&this.enabled;
  if(!on)return;this.target(this.master.gain,.38,t,.05);
  if(game)this.engineUpdate(skimmerAudioState(game,sessionMode,this.previous),t);
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
const api={Contact,ContactAudio,transmission,skimmerAudioState,skimmerAudioEdges};root.SDContact=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
