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
| Bike relative steering (default) and screen relative steering | Done |
| Petrol 4-speed manual gearbox, engine braking, auto shift option | Done |
| Brake pad wear; electric regen braking | Done |
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
| Throttle | W or ↑ (also Space) | GO button |
| Brake | S or ↓ (also Shift) | STOP button |
| Turn left and right | A and D, or ← and → | Left side: virtual stick |
| Shift up and down (petrol) | E and Q (also X and Z) | + and − buttons |
| Auto shift on or off | G | G button |
| Horn | H | H button |
| Change steering model | C | C button |
| Change bike (petrol or electric) | B | B button |
| Reset the bike, energy and brakes | R | R button |
| Sound on or off | V | — |

**Bike relative steering (default, GTA 1 style).** Left and right turn the bike. Up is throttle. Down is brake. Hold down when the bike is stopped to push it backwards.

**Screen relative steering (C).** Push a direction and the bike goes that way on the screen. The diagonal keys (for example up and right together) follow the roads exactly.

## Gears and brakes

The petrol moto has a manual 4-speed gearbox. The electric moto has no gearbox.

- **Each gear has a top speed** (22, 38, 54 and 70 km/h). At the rev limit, the engine stops pulling. Shift up.
- **A gear that is too high pulls weakly** (the engine lugs). A start in third gear is slow.
- **High revs use more fuel.** An early upshift saves fuel. Fuel use goes from 0.6× at low revs to 1.3× at the rev limit.
- **Engine braking.** When you close the throttle, a low gear slows the bike. It uses no fuel and does not wear the brakes. The game refuses a downshift that would over-rev the engine.
- **Brake wear.** The friction brakes wear in proportion to the speed that they remove: about 1% of the pads for each hard stop from 60 km/h. Worn pads stop the bike less well (45% of new at 0%).
- **Electric regen braking.** The motor does the first 2.5 m/s² of braking and charges the battery. Only harder braking uses the friction brakes.

Milestone 2 will add the cost of new brake pads to the economy.

## How to tune the game

All the numbers are in [`src/config.js`](src/config.js). The units are metric (metres, seconds, km/h). Change a value, and the dev server reloads the game.

| Group | What it controls |
| --- | --- |
| `WORLD` | Tile size (4 m), height per level (1.5 m), pixel sizes |
| `VIEW` | Internal resolution (480 × 270), camera follow and look ahead |
| `BIKES` | Top speed, acceleration, energy, uphill and downhill factors, regen, gears |
| `GEARBOX` | Shift time, lugging, rev limit curve, fuel use per rev, auto shift points |
| `BRAKES` | Pad wear rate, stopping power of worn pads, warning level |
| `PHYSICS` | Hill force, drag, engine braking, turn rate, grip |
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
