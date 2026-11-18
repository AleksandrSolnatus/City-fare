const test=require('node:test'),assert=require('node:assert/strict');
const {Game,FLIGHT_ASSIST,HANDLING}=require('./game.js'),{ArrivalSession}=require('./arrival.js');
const DT=1/60;
function setup(){const game=new Game(701);game.start();return {game,session:new ArrivalSession(game,{direct:true})};}
function run(s,seconds,input={}){for(let i=0;i<Math.ceil(seconds/DT);i++)s.step(input,DT);}
function height(g){return g.car.z-g.world.height(g.car.x,g.car.y);}
function finite(g){for(const key of ['x','y','z','vx','vy','vz','yaw','lift'])assert(Number.isFinite(g.car[key]),key);}

// Captured from public 013 commit3f07fde before adding flight assist. This is a
// fixed reference, not generated from the implementation under test.
const groundReference=[
 [0,-2799.996156415776,-2199.9974376105174,41.13834801698192,.23061505342008956,.15374336894672636,.00018206378094494843,.5880026035475675,'hover'],
 [119,-2777.0384732847806,-2184.6923155231875,41.27647905925268,20.662489323530828,13.774992882353882,.15411081448882027,.5880026035475675,'hover'],
 [179,-2752.955002706185,-2168.636668470791,48.44331570688702,27.066604578187548,18.044403052125023,2.3435866476343348,.5880026035475675,'flight'],
 [299,-2726.4980934457967,-2109.558296265234,42.0528448216663,-9.607975079809128,33.9871923775601,-.7114677692818685,2.0759150354776685,'hover'],
 [449,-2781.574433474425,-2000.7342045866649,40.442388585536555,-20.037956449588094,55.93153526552183,-2.7857843804431015,1.7525378327499228,'hover'],
 [599,-2755.411554971344,-1882.727093220927,25.718635383904704,17.26730139833153,33.39808922181408,-5.546912805720737,1.090764968381138,'hover'],
 [679,-2747.747111112085,-1867.956088287432,23.311754673511,-5.0578746259212346e-36,2.6333859771621692e-36,.31354922403441243,1.090764968381138,'hover'],
 [809,-2750.46615810246,-1873.1784897502555,24.292445009767643,-3.330566269322237,-6.396930328347629,1.084167717412662,1.090764968381138,'hover'],
 [899,-2754.448831879851,-1880.8279056796641,25.607311918691096,-2.0895253535998566,-4.013295945921621,.668106244277503,1.090764968381138,'hover']
];

test('never-enabled flight preserves the original 013 ground hop/surge/turn/brake/reverse trajectory',()=>{
 const {game:g}=setup();let n=0;
 for(let i=0;i<900;i++){
  g.step({forward:i<540,right:i>=180&&i<300,left:i>=420&&i<510,boost:i>=330&&i<430,hop:i>=120&&i<155,brake:i>=600&&i<680,backward:i>=720&&i<810},DT);
  if(i!==groundReference[n]?.[0])continue;const expected=groundReference[n++],keys=['x','y','z','vx','vy','vz','yaw'];
  keys.forEach((key,j)=>assert(Math.abs(g.car[key]-expected[j+1])<1e-10,`frame${i} ${key}`));assert.equal(g.car.hopPhase,expected[8]);
 }
 assert.equal(n,groundReference.length);assert.equal(g.car.flightAssist,false);
});

test('observation flight climbs by finite thrust and then holds altitude while pivoting through180degrees',()=>{
 const {game:g,session:s}=setup(),x=g.car.x,y=g.car.y,z=g.car.z;assert.equal(s.setFlightAssist(true),true);
 let previousZ=g.car.z,maxVz=0;
 for(let i=0;i<1200;i++){s.step({hop:true},DT);finite(g);assert(Math.abs(g.car.z-previousZ)<.21);assert(g.car.lift<=HANDLING.liftMax);assert(g.car.groundCorrection===0);maxVz=Math.max(maxVz,g.car.vz);previousZ=g.car.z;}
 assert(g.car.z-z>220);assert(maxVz<=FLIGHT_ASSIST.climb+1e-9);run(s,8);const held=g.car.z,yaw=g.car.yaw;
 run(s,Math.PI/1.17,{left:true});assert(Math.abs(g.car.yaw-yaw+Math.PI)<.03);assert(Math.abs(g.car.z-held)<.01);assert.equal(g.car.x,x);assert.equal(g.car.y,y);assert.equal(s.snapshot().flightAssist,true);assert.equal(s.canExit(),false);
});

