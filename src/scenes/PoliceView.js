import { WORLD, POLICE, COLLISION } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawOfficer, drawPolicePost, policeSpots, POLICE_POST } from '../world/police.js';
import { PERSON_CANVAS } from '../world/vehicle-sprites.js';
import { createPolice, stepPolice } from '../sim/police.js';
import { addCanvasTexture, placeOnPixels } from './textures.js';

// Traffic police on the junction corners (see sim/police.js for the rules). This view moves the
// sprites and the collision poles. The ride scene handles the events (whistle, chase, fine).

const T = WORLD.tileMetres;

export class PoliceView {
  constructor(scene, world, graph) {
    this.scene = scene;
    this.world = world;
    for (const f of [0, 1, 2, 3]) {
      if (!scene.textures.exists(`officer-${f}`)) addCanvasTexture(scene, `officer-${f}`, drawOfficer(f));
      if (!scene.textures.exists(`officer-${f}-L`)) addCanvasTexture(scene, `officer-${f}-L`, drawOfficer(f, true));
    }
    for (const f of [0, 1]) if (!scene.textures.exists(`police-post-${f}`)) addCanvasTexture(scene, `police-post-${f}`, drawPolicePost(f));
    this.police = createPolice(policeSpots(world, graph));
    // The POLICE post at each corner (it stays when the officer runs). Its light flashes blue and red.
    this.posts = [];
    for (const o of this.police.officers) {
      if (!o.post) continue;
      const { x, y } = o.post;
      const s = toScreen(x, y, world.heightAt(x, y));
      const img = placeOnPixels(scene.add.image(0, 0, 'police-post-0'), s, POLICE_POST.groundX, POLICE_POST.groundY).setDepth((x + y) / T);
      img.noAmbient = true; // the sign and the light are easy to see at night
      this.posts.push(img);
      world.poles.push({ kind: 'pole', x, y, radius: COLLISION.poleRadius });
    }
    for (const o of this.police.officers) {
      o.img = scene.add.image(0, 0, 'officer-0').setOrigin(PERSON_CANVAS.groundX / PERSON_CANVAS.width, PERSON_CANVAS.groundY / PERSON_CANVAS.height);
      o.pole = { kind: 'pole', officer: true, x: o.x, y: o.y, radius: POLICE.radius };
      world.poles.push(o.pole); // the pole moves with the officer
      o.frame = -1;
      this.#place(o, 0);
    }
  }

  #place(o, frame) {
    const s = toScreen(o.x, o.y, this.world.heightAt(o.x, o.y));
    o.img.setPosition(s.x, s.y).setDepth((o.x + o.y) / T);
    const key = `officer-${frame}${o.state !== 'post' && o.facing < 0 ? '-L' : ''}`; // the left frames keep the light on the top left
    if (key !== o.frame) o.img.setTexture(key);
    o.frame = key;
    o.pole.x = o.x;
    o.pole.y = o.y;
  }

  /** Call each frame. ctx: { speedKmh, limitKmh, illegal }. Returns the police events. */
  update(time, dt, bike, ctx) {
    const solid = (x, y) => this.world.isSolidAt(x, y, false);
    const events = stepPolice(this.police, bike, ctx, dt, solid);
    const light = Math.floor(time / POLICE.postFlashMs) % 2;
    if (light !== this.light) {
      this.light = light;
      for (const p of this.posts) p.setTexture(`police-post-${light}`);
    }
    for (const e of events) if (e.type === 'whistle') e.officer.whistleTime = 1.2;
    for (const o of this.police.officers) {
      o.whistleTime = Math.max(0, (o.whistleTime ?? 0) - dt);
      let frame;
      if (o.state === 'chase') frame = Math.floor(time / 110) % 2 ? 2 : 3;
      else if (o.state === 'return') frame = Math.floor(time / 260) % 2 ? 2 : 3;
      // At the corner: the arm goes up while the whistle blows, and now and then (directing the traffic).
      else frame = o.whistleTime > 0 || (time / 1400 + o.phase) % 3 < 0.8 ? 1 : 0;
      if (o.state !== 'post' || `officer-${frame}` !== o.frame) this.#place(o, frame);
    }
    return events;
  }
}
