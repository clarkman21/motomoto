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
    energySeconds: 6 * 60, // full bar at full throttle on flat tarmac (spec: 6 min; 4 min was too hard in play)
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
    energySeconds: 8 * 60, // spec: 8 min plus regen (it must go further than the petrol tank)
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
  stuckHintSeconds: 1.5, // throttle but no movement this long: a hint to walk the bike backwards
  reverseMs2: 1.2, // walking the bike backwards: the push on top of the rolling resistance
  deadEngineDragMs2: 0.5, // no fuel: the bike rolls on with no engine braking (it slows down slowly)
  rideOffKmh: 7, // no fuel: the rider stays on the rolling bike until it is slower than this, then walks
  pushMs2: 1.2, // how fast you get to walking speed (on top of the ground resistance and the slope)
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
  // Fuel use rises fast with revs: factor = fuelAtIdle + fuelPerRev × revs². So good shifting saves a lot:
  // revs 0.6 → 0.81, revs 0.8 → 1.09, revs 1.0 (the red zone) → 1.45.
  fuelAtIdle: 0.45,
  fuelPerRev: 1.0,
  // Lugging (revs below lugRevs in gear 2 and up) also wastes fuel: + lugFuel × (lugRevs − revs).
  lugFuel: 1.5,
  // The RPM bar on the HUD: green (good for fuel) below ecoRevs, gold up to peakRevsEnd, then red.
  ecoRevs: 0.7,
  redWarnSeconds: 1.5, // "Shift up to save fuel" after this long in the red zone (manual shift only)
  redWarnEverySeconds: 25, // at most once in this time
  // Auto shift (G key) shifts up and down at these revs.
  autoUpRevs: 0.92,
  autoDownRevs: 0.35,
};

export const BRAKES = {
  // Brake pads are part of the service: the friction brakes add wear to the service meter.
  // Game km per m²/s² of speed that the friction brakes remove (a stop from 60 km/h removes 139):
  // 0.0036 = about 0.5 km for each hard stop from 60 km/h — guess.
  serviceKmPerUnit: 0.0036,
  wornEfficiency: 0.45, // stopping power at the breakdown point (the pads are worn out), as a fraction of new
};

// Point hazards on top of a surface.
export const HAZARDS = {
  pothole: { speedCut: 0.3 }, // spec: a pothole cuts speed by 30%
  speedBump: { safeSpeedKmh: 20, speedCut: 0.35 }, // above the safe speed, you lose 35% — guess
  // Murram roads are rough: patches of loose rocks, potholes (puddles on a rainy day), and small bumps
  // all the way (a washboard surface). All guesses, to tune in play.
  rocks: { safeSpeedKmh: 22, speedCut: 0.18 }, // loose rocks: above the safe speed, you lose 18%
  murramRocksShare: 0.07, // the share of murram tiles with loose rocks
  murramPotholeShare: 0.035, // the share of murram tiles with a pothole
  murramBumps: { fromKmh: 15, everyMetres: 2.2, bounce: 0.12 }, // a small bump every few metres above this speed
};

// ---------------------------------------------------------------------------
// Colours. Ampersand yellow is only for batteries, swap stations and the electric moto.
// ---------------------------------------------------------------------------
export const COLOURS = {
  ampersandYellow: 0xfcdc04, // Surge Yellow
  ampersandBlack: 0x000000, // Eerie Black
  ebonyGrey: 0x5c5c5e,
  // MTN MoMo agents: MTN yellow and a dark blue. This yellow is more orange than Surge Yellow, so the
  // two do not mix up (Surge Yellow is only for Ampersand).
  mtnYellow: 0xffc20e,
  // Traffic police: a greener high visibility vest than the moto riders' yellow vest, and police blue.
  policeVest: 0x9ee83a,
  policeBlue: 0x1f4fb8,
  mtnBlue: 0x0b3d6e,
  // SP fuel stations: blue and yellow. This yellow is darker and more orange than Surge Yellow,
  // so the two do not mix up.
  spBlue: 0x1f4fa8,
  spYellow: 0xf0a800,
};

