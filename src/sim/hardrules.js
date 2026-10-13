import { HARD_RULES as H, WORLD } from '../config.js';
import { mulberry32 } from './jobs.js';
import { lanePoint } from './roads.js';
import { cameraFine } from './law.js';

// Hard mode challenges (spec "More places for fines and challenges"): mobile speed checks, one-way
// streets, streets with no motos, overloading, stopping at bus stops, and the bathroom need.
// No Phaser here. The fines are only on hard mode (the scene decides); traffic keeps to the
// one-way streets in every mode.

const T = WORLD.tileMetres;
const isMain = (e) => e.road && !e.road.ring && e.road.surface !== 'm' && !e.road.median;

/** The roads of the map with a rule: [{ road, dir }] for one-way, [road] for no motos. */
export function oneWayRoads(roads) {
  return H.oneWay.flatMap((o) => roads.filter((r) => r.name === o.name).map((road) => ({ road, dir: o.dir })));
}
export function noMotoRoads(roads) {
  return roads.filter((r) => H.noMoto.includes(r.name));
}

/** Is tile (tx, ty) on this straight road (in tiles: along x with y, or along y with x)? */
export function onRoad(r, tx, ty) {
  const w = (r.width ?? 2) - 1;
  return r.y !== undefined ? tx >= r.x0 && tx <= r.x1 && ty >= r.y && ty <= r.y + w : ty >= r.y0 && ty <= r.y1 && tx >= r.x && tx <= r.x + w;
}

/** The way you may drive on a one-way road: a unit vector. */
export function oneWayDir(o) {
  return o.road.y !== undefined ? { x: o.dir, y: 0 } : { x: 0, y: o.dir };
}

// Is this graph edge on the one-way road? (The level graph has copies of the roads, so the name and the place.)
const alongOneWay = (e, o) => e.road && e.road.name === o.road.name && onRoad(o.road, Math.floor((e.from.x + e.to.x) / 2 / T), Math.floor((e.from.y + e.to.y) / 2 / T));
const wrongWay = (e, o) => alongOneWay(e, o) && e.dx * oneWayDir(o).x + e.dy * oneWayDir(o).y < -0.5;

/**
 * Traffic keeps to the one-way streets: remove the edges that go the wrong way (but never the last
 * way out of a node). Changes the graph.
 */
export function pruneOneWay(graph, oneWays) {
  const wrong = (e) => oneWays.some((o) => wrongWay(e, o));
  const removed = new Set();
  for (const n of graph.nodes) {
    const keep = n.out.filter((e) => !wrong(e));
    if (keep.length && keep.length < n.out.length) {
      for (const e of n.out) if (wrong(e)) removed.add(e);
      n.out = keep;
    }
  }
  graph.edges = graph.edges.filter((e) => !removed.has(e));
  return removed.size;
}

/**
 * After pruneOneWay: the one-way roads where traffic can really keep to the rule. A dead-end street
 * keeps its way back, so it is not one-way (you must not get a fine to come out of it).
 */
export function strictOneWays(graph, oneWays) {
  return oneWays.filter((o) => !graph.edges.some((e) => wrongWay(e, o) && !stub(e)));
}
// A very short edge out of a dead end (the end of a road that stops one tile past a junction).
const stub = (e) => e.from.out.length === 1 && e.length <= 2 * T;

/**
 * The rule you break now, or null: 'oneWay' (riding the wrong way on a one-way street), 'noMoto' (a
 * street with no motos). vx, vy: the bike's velocity (m/s).
 */
export function streetRule(oneWays, noMotos, bike) {
  const tx = Math.floor(bike.x / T), ty = Math.floor(bike.y / T);
  for (const r of noMotos) if (onRoad(r, tx, ty)) return 'noMoto';
  for (const o of oneWays) {
    if (!onRoad(o.road, tx, ty)) continue;
    const d = oneWayDir(o);
    if (bike.vx * d.x + bike.vy * d.y < -1.5) return 'oneWay';
  }
  return null;
}

/** Today's mobile speed checks: [{ id, x, y, heading }] (metres): a parked patrol car at the roadside. */
export function pickSpeedChecks(graph, districtAt, districts, day, levelN) {
  const S = H.speedChecks;
  if (levelN < S.fromLevel) return [];
  const rng = mulberry32(day * 271 + levelN * 17 + 9);
  rng();
  const edges = graph.edges.filter((e) => isMain(e) && e.length >= 30 && districts.includes(districtAt((e.from.x + e.to.x) / 2, (e.from.y + e.to.y) / 2)));
  const out = [];
  for (let i = 0; i < S.perDay && edges.length; i++) {
    const e = edges.splice(Math.floor(rng() * edges.length), 1)[0];
    const p = lanePoint(e, e.length * (0.3 + rng() * 0.4), S.offset);
    out.push({ id: `check-${i}`, x: p.x, y: p.y, heading: Math.atan2(e.dy, e.dx) });
  }
  return out;
}

/**
 * Speed checks: a check measures the bike once, when the bike comes within its radius. state: a Map
 * (id → inside). Returns events: [{ check, speedKmh, limitKmh, fine }] (fine 0 when you were not too fast).
 */
export function speedChecks(state, checks, bike, speedKmh, limitKmh) {
  const events = [];
  for (const c of checks) {
    const inside = Math.hypot(bike.x - c.x, bike.y - c.y) < H.speedChecks.radiusMetres;
    if (inside && !state.get(c.id)) events.push({ check: c, speedKmh, limitKmh, fine: cameraFine(speedKmh, limitKmh) });
    state.set(c.id, inside);
  }
  return events;
}

/** Is this job too heavy for a moto? */
export function overloaded(job) {
  return !!job && job.type === 'cargo' && job.kg > H.overload.limitKg;
}

/** Hard mode: make a cargo offer heavy (more kilos, more pay), with the share heavyShare. */
export function maybeHeavy(offer, rng) {
  const O = H.overload;
  if (offer.type !== 'cargo' || offer.mission || rng() >= O.heavyShare) return offer;
  const extra = O.heavyExtraKg[0] + rng() * (O.heavyExtraKg[1] - O.heavyExtraKg[0]);
  return { ...offer, kg: Math.ceil((Math.max(offer.kg, O.limitKg) + extra) / 5) * 5, pay: Math.round((offer.pay * O.heavyPay) / 10) * 10, heavy: true };
}

/** The bathroom need: it fills with the game clock (dHours); drinks add to it. Returns 'urgent' once when it passes urgentAt. */
export function stepBladder(rider, dHours) {
  const was = rider.bladder ?? 0;
  rider.bladder = Math.min(1, was + H.bladder.perHour * dHours);
  return was < H.bladder.urgentAt && rider.bladder >= H.bladder.urgentAt ? 'urgent' : null;
}

/** After food or a drink: an energy drink or ikivuguto fills the bladder faster. */
export function drinkToBladder(rider, food) {
  const add = H.bladder[food] ?? 0;
  rider.bladder = Math.min(1, (rider.bladder ?? 0) + add);
}

/** The power factor from the bathroom need: full = less power. */
export function bladderPower(rider) {
  return (rider?.bladder ?? 0) >= 1 ? H.bladder.fullPower : 1;
}
