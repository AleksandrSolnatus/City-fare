# CITY FARE: Sand Power — Whole Body / Motion 001

2026-11-12. **Small playable motion trial, not the full game.** Additive to Research 001/002. Keep this attempt intact; subsequent revisions belong in attempt-002. No main-source replacement, PR #5 merge or deployment was performed by this work.

## Question

Can distributed muscle effort, tissue compliance and environmental reactions produce a controllable ride, rather than moving a head and dragging an animated tail? The owner's stiff-hips analogy becomes a direct comparison: same muscle drive, different middle stiffness, different movement.

## Open offline

From this directory, with Python 3 installed:

```sh
python3 build.py
```

Open `City-Fare-Sand-Power-001.html` in a normal desktop browser. The built file is completely self-contained: no runtime dependencies, external assets, fetches or accounts. It does not read or write the car's saves, or any localStorage. Attachment previews may not execute the game; the artifact needs a browser that executes the downloaded HTML. Physical iPhone/Safari opening and performance remain unverified. No new hosted link is created by this attempt.

The exact generated HTML tested in this session has SHA-256:
`98274584bd8113cfda3ddbd6efd7ca2f7fb38fa5e40ea4a25086731a9449ce09`

Controls: W / Up = surge; A D / Left Right = lean; S / Down = hold dive, release to rise; Space = ease off all effort; P = pause. Touch buttons perform the same actions. Releasing surge returns to an authored low-effort cruise, not complete rest. Select Supple, Firm middle or Stiff middle to compare compliance. Study view provides a steadier overhead view; See tissue reveals the actual simulation layout.

Fresh run retains completed runs in the current session's export. Export runs saves inputs, parameter changes, final tissue state and dropped wall-clock time as JSON. Nothing is automatically durable: export before closing. No resume/import UI is claimed. Reconstruct by replaying the event log from a new Body; this was independently executed in Node against one browser export.

## What is actually moving

The numerical grid is **a reduced material model, not an anatomical skeleton**. It contains 25 cross sections / 50 dynamic material points, passive stretch/shear/bend springs, a 2D area-resistance term, and opposing distributed contraction forces. Muscle forces are equal/opposite internal pairs with finite force and instantaneous positive-power limits. No point receives a special head-pulling force; there is no prescribed forward velocity or path.

Each point receives local directional resistance. The same deformed body is used to draw the flexible envelope, derive contact, follow the camera and place the plates. Rigid short plate pieces rotate and overlap; they do not dictate the tissue's trajectory. Their mass/stiffness is lumped into the tissue representation, not solved as individual colliding armour shells.

The middle-stiffness buttons change actual passive mechanics while leaving the muscle-force ceiling unchanged. Changing stiffness live is an external parameter intervention and can change stored elastic energy; it is NOT a claim of energy-conserving biological co-contraction. For a fair comparison, start fresh runs with the chosen setting and replay the same inputs.

## Deliberate simplifications

- This is a planar tissue-strip with an additional authored vertical controller, NOT a full 3D hydrostatic continuum. The area penalty only resists area change; it does not enforce exact body volume or solve pressure.
- Depth has finite acceleration and contact-gated support; immersion changes horizontal resistance. It is not a validated burrowing/lift law. Vertical neighbour coupling is not a full 3D bending solution.
- The 200 m rest length and speed display are illustrative spatial scaling, not a biological mass or real sand calibration. Tissue shortens under contraction. In the mixed-input diagnostic, sampled centreline lengths ranged roughly 10.0–12.0 model units.
- Terrain is static. Surface marks are cosmetic contact traces, capped at 2,400 display marks. They are NOT excavated material or a permanent landscape scar. Dotted underground outlines are explicitly labelled study guides, not physical ridges.
- Sand coverage changes with contact and emergence but is a visual coating fraction, not the conservative coating-volume ledger from Research 002. Do not conflate those models.
- Internal non-neighbour repulsion is a coarse safeguard, not a proof of collision-free anatomy. The rigid plate footprint is a visual approximation.
- Physics uses fixed 1/240 s steps. A frame exceeding 0.35 s pauses. Bounded catch-up can drop wall time; that total is reported/exported instead of silently claiming real-time endurance.
- Rider is a tiny scale marker. The protective recess, detailed head, cinematic introduction and full sand deformation are intentionally not built.

## Executed checks

`python3 build.py && node test.cjs` — **14/14 mechanics checks passed locally under Node v22.16.0**. They cover no-contact centre-of-mass invariance, initial momentum, rest, isotropic comparison, distributed propulsion, stiffness influence, opposite turns, inertia, force/power limits, dive/release, continuity, exact same-engine replay, a 120-s simulated mixed-input run, and complete inline bundling without network/storage calls.

**14/14 real Chromium Canvas/UI checks passed**, with the exact HTML injected using Playwright `set_content`. Direct file navigation was blocked by the environment's administrator policy; the policy was not altered. Desktop 1280x800, phone-size 390x844 and landscape 844x390 views rendered; pointer handlers, cancellation, pause/blur, run archival and export worked. Phone-sized viewport and synthetic pointer checks are NOT physical iPhone or Safari tests.

One exported Chromium input sequence (2,263 physics ticks) was replayed in Node; maximum absolute tissue-state discrepancy was approximately `8.79e-14`. This is one cross-engine fixture, not a universal bitwise determinism claim.

The separately supplied offline packet includes the built HTML, complete source, test scripts, raw JSON results, browser export, screenshots, manifest and receipt. Git retains complete reconstruction source and this scoped result summary. The source Git blob hashes were compared with the executed local files and matched.

Not established: fun, owner acceptance, giant-animal realism, full sand displacement, long-play stability, physical phone performance or independent Root sign-off. This is ready for a bounded feel test, not release.

## Biological context, not implementation validation

Ellers et al. (2024), *Soft skeletons transmit force with variable gearing*, DOI 10.1242/jeb.246901: hydrostatic support, geometry, fibres and muscle force interact. https://pmc.ncbi.nlm.nih.gov/articles/PMC11177778/

Zhang et al. (2019), *Modeling and simulation of complex dynamic musculoskeletal architectures*, DOI 10.1038/s41467-019-12759-5: active/passive distributed structures and compliance can be modelled without resolving every anatomical detail. https://pmc.ncbi.nlm.nih.gov/articles/PMC6811595/

These papers inform the conceptual distinction between tissue mechanics and animation. This small spring/area model is not their solver or a validated reproduction of their results.
