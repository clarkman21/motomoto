import { TRAFFIC, WORLD, BUS_PARK, HAZARDS } from '../config.js';
import { lanePoint, LANE_OFFSET, roadLane, shortestPath } from './roads.js';
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

/** counts: how many of each kind (default: TRAFFIC.counts). */
export function createTraffic(world, graph, rng, counts = TRAFFIC.counts) {
  const vehicles = [];
  let id = 1;
  const roadEdges = graph.edges.filter((e) => e.length > 12);
  for (const [kind, count] of Object.entries(counts)) {
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
        laneExtra: (spec.laneOffset ?? LANE_OFFSET) - LANE_OFFSET, // cyclists keep further to the edge
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

/** The lane of vehicle v on edge e: metres to the right of the centre line. */
function laneOf(v, e) {
  return roadLane(e.road) + (e.road?.ring ? 0 : v.laneExtra ?? 0);
}

/** Position and heading from the edge and s, with a curve near the nodes. */
function place(v) {
  const e = v.edge;
  let p, d;
  const cOut = v.next ? cornerFor(e, v.next) : 0;
  const cIn = v.prev ? cornerFor(v.prev, e) : 0;
  if (v.next && e.length - v.s < cOut) {
    const t = (v.s - (e.length - cOut)) / (2 * cOut); // 0 .. 0.5
    ({ p, d } = curve(e, v.next, t, cOut, laneOf(v, e), laneOf(v, v.next)));
  } else if (v.prev && v.s < cIn) {
    const t = 0.5 + v.s / (2 * cIn); // 0.5 .. 1
    ({ p, d } = curve(v.prev, e, t, cIn, laneOf(v, v.prev), laneOf(v, e)));
  } else {
    p = lanePoint(e, v.s, laneOf(v, e));
    d = { x: e.dx, y: e.dy };
  }
  v.x = p.x;
  v.y = p.y;
  v.heading = Math.atan2(d.y, d.x);
}

/**
 * Quadratic curve from the lane of edge a (c metres before its end) to the lane of edge b (c metres
 * after its start). la, lb: the lanes of the two edges (they differ where a road meets a ring).
 */
function curve(a, b, t, c, la = LANE_OFFSET, lb = la) {
  const p0 = lanePoint(a, a.length - c, la);
  const p2 = lanePoint(b, c, lb);
  let p1;
  const cross = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(cross) > 0.2) {
    // A turn: the control point is where the two lane lines meet.
    const end = lanePoint(a, a.length, la);
    const start = lanePoint(b, 0, lb);
    const k = ((start.x - end.x) * b.dy - (start.y - end.y) * b.dx) / cross;
    p1 = { x: end.x + a.dx * k, y: end.y + a.dy * k };
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

/** The safe speed (m/s) over a speed bump or a pothole. */
function safeSpeed(hazard) {
  return hazard === 'speedBump' ? HAZARDS.speedBump.safeSpeedKmh * KMH * 0.8 : TRAFFIC.potholeKmh * KMH;
}

/** The nearest speed bump or pothole ahead of v in its lane (within look metres): { type, dist }, or null. */
function hazardAhead(world, v, look) {
  const fx = Math.cos(v.heading), fy = Math.sin(v.heading);
  for (let d = 1; d <= look; d += 1) {
    const t = world.tileAt(v.x + fx * d, v.y + fy * d);
    if (t?.hazard) return { type: t.hazard, dist: d };
  }
  return null;
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
    // A cyclist at the road edge and a car in the lane can pass each other when there is room.
    // A moto that stands at the roadside (o.roadside: a hired rider who waits for help) counts the same.
    const cyclist = o.kind === 'cyclist' || v.kind === 'cyclist' || o.roadside;
    const room = cyclist ? (v.width + (o.width ?? 0.8)) / 2 + 0.25 : 1.6 + (o.width ?? 0.8) / 2;
    if (side > room) continue;
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
    // Speed bumps and potholes: slow down before them, as the bike must.
    const hazard = hazardAhead(world, v, TRAFFIC.hazardLookMetres);
    if (hazard) target = Math.min(target, safeSpeed(hazard.type) + Math.max(0, hazard.dist - 2) * 1.2);
    // Minibuses stop at bus stops.
    if (v.kind === 'bus') {
      for (const stop of world.busStops) {
        const sx = (stop.x + 0.5) * WORLD.tileMetres, sy = (stop.y + 0.5) * WORLD.tileMetres;
        if (v.lastStop !== stop && Math.hypot(v.x - sx, v.y - sy) < 5) {
          v.lastStop = stop;
          v.stopTimer = stop.park ? BUS_PARK.dwellSeconds : TRAFFIC.busStopSeconds;
          // At the bus park, the passengers get off and look for motos.
          if (stop.park) events.push({ type: 'busArrived', vehicle: v, stop });
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
    // Give way to the traffic on a roundabout: wait at the ring until no vehicle on the ring is near.
    const node0 = v.edge.to;
    if (v.next?.road?.ring && !v.edge.road?.ring && toEnd < 9) {
      const busy = vehicles.some((w) => w !== v && w.edge.road?.ring && w.edge.from !== node0
        && (w.edge.to === node0 || w.next?.to === node0) && Math.hypot(w.x - node0.x, w.y - node0.y) < TRAFFIC.ringGiveWayMetres);
      if (busy && (v.ringWait ?? 0) < TRAFFIC.ringPatienceSeconds) {
        target = Math.min(target, Math.max(0, (toEnd - 5) * 1.5));
        v.why = 'giveWay';
        v.ringWait = (v.ringWait ?? 0) + dt;
      }
    } else v.ringWait = 0;
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
    // Over a bump or a pothole the vehicle bounces (the view shows it), and a fast one loses speed.
    const tile = world.tileAt(v.x, v.y);
    const key = tile ? tile.tx * 100000 + tile.ty : -1;
    if (key !== v.tileKey) {
      v.tileKey = key;
      if (tile?.hazard) {
        v.bump = 0.3;
        if (v.speed > safeSpeed(tile.hazard) * 1.2) v.speed *= 1 - (tile.hazard === 'speedBump' ? HAZARDS.speedBump.speedCut : HAZARDS.pothole.speedCut);
      }
    }
    v.bump = Math.max(0, (v.bump ?? 0) - dt);
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

/**
 * Send a bus to the bus park: the shortest way to one end of the bus park lane, then along it.
 * parkEdge: the lane edge that passes the bus park stop. Returns true if a route was found.
 */
export function sendBusToPark(traffic, v, parkEdge) {
  if (!v.next) return false;
  let best = null;
  for (const e of [parkEdge, parkEdge.reverse].filter(Boolean)) {
    const path = v.next.to === e.from ? [] : shortestPath(traffic.graph, v.next.to, e.from);
    if (!path) continue;
    const len = path.reduce((a, p) => a + p.length, 0);
    if (!best || len < best.len) best = { len, route: [...path, e] };
  }
  if (!best) return false;
  v.route = best.route;
  v.lastStop = null;
  return true;
}

/** Move a vehicle to a point s on an edge (for example a hired rider who calls for help). */
export function moveVehicle(v, edge, s, rng) {
  Object.assign(v, { edge, s, prev: null, route: [], speed: 0 });
  v.next = chooseNext(v, edge.to, rng);
  place(v);
}

/** True if a point is inside a vehicle's footprint (a rectangle turned to its heading). */
export function insideVehicle(v, x, y, margin = 0) {
  const fx = Math.cos(v.heading), fy = Math.sin(v.heading);
  const rx = x - v.x, ry = y - v.y;
  return Math.abs(rx * fx + ry * fy) < v.length / 2 + margin && Math.abs(-rx * fy + ry * fx) < v.width / 2 + margin;
}

export { LANE_OFFSET };