// ---------------------------------------------------------------------------
// Visual design system: the palette and the light rule. See "Visual design system" in the spec.
// - Each palette entry is a base colour (the lit tone). A sprite gets the other two tones from
//   the light rule (world/palette.js tone()), so each material has 3 tones only.
// - The light comes from the top left of the screen. Top faces get the lit tone, faces that look to
//   the left of the screen get the mid tone, faces that look to the right get the dark tone.
// - People and other small figures: the right edge of the body gets the dark tone, and a 1 px ink
//   outline goes around all things that move.
// The traffic, the people, the police and the attendants use only these colours (a test checks it).
// The other sprites move to the palette step by step.
// Roofs: houses and villas on a rectangular plot get a pitched roof (a ridge along the long side).
// The roof planes follow the light rule too: the plane that looks to the top left of the screen is lit.
// ---------------------------------------------------------------------------
export const LIGHT = { top: 1, left: 0.86, right: 0.68 };
// Pitched roofs. pitch: rise / run; maxLevels: the highest ridge (1 level = 1.5 m); steepChance: the part
// of the villas and the Kicukiro houses that are new apartments with a very steep roof (Alp: "the new
// face of Kigali"; which districts is a guess).
// Moving details of the city (the scene animates them).
export const CITY_ANIM = {
  flagFrames: 4, flagFrameMs: 170, // flags in the wind
  sprayFrames: 4, sprayFrameMs: 110, // the MTN fountain spray
  sprayEverySeconds: 40, sprayForSeconds: 9, // Alp: the fountain sprays only now and then
};
export const ROOFS = {
  house: { pitch: 0.5, maxLevels: 2 },
  mud: { pitch: 0.45, maxLevels: 1.2 },
  mudChance: 0.6, // the part of the Nyabugogo houses that are mud houses (the others are painted)
  villa: { pitch: 0.6, maxLevels: 2.2 },
  steep: { pitch: 1.3, maxLevels: 3.6 },
  steepChance: 0.35,
  eave: 0.06, // the roof sticks out over the walls (tiles)
};
export const PALETTE = {
  ink: 0x161616, // the outline of all things that move
  // People
  skinLight: 0x7a4a2a, skin: 0x6b4226, skinDeep: 0x5a3820,
  hair: 0x1a1a1a, shoe: 0x2a2a2a,
  // Cloth (shirts, trousers, kitenge)
  red: 0xc0392b, green: 0x3f8f4a, orange: 0xe0a030, purple: 0x6a4aa0, cloth: 0xe8e8e4, blue: 0x2f6fb0,
  navy: 0x2a3550, charcoal: 0x3a3a3a, mud: 0x5a4a3a, teal: 0x2a8a8a, pink: 0xb0306a, cream: 0xf2efe6,
  kOrange: 0xe07a2a, kGreen: 0x2f7f4a, kPurple: 0x6a2f8a, kBlue: 0x1f4f9a, kGold: 0xe8b030, kSand: 0xe8e0c0, kTeal: 0x3fa0a0,
  // Vehicle paint
  white: 0xf0efe6, silver: 0xa9adb3, carRed: 0xb83a2e, carBlue: 0x2e4a7a, carGreen: 0x3a6a4a, cabBlue: 0x2e5a9a, cabGreen: 0x2f7a5a,
  // Vehicle parts
  glass: 0x2c3e4c, glassShine: 0x6a8496, tyre: 0x1b1b1b, hub: 0x8a8a8a, chrome: 0xc8ccd0, plate: 0xf2f2e8,
  bumper: 0x3a3c40, headlight: 0xfff2b0, tailLight: 0xd03a2a, indicator: 0xf0a030,
  // Goods and materials
  wood: 0x8a5a32, woodDark: 0x6a4224, sack: 0xe6e0cc, banana: 0x7aa83a, bananaDark: 0x5a8a2a, tomato: 0xd0302a,
  basket: 0xc8a060, basketDark: 0xa8804a, tarp: 0x56703f,
  // House paint: Kigali houses are colourful (not Surge Yellow: that colour is only for Ampersand)
  paintPeach: 0xf2b48a, paintMint: 0x9fd8b8, paintSky: 0x8ec4e8, paintPink: 0xe8a0b8, paintLilac: 0xb8a0d8,
  paintLime: 0xc8dc78, paintOchre: 0xe0b860, paintCream: 0xefe4c8, paintTerracotta: 0xd07a50,
  // Roofs and walls
  tin: 0x9a9e9c, tinRust: 0x9a5a3a, clayTile: 0xb5543a, roofRed: 0x9a2f2a, roofGreen: 0x3f7f4a, roofBlue: 0x2f5f9a,
  // The flag of Rwanda: sky blue, yellow, green (the flag's own yellow, not Surge Yellow)
  rwBlue: 0x20a0e0, rwYellow: 0xe5be01, rwGreen: 0x20603d,
  slate: 0x4a4e58, water: 0x3f7fb8, waterLight: 0x8ac0e8, concrete: 0xb5b0a5, mudWall: 0xa8724a, mudLight: 0xc08a5a, brick: 0x9a4a32, stone: 0x6a645a,
  // Police
  uniform: 0x1c2a5a, policeWhite: 0xf4f4f4, boots: 0x101010, policeSilver: 0xd8dce4,
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
  repairs: { wall: 800 }, // a crash costs money at once; potholes and bumps add wear instead (see MAINTENANCE) — guess
  minFuelCash: 10, // the smallest amount of fuel you can buy
};

// ---------------------------------------------------------------------------
// Game over: there is no loan. Below zero cash at the day end (after the rent), or an empty tank
// with no cash for fuel (or a swap) and nobody on the bike to pay you, ends the game. Then you
// start again at level 1 (decision by Alp: the game is hard enough without a way back from debt).
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Balance model (sim/balance.js, `npm run balance`): player profiles to estimate how many days each
// level takes. All guesses, to be checked against real play.
// ---------------------------------------------------------------------------
export const BALANCE = {
  sampleJobs: 300,
  targetDaysAverage: [5, 6, 7, 8, 9, 10, 11, 12, 13, 15], // an average player must pass levels 1 to 10 in this many days at most
  beginnerMaxLossPerDay: 1000, // a beginner on level 1 may lose at most this much each day
  policeFine: 5000, // a fine from a police officer (levels with no cameras)
  crashCost: 1200, // an average crash repair
  // kmh: the average speed over a job (with turns, traffic and slowing down); overheadSeconds: the time
  // lost at each job (choose it, stop at the pickup and the drop off, wrong turns); tip: the average tip
  // (part of the fare); finesPerDay and crashesPerDay: on average.
  players: {
    good: { kmh: 32, overheadSeconds: 10, tip: 0.22, finesPerDay: 0.05, crashesPerDay: 0.2 },
    average: { kmh: 24, overheadSeconds: 16, tip: 0.12, finesPerDay: 0.25, crashesPerDay: 0.6 },
    beginner: { kmh: 18, overheadSeconds: 24, tip: 0.05, finesPerDay: 0.5, crashesPerDay: 1.2 },
  },
};

