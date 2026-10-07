import { WORLD, COLOURS, LIGHTS } from '../config.js';
import { toScreen } from './iso.js';
import { PixelCanvas, shadeColour, hash2 } from './pixel-canvas.js';

// Pixel art sprites made in code, so the prototype needs no art files.
// Each function returns a PixelCanvas. The scene turns them into textures.

export const BIKE_DIRECTIONS = 16;
const BIKE_SCALE = 1.25; // draw the bike and rider a little larger than real size, so they read well
export const BIKE_CANVAS = { width: 44, height: 44, groundX: 22, groundY: 34 };

// All moto taxi riders wear a high visibility vest (as in Kigali). Its yellow is a safety yellow,
// not Ampersand Surge Yellow (that colour is only for batteries, swap stations and the electric moto).
export const VEST = { colour: 0xd4e83a, stripe: 0xe8e8e8 };
export const BIKE_LOOKS = {
  petrol: { body: 0x8c2b23, seat: 0x222222, vest: VEST.colour, helmet: 0xc0392b, trousers: 0x2a3550 },
  electric: { body: COLOURS.ampersandYellow, seat: 0x111111, vest: VEST.colour, helmet: 0x111111, trousers: 0x2a3550 },
  rival: { body: 0x2b2f36, seat: 0x111111, vest: VEST.colour, helmet: 0xe8e8e8, trousers: 0x3a3a3a }, // other moto taxi riders
  // Motos that wait for repair at the garage (no rider).
  parkedRed: { body: 0x9a2a20, seat: 0x1a1a1a },
  parkedBlue: { body: 0x2a4f8a, seat: 0x1a1a1a },
  parkedBlack: { body: 0x2a2c30, seat: 0x3a2a1a },
};
const SKIN = 0x6b4226;

/** Index of the sprite frame for a heading in radians. */
export function bikeFrameForHeading(heading) {
  const step = (Math.PI * 2) / BIKE_DIRECTIONS;
  return ((Math.round(heading / step) % BIKE_DIRECTIONS) + BIKE_DIRECTIONS) % BIKE_DIRECTIONS;
}

/** Load shown on the bike: none, a passenger behind the rider, or cargo on the rear rack (bananas or a rice sack). */
export const BIKE_LOADS = ['none', 'passenger', 'bananas', 'rice'];
const PASSENGER = { shirt: 0x3b6fb6, trousers: 0x4a3a2a, helmet: 0xe8e8e8 };

/**
 * Draw one frame of a bike with rider. type is a key of BIKE_LOOKS. load is one of BIKE_LOADS.
 * rider: false draws a parked bike with nobody on it (for example at the garage).
 */
