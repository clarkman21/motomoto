import { WORLD, SURFACES } from '../config.js';

// The world is a grid of 4 m tiles. Ground height is stored at the tile
// corners (vertices) and is smooth inside a tile, so hills and ramps have no
// steps. Buildings, trees and the monument are solid blocks on top of the ground.

const CHAR_INFO = {
  '.': { surface: 'grass' },
  '#': { surface: 'tarmac' },
  c: { surface: 'cobble' },
  m: { surface: 'murram' },
  w: { surface: 'murramWet' },
  o: { surface: 'tarmac', hazard: 'pothole' },
  '=': { surface: 'tarmac', hazard: 'speedBump' },
  t: { surface: 'grass', block: 'tree' },
  M: { surface: 'grass', block: 'monument' },
  F: { surface: 'tarmac', block: 'fuel', blockLevels: 2 },
  S: { surface: 'tarmac', block: 'swap', blockLevels: 2 },
  G: { surface: 'tarmac', block: 'garage', blockLevels: 3 },
};

// Blocks that join with neighbours of the same kind into one building (one colour, no inner walls).
const GROUPED = ['building', 'fuel', 'swap', 'garage'];

// Trees are round and smaller than a tile. Other blocks fill the whole tile.
const TREE_RADIUS_TILES = 0.28;

export class World {
  constructor(mapData) {
    this.name = mapData.name;
    this.rows = mapData.rows;
    this.height = mapData.rows.length; // in tiles (y)
    this.width = mapData.rows[0].length; // in tiles (x)
    for (const [i, row] of mapData.rows.entries()) {
      if (row.length !== this.width) {
        throw new Error(`Map row ${i} has ${row.length} tiles, expected ${this.width}`);
      }
    }
    this.start = mapData.start;
    this.places = mapData.places ?? [];
    this.zones = mapData.zones ?? [];
    this.cameras = (mapData.cameras ?? []).map((c, i) => ({ id: i, ...c }));
    this.signs = mapData.signs ?? [];
    this.tiles = this.#parseTiles();
    this.vertexLevels = this.#buildHeights(mapData.hills ?? []);
    this.blocks = this.#buildBlocks();
  }

  get widthMetres() {
    return this.width * WORLD.tileMetres;
  }

  get heightMetres() {
    return this.height * WORLD.tileMetres;
  }

