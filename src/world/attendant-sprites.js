import { COLOURS, PALETTE } from '../config.js';
import { finishFigure } from './palette.js';
import { PixelCanvas } from './pixel-canvas.js';
import { PERSON_CANVAS } from './vehicle-sprites.js';

// Station attendants who come out to help you (same size as the walkers).
// - fuel: an SP attendant in a blue uniform and a yellow cap, with the fuel nozzle on a black hose.
// - swap: an Ampersand attendant in black with a Surge Yellow vest, who carries the new battery.
// Frames: 'walk0', 'walk1' (walking), 'work' (filling up, or lifting the battery to the bike).
// The sprite looks to the right; left: true draws it to look to the left (the light stays top left).

export const ATTENDANT_FRAMES = ['walk0', 'walk1', 'work'];

const SKIN = PALETTE.skinDeep;
const LOOKS = {
  fuel: { shirt: COLOURS.spBlue, legs: PALETTE.uniform, cap: COLOURS.spYellow, trim: COLOURS.spYellow },
  swap: { shirt: PALETTE.hair, legs: PALETTE.shoe, cap: PALETTE.hair, trim: COLOURS.ampersandYellow },
};

export function drawAttendant(kind, frame, left = false) {
  const c = new PixelCanvas(PERSON_CANVAS.width + 6, PERSON_CANVAS.height);
  const look = LOOKS[kind] ?? LOOKS.fuel;
  const gx = PERSON_CANVAS.groundX, gy = PERSON_CANVAS.groundY;
  const step = frame === 'walk1' ? 1.5 : frame === 'walk0' ? -1.5 : 0;
  // Legs and body. The vest or the uniform trim is a band across the chest.
  c.line(gx - 1, gy - 1, gx - 1 + step * 0.6, gy - 8, 2.2, look.legs);
  c.line(gx + 1, gy - 1, gx + 1 - step * 0.6, gy - 8, 2.2, look.legs);
  c.line(gx, gy - 9, gx, gy - 15, 4.6, look.shirt);
  for (let x = gx - 2; x <= gx + 2; x++) c.plot(x, gy - 12, look.trim);
  if (kind === 'swap') for (let y = gy - 15; y <= gy - 10; y++) { c.plot(gx - 2, y, look.trim); c.plot(gx + 2, y, look.trim); }
  // Head and cap (the peak looks forward, to the right).
  c.fillDisc(gx + 0.5, gy - 18.5, 2.5, SKIN);
  for (let x = gx - 2; x <= gx + 3; x++) c.plot(x, gy - 21, look.cap);
  for (let x = gx - 1; x <= gx + 2; x++) c.plot(x, gy - 22, look.cap);
  c.plot(gx + 4, gy - 20, look.cap);
  if (kind === 'fuel') {
    // The nozzle: in the hand in front, on a black hose that hangs back to the pump.
    const hand = frame === 'work' ? { x: gx + 6, y: gy - 12 } : { x: gx + 3, y: gy - 10 };
    c.line(gx + 2, gy - 14, hand.x, hand.y, 1.6, SKIN);
    c.line(gx - 2.5, gy - 14, gx - 3 - step * 0.4, gy - 9, 1.6, SKIN);
    c.line(hand.x, hand.y, hand.x + 2, hand.y - 1, 1.6, PALETTE.shoe); // the nozzle
    c.line(hand.x - 1, hand.y + 1, gx - 5, gy - 2, 1, PALETTE.boots); // the hose
  } else {
    // The battery: a Surge Yellow box in both hands (higher when it goes into the bike).
    const by = frame === 'work' ? gy - 17 : gy - 12;
    c.line(gx - 2, gy - 14, gx + 3, by + 1, 1.6, SKIN);
    c.line(gx + 2, gy - 14, gx + 4, by + 1, 1.6, SKIN);
    for (let y = by - 2; y <= by + 2; y++) for (let x = gx + 2; x <= gx + 6; x++) c.plot(x, y, y === by - 2 ? PALETTE.shoe : COLOURS.ampersandYellow);
  }
  return finishFigure(c, left);
}
