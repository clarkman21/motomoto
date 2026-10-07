import { WORLD, POLICE } from '../config.js';
import { PixelCanvas, hash2 } from './pixel-canvas.js';
import { PERSON_CANVAS } from './vehicle-sprites.js';
import { VEST } from './sprites.js';

// Traffic police on the corners of the junctions, as in Kigali: a dark blue uniform, a dark
// blue cap and a high visibility vest with POLICE on it. No Phaser here.

const T = WORLD.tileMetres;
const UNIFORM = 0x1c2a5a, CAP = 0x141e44, SKIN = 0x5a3820;

/**
 * A police officer. frame 0: stands; 1: one arm up (directs the traffic, blows the whistle);
 * 2 and 3: runs (long steps, arms swing; the officer looks to the right).
 */
export function drawOfficer(frame = 0) {
  const c = new PixelCanvas(PERSON_CANVAS.width, PERSON_CANVAS.height);
  const gx = PERSON_CANVAS.groundX, gy = PERSON_CANVAS.groundY;
  if (frame >= 2) return drawRunning(c, gx, gy, frame === 2 ? 1 : -1);
  c.line(gx - 1, gy - 1, gx - 1, gy - 8, 2.2, UNIFORM); // trousers
  c.line(gx + 1, gy - 1, gx + 1, gy - 8, 2.2, UNIFORM);
  c.line(gx, gy - 9, gx, gy - 15, 4.6, VEST.colour); // the high visibility vest
  // The POLICE band across the vest: dark blue with white letters (too small to read: a pattern).
  for (let x = gx - 2; x <= gx + 2; x++) c.plot(x, gy - 12, UNIFORM);
  for (const x of [gx - 2, gx, gx + 2]) c.plot(x, gy - 12, 0xf2f2f2);
  c.plot(gx - 2, gy - 10, VEST.stripe);
  c.plot(gx + 2, gy - 10, VEST.stripe);
  // Arms in the uniform sleeves.
  c.line(gx - 2.5, gy - 14, gx - 3, gy - 9, 1.6, UNIFORM);
  if (frame) {
    c.line(gx + 2.5, gy - 14, gx + 5, gy - 20, 1.6, UNIFORM); // arm up
    c.plot(gx + 5, gy - 21, 0xf2f2f2); // the white glove
  } else c.line(gx + 2.5, gy - 14, gx + 3, gy - 9, 1.6, UNIFORM);
  c.fillDisc(gx + 0.5, gy - 18.5, 2.5, SKIN);
  // The cap: dark blue with a peak to the front.
  for (let x = gx - 2; x <= gx + 3; x++) c.plot(x, gy - 21, CAP);
  for (let x = gx - 1; x <= gx + 2; x++) c.plot(x, gy - 22, CAP);
  c.plot(gx + 4, gy - 20, CAP);
  c.plot(gx, gy - 21, VEST.colour); // the badge
  c.outline(0x161616);
  return c;
}

function drawRunning(c, gx, gy, step) {
  c.line(gx, gy - 8, gx + 3 * step, gy - 1, 2.2, UNIFORM); // legs far apart
  c.line(gx, gy - 8, gx - 3 * step, gy - 2, 2.2, UNIFORM);
  c.line(gx + 0.5, gy - 9, gx + 1.5, gy - 15, 4.6, VEST.colour); // leaning forward
  for (let x = gx - 1; x <= gx + 3; x++) c.plot(x, gy - 12, UNIFORM);
  for (const x of [gx - 1, gx + 1, gx + 3]) c.plot(x, gy - 12, 0xf2f2f2);
  c.line(gx + 1, gy - 14, gx + 1 + 3 * step, gy - 10, 1.6, UNIFORM); // arms swing
  c.line(gx + 1, gy - 14, gx + 1 - 3 * step, gy - 11, 1.6, UNIFORM);
  c.fillDisc(gx + 2, gy - 18.5, 2.5, SKIN);
  for (let x = gx; x <= gx + 5; x++) c.plot(x, gy - 21, CAP);
  for (let x = gx + 1; x <= gx + 4; x++) c.plot(x, gy - 22, CAP);
  c.plot(gx + 6, gy - 20, CAP);
  c.plot(gx + 4, gy - 16, 0xc0c0c0); // the whistle in the mouth
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
      spots.push({ x, y, phase: hash2(tx, ty, 132) * 3 });
      break;
    }
  }
  return spots;
}
