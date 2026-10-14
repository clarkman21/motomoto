import { TRAFFIC, WORLD, BUS_PARK, HAZARDS } from '../config.js';
import { lanePoint, LANE_OFFSET, roadLane, shortestPath } from './roads.js';
import { speedLimitAt } from './law.js';
import { lightLimit } from './lights.js';
import { slowZoneLimit } from './roadevents.js';

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

/** The family of a kind (car, bus, truck, moto): its sound, lights and bounce. A pickup is a car. */
export const familyOf = (kind) => TRAFFIC.kinds[kind]?.family ?? kind;

/** counts: how many of each kind (default: TRAFFIC.counts). */
export function createTraffic(world, graph, rng, counts = TRAFFIC.counts) {
  const traffic = { graph, vehicles: [], rng, nodeClaims: new Map(), time: 0, nextId: 1, slowZones: [], closed: null };
  const roadEdges = graph.edges.filter((e) => e.length > 12);
  for (const [kind, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      const spec = TRAFFIC.kinds[kind];
      const pool = spec.mainRoads ? roadEdges.filter((e) => e.road?.surface !== 'm') : roadEdges;
      // A free place: not on top of a vehicle that is there already (a few tries).
      const from = pool.length ? pool : roadEdges;
      let edge, s;
      for (let k = 0; k < 8; k++) {
        edge = from[Math.floor(rng() * from.length)];
        s = CORNER + rng() * Math.max(0, edge.length - 2 * CORNER);
        if (!traffic.vehicles.some((o) => o.edge === edge && Math.abs(o.s - s) < (o.length + spec.length) / 2 + 2)) break;
      }
      traffic.vehicles.push(addVehicle(traffic, kind, edge, s));
    }
  }
  return traffic;
}

/**
 * A new vehicle of a kind on an edge, s metres along it, with a planned route (a list of edges) or
 * none (it drives at random). The caller adds it to traffic.vehicles.
 */
export function addVehicle(traffic, kind, edge, s, route = []) {
  const rng = traffic.rng;
  const spec = TRAFFIC.kinds[kind];
  const v = {
    id: traffic.nextId++,
    kind,
    variant: Math.floor(rng() * spec.variants),
    edge,
    prev: null,
    next: null,
    s,
    speed: 0,
    length: spec.length,
    width: spec.width,
    laneExtra: (spec.laneOffset ?? LANE_OFFSET) - LANE_OFFSET, // cyclists keep further to the edge
    maxSpeed: spec.maxKmh * KMH * (0.9 + rng() * 0.2),
    x: 0, y: 0, heading: 0,
    stopTimer: 0,
    lastStop: null,
    route,
    puff: rng(),
  };
  v.next = chooseNext(v, edge.to, rng, traffic.closed);
  place(v);
  return v;
}

/** The next edge from a node: follow the route if there is one, else a random way on (no U-turn unless a dead end). */
function chooseNext(v, node, rng, closed = null) {
  if (v.route.length) return v.route.shift();
  let ways = node.out.filter((e) => e !== v.edge.reverse);
  // Closed roads (a car free morning): drive round them when there is another way.
  if (closed?.size) {
    const open = ways.filter((e) => !closed.has(e.road));
    if (open.length) ways = open;
  }
  // Police patrol cars keep to the main roads (no murram back roads): at the end of a main road they turn back.
  if (TRAFFIC.kinds[v.kind]?.mainRoads) {
    const main = ways.filter((e) => e.road?.surface !== 'm');
    ways = main.length ? main : node.out.filter((e) => e.road?.surface !== 'm');
  }
  const pool = ways.length ? ways : node.out;
  return pool[Math.floor(rng() * pool.length)];
}

/** The lane of vehicle v on edge e: metres to the right of the centre line. */
function laneOf(v, e) {
  return roadLane(e.road) + (e.road?.ring ? 0 : v.laneExtra ?? 0) - (v.swerve ?? 0);
}

const approach = (a, b, step) => (a < b ? Math.min(b, a + step) : Math.max(b, a - step));

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
  v.heading = Math.atan2(d.y, d.x) + (v.crashTilt ?? 0);
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
  if (hazard === 'speedBump') return HAZARDS.speedBump.safeSpeedKmh * KMH * 0.8;
  if (hazard === 'rocks') return HAZARDS.rocks.safeSpeedKmh * KMH;
  return TRAFFIC.potholeKmh * KMH;
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

