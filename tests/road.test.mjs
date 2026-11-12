import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTE_LENGTH, TUNE, bump, center, elevation, heading, slope, terrainHeight, fresh, step } from '../dist/road.js';

const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test('2200-mile procedural route is deterministic, bounded, and has consistent tangents', () => {
  near(ROUTE_LENGTH, 3540556.8);
  near(bump(0, 0, 100, 8), 0);
  near(bump(50, 0, 100, 8), 8);
  near(bump(100, 0, 100, 8), 0);
  for (const z of [-20, 0, 400]) { near(center(z), 0); near(elevation(z), 0); near(heading(z), 0); }
  for (const z of [800, 1799, 1800, 1801, 3900, 45000, 3487600, ROUTE_LENGTH + 9000]) {
    const x = center(z); center(z + 31200); near(center(z), x);
    assert.ok(Math.abs(x) <= 90); assert.ok(elevation(z) >= 0 && elevation(z) <= 12);
    near(Math.tan(heading(z)), (center(z + .01) - center(z - .01)) / .02, 1e-7);
    near(slope(z), (elevation(z + .01) - elevation(z - .01)) / .02, 1e-7);
  }
  near(center(1800 - .001), center(1800 + .001), 1e-8);
  assert.notEqual(center(45000), center(45000 + 12000));
});

test('terrain is flat near the road and gently bounded outside', () => {
  for (const z of [0, 300, 1200, 1800, 45000, ROUTE_LENGTH + 9000]) {
    for (const lateral of [-20, -4, 0, 4, 20]) near(terrainHeight(center(z) + lateral, z), elevation(z) - .05);
    for (const x of [-400, -60, 60, 400]) {
      assert.ok(Math.abs(terrainHeight(x, z) - elevation(z) + .05) <= 2.25 + 1e-10);
    }
  }
  near(terrainHeight(110, -1e-6), terrainHeight(110, 1e-6), 1e-6);
});

test('fresh starts in the right lane and stationary steering cannot rotate the car', () => {
  const state = fresh();
  assert.equal(state.z, 0); near(state.x - center(state.z), 1.8); assert.equal(state.finished, false);
  near(state.angle, heading(state.z)); assert.equal(state.v, 0);
  for (let i = 0; i < 120; i++) step(state, { right: true }, 1 / 60);
  near(state.x, 1.8); near(state.z, 0); near(state.angle, 0); near(state.distance, 0);
  assert.ok(state.steer > .99);
});

test('straight propulsion integrates odometer distance in real SI time', () => {
  const state={...fresh(),v:10};
  step(state,{gas:true},.1);
  assert.ok(state.v>10 && state.v<12);
  near(state.z,state.distance,1e-8);
  near(state.x,1.8);near(state.angle,0);
});

test('absolute yaw drives world x/z without road-follow steering', () => {
  const state = { ...fresh(), z: 1000, x: center(1000), v: 10, angle: .2 };
  step(state, {}, .05);
  const travel=state.distance;
  near(state.x,center(1000)+Math.sin(.2)*travel);
  near(state.z,1000+Math.cos(.2)*travel);
  near(state.angle, .2);
});

test('brake overrides gas, speed stays bounded, and dt is bounded', () => {
  const brake = { ...fresh(), v: 10 }, both = { ...brake };
  step(brake, { brake: true }, .1); step(both, { brake: true, gas: true }, .1);
  assert.deepEqual(brake, both); assert.ok(brake.v<10);
  const capped = { ...fresh(), v: 80.4672 };
  step(capped, { gas: true }, .1); assert.equal(capped.v, 80.4672);
  const stopped = { ...fresh(), v: .01 };
  step(stopped, { brake: true }, .1); assert.equal(stopped.v, 0);
  const normal = fresh(), huge = fresh();
  step(normal, { gas: true }, .1); step(huge, { gas: true }, 1000);
  assert.deepEqual(huge, normal);
  for (const dt of [-1, 0, NaN, Infinity]) {
    const state = fresh(), before = { ...state }; step(state, { gas: true }, dt); assert.deepEqual(state, before);
  }
});

test('frame cadence agrees and releasing caller inputs recentres steering', () => {
  function drive(hz) {
    const state = { ...fresh(), v: 12 };
    for (let i = 0; i < hz * 2; i++) step(state, { gas: true, right: true }, 1 / hz);
    return state;
  }
  const reference = drive(120);
  for (const hz of [30, 60]) {
    const state = drive(hz);
    for (const key of ['x', 'z', 'v', 'angle', 'steer', 'distance']) near(state[key], reference[key], 1e-7);
  }
  const state = drive(60), speed = state.v;
  for (let i = 0; i < 120; i++) step(state, {}, 1 / 60);
  assert.ok(Math.abs(state.steer) < .001); assert.ok(state.v < speed);
});

test('off-road drag starts at tire edge while recovery remains possible', () => {
  const paved = { ...fresh(), x: 2.7, v: 15 }, shoulder = { ...fresh(), x: 4, v: 15 };
  step(paved, { gas: true }, .1); step(shoulder, { gas: true }, .1);
  assert.ok(shoulder.v < paved.v);
  const recovery = { ...fresh(), x: 8, angle: -.3 };
  for (let i = 0; i < 120; i++) step(recovery, { gas: true }, 1 / 60);
  assert.ok(recovery.v > 0); assert.ok(recovery.x < 8);
  const fastSand = { ...fresh(), x: 8, v: TUNE.maxSpeed };
  step(fastSand, { gas: true }, .1);
  assert.ok(fastSand.v < TUNE.maxSpeed && fastSand.v > 0);
});

test('world z does not wrap or finish the odometer challenge', () => {
  const z = ROUTE_LENGTH - .2;
  const forward = { ...fresh(), z, x: center(z), v: 10 };
  step(forward, {}, .1);
  assert.ok(forward.z > ROUTE_LENGTH); assert.equal(forward.finished, false);
  near(forward.z-z,forward.distance);
  const reverse = { ...fresh(), z: .2, v: 10, angle: Math.PI };
  step(reverse, {}, .1);
  near(reverse.z, 0); assert.equal(reverse.finished, false);
});

test('the exact 2200-mile odometer endpoint stops motion permanently', () => {
  const state = { ...fresh(), z: 100, v: 30, angle: .3, distance: ROUTE_LENGTH - .2 };
  step(state, { gas: true }, .1);
  assert.equal(state.distance, ROUTE_LENGTH); assert.equal(state.finished, true); assert.equal(state.v, 0);
  near(state.z, 100 + .2 * Math.cos(.3), 1e-8);
  near(state.x, 1.8 + .2 * Math.sin(.3), 1e-8);
  const stopped = { ...state };
  step(state, { gas: true, right: true }, .1);
  assert.deepEqual(state, stopped);
});
