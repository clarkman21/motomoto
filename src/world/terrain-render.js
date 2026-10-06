import { WORLD } from '../config.js';
import { toScreen } from './iso.js';
import { PixelCanvas, shadeColour, hash2 } from './pixel-canvas.js';

// Draws the ground of the whole map into one PixelCanvas at 1× scale.
// The bike never goes below the ground, so the ground is one image under all
// sprites. Blocks (buildings, trees) are separate sprites so they can sort
// in front of or behind the bike.

const SKIRT_LEVELS = 2; // depth of the earth wall at the front edges of the map

// Light comes from the upper left of the screen (world -x, a little -y) and from above.
const LIGHT = normalise([-0.55, -0.35, 1]);
const FLAT_LIGHT = LIGHT[2];

const PALETTE = {
  grass: [0x5d9b3a, 0x4f8a32, 0x6fb046],
  tarmac: [0x5b5f63, 0x515458, 0x66696d],
  cobbleStone: [0x9b9184, 0x8d8477, 0xa69d90],
  cobbleMortar: 0x5e564d,
  murram: [0xb0552b, 0xa04b26, 0xc2663a],
  pebble: 0xd7a07a,
  murramWet: [0x7a3a1f, 0x6c321b, 0x84422a],
  puddle: 0x6d7f8c,
  puddleShine: 0x9fb3bf,
  pothole: 0x2a2c2e,
  potholeRim: 0x46494c,
  bumpLight: 0xe8e4d8,
  bumpDark: 0x2b2b2b,
  curb: 0xb8b2a2,
  flowers: [0xd04a6a, 0x9a5ad0, 0xf0f0f0],
  soil: [0x6b3a22, 0x9a4a27, 0x7d3b20],
};

export function renderTerrain(world) {
  const T = WORLD.tileMetres;
  const L = WORLD.levelMetres;
  const vertex = (vx, vy, levels = world.vertexLevel(vx, vy)) => {
    const s = toScreen(vx * T, vy * T, levels * L);
    return { sx: s.x, sy: s.y, wx: vx * T, wy: vy * T, wz: levels * L };
  };

  // Screen bounds of the ground and the front edge walls.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let vy = 0; vy <= world.height; vy++) {
    for (let vx = 0; vx <= world.width; vx++) {
      for (const lv of [world.vertexLevel(vx, vy), -SKIRT_LEVELS]) {
        const p = vertex(vx, vy, lv);
        minX = Math.min(minX, p.sx); maxX = Math.max(maxX, p.sx);
        minY = Math.min(minY, p.sy); maxY = Math.max(maxY, p.sy);
      }
    }
  }
  const ox = Math.floor(minX) - 2;
  const oy = Math.floor(minY) - 2;
  const canvas = new PixelCanvas(maxX - ox + 4, maxY - oy + 4, ox, oy);

  // Painter's order: tiles further back (smaller x + y) first.
  const order = [...world.tiles].sort((a, b) => a.tx + a.ty - (b.tx + b.ty) || a.tx - b.tx);
  for (const tile of order) {
    const { tx, ty } = tile;
    const p00 = vertex(tx, ty), p10 = vertex(tx + 1, ty), p11 = vertex(tx + 1, ty + 1), p01 = vertex(tx, ty + 1);
    drawGroundTri(canvas, world, tile, [p00, 0, 0], [p10, 1, 0], [p11, 1, 1]);
    drawGroundTri(canvas, world, tile, [p00, 0, 0], [p11, 1, 1], [p01, 0, 1]);
  }

  // Earth walls on the two front edges of the map.
  for (let ty = 0; ty < world.height; ty++) {
    drawSkirt(canvas, vertex(world.width, ty), vertex(world.width, ty + 1), vertex(world.width, ty + 1, -SKIRT_LEVELS), vertex(world.width, ty, -SKIRT_LEVELS), 0.72);
  }
  for (let tx = 0; tx < world.width; tx++) {
    drawSkirt(canvas, vertex(tx, world.height), vertex(tx + 1, world.height), vertex(tx + 1, world.height, -SKIRT_LEVELS), vertex(tx, world.height, -SKIRT_LEVELS), 0.9);
  }
  return canvas;
}

function drawGroundTri(canvas, world, tile, [a, au, av], [b, bu, bv], [c, cu, cv]) {
  const n = triNormal(a, b, c);
  const light = clamp(quantise(dot(n, LIGHT) / FLAT_LIGHT, 12), 0.62, 1.2);
  const ctx = tileContext(world, tile);
  canvas.fillTri(
    { x: a.sx, y: a.sy, u: au, v: av },
    { x: b.sx, y: b.sy, u: bu, v: bv },
    { x: c.sx, y: c.sy, u: cu, v: cv },
    (u, v, px, py) => shadeColour(surfaceColour(ctx, u, v, px + canvas.ox, py + canvas.oy), light),
  );
}

