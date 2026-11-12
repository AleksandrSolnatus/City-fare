# CITY FARE: Sand Power — Research 001

Date: 2026-11-12. **Research and disposable numerical probes only; no game implementation, merge, release, deployment or preview replacement.** Additive to Motion Lab 001. The reviewed car remains a separate baseline at `3f5149f2e6c52575472da741139298062a38469f`.

## Recommended hypothesis

Try an original worm approximately **200 m long and 20 m wide**, with 120 m and 300 m comparisons. These are test scales, not canon or biological claims. Use an active travelling lateral body wave, responsive steering intent, distance-preserving body geometry, and a separate continuous vertical trajectory for diving and emergence. The animal should move sand into shoulders/berms and leave a landscape that slumps and remains changed, rather than only spawning dust.

Retain a tiny rider for scale and human purpose. Directly controlling the worm does not require a walking, climbing or inventory system. A full dive needs an explicit fictional rider refuge; an exposed person on the back would be buried. Proposed design: a shallow protected riding recess closes under overlapping dry dorsal plates during a dive. This is a fiction rule, not a biological or safety claim.

## Literature and reuse

- Sandfish experiments show head-to-tail travelling lateral body undulation during subsurface locomotion. Active undulation is a stronger starting reference than dragging a passive chain behind a translated head. Small-animal experiments do not validate giant-animal scaling. [S1,S2]
- Granular intrusion resistance depends on depth, packing, shape and speed regime. Low-speed friction-dominated laws cannot simply be applied to a huge, fast fictional worm. [S2,S3]
- Intruder shape changes vertical lift in sand; head pitch and a broad tapered burrowing profile are useful original design hypotheses. [S4]
- Dune slip faces avalanche. USGS describes common repose angles around 30–34 degrees with material dependence. The probe's 32-degree rule is authored and uncalibrated. [S5]
- Real singing/booming sand offers an original later sound direction. No recordings were auditioned, downloaded or used. [S6]
- MPM is a richer particle/grid representation reference, not a phone-browser performance promise or a requirement for the first trials. [S7]

Earlier internal sand work was read-only context: reuse conservative transfers, shared geometry, explicit checkpoints and testable representation limits. Its heightfield does not contain actual tunnels or grain contacts. Do not import private saved states or treat earlier failed grain-contact settings as validated. The private companion source map remains outside this public repository.

## What the probes establish

`probes.py` and `dive_probe.py` are local numerical studies, not playable game builds. Python 3.10+ and NumPy are required. The executed environment was Python 3.13.5 / NumPy 2.3.5.

Run in a disposable copy:

```sh
python probes.py
python dive_probe.py
```

They write `results.json` and `dive-results.json` beside the scripts. They use no network, City Fare imports or live storage. Preserve committed records; rerun to a disposable directory rather than overwriting this research snapshot.

### Body shape

Across 288 size/amplitude/phase samples, adding sideways sine offsets to fixed longitudinal positions increased body length by approximately 2.42%, 9.24% or 32.06%, depending on amplitude. Equal-length tangent integration retained segment lengths to floating-point roundoff. This is a narrow geometry result, NOT a locomotion or self-contact test.

A fixed time delay selected for a 200 m worm at 24 m/s produces a 100 m trail at 12 m/s and a 300 m trail at 36 m/s. Distance-based spacing avoids that particular rubber-body effect. A distance-following chain alone is still not a propulsion model.

### Surface redistribution

A 96×96 grid of 2 m cells received 61 authored cut/deposit marks and 240 relaxation steps. Approximately 2,973 m³ was redistributed cumulatively. All values remained finite/nonnegative; the total discrepancy was zero at the tested floating-point summation precision, the JSON round-trip was exact, and the repeated run matched. The largest tested neighbour slope relaxed from about 36.94 to 32.00 degrees.

A separate 1D eight-second relaxation comparison at 30/60/120 simulation steps per second conserved its represented area; 60-versus-120-step final heights differed by about 1.17 mm. These results certify neither physical avalanche timing nor rotational invariance. No grain momentum, buried-body occupied volume, tunnel or browser performance was simulated.

### Dive geometry

A prescribed 200 m centreline with 64 segments followed one continuous 3D path through a mathematical dune. An emergence snapshot had 42 proxy rings buried, 11 crossing the surface, and 12 above it. The body must not switch visibility or teleport as a single object. Maximum resampled segment chord error was about 0.0053% in this fixture. An exposed rider marker was below the surface in 47/144 inspected frames: a full-dive riding rule is required.

