import { WORLD, COLLISION } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawTrafficLight, TRAFFIC_LIGHT_CANVAS as C } from '../world/police.js';
import { lightState } from '../sim/lights.js';
import { addCanvasTexture, placeOnPixels } from './textures.js';

// The traffic light poles: two at each junction with lights, on opposite corners. One shows the
// colour for the traffic along x, the other for the traffic along y.

const T = WORLD.tileMetres;
const CORNER = 5.4; // metres from the centre of the junction (on the corner, beside the road)

export class TrafficLightView {
  constructor(scene, world, lights) {
    this.scene = scene;
    for (const lit of ['red', 'amber', 'green']) if (!scene.textures.exists(`tlight-${lit}`)) addCanvasTexture(scene, `tlight-${lit}`, drawTrafficLight(lit));
    this.poles = [];
    for (const l of lights) {
      for (const [axis, dx, dy] of [['x', -CORNER, CORNER], ['y', CORNER, -CORNER]]) {
        const x = l.x + dx, y = l.y + dy;
        const s = toScreen(x, y, world.heightAt(x, y));
        const img = placeOnPixels(scene.add.image(0, 0, 'tlight-red'), s, C.groundX, C.groundY).setDepth((x + y) / T).setVisible(false);
        img.noAmbient = true; // the lamps are easy to see at night
        const pole = { kind: 'pole', x, y, radius: COLLISION.poleRadius, off: true };
        world.poles.push(pole);
        this.poles.push({ light: l, axis, img, pole, lit: null });
      }
    }
  }

  /** Show only the lights in use (open districts, and a mode with lights). */
  setActive(active) {
    const on = new Set(active.map((l) => l.id));
    for (const p of this.poles) {
      const show = on.has(p.light.id);
      p.img.setVisible(show);
      p.pole.off = !show; // a pole not in use is not solid
      p.active = show;
    }
  }

  /** time: the traffic clock (seconds). */
  update(time) {
    for (const p of this.poles) {
      if (!p.active) continue;
      const lit = lightState(p.light, time)[p.axis];
      if (lit !== p.lit) {
        p.lit = lit;
        p.img.setTexture(`tlight-${lit}`);
      }
    }
  }
}
