import { WORLD } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawYellowBattery, BATTERY_CANVAS as C } from '../world/story-sprites.js';
import { addCanvasTexture, placeOnPixels } from './textures.js';

// The yellow battery pickups on the road (story arc). They bob up and down, and they shine at night.

export class BatteryView {
  constructor(scene) {
    this.scene = scene;
    if (!scene.textures.exists('yellow-battery')) addCanvasTexture(scene, 'yellow-battery', drawYellowBattery());
    this.items = [];
  }

  /** spots: [{ x, y, taken }] in metres. */
  set(world, spots) {
    for (const it of this.items) it.img.destroy();
    this.items = spots.map((s) => {
      const img = this.scene.add.image(0, 0, 'yellow-battery');
      img.noAmbient = true; // easy to see at night
      return { spot: s, img, base: toScreen(s.x, s.y, world.heightAt(s.x, s.y)) };
    });
  }

  update(time) {
    for (const it of this.items) {
      it.img.setVisible(!it.spot.taken);
      if (it.spot.taken) continue;
      const bob = Math.round(Math.sin(time / 260 + it.spot.id) * 1.5) - 2;
      placeOnPixels(it.img, { x: it.base.x, y: it.base.y + bob }, C.groundX, C.groundY).setDepth((it.spot.x + it.spot.y) / WORLD.tileMetres + 0.5);
    }
  }
}
