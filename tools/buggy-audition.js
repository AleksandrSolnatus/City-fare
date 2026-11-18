/* Mechanically textured audition mixes, separate from the live vehicle mix. */
(function(root){'use strict';
const profiles=Object.freeze({
 belt:{name:'Engine Forward',description:'A four-cylinder growl over quieter belt, tire, and frame sounds.',engine:.68,drive:.16,belt:.06,tread:.13,frame:.06},
 frame:{name:'Loose Frame',description:'More chassis movement and a dry suspension knock.',engine:.24,drive:.16,belt:.08,tread:.24,frame:.24},
 tread:{name:'Tires First',description:'Gravel and sand carry the sound, with a quiet drivetrain.',engine:.14,drive:.05,belt:.04,tread:.38,frame:.11}
});
const surfaces={bedrock:[690,.40],gravel:[1480,1],sand:[870,.82]};

// One uneven four-cylinder firing cycle, repeated at the current engine rate.
const firingOffsets=[0,.246,.5,.741],firingStrength=[1,.83,.92,.77];
function firingVoice(audio,time){
 const context=audio.context;
 const buffer=context.createBuffer(1,Math.round(context.sampleRate/16),context.sampleRate);
 const samples=buffer.getChannelData(0);
 for(let i=0;i<samples.length;i++){
  const phase=i/samples.length;
  for(let j=0;j<firingOffsets.length;j++){
   const age=(phase-firingOffsets[j]+1)%1;
   samples[i]+=firingStrength[j]*1.45*(Math.exp(-age*19)-Math.exp(-age*135));
  }
 }
 const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
 source.buffer=buffer;source.loop=true;source.playbackRate.value=.61;
 filter.type='bandpass';filter.frequency.value=180;filter.Q.value=.62;gain.gain.value=0;
 source.connect(filter);filter.connect(gain);gain.connect(audio.master);
 source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
 source.start(time);
 return {source,filter,gain,stopped:false};
}

class AuditionVoice{
 constructor(audio,id){
  this.audio=audio;
  this.profile=profiles[id];
  this.previous=null;
  this.voices=null;
  this.phase=0;
  this.lastTime=0;
 }
 stop(time){
  if(!this.voices)return;
  for(const voice of Object.values(this.voices))this.audio.stopVoice(voice,time);
  this.voices=null;
  this.previous=null;
 }
 update(state,time){
  const {audio,profile}=this;
  if(!this.voices){
   this.voices={
    engine:firingVoice(audio,time),
    drive:audio.voice('noise',0,'bandpass',175,time),
    belt:audio.voice('noise',0,'bandpass',460,time),
    tread:audio.voice('noise',0,'bandpass',900,time),
    frame:audio.voice('noise',0,'bandpass',570,time)
   };
   this.phase=0;
   this.lastTime=time;
  }
  const {engine,drive,belt,tread,frame}=this.voices;
  const dt=Math.min(.12,Math.max(0,time-this.lastTime));
  this.phase=(this.phase+dt*(4+state.speed*6))%1;
  this.lastTime=time;
  const pulse=.46+.54*Math.exp(-6*this.phase);
  const rolling=Math.sqrt(state.speed)*state.support;
  const [frequency,texture]=surfaces[state.surface]||surfaces.bedrock;
  const load=state.effort,rate=.61+.62*state.speed+.33*load+(state.surge?.09:0);
  audio.target(engine.source.playbackRate,rate,time,.12);
  audio.target(engine.filter.frequency,142+122*load+37*state.speed,time,.10);
  audio.target(engine.gain.gain,profile.engine*(.30+.62*load+.19*state.speed),time,.07);
  audio.target(drive.filter.frequency,150+55*state.effort+36*state.speed,time,.12);
  audio.target(drive.gain.gain,profile.drive*(.29+.57*state.effort+.28*state.speed)*pulse,time,.034);
  audio.target(belt.filter.frequency,390+210*state.effort,time,.11);
  audio.target(belt.gain.gain,profile.belt*(.15+.85*state.effort)*pulse,time,.04);
  audio.target(tread.filter.frequency,frequency+state.speed*380,time,.10);
  audio.target(tread.gain.gain,profile.tread*texture*rolling*(.54+.46*state.slip),time,.075);
  audio.target(frame.gain.gain,profile.frame*rolling*(.22+.78*texture)*(1-pulse*.6),time,.04);
  if(this.previous){
   if(state.surge&&!this.previous.surge){
    audio.puff(540,220,.07+profile.belt*.6,.26,time,null,.019);
    audio.puff(280,150,.11+profile.drive*.32,.21,time+.055,null,.018);
   }
   if(state.landingCount>this.previous.landingCount){
    const impact=.48+.52*state.impact;
    audio.puff(300,148,.23*impact,.24,time,null,.009);
    audio.puff(1500,460,(.09+profile.frame*.55)*impact,.13,time+.015,null,.009);
   }
  }
  this.previous=state;
 }
}
root.SDBuggyAudition={AuditionVoice,profiles};
})(typeof globalThis!=='undefined'?globalThis:this);