// A grid of buckets (GRID_METRES square) for the gap check: each vehicle looks only at the buckets in a
// strip ahead of it, not at all the others (with many vehicles, that check was most of the time).
const GRID_METRES = 16;
const gridKey = (cx, cy) => cx * 65536 + cy;
function buildGrid(things) {
  const grid = new Map();
  for (const o of things) {
    const k = gridKey(Math.floor(o.x / GRID_METRES), Math.floor(o.y / GRID_METRES));
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push(o);
  }
  return grid;
}
/** The things in the buckets that a strip of look metres ahead of v (and a margin) touches. */
function nearAhead(grid, v, look) {
  const ex = v.x + Math.cos(v.heading) * look, ey = v.y + Math.sin(v.heading) * look, m = 10; // m: the longest vehicle + the lane width
  const x0 = Math.floor((Math.min(v.x, ex) - m) / GRID_METRES), x1 = Math.floor((Math.max(v.x, ex) + m) / GRID_METRES);
  const y0 = Math.floor((Math.min(v.y, ey) - m) / GRID_METRES), y1 = Math.floor((Math.max(v.y, ey) + m) / GRID_METRES);
  const out = [];
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const list = grid.get(gridKey(cx, cy)); if (list) for (const o of list) out.push(o); }
  return out;
}

/**
 * Anything in front of vehicle v, in its path: returns the free distance (metres), the speed of the thing
 * ahead, and cross (true when the thing ahead is a vehicle that crosses the path of v).
 */
function gapAhead(v, others, now) {
  const fx = Math.cos(v.heading), fy = Math.sin(v.heading);
  let gap = Infinity, aheadSpeed = 0, ahead = null, cross = false, turned = false;
  const going = now < (v.goUntil ?? 0);
  const look = 8 + v.speed * 2;
  const swerving = (v.swerve ?? 0) > 0.5;
  for (const o of others) {
    if (o === v || o === v.passing) continue;
    const rx = o.x - v.x, ry = o.y - v.y;
    const along = rx * fx + ry * fy;
    if (along <= 0 || along > look + (o.length ?? 1)) continue;
    let side = Math.abs(-rx * fy + ry * fx);
    let alongExt = (o.length ?? 1) / 2, crossing = false, crossSame = 0;
    // A cyclist at the road edge and a car in the lane can pass each other when there is room.
    // A moto that stands at the roadside (o.roadside: a hired rider who waits for help) counts the same.
    const cyclist = o.kind === 'cyclist' || v.kind === 'cyclist' || o.roadside;
    let room = cyclist ? (v.width + (o.width ?? 0.8)) / 2 + 0.25 : 1.6 + (o.width ?? 0.8) / 2;
    if (o.heading !== undefined && o.edge !== undefined) {
      const same = Math.cos(o.heading) * fx + Math.sin(o.heading) * fy;
      // Oncoming vehicles keep to their own lane. They count only when v swerves into that lane.
      if (same < -0.7 && !swerving) continue;
      // Two vehicles that wait for each other (at a junction, or where two lanes merge): the one that is
      // already further into the path of the other goes first (it can clear the way). Else the lower id goes.
      if (o.blocker === v) {
        const mine = Math.abs(-rx * fy + ry * fx);
        const theirs = Math.abs(rx * Math.sin(o.heading) - ry * Math.cos(o.heading));
        if (mine > theirs + 0.2 || (Math.abs(mine - theirs) <= 0.2 && v.id < o.id)) continue;
      }
      // A vehicle that waited too long for turned or crossing traffic goes anyway, so that nothing locks up.
      if (same < 0.8 && going) continue;
      if (same < 0.3 && same >= -0.7) {
        // Crossing traffic (Alp, 14 October 2026: "I saw a truck run through a motorcycle"): its footprint
        // turned to the heading of v, now and a short time later.
        if (along > TRAFFIC.crossLookMetres + v.speed * TRAFFIC.crossLookSeconds * 2) continue; // it leaves the path soon
        crossing = true;
        crossSame = same;
        const sin = Math.sqrt(Math.max(0, 1 - same * same));
        alongExt = Math.abs(same) * (o.length ?? 1) / 2 + sin * (o.width ?? 0.8) / 2;
        room = v.width / 2 + sin * (o.length ?? 1) / 2 + Math.abs(same) * (o.width ?? 0.8) / 2 + 0.25;
        const t = TRAFFIC.crossLookSeconds, ox = Math.cos(o.heading) * (o.speed ?? 0) * t, oy = Math.sin(o.heading) * (o.speed ?? 0) * t;
        side = Math.min(side, Math.abs(-(rx + ox) * fy + (ry + oy) * fx));
      }
    }
    if (side > room) continue;
    const free = along - v.length / 2 - alongExt;
    if (free < gap) {
      gap = free;
      aheadSpeed = crossing ? Math.max(0, (o.speed ?? 0) * crossSame) : o.speed ?? 0; // only the part of its speed along the path of v
      ahead = o;
      cross = crossing;
      turned = o.heading !== undefined && o.edge !== undefined && Math.cos(o.heading) * fx + Math.sin(o.heading) * fy < 0.8;
    }
  }
  return { gap, aheadSpeed, ahead, cross, turned };
}

