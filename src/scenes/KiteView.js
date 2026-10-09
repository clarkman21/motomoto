import { WORLD, KITES } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawKite, drawKiteShadow, KITE_CANVAS } from '../world/kite-sprites.js';
import { createKites, stepKites, kitesVisible } from '../sim/kites.js';
import { addCanvasTexture } from './textures.js';

// Brown kites that circle high over the city (sim/kites.js), with a small shadow on the ground.
// They draw over the buildings (they are high in the sky), but under the HUD.

const SKY_DEPTH = 9e4;

export class KiteView {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    for (const f of ['glide', 'up', 'down']) if (!scene.textures.exists(`kite-${f}`)) addCanvasTexture(scene, `kite-${f}`, drawKite(f));
    if (!scene.textures.exists('kite-shadow')) addCanvasTexture(scene, 'kite-shadow', drawKiteShadow());
    // Most kites over the markets and the bus park (they look for food there), some over the valleys.
    const T = WORLD.tileMetres;
    const centres = world.places.filter((p) => p.tags.includes('market')).map((p) => ({ x: p.x * T, y: p.y * T }));
    if (!centres.length) centres.push({ x: world.width * T * 0.5, y: world.height * T * 0.5 });
    this.kites = createKites(centres);
    this.sprites = this.kites.map(() => ({
      img: scene.add.image(0, 0, 'kite-glide').setOrigin(0.5).setDepth(SKY_DEPTH).setVisible(false),
      shadow: scene.add.image(0, 0, 'kite-shadow').setOrigin(0.5).setVisible(false),
    }));
  }

  /** dt in seconds. light: daylight (0..1). rain: a rainy day. view: the camera world view. */
  update(time, dt, view, light, rain) {
    stepKites(this.kites, dt);
    const n = kitesVisible(this.kites.length, light, rain);
    const m = 30;
    this.kites.forEach((k, i) => {
      const { img, shadow } = this.sprites[i];
      if (i >= n) {
        img.setVisible(false);
        shadow.setVisible(false);
        return;
      }
      const ground = this.world.heightAt(k.x, k.y);
      const s = toScreen(k.x, k.y, ground + k.alt);
      const visible = s.x > view.x - m && s.x < view.right + m && s.y > view.y - m && s.y < view.bottom + m;
      img.setVisible(visible);
      if (visible) {
        const frame = k.flap > 0 ? (Math.floor(time / 130) % 2 ? 'up' : 'down') : 'glide';
        img.setTexture(`kite-${frame}`).setPosition(Math.round(s.x), Math.round(s.y));
      }
      // The shadow: on the ground under the kite (the sun is high), a little to the lower right.
      const g = toScreen(k.x + 2, k.y + 2, ground);
      const sv = g.x > view.x - m && g.x < view.right + m && g.y > view.y - m && g.y < view.bottom + m;
      shadow.setVisible(sv).setPosition(Math.round(g.x), Math.round(g.y)).setDepth((k.x + k.y) / WORLD.tileMetres - 0.5);
    });
  }
}

export { KITE_CANVAS };
