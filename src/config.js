// All tunable values for the prototype live here, so you can tune the game
// without code changes. Units are metric: metres, seconds, km/h.
// Values marked "guess" come from the spec's first guesses and need playtests.

// ---------------------------------------------------------------------------
// World scale and projection
// ---------------------------------------------------------------------------
// The game version (the menu shows it).
export const VERSION = '1.0 RC2';

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
  // Buildings that hide things fade (Alp, 14 October 2026: "behind big buildings you cannot see the road"):
  // the buildings in front of the bike, of the road ahead (points every seeAheadStep metres up to
  // seeAheadMetres, in the direction you ride) and of the job pin (when it is this near).
  seeAheadMetres: 24,
  seeAheadStep: 6,
  seePinMetres: 70,
  fadeAlpha: 0.25, // a building that hides the bike or the road ahead (before: 0.45)
  fadeSeconds: 0.2, // the time to fade out or back in
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
  runway: { name: 'Runway', grip: 1.0, speedFactor: 1.0, energyFactor: 1.0, rollingMs2: 0.25, wearFactor: 1.0 }, // behind the airport fence
  apron: { name: 'Apron', grip: 1.0, speedFactor: 1.0, energyFactor: 1.0, rollingMs2: 0.25, wearFactor: 1.0 },
  water: { name: 'River', grip: 0, speedFactor: 0, energyFactor: 1, rollingMs2: 9, wearFactor: 1 }, // solid: you cannot ride here
};

// The Motari lesson (level 1, sim/lesson.js): Rukundo Thacien phones you with tips. Values are a first guess.
export const LESSON = {
  helloAfterSeconds: 2, // he calls this long after the shift starts
  ringSeconds: 1.2, // the phone rings this long before he talks
  lineSeconds: 1.6, // each line shows this long ...
  secondsPerChar: 0.055, // ... plus this for each letter (time to read)
  charsPerSecond: 40, // the line types out at this speed
  gapSeconds: 6, // at least this long between two calls
  fuelBelow: 0.4, // the fuel tip: the tank under this
  serviceFrom: 0.5, // the service tip: the service meter from this (1 = service due)
  overLimitKmh: 8, // the speed tip: this much over the limit ...
  officerNearMetres: 25, // the police tip: an officer this near
  bumpLookMetres: 14, // the speed bump tip: a bump this far ahead
  byeAfterTips: 9, // he says goodbye after this many tips
};

// The babble voice (sim/babble.js): speech sounds without words, for Rukundo on the phone (muffled) and for
// the lines of the rider in bubbles. Seconds; pitch values are factors. Guesses, tuned by ear.
export const BABBLE = {
  syllableSeconds: [0.075, 0.115], // the length of one syllable (from, to)
  inWordGap: 0.012, wordGap: 0.05, commaPause: 0.16, stopPause: 0.26,
  maxPerWord: 4, // at most this many syllables in one word
  fall: 0.16, // the pitch goes down this much over a sentence
  wobble: 0.1, // a random change of pitch for each syllable
  questionRise: 0.28, shoutRise: 0.08,
  phone: { basePitchHz: 118, volume: 0.5, lowCutHz: 380, highCutHz: 1700 }, // Rukundo on the phone: a low voice, muffled
  rider: { basePitchHz: 135, volume: 0.32, lowCutHz: 160, highCutHz: 3200, maxSeconds: 1.4 }, // you, in a bubble
  // The sounds while you eat or drink at a food stop: one each 'every' seconds.
  food: { bananas: { sound: 'munch', every: 0.42 }, buffet: { sound: 'munch', every: 0.55 }, ikivuguto: { sound: 'gulp', every: 0.6 }, drink: { sound: 'gulp', every: 0.4 } },
};

// Wet murram is very slippery (Alp, 14 October 2026): a turn at speed makes the bike slide; a hard
// turn at speed, held, makes it fall. The turn load is the speed times the turn rate (m/s²). Guesses.
// Better tyres (wetGrip) move both limits up.
export const WET_MURRAM = {
  slideMs2: 12, // from this turn load the rear slides out (about a full turn at 15 km/h)
  slideKick: 0.45, // how much of the extra load pushes the bike sideways
  fallMs2: 18, // from this turn load, held for fallSeconds, the bike falls (about a full turn at 24 km/h)
  fallSeconds: 0.15, // a hard turn slows the bike fast, so the time is short
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
  // The swap stations (design canvas "Ampersand swap stations"): the darker tones of Surge Yellow for the
  // ribs, rails and the dark face; the charge lights; the uniform blue of the station staff (a guess, not
  // the police blue).
  ampersandYellowMid: 0xd9bd03,
  ampersandYellowDark: 0xab9603,
  chargeGreen: 0x44bc9d,
  chargeRed: 0xec5825,
  ampersandBlue: 0x22408a,
  ampersandBlueDark: 0x162b5e,
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
  // The muzungu (a foreign visitor): light skin, light brown hair, khaki shorts.
  visitorSkin: 0xf2c6a8, visitorHair: 0x7a5230, khaki: 0xc8a060,
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
  // Trees: a light and a deep colour for each crown (each in its tones), the outline, and the bark.
  figLeaf: 0x6bbf55, figDeep: 0x3d8a34, figInk: 0x1f3a1a,
  acaciaLeaf: 0x87a844, acaciaDeep: 0x5a7a2a, acaciaInk: 0x2a3a14,
  jacaranda: 0xb89ae0, jacarandaDeep: 0x7a5ab0, jacarandaInk: 0x2e2048, jacarandaLeaf: 0x4f7f3a,
  avocadoLeaf: 0x58904a, avocadoDeep: 0x2c5f2c, avocadoInk: 0x13301a, avocadoFruit: 0x6a8a2a,
  palmLeaf: 0x78c058, palmDeep: 0x3f8a34, palmInk: 0x1a3418, palmTrunk: 0x8a7a62, palmSkirt: 0x9a7448,
  bark: 0x5a3a22,
  // The moto riders: the safety vest (not Surge Yellow), its reflective band, the visor, the red moto.
  vest: 0xd4e83a, reflect: 0xe8e8e8, visor: 0x9fd3f0, motoRed: 0x8c2b23,
  // Road signs
  signWhite: 0xffffff, signRed: 0xd0302a, signBlue: 0x1f5fb0,
};

