import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTE_LENGTH, center, fresh, step } from '../dist/road.js';
import { TripSave, TRIP_SAVE_KEY } from '../dist/trip-save.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, value); }
}

function parkedTrip(overrides = {}) {
  return { ...fresh(), x: center(1500) + 12, z: 1500, angle: Math.PI * 5.25,
    distance: 4200, v: 42, steer: -.8, paused: false, ...overrides };
}

function storedRecord(overrides = {}) {
  return { version: 1, route: 'sonoran-007', routeLength: ROUTE_LENGTH,
    savedAt: 1794180000000, state: { x: 1.8, z: 0, angle: 0, distance: 0, finished: false },
    ...overrides };
}

test('round trip keeps off-road position, continuous yaw and true odometer, then parks', () => {
  const storage = new MemoryStorage(), save = new TripSave(storage), source = parkedTrip();
  assert.deepEqual(save.load(), { status: 'empty' });
  const result = save.save(source);
  assert.equal(result.status, 'saved');
  assert.ok(Number.isSafeInteger(result.checkpoint.savedAt));
  assert.equal(source.v, 42); assert.equal(source.steer, -.8);
  const read = new TripSave(storage).load();
  assert.equal(read.status, 'saved');
  assert.deepEqual(read.checkpoint, result.checkpoint);
  for (const key of ['x', 'z', 'angle', 'distance']) assert.equal(read.checkpoint.state[key], source[key]);
  assert.deepEqual([read.checkpoint.state.v, read.checkpoint.state.steer, read.checkpoint.state.paused], [0, 0, true]);
  const encoded = JSON.parse(storage.getItem(TRIP_SAVE_KEY));
  assert.deepEqual(Object.keys(encoded.state).sort(), ['angle', 'destroyedCactusBits', 'distance', 'finished', 'x', 'z']);
  // Mutating either the caller's state or a returned snapshot cannot change saved bytes.
  source.z = 100;
  read.checkpoint.state.distance = 9;
  assert.equal(save.load().checkpoint.state.distance, 4200);
});

test('driving backward retains cumulative travel rather than replacing it with world z', () => {
  const storage = new MemoryStorage(), save = new TripSave(storage);
  const state = parkedTrip({ x: center(1500), angle: Math.PI, v: 20 });
  step(state, { gas: true }, .1);
  assert.ok(state.z < 1500); assert.ok(state.distance > 4200);
  assert.equal(save.save(state).status, 'saved');
  const restored = save.load().checkpoint.state;
  assert.equal(restored.z, state.z); assert.equal(restored.distance, state.distance);
  const before = { ...restored };
  step(restored, {}, .1);
  assert.equal(restored.z, before.z); assert.equal(restored.distance, before.distance);
});

test('elapsed wall time adds no mileage and a completed journey remains completed', () => {
  const storage = new MemoryStorage(), save = new TripSave(storage);
  const completed = parkedTrip({ distance: ROUTE_LENGTH, finished: false });
  assert.equal(save.save(completed).checkpoint.state.finished, true);
  const old = JSON.parse(storage.getItem(TRIP_SAVE_KEY)); old.savedAt = 0;
  storage.setItem(TRIP_SAVE_KEY, JSON.stringify(old));
  const restored = save.load().checkpoint.state;
  assert.equal(restored.finished, true); assert.equal(restored.distance, ROUTE_LENGTH);
  const before = { ...restored };
  step(restored, { gas: true, right: true }, .1);
  assert.deepEqual(restored, before);
  // A premature incoming flag is derived from mileage, never trusted as a win.
  assert.equal(save.save(parkedTrip({ finished: true })).checkpoint.state.finished, false);
});

test('invalid runtime state is rejected before any existing checkpoint is changed', () => {
  const storage = new MemoryStorage(), save = new TripSave(storage);
  assert.equal(save.save(parkedTrip()).status, 'saved');
  const initial = storage.getItem(TRIP_SAVE_KEY);
  const bad = [null, [], {}, parkedTrip({ finished: 'yes' }), parkedTrip({ z: -1 }),
    parkedTrip({ distance: -1 }), parkedTrip({ distance: ROUTE_LENGTH + 1 }),
    parkedTrip({ z: 5000 }), parkedTrip({ x: center(1500) + 10000 })];
  for (const key of ['x', 'z', 'angle', 'distance']) {
    for (const value of [NaN, Infinity, -Infinity, '12', null]) bad.push(parkedTrip({ [key]: value }));
  }
  for (const state of bad) {
    assert.equal(save.save(state).status, 'invalid');
    assert.equal(storage.getItem(TRIP_SAVE_KEY), initial);
  }
});

