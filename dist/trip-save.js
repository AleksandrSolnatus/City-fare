import { ROUTE_LENGTH } from './road.js';

export const TRIP_SAVE_KEY = 'cityFareTrip:sonoran-007:v1';
const tripSaveRoute = 'sonoran-007';
const tripSaveTolerance = 1e-6;

function tripSaveState(value, requireMatchingFinish = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !['x', 'z', 'angle', 'distance'].every(key => Number.isFinite(value[key]))
    || typeof value.finished !== 'boolean') return null;
  const { x, z, angle, distance } = value;
  if (z < 0 || distance < 0 || distance > ROUTE_LENGTH
    || z > distance + tripSaveTolerance
    || Math.abs(x-1.8) > distance + 200 || z > 1e9) return null;
  // Existing 008 checkpoint records have no cactus history: accept as empty.
  const destroyedCacti=value.destroyedCacti===undefined?[]:value.destroyedCacti;
  if(!Array.isArray(destroyedCacti)||destroyedCacti.length>10000
    || destroyedCacti.some(id=>typeof id!=='string'||
       !/^c:-?\d+:\d+:-?1:(?:0|1|near)$/.test(id))
    || new Set(destroyedCacti).size!==destroyedCacti.length)return null;
  const finished = distance === ROUTE_LENGTH;
  if (requireMatchingFinish && value.finished !== finished) return null;
  // Only journey coordinates survive. Resuming never restores motion or held controls.
  return { x, z, angle, distance, finished, destroyedCacti:[...destroyedCacti], v: 0, steer: 0, paused: true };
}

function tripSaveDecode(raw) {
  if (raw === null) return { status: 'empty' };
  let record;
  try { record = JSON.parse(raw); } catch { return { status: 'invalid', reason: 'malformed' }; }
  if (!record || typeof record !== 'object' || Array.isArray(record)
    || record.version !== 1 || record.route !== tripSaveRoute
    || record.routeLength !== ROUTE_LENGTH) return { status: 'invalid', reason: 'incompatible' };
  const state = tripSaveState(record.state, true);
  if (!state || !Number.isSafeInteger(record.savedAt) || record.savedAt < 0)
    return { status: 'invalid', reason: 'invalid-checkpoint' };
  return { status: 'saved', checkpoint: { state, savedAt: record.savedAt } };
}

// One local slot. Exact raw comparison detects a tab that wrote since our last
// load/save. Web Storage has no atomic compare-and-swap; this is best-effort protection.
export class TripSave {
  #storage;
  #raw;

  constructor(storage) { this.#storage = storage; }

  load() {
    let raw;
    try { raw = this.#storage.getItem(TRIP_SAVE_KEY); }
    catch { return { status: 'unavailable', reason: 'storage-read' }; }
    this.#raw = raw;
    return tripSaveDecode(raw);
  }

  save(value, { replace = false } = {}) {
    const state = tripSaveState(value);
    if (!state) return { status: 'invalid', reason: 'invalid-state' };
    let current;
    try { current = this.#storage.getItem(TRIP_SAVE_KEY); }
    catch { return { status: 'unavailable', reason: 'storage-read' }; }
    if (!replace) {
      const existing = tripSaveDecode(current);
      if (existing.status === 'invalid') return existing;
      // An unobserved occupied slot also needs a load before automatic writes.
      if (this.#raw === undefined ? current !== null : current !== this.#raw)
        return { status: 'conflict' };
    }
    const savedAt = Date.now();
    const { x, z, angle, distance, finished, destroyedCacti } = state;
    const raw = JSON.stringify({ version: 1, route: tripSaveRoute,
      routeLength: ROUTE_LENGTH, savedAt, state: { x, z, angle, distance, finished, destroyedCacti } });
    try { this.#storage.setItem(TRIP_SAVE_KEY, raw); }
    catch { return { status: 'unavailable', reason: 'storage-write' }; }
    this.#raw = raw;
    return { status: 'saved', checkpoint: { state, savedAt } };
  }
}
