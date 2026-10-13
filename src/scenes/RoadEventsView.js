import { WORLD, COLLISION } from '../config.js';
import { toScreen } from '../world/iso.js';
import { addCanvasTexture, placeOnPixels } from './textures.js';
import { drawCone, CONE_CANVAS, drawBoard, drawBarrier, drawPatch, drawWorker, drawNoMotoSign } from '../world/roadevent-sprites.js';
import { PERSON_CANVAS, drawVehicle, VEHICLE_CANVAS } from '../world/vehicle-sprites.js';
import { bikeFrameForHeading } from '../world/sprites.js';

// Draws the street events (sim/roadevents.js): the road works (a dug-up strip, cones, a sign, two
// workers with shovels) and the car free morning (barriers and a banner at the ends of the closed road).
// Cones, workers and barriers are poles for collisions.

const T = WORLD.tileMetres;

export class RoadEventsView {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.works = [];
    this.carFree = [];
    this.workers = [];
    this.rules = [];
    this.checks = [];
    if (!scene.textures.exists('works-cone')) {
      addCanvasTexture(scene, 'works-cone', drawCone());
      for (const f of [0, 1]) addCanvasTexture(scene, `works-worker-${f}`, drawWorker(f));
    }
  }

  #add(list, key, x, y, gx, gy, depth, pole = 0) {
    const img = placeOnPixels(this.scene.add.image(0, 0, key), toScreen(x, y, this.world.heightAt(x, y)), gx, gy).setDepth(depth ?? (x + y) / T);
    const item = { img, pole: null };
    if (pole) {
      item.pole = { kind: 'pole', x, y, radius: pole };
      this.world.poles.push(item.pole);
    }
    list.push(item);
    return img;
  }

  #clear(list) {
    for (const it of list) {
      it.img.destroy();
      if (it.pole) this.world.poles = this.world.poles.filter((p) => p !== it.pole);
    }
    list.length = 0;
  }

  /** Today's road works (from pickRoadWorks). */
  setWorks(sites) {
    this.#clear(this.works);
    this.workers = [];
    const sign = drawBoard('ROAD WORKS', 0xe0a030, 0x161616);
    if (!this.scene.textures.exists('works-sign')) addCanvasTexture(this.scene, 'works-sign', sign.canvas);
    for (const site of sites) {
      const z = this.world.heightAt(site.zone.x, site.zone.y);
      const patch = drawPatch(site.patch, z);
      const pk = `works-patch-${site.id}-${Math.round(site.zone.x)}-${Math.round(site.zone.y)}`;
      if (!this.scene.textures.exists(pk)) addCanvasTexture(this.scene, pk, patch.canvas);
      const minDepth = Math.min(...site.patch.map((p) => (p.x + p.y) / T));
      this.works.push({ img: this.scene.add.image(patch.x, patch.y, pk).setOrigin(0).setDepth(minDepth - 0.6), pole: null });
      for (const c of site.cones) this.#add(this.works, 'works-cone', c.x, c.y, CONE_CANVAS.groundX, CONE_CANVAS.groundY, undefined, COLLISION.poleRadius);
      this.#add(this.works, 'works-sign', site.sign.x, site.sign.y, sign.groundX, sign.groundY, undefined, COLLISION.poleRadius);
      for (const w of site.workers) this.workers.push(this.#add(this.works, 'works-worker-0', w.x, w.y, PERSON_CANVAS.groundX, PERSON_CANVAS.groundY, undefined, 0.35));
    }
  }

  /**
   * The car free morning: barriers across both ends of each closed road, and a banner. roads: the
   * road objects (straight roads along x or y, in tiles). on: show or hide.
   */
  setCarFree(roads, on) {
    this.#clear(this.carFree);
    if (!on) return;
    const bar = drawBarrier();
    if (!this.scene.textures.exists('carfree-barrier')) addCanvasTexture(this.scene, 'carfree-barrier', bar.canvas);
    const banner = drawBoard('CAR FREE DAY', 0x2f7f4a, 0xf2efe6, 12);
    if (!this.scene.textures.exists('carfree-banner')) addCanvasTexture(this.scene, 'carfree-banner', banner.canvas);
    for (const r of roads) {
      const w = r.width ?? 2;
      const ends = r.y !== undefined
        ? [[r.x0 + 0.5, r.y], [r.x1 + 0.5, r.y]].map(([x, y]) => Array.from({ length: Math.ceil(w / 2) }, (_, i) => ({ x: x * T, y: (y + 1 + i * 2) * T })))
        : [[r.x, r.y0 + 0.5], [r.x, r.y1 + 0.5]].map(([x, y]) => Array.from({ length: Math.ceil(w / 2) }, (_, i) => ({ x: (x + 1 + i * 2) * T, y: y * T })));
      for (const end of ends) for (const p of end) this.#add(this.carFree, 'carfree-barrier', p.x, p.y, bar.groundX, bar.groundY, undefined, 0.6);
      const b = ends[0][0];
      this.#add(this.carFree, 'carfree-banner', b.x + (r.y !== undefined ? 3 : -3), b.y + (r.y !== undefined ? -3 : 3), banner.groundX, banner.groundY);
    }
  }

  /**
   * The street rules (hard rules): a blue ONE WAY board and a round NO MOTOS sign at both ends of the
   * road, at the roadside. They are not poles, so they never close a junction.
   */
  setRuleSigns(oneWays, noMotos) {
    this.#clear(this.rules);
    const one = drawBoard('ONE WAY', 0x1f4f9a, 0xf2efe6, 10);
    if (!this.scene.textures.exists('rule-oneway')) addCanvasTexture(this.scene, 'rule-oneway', one.canvas);
    const no = drawNoMotoSign();
    if (!this.scene.textures.exists('rule-nomoto')) addCanvasTexture(this.scene, 'rule-nomoto', no.canvas);
    const ends = (r) => (r.y !== undefined
      ? [{ x: (r.x0 + 0.5) * T, y: r.y * T - 1 }, { x: (r.x1 + 0.5) * T, y: r.y * T - 1 }]
      : [{ x: r.x * T - 1, y: (r.y0 + 0.5) * T }, { x: r.x * T - 1, y: (r.y1 + 0.5) * T }]);
    for (const o of oneWays) for (const p of ends(o.road)) this.#add(this.rules, 'rule-oneway', p.x, p.y, one.groundX, one.groundY);
    for (const r of noMotos) for (const p of ends(r)) this.#add(this.rules, 'rule-nomoto', p.x, p.y, no.groundX, no.groundY);
  }

  /** Today's mobile speed checks: a parked police car at the roadside. It is a pole (you can hit it). */
  setSpeedChecks(checks) {
    this.#clear(this.checks);
    for (const c of checks) {
      const f = bikeFrameForHeading(c.heading);
      const key = `check-car-${f}`;
      if (!this.scene.textures.exists(key)) addCanvasTexture(this.scene, key, drawVehicle('police', 0, f));
      this.#add(this.checks, key, c.x, c.y, VEHICLE_CANVAS.groundX, VEHICLE_CANVAS.groundY, undefined, 1.2);
    }
  }

  /** The workers dig (two frames). */
  update(time) {
    const f = Math.floor(time / 450) % 2;
    this.workers.forEach((img, i) => img.setTexture(`works-worker-${(f + i) % 2}`));
  }

  destroy() {
    this.#clear(this.works);
    this.#clear(this.carFree);
    this.#clear(this.rules);
    this.#clear(this.checks);
  }
}

