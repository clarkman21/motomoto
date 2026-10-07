import { WORLD, POLICE, LAW } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawOfficer, policeSpots } from '../world/police.js';
import { PERSON_CANVAS } from '../world/vehicle-sprites.js';
import { addCanvasTexture } from './textures.js';

// Traffic police on the junction corners. They move an arm now and then (they direct the
// traffic). When you ride past much faster than the speed limit, the officer blows the whistle.
// For now there is no fine; later levels add helmet checks and stops.

const T = WORLD.tileMetres;

export class PoliceView {
  constructor(scene, world, graph) {
    this.scene = scene;
    this.world = world;
    for (const f of [0, 1]) if (!scene.textures.exists(`officer-${f}`)) addCanvasTexture(scene, `officer-${f}`, drawOfficer(f));
    this.officers = policeSpots(world, graph).map((p) => {
      const s = toScreen(p.x, p.y, world.heightAt(p.x, p.y));
      const img = scene.add.image(s.x, s.y, 'officer-0')
        .setOrigin(PERSON_CANVAS.groundX / PERSON_CANVAS.width, PERSON_CANVAS.groundY / PERSON_CANVAS.height).setDepth((p.x + p.y) / T);
      world.poles.push({ kind: 'pole', x: p.x, y: p.y, radius: POLICE.radius });
      return { ...p, img, frame: 0, cooldown: 0 };
    });
  }

  /** Call each frame. Returns the officer who blows the whistle now, or null. */
  update(time, dt, bike, speedKmh, limitKmh) {
    let whistle = null;
    for (const o of this.officers) {
      o.cooldown = Math.max(0, o.cooldown - dt);
      const near = Math.hypot(o.x - bike.x, o.y - bike.y) < POLICE.whistleRange;
      if (near && o.cooldown === 0 && speedKmh > limitKmh + Math.max(POLICE.whistleKmh, LAW.toleranceKmh)) {
        o.cooldown = 6;
        o.whistleTime = 1.2;
        whistle = o;
      }
      o.whistleTime = Math.max(0, (o.whistleTime ?? 0) - dt);
      // Arm up while the whistle blows; else now and then (directing the traffic).
      const f = o.whistleTime > 0 || (time / 1400 + o.phase) % 3 < 0.8 ? 1 : 0;
      if (f !== o.frame) o.img.setTexture(`officer-${f}`);
      o.frame = f;
    }
    return whistle;
  }
}
