import { PixelCanvas } from './pixel-canvas.js';

// The portrait of Rukundo Thacien for the phone call of the Motari lesson (sim/lesson.js): an older motari
// with his helmet on (the visor up), grey stubble and a green rider vest. Two frames: the mouth closed and
// open (he talks). No Phaser here.

const PAL = {
  H: 0x3f8f4a, h: 0x2a6634, y: 0xf2c94c, v: 0x1a2630, w: 0x7fa6bf, s: 0x6b4226, d: 0x4a2e1a,
  e: 0xf2ece0, p: 0x1a1210, g: 0x9a9a96, m: 0x2a1410, t: 0xf2ece0, c: 0x222222, j: 0x6dbb3a, J: 0x4e8f2a, n: 0xf6f5ec,
};

const HEAD = [
  '.....HHHHHHHH.....',
  '...HHHHHyyHHHHH...',
  '..HHHHHHyyHHHHHH..',
  '.HHHHHHHyyHHHHHHh.',
  '.HHHHHHHyyHHHHHHh.',
  'hhhhhhhhhhhhhhhhhh',
  'hvvvvvvvvvvvvvvvvh',
  'hvwwvvvvvvvvvvvvvh',
  'hHdssssssssssssdHh',
  'hHsddssssssddssHHh',
  'hHseeppsssseeppsHh',
  'hHsssssssssssssdHh',
  'hcssssssdsssssssch',
  '.csssssddssssssdc.',
  '.csgssssssssssgdc.',
  '..cgsMMMMMMMMsgc..',
  '..cgsMMMMMMMMggc..',
  '...cggggggggggc...',
  '....cgggggggc.....',
  '..jjjjjsssjjjjjj..',
  '.jjjjjjjnnjjjjjJj.',
  'jjjjjjjnjjnjjjjJJj',
];
const MOUTH = {
  closed: ['sssssmmmmsss', 'ssssssssssss'],
  open: ['ssssmttttmss', 'sssssmmmmsss'],
};

/** Rukundo's head, 18 × 22 pixels with a dark outline. talk: the mouth is open. */
export function drawRukundo(talk = false) {
  const rows = HEAD.map((r) => r);
  const m = MOUTH[talk ? 'open' : 'closed'];
  // The mouth rows (15, 16): put the mouth over the 'M' marks, the rest is skin.
  for (let k = 0; k < 2; k++) {
    const row = rows[15 + k];
    const at = row.indexOf('M');
    const mouth = m[k].slice(2, 10);
    rows[15 + k] = row.slice(0, at) + mouth + row.slice(at + mouth.length);
  }
  const W = rows[0].length, H = rows.length;
  const c = new PixelCanvas(W + 2, H + 2);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch] !== undefined) c.setPixel(x + 1, y + 1, PAL[ch]); }));
  c.outline(0x101010);
  return c;
}
