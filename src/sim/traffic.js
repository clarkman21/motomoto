import { TRAFFIC, WORLD } from '../config.js';
import { lanePoint, LANE_OFFSET } from './roads.js';
import { speedLimitAt } from './law.js';

// Traffic: cars, minibuses, trucks and other motos that drive on the road network.
// No Phaser here. Each vehicle drives along an edge (s = metres from its start) in the right
// hand lane. Near a node it follows a smooth curve into the next edge. It keeps a gap to
// anything ahead (vehicles, people, the player's bike), gives way at busy junctions, obeys the
// speed limit, and minibuses stop at bus stops. Trucks crawl up hills.

const KMH = 1 / 3.6;
const CORNER = 3.5; // metres before and after a node where the curve to the next edge runs (less on short edges)
const CLAIM_SECONDS = 2.5; // a junction claim expires after this time
const PATIENCE_SECONDS = 4; // after this long at a junction, a vehicle goes anyway

const cornerFor = (a, b) => Math.min(CORNER, a.length / 2 - 0.05, b.length / 2 - 0.05);

export function createTraffic(world, graph, rng) {
  const vehicles = [];
  let id = 1;
  const roadEdges = graph.edges.filter((e) => e.length > 12);
  for (const [kind, count] of Object.entries(TRAFFIC.counts)) {
    for (let i = 0; i < count; i++) {
      const edge = roadEdges[Math.floor(rng() * roadEdges.length)];
      const spec = TRAFFIC.kinds[kind];
      const v = {
        id: id++,
        kind,
        variant: Math.floor(rng() * spec.variants),
        edge,
        prev: null,
        next: null,
        s: CORNER + rng() * Math.max(0, edge.length - 2 * CORNER),
        speed: 0,
        length: spec.length,
        width: spec.width,
        maxSpeed: spec.maxKmh * KMH * (0.9 + rng() * 0.2),
        x: 0, y: 0, heading: 0,
        stopTimer: 0,
        lastStop: null,
        route: [],
        puff: rng(),
      };
      v.next = chooseNext(v, edge.to, rng);
      place(v);
      vehicles.push(v);
    }
  }
  return { graph, vehicles, rng, nodeClaims: new Map(), time: 0 };
}

/** The next edge from a node: follow the route if there is one, else a random way on (no U-turn unless a dead end). */
function chooseNext(v, node, rng) {
  if (v.route.length) return v.route.shift();
  const ways = node.out.filter((e) => e !== v.edge.reverse);
  const pool = ways.length ? ways : node.out;
  return pool[Math.floor(rng() * pool.length)];
}

/** Position and heading from the edge and s, with a curve near the nodes. */
function place(v) {
  const e = v.edge;
  let p, d;
  const cOut = v.next ? cornerFor(e, v.next) : 0;
  const cIn = v.prev ? cornerFor(v.prev, e) : 0;
  if (v.next && e.length - v.s < cOut) {
    const t = (v.s - (e.length - cOut)) / (2 * cOut); // 0 .. 0.5
    ({ p, d } = curve(e, v.next, t, cOut));
  } else if (v.prev && v.s < cIn) {
    const t = 0.5 + v.s / (2 * cIn); // 0.5 .. 1
    ({ p, d } = curve(v.prev, e, t, cIn));
  } else {
    p = lanePoint(e, v.s);
    d = { x: e.dx, y: e.dy };
  }
  v.x = p.x;
  v.y = p.y;
  v.heading = Math.atan2(d.y, d.x);
}

/** Quadratic curve from the lane of edge a (CORNER before its end) to the lane of edge b (CORNER after its start). */
function curve(a, b, t, c) {
  const p0 = lanePoint(a, a.length - c);
  const p2 = lanePoint(b, c);
  let p1;
  const cross = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(cross) > 0.5) {
    // A turn: the control point is where the two lane lines meet.
    const end = lanePoint(a, a.length);
    const start = lanePoint(b, 0);
    p1 = { x: a.dx !== 0 ? start.x : end.x, y: a.dy !== 0 ? start.y : end.y };
  } else if (a.dx * b.dx + a.dy * b.dy > 0) {
    p1 = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 }; // straight on
  } else {
    p1 = { x: a.to.x + a.dx * c, y: a.to.y + a.dy * c }; // U-turn at a dead end
  }
  const u = 1 - t;
  const p = { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
  const d = { x: 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x), y: 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y) };
  const len = Math.hypot(d.x, d.y) || 1;
  return { p, d: { x: d.x / len, y: d.y / len } };
}

/** Anything in front of vehicle v, in its lane: returns the free distance (metres) and the speed of the thing ahead. */
function gapAhead(v, others) {
  const fx = Math.cos(v.heading), fy = Math.sin(v.heading);
  let gap = Infinity, aheadSpeed = 0, ahead = null;
  const look = 8 + v.speed * 2;
  for (const o of others) {
    if (o === v) continue;
    const rx = o.x - v.x, ry = o.y - v.y;
    const along = rx * fx + ry * fy;
    if (along <= 0 || along > look + (o.length ?? 1)) continue;
    // Other vehicles count only when they go the same way. Crossing traffic is handled by the
    // junction claims; if two are about to touch, the lower id goes first. The bike and people always count.
    if (o.heading !== undefined && o.edge !== undefined) {
      const same = Math.cos(o.heading) * fx + Math.sin(o.heading) * fy;
      if (same < 0.3 && !(along < 3 && o.id < v.id)) continue;
      // Two vehicles that wait for each other (for example when they merge into one lane): the lower id goes.
      if (o.blocker === v && v.id < o.id) continue;
    }
    const side = Math.abs(-rx * fy + ry * fx);
    if (side > 1.6 + (o.width ?? 0.8) / 2) continue;
    const free = along - v.length / 2 - (o.length ?? 1) / 2;
    if (free < gap) {
      gap = free;
      aheadSpeed = o.speed ?? 0;
      ahead = o;
    }
  }
  return { gap, aheadSpeed, ahead };
}

