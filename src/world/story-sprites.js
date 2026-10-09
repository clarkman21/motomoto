import { COLOURS } from '../config.js';
import { PixelCanvas } from './pixel-canvas.js';

// The yellow battery pickup (story arc, levels 3 and 4): an Ampersand battery in Surge Yellow (a
// battery: Surge Yellow is right here), with a black top and a white lightning mark. 9 × 12 pixels.
export const BATTERY_CANVAS = { width: 9, height: 12, groundX: 4, groundY: 11 };

export function drawYellowBattery() {
  const c = new PixelCanvas(BATTERY_CANVAS.width, BATTERY_CANVAS.height);
  const Y = COLOURS.ampersandYellow, D = 0xc8ae00, K = 0x101010, W = 0xffffff;
  for (let y = 2; y < 11; y++) for (let x = 1; x < 8; x++) c.setPixel(x, y, x === 7 ? D : Y); // the body, darker on the right
  for (let x = 2; x < 7; x++) c.setPixel(x, 1, K); // the black top
  c.setPixel(3, 0, K); c.setPixel(5, 0, K); // the terminals
  for (const [x, y] of [[5, 3], [4, 4], [3, 5], [4, 5], [5, 5], [4, 6], [3, 7]]) c.setPixel(x, y, W); // a lightning mark
  for (let x = 1; x < 8; x++) c.setPixel(x, 11, 0x000000, 90); // a small shadow
  c.outline(0x161616);
  return c;
}
