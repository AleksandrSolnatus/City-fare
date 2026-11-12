# City Fare 009 — Sonoran Unbound: review packet

**Status:** draft implementation for independent review. Owner authorized work in the existing City Fare repository, not merge or public deployment.
**Home:** City Fare remains its own playable browser product and repository. Bridges Group can showcase it as a learner/demo after review. Squid Inc.'s underwater consent-and-diplomacy game and Outside In's mathematical toys stay separate. No files were changed in those projects.

## Gameplay contract

- 2,200 integrated miles remain the original finish condition. Any direction counts travelled distance. No navigation solver or forced road-following.
- The 32-metre hard lateral clamp is removed; the car can drive far into the desert. The renderer shifts its near-car terrain strip in 2,200-metre bands, while keeping a stable procedural terrain height function.
- Cactus objects are deterministic, stable-ID records from `road.js`; the road renderer and swept-circle collision checker use the **same** generated records. Impact registers once, trims some speed, removes the object in the current session and emits a short green-fragment/dust effect. A small optional synthesised "pop" uses the already opt-in sound system.
- At speed, the active rear wing visibly rises. Pausing offers **Auto wing**, **Low drag**, and **High downforce**. Geometry and model use the same wing setting. The HUD presents surface, wind speed and wing deployment.

## Equations and deliberate approximations

SI units: car 1,250 kg, air density 1.2 kg/m³, engine maximum 560 kW.

- Apparent longitudinal airflow = vehicle forward speed − local wind projected onto vehicle heading. The deterministic wind field is a smooth function of world `(x,z)`, so repeated runs are reproducible.
- Dynamic pressure `q = 0.5 * airDensity * apparentSpeed²`
- `drag = q * (bodyCdA + wingCdA * wingSetting)`, projected onto the forward direction.
- `downforce = q * (floorClA + wingClA * wingSetting)`.
- Available lateral acceleration is approximated by `mu(surface) * (g + downforce / mass)`; desired yaw rate is capped by lateral acceleration / speed.
- Longitudinal acceleration is `(availableDriveForce - drag - rolling/sand resistance) / mass`. Above low speed, drive force is also limited by engine power divided by speed. Sand has lower grip and greater speed-dependent resistance.
- 145 m/s is a numerical safety ceiling, **not** the target speed. Equilibrium between power and resistance should ordinarily occur well below it. Any 240–260 mph figure is a *design target*, not an instrumented result.

This is a bounded **arcade model**, not CFD, a differential tire-force model, real vehicle homologation, or a claim that a race car can safely strike a cactus.

## Save compatibility

The original `cityFareTrip:sonoran-007:v1` browser key, route identity, 2,200-mile length, stale-tab detection and deliberate restart remain. Version 008 records without the optional `destroyedCacti` field load with an empty set. The new field is a bounded, validated list of stable IDs (10,000 maximum). Old saves are not silently replaced on load; a normal save writes the additive field.

The car resumes stationary and with controls released. Browser/site-origin isolation, denied/full storage behavior and best-effort cross-tab conflict limits remain.

## Build and validation

```sh
npm test
npm run build
git diff --exit-code -- index.html
```

The root portable `index.html` and separate source files should be identical after the bundler runs; the numbered `City-Fare-009.html` is a locally generated copy and is gitignored. Node tests cover prior route/lifecycle/save behavior plus wind, wing modes, off-road movement, deterministic cacti, swept collisions, one-shot destruction, and legacy-save compatibility.

**Not yet established by Node tests:** WebGL scene quality, causal sense of speed, sound quality, frame rate or terrain-band pop on physical iPhone Safari, any full-trip run, actual 240–260 mph top speed under all wind/terrain conditions, or public deployment quality.

## Manual acceptance for Root / owner

1. Compare 008 checkpoint before and after opening 009; confirm same position, heading and mileage. Reload and ensure stationary restoration.
2. On desktop and physical iPhone Safari: leave pavement, drive past former 32m edge; return without clipping/invisible wall; traverse a 2,200m terrain band.
3. Hit a close and distant cactus at low/high speed; verify the correct cactus vanishes, particles appear, speed changes, sound is optional; pause/reload and confirm it stays gone.
4. At comparable speeds, switch Low drag and High downforce in Pause. Compare acceleration and cornering response as well as visible spoiler deployment. Don't infer realism from the HUD alone.
5. Check resize, landscape and portrait touch controls, reduced-motion mode, idle tab and pagehide saving, storage denial, and simultaneous-tab conflict.
6. Independent Root review records failures with reproduction steps and checks the Git diff; separately authorize any merge or production deployment.

No modification of Squid Inc., Outside In, Bridges Group site or existing production City Fare is requested by this PR. PR #3 archive/benchmark remains separate.