// The emergency fuel moto (key T): a moto from the nearest station brings 1 litre of fuel (or a
// charged battery for the electric moto), for the station price plus a premium. Guesses.
export const RESCUE = {
  premium: 0.2, // 20% more than at the station (Alp)
  answerSeconds: 4, // the phone call, before the moto leaves the station
  speedKmh: 45,
  handoverMetres: 3,
  handoverSeconds: 2.5,
  leavePoints: 3, // the moto rides back this many road points, then it is gone
};

// Road signs and zebra crossings, made from the road list (see world/road-signs.js). Guesses.
export const ROAD_SIGNS = {
  repeatTiles: 24, // a speed limit sign again after this many tiles (96 m) on the same road
  bumpWarnTiles: 3, // the speed bump warning stands this many tiles before the bump
  crossingChance: 0.4, // part of the junction arms (on tarmac) that have a zebra crossing
  minGapTiles: 1.6, // no two signs (or a sign and a street lamp) nearer than this
  vergeInset: 0.3, // how far from the road edge a sign stands, in tiles
  tries: 4, // when the verge is not free, try this many tiles further on
};

export const GAME_OVER = {
  strandedSeconds: 4, // the time you see the warning before the game over screen — guess
  bicycleFrames: 4, // pedal frames of the bicycle taxi on the game over screen
  frameMs: 140,
  warnBelowCash: 10000, // the day end screen tells you the game over rules when your cash is below this
};

// ---------------------------------------------------------------------------
// Jobs (passenger and cargo, from the spec prototype scope)
// ---------------------------------------------------------------------------
export const JOBS = {
  // The test map is small, so distance is compressed: 40 m of map = 1 game km.
  gameKmMetres: 40,
  maxOffers: 3,
  maxOffersShown: 4, // the HUD has 4 job cards (keys 1-4): never more offers than this
  offerLifeSeconds: 40, // an offer that nobody takes goes away
  minTripMetres: 60,
  arriveRadiusMetres: 6,
  stopSpeedKmh: 6, // you must slow down below this to pick up or drop off
  passengerChance: 0.65,
  // Fares ×1.5 (8 October 2026): the balance model (npm run balance) showed that an average player lost
  // money each day, so level 1 could not be passed.
  passenger: { base: 750, perGameKm: 300, maxTipFraction: 0.3, kg: 65 },
  cargo: { base: 600, perGameKm: 240, perKg: 18, kgMin: 20, kgMax: 80, fragileChance: 0.4 },
  // Passenger comfort lost (0..100) and cargo damage (fraction of pay, fragile cargo only).
  comfortLoss: { pothole: 20, bumpHard: 15, wall: 35, crash: 50, hardBrakePerSecond: 25, offRoadPerSecond: 10, reversePerSecond: 6 },
  // A passenger on the bike waits while you fill up, swap, see the mechanic or push the bike: the tip goes down.
  waitComfort: { atStop: 8, perSecond: 1.5 }, // guesses
  cargoDamage: { pothole: 0.1, bumpHard: 0.1, wall: 0.3, crash: 0.4, offRoadPerSecond: 0.03 },
  hardBrakeMs2: 5, // braking harder than this upsets the passenger
  loseJobBelowKmh: 3, // out of fuel during a job: when the bike is this slow, the customer leaves (no fare)
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
  hazardWearKm: { pothole: 2, puddle: 2, rocksHard: 1, bumpHard: 1.5, wall: 4, crash: 8 }, // extra km on the service meter for each hit
  warnAt: 0.8, // "Service soon"
  breakdownAt: 1.5, // the engine stops; push the bike to the garage
  // Between 100% and the breakdown, the bike loses power and uses more energy (up to these values).
  overduePowerLoss: 0.3,
  overdueEnergyExtra: 0.3,
  serviceCost: { petrol: 3500, electric: 2000 }, // the sum of serviceItems — guess
  // What the mechanic does at each service (the costs add up to serviceCost). The petrol engine needs
  // an oil change; high revs fill the service meter faster (redlineWearFactor), so you need it sooner.
  serviceItems: {
    petrol: [{ name: 'Oil change', cost: 1500 }, { name: 'Brake pads', cost: 1000 }, { name: 'Check: chain, tyres, lights', cost: 1000 }],
    electric: [{ name: 'Brake pads', cost: 1000 }, { name: 'Check: tyres, lights', cost: 1000 }],
  },
  serviceSeconds: 20,
  minServiceFraction: 0.05, // below this, the mechanic has nothing to do
};