export function drawBike(type, frame, load = 'none', rider = true) {
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
  if (!rider) {
    parts.sort((a, b) => a.depth - b.depth);
    for (const p of parts) p.draw();
    c.outline(0x161616);
    return c;
  }
  for (const side of [-1, 1]) {
    seg([-0.15, 0.12 * side, 0.88], [0.25, 0.2 * side, 0.72], 2.6, look.trousers); // thigh
    seg([0.25, 0.2 * side, 0.72], [0.15, 0.22 * side, 0.42], 2.2, look.trousers); // shin
    seg([0.05, 0.18 * side, 1.4], [0.42, 0.3 * side, 1.0], 2, SKIN); // arm
  }
  seg([-0.15, 0, 0.9], [0.05, 0, 1.42], 4.6, look.vest, 0.02); // torso in the vest
  seg([-0.09, 0, 1.08], [-0.06, 0, 1.14], 4.8, VEST.stripe, 0.021); // reflective band
  blob([0.08, 0, 1.68], 2.6, look.helmet, 0.03); // helmet
  blob([0.16, 0, 1.66], 1.1, 0x9fd3f0, 0.04); // visor

  if (load === 'passenger') {
    // Passenger on the back seat, with a helmet (the law in Kigali), holding the rider.
    for (const side of [-1, 1]) {
      seg([-0.48, 0.12 * side, 0.9], [-0.22, 0.2 * side, 0.74], 2.6, PASSENGER.trousers); // thigh
      seg([-0.22, 0.2 * side, 0.74], [-0.32, 0.24 * side, 0.44], 2.2, PASSENGER.trousers); // shin to the foot peg
      seg([-0.36, 0.18 * side, 1.36], [-0.08, 0.16 * side, 1.12], 2, SKIN); // arm round the rider
    }
    seg([-0.5, 0, 0.92], [-0.38, 0, 1.4], 4.4, PASSENGER.shirt, -0.02); // torso
    blob([-0.36, 0, 1.64], 2.5, PASSENGER.helmet, -0.01); // helmet
  } else if (load === 'bananas') {
    // A big bunch of green bananas (matoke) tied on the rear rack.
    seg([-0.62, 0, 0.86], [-0.62, 0, 1.5], 1.4, 0x6b4a2a, -0.03); // stem
    const greens = [0x5f9a32, 0x4f8a2a, 0x76b23e];
    let i = 0;
    for (let z = 0.9; z <= 1.42; z += 0.13) {
      for (const sd of [-0.16, 0, 0.16]) blob([-0.62 + (i % 2) * 0.05, sd, z], 2.3 - (z - 0.9) * 1.2, greens[i++ % 3], -0.02 + sd * 0.01);
    }
  } else if (load === 'rice') {
    // A big white sack of rice with a printed stripe, strapped on the rear rack.
    seg([-0.84, 0, 0.98], [-0.4, 0, 0.98], 8, 0xe6e0cc, -0.02);
    seg([-0.8, 0, 1.0], [-0.44, 0, 1.0], 2, 0x2f6fb0, -0.015); // printed band
    seg([-0.62, -0.25, 0.86], [-0.62, -0.25, 1.22], 1, 0x3a2a1a, 0.05); // strap
  }

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

/** Small exhaust puff. dark = diesel smoke from trucks and minibuses. */
export function drawPuff(dark = false) {
  const c = new PixelCanvas(6, 6);
  c.fillDisc(3, 3, 2.6, dark ? 0x3a3a3a : 0x8d8d8d);
  c.fillDisc(2.4, 2.4, 1.3, dark ? 0x5a5a5a : 0xb4b4b4);
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
  const pad = block.kind === 'tree' ? 16 : block.kind === 'monument' ? 8 : block.kind === 'fuel' ? 22 : block.kind === 'garage' ? 6
    : block.kind === 'building' ? (block.style === 'government' ? 52 : 14) : 2; // room for roof tanks and flags
  const corners = [];
  for (const [x, y] of [[tx, ty], [tx + 1, ty], [tx + 1, ty + 1], [tx, ty + 1]]) {
    corners.push(pt(x, y, block.baseLevel), pt(x, y, block.topLevel));
  }
  const minX = Math.floor(Math.min(...corners.map((p) => p.x))) - pad;
  const maxX = Math.ceil(Math.max(...corners.map((p) => p.x))) + pad;
  const minY = Math.floor(Math.min(...corners.map((p) => p.y))) - pad;
  const maxY = Math.ceil(Math.max(...corners.map((p) => p.y))) + 2;
  const c = new PixelCanvas(maxX - minX, maxY - minY, minX, minY);

  // glow: the parts that shine at night (lit windows, station signs). It has the same size as the canvas.
  const glow = new PixelCanvas(c.width, c.height, c.ox, c.oy);
  if (block.kind === 'building') drawBuilding(c, block, pt, world, glow);
  else if (block.kind === 'fuel') drawFuelStation(c, block, pt, world, glow);
  else if (block.kind === 'swap') drawStation(c, block, pt, world, glow);
  else if (block.kind === 'garage') drawGarage(c, block, pt, world);
  else if (block.kind === 'tree') drawTree(c, block, pt, world);
  else if (block.kind === 'dome') drawDome(c, block, pt, world, glow);
  else drawMonument(c, block, pt, world);
  const lit = glow.data.some((v, i) => (i & 3) === 3 && v > 0);
  return { canvas: c, depth: tx + ty + 1, glow: lit ? glow : null };
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

// Building styles (block.style). Each style has its own walls, windows, ground floor and roof.
// The colours of one building come from its group id, so neighbours look different.
const STYLE_LOOKS = {
  house: { walls: [0xe8dcc0, 0xd98c6a, 0x9fc4d6, 0xe0a7b5, 0xc9d6a0, 0xf0efe6], roofs: [0x8a3b2a, 0x9a9a96, 0xa0522d], corrugated: true, tanks: 0.5 },
  shop: { walls: [0xe8dcc0, 0xf0efe6, 0xd8c8a8, 0xc9d6a0], roofs: [0x8a3b2a, 0x9a9a96], corrugated: true, tanks: 0.4 },
  office: { walls: [0xd8d4c8, 0xbfc6cc, 0xe8e2d6, 0xc9b8a0], roofs: [0x8a8a86, 0x7a7e82], tanks: 0.5, ac: true },
  tower: { walls: [0x5f8fa8, 0x4a7f8a, 0x6a8fb8, 0x3f6a7a], roofs: [0x5a5e62, 0x4a4e52], ac: true },
  government: { walls: [0xefe6cc, 0xf2efe6], roofs: [0x9a3b2a], flag: true },
  school: { walls: [0xf0efe6], roofs: [0x3f7f4a, 0x8a3b2a], corrugated: true },
  warehouse: { walls: [0xa0a4a8, 0x8f9aa0, 0xb0a890], roofs: [0x9a9a96, 0x8a8a86], corrugated: true },
  villa: { walls: [0xf0efe6, 0xe8dcc0, 0xe0d0b0, 0xd8e0e8], roofs: [0xb5543a, 0xa0482e], tanks: 0.3 },
};
// Bright paint for shop fronts (not Surge Yellow: that colour is only for Ampersand).
const SHOP_PAINT = [0xc0392b, 0x3f8f4a, 0x2f6fb0, 0xe07a2a, 0x8a4ab0];

function drawBuilding(c, block, pt, world, glow) {
  const { tx, ty, baseLevel, topLevel, groupId } = block;
  const style = block.style ?? 'house';
  const look = STYLE_LOOKS[style] ?? STYLE_LOOKS.house;
  const wall = look.walls[groupId % look.walls.length];
  const roof = look.roofs[groupId % look.roofs.length];
  const paint = SHOP_PAINT[groupId % SHOP_PAINT.length];
  const floor = block.floorLevel ?? baseLevel;
  const lit = (along, zl, k, px, py, perFloor) => {
    if (glow && hash2(Math.floor(along * perFloor), Math.floor(zl / 2), groupId + 101) < LIGHTS.windowLitChance) {
      glow.setPixel(px, py, shadeColour(LIGHTS.windowColour, 0.7 + 0.3 * k));
    }
  };
  const wallShade = (k) => (along, z, px, py) => {
    const zl = z - floor;
    let col = wall;
    if (zl < 0) {
      // Stone foundation on a slope (Kigali houses stand on stone walls on the hillsides).
      const course = Math.floor(z * 4);
      const brick = Math.floor(along * 6 + (course & 1) * 0.5);
      col = (z * 4) % 1 < 0.18 || (along * 6 + (course & 1) * 0.5) % 1 < 0.1 ? 0x5e574d : hash2(brick, course, 9) > 0.5 ? 0x948a7a : 0x857b6c;
      return shadeColour(col, k);
    }
    const top = topLevel - z;
    const floorPos = zl % 2; // one floor is 2 levels (3 m)
    if (style === 'tower') {
      // Glass: a line at each floor, thin mullions, a darker crown at the top.
      col = shadeColour(wall, 0.85 + 0.25 * Math.min(1, zl / Math.max(1, topLevel - floor)));
      if (top < 0.6) col = 0x2f3a44;
      else if (zl % 1 < 0.1 || (along * 4) % 1 < 0.07) col = 0xc8d8e0;
      else if (zl > 0.4) lit(along, zl * 2, k, px, py, 4);
      return shadeColour(col, k);
    }
    if (zl < 0.18) return shadeColour(wall, 0.7 * k); // dirty plinth
    if (top < 0.2) return shadeColour(wall, 1.1 * k); // parapet
    const a3 = (along * 3) % 1;
    if (style === 'shop' && zl < 1.9) {
      // The ground floor: open shop fronts with goods, and a painted band with the shop name above.
      if (zl > 1.45) col = hash2(Math.floor(along * 12), Math.floor(zl * 8), groupId) > 0.82 ? 0xffffff : paint;
      else if ((along * 2) % 1 > 0.12 && (along * 2) % 1 < 0.88) {
        col = zl < 1.1 && hash2(Math.floor(along * 16), Math.floor(zl * 10), groupId + 7) > 0.6 ? SHOP_PAINT[Math.floor(hash2(Math.floor(along * 16), 3, groupId) * 5)] : 0x2a2622;
        if (glow && zl > 0.2) glow.setPixel(px, py, shadeColour(0xffd8a0, 0.6 + 0.2 * k), 170);
      }
      return shadeColour(col, k);
    }
    if (style === 'school') {
      col = zl < 0.8 ? 0x3a6fb0 : wall; // blue below, white above
      if (floorPos > 0.9 && floorPos < 1.6 && (along * 2) % 1 > 0.1 && (along * 2) % 1 < 0.9) {
        col = WINDOW;
        lit(along, zl, k, px, py, 2);
      }
      return shadeColour(col, k);
    }
    if (style === 'government') {
      // Tall windows between light columns.
      const a = (along * 3) % 1;
      if (a < 0.12) col = 0xffffff;
      else if (zl > 0.5 && top > 0.5 && a > 0.3 && a < 0.82) {
        col = 0x2f4a6c;
        lit(along, zl, k, px, py, 3);
      }
      return shadeColour(col, k);
    }
    if (style === 'warehouse') {
      col = (along * 10) % 1 < 0.3 ? shadeColour(wall, 0.9) : wall; // corrugated sheets
      if (zl < 1.6 && (along % 1) > 0.25 && (along % 1) < 0.75) col = 0x4a4f55; // a big door
      return shadeColour(col, k);
    }
    const perFloor = style === 'office' ? 4 : style === 'villa' ? 2 : 3;
    const a = (along * perFloor) % 1;
    if (floorPos > 0.7 && floorPos < 1.6 && a > 0.22 && a < 0.78) {
      col = hash2(Math.floor(along * perFloor), Math.floor(zl / 2), groupId) > 0.75 ? WINDOW_LIT : WINDOW;
      lit(along, zl, k, px, py, perFloor);
    } else if (style === 'office' && floorPos > 0.45 && floorPos < 0.7 && a > 0.3 && a < 0.55 && hash2(Math.floor(along * perFloor), Math.floor(zl / 2), groupId + 5) > 0.7) {
      col = 0xa8acb0; // an air conditioner under the window
    } else if (style === 'house' && floorPos < 0.7 && (along % 1) > 0.42 && (along % 1) < 0.58 && zl < 1.4) {
      col = 0x5a3a24; // a door
    }
    if (hash2(px + c.ox, py + c.oy, 2) > 0.95) col = shadeColour(col, 0.94);
    return shadeColour(col, k);
  };
  const roofShade = (u, v, px, py) => {
    let col = roof;
    if (look.corrugated) col = Math.floor((tx + u) * 10) & 1 ? roof : shadeColour(roof, 0.88);
    else if (style === 'villa') col = Math.floor((ty + v) * 6) & 1 ? roof : shadeColour(roof, 0.9); // clay tiles
    else if (hash2(px + c.ox, py + c.oy, 4) > 0.9) col = shadeColour(roof, 0.92);
    return col;
  };
  drawBox(c, tx, ty, tx + 1, ty + 1, baseLevel, topLevel, pt, roofShade, wallShade(0.68), wallShade(0.86), visibleFaces(block, world));
  // Roof details: black water tanks, air conditioners, and the flag of Rwanda on government buildings.
  const h = hash2(tx, ty, groupId + 11);
  const flat = (col) => () => col;
  const side = (col, k) => () => shadeColour(col, k);
  if (look.tanks && h < look.tanks && isFlagTile(block, world)) {
    // One small black water tank on the building (most houses in Kigali have one).
    drawBox(c, tx + 0.42, ty + 0.42, tx + 0.6, ty + 0.6, topLevel, topLevel + 0.5, pt,
      (u, v) => (u + v < 1 ? 0x3a3a3a : 0x262626), side(0x1e1e1e, 0.8), side(0x2a2a2a, 1));
  } else if (look.ac && h < 0.3) {
    drawBox(c, tx + 0.3, ty + 0.4, tx + 0.55, ty + 0.6, topLevel, topLevel + 0.35, pt, flat(0xc8ccd0), side(0xa8acb0, 0.8), side(0xa8acb0, 0.95));
  }
  if (look.flag && isFlagTile(block, world)) {
    drawBox(c, tx + 0.48, ty + 0.48, tx + 0.53, ty + 0.53, topLevel, topLevel + 3, pt, flat(0xd8d8d8), side(0xc0c0c0, 0.8), side(0xc0c0c0, 1));
    // The flag of Rwanda: blue (with the sun), yellow, green. The yellow is the flag's own, not Surge Yellow.
    const p = pt(tx + 0.5, ty + 0.5, topLevel + 3);
    const colours = [0x20a0e0, 0x20a0e0, 0xe5be01, 0x20603d];
    for (let r = 0; r < 4; r++) for (let x = 1; x <= 7; x++) c.plot(p.x + x, p.y + r, colours[r]);
    c.plot(p.x + 6, p.y, 0xe5be01);
  }
}

/** The flag stands on one tile of a government building: the one with the smallest x + y. */
function isFlagTile(block, world) {
  const same = (x, y) => world.blockAt(x, y)?.groupId === block.groupId;
  return !same(block.tx - 1, block.ty) && !same(block.tx, block.ty - 1);
}

// Tree kinds of Kigali. lumps: discs of the crown [x, y, radius] in pixels from the crown centre.
// crown: the height of the crown centre above the ground, in levels. Colours: dark to light.
const TREES = {
  // Umbrella thorn acacia: a tall forked trunk and a wide flat crown.
  acacia: {
    trunk: 3.3, crown: 3.7, fork: true,
    lumps: [[-18, 1, 5], [-10, -1, 6], [-2, -2, 6], [7, -1, 6], [15, 0, 5], [21, 2, 4], [-23, 3, 3], [3, 2, 5], [-8, 3, 4]],
    colours: [0x485f22, 0x5a7a2a, 0x6f8f34, 0x87a844], outline: 0x2a3a14,
  },
  // Jacaranda: a big round crown of purple flowers, with some green leaves.
  jacaranda: {
    trunk: 2.4, crown: 3.0,
    lumps: [[0, -9, 10], [-10, -2, 9], [10, -2, 9], [-5, 7, 9], [6, 7, 8], [0, 0, 10], [-15, 5, 5], [15, 5, 5]],
    colours: [0x5e4290, 0x7a5ab0, 0x9a7ad0, 0xb89ae0], leaf: 0x4f7f3a, outline: 0x2e2048,
  },
  // Avocado: a dense, tall, dark green crown, with fruit.
  avocado: {
    trunk: 1.8, crown: 2.9,
    lumps: [[0, -12, 8], [-7, -4, 9], [7, -4, 9], [0, 3, 10], [-6, 10, 7], [6, 10, 7], [0, -18, 5]],
    colours: [0x1f4a24, 0x2c5f2c, 0x3f7a3a, 0x58904a], fruit: 0x6a8a2a, outline: 0x13301a,
  },
  // A big shade tree (fig or eucalyptus mix): the common street tree.
  fig: {
    trunk: 2.3, crown: 2.9,
    lumps: [[0, -7, 11], [-10, 0, 10], [10, 0, 10], [-4, 7, 10], [5, 7, 9], [-15, 6, 5], [16, 6, 5]],
    colours: [0x2f6f2a, 0x3d8a34, 0x52a344, 0x6bbf55], outline: 0x1f3a1a,
  },
};
const TREE_MIX = {
  // [acacia, jacaranda, avocado]; the rest are figs.
  nyabugogo: [0.3, 0.1, 0.25], town: [0.05, 0.45, 0.1], kacyiru: [0.1, 0.35, 0.15],
  kimihurura: [0.1, 0.45, 0.15], nyarutarama: [0.35, 0.3, 0.1], kicukiro: [0.25, 0.15, 0.3],
};

/** The kind of tree on a tile (it depends on the district and the tile). */
export function treeKind(world, tx, ty) {
  const t = world.tile(tx, ty);
  const mix = TREE_MIX[t?.district] ?? [0.25, 0.25, 0.25];
  const h = hash2(tx, ty, 41);
  if (h < mix[0]) return 'acacia';
  if (h < mix[0] + mix[1]) return 'jacaranda';
  if (h < mix[0] + mix[1] + mix[2]) return 'avocado';
  return 'fig';
}

function drawTree(c, block, pt, world) {
  const { tx, ty, baseLevel } = block;
  const kind = TREES[treeKind(world, tx, ty)];
  // A small random offset, so a row of trees does not look like a grid.
  const cx = tx + 0.35 + 0.3 * hash2(tx, ty, 42), cy = ty + 0.35 + 0.3 * hash2(ty, tx, 43);
  const ground = world.heightAt(cx * WORLD.tileMetres, cy * WORLD.tileMetres) / WORLD.levelMetres;
  // Trunk
  const r = 0.06;
  drawBox(c, cx - r, cy - r, cx + r, cy + r, Math.min(baseLevel, ground), ground + kind.trunk, pt,
    () => 0x5a3a22, () => 0x4a2f1c, () => 0x5a3a22);
  const centre = pt(cx, cy, ground + kind.crown);
  if (kind.fork) {
    // The acacia trunk forks into branches that hold the flat crown.
    const f = pt(cx, cy, ground + kind.trunk - 1.1);
    for (const dx of [-12, -4, 6, 13]) c.line(f.x, f.y, centre.x + dx, centre.y + 1, 1.4, 0x4a2f1c);
  }
  const minX = Math.min(...kind.lumps.map(([x, , r2]) => x - r2)), maxX = Math.max(...kind.lumps.map(([x, , r2]) => x + r2));
  const minY = Math.min(...kind.lumps.map(([, y, r2]) => y - r2)), maxY = Math.max(...kind.lumps.map(([, y, r2]) => y + r2));
  const halfW = (maxX - minX) / 2, halfH = (maxY - minY) / 2, midY = (minY + maxY) / 2;
  for (let y = Math.floor(minY); y <= maxY; y++) {
    for (let x = Math.floor(minX); x <= maxX; x++) {
      if (!kind.lumps.some(([lx, ly, lr]) => (x + 0.5 - lx) ** 2 + (y + 0.5 - ly) ** 2 <= lr * lr)) continue;
      // Lit from the upper left, with leafy noise.
      const n = hash2(x + tx * 31, y + ty * 17, 9);
      const k = 0.55 - (x / halfW) * 0.3 - ((y - midY) / halfH) * 0.45 + (n - 0.5) * 0.45;
      let rgb = kind.colours[Math.max(0, Math.min(3, Math.floor(k * 4)))];
      if (kind.leaf && hash2(x + tx * 7, y + ty * 5, 44) < 0.12) rgb = kind.leaf;
      if (kind.fruit && k < 0.45 && hash2(x + tx * 3, y + ty * 11, 45) < 0.03) rgb = kind.fruit;
      c.plot(centre.x + x, centre.y + y, rgb);
    }
  }
  c.outline(kind.outline);
}

// The Convention Centre dome: white steps with ribs. At night it shines in many colours.
const DOME_NIGHT = [0xff4fa0, 0x4fb0ff, 0x7cff6a, 0xffa040, 0xb070ff];
function drawDome(c, block, pt, world, glow) {
  const { tx, ty, baseLevel, topLevel } = block;
  const night = DOME_NIGHT[Math.round(topLevel) % DOME_NIGHT.length];
  const wallShade = (k) => (along, z, px, py) => {
    const rib = (along * 4) % 1 < 0.12;
    const col = rib ? 0xc9cdd2 : 0xeef0f2;
    if (glow && z - baseLevel > 0.5) glow.setPixel(px, py, shadeColour(night, 0.75 + 0.25 * k), rib ? 160 : 230);
    return shadeColour(col, k);
  };
  const roofShade = (u, v, px, py) => (hash2(px + c.ox, py + c.oy, 4) > 0.93 ? 0xd8dce0 : 0xf6f7f8);
  drawBox(c, tx, ty, tx + 1, ty + 1, baseLevel, topLevel, pt, roofShade, wallShade(0.72), wallShade(0.88), visibleFaces(block, world));
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

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------

/** Fuel station (white and red) or Ampersand swap station (Surge Yellow, black, battery bays). */
// A fuel station: a white canopy on thin pillars with a red fascia, pumps on a concrete island
// under it, a small shop with a glass front, and a tall price sign. Two tiles: the first tile
// (smaller x + y) has the shop, the second has the pumps and the sign.
const FUEL_RED = 0xc0392b;
function drawFuelStation(c, block, pt, world, glow) {
  const { tx, ty } = block;
  const base = block.floorLevel ?? block.baseLevel;
  const isFuel = (x, y) => world.blockAt(x, y)?.kind === 'fuel';
  const first = isFuel(tx + 1, ty) || isFuel(tx, ty + 1);
  const flat = (col) => () => col;
  const box = (x0, y0, x1, y1, z0, z1, top, east, south) =>
    drawBox(c, tx + x0, ty + y0, tx + x1, ty + y1, base + z0, base + z1, pt, top, east, south);
  const wall = (col, k) => () => shadeColour(col, k);
  // Concrete forecourt slab.
  box(0.02, 0.02, 0.98, 0.98, -0.02, 0.06, flat(0xb8b4aa), wall(0x9a968c, 0.8), wall(0x9a968c, 0.9));
  if (first) {
    // The shop: white walls, a glass front and a door, a red band at the top.
    const shop = (k) => (along, z, px, py) => {
      const zl = z - base;
      let col = 0xf0efe6;
      if (zl > 1.45) col = FUEL_RED;
      else if (zl > 0.35 && zl < 1.3 && (along * 5) % 1 > 0.15) {
        col = 0x6fa4c4; // glass
        if (glow) glow.setPixel(px, py, shadeColour(0xfff2c8, 0.8 + 0.2 * k));
      }
      return shadeColour(col, k);
    };
    box(0.18, 0.18, 0.82, 0.82, 0.06, 1.7, flat(0x9a9a96), shop(0.72), shop(0.88));
  } else {
    // A concrete island with two pumps.
    box(0.25, 0.3, 0.75, 0.7, 0.06, 0.16, flat(0xd8d4ca), wall(0xb0aca2, 0.75), wall(0xb0aca2, 0.88));
    for (const [px0, py0] of [[0.3, 0.42], [0.58, 0.42]]) {
      const pump = (k) => (along, z, px, py) => {
        const zl = z - base;
        let col = zl > 0.75 ? FUEL_RED : 0xe8e8e4;
        if (zl > 0.48 && zl < 0.66) {
          col = 0x203038; // the display
          if (glow) glow.setPixel(px, py, 0x7cff8a, 220);
        }
        return shadeColour(col, k);
      };
      box(px0, py0, px0 + 0.12, py0 + 0.16, 0.16, 0.9, flat(FUEL_RED), pump(0.72), pump(0.88));
    }
    // The price sign: a tall pole with a red panel and white bars.
    box(0.88, 0.86, 0.94, 0.92, 0.06, 3.4, flat(0x7a7a7a), wall(0x8a8a8a, 0.72), wall(0x8a8a8a, 0.88));
    const sign = (k) => (along, z, px, py) => {
      const zl = z - base;
      const bar = (zl > 3.65 && zl < 3.8) || (zl > 3.95 && zl < 4.1) || (zl > 4.25 && zl < 4.4);
      const col = bar ? 0xffffff : FUEL_RED;
      if (glow) glow.setPixel(px, py, shadeColour(col, k), 230);
      return shadeColour(col, k);
    };
    box(0.72, 0.86, 1.0, 0.92, 3.4, 4.6, flat(0x8a2a20), sign(0.72), sign(0.88));
  }
  // Pillars at the corners, then the canopy on top.
  for (const [x, y] of [[0.08, 0.08], [0.86, 0.08], [0.08, 0.86], [0.86, 0.86]]) {
    if (!first && x > 0.8 && y > 0.8) continue; // the sign pole stands there
    box(x, y, x + 0.06, y + 0.06, 0.06, 2.65, flat(0xd0d0cc), wall(0xd0d0cc, 0.72), wall(0xd0d0cc, 0.88));
  }
  const fascia = (k) => (along, z, px, py) => {
    const zl = z - base;
    const col = zl > 2.8 && zl < 2.88 ? 0xffffff : FUEL_RED;
    if (glow) glow.setPixel(px, py, shadeColour(col, 0.85 + 0.15 * k), 200);
    return shadeColour(col, k);
  };
  drawBox(c, tx - 0.04, ty - 0.04, tx + 1.04, ty + 1.04, base + 2.65, base + 3, pt,
    (u, v, px, py) => (hash2(px + c.ox, py + c.oy, 4) > 0.92 ? 0xe0e0dc : 0xf2f2ee), fascia(0.72), fascia(0.88),
    { east: !isFuel(tx + 1, ty), south: !isFuel(tx, ty + 1) });
}

function drawStation(c, block, pt, world, glow) {
  const { tx, ty, baseLevel, topLevel } = block;
  const swap = block.kind === 'swap';
  const wall = swap ? COLOURS.ampersandYellow : 0xf0efe6;
  const band = swap ? 0x111111 : 0xc0392b;
  const wallShade = (k) => (along, z, px, py) => {
    const zl = z - baseLevel;
    let col = wall;
    if (topLevel - z < 0.45) col = band; // sign band at the top
    else if (zl < 0.15) col = shadeColour(wall, 0.7);
    else if (swap) {
      // Battery bays: dark slots with a green charge light.
      const a = (along * 4) % 1;
      if (zl > 0.3 && zl < 1.2 && a > 0.2 && a < 0.8) col = zl > 1.0 && a > 0.45 && a < 0.55 ? 0x44bc9d : 0x1a1a1a;
    } else {
      // Fuel station: a dark door and a pump in front of each tile.
      const a = (along * 2) % 1;
      if (zl > 0.15 && zl < 1.1 && a > 0.35 && a < 0.65) col = 0x3a3f44;
    }
    // At night the station is lit: the walls and the sign band shine (not the dark parts).
    if (glow && col !== 0x1a1a1a && col !== 0x3a3f44 && col !== 0x111111) glow.setPixel(px, py, shadeColour(col, k), 230);
    return shadeColour(col, k);
  };
  const roof = swap ? 0x111111 : 0x7a7a7a;
  const roofShade = (u, v, px, py) => (hash2(px + c.ox, py + c.oy, 4) > 0.9 ? shadeColour(roof, 1.15) : roof);
  drawBox(c, tx, ty, tx + 1, ty + 1, baseLevel, topLevel, pt, roofShade, wallShade(0.72), wallShade(0.88), visibleFaces(block, world));
}

// ---------------------------------------------------------------------------
// Road furniture: speed cameras and speed limit signs. Origin = ground point (bottom centre).
// ---------------------------------------------------------------------------

export const PROP_CANVAS = { width: 18, height: 34, groundX: 9, groundY: 32 };

const DIGITS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '001', '001', '001'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};

/** Draw a number in a 3 × 5 pixel font, centred on (cx, top). */
export function drawDigits(c, text, cx, top, rgb) {
  const w = text.length * 4 - 1;
  let x0 = Math.round(cx - w / 2);
  for (const ch of text) {
    const rows = DIGITS[ch];
    if (rows) rows.forEach((row, y) => [...row].forEach((bit, x) => bit === '1' && c.setPixel(x0 + x, top + y, rgb)));
    x0 += 4;
  }
}

function pole(c, topY) {
  for (let y = topY; y <= PROP_CANVAS.groundY; y++) c.setPixel(PROP_CANVAS.groundX, y, 0x8a8a8a);
}

export function drawCamera() {
  const c = new PixelCanvas(PROP_CANVAS.width, PROP_CANVAS.height);
  pole(c, 10);
  // Camera box on top of the pole
  for (let y = 5; y < 11; y++) for (let x = 4; x < 14; x++) c.setPixel(x, y, y === 5 ? 0x5a5a5a : 0x3a3a3a);
  c.setPixel(5, 7, 0x9fd3f0); c.setPixel(6, 7, 0x9fd3f0); c.setPixel(5, 8, 0x9fd3f0); c.setPixel(6, 8, 0x9fd3f0); // lens
  c.setPixel(12, 7, 0xff4a3a); // red light
  c.outline(0x161616);
  return c;
}

export function drawSpeedSign(limitKmh) {
  const c = new PixelCanvas(PROP_CANVAS.width, PROP_CANVAS.height);
  pole(c, 12);
  const cx = PROP_CANVAS.groundX + 0.5, cy = 8.5;
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= 7.6) c.setPixel(x, y, d > 5.6 ? 0xd0302a : 0xffffff);
    }
  }
  drawDigits(c, String(limitKmh), PROP_CANVAS.groundX + 0.5, 6, 0x111111);
  c.outline(0x161616);
  return c;
}

