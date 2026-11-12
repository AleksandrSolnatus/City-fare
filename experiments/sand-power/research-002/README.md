# CITY FARE: Sand Power — Research 002
## Whole-body intent, inertia, coloured armour and sand coverage

**Date:** 2026-11-12. **Status:** local research diagnostics only. No game implementation, main/PR #5 changes, merge, deployment or preview replacement. Additive to research-001; not a replacement for its unfinished 3D body/contact study.

## Owner direction recorded

The rider remains a simple scale marker. The fictional protective recess is accepted as a possible solution, but is not the priority for this run. The worm should feel massive without dull or delayed control. Control must coordinate the body rather than merely drive the head, without making the player operate individual segments. Mathematics must correspond to the movement shown. The creature has hard coloured plates, sometimes exposed and sometimes covered in sand.

No palette, biological mass, exact final size or realistic speed is fixed by this note. The 120/200/300 m comparisons from research-001 remain proposals. The contemplated blue-green/copper palette below is an art suggestion, not an owner-selected colour scheme.

## Design recommendation

**The player directs intention and effort; a distributed controller coordinates the body; the environment supplies reactions.**

- **Lean:** bias the body's curvature and balance of contractions. It must not rotate the whole body instantly or push the head along a cursor path.
- **Surge / ease:** change gait effort and eventually power-limited contraction cadence. Show the corresponding contraction wave and retain momentum when effort changes.
- **Dive / rise:** bias a continuous 3D body trajectory and contact pattern. A partial breach must change which body sections can push against sand; do not grant the airborne nose invisible ground traction.

These are a proposed compact control mapping, not controls implemented by this research script. Finite actuation force, torque, power and curvature limits are required before the model can support meaningful mechanical weight. A numerical mass parameter alone does not establish weight or a realistic animal. Responsiveness can begin with a prompt, bounded posture response while momentum takes longer to change.

## Primary references

1. Ding et al. (2012), *Mechanics of Undulatory Swimming in a Frictional Fluid*, DOI 10.1371/journal.pcbi.1002810. https://pmc.ncbi.nlm.nih.gov/articles/PMC3531286/ — models sandfish propulsion through body undulations and distributed granular interactions. Useful mechanism reference, not evidence for a giant worm.
2. EPFL BioRob, *Lamprey and Salamander Modeling*. https://www.epfl.ch/labs/biorob/research/neuromechanical/page-36368-en-html/ — high-level drive signals modulate speed, direction and gait in distributed locomotor-controller models. This supports a low-dimensional player interface to coordinated motion, not a need to reproduce an entire nervous system.
3. Johns Hopkins Terradynamics Lab, *Physics — Granular Intrusion Forces*. https://li.me.jhu.edu/physics-granular-intrusion-forces/ — resistance depends on depth, packing, speed and geometry; the cited low-speed regime does not justify a giant high-speed scaling law.

Accessed 2026-11-12. Only the HTML/abstract material identified above was relied upon; no PDF was analysed for this pass. The simplified law below is our explicit diagnostic choice, not a transcription or validation of these papers' granular models.

## Diagnostic A: can a whole body move without a head-pulling force?

`control_probe.py` uses a **normalized planar** 40-segment body of total length 1. Segment tangent angles are prescribed by a travelling wave plus a distributed steering bias:

    theta_i = amplitude * sin(2*pi*u_i - phase) + bend * (u_i - 0.5)

The centreline is integrated with equal segment lengths and recentered about its mass-weighted centre. Segment velocities include translation, rotation AND internal shape motion. Each segment receives its own local, linear anisotropic resistance:

    F_i = -D_i * v_i

The positive resistance matrix has tangential coefficient 1 and transverse coefficient 4 in the principal fixture. This is **not a calibrated sand law**. Net motion is solved from the external forces and torques, with a frame-frozen implicit step. No head position or forward travel path is prescribed.

Linear momentum and total angular momentum are retained explicitly. Total angular momentum includes `sum(m_i * q_i cross qdot_i)` as well as rigid rotation `I * omega`; omitting the internal-shape contribution would give the wrong no-contact result. Internal motors prescribe shape and can do work; therefore, no total-energy conservation or finite-muscle-power claim is made. Their force/power limits are not yet implemented.

### Executed ablations

