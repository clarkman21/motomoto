# Moto Kigali — prototype

Moto Kigali is an isometric open city driving game. You are a moto taxi rider on the hills of Kigali. The story moves you from a petrol moto to an Ampersand electric moto.

This repository holds the web prototype. The game spec is the doc "Moto Kigali: Game Spec v0.1".

## Status: milestone 1, "Ride feel"

Milestone 1 has a bike on a test map with hills, ramps and surfaces. It lets you test the two steering models.

| Item | Status |
| --- | --- |
| 2:1 isometric map with real height (64 × 32 px tiles, 16 px per level) | Done |
| Gentle ramps (19%) and steep ramps (37%) | Done |
| Surfaces: tarmac, cobblestone, murram (dry and wet), grass verge | Done |
| Potholes (speed −30%) and speed bumps | Done |
| Roundabout, buildings and trees (solid) | Done |
| Petrol and electric moto with the spec values | Done |
| Energy bar, uphill and downhill cost, electric regen | Done (placeholder values) |
| Screen relative and bike relative steering | Done |
| Hills hide things: buildings fade, bike outline shows | Done |
| Camera that looks ahead in the direction of travel | Done |
| Touch controls (virtual stick, GO and STOP buttons) | Done (basic) |
| Engine sound and horn (synthesized) | Done (basic) |
| Jobs, cash, fuel stations, day end screen | Milestone 2 |

## Run the game

You need Node.js 20 or later.

```sh
npm install
npm run dev      # starts a local server; open the URL that it shows
npm test         # runs the unit tests
npm run build    # makes a static build in dist/
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | Arrows or WASD | Left side: virtual stick |
| Throttle | Space (and up, in bike relative mode) | GO button |
| Brake | Shift (and down, in bike relative mode) | STOP button |
| Horn | H | H button |
| Change steering model | C | C button |
| Change bike (petrol or electric) | B | B button |
| Reset the bike and the energy | R | R button |
| Sound on or off | V | — |

**Screen relative steering.** Push a direction and the bike goes that way on the screen. The diagonal keys (for example up and right together) follow the roads exactly. If you push the opposite direction at speed, the bike brakes first.

**Bike relative steering (GTA 1 style).** Left and right turn the bike. Up is throttle. Down is brake. Hold down when the bike is stopped to push it backwards.

## How to tune the game

All the numbers are in [`src/config.js`](src/config.js). The units are metric (metres, seconds, km/h). Change a value, and the dev server reloads the game.

| Group | What it controls |
| --- | --- |
| `WORLD` | Tile size (4 m), height per level (1.5 m), pixel sizes |
| `VIEW` | Internal resolution (480 × 270), camera follow and look ahead |
| `BIKES` | Top speed, acceleration, energy, uphill and downhill factors, regen |
| `PHYSICS` | Hill force, drag, turn rate, grip |
| `SURFACES` | Grip, speed factor and energy factor for each surface |
| `HAZARDS` | Pothole and speed bump effects |

To change the map, edit the ASCII grid in [`src/world/map-data.js`](src/world/map-data.js). The legend is at the top of the file. Hills are plateaus with ramps; each hill has a height and a ramp length for each side.

## Code structure

```
src/
  config.js              All tunable values
  main.js                Starts Phaser
  world/
    iso.js               Isometric projection (world metres ↔ screen pixels)
    map-data.js          Test map (ASCII) and hills
    world.js             Heights, slopes, surfaces, solid blocks
    pixel-canvas.js      Small software rasterizer for pixel art
    terrain-render.js    Draws the ground into one image
    sprites.js           Draws the bike (16 directions), buildings, trees
  sim/
    bike.js              Arcade bike physics and energy (no Phaser)
    controls.js          The two steering models
  audio/engine-sound.js  Engine and horn with Web Audio
  scenes/
    RideScene.js         World, bike, camera, smoke, occlusion
    HudScene.js          HUD and touch controls
test/                    Unit tests (Vitest)
```

The physics (`src/sim`) and the world (`src/world`) do not use Phaser, so the unit tests run them in Node.

All art is made in code at 1× scale. The camera zoom is a whole number (×4 at 1920 × 1080), so the pixels stay sharp. Sprites keep sub pixel positions, so the camera moves smoothly.

## Known limits

- The terrain is one image. A map that is much larger than 40 × 40 tiles needs chunks (the spec asks for chunks of 32 × 32 tiles).
- All prices, energy values and the scale (4 m per tile, 1.5 m per level) are first guesses.
- In a browser without a GPU, the game runs slower than real time. Phaser slows the game clock when the frame rate is low.