// ---------------------------------------------------------------------------
// Job marker (ring on the ground and a pin above it) and the direction arrow
// ---------------------------------------------------------------------------

export function drawMarkerRing(rgb) {
  const c = new PixelCanvas(40, 20);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 40; x++) {
      const d = Math.hypot((x + 0.5 - 20) / 20, (y + 0.5 - 10) / 10);
      if (d <= 1 && d > 0.78) c.setPixel(x, y, rgb);
    }
  }
  return c;
}

export function drawMarkerPin(rgb) {
  const c = new PixelCanvas(11, 14);
  for (let y = 0; y < 14; y++) {
    const half = y < 7 ? 5 : Math.max(0, 5 - (y - 6));
    for (let x = 5 - half; x <= 5 + half; x++) c.setPixel(x, y, rgb);
  }
  c.fillDisc(5.5, 4.5, 1.6, 0xffffff);
  c.outline(0x161616);
  return c;
}

export function drawArrow() {
  const c = new PixelCanvas(13, 11);
  for (let x = 0; x < 11; x++) {
    const half = Math.floor((11 - x) / 2.2);
    for (let y = 5 - half; y <= 5 + half; y++) c.setPixel(x + 1, y, 0xf6f5ec);
  }
  c.outline(0x161616);
  return c;
}

