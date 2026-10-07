// All tunable values for the prototype live here, so you can tune the game
// without code changes. Units are metric: metres, seconds, km/h.
// Values marked "guess" come from the spec's first guesses and need playtests.

// ---------------------------------------------------------------------------
// World scale and projection
// ---------------------------------------------------------------------------
export const WORLD = {
  tileMetres: 4, // one map tile is a 4 m × 4 m square (about one road lane plus margin) — guess
  levelMetres: 1.5, // one height level lifts the ground by 1.5 m — guess
  tileWidthPx: 64, // 2:1 isometric base tile, from the spec
  tileHeightPx: 32,
  levelPx: 16, // each height level lifts a tile by 16 px, from the spec
};

// ---------------------------------------------------------------------------
// Screen and camera
// ---------------------------------------------------------------------------
export const VIEW = {
  // The spec asks for a 480 × 270 internal resolution scaled ×4 to 1920 × 1080.
  // The camera zoom is the largest whole number that shows at least this area.
  internalWidth: 480,
  internalHeight: 270,
  cameraLerp: 0.12, // 0..1 per frame at 60 fps. Higher = camera follows tighter.
  lookAheadSeconds: 0.55, // camera aims at where the bike will be in this time
  lookAheadMaxPx: 70, // in internal pixels
};

// ---------------------------------------------------------------------------
// Bikes. Values from the spec table "Bike, energy and physics" where it gives them.
// ---------------------------------------------------------------------------
export const BIKES = {
  petrol: {
    name: 'Petrol moto',
    topSpeedKmh: 70, // spec
    accelMs2: 3.4, // peak acceleration at 0 km/h — guess ("medium")
    brakeMs2: 7.5,
    reverseSpeedKmh: 4, // walking the bike backwards to get unstuck
    energySeconds: 4 * 60, // full bar at full throttle on flat tarmac (spec said 6 min; 4 min makes fuel part of each shift)
    uphillEnergyFactor: 2.0, // spec
    downhillEnergyFactor: 0.5, // spec
    regenFraction: 0, // no regen on petrol
    smoke: true,
    // Manual gearbox (guess: a 4-speed 125–150 cc moto taxi). Each gear has a top speed
    // (the rev limit) and a pull factor (fraction of accelMs2).
    gears: [
      { topKmh: 22, pull: 1.25 }, // low gear torque: enough to climb a 37% ramp with a passenger
      { topKmh: 38, pull: 0.7 },
      { topKmh: 54, pull: 0.52 },
      { topKmh: 70, pull: 0.42 },
    ],
    regenBrakeMs2: 0, // no regen braking on petrol
  },
  electric: {
    name: 'Electric moto',
    topSpeedKmh: 75, // spec
    accelMs2: 5.0, // spec "high, instant torque" — guess
    brakeMs2: 7.5,
    reverseSpeedKmh: 4,
    energySeconds: 5.5 * 60, // spec said 8 min plus regen; shorter so swaps are part of each shift
    uphillEnergyFactor: 1.6, // spec
    downhillEnergyFactor: 0, // no cost when you roll downhill
    regenFraction: 0.2, // spec: regen gives back 20% of climb cost
    smoke: false,
    gears: null, // single speed, no gearbox — guess for the Ampersand moto
    // Regen braking: the motor brakes up to this deceleration and charges the battery.
    // Only the brake force above it uses (and wears) the friction brakes.
    regenBrakeMs2: 2.5,
    regenBrakeFraction: 0.35, // part of the braking energy that goes back to the battery — guess
  },
};

