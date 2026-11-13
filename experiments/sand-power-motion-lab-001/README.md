# Sand Power Motion Lab — unfinished / parked

Preserved research workspace, separate from the City Fare game. No merge or deployment requested. Open index.html locally to explore the schematic; browser storage behavior with file URLs may vary.

## Implemented draft

Fixed-step top-down kinematic worm schematic, motion controls, small rider marker, sand coverage mask, camera following, observation fields, browser-local append-only records, comparison, replay, branching, JSON backup/restore and compact handoff export.

## Evidence and limitations

- JavaScript syntax parse passed.
- Browser interaction tests were attempted but Chromium could not start: process singleton socket operation was denied in the execution environment. No interaction or mobile acceptance claimed.
- Safari/iPhone, persistence, import collision handling, branch relationships, deterministic replay and exports still require verification.
- Changing controls resets the simulation. Replay uses saved parameters and timestep, not a complete action history. Runs stop after 36,000 steps.
- Sand is a visual mask; tracks are temporary. No physical sand, terrain deformation, collisions or validated locomotion physics.
- Records live in browser localStorage; export for backup. No cross-device sync.
- Existing game source and prior offline versions are untouched.

## Next review

Test append/reload/restore, duplicate and conflicting imports, replay consistency, camera and mobile layout. Revisit body length/spacing and frame-rate-dependent perceived speed. Later project direction considers removing the rider and following closer to the head; this preservation retains the original rider-marker draft without applying that change.

Source provenance: saved Sites draft v1, source commit fae16398bf7b34ac69eb8a94b63ce13f354098da (2026-11-12). Hosting configuration intentionally omitted from this archive so this does not bind to or deploy the Site.
