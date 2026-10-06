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
  },
};

// ---------------------------------------------------------------------------
// Physics shared by all bikes (arcade, not simulation)
// ---------------------------------------------------------------------------
export const PHYSICS = {
  gravity: 9.81,
  // Arcade factor on the slope force. At 1.0 a 37% ramp nearly stops the petrol bike.
  hillFactor: 0.5,
  // A grade at or above this value counts as "fully uphill" for the energy factor.
  fullUphillGrade: 0.2,
  rollingDragMs2: 0.25,
  airDragPerMs: 0.004, // extra deceleration per m/s of speed
  coastDragMs2: 0.6, // extra drag when you do not press throttle (engine braking)
  // Steering
  maxTurnRateRad: 3.4, // rad/s at low speed
  turnRateAtTopSpeed: 0.45, // fraction of maxTurnRate left at top speed
  minSpeedToTurnMs: 0.4,
  // Grip: how fast sideways velocity is removed (1/s) at grip 1.0.
  // Lower grip lets the bike slide on wet murram.
  lateralGripRate: 10,
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
  tarmac: { name: 'Tarmac', grip: 1.0, speedFactor: 1.0, energyFactor: 1.0 },
  cobble: { name: 'Cobblestone', grip: 0.85, speedFactor: 0.9, energyFactor: 1.1 },
  murram: { name: 'Murram, dry', grip: 0.7, speedFactor: 0.75, energyFactor: 1.25 },
  murramWet: { name: 'Murram, wet', grip: 0.45, speedFactor: 0.6, energyFactor: 1.4 },
  grass: { name: 'Grass verge', grip: 0.6, speedFactor: 0.45, energyFactor: 1.5 }, // guess, not in spec
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