test('malformed, incompatible and impossible stored records survive automatic writes', () => {
  const bad = ['{', 'null', '[]', JSON.stringify(storedRecord({ version: 2 })),
    JSON.stringify(storedRecord({ route: 'old-prototype' })),
    JSON.stringify(storedRecord({ routeLength: 100 })),
    JSON.stringify(storedRecord({ savedAt: -1 })),
    JSON.stringify(storedRecord({ savedAt: 'yesterday' })),
    JSON.stringify(storedRecord({ state: { x: null, z: 0, angle: 0, distance: 0, finished: false } })),
    JSON.stringify(storedRecord({ state: { x: 1.8, z: 100, angle: 0, distance: 5, finished: false } })),
    JSON.stringify(storedRecord({ state: { x: 1.8, z: 0, angle: 0, distance: 0, finished: true } })),
    JSON.stringify(storedRecord({ state: { x: 999, z: 0, angle: 0, distance: 100, finished: false } })),
    JSON.stringify(storedRecord({ state: { x: 1.8, z: 0, angle: 0, distance: ROUTE_LENGTH, finished: false } }))];
  for (const raw of bad) {
    const storage = new MemoryStorage(); storage.setItem(TRIP_SAVE_KEY, raw);
    const save = new TripSave(storage);
    assert.equal(save.load().status, 'invalid');
    assert.equal(save.save(fresh()).status, 'invalid');
    assert.equal(storage.getItem(TRIP_SAVE_KEY), raw);
    assert.equal(save.save(fresh(), { replace: true }).status, 'saved');
  }
});

test('valid boundary values allow harmless rounding but never relocate the car', () => {
  const storage = new MemoryStorage(), save = new TripSave(storage);
  for (const lateral of [-140, 140]) {
    const state = parkedTrip({ x: center(1500) + lateral, z: 1500, distance: 1500 - 1e-8 });
    assert.equal(save.save(state).status, 'saved');
    assert.equal(save.load().checkpoint.state.x, state.x);
    assert.equal(save.load().checkpoint.state.z, state.z);
  }
});

test('missing, denied and quota-full storage fail without throwing or losing the baseline', () => {
  assert.equal(new TripSave(undefined).load().status, 'unavailable');
  const denied = new TripSave({ getItem() { throw new Error('Denied'); } });
  assert.equal(denied.load().status, 'unavailable');
  assert.equal(denied.save(fresh()).status, 'unavailable');
  const storage = new MemoryStorage(), save = new TripSave(storage);
  assert.equal(save.save(parkedTrip()).status, 'saved');
  const prior = storage.getItem(TRIP_SAVE_KEY), write = storage.setItem.bind(storage);
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.equal(save.save(fresh()).status, 'unavailable');
  assert.equal(storage.getItem(TRIP_SAVE_KEY), prior);
  storage.setItem = write;
  assert.equal(save.save(fresh()).status, 'saved');
});

test('two tabs detect an intervening write or deletion, while an explicit restart replaces', () => {
  const storage = new MemoryStorage(), first = new TripSave(storage), second = new TripSave(storage);
  first.load(); second.load();
  assert.equal(first.save(parkedTrip()).status, 'saved');
  const prior = storage.getItem(TRIP_SAVE_KEY);
  assert.equal(second.save(fresh()).status, 'conflict');
  assert.equal(storage.getItem(TRIP_SAVE_KEY), prior);
  assert.equal(second.save(fresh(), { replace: true }).status, 'saved');
  assert.equal(first.save(parkedTrip()).status, 'conflict');
  assert.equal(first.load().checkpoint.state.distance, 0);
  assert.equal(first.save(parkedTrip()).status, 'saved');
  storage.values.delete(TRIP_SAVE_KEY);
  assert.equal(first.save(parkedTrip()).status, 'conflict');
  assert.equal(first.load().status, 'empty');
  assert.equal(first.save(fresh()).status, 'saved');
});

test('unobserved occupied slots require loading, and unrelated prototype data is untouched', () => {
  const storage = new MemoryStorage();
  storage.setItem('cityFareSave', 'old prototype data');
  assert.equal(new TripSave(storage).save(parkedTrip()).status, 'saved');
  const lateTab = new TripSave(storage);
  assert.equal(lateTab.save(fresh()).status, 'conflict');
  assert.equal(lateTab.load().status, 'saved');
  assert.equal(lateTab.save(fresh()).status, 'saved');
  assert.equal(storage.getItem('cityFareSave'), 'old prototype data');
});

test('008 legacy checkpoint restores with empty cactus history; impacts persist in 009', () => {
  const storage=new MemoryStorage();
  storage.setItem(TRIP_SAVE_KEY,JSON.stringify(storedRecord()));
  const save=new TripSave(storage);
  const legacy=save.load();assert.equal(legacy.status,'saved');
  assert.deepEqual(legacy.checkpoint.state.destroyedCacti,[]);
  const hit='c:0:30:1:0';
  const state=parkedTrip({destroyedCacti:[hit]});
  assert.equal(save.save(state).status,'saved');
  const restored=new TripSave(storage).load();
  assert.deepEqual(restored.checkpoint.state.destroyedCacti,[hit]);
  assert.equal(restored.checkpoint.state.v,0);
});
test('invalid cactus receipts are rejected without rewriting a valid save', () => {
  const storage=new MemoryStorage(),save=new TripSave(storage);
  assert.equal(save.save(parkedTrip()).status,'saved');
  const baseline=storage.getItem(TRIP_SAVE_KEY);
  for(const destroyedCacti of [['bad'],['c:0:30:1:0','c:0:30:1:0'],null]){
    assert.equal(save.save(parkedTrip({destroyedCacti})).status,'invalid');
    assert.equal(storage.getItem(TRIP_SAVE_KEY),baseline);
  }
});
