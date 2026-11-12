import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ROUTE_LENGTH, center } from '../dist/road.js';
import { TRIP_SAVE_KEY } from '../dist/trip-save.js';

// Executes the actual game lifecycle and road/save code. DOM, frames and Renderer
// are deliberately small test doubles: these checks do NOT verify browser layout,
// WebGL, native dialog behavior, physical touch input or browser storage events.
const readSource = name => readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8');
const stripModules = source => source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
const lifecycleSource = ['aero.js', 'road.js', 'trip-save.js', 'game.js'].map(readSource).map(stripModules).join('\n');
const gameHtml = readSource('index.html');

function fixture(distance = 4200, z = 1500) {
  return JSON.stringify({ version: 1, route: 'sonoran-007', routeLength: ROUTE_LENGTH,
    savedAt: 1794180000000, state: { x: center(z) + 1.8, z, angle: .23,
      distance, finished: distance === ROUTE_LENGTH } });
}

class TestStorage {
  constructor(raw) { this.values = new Map(raw ? [[TRIP_SAVE_KEY, raw]] : []); }
  writes = [];
  readFailures = 0;
  denyWrites = false;
  getItem(key) {
    if (key === TRIP_SAVE_KEY && this.readFailures > 0) {
      this.readFailures--; throw new Error('Temporary read failure');
    }
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.denyWrites) throw new Error('Quota or permission failure');
    this.values.set(key, value); this.writes.push({ key, value });
  }
  get raw() { return this.values.get(TRIP_SAVE_KEY); }
  get saved() { return JSON.parse(this.raw); }
}

function eventTarget(extra = {}) {
  const listeners = new Map();
  return Object.assign({
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    dispatch(type, detail = {}) {
      const event = { target: this, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, ...detail };
      for (const callback of listeners.get(type) || []) callback(event);
      return event;
    },
  }, extra);
}

function harness(storage = new TestStorage()) {
  const nodes = new Map();
  const document = eventTarget({ hidden: false });
  const makeNode = (tag = 'div') => {
    const classes = new Set();
    return eventTarget({ tagName: tag.toUpperCase(), style: {}, dataset: {},
      hidden: false, disabled: false, inert: false, open: false, isConnected: true,
      textContent: '', innerHTML: '',
      classList: { add: (...values) => values.forEach(value => classes.add(value)),
        remove: (...values) => values.forEach(value => classes.delete(value)),
        contains: value => classes.has(value),
        toggle(value, force) { const enabled = force ?? !classes.has(value); enabled ? classes.add(value) : classes.delete(value); return enabled; } },
      focus() { document.activeElement = this; },
      setAttribute(name, value) { this[name] = value; },
      setPointerCapture() {},
      closest(selector) { return selector === 'button' && this.tagName === 'BUTTON' ? this : null; },
      showModal() { this.open = true; }, close() { this.open = false; },
    });
  };
  for (const match of gameHtml.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const node = makeNode(match[1]);
    node.hidden = /\bhidden\b/.test(match[2]); node.inert = /\binert\b/.test(match[2]);
    nodes.set('#' + match[3], node);
  }
  nodes.set('.controls', makeNode()); nodes.set('.brand', makeNode('a'));
  nodes.set('#camera span', makeNode('span'));
  const driveButtons = ['left', 'right', 'brake', 'gas'].map(key => {
    const node = makeNode('button'); node.dataset.key = key; return node;
  });
  const get = selector => {
    assert.ok(nodes.has(selector), `Unsupported or missing DOM selector ${selector}`);
    return nodes.get(selector);
  };
  document.querySelector = get;
  document.querySelectorAll = selector => {
    assert.equal(selector, '.drive'); return driveButtons;
  };
  get('#overlay').querySelectorAll = selector => {
    assert.equal(selector, 'button,input');
    return ['resume', 'save-exit', 'reload-save', 'sound', 'volume', 'gentle', 'motion', 'quality', 'restart'].map(id => get('#' + id));
  };
  document.body = makeNode('body'); document.body.classList.add('intro');
  document.activeElement = document.body;
  const window = eventTarget({ localStorage: storage });
  const frames = new Map(); let frameId = 0, clock = 100;
  class TestRenderer {
    frames = 0; yaw = null; dust = [];
    resize() {}
    resetWorld() {}
    registerHits() {}
    render() { this.frames++; }
    inspect() { return { renderer: 'test double', frames: this.frames }; }
  }
  runInNewContext(lifecycleSource, {
    window, document, Renderer: TestRenderer, matchMedia: () => ({ matches: false }),
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); }, setTimeout: () => 1, clearTimeout() {},
    location: { reload() {} },
  }, { timeout: 2000, filename: 'actual-city-fare-lifecycle.js' });
  return { storage, window, document, get,
    inspect: () => JSON.parse(JSON.stringify(window.CityFare.inspect())),
    click(selector) { const node = get(selector); assert.equal(node.disabled, false); node.onclick({ target: node, preventDefault() {} }); },
    key(code, type = 'keydown') { return window.dispatch(type, { code, repeat: false, target: document.activeElement }); },
    advance(seconds) {
      for (let i = 0; i < Math.ceil(seconds * 60); i++) {
        clock += 1000 / 60;
        const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(clock));
      }
    },
  };
}

