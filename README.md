# Moto Kigali — prototype

Moto Kigali is an isometric open city driving game. You are a moto taxi rider on the hills of Kigali. The story moves you from a petrol moto to an Ampersand electric moto.

This repository holds the web prototype. The game spec is the doc "Moto Kigali: Game Spec v0.1".

## Status: milestones 1 and 2 done, milestone 3 (district slice) playable

Milestone 1 has a bike on a test map with hills, ramps and surfaces. It lets you test the two steering models.

| Item | Status |
| --- | --- |
| 2:1 isometric map with real height (64 × 32 px tiles, 16 px per level) | Done |
| Gentle ramps (19%) and steep ramps (37%) | Done |
| Surfaces: tarmac, cobblestone, murram (dry and wet), grass verge | Done |
| Potholes (speed −30%) and speed bumps (a raised hump with yellow and black paint) | Done |
| Zebra crossings (white bars) next to some junctions, separate from the speed bumps | Done |
| Roundabout, buildings and trees (solid) | Done |
| Petrol and electric moto with the spec values | Done |
| Energy bar, uphill and downhill cost, electric regen | Done (placeholder values) |
| Bike relative steering (default) and screen relative steering | Done |
| Petrol 4-speed manual gearbox, engine braking, auto shift option | Done |
| Brake wear (part of the moto service meter); electric regen braking | Done |
| Hills hide things: buildings fade, bike outline shows | Done |
| Camera that looks ahead in the direction of travel | Done |
| Touch controls (virtual stick, GO and STOP buttons) | Done (basic) |
| Engine sound and horn (synthesized); crash sound; people yell (a cute voice and a word) when you pass too close | Done |
| The horn makes people in front of you step aside | Done |
| Traffic behind you honks when you stand in the road (each vehicle type has its own horn; cyclists ring the bell) | Done |
| Out of fuel or charge: the rider walks beside the bike and pushes it, with tired sounds (UFF! AAH...) | Done |
| A passenger loses patience at a station stop or while you push: the tip goes down, and they complain | Done |
| Job cards in a small 3 × 5 pixel font, so the jobs window takes less of the screen | Done |
| MTN MoMo agents across the city: a lady in a yellow vest, a yellow stand and umbrella (decoration; airtime comes later) | Done |
| Traffic police on the corners of most junctions: dark blue uniform, white cap and gloves, a green hi-vis vest with blue and white checks, and a blue POLICE post with a flashing blue and red light; they blow the whistle when you speed past | Done |
| Hit a police officer at 15 km/h or more: jail, and the game is over (a jail cell game over screen) | Done |
| Ride on the pavement or off road near an officer: the officer runs after you (22 km/h); caught = 5,000 RWF fine; you can get away on the road | Done |
| Dashed white lane lines on tarmac roads (gaps at junctions) | Done |
| Fix: you can push the bike with no fuel on grass, sand and up moderate hills | Done |
| Passenger and cargo jobs, cash, fares and tips | Done |
| Fuel station (pay per litre) and Ampersand swap station (flat fee) | Done |
| Speed limit zones, signs and speed cameras with fines; about 250 speed limit signs made from the roads (where the limit changes and every 96 m), speed bump warning signs and crossing signs | Done |
| Garage, service meter, breakdowns, crash repairs, daily rent | Done |
| Shift clock for each level (for example 19:00–23:00 in 3 min) and day end summary | Done |
| Out of cash = game over (no loan): below zero after the rent, or an empty tank and no cash for fuel; a bicycle taxi game over screen, then a new game at level 1 | Done |
| Kigali map: 6 districts (Nyabugogo, Kigali town, Kacyiru, Kimihurura, Nyarutarama, Kicukiro), 192 × 128 tiles, streamed in chunks | Done |
| Topography: valley, ridges, hills and saddles; foundations on slopes, slope shading and contour lines | Done |
| The map grows with the levels: barriers close the districts that are not open yet | Done |
| Nyabugogo bus park: buses arrive and their passengers wave for motos | Done |
| Fuel in each shift: part full tank at the start, idle use, prices by district, low fuel arrow | Done |
| Less fuel use: a 6 min tank (electric 8 min), 60% at the start, and good shifting saves a lot (green revs use about half of the red zone); a hint when you stay in the red zone | Done |
| Collisions by mass with vehicles, people and poles; hard hits throw you off the bike | Done |
| Traffic: cars, minibuses (bus stops), trucks (slow on hills), other motos; exhaust | Done |
| People on pavements and in the market; customers who wave (street hails) | Done |
| Rival riders who race you to pickups and take street hails | Done |
| Levels 1–4: savings goals, milestones (phone, electric moto), streak bonus, save game | Done |
| Welcome menu, How to play, Settings, pause menu with Restart shift | Done |
| Retro 16-bit menus: pixel font, blue windows, ▶ cursor, scanlines, menu blips | Done |
| Retro 16-bit HUD, minimap, end of day and level up screens: pixel font, pixel icons, segmented bars, blue windows, low resolution scaled by a whole number | Done |
| Buy the electric moto at the Ampersand showroom on Kacyiru boulevard (level 4 mission) | Done |
| Station attendants: an SP attendant with the fuel nozzle, an Ampersand attendant with the new battery; the bike stands still while you fill up | Done |
| Family rewards: what the money means at home after each job, each shift and each milestone | Done |
| Sounds: the engine stops at the end of a shift; short tunes for shift end, milestone, game over, delivery | Done |
| Hi-vis vests for all moto riders; banana and rice cargo; cyclists from level 3; detailed fuel stations | Done |
| Buy fuel in fixed amounts: 25% of a tank (1,000 RWF at the base price), 50%, or a full tank (your choice, not from the jobs); itemized service (oil change, brake pads, check) | Done |
| One MOTO SERVICE meter: engine oil, brake pads, chain and tyres; the bike breaks down if you do not service it | Done |
| Fuel estimate on each job card, from the distance, the climb and the load | Done |
| Moto garages (Kazi ni Kazi, Sonatubes): open workshop, motos, mechanics, oil stains, painted sign | Done |
| Building types: houses, shops, offices, glass towers, government offices, schools, warehouses, villas; roof water tanks, AC units, flags | Done |
| Named landmarks with signs: Kigali City Tower, KPC, Chic, Kigali Heights, IBIRO offices (Kinyarwanda), schools (WE STRIVE FOR SUCCESS) | Done |
| Traffic slows for speed bumps and potholes and bounces over them | Done |
| Minimap like GTA: a zoomed view that moves with you; districts, locked areas (stripes and padlocks), SP fuel or swap stations, garages, the job target and you | Done |
| Market life: mamas in kitenge who sell goods on mats, umbrellas, goats and sheep; kitenge walkers | Done |
| Trees: acacia, jacaranda, avocado and fig, mixed by district | Done |
| Day and night: fast clock, night colour, sunset, street lamps, lit windows, headlights and tail lights | Done |
| Levels 5–10, police helmet checks, hired riders, traffic lights | Later milestones |

