const {test}=require('node:test');
const assert=require('node:assert/strict');
const {BuggyVoice,stateOf,profiles,auditionState}=require('./buggy-audio.js');

function testAudio(){
 const cues=[];
 return {
  cues,
  voice(){return {source:{frequency:{}},gain:{gain:{}},filter:{frequency:{}}};},
  stopVoice(voice){voice.stopped=true;},
  target(param,value){param.value=value;},
  tone(...args){cues.push(args);},
  puff(){}
 };
}

test('buggy sound reads vehicle state, stays quiet when parked, and loses tyre noise in the air',()=>{
 const audio=testAudio(),voice=new BuggyVoice(audio);
 const vehicle=Object.freeze({id:'buggy-01',speed:-20,throttle:-.4,slip:.6,supportCount:4,surface:'gravel'});
 voice.update(stateOf(vehicle,true),0);
 const rolling=voice.voices.tyre.gain.gain.value;
 assert(rolling>0);
 const cutoff=voice.voices.tyre.filter.frequency.value;
 voice.update(stateOf({...vehicle,surface:'bedrock'},true),.1);
 assert(voice.voices.tyre.gain.gain.value<rolling);
 assert(voice.voices.tyre.filter.frequency.value<cutoff);
 voice.update(stateOf({...vehicle,supportCount:0},true),.2);
 assert.equal(voice.voices.tyre.gain.gain.value,0);
 assert(voice.voices.motor.gain.gain.value>0);
 const voices=voice.voices;
 voice.update(stateOf({...vehicle,parked:true},true),.3);
 assert.equal(voice.voices,null);
 assert(Object.values(voices).every(node=>node.stopped));
});

test('touchdown and surge cues play once and never inherit another vehicle’s history',()=>{
 const audio=testAudio(),voice=new BuggyVoice(audio);
 const vehicle={id:'buggy-01',landingCount:9,lastLandingSpeed:4};
 voice.update(stateOf(vehicle,true),0);
 assert.equal(audio.cues.length,1,'startup only');
 voice.update(stateOf({...vehicle,landingCount:10,boosting:true},true),.1);
 assert.equal(audio.cues.length,3,'surge and landing');
 voice.update(stateOf({...vehicle,landingCount:10,boosting:true},true),.2);
 assert.equal(audio.cues.length,3);
 voice.update(stateOf({...vehicle,id:'buggy-02',landingCount:16},true),.3);
 assert.equal(audio.cues.length,4,'new vehicle startup only');
});

test('comparison uses the same drive and produces three different motor voices',()=>{
 const state=auditionState(2);
 const outputs=Object.keys(profiles).map(profile=>{
  const voice=new BuggyVoice(testAudio(),profile);
  voice.update(state,0);
  return voice.voices.motor.source.frequency.value;
 });
 assert.equal(new Set(outputs).size,3);
 for(const time of [0,1,3,4,5.8]){
  const sample=auditionState(time);
  assert([sample.speed,sample.effort,sample.slip,sample.support].every(v=>v>=0&&v<=1));
 }
});
