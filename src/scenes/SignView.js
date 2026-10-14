import { WORLD, COLLISION, CITY_ANIM } from '../config.js';
import { hash2 } from '../world/pixel-canvas.js';
import { BUILDING_STYLES } from '../world/world.js';
import { toScreen } from '../world/iso.js';
import { drawWallSign, drawFuelSign } from '../world/garage-sprites.js';
import { FUEL_BRAND, flagSpots, drawFlagCloth, fountainSpots, drawFountainSpray, SPRAY } from '../world/sprites.js';
import { addCanvasTexture, placeOnPixels } from './textures.js';
import { groupKey } from './chunks.js';
import { shopSignArt, drawMannequin, drawMural, drawPorch, shearOnWall, MANNEQUIN_CANVAS } from '../world/shops.js';
import { SHOPS } from '../config.js';

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
      const blocks = world.blocks.filter((b) => b.tx >= lm.x0 && b.tx <= lm.x1 && b.ty >= lm.y0 && b.ty <= lm.y1);
      if (!blocks.length) continue;
      const top = Math.max(...blocks.map((b) => b.topLevel));
      const roof = BUILDING_STYLES[lm.style] === 'tower' || BUILDING_STYLES[lm.style] === 'hotel'; // towers and hotels: the big name high up
      // All the signs lie flat on the front (south) wall, sheared to the wall (Alp, 14 October 2026).
      const wallPx = (lm.x1 - lm.x0 + 1) * T * 8; // a tile face is 32 screen pixels wide
      const sign = drawWallSign(lm.sign, lm.sign2 ?? '', roof ? 'roof' : lm.brand ? 'brand' : 'wall', 'south', wallPx - 8);
      const key = `sign-${lm.x0}-${lm.y0}`;
      if (!scene.textures.exists(key)) addCanvasTexture(scene, key, sign.canvas);
      // The middle of the front wall; the top of the board stays a little under the roof edge.
      const wx = ((lm.x0 + lm.x1 + 1) / 2) * T, wy = (lm.y1 + 1) * T;
      const boardLevels = sign.boardHeight / WORLD.levelPx;
      const z = (top - 0.25 - boardLevels) * L;
      const keys = new Set(blocks.map(groupKey));
      const imgs = this.#onWall(scene, key, sign, lm, toScreen(wx, wy, z), keys);
      if (roof) {
        for (const img of imgs) img.noAmbient = true; // the tower names shine at night (you see them from far away)
        // The name is far up: a second sign over the entrance, so you can read the name near the tower.
        const door = drawWallSign(lm.sign, lm.sign2 ?? '', 'wall', 'south', wallPx - 8);
        const doorKey = `${key}-door`;
        if (!scene.textures.exists(doorKey)) addCanvasTexture(scene, doorKey, door.canvas);
        const base = Math.min(...blocks.map((b) => b.floorLevel ?? b.baseLevel));
        this.#onWall(scene, doorKey, door, lm, toScreen(wx, wy, (base + 1.4) * L), keys);
      }
    }
  }

  /**
   * A sign on the front (south) wall of a landmark: one image slice for each tile of the wall, each with the
   * depth of its tile, so that no part of the sign goes under the building (the blocks sort by tile).
   */
  #onWall(scene, key, sign, lm, p, keys) {
    const T = WORLD.tileMetres, tilePx = T * 8; // a tile face is 32 screen pixels wide
    const x0 = Math.round(p.x - sign.groundX), y0 = Math.round(p.y - sign.groundY);
    const wallLeft = toScreen(lm.x0 * T, (lm.y1 + 1) * T).x;
    const imgs = [];
    for (let tx = lm.x0; tx <= lm.x1; tx++) {
      const from = Math.max(0, Math.round(wallLeft + (tx - lm.x0) * tilePx) - x0);
      const to = tx === lm.x1 ? sign.canvas.width : Math.min(sign.canvas.width, Math.round(wallLeft + (tx + 1 - lm.x0) * tilePx) - x0);
      const left = tx === lm.x0 ? 0 : from;
      if (to <= left) continue;
      const img = scene.add.image(x0, y0, key).setOrigin(0).setCrop(left, 0, to - left, sign.canvas.height).setDepth(tx + lm.y1 + 1.6);
      this.items.push({ img, keys });
      imgs.push(img);
    }
    return imgs;
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

  /**
   * Shops and street life (world/shops.js): a painted sign with a picture over each shop front, and
   * mannequins in front of each boutique. The signs fade with their building.
   */
  addShopSigns(scene, world, shops) {
    const T = WORLD.tileMetres, L = WORLD.levelMetres;
    const dresses = [0x8a3a8a, 0xc0392b, 0x2f6fb0, 0x3f8f4a];
    for (const s of shops) {
      const key = `shopsign-${s.id}`;
      // Design review (13 October 2026): painted on the wall when it fits, else a board on legs.
      const art = shopSignArt(s);
      if (!scene.textures.exists(key)) addCanvasTexture(scene, key, art.canvas);
      let p, depth;
      if (art.mount === 'wall') {
        p = toScreen(s.wallMid.x, s.wallMid.y, (s.floor + SHOPS.wallSignLevel) * L);
        depth = s.sign.face === 'south' ? (s.x0 + s.x1 + 1) / 2 + s.y1 + 1.6 : s.x1 + 1 + (s.y0 + s.y1 + 1) / 2 + 0.6;
      } else {
        const out = SHOPS.boardOutMetres;
        const x = s.sign.x + (s.sign.face === 'east' ? out : 0), y = s.sign.y + (s.sign.face === 'south' ? out : 0);
        p = toScreen(x, y, world.heightAt(x, y));
        depth = (x + y) / T + 0.05;
      }
      const img = placeOnPixels(scene.add.image(0, 0, key), p, art.groundX, art.groundY).setDepth(depth);
      const keys = new Set(world.blocks.filter((b) => b.groupId === s.groupId).map(groupKey));
      this.items.push({ img, keys });
      // Alp's design canvas: a hand-painted picture of what the shop sells on the side wall, and a small
      // iron-sheet porch on two poles over the shop front.
      const wallDepth = (face) => (face === 'south' ? (s.x0 + s.x1 + 1) / 2 + s.y1 + 1.6 : s.x1 + 1 + (s.y0 + s.y1 + 1) / 2 + 0.6);
      if (s.muralFace) {
        const mk = `mural-${s.kind}-${s.muralFace}`;
        const art = shearOnWall(drawMural(s.kind), s.muralFace);
        if (!scene.textures.exists(mk)) addCanvasTexture(scene, mk, art.canvas);
        const q = toScreen(s.muralMid.x, s.muralMid.y, (s.floor + SHOPS.muralLevel) * L);
        this.items.push({ img: placeOnPixels(scene.add.image(0, 0, mk), q, art.groundX, art.groundY).setDepth(wallDepth(s.muralFace)), keys });
      }
      const face = s.sign.face, len = s.wallTiles * T;
      const rust = hash2(s.x0, s.y0, 913) < 0.35;
      const pk = `porch-${face}-${s.wallTiles}-${rust ? 1 : 0}`;
      const porch = drawPorch(face, len, SHOPS.porchLevel, rust);
      if (!scene.textures.exists(pk)) addCanvasTexture(scene, pk, porch.canvas);
      const a = face === 'south' ? { x: s.x0 * T, y: (s.y1 + 1) * T } : { x: (s.x1 + 1) * T, y: s.y0 * T };
      const porchDepth = face === 'south' ? (s.x0 + s.x1 + 1) / 2 + s.y1 + 1.3 : s.x1 + 1.3 + (s.y0 + s.y1 + 1) / 2;
      this.items.push({ img: placeOnPixels(scene.add.image(0, 0, pk), toScreen(a.x, a.y, (s.floor + SHOPS.porchLevel) * L), porch.groundX, porch.groundY).setDepth(porchDepth), keys });
      if (s.kind !== 'boutique') continue;
      // Mannequins out in front, with strange proportions (Alp).
      for (let i = 0; i < SHOPS.mannequins; i++) {
        const v = i % 2, mk = `mannequin-${v}-${i}`;
        if (!scene.textures.exists(mk)) addCanvasTexture(scene, mk, drawMannequin(v, dresses[i % dresses.length]));
        const side = (i - (SHOPS.mannequins - 1) / 2) * 1.2;
        const x = s.sign.face === 'south' ? s.front.x * T + side : (s.front.x - 0.3) * T;
        const y = s.sign.face === 'south' ? (s.front.y - 0.3) * T : s.front.y * T + side;
        const q = toScreen(x, y, world.heightAt(x, y));
        placeOnPixels(scene.add.image(0, 0, mk), q, MANNEQUIN_CANVAS.groundX, MANNEQUIN_CANVAS.groundY).setDepth((x + y) / T);
        world.poles.push({ kind: 'pole', x, y, radius: COLLISION.poleRadius });
      }
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

  /** The building of a sign fades when it hides the bike or the road: the sign fades too. fade: building key -> alpha. */
  fade(fade) {
    for (const { img, keys } of this.items) {
      let alpha = 1;
      for (const k of keys) alpha = Math.min(alpha, fade.get(k) ?? 1);
      img.setAlpha(alpha);
    }
  }
}
