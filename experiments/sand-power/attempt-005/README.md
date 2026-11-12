# CITY FARE · Sand Power 005 — review checkpoint

**Stopped at Amar's request. Movement is broken in the owner's playtest. This is an unfinished review snapshot, not an accepted game.** Automated checks passing below do not establish enjoyable or correct player-facing movement. No further implementation is authorized until Amar returns with a plan.

Open `City-Fare-Sand-Power-005.html` offline. Intended controls: W/Up forward, S/Down backward, A/Left left, D/Right right, Shift boost, Space brake, hold E to dive and release to rise, P pause. Touch buttons mirror these inputs.

The final requested direction is: more speed; direct WASD regardless of the worm's current shape; moving prey to hunt; head-first entry/emergence; keep the dark armour and ivory-spike design that grew on Amar, with room for modest refinement. Earlier requests for a friendlier redesign were superseded.

## What is here

- `body.js`: 240 Hz tissue simulation plus explicitly authored, bounded contact traction targeting world-aligned movement. Nominal targets are 4.2 model units/s, or 6.5 with boost. The 200 m scale and km/h display are illustrative. No input targets rest. This is arcade control, not a claim of biological propulsion.
- `view.js`: retained 004 armour, fixed world camera, actual section-height gradients orienting the head/body into and out of sand, plus moving prey geometry.
- `hunt.js`: five deterministic sand skippers that flee, are caught by exposed body contact and respawn. The last applied fix checks all exposed sections rather than letting a nearer buried section mask a catch.
- `app.js` and `template.html`: keyboard/touch mapping, pause, hunt HUD and diagnostic export. Export includes input history, settings, final body/depth state and prey state. There is no import/resume UI or automatic save.

## Review first

1. Reproduce the owner's movement complaint in the browser. The precise trigger and expected response were not captured before the requested stop; do not invent a diagnosis.
2. Inspect the relationship between key axes, fixed camera, whole-body traction, body orientation and visible head motion. A numerical direction test is not a movement-feel test.
3. Return a bounded plan with explicit acceptance examples and room to explore. Keep implementation paused until Amar returns.

For a cheaper read-only review, start with this README, then `app.js`, `body.js`, `view.js`, `hunt.js`, and the focused tests. Use 003/004 only where a comparison helps. The standalone HTML repeats those sources and need not be reviewed a second time.

## Checks already executed before stopping

`python3 build.py` rebuilds the single-file game; `npm test` runs the local suites without runtime dependencies. The eight mechanics/rendering groups, eight direct-movement groups (including 32 direction/body-heading cases), lifecycle/export replay and hunt checks passed before the stop. The final hunt fix was followed by its focused regression and lifecycle replay checks, not another full suite.

Independent Counsel identified the overlapping exposed/buried catch defect; Root applied its exact regression case and correction. Final independent confirmation of that correction was interrupted by the owner's stop. Counsel also completed frozen-render and coordinate/pitch probes. These findings are bounded code evidence, not approval of the failed playtest.

Root's Chrome smoke test used W, Shift+W, A, S and E, travelled 323 illustrative metres and counted two catches. This did not establish acceptable movement. Final responsive/device testing and final packaging were unfinished when work stopped. Physical phone, Safari, real multitouch and audio quality remain unverified.

## Provenance

Local starting commit: `5f9ce25c4defa427cd44b6c63f63e552047fecb9` (003). Published experiment baseline: `81794ff917be89b9cd5e405b32477cc0ff9d9681` (002). 004 is preserved as the intermediate speed/design trial; 005 is the current stopped state. Earlier attempts and the reviewed car gameplay remain unchanged. This branch is for a draft review PR; no production merge or deployment is requested.
