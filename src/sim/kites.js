import { KITES as K } from '../config.js';
import { mulberry32 } from './jobs.js';

// Brown kites in the sky. No Phaser here. A kite circles a centre at a height; the centre drifts.

/** Make the kites. centres: [{ x, y }] in metres (markets, the bus park); the kites spread over them. */
export function createKites(centres, seed = 11) {
  const rng = mulberry32(seed);
  rng();
  const lerp = ([a, b]) => a + rng() * (b - a);
  return Array.from({ length: K.count }, (_, i) => {
    const c = centres[i % centres.length];
    return {
      id: i, cx: c.x + (rng() - 0.5) * 60, cy: c.y + (rng() - 0.5) * 60, home: { x: c.x, y: c.y },
      r: lerp(K.radiusMetres), alt: lerp(K.altitudeMetres), speed: lerp(K.speedMs),
      a: rng() * Math.PI * 2, dir: rng() < 0.5 ? 1 : -1, flapIn: lerp(K.flapEverySeconds), flap: 0,
      driftA: rng() * Math.PI * 2, x: 0, y: 0, heading: 0,
    };
  });
}

/** Move the kites by dt seconds. rng: for the drift. */
export function stepKites(kites, dt, rng = Math.random) {
  for (const k of kites) {
    k.a += (k.dir * k.speed * dt) / k.r;
    // The centre drifts, but it stays near home (within about 120 m).
    k.driftA += (rng() - 0.5) * dt;
    const pull = Math.min(1, Math.hypot(k.cx - k.home.x, k.cy - k.home.y) / 120);
    k.cx += (Math.cos(k.driftA) * (1 - pull) + (k.home.x - k.cx) / 120 * pull) * K.driftMs * dt;
    k.cy += (Math.sin(k.driftA) * (1 - pull) + (k.home.y - k.cy) / 120 * pull) * K.driftMs * dt;
    k.x = k.cx + Math.cos(k.a) * k.r;
    k.y = k.cy + Math.sin(k.a) * k.r;
    k.heading = k.a + (k.dir * Math.PI) / 2; // along the circle
    // Mostly they glide; now and then a few wing beats.
    if (k.flap > 0) k.flap -= dt;
    else if ((k.flapIn -= dt) <= 0) {
      k.flap = K.flapSeconds;
      k.flapIn = K.flapEverySeconds[0] + rng() * (K.flapEverySeconds[1] - K.flapEverySeconds[0]);
    }
  }
}

/** How many kites fly now: none at night, fewer in the rain. */
export function kitesVisible(count, light, rain) {
  if (light < K.minLight) return 0;
  return rain ? Math.round(count * K.rainShare) : count;
}
