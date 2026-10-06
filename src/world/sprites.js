import { WORLD, COLOURS } from '../config.js';
import { toScreen } from './iso.js';
import { PixelCanvas, shadeColour, hash2 } from './pixel-canvas.js';

// Pixel art sprites made in code, so the prototype needs no art files.
// Each function returns a PixelCanvas. The scene turns them into textures.

export const BIKE_DIRECTIONS = 16;
const BIKE_SCALE = 1.25; // draw the bike and rider a little larger than real size, so they read well
export const BIKE_CANVAS = { width: 44, height: 44, groundX: 22, groundY: 34 };

const BIKE_LOOKS = {
  petrol: { body: 0x8c2b23, seat: 0x222222, vest: 0x3f8f4a, helmet: 0xc0392b, trousers: 0x2a3550 },
  electric: { body: COLOURS.ampersandYellow, seat: 0x111111, vest: 0x1a1a1a, helmet: 0x111111, trousers: 0x2a3550 },
};
const SKIN = 0x6b4226;

/** Index of the sprite frame for a heading in radians. */
export function bikeFrameForHeading(heading) {
  const step = (Math.PI * 2) / BIKE_DIRECTIONS;
  return ((Math.round(heading / step) % BIKE_DIRECTIONS) + BIKE_DIRECTIONS) % BIKE_DIRECTIONS;
}

/** Draw one frame of a bike with rider. type is 'petrol' or 'electric'. */
export function drawBike(type, frame) {
  const look = BIKE_LOOKS[type];
  const heading = (frame / BIKE_DIRECTIONS) * Math.PI * 2;
  const c = new PixelCanvas(BIKE_CANVAS.width, BIKE_CANVAS.height, -BIKE_CANVAS.groundX, -BIKE_CANVAS.groundY);
  const cos = Math.cos(heading), sin = Math.sin(heading);
  // Bike-local point (forward f, side s, up z) in metres to screen pixels and depth.
  const P = (f, s, z) => {
    f *= BIKE_SCALE; s *= BIKE_SCALE; z *= BIKE_SCALE;
    const dx = f * cos - s * sin;
    const dy = f * sin + s * cos;
    const p = toScreen(dx, dy, z);
    return { x: p.x, y: p.y, depth: dx + dy };
  };

  const parts = [];
  const wheel = (fc) => {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push(P(fc + 0.3 * Math.cos(a), 0, 0.3 + 0.3 * Math.sin(a)));
    }
    const hub = P(fc, 0, 0.3);
    parts.push({ depth: hub.depth - 0.01, draw: () => { c.fillPoly(pts, 0x1e1e1e); c.fillDisc(hub.x, hub.y, 0.8, 0x8a8a8a); } });
  };
  const seg = (a, b, thick, col, bias = 0) => {
    const pa = P(...a), pb = P(...b);
    parts.push({ depth: (pa.depth + pb.depth) / 2 + bias, draw: () => c.line(pa.x, pa.y, pb.x, pb.y, thick, col) });
  };
  const blob = (p, r, col, bias = 0) => {
    const pp = P(...p);
    parts.push({ depth: pp.depth + bias, draw: () => c.fillDisc(pp.x, pp.y, r, col) });
  };

  wheel(-0.62);
  wheel(0.62);
  seg([-0.72, 0, 0.55], [0.35, 0, 0.66], 3.2, look.body); // body and rear fender
  seg([0.62, 0, 0.3], [0.42, 0, 0.95], 1.5, 0x9a9a9a); // fork
  seg([-0.45, 0, 0.8], [0.05, 0, 0.84], 3, look.seat); // seat
  seg([0.42, -0.32, 0.98], [0.42, 0.32, 0.98], 1.5, 0x333333); // handlebar
  blob([0.52, 0, 0.84], 1.1, 0xfff2b0, 0.05); // headlight
  for (const side of [-1, 1]) {
    seg([-0.15, 0.12 * side, 0.88], [0.25, 0.2 * side, 0.72], 2.6, look.trousers); // thigh
    seg([0.25, 0.2 * side, 0.72], [0.15, 0.22 * side, 0.42], 2.2, look.trousers); // shin
    seg([0.05, 0.18 * side, 1.4], [0.42, 0.3 * side, 1.0], 2, SKIN); // arm
  }
  seg([-0.15, 0, 0.9], [0.05, 0, 1.42], 4.6, look.vest, 0.02); // torso
  blob([0.08, 0, 1.68], 2.6, look.helmet, 0.03); // helmet
  blob([0.16, 0, 1.66], 1.1, 0x9fd3f0, 0.04); // visor

  parts.sort((a, b) => a.depth - b.depth);
  for (const p of parts) p.draw();
  c.outline(0x161616);
  return c;
}

