import { WORLD, COLLISION } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawBike, BIKE_CANVAS, BIKE_DIRECTIONS } from '../world/sprites.js';
import {
  drawGarageSign, drawMechanic, MECHANIC_CANVAS, drawOilStain, drawTyres, drawOilDrum, SMALL_PROP,
} from '../world/garage-sprites.js';
import { hash2 } from '../world/pixel-canvas.js';
import { addCanvasTexture } from './textures.js';

// The yard of each moto garage: the name sign, motos that wait for repair, mechanics at work,
// tyres, an oil drum and black oil stains on the ground. It is not a clean place.

const T = WORLD.tileMetres;
const PARKED = ['parkedRed', 'parkedBlue', 'parkedBlack'];
const YARD_SURFACES = ['grass', 'pavement'];

export class GarageView {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mechanics = [];
    this.#makeTextures();
    for (const place of world.placesWithTag('garage')) this.#yard(place);
  }

  #makeTextures() {
    const scene = this.scene;
    if (scene.textures.exists('mechanic-0-0')) return;
    for (const type of PARKED) {
      for (let f = 0; f < BIKE_DIRECTIONS; f += 3) addCanvasTexture(scene, `parked-${type}-${f}`, drawBike(type, f, 'none', false));
    }
    for (const flip of [0, 1]) for (const frame of [0, 1]) addCanvasTexture(scene, `mechanic-${flip}-${frame}`, drawMechanic(frame, !!flip));
    for (let i = 0; i < 3; i++) addCanvasTexture(scene, `oil-stain-${i}`, drawOilStain(i * 2.1));
    addCanvasTexture(scene, 'tyres', drawTyres());
    addCanvasTexture(scene, 'oil-drum', drawOilDrum());
  }

  #yard(place) {
    const w = this.world, scene = this.scene;
    const blocks = w.blocks.filter((b) => b.kind === 'garage' && Math.abs(b.tx + 0.5 - place.x) < 3 && Math.abs(b.ty + 0.5 - place.y) < 3);
    if (!blocks.length) return;
    // Free tiles around the workshop (grass or pavement, not the road).
    const yard = [];
    const seen = new Set(blocks.map((b) => `${b.tx},${b.ty}`));
    for (const b of blocks) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const t = w.tile(b.tx + dx, b.ty + dy);
        const key = `${b.tx + dx},${b.ty + dy}`;
        if (!t || seen.has(key) || t.block || t.solid || !YARD_SURFACES.includes(t.surface)) continue;
        seen.add(key);
        yard.push(t);
      }
    }
    // The tile nearest to the road side (the place) gets the sign; the others hold motos and junk.
    yard.sort((a, b) => Math.hypot(a.tx + 0.5 - place.x, a.ty + 0.5 - place.y) - Math.hypot(b.tx + 0.5 - place.x, b.ty + 0.5 - place.y));
    const sprite = (key, x, y, ox, oy, depthBias = 0) => {
      const s = toScreen(x, y, w.heightAt(x, y));
      return scene.add.image(s.x, s.y, key).setOrigin(ox, oy).setDepth((x + y) / T + depthBias);
    };
    const [signTile, ...rest] = yard;
    if (signTile) {
      const key = `garage-sign-${place.id}`;
      const sign = drawGarageSign(place.sign ?? 'MOTO GARAGE', 'MOTO GARAGE');
      if (!scene.textures.exists(key)) addCanvasTexture(scene, key, sign.canvas);
      sprite(key, (signTile.tx + 0.5) * T, (signTile.ty + 0.5) * T, sign.groundX / sign.canvas.width, sign.groundY / sign.canvas.height, 0.2);
    }
    // Black oil stains everywhere: on the yard, on the workshop floor edge and on the road in front.
    const spots = [...rest, ...blocks.map((b) => w.tile(b.tx, b.ty))];
    spots.forEach((t, i) => {
      for (let k = 0; k < 2; k++) {
        const x = (t.tx + 0.2 + 0.6 * hash2(t.tx, t.ty, 50 + k)) * T, y = (t.ty + 0.2 + 0.6 * hash2(t.ty, t.tx, 60 + k)) * T;
        const s = toScreen(x, y, w.heightAt(x, y));
        scene.add.image(s.x, s.y, `oil-stain-${(i + k) % 3}`).setDepth(-9500);
      }
    });
    const ps = toScreen(place.x * T, place.y * T, w.heightAt(place.x * T, place.y * T));
    scene.add.image(ps.x, ps.y, 'oil-stain-1').setDepth(-9500);
    // Motos that wait for repair, each with a mechanic at work beside it.
    rest.slice(0, 3).forEach((t, i) => {
      const x = (t.tx + 0.5) * T, y = (t.ty + 0.5) * T;
      const f = (Math.floor(hash2(t.tx, t.ty, 70) * 6) * 3) % BIKE_DIRECTIONS;
      sprite(`parked-${PARKED[i % PARKED.length]}-${f}`, x, y, BIKE_CANVAS.groundX / BIKE_CANVAS.width, BIKE_CANVAS.groundY / BIKE_CANVAS.height);
      w.poles.push({ kind: 'pole', x, y, radius: COLLISION.bikeRadius + 0.2 }); // you can bump into a parked moto
      if (i < 2) {
        const mx = x + 1.1, my = y - 0.4;
        const img = sprite(`mechanic-${i % 2}-0`, mx, my, MECHANIC_CANVAS.groundX / MECHANIC_CANVAS.width, MECHANIC_CANVAS.groundY / MECHANIC_CANVAS.height, 0.01);
        this.mechanics.push({ img, flip: i % 2, phase: i * 0.37 });
        w.poles.push({ kind: 'pole', x: mx, y: my, radius: 0.3 });
      }
    });
    // Old tyres and an oil drum.
    const junk = rest[3] ?? rest[rest.length - 1];
    if (junk) {
      sprite('tyres', (junk.tx + 0.3) * T, (junk.ty + 0.35) * T, SMALL_PROP.groundX / SMALL_PROP.width, SMALL_PROP.groundY / SMALL_PROP.height);
      sprite('oil-drum', (junk.tx + 0.7) * T, (junk.ty + 0.7) * T, SMALL_PROP.groundX / SMALL_PROP.width, SMALL_PROP.groundY / SMALL_PROP.height);
    }
  }

  /** The mechanics hammer and turn their spanners. */
  update(time) {
    for (const m of this.mechanics) m.img.setTexture(`mechanic-${m.flip}-${Math.floor(time / 280 + m.phase * 3) % 2}`);
  }
}
