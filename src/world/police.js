import { WORLD, POLICE, COLOURS } from '../config.js';
import { PixelCanvas, hash2 } from './pixel-canvas.js';
import { PERSON_CANVAS } from './vehicle-sprites.js';
import { drawText, textWidth } from './garage-sprites.js';

// Traffic police on the corners of the junctions, as in Kigali: a dark blue uniform, a white cap
// and a high visibility vest. So that you see at once that they are police (and not moto riders in
// their yellow vests), the vest is greener, with a band of blue and white checks and silver
// stripes, and a blue POLICE post with a flashing light stands at each corner. No Phaser here.

const T = WORLD.tileMetres;
const UNIFORM = 0x1c2a5a, SKIN = 0x5a3820, WHITE = 0xf4f4f4, BOOTS = 0x101010;
const VEST_COLOUR = COLOURS.policeVest, CHECK_BLUE = COLOURS.policeBlue, SILVER = 0xd8dce4;

/** The vest from (top) to (top + 6): green, a blue and white check band, silver stripes at the hem. */
function vest(c, x0, x1, top) {
  for (let y = top; y <= top + 6; y++) for (let x = x0; x <= x1; x++) c.plot(x, y, VEST_COLOUR);
  for (let x = x0; x <= x1; x++) {
    c.plot(x, top + 2, (x & 1) ? CHECK_BLUE : WHITE); // the check band (it reads as POLICE)
    c.plot(x, top + 3, (x & 1) ? WHITE : CHECK_BLUE);
    c.plot(x, top + 5, SILVER); // the reflective stripe
  }
}

/** The white police cap with a black peak and a check band. dir: 1 = the peak looks to the right. */
function cap(c, x, y, dir = 1) {
  for (let dx = -2; dx <= 3; dx++) c.plot(x + dx, y - 1, WHITE);
  for (let dx = -2; dx <= 2; dx++) c.plot(x + dx, y - 2, WHITE);
  for (let dx = -2; dx <= 3; dx++) c.plot(x + dx, y, (dx & 1) ? CHECK_BLUE : WHITE); // the band
  c.plot(x + 4 * dir, y, BOOTS); // the peak
  c.plot(x + 3 * dir, y + 1, BOOTS);
}

/**
 * A police officer. frame 0: stands; 1: one arm up (directs the traffic, blows the whistle);
 * 2 and 3: runs (long steps, arms swing; the officer looks to the right).
 */
export function drawOfficer(frame = 0) {
  const c = new PixelCanvas(PERSON_CANVAS.width, PERSON_CANVAS.height);
  const gx = PERSON_CANVAS.groundX, gy = PERSON_CANVAS.groundY;
  if (frame >= 2) return drawRunning(c, gx, gy, frame === 2 ? 1 : -1);
  c.line(gx - 1, gy - 2, gx - 1, gy - 8, 2.2, UNIFORM); // trousers
  c.line(gx + 1, gy - 2, gx + 1, gy - 8, 2.2, UNIFORM);
  c.line(gx - 1, gy - 1, gx - 1.5, gy - 1, 1.4, BOOTS);
  c.line(gx + 1, gy - 1, gx + 1.5, gy - 1, 1.4, BOOTS);
  for (let x = gx - 2; x <= gx + 2; x++) c.plot(x, gy - 9, WHITE); // the white belt
  vest(c, gx - 2, gx + 2, gy - 16);
  // Arms in the uniform sleeves, white gloves.
  c.line(gx - 3, gy - 15, gx - 3.5, gy - 10, 1.6, UNIFORM);
  c.plot(gx - 4, gy - 9, WHITE);
  if (frame) {
    c.line(gx + 3, gy - 15, gx + 5.5, gy - 21, 1.6, UNIFORM); // arm up
    c.plot(gx + 6, gy - 22, WHITE); // the white glove
    c.plot(gx + 6, gy - 23, WHITE);
  } else {
    c.line(gx + 3, gy - 15, gx + 3.5, gy - 10, 1.6, UNIFORM);
    c.plot(gx + 4, gy - 9, WHITE);
  }
  c.fillDisc(gx + 0.5, gy - 19, 2.4, SKIN);
  cap(c, gx, gy - 21);
  c.outline(0x161616);
  return c;
}

