# CITY FARE: Sand Power — numbered experiments

Current local candidate: [003 — Deep Current](attempt-003/README.md), a playable offline ride with travelling dive intent and surface/submerged signals. 001/002 remain preserved baselines. Status: experimental, no production merge or publication.

## Identity
- Product name remains **CITY FARE** (do not rename the main game).
- This candidate edition is **CITY FARE: Sand Power**.
- **Worm only** for this edition: no dinosaur, no multiple competing mounts.
- The creature is original: a great dry desert animal, distinctly not a copy of any existing franchise's creature anatomy, lore, riding equipment, or visual signature.
- Movement through sand must be **fun before anything else**. Spectacle, cinematic sun, effects, story and extra controls follow successful motion tests.
- We make these demos for other people and to learn ourselves. Record what really happened, including failed attempts, without claiming an experiment is a finished release.

## Immutable starting point
Start from independently reviewed City Fare 009 commit `3f5149f2e6c52575472da741139298062a38469f`. The existing production, 009 review PR, archives and Root receipts remain untouched.

## Offline / iteration rule
Make small numbered attempts, e.g. `experiments/sand-power/attempt-001/`, `attempt-002/` and so on. Retain the complete source or reproducible patch, run/test instructions, a short manifest with originating commit, behavior, inputs, observations, failure modes and unresolved issues for every attempt. When a standalone HTML is generated, give it a stable numbered offline filename and retain its source/checksum. Never overwrite an earlier attempt to replace it with a newer experiment. The comparison between attempts is part of the product's learning value. Keep everything in this sandbox branch until the owner separately approves what becomes official.

## FIRST EXPERIMENT: Does riding a huge living wave feel good?

### Rider experience
- Optional short **Call** interaction; a dune bulges, the animal rises, and the view settles into a clearly mounted third-person perspective. Avoid lengthy cutscenes during motion trials.
- Left/right **lean** turns an enormous, delayed body, rather than spinning a car. Forward is **surge**; release naturally coasts.
- One **dive / breach** input alters the creature's depth and the sand wake. The movement continues seamlessly when it dives; no teleport.
- Camera follows ahead of the head and looks toward the horizon; it should not jitter or clip through the animal.
- The creature cannot be mistaken for a slime-coated tube. Use large dry forms and a readable head/tail silhouette. Detailed appearance can wait.

### Proposed testable movement
Use a chain of body nodes following a head trajectory, with finite curvature and delay. Head velocity is tangent to heading, and steering follows a rate-limited angular response. Keep the numerical integrator deterministic at the original fixed timestep.

Use a small tunable set:
- surge acceleration and max speed
- turn responsiveness and minimum turning radius
- body follow lag and segment spacing
- sand depth, wave height and breach dwell
- camera spring and max pitch

A great first test is simply: start moving, carve a broad S, surge, then dive and breach on a dune crest, all from the same mobile controls.

### Acceptance questions (not claims)
1. Is it enjoyable to steer for 60 uninterrupted seconds, even without scenery changes?
2. Can the rider feel the animal's enormous scale **without** sluggish controls?
3. Can we predict and replay the same movement path from fixed input and seed?
4. Does the camera stay comfortable in portrait and landscape on a real phone?
5. Can we save/reload a ride without corrupting or replacing the historical 009 car trip?
6. Can the exact attempt be opened offline from its preserved single-file build?

## Sequence
001: Pure motion silhouette + temporary simple sand surface.
002: Body-wave tuning: compare lag/turn settings; preserve 001.
003: Dive/breach and wake; preserve 001/002.
004: Camera and touch feel; preserve all earlier trials.
005: Dusk lighting and creature art only after motion approval.

No public release, deployment, production swap, PR #5 merge or replacement of the reviewed car preview is authorized by this plan.
