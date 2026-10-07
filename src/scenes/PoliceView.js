import { WORLD, POLICE } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawOfficer, policeSpots } from '../world/police.js';
import { PERSON_CANVAS } from '../world/vehicle-sprites.js';
import { createPolice, stepPolice } from '../sim/police.js';
import { addCanvasTexture } from './textures.js';

// Traffic police on the junction corners (see sim/police.js for the rules). This view moves the
// sprites and the collision poles. The ride scene handles the events (whistle, chase, fine).

const T = WORLD.tileMetres;

export class PoliceView {
  constructor(scene, world, graph) {
    this.scene = scene;
    this.world = world;
    for (const f of [0, 1, 2, 3]) if (!scene.textures.exists(`officer-${f}`)) addCanvasTexture(scene, `officer-${f}`, drawOfficer(f));
    this.police = createPolice(policeSpots(world, graph));
    for (const o of this.police.officers) {
      o.img = scene.add.image(0, 0, 'officer-0').setOrigin(PERSON_CANVAS.groundX / PERSON_CANVAS.width, PERSON_CANVAS.groundY / PERSON_CANVAS.height);
      o.pole = { kind: 'pole', x: o.x, y: o.y, radius: POLICE.radius };
      world.poles.push(o.pole); // the pole moves with the officer
      o.frame = -1;
      this.#place(o, 0);
    }
  }

  #place(o, frame) {
    const s = toScreen(o.x, o.y, this.world.heightAt(o.x, o.y));
    o.img.setPosition(s.x, s.y).setDepth((o.x + o.y) / T).setFlipX(o.state !== 'post' && o.facing < 0);
    if (frame !== o.frame) o.img.setTexture(`officer-${frame}`);
    o.frame = frame;
    o.pole.x = o.x;
    o.pole.y = o.y;
  }

  /** Call each frame. ctx: { speedKmh, limitKmh, illegal }. Returns the police events. */
  update(time, dt, bike, ctx) {
    const solid = (x, y) => this.world.isSolidAt(x, y, false);
    const events = stepPolice(this.police, bike, ctx, dt, solid);
    for (const e of events) if (e.type === 'whistle') e.officer.whistleTime = 1.2;
    for (const o of this.police.officers) {
      o.whistleTime = Math.max(0, (o.whistleTime ?? 0) - dt);
      let frame;
      if (o.state === 'chase') frame = Math.floor(time / 110) % 2 ? 2 : 3;
      else if (o.state === 'return') frame = Math.floor(time / 260) % 2 ? 2 : 3;
      // At the corner: the arm goes up while the whistle blows, and now and then (directing the traffic).
      else frame = o.whistleTime > 0 || (time / 1400 + o.phase) % 3 < 0.8 ? 1 : 0;
      if (o.state !== 'post' || frame !== o.frame) this.#place(o, frame);
    }
    return events;
  }
}
