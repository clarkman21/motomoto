import { COLOURS } from '../config.js';
import { PixelCanvas } from './pixel-canvas.js';

// The Ampersand swap cabinet (design canvas "Ampersand swap stations"): a small Surge Yellow cabinet like
// a vending machine, with a screen and rows of small doors. Each door has a light: green = a charged
// battery is behind it, red = charging. When you swap, two doors spring open and two batteries slide out.
// No attendant: the rider does the swap. No Phaser here.
//
// The front (the south face, about 1.6 m × 2.1 m) is a hand-made pixel grid, sheared 2:1 onto the wall
// as the shop signs are, so the small doors stay crisp. The east face and the top are flat tones.
// state: 'closed' or 'open'. Returns { canvas, groundX, groundY }: the canvas pixel of the middle of the
// footprint on the ground.

const PAL = {
  Y: COLOURS.ampersandYellow, y: COLOURS.ampersandYellowMid, z: COLOURS.ampersandYellowDark,
  k: 0x000000, g: COLOURS.ebonyGrey, a: 0x9e9e9e, s: 0x1e1e22, l: COLOURS.chargeGreen, r: COLOURS.chargeRed,
};
const DOOR = ['zzzzz', 'zyyy*', 'zyyyy', 'zzzzz'];
const OPEN = ['zzzzz', 'zkkkk', 'zYYYY', 'zYYYY']; // the slot, with the battery that slides out to you
const LIGHTS = ['lr', 'll', 'rl']; // the light of each door (row, column)

function front(open) {
  const rows = [
    'yyyyyyyyyyyyy',
    'YYYYYYYYYYYYY',
    'YkkkkkkkkkkkY',
    'YklllkllllkkY', // the screen: KOMEZA UGENDE (Keep on moving), too small to read: two green lines
    'YkkkkkkkkkkkY',
    'YkllkllllkkkY',
    'YkkkkkkkkkkkY',
    'YgggggggggggY',
  ];
  for (let r = 0; r < 3; r++) {
    for (let j = 0; j < 4; j++) {
      let line = 'Y';
      for (let col = 0; col < 2; col++) {
        const d = (open && r === 1 ? OPEN : DOOR)[j].replace('*', LIGHTS[r][col]);
        line += d + (col === 0 ? 'Y' : '');
      }
      rows.push(line + 'Y');
    }
  }
  rows.push('ggggggggggggg', 'aaaaaaaaaaaaa');
  return rows;
}

export function drawCabinet(state = 'closed') {
  const rows = front(state === 'open');
  const W = rows[0].length, H = rows.length, D = 3; // the east face is 3 px (0.6 m deep)
  const top = 3; // room for the top face
  const c = new PixelCanvas(W + D + 2, H + Math.ceil(W / 2) + top + 3);
  const x0 = 1, y0 = top;
  // The top: between the top edges of the front and the east face (below) and the west and back edges (above).
  for (let x = 0; x < W + D; x++) {
    const lower = x < W ? y0 + Math.floor(x / 2) : y0 + Math.floor((W - 1) / 2) - Math.floor((x - W + 1) / 2);
    const upper = x < D ? y0 - Math.ceil(x / 2) : y0 - Math.ceil(D / 2) + Math.floor((x - D) / 2);
    for (let y = upper; y < lower; y++) c.setPixel(x0 + x, y, PAL.y);
  }
  // The east face (the dark face).
  for (let e = 0; e < D; e++) {
    const off = Math.floor((W - 1) / 2) - Math.floor((e + 1) / 2);
    for (let j = 0; j < H; j++) c.setPixel(x0 + W + e, y0 + off + j, j >= H - 2 ? PAL.g : PAL.z);
  }
  // The front, sheared 2:1 (down to the right).
  for (let x = 0; x < W; x++) {
    for (let j = 0; j < H; j++) c.setPixel(x0 + x, y0 + Math.floor(x / 2) + j, PAL[rows[j][x]]);
  }
  c.outline(0x111111);
  return { canvas: c, groundX: x0 + Math.floor(W / 2) + 1, groundY: y0 + Math.floor(W / 4) + H - 1 };
}
