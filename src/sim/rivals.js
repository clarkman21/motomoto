import { RIVALS, WORLD } from '../config.js';
import { nearestNode, shortestPath } from './roads.js';

// Rival moto riders: traffic motos that go for customers. No Phaser here.
// A rival with a mission follows the shortest road path to the customer's nearest junction.
// When it arrives first, it takes the customer and rides with a passenger for a while.

const T = WORLD.tileMetres;

/** Free rivals: motos without a mission and without a passenger. */
const freeRivals = (traffic) => traffic.vehicles.filter((v) => v.kind === 'moto' && !v.mission && !v.loaded);

/** Send a rival to a target point (metres). mission = { type: 'job' | 'hail', id }. */
export function sendRival(traffic, v, target, mission) {
  const goal = nearestNode(traffic.graph, target.x, target.y);
  const path = shortestPath(traffic.graph, v.edge.to, goal);
  if (!path) return false;
  // The vehicle already chose its next edge from edge.to; replace it with the first edge of the path.
  v.route = path.slice();
  if (v.route.length) v.next = v.route.shift();
  v.mission = { ...mission, target, goal };
  return true;
}

/** When you take an app job: maybe a rival races you to the pickup. Returns the rival or null. */
export function startRace(traffic, bike, pickup, rng) {
  if (rng() >= RIVALS.raceChance) return null;
  const target = { x: pickup.x * T, y: pickup.y * T };
  const yours = Math.hypot(bike.x - target.x, bike.y - target.y);
  const [lo, hi] = RIVALS.raceDistance;
  let best = null, bestScore = Infinity;
  for (const v of freeRivals(traffic)) {
    const d = Math.hypot(v.x - target.x, v.y - target.y);
    if (d < yours * lo || d > yours * hi) continue;
    const score = Math.abs(d - yours * 1.2);
    if (score < bestScore) {
      best = v;
      bestScore = score;
    }
  }
  if (best && sendRival(traffic, best, target, { type: 'job', id: pickup.jobId })) return best;
  return null;
}

/** A new street hail: maybe the nearest free rival goes for it. */
export function chaseHail(traffic, hail, rng) {
  if (rng() >= RIVALS.hailChance) return null;
  let best = null, bestD = RIVALS.hailRange;
  for (const v of freeRivals(traffic)) {
    const d = Math.hypot(v.x - hail.x, v.y - hail.y);
    if (d < bestD) {
      best = v;
      bestD = d;
    }
  }
  if (best && sendRival(traffic, best, { x: hail.x, y: hail.y }, { type: 'hail', id: hail.id })) return best;
  return null;
}

export function cancelMission(v) {
  if (!v) return;
  v.mission = null;
  v.route = [];
}

/** Advance rivals. Returns events: { type: 'rivalArrived', vehicle, mission }. */
export function stepRivals(traffic, dt) {
  const events = [];
  for (const v of traffic.vehicles) {
    if (v.kind !== 'moto') continue;
    if (v.loaded) {
      v.busy -= dt;
      if (v.busy <= 0) v.loaded = false;
    }
    const m = v.mission;
    if (!m) continue;
    const d = Math.hypot(v.x - m.target.x, v.y - m.target.y);
    // Arrived: close to the customer, or at the goal junction (the customer walks the last metres).
    const atGoal = !v.route.length && v.prev && v.prev.to === m.goal && v.s < 6;
    if (d < RIVALS.arriveMetres || (atGoal && d < 30)) {
      v.mission = null;
      v.loaded = true;
      v.busy = RIVALS.busySeconds;
      events.push({ type: 'rivalArrived', vehicle: v, mission: m });
    }
  }
  return events;
}
