import { RUSH } from '../config.js';

// Rush hours: extra cars and minibuses on the roads at the busy hours. No Phaser here.
// The extra vehicles (v.rush) wait in traffic.dormant outside the rush hours.

/** True in a rush hour. */
export const isRushHour = (hour) => RUSH.hours.some(([a, b]) => hour >= a && hour < b);

/** How many extra vehicles of each kind for the rush hours (counts: the normal cars and buses). */
export function rushCounts(counts, extra) {
  return { car: Math.round((counts.car ?? 0) * extra), bus: Math.round((counts.bus ?? 0) * extra) };
}

/** Mark n vehicles of each kind as rush vehicles, and park them (they wait off the road). */
export function markRush(traffic, extraCounts) {
  traffic.dormant = traffic.dormant ?? [];
  for (const [kind, n] of Object.entries(extraCounts)) {
    const list = traffic.vehicles.filter((v) => v.kind === kind).slice(-n);
    for (const v of n > 0 ? list : []) v.rush = true;
  }
  const keep = [];
  for (const v of traffic.vehicles) (v.rush ? traffic.dormant : keep).push(v);
  traffic.vehicles = keep;
}

/**
 * Each step: in a rush hour, rush vehicles come on the road far from the bike; after it, they go off the
 * road far from the bike. allowed: false keeps them off (for example the Umuganda morning).
 */
export function stepRush(traffic, hour, bike, allowed = true) {
  const far = (v, d) => Math.hypot(v.x - bike.x, v.y - bike.y) >= d;
  if (isRushHour(hour) && allowed) {
    const stay = [];
    for (const v of traffic.dormant ?? []) (v.rush && far(v, RUSH.wakeMetres) ? traffic.vehicles : stay).push(v);
    traffic.dormant = stay;
  } else {
    const keep = [];
    for (const v of traffic.vehicles) (v.rush && far(v, RUSH.parkMetres) && !v.mission ? traffic.dormant : keep).push(v);
    traffic.vehicles = keep;
  }
}