// ---------------------------------------------------------------------------
// Traffic (milestone 3). Counts are for the district map. All guesses.
// ---------------------------------------------------------------------------
export const TRAFFIC = {
  counts: { car: 18, bus: 6, truck: 6, moto: 10 }, // default (tests); the game uses perDistrict
  ringGiveWayMetres: 11, // a vehicle that comes to a roundabout waits while a vehicle on the ring is this near
  ringPatienceSeconds: 6, // after this long it goes anyway, so the ring never locks up
  // Vehicles for each open district (× the level's traffic factor). The map grows, so traffic grows with it.
  perDistrict: { car: 8, bus: 3, truck: 2 },
  kinds: {
    // limitFactor: how they treat the speed limit (motos ride a little over it).
    car: { length: 4.2, width: 1.8, maxKmh: 50, accel: 2.5, brake: 6, limitFactor: 1.0, hillSlowdown: 1.0, minHillFactor: 0.5, exhaust: 0.5, variants: 5 },
    bus: { length: 5.0, width: 1.9, maxKmh: 45, accel: 1.8, brake: 5, limitFactor: 1.0, hillSlowdown: 1.6, minHillFactor: 0.35, exhaust: 1.0, variants: 2 },
    truck: { length: 7.0, width: 2.4, maxKmh: 35, accel: 1.0, brake: 4, limitFactor: 0.9, hillSlowdown: 2.4, minHillFactor: 0.18, exhaust: 2.0, variants: 3 },
    moto: { length: 2.0, width: 0.8, maxKmh: 55, accel: 3.5, brake: 7, limitFactor: 1.1, hillSlowdown: 0.8, minHillFactor: 0.5, exhaust: 0.6, variants: 1 },
    // Your hired riders on your electric motos: they keep to the speed limit, and an electric moto has no exhaust.
    fleet: { length: 2.0, width: 0.8, maxKmh: 50, accel: 3.5, brake: 7, limitFactor: 1.0, hillSlowdown: 0.6, minHillFactor: 0.6, exhaust: 0, variants: 1 },
    // Cyclists ride slowly at the edge of the road (laneOffset), so cars can pass them. Very slow uphill.
    cyclist: { length: 1.8, width: 0.6, maxKmh: 16, accel: 0.8, brake: 4, limitFactor: 1, hillSlowdown: 4, minHillFactor: 0.3, exhaust: 0, variants: 3, laneOffset: 3.6 },
  },
  turnKmh: 18,
  busStopSeconds: 5,
  // Vehicles that wait behind a bike that stands in the road honk (cyclists ring the bell).
  honk: {
    range: 12, // metres behind the bike
    ahead: 0.85, // how straight in front of the vehicle the bike must be (cosine of the angle)
    bikeStillMs: 0.6, // the bike stands still below this speed (m/s)
    vehicleStillMs: 1.0, // the vehicle waits below this speed (m/s)
    afterSeconds: 2.5, // the first honk after this long
    everySeconds: [2.5, 4.5], // then again after this long (a random time in the range)
  },
  // Drivers slow down for speed bumps (to HAZARDS.speedBump.safeSpeedKmh) and potholes (to this speed).
  potholeKmh: 25,
  hazardLookMetres: 12,
};

