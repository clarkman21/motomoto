import { WORLD, MARKET } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawVendor, drawGoat, drawSheep, VENDOR_CANVAS, ANIMAL_CANVAS, GOAT_COATS } from '../world/market-sprites.js';
import { marketSpots } from '../world/market.js';
import { addCanvasTexture } from './textures.js';

// Market life: mamas in kitenge who sell goods on mats (some under umbrellas), and goats and
// sheep tied up for sale. They stand in the markets and on some pavements near them.
// They are solid: you can bump into them.

const T = WORLD.tileMetres;

export class MarketView {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.anims = [];
    this.#makeTextures();
    for (const spot of marketSpots(world)) this.#add(spot);
  }

  #makeTextures() {
    const scene = this.scene;
    if (scene.textures.exists('goat-0-0')) return;
    for (let coat = 0; coat < GOAT_COATS.length; coat++) for (const f of [0, 1]) addCanvasTexture(scene, `goat-${coat}-${f}`, drawGoat(coat, f));
    for (const f of [0, 1]) addCanvasTexture(scene, `sheep-${f}`, drawSheep(f));
  }

  #add(spot) {
    const { x, y } = spot;
    const s = toScreen(x, y, this.world.heightAt(x, y));
    const C = spot.kind === 'vendor' ? VENDOR_CANVAS : ANIMAL_CANVAS;
    const key = (f) => (spot.kind === 'vendor' ? `vendor-${spot.goods}-${spot.kitenge}-${f}-${spot.umbrella ? 'u' : 'n'}` : spot.kind === 'goat' ? `goat-${spot.coat}-${f}` : `sheep-${f}`);
    if (spot.kind === 'vendor' && !this.scene.textures.exists(key(0))) {
      // Make vendor textures only for the looks that the map uses.
      const seed = spot.kitenge + spot.goods.length;
      for (const f of [0, 1]) addCanvasTexture(this.scene, key(f), drawVendor(spot.goods, spot.kitenge, f, spot.umbrella ? seed % 3 : null, seed));
    }
    const img = this.scene.add.image(s.x, s.y, key(0)).setOrigin(C.groundX / C.width, C.groundY / C.height)
      .setDepth((x + y) / T).setFlipX(spot.flip);
    this.anims.push({ img, key, phase: spot.phase, period: spot.kind === 'vendor' ? 900 : 1300 });
    this.world.poles.push({ kind: 'pole', x, y, radius: spot.kind === 'vendor' ? MARKET.vendorRadius : MARKET.animalRadius });
  }

  /** Vendors call to customers now and then; goats and sheep lift and lower their heads. */
  update(time) {
    for (const a of this.anims) {
      const f = (time / a.period + a.phase) % 4 < 1 ? 1 : 0;
      if (f !== a.frame) a.img.setTexture(a.key(f));
      a.frame = f;
    }
  }
}