## Run the game

You need Node.js 20 or later.

```sh
npm install
npm run dev      # starts a local server; open the URL that it shows
npm test         # runs the unit tests
npm run build    # makes a static build in dist/
```

## Controls

The game opens with the welcome menu: Continue (your saved game), New game, How to play and Settings (sound, steering, gears).
In the game, Esc, P or the II button opens the pause menu: Resume, Restart shift, How to play, Settings and Main menu.

| Action | Keyboard | Touch |
| --- | --- | --- |
| Pause menu | Esc or P | II button |
| Throttle | W or ↑ (also Space) | GO button |
| Brake | S or ↓ (also Shift) | STOP button |
| Turn left and right | A and D, or ← and → | Left side: virtual stick |
| Shift up and down (petrol) | E and Q (also X and Z) | + and − buttons |
| Auto shift on or off | G | G button |
| Horn | H | H button |
| Change steering model | C | C button |
| Change bike (petrol or electric) | B | B button |
| Put a stuck bike back on the nearest road (fuel, wear and the job stay) | R | R button |
| Show or hide the minimap | M | Settings menu |
| Sound on or off | V | — |
| Take job 1, 2 or 3 | 1, 2, 3 | Tap the job card |
| Take the street hail next to you (stop close to a waving customer) | 1 | Tap the prompt |
| Cancel the job (no pay) | Backspace | — |
| Fill up or swap the battery (stop at the station) | F | Tap the station prompt |

**Bike relative steering (default, GTA 1 style).** Left and right turn the bike. Up is throttle. Down is brake. Hold down when the bike is stopped to push it backwards.

**Screen relative steering (C).** Push a direction and the bike goes that way on the screen. The diagonal keys (for example up and right together) follow the roads exactly.

## Gears and brakes

The petrol moto has a manual 4-speed gearbox. The electric moto has no gearbox.

