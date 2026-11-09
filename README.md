# City Fare · Sonoran Run

A fast car and an Arizona-inspired desert. Minimal native WebGL shapes, a low orange sun just before dusk, distant mountains, a future skyline, and 2,200 miles to cover. The coupe uses steel and gunmetal surfaces with restrained cyan underglow and warm rear light halos.

## Play offline

Download and extract this repository, then open the root `index.html` in a modern browser with WebGL support. The game is self-contained: no installation, server, account or internet connection is required.

To regenerate the standalone game from the existing sources, run `node tools/bundle.mjs` from the repository root with Node.js installed. This writes the same self-contained **008 — Sonoran Save** build to `index.html` and `City-Fare-008.html`; the numbered copy is excluded from Git. No dependency installation is needed.

For local development, run `npm run dev` (requires npm and Python 3), then visit `http://127.0.0.1:8766`.

## Drive

W / Up accelerates; S / Down or Space brakes; A D / Left Right steer. P / Escape pauses. C changes camera; R opens the restart confirmation. Touch controls are available on small or coarse-pointer screens. Enable optional electric-motor audio in Pause; adjust volume there. Gentle steering, reduced camera motion and lower resolution are available.

The car tops out at approximately 180 mph. A light peripheral blur fades in above 70 mph and the camera gently widens with speed; reduced motion disables both. Driving distance is integrated from speed in metres per second and simulation seconds, then converted with 1 mile = 1609.344 metres. Completion is an odometer challenge: all driven distance counts, including turns and off-road travel. Exactly 2,200 accumulated miles ends the drive. At full speed, the trip takes over 12 hours; the saved drive lets that journey span sessions.

The last 2,500 metres gradually fade the scene; completion presents a quiet end screen and restart button. The skyline is a stylized progress cue whose apparent distance shrinks, not an accurately simulated urban map.

## Save and resume

008 keeps one drive in this browser's local storage. It attempts a checkpoint every **15 simulation seconds**, when you pause, when the page loses focus or goes into the background, when you choose **Save & return to title**, and on completion. The pause and completion screens display the save status. A completed trip stays completed after reloading.

The title shows the saved mileage and a **Resume drive** button. Resuming restores the exact saved world position, continuous heading and accumulated odometer, including off-road or backward-facing travel. The car starts stationary with zero steering and released controls. Time spent away from the page adds no miles. Choosing a new drive, pressing R, or restarting after completion opens a confirmation before replacing the saved trip.

Saves belong to the same browser and origin (the same scheme, host and port); they do not sync between devices, browser profiles or different addresses. Clearing site data removes both the drive and preferences. Storage for directly opened `file:` HTML depends on the browser; serving the game at the same local address gives it a consistent origin. Abrupt browser shutdown can miss a final checkpoint, so **Save & return to title** provides an explicit save result before leaving.

Malformed or incompatible saved data is left intact during automatic saving; the interface offers a deliberate new start. If storage is denied or full, the game reports that progress could not be saved and remains playable in the current tab. A reload may then return to an older checkpoint. Best-effort stale-tab protection compares the stored record with the last loaded or saved value and watches storage-change events: a conflicting tab pauses and offers **Reload saved drive**. This is not an atomic lock across tabs, so simultaneous writes cannot be fully excluded.

## Implementation

- `dist/road.js`: deterministic quintic road anchors and metre/second vehicle dynamics.
- `dist/renderer.js`: lightweight polygon meshes, perspective projection, depth, haze and dust. Nearby terrain chunks are created on demand and discarded when distant. Chunk-local coordinates avoid floating-point jitter over the long trip.
- `dist/trip-save.js`: versioned, route-checked local checkpoints, validation, stationary restoration and stale-tab checks.
- `dist/game.js`: controls, fixed-step timing, save/resume lifecycle, session state and synthesized audio.
- `dist/index.html`, `dist/style.css`: minimal responsive interface.
- `tools/bundle.mjs`: combines those exact sources into the portable HTML.

Run `npm test` for focused driving/distance and save/restore checks. All 19 tests pass for this revision, covering the unchanged road behavior plus checkpoint round trips, invalid records, completion, storage errors and stale-tab conflicts. Run `node tools/bundle.mjs` after source changes.

## Lineage and scope

Evolves owner-supplied City-Fare-006 controls, metre/second timing and audio lifecycle, with the visible vehicle identity informed by 003. Earlier versions 003, 004, 005A, 005C and 006 remain untouched locally. Sonoran Run 007 changed the authored repeating road to generated sections, extended the run to 2,200 integrated miles, and gave the vehicle a minimal futuristic appearance. Revision 008 adds local save/resume and deliberate restart controls; `road.js` and `renderer.js` are unchanged.

Chrome and Safari rendered the first chase-camera build. Desktop input was exercised; 390 × 720 and 844 × 390 embedded layouts were visually inspected. The dusk/gunmetal Sonoran build also rendered in Chrome; later Sonoran changes received syntax and focused distance/finish checks. Browser QA for 008's save/resume interface is pending because a local preview was unavailable in the implementation environment. Physical phone performance, multitouch hardware, a full 12-hour drive and the subjective new sound have not been verified. WebGL support is required. Scenery is decorative, with soft lateral driving bounds rather than prop collision simulation. Slow frames can lose simulation time to preserve stable controls. Control/display preferences and one driving checkpoint persist locally when browser storage is available.

Only City Fare is in scope. This local build and a Git branch do not establish public deployment or a change to the existing City Fare address.
