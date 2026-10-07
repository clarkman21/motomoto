import { TRAFFIC } from '../config.js';

// Traffic that waits behind you honks. When the bike stands still (or nearly) in front of a
// vehicle that has stopped behind it, the vehicle waits a little, then honks. It honks again
// now and then while you stay. Cyclists ring the bell. No Phaser here.

/**
 * Call each frame. bike: { x, y, speed (m/s) }. Returns the vehicles that honk now.
 * rng: a function that returns 0..1 (for the time to the next honk).
 */
export function trafficHonks(traffic, bike, dt, rng = Math.random) {
  const H = TRAFFIC.honk;
  const out = [];
  const still = bike.speed < H.bikeStillMs;
  for (const v of traffic.vehicles) {
    let waiting = false;
    if (still && v.speed < H.vehicleStillMs) {
      const dx = bike.x - v.x, dy = bike.y - v.y, d = Math.hypot(dx, dy);
      // The bike is in front of the vehicle, close, and near its lane.
      waiting = d > 0.5 && d < H.range && (Math.cos(v.heading) * dx + Math.sin(v.heading) * dy) / d > H.ahead;
    }
    if (!waiting) {
      v.waitBehind = 0;
      continue;
    }
    v.waitBehind = (v.waitBehind ?? 0) + dt;
    if (v.waitBehind >= H.afterSeconds && (v.nextHonk ?? 0) <= v.waitBehind) {
      v.nextHonk = v.waitBehind + H.everySeconds[0] + rng() * (H.everySeconds[1] - H.everySeconds[0]);
      out.push(v);
    }
  }
  return out;
}