/** A person who waits for a moto at a pickup, with one arm up. Origin = ground point (bottom centre). */
export function drawWaitingPassenger() {
  const c = new PixelCanvas(PROP_CANVAS.width, PROP_CANVAS.height);
  const gx = PROP_CANVAS.groundX, gy = PROP_CANVAS.groundY;
  c.line(gx - 1.5, gy - 1, gx - 1, gy - 9, 2.4, 0x2a3550); // legs
  c.line(gx + 1.5, gy - 1, gx + 1, gy - 9, 2.4, 0x2a3550);
  c.line(gx, gy - 10, gx, gy - 17, 5, 0xc0392b); // body (red shirt)
  c.line(gx + 2, gy - 16, gx + 5, gy - 24, 1.8, SKIN); // arm up: waving at you
  c.line(gx - 2, gy - 16, gx - 3, gy - 11, 1.8, SKIN);
  c.fillDisc(gx + 0.5, gy - 20.5, 2.6, SKIN); // head
  c.outline(0x161616);
  return c;
}

/** Sacks and a crate that wait at a cargo pickup. Origin = ground point (bottom centre). */
/** Cargo that waits for you at the pickup: bunches of bananas or sacks of rice. */
export function drawCargoPile(goods = 'rice') {
  const c = new PixelCanvas(PROP_CANVAS.width, PROP_CANVAS.height);
  const gx = PROP_CANVAS.groundX, gy = PROP_CANVAS.groundY;
  if (goods === 'bananas') {
    const greens = [0x5f9a32, 0x4f8a2a, 0x76b23e];
    for (const [bx, top] of [[gx - 3, gy - 12], [gx + 4, gy - 9]]) {
      c.line(bx, gy - 1, bx, top - 2, 1.2, 0x6b4a2a); // stem
      let i = 0;
      for (let y = gy - 2; y > top; y -= 2) for (const dx of [-2, 0, 2]) c.fillDisc(bx + dx, y, 1.6, greens[i++ % 3]);
    }
  } else {
    for (const [x0, y0] of [[gx - 6, gy - 6], [gx + 1, gy - 6], [gx - 3, gy - 12]]) {
      for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 7; x++) c.setPixel(x, y, y === y0 ? 0xf2eee0 : 0xe0dac6);
      for (let x = x0; x < x0 + 7; x++) c.setPixel(x, y0 + 3, 0x2f6fb0); // printed band
    }
  }
  c.outline(0x161616);
  return c;
}