- **Each gear has a top speed** (22, 38, 54 and 70 km/h). First gear pulls hardest, so a loaded bike can still crawl up the 37% ramp. At the rev limit, the engine stops pulling. Shift up.
- **A gear that is too high pulls weakly** (the engine lugs). A start in third gear is slow.
- **High revs use more fuel.** An early upshift saves fuel. Fuel use goes from 0.6× at low revs to 1.3× at the rev limit.
- **Engine braking.** When you close the throttle, a low gear slows the bike. It uses no fuel and does not wear the brakes. The game refuses a downshift that would over-rev the engine.
- **Brake wear.** The brake pads are part of the moto service. The friction brakes add wear to the service meter in proportion to the speed that they remove: about 0.5 km for each hard stop from 60 km/h. When the service is overdue, the brakes get weaker (45% of new at the breakdown point).
- **Electric regen braking.** The motor does the first 2.5 m/s² of braking and charges the battery. Only harder braking uses the friction brakes.

## Money

The game is about money. You earn from jobs. You spend on energy, fines and the bike.

| You earn | You spend |
| --- | --- |
| Passenger fare: 500 RWF + 200 RWF per game km | Fuel: 4,000 RWF for a full tank, you pay for what you fill (petrol) |
| Tip: up to 30% of the fare, from passenger comfort | Battery swap: 2,500 RWF flat (electric) |
| Cargo: 400 RWF + 160 RWF per game km + 12 RWF per kg, less damage | Speed camera fine: 5,000 RWF, or 10,000 RWF when more than 15 km/h over |
| | Crash repair: 800 RWF |
| | Garage service: 3,500 RWF (petrol: oil change, brake pads, check), 2,000 RWF (electric: brake pads, check) |
| | Daily rent: 6,000 RWF (petrol and electric) |