test('climb ceiling remains bounded and lower input physically descends without turning flight off',()=>{
 const {game:g,session:s}=setup();s.setFlightAssist(true);run(s,90,{hop:true});finite(g);
 assert(height(g)<=FLIGHT_ASSIST.ceilingAboveGround+.5);assert(g.car.z<=FLIGHT_ASSIST.ceilingAbsolute+.5);assert(height(g)>690);assert(Math.abs(g.car.vz)<.1);
 const z=g.car.z;run(s,5,{descend:true});assert(g.car.z<z-30);assert(g.car.vz>=-FLIGHT_ASSIST.descent-1e-8);assert(s.flightAssist);assert(g.inputEvents.some(e=>e.input.endsWith('1')));
});

test('flight toggle off lands under power; held E never exits until a fresh interaction',()=>{
 const {game:g,session:s}=setup();s.setFlightAssist(true);run(s,15,{hop:true});const z=g.car.z;
 s.setFlightAssist(false);assert.equal(g.car.z,z);assert(g.car.flightLanding);assert.equal(s.canExit(),false);s.requestStop();
 let frames=0,previousZ=g.car.z;for(;frames<3600&&!s.canExit();frames++){s.step({brake:true},DT);finite(g);assert(Math.abs(g.car.z-previousZ)<.21);assert.equal(g.car.groundCorrection,0);assert.equal(s.mode,'drive');previousZ=g.car.z;}
 assert(frames<3600);assert(!g.car.flightAssist&&!g.car.flightLanding);assert.equal(s.mode,'drive');assert.equal(s.exitStatus().reason,'ready');
 assert.equal(s.interact(),true);run(s,2);assert.equal(s.mode,'walk');assert.equal(s.setFlightAssist(true),false);assert.equal(s.interact(),true);run(s,3);assert.equal(s.mode,'drive');assert.equal(s.flightAssist,false);assert.equal(g.car.hopPhase,'hover');
});

test('E while flight assist is enabled brakes horizontal travel and descends before safe exit',()=>{
 const {game:g,session:s}=setup();s.setFlightAssist(true);run(s,8,{forward:true,hop:true});assert(g.car.speed>40);assert(height(g)>80);
 s.requestStop();assert.equal(s.flightAssist,false);assert(s.parkingRequested);run(s,2,{brake:true});assert(g.car.speed<.15);assert(height(g)>50);assert.equal(s.mode,'drive');assert.equal(s.exitStatus().reason,'airborne');
 run(s,25,{brake:true});assert.equal(s.exitStatus().reason,'ready');assert.equal(s.mode,'drive');
});

test('legacy brake also commits to controlled descent instead of climbing back when released',()=>{
 const {game:g,session:s}=setup();s.setFlightAssist(true);run(s,8,{hop:true});run(s,1);const z=g.car.z;
 s.step({brake:true},DT);assert.equal(s.flightAssist,false);assert(g.car.flightLanding);run(s,6,{});assert(g.car.z<z-20);assert.equal(s.flightAssist,false);
 run(s,20,{});assert.equal(g.car.hopPhase,'hover');assert.equal(g.car.flightLanding,false);assert(height(g)<3);
});

test('surge and ascent remain independent; deterministic replay retains finite flight state',()=>{
 const a=setup(),b=setup();for(const {game:g,session:s}of[a,b]){s.setFlightAssist(true);run(s,2,{hop:true});assert.equal(g.car.speed,0);run(s,2,{hop:true,boost:true});assert(g.car.boosting);assert(g.car.speed>40);assert(g.car.vz>11);assert(g.car.surge<.4);run(s,2,{forward:true,right:true});run(s,2,{descend:true,left:true});}
 assert.deepEqual(a.game.car,b.game.car);assert.deepEqual(a.session.events,b.session.events);assert(a.game.car.surge<1);assert(height(a.game)>35);finite(a.game);
 a.session.recover();assert.equal(a.session.flightAssist,false);assert.equal(a.game.car.flightLanding,false);
});

test('high observation flight contributes much less ground disturbance than nearby powered hover',()=>{
 const {game:g,session:s}=setup();s.setFlightAssist(true);run(s,20,{hop:true});s.step({forward:true},DT);
 const c=g.car,raw=.15+Math.abs(c.throttle)*.55+(c.boosting?.55:0)+Math.min(.15,Math.abs(c.vz)*.025),material=g.world.material(c.x,c.y)==='rock'?.2:1;
 assert(height(g)>230);assert(c.disturbance<raw*material*.01);
});
