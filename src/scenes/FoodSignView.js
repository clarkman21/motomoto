import { WORLD } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawFoodSign } from '../world/food-signs.js';
import { addCanvasTexture, placeOnPixels } from './textures.js';

// The food signs over the food stops (medium and hard modes, where the rider must eat): the buffets,
// the Inyange milk bars, the banana sellers and the drinks at the MTN MoMo kiosks (world/food-signs.js).

const T = WORLD.tileMetres;
const SIDE = 1.2; // metres beside the stop, so that the sign does not stand on the vendor

export class FoodSignView {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.imgs = [];
  }

  /** Show the signs of these stops (none: no signs, for example in easy mode). */
  set(stops) {
    for (const img of this.imgs) img.destroy();
    this.imgs = [];
    for (const s of stops) {
      const key = `food-sign-${s.food}`;
      if (!this.scene.textures.exists(key)) {
        const sign = drawFoodSign(s.food);
        addCanvasTexture(this.scene, key, sign.canvas);
        this.scene.textures.get(key).customData = { groundX: sign.groundX, groundY: sign.groundY };
      }
      const { groundX, groundY } = this.scene.textures.get(key).customData;
      const x = s.x + SIDE, y = s.y - SIDE;
      const p = toScreen(x, y, this.world.heightAt(x, y));
      this.imgs.push(placeOnPixels(this.scene.add.image(0, 0, key), p, groundX, groundY).setDepth((x + y) / T + 0.2));
    }
  }
}