// ---------------------------------------------------------------------------
// Physics shared by all bikes (arcade, not simulation)
// ---------------------------------------------------------------------------
export const PHYSICS = {
  gravity: 9.81,
  // Arcade factor on the slope force (1.0 = real gravity). At 0.8, a 19% ramp needs 2nd gear
  // on the petrol moto and a 37% ramp needs 1st gear.
  hillFactor: 0.8,
  // A grade at or above this value counts as "fully uphill" for the energy factor.
  fullUphillGrade: 0.2,
  airDragPerMs: 0.004, // extra deceleration per m/s of speed
  coastDragMs2: 0.6, // electric: extra drag when you do not press throttle (light motor drag)
  // Steering
  maxTurnRateRad: 3.4, // rad/s at low speed
  turnRateAtTopSpeed: 0.45, // fraction of maxTurnRate left at top speed
  minSpeedToTurnMs: 0.4,
  // Grip: how fast sideways velocity is removed (1/s) at grip 1.0.
  // Lower grip lets the bike slide on wet murram.
  lateralGripRate: 10,
  // Engine braking (petrol, throttle closed): deceleration at the rev limit. It falls with revs squared.
  // It uses no fuel and does not wear the brakes, so a downshift is a free brake.
  engineBrakeMs2: 2.4,
  pushSpeedKmh: 4, // with no fuel or charge left, you push the bike at walking speed
  // Hard limit on how far one physics step can move, for collision safety.
  maxStepMetres: 0.5,
  // Speed lost when you hit a wall or a building, as a fraction of speed.
  wallBounce: 0.25,
};

// ---------------------------------------------------------------------------
// Surfaces. Grip and speed factor from the spec table "Surface grip".
// energyFactor implements the spec note: dirt road parts are slower and use more fuel.
// ---------------------------------------------------------------------------
export const SURFACES = {
  // rollingMs2: rolling resistance (deceleration) that always works against motion. It makes the
  // engine work harder, so you need a lower gear (petrol) or more energy (electric). Arcade guesses.
  // wearFactor: how much each metre on this surface counts for the service bill (wear on tyres,
  // chain, suspension). Off road (grass) wears the bike 4 times faster than tarmac. Guesses.
  tarmac: { name: 'Tarmac', grip: 1.0, speedFactor: 1.0, energyFactor: 1.0, rollingMs2: 0.25, wearFactor: 1.0 },
  cobble: { name: 'Cobblestone', grip: 0.85, speedFactor: 0.9, energyFactor: 1.1, rollingMs2: 0.45, wearFactor: 1.3 },
  murram: { name: 'Murram, dry', grip: 0.7, speedFactor: 0.75, energyFactor: 1.25, rollingMs2: 0.9, wearFactor: 1.5 },
  murramWet: { name: 'Murram, wet', grip: 0.45, speedFactor: 0.6, energyFactor: 1.4, rollingMs2: 1.3, wearFactor: 1.8 },
  grass: { name: 'Off road', grip: 0.6, speedFactor: 0.45, energyFactor: 1.5, rollingMs2: 1.6, wearFactor: 4.0, offRoad: true }, // guess, not in spec
  pavement: { name: 'Pavement', grip: 0.95, speedFactor: 0.5, energyFactor: 1.0, rollingMs2: 0.3, wearFactor: 1.2 }, // for people; slow for bikes
  sand: { name: 'Sand', grip: 0.5, speedFactor: 0.4, energyFactor: 1.6, rollingMs2: 2.0, wearFactor: 2.5, offRoad: true }, // golf bunkers — guess
  water: { name: 'River', grip: 0, speedFactor: 0, energyFactor: 1, rollingMs2: 9, wearFactor: 1 }, // solid: you cannot ride here
};

// ---------------------------------------------------------------------------
// Gearbox and brakes
// ---------------------------------------------------------------------------
export const GEARBOX = {
  shiftSeconds: 0.18, // the engine does not pull while the clutch is in
  // Below this fraction of the gear's top speed, the engine lugs (pulls weakly). First gear does not lug (clutch slip).
  lugRevs: 0.3,
  lugPull: 0.35, // pull at zero revs in gears 2 and up
  lugWarnSeconds: 0.8, // show "Shift down!" after the engine struggles for this long
  // Above this fraction of the gear's top speed, pull falls to zero at the rev limit.
  peakRevsEnd: 0.85,
  // Fuel use rises with revs: factor = fuelAtIdle + fuelPerRev × revs (1.0 at mid revs).
  fuelAtIdle: 0.6,
  fuelPerRev: 0.7,
  // Auto shift (G key) shifts up and down at these revs.
  autoUpRevs: 0.92,
  autoDownRevs: 0.35,
};

