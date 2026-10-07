import { PixelCanvas, hash2 } from './pixel-canvas.js';
import { KITENGE } from './market-sprites.js';

// The game over picture: you lost the moto, so you ride a bicycle taxi (an igare) again.
// A side view (not isometric), like the cut scenes of 16-bit games. One pixel is one virtual
// pixel of the retro UI. No Phaser here.
// - drawBicycleTaxi(frame, frames): the rider pedals, with a passenger on the padded seat at the
//   back. The sprite looks to the right. The pedals turn and the wheels turn with the frame.
// - drawGameOverBackdrop(w, h): an evening sky, the green hills of Kigali with small houses, and a road.
// - drawJailCell(w, h, frame): the jail game over (you hit a police officer): you sit in a cell.

export const BICYCLE_CANVAS = { width: 60, height: 50, groundY: 48 };
export const BACKDROP_ROAD = 14; // the height of the road at the bottom of the backdrop

const SKIN = 0x5a3820;
const SKIN_DARK = 0x46301c;
const TYRE = 0x161616;
const STEEL = 0x8c8c94;
const FRAME = 0x8a1c1c; // a red roadster frame
const CUSHION = [0x1f6fb0, 0xf2efe6]; // the padded seat for the passenger: blue and white checks
const SHIRT = 0x2e8b57;
const SHIRT_DARK = 0x246e45;
const TROUSERS = 0x2a3550;

/** Where the knee is, for a hip, a foot and the two leg parts (the knee goes forward and up). */
function knee(hip, foot, a = 9, b = 9) {
  const dx = foot.x - hip.x, dy = foot.y - hip.y;
  const d = Math.min(a + b - 0.01, Math.hypot(dx, dy));
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const ux = dx / d, uy = dy / d;
  // Of the two answers, use the one in front of the line from the hip to the foot.
  return { x: hip.x + ux * along + uy * h, y: hip.y + uy * along - ux * h };
}

/** A wheel: a black tyre, a steel rim, spokes that turn with the frame, and the hub. */
function wheel(c, cx, cy, r, turn) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r && d > r - 1.6) c.plot(x, y, TYRE);
      else if (d <= r - 1.6 && d > r - 2.4) c.plot(x, y, STEEL);
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = turn + (i * Math.PI) / 4;
    const dx = Math.cos(a) * (r - 2.2), dy = Math.sin(a) * (r - 2.2);
    c.line(cx - dx, cy - dy, cx + dx, cy + dy, 0.6, 0xb8b8c0);
  }
  c.fillDisc(cx, cy, 1.2, 0x505058);
}

