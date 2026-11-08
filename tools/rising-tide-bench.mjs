// City Fare Rising Tide: deterministic, read-only physics replay.
// Does not move or overwrite browser gameplay progress; rendering/FPS is NOT measured.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { fresh, step, center, TUNE, ROUTE_LENGTH } from '../dist/road.js';

const DT = 1 / 60;
const MPH = 2.2369362920544;
const round = n => Number(n.toFixed(6));
const cases = Object.freeze([
  { id: 'departure', seconds: 30, offset: 0 },
  { id: 'brake-and-relaunch', seconds: 35, offset: 0 },
  { id: 'slalom', seconds: 50, offset: 0 },
  { id: 'desert-recovery', seconds: 40, offset: 18 }
]);

function controls(id, t) {
  if (id === 'departure') return { gas: true };
  if (id === 'brake-and-relaunch') {
    return { gas: t < 16 || t >= 23, brake: t >= 16 && t < 23 };
  }
  if (id === 'slalom') {
    return {
      gas: true,
      left: t >= 7 && t < 13 || t >= 24 && t < 30,
      right: t >= 15 && t < 21 || t >= 32 && t < 38
    };
  }
  // Deliberately synthetic off-road starting condition, not a normal game spawn.
  return { gas: true, left: t < 4, right: t >= 4 && t < 8 };
}

export function runScenario(spec) {
  const state = fresh();
  state.x += spec.offset;
  const frames = Math.round(spec.seconds / DT);
  let peakSpeed = 0, peakLateral = 0, offRoadFrames = 0;
  for (let frame = 0; frame < frames; frame++) {
    const before = state.distance;
    step(state, controls(spec.id, frame * DT), DT);
    const lateral = Math.abs(state.x - center(state.z));
    assert.ok(
      [state.x, state.z, state.v, state.steer, state.angle, state.distance].every(Number.isFinite),
      'non-finite physics state: ' + spec.id + '/' + frame
    );
    assert.ok(state.distance >= before && state.distance <= ROUTE_LENGTH,
      'invalid odometer: ' + spec.id + '/' + frame);
    assert.ok(state.v >= 0 && state.v <= TUNE.maxSpeed,
      'invalid speed: ' + spec.id + '/' + frame);
    assert.ok(lateral <= TUNE.lateralLimit + 1e-7,
      'left permitted desert bounds: ' + spec.id + '/' + frame);
    peakSpeed = Math.max(peakSpeed, state.v);
    peakLateral = Math.max(peakLateral, lateral);
    if (lateral + TUNE.carHalf > TUNE.roadHalf) offRoadFrames++;
  }
  return {
    id: spec.id,
    simulatedSeconds: spec.seconds,
    frames,
    startLateralMeters: spec.offset,
    distanceMeters: round(state.distance),
    finalX: round(state.x),
    finalZ: round(state.z),
    finalLateralMeters: round(state.x - center(state.z)),
    finalSpeedMph: round(state.v * MPH),
    peakSpeedMph: round(peakSpeed * MPH),
    peakLateralMeters: round(peakLateral),
    offRoadFramePercent: round(100 * offRoadFrames / frames),
    finished: state.finished
  };
}

export function runAll() {
  return {
    schema: 'city-fare-rising-tide-physics/v1',
    model: 'dist/road.js',
    timeStepSeconds: DT,
    note: 'Deterministic simulated controls only. No frame-rate, graphics, player-experience, work-time or speedup claim.',
    scenarios: cases.map(runScenario)
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(runAll(), null, 2) + '\n');
}
