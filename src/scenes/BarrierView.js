import { WORLD } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawBarrier } from '../world/sprites.js';
import { addCanvasTexture } from './textures.js';

// Barriers on the edge of the closed districts: a road barrier across each road, and a low fence
// between the roads. They move when a new district opens.

const ROAD_SURFACES = ['tarmac', 'cobble', 'murram', 'murramWet'];

export class BarrierView {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.sprites = [];
    for (const axis of ['x', 'y']) {
      for (const road of [true, false]) {
        const key = `barrier-${axis}-${road ? 'road' : 'fence'}`;
        if (!scene.textures.exists(key)) addCanvasTexture(scene, key, drawBarrier(axis, road));
      }
    }
  }

  /** Put barriers on every open tile next to a closed district. */
  update() {
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
    const w = this.world;
    const T = WORLD.tileMetres;
    for (const t of w.tiles) {
      if (w.isClosedTile(t) || t.block || t.solid) continue;
      for (const [dx, dy, axis] of [[1, 0, 'x'], [-1, 0, 'x'], [0, 1, 'y'], [0, -1, 'y']]) {
        const n = w.tile(t.tx + dx, t.ty + dy);
        if (!n || !w.isClosedTile(n)) continue;
        const road = ROAD_SURFACES.includes(t.surface);
        const z = w.heightAt((t.tx + 0.5) * T, (t.ty + 0.5) * T);
        const s = toScreen(t.tx * T, t.ty * T, z);
        const img = this.scene.add.image(s.x - 34, s.y - 16, `barrier-${axis}-${road ? 'road' : 'fence'}`).setOrigin(0).setDepth(t.tx + t.ty + 1);
        this.sprites.push(img);
        break;
      }
    }
  }

  /** The closed district a point is in, or null (for the "opens at level N" message). */
  closedDistrictAt(x, y) {
    const t = this.world.tileAt(x, y);
    return t && this.world.isClosedTile(t) ? t.district : null;
  }
}