- **Jobs.** Take a job (1, 2 or 3). Ride to the green marker and stop. Then ride to the white marker and stop. Potholes, hard speed bumps, crashes and hard braking cost passenger comfort (and so the tip) and damage fragile cargo. A passenger or cargo makes the bike heavier.
- **Speed limits.** Outside a zone the limit is 60 km/h. The market zone is 30 km/h. The city centre, the roundabout and the bottom of the steep east ramp are 40 km/h. Four cameras fine you when you pass more than 5 km/h over the limit. The HUD limit sign flashes when you are too fast.
- **Off road.** Grass is off road. Each metre there counts 4 times on the service meter (cobblestone 1.3×, dry murram 1.5×, wet murram 1.8×). Off road riding also costs passenger comfort and damages fragile cargo. The HUD shows "OFF ROAD: 4× wear".
- **Service meter and garage.** The MOTO SERVICE meter on the HUD fills as you ride. It is one meter for the engine oil, the brake pads, the chain and the tyres. One game km on tarmac adds 1 km; bad roads add more (see above), the petrol red zone adds 3×, hard braking adds about 0.5 km for each stop from 60 km/h, and each pothole (2 km), hard speed bump (1.5 km) and crash (4 km) adds more. A service is due every 150 km (petrol) or 600 km (electric). At 80% the HUD warns you. From 100%, the bike loses up to 30% power and uses up to 30% more energy. At 150%, it breaks down: push it to the garage (south road) and press F. A service takes 20 s. After a breakdown, the mechanic repairs on credit if you have too little cash.
- **Traffic.** Cars, minibuses, trucks and other motos drive on the right, keep a gap, stop for you and for people, and give way at junctions. Minibuses stop at bus stops; trucks crawl up hills. A crash with a vehicle costs 800 RWF. Petrol engines leave exhaust smoke.
- **People and street hails.** People walk on the pavements and in the market and step aside from a fast bike. Hitting a person costs a 5,000 RWF police fine. Customers wave at the roadside: stop next to one (below 6 km/h) and press 1 for a quick ride that starts at once.
- **Rival riders.** When you take an app job, a rival (blue vest) may race you to the pickup; a red pin shows the rival. If the rival gets there first, you lose the job. Rivals also take street hails, and app offers go away faster (15–40 s).
- **Passengers and cargo show on the bike.** A passenger with a helmet rides behind you; cargo sacks ride on the rear rack. A person waves at a passenger pickup; sacks wait at a cargo pickup.
- **Fuel and shifting.** A full petrol tank lasts 6 min at full throttle (the electric battery 8 min). A new game starts with 60%. Fuel use rises fast with the revs: in the green part of the RPM bar the engine uses about 0.6–0.9× fuel, in the red zone 1.45×, and lugging in a high gear also costs more. Shift up (E) before the gold. If you stay in the red zone for 1.5 s with the manual shift, the game tells you to shift up (at most once in 25 s).
- **Empty tank or battery.** Hold throttle to push the bike at walking speed to a station.
- **Police.** Do not hit a police officer. At 15 km/h or more, the police arrest you: after 2.5 s the game over screen shows a jail cell, and you start again at level 1. A slow touch is only a warning.
- **Buying fuel.** At a fuel station, press F, then 1 (25% of a tank), 2 (50%) or 3 (a full tank). At the base price, 25% costs 1,000 RWF; each district has its own price. The job cards still show the fuel that each job needs.
- **Out of cash: game over.** There is no loan. The game is over when: (1) your cash is below zero at the end of the day, after the rent; or (2) the tank (or the battery) is empty, you have less cash than the smallest fuel buy (10 RWF) or a swap (2,500 RWF), and no passenger or cargo is on the bike. For (2) you get a warning, then the game over screen comes after 4 s. During the shift, cash below zero gets a warning only: earn it back before the shift ends. The game over screen shows why, a moving picture of you on a bicycle taxi (an igare, with a passenger on the soft seat at the back), and what you did in the game. Then you start again at level 1. The save is removed at the game over, so a reload does not bring the moto back.
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
| `GEARBOX` | Shift time, lugging, rev limit curve, fuel use by revs (and lugging), the green part of the RPM bar, the red zone hint, auto shift points |
| `BRAKES` | How much braking adds to the service meter, stopping power when the service is long overdue |
| `PHYSICS` | Hill force, drag, engine braking, turn rate, grip |
| `SURFACES` | Grip, speed factor and energy factor for each surface |
| `HAZARDS` | Pothole and speed bump effects (traffic uses the same safe speeds) |
| `LOAD` | Mass of bike and rider (a load changes pull and braking) |
| `DAY` | Day length and hours |
| `MONEY` | Start cash, rent, fuel, swaps, crash repair, the smallest fuel buy |
| `GAME_OVER` | Warning time before the game over when you are stranded, the bicycle taxi animation, the cash below which the day end shows the game over rules |
| `MAINTENANCE` | Service interval, wear from red zone and hits, overdue penalties, breakdown, garage price |
| `JOBS` | Fares, tips, cargo pay, comfort and damage rules, game km scale |
| `LAW` | Default speed limit, camera tolerance and fines |
| `TRAFFIC` | Number of each vehicle type, speeds, hill slowdown, exhaust, bus stop time, pothole speed, hazard look ahead |
| `PEOPLE` | Number of walkers, street hails, police fine for hitting a person, near miss yells, how far the horn reaches |
| `RIVALS` | Chance a rival races you or takes a street hail, offer lifetimes |
| `LEVELS`, `SAVINGS_FLOAT`, `STREAK` | Goals, shifts, rent, traffic and rivals for each level; the clean ride bonus |
| `DISTRICTS` | Name, unlock level, fuel price and fare factor of each district |
| `BUS_PARK` | How often buses arrive at Nyabugogo and how many customers they bring |
| `FUEL` | Start tank, idle use, low fuel and reserve warnings, fuel estimates for jobs (petrol and electric) |
| `COLLISION` | Bike radius, bounce, masses, crash speed and time, repair cost per km/h |
| `FAMILY` | The family names, and what money pays for at home |
| `DAYLIGHT` | Light at each hour, night colour, sunset colour |
| `LIGHTS` | Street lamp spacing, light pools, lit windows, headlights and tail lights |
| `MINIMAP` | Minimap zoom (pixels per tile), window size, hill shading, padlock spacing |
| `MARKET` | How many vendors, umbrellas, goats and sheep, and street vendors |
| `MOMO` | How many MTN MoMo agents, and the space between them |
| `POLICE` | How many junctions have an officer, the whistle, the chase (how far they see, how fast they run, when they give up), the fine, the speed that sends you to jail, the flashing light of the post |
| `ROAD_SIGNS` | How often speed limit signs repeat, where the bump warnings stand, how many junction arms have a zebra crossing |

The game map is built in code in [`src/world/maps/kigali.js`](src/world/maps/kigali.js): district rectangles, hills, roads, landmarks, stations and places. Each block has a building style (`h` house, `s` shop, `o` office, `t` tower, `g` government, `c` school, `w` warehouse, `v` villa). The district rules set the style, and a landmark sets the style, the height in levels and the sign text of its block. The small test map for the unit tests is an ASCII grid in [`src/world/map-data.js`](src/world/map-data.js). The legend is at the top of the file. Hills are plateaus with ramps; each hill has a height and a ramp length for each side. The same file has the job places, speed limit zones, cameras and signs.

## Code structure