/** The bicycle taxi with the rider and a passenger. frame: 0 .. frames - 1 (one turn of the pedals). */
export function drawBicycleTaxi(frame = 0, frames = 4) {
  const c = new PixelCanvas(BICYCLE_CANVAS.width, BICYCLE_CANVAS.height);
  const gy = BICYCLE_CANVAS.groundY;
  const r = 8.5;
  const rear = { x: 13, y: gy - r }, front = { x: 46, y: gy - r };
  const bb = { x: 26, y: gy - r + 1 }; // the bottom bracket (the pedal axle)
  const seat = { x: 22, y: gy - 24 }, head = { x: 40, y: gy - 25 }, headLow = { x: 41, y: gy - 20 };
  const turn = (frame / frames) * Math.PI * 2;
  const bob = frame % 2; // the rider goes up and down a little with the pedals

  // The far pedal and leg first (behind the bike).
  const crank = 4.2;
  const pedal = (a) => ({ x: bb.x + Math.cos(a) * crank, y: bb.y + Math.sin(a) * crank });
  const pNear = pedal(turn), pFar = pedal(turn + Math.PI);
  const hip = { x: seat.x + 1, y: seat.y - 2 + bob };
  const kFar = knee(hip, pFar);
  c.line(hip.x, hip.y, kFar.x, kFar.y, 2.6, 0x1e2840);
  c.line(kFar.x, kFar.y, pFar.x, pFar.y, 2.2, 0x1e2840);
  c.line(pFar.x, pFar.y, pFar.x + 2.5, pFar.y, 1.4, 0x101010); // the far shoe

  // Wheels, mudguards and the frame.
  wheel(c, rear.x, rear.y, r, -turn * 1.6);
  wheel(c, front.x, front.y, r, -turn * 1.6);
  for (let a = -2.6; a <= -0.4; a += 0.08) c.plot(front.x + Math.cos(a) * (r + 1.2), front.y + Math.sin(a) * (r + 1.2), 0x3a3a40);
  c.line(rear.x, rear.y, bb.x, bb.y, 1.4, FRAME); // the chain stay
  c.line(rear.x, rear.y, seat.x, seat.y + 2, 1.4, FRAME); // the seat stay
  c.line(bb.x, bb.y, seat.x, seat.y + 1, 1.8, FRAME); // the seat tube
  c.line(bb.x, bb.y, headLow.x, headLow.y, 1.8, FRAME); // the down tube
  c.line(seat.x + 1, seat.y + 2, head.x, head.y + 1, 1.8, FRAME); // the top tube
  c.line(headLow.x, headLow.y, front.x, front.y, 1.4, 0x5a5a62); // the fork
  c.line(head.x, head.y + 1, head.x - 1, head.y - 4, 1.4, 0x5a5a62); // the stem
  c.line(head.x - 4, head.y - 4, head.x + 1, head.y - 4, 1.2, 0x5a5a62); // the handlebar
  c.plot(head.x - 4, head.y - 4, 0x101010);
  c.line(head.x + 1, head.y - 5, head.x + 2, head.y - 9, 0.6, 0x5a5a62); // the mirror stalk
  c.fillDisc(head.x + 2.5, head.y - 9.5, 1.1, 0xc8d8e8);
  // Plastic flowers on the handlebar, like on many bicycle taxis.
  c.plot(head.x - 2, head.y - 6, 0xe0407a);
  c.plot(head.x - 3, head.y - 6, 0xf080b0);
  c.plot(head.x - 2, head.y - 7, 0xf080b0);
  c.fillDisc(bb.x, bb.y, 2.6, 0x707078); // the chain ring
  c.line(bb.x, bb.y, rear.x, rear.y + 1, 0.6, 0x404048); // the chain
  // The carrier over the rear wheel and the padded seat on it (blue and white checks).
  c.line(rear.x - 6, seat.y + 4, seat.x - 1, seat.y + 4, 1.2, 0x5a5a62);
  c.line(rear.x - 5, seat.y + 4, rear.x, rear.y, 0.8, 0x5a5a62);
  for (let y = seat.y; y <= seat.y + 3; y++) {
    for (let x = rear.x - 7; x <= seat.x - 2; x++) c.plot(x, y, CUSHION[((x >> 1) + (y >> 1)) & 1]);
  }
  c.line(seat.x - 2, seat.y - 1, seat.x + 3, seat.y - 1, 1.6, 0x202020); // the rider's saddle

  // The passenger: a mama in kitenge who sits sideways on the padded seat, with her legs on the near side.
  const k = KITENGE[0];
  const px = rear.x - 3, py = seat.y - 1;
  c.line(px, py, px - 1, py - 9, 4.4, k.base); // the body
  for (let y = py - 10; y <= py; y += 3) c.plot(px - 1 + ((y >> 1) & 1), y, k.pat);
  c.line(px + 1, py + 1, px + 4, py + 9, 3.2, k.base); // the wrapper over her legs
  c.plot(px + 3, py + 5, k.pat);
  c.line(px + 4, py + 10, px + 4, py + 14, 1.6, SKIN); // the lower legs
  c.line(px + 4, py + 15, px + 6, py + 15, 1.4, 0x5a2a1a); // the sandal
  c.line(px, py - 7, px + 4, py - 4 + bob * 0.5, 1.4, SKIN_DARK); // her arm round the rider
  c.fillDisc(px - 0.5, py - 12.5, 2.4, SKIN);
  // Her head wrap: a round top with a knot at the back.
  for (let x = px - 3; x <= px + 1; x++) c.plot(x, py - 14, k.wrap);
  for (let x = px - 2; x <= px + 1; x++) c.plot(x, py - 15, k.wrap);
  for (let x = px - 1; x <= px; x++) c.plot(x, py - 16, k.wrap);
  c.plot(px - 4, py - 15, k.band);
  c.plot(px + 1, py - 12, 0x101010); // an eye

  // The rider: leans forward to the handlebar.
  const shoulder = { x: hip.x + 7, y: hip.y - 10 };
  c.line(hip.x, hip.y, shoulder.x, shoulder.y, 4.6, SHIRT); // the body
  c.line(hip.x + 1, hip.y - 2, shoulder.x - 1, shoulder.y + 1, 1, SHIRT_DARK);
  c.fillDisc(shoulder.x + 2, shoulder.y - 3 + bob * 0.3, 2.6, SKIN); // the head
  for (let x = shoulder.x - 1; x <= shoulder.x + 3; x++) c.plot(x, shoulder.y - 6, 0xd0d0d0); // a cap
  for (let x = shoulder.x; x <= shoulder.x + 5; x++) c.plot(x, shoulder.y - 5, 0xd0d0d0);
  c.plot(shoulder.x + 4, shoulder.y - 3, 0x101010); // an eye
  const hand = { x: head.x - 3, y: head.y - 4 };
  c.line(shoulder.x, shoulder.y + 1, hand.x, hand.y, 1.6, SKIN); // the near arm
  // The near leg and pedal (in front of the bike).
  const kNear = knee(hip, pNear);
  c.line(hip.x, hip.y, kNear.x, kNear.y, 2.8, TROUSERS);
  c.line(kNear.x, kNear.y, pNear.x, pNear.y, 2.4, TROUSERS);
  c.line(pNear.x, pNear.y, pNear.x + 2.8, pNear.y, 1.6, 0x101010); // the shoe
  c.line(bb.x, bb.y, pNear.x, pNear.y, 1, 0xa0a0a8); // the crank arm
  c.outline(0x101010);
  return c;
}

