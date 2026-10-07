import { WORLD, MARKET, MOMO } from '../config.js';
import { hash2 } from './pixel-canvas.js';
import { MARKET_GOODS, KITENGE, GOAT_COATS } from './market-sprites.js';

// Where the market vendors and animals stand. No Phaser here, so the tests can use it.

const T = WORLD.tileMetres;
const GROUND = ['murram', 'pavement', 'grass'];

/**
 * Where the vendors and animals stand (no Phaser, so the tests can use it). Free ground tiles in
 * the markets get a vendor or a small herd; pavements near the markets get a few vendors.
 * Not near job places, so the markers and waiting customers stay clear.
 */
export function marketSpots(world) {
  const spots = [];
  const markets = (world.crowdAreas ?? []).filter((a) => /market/i.test(a.name));
  const places = world.places;
  const free = (t) => t && !t.block && !t.solid && GROUND.includes(t.surface) && !t.hazard;
  const nearPlace = (tx, ty) => places.some((p) => Math.hypot(p.x - (tx + 0.5), p.y - (ty + 0.5)) < MARKET.clearTiles);
  const vendor = (t, i) => spots.push({
    kind: 'vendor', x: (t.tx + 0.3 + 0.4 * hash2(t.tx, t.ty, 81)) * T, y: (t.ty + 0.3 + 0.4 * hash2(t.ty, t.tx, 82)) * T,
    goods: MARKET_GOODS[Math.floor(hash2(t.tx, t.ty, 83) * MARKET_GOODS.length)], kitenge: Math.floor(hash2(t.tx, t.ty, 84) * KITENGE.length),
    umbrella: hash2(t.tx, t.ty, 85) < MARKET.umbrellaChance, flip: hash2(t.tx, t.ty, 86) < 0.5, phase: i * 0.37,
  });
  // Markets: vendors, and a few herds of goats with a sheep or two.
  const areas = [...markets, ...(world.landmarks ?? []).filter((l) => /ISOKO/.test(l.sign ?? '')).map((l) => ({ x0: l.x0 - 2, y0: l.y0 - 2, x1: l.x1 + 3, y1: l.y1 + 3 }))];
  for (const a of areas) {
    for (let ty = a.y0; ty < a.y1; ty++) {
      for (let tx = a.x0; tx < a.x1; tx++) {
        const t = world.tile(tx, ty);
        if (!free(t) || nearPlace(tx, ty)) continue;
        const h = hash2(tx, ty, 80);
        if (h < MARKET.vendorChance) vendor(t, spots.length);
        else if (h < MARKET.vendorChance + MARKET.herdChance) {
          const n = 2 + Math.floor(hash2(tx, ty, 87) * 2);
          for (let i = 0; i < n; i++) {
            const sheep = hash2(tx + i, ty, 88) < 0.3;
            spots.push({
              kind: sheep ? 'sheep' : 'goat', coat: Math.floor(hash2(tx, ty + i, 89) * GOAT_COATS.length),
              x: (tx + 0.25 + 0.5 * hash2(tx + i, ty, 90)) * T, y: (ty + 0.25 + 0.5 * hash2(tx, ty + i, 91)) * T,
              flip: hash2(tx + i, ty + i, 92) < 0.5, phase: i * 1.3 + tx * 0.11,
            });
          }
        }
      }
    }
  }
  // Street vendors: a few mamas on the pavements of Nyabugogo and Kicukiro.
  for (const t of world.tiles) {
    if (t.surface !== 'pavement' || !MARKET.streetDistricts.includes(t.district) || nearPlace(t.tx, t.ty)) continue;
    if (areas.some((a) => t.tx >= a.x0 && t.tx < a.x1 && t.ty >= a.y0 && t.ty < a.y1)) continue;
    if (free(t) && hash2(t.tx, t.ty, 93) < MARKET.streetVendorChance) vendor(t, spots.length);
  }
  return spots;
}

const ROADS = ['tarmac', 'cobble', 'murram', 'murramWet'];

/**
 * Where the MTN MoMo agents sit: a pavement or a grass verge beside a road, across the whole map, spaced out.
 * Not near job places, stations or lamp posts, and not on a market vendor's tile.
 */
export function momoSpots(world, taken = []) {
  const spots = [];
  const near = (list, tx, ty, d) => list.some((p) => Math.hypot(p.x - tx, p.y - ty) < d);
  const lamps = (world.lamps ?? []).map((l) => ({ x: l.x, y: l.y }));
  const used = taken.map((s) => ({ x: s.x / T, y: s.y / T }));
  const byRoad = (t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const n = world.tile(t.tx + dx, t.ty + dy);
    return n && ROADS.includes(n.surface) && !n.block;
  });
  for (const t of world.tiles) {
    if (!['pavement', 'grass'].includes(t.surface) || t.block || t.solid || t.hazard || hash2(t.tx, t.ty, 120) >= MOMO.chance || !byRoad(t)) continue;
    const cx = t.tx + 0.5, cy = t.ty + 0.5;
    if (near(world.places, cx, cy, MOMO.clearTiles) || near(lamps, cx, cy, 2.2) || near(used, cx, cy, 1.5)) continue;
    if (near(spots.map((s) => ({ x: s.x / T, y: s.y / T })), cx, cy, MOMO.minTiles)) continue;
    // No mirror (flip: false): the MOMO sign on the stand must read the right way.
    spots.push({ kind: 'momo', x: cx * T, y: cy * T, seed: Math.floor(hash2(t.tx, t.ty, 121) * 3), flip: false, phase: hash2(t.ty, t.tx, 123) * 4 });
  }
  return spots;
}
