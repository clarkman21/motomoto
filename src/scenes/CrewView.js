import { WORLD } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawWorker, PERSON_LOOKS, PERSON_CANVAS, CITY_SWEEPER_LOOK } from '../world/vehicle-sprites.js';
import { crewFrame } from '../sim/crews.js';
import { packShelves } from './chunks.js';

// Draws the work crews at the road sides (sim/crews.js): Umuganda workers with hoes and brooms, and
// the city road sweepers. setCrews() gives the list; update() places the sprites in view.
export class CrewView {
  constructor(scene) {
    this.scene = scene;
    this.crews = [];
    this.sprites = [];
    this.#buildAtlas();
    this.origin = { ox: PERSON_CANVAS.groundX / PERSON_CANVAS.width, oy: PERSON_CANVAS.groundY / PERSON_CANVAS.height };
  }

  #buildAtlas() {
    if (this.scene.textures.exists('crew')) return;
    const frames = [];
    const add = (lookKey, look) => {
      for (const task of ['hoe', 'sweep']) for (const f of [0, 1]) for (const side of ['R', 'L']) {
        frames.push({ name: `w-${lookKey}-${task}-${f}-${side}`, canvas: drawWorker(look, task, f, side === 'L') });
      }
    };
    PERSON_LOOKS.forEach((look, i) => add(i, look));
    add('city', CITY_SWEEPER_LOOK);
    const { width, height, places } = packShelves(frames.map((f) => f.canvas));
    const tex = this.scene.textures.createCanvas('crew', width, height);
    frames.forEach((f, i) => {
      tex.context.putImageData(new ImageData(f.canvas.data, f.canvas.width, f.canvas.height), places[i].x, places[i].y);
      tex.add(f.name, 0, places[i].x, places[i].y, f.canvas.width, f.canvas.height);
    });
    tex.refresh();
  }

  /** The workers to show now (an empty list hides them all). */
  setCrews(list) {
    this.crews = list;
    for (let i = list.length; i < this.sprites.length; i++) this.sprites[i].setVisible(false);
  }

  update(world, view, time) {
    const m = 40;
    this.crews.forEach((w, i) => {
      const img = (this.sprites[i] ??= this.scene.add.image(0, 0, 'crew', 'w-city-sweep-0-R').setOrigin(this.origin.ox, this.origin.oy));
      const s = toScreen(w.x, w.y, world.heightAt(w.x, w.y));
      if (s.x < view.x - m || s.x > view.right + m || s.y < view.y - m || s.y > view.bottom + m) return img.setVisible(false);
      const f = w.hurt > 0 ? 0 : crewFrame(w, time);
      img.setVisible(true).setFrame(`w-${w.look}-${w.task}-${f}-${w.left ? 'L' : 'R'}`).setPosition(s.x, s.y)
        .setDepth((w.x + w.y) / WORLD.tileMetres).setAngle(w.hurt > 0 ? 80 : 0);
    });
  }
}
