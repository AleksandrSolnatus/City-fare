import {fresh,step,TUNE,ROUTE_LENGTH,center} from './road.js';
import {aeroForces,activeWing} from './aero.js';
import {Renderer} from './renderer.js';
import {TripSave,TRIP_SAVE_KEY} from './trip-save.js';

const $=s=>document.querySelector(s);
const canvas=$('#view'),speedEl=$('#speed'),pause=$('#pause'),overlay=$('#overlay'),speedFX=$('#speedfx');
let renderer,fatal=false;
let preferences={gentle:false,motion:matchMedia('(prefers-reduced-motion: reduce)').matches,quality:false,volume:.18,camera:'chase',wingMode:'auto'};
let storage=null;
try{storage=window.localStorage}catch(e){}
try{let p=JSON.parse(storage?.getItem('cityFarePrefs')||'{}');for(let k of ['gentle','motion','quality'])if(typeof p[k]==='boolean')preferences[k]=p[k];if(Number.isFinite(p.volume))preferences.volume=Math.max(0,Math.min(1,p.volume));if(p.camera==='wide')preferences.camera='wide';if(['auto','speed','grip'].includes(p.wingMode))preferences.wingMode=p.wingMode}catch(e){}
const STEP=1/60,MAX_STEPS=5,MPH=2.236936,SAVE_INTERVAL=15;
let state=fresh(),previous={...state},held=new Set(),pointers=new Map(),last=0,accumulator=0,raf=0,started=false,overloads=0,toastTimer;
const tripSave=new TripSave(storage);
let saveResult=tripSave.load(),savedCheckpoint=saveResult.checkpoint||null,secondsSinceSave=0,finishedSaved=false,restartFocus=null;
const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'gas',KeyW:'gas',ArrowDown:'brake',KeyS:'brake',Space:'brake'};
const miles=value=>(value/1609.344).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});