// ---------------------------------------------------------------------------
// People, street hails and rival riders (milestone 3). All guesses.
// ---------------------------------------------------------------------------
export const PEOPLE = {
  walkers: 40, // default (tests); the game uses walkersPerDistrict
  walkersPerDistrict: 20,
  looks: 10, // walker looks (see PERSON_LOOKS in vehicle-sprites.js); the last four are mamas in kitenge
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
  // A near miss: a person yells when a fast bike passes this close (a short, cute yell).
  yellDistance: 2.6, // metres
  yellSpeed: 4, // m/s (about 15 km/h)
  yellCooldown: 8, // seconds before the same person yells again
  yellGap: 1.5, // seconds between two yells (any people)
  leaveWords: ['MANA WE!', 'UMVA, BE SERIOUS!'], // out of fuel: the passenger gets off (Alp)
  yells: ['AYII!', 'WITONDE!', 'EH! EH!', 'MANA WE!', 'BUHORO!'], // Kinyarwanda: "be careful", "oh my God", "slowly"
  // The horn: people in front of the bike and this close step out of the way.
  honkRadius: 16, // metres
  honkDodgeSeconds: 1.3,
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
    shift: { start: 19, end: 23, realSeconds: 240 }, rent: 2500,
    traffic: 0.3, rivals: 2, cyclists: 0, raceChance: 0.15, offerLife: [30, 60], hailEvery: 0.6,
    fare: 1.2, petrol: 1.0, cameras: false,
    news: 'Night shift in Nyabugogo: quiet streets, few rivals, night fares +20%. Buses arrive at the bus park all night.',
  },
  {
    n: 2, name: 'Evening rider', goal: 25000, milestone: 'A smartphone and a spare passenger helmet', kind: 'asset', effect: 'phone',
    story: 'Your new phone shows more ride requests, and the spare helmet keeps your passengers safe. Uwase calls you on it to say well done.',
    shift: { start: 16, end: 23, realSeconds: 300 }, rent: 4500,
    traffic: 0.5, rivals: 4, cyclists: 0, raceChance: 0.25, offerLife: [25, 50], hailEvery: 0.6,
    fare: 1.3, petrol: 1.0, cameras: false,
    news: 'Kigali town opens: the city on the ridge above Nyabugogo. Evening rush, more traffic and more rivals.',
  },
  {
    n: 3, name: 'Day rider', goal: 40000, milestone: 'A year of school: fees, uniforms and books', kind: 'life',
    story: 'A full year of school is paid for Aline and Eric. Their new uniforms hang by the door, ready for Monday.',
    shift: { start: 6, end: 22, realSeconds: 420 }, rent: 5000,
    traffic: 0.8, rivals: 6, cyclists: 2, raceChance: 0.35, offerLife: [20, 45], hailEvery: 1,
    fare: 1.25, petrol: 1.1, cameras: true,
    news: 'Kacyiru opens: offices, the police headquarters and the hospital. Your phone now shows daily app quests and special jobs (gold). Speed cameras on, petrol +10%.',
  },
  {
    n: 4, name: 'Rush hour', goal: 60000, milestone: 'Your own Ampersand electric moto', kind: 'asset', effect: 'electric',
    buyAt: 'office', // you buy it at the Ampersand showroom, not at the end of the day
    story: 'You sign for your own Ampersand electric moto at the showroom. No more petrol queues and no more smoke. The whole family comes to see it.',
    shift: { start: 6, end: 22, realSeconds: 420 }, rent: 5000,
    traffic: 1.0, rivals: 10, cyclists: 2, raceChance: 0.45, offerLife: [15, 40], hailEvery: 1,
    fare: 1.45, petrol: 1.2, cameras: true,
    news: 'Kimihurura opens: the Convention Centre, Parliament and cobblestone lanes. Rush hour: heavy traffic, 10 rivals. Petrol +20%.',
  },
  {
    n: 5, name: 'Electric rider', goal: 120000, milestone: 'A plot of land', kind: 'life',
    story: 'You sign for a small plot of land in Kicukiro. The family walks round it in the evening: one day this will be the family house.',
    shift: { start: 6, end: 22, realSeconds: 420 }, rent: 0, // the moto is yours: no more rent from level 5
    traffic: 1.0, rivals: 12, cyclists: 3, raceChance: 0.5, offerLife: [15, 40], hailEvery: 1,
    fare: 1.5, petrol: 1.3, cameras: true,
    news: 'You ride electric now, and the moto is yours: no more rent. Kicukiro opens: busy junctions, workshops and trucks.',
  },
  {
    n: 6, name: 'City rider', goal: 170000, milestone: 'A second moto, with a hired rider', kind: 'asset', effect: 'rider1',
    story: 'Your cousin Jean-Paul rides your second moto now. Each evening he brings you his rent, and he is proud to work.',
    shift: { start: 6, end: 22, realSeconds: 420 }, rent: 0,
    traffic: 1.2, rivals: 14, cyclists: 3, raceChance: 0.55, offerLife: [12, 35], hailEvery: 0.8,
    fare: 1.6, petrol: 1.4, cameras: true, events: { umuganda: 0.34 },
    news: 'Nyarutarama opens: the golf course, the lake and big villas. On Umuganda days the roads are empty until 11:00, then everybody wants a moto.',
  },
  {
    n: 7, name: 'Rainy season', goal: 220000, milestone: 'Foundation and walls of a house', kind: 'life',
    story: 'The builders lay the foundation and the walls go up, brick by brick. Aline and Eric write their names in the wet cement.',
    shift: { start: 6, end: 22, realSeconds: 420 }, rent: 0,
    traffic: 1.2, rivals: 16, cyclists: 2, raceChance: 0.6, offerLife: [12, 35], hailEvery: 0.8,
    fare: 1.7, petrol: 1.5, cameras: true, events: { umuganda: 0.25, rain: 0.5 },
    news: 'The rainy season: on rainy days the murram is wet and slippery, but everybody wants a moto, and fares are higher.',
  },
  {
    n: 8, name: 'Match days', goal: 270000, milestone: 'A third moto, with a second hired rider', kind: 'asset', effect: 'rider2',
    story: 'A third moto joins your little fleet, and your neighbour Claudine rides it. People in the street start to call you "boss".',
    shift: { start: 6, end: 22, realSeconds: 420 }, rent: 0,
    traffic: 1.4, rivals: 18, cyclists: 3, raceChance: 0.65, offerLife: [10, 30], hailEvery: 0.7,
    fare: 1.8, petrol: 1.6, cameras: true, events: { umuganda: 0.25, rain: 0.35 },
    news: 'Heavy traffic all day and more rivals. Your hired rider pays you each evening: look after the fleet.',
  },
  {
    n: 9, name: 'Fleet owner', goal: 360000, milestone: 'Roof, doors and windows', kind: 'life',
    story: 'The roof goes on, with blue doors and big windows. When it rains now, the house stays dry.',
    shift: { start: 6, end: 22, realSeconds: 420 }, rent: 0,
    traffic: 1.5, rivals: 20, cyclists: 3, raceChance: 0.7, offerLife: [10, 30], hailEvery: 0.6,
    fare: 1.9, petrol: 1.7, cameras: true, events: { umuganda: 0.25, rain: 0.4 },
    news: 'You run a fleet of three motos. All the events of the city, and the toughest competition yet.',
  },
  {
    n: 10, name: 'Kigali legend', goal: 450000, milestone: 'Finish the house and move in', kind: 'life',
    story: 'The whole family moves into the new house. Uwase cooks for the neighbours, the children paint their rooms, and you park three motos by the gate. You are a Kigali legend.',
    shift: { start: 6, end: 22, realSeconds: 420 }, rent: 0,
    traffic: 1.6, rivals: 24, cyclists: 3, raceChance: 0.75, offerLife: [8, 25], hailEvery: 0.6,
    fare: 2.0, petrol: 1.8, cameras: true, events: { umuganda: 0.3, rain: 0.5 },
    news: 'The last goal: finish the house. Events come more often, and the city is at its busiest.',
  },
  {
    n: 11, name: 'Free play', goal: 0, milestone: 'Free play', kind: 'life', freePlay: true,
    story: 'You have done it. Ride on for the joy of it, and keep the fleet busy.',
    shift: { start: 6, end: 22, realSeconds: 420 }, rent: 0,
    traffic: 1.6, rivals: 24, cyclists: 3, raceChance: 0.75, offerLife: [8, 25], hailEvery: 0.6,
    fare: 2.0, petrol: 1.8, cameras: true, events: { umuganda: 0.3, rain: 0.5 },
    news: 'Free play: the house is finished. Ride for the joy of it.',
  },
];