/**
 * The backdrop of the game over picture, w × h: an evening sky, the sun low over the hills, hills
 * with small houses, and a road at the bottom (BACKDROP_ROAD high) with a red earth verge.
 */
export function drawGameOverBackdrop(w, h) {
  const c = new PixelCanvas(w, h);
  const roadTop = h - BACKDROP_ROAD;
  const sky = [0x2a2050, 0x48306a, 0x7a3c6e, 0xb8505a, 0xe07a4a, 0xf0a050];
  const band = Math.ceil(roadTop / sky.length);
  for (let y = 0; y < roadTop; y++) for (let x = 0; x < w; x++) c.setPixel(x, y, sky[Math.min(sky.length - 1, Math.floor(y / band))]);
  // A few stars at the top, and the sun.
  for (let i = 0; i < w / 10; i++) {
    const x = Math.floor(hash2(i, 1, 9) * w), y = Math.floor(hash2(i, 2, 9) * band * 1.5);
    c.setPixel(x, y, 0xf2efe6);
  }
  c.fillDisc(w * 0.72, roadTop - 27, 6, 0xf8d080);
  // Three layers of hills: far (blue green) to near (green). The near hill has houses.
  const layers = [
    { base: roadTop - 22, amp: 7, freq: 0.035, phase: 1.3, col: 0x3a5a6a },
    { base: roadTop - 13, amp: 6, freq: 0.05, phase: 4.1, col: 0x2f6a4a },
    { base: roadTop - 5, amp: 4, freq: 0.07, phase: 2.2, col: 0x3f8a4a },
  ];
  layers.forEach((L, li) => {
    for (let x = 0; x < w; x++) {
      const top = Math.round(L.base - L.amp * (Math.sin(x * L.freq + L.phase) * 0.7 + Math.sin(x * L.freq * 2.3 + L.phase) * 0.3));
      for (let y = Math.max(0, top); y < roadTop; y++) c.setPixel(x, y, L.col);
      // Houses: a white wall and a red roof, on the two nearer layers.
      if (li > 0 && x % 7 === 3 && hash2(x, li, 4) < 0.45) {
        const wall = li === 1 ? 0xb8b0a0 : 0xe8e0d0, roof = li === 1 ? 0x8a3a2a : 0xb04a30;
        for (let dx = 0; dx < 3; dx++) { c.setPixel(x + dx, top, wall); c.setPixel(x + dx, top + 1, wall); c.setPixel(x + dx, top - 1, roof); }
        if (li === 2) c.setPixel(x + 1, top + 1, 0x2a2a2a); // a door
      }
    }
  });
  // The road: red earth on the verge, then tarmac with a white edge line.
  for (let x = 0; x < w; x++) {
    c.setPixel(x, roadTop, 0xa0502a);
    c.setPixel(x, roadTop + 1, hash2(x, 3, 1) < 0.5 ? 0x8a4424 : 0xa0502a);
    for (let y = roadTop + 2; y < h; y++) c.setPixel(x, y, hash2(x, y, 2) < 0.08 ? 0x4a4a50 : 0x3a3a40);
    c.setPixel(x, roadTop + 3, 0xd8d6cc);
  }
  return c;
}

