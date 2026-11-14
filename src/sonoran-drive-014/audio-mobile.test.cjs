const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

// Models browser state transitions and policy failures; it cannot establish audible phone output.
function browser(options={}){
 const contexts=[],sessionWrites=[];
 class Param{
  constructor(){this.value=0;this.events=[];}
  setTargetAtTime(value,...args){this.value=value;this.events.push(['target',value,...args]);}
  setValueAtTime(value,...args){this.value=value;this.events.push(['set',value,...args]);}
  linearRampToValueAtTime(value,...args){this.events.push(['linear',value,...args]);}
  exponentialRampToValueAtTime(value,...args){this.events.push(['exp',value,...args]);}
  cancelScheduledValues(...args){this.events.push(['cancel',...args]);}
 }
 class Node{
  constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.stops=[];}
  connect(){} disconnect(){} start(t){this.started=t;} stop(t){this.stops.push(t);}
 }
 class Audio{
  constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=8000;this.destination={};this.nodes=[];this.handlers=[];this.resumeCalls=0;this.suspendCalls=0;contexts.push(this);}
  node(){const n=new Node();this.nodes.push(n);return n;}
  createGain(){return this.node();} createOscillator(){return this.node();} createBufferSource(){return this.node();} createBiquadFilter(){return this.node();}
  createBuffer(ch,n,sr){const data=new Float32Array(n);return {getChannelData:()=>data};}
  addEventListener(type,fn){if(type==='statechange')this.handlers.push(fn);}
  removeEventListener(type,fn){this.handlers=this.handlers.filter(f=>f!==fn);}
  transition(state){if(this.state===state)return;this.state=state;for(const fn of this.handlers)fn();this.onstatechange?.();}
  resume(){this.resumeCalls++;if(this.nextResume)return this.nextResume();this.transition('running');return Promise.resolve();}
  suspend(){this.suspendCalls++;this.transition('suspended');return Promise.resolve();}
 }
 let type=options.initialType||'auto';
 const session={get type(){if(options.throwRead)throw Error('unavailable');return type;},set type(v){if(options.throwWrite)throw Error('unsupported category');type=v;sessionWrites.push(v);}};
 const navigator=options.noSession?{}:{audioSession:session};
 const sandbox={AudioContext:Audio,navigator,console,Float32Array,Promise,Set,Math};
 vm.runInNewContext(fs.readFileSync(__dirname+'/contact.js','utf8'),sandbox);
 return {ContactAudio:sandbox.SDContact.ContactAudio,Audio,contexts,session,sessionWrites,get type(){return type;}};
}
const idle=()=>({time:1,status:'playing',parked:false,car:{vx:0,vy:0,vz:0,throttle:0,boosting:false,hopPhase:'hover'}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function assertSilent(sound){assert.equal(sound.master?.gain.value||0,0);assert(!sound.engine);assert([...sound.sources].every(v=>v.stopped),'all existing sources stopped');}

test('interrupted initial activation recovers when the active browser context becomes running',async()=>{
 const b=browser(),a=new b.Audio(),sound=new b.ContactAudio({context:a});sound.setActive(true);
 a.nextResume=()=>{a.transition('interrupted');return Promise.resolve();};
 assert.equal(await sound.unlock(),false);sound.update({},[],idle(),'drive');assert(!sound.engine);
 a.transition('running');sound.update({},[],idle(),'drive');
 assert.equal(sound.ready,true);assert.equal(sound.failed,false);assert(sound.engine,'a recovered context must not stay latched silent');
});

test('a denied activation remains harmless and a later user activation retries successfully',async()=>{
 const b=browser(),a=new b.Audio(),sound=new b.ContactAudio({context:a});sound.setActive(true);
 a.nextResume=()=>Promise.reject(Error('gesture denied'));
 assert.equal(await sound.unlock(),false);assertSilent(sound);
 a.nextResume=null;assert.equal(await sound.unlock(),true);sound.update({},[],idle(),'drive');
 assert.equal(a.resumeCalls,2);assert(sound.engine);assert.equal(sound.failed,false);
});

test('an older activation rejection cannot silence a newer successful gesture',async()=>{
 const b=browser(),a=new b.Audio(),sound=new b.ContactAudio({context:a});sound.setActive(true);
 let rejectOld;a.nextResume=()=>new Promise((resolve,reject)=>{rejectOld=reject;});const old=sound.unlock();
 a.nextResume=null;assert.equal(await sound.unlock(),true);sound.update({},[],idle(),'drive');const engine=sound.engine;assert(engine);
 rejectOld(Error('late policy rejection'));assert.equal(await old,false);sound.update({},[],idle(),'drive');
 assert.equal(sound.ready,true);assert.equal(sound.failed,false);assert.equal(sound.engine,engine);assert.equal(b.type,'playback');
});

test('muted gestures neither construct nor resume a context or claim playback',async()=>{
 const b=browser(),sound=new b.ContactAudio();sound.setActive(true);sound.enabled=false;
 assert.equal(await sound.unlock(),false);assert.equal(b.contexts.length,0);assert.equal(b.type,'auto');
 const a=new b.Audio(),existing=new b.ContactAudio({context:a});existing.setActive(true);existing.enabled=false;
 await existing.unlock();assert.equal(a.resumeCalls,0);assert.equal(b.type,'auto');
});

for(const action of ['pause','mute'])test(`${action} during a pending resume cannot restore sound or retain the media session`,async()=>{
 const b=browser(),a=new b.Audio(),sound=new b.ContactAudio({context:a});sound.setActive(true);
 let finish;a.nextResume=()=>new Promise(resolve=>{finish=()=>{a.transition('running');resolve();};});
 const pending=sound.unlock();assert.equal(b.type,'playback');
 if(action==='pause')sound.setActive(false);else sound.enabled=false;
 assert.equal(b.type,'auto');finish();await pending;await tick();sound.update({},[],idle(),'drive');
 assertSilent(sound);assert.equal(a.state,'suspended');assert.equal(b.type,'auto');
});

test('background state changes cannot wake sources or automatically retry activation',async()=>{
 const b=browser(),sound=new b.ContactAudio();sound.setActive(true);await sound.unlock();
 const a=b.contexts[0];sound.update({},[],idle(),'drive');assert(sound.engine);sound.setActive(false);await tick();
 const calls=a.resumeCalls;a.transition('running');await tick();sound.update({},[],idle(),'drive');
 assertSilent(sound);assert.equal(a.resumeCalls,calls);assert.equal(a.state,'suspended');assert.equal(b.type,'auto');
});

test('a gesture delivered while paused cannot resume an existing context',async()=>{
 const b=browser(),sound=new b.ContactAudio();sound.setActive(true);await sound.unlock();const a=b.contexts[0];
 sound.setActive(false);await tick();const calls=a.resumeCalls;
 assert.equal(await sound.unlock(),false);assert.equal(a.resumeCalls,calls);assert.equal(a.state,'suspended');assert.equal(b.type,'auto');
});

test('playback category is released on pause and mute and reacquired only on activation',async()=>{
 const b=browser({initialType:'ambient'}),sound=new b.ContactAudio();sound.setActive(true);await sound.unlock();assert.equal(b.type,'playback');
 sound.setActive(false);await tick();assert.equal(b.type,'ambient');sound.setActive(true);assert.equal(b.type,'ambient');
 await sound.unlock();assert.equal(b.type,'playback');sound.enabled=false;await tick();assert.equal(b.type,'ambient');
});

test('releasing this sound does not overwrite an external category change',async()=>{
 const b=browser(),sound=new b.ContactAudio();sound.setActive(true);await sound.unlock();
 b.session.type='play-and-record';sound.setActive(false);await tick();assert.equal(b.type,'play-and-record');
});

for(const options of [{noSession:true},{throwRead:true},{throwWrite:true}])test(`AudioSession capability failure is contained: ${JSON.stringify(options)}`,async()=>{
 const b=browser(options),sound=new b.ContactAudio();sound.setActive(true);
 assert.equal(await sound.unlock(),true);sound.update({},[],idle(),'drive');assert(sound.engine);
 assert.doesNotThrow(()=>sound.setActive(false));await tick();assertSilent(sound);
});

test('offline synthesis remains usable without realtime resume or media-session changes',()=>{
 const b=browser(),a=new b.Audio(),sound=new b.ContactAudio({context:a,offline:true});sound.setActive(true);
 sound.renderTime=.25;sound.update({},[],idle(),'drive');assert(sound.engine);assert.equal(a.resumeCalls,0);assert.equal(b.type,'auto');
 sound.setActive(false);assertSilent(sound);assert.equal(a.suspendCalls,0);
});