  #parseTiles() {
    const tiles = [];
    for (let ty = 0; ty < this.height; ty++) {
      for (let tx = 0; tx < this.width; tx++) {
        const ch = this.rows[ty][tx];
        let info = CHAR_INFO[ch];
        if (!info && ch >= '2' && ch <= '9') {
          info = { surface: 'tarmac', block: 'building', blockLevels: Number(ch) };
        }
        if (!info) throw new Error(`Unknown map character '${ch}' at ${tx},${ty}`);
        tiles.push({ tx, ty, ch, surface: info.surface, hazard: info.hazard ?? null, block: info.block ?? null, blockLevels: info.blockLevels ?? 0 });
      }
    }
    return tiles;
  }

  #buildHeights(hills) {
    const w = this.width + 1;
    const h = this.height + 1;
    const levels = new Float32Array(w * h);
    for (let vy = 0; vy < h; vy++) {
      for (let vx = 0; vx < w; vx++) {
        let best = 0;
        for (const hill of hills) best = Math.max(best, hillLevelAt(hill, vx, vy));
        levels[vy * w + vx] = best;
      }
    }
    return levels;
  }

  #buildBlocks() {
    // Give connected building tiles one building id, so a 2 × 2 building gets one colour.
    const ids = new Map();
    let nextId = 0;
    for (const t of this.tiles) {
      if (!GROUPED.includes(t.block) || ids.has(t)) continue;
      const stack = [t];
      ids.set(t, nextId);
      while (stack.length) {
        const cur = stack.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = this.tile(cur.tx + dx, cur.ty + dy);
          if (n && n.block === t.block && !ids.has(n)) {
            ids.set(n, nextId);
            stack.push(n);
          }
        }
      }
      nextId++;
    }
    const blocks = [];
    for (const t of this.tiles) {
      if (!t.block) continue;
      const corners = this.cornerLevels(t.tx, t.ty);
      const baseLevel = Math.min(...corners);
      const topOfGround = Math.max(...corners);
      let levels = t.blockLevels;
      if (t.block === 'tree') levels = 5;
      if (t.block === 'monument') levels = 8;
      blocks.push({
        tx: t.tx,
        ty: t.ty,
        kind: t.block,
        groupId: ids.get(t) ?? -1,
        baseLevel,
        topLevel: topOfGround + levels,
      });
    }
    return blocks;
  }

  /** A place by id (see map data). */
  place(id) {
    return this.places.find((p) => p.id === id) ?? null;
  }

  /** Solid block on a tile, or null. */
  blockAt(tx, ty) {
    if (!this.blockIndex) this.blockIndex = new Map(this.blocks.map((b) => [b.tx + ',' + b.ty, b]));
    return this.blockIndex.get(tx + ',' + ty) ?? null;
  }

  /** Tile at tile coordinates, or null outside the map. */
  tile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return null;
    return this.tiles[ty * this.width + tx];
  }

  /** Tile under a world point in metres, or null outside the map. */
  tileAt(x, y) {
    return this.tile(Math.floor(x / WORLD.tileMetres), Math.floor(y / WORLD.tileMetres));
  }

  vertexLevel(vx, vy) {
    vx = Math.max(0, Math.min(this.width, vx));
    vy = Math.max(0, Math.min(this.height, vy));
    return this.vertexLevels[vy * (this.width + 1) + vx];
  }

  /** Corner heights in levels: [north-west, north-east, south-east, south-west]. */
  cornerLevels(tx, ty) {
    return [
      this.vertexLevel(tx, ty),
      this.vertexLevel(tx + 1, ty),
      this.vertexLevel(tx + 1, ty + 1),
      this.vertexLevel(tx, ty + 1),
    ];
  }

  /** Ground height in metres at a world point. */
  heightAt(x, y) {
    const { h00, h10, h01, h11, fx, fy } = this.#cell(x, y);
    const levels = h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) + h01 * (1 - fx) * fy + h11 * fx * fy;
    return levels * WORLD.levelMetres;
  }

  /** Ground slope at a world point: rise in metres per metre along x and y. */
  slopeAt(x, y) {
    const { h00, h10, h01, h11, fx, fy } = this.#cell(x, y);
    const k = WORLD.levelMetres / WORLD.tileMetres;
    return {
      dx: ((h10 - h00) * (1 - fy) + (h11 - h01) * fy) * k,
      dy: ((h01 - h00) * (1 - fx) + (h11 - h10) * fx) * k,
    };
  }

  #cell(x, y) {
    const gx = Math.max(0, Math.min(this.width - 1e-6, x / WORLD.tileMetres));
    const gy = Math.max(0, Math.min(this.height - 1e-6, y / WORLD.tileMetres));
    const tx = Math.floor(gx);
    const ty = Math.floor(gy);
    return {
      h00: this.vertexLevel(tx, ty),
      h10: this.vertexLevel(tx + 1, ty),
      h01: this.vertexLevel(tx, ty + 1),
      h11: this.vertexLevel(tx + 1, ty + 1),
      fx: gx - tx,
      fy: gy - ty,
    };
  }

  /** Surface settings (grip, speed and energy factors) at a world point. */
  surfaceAt(x, y) {
    const t = this.tileAt(x, y);
    return SURFACES[t ? t.surface : 'grass'];
  }

  /** True if a world point is outside the map or inside a solid block. */
  isSolidAt(x, y) {
    const t = this.tileAt(x, y);
    if (!t) return true;
    if (!t.block) return false;
    if (t.block === 'tree') {
      const cx = (t.tx + 0.5) * WORLD.tileMetres;
      const cy = (t.ty + 0.5) * WORLD.tileMetres;
      return Math.hypot(x - cx, y - cy) < TREE_RADIUS_TILES * WORLD.tileMetres;
    }
    return true;
  }
}

/** Height in levels that one hill gives to a vertex. */
export function hillLevelAt(hill, vx, vy) {
  const { x0, y0, x1, y1, level, run } = hill;
  let dx = 0;
  if (vx < x0) dx = (x0 - vx) / run.west;
  else if (vx > x1) dx = (vx - x1) / run.east;
  let dy = 0;
  if (vy < y0) dy = (y0 - vy) / run.north;
  else if (vy > y1) dy = (vy - y1) / run.south;
  return Math.max(0, level - Math.max(dx, dy));
}
