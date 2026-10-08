import { WORLD, COLLISION, CITY_ANIM } from '../config.js';
import { BUILDING_STYLES } from '../world/world.js';
import { toScreen } from '../world/iso.js';
import { drawBuildingSign, drawFuelSign } from '../world/garage-sprites.js';
import { FUEL_BRAND, drawBike, BIKE_CANVAS, flagSpots, drawFlagCloth, fountainSpots, drawFountainSpray, SPRAY } from '../world/sprites.js';
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
    this.#flags(scene, world);
    this.#fountains(scene, world);
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

  /** The flag cloths on the poles of government buildings, ministries and the US Embassy. They wave. */
  #flags(scene, world) {
    const T = WORLD.tileMetres, L = WORLD.levelMetres;
    this.flags = [];
    for (const kind of ['rw', 'us']) for (let f = 0; f < CITY_ANIM.flagFrames; f++) {
      const key = `flag-${kind}-${f}`;
      if (!scene.textures.exists(key)) addCanvasTexture(scene, key, drawFlagCloth(kind, f, CITY_ANIM.flagFrames));
    }
    for (const spot of flagSpots(world)) {
      const p = toScreen(spot.x * T, spot.y * T, spot.z * L);
      const img = placeOnPixels(scene.add.image(0, 0, `flag-${spot.kind}-0`), p, -1, 2).setDepth(spot.block.tx + spot.block.ty + 1.3);
      const offset = Math.floor((spot.x * 7 + spot.y * 3) % CITY_ANIM.flagFrames); // flags do not all move together
      this.flags.push({ img, kind: spot.kind, offset });
      this.items.push({ img, keys: new Set([groupKey(spot.block)]) });
    }
  }

  /** The spray of the MTN fountain: only now and then (Alp). */
  #fountains(scene, world) {
    const T = WORLD.tileMetres, L = WORLD.levelMetres;
    this.sprays = [];
    for (let f = 0; f < CITY_ANIM.sprayFrames; f++) {
      const key = `spray-${f}`;
      if (!scene.textures.exists(key)) addCanvasTexture(scene, key, drawFountainSpray(f, CITY_ANIM.sprayFrames));
    }
    for (const spot of fountainSpots(world)) {
      const p = toScreen(spot.x * T, spot.y * T, spot.z * L);
      const img = placeOnPixels(scene.add.image(0, 0, 'spray-0'), p, SPRAY.groundX, SPRAY.groundY)
        .setDepth(spot.block.tx + spot.block.ty + 1.2).setVisible(false);
      this.sprays.push(img);
    }
  }

  /** Call each frame (time in ms): the flags wave, and the fountain sprays now and then. */
  update(time) {
    const f = Math.floor(time / CITY_ANIM.flagFrameMs);
    for (const fl of this.flags) fl.img.setTexture(`flag-${fl.kind}-${(f + fl.offset) % CITY_ANIM.flagFrames}`);
    const t = (time / 1000) % CITY_ANIM.sprayEverySeconds;
    const on = t >= CITY_ANIM.sprayEverySeconds - CITY_ANIM.sprayForSeconds; // at the end of each cycle
    const sf = Math.floor(time / CITY_ANIM.sprayFrameMs) % CITY_ANIM.sprayFrames;
    for (const img of this.sprays) img.setVisible(on).setTexture(`spray-${sf}`);
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
