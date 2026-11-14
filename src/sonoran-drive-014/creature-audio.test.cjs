const test=require('node:test'),assert=require('node:assert/strict');
const {ContactAudio,creatureAudioState}=require('./contact.js');
class Param{constructor(){this.value=0;this.events=[];}setTargetAtTime(v,...a){this.value=v;this.events.push(['target',v,...a]);}setValueAtTime(v,...a){this.value=v;this.events.push(['set',v,...a]);}linearRampToValueAtTime(...a){this.events.push(['linear',...a]);}exponentialRampToValueAtTime(...a){this.events.push(['exp',...a]);}cancelScheduledValues(){}}
class Node{constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.pan=new Param();this.end=Infinity;this.ended=false;}connect(){}disconnect(){this.disconnected=true;}start(t){this.startTime=t;}stop(t){this.end=t;}}
class Audio{constructor(pan=true){this.currentTime=0;this.state='running';this.sampleRate=8000;this.destination={};this.nodes=[];if(!pan)this.createStereoPanner=undefined;}node(){const n=new Node();this.nodes.push(n);return n;}createGain(){return this.node();}createOscillator(){return this.node();}createBufferSource(){return this.node();}createBiquadFilter(){return this.node();}createStereoPanner(){return this.node();}createBuffer(c,n){const d=new Float32Array(n);return {getChannelData:()=>d};}resume(){this.state='running';this.onstatechange?.();return Promise.resolve();}suspend(){this.state='suspended';this.onstatechange?.();return Promise.resolve();}advance(t){this.currentTime=t;for(const n of this.nodes)if(!n.ended&&n.end<=t){n.ended=true;n.onended?.();}}}
const observer={x:0,y:0,z:2,yaw:0};
function game(){return {seed:701,time:0,status:'playing',parked:true,car:{},world:{height:()=>0},worms:[{id:'western',head:{x:80,y:80,z:0},sections:[{r:20}]}],sky:{x:100,y:-100,z:200}};}
async function sound(pan=true){const audio=new Audio(pan),s=new ContactAudio({context:audio});s.setActive(true);await s.unlock();return {s,a:audio};}
function tick(s,a,g,time,o=observer){g.time=time;a.advance(time);s.update({},[],g,'walk',o);}
function nextCall(g,kind){const d=creatureAudioState(g,observer).find(d=>d.kind===kind);return d.at+d.period;}