// Daily app quests and side missions (on the phone, from level 3: after the smartphone milestone).
// Rewards grow with the level. All guesses, to tune in play.
export const MISSIONS = {
  fromLevel: 3,
  questsPerDay: 2,
  questReward: { base: 1000, perLevel: 600 }, // RWF for one quest: base + perLevel × level
  sideChance: 0.18, // when a new offer comes, the chance that it is a side mission (at most one on the board)
  vip: { payFactor: 2.2, bonusFactor: 0.8, minComfort: 85 }, // a VIP passenger: no fine, no crash, comfort ≥ 85%
  rush: { payFactor: 1.6, bonusFactor: 0.6, metresPerSecond: 7, extraSeconds: 25, latePayFactor: 0.5 }, // against the clock
  ikivuguto: { payFactor: 1.8, bonusFactor: 0.6, maxDamage: 0.1, kg: 20 }, // fermented milk in cans: do not spill it
  hotel: { payFactor: 2.5, bonusFactor: 0.7, metresPerSecond: 6.5, extraSeconds: 30 }, // a hotel guest in a hurry
  secretBonus: 2500, // a secret place, found once in a game
};

// Hired riders (levels 6 and 8: a second and a third moto). The rider rides your moto in the city and
// pays you a daily rent; you pay the service and repairs. Some days go badly. Guesses (from the spec).
export const FLEET = {
  rentPerDay: 6000, // the same rent you paid at level 1
  costPerDay: 600, // service of an electric moto
  badDayChance: 0.1, // about 1 day in 10: a crash (a repair) or no rent
  repair: [3000, 8000],
  helpChance: 0.35, // a day when the rider calls you for help (out of battery or a flat tyre)
  helpMinutes: 1.5, // real minutes to get to the rider; if you come, the day goes on; if not, no rent that day
  helpReward: 0, // the rent is the reward
  speedKmh: 30,
  names: ['Jean-Paul', 'Claudine'], // the hired riders, in the order you hire them (levels 6 and 8)
  helpRangeMetres: 6, // stop this near the rider to help
  helpStopKmh: 8, // and this slow
  helpWorkSeconds: 3, // the time to fix the problem
  callDistance: [120, 350], // metres from you: where the rider waits for help
  jobSeconds: [25, 70], // on the map, a rider carries a passenger for this long, then looks for the next one
};

// Difficulty modes (spec "Difficulty modes"): you choose one at a new game. Each mode is a year of the city:
// fewer rules and less traffic in 2010, all the cameras, lights and police in 2020.
// fuelUse and wear multiply the fuel use and the service meter (wear 0: no wear and no breakdowns);
// hazards: the share of the potholes and loose rocks on the map; traffic multiplies the cars, buses and trucks;
// crashRepair multiplies crash repairs; lights: 'none', 'lights' (no red light cameras) or 'cameras'.
// All values are guesses, to tune in play.
export const MODES = {
  easy: {
    name: 'Kigali 2010', short: 'EASY', gears: 'auto', fuelUse: 0.8, wear: 0, cameras: false, police: false,
    hazards: 0.5, traffic: 0.7, crashRepair: 0.5, lights: 'none', riderEnergy: false, helmetChecks: false,
    text: 'Automatic gears, low fuel use, no wear, no cameras and no police fines, light traffic.',
  },
  medium: {
    name: 'Kigali 2015', short: 'MEDIUM', gears: 'choice', fuelUse: 1, wear: 1, cameras: true, police: true,
    hazards: 1, traffic: 1, crashRepair: 1, lights: 'lights', riderEnergy: false, helmetChecks: false,
    text: 'The normal game: gears of your choice, wear, speed cameras, police, traffic lights.',
  },
  hard: {
    name: 'Kigali 2020', short: 'HARD', gears: 'manual', fuelUse: 1.15, wear: 1.3, cameras: true, police: true,
    hazards: 1, traffic: 1.25, crashRepair: 1, lights: 'cameras', riderEnergy: true, helmetChecks: true,
    text: 'Manual gears, more fuel and wear, heavy traffic, red light cameras, helmet checks, and you must eat to keep your energy.',
  },
};
export const DEFAULT_MODE = 'medium'; // a saved game from before the modes plays as medium

// Rider energy (hard mode, Kigali 2020): the rider gets hungry. Energy goes down with the game clock
// (faster when you push the bike), and food brings it back. Below hungryAt the moto has less power; at 0
// the rider is weak. Food stops: a buffet lunch (from 11:00), ikivuguto at an Inyange Milk Zone (fills
// you the most), bananas from a market seller, an energy drink at an MTN MoMo kiosk (quick, but it
// fills you less and wears off: energy goes down faster for an hour). All values are guesses.
export const RIDER = {
  startEnergy: 0.9, // breakfast at home
  drainPerHour: 0.075, // energy (0..1) for each game hour
  pushDrainFactor: 3, // pushing the bike is hard work
  hungryAt: 0.3, hungryPower: 0.85,
  weakPower: 0.55, // at 0 energy
  foods: {
    buffet: { name: 'Buffet lunch', price: 1200, energy: 0.6, seconds: 25, fromHour: 11, toHour: 16 },
    ikivuguto: { name: 'Ikivuguto', price: 800, energy: 0.75, seconds: 8, slowHours: 3, slowFactor: 0.6 },
    bananas: { name: 'Bananas', price: 200, energy: 0.2, seconds: 3 },
    drink: { name: 'Energy drink', price: 700, energy: 0.35, seconds: 2, crashHours: 1, crashFactor: 1.8 },
  },
};

