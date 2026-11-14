const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./evidence/input-harness.cjs');
test('jittered60Hz ticks keep a steady30Hz paint cadence rather than16/50ms alternation',()=>{
 const times=[],h=harness({onRender:t=>times.push(t)});h.node('start').click();
 for(let i=0;i<1200;i++)h.frameMs(1000/60+(i%2?.2:-.2));
 // The first paint is immediate; measure steady cadence after that initial partial interval.
 const intervals=times.slice(2).map((t,i)=>t-times[i+1]);assert(intervals.length>590);assert(intervals.every(ms=>Math.abs(ms-1000/30)<.01));
});
test('hidden Pause map costs no draws during driving; frozen pause stops repainting the world',()=>{
 const h=harness();h.drive();h.key('KeyW');h.advance(3);assert.equal(h.counts.mapPaints,0);
 h.key('KeyP');h.advance(.1);assert(h.counts.mapPaints>0);const n=h.counts.worldPaints;h.advance(3);assert.equal(h.counts.worldPaints,n);
 h.node('continue').click();h.advance(.1);assert(h.counts.worldPaints>n);
});
test('gameplay gestures retry audio only while active, enabled and trusted',()=>{
 const options={},h=harness(options);h.node('start').click();const started=options.unlocks;
 h.listeners['doc:pointerup']({isTrusted:true});assert(options.unlocks>started);
 const n=options.unlocks;h.listeners['doc:touchend']({isTrusted:false});assert.equal(options.unlocks,n);
 h.node('sound').checked=false;h.node('sound').onchange();h.listeners['doc:touchend']({isTrusted:true});h.key('KeyW');assert.equal(options.unlocks,n);
 h.node('sound').checked=true;h.node('sound').onchange();h.key('KeyP');const paused=options.unlocks;
 h.listeners['doc:pointerup']({isTrusted:true});assert.equal(options.unlocks,paused);assert.equal(options.audioActive,false);
 h.node('continue').click();assert(options.unlocks>paused);assert.equal(options.audioActive,true);
});

test('quick controls appear after Enter, fade once and leave the playable view after eight gameplay seconds',()=>{
 const h=harness();h.node('start').click();const guide=h.node('arrival-controls');
 assert.equal(guide.hidden,false);assert.equal(guide.style.opacity,1);assert.match(h.node('arrival-controls-main').textContent,/WASD/);
 h.key('KeyW');h.advance(1);h.key('KeyW','keyup');assert(h.window.SonoranDrive.inspect().arrival.contact.distance>2,'guide never blocks walking input');
 h.advance(6.6);assert.equal(guide.hidden,false);assert(guide.style.opacity>0&&guide.style.opacity<1);
 h.advance(.6);assert.equal(guide.hidden,true);h.key('KeyP');assert.equal(h.node('pause-dialog').open,true);assert.match(h.node('pause-controls-interact').textContent,/release, press again to exit/);
 h.node('continue').click();h.advance(.1);assert.equal(guide.hidden,true,'resume must not replay the opening guide');
});

test('pausing early dismisses the opening strip while retaining its essential controls in Pause',()=>{
 const h=harness();h.node('start').click();h.advance(.5);assert.equal(h.node('arrival-controls').hidden,false);h.key('KeyP');
 assert.equal(h.node('arrival-controls').hidden,true);assert.match(h.node('pause-controls-flight').textContent,/V toggles flight/);
 h.node('continue').click();h.advance(.2);assert.equal(h.node('arrival-controls').hidden,true);
});

test('automatic and manual touch visibility choose the matching concise instructions',()=>{
 const h=harness({touch:true});h.node('start').click();assert.match(h.node('arrival-controls-main').textContent,/Hold arrows/);assert.match(h.node('pause-controls-flight').textContent,/CLIMB \/ DOWN/);
 h.node('touch-controls').value='hide';h.node('touch-controls').onchange();assert.match(h.node('arrival-controls-main').textContent,/WASD/);assert.match(h.node('pause-controls-main').textContent,/IJKL/);
 h.node('touch-controls').value='show';h.node('touch-controls').onchange();assert.match(h.node('pause-controls-interact').textContent,/tap EXIT/);
});

test('entry stays one action; Pause puts controls ahead of settings and the temporary strip cannot capture pointers',()=>{
 const template=fs.readFileSync(__dirname+'/template.html','utf8'),entry=template.split('<div id="welcome"')[1].split('</section></div>')[0],pause=template.split('<dialog id="pause-dialog"')[1].split('</dialog>')[0];
 assert.equal((entry.match(/<button/g)||[]).length,1);assert(!entry.includes('controls-'));assert(pause.indexOf('pause-controls-main')<pause.indexOf('id="flight-assist"'));assert(pause.indexOf('pause-controls-main')<pause.indexOf('id="sound"'));
 assert.match(template,/\.arrival-controls\{[^}]*pointer-events:none/);assert(!/\.arrival-controls\{[^}]*animation/.test(template));assert.equal((template.match(/id="arrival-controls"/g)||[]).length,1);
});

test('frozen intro and Pause waits are excluded from observed draw cadence',()=>{
 const h=harness();h.advance(12);h.node('start').click();h.advance(3);
 const first=h.window.SonoranDrive.inspect().performance.observedDrawFPS;assert(first>29&&first<31, String(first));
 h.key('KeyP');h.advance(12);h.node('continue').click();h.advance(3);
 const resumed=h.window.SonoranDrive.inspect().performance.observedDrawFPS;assert(resumed>29&&resumed<31,String(resumed));
});
