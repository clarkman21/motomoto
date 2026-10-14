import { WORLD } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawCabinet } from '../world/cabinet-sprites.js';
import { addCanvasTexture, placeOnPixels } from './textures.js';

// The Ampersand swap cabinets beside some fuel stations (world/cabinet-sprites.js). While you swap at a
// cabinet, its doors are open and two batteries come out.

const T = WORLD.tileMetres;

export class CabinetView {
  constructor(scene, world) {
    this.scene = scene;
    this.imgs = new Map(); // place -> image
    for (const state of ['closed', 'open']) {
      const key = `swap-cabinet-${state}`;
      if (scene.textures.exists(key)) continue;
      const r = drawCabinet(state);
      addCanvasTexture(scene, key, r.canvas);
      scene.textures.get(key).customData = { groundX: r.groundX, groundY: r.groundY };
    }
    for (const p of world.placesWithTag('swap')) {
      if (!p.cabinet) continue;
      const { groundX, groundY } = scene.textures.get('swap-cabinet-closed').customData;
      const x = p.cabinet.x * T, y = p.cabinet.y * T;
      const img = placeOnPixels(scene.add.image(0, 0, 'swap-cabinet-closed'), toScreen(x, y, world.heightAt(x, y)), groundX, groundY);
      this.imgs.set(p, img.setDepth((x + y) / T + 0.3));
    }
  }

  /** Open the doors of the cabinet where you swap now; close the others. */
  update(ride) {
    const at = ride.refuel?.kind === 'swap' ? ride.stationPlace : null;
    for (const [p, img] of this.imgs) {
      const key = p === at ? 'swap-cabinet-open' : 'swap-cabinet-closed';
      if (img.texture.key !== key) img.setTexture(key);
    }
  }
}
