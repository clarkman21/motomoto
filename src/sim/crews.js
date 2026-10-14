import { CREWS, WORLD } from '../config.js';

// Work crews at the road sides. No Phaser here.
// - Umuganda (the community work morning): groups of people with hoes in the fields beside the roads,
//   and groups who sweep the roads. Nobody walks in the streets then (see RideScene).
// - Normal days: a few city road sweepers in the early morning.
// A crew member stands still and works (two frames: the hoe up and down, the broom left and right).

const T = WORLD.tileMetres;
const ROAD_SURFACES = ['tarmac', 'murram', 'murramWet', 'cobble'];
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const isRoad = (t) => !!t && !t.block && ROAD_SURFACES.includes(t.surface);
const nextToRoad = (world, t) => SIDES.some(([dx, dy]) => isRoad(world.tile(t.tx + dx, t.ty + dy)));

/**
 * The tiles where a crew can work. task 'hoe': grass beside a road (the fields at the road sides).
 * task 'sweep': pavement beside a road, and the edge tiles of a road (a road tile beside grass or pavement).
 */
export function crewTiles(world, task, districts) {
  const open = (t) => !districts || !t.district || districts.includes(t.district);
  return world.tiles.filter((t) => {
    if (!open(t) || t.block || t.solid) return false;
    if (task === 'hoe') return t.surface === 'grass' && nextToRoad(world, t);
    if (t.surface === 'pavement') return nextToRoad(world, t);
    return isRoad(t) && SIDES.some(([dx, dy]) => {
      const n = world.tile(t.tx + dx, t.ty + dy);
      return n && !n.block && (n.surface === 'grass' || n.surface === 'pavement');
    });
  });
}

/** One worker. look: an index into PERSON_LOOKS, or 'city0' to 'city2' (a city road sweeper: a lady in green). */
function worker(id, t, task, look, rng) {
  return {
    id, kind: 'person', crew: true, task, look,
    x: (t.tx + 0.2 + rng() * 0.6) * T, y: (t.ty + 0.2 + rng() * 0.6) * T,
    phase: rng(), frameMs: CREWS.frameMs[0] + rng() * (CREWS.frameMs[1] - CREWS.frameMs[0]),
    left: rng() < 0.5, hurt: 0, vx: 0, vy: 0, length: 0.7, width: 0.7,
  };
}

/** A group of n workers on the tiles near a seed tile (within 2 tiles). */
function group(world, seed, tiles, n, task, look, rng, nextId) {
  const near = tiles.filter((t) => Math.abs(t.tx - seed.tx) <= 2 && Math.abs(t.ty - seed.ty) <= 2);
  const out = [];
  for (let i = 0; i < n && near.length; i++) out.push(worker(nextId(), near[Math.floor(rng() * near.length)], task, look(), rng));
  return out;
}

/** The look ids to pick from: looks is a count (0..n-1) or a list of ids. */
const lookIds = (looks) => (Array.isArray(looks) ? looks : Array.from({ length: looks }, (_, i) => i));

/**
 * Place the work crews. kind: 'umuganda' (hoes and brooms, everybody) or 'sweepers' (city road sweepers).
 * opts: { districts, looks (the PERSON_LOOKS ids to use, or their count) }. Returns a list of workers.
 */
export function placeCrews(world, rng, kind, opts = {}) {
  const spec = CREWS[kind];
  const districts = opts.districts ?? [...new Set(world.tiles.map((t) => t.district).filter(Boolean))];
  const looks = lookIds(opts.looks ?? 10);
  let id = 1;
  const nextId = () => id++;
  const out = [];
  const tilesOf = { hoe: crewTiles(world, 'hoe', districts), sweep: crewTiles(world, 'sweep', districts) };
  for (const d of districts) {
    const byTask = { hoe: tilesOf.hoe.filter((t) => t.district === d), sweep: tilesOf.sweep.filter((t) => t.district === d) };
    let left = spec.perDistrict;
    while (left > 0) {
      const task = kind === 'sweepers' ? 'sweep' : rng() < spec.hoeShare ? 'hoe' : 'sweep';
      const tiles = byTask[task].length ? byTask[task] : byTask[task === 'hoe' ? 'sweep' : 'hoe'];
      if (!tiles.length) break;
      const [lo, hi] = spec.groupSize;
      const n = Math.min(left, lo + Math.floor(rng() * (hi - lo + 1)));
      const look = () => (kind === 'sweepers' ? `city${Math.floor(rng() * 3)}` : looks[Math.floor(rng() * looks.length)]);
      out.push(...group(world, tiles[Math.floor(rng() * tiles.length)], tiles, n, tiles === byTask.hoe ? 'hoe' : 'sweep', look, rng, nextId));
      left -= n;
    }
  }
  return out;
}

/** A crew at a place (x, y in tiles), for example the work site of an Umuganda run. ids start at firstId. */
export function crewAt(world, rng, x, y, n, firstId, looks = 10) {
  let id = firstId;
  const ids = lookIds(looks);
  const near = (tiles) => tiles.filter((t) => Math.abs(t.tx - x) <= 3 && Math.abs(t.ty - y) <= 3);
  const hoe = near(crewTiles(world, 'hoe'));
  const tiles = hoe.length ? hoe : near(crewTiles(world, 'sweep'));
  if (!tiles.length) return [];
  return group(world, tiles[0], tiles, n, hoe.length ? 'hoe' : 'sweep', () => ids[Math.floor(rng() * ids.length)], rng, () => id++);
}

/** The work frame (0 or 1) of a worker at time ms. */
export function crewFrame(w, ms) {
  return Math.floor(ms / w.frameMs + w.phase * 2) % 2;
}

/** Are the city sweepers at work at this hour? */
export function sweepersOut(hour) {
  const [from, to] = CREWS.sweepers.hours;
  return hour >= from && hour < to;
}

/** The sweepers at work after the morning: a part of them (every second group member, so groups stay). */
export function daySweepers(sweepers) {
  const n = Math.round(1 / Math.max(0.01, CREWS.sweepers.dayShare));
  return sweepers.filter((_, i) => i % n === 0);
}

/** A knocked-down worker gets up again. */
export function stepCrews(crews, dt) {
  for (const w of crews) if (w.hurt > 0) w.hurt = Math.max(0, w.hurt - dt);
}