// Traffic lights at the big junctions (medium and hard modes). Each light has two phases: the roads
// along x, then the roads along y (green, amber, then all red for a moment). Cars, buses and trucks stop
// at the stop line on red. Riding through a red light: a fine, only when a red light camera (hard mode)
// or a police officer near the junction sees you (decision by Alp). All values are guesses.
export const TRAFFIC_LIGHTS = {
  perDistrict: 2, minSpacingTiles: 22,
  greenSeconds: 12, amberSeconds: 3, allRedSeconds: 1.5,
  stopMetres: 6, // the stop line: this far before the centre of the junction
  boxMetres: 4.5, // the junction box (half its width)
  fine: 10000, officerRangeMetres: 30,
};

// Police helmet checks (hard mode). Each day a few officers in the open districts run a check. With a
// passenger on board you must stop beside the officer (within stopSeconds). The passenger needs a helmet:
// the spare helmet from the level 2 milestone. Ride on, or no passenger helmet: a fine. Guesses.
export const HELMET_CHECKS = {
  perDay: 4, rangeMetres: 10, stopMetres: 7, stopSeconds: 5, checkSeconds: 4, fine: 10000,
};

// Shops and street life (Alp): a share of the shop buildings get a painted sign with a picture and a
// name (world/shops.js). kinds: how often each kind of shop comes (barbershops are the most common).
// placeEvery: every n-th shop is also a job place (all buffets are job places and food stops).
export const SHOPS = {
  share: 0.4,
  kinds: { barber: 5, saloon: 3, bar: 3, butcher: 2, shoes: 1.2, phones: 1.5, boutique: 2.5, buffet: 1.5 },
  placeEvery: 3,
  mannequins: 2, // in front of each boutique
};

// Parts and upgrades at the garages (Alp: parts that bring better tips and a longer service life).
// From the moto shop brainstorm in the spec. level: the level where the part comes to the shop.
// only: 'petrol' or 'electric' (petrol engine parts do not move to the electric moto).
// The effects multiply: wear (service meter), rough (wear on murram, potholes, off road), comfortHit
// (comfort lost on bumps), fragile (cargo damage), crash (crash repairs), fuel, regen; tipExtra: an extra
// tip as a share of the fare (times the comfort); longTripTip: the same, for trips longer than longTripKm.
// Prices (Alp: a bit cheaper, for example 3,000 RWF for a speaker) and effects are guesses, to tune in play.
export const SHOP = {
  longTripKm: 5,
  items: [
    { id: 'speaker', name: 'Bluetooth speaker', price: 3000, level: 2, effect: { tipExtra: 0.1 }, text: 'Passengers like music: an extra tip of up to 10% of the fare.' },
    { id: 'cushion', name: 'Seat cushion', price: 1500, level: 2, effect: { comfortHit: 0.7 }, text: 'Potholes and speed bumps cost 30% less comfort.' },
    { id: 'chain', name: 'O-ring chain kit', price: 3500, level: 2, only: 'petrol', effect: { wear: 0.8 }, text: 'The service meter fills 20% slower. Petrol moto only.' },
    { id: 'filter', name: 'Air filter and tune up', price: 2000, level: 2, only: 'petrol', effect: { fuel: 0.92 }, text: 'Fuel use 8% lower. Petrol moto only.' },
    { id: 'tyres', name: 'Better tyres', price: 4500, level: 3, effect: { rough: 0.7, wetGrip: 0.1 }, text: '30% less wear on murram, potholes and off road, and more grip on wet murram.' },
    { id: 'net', name: 'Cargo net and straps', price: 1000, level: 3, effect: { fragile: 0.5 }, text: 'Bananas and ikivuguto get 50% less damage.' },
    { id: 'crashbars', name: 'Crash bars', price: 2500, level: 3, effect: { crash: 0.6 }, text: 'Crash repairs cost 40% less.' },
    { id: 'charger', name: 'Phone charger for passengers', price: 1500, level: 3, effect: { longTripTip: 0.05 }, text: 'An extra tip of up to 5% on trips longer than 5 km.' },
    { id: 'pads', name: 'Ceramic brake pads', price: 2500, level: 4, effect: { wear: 0.9 }, text: 'The brake pads last longer: the service meter fills 10% slower.' },
    { id: 'bearings', name: 'Sealed wheel bearings', price: 4000, level: 5, effect: { wear: 0.85 }, text: 'The service meter fills 15% slower.' },
    { id: 'regen', name: 'Ampersand regen tune', price: 3000, level: 5, only: 'electric', effect: { regen: 1.2 }, text: 'Regen braking gives back 20% more. Electric moto only.' },
  ],
  // What the mechanic says when you come in (one line, chosen by the garage).
  talk: ['Muraho! A good speaker brings good tips.', 'Good tyres love murram.', 'Service on time, and the moto lives long.', 'Ceramic pads, smooth stops.', 'Bite the road, not the dust!'],
};