These are prescribed kinematics and vertical-radius proxies, not granular forces or exact inclined-body intersections. No self-collision or gameplay enjoyment is established.

## Scale and camera

At a held comparison speed of 24 m/s (86.4 km/h):

| Length / diameter | One body-length travel | 90-degree turn at radius 0.6 lengths |
|---|---|---|
| 120 / 12 m | 5.0 s | 4.71 s |
| 200 / 20 m | 8.33 s | 7.85 s |
| 300 / 30 m | 12.5 s | 11.78 s |

These calculations expose the responsive-head / slow-completing-body tradeoff; they do not choose the best size.

Proposed reveal: begin near a cloaked rider on an apparent ridge; withdraw the camera as the ridge moves and reveals the animal. Let the person become a speck briefly, then move to an elevated rear-quarter view near the forward body. Include skip and a restrained-motion alternative. Do not permanently park the camera behind the entire 200 m tail.

A pinhole estimate for a 1.8 m rider, 720 px viewport height and 55-degree vertical FOV gives 13.8 px at 90 m versus 3.1 px at 400 m. That is not a rendered-phone test. Keep the horizon stable and use intended movement rather than each individual body oscillation to drive camera motion.

## Sand/body architecture question

Candidate: reproducible dune field plus sparse persistent deltas, a 3D segmented animal, and a local conservative bulk-sand patch. Separate sand transported into lasting berms from the volume temporarily occupied by the body. Do not double-count overlapping rings or make cosmetic particles create material. Use swept body geometry, not only endpoint/head collisions.

A heightfield cannot retain tunnels, overhangs or arbitrary cavities. Exterior-only subsurface travel with collapsed passage behind the animal may suffice. Any persistent underground architecture needs its own volumetric study. The existing surface probe does not solve this coupling.

## Next bounded studies

**002 / Body and contact:** compare passive path-following, active curvature-wave and hybrid motion on one plain dune. Measure length, self-intersections, head response, burial continuity and contact classification. Resolve body occupancy before enabling sand transport. No art pass.

**003 / The scar:** replay one fixed body sweep; separately account for sand transport, temporary body occupancy and settled terrain. Test repeated passes, zero movement, reverse travel, tile seams and exact saved restoration. Do not introduce an arbitrary history cap that makes a later valid state unsavable.

Only then use a small interactive encounter to judge fun. Numbers cannot establish that. No new large build is authorized by these notes.

## Preservation

This folder is append-only; future changes belong in `research-002/`. Retain exact source, settings, outputs, checksums and failure limits. Research is distinct from playable attempts, which should preserve offline source and standalone builds. No change to `main`, PR #5, production City Fare or the protected car preview.

## Public sources, consulted 2026-11-12

S1. Maladen et al. (2011), Mechanical models of sandfish locomotion reveal principles of high performance subsurface sand-swimming. DOI 10.1098/rsif.2010.0678. https://physics.gatech.edu/node/1901 and https://pubmed.ncbi.nlm.nih.gov/21378020/

S2. Ding et al. (2012), Mechanics of Undulatory Swimming in a Frictional Fluid. DOI 10.1371/journal.pcbi.1002810. Full text: https://pmc.ncbi.nlm.nih.gov/articles/PMC3531286/

S3. Johns Hopkins Terradynamics Lab, Physics — Granular Intrusion Forces. https://li.me.jhu.edu/physics-granular-intrusion-forces/

S4. Ding, Gravish & Goldman (2011), Drag Induced Lift in Granular Media. DOI 10.1103/PhysRevLett.106.028001. Abstract: https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.106.028001

S5. USGS, Geology of Great Sand Dunes National Park. https://www.usgs.gov/geology-and-ecology-of-national-parks/geology-great-sand-dunes-national-park

S6. US National Park Service, Sound Library — Singing Sands. Page inspected; audio not auditioned. https://www.nps.gov/subjects/sound/singing-sands.htm

S7. Walt Disney Animation Studios, Matterhorn. https://www.disneyanimation.com/technology/matterhorn

A Journey sand-rendering talk page was located but could not be fetched reliably; no claim relies on the unseen talk. Private source reports remain in their original locations and are not republished here.
