import Phaser from 'phaser';
import { drawRetroFontSheet, RETRO_CHARS, RETRO_CELL, RETRO_PER_ROW, retroText } from '../world/retro-font.js';
import { drawIconSheet } from '../world/hud-icons.js';
import { addCanvasTexture } from './textures.js';

// Shared parts of the retro 16-bit look (menus, HUD, end of day): the pixel font, the icons,
// the blue windows and the segmented bars. All sizes are in virtual pixels: the scene draws
// at a low resolution in a container, and scales the container by a whole number.

export const UI = {
  white: 0xffffff, dim: 0xa8b0e0, green: 0x7fe0b8, gold: 0xffc85a, red: 0xf05a40, orange: 0xf0a040, grey: 0x7a80a0,
};

/** The biggest whole number scale that keeps at least minW × minH virtual pixels (2 at least). */
export function pixelScale(width, height, minW, minH) {
  return Math.max(2, Math.min(6, Math.floor(Math.min(width / minW, height / minH))));
}

/** Make the 'retro' bitmap font once (any scene can call it). */
export function ensureRetroFont(scene) {
  if (scene.cache.bitmapFont.exists('retro')) return;
  addCanvasTexture(scene, 'retro-font', drawRetroFontSheet());
  const config = {
    image: 'retro-font', width: RETRO_CELL.width, height: RETRO_CELL.height, chars: RETRO_CHARS,
    charsPerRow: RETRO_PER_ROW, spacing: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, lineSpacing: 1,
  };
  scene.cache.bitmapFont.add('retro', Phaser.GameObjects.RetroFont.Parse(scene, config));
}

/** Make the icon sheet once: texture 'hud-icons' with one frame for each icon. */
export function ensureIcons(scene) {
  if (scene.textures.exists('hud-icons')) return;
  const { canvas, frames } = drawIconSheet();
  addCanvasTexture(scene, 'hud-icons', canvas);
  const tex = scene.textures.get('hud-icons');
  for (const [name, f] of Object.entries(frames)) tex.add(name, 0, f.x, f.y, f.w, f.h);
}

/**
 * Text in the pixel font (capitals). scale 2 for big numbers. setText on the result also turns
 * the text into capitals and removes characters that the font does not have.
 */
export function retroLabel(scene, x, y, text, tint = UI.white, scale = 1) {
  const t = scene.add.bitmapText(x, y, 'retro', retroText(text)).setTint(tint).setScale(scale);
  const setText = t.setText.bind(t);
  t.setText = (value) => setText(retroText(value));
  return t;
}

/** Width in virtual pixels of a text in the pixel font. */
export const retroWidth = (text, scale = 1) => retroText(text).length * RETRO_CELL.width * scale;

/**
 * A window like the menus of 16-bit role playing games: a blue gradient and a light border.
 * style 'dark': a near black window (for the minimap and prompts on busy ground).
 */
export function drawWindow(g, x, y, w, h, style = 'blue', alpha = 0.94) {
  const bands = style === 'dark'
    ? [0x1a1e2e, 0x181c2a, 0x161a26, 0x141822, 0x12161e]
    : [0x3050c0, 0x2a48b0, 0x2440a0, 0x1e3890, 0x183080, 0x142870, 0x102060];
  const bandH = Math.ceil((h - 4) / bands.length);
  bands.forEach((col, i) => {
    const top = y + 2 + i * bandH;
    const hh = Math.min(bandH, y + h - 2 - top);
    if (hh > 0) g.fillStyle(col, alpha).fillRect(x + 2, top, w - 4, hh);
  });
  g.fillStyle(0x000000, 1);
  g.fillRect(x + 1, y, w - 2, 1).fillRect(x + 1, y + h - 1, w - 2, 1).fillRect(x, y + 1, 1, h - 2).fillRect(x + w - 1, y + 1, 1, h - 2);
  g.fillStyle(style === 'dark' ? 0x8088a8 : 0xe8e8f8, 1);
  g.fillRect(x + 2, y + 1, w - 4, 1).fillRect(x + 1, y + 2, 1, h - 4);
  g.fillStyle(style === 'dark' ? 0x4a5068 : 0x9098c8, 1);
  g.fillRect(x + 2, y + h - 2, w - 4, 1).fillRect(x + w - 2, y + 2, 1, h - 4);
  return g;
}

/**
 * A segmented bar (like the life bar of a 16-bit game): a black frame, then `segments` blocks.
 * frac 0..1 fills the blocks from the left. colour: a number, or a function (segment index) → colour.
 */
export function drawSegBar(g, x, y, w, h, frac, colour, segments = 10, empty = 0x2a2e40) {
  g.fillStyle(0x000000, 1).fillRect(x, y, w, h);
  const inner = w - 2, seg = inner / segments;
  const filled = Math.max(0, Math.min(1, frac)) * segments;
  for (let i = 0; i < segments; i++) {
    const x0 = Math.round(x + 1 + i * seg), x1 = Math.round(x + 1 + (i + 1) * seg) - 1;
    const on = i < Math.floor(filled) || (i < filled && filled - i >= 0.5);
    const col = on ? (typeof colour === 'function' ? colour(i) : colour) : empty;
    g.fillStyle(col, 1).fillRect(x0, y + 1, Math.max(1, x1 - x0), h - 2);
    if (on) g.fillStyle(0xffffff, 0.35).fillRect(x0, y + 1, Math.max(1, x1 - x0), 1); // shine on top
  }
}
