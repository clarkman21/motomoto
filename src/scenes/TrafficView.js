import { WORLD, TRAFFIC } from '../config.js';
import { toScreen } from '../world/iso.js';
import { bikeFrameForHeading, BIKE_DIRECTIONS, BIKE_CANVAS } from '../world/sprites.js';
import { drawVehicle, drawRivalMoto, VEHICLE_CANVAS, VEHICLE_VARIANTS } from '../world/vehicle-sprites.js';
import { packShelves } from './chunks.js';

// Draws the traffic: one sprite and one shadow per vehicle, all frames in one atlas.

export class TrafficView {
  constructor(scene, traffic) {
    this.scene = scene;
    this.traffic = traffic;
    this.#buildAtlas();
    this.sprites = new Map();
    for (const v of traffic.vehicles) {
      const shadow = scene.add.image(0, 0, 'shadow').setAlpha(0.9);
      const moto = v.kind === 'moto';
      const c = moto ? BIKE_CANVAS : VEHICLE_CANVAS;
      const img = scene.add.image(0, 0, 'vehicles', this.#frame(v)).setOrigin(c.groundX / c.width, c.groundY / c.height);
      // Shadow size from the vehicle size (the shadow texture is 24 × 12 px).
      shadow.setScale(moto ? 0.9 : v.length / 3.2, moto ? 0.9 : v.width / 1.5);
      this.sprites.set(v.id, { img, shadow });
    }
  }

  #frame(v) {
    const f = bikeFrameForHeading(v.heading);
    if (v.kind === 'moto') return `moto-${v.loaded ? 'passenger' : 'none'}-${f}`;
    return `${v.kind}-${v.variant}-${f}`;
  }

  #buildAtlas() {
    if (this.scene.textures.exists('vehicles')) return;
    const frames = [];
    for (const kind of ['car', 'bus', 'truck']) {
      for (let variant = 0; variant < VEHICLE_VARIANTS[kind].length; variant++) {
        for (let f = 0; f < BIKE_DIRECTIONS; f++) frames.push({ name: `${kind}-${variant}-${f}`, canvas: drawVehicle(kind, variant, f) });
      }
    }
    for (const load of ['none', 'passenger']) {
      for (let f = 0; f < BIKE_DIRECTIONS; f++) frames.push({ name: `moto-${load}-${f}`, canvas: drawRivalMoto(f, load) });
    }
    const { width, height, places } = packShelves(frames.map((fr) => fr.canvas));
    const tex = this.scene.textures.createCanvas('vehicles', width, height);
    frames.forEach((fr, i) => {
      tex.context.putImageData(new ImageData(fr.canvas.data, fr.canvas.width, fr.canvas.height), places[i].x, places[i].y);
      tex.add(fr.name, 0, places[i].x, places[i].y, fr.canvas.width, fr.canvas.height);
    });
    tex.refresh();
  }

  /** Place all sprites. Only vehicles inside the camera view are shown. */
  update(world, view) {
    const m = 80;
    for (const v of this.traffic.vehicles) {
      const { img, shadow } = this.sprites.get(v.id);
      const s = toScreen(v.x, v.y, world.heightAt(v.x, v.y));
      const visible = s.x > view.x - m && s.x < view.right + m && s.y > view.y - m && s.y < view.bottom + m;
      img.setVisible(visible);
      shadow.setVisible(visible);
      if (!visible) continue;
      const depth = (v.x + v.y) / WORLD.tileMetres;
      img.setFrame(this.#frame(v)).setPosition(s.x, s.y).setDepth(depth);
      shadow.setPosition(s.x, s.y + 1).setDepth(depth - 0.01);
    }
  }
}

export const isDiesel = (v) => v.kind === 'truck' || v.kind === 'bus';
export { TRAFFIC };
