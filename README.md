# CITY fare

A quiet alien desert. A skimmer waiting outside a small portal station. Two colossal sunworms and the RibbonHawk, living their own lives.

[Visit CITY fare](https://city-fare.pages.dev/) · [Download the standalone game](https://city-fare.pages.dev/CITY-FARE-Sonoran-Drive-014.html)

Sonoran Drive 014 — Listening Flight is a public playtest. Enter through the green portal, walk to the skimmer, then explore freely. The copper western worm and jade eastern worm carry angle-shifting crystalline frills. Their sun-gathering and cooling routines are authored alien ecology, not a validated biological model.

## Controls

- WASD: walk; in the skimmer W accelerates, A/D steer, S slows and reverses.
- E: enter nearby. In motion, brake and settle. Release and press E again to step out.
- Space: hop. Shift: surge. They work together.
- Drag the open view to look, including upward. I/J/K/L also look; R centers the driving view.
- V: optional observation flight. Space climbs, X descends; release to hold altitude. E lands.
- P or the small corner menu: pause, controls, map, sound, reduced detail, touch controls and recovery.

A translucent controls reminder appears briefly after Enter. Pause keeps the guide near the top.

Touch devices show translucent directional and action buttons. Hold movement with one thumb and swipe the open view with the other. Pause includes a manual visibility override. Audio begins only after interaction and stops on pause or loss of focus.

## Build and test

No external runtime assets, network requests, dependencies or analytics are required. The downloadable HTML works offline in a browser with WebGL2.

```sh
npm run build
npm test
npm run dev
```

Open `http://127.0.0.1:8766/`. Editable runtime source lives in `src/sonoran-drive-014`. `tools/bundle.mjs` reproducibly builds `index.html`, the offline HTML and `version.json`. The manifest records the exact SHA-256. Node 22 or newer is suitable for the tests. The development server uses Python 3.

Visitor records store only visits, the optional parcel and display preferences. New outings begin in the hut. Saved terrain and animals are not persisted between outings. Earlier Sonoran Drive visitor JSON can be imported; the original driving game's saves remain separate.

## Limits and history

This is an authored browser game: granular deformation uses a conservative sparse heightfield, finite coarse parcels and a bounded editable surface layer. Crystal colour is a lighting approximation. Worm avoidance is not a general deformable-body solver. Full-size Retina rendering can cost more than the 30 FPS target; reduced detail is available. Desktop Chrome interaction and automated tests do not establish physical iPhone performance or player enjoyment.

The prior Sonoran Run008 source remains unchanged in `dist/`, with its tests in `tests/` and its former bundler preserved as `tools/bundle-sonoran-run-008.mjs`. That historical bundler writes the root old game if invoked; use the normal `npm run build` for the current game. Git retains the prior live version at `87d6e1c2ed21ede40d8227ba1a6b9baacdfd8abc`. The complete local research archive and evidence are preserved separately and are not part of this website's deployment.

Built with Amar through iterative design, engineering and independent review. Coram Deo.

## 014 listening and flight update

Audio starts with Enter, is on by default, and can be toggled in Pause. On supported browsers it selects playback audio for the game and releases that session on pause/mute. Playback can interrupt other media. Interrupted audio retries on ordinary gestures. Physical-phone output still needs user verification.

V toggles optional flight assist while driving (also available in Pause). Hold Space to climb or X to descend; release them to hold altitude. Steering and surge remain familiar. V off or E begins a controlled descent; E brakes and settles before a fresh press exits. The same skimmer is an observation platform with independent free look and gentle camera reframing. Ground handling is preserved by a numerical reference test.

Creature calls are quiet original synthesis, spaced by world-time routines and attenuated by distance/burial. The continuous idle hiss is removed; wind, rotor and upper regeneration/surge are softer, while the low electric motor remains. Cached rendering and corrected paint timing address demonstrated redundant work and frame jitter. These changes are not a promise of universal frame rate.

The original 013 download and src/sonoran-drive-013 remain unchanged; versions/013.json records its hash. The updated root game is 014.
