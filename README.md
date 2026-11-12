# City Fare · Sonoran Unbound (009 draft)

A small, offline-capable race-car and **learn-by-driving** experiment set in the Sonoran desert. Race through an open procedural landscape, leave the highway, strike a cactus for a brief green/dust poof, and feel how wind, downforce and surface grip change the car. The original **2,200-mile accumulated-distance journey** and browser-local save/resume remain intact.

**Release boundary:** version 009 is a draft under review, not an approved production release. Existing City Fare production and historical 002/007/008 work remain separate.

## Play and build

Requires a modern WebGL-capable browser. Use the portable root `index.html` (same-origin local serving is recommended for reliable saves), or run a local development server:

```sh
npm run dev
npm test
npm run build
```

There are no third-party runtime dependencies. `npm run build` creates the portable root `index.html` and a gitignored `City-Fare-009.html` copy, using `dist/aero.js`, `dist/cactus-ledger.js`, `dist/road.js`, `dist/renderer.js`, `dist/trip-save.js`, `dist/game.js`, `dist/index.html` and `dist/style.css`. GitHub Actions checks test and bundle consistency on pull requests.

## Drive

**W / Up** accelerates; **S / Down / Space** brakes; **A D / Left Right** steer. **P / Escape** pauses; **C** swaps chase camera; **R** asks before restarting. Mobile touch driving controls remain. Reduced camera motion, gentle steering, lower resolution and optional generated audio remain available from Pause.

- **Open desert:** the old ±32-metre boundary is removed. Sand has less traction and greater resistance, but is fully drivable. A procedural terrain band follows the car as it roams.
- **Cactus poof:** visible cacti are generated from stable shared records. A swept collision test catches fast crossings, including the 12m overhang at the end of a cactus-owning chunk. Each hit takes a small amount of speed, hides that cactus and emits lightweight green/dust triangles. If sound is enabled, an impact pop plays. Destruction is remembered in this browser's trip checkpoint.
- **Faster race car:** an active rear wing, a low-profile rear spoiler and diffuser, and an arcade aerodynamic model replace the flat 180-mph cap. The chosen power/drag values target a substantially faster paved-road equilibrium; the numerical safety limit is not a speed promise.
- **Physics experiment:** Pause offers **Auto wing**, **Low drag** and **High downforce**. The selected wing geometry changes drag and available grip; wind comes from a deterministic field rather than random frame-by-frame nudges. Driving HUD shows surface, wind and wing state.

The simplified equations use metres, seconds, kilograms and newtons. They are intended to make mathematical cause and effect visible, not reproduce a measured race car. See [the 009 review packet](docs/SONORAN-UNBOUND-009-REVIEW.md) for equations, constants, limitations and test steps.

## The journey and checkpoints

The 2,200 miles are integrated physical travel, including turns and off-road exploration. A local checkpoint attempts to save every 15 simulation seconds, on pause, page backgrounding, explicit return to title, and completion. A resumed car is always stationary. Time outside the tab never adds mileage. The 2,500-metre ending fade and completion screen remain.

Version 009 keeps the original `cityFareTrip:sonoran-007:v1` local-storage key so **008 saves can open without a destructive migration**. Older 008 checkpoints load without cactus history; earlier 009 ID arrays load unchanged until a new save. New saves store a compact per-chunk cactus bitset, preserving all destroyed objects even beyond 10,000 hits, with unusual older IDs separately retained rather than silently discarded. Save data belongs to the same browser and web origin; it does not transfer automatically between local files, preview addresses, production addresses, browsers or devices. Clearing site storage deletes the drive. Storage errors are shown rather than concealed; cross-tab conflict detection remains best-effort.

## Source layout and validation

- `dist/aero.js` — repeatable wind, selectable wing, air-relative drag and downforce, power/traction/rolling losses.
- `dist/cactus-ledger.js` — lossless 60-bit per-chunk destruction masks, legacy ID-array compatibility and validation.
- `dist/road.js` — deterministic road/terrain, free driving physics, shared cactus records, swept contacts, odometer.
- `dist/renderer.js` — native WebGL terrain, car/spoiler, cactus geometry, dust and timed poof triangles.
- `dist/game.js` — keyboard/touch interaction, learning HUD, sound and pause lifecycle.
- `dist/trip-save.js` — route-scoped checkpoint validation and durable event IDs.
- `tests/...` — Node route, aero/cactus, checkpoint and lifecycle regressions. Real device/browser behavior is a separate gate.

No full-distance run, measured top speed, physical iPhone acceptance, or production WebGL validation is claimed by the code tests. A draft GitHub PR permits independent review; **do not merge or deploy without owner authorization.**

## Lineage and project home

City Fare 002 PRO and Sonoran Run 007 have preserved historical checkpoints in Git. Sonoran Save 008 added resume and on-device state protection; this 009 draft builds on that version. The archive/benchmark work in draft PR #3 remains separate. The independent City Fare repository is the canonical source for this game. Bridges Group can feature an approved City Fare build as a public educational demo; Squid Inc. remains its own underwater autonomous-logic/diplomacy project, and Outside In its own toy laboratory. Sharing ideas does not merge records or original projects.
