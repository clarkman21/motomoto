import { WORLD, PLANES } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawPlane, drawPlaneShadow } from '../world/plane-sprites.js';
import { createPlanes, stepPlanes, jetLevel } from '../sim/planes.js';
import { addCanvasTexture, placeOnPixels } from './textures.js';

// The planes at Kigali International Airport (sim/planes.js, world/plane-sprites.js): the plane on the
// apron and the plane that takes off, each with a shadow on the ground. In the air, the plane draws over
// the buildings (like the kites), and its shadow moves away from it as it climbs.

const T = WORLD.tileMetres;
const SKY_DEPTH = 9e4;
const SHADOW_ALPHA = 0.32;

export class PlaneView {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.planes = createPlanes(world.airport);
    if (!this.planes) return;
    const make = (key, r) => {
      if (!scene.textures.exists(key)) {
        addCanvasTexture(scene, key, r.canvas);
        scene.textures.get(key).customData = { groundX: r.groundX, groundY: r.groundY };
      }
    };
    make('plane-ground', drawPlane({ gear: true }));
    make('plane-roll', drawPlane({ gear: true, west: true }));
    make('plane-air', drawPlane({ gear: false, west: true }));
    make('plane-shadow', drawPlaneShadow());
    make('plane-shadow-west', drawPlaneShadow({ west: true }));
    const p = this.planes.parked;
    this.parkedShadow = this.#place(scene.add.image(0, 0, 'plane-shadow'), p.x, p.y, 0).setAlpha(SHADOW_ALPHA).setDepth((p.x + p.y) / T - 3);
    this.parked = this.#place(scene.add.image(0, 0, 'plane-ground'), p.x, p.y, 0).setDepth((p.x + p.y) / T + 0.5);
    this.shadow = scene.add.image(0, 0, 'plane-shadow-west').setVisible(false);
    this.plane = scene.add.image(0, 0, 'plane-roll').setVisible(false);
  }

  #place(img, x, y, z) {
    const { groundX, groundY } = this.scene.textures.get(img.texture.key).customData;
    return placeOnPixels(img, toScreen(x, y, this.world.heightAt(x, y) + z), groundX, groundY);
  }

  /** dt in seconds. bike: the rider (for the jet sound). Returns the jet loudness 0..1. */
  update(dt, bike) {
    if (!this.planes) return 0;
    stepPlanes(this.planes, dt);
    const f = this.planes.flight;
    const seen = f.phase !== 'wait' && f.alpha > 0;
    this.plane.setVisible(seen);
    this.shadow.setVisible(seen);
    if (seen) {
      const inAir = f.z > PLANES.gearUpMetres;
      this.plane.setTexture(inAir ? 'plane-air' : 'plane-roll');
      this.#place(this.plane, f.x, f.y, f.z).setAlpha(f.alpha);
      // In the sky: over the buildings. On the runway: sorted with the things round it.
      this.plane.setDepth(f.z > 6 ? SKY_DEPTH : (f.x + f.y) / T + 0.5);
      // The shadow: the sun is high, so it stays near the plane, a little to the south-east.
      const sx = f.x + f.z * 0.25, sy = f.y + f.z * 0.25;
      this.#place(this.shadow, sx, sy, 0).setAlpha(SHADOW_ALPHA * f.alpha * Math.max(0.3, 1 - f.z / PLANES.awayMetres));
      this.shadow.setDepth((sx + sy) / T - 3);
    }
    return bike ? jetLevel(this.planes, bike.x, bike.y) : 0;
  }
}
