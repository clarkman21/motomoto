import { SMOG } from '../config.js';
import { PixelCanvas, hash2 } from '../world/pixel-canvas.js';
import { addCanvasTexture } from './textures.js';

// The smog over the city (sim/story.js): a brown haze in soft blocks of whole pixels that drifts
// slowly over the view. It is thick at level 1 and thinner at each level. Over the world, under the HUD.

const SIZE = 128;

export class SmogView {
  constructor(scene) {
    if (!scene.textures.exists('smog')) {
      const c = new PixelCanvas(SIZE, SIZE);
      const n = SMOG.cellPx;
      // Soft blobs: each cell's strength from two layers of noise (the texture tiles without seams).
      for (let y = 0; y < SIZE; y += n) for (let x = 0; x < SIZE; x += n) {
        const big = (Math.sin((x / SIZE) * Math.PI * 2) + Math.sin((y / SIZE) * Math.PI * 4 + 1) + 2) / 4;
        const a = Math.round(150 + 105 * (0.6 * big + 0.4 * hash2(x / n, y / n, 501)));
        for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) c.setPixel(x + xx, y + yy, SMOG.colour, a);
      }
      addCanvasTexture(scene, 'smog', c);
    }
    this.img = scene.add.tileSprite(0, 0, 16, 16, 'smog').setOrigin(0).setDepth(9.5e4).setVisible(false);
    this.t = 0;
  }

  /** alpha: the smog of the level (0: none). view: the camera world view. */
  update(view, dt, alpha) {
    this.img.setVisible(alpha > 0);
    if (alpha <= 0) return;
    this.t += dt;
    const x = Math.floor(view.x), y = Math.floor(view.y);
    this.img.setPosition(x, y).setSize(Math.ceil(view.width) + 2, Math.ceil(view.height) + 2).setAlpha(alpha);
    // The haze drifts with the wind, and stays still on the ground when the camera moves.
    this.img.setTilePosition(x + Math.floor(this.t * SMOG.driftPxPerSecond), y);
  }
}
