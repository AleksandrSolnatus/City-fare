/* Original buggy synthesis shared by the game and the offline audition board. */
(function(root){'use strict';

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const finite=value=>Number.isFinite(value)?value:0;
const surfaces=Object.freeze({bedrock:[460,.46],hardpan:[640,.57],gravel:[1210,1],sand:[820,.76]});
const profiles=Object.freeze({
 sandline:{name:'Sandline',description:'Low electric pull and a soft tyre texture.',wave:'triangle',motor:72,range:49,load:30,body:.082,whine:.012,ratio:2.01,tyres:.076,rattle:.013},
 twin:{name:'Twin Motor',description:'Two brighter motor tones with a slight beating pulse.',wave:'triangle',motor:88,range:65,load:35,body:.060,whine:.035,ratio:1.025,tyres:.070,rattle:.019},
 dry:{name:'Dry Drive',description:'A quieter motor with more tread and chassis detail.',wave:'sawtooth',motor:61,range:42,load:22,body:.048,whine:.010,ratio:2.97,tyres:.111,rattle:.038}
});
const previewCues=['gravel','sand','surge','landing'];

function stateOf(vehicle,live){
 const engine=!!vehicle&&live&&!vehicle.parked&&!vehicle.disabled&&!vehicle.stranded;
 return {
  id:vehicle?.id,engine,speed:clamp(Math.abs(finite(vehicle?.speed))/42.5),
  effort:clamp(Math.abs(finite(vehicle?.throttle))),slip:clamp(finite(vehicle?.slip)),
  support:clamp(finite(vehicle?.supportCount)/4),surface:vehicle?.surface||'bedrock',
  surge:engine&&!!vehicle.boosting,landingCount:finite(vehicle?.landingCount),
  impact:clamp(finite(vehicle?.lastLandingSpeed)/7)
 };
}

class BuggyVoice{
 constructor(audio,profile='sandline'){
  this.audio=audio;
  this.profile=profiles[profile]||profiles.sandline;
  this.previous=null;
  this.voices=null;
 }
 stop(time){
  if(this.voices)for(const voice of Object.values(this.voices))this.audio.stopVoice(voice,time);
  this.voices=null;
  this.previous=null;
 }
 update(state,time){
  if(!state.engine){this.stop(time);return;}
  if(this.previous?.id!==state.id)this.stop(time);
  const {audio,profile}=this;
  if(!this.voices){
   this.voices={
    motor:audio.voice(profile.wave,profile.motor,'lowpass',340,time),
    overtone:audio.voice('sine',profile.motor*profile.ratio,null,0,time),
    tyre:audio.voice('noise',0,'bandpass',640,time),
    chassis:audio.voice('noise',0,'lowpass',220,time)
   };
   this.cue('power',time);
  }
  if(this.previous&&state.surge&&!this.previous.surge)this.cue('surge',time);
  if(this.previous&&state.landingCount>this.previous.landingCount)this.cue('landing',time,state.impact);
  this.previous=state;

  const {motor,overtone,tyre,chassis}=this.voices;
  const rolling=Math.sqrt(state.speed)*state.support;
  const frequency=profile.motor+state.speed*profile.range+state.effort*profile.load+(state.surge?12:0);
  const [cutoff,texture]=surfaces[state.surface]||surfaces.bedrock;
  audio.target(motor.source.frequency,frequency,time,.11);
  audio.target(motor.filter.frequency,260+frequency*2.1,time,.15);
  audio.target(motor.gain.gain,profile.body*(.25+.60*state.effort+.2*state.speed),time,.09);
  audio.target(overtone.source.frequency,frequency*profile.ratio,time,.13);
  audio.target(overtone.gain.gain,profile.whine*(.22+.78*state.effort),time,.09);
  audio.target(tyre.filter.frequency,cutoff+state.speed*500,time,.13);
  audio.target(tyre.gain.gain,profile.tyres*texture*rolling*(.40+.60*state.slip),time,.07);
  audio.target(chassis.gain.gain,profile.rattle*rolling*(.30+.70*state.slip),time,.1);
 }
 cue(kind,time,weight=1){
  const {audio,profile}=this;
  if(kind==='power'){
   audio.tone(profile.motor*.68,profile.motor*1.34,profile.body*.65,.42,time,'triangle');
  }else if(kind==='surge'){
   audio.tone(profile.motor*1.18,profile.motor*2.65,profile.body,.52,time,'triangle');
   audio.puff(300,1030,.033,.38,time,null,.016);
  }else if(kind==='landing'){
   const impact=.36+.64*weight;
   audio.tone(108,53,.105*impact,.27,time,'sine',null,.014);
   audio.puff(710,150,.15*impact,.30,time,null,.012);
   audio.puff(380,108,.042*impact,.25,time+.045,null,.012);
  }
 }
}

// The same scripted drive is used for every profile so differences are audible.
function auditionState(time,scene='drive'){
 const span=scene==='drive'?5.8:2.5,phase=clamp(time/span);
 const state={id:'audition',engine:true,speed:.42,effort:.38,slip:.32,support:1,surface:'bedrock',surge:false,landingCount:0,impact:.74};
 if(scene==='gravel'||scene==='sand')return {...state,surface:scene,speed:.12+.62*Math.sin(Math.PI*phase),slip:.38+.46*Math.sin(Math.PI*phase)};
 if(scene==='surge')return {...state,speed:.22+.65*phase,effort:phase>.25?.93:.45,surge:phase>.25&&phase<.78};
 if(scene==='landing')return {...state,speed:.54*(1-.72*phase),surface:'sand',support:phase>.16&&phase<.53?0:1,landingCount:phase>=.53?1:0};
 return {...state,speed:.84*Math.sin(Math.PI*phase),effort:phase<.72?Math.sin(Math.PI*phase/.92):.08,
  surface:phase<.3?'bedrock':phase<.56?'gravel':'sand',slip:phase<.3?.18:.55,
  support:phase>.60&&phase<.72?0:1,surge:phase>.36&&phase<.52,landingCount:phase>=.72?1:0};
}

const api={BuggyVoice,auditionState,previewCues,profiles,stateOf};
root.SDBuggyAudio=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
