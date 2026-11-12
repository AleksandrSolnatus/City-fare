# CITY FARE: Sand Power — Close Ride 002 (preserved)

This folder preserves the original **002 standalone offline HTML** and the corresponding exact editable source, extracted from its three inline scripts. The HTML is playable offline without a network connection or dependencies.

**Exact 002 artifact SHA-256:** `0c9fb81a579541807483128928a3bd1c757d88bcb0d3a520de9f0f8a6e438092`.

To reproduce the original offline artifact without overwriting it:

```sh
cd experiments/sand-power/attempt-002
python3 build.py
# Produces REBUILT-City-Fare-Sand-Power-002.html; stops if SHA differs.
```

001 is independently preserved in `../attempt-001/` and untouched. 002 uses the **identical original body mechanics** but changes the camera and scale cues: close / wide / study views, landmark on/off, and a near body composition. The original comparison is **not** a new gait or true excavation.

**Original user feedback on 001:** camera too far away; fast speed feels slow; worm needs massive-scale landmarks; investigate deliberate dives/emergences vs lateral effort. 002 addresses only camera/scale, deliberately holding motion state and physics constant.

**Prior review evidence:** the authoring-session report recorded 14 mechanics checks, 9 camera/view checks, 20 Chromium interaction checks passing. These claims refer to the previous session's ZIP receipt and browser probes, not rerun GitHub CI on this commit. Screenshots, raw browser traces and the full QA receipt remain in the originally exported `CITY_FARE_SAND_POWER_MOTION_002.zip`; this Git copy includes only what is required to play/rebuild 002. Root should independently verify rather than treating old checks as current acceptance.

**Next Root job:** Use 001/002 as frozen baselines, test 003 as a *new* append-only folder. Compare a lateral-dominant whole-body gait with purposeful dive/emergence under the same scale cues; do not animate a head while bypassing body contact. Report subjective feel separately from deterministic mechanics. Preserve 001/002, branch history, historical saves, original car PR and hosted preview. Do not merge or deploy without explicit approval.

**Project:** `AleksandrSolnatus/City-fare`, experimental branch `experiment/sand-power-worm`. The private Cloudflare/Vercel or existing CITY FARE production build was not modified by this filing.