export const BRAKES = {
  // Pad wear per m²/s² of speed that the friction brakes remove (a stop from 60 km/h removes 139).
  // 0.00007 = about 1% of the pads for each hard stop from 60 km/h — guess.
  wearPerUnit: 0.00007,
  wornEfficiency: 0.45, // stopping power with fully worn pads, as a fraction of new
  warnBelow: 0.25, // warn the rider when the pads are below this level
};

// Point hazards on top of a surface.
export const HAZARDS = {
  pothole: { speedCut: 0.3 }, // spec: a pothole cuts speed by 30%
  speedBump: { safeSpeedKmh: 20, speedCut: 0.35 }, // above the safe speed, you lose 35% — guess
};

// ---------------------------------------------------------------------------
// Colours. Ampersand yellow is only for batteries, swap stations and the electric moto.
// ---------------------------------------------------------------------------
export const COLOURS = {
  ampersandYellow: 0xfcdc04, // Surge Yellow
  ampersandBlack: 0x000000, // Eerie Black
  ebonyGrey: 0x5c5c5e,
};

// ---------------------------------------------------------------------------
// Load. A passenger or cargo makes the bike heavier: less pull, less braking, more energy.
// ---------------------------------------------------------------------------
export const LOAD = {
  baseMassKg: 180, // bike and rider — guess
};

// ---------------------------------------------------------------------------
// Game day. From the spec: one day is about 6 minutes, from 06:00 to 22:00.
// ---------------------------------------------------------------------------
export const DAY = {
  realSeconds: 360,
  startHour: 6,
  endHour: 22,
};

// ---------------------------------------------------------------------------
// Money. All values are placeholders in Rwandan francs (RWF).
// Calibrate them with real fare, fuel and swap data before a playtest.
// Target: a petrol rider just breaks even on a good day; an electric rider makes a clear profit.
// ---------------------------------------------------------------------------
export const MONEY = {
  startCash: 5000, // spec
  dailyRent: { petrol: 6000, electric: 6000 }, // spec: the electric lease is the same as the petrol rent
  fuelFullTank: 4000, // spec; you pay only for the part of the tank that you fill
  fuelSeconds: 10, // spec: 10 s plus queue
  fuelQueueMaxSeconds: 8, // random queue 0..8 s — guess
  swapFee: 2500, // spec: flat fee, whatever charge is left in the old battery
  swapSeconds: 15, // spec
  brakePads: 3000, // new pads at the garage — guess
  repairs: { wall: 800 }, // a crash costs money at once; potholes and bumps add wear instead (see MAINTENANCE) — guess
  // Out of cash at day end = game over, or one loan. The loan makes the next days harder. All guesses.
  loan: { amount: 20000, days: 10, interest: 0.2 }, // repay 2,400 RWF per day for 10 days
};

// ---------------------------------------------------------------------------
// Jobs (passenger and cargo, from the spec prototype scope)
// ---------------------------------------------------------------------------
export const JOBS = {
  // The test map is small, so distance is compressed: 40 m of map = 1 game km.
  gameKmMetres: 40,
  maxOffers: 3,
  offerLifeSeconds: 40, // an offer that nobody takes goes away
  minTripMetres: 60,
  arriveRadiusMetres: 6,
  stopSpeedKmh: 6, // you must slow down below this to pick up or drop off
  passengerChance: 0.65,
  passenger: { base: 500, perGameKm: 200, maxTipFraction: 0.3, kg: 65 },
  cargo: { base: 400, perGameKm: 160, perKg: 12, kgMin: 20, kgMax: 80, fragileChance: 0.4 },
  // Passenger comfort lost (0..100) and cargo damage (fraction of pay, fragile cargo only).
  comfortLoss: { pothole: 20, bumpHard: 15, wall: 35, crash: 50, hardBrakePerSecond: 25, offRoadPerSecond: 10 },
  cargoDamage: { pothole: 0.1, bumpHard: 0.1, wall: 0.3, crash: 0.4, offRoadPerSecond: 0.03 },
  hardBrakeMs2: 5, // braking harder than this upsets the passenger
};