/**
 * A rare real crash (Alp, 14 October 2026: "other vehicles should have a collision probability"): when two
 * vehicles come too near too fast, near the bike (traffic.focus) and not too often. Both stop, and the
 * drivers argue. Returns true if they crash.
 */
function rollCrash(traffic, v, o, gap, cross) {
  const C = TRAFFIC.crash;
  if (!traffic.focus || !o.edge || o.crashed > 0 || v.mission || o.mission) return false;
  if (C.notKinds.includes(v.kind) || C.notKinds.includes(o.kind)) return false;
  const closing = cross ? v.speed : v.speed - (o.speed ?? 0);
  if (gap > C.conflictMetres || closing < C.conflictKmh / 3.6) return false;
  // One roll for each meeting of the two.
  if (v.rolledWith === o.id) return false;
  v.rolledWith = o.id;
  if (traffic.time < (traffic.nextCrashAt ?? 0)) return false;
  if (Math.hypot(v.x - traffic.focus.x, v.y - traffic.focus.y) > C.nearMetres) return false;
  if (traffic.rng() >= C.chance) return false;
  traffic.nextCrashAt = traffic.time + C.everySeconds;
  for (const w of [v, o]) {
    w.crashed = C.seconds;
    w.speed = 0;
    w.crashTilt = (traffic.rng() - 0.5) * 0.5;
  }
  return true;
}

/**
 * Advance all vehicles by dt. obstacles = other things to keep a gap to (the bike, people),
 * each { x, y, length, width, speed }. Returns events: { type: 'exhaust', vehicle }.
 */
