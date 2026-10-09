import { WORLD } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawPerson, drawWaver, PERSON_LOOKS, PERSON_CANVAS } from '../world/vehicle-sprites.js';
import { packShelves } from './chunks.js';

// Draws walkers and waving customers. All frames are in one atlas.

export class PeopleView {
  constructor(scene, people) {
    this.scene = scene;
    this.people = people;
    this.#buildAtlas();
    const ox = PERSON_CANVAS.groundX / PERSON_CANVAS.width, oy = PERSON_CANVAS.groundY / PERSON_CANVAS.height;
    this.walkerSprites = people.walkers.map(() => scene.add.image(0, 0, 'people', 'p-0-0-0-R').setOrigin(ox, oy));
    this.hailSprites = new Map();
    this.origin = { ox, oy };
  }

  #buildAtlas() {
    if (this.scene.textures.exists('people')) return;
    const frames = [];
    PERSON_LOOKS.forEach((look, i) => {
      for (const side of ['R', 'L']) {
        for (const facing of [0, 1]) for (const step of [0, 1]) frames.push({ name: `p-${i}-${facing}-${step}-${side}`, canvas: drawPerson(look, facing, step, side === 'L') });
      }
      frames.push({ name: `wave-${i}`, canvas: drawWaver(look) });
    });
    const { width, height, places } = packShelves(frames.map((f) => f.canvas));
    const tex = this.scene.textures.createCanvas('people', width, height);
    frames.forEach((f, i) => {
      tex.context.putImageData(new ImageData(f.canvas.data, f.canvas.width, f.canvas.height), places[i].x, places[i].y);
      tex.add(f.name, 0, places[i].x, places[i].y, f.canvas.width, f.canvas.height);
    });
    tex.refresh();
  }

  destroy() {
    for (const img of this.walkerSprites) img.destroy();
    for (const img of this.hailSprites.values()) img.destroy();
    this.hailSprites.clear();
  }

  update(world, view, time) {
    const m = 40;
    const inView = (s) => s.x > view.x - m && s.x < view.right + m && s.y > view.y - m && s.y < view.bottom + m;
    // Walkers come and go (people who cross the road): make sprites as needed, hide the extra ones.
    for (let i = this.people.walkers.length; i < this.walkerSprites.length; i++) this.walkerSprites[i].setVisible(false);
    this.people.walkers.forEach((p, i) => {
      const img = (this.walkerSprites[i] ??= this.scene.add.image(0, 0, 'people', 'p-0-0-0-R').setOrigin(this.origin.ox, this.origin.oy));
      const s = toScreen(p.x, p.y, world.heightAt(p.x, p.y));
      if (!inView(s)) return img.setVisible(false);
      const moving = Math.abs(p.vx) + Math.abs(p.vy) > 0.1;
      const facing = p.vx + p.vy >= 0 ? 0 : 1; // towards the camera when walking to +x +y
      const step = moving ? Math.floor(time / 180 + p.id) % 2 : 0;
      const side = p.vx - p.vy < 0 ? 'L' : 'R'; // the screen x direction of the walk
      img.setVisible(true).setFrame(`p-${p.look}-${facing}-${step}-${side}`).setPosition(s.x, s.y).setDepth((p.x + p.y) / WORLD.tileMetres);
      img.setAngle(p.hurt > 0 ? 80 : 0); // knocked down
    });
    // Waving customers: create and remove sprites as hails come and go.
    const alive = new Set();
    for (const h of this.people.hails) {
      alive.add(h.id);
      let img = this.hailSprites.get(h.id);
      if (!img) {
        img = this.scene.add.image(0, 0, 'people', `wave-${h.look}`).setOrigin(this.origin.ox, this.origin.oy);
        this.hailSprites.set(h.id, img);
      }
      const s = toScreen(h.x, h.y, world.heightAt(h.x, h.y));
      img.setVisible(inView(s)).setPosition(s.x, s.y - (Math.floor(time / 300) % 2)).setDepth((h.x + h.y) / WORLD.tileMetres);
    }
    for (const [id, img] of this.hailSprites) {
      if (!alive.has(id)) {
        img.destroy();
        this.hailSprites.delete(id);
      }
    }
  }
}
