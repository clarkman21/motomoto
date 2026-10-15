import { PLANES, WORLD } from '../config.js';

// The planes at Kigali International Airport (world.airport, in tiles). One plane stands on the apron.
// One plane at a time takes off to the west: wait (not seen) → hold (it comes into view at the east end of
// the runway, near the taxiway) → roll (west, faster and faster) → climb (it lifts and flies away over
// Kicukiro and Gikondo) → wait again.
// Positions in metres. No Phaser here.

const T = WORLD.tileMetres;

/** The planes of an airport, or null if the map has no airport. */
export function createPlanes(airport, P = PLANES) {
  if (!airport) return null;
  const rw = airport.runway;
  const runwayY = ((rw.y0 + rw.y1 + 1) / 2) * T;
  return {
    parked: { x: P.parked.x * T, y: P.parked.y * T },
    startX: (airport.x1 - 2.5) * T, // the east end of the runway, the tail on the runway
    runwayY,
    flight: { phase: 'wait', t: P.firstSeconds, x: 0, y: runwayY, z: 0, v: 0, alpha: 0 },
  };
}

/** Move the flight on by dt seconds. Returns events: { type: 'roll' } (the engines go loud). */
export function stepPlanes(planes, dt, P = PLANES) {
  const events = [];
  if (!planes) return events;
  const f = planes.flight;
  f.t -= dt;
  switch (f.phase) {
    case 'wait':
      if (f.t <= 0) Object.assign(f, { phase: 'hold', t: P.fadeSeconds + P.holdSeconds, x: planes.startX, y: planes.runwayY, z: 0, v: 0, alpha: 0 });
      break;
    case 'hold':
      f.alpha = Math.min(1, f.alpha + dt / P.fadeSeconds);
      if (f.t <= 0) {
        f.phase = 'roll';
        events.push({ type: 'roll' });
      }
      break;
    case 'roll':
    case 'climb':
      f.v = Math.min(P.topMs, f.v + P.accel * dt);
      f.x -= f.v * dt; // to the west
      if (f.phase === 'roll' && f.v >= P.liftMs) f.phase = 'climb';
      if (f.phase === 'climb') {
        f.z += f.v * P.climbRatio * dt;
        f.alpha = Math.max(0, Math.min(1, (P.awayMetres - f.z) / (P.awayMetres * 0.25)));
        if (f.z >= P.awayMetres) Object.assign(f, { phase: 'wait', t: P.everySeconds, alpha: 0 });
      }
      break;
  }
  return events;
}

/** How loud the jet is for a listener at (x, y) metres: 0..1. */
export function jetLevel(planes, x, y, P = PLANES) {
  if (!planes) return 0;
  const f = planes.flight;
  const power = f.phase === 'roll' || f.phase === 'climb' ? 1 : f.phase === 'hold' ? 0.35 : 0;
  if (!power) return 0;
  const d = Math.hypot(f.x - x, f.y - y, f.z);
  return power * Math.max(0, 1 - d / P.hearMetres) ** 1.5;
}