// Day events (from level 6). A level's `events` gives the chance of each event on a day; one event at most.
// The numbers are guesses, to tune in play.
export const EVENTS = {
  // Umuganda: the community work morning. No customers and almost no traffic until endHour, then a rush.
  umuganda: {
    endHour: 11, rushEndHour: 13,
    trafficShare: 0.15, // the share of the traffic on the road in the morning
    rushFare: 1.3, rushExtraOffers: 1, rushHailEvery: 0.5, // extra offers up to JOBS.maxOffersShown; twice the street hails
    wakeMetres: 70, // vehicles come back on the road only this far from you (they do not pop up in view)
  },
  // Rain: the murram is wet (SURFACES.murramWet), the light is grey, more people want a moto.
  rain: {
    fare: 1.25, hailEvery: 0.6,
    tint: [0.72, 0.76, 0.82], // a grey-blue colour multiplier on the daylight
    drops: 140, // rain streaks on the screen
    dropColour: 0xbcd0e0, dropAlpha: 0.55, fallPxPerSecond: 260, slantPx: 0.35,
  },
};

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
  startLevel: 0.6, // tank or battery at the start of a new game (0.45 was only enough for about one job)
  idleUse: 0.08, // fraction of the full throttle use while the engine runs with no throttle (petrol only)
  lowAt: 0.25, // "Fuel low": the HUD arrow points to the nearest station
  reserveAt: 0.1, // "Reserve!"
  // Buying fuel: fixed amounts, your choice (not from the jobs): a quarter or a half of a tank, or a full tank.
  // At the base price, 25% of a tank is 1,000 RWF. Job cards still show the fuel that each job needs.
  buySteps: [0.25, 0.5],
  tankLitres: 2.5, // the game tank: a full tank is 4,000 RWF, so 1 litre is about 1,600 RWF (Kigali price, about) — guess
  // The estimate for a known job, as a fraction of the tank or the battery (measured in a test ride with
  // stops; see test/fuel.test.js). The electric moto goes further: a bigger battery and no gears.
  flatTankPerKm: { petrol: 0.19, electric: 0.1 }, // riding on the flat with no load
  tankPerClimbMetre: { petrol: 0.001, electric: 0.0006 }, // each metre of climb (the engine works harder)
  margin: 1.15,
  roundToRwf: 100, // fuel is sold in round amounts
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

// The minimap in the lower left corner (key M shows or hides it). Like in GTA, it shows the area
// around you and moves as you ride. It does not turn.
export const MINIMAP = {
  pxPerTile: 1, // virtual HUD pixels along each diagonal for one tile (the HUD scales them up by a whole number)
  viewWidth: 124, // the window, in virtual HUD pixels
  viewHeight: 72,
  heightContrast: 0.45, // higher ground is up to this much lighter
  padlockSpacing: 40, // map pixels between the padlocks on a closed district
};

// Market life (see MarketView.js): vendors on mats and goats and sheep for sale. Guesses.
export const MARKET = {
  vendorChance: 0.3, // part of the free market tiles with a vendor
  herdChance: 0.05, // part of the free market tiles with 2 or 3 goats (some sheep)
  umbrellaChance: 0.4, // vendors under a big umbrella
  streetVendorChance: 0.03, // pavement tiles in the street districts with a vendor
  streetDistricts: ['nyabugogo', 'kicukiro'],
  clearTiles: 2.5, // no vendors this close to a job place (the markers stay clear)
  vendorRadius: 0.6, // metres, for collisions
  animalRadius: 0.35,
};

// MTN MoMo agents (mobile money and airtime): a lady in a yellow vest at a yellow stand under a
// yellow umbrella, on pavements across the city. For now they are only decoration; later levels
// use them to buy airtime. Guesses.
export const MOMO = {
  chance: 0.06, // part of the pavement tiles beside a road that are a possible place
  minTiles: 12, // tiles between two agents (48 m)
  clearTiles: 3, // no agent this close to a job place or a station
  radius: 0.6, // metres, for collisions
};

// Traffic police on the corners of the junctions (decoration; later levels add helmet checks).
export const POLICE = {
  repathSeconds: 0.5, // a chasing officer finds a new way around the buildings this often
  pathTiles: 12, // the path search looks this many tiles around the officer and the target
  pathMaxNodes: 1500,
  jailKmh: 15, // hit an officer at this speed or more: jail, and the game is over — guess
  jailDelaySeconds: 2.5, // the time from the hit to the game over screen
  postFlashMs: 450, // the light on the POLICE post changes between blue and red
  junctionChance: 0.8, // part of the junctions with an officer
  radius: 0.35, // metres, for collisions
  whistleKmh: 10, // the officer blows the whistle when you pass faster than the limit + this
  whistleRange: 8, // metres
  // Riding on the pavement or off road near an officer: a chase, and a fine if you get caught. Guesses.
  seeMetres: 14, // the officer sees you this close
  ridingKmh: 6, // faster than this is riding (slower is walking or pushing the bike)
  runKmh: 22, // the officer runs fast: you get away only on a good road
  walkKmh: 5, // back to the corner
  catchMetres: 1.6,
  giveUpMetres: 30,
  maxChaseSeconds: 12,
  cooldownSeconds: 20, // after a fine, no new chase for this long
  fine: 5000, // RWF
  graceMetres: 8, // no chase this close to your job target or a station (you pull in to stop)
};
