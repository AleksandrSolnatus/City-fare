# City Fare Rising Tide — first automated replay receipt

Date: **2026-11-08**. This is a reproducible **physics/controls simulation** receipt, **not** a human driving-feel acceptance test and not an independent proof of a performance improvement.

## Provenance

- Source repo: https://github.com/AleksandrSolnatus/City-fare
- Frozen 007 model commit: `ed7c1101553ba46b3aa6db3f970a9846d25d6e8f`.
- Retained model file `dist/road.js` blob SHA: `4bf8a5ee7463a5ee4d44361ba84f90d3e6052afc`. Unchanged by the instrumentation PR.
- Instrumentation run head: `139760e6a3f5e814296afacf2e66c5ff8f33c8fb`.
- Workflow run: https://github.com/AleksandrSolnatus/City-fare/actions/runs/42501446426
- Job ID: `128794873386` (check: success).
- Test outcome from job log: **13 tests passed, 0 failed**.
- Replay artifact ID: `13624679646`. Artifact ZIP SHA-256: `dd8e3c427e632451913d48827a3f902414b9116e88c7fc76c020c36389079580`. Scheduled expiry: 2026-12-08.
- **Permanently retained replay output:** `evidence/2026-11-08-007-physics-replay.json`, transcribed directly from the machine-generated JSON printed in the successful job log. Four scenarios, 9,300 total simulated frames at 60 Hz.

## Numerical observations

| Scenario | Seconds | Distance (m) | Maximum mph | Time beyond road-edge threshold |
| --- | ---: | ---: | ---: | ---: |
| Departure, full throttle | 30 | 1764.569357 | 179.998980 | 50.055556% |
| Braking then relaunching | 35 | 1429.858689 | 179.998980 | 57.190476% |
| Slalom | 50 | 2812.752098 | 137.059508 | 84.166667% |
| Synthetic desert start/recovery | 40 | 2095.772320 | 137.059508 | 98.375000% |

This test classifies an off-road frame when the car's center plus car half-width crosses `TUNE.roadHalf` from `center(z)`. It does **not** verify visual road paint, crashes, camera framing, road-following intent or a physical phone.

### What we learned and did not learn

The neutral steering inputs do **not** automatically follow the curved generated road: in the straight-accelerate scenario roughly half the sampled frames are outside the test's road boundary. That is consistent with the model's explicit design of **no lane-follow assist**, not sufficient proof of a game defect. The other test scenarios intentionally steer or begin off-road. Their percentages should not be interpreted as human crash rates.

**Next check:** play 007 manually on desktop and physical phone; then decide whether camera readability or steering guidance should be the first narrow 008 change. Use the same replay for before/after guardrails, and separately record subjective feel. No fresh-vs-retained speedup claim has been tested.

Snapshot refs remain untouched; the live Cloudflare address still serves original 002 PRO. No publication or merge occurred.
