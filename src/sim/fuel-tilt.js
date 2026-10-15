import { BIKES, FUEL } from '../config.js';

// The fuel tilt ("the dance", Alp, 15 October 2026). Every motari knows it: the petrol tank is empty, so
// you stop, lay the moto on its side and rock it. The last fuel in the corners of the tank runs to the
// carburettor, and you get a little more riding: enough to get nearer to a fuel station.
// Once for each empty tank. After you buy fuel (the tank is above FUEL.tilt.againAt) you can do it again.
// No Phaser here.

export function createTilt() {
  return { t: 0, used: false };
}

/** Why you cannot tilt now ('electric', 'fuel', 'broken', 'moving', 'used', 'busy'), or null if you can. */
export function tiltBlocked(tilt, bike, kmh) {
  if (!BIKES[bike.type].gears) return 'electric';
  if (tilt.t > 0) return 'busy';
  if (bike.brokenDown || bike.crashed > 0) return 'broken';
  if (bike.energy > 0) return 'fuel';
  if (tilt.used) return 'used';
  if (kmh > FUEL.tilt.maxKmh) return 'moving';
  return null;
}

/** Start the tilt. Returns true if it starts. */
export function startTilt(tilt, bike, kmh) {
  if (tiltBlocked(tilt, bike, kmh)) return false;
  tilt.t = FUEL.tilt.seconds;
  return true;
}

/** One step. Returns 'done' when the tilt ends (the fuel is in the carburettor). */
export function stepTilt(tilt, bike, dt) {
  if (bike.energy >= FUEL.tilt.againAt) tilt.used = false; // you bought fuel: you may tilt again next time
  if (tilt.t <= 0) return null;
  tilt.t = Math.max(0, tilt.t - dt);
  if (tilt.t > 0) return null;
  tilt.used = true;
  bike.energy = Math.min(1, bike.energy + FUEL.tilt.fuel);
  return 'done';
}

/**
 * How far the moto leans now, in degrees (0 = upright). It goes down onto its side, rocks there two
 * times, and comes up again.
 */
export function tiltAngle(tilt) {
  if (tilt.t <= 0) return 0;
  const T = FUEL.tilt.seconds, done = T - tilt.t, ramp = 0.5;
  const lean = Math.min(1, done / ramp, tilt.t / ramp);
  const rock = Math.sin((done / T) * Math.PI * 4) * 12;
  return lean * (55 + rock);
}