test('the title screen never writes over an existing trip on idle or background events', () => {
  const raw = fixture(), game = harness(new TestStorage(raw));
  game.advance(30); game.window.dispatch('blur'); game.window.dispatch('pagehide');
  game.document.hidden = true; game.document.dispatch('visibilitychange');
  assert.equal(game.inspect().started, false);
  assert.equal(game.storage.raw, raw); assert.equal(game.storage.writes.length, 0);
  assert.equal(game.get('#start-label').textContent, 'Resume drive');
});

test('a transient re-read failure during Resume retains the last valid trip', () => {
  const game = harness(new TestStorage(fixture())), original = game.storage.saved.state;
  // Also cover the title's storage-event re-read failing before the click.
  game.storage.readFailures = 1;
  game.window.dispatch('storage', { key: TRIP_SAVE_KEY, storageArea: game.storage });
  game.storage.readFailures = 1; game.click('#start');
  const state = game.inspect().state;
  for (const key of ['x', 'z', 'angle', 'distance']) assert.equal(state[key], original[key]);
  assert.equal(state.v, 0); assert.equal(state.steer, 0); assert.equal(game.storage.writes.length, 0);
  game.click('#pause');
  assert.equal(game.storage.saved.state.distance, original.distance);
  assert.ok(game.storage.writes.every(write => JSON.parse(write.value).state.distance !== 0));
});

test('R restart cancellation keeps progress and modal focus; confirmation replaces the trip', () => {
  const game = harness(new TestStorage(fixture())); game.click('#start');
  game.key('KeyR'); assert.equal(game.get('#restart-dialog').open, true);
  const preserved = game.storage.raw;
  game.click('#cancel-restart');
  assert.equal(game.storage.raw, preserved); assert.equal(game.inspect().state.distance, 4200);
  assert.equal(game.get('#overlay').hidden, false);
  assert.equal(game.document.activeElement, game.get('#resume'));
  game.click('#restart'); game.click('#confirm-restart');
  assert.equal(game.inspect().state.distance, 0); assert.equal(game.storage.saved.state.distance, 0);
  assert.equal(game.inspect().state.finished, false); assert.equal(game.get('#restart-dialog').open, false);
});

test('denied restart writes preserve old saved bytes and never claim the new run is saved', () => {
  const game = harness(new TestStorage(fixture())); game.click('#start'); game.click('#pause');
  const prior = game.storage.raw;
  game.click('#restart'); game.storage.denyWrites = true; game.click('#confirm-restart');
  assert.equal(game.inspect().state.distance, 0); assert.equal(game.inspect().save.status, 'unavailable');
  assert.equal(game.storage.raw, prior);
  assert.match(game.get('#save-status').textContent, /could not be saved/i);
  game.key('KeyW'); game.advance(1); game.key('KeyW', 'keyup');
  assert.ok(game.inspect().state.distance > 0); assert.equal(game.storage.raw, prior);
  game.storage.denyWrites = false; game.click('#pause');
  assert.equal(game.inspect().save.status, 'saved');
  assert.equal(game.storage.saved.state.distance, game.inspect().state.distance);
});

test('completion writes once, survives reload, and does not award mileage from elapsed wall time', () => {
  const storage = new TestStorage(fixture(ROUTE_LENGTH - .02, 100));
  const game = harness(storage); game.click('#start'); game.key('KeyW'); game.advance(1);
  assert.equal(game.inspect().state.finished, true); assert.equal(storage.saved.state.distance, ROUTE_LENGTH);
  assert.equal(storage.writes.length, 1); assert.equal(game.get('#finish').hidden, false);
  game.window.dispatch('blur'); game.window.dispatch('pagehide'); game.advance(10);
  assert.equal(storage.writes.length, 1);
  const reloaded = harness(storage); reloaded.click('#start'); reloaded.key('KeyW'); reloaded.advance(20);
  assert.equal(reloaded.inspect().state.finished, true); assert.equal(reloaded.inspect().state.v, 0);
  assert.equal(reloaded.inspect().state.distance, ROUTE_LENGTH); assert.equal(storage.writes.length, 1);
});

test('background saving clears input; another tab changing the slot blocks stale resume and writes', () => {
  const game = harness(); game.click('#start'); game.key('KeyW'); game.advance(1);
  game.window.dispatch('pagehide');
  assert.equal(game.inspect().state.paused, true); assert.equal(game.inspect().input.gas, false);
  assert.equal(game.storage.saved.state.distance, game.inspect().state.distance);
  const newer = fixture(9000, 2000); game.storage.values.set(TRIP_SAVE_KEY, newer);
  game.window.dispatch('storage', { key: TRIP_SAVE_KEY, storageArea: game.storage });
  assert.equal(game.inspect().save.status, 'conflict'); assert.equal(game.get('#resume').disabled, true);
  assert.equal(game.get('#save-exit').disabled, true); assert.equal(game.get('#reload-save').hidden, false);
  game.window.dispatch('pagehide'); game.key('Escape');
  assert.equal(game.storage.raw, newer); assert.equal(game.inspect().state.paused, true);
});
