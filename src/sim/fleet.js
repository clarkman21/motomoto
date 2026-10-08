import { FLEET, TRAFFIC } from '../config.js';
import { mulberry32 } from './jobs.js';
import { moveVehicle, LANE_OFFSET } from './traffic.js';

// Hired riders (the milestones of levels 6 and 8). They ride your motos in the traffic and pay you
// rent at the end of the day. Some days they call you for help. No Phaser here.

/** The names of your hired riders (from the wallet perks rider1 and rider2). */
export function fleetRiders(wallet) {
  return FLEET.names.filter((_, i) => wallet.perks?.[`rider${i + 1}`]);
}

/**
 * The plan of a day for each rider (seeded by the day): a bad day ('repair' or 'noRent') and the
 * hour of a call for help (or null). shift: { start, end }. firstHour: no calls before this hour.
 */
export function planFleetDay(names, day, shift, firstHour = shift.start) {
  return names.map((name, i) => {
    const r = mulberry32(day * 4241 + i * 613 + 7);
    r();
    const bad = r() < FLEET.badDayChance ? (r() < 0.5 ? 'repair' : 'noRent') : null;
    const repair = Math.round((FLEET.repair[0] + r() * (FLEET.repair[1] - FLEET.repair[0])) / 100) * 100;
    const from = Math.max(firstHour, shift.start + 1), to = shift.end - 2;
    const call = r() < FLEET.helpChance && to > from ? from + r() * (to - from) : null;
    return { name, index: i, bad, repair, call, help: null };
  });
}

/** Mark the fleet motos in the traffic (kind 'fleet') with their rider, and give them a job timer. */
export function attachFleet(traffic, plan, rng) {
  const motos = [...traffic.vehicles, ...(traffic.dormant ?? [])].filter((v) => v.kind === 'fleet');
  motos.forEach((v, i) => {
    v.rider = plan[i] ?? null;
    v.jobTimer = 5 + rng() * 20;
  });
}

/**
 * Each frame. The riders carry passengers now and then. A call for help starts at its hour: the rider
 * stops on a road near you (but out of view). Returns events: { type: 'call' | 'helped' | 'missed', rider }.
 * bike: { x, y, speed } (speed in m/s). hour: the game clock. inView(x, y): true if a point is on the screen.
 */
export function stepFleet(traffic, plan, bike, hour, dt, rng, inView = () => false) {
  const events = [];
  // A rider who is still off the road (the Umuganda morning) comes back when the call is due.
  if (traffic.dormant?.length) {
    const due = traffic.dormant.filter((v) => v.kind === 'fleet' && v.rider && !v.rider.help && v.rider.call != null && hour >= v.rider.call);
    for (const v of due) {
      traffic.dormant.splice(traffic.dormant.indexOf(v), 1);
      traffic.vehicles.push(v);
    }
  }
  for (const v of traffic.vehicles) {
    if (v.kind !== 'fleet' || !v.rider) continue;
    const r = v.rider;
    const h = r.help;
    if (h?.state === 'waiting') {
      v.stopTimer = 1; // the moto stands still until you come
      h.timeLeft -= dt;
      const near = Math.hypot(bike.x - v.x, bike.y - v.y) < FLEET.helpRangeMetres;
      if (near && bike.speed * 3.6 < FLEET.helpStopKmh) h.work += dt;
      else h.work = 0;
      if (h.work >= FLEET.helpWorkSeconds) {
        h.state = 'helped';
        backOnRoad(v);
        events.push({ type: 'helped', rider: r });
      } else if (h.timeLeft <= 0) {
        h.state = 'missed';
        backOnRoad(v);
        events.push({ type: 'missed', rider: r });
      }
      continue;
    }
    if (!h && r.call != null && hour >= r.call) {
      const spot = callSpot(traffic, bike, rng, inView);
      if (spot) moveVehicle(v, spot.edge, spot.s, rng);
      v.loaded = false;
      v.roadside = true; // at the road edge, so the traffic can pass
      v.laneExtra = TRAFFIC.kinds.cyclist.laneOffset - LANE_OFFSET;
      r.help = { state: 'waiting', timeLeft: FLEET.helpMinutes * 60, work: 0, problem: rng() < 0.5 ? 'battery' : 'tyre' };
      events.push({ type: 'call', rider: r, vehicle: v });
      continue;
    }
    // A passenger on and off: the rider works.
    if ((v.jobTimer -= dt) <= 0) {
      v.loaded = !v.loaded;
      const [lo, hi] = FLEET.jobSeconds;
      v.jobTimer = v.loaded ? lo + rng() * (hi - lo) : 4 + rng() * 10;
    }
  }
  return events;
}

function backOnRoad(v) {
  v.stopTimer = 0;
  v.roadside = false;
  v.laneExtra = 0;
}

/** A road edge between FLEET.callDistance metres from the bike, out of view. */
function callSpot(traffic, bike, rng, inView) {
  const [lo, hi] = FLEET.callDistance;
  const edges = traffic.graph.edges.filter((e) => {
    if (e.length < 14) return false;
    const mx = (e.from.x + e.to.x) / 2, my = (e.from.y + e.to.y) / 2;
    const d = Math.hypot(mx - bike.x, my - bike.y);
    return d >= lo && d <= hi && !inView(mx, my);
  });
  if (!edges.length) return null;
  const edge = edges[Math.floor(rng() * edges.length)];
  return { edge, s: edge.length / 2 };
}

/** The rider who waits for your help now, with the moto, or null. */
export function waitingRider(traffic) {
  const v = traffic.vehicles.find((x) => x.kind === 'fleet' && x.rider?.help?.state === 'waiting');
  return v ? { rider: v.rider, vehicle: v } : null;
}

/**
 * The money of the day for each rider: rent (none on a bad 'noRent' day or when you did not help)
 * and costs (service, and a repair on a bad 'repair' day). Returns { rent, costs, lines }.
 */
export function fleetDayMoney(plan) {
  let rent = 0, costs = 0;
  const lines = [];
  for (const r of plan) {
    const paid = r.bad !== 'noRent' && r.help?.state !== 'missed' && r.help?.state !== 'waiting';
    if (paid) rent += FLEET.rentPerDay;
    costs += FLEET.costPerDay + (r.bad === 'repair' ? r.repair : 0);
    if (r.help?.state === 'missed' || r.help?.state === 'waiting') lines.push(`${r.name} waited for help and lost the day: no rent.`);
    else if (r.bad === 'noRent') lines.push(`${r.name} was sick today: no rent.`);
    else if (r.bad === 'repair') lines.push(`${r.name} had a small crash: the repair cost ${r.repair.toLocaleString('en-US')} RWF.`);
    else if (r.help?.state === 'helped') lines.push(`${r.name} says thank you for the help, boss.`);
  }
  return { rent, costs, lines };
}
