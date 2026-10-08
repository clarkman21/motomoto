import { WORLD } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawAttendant, ATTENDANT_FRAMES } from '../world/attendant-sprites.js';
import { PERSON_CANVAS } from '../world/vehicle-sprites.js';
import { addCanvasTexture } from './textures.js';

// A station attendant who comes out to help when you fill up (SP fuel) or swap the battery
// (Ampersand). The attendant walks from the station to your bike, works beside it, and walks
// back when the job is done.

const T = WORLD.tileMetres;
const WALK = 1.6; // metres a second
const SIDE = 0.9; // metres beside the bike

export class AttendantView {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    for (const kind of ['fuel', 'swap']) {
      for (const f of ATTENDANT_FRAMES) {
        const key = `attendant-${kind}-${f}`;
        if (!scene.textures.exists(key)) addCanvasTexture(scene, key, drawAttendant(kind, f));
        if (!scene.textures.exists(`${key}-L`)) addCanvasTexture(scene, `${key}-L`, drawAttendant(kind, f, true));
      }
    }
    const w = PERSON_CANVAS.width + 6;
    this.img = scene.add.image(0, 0, 'attendant-fuel-walk0').setOrigin(PERSON_CANVAS.groundX / w, PERSON_CANVAS.groundY / PERSON_CANVAS.height).setVisible(false);
    this.state = null; // null, 'out', 'work', 'back'
  }

  /** Where the attendant comes from: the middle of the station tile nearest to the place. */
  #home(place, kind) {
    let best = null, bestD = Infinity;
    for (const b of this.world.blocks) {
      if (b.kind !== kind) continue;
      const d = Math.hypot(b.tx + 0.5 - place.x, b.ty + 0.5 - place.y);
      if (d < bestD) { best = b; bestD = d; }
    }
    if (!best) return { x: place.x * T, y: place.y * T };
    // The edge of the station tile on the side of the place.
    const cx = (best.tx + 0.5) * T, cy = (best.ty + 0.5) * T;
    const dx = place.x * T - cx, dy = place.y * T - cy, d = Math.hypot(dx, dy) || 1;
    return { x: cx + (dx / d) * T * 0.55, y: cy + (dy / d) * T * 0.55 };
  }

  update(ride, dt, time) {
    const r = ride.refuel;
    const kind = r && (r.kind === 'fuel' || r.kind === 'swap') ? r.kind : null;
    if (kind && !this.state) {
      // A new fill up or swap: the attendant comes out.
      const place = ride.stationPlace;
      if (!place) return;
      this.kind = kind;
      this.home = this.#home(place, kind);
      this.pos = { ...this.home };
      this.state = 'out';
    }
    if (!this.state) return;
    if (!kind && this.state !== 'back') this.state = 'back';
    const b = ride.bike;
    // Beside the bike, on the side of the station.
    const nx = -Math.sin(b.heading), ny = Math.cos(b.heading);
    const side = (this.home.x - b.x) * nx + (this.home.y - b.y) * ny >= 0 ? 1 : -1;
    const target = this.state === 'back' ? this.home : { x: b.x + nx * SIDE * side, y: b.y + ny * SIDE * side };
    const dx = target.x - this.pos.x, dy = target.y - this.pos.y, d = Math.hypot(dx, dy);
    const stepM = WALK * dt;
    let frame = 'work';
    if (d > 0.05) {
      const k = Math.min(1, stepM / d);
      this.pos.x += dx * k;
      this.pos.y += dy * k;
      frame = Math.floor(time / 180) % 2 ? 'walk1' : 'walk0';
      this.facing = dx - dy; // screen x direction of the walk
    } else if (this.state === 'out') {
      this.state = 'work';
    } else if (this.state === 'back') {
      this.state = null;
      this.img.setVisible(false);
      return;
    }
    if (this.state === 'work') {
      frame = 'work';
      this.facing = (b.x - this.pos.x) - (b.y - this.pos.y); // look at the bike
    }
    const s = toScreen(this.pos.x, this.pos.y, this.world.heightAt(this.pos.x, this.pos.y));
    this.img.setTexture(`attendant-${this.kind}-${frame}${(this.facing ?? 1) < 0 ? '-L' : ''}`).setVisible(true).setPosition(s.x, s.y)
      .setDepth((this.pos.x + this.pos.y) / T + 0.01);
  }
}