function drawRunning(c, gx, gy, step) {
  c.line(gx, gy - 8, gx + 3 * step, gy - 2, 2.2, UNIFORM); // legs far apart
  c.line(gx, gy - 8, gx - 3 * step, gy - 3, 2.2, UNIFORM);
  c.plot(gx + 3 * step, gy - 1, BOOTS);
  c.plot(gx - 3 * step, gy - 2, BOOTS);
  for (let x = gx - 1; x <= gx + 3; x++) c.plot(x, gy - 9, WHITE);
  vest(c, gx - 1, gx + 3, gy - 16); // leaning forward
  c.line(gx + 1, gy - 15, gx + 1 + 3 * step, gy - 11, 1.6, UNIFORM); // arms swing
  c.line(gx + 1, gy - 15, gx + 1 - 3 * step, gy - 12, 1.6, UNIFORM);
  c.plot(gx + 1 + 3 * step, gy - 10, WHITE);
  c.plot(gx + 1 - 3 * step, gy - 11, WHITE);
  c.fillDisc(gx + 2, gy - 19, 2.4, SKIN);
  cap(c, gx + 2, gy - 21);
  c.plot(gx + 4, gy - 17, 0xc0c0c0); // the whistle in the mouth
  c.outline(0x161616);
  return c;
}

export const POLICE_POST = { width: 30, height: 40, groundX: 15, groundY: 38 };

/**
 * The police post at a corner: a blue sign on a pole with POLICE in white letters, and a light on
 * top. light 0: blue, 1: red (the game swaps the two, so that the light flashes).
 */
export function drawPolicePost(light = 0) {
  const P = POLICE_POST;
  const c = new PixelCanvas(P.width, P.height);
  for (let y = 12; y <= P.groundY; y++) c.setPixel(P.groundX, y, 0x8a8a8a); // the pole
  const w = textWidth('POLICE') + 6, x0 = P.groundX - Math.floor(w / 2);
  for (let y = 6; y <= 14; y++) for (let x = x0; x < x0 + w; x++) c.setPixel(x, y, y === 6 || y === 14 ? WHITE : CHECK_BLUE);
  drawText(c, 'POLICE', x0 + 3, 8, WHITE);
  // The light on top of the board.
  const lamp = light ? 0xf03a3a : 0x3a7af0;
  for (let y = 2; y <= 4; y++) for (let x = P.groundX - 1; x <= P.groundX + 1; x++) c.setPixel(x, y, lamp);
  c.setPixel(P.groundX, 1, lamp);
  c.setPixel(P.groundX, 5, 0x404040);
  c.outline(0x161616);
  return c;
}

/**
 * Where the officers stand: one corner of most road junctions (3 or 4 ways). graph: the road
 * graph (sim/roads.js). Returns [{ x, y, phase }] in metres.
 */
export function policeSpots(world, graph) {
  const spots = [];
  const free = (t) => t && !t.block && !t.solid && (t.surface === 'pavement' || t.surface === 'grass');
  const near = (x, y, d) => world.places.some((p) => Math.hypot(p.x * T - x, p.y * T - y) < d * T);
  for (const n of graph.nodes) {
    const dirs = new Set(n.out.map((e) => `${Math.round(e.dx)},${Math.round(e.dy)}`));
    if (dirs.size < 3) continue;
    const tx = Math.round(n.x / T), ty = Math.round(n.y / T);
    if (hash2(tx, ty, 130) >= POLICE.junctionChance) continue;
    // The four corners of the junction (the road is 2 tiles wide around the node).
    const corners = [[-2, -2], [1, -2], [-2, 1], [1, 1]];
    const start = Math.floor(hash2(ty, tx, 131) * 4);
    for (let i = 0; i < 4; i++) {
      const [dx, dy] = corners[(start + i) % 4];
      const t = world.tile(tx + dx, ty + dy);
      if (!free(t)) continue;
      // Stand on the corner of the tile next to the junction.
      const x = (tx + dx + (dx < 0 ? 0.75 : 0.25)) * T, y = (ty + dy + (dy < 0 ? 0.75 : 0.25)) * T;
      if (near(x, y, 1.5)) continue;
      // The post stands further into the corner, away from the road.
      // No post near a place (a garage or a station has its own sign there): the officer stands alone.
      const post0 = { x: (tx + dx + (dx < 0 ? 0.3 : 0.7)) * T, y: (ty + dy + (dy < 0 ? 0.3 : 0.7)) * T };
      const post = near(post0.x, post0.y, 3) ? null : post0;
      spots.push({ x, y, phase: hash2(tx, ty, 132) * 3, post });
      break;
    }
  }
  return spots;
}
