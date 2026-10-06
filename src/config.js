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
    energySeconds: 6 * 60, // full bar at full throttle on flat tarmac — spec "about 6 min"
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
    energySeconds: 8 * 60, // spec "about 8 min, plus regen"
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
  brakePads: 3000, // new pads — guess
  replacePadsBelow: 0.5, // the mechanic replaces pads below this level at day end
  servicePerGameKm: { petrol: 25, electric: 5 }, // oil, chain, engine wear, per game km of tarmac; × the surface wearFactor — guess
  repairs: { pothole: 300, bumpHard: 500, wall: 800 }, // damage — guess
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
  comfortLoss: { pothole: 20, bumpHard: 15, wall: 35, hardBrakePerSecond: 25, offRoadPerSecond: 10 },
  cargoDamage: { pothole: 0.1, bumpHard: 0.1, wall: 0.3, offRoadPerSecond: 0.03 },
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
