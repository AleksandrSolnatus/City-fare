# CITY fare

## Sonoran Drive 015 · Lantern Dock

Walk out through the green portal hut and choose a vehicle at one of the two bays. The wheeled buggy follows the terrain on four independent contacts. The skimmer can jump and fly. Both vehicles stay where you park them during the outing.

[Play the offline build](CITY-FARE-Sonoran-Drive-015.html) · [Audition buggy sounds](CITY-FARE-Buggy-Soundboard.html) · [Open the previous edition](CITY-FARE-Sonoran-Drive-014.html)

## Controls

The opening hint points to **Pause**, where the controls are always available. Press **P** or select **⋯** to open it.

- Walk with **WASD** and drag the view to look. **E** enters a nearby vehicle. While driving, **E** brakes or lands. Release and press **E** again when settled to step out.
- **W** accelerates, **S** brakes or reverses, **A/D** steer, and **Shift** surges. Drag or use **IJKL** to look. **R** centers the driving view.
- On the skimmer, tap **Space** to jump or hold it to climb into flight. Release to hold altitude. **X** descends and **E** lands.
- On the buggy, tap **Space** for a suspension hop. On touch, use the corresponding **Jump**, **Hop**, **Down**, and **Brake / Exit** buttons.

At a station, Pause can recall an unoccupied vehicle. Docking offers separate repair actions for damaged vehicles within reach. Recover at safe station moves the visitor and the occupied or last-driven vehicle when there is safe room. Before the first drive, recovery moves the visitor alone.

## Soundboard

Engine Forward, Loose Frame, and Tires First play the same short route with different blends of drivetrain, suspension, and road texture. Individual gravel, sand, surge, and landing previews are available. **Sandline** is the provisional in-game profile.

## Build and test

Use Node and a WebGL2 browser. The game and soundboard run from their HTML files without network requests or runtime dependencies.

```sh
npm run build
npm test
npm run dev
```

The dev server uses Python 3 and listens at `http://127.0.0.1:8766/`. Editable game modules live in `src/sonoran-drive-015/`. The build generates the standalone game, root `index.html`, `version.json`, and the soundboard. The preserved 014 artifact is identified by `versions/014.json`.

Visitor records keep places visited, the parcel, the last safe station, and display preferences. A reload starts a fresh outing at Lantern Dock. The downloadable journey evidence records both vehicles and switch events for inspection.

The buggy is an arcade vehicle with bounded suspension travel, steering grip, and body pitch and roll. The previous Sonoran Drive editions remain available through their source, standalone artifacts, and Git history. [Play Sonoran Drive live](https://city-fare.pages.dev/).

Built with Amar through iterative design, engineering and independent review. Coram Deo.