/**
 * The jail picture, w × h: a cell with a brick wall, a small window with bars and moonlight, and you
 * on a bench in orange prison clothes, behind the bars of the door. frame 0: the head is down; 1: up.
 */
export function drawJailCell(w, h, frame = 0) {
  const c = new PixelCanvas(w, h);
  const floor = h - 10;
  // The wall: grey bricks with dark joints. The floor: dark concrete.
  for (let y = 0; y < floor; y++) {
    for (let x = 0; x < w; x++) {
      const row = Math.floor(y / 5), off = (row & 1) * 6;
      const joint = y % 5 === 4 || (x + off) % 12 === 11;
      const tone = hash2(Math.floor((x + off) / 12), row, 31) < 0.3 ? 0x6a6660 : 0x77736c;
      c.setPixel(x, y, joint ? 0x4e4b46 : tone);
    }
  }
  for (let y = floor; y < h; y++) for (let x = 0; x < w; x++) c.setPixel(x, y, hash2(x, y, 5) < 0.1 ? 0x3e3e40 : 0x48484a);
  // The window, high on the wall: night sky, the moon, three bars, and moonlight on the floor.
  const wx = Math.floor(w * 0.62), wy = 8, ww = 22, wh = 14;
  for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) c.setPixel(x, y, 0x1e2448);
  c.fillDisc(wx + 15, wy + 5, 3, 0xf0ecd0);
  for (const bx of [wx + 5, wx + 11, wx + 17]) for (let y = wy; y < wy + wh; y++) c.setPixel(bx, y, 0x2a2a2a);
  for (let y = floor; y < h; y++) {
    const spread = (y - floor) * 1.5;
    for (let x = Math.floor(wx - 10 - spread); x < wx + ww - 6 - spread * 0.5; x++) if (hash2(x, y, 9) < 0.5) c.setPixel(x, y, 0x5c5c5e);
  }
  // The bench and you: orange prison clothes, sitting, the arms on the knees.
  const bx = Math.floor(w * 0.3), by = floor - 10;
  for (let x = bx - 18; x <= bx + 18; x++) { c.setPixel(x, by, 0x6a4a2a); c.setPixel(x, by + 1, 0x6a4a2a); c.setPixel(x, by + 2, 0x4a3420); }
  for (const lx of [bx - 16, bx + 16]) for (let y = by + 3; y < floor + 1; y++) { c.setPixel(lx, y, 0x4a3420); c.setPixel(lx + 1, y, 0x4a3420); }
  const ORANGE = 0xe0782a, ORANGE_DARK = 0xb85c1c;
  c.line(bx, by - 1, bx, by - 17, 8, ORANGE); // the body
  c.line(bx + 2, by - 2, bx + 11, by - 2, 4.4, ORANGE_DARK); // the thighs
  c.line(bx + 11, by - 1, bx + 11, floor - 1, 3.6, ORANGE_DARK); // the lower legs
  c.line(bx + 11, floor, bx + 14, floor, 2, 0x202020); // the shoes
  c.line(bx + 2, by - 15, bx + 10, by - 5, 2.6, ORANGE); // the arm on the knee
  const head = frame ? { x: bx + 1, y: by - 23 } : { x: bx + 4, y: by - 20 };
  c.fillDisc(head.x, head.y, 4.2, SKIN);
  if (frame) { c.setPixel(head.x + 2, head.y - 1, 0x101010); c.setPixel(head.x + 2, head.y - 2, 0xffffff); } // the prisoner looks up at the window
  // The bars of the door in front of everything, with a cross bar.
  for (let x = 4; x < w; x += 16) for (let y = 0; y < h; y++) { c.setPixel(x, y, 0x1a1a1a); c.setPixel(x + 1, y, 0x3a3a3a); }
  for (let x = 0; x < w; x++) { c.setPixel(x, 4, 0x1a1a1a); c.setPixel(x, h - 18, 0x1a1a1a); c.setPixel(x, h - 17, 0x3a3a3a); }
  return c;
}