```
src/
  config.js              All tunable values
  main.js                Starts Phaser
  world/
    iso.js               Isometric projection (world metres ↔ screen pixels)
    map-data.js          Small test map (ASCII), used by the tests
    maps/kigali.js       Kigali map: 6 districts, hills, roads, landmarks, built in code
    vehicle-sprites.js   Cars, minibuses, trucks, rival motos, people
    world.js             Heights, slopes, surfaces, solid blocks
    pixel-canvas.js      Small software rasterizer for pixel art
    terrain-render.js    Draws the ground into one image
    sprites.js           Draws the bike (16 directions), buildings (8 styles), trees, lit windows
    light-sprites.js     Light pools, headlight cones, light dots, lamp posts
    retro-font.js        5 × 7 pixel font for the retro menus and HUD
    hud-icons.js         9 × 9 pixel icons for the HUD (fuel, battery, spanner, coin, clock, star, …)
    attendant-sprites.js Station attendants (SP fuel, Ampersand swap)
    police.js            Traffic police: the sprite, the POLICE post and where they stand (junction corners)
    road-signs.js        Speed limit, speed bump and crossing signs, and the zebra crossings, made from the roads
    garage-sprites.js    Garage and building signs (pixel font), mechanics, oil stains, tyres, oil drum
    market-sprites.js    Market vendors, kitenge, goats and sheep, MTN MoMo agents
    market.js            Where the market vendors, animals and MoMo agents stand
    minimap.js           Draws the minimap (the whole map as a small diamond)
    bicycle-sprites.js   The game over pictures: a bicycle taxi (side view) and the evening hills; the jail cell
  sim/
    bike.js              Arcade bike physics and energy (no Phaser)
    controls.js          The two steering models
    economy.js           Wallet, fuel and swaps, repairs, day end bill, out of cash (stranded)
    jobs.js              Job offers, pickup and drop off, fares and tips
    law.js               Speed limit zones and speed cameras
    roads.js             Road graph from the map's road list, lanes, shortest path
    traffic.js           Vehicles: lane following, gaps, junctions, bus stops, hills
    honk.js              Traffic that waits behind a stopped bike honks
    police.js            Police rules: the whistle, the chase and the fine
    people.js            Walkers, dodging, street hail customers
    rivals.js            Rival riders who race you to customers
    collide.js           Collisions of the bike with vehicles, people and poles (by mass)
    maintenance.js       Service meter, wear, breakdown, garage quote
    levels.js            Levels, savings goals, milestones, streak bonus
    daylight.js          Light and colour at each hour of the day
    family.js            What the money means for the rider's family
    fuel.js              Fuel estimate for a job: distance, climb and load
  audio/engine-sound.js  Engine, horn, crash, yells, jingles and menu sounds (Web Audio)
  scenes/
    MenuScene.js         Welcome menu, pause menu, How to play, Settings
    RideScene.js         World, bike, camera, smoke, occlusion
    HudScene.js          Retro HUD: speed, energy, service, money, jobs, prompts, touch controls
    DayEndScene.js       Day end summary, level up and game over screens (retro)
    chunks.js            Streams ground and buildings in chunks; texture atlas packing
    TrafficView.js       Draws traffic
    PeopleView.js        Draws people and waving customers
    LightsView.js        Night colour, street lamps, headlights and tail lights
    BarrierView.js       Barriers at the edge of closed districts
    GarageView.js        The garage yards: motos, mechanics, oil stains, sign
    retro-ui.js          Shared retro parts: pixel font, icons, blue windows, segmented bars, pixel scale
    AttendantView.js     The station attendant who walks out to your bike
    PoliceView.js        Traffic police on the junction corners, and the whistle
    SignView.js          Landmark signs: roof and entrance signs on towers, wall signs on the others
    MarketView.js        Market vendors, goats and sheep (animated)
    MinimapView.js       The minimap in the HUD
    save.js              Saves the game in the browser (localStorage)
test/                    Unit tests (Vitest)
```

The physics (`src/sim`) and the world (`src/world`) do not use Phaser, so the unit tests run them in Node.

All art is made in code at 1× scale. The camera zoom is a whole number (×4 at 1920 × 1080), so the pixels stay sharp. Sprites keep sub pixel positions, so the camera moves smoothly.

## Known limits

- No traffic lights yet. Vehicles can overlap for a moment in a junction.
- All prices, energy values and the scale (4 m per tile, 1.5 m per level) are first guesses.
- In a browser without a GPU, the game runs slower than real time. Phaser slows the game clock when the frame rate is low.