function actions(){const a={left:false,right:false,gas:false,brake:false};for(const code of held)if(keyMap[code])a[keyMap[code]]=true;for(const action of pointers.values())a[action]=true;return a}
function paintInputs(){const a=actions();document.querySelectorAll('.drive').forEach(b=>b.classList.toggle('on',!!a[b.dataset.key]))}
function release(){held.clear();pointers.clear();paintInputs()}
function notify(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200)}
function savePreferences(){try{storage?.setItem('cityFarePrefs',JSON.stringify(preferences))}catch(e){}}
function saveMessage(){
  if(saveResult.status==='conflict')return 'Another tab changed the saved drive. Reload to use that save.';
  if(saveResult.status==='unavailable')return 'Progress could not be saved. Keep this tab open; reloading may return to an older save.';
  if(saveResult.status==='invalid')return 'The saved drive could not be read. Starting a new drive will replace it.';
  if(savedCheckpoint)return 'Saved in this browser at '+new Date(savedCheckpoint.savedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'.';
  return 'Progress saves in this browser every 15 seconds and when you pause.';
}
function updateSaveUI(){
  const conflict=saveResult.status==='conflict';
  $('#save-status').textContent=saveMessage();$('#finish-save-status').textContent=saveMessage();
  $('#resume').disabled=conflict;$('#save-exit').disabled=conflict;$('#reload-save').hidden=!conflict;
  $('#new-drive').hidden=!savedCheckpoint;
  $('#start-label').textContent=savedCheckpoint?(savedCheckpoint.state.finished?'View completed drive':'Resume drive'):'Drive';
  $('#trip-summary').textContent=savedCheckpoint?miles(savedCheckpoint.state.distance)+' miles driven · '+miles(ROUTE_LENGTH-savedCheckpoint.state.distance)+' to go':'';
  $('#trip-note').textContent=saveResult.status==='unavailable'?'Saving is unavailable. You can still drive in this tab.'
    :saveResult.status==='invalid'?'Your saved drive could not be read. Start over to begin a new one.'
    :savedCheckpoint&&!savedCheckpoint.state.finished?'Continue from your last stop. Your car will be stationary.':'Your progress stays in this browser.';
}
function checkpoint(replace=false){
  if(!started||(saveResult.status==='conflict'&&!replace))return saveResult;
  const before=saveResult.status;saveResult=tripSave.save(state,{replace});secondsSinceSave=0;
  if(saveResult.status==='saved')savedCheckpoint=saveResult.checkpoint;
  updateSaveUI();
  if(saveResult.status==='conflict'&&before!=='conflict')notify('A newer save exists in another tab.');
  if(saveResult.status==='unavailable'&&before!=='unavailable')notify('Progress could not be saved.');
  return saveResult;
}
function fail(message){
  if(fatal)return;if(started)checkpoint();fatal=true;speedFX.style.opacity='0';
  $('#error-message').textContent=message+(saveResult.status==='saved'?' Your drive is saved in this browser.':'');
  $('#error').hidden=false;release();if(raf)cancelAnimationFrame(raf);raf=0;state.paused=true;quietAudio();
}
function render(interpolate=false,dt=STEP){
  if(!renderer)return;let visible=state;
  if(interpolate){let a=accumulator/STEP;visible={...state};for(let k of ['x','v','steer','angle','distance','z'])visible[k]=previous[k]+(state[k]-previous[k])*a}
  renderer.render(visible,preferences,dt,actions());
  const forces=aeroForces(state.v,state.angle,state.x,state.z,activeWing(state.v,preferences.wingMode));
  const lateral=Math.abs(state.x-center(state.z));
  $('#surface').textContent=lateral>5.1?'SAND · LOWER GRIP':'ASPHALT · HIGH GRIP';
  $('#hint').textContent='WIND '+Math.round(Math.hypot(forces.wind.x,forces.wind.z)*MPH)+
    ' MPH · ACTIVE WING '+Math.round(activeWing(state.v,preferences.wingMode)*100)+'%';
  speedFX.style.opacity=started&&!state.paused&&!state.finished&&!preferences.motion?String(.58*Math.max(0,Math.min(1,(state.v-31.2928)/(125-31.2928)))):'0';
  speedEl.textContent=Math.round(state.v*MPH);$('#speedbar').style.width=(Math.min(1,state.v/115)*100)+'%';
  $('#distance').textContent=miles(Math.max(0,ROUTE_LENGTH-state.distance));$('#progress').style.width=(state.distance/ROUTE_LENGTH*100)+'%';
  let fade=Math.max(0,Math.min(1,(state.distance-(ROUTE_LENGTH-2500))/2500));
  $('#finish-fade').style.opacity=started?(state.finished?1:Math.pow(fade,1.7)*.85):0;
  if(started&&state.finished){release();quietAudio();overlay.hidden=true;document.body.classList.add('finished');$('#finish').hidden=false}
  updateAudio();
}
function frame(t){
  raf=0;if(!started||state.paused||fatal||state.finished)return;
  if(!last)last=t;let elapsed=(t-last)/1000;last=t;
  if(elapsed>.35){setPaused(true);return}
  accumulator+=Math.max(0,elapsed);let steps=0;
  while(accumulator>=STEP&&steps<MAX_STEPS){previous={...state};step(state,actions(),STEP,preferences);if(state.impacts?.length){renderer.registerHits(state.impacts);playPoof(state.impacts.length)}accumulator-=STEP;secondsSinceSave+=STEP;steps++;if(state.finished)break}
  if(accumulator>=STEP){overloads++;accumulator%=STEP}
  if(state.finished&&!finishedSaved){finishedSaved=checkpoint().status==='saved';previous={...state}}
  else if(secondsSinceSave>=SAVE_INTERVAL){checkpoint();if(saveResult.status==='conflict'){setPaused(true,false);return}}
  render(!state.finished,elapsed);
  if(state.finished)$('#again').focus();else raf=requestAnimationFrame(frame);
}
function setPaused(value,save=true){
  if(!started||fatal||state.finished||(!value&&saveResult.status==='conflict'))return;
  state.paused=value;overlay.hidden=!value;pause.innerHTML=value?'▶ <span>Resume</span>':'Ⅱ <span>Pause</span>';
  pause.setAttribute('aria-label',value?'Resume drive':'Pause and settings');$('#drivehud').inert=value;$('.controls').inert=value;
  release();last=0;accumulator=0;previous={...state};
  if(value){quietAudio();if(raf)cancelAnimationFrame(raf);raf=0;if(save)checkpoint();render();(saveResult.status==='conflict'?$('#reload-save'):$('#resume')).focus()}
  else{if(!raf)raf=requestAnimationFrame(frame);canvas.focus({preventScroll:true})}
}
function toggle(){if(started)setPaused(!state.paused)}
function beginDrive(nextState){
  if(fatal)return;if(raf)cancelAnimationFrame(raf);
  raf=0;state={...nextState,paused:false};previous={...state};started=true;
  finishedSaved=state.finished;last=0;accumulator=0;secondsSinceSave=0;release();renderer.resetWorld(state.destroyedCacti||[]);
  document.body.classList.remove('intro','finished');document.body.classList.add('playing');
  $('#welcome').inert=true;$('#drivehud').inert=false;$('.controls').inert=false;$('#finish').hidden=true;overlay.hidden=true;
  pause.innerHTML='Ⅱ <span>Pause</span>';pause.setAttribute('aria-label','Pause and settings');render();
  if(state.finished)$('#again').focus();else{raf=requestAnimationFrame(frame);canvas.focus({preventScroll:true})}
}
function start(){
  if(started||fatal)return;
  // Re-read at the explicit gesture: another tab may have saved while the title was open.
  saveResult=tripSave.load();
  // A transient read failure must not turn a known saved journey into a fresh one.
  if(saveResult.status!=='unavailable')savedCheckpoint=saveResult.checkpoint||null;
  updateSaveUI();
  if(saveResult.status==='invalid'){requestRestart();return}
  beginDrive(savedCheckpoint?savedCheckpoint.state:fresh());if(!savedCheckpoint)checkpoint();
}
function returnToTitle(){
  if(checkpoint().status!=='saved')return;if(raf)cancelAnimationFrame(raf);raf=0;started=false;
  state={...savedCheckpoint.state};previous={...state};last=0;accumulator=0;release();quietAudio();overlay.hidden=true;
  document.body.classList.remove('playing','finished');document.body.classList.add('intro');
  $('#finish').hidden=true;$('#welcome').inert=false;$('#drivehud').inert=true;$('.controls').inert=true;
  updateSaveUI();render();$('#start').focus();
}
function requestRestart(){
  if(fatal||$('#restart-dialog').open)return;restartFocus=document.activeElement;
  if(started&&!state.paused&&!state.finished)setPaused(true);
  $('#restart-dialog').showModal();$('#cancel-restart').focus();
}
function closeRestart(){
  $('#restart-dialog').close();
  if(!overlay.hidden)(saveResult.status==='conflict'?$('#reload-save'):$('#resume')).focus();
  else if(restartFocus?.isConnected&&!restartFocus.disabled)restartFocus.focus();
}
function restartDrive(){$('#restart-dialog').close();beginDrive(fresh());checkpoint(true)}
function suspend(){release();if(!started)return;if(!state.paused&&!state.finished&&!fatal)setPaused(true);else if(!finishedSaved&&!fatal)checkpoint()}

$('#again').onclick=requestRestart;$('#start').onclick=start;$('#new-drive').onclick=requestRestart;
pause.onclick=toggle;$('#resume').onclick=()=>setPaused(false);$('#restart').onclick=requestRestart;
$('#save-exit').onclick=returnToTitle;$('#reload-save').onclick=()=>location.reload();
$('#cancel-restart').onclick=closeRestart;$('#confirm-restart').onclick=restartDrive;
$('#restart-dialog').addEventListener('cancel',e=>{e.preventDefault();closeRestart()});
$('.brand').onclick=e=>{e.preventDefault();if(started)setPaused(true)};
$('#camera span').textContent=preferences.camera==='wide'?'Wide cam':'Chase cam';
$('#camera').onclick=()=>{preferences.camera=preferences.camera==='wide'?'chase':'wide';savePreferences();$('#camera span').textContent=preferences.camera==='wide'?'Wide cam':'Chase cam';render()};
for(const name of ['gentle','motion','quality']){let el=$('#'+name);el.checked=preferences[name];el.onchange=()=>{preferences[name]=el.checked;savePreferences();if(name==='quality')renderer.resize(preferences.quality);render()}}
let wingMode=$('#wing-mode');wingMode.value=preferences.wingMode;
wingMode.onchange=()=>{preferences.wingMode=wingMode.value;savePreferences();render()};
let volume=$('#volume');volume.value=preferences.volume;volume.oninput=()=>{preferences.volume=Number(volume.value);savePreferences();updateAudio()};

// Gesture-started electric motor: soft sine pair and filtered air, no gear drone.
let audio=null,osc=null,gain=null,wind=null,windGain=null,harmonic=null,soundOn=false;
function playPoof(count){
  if(!audio||!soundOn)return;
  for(let i=0;i<Math.min(2,count);i++){
    const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
    o.type='triangle';o.frequency.setValueAtTime(230,t);
    o.frequency.exponentialRampToValueAtTime(72,t+.16);
    g.gain.setValueAtTime(Math.max(.0001,preferences.volume*.12),t);
    g.gain.exponentialRampToValueAtTime(.0001,t+.21);
    o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.22);
  }
}
function quietAudio(){if(audio&&gain){gain.gain.setTargetAtTime(0,audio.currentTime,.08);windGain.gain.setTargetAtTime(0,audio.currentTime,.08)}}
function updateAudio(){if(!audio)return;let active=soundOn&&!state.paused&&!state.finished&&started,a=actions(),ratio=state.v/TUNE.maxSpeed;osc.frequency.setTargetAtTime(55+state.v*1.65+(a.gas?4:0),audio.currentTime,.25);harmonic.frequency.setTargetAtTime(110+state.v*3.3,audio.currentTime,.3);gain.gain.setTargetAtTime(active?preferences.volume*(.008+ratio*.025):0,audio.currentTime,.16);windGain.gain.setTargetAtTime(active?preferences.volume*ratio*.045:0,audio.currentTime,.3)}
$('#sound').onclick=async()=>{try{if(!audio){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('unavailable');audio=new AC();gain=audio.createGain();gain.gain.value=0;gain.connect(audio.destination);osc=audio.createOscillator();osc.type='sine';osc.connect(gain);osc.start();harmonic=audio.createOscillator();harmonic.type='sine';let hg=audio.createGain();hg.gain.value=.16;harmonic.connect(hg);hg.connect(gain);harmonic.start();let buffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;wind=audio.createBufferSource();wind.buffer=buffer;wind.loop=true;let filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=380;windGain=audio.createGain();windGain.gain.value=0;wind.connect(filter);filter.connect(windGain);windGain.connect(audio.destination);wind.start()}soundOn=!soundOn;if(soundOn)await audio.resume();$('#sound').textContent='Sound: '+(soundOn?'On':'Off');if(!soundOn)quietAudio()}catch(e){soundOn=false;$('#sound').textContent='Sound unavailable'}};

