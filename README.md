# Moto Kigali — prototype

Moto Kigali is an isometric open city driving game. You are a moto taxi rider on the hills of Kigali. The story moves you from a petrol moto to an Ampersand electric moto.

This repository holds the web prototype. The game spec is the doc "Moto Kigali: Game Spec v0.1".

## Status: milestone 1 ("Ride feel") and the core money loop

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
| Passenger and cargo jobs, cash, fares and tips | Done |
| Fuel station (pay per litre) and Ampersand swap station (flat fee) | Done |
| Speed limit zones, signs and speed cameras with fines | Done |
| Damage repairs, servicing, brake pads, daily rent | Done |
| Day clock (06:00–22:00 in 6 min) and day end summary | Done |
| Out of cash: one loan, then game over | Done |
| Story, other districts, police helmet checks, upgrades | Later milestones |

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
| Take job 1, 2 or 3 | 1, 2, 3 | Tap the job card |
| Cancel the job (no pay) | Backspace | — |
| Fill up or swap the battery (stop at the station) | F | Tap the station prompt |

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

## Money

The game is about money. You earn from jobs. You spend on energy, fines and the bike.

| You earn | You spend |
| --- | --- |
| Passenger fare: 500 RWF + 200 RWF per game km | Fuel: 4,000 RWF for a full tank, you pay for what you fill (petrol) |
| Tip: up to 30% of the fare, from passenger comfort | Battery swap: 2,500 RWF flat (electric) |
| Cargo: 400 RWF + 160 RWF per game km + 12 RWF per kg, less damage | Speed camera fine: 5,000 RWF, or 10,000 RWF when more than 15 km/h over |
| | Damage: pothole 300, hard speed bump 500, crash 800 RWF |
| | Service at day end: 25 RWF per game km (petrol), 5 RWF (electric) |
| | Brake pads: 3,000 RWF when the pads are below 50% |
| | Daily rent: 6,000 RWF (petrol and electric) |
| | Loan payment: 2,400 RWF per day for 10 days, if you took the loan |

- **Jobs.** Take a job (1, 2 or 3). Ride to the green marker and stop. Then ride to the white marker and stop. Potholes, hard speed bumps, crashes and hard braking cost passenger comfort (and so the tip) and damage fragile cargo. A passenger or cargo makes the bike heavier.
- **Speed limits.** Outside a zone the limit is 60 km/h. The market zone is 30 km/h. The city centre, the roundabout and the bottom of the steep east ramp are 40 km/h. Four cameras fine you when you pass more than 5 km/h over the limit. The HUD limit sign flashes when you are too fast.
- **Empty tank or battery.** Hold throttle to push the bike at walking speed to a station.
- **Out of cash.** The game checks your cash at the end of each day, after the rent. Below zero, you can take one loan of 20,000 RWF (you pay back 2,400 RWF each day for 10 days). If you already had the loan, or your debt is larger than the loan, the game is over.
- **Regen.** The electric moto charges its battery when it brakes and when it rolls downhill. The day end summary shows how much regen saved.
- **Distance.** The test map is small, so 40 m of map counts as 1 game km.

All values are placeholders in `src/config.js` (`MONEY`, `JOBS`, `LAW`, `DAY`).

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
| `LOAD` | Mass of bike and rider (a load changes pull and braking) |
| `DAY` | Day length and hours |
| `MONEY` | Start cash, rent, fuel, swaps, repairs, service, brake pads |
| `JOBS` | Fares, tips, cargo pay, comfort and damage rules, game km scale |
| `LAW` | Default speed limit, camera tolerance and fines |

To change the map, edit the ASCII grid in [`src/world/map-data.js`](src/world/map-data.js). The legend is at the top of the file. Hills are plateaus with ramps; each hill has a height and a ramp length for each side. The same file has the job places, speed limit zones, cameras and signs.

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
    economy.js           Wallet, fuel and swaps, repairs, day end bill
    jobs.js              Job offers, pickup and drop off, fares and tips
    law.js               Speed limit zones and speed cameras
  audio/engine-sound.js  Engine and horn with Web Audio
  scenes/
    RideScene.js         World, bike, camera, smoke, occlusion
    HudScene.js          HUD, jobs, money and touch controls
    DayEndScene.js       Day end summary
test/                    Unit tests (Vitest)
```

The physics (`src/sim`) and the world (`src/world`) do not use Phaser, so the unit tests run them in Node.

All art is made in code at 1× scale. The camera zoom is a whole number (×4 at 1920 × 1080), so the pixels stay sharp. Sprites keep sub pixel positions, so the camera moves smoothly.

## Known limits

- The terrain is one image. A map that is much larger than 40 × 40 tiles needs chunks (the spec asks for chunks of 32 × 32 tiles).
- All prices, energy values and the scale (4 m per tile, 1.5 m per level) are first guesses.
- In a browser without a GPU, the game runs slower than real time. Phaser slows the game clock when the frame rate is low.