// ---------------------------------------------------------------------------
// Speed limits and speed cameras
// ---------------------------------------------------------------------------
export const LAW = {
  defaultLimitKmh: 60, // outside a zone — guess
  toleranceKmh: 5, // a camera fines you only above limit + tolerance — guess
  cameraRadiusMetres: 7, // the camera measures you when you come this close
  cameraFine: 5000, // guess
  cameraFineHigh: 10000, // when you are more than highOverKmh over the limit — guess
  highOverKmh: 15,
};

// ---------------------------------------------------------------------------
// Maintenance and the garage. The service meter fills as you ride; at 100% the bike
// needs a service at the garage. Bad roads, high revs and hits fill it faster. All guesses.
// ---------------------------------------------------------------------------
export const MAINTENANCE = {
  intervalKm: { petrol: 150, electric: 600 }, // game km of tarmac riding between services
  // Each km counts × the surface wearFactor (SURFACES) × this factor when the petrol engine is in the red zone.
  redlineWearFactor: 3,
  hazardWearKm: { pothole: 2, bumpHard: 1.5, wall: 4, crash: 8 }, // extra km on the service meter for each hit
  warnAt: 0.8, // "Service soon"
  breakdownAt: 1.5, // the engine stops; push the bike to the garage
  // Between 100% and the breakdown, the bike loses power and uses more energy (up to these values).
  overduePowerLoss: 0.3,
  overdueEnergyExtra: 0.3,
  serviceCost: { petrol: 3500, electric: 2000 }, // the sum of serviceItems — guess
  // What the mechanic does at each service (the costs add up to serviceCost). The petrol engine needs
  // an oil change; high revs fill the service meter faster (redlineWearFactor), so you need it sooner.
  serviceItems: {
    petrol: [{ name: 'Oil change', cost: 2000 }, { name: 'Check: chain, tyres, lights', cost: 1500 }],
    electric: [{ name: 'Check: brakes, tyres, lights', cost: 2000 }],
  },
  serviceSeconds: 20,
  padsBelow: 0.7, // the mechanic also replaces brake pads below this level (MONEY.brakePads)
  minServiceFraction: 0.05, // below this, and with good pads, the mechanic has nothing to do
};

// ---------------------------------------------------------------------------
// Traffic (milestone 3). Counts are for the district map. All guesses.
// ---------------------------------------------------------------------------
export const TRAFFIC = {
  counts: { car: 18, bus: 6, truck: 6, moto: 10 }, // default (tests); the game uses perDistrict
  // Vehicles for each open district (× the level's traffic factor). The map grows, so traffic grows with it.
  perDistrict: { car: 8, bus: 3, truck: 2 },
  kinds: {
    // limitFactor: how they treat the speed limit (motos ride a little over it).
    car: { length: 4.2, width: 1.8, maxKmh: 50, accel: 2.5, brake: 6, limitFactor: 1.0, hillSlowdown: 1.0, minHillFactor: 0.5, exhaust: 0.5, variants: 4 },
    bus: { length: 5.0, width: 1.9, maxKmh: 45, accel: 1.8, brake: 5, limitFactor: 1.0, hillSlowdown: 1.6, minHillFactor: 0.35, exhaust: 1.0, variants: 2 },
    truck: { length: 7.0, width: 2.4, maxKmh: 35, accel: 1.0, brake: 4, limitFactor: 0.9, hillSlowdown: 2.4, minHillFactor: 0.18, exhaust: 2.0, variants: 2 },
    moto: { length: 2.0, width: 0.8, maxKmh: 55, accel: 3.5, brake: 7, limitFactor: 1.1, hillSlowdown: 0.8, minHillFactor: 0.5, exhaust: 0.6, variants: 1 },
    // Cyclists ride slowly at the edge of the road (laneOffset), so cars can pass them. Very slow uphill.
    cyclist: { length: 1.8, width: 0.6, maxKmh: 16, accel: 0.8, brake: 4, limitFactor: 1, hillSlowdown: 4, minHillFactor: 0.3, exhaust: 0, variants: 3, laneOffset: 3.6 },
  },
  turnKmh: 18,
  busStopSeconds: 5,
};

