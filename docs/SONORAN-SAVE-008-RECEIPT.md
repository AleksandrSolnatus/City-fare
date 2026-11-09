# City Fare — Sonoran Save 008

Date: November 8, 2026 (America/Phoenix).

## Work authorized

Amar asked QUARK to find the game and work on something. The recent City Fare
trail and current GitHub source identified Sonoran Run as the existing game.
This bounded improvement adds resumable progress to its 2,200-mile drive.

## Source and custody

- Repository: `AleksandrSolnatus/City-fare`.
- Base commit: `ed7c1101553ba46b3aa6db3f970a9846d25d6e8f`.
- All 11 original source files were matched to their GitHub Git-blob hashes
  before editing. An older workspace copy differed and was replaced in this
  isolated working directory with the exact remote source.
- Feature branch: `work/sonoran-save-resume-2026-11-08`.
- Review: <https://github.com/AleksandrSolnatus/City-fare/pull/4>.
- Application source commit: `9a9533c0545272a77480928063bf468c9e813958`.
  The later verification commit adds lifecycle tests and documentation without
  changing the game bytes.
- `dist/road.js` and `dist/renderer.js` are unchanged from the base. The existing
  archive/comparison PR #3 is separate and was not modified or merged.

## Result

The game now keeps one local checkpoint and offers Resume drive with saved
mileage. It restores the exact position, yaw and integrated odometer while
parking the car and releasing all held controls. Time away from the page does
not advance the trip. Completion survives reload. Every restart entry point
opens a confirmation before intentionally replacing the saved drive.

Checkpoints are attempted every 15 simulation seconds, on pause and background
events, on explicit Save & return to title, and at completion. Failed writes
are reported. Malformed or incompatible records are retained until explicit
replacement. Stale-tab detection uses the loaded raw record plus storage events;
it is best effort, because localStorage has no atomic compare-and-swap.

An independent source review found a transient-read failure that could discard
the cached trip and later overwrite it with a fresh one. The implementation now
retains the last valid checkpoint when re-reading fails, and a dedicated
lifecycle test covers that sequence. Restart-cancel focus was also corrected.

The bundler now updates root `index.html` as well as the ignored numbered
`City-Fare-008.html`, avoiding a stale root game after source changes.

## Checked evidence

- **25 tests passed, zero failures**: 10 existing road/vehicle tests, nine
  storage tests and six lifecycle regressions. The actual local test output is
  retained in `evidence/2026-11-08-sonoran-save-tests.txt`.
- The lifecycle tests run actual game/road/save code with small DOM, renderer,
  frame and event doubles. They are not browser or rendering tests.
- The generated standalone script parses successfully and includes TripSave.
- The first GitHub Actions run passed the 19 tests present in the application
  commit, rebuilt the game and confirmed root `index.html` matched its sources:
  <https://github.com/AleksandrSolnatus/City-fare/actions/runs/42568875334>.
- Cloudflare reported the application commit's preview deployed successfully:
  <https://4b85296f.city-fare.pages.dev>.
- The browser opened the stable branch preview at
  <https://work-sonoran-save-resume-202.city-fare.pages.dev/> and displayed the
  new title/save copy. It then displayed the existing graphics error:
  “This drive needs WebGL.” This browser could not create a WebGL context.

## Verification limits

Visual driving, native-dialog behavior, phone layout, real multitouch and the
save/resume interaction remain unverified in a real browser for 008. A local
browser binary was absent; the managed local preview also stopped before it
could load. Neither attempt is counted as a passed playtest. Physical device
performance and a complete 12-hour journey were not tested.

Saves are specific to the browser and origin. Preview, production, other devices
and different local addresses do not share progress. Clearing browser site data
removes it; an abrupt shutdown may miss the last checkpoint. These are browser
storage limits, not cloud synchronization.

## Release state

The work is preserved in a draft PR and an existing-provider branch preview.
No merge, production replacement, new Site, hosting migration or schedule was
performed. The existing release instructions reserve production replacement
for Amar's separate approval. This receipt records a functional code change,
its checked scope and its remaining browser verification limit.