function drawSkirt(canvas, topA, topB, botB, botA, light) {
  const L = WORLD.levelMetres;
  canvas.fillQuad(
    { x: topA.sx, y: topA.sy, u: 0, v: topA.wz / L },
    { x: topB.sx, y: topB.sy, u: 1, v: topB.wz / L },
    { x: botB.sx, y: botB.sy, u: 1, v: -SKIRT_LEVELS },
    { x: botA.sx, y: botA.sy, u: 0, v: -SKIRT_LEVELS },
    (u, z, px, py) => {
      const top = topA.wz / L + (topB.wz / L - topA.wz / L) * u;
      const depth = top - z; // levels below the ground surface
      let col = depth < 0.12 ? PALETTE.grass[1] : depth < 0.5 ? PALETTE.soil[0] : PALETTE.soil[1 + (Math.floor(z * 3) & 1)];
      if (hash2(px + canvas.ox, py + canvas.oy, 7) > 0.93) col = shadeColour(col, 0.85);
      return shadeColour(col, light);
    },
  );
}

/** Facts about a tile and its neighbours that the pixel shader needs. */
function tileContext(world, tile) {
  const n = (dx, dy) => world.tile(tile.tx + dx, tile.ty + dy);
  const isRoad = (t) => t && t.surface !== 'grass' && !t.block;
  const curbs = {
    west: tile.surface === 'tarmac' && !isRoad(n(-1, 0)),
    east: tile.surface === 'tarmac' && !isRoad(n(1, 0)),
    north: tile.surface === 'tarmac' && !isRoad(n(0, -1)),
    south: tile.surface === 'tarmac' && !isRoad(n(0, 1)),
  };
  // A speed bump band runs across the road. Bump tiles in a column mean the road runs along x.
  const bumpN = n(0, -1)?.hazard === 'speedBump' || n(0, 1)?.hazard === 'speedBump';
  const nearMonument = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].some(([dx, dy]) => n(dx, dy)?.block === 'monument');
  return { tile, curbs, bumpAcrossX: bumpN, nearMonument };
}

function surfaceColour(ctx, u, v, sx, sy) {
  const { tile } = ctx;
  const r = hash2(sx, sy);
  const wu = tile.tx + u; // world position in tiles, for patterns that stick to the ground
  const wv = tile.ty + v;
  switch (tile.surface) {
    case 'grass': {
      if (ctx.nearMonument && r > 0.9) return PALETTE.flowers[Math.floor(hash2(sx, sy, 3) * 3)];
      return pick(PALETTE.grass, r, 0.14, 0.9);
    }
    case 'cobble': {
      const rows = 6;
      const sv = wv * rows;
      const row = Math.floor(sv);
      const su = wu * rows + (row & 1 ? 0.5 : 0);
      const fu = su - Math.floor(su), fv = sv - row;
      if (fu < 0.14 || fv < 0.16) return PALETTE.cobbleMortar;
      const tone = PALETTE.cobbleStone[Math.floor(hash2(Math.floor(su), row, 5) * 3)];
      return fv < 0.32 ? shadeColour(tone, 1.08) : tone;
    }
    case 'murram': {
      if (r > 0.985) return PALETTE.pebble;
      return pick(PALETTE.murram, r, 0.2, 0.86);
    }
    case 'murramWet': {
      const p = valueNoise(wu * 2.2, wv * 2.2, 11);
      if (p > 0.66) return p > 0.72 && r > 0.8 ? PALETTE.puddleShine : PALETTE.puddle;
      return pick(PALETTE.murramWet, r, 0.22, 0.88);
    }
    default: {
      // tarmac, with hazards and curbs
      let col = pick(PALETTE.tarmac, r, 0.1, 0.86);
      const c = ctx.curbs;
      const e = 0.07;
      if ((c.west && u < e) || (c.east && u > 1 - e) || (c.north && v < e) || (c.south && v > 1 - e)) col = PALETTE.curb;
      if (tile.hazard === 'pothole') {
        const wob = 0.04 * Math.sin(Math.atan2(v - 0.5, u - 0.5) * 3 + tile.tx);
        const d = Math.hypot((u - 0.5) * 1.1, v - 0.5) + wob;
        if (d < 0.24) col = PALETTE.pothole;
        else if (d < 0.29) col = PALETTE.potholeRim;
      } else if (tile.hazard === 'speedBump') {
        const across = ctx.bumpAcrossX ? u : v; // position across the band
        const along = ctx.bumpAcrossX ? wv : wu; // position along the band
        if (across > 0.38 && across < 0.62) col = Math.floor(along * 4) & 1 ? PALETTE.bumpLight : PALETTE.bumpDark;
      }
      return col;
    }
  }
}

function pick(tones, r, darkBelow, lightAbove) {
  if (r < darkBelow) return tones[1];
  if (r > lightAbove) return tones[2];
  return tones[0];
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const quantise = (x, steps) => Math.round(x * steps) / steps;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normalise(v) {
  const len = Math.hypot(...v);
  return v.map((c) => c / len);
}

function triNormal(a, b, c) {
  const e1 = [b.wx - a.wx, b.wy - a.wy, b.wz - a.wz];
  const e2 = [c.wx - a.wx, c.wy - a.wy, c.wz - a.wz];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  if (n[2] < 0) n.forEach((_, i) => (n[i] = -n[i]));
  return normalise(n);
}