// ---------------------------------------------------------------------------
// People, street hails and rival riders (milestone 3). All guesses.
// ---------------------------------------------------------------------------
export const PEOPLE = {
  walkers: 40, // default (tests); the game uses walkersPerDistrict
  walkersPerDistrict: 20,
  walkSpeed: [1.1, 1.6], // m/s
  radius: 0.35, // metres, for collisions
  dodgeDistance: 3.5, // a person steps aside when a fast bike comes this close
  // Street hails: customers who wave at the roadside.
  maxHails: 4,
  hailEverySeconds: 12,
  hailLifeSeconds: [60, 120],
  hailRange: 6, // metres: stop this close to a customer to take the ride
  hitFine: 5000, // police fine for hitting a person
  hitSpeed: 2.5, // m/s: below this a touch is not a hit
};

export const RIVALS = {
  raceChance: 0.45, // when you take an app job, a rival may race you to the pickup
  // The racing rival starts between these multiples of your own distance to the pickup, so you have a fair chance.
  raceDistance: [0.8, 2.5],
  hailChance: 0.5, // a rival goes for a new street hail
  hailRange: 120, // metres
  arriveMetres: 9,
  busySeconds: 40, // a rival with a passenger rides for this long, then looks for work again
  offerLifeSeconds: [15, 40], // app offers go away faster: rivals take them
};

// ---------------------------------------------------------------------------
// Levels (spec: Levels and progression). Levels 1-4 are built; level 5 is free play until
// the next build. Each level: a savings goal and a milestone, a shift, and the difficulty.
// The open districts come from DISTRICTS (unlockLevel): the map grows with the levels.
// Rent scales with the shift length (night and evening shifts are shorter). All guesses.
// ---------------------------------------------------------------------------
export const SAVINGS_FLOAT = 5000; // you need the goal plus this working money to buy a milestone

