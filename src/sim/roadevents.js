import { ROAD_EVENTS as R } from '../config.js';
import { mulberry32 } from './jobs.js';
import { lanePoint } from './roads.js';

// Street events (spec "More traffic in later levels"): road works, VIP convoys and car free mornings.
// No Phaser here. The events of a day come from a seed (the day and the level), so a reload gives the same day.

const KMH = 1 / 3.6;
const isMain = (e) => e.road && !e.road.ring && e.road.surface !== 'm';
const mid = (e) => ({ x: (e.from.x + e.to.x) / 2, y: (e.from.y + e.to.y) / 2 });

/**
 * Today's road works: [{ id, cones, patch (4 corners), workers, sign, zone: { x, y, r, kmh } }] (metres).
 * graph: the road graph of the open roads. districtAt(x, y): the district of a point (metres).
 */
export function pickRoadWorks(graph, districtAt, districts, day, levelN) {
  const W = R.works;
  if (levelN < W.fromLevel) return [];
  const rng = mulberry32(day * 911 + levelN * 7 + 3);
  rng();
  const seen = new Set();
  const byDistrict = new Map();
  for (const e of graph.edges) {
    if (!isMain(e) || e.road.median || e.length < W.minEdgeMetres) continue;
    const key = [e.from.id, e.to.id].sort().join('-'); // one edge of each pair
    if (seen.has(key)) continue;
    seen.add(key);
    const d = districtAt(mid(e).x, mid(e).y);
    if (!districts.includes(d)) continue;
    if (!byDistrict.has(d)) byDistrict.set(d, []);
    byDistrict.get(d).push(e);
  }
  const sites = [];
  for (const d of districts) {
    const list = byDistrict.get(d);
    if (!list?.length || rng() >= W.chancePerDistrict) continue;
    const e = list[Math.floor(rng() * list.length)];
    const s = e.length / 2, half = W.lengthMetres / 2, off = W.offset;
    const cones = [];
    for (let a = -half; a <= half + 0.01; a += 2) cones.push(lanePoint(e, s + a, off));
    cones.push(lanePoint(e, s - half - 1.5, off - 0.5), lanePoint(e, s - half - 3, off - 1)); // the taper
    sites.push({
      id: `works-${sites.length}`,
      cones,
      patch: [lanePoint(e, s - half, off - 0.2), lanePoint(e, s + half, off - 0.2), lanePoint(e, s + half, off + 0.7), lanePoint(e, s - half, off + 0.7)],
      workers: [lanePoint(e, s - 2, off + 0.4), lanePoint(e, s + 3, off + 0.3)],
      sign: lanePoint(e, s - half - 5, off + 0.3),
      zone: { ...lanePoint(e, s, 0), r: half + W.radiusExtra, kmh: W.kmh },
    });
  }
  return sites;
}

/** The shortest way from node a to node b on the main roads only (a list of edges), or null. */
export function mainRoadPath(graph, a, b) {
  if (a === b) return [];
  const dist = new Map([[a.id, 0]]);
  const prev = new Map();
  const open = [a];
  const done = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist.get(open[i].id) < dist.get(open[bi].id)) bi = i;
    const n = open.splice(bi, 1)[0];
    if (done.has(n.id)) continue;
    done.add(n.id);
    if (n === b) break;
    for (const e of n.out) {
      if (!isMain(e)) continue;
      const d = dist.get(n.id) + e.length;
      if (d < (dist.get(e.to.id) ?? Infinity)) {
        dist.set(e.to.id, d);
        prev.set(e.to.id, e);
        open.push(e.to);
      }
    }
  }
  if (!prev.has(b.id)) return null;
  const path = [];
  for (let n = b; n !== a; n = prev.get(n.id).from) path.unshift(prev.get(n.id));
  return path;
}

/**
 * Today's VIP convoy, or null: { hour, route: [edges] } on the main roads, from one far point to another.
 * shift: { start, end } (hours). force: a convoy at any level (the cheat menu).
 */
export function planConvoy(graph, districtAt, districts, day, levelN, shift, force = false) {
  const V = R.vip;
  if (levelN < V.fromLevel && !force) return null;
  const rng = mulberry32(day * 613 + levelN * 29 + 11);
  rng();
  if (rng() >= V.chance && !force) return null;
  const nodes = graph.nodes.filter((n) => n.out.some(isMain) && districts.includes(districtAt(n.x, n.y)));
  if (nodes.length < 2) return null;
  for (let tries = 0; tries < 20; tries++) {
    const a = nodes[Math.floor(rng() * nodes.length)], b = nodes[Math.floor(rng() * nodes.length)];
    if (Math.hypot(a.x - b.x, a.y - b.y) < V.minMetres) continue;
    const route = mainRoadPath(graph, a, b);
    if (!route?.length) continue;
    const hour = shift.start + 1 + rng() * Math.max(0.5, shift.end - shift.start - 2);
    return { hour, route };
  }
  return null;
}

/**
 * The vehicles of a convoy, ready to add to the traffic: a police car in front, then the black cars.
 * makeVehicle(kind, edge, s) makes one vehicle (sim/traffic.js addVehicle). They all follow the route.
 */
export function convoyVehicles(convoy, makeVehicle) {
  const [first, ...rest] = convoy.route;
  const kinds = ['police', ...Array(R.vip.cars).fill('vip')];
  const out = [];
  kinds.forEach((kind, i) => {
    const s = Math.max(0.5, first.length - 3 - i * R.vip.gapMetres);
    const v = makeVehicle(kind, first, s, rest.slice());
    v.convoy = true;
    v.siren = kind === 'police';
    v.maxSpeed = R.vip.kmh * KMH;
    out.push(v);
  });
  return out;
}

/**
 * The bike near a convoy: { near (a convoy vehicle within seeMetres), violation (you ride on within
 * pullOverMetres) }. speedKmh: the bike speed.
 */
export function convoyCheck(vehicles, bike, speedKmh) {
  let near = false, violation = false;
  for (const v of vehicles) {
    if (!v.convoy) continue;
    const d = Math.hypot(v.x - bike.x, v.y - bike.y);
    if (d < R.vip.seeMetres) near = true;
    if (d < R.vip.pullOverMetres && speedKmh > R.vip.stopKmh) violation = true;
  }
  return { near, violation };
}

/** Is today a car free morning? (Not on an Umuganda day.) */
export function isCarFreeDay(day, levelN, dayEvent) {
  if (levelN < R.carFree.fromLevel || dayEvent === 'umuganda') return false;
  const rng = mulberry32(day * 397 + levelN * 13 + 5);
  rng();
  return rng() < R.carFree.chance;
}

/** The car free hours. */
export function carFreeNow(hour) {
  return hour >= R.carFree.fromHour && hour < R.carFree.toHour;
}

/** The closed roads (road objects of the map). */
export function carFreeRoads(roads) {
  return roads.filter((r) => R.carFree.roads.includes(r.name));
}

/** The speed limit (m/s) of the slow zones (road works) at a point, or Infinity. */
export function slowZoneLimit(zones, x, y) {
  let lim = Infinity;
  for (const z of zones ?? []) if (Math.hypot(x - z.x, y - z.y) < z.r) lim = Math.min(lim, z.kmh * KMH);
  return lim;
}