- **No external contact:** the body changes shape and may reorient internally, but its centre of mass does not translate from rest. It is not pulled forward for free.
- **Uniform isotropic linear resistance:** centre-of-mass travel is at roundoff scale in this fixture. This is a property of the stated diagnostic, not a theorem about sand or all isotropic media.
- **Distributed anisotropic resistance:** the active wave produces about 2.016 body lengths of travel over 12 normalized time units. This is not a game speed prediction.
- **Left/right bias:** opposite biases produce opposite lateral travel. At the sampled endpoint they are not exact mirror images: the same initial travelling-wave phase was used in both runs.
- **Front-half-only contact:** changing which segments encounter resistance changes the motion. The mask is an authored input, not actual contact with a simulated dune.
- **Frozen posture from rest:** remains at rest.
- **Coast comparison:** from the same normalized speed, changing mass from 1 to 4 while keeping resistance fixed retains about 5.04% versus 47.27% of that speed after three normalized time units. This checks inertia, NOT vertical gravitational weight or appropriate game tuning.

Worst segment-length discrepancy was below 1e-16 body lengths; worst discrete momentum-balance residual was below 7e-16 in the tested normalized units. These are narrow numerical bookkeeping checks; they do not certify physical fidelity. Positive environmental power was not observed for this dissipative law. A same-process repeated turn run matched exactly; this is not a cross-platform bitwise-determinism claim.

The 1/60, 1/120 and 1/240 step comparisons differed at the final centre of mass by less than 0.00065 body lengths. This is a sensitivity sample, not a convergence proof or an accepted timestep for the game.

## Diagnostic B: permanent plate colour plus temporary sand

Separate three states in the eventual renderer:

1. **Intrinsic plate colour** attached to stable body/plate coordinates. It must not slide over the animal as world-space colour noise.
2. **Burial / occlusion** from the same world geometry used for contact. A buried plate is hidden by sand, not recoloured into sand.
3. **Retained coating** that can remain after emergence, then fall or be scraped off.

Hard plates should remain rigid while their overlaps and underlying joints articulate. A smooth-body animation that stretches the plates would contradict this material direction. The broad collision envelope and rendered silhouette must agree; tiny etched grooves can remain visual detail only.

A separate bookkeeping fixture used 32 fixed material patches. Sixteen received a prescribed contact episode; the rest never contacted sand. Material moved from a finite source into a maximum authored 2 mm layer and then into a shed-material account. Orientation affected an authored shedding rate. The source, coating and shed accounts retained the initial amount to about 5.6e-17 cubic metres in this small floating-point fixture. Intrinsic colours remained unchanged, untouched patches stayed clean, and the JSON snapshot round-trip was exact.

**Limits:** those contacts and normals were prescribed. There is no actual worm/terrain collision, renderer, plate mesh, physically validated adhesion, grain flight or gameplay in this test. The patch area is a local test value, not a mesh representation of the whole giant worm. Until coupled, this is evidence for accounting only.

### Appearance proposal, not selected canon

Try matte blue-green plates with warm copper/ochre edges as one future colour study. A sandy back can look almost like the dune; a roll or breach reveals a strong coloured flank, then falling sand exposes more of its stable pattern. Avoid an automatic whole-body clean/dirty fade. Sand remaining in upper overlaps while steep side plates clear gives the movement visual consequences.

## Same-state contract for a future rendered trial

The drawn body, collision envelope, local velocity, contact mask and plate transforms must originate from the same simulation state. Any rendering interpolation must interpolate those states coherently; do not add an independent decorative wiggle that changes the meaningful geometry. Terrain deformation must follow a swept body footprint, not an unrelated trail texture. Dust that represents no canonical bulk mass must be explicitly cosmetic; counted sand must transfer out of a material account once, not twice.

Useful causal checks: stop the wave; remove contact; change mass without changing force; keep speed but change steering; bury only half the body; emerge twice without new contact; save/reload plate coverage. Screen results should change for the same reasons as the diagnostic quantities. **No current screen correspondence is certified because this study has no renderer.**

## Reproduction and preservation

Requires Python 3.10+ and NumPy. The executed environment was Python 3.13.5 / NumPy 2.3.5. Run into a new directory:

    python control_probe.py --out path/to/new-run

The script refuses an existing output directory. It uses no network, City Fare imports or live saves. The conversation packet includes full sampled traces and original stdout under `run-001/` and `run-001-stdout.txt`; the branch contains this note, the runnable source and a compact evidence summary. Future meaningful changes belong in a new numbered research directory; do not overwrite research-001.

## Remaining questions / next bounded test

This pass moves the control question forward but does not complete research-001's body-and-contact study. The next meaningful gate is **force-limited actuation plus actual partial body contact**, initially in a small plain fixture. Compare coast, brace, wide turn and dive intent while monitoring force/power limits, length, self-contact and momentum. A later tiny rendered test must establish perceived mass, responsive control and enjoyable movement. The rider, elaborate armour mesh, world generation, persistent sand scars and large game build remain deferred.