export const LEVELS = [
  {
    n: 1, name: 'Night rider', goal: 15000, milestone: 'School fees for one term', kind: 'life',
    story: 'Aline goes back to school with her fees paid. At dinner she shows you her new exercise books.',
    shift: { start: 19, end: 23, realSeconds: 180 }, rent: 3000,
    traffic: 0.3, rivals: 2, cyclists: 0, raceChance: 0.15, offerLife: [30, 60], hailEvery: 0.6,
    fare: 1.2, petrol: 1.0, cameras: false,
    news: 'Night shift in Nyabugogo: quiet streets, few rivals, night fares +20%. Buses arrive at the bus park all night.',
  },
  {
    n: 2, name: 'Evening rider', goal: 25000, milestone: 'A smartphone and a spare passenger helmet', kind: 'asset', effect: 'phone',
    story: 'Your new phone shows more ride requests, and the spare helmet keeps your passengers safe. Uwase calls you on it to say well done.',
    shift: { start: 16, end: 23, realSeconds: 240 }, rent: 4500,
    traffic: 0.5, rivals: 4, cyclists: 0, raceChance: 0.25, offerLife: [25, 50], hailEvery: 0.6,
    fare: 1.1, petrol: 1.0, cameras: false,
    news: 'Kigali town opens: the city on the ridge above Nyabugogo. Evening rush, more traffic and more rivals.',
  },
  {
    n: 3, name: 'Day rider', goal: 40000, milestone: 'A year of school: fees, uniforms and books', kind: 'life',
    story: 'A full year of school is paid for Aline and Eric. Their new uniforms hang by the door, ready for Monday.',
    shift: { start: 6, end: 22, realSeconds: 360 }, rent: 6000,
    traffic: 0.8, rivals: 6, cyclists: 2, raceChance: 0.35, offerLife: [20, 45], hailEvery: 1,
    fare: 1.0, petrol: 1.1, cameras: true,
    news: 'Kacyiru opens: offices, the police headquarters and the hospital. Full day shift, speed cameras on, petrol +10%.',
  },
  {
    n: 4, name: 'Rush hour', goal: 60000, milestone: 'Down payment on an Ampersand electric moto', kind: 'asset', effect: 'electric',
    story: 'You sign for your own Ampersand electric moto. No more petrol queues and no more smoke. The whole family comes to see it at the swap station.',
    shift: { start: 6, end: 22, realSeconds: 360 }, rent: 6000,
    traffic: 1.0, rivals: 10, cyclists: 2, raceChance: 0.45, offerLife: [15, 40], hailEvery: 1,
    fare: 1.1, petrol: 1.2, cameras: true,
    news: 'Kimihurura opens: the Convention Centre, Parliament and cobblestone lanes. Rush hour: heavy traffic, 10 rivals. Petrol +20%.',
  },
  {
    n: 5, name: 'Electric rider', goal: 80000, milestone: 'A plot of land', kind: 'life', freePlay: true,
    story: 'One day this plot will hold the family house.',
    shift: { start: 6, end: 22, realSeconds: 360 }, rent: 6000,
    traffic: 1.0, rivals: 12, cyclists: 3, raceChance: 0.5, offerLife: [15, 40], hailEvery: 1,
    fare: 1.2, petrol: 1.3, cameras: true,
    news: 'You ride electric now, and Kicukiro opens: busy junctions, workshops and trucks. Levels 6 to 10 (and Nyarutarama) come in the next build: free play.',
  },
];

export const STREAK = { step: 0.1, max: 1.5, minComfort: 80 }; // clean ride streak: fares × (1 + streak)

// Day and night: the light at each hour (0-24). light: 0 = night, 1 = full day.
export const DAYLIGHT = {
  nightTint: [0.3, 0.34, 0.52], // colour multiplier at full night (blue)
  sunsetTint: [1.0, 0.84, 0.7], // warm light at sunset
  // [hour, light] points; light between them is interpolated.
  curve: [[0, 0], [5, 0], [6.5, 0.6], [7.5, 1], [17, 1], [18.2, 0.7], [19.3, 0.15], [20, 0], [24, 0]],
};

// Night lights. Colours are 0xRRGGBB. Distances are in metres. Alpha is 0-255 at full night.
// Surge Yellow is not used here: the lamps are sodium orange and the windows warm white.
export const LIGHTS = {
  lampSpacingTiles: 5, // street lamps along tarmac roads, on alternate sides
  lampHeightMetres: 5,
  poolRadiusMetres: 7, // the lit ground under one lamp
  poolColour: 0xff9a40,
  poolAlpha: 100,
  stationPoolRadiusMetres: 7,
  windowColour: 0xffc874,
  windowLitChance: 0.55, // part of the windows that are lit at night
  headlightLengthMetres: 9,
  headlightHalfAngleDeg: 22,
  headlightColour: 0xfff1c8,
  headlightAlpha: 140,
  headDotColour: 0xfff6d8,
  tailDotColour: 0xff2a1a,
  lampHeadColour: 0xffb45a,
};

