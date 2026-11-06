// City Fare: 006's metre/second driving and smoothed inputs, extended to Sonoran Run.
// Deterministic road anchors are generated on demand; 2200 miles means integrated travel.
export const ROUTE_LENGTH = 2200 * 1609.344;
export const TUNE = Object.freeze({
  maxSpeed: 80.4672, acceleration: 7.5, brake: 12, coast: 1.1,
  shoulderDrag: 2.8, sandSpeedFactor: .78, steerRate: 4.5, turnRate: .42,
  roadHalf: 3.6, shoulder: 1.7, carHalf: .82,
  lateralLimit: 32, boundaryStart: 24, maxDt: .1,
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
  return { x: center(z) + 1.8, z, v: 0, steer: 0, angle: heading(z), distance: 0, finished: false };
}

// Mutates and returns state. x/z are world coordinates; angle is absolute yaw,
// with zero along +z and positive toward +x. Angles remain continuous for camera interpolation.
export function step(state, input = {}, dt = 0, prefs = {}) {
  if (state.finished || state.distance >= ROUTE_LENGTH) {
    state.finished = true; state.distance = ROUTE_LENGTH; state.v = 0; return state;
  }
  if (!Number.isFinite(dt) || dt <= 0) return state;
  const duration = Math.min(dt, TUNE.maxDt);
  const count = Math.ceil(duration * 120);
  const h = duration / count;
  const target = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  for (let i = 0; i < count; i++) {
    const oldSteer = state.steer;
    state.steer += (target - state.steer) * (1 - Math.exp(-TUNE.steerRate * h));
    const oldSpeed = state.v;
    const lateral = state.x - center(state.z);
    const shoulder = smooth((Math.abs(lateral) + TUNE.carHalf - TUNE.roadHalf) / TUNE.shoulder);
    const sandLimit = TUNE.maxSpeed * (1 - (1 - TUNE.sandSpeedFactor) * shoulder);
    const drive = TUNE.acceleration * clamp((sandLimit - oldSpeed) / 4, 0, 1);
    let acceleration = input.brake ? -TUNE.brake : input.gas ? drive : -TUNE.coast;
    // Speed-dependent drag keeps a stopped vehicle able to return from the desert.
    acceleration -= TUNE.shoulderDrag * shoulder * Math.min(1, oldSpeed / 12);
    state.v = clamp(oldSpeed + acceleration * h, 0, TUNE.maxSpeed);
    const speed = (oldSpeed + state.v) / 2;
    const remaining = ROUTE_LENGTH - (state.distance || 0);
    const travel = Math.min(speed * h, remaining);
    const fraction = speed > 0 ? travel / (speed * h) : 1;
    const yawChange = (oldSteer + state.steer) / 2 * TUNE.turnRate
      * (prefs.gentle ? .68 : 1) * speed / (speed + 8)
      / Math.max(1, speed / 45) * h * fraction;
    const midAngle = state.angle + yawChange / 2;
    let dx = travel * Math.sin(midAngle);
    const dz = travel * Math.cos(midAngle);

    // A gradual boundary only at the outer desert margin; there is no lane-follow assist.
    if (dx * lateral > 0) dx *= 1 - smooth((Math.abs(lateral) - TUNE.boundaryStart)
      / (TUNE.lateralLimit - TUNE.boundaryStart));
    state.z = Math.max(0, state.z + dz);
    state.angle += yawChange;
    state.x = clamp(state.x + dx, center(state.z) - TUNE.lateralLimit,
      center(state.z) + TUNE.lateralLimit);
    state.distance = Math.min(ROUTE_LENGTH, (state.distance || 0) + travel);
    if (state.distance >= ROUTE_LENGTH) { state.finished = true; state.v = 0; break; }
  }
  return state;
}
