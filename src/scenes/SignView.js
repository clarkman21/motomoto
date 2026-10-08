import { WORLD, COLLISION } from '../config.js';
import { BUILDING_STYLES } from '../world/world.js';
import { toScreen } from '../world/iso.js';
import { drawBuildingSign, drawFuelSign } from '../world/garage-sprites.js';
import { FUEL_BRAND, drawBike, BIKE_CANVAS } from '../world/sprites.js';
import { addCanvasTexture, placeOnPixels } from './textures.js';
import { groupKey } from './chunks.js';

// The names on landmark buildings: big letters on the roof of a tower (lit at night), and a
// blue board on the front wall of a government office, a school or a market.
// The signs stand on whole pixels (like the buildings), so they do not move against the
// buildings when the camera moves, and they fade with their building (see fade).

export class SignView {
  constructor(scene, world) {
    const T = WORLD.tileMetres, L = WORLD.levelMetres;
    this.items = []; // { img, keys: the building keys (groupKey) that the sign is on }
    this.#fuelSigns(scene, world);
    for (const lm of world.landmarks) {
      if (!lm.sign) continue;
      if (lm.brand) this.#showroomMoto(scene, world, lm);
      const blocks = world.blocks.filter((b) => b.tx >= lm.x0 && b.tx <= lm.x1 && b.ty >= lm.y0 && b.ty <= lm.y1);
      if (!blocks.length) continue;
      const top = Math.max(...blocks.map((b) => b.topLevel));
      const roof = BUILDING_STYLES[lm.style] === 'tower' || BUILDING_STYLES[lm.style] === 'hotel'; // towers and hotels: the name on the roof
      const sign = drawBuildingSign(lm.sign, lm.sign2 ?? '', roof ? 'roof' : lm.brand ? 'brand' : 'wall');
      const key = `sign-${lm.x0}-${lm.y0}`;
      if (!scene.textures.exists(key)) addCanvasTexture(scene, key, sign.canvas);
      // A tower: on the roof near the front edge. Others: on the front (south) wall, under the roof edge.
      const wx = ((lm.x0 + lm.x1 + 1) / 2) * T;
      const wy = roof ? (lm.y1 + 0.8) * T : (lm.y1 + 1) * T;
      const z = (roof ? top : top - 0.3) * L;
      const p = toScreen(wx, wy, z);
      const img = placeOnPixels(scene.add.image(0, 0, key), p, sign.groundX, sign.groundY)
        .setDepth(roof ? lm.x1 + lm.y1 + 2.2 : (lm.x0 + lm.x1 + 1) / 2 + lm.y1 + 1.6);
      const keys = new Set(blocks.map(groupKey));
      this.items.push({ img, keys });
      if (roof) {
        img.noAmbient = true; // the tower names shine at night (you see them from far away)
        // The roof is far up: a second sign over the entrance, so you can read the name near the tower.
        const door = drawBuildingSign(lm.sign, lm.sign2 ?? '', 'wall');
        const doorKey = `${key}-door`;
        if (!scene.textures.exists(doorKey)) addCanvasTexture(scene, doorKey, door.canvas);
        const base = Math.min(...blocks.map((b) => b.floorLevel ?? b.baseLevel));
        const q = toScreen(wx, (lm.y1 + 1) * T, (base + 2.6) * L);
        const doorImg = placeOnPixels(scene.add.image(0, 0, doorKey), q, door.groundX, door.groundY)
          .setDepth((lm.x0 + lm.x1 + 1) / 2 + lm.y1 + 1.6);
        this.items.push({ img: doorImg, keys });
      }
    }
  }

  /** A new Ampersand electric moto on show in front of the showroom (you can bump into it). */
  #showroomMoto(scene, world, lm) {
    const T = WORLD.tileMetres;
    if (!scene.textures.exists('showroom-moto')) addCanvasTexture(scene, 'showroom-moto', drawBike('electric', 2, 'none', false));
    const x = (lm.x0 + 4.5) * T, y = (lm.y1 + 1.45) * T;
    const p = toScreen(x, y, world.heightAt(x, y));
    placeOnPixels(scene.add.image(0, 0, 'showroom-moto'), p, BIKE_CANVAS.groundX, BIKE_CANVAS.groundY).setDepth((x + y) / T);
    world.poles.push({ kind: 'pole', x, y, radius: COLLISION.bikeRadius + 0.2 });
  }

  /** The SP price sign at the corner of each fuel station (the tile at the far end of the pumps). */
  #fuelSigns(scene, world) {
    const T = WORLD.tileMetres;
    if (!scene.textures.exists('fuel-sign')) addCanvasTexture(scene, 'fuel-sign', drawFuelSign(FUEL_BRAND).canvas);
    const sign = drawFuelSign(FUEL_BRAND);
    const isFuel = (x, y) => world.blockAt(x, y)?.kind === 'fuel';
    for (const b of world.blocks) {
      if (b.kind !== 'fuel' || isFuel(b.tx + 1, b.ty) || isFuel(b.tx, b.ty + 1)) continue; // the pump tile, not the shop
      const x = (b.tx + 0.91) * T, y = (b.ty + 0.89) * T;
      const p = toScreen(x, y, world.heightAt(x, y));
      const img = placeOnPixels(scene.add.image(0, 0, 'fuel-sign'), p, sign.groundX, sign.groundY).setDepth((x + y) / T + 0.05);
      img.noAmbient = true; // the sign is lit at night
    }
  }

  /** The building of a sign fades when it hides the bike: the sign fades too. hiding: a Set of building keys. */
  fade(hiding) {
    for (const { img, keys } of this.items) {
      let hidden = false;
      for (const k of keys) if (hiding.has(k)) { hidden = true; break; }
      img.setAlpha(hidden ? 0.45 : 1);
    }
  }
}