// The UI palette: the HUD, the menus, the day end and the HUD icons (the retro 16-bit windows). The UI is
// flat and on top of the world, so it does not use the light rule; all its colours come from here.
export const UI_PALETTE = {
  // Text
  white: 0xffffff, dim: 0xa8b0e0, green: 0x7fe0b8, gold: 0xffc85a, red: 0xf05a40, orange: 0xf0a040, grey: 0x7a80a0,
  textShadow: 0x0a0a28,
  // Windows: the blue gradient (top to bottom) and the dark one, the frame (black, light, mid).
  blueBands: [0x3050c0, 0x2a48b0, 0x2440a0, 0x1e3890, 0x183080, 0x142870, 0x102060],
  darkBands: [0x1a1e2e, 0x181c2a, 0x161a26, 0x141822, 0x12161e],
  frame: 0x000000, frameLight: 0xe8e8f8, frameMid: 0x9098c8, darkFrameLight: 0x8088a8, darkFrameMid: 0x4a5068,
  // Bars, screens behind windows, touch buttons.
  barEmpty: 0x2a2e40, petrol: 0xec5825, water: 0x4a78e0, veil: 0x060818, helpBack: 0x0a0c18,
  storyCard: 0x0f3a2a, road: 0xd8d6cc, signRed: 0xd0302a, signBlink: 0xffb080, signInk: 0x101010,
  // HUD icons (9 × 9 px): the letters of the icon maps. 'c' (Surge Yellow) is only on the battery.
  icon: { k: 0x0a0a1a, w: 0xf2f2f2, s: 0x9098a8, r: 0xe04a30, o: 0xf08a24, y: 0xf0c040, g: 0x58c040, d: 0x2f7a2a, b: 0x4a78e0, n: 0x8a5a30, t: 0xd8c090 },
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
  cabinetSeconds: 8, // a swap cabinet: you swap the battery yourself (design canvas "Ampersand swap stations"; a guess)
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
  hazardWearKm: { pothole: 2, puddle: 2, rocksHard: 1, bumpHard: 1.5, wall: 4 }, // extra km on the service meter for each hit
  // A crash (Alp: it must show on the service meter): a part of the whole meter, more for a harder hit.
  // share = base + perKmh × (impact km/h − COLLISION.crashSpeedKmh), up to max. Crash bars make it smaller. Guesses.
  crashWear: { base: 0.1, perKmh: 0.006, max: 0.3 },
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
  // Alp (14 October 2026): a lot more traffic, mostly small cars, then pickups and trucks: about 3 times
  // the vehicles of before (design canvas "Kigali traffic and people").
  perDistrict: { car: 16, pickup: 4, lorry: 3, truck: 2, tipper: 1, bus: 4 },
  // Motos that do not race you for customers (taxi: a moto taxi that has a passenger or a load already;
  // amp: an Ampersand rider on a red Alpha). Their sum for each open district; the Ampersand share grows
  // with the levels (the story arc: the city goes electric). The rival riders (levels) come on top.
  motosPerDistrict: 10,
  ampShare: [0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.42, 0.5], // level 1 to 10 (free play: the last)
  kinds: {
    // limitFactor: how they treat the speed limit (motos ride a little over it).
    // family: the kind of sound, lights and bounce (car, bus, truck, moto); none = the kind itself.
    car: { length: 4.2, width: 1.8, maxKmh: 50, accel: 2.5, brake: 6, limitFactor: 1.0, hillSlowdown: 1.0, minHillFactor: 0.5, exhaust: 0.5, variants: 12, electricVariants: [10, 11] }, // 10, 11: new electric cars (no exhaust)
    // An old pickup (Hilux): a load or people in the open back.
    pickup: { length: 4.9, width: 1.8, maxKmh: 50, accel: 2.2, brake: 6, limitFactor: 1.0, hillSlowdown: 1.3, minHillFactor: 0.45, exhaust: 0.8, variants: 4, family: 'car' },
    // A short truck (Canter, Elf) with wooden sides and sacks piled high.
    lorry: { length: 5.6, width: 2.1, maxKmh: 40, accel: 1.4, brake: 5, limitFactor: 0.95, hillSlowdown: 2.0, minHillFactor: 0.25, exhaust: 1.6, variants: 3, family: 'truck' },
    // A big old tipper with sand or murram for the building sites.
    tipper: { length: 8.0, width: 2.5, maxKmh: 32, accel: 0.9, brake: 4, limitFactor: 0.9, hillSlowdown: 2.8, minHillFactor: 0.15, exhaust: 2.6, variants: 2, family: 'truck' },
    // A moto taxi that is busy (a passenger, bananas or rice): it does not race you for customers.
    taxi: { length: 2.0, width: 0.8, maxKmh: 55, accel: 3.5, brake: 7, limitFactor: 1.1, hillSlowdown: 0.8, minHillFactor: 0.5, exhaust: 0.6, variants: 3, family: 'moto' },
    // An Ampersand rider on a red Alpha: quiet, no exhaust; sometimes with a passenger.
    amp: { length: 2.0, width: 0.8, maxKmh: 55, accel: 3.8, brake: 7, limitFactor: 1.0, hillSlowdown: 0.6, minHillFactor: 0.6, exhaust: 0, variants: 2, family: 'moto' },
    bus: { length: 5.0, width: 1.9, maxKmh: 45, accel: 1.8, brake: 5, limitFactor: 1.0, hillSlowdown: 1.6, minHillFactor: 0.35, exhaust: 1.0, variants: 2 },
    truck: { length: 7.0, width: 2.4, maxKmh: 35, accel: 1.0, brake: 4, limitFactor: 0.9, hillSlowdown: 2.4, minHillFactor: 0.18, exhaust: 2.0, variants: 3 },
    moto: { length: 2.0, width: 0.8, maxKmh: 55, accel: 3.5, brake: 7, limitFactor: 1.1, hillSlowdown: 0.8, minHillFactor: 0.5, exhaust: 0.6, variants: 1 },
    // Your hired riders on your electric motos: they keep to the speed limit, and an electric moto has no exhaust.
    fleet: { length: 2.0, width: 0.8, maxKmh: 50, accel: 3.5, brake: 7, limitFactor: 1.0, hillSlowdown: 0.6, minHillFactor: 0.6, exhaust: 0, variants: 1, family: 'moto' },
    // Cyclists ride slowly at the edge of the road (laneOffset), so cars can pass them. Very slow uphill.
    cyclist: { length: 1.8, width: 0.6, maxKmh: 16, accel: 0.8, brake: 4, limitFactor: 1, hillSlowdown: 4, minHillFactor: 0.3, exhaust: 0, variants: 3, laneOffset: 3.6 },
    // Police patrol cars (the Umuganda mission): they drive only on the main roads (mainRoads), not on murram.
    police: { length: 4.3, width: 1.8, maxKmh: 40, accel: 2.5, brake: 6, limitFactor: 1.0, hillSlowdown: 1.0, minHillFactor: 0.5, exhaust: 0.4, variants: 2, mainRoads: true, family: 'car' },
    // VIP convoy cars: big black cars; they follow a planned route on the main roads.
    vip: { length: 4.8, width: 1.9, maxKmh: 60, accel: 3.0, brake: 7, limitFactor: 1.2, hillSlowdown: 0.6, minHillFactor: 0.6, exhaust: 0.3, variants: 1, mainRoads: true, family: 'car' },
  },
  turnKmh: 18,
  ringKmh: 25, // the speed on a roundabout ring (a guess)
  busStopSeconds: 5,
  // Crossing traffic (sim/traffic.js): a vehicle brakes for a vehicle that is in its path now, or will be
  // in this many seconds. After crossPatienceSeconds of waiting for turned or crossing traffic it goes anyway, so nothing locks up.
  crossLookSeconds: 0.6,
  waitFrontMetres: 3.2, // at a junction or a roundabout, a vehicle waits with its front this far from the middle of the node
  crossLookMetres: 4, // and only this near (+ 2 × crossLookSeconds of its own speed): a crossing vehicle soon leaves the path
  crossPatienceSeconds: 5,
  crossGoSeconds: 2.5, // then it does not brake for turned or crossing traffic for this long
  // A real crash between two vehicles (Alp, 14 October 2026). Values are a first guess.
  crash: {
    conflictMetres: 2, // a conflict: the free gap is less than this ...
    conflictKmh: 12, // ... and the vehicle closes at more than this speed
    chance: 0.1, // the chance that a conflict is a crash
    nearMetres: 80, // only this near the bike (you see it)
    everySeconds: 240, // at most one crash in this time
    seconds: 20, // the two vehicles stand still this long, while the drivers argue
    notKinds: ['police', 'vip', 'fleet', 'cyclist'], // these do not crash (the patrols, the convoy, your riders, bicycles)
    swerveAfterSeconds: 1.5, // a vehicle behind the crash waits this long, then drives round it
    swerveKmh: 12, // at this speed
    swerveRate: 1.5, // metres a second to the side
    argueEverySeconds: 1.6, // the drivers shout in turn
    // What they shout (Kinyarwanda and English; a guess): "Reba!" look!, "Wewe!" you!, "Umva!" listen!,
    // "Ni wowe!" it is you!, "Oya!" no!
    argueWords: ['EH!', 'REBA!', 'WEWE!', 'UMVA!', 'NI WOWE!', 'OYA!', 'MY CAR!', 'POLICE!'],
  },
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
  walkersPerDistrict: 50, // Alp (14 October 2026): many more people on the streets (was 20)
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
  crashWords: ['AYA!', 'MANA WE!', 'NEVER AGAIN!'], // a crash with a passenger: the passenger gets off and does not pay (guesses)
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
    n: 4, name: 'Rush hour', goal: 60000, milestone: 'Your own Ampersand electric moto', kind: 'asset', effect: 'alphaReady',
    // Bought at the day end as the other milestones. The Alpha waits at the Ampersand HQ in Gikondo: you
    // get it in a mission at the start of level 5 (sim/hq.js), then the moto is electric (perks.electric).
    story: 'You sign for your own Ampersand Alpha. The factory in Gikondo gets it ready for you: tomorrow you trade in the old petrol moto and ride the Alpha home. The whole family will come to see it.',
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
    news: 'Kicukiro opens: busy junctions, workshops and trucks. Your Alpha is ready at the Ampersand HQ in Gikondo: ride there, trade in the old moto and ride the Alpha out. The moto is yours: no more rent.',
    hqNews: 'You ride electric now: no petrol, no smoke, and strong, quiet power from 0 km/h. Swap the battery at the yellow Ampersand stations.',
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
// Hard mode challenges (spec "More places for fines and challenges"). Fines only on hard mode (Alp);
// in the other modes a warning. Traffic keeps to the one-way streets in every mode.
export const HARD_RULES = {
  fine: 10000,
  // Mobile speed checks: a parked police car at the roadside with a radar. Seen within radiusMetres.
  speedChecks: { fromLevel: 3, perDay: 3, radiusMetres: 20, offset: 4.4 },
  // One-way streets (dir: +1 = towards +x or +y on the map) and streets where motos may not ride.
  oneWay: [{ name: 'Town north street', dir: 1 }, { name: 'Town south street', dir: -1 }],
  // No motos on the road from the US Embassy roundabout to the President's office. No job place is on it.
  noMoto: ['Embassy road south'],
  // Overloading: a moto may carry up to limitKg. On hard mode some cargo offers are heavy (more pay):
  // heavyExtraKg more than the limit.
  overload: { limitKg: 80, heavyShare: 0.25, heavyExtraKg: [10, 50], heavyPay: 1.35 },
  // Stopping at a bus stop (the minibuses need it): a fine when an officer sees you.
  busStop: { metres: 5, stopSeconds: 2.5, officerMetres: 30 },
  // The bathroom need (hard mode): the WC bar fills with the clock, faster after drinks. Full: less
  // power (you cannot sit still). Stop at a toilet (stations, buffets, the bus park) to empty it.
  bladder: { perHour: 0.08, drink: 0.25, ikivuguto: 0.2, urgentAt: 0.8, fullPower: 0.85, metres: 9, stopSeconds: 1.5, cost: 200 },
};

// Street events (spec "More traffic in later levels"): road works, VIP convoys, car free mornings.
export const ROAD_EVENTS = {
  // Road works: a dug-up strip at the edge of a main road, cones, a sign and two workers. Traffic slows.
  works: { fromLevel: 3, chancePerDistrict: 0.6, minEdgeMetres: 40, lengthMetres: 12, offset: 3.3, kmh: 18, radiusExtra: 6 },
  // A VIP convoy: a police car in front of black cars, fast, on the main roads. Pull over and stop.
  vip: { fromLevel: 5, chance: 0.5, cars: 3, gapMetres: 9, kmh: 55, minMetres: 500, seeMetres: 60, pullOverMetres: 14, stopKmh: 8, fine: 10000 },
  // Car free morning (like Kigali Car Free Day): the Kacyiru boulevard is closed to motor traffic,
  // people jog and cycle on it. No motos: on hard mode an officer chases you (a fine); else a warning.
  carFree: { fromLevel: 4, chance: 0.2, fromHour: 7, toHour: 10, roads: ['Kacyiru boulevard'], joggers: 12 },
};

export const MISSIONS = {
  fromLevel: 3,
  questsPerDay: 2,
  questReward: { base: 1000, perLevel: 600 }, // RWF for one quest: base + perLevel × level
  sideChance: 0.18, // when a new offer comes, the chance that it is a side mission (at most one on the board)
  vip: { payFactor: 2.2, bonusFactor: 0.8, minComfort: 85 }, // a VIP passenger: no fine, no crash, comfort ≥ 85%
  rush: { payFactor: 1.6, bonusFactor: 0.6, metresPerSecond: 7, extraSeconds: 25, latePayFactor: 0.5 }, // against the clock
  ikivuguto: { payFactor: 1.8, bonusFactor: 0.6, maxDamage: 0.1, kg: 20 }, // fermented milk in cans: do not spill it
  // The network (story arc, from level 5): carry charged Ampersand batteries from the Ampersand HQ or a swap station
  // to another swap station. Do not drop them (damage under maxDamage). Each delivery grows the network.
  batteries: { fromLevel: 5, payFactor: 2.0, bonusFactor: 0.8, maxDamage: 0.15, kg: 40 },
  hotel: { payFactor: 2.5, bonusFactor: 0.7, metresPerSecond: 6.5, extraSeconds: 30 }, // a hotel guest in a hurry
  // Umuganda run (Alp): on an Umuganda morning, take a passenger or tools to the roadside Umuganda work
  // site against the clock. Motos may not ride during Umuganda: patrol cars drive the main roads and
  // officers stand at the corners. Seen on a main road, you must get away; murram back roads are safe.
  umuganda: {
    payFactor: 1.8, bonusFactor: 1.0, metresPerSecond: 6, extraSeconds: 35,
    minTripMetres: 450, maxPerMorning: 2, gapSeconds: 12, offerLife: 999, cargoKg: 30,
    patrolsPerDistrict: 1, patrolSeeMetres: 24, patrolEscapeMetres: 34, patrolGraceSeconds: 3,
  },
  secretBonus: 2500, // a secret place, found once in a game
};

// The muzungu (Alp, 14 October 2026): a foreign visitor who loves everything, tries to say Kinyarwanda
// words and pays 4 times the fare. The joke is on the tourist, never on the people. Place ids are the
// job places of the Kigali map; sight positions are in tiles.
export const MUZUNGU = {
  fromLevel: 2, // when Kigali town and its hotels open (guess)
  chance: 1 / 15, // the chance that a new offer is a visitor
  maxOnBoard: 2,
  fareFactor: 4,
  streakRides: 3, // a clean ride counts as 3 rides for the clean ride streak ("3× delivery")
  startIds: ['milleCollines', 'serena', 'umubano', 'radisson', 'marriott', 'kcc', 'kigaliHeights', 'carFree', 'cityTower', 'airportRoad', 'airport'], // visitors come off the plane ...
  endIds: ['carFree', 'townMarket', 'market', 'kcc', 'golf', 'milleCollines', 'serena', 'umubano', 'radisson', 'marriott', 'kigaliHeights', 'chic', 'mtn', 'gakinjiro', 'airport'], // ... and go back to it
  // Photo stops. line: what the visitor says when you ride past too fast for a photo.
  sights: [
    { id: 'kcc', name: 'the KCC', x: 110, y: 90.5, line: 'IS THAT THE CONVENTION CENTRE?!' },
    { id: 'love', name: 'I LOVE KIGALI', x: 43, y: 103.5, line: 'I LOVE KIGALI! I LOVE IT!' },
    { id: 'tower', name: 'Kigali City Tower', x: 34, y: 87, line: 'OH WOW, LOOK AT THAT TOWER!' },
    { id: 'fountain', name: 'the MTN fountain', x: 41, y: 79.5, line: 'OH WOW, A FOUNTAIN!' },
    { id: 'heights', name: 'Kigali Heights', x: 117.5, y: 86.5, line: 'OH WOW! SO MODERN!' },
    { id: 'milleCollines', name: 'the Mille Collines', x: 55, y: 114.5, line: 'OH WOW, WHAT A VIEW!' },
    { id: 'golfLake', name: 'the golf lake', x: 137, y: 37, line: 'OH WOW, THE HILLS!' }, // on the Nyarutarama link, by the lake
    { id: 'townMarket', name: 'the town market', x: 16, y: 102, line: 'EE-GEE-TOH-KEE! BANANA!' },
  ],
  sightMetres: 26, // near a sight
  photoKmh: 20, // ride past a sight under this speed: a photo (a flash) and a bigger tip
  photoTipFactor: 0.1, // each photo adds this part of the fare to the tip
  maxPhotos: 3,
  // No visitor lines near these places (respect). Parliament holds the Campaign Against Genocide Museum.
  quietIds: ['parliament'],
  quietTags: ['memorial', 'church'],
  quietMetres: 40,
  fastKmh: 50, // "BUHORO BUHORO!"
  marketMetres: 30,
  policeMetres: 22,
  uphillGrade: 0.06,
  // Alp, 15 October 2026: the lines are funny, but not too often. A photo still comes at once (it gives a tip).
  gapSeconds: 15, // at least this long between two lines
  chatterSeconds: [25, 35], // a random line when nothing happens
  bumpSeconds: 30, // "OUCH!" on a bump at most this often
  fastSeconds: 30, // "BUHORO BUHORO!" at most this often
  // Street hails (Alp: both, on the job board and at the roadside): a hail near a start place
  // (within hailMetres) is a visitor with this chance; at most maxHails visitor hails at a time.
  hailMetres: 50,
  hailChance: 0.35,
  maxHails: 1,
  hailCallSeconds: 4, // a waving visitor calls "MOTO!" this often when you are near
  hailCallMetres: 45,
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
  // fines: fines from speed cameras, the police, red lights, crossings and accidents (Alp: only on hard).
  // pavementChase: officers chase a moto on the pavement or off the road, and fine it when they catch
  // it (Alp, 13 October 2026: medium too). All modes have manual gears (Alp: no automatic option).
  // riderEnergy: false, or how fast the rider gets hungry (1 = the RIDER values).
  easy: {
    name: 'Kigali 2010', short: 'EASY', fuelUse: 0.8, wear: 0, cameras: false, police: false, fines: false, pavementChase: false,
    hazards: 0.5, traffic: 0.7, crashRepair: 0.5, lights: 'none', riderEnergy: false, helmetChecks: false, crossers: 0.5, crossStepOut: 0, rushExtra: 0,
    text: 'Low fuel use, no wear, no fines, light traffic.',
  },
  medium: {
    name: 'Kigali 2015', short: 'MEDIUM', fuelUse: 1, wear: 1, cameras: false, police: false, fines: false, pavementChase: true,
    hazards: 1, traffic: 1, crashRepair: 1, lights: 'lights', riderEnergy: 0.7, helmetChecks: false, crossers: 1, crossStepOut: 0.1, rushExtra: 0.5,
    text: 'The normal game: wear, traffic lights, and you eat to keep your energy. Only the police fine you, if they catch you on the pavement or off the road.',
  },
  hard: {
    name: 'Kigali 2020', short: 'HARD', fuelUse: 1.15, wear: 1.3, cameras: true, police: true, fines: true, pavementChase: true,
    hazards: 1, traffic: 1.25, crashRepair: 1, lights: 'cameras', riderEnergy: 1, helmetChecks: true, crossers: 1.8, crossStepOut: 0.5, rushExtra: 0.9, bladder: true,
    text: 'More fuel and wear, heavy traffic, all the fines (speed and red light cameras, police, helmet checks), and you must eat.',
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

// Rush hours (spec "More traffic in later levels"): more cars and minibuses on the roads at these hours.
// The mode's rushExtra: the extra share of cars and minibuses (0: no rush hours). The extra vehicles come
// on the road and go off it only far from you, so they never pop up in view. Guesses.
export const RUSH = { hours: [[7, 9], [17, 19]], wakeMetres: 70, parkMetres: 80 };

// People on the zebra crossings. Near you, a person now and then crosses the road on a crossing; traffic
// stops for them. They wait at the kerb when a vehicle comes (in hard mode some step out anyway: the
// mode's crossStepOut). Ride through a crossing fast while a person is on it: a fine when a police officer
// near the crossing sees you, else a warning. All values are guesses.
export const CROSSINGS = {
  everySeconds: 6, // at each crossing near you, a new person about this often (times the mode's crossers)
  nearMetres: 90, clearMetres: 14, maxCrossers: 8,
  passKmh: 10, passMetres: 3, fine: 10000, officerRangeMetres: 30,
};

// Brown kites (black kites, Milvus migrans) circle high over Kigali, most over the markets and the bus
// park (Alp). Each kite circles a centre that drifts slowly. None at night; fewer in the rain.
// The view draws height large (about 10.7 px for each metre), so the altitude is lower than real kites
// fly: higher kites would be off the screen above you.
export const KITES = {
  count: 10,
  altitudeMetres: [12, 22], radiusMetres: [16, 42], speedMs: [6, 10],
  driftMs: 0.6, // how fast the centre of a circle drifts
  flapEverySeconds: [5, 12], flapSeconds: 1.2,
  minLight: 0.35, rainShare: 0.3,
};

// Kigali International Airport (sim/planes.js): one plane stands on the apron, and from time to time a
// plane takes off. It comes into view at the east end of the runway, waits, rolls west faster and faster,
// lifts, climbs and flies away over the city to the west. The runway is short (the map is compressed), so the speeds are
// low for a plane. Distances in metres, speeds in m/s, times in seconds.
export const PLANES = {
  firstSeconds: 25, everySeconds: 90, // the first take-off, then the time between take-offs
  fadeSeconds: 1.5, holdSeconds: 4, // it comes into view, then waits at the end of the runway
  accel: 4.5, liftMs: 20, topMs: 36, // it lifts at 20 m/s (72 km/h)
  climbRatio: 0.3, // metres up for each metre forward
  awayMetres: 80, // above this height it fades away
  gearUpMetres: 4, // the wheels go up above this height
  parked: { x: 176, y: 105.5 }, // the plane on the apron (tiles)
  hearMetres: 260, // the jet sound fades to nothing at this distance from the rider
};

// The story arc (spec "Story arc: petrol to electric"). Smog: a brown haze covers the city at level 1, and
// each level makes it thinner (the alpha of the haze for each level); at the end, the air is clear.
// The yellow battery (levels 3 and 4, the petrol moto): an Ampersand rider rides in the traffic, and yellow
// battery pickups lie on the roads. Ride over one: an electric boost for boostSeconds (more power, no fuel).
export const STORY = {
  batteryLevels: [3, 4], batteriesPerDay: 5, pickMetres: 2.4,
  boostSeconds: 25, boostPower: 1.3,
};

export const SMOG = {
  byLevel: [0.34, 0.31, 0.28, 0.25, 0.19, 0.15, 0.11, 0.08, 0.05, 0.03, 0],
  colour: 0x8a7458, cellPx: 4, driftPxPerSecond: 3,
};

// Shops and street life (Alp): a share of the shop buildings get a painted sign with a picture and a
// name (world/shops.js). kinds: how often each kind of shop comes (barbershops are the most common).
// placeEvery: every n-th shop is also a job place (all buffets are job places and food stops).
// Garden walls (world/compounds.js): a painted wall around each villa compound, with a steel gate on
// the road side. Kimihurura first (the spec); the other rich districts can follow (add their ids).
export const GARDEN_WALLS = {
  districts: ['kimihurura'],
  heightMetres: 1.8, // a Kigali compound wall — guess
  gateFactor: 0.95, // the gate is a little lower than the wall
  pillarMetres: 0.4, // the gate pillars stand higher than the gate
  pillarShare: 0.1, // the part of the gate width that is a pillar (each side)
  insetTiles: 0.08, // the wall stands a little inside the tile edge
  topShare: 0.14, footShare: 0.18, // the coping at the top and the darker band at the foot (parts of the height)
  solidMetres: 0.5, // the thickness of the wall for collisions
  fenceMetres: 2.2, // the airport fence (a chain-link fence round the airfield)
};

export const SHOPS = {
  share: 0.4,
  kinds: { barber: 5, saloon: 3, bar: 3, butcher: 2, shoes: 1.2, phones: 1.5, boutique: 2.5, buffet: 1.5 },
  placeEvery: 3,
  mannequins: 2, // in front of each boutique
  // Where the sign goes (design review, 13 October 2026): painted on the band above the shop front
  // when the wall is long enough, else on a board with two legs in front of the shop.
  wallSignLevel: 1.12, // levels above the floor: the bottom of the sign (its top is at the roof edge of a 1-floor shop)
  wallMarginPx: 6, // the sign must be this much shorter than the wall (screen pixels)
  boardLevel: 1.1, // levels above the ground: the bottom of a board on legs
  boardOutMetres: 1.5, // a board stands this far in front of the wall (in front of the porch)
  // Kigali shop fronts (Alp, design canvas "Rwandan shop fronts", 13 October 2026): one bright colour on
  // the whole wall and a darker band at its foot. Brand style walls (phone companies, beer) have no logos.
  // No wall is Surge Yellow: the telecom yellow is darker and more orange.
  walls: [
    { wall: 0x2fa8a0, band: 0x1f5f6a }, { wall: 0xe0709a, band: 0x8a2f55 }, { wall: 0x8cc63f, band: 0x3f6a2a },
    { wall: 0xe8862a, band: 0x7a3a1a }, { wall: 0x5ab0e0, band: 0x2f5f9a }, { wall: 0x8a4ab0, band: 0x4a2a6a },
    { wall: 0xc0392b, band: 0x6a1f18 }, { wall: 0xd08a2a, band: 0x6a4218 }, { wall: 0xf0e2c0, band: 0x8a6a4a },
    { wall: 0xf0ece0, band: 0xa82a2a },
  ],
  brandWalls: [
    { wall: 0xe0a81c, band: 0x1f2f5a }, // telecom yellow (not Surge Yellow)
    { wall: 0xd42a2a, band: 0xf0ece0 }, // telecom red
    { wall: 0xb8202a, band: 0x1a1a1a }, // beer red
    { wall: 0x2f7a3a, band: 0xf0e2c0 }, // beer green
  ],
  brandShare: 0.2,
  doors: [0x2f5f9a, 0x3f8f4a, 0xc0392b], // steel double doors
  bandLevels: 0.6, // the darker band: up to this height above the floor (levels)
  muralLevel: 0.2, // the bottom of a wall picture (levels above the floor): it is painted over the band
  porchLevel: 1.08, // the porch roof meets the wall here (levels above the floor)
  porchDepthMetres: 0.8, // a narrow porch: a deeper one hides the shop front from the camera
  porchDropMetres: 0.2, // the porch slopes down to the front
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
    { id: 'crashbars', name: 'Crash bars', price: 2500, level: 3, effect: { crash: 0.6 }, text: 'Crash repairs cost 40% less, and a crash wears the moto 40% less.' },
    { id: 'charger', name: 'Phone charger for passengers', price: 1500, level: 3, effect: { longTripTip: 0.05 }, text: 'An extra tip of up to 5% on trips longer than 5 km.' },
    { id: 'pads', name: 'Ceramic brake pads', price: 2500, level: 4, effect: { wear: 0.9 }, text: 'The brake pads last longer: the service meter fills 10% slower.' },
    { id: 'bearings', name: 'Sealed wheel bearings', price: 4000, level: 5, effect: { wear: 0.85 }, text: 'The service meter fills 15% slower.' },
    { id: 'regen', name: 'Ampersand regen tune', price: 3000, level: 5, only: 'electric', effect: { regen: 1.2 }, text: 'Regen braking gives back 20% more. Electric moto only.' },
  ],
  // What the mechanic says when you come in (one line, chosen by the garage).
  talk: ['Muraho! A good speaker brings good tips.', 'Good tyres love murram.', 'Service on time, and the moto lives long.', 'Ceramic pads, smooth stops.', 'Bite the road, not the dust!'],
};

// Garage parts that show on your bike (Alp, 14 October 2026). The other parts are inside the bike.
export const VISIBLE_PARTS = ['speaker', 'charger', 'crashbars', 'net', 'cushion', 'tyres'];

// Effects of the garage parts on your bike (Alp, 14 October 2026; design canvas "Moto Inziza: bike
// add-on effects"): each part shows a short effect when it does its job (sim/partfx.js, PartFxView.js).
// Only on your bike. Times are guesses.
export const PART_FX = {
  cooldown: 4, // seconds before the same effect can play again
  bumpMin: 0.18, // a bump this big (bounce seconds) or more: a pothole, rocks or a speed bump (not the murram washboard)
  hardBrake: 0.7, // brake input for a hard brake
  hardBrakeKmh: 20, // a hard brake from this speed or more
  regenKmh: 10, // regen sparks from this speed (Alpha, braking)
  rollKmh: 15, // the bearings effect: rolling with no throttle and no brake from this speed
  chainKmh: 30, // the chain glint from this speed (petrol)
  treadKmh: 5, // tread marks on murram from this speed
  treadEveryMetres: 0.7, // one tread mark each this many metres
  treadSeconds: 3, // a tread mark stays this long
  sprayKmh: 8, // spray on wet murram from this speed
  dustKmh: 12, // a dust cloud off the rear tyre on dry murram from this speed (all bikes)
  dustEverySeconds: 0.1,
  glowNight: 0.3, // the phone screen shines when the night is darker than this (0..1)
  maxParticles: 160,
};

// The Ampersand HQ in Gikondo (Alp, 14 October 2026: "a blue roof warehouse"): the factory where you
// get your Alpha at the start of level 5 (sim/hq.js). Positions are in tiles (x, y), from the design
// canvas "Moto Inziza: Ampersand HQ mission and radio". Money and times are guesses.
export const HQ = {
  // In the Gikondo valley, south of the main road (Alp's Kigali map, 15 October 2026: Gikondo is south of
  // the road from the KCC to Sonatubes). The gates open on Kicukiro centre street.
  yard: { x0: 129, y0: 98, x1: 140, y1: 107 }, // the fenced yard (tarmac); the fence is on its edge
  building: { x0: 130, y0: 98, x1: 135, y1: 100, levels: 2 }, // the warehouse with the blue roof
  gates: { in: [131, 133], out: [137, 140] }, // openings in the south fence (tiles x from, x to)
  desk: { x: 133.6, y: 105.6 }, // the hand-in desk; the staff stand behind it (north)
  alphaRows: { x0: 130.0, x1: 135.4, ys: [101.6, 103.0], step: 0.38 }, // rows of new Alphas, nose to the south
  ribbon: { row: 1, index: 9 }, // your Alpha: the teal bow and the name tag
  tradeRow: { x: 129.45, y0: 101.4, step: 0.5, count: 5 }, // the row of old petrol motos (trade-ins)
  // The test track: a ring of cones round an ellipse, a lane between the outer and the inner ring.
  track: { cx: 138.4, cy: 103.0, rx: 1.75, ry: 2.4, innerRx: 0.6, innerRy: 1.25, coneMetres: 2.6, openings: [Math.PI, Math.PI / 2] },
  gateOrder: [Math.PI, Math.PI * 1.5, 0, Math.PI / 2], // the 4 gates (angles on the lane): west, north, east, south
  gateMetres: 3, // ride this near the centre of a gate to pass it
  coneMetres: 0.75, // a cone nearer than this to the bike falls over
  conePenalty: 2, // seconds for each cone you hit
  bonusSeconds: 45, // a time under this gives the bonus
  bonus: 3000, // RWF (guess)
  tradeIn: 15000, // RWF for your old petrol moto (guess)
  walkMs: 1.4, // walking speed (m/s)
  reachMetres: 2.4, // walk this near to the desk or the Alpha (its centre), then press F
  stopKmh: 3, // stop (slower than this) to get off with F
  confetti: { pieces: 120, seconds: 4 },
  staffLine: 'IYI NI IYAWE!', // "this one is yours" (a guess)
};

// Radio Inziza (Alp, 14 October 2026): music made in code (audio/radio.js), on a bike with the Bluetooth
// speaker. N or the ♪ button: the next station; the last one is OFF. The titles are new (not real songs).
// KISS FM is the name of a real Kigali radio station (Alp asked for it); its music here is made in code.
export const RADIO = {
  chipSeconds: 3, // the station chip shows this long after a change
  volume: 0.6, // the default music volume (0..1, Settings)
  stations: [
    { id: 'impala', name: 'IMPALA GOLD', kind: 'Rwandan band music', bpm: 118, tracks: ['Kigali by Night', 'Umutoni', 'Nyamirambo Twist', 'Sunday at Rebero'] },
    { id: 'rumba', name: 'RUMBA KIN', kind: 'Congolese rumba', bpm: 128, tracks: ['Sebene ya Moto', 'Mama Kivu', 'Ndombolo Express'] },
    { id: 'country', name: 'KIGALI COUNTRY', kind: 'Country music', bpm: 100, tracks: ['Murram Road Home', 'Red Dust Boots', 'Two Hills Waltz'] },
    { id: 'trap', name: 'KINYATRAP FM', kind: 'Rwandan trap', bpm: 140, tracks: ['Gikondo Nights', 'Helmet On', 'Swap n Go', 'Boda Flex'] },
    { id: 'gospel', name: 'GOSPEL 7', kind: 'Rwandan gospel', bpm: 96, tracks: ['Imana Ishimwe', 'Morning Light', 'Hallelujah Hill'] },
    { id: 'kiss', name: 'KISS FM', kind: 'Pop hits', bpm: 120, tracks: ['Kigali Summer', 'Hold On Tight', 'Neon Hills', 'Dancefloor 250'] },
  ],
};

// The minimal HUD (Alp, 14 October 2026): when a part shows (see HudScene.js).
export const HUD_RULES = {
  // The fuel or battery bar, the service bar, the food bar (medium and hard) and the WC bar (hard) always show.
  messageSeconds: 3, // a message stays this long, then fades
  districtSeconds: 2, // the district name stays this long when you ride into a district
};

// Work crews (sim/crews.js). On an Umuganda morning nobody walks in the streets (Alp, 14 October 2026):
// everybody does community work at the road sides: crews with hoes in the fields beside the roads, and
// crews who sweep the roads. On a normal day, city road sweepers sweep the road sides in the early morning.
export const CREWS = {
  umuganda: { perDistrict: 36, groupSize: [3, 6], hoeShare: 0.55 }, // the share of the groups with hoes; the others sweep
  // City sweepers (Alp: ladies in green, all day, most of them from the morning): perDistrict until
  // morningEnd, then dayShare of them until the end of hours (guesses).
  sweepers: { perDistrict: 6, groupSize: [2, 3], hours: [6, 20], morningEnd: 10, dayShare: 0.5 },
  siteCrew: 6, // people at the work site of an Umuganda run
  frameMs: [380, 520], // the time of one work stroke (each worker has its own speed)
};

// Day events (from level 6). A level's `events` gives the chance of each event on a day; one event at most.
// The numbers are guesses, to tune in play.
export const EVENTS = {
  // Umuganda: the community work morning. No customers, no traffic (only police patrols) and nobody in the streets until endHour, then a rush.
  umuganda: {
    endHour: 11, rushEndHour: 13,
    trafficShare: 0, // the share of the traffic on the road in the morning (Alp: no cars; only the police patrols)
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
  // Low fuel (Alp, 15 October 2026). Under sputterAt the petrol engine misses now and then: for a moment
  // it loses its power and coughs. It misses more often when the tank is nearly empty (missShare: from
  // the first to the second value). The pattern changes each sputterSlotSeconds.
  sputterAt: 0.1, sputterSlotSeconds: 0.18, missShare: [0.12, 0.45], missThrottle: 0.1,
  // The fuel tilt ("the dance", Alp): out of fuel, stop, lay the moto on its side and rock it, so that the
  // last fuel in the tank runs to the carburettor. Once for each empty tank: you can do it again after you
  // buy fuel (the tank is above againAt). It gives about 30 s of riding at full throttle.
  tilt: { seconds: 3.5, fuel: 0.08, maxKmh: 3, againAt: 0.15 },
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
  massKg: { car: 1200, pickup: 1700, lorry: 4500, bus: 4500, truck: 9000, tipper: 15000, moto: 200, taxi: 200, amp: 220, fleet: 220, cyclist: 90, person: 70, wall: Infinity, pole: Infinity },
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
  viewWidth: 104, // the window, in virtual HUD pixels (Alp: a smaller HUD; was 124 × 72 with a legend)
  viewHeight: 60,
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
