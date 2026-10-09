import { SMOG, STORY, WORLD } from '../config.js';
import { mulberry32 } from './jobs.js';

// The story arc: petrol to electric. No Phaser here.

/** The smog over the city at a level (0: clear air). Level 11 (free play) and later: clear. */
export function smogAt(level) {
  return SMOG.byLevel[Math.max(0, Math.min(level, SMOG.byLevel.length) - 1)] ?? 0;
}


/** Today's yellow battery pickups: tarmac road tiles in the open districts (seeded by the day). Metres. */
export function batterySpots(world, districts, day, n = STORY.batteriesPerDay) {
  const tiles = world.tiles.filter((t) => t.surface === 'tarmac' && !t.block && !t.hazard && districts.includes(t.district));
  const rng = mulberry32(day * 7477 + 5);
  rng();
  const out = [];
  for (let i = 0; i < n && tiles.length; i++) {
    const t = tiles.splice(Math.floor(rng() * tiles.length), 1)[0];
    out.push({ id: i, x: (t.tx + 0.5) * WORLD.tileMetres, y: (t.ty + 0.5) * WORLD.tileMetres, taken: false });
  }
  return out;
}

/** Ride over a battery: returns the battery taken, or null. */
export function takeBattery(spots, bike) {
  const b = spots.find((s) => !s.taken && Math.hypot(s.x - bike.x, s.y - bike.y) < STORY.pickMetres);
  if (b) b.taken = true;
  return b ?? null;
}