/** Garage: grey walls, a blue sign band, roll up doors with a tyre stack look. */
// The moto garage: an open workshop under a rusty iron roof. You see inside through the open
// front: a dark wall with tools, shelves with oil cans, and an oily floor. Motos, mechanics,
// oil stains and the name sign stand around it (see GarageView.js).
function drawGarage(c, block, pt, world) {
  const { tx, ty } = block;
  const base = block.floorLevel ?? block.baseLevel;
  const isGarage = (x, y) => world.blockAt(x, y)?.kind === 'garage';
  const box = (x0, y0, x1, y1, z0, z1, top, east, south, faces) =>
    drawBox(c, tx + x0, ty + y0, tx + x1, ty + y1, base + z0, base + z1, pt, top, east, south, faces);
  const flat = (col) => () => col;
  const shade = (col, k) => () => shadeColour(col, k);
  // An oily concrete floor.
  const floor = (u, v, px, py) => {
    const n = hash2(Math.floor((tx + u) * 6), Math.floor((ty + v) * 6), 31);
    return n > 0.8 ? 0x1c1c1c : n > 0.65 ? 0x3a3835 : 0x6a665e;
  };
  box(0, 0, 1, 1, -0.02, 0.05, floor, shade(0x5a564e, 0.75), shade(0x5a564e, 0.9));
  // Back walls, seen from inside: a tool board and shelves with oil cans.
  const inside = (k) => (along, z, px, py) => {
    const zl = z - base;
    const a = along % 1;
    let col = 0x3e4a52;
    if (zl > 1.0 && zl < 1.6 && a > 0.15 && a < 0.85) {
      col = 0x6b5a3a; // the tool board
      if (hash2(Math.floor(along * 14), Math.floor(zl * 8), 33) > 0.7) col = 0x9a9a9a; // spanners
    } else if (zl > 0.45 && zl < 0.5 || zl > 0.85 && zl < 0.9) col = 0x5a4a3a; // shelves
    else if (zl > 0.5 && zl < 0.62 && hash2(Math.floor(along * 10), 1, 35) > 0.4) {
      col = [0xc0392b, 0x2f6fb0, 0x3f8f4a, 0xe6e0cc][Math.floor(hash2(Math.floor(along * 10), 2, 36) * 4)]; // oil cans
    } else if (zl < 0.3 && hash2(Math.floor(along * 9), Math.floor(zl * 9), 37) > 0.75) col = 0x1a1a1a; // oil splashes
    return shadeColour(col, k);
  };
  if (!isGarage(tx - 1, ty)) box(0, 0, 0.06, 1, 0.05, 2.4, flat(0x4a4a4a), inside(0.62), shade(0x3e4a52, 0.8));
  if (!isGarage(tx, ty - 1)) box(0, 0, 1, 0.06, 0.05, 2.4, flat(0x4a4a4a), shade(0x3e4a52, 0.6), inside(0.82));
  // A workbench and a moto engine on a stand inside.
  box(0.12, 0.12, 0.5, 0.3, 0.05, 0.75, flat(0x6b4a2a), shade(0x5a3a1a, 0.72), shade(0x5a3a1a, 0.88));
  box(0.55, 0.15, 0.75, 0.32, 0.05, 0.55, flat(0x2a2a2a), shade(0x8a8a8a, 0.72), shade(0x5a5a5a, 0.88));
  // Posts at the open front.
  for (const [x, y] of [[0.92, 0.92], [0.92, 0.04], [0.04, 0.92]]) {
    if (x > 0.9 && y < 0.1 && isGarage(tx + 1, ty)) continue;
    if (y > 0.9 && x < 0.1 && isGarage(tx, ty + 1)) continue;
    box(x, y, x + 0.06, y + 0.06, 0.05, 2.4, flat(0x5a4a3a), shade(0x6b5a4a, 0.72), shade(0x6b5a4a, 0.88));
  }
  // A rusty corrugated iron roof, a little larger than the floor.
  const roof = (u, v, px, py) => {
    const ridge = Math.floor((tx + u) * 10) & 1;
    const rust = hash2(Math.floor((tx + u) * 5), Math.floor((ty + v) * 5), 39) > 0.6;
    return rust ? (ridge ? 0x8a4a2a : 0x7a3e22) : ridge ? 0x9a9a92 : 0x82827a;
  };
  const edge = (k) => (along, z, px, py) => shadeColour(Math.floor(along * 10) & 1 ? 0x7a3e22 : 0x8a8a82, k);
  drawBox(c, tx - 0.08, ty - 0.08, tx + 1.08, ty + 1.08, base + 2.4, base + 2.55, pt, roof, edge(0.72), edge(0.88),
    { east: !isGarage(tx + 1, ty), south: !isGarage(tx, ty + 1) });
}