// ---------------------------------------------------------------------------
// Districts (spec: Districts and the growing map). The map is 6 districts of 64 × 64 tiles
// (256 m × 256 m each). The map grows slowly: one new district at each level. Before its level,
// barriers close the roads into a district. Planned next (spec): Remera 7, Kimironko 8, Nyamirambo 9, Kanombe 10.
// fuelPrice multiplies the fuel price at its stations. fares multiplies the fares that start there.
// The geometry (hills, roads, landmarks) is in src/world/maps/kigali.js. All values are guesses.
// ---------------------------------------------------------------------------
export const DISTRICTS = {
  nyabugogo: { name: 'Nyabugogo', unlockLevel: 1, fuelPrice: 0.95, fares: 1.0 },
  town: { name: 'Kigali town', unlockLevel: 2, fuelPrice: 1.0, fares: 1.1 },
  kacyiru: { name: 'Kacyiru', unlockLevel: 3, fuelPrice: 1.0, fares: 1.15 },
  kimihurura: { name: 'Kimihurura', unlockLevel: 4, fuelPrice: 1.05, fares: 1.2 },
  kicukiro: { name: 'Kicukiro', unlockLevel: 5, fuelPrice: 0.95, fares: 1.0 },
  nyarutarama: { name: 'Nyarutarama', unlockLevel: 6, fuelPrice: 1.15, fares: 1.35 },
};

// Intercity buses arrive at the Nyabugogo bus park and their passengers want rides.
export const BUS_PARK = {
  arrivalEverySeconds: [18, 30], // a bus comes to the bus park this often (real seconds)
  passengers: [2, 4], // customers who wave for a moto when a bus unloads
  dwellSeconds: 12, // the bus waits at the park
};

// Fuel and charge. Fuel must be part of each shift: you start with a part full tank,
// the engine uses fuel when it runs at idle, and the HUD points to the nearest station when you are low.
export const FUEL = {
  startLevel: 0.45, // tank or battery at the start of a new game
  idleUse: 0.08, // fraction of the full throttle use while the engine runs with no throttle (petrol only)
  lowAt: 0.25, // "Fuel low": the HUD arrow points to the nearest station
  reserveAt: 0.1, // "Reserve!"
  // Buying fuel: riders buy the bare minimum, not a full tank. The station offers enough for the
  // next job, for the next two jobs, or a full tank. Estimate: tank per km of riding (with hills), plus a margin.
  tankPerKm: 0.25, // a rough average (with hills), for a job that is not known yet
  // The estimate for a known job (petrol tank; the electric battery scales by its energySeconds):
  flatTankPerKm: 0.2, // riding on the flat with no load
  tankPerClimbMetre: 0.0015, // each metre of climb (the engine works harder and revs higher)
  margin: 1.15,
  roundToRwf: 100, // fuel is sold in round amounts
  approachMetres: 500, // the ride to a pickup that is not known yet
};

// Collisions: the bike and other things push each other by mass. A hard hit throws you off the bike.
export const COLLISION = {
  bikeRadius: 0.45, // metres
  restitution: 0.25, // bounce (0 = no bounce, 1 = full bounce)
  massKg: { car: 1200, bus: 4500, truck: 9000, moto: 200, cyclist: 90, person: 70, wall: Infinity, pole: Infinity },
  poleRadius: 0.15, // street lamps, signs, cameras
  crashSpeedKmh: 18, // an impact speed above this throws the rider off
  crashSeconds: 2.5, // time on the ground before you ride again
  slideMs2: 6, // the fallen bike slides to a stop
  repairPerKmh: 60, // RWF of crash repairs for each km/h of impact speed (above 5 km/h)
  personHurtKmh: 9, // an impact above this hurts a person (police fine)
};

// The rider's family (spec: Story and rewards). The day end shows what the money means at home.
// Names and prices are guesses (RWF). needs: from small to big; the game shows the biggest one that a day's profit pays for.
export const FAMILY = {
  partner: 'Uwase',
  children: ['Aline', 'Eric'],
  needs: [
    { cost: 300, text: 'bread and milk for breakfast' },
    { cost: 1000, text: 'beans and rice for a family dinner' },
    { cost: 2500, text: 'a day of food for the whole family' },
    { cost: 4000, text: "a week of school lunch for Aline" },
    { cost: 7000, text: 'new school shoes for Eric' },
    { cost: 12000, text: 'a month of water and electricity at home' },
    { cost: 20000, text: "a month of the family's rent" },
  ],
};
