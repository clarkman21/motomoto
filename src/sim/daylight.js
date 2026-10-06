import { DAYLIGHT } from '../config.js';

// Day and night: how much daylight there is at an hour, and the colour of the light.
// No Phaser here. light: 0 = night, 1 = full day. tint: a colour multiplier for the world.

export function lightAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  const c = DAYLIGHT.curve;
  for (let i = 0; i < c.length - 1; i++) {
    const [h0, l0] = c[i], [h1, l1] = c[i + 1];
    if (h >= h0 && h <= h1) return l0 + ((l1 - l0) * (h - h0)) / (h1 - h0 || 1);
  }
  return 0;
}

const mix = (a, b, t) => a + (b - a) * t;

/** { light, night (0..1, how strong the lamps are), tint (0xRRGGBB) } for an hour. */
export function daylight(hour) {
  const h = ((hour % 24) + 24) % 24;
  const light = lightAt(h);
  const n = DAYLIGHT.nightTint;
  let rgb = [mix(n[0], 1, light), mix(n[1], 1, light), mix(n[2], 1, light)];
  // Warm light at sunset and, a little, at dawn.
  const warm = Math.max(0, 1 - Math.abs(h - 18.4) / 1.3) + 0.5 * Math.max(0, 1 - Math.abs(h - 6.3) / 0.9);
  const s = DAYLIGHT.sunsetTint;
  rgb = rgb.map((c, i) => c * mix(1, s[i], Math.min(1, warm)));
  const byte = (c) => Math.max(0, Math.min(255, Math.round(c * 255)));
  const tint = (byte(rgb[0]) << 16) | (byte(rgb[1]) << 8) | byte(rgb[2]);
  // Lamps come on before full dark and go off after dawn.
  const night = Math.max(0, Math.min(1, (0.85 - light) / 0.7));
  return { light, night, tint };
}
