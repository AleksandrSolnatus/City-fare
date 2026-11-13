# CITY fare

A quiet alien desert. A skimmer waiting outside a small portal station. Two colossal sunworms and the RibbonHawk, living their own lives.

[Visit CITY fare](https://city-fare.pages.dev/) · [Download the standalone game](https://city-fare.pages.dev/CITY-FARE-Sonoran-Drive-013.html)

Sonoran Drive013 — Sun Colonies is a public playtest. Enter through the green portal, walk to the skimmer, then explore freely. The copper western worm and jade eastern worm carry angle-shifting crystalline frills. Their sun-gathering and cooling routines are authored alien ecology, not a validated biological model.

## Controls

- WASD: walk; in the skimmer W accelerates, A/D steer, S slows and reverses.
- E: enter nearby. In motion, brake and settle. Release and press E again to step out.
- Space: hop. Shift: surge. They work together.
- Drag the open view to look, including upward. I/J/K/L also look; R centers the driving view.
- P or the small corner menu: pause, map, sound, reduced detail, touch controls and recovery.

Touch devices show translucent directional and action buttons. Hold movement with one thumb and swipe the open view with the other. Pause includes a manual visibility override. Audio begins only after interaction and stops on pause or loss of focus.

## Build and test

No external runtime assets, network requests, dependencies or analytics are required. The downloadable HTML works offline in a browser with WebGL2.

```sh
npm run build
npm test
npm run dev
```

Open `http://127.0.0.1:8766/`. Editable runtime source lives in `src/sonoran-drive-013`. `tools/bundle.mjs` reproducibly builds `index.html`, the offline HTML and `version.json`. The manifest records the exact SHA-256. Node22 or newer is suitable for the tests. The development server uses Python3.

Visitor records store only visits, the optional parcel and display preferences. New outings begin in the hut. Saved terrain and animals are not persisted between outings. Earlier Sonoran Drive visitor JSON can be imported; the original driving game's saves remain separate.

## Limits and history

This is an authored browser game: granular deformation uses a conservative sparse heightfield, finite coarse parcels and a bounded editable surface layer. Crystal colour is a lighting approximation. Worm avoidance is not a general deformable-body solver. Full-size Retina rendering can cost more than the30FPS target; reduced detail is available. Desktop Chrome interaction and automated tests do not establish physical iPhone performance or player enjoyment.

The prior Sonoran Run008 source remains unchanged in `dist/`, with its tests in `tests/` and its former bundler preserved as `tools/bundle-sonoran-run-008.mjs`. That historical bundler writes the root old game if invoked; use the normal `npm run build` for the current game. Git retains the prior live version at `87d6e1c2ed21ede40d8227ba1a6b9baacdfd8abc`. The complete local research archive and evidence are preserved separately and are not part of this website's deployment.

Built with Amar through iterative design, engineering and independent review. Coram Deo.