/**
 * Advance all vehicles by dt. obstacles = other things to keep a gap to (the bike, people),
 * each { x, y, length, width, speed }. Returns events: { type: 'exhaust', vehicle }.
 */
export function stepTraffic(traffic, world, obstacles, dt) {
  const { vehicles, rng, nodeClaims } = traffic;
  traffic.time += dt;
  const now = traffic.time;
  const all = vehicles.concat(obstacles);
  const events = [];
  for (const v of vehicles) {
    const spec = TRAFFIC.kinds[v.kind];
    let target = Math.min(v.maxSpeed, speedLimitAt(world, v.x, v.y).limitKmh * KMH * spec.limitFactor);
    // Trucks (and loaded buses) crawl up hills.
    const slope = world.slopeAt(v.x, v.y);
    const grade = slope.dx * Math.cos(v.heading) + slope.dy * Math.sin(v.heading);
    if (grade > 0) target *= Math.max(spec.minHillFactor, 1 - grade * spec.hillSlowdown);
    // Slow down for a turn.
    const toEnd = v.edge.length - v.s;
    const turning = v.next && v.edge.dx * v.next.dx + v.edge.dy * v.next.dy < 0.5;
    if (turning && toEnd < 10) target = Math.min(target, TRAFFIC.turnKmh * KMH);
    // Minibuses stop at bus stops.
    if (v.kind === 'bus') {
      for (const stop of world.busStops) {
        const sx = (stop.x + 0.5) * WORLD.tileMetres, sy = (stop.y + 0.5) * WORLD.tileMetres;
        if (v.lastStop !== stop && Math.hypot(v.x - sx, v.y - sy) < 5) {
          v.lastStop = stop;
          v.stopTimer = TRAFFIC.busStopSeconds;
        }
      }
    }
    if (v.stopTimer > 0) {
      v.stopTimer -= dt;
      target = 0;
    }
    // Keep a gap to whatever is ahead.
    v.why = 'free';
    const { gap, aheadSpeed, ahead } = gapAhead(v, all);
    if (gap < Infinity) {
      const t2 = Math.max(0, Math.min(aheadSpeed + (gap - 2) * 0.8, (gap - 1.5) * 1.5));
      if (t2 < target) {
        target = t2;
        v.why = 'gap';
        v.blocker = ahead;
      }
    }
    // Give way at a junction: one vehicle at a time in the middle of a node.
    // A claim expires, and a vehicle that has waited too long goes anyway, so junctions never lock up.
    const node = v.edge.to;
    let claim = nodeClaims.get(node.id);
    if (claim && now - claim.time > CLAIM_SECONDS) {
      nodeClaims.delete(node.id);
      claim = null;
    }
    if (toEnd < 7 && node.out.length > 2) {
      if (claim && claim.id !== v.id && (v.waited ?? 0) < PATIENCE_SECONDS) {
        target = Math.min(target, Math.max(0, (toEnd - 5) * 1.5));
        v.why = 'junction';
        v.waited = (v.waited ?? 0) + dt;
      } else if (toEnd < 5 && !claim) {
        nodeClaims.set(node.id, { id: v.id, time: now });
      }
    }
    // Accelerate or brake towards the target speed.
    const accel = target > v.speed ? spec.accel : -spec.brake;
    v.speed = target > v.speed ? Math.min(target, v.speed + accel * dt) : Math.max(target, v.speed + accel * dt);
    // Move along the edge, and into the next one.
    v.s += v.speed * dt;
    while (v.s >= v.edge.length) {
      v.s -= v.edge.length;
      if (nodeClaims.get(v.edge.to.id)?.id === v.id) v.claimed = v.edge.to.id;
      v.waited = 0;
      v.prev = v.edge;
      v.edge = v.next;
      v.next = chooseNext(v, v.edge.to, rng);
    }
    if (v.claimed !== undefined && v.s > CORNER) {
      if (nodeClaims.get(v.claimed)?.id === v.id) nodeClaims.delete(v.claimed);
      v.claimed = undefined;
    }
    place(v);
    // Exhaust from petrol engines.
    if (spec.exhaust) {
      v.puff -= dt * (0.6 + v.speed * 0.08) * spec.exhaust;
      if (v.puff <= 0) {
        v.puff = 1;
        events.push({ type: 'exhaust', vehicle: v });
      }
    }
  }
  return events;
}

/** True if a point is inside a vehicle's footprint (a rectangle turned to its heading). */
export function insideVehicle(v, x, y, margin = 0) {
  const fx = Math.cos(v.heading), fy = Math.sin(v.heading);
  const rx = x - v.x, ry = y - v.y;
  return Math.abs(rx * fx + ry * fy) < v.length / 2 + margin && Math.abs(-rx * fy + ry * fx) < v.width / 2 + margin;
}

export { LANE_OFFSET };
