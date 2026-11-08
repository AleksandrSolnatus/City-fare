# City Fare — Rising Tide development record

**Started:** 2026-11-08. **Status:** Living experiment, not a claimed speedup or a new game release.

## Original evidence preserved

| Checkpoint | What it is | Exact source | Status |
| --- | --- | --- | --- |
| 002 PRO | Original city/taxi fare game | commit `aa8414fd8ca04da8616ba7570c58fb2d5d545895`; branch `archive/city-fare-002-pro-2026-10-13` | Historical source preserved; currently visible at https://city-fare.pages.dev/ |
| 003–006 | Earlier local design, input, road, road-seam, hill and sound experiments | Owner's original files in `Projects/City Fare` and `_Inbox` on Mac | Referenced by lineage; not represented as uploaded to GitHub |
| 007 Sonoran Run | New third-person desert driving WebGL game and tests | commit `ed7c1101553ba46b3aa6db3f970a9846d25d6e8f`; branch `archive/sonoran-run-007-2026-11-08` | Historical source preserved; offline playable via root `index.html`; **not** the current live site's game |
| 008 work | The next increment, beginning with replay and comparison instrumentation | branch `work/rising-tide-city-fare-008` | Draft development only; no production replacement |

GitHub: https://github.com/AleksandrSolnatus/City-fare

The checkpoint commits above identify exact immutable source states. Archive branches are human-readable pointers to those commits and must **not** be rebased, moved or deleted. Neither snapshot is a new public game deployment.

## Two different comparisons — do not confuse them

1. **Historical, playable comparison:** original taxi-fare game versus third-person Sonoran Run. These have different goals, rules, and rendering engines. They show how the design changed, **not** a controlled speedup.
2. **Rising Tide retained-versus-fresh experiment:** for a *narrow, identical* task, compare an implementation using a retained 007 model/source/tests against an independent fresh approach. Fix the task, constraints, budget, environment, evaluation criteria, and validation method in advance. Measure coding/testing effort, quality, regressions, compute time and rework. Save failures, not only wins. Do not redo the entire game merely to manufacture a control.

A more important question than “Is the new build better?” is “**What did keeping verified work let us accomplish, and what did it cost to keep it?**” The answer may be negative.

## Repeatable physics replay

The new script `tools/rising-tide-bench.mjs` imports the actual `dist/road.js` model. It does not use a substitute copy of the equations.

Run:

```sh
npm test
npm run benchmark > rising-tide-replay.json
```

The benchmark uses a fixed 1/60-second step, with four prescribed cases: departure, brake-and-relaunch, slalom, and a synthetic start in the desert. It checks odometer monotonicity, bounded steering position, finite state and speed, then records traveled distance, maximum speed, road departure percentage and endpoint coordinates. The replay test requires identical results for identical code and inputs.

**What these numbers do not prove:** actual browser FPS, WebGL stability, mobile touch behavior, subjective car handling, road or mountain appearance, hours of uninterrupted play, or engineering effort saved. Only physical play-testing and separately logged work effort can evaluate those.

## Log for every new increment

- **Question and exact change:** one primary improvement per increment; e.g. “Does this steering/camera revision make the coupe feel more responsive without destabilizing the road?”
- **References:** base commit, new commit/PR, reused artifacts and original version; each attempt kept distinct.
- **Controls:** identical physics-replay inputs, device/viewport, browser, test steps, work budget and environment where comparable.
- **Results:** existing tests, new tests, replay JSON before/after, screenshots or recording where available, measured performance if captured, subjective play-test notes and failed checks.
- **Work:** actual implementation/debugging/test elapsed time, tool or compute cost when measured, iterations and lines/files changed; use `not measured` rather than invented numbers.
- **Verification:** author self-check versus independent reproduction; precise outstanding uncertainties; no “verified” without independent evidence.
- **Decision:** retain, revert, revise, or compare with a fresh candidate. Never erase a failed attempt.

## First 008 question

**Can we improve the perceived grip, steering return and chase-camera readability of the current coupe without erasing the road, car identity, mountain rendering or the controls already working?**

Order:
1. Preserve baseline 007 exactly (completed).
2. Add repeatable replay/CI instrumentation (in progress).
3. Play the archived 007 on desktop and phone; record a small list of real handling problems.
4. Adjust *one* parameter or camera behavior on the work branch; replay the four cases and inspect the visual result.
5. Record retained work, tradeoffs, failures and the checks; only then ask whether to promote a version to the original City Fare address.

## Boundaries

- Keep `main` and https://city-fare.pages.dev/ unchanged until the owner explicitly approves a production replacement.
- Preserve 002 PRO, all available 003–006 original files, 007 and future checkpoints; never silently collapse distinct versions.
- No drift into other Bridges/Quark websites; City Fare only.
- Proof Wall may later *display* verified receipts and comparisons. It is not the game host, the source of truth for builds, or a reason to declare success.
