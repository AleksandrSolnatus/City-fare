# CITY FARE · Sand Power 003 — Deep Current

Open **City-Fare-Sand-Power-003.html** in Chrome, Safari or another modern browser. It is one self-contained offline file. No installation, account, network assets or runtime dependencies.

Ride a giant teal-and-copper armoured worm through a terracotta desert. Follow amber surface signals and cyan buried signals, or wander. Hold W / Up to surge; A D / Left Right lean; hold S / Down to dive and release to emerge; Space coasts; P pauses. Touch buttons support multiple pointers. Pause offers a surface-only comparison ride, body stiffness, reduced effects, tissue overlay and export. Sound is optional. Ride / Drift / Study cameras share the same simulation.

Signals use the actual centre of mass and current burial state. Their visible halo is the capture radius. There are no prop collisions, terrain excavation or prescribed head trajectories. The 200 m rest-length scale and displayed speed are illustrative, not calibrated animal or sand measurements. A held dive propagates down the 25-section tissue strip; finite local forces move each section, and immersion changes each point's horizontal contact. A short dive may submerge only the front. Emergence restores contact and sheds cosmetic sand; dust is not counted terrain mass.

## Rebuild and check

From this directory:

```sh
python3 build.py
npm test
```

`build.py` assembles the exact editable inputs and writes `build-receipt.json` with their hashes and the standalone artifact hash. Tests require Node; the browser game does not. The root repository's `npm test` additionally checks the unchanged car game.

The nine numerical/render groups check partial-diving progression, comparison equality, contact ablation, momentum, force/power budgets, two-minute mixed input, deterministic replay, signal depth gating, rendering non-mutation at three viewports and the offline bundle. The separate lifecycle harness executes the actual app with DOM/frame doubles to check physical-key aliases, pointer cancellation, pause/background/long-frame input release, exact exported replay, fresh comparison runs and isolated diagnostic snapshots. A double is not browser acceptance.

Root exercised Chrome: entry, acceleration, a collected surface signal, dive, emergence and pause. Portrait 390 × 740 and landscape 844 × 390 render at their actual iframe viewport sizes with no horizontal overflow; both drove, released input on blur and reported no fatal error. Measured render samples were around 3 ms on this Mac, not a physical-phone performance claim. See `evidence/` for logs and screenshots. Physical iPhone/Safari, real multitouch hardware and subjective sound quality remain untested.

## Evidence and preservation

Origin: `81794ff917be89b9cd5e405b32477cc0ff9d9681` on `experiment/sand-power-worm`; local work branch `root/sand-power-003`.

001 and 002 gameplay sources and standalone 002 are unchanged. The separate 002 checksum repair documents the earlier digest discrepancy and establishes reconstruction of its Git artifact; equivalence to the original exported ZIP remains unresolved. The main car files, PR #5 and historical saves are unchanged.

An independent mechanics contribution identified 002's global burial controller. Builder integrated per-section delayed intents using previous-step values; no centre-of-mass speed multiplier was added. Independent read-only Counsel caught keyboard-alias release, halo radius and comparison-message defects. All three were corrected and independently rechecked; disposition: no remaining blocking finding in the bounded code/test review.

Runs remain in this tab. Export includes input events, settings and final state, including local depth intents and emergence lift. A fresh ride retains earlier runs in the session export. There is no automatic save or import/resume UI. Exported data is diagnostic/replay material, not an independent measurement. A reload starts fresh.

This candidate is an experiment for playtesting. It has not been merged or deployed to City Fare production. Next useful feedback: whether the travelling dive feels intentional, the close camera conveys scale, and steering remains enjoyable on a phone.