/** A soft ground shadow (alpha only). */
export function drawShadow() {
  const c = new PixelCanvas(24, 12);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 24; x++) {
      const d = ((x + 0.5 - 12) / 12) ** 2 + ((y + 0.5 - 6) / 6) ** 2;
      if (d < 1) c.setPixel(x, y, 0x000000, d < 0.55 ? 90 : 55);
    }
  }
  return c;
}

/** Yellow ground glow under the electric moto. */
export function drawGlow() {
  const c = new PixelCanvas(36, 18);
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 36; x++) {
      const d = ((x + 0.5 - 18) / 18) ** 2 + ((y + 0.5 - 9) / 9) ** 2;
      if (d < 1) c.setPixel(x, y, COLOURS.ampersandYellow, Math.round(110 * (1 - d)));
    }
  }
  return c;
}

/** Small exhaust puff. */
export function drawPuff() {
  const c = new PixelCanvas(6, 6);
  c.fillDisc(3, 3, 2.6, 0x8d8d8d);
  c.fillDisc(2.4, 2.4, 1.3, 0xb4b4b4);
  return c;
}

const BUILDING_WALLS = [0xe8dcc0, 0xd98c6a, 0x9fc4d6, 0xe0a7b5, 0xc9d6a0, 0xf0efe6];
const BUILDING_ROOFS = [0x8a3b2a, 0x9a9a96, 0x6f7f86];
const WINDOW = 0x2f4a5c;
const WINDOW_LIT = 0x7fa6bf;

/**
 * Draw a solid block (building, tree or monument) for one tile.
 * Returns { canvas, depth } where the canvas offset is in world screen pixels.
 */
export function drawBlock(block, world) {
  const T = WORLD.tileMetres, L = WORLD.levelMetres;
  const { tx, ty } = block;
  const pt = (x, y, levels) => {
    const s = toScreen(x * T, y * T, levels * L);
    return { x: s.x, y: s.y };
  };
  // Canvas bounds: the tile footprint from base to top, with room for tree crowns.
  const pad = block.kind === 'tree' ? 16 : block.kind === 'monument' ? 8 : 2;
  const corners = [];
  for (const [x, y] of [[tx, ty], [tx + 1, ty], [tx + 1, ty + 1], [tx, ty + 1]]) {
    corners.push(pt(x, y, block.baseLevel), pt(x, y, block.topLevel));
  }
  const minX = Math.floor(Math.min(...corners.map((p) => p.x))) - pad;
  const maxX = Math.ceil(Math.max(...corners.map((p) => p.x))) + pad;
  const minY = Math.floor(Math.min(...corners.map((p) => p.y))) - pad;
  const maxY = Math.ceil(Math.max(...corners.map((p) => p.y))) + 2;
  const c = new PixelCanvas(maxX - minX, maxY - minY, minX, minY);

  if (block.kind === 'building') drawBuilding(c, block, pt, world);
  else if (block.kind === 'tree') drawTree(c, block, pt, world);
  else drawMonument(c, block, pt, world);
  return { canvas: c, depth: tx + ty + 1 };
}

function drawBox(c, x0, y0, x1, y1, base, top, pt, shadeTop, shadeEast, shadeSouth, faces = { east: true, south: true }) {
  // Only the top, east (+x) and south (+y) faces face the camera.
  if (faces.east) c.fillQuad(
    { ...pt(x1, y0, top), u: y0, v: top }, { ...pt(x1, y1, top), u: y1, v: top },
    { ...pt(x1, y1, base), u: y1, v: base }, { ...pt(x1, y0, base), u: y0, v: base },
    shadeEast,
  );
  if (faces.south) c.fillQuad(
    { ...pt(x0, y1, top), u: x0, v: top }, { ...pt(x1, y1, top), u: x1, v: top },
    { ...pt(x1, y1, base), u: x1, v: base }, { ...pt(x0, y1, base), u: x0, v: base },
    shadeSouth,
  );
  c.fillQuad(
    { ...pt(x0, y0, top), u: 0, v: 0 }, { ...pt(x1, y0, top), u: 1, v: 0 },
    { ...pt(x1, y1, top), u: 1, v: 1 }, { ...pt(x0, y1, top), u: 0, v: 1 },
    shadeTop,
  );
}

