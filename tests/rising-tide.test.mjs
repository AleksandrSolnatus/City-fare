import test from 'node:test';
import assert from 'node:assert/strict';
import { runAll, runScenario } from '../tools/rising-tide-bench.mjs';

test('Rising Tide replay repeats exactly under identical controls', () => {
  const one = runAll();
  const two = runAll();
  assert.deepEqual(one, two);
  assert.equal(one.schema, 'city-fare-rising-tide-physics/v1');
  assert.deepEqual(one.scenarios.map(s => s.id), [
    'departure', 'brake-and-relaunch', 'slalom', 'desert-recovery'
  ]);
  assert.equal(one.scenarios.reduce((sum, s) => sum + s.frames, 0), 9300);
});

test('every replay preserves finite, bounded state and accumulates distance', () => {
  for (const s of runAll().scenarios) {
    assert.ok(s.distanceMeters > 0, s.id);
    assert.ok(s.peakSpeedMph > 0, s.id);
    assert.ok(s.peakLateralMeters >= 0 && s.peakLateralMeters <= 32, s.id);
    assert.ok(s.offRoadFramePercent >= 0 && s.offRoadFramePercent <= 100, s.id);
    assert.equal(s.finished, false);
  }
});

test('brake and desert conditions remain distinguishable', () => {
  const scenarios = runAll().scenarios;
  const byId = Object.fromEntries(scenarios.map(s => [s.id, s]));
  assert.ok(byId['brake-and-relaunch'].distanceMeters < byId.departure.distanceMeters * 1.5,
    'Braking scenario should not dramatically exceed the shorter uninterrupted launch');
  assert.ok(byId['desert-recovery'].offRoadFramePercent > 0,
    'Desert test must actually sample off-road motion');
});
