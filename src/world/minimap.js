import { WORLD, MINIMAP, COLOURS } from '../config.js';
import { PixelCanvas } from './pixel-canvas.js';

// The minimap: a small flat picture of the whole map, in the same diamond shape as the game
// view (world x goes to the lower right, y to the lower left). One tile is `f` pixels along each
// diagonal. Closed districts are dark. Higher ground is lighter, so you can see the hills.
// No Phaser here, so the tests can run it.

const GROUND = {
  tarmac: 0x3c4044, cobble: 0x6e665c, murram: 0xb0643a, murramWet: 0x8a4e30, grass: 0x4f8a3c,
  pavement: 0xa8a294, sand: 0xd8c890, water: 0x3a6a9a,
};
const BLOCKS = { tree: 0x2c6228, fuel: COLOURS.spBlue, swap: 0x3c4044, garage: 0x2f6fb0, dome: 0xf2efe6, monument: 0xf2efe6 };
const BUILDING = { tower: 0x6f9fb8, government: 0xefe6cc, school: 0x5f8fd0 };
const BUILDING_OTHER = 0x8c7c6c;
const LANDMARK = 0xf2e6c8;
const CLOSED = [0x4a4e52, 0x30343a]; // grey stripes: not open yet

/** Size of the minimap in pixels for a map, at f pixels per tile. */
export function minimapSize(world, f) {
  return { width: Math.ceil((world.width + world.height) * f), height: Math.ceil(((world.width + world.height) * f) / 2) };
}

/** Project a world point (metres) to minimap pixels. */
export function minimapPoint(world, f, x, y) {
  const tx = x / WORLD.tileMetres, ty = y / WORLD.tileMetres;
  return { x: (tx - ty + world.height) * f, y: ((tx + ty) * f) / 2 };
}

/** The minimap direction (unit vector) of a world heading. */
export function minimapDirection(heading) {
  const dx = Math.cos(heading) - Math.sin(heading), dy = (Math.cos(heading) + Math.sin(heading)) / 2;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function shade(rgb, k) {
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((rgb >> s) & 255) * k)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** The colour of one tile on the minimap. */
export function minimapColour(world, t) {
  if (world.isClosedTile(t)) return CLOSED[1];
  if (t.block === 'building') return t.landmark ? LANDMARK : BUILDING[t.style] ?? BUILDING_OTHER;
  if (t.block) return BLOCKS[t.block] ?? BUILDING_OTHER;
  return GROUND[t.surface] ?? GROUND.grass;
}

/** Draw the minimap. Returns a PixelCanvas (transparent outside the map). */
export function drawMinimap(world, f = MINIMAP.pxPerTile) {
  const { width, height } = minimapSize(world, f);
  const c = new PixelCanvas(width, height);
  const T = WORLD.tileMetres;
  let maxZ = 1;
  for (const t of world.tiles) maxZ = Math.max(maxZ, world.heightAt((t.tx + 0.5) * T, (t.ty + 0.5) * T));
  const colours = new Map();
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const a = (px + 0.5) / f - world.height; // tx - ty
      const b = ((py + 0.5) * 2) / f; // tx + ty
      const tx = Math.floor((a + b) / 2), ty = Math.floor((b - a) / 2);
      const t = world.tile(tx, ty);
      if (!t) continue;
      if (world.isClosedTile(t)) {
        c.setPixel(px, py, CLOSED[((px + py) >> 1) % 3 === 0 ? 0 : 1]);
        continue;
      }
      let rgb = colours.get(t);
      if (rgb === undefined) {
        const z = world.heightAt((tx + 0.5) * T, (ty + 0.5) * T);
        rgb = shade(minimapColour(world, t), 0.8 + (MINIMAP.heightContrast * z) / maxZ);
        colours.set(t, rgb);
      }
      c.setPixel(px, py, rgb);
    }
  }
  stampPadlocks(world, c, f);
  return c;
}

// A small padlock (7 × 9 px): '#' dark outline, 'o' light metal, 'k' the key hole.
const PADLOCK = [
  '.#####.', '#ooooo#', '#o###o#', '#o#.#o#', '#######', '#ooooo#', '#oo#oo#', '#ooooo#', '#######',
];
const PADLOCK_COLOURS = { '#': 0x14181c, o: 0xa8acb0, k: 0x3a3a3a };

/** Padlocks spread over the closed districts, so you see that an area is locked from any side. */
function stampPadlocks(world, c, f) {
  const step = MINIMAP.padlockSpacing;
  const closedAt = (px, py) => {
    const a = (px + 0.5) / f - world.height, b = ((py + 0.5) * 2) / f;
    const t = world.tile(Math.floor((a + b) / 2), Math.floor((b - a) / 2));
    return t && world.isClosedTile(t);
  };
  for (let row = 0, y = step / 2; y < c.height - 9; y += step / 2, row++) {
    for (let x = (row % 2) * (step / 2) + step / 4; x < c.width - 7; x += step) {
      const x0 = Math.round(x), y0 = Math.round(y);
      if (![[0, 0], [6, 0], [0, 8], [6, 8], [3, 4]].every(([dx, dy]) => closedAt(x0 + dx, y0 + dy))) continue;
      PADLOCK.forEach((line, dy) => [...line].forEach((ch, dx) => ch !== '.' && c.setPixel(x0 + dx, y0 + dy, PADLOCK_COLOURS[ch])));
    }
  }
}

/** The label point (minimap pixels) and the name of each district. */
export function districtLabels(world, f) {
  return world.districts.map((d) => {
    const p = minimapPoint(world, f, ((d.x0 + d.x1) / 2) * WORLD.tileMetres, ((d.y0 + d.y1) / 2) * WORLD.tileMetres);
    return { id: d.id, name: d.name, x: p.x, y: p.y, open: !world.closed?.has(d.id) };
  });
}
