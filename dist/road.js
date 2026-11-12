import {vehicleForces} from './aero.js';
// City Fare: 006's metre/second driving and smoothed inputs, extended to Sonoran Run.
// Deterministic road anchors are generated on demand; 2200 miles means integrated travel.
export const ROUTE_LENGTH = 2200 * 1609.344;
export const TUNE = Object.freeze({
  // 145 m/s is a numerical safety guard; aerodynamic equilibrium sets top speed.
  maxSpeed: 145, steerRate: 5.2, turnRate: .82,
  roadHalf: 3.6, shoulder: 1.7, carHalf: .94, maxDt: .1,
});

const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const quintic = t => t * t * t * (t * (t * 6 - 15) + 10);
const quinticSlope = t => 30 * t * t * (t - 1) * (t - 1);

export function bump(z, start, length, amount) {
  const u = (z - start) / length;
  return u <= 0 || u >= 1 ? 0 : amount * (1 - Math.cos(TAU * u)) / 2;
}

function hash(index, salt) {
  let value = Math.imul(index | 0, 0x45d9f3b) ^ salt;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function anchor(index, hills) {
  if (!hills) return (hash(index, 0x73a4c971) * 2 - 1) * 90;
  return hash(index, 0x561724ad) < .26 ? 4 + hash(index, 0x291ab53f) * 8 : 0;
}

function profile(z, hills) {
  const index = Math.floor(z / 1800), t = z / 1800 - index;
  const a = anchor(index, hills), delta = anchor(index + 1, hills) - a;
  const value = a + delta * quintic(t), derivative = delta * quinticSlope(t) / 1800;
  // A flat 400 m departure eases into the procedural road without a tangent jump.
  const start = clamp((z - 400) / 1400, 0, 1), blend = quintic(start);
  const blendSlope = start > 0 && start < 1 ? quinticSlope(start) / 1400 : 0;
  return [value * blend, derivative * blend + value * blendSlope];
}

export function center(z) { return profile(z, false)[0]; }
export function elevation(z) { return profile(z, true)[0]; }
export function heading(z) { return Math.atan(profile(z, false)[1]); }

// Vertical grade, distinct from the horizontal tangent returned by heading().
export function slope(z) { return profile(z, true)[1]; }

export function terrainHeight(x, z) {
  const lateral = Math.abs(x - center(z));
  const blend = smooth((lateral - 20) / 75);
  const phase = TAU * z / 12000;
  const rolls = 1.2 * Math.sin(x * .04 + phase * 5)
    + .65 * Math.sin(x * .075 - phase * 9)
    + .4 * Math.cos(x * .022 + phase * 3);
  return elevation(z) - .05 + blend * rolls;
}

export function fresh() {
  const z = 0;
  return { x: center(z) + 1.8, z, v: 0, steer: 0, angle: heading(z), distance: 0, finished: false, destroyedCacti: [] };
}

// Shared, reproducible cactus positions: visible mesh and collision use identical records.
export function cactusRecords(start) {
  const records=[];
  for(let z=start+30;z<start+600;z+=60) for(const side of [-1,1]) {
    for(let j=0;j<2;j++) {
      const zz=z+j*23;
      const seed=z+side+j;
      records.push({id:'c:'+start+':'+(z-start)+':'+side+':'+j,
        x:center(zz)+side*(38+decorRandom(seed)*120),z:zz,seed,radius:.55});
    }
    // A second, closer belt encourages accessible off-road exploration.
    const zz=z+42, seed=z+side+513;
    records.push({id:'c:'+start+':'+(z-start)+':'+side+':near',
      x:center(zz)+side*(15+decorRandom(seed)*20),z:zz,seed,radius:.55});
  }
  return records;
}
function decorRandom(n) {
  const value=Math.sin(n*127.1+311.7)*43758.5453;
  return value-Math.floor(value);
}
// Swept circular hit test avoids tunnelling even when the vehicle is fast.
export function sweptCactusHits(x0,z0,x1,z1,alreadyDestroyed=new Set()) {
  const hits=[],vx=x1-x0,vz=z1-z0,len2=vx*vx+vz*vz;
  const first=Math.floor((Math.min(z0,z1)-3)/600)*600;
  const last=Math.floor((Math.max(z0,z1)+3)/600)*600;
  for(let chunk=first;chunk<=last;chunk+=600) {
    for(const cactus of cactusRecords(chunk)) {
      if(alreadyDestroyed.has(cactus.id))continue;
      const t=len2>0?clamp(((cactus.x-x0)*vx+(cactus.z-z0)*vz)/len2,0,1):0;
      const dx=x0+t*vx-cactus.x,dz=z0+t*vz-cactus.z;
      const reach=TUNE.carHalf+cactus.radius;
      if(dx*dx+dz*dz<=reach*reach)hits.push(cactus);
    }
  }
  return hits;
}

// Mutates and returns state. Driving uses SI units and constant substep cadence.
export function step(state, input = {}, dt = 0, prefs = {}) {
  if (state.finished || state.distance >= ROUTE_LENGTH) {
    state.finished=true;state.distance=ROUTE_LENGTH;state.v=0;return state;
  }
  if(!Number.isFinite(dt)||dt<=0)return state;
  const duration=Math.min(dt,TUNE.maxDt);
  const count=Math.ceil(duration*120),h=duration/count;
  const target=(input.right?1:0)-(input.left?1:0);
  if(!Array.isArray(state.destroyedCacti))state.destroyedCacti=[];
  const destroyed=new Set(state.destroyedCacti);
  state.impacts=[];

  for(let i=0;i<count;i++){
    const oldSteer=state.steer;
    state.steer+=(target-state.steer)*(1-Math.exp(-TUNE.steerRate*h));
    const oldSpeed=state.v, x0=state.x,z0=state.z;
    const lateral=state.x-center(state.z);
    const sand=smooth((Math.abs(lateral)+TUNE.carHalf-TUNE.roadHalf)/TUNE.shoulder);
    const forces=vehicleForces(oldSpeed,state.angle,state.x,state.z,sand,undefined,prefs.wingMode);
    const acceleration=input.brake?forces.braking:input.gas?forces.acceleration:
      -(forces.drag+forces.resistance)/1250;
    state.v=clamp(oldSpeed+acceleration*h,0,TUNE.maxSpeed);
    const speed=(oldSpeed+state.v)/2;
    const remaining=ROUTE_LENGTH-(state.distance||0);
    const travel=Math.min(speed*h,remaining);
    const fraction=speed>0?travel/(speed*h):1;
    const desiredYaw=(oldSteer+state.steer)/2*TUNE.turnRate*
      (prefs.gentle?.68:1)*speed/(speed+8)/Math.max(1,speed/40);
    // The friction + downforce budget limits cornering on both road and sand.
    const yawRate=clamp(desiredYaw,-forces.lateralGrip/Math.max(4,speed),
                                   forces.lateralGrip/Math.max(4,speed));
    const yawChange=yawRate*h*fraction,midAngle=state.angle+yawChange/2;
    state.x+=travel*Math.sin(midAngle);
    state.z=Math.max(0,state.z+travel*Math.cos(midAngle));
    state.angle+=yawChange;
    state.distance=Math.min(ROUTE_LENGTH,(state.distance||0)+travel);
    for(const hit of sweptCactusHits(x0,z0,state.x,state.z,destroyed)){
      destroyed.add(hit.id);state.destroyedCacti.push(hit.id);
      state.impacts.push({id:hit.id,x:hit.x,z:hit.z,seed:hit.seed});
      state.v*=.95;
    }
    if(state.distance>=ROUTE_LENGTH){state.finished=true;state.v=0;break;}
  }
  return state;
}