test('creature timing is world-derived, deterministic, read-only and independent of listener',()=>{
 const g=game(),before=JSON.stringify(g),a=creatureAudioState(g,observer),b=creatureAudioState(g,{x:5000,y:-5000,z:900,yaw:3});
 assert.deepEqual(a.map(({id,kind,cycle,at,period})=>({id,kind,cycle,at,period})),b.map(({id,kind,cycle,at,period})=>({id,kind,cycle,at,period})));
 assert.equal(JSON.stringify(g),before);assert.deepEqual(a,creatureAudioState(g,observer));assert(a.every(d=>d.period>=30&&d.period<=45));
});
test('distance, bearing, altitude and burial affect audibility without changing the schedule',()=>{
 const g=game(),near=creatureAudioState(g,observer),far=creatureAudioState(g,{...observer,x:6000});assert(far.every(d=>d.gain===0));
 assert(near.find(d=>d.kind==='worm').pan>0);assert(near.find(d=>d.kind==='sky').pan<0);
 g.worms[0].head.z=-45;const buried=creatureAudioState(g,observer)[0];assert(buried.gain<near[0].gain*.04);assert.equal(buried.at,near[0].at);
 g.worms[0].head.z=-55;assert.equal(creatureAudioState(g,observer)[0].gain,0);
 g.sky.z=2200;assert.equal(creatureAudioState(g,observer).find(d=>d.kind==='sky').gain,0);
});
test('no call on initial activation, late joining, or skipped time; no approach-triggered catch-up',async()=>{
 const {s,a}=await sound(),g=game();tick(s,a,g,0);assert.equal(s.sources.size,0);tick(s,a,g,300);assert.equal(s.sources.size,0);
 const at=nextCall(g,'worm');tick(s,a,g,at-.1,{...observer,x:6000});tick(s,a,g,at+.01,{...observer,x:6000});assert.equal(s.creatureCalls.worm,0);
 tick(s,a,g,at+.03);assert.equal(s.creatureCalls.worm,0,'approaching after missed call does not trigger it');
 const h=game();h.time=at+.03;tick(s,a,h,h.time);assert.equal(s.creatureCalls.worm,0,'new outing object baselines the cycle');
});
test('worm breath and mineral resonance use three finite spatial voices once per cycle',async()=>{
 const {s,a}=await sound(),g=game();g.sky=null;const at=nextCall(g,'worm');tick(s,a,g,at-.1);tick(s,a,g,at+.01);
 assert.equal(s.creatureCalls.worm,1);assert.equal(s.sources.size,3);assert([...s.sources].every(v=>v.panner&&v.source.end<=a.currentTime+3));
 const voices=[...s.sources];assert.equal(voices.filter(v=>v.source.loop).length,1);assert(voices.every(v=>v.gain.gain.events.some(e=>e[0]==='linear'&&e[1]>0)));
 g.time=at+.02;const before=JSON.stringify(g);a.advance(g.time);s.update({},[],g,'walk',observer);assert.equal(s.creatureCalls.worm,1);assert.equal(s.sources.size,3);assert.equal(JSON.stringify(g),before);
 a.advance(at+4);assert.equal(s.sources.size,0);assert(voices.every(v=>v.panner.disconnected));
});
test('RibbonHawk call is one bounded airy two-part phrase and works without StereoPanner',async()=>{
 const {s,a}=await sound(false),g=game();g.worms=[];const at=nextCall(g,'sky');tick(s,a,g,at-.1);tick(s,a,g,at+.01);
 assert.equal(s.creatureCalls.sky,1);assert.equal(s.sources.size,4);const starts=[...s.sources].map(v=>v.source.startTime);assert(starts.some(t=>t>a.currentTime+.6));assert([...s.sources].every(v=>!v.panner));
 a.advance(at+3);assert.equal(s.sources.size,0);
});
test('pause and mute stop all wildlife voices; resuming does not replay missed calls',async()=>{
 for(const method of ['pause','mute']){const {s,a}=await sound(),g=game();g.sky=null;const at=nextCall(g,'worm');tick(s,a,g,at-.1);tick(s,a,g,at+.01);assert.equal(s.sources.size,3);
 if(method==='pause')s.setActive(false);else s.enabled=false;assert([...s.sources].every(v=>v.stopped&&v.source.end<=a.currentTime+.14));assert.equal(s.master.gain.value,0);assert.equal(a.state,'suspended');
 tick(s,a,g,at+42);assert.equal(s.creatureCalls.worm,1);if(method==='pause')s.setActive(true);else s.enabled=true;await s.unlock();tick(s,a,g,at+42.1);assert.equal(s.creatureCalls.worm,1);
 }
});
test('ten minutes have bounded voice count, ordinary cadence, and bounded diagnostics',async()=>{
 const {s,a}=await sound(),g=game();g.worms.push({id:'eastern',head:{x:100,y:0,z:0},sections:[{r:20}]});let max=0;
 for(let i=0;i<36000;i++){tick(s,a,g,i/60);max=Math.max(max,s.sources.size);}
 assert(max<=10);assert(s.creatureCalls.worm>=26&&s.creatureCalls.worm<=30);assert(s.creatureCalls.sky>=15&&s.creatureCalls.sky<=17);assert.equal(s.lastCreatureCalls.length,4);
});
test('gentler regen and surge keep the low motor foundation and octave',async()=>{
 const {s}=await sound();s.engineUpdate({engine:true,time:1,speed:0,effort:0,slowing:1,surge:true,phase:'hover',vertical:0},0);
 assert.equal(s.engine.undertone.source.frequency.value,60);assert.equal(s.engine.undertoneOctave.source.frequency.value,120.24);
 assert.equal(s.engine.undertone.gain.gain.value,.046);assert.equal(s.engine.undertoneOctave.gain.gain.value,.018);
 assert.equal(s.engine.regenUpper.gain.gain.value,.010);assert.equal(s.engine.surgeHigh.gain.gain.value,.012);
});

test('landing cue waits for actual hover recapture, not starting a high altitude descent',()=>{
 const {skimmerAudioEdges}=require('./contact.js');const state=phase=>({engine:true,phase,surge:false});
 assert(!skimmerAudioEdges(state('flight'),state('landing')).includes('landing'));
 assert.deepEqual(skimmerAudioEdges(state('landing'),state('hover')),['landing']);
 assert.deepEqual(skimmerAudioEdges(state('hover'),state('hover')),[]);
});


test('014 removes the idle fan and keeps cruise/flight air well below the electric body',async()=>{
 const {s}=await sound();const state={engine:true,time:1,speed:0,effort:0,slowing:0,surge:false,phase:'hover',vertical:0};
 s.engineUpdate(state,0);assert.equal(s.engine.wind.gain.gain.value,0,'stationary hover has no continuous noise floor');
 assert.equal(s.engine.wind.filter.type,'lowpass');assert.equal(s.engine.wind.filter.frequency.value,180);
 s.engineUpdate({...state,time:2,speed:2/3,effort:1},1);
 assert(s.engine.wind.gain.gain.value<.005,'120 MPH keeps air quiet');assert(s.engine.wind.gain.gain.value<s.engine.undertone.gain.gain.value*.1);
 assert(s.engine.wind.filter.frequency.value<=500,'cruise does not open a mid/high hiss band');
 assert(s.engine.rotor.gain.gain.value<=.0015,'third harmonic is a trace rather than a fan whine');
 assert(Math.abs(s.engine.undertone.gain.gain.value-.058)<1e-12);assert(Math.abs(s.engine.undertoneOctave.gain.gain.value-.023)<1e-12);
 s.engineUpdate({...state,time:3,speed:1,effort:1,phase:'flight',vertical:1,surge:true},2);
 assert(s.engine.wind.gain.gain.value<=.012);assert(s.engine.wind.filter.frequency.value<=700);
 assert.equal(s.engine.surge.gain.gain.value,.030);assert.equal(s.engine.surgeHigh.gain.gain.value,.012);
});