window.addEventListener('keydown',e=>{
  if($('#restart-dialog').open)return;
  const editing=/INPUT|SELECT|TEXTAREA/.test(e.target.tagName),button=e.target.closest?.('button');
  if(e.code==='Tab'&&!overlay.hidden){
    let items=[...overlay.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&!el.hidden),first=items[0],lastItem=items.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();lastItem.focus()}
    else if(!e.shiftKey&&document.activeElement===lastItem){e.preventDefault();first.focus()}return;
  }
  if(!e.repeat&&(e.code==='KeyP'||e.code==='Escape')){if(e.code==='Escape'||!editing){e.preventDefault();toggle()}return}
  if(editing)return;
  if(keyMap[e.code]){if(e.code==='Space'&&button)return;e.preventDefault();if(started&&!state.paused&&!state.finished){held.add(e.code);paintInputs()}}
  if(!e.repeat&&started&&overlay.hidden){if(e.code==='KeyC')$('#camera').click();if(e.code==='KeyR')requestRestart()}
});
window.addEventListener('keyup',e=>{if(keyMap[e.code]){held.delete(e.code);paintInputs()}});
document.querySelectorAll('.drive').forEach(b=>{
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(!started||state.paused||state.finished)return;b.setPointerCapture(e.pointerId);pointers.set(e.pointerId,b.dataset.key);paintInputs()});
  function up(e){pointers.delete(e.pointerId);paintInputs()}
  for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,up);
});
window.addEventListener('blur',suspend);window.addEventListener('pagehide',suspend);
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend()});
window.addEventListener('storage',event=>{
  if(event.storageArea!==storage||(event.key!==TRIP_SAVE_KEY&&event.key!==null))return;
  if(!started){saveResult=tripSave.load();if(saveResult.status!=='unavailable')savedCheckpoint=saveResult.checkpoint||null;updateSaveUI();return}
  saveResult={status:'conflict'};updateSaveUI();if(!state.finished&&!fatal)setPaused(true,false);
});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('The graphics connection was interrupted. Reload to continue.')});
window.addEventListener('error',()=>fail('The drive stopped unexpectedly. Please reload.'));
window.addEventListener('resize',()=>{if(renderer){renderer.resize(preferences.quality);render()}});
updateSaveUI();
try{renderer=new Renderer(canvas);renderer.resize(preferences.quality);render()}catch(e){fail(e.message)}
// Read-only diagnostics. No debug teleport/control mutations are exposed.
window.CityFare=Object.freeze({inspect:()=>({version:'009-Sonoran-Unbound',fatal,state:{...state},input:actions(),preferences:{...preferences},started,overloads,save:{status:saveResult.status,savedAt:savedCheckpoint?.savedAt||null,distance:savedCheckpoint?.state.distance??null},graphics:renderer?.inspect()||null})});
