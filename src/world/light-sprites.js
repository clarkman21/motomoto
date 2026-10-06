import { WORLD, LIGHTS } from '../config.js';
import { PixelCanvas } from './pixel-canvas.js';
import { BIKE_DIRECTIONS } from './sprites.js';

// Light textures for the night: ground pools under street lamps, headlight cones, small light
// dots and the lamp post. The game draws the light textures with additive blending, so the
// alpha of each pixel is the strength of the light. The light fades in steps (bands), so it
// looks like pixel art and not like a smooth gradient.

const HALF_W = WORLD.tileWidthPx / 2;
const HALF_H = WORLD.tileHeightPx / 2;
const BANDS = 5;

const band = (t) => Math.ceil(Math.max(0, Math.min(1, t)) * BANDS) / BANDS;

/** Ground offset in metres for a screen offset in pixels (inverse of the flat iso projection). */
function groundOffset(sx, sy) {
  const a = sx / HALF_W, b = sy / HALF_H;
  return { dx: ((a + b) / 2) * WORLD.tileMetres, dy: ((b - a) / 2) * WORLD.tileMetres };
}

/** A round pool of light on the ground (an ellipse on the screen). The canvas centre is the pool centre. */
export function drawLightPool(radiusMetres, rgb, alpha) {
  const rTiles = radiusMetres / WORLD.tileMetres;
  const w = Math.ceil(rTiles * HALF_W * Math.SQRT2) * 2 + 2;
  const h = Math.ceil(rTiles * HALF_H * Math.SQRT2) * 2 + 2;
  const c = new PixelCanvas(w, h, -w / 2, -h / 2);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const { dx, dy } = groundOffset(px + 0.5 - w / 2, py + 0.5 - h / 2);
      const t = 1 - Math.hypot(dx, dy) / radiusMetres;
      if (t > 0) c.setPixel(px, py, rgb, Math.round(alpha * band(t ** 1.4)));
    }
  }
  return c;
}

/** Size of a headlight cone frame. The canvas centre is the vehicle position on the ground. */
export function headlightCanvasSize() {
  const reach = LIGHTS.headlightLengthMetres / WORLD.tileMetres;
  return { width: Math.ceil(reach * HALF_W * Math.SQRT2) * 2 + 4, height: Math.ceil(reach * HALF_H * Math.SQRT2) * 2 + 4 };
}

/** A headlight cone on the ground for one of the 16 headings (frame 0 points along +x). */
export function drawHeadlightCone(frame) {
  const { width: w, height: h } = headlightCanvasSize();
  const c = new PixelCanvas(w, h, -w / 2, -h / 2);
  const heading = (frame * Math.PI * 2) / BIKE_DIRECTIONS;
  const half = (LIGHTS.headlightHalfAngleDeg * Math.PI) / 180;
  const near = 0.8, far = LIGHTS.headlightLengthMetres;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const { dx, dy } = groundOffset(px + 0.5 - w / 2, py + 0.5 - h / 2);
      const d = Math.hypot(dx, dy);
      if (d < near || d > far) continue;
      let ang = Math.atan2(dy, dx) - heading;
      ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(ang) > half) continue;
      const t = (1 - (d - near) / (far - near)) * (1 - (ang / half) ** 2);
      const a = Math.round(LIGHTS.headlightAlpha * band(t));
      if (a > 0) c.setPixel(px, py, LIGHTS.headlightColour, a);
    }
  }
  return c;
}

/** A small round light (a lamp head, a headlight or a tail light). The canvas centre is the light. */
export function drawLightDot(radiusPx, rgb) {
  const size = radiusPx * 2 + 1;
  const c = new PixelCanvas(size, size, -radiusPx - 0.5, -radiusPx - 0.5);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const t = 1 - Math.hypot(px - radiusPx, py - radiusPx) / (radiusPx + 0.5);
      if (t > 0) c.setPixel(px, py, rgb, Math.round(255 * band(t * 1.6)));
    }
  }
  return c;
}

// The lamp post: a pole with an arm over the road. side is the side of the road the post stands on.
export const LAMP_CANVAS = { width: 30, height: 64, groundX: 15, groundY: 61 };
const ARM_DIR = { north: [-1, 0.5], south: [1, -0.5], west: [1, 0.5], east: [-1, -0.5] }; // screen direction to the road

/** Screen offset of the lamp head from the foot of the post. */
export function lampHeadOffset(side) {
  const [ax, ay] = ARM_DIR[side];
  const top = (LIGHTS.lampHeightMetres / WORLD.levelMetres) * WORLD.levelPx;
  return { x: ax * 9, y: -top + ay * 9 + 2 };
}

export function drawLampPost(side) {
  const { width, height, groundX, groundY } = LAMP_CANVAS;
  const c = new PixelCanvas(width, height);
  const top = Math.round((LIGHTS.lampHeightMetres / WORLD.levelMetres) * WORLD.levelPx);
  const pole = 0x6a6e72, dark = 0x3e4246;
  for (let y = groundY - top; y <= groundY; y++) {
    c.setPixel(groundX, y, pole);
    c.setPixel(groundX + 1, y, dark);
  }
  for (let y = groundY - 3; y <= groundY; y++) c.setPixel(groundX - 1, y, dark); // base
  const head = lampHeadOffset(side);
  c.line(groundX + 0.5, groundY - top + 0.5, groundX + head.x + 0.5, groundY + head.y - 1.5, 1, pole);
  const hx = Math.round(groundX + head.x), hy = Math.round(groundY + head.y);
  for (let x = hx - 2; x <= hx + 2; x++) c.setPixel(x, hy - 1, dark);
  for (let x = hx - 1; x <= hx + 1; x++) c.setPixel(x, hy, 0xd8d2c0); // lamp glass
  return c;
}
