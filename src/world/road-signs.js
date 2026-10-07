import { WORLD, ROAD_SIGNS } from '../config.js';
import { speedLimitAt } from '../sim/law.js';
import { hash2 } from './pixel-canvas.js';

// Road signs and zebra crossings, made from the road list of the map. No Phaser here.
// Roads are 2 tiles wide and run along x (rows y, y + 1) or along y (columns x, x + 1).
// Traffic keeps to the right: along +x it uses row y + 1, along −x row y; along +y it uses
// column x, along −y column x + 1. A sign stands on the verge on the right of its lane.
// - Speed limit signs: where the limit changes, and again every ROAD_SIGNS.repeatTiles.
// - A speed bump warning sign before each speed bump.
// - A crossing sign at each zebra crossing. Zebra crossings are next to some junctions.

/** For each road tile: how many roads use it (2 or more = a junction). Map 'tx,ty' → count. Cached. */
function roadUse(world) {
  if (world.roadUseCache) return world.roadUseCache;
  const count = new Map();
  const add = (tx, ty) => count.set(`${tx},${ty}`, (count.get(`${tx},${ty}`) ?? 0) + 1);
  for (const r of world.roads ?? []) {
    if (r.y !== undefined) for (let x = r.x0; x <= r.x1; x++) { add(x, r.y); add(x, r.y + 1); }
    else for (let y = r.y0; y <= r.y1; y++) { add(r.x, y); add(r.x + 1, y); }
  }
  world.roadUseCache = count;
  return count;
}

/** The two tiles across a road at index i (along the road), and the road's direction. */
function across(r, i) {
  return r.y !== undefined ? [[i, r.y], [i, r.y + 1]] : [[r.x, i], [r.x + 1, i]];
}

const range = (r) => (r.y !== undefined ? [r.x0, r.x1] : [r.y0, r.y1]);

/**
 * Zebra crossings: Map 'tx,ty' → { alongX } (alongX: the road runs along x, so the white bars
 * run along x too). On a tarmac road, the two tiles just before a junction, on some of the arms.
 */
export function crossings(world) {
  if (world.crossingCache) return world.crossingCache;
  const use = roadUse(world);
  const out = new Map();
  const isJunction = (tx, ty) => (use.get(`${tx},${ty}`) ?? 0) > 1;
  for (const r of world.roads ?? []) {
    const [a, b] = range(r);
    const alongX = r.y !== undefined;
    for (let i = a; i <= b; i++) {
      const pair = across(r, i);
      if (pair.some(([x, y]) => isJunction(x, y))) continue;
      const nextToJunction = [-1, 1].some((d) => across(r, i + d).every(([x, y]) => isJunction(x, y)));
      if (!nextToJunction) continue;
      const tiles = pair.map(([x, y]) => world.tile(x, y));
      if (tiles.some((t) => !t || t.surface !== 'tarmac' || t.hazard || t.block)) continue;
      if (hash2(pair[0][0], pair[0][1], 77) >= ROAD_SIGNS.crossingChance) continue;
      for (const [x, y] of pair) out.set(`${x},${y}`, { alongX });
    }
  }
  world.crossingCache = out;
  return out;
}

/**
 * All the road signs for the map: [{ x, y (tiles), kind: 'limit' | 'bump' | 'crossing', limitKmh? }].
 * taken: signs that are on the map already (a new sign does not stand near one of them).
 */
export function roadSigns(world, taken = []) {
  const T = WORLD.tileMetres;
  const use = roadUse(world);
  const cross = crossings(world);
  const signs = [];
  const near = (x, y, d) => [...taken, ...signs, ...(world.lamps ?? [])].some((s) => Math.hypot(s.x - x, s.y - y) < d);
  // A free place on the verge: not a road, not a building, not water, not a closed edge of the map.
  const free = (x, y) => {
    const t = world.tile(Math.floor(x), Math.floor(y));
    if (!t || t.block || t.surface === 'water' || use.has(`${Math.floor(x)},${Math.floor(y)}`)) return false;
    return !near(x, y, ROAD_SIGNS.minGapTiles);
  };
  const put = (sign) => {
    if (!free(sign.x, sign.y)) return false;
    signs.push(sign);
    return true;
  };

  // Three passes: crossing signs and bump warnings first (they must stand in one place), then the limits.
  for (const pass of ['crossing', 'bump', 'limit']) for (const r of world.roads ?? []) {
    const alongX = r.y !== undefined;
    const [a, b] = range(r);
    for (const dir of [1, -1]) {
      // The lane for this direction and the verge on its right.
      const lane = alongX ? (dir > 0 ? r.y + 1 : r.y) : dir > 0 ? r.x : r.x + 1;
      const verge = alongX ? (dir > 0 ? r.y + 2 + ROAD_SIGNS.vergeInset : r.y - ROAD_SIGNS.vergeInset) : dir > 0 ? r.x - ROAD_SIGNS.vergeInset : r.x + 2 + ROAD_SIGNS.vergeInset;
      const at = (i) => (alongX ? { x: i + 0.5, y: verge } : { x: verge, y: i + 0.5 });
      const laneTile = (i) => (alongX ? [i, lane] : [lane, i]);
      const order = [];
      for (let i = dir > 0 ? a : b; dir > 0 ? i <= b : i >= a; i += dir) order.push(i);

      // Speed limits: a sign where the limit changes, then one every repeatTiles.
      if (pass === 'limit') {
        let last = null, since = 0, pending = 0;
        for (const i of order) {
          const [tx, ty] = laneTile(i);
          if ((use.get(`${tx},${ty}`) ?? 0) > 1) continue; // no signs in a junction
          const { limitKmh } = speedLimitAt(world, (tx + 0.5) * T, (ty + 0.5) * T);
          since++;
          if (limitKmh !== last) { last = limitKmh; pending = ROAD_SIGNS.tries; }
          else if (since >= ROAD_SIGNS.repeatTiles && !pending) pending = ROAD_SIGNS.tries;
          if (pending) {
            if (put({ ...at(i), kind: 'limit', limitKmh })) { pending = 0; since = 0; }
            else pending--;
          }
        }
      }

      // A warning sign a few tiles before each speed bump (one for each bump band).
      if (pass === 'bump') for (let k = 0; k < order.length; k++) {
        const [tx, ty] = laneTile(order[k]);
        if (world.tile(tx, ty)?.hazard !== 'speedBump') continue;
        const prev = k > 0 ? laneTile(order[k - 1]) : null;
        if (prev && world.tile(prev[0], prev[1])?.hazard === 'speedBump') continue;
        for (let back = ROAD_SIGNS.bumpWarnTiles; back <= ROAD_SIGNS.bumpWarnTiles + 2; back++) {
          if (k - back >= 0 && put({ ...at(order[k - back]), kind: 'bump' })) break;
        }
      }

      // A crossing sign on the right verge at each zebra crossing (one for each crossing).
      if (pass === 'crossing') for (const i of order) {
        const [tx, ty] = laneTile(i);
        if (cross.has(`${tx},${ty}`)) put({ ...at(i), kind: 'crossing' });
      }
    }
  }
  return signs;
}
