# City Fare · Sonoran Run

A fast car and an Arizona-inspired desert. Minimal native WebGL shapes, a low orange sun just before dusk, distant mountains, a future skyline, and 2,200 miles to cover. The coupe uses steel and gunmetal surfaces with restrained cyan underglow and warm rear light halos.

Open `City-Fare-007.html` directly in a modern browser, or run `npm run dev` and visit `http://127.0.0.1:8766`. No dependencies, accounts, network assets or runtime API calls.

## Drive

W / Up accelerates; S / Down or Space brakes; A D / Left Right steer. P / Escape pauses. C changes camera; R restarts. Touch controls are available on small or coarse-pointer screens. Enable optional electric-motor audio in Pause; adjust volume there. Gentle steering, reduced camera motion and lower resolution are available.

The car tops out at approximately 180 mph. Driving distance is integrated from speed in metres per second and simulation seconds, then converted with 1 mile = 1609.344 metres. Completion is an odometer challenge: all driven distance counts, including turns and off-road travel. Exactly 2,200 accumulated miles ends the drive. At full speed, the trip takes over 12 hours. No progress is saved. A new page load starts at mile zero; pause only holds the current run while this page remains open.

The last 2,500 metres gradually fade the scene; completion presents a quiet end screen and restart button. The skyline is a stylized progress cue whose apparent distance shrinks, not an accurately simulated urban map.

## Implementation

- `dist/road.js`: deterministic quintic road anchors and metre/second vehicle dynamics.
- `dist/renderer.js`: lightweight polygon meshes, perspective projection, depth, haze and dust. Nearby terrain chunks are created on demand and discarded when distant. Chunk-local coordinates avoid floating-point jitter over the long trip.
- `dist/game.js`: controls, fixed-step timing, session state and synthesized audio.
- `dist/index.html`, `dist/style.css`: minimal responsive interface.
- `tools/bundle.mjs`: combines those exact sources into the portable HTML.

Run `npm test` for focused driving/distance checks. Run `node tools/bundle.mjs` after source changes.

## Lineage and scope

Evolves owner-supplied City-Fare-006 controls, metre/second timing and audio lifecycle, with the visible vehicle identity informed by 003. Earlier versions 003, 004, 005A, 005C and 006 remain untouched locally. The latest revision changes the authored repeating road to generated sections, extends the run to 2,200 integrated miles, and gives the vehicle a minimal futuristic appearance.

Chrome and Safari rendered the first chase-camera build. Desktop input was exercised; 390 × 720 and 844 × 390 embedded layouts were visually inspected. Later Sonoran changes received syntax and focused distance/finish checks; physical phone performance, multitouch hardware, a full 12-hour drive and the subjective new sound have not been verified. WebGL support is required. Scenery is decorative, with soft lateral driving bounds rather than prop collision simulation. Slow frames can lose simulation time to preserve stable controls. Only control/display preferences persist locally; driving progress does not.

Only City Fare is in scope. This local build and a Git branch do not establish deployment to the existing Sites entry.