// Barriers at the edge of a closed district. axis 'x': the closed side is in the x direction, so the
// barrier runs along y. road: a red and white road barrier; else a low wooden fence.
// The canvas origin (0, 0) is the north corner of the tile at ground level.
export function drawBarrier(axis, road) {
  const T = WORLD.tileMetres;
  const P = (x, y, z) => {
    const s = toScreen(x * T, y * T, z);
    return { x: s.x, y: s.y };
  };
  const c = new PixelCanvas(68, 50, -34, -16);
  const [a, b] = axis === 'x' ? [[0.5, 0.04], [0.5, 0.96]] : [[0.04, 0.5], [0.96, 0.5]];
  const lo = road ? 0.55 : 0.35, hi = road ? 1.0 : 0.75; // metres above the ground
  const legs = road ? [0.12, 0.88] : [0.05, 0.37, 0.68, 0.95];
  for (const t of legs) {
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const top = P(x, y, hi + 0.08), foot = P(x, y, 0);
    c.line(top.x, top.y, foot.x, foot.y, 1, road ? 0x3a3a3a : 0x5a4126);
  }
  const quad = (z0, z1, shade) => c.fillQuad(
    { ...P(a[0], a[1], z1), u: 0, v: 0 }, { ...P(b[0], b[1], z1), u: 1, v: 0 },
    { ...P(b[0], b[1], z0), u: 1, v: 1 }, { ...P(a[0], a[1], z0), u: 0, v: 1 }, shade,
  );
  if (road) quad(lo, hi, (u) => (Math.floor(u * 6) & 1 ? 0xf2f2f2 : 0xd0302a));
  else {
    quad(hi - 0.1, hi, () => 0x8a6a3e);
    quad(lo, lo + 0.1, () => 0x7a5c34);
  }
  return c;
}