/** Faces that touch a block of the same kind that is as tall are inside the building: do not draw them. */
function visibleFaces(block, world) {
  const hidden = (n) => n && n.kind === block.kind && n.topLevel >= block.topLevel - 0.01;
  return { east: !hidden(world.blockAt(block.tx + 1, block.ty)), south: !hidden(world.blockAt(block.tx, block.ty + 1)) };
}

function drawBuilding(c, block, pt, world) {
  const { tx, ty, baseLevel, topLevel, groupId } = block;
  const wall = BUILDING_WALLS[groupId % BUILDING_WALLS.length];
  const roof = BUILDING_ROOFS[groupId % BUILDING_ROOFS.length];
  const corrugated = roof === BUILDING_ROOFS[0];
  const wallShade = (k) => (along, z, px, py) => {
    const zl = z - baseLevel;
    let col = wall;
    if (zl < 0.18) col = shadeColour(wall, 0.7); // dirty plinth
    else if (topLevel - z < 0.2) col = shadeColour(wall, 1.1); // parapet
    else {
      const floorPos = zl % 2; // one floor is 2 levels (3 m)
      const a = (along * 3) % 1;
      if (floorPos > 0.7 && floorPos < 1.6 && a > 0.22 && a < 0.78) {
        col = hash2(Math.floor(along * 3), Math.floor(zl / 2), groupId) > 0.75 ? WINDOW_LIT : WINDOW;
      }
    }
    if (hash2(px + c.ox, py + c.oy, 2) > 0.95) col = shadeColour(col, 0.94);
    return shadeColour(col, k);
  };
  const roofShade = (u, v, px, py) => {
    let col = roof;
    if (corrugated) col = Math.floor((tx + u) * 10) & 1 ? roof : shadeColour(roof, 0.88);
    else if (hash2(px + c.ox, py + c.oy, 4) > 0.9) col = shadeColour(roof, 0.92);
    return col;
  };
  drawBox(c, tx, ty, tx + 1, ty + 1, baseLevel, topLevel, pt, roofShade, wallShade(0.68), wallShade(0.86), visibleFaces(block, world));
}

function drawTree(c, block, pt, world) {
  const { tx, ty, baseLevel } = block;
  const cx = tx + 0.5, cy = ty + 0.5;
  const ground = world.heightAt(cx * WORLD.tileMetres, cy * WORLD.tileMetres) / WORLD.levelMetres;
  // Trunk
  const r = 0.05;
  drawBox(c, cx - r, cy - r, cx + r, cy + r, Math.min(baseLevel, ground), ground + 2.3, pt,
    () => 0x5a3a22, () => 0x4a2f1c, () => 0x5a3a22);
  // Crown: a cluster of overlapping discs, lit from the upper left.
  const centre = pt(cx, cy, ground + 2.7);
  const lumps = [[0, -5, 9], [-7, 0, 8], [7, 0, 8], [-3, 5, 8], [4, 5, 7]];
  const greens = [0x2f6f2a, 0x3d8a34, 0x52a344, 0x6bbf55];
  for (let y = -16; y <= 14; y++) {
    for (let x = -16; x <= 16; x++) {
      const inside = lumps.some(([lx, ly, lr]) => (x + 0.5 - lx) ** 2 + (y + 0.5 - ly) ** 2 <= lr * lr);
      if (!inside) continue;
      const k = 0.55 - (x / 16) * 0.35 - (y / 14) * 0.45 + (hash2(x + tx * 31, y + ty * 17, 9) - 0.5) * 0.4;
      c.plot(centre.x + x, centre.y + y, greens[Math.max(0, Math.min(3, Math.floor(k * 4)))]);
    }
  }
  c.outline(0x1f3a1a);
}

function drawMonument(c, block, pt, world) {
  const { tx, ty, baseLevel } = block;
  const stone = (k) => (u, v, px, py) => shadeColour(hash2(px + c.ox, py + c.oy, 6) > 0.9 ? 0xa39e93 : 0xb5b0a5, k);
  const top = Math.ceil(baseLevel) + 1;
  drawBox(c, tx, ty, tx + 1, ty + 1, baseLevel, top, pt, stone(1), stone(0.7), stone(0.86), {
    east: world.blockAt(tx + 1, ty)?.kind !== 'monument',
    south: world.blockAt(tx, ty + 1)?.kind !== 'monument',
  });
  // The south-east tile of the 2 × 2 monument carries the column at the shared corner.
  const isSouthEast = world.tile(tx - 1, ty - 1)?.block === 'monument';
  if (isSouthEast) {
    const r = 0.16;
    drawBox(c, tx - r, ty - r, tx + r, ty + r, top, top + 6, pt, stone(1.1), stone(0.72), stone(0.9));
  }
}