export function stepTraffic(traffic, world, obstacles, dt) {
  const { vehicles, rng, nodeClaims } = traffic;
  traffic.time += dt;
  const now = traffic.time;
  const grid = buildGrid(vehicles.concat(obstacles));
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
    // On a roundabout ring (a tight curve) and when it comes onto one.
    if (v.edge.road?.ring || (v.next?.road?.ring && toEnd < 10)) target = Math.min(target, TRAFFIC.ringKmh * KMH);
    // Road works (sim/roadevents.js): slow past the cones and the workers.
    if (traffic.slowZones?.length) target = Math.min(target, slowZoneLimit(traffic.slowZones, v.x, v.y));
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
    // After a crash the vehicle stands still while the drivers argue.
    if (v.crashed > 0) {
      v.crashed -= dt;
      v.speed = 0;
      v.why = 'crash';
      if (v.crashed <= 0) v.crashTilt = 0;
      place(v);
      if (v.crashed > 0) continue;
    }
    // Keep a gap to whatever is ahead.
    v.why = 'free';
    const { gap, aheadSpeed, ahead, cross, turned } = gapAhead(v, nearAhead(grid, v, 8 + v.speed * 2 + (v.swerve ?? 0)), now);
    if (ahead?.edge && rollCrash(traffic, v, ahead, gap, cross)) {
      events.push({ type: 'vehicleCrash', a: v, b: ahead });
      place(v);
      place(ahead);
      continue;
    }
    if (gap < Infinity) {
      const t2 = Math.max(0, Math.min(aheadSpeed + (gap - 2) * 0.8, (gap - 1.5) * 1.5));
      if (t2 < target) {
        target = t2;
        v.why = 'gap';
        v.blocker = ahead;
      }
    }
    v.crossWait = turned && v.why === 'gap' && v.speed < 0.5 ? (v.crossWait ?? 0) + dt : 0;
    if (v.crossWait > TRAFFIC.crossPatienceSeconds) {
      v.crossWait = 0;
      v.goUntil = now + TRAFFIC.crossGoSeconds;
    }
    // Behind a crash: wait a moment, then drive round it on the left side.
    const sw = TRAFFIC.crash;
    if (ahead?.crashed > 0 && !cross && v.why === 'gap' && v.speed < 0.5) {
      v.crashWait = (v.crashWait ?? 0) + dt;
      if (v.crashWait > sw.swerveAfterSeconds) {
        v.passing = ahead;
        v.swerveTo = (ahead.width ?? 2) / 2 + v.width / 2 + 0.4;
      }
    } else v.crashWait = 0;
    if (v.passing) {
      const p = v.passing, fx = Math.cos(v.heading), fy = Math.sin(v.heading);
      // Past it (or it drives on again): back into the lane.
      if (!(p.crashed > 0) || (p.x - v.x) * fx + (p.y - v.y) * fy < -(p.length + v.length) / 2 - 1) { v.passing = null; v.swerveTo = 0; }
      else target = Math.min(target, sw.swerveKmh / 3.6);
    }
    v.swerve = approach(v.swerve ?? 0, v.swerveTo ?? 0, sw.swerveRate * dt);
    // Give way to the traffic on a roundabout: wait at the ring until no vehicle on the ring is near.
    // Where it waits: the front of the vehicle stays out of the cross lanes (a long truck waits further back).
    const waitAt = TRAFFIC.waitFrontMetres + v.length / 2;
    const node0 = v.edge.to;
    if (v.next?.road?.ring && !v.edge.road?.ring && toEnd < waitAt + 4) {
      const busy = vehicles.some((w) => w !== v && w.edge.road?.ring && w.edge.from !== node0
        && (w.edge.to === node0 || w.next?.to === node0) && Math.hypot(w.x - node0.x, w.y - node0.y) < TRAFFIC.ringGiveWayMetres);
      if (busy && (v.ringWait ?? 0) < TRAFFIC.ringPatienceSeconds) {
        target = Math.min(target, Math.max(0, (toEnd - waitAt) * 1.5));
        v.why = 'giveWay';
        v.ringWait = (v.ringWait ?? 0) + dt;
      }
    } else v.ringWait = 0;
    // Traffic lights (sim/lights.js): stop at the stop line on red, and on amber when there is room.
    const signal = v.edge.to.light;
    if (signal) {
      const lim = lightLimit(signal, now, v.edge, toEnd, v.speed, spec.brake);
      if (lim < target) {
        target = lim;
        v.why = 'light';
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
    // It sees the claim early enough to stop (its stopping distance).
    if (toEnd < waitAt + 2 + (v.speed * v.speed) / (2 * spec.brake) && node.out.length > 2) {
      if (claim && claim.id !== v.id && (v.waited ?? 0) < PATIENCE_SECONDS) {
        target = Math.min(target, Math.max(0, (toEnd - waitAt) * 1.5));
        v.why = 'junction';
        v.waited = (v.waited ?? 0) + dt;
      } else if (toEnd < waitAt && !claim) {
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
      v.next = chooseNext(v, v.edge.to, rng, traffic.closed);
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
        if (v.speed > safeSpeed(tile.hazard) * 1.2) v.speed *= 1 - (HAZARDS[tile.hazard]?.speedCut ?? HAZARDS.pothole.speedCut);
      }
    }
    // Small bumps on murram (a washboard surface), as for the bike.
    const mb = HAZARDS.murramBumps;
    if (tile && (tile.surface === 'murram' || tile.surface === 'murramWet') && v.speed * 3.6 > mb.fromKmh) {
      v.washboard = (v.washboard ?? 0) + v.speed * dt;
      if (v.washboard >= mb.everyMetres * 1.5) {
        v.washboard = 0;
        if (!(v.bump > 0)) v.bump = mb.bounce;
      }
    }
    v.bump = Math.max(0, (v.bump ?? 0) - dt);
    // Exhaust from petrol engines.
    if (spec.exhaust && !spec.electricVariants?.includes(v.variant)) {
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
