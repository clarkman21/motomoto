import { WORLD, HQ, COLLISION, PALETTE } from '../config.js';
import { toScreen } from '../world/iso.js';
import { drawBike, BIKE_CANVAS, bikeFrameForHeading, BIKE_LOOKS } from '../world/sprites.js';
import { drawPosed, drawWaver, PERSON_CANVAS } from '../world/vehicle-sprites.js';
import { drawCone, CONE_CANVAS } from '../world/roadevent-sprites.js';
import {
  drawFencePanel, drawTrackGate, GATE_CANVAS, drawBow, BOW_CANVAS, drawDesk, DESK_CANVAS, drawBanner, drawChild,
  STAFF_LOOK, MOTHER_LOOK, CHILD_LOOKS, CONFETTI_COLOURS,
} from '../world/hq-sprites.js';
import { alphaSpots, tradeSpots, trackLayout } from '../sim/hq.js';
import { addCanvasTexture, placeOnPixels } from './textures.js';

// The Ampersand HQ in Gikondo: the fence, the rows of new Alphas, the trade-in row, the desk and the
// staff, the test track (cones and 4 gates), the MURAKAZA NEZA banner. During the mission (sim/hq.js):
// the rider on foot, your Alpha with the teal bow, a staff member who walks the old moto to the trade-in
// row, and at the end the confetti, the family who waves and the staff who clap.

const T = WORLD.tileMetres;
// The rider on foot: the skin of the rider on the bike (as in drawBike) and the reflective band of the vest.
const riderSkin = () => ({ skin: PALETTE.skin, trim: PALETTE.reflect });
const PX = PERSON_CANVAS.groundX / PERSON_CANVAS.width, PY = PERSON_CANVAS.groundY / PERSON_CANVAS.height;

/** A parked bike texture (no rider), made when it is first needed. parts: the garage parts that show. */
export function parkedKey(scene, type, frame, parts = []) {
  const key = `parked-${type}-${frame}${parts.length ? `-${parts.join('.')}` : ''}`;
  if (!scene.textures.exists(key)) addCanvasTexture(scene, key, drawBike(type, frame, 'none', false, 'ride', parts));
  return key;
}

export class HqView {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.#textures(scene);
    this.#fence(scene, world);
    this.#yard(scene, world);
    this.walker = scene.add.image(0, 0, 'hq-rider-petrol-0-0-R').setOrigin(PX, PY).setVisible(false);
    this.oldMoto = scene.add.image(0, 0, parkedKey(scene, 'petrol', 0)).setOrigin(BIKE_CANVAS.groundX / BIKE_CANVAS.width, BIKE_CANVAS.groundY / BIKE_CANVAS.height).setVisible(false);
    this.porter = scene.add.image(0, 0, 'hq-staff-walk0-R').setOrigin(PX, PY).setVisible(false); // walks the old moto away
    this.family = [
      scene.add.image(0, 0, 'hq-mother-0').setOrigin(PX, PY),
      scene.add.image(0, 0, 'hq-child0-0').setOrigin(PX, PY),
      scene.add.image(0, 0, 'hq-child1-0').setOrigin(PX, PY),
    ];
    this.family.forEach((img, i) => this.#put(img, (HQ.yard.x0 + 7.0 + i * 0.28) * T, (HQ.yard.y1 + 0.45 - i * 0.05) * T).setVisible(false));
    this.cheer = [this.#person('hq-staff-clap0-L', HQ.yard.x0 + 11.55, HQ.yard.y1 + 0.2), this.#person('hq-staff-clap0-R', HQ.yard.x0 + 7.85, HQ.yard.y1 + 0.6)];
    for (const img of this.cheer) img.setVisible(false);
    this.confetti = scene.add.graphics().setDepth(1e5);
    this.confetti.noAmbient = true;
    this.pieces = [];
    this.trade = null; // the walk of the old moto to the trade-in row
  }

  #textures(scene) {
    const add = (key, pc) => { if (!scene.textures.exists(key)) addCanvasTexture(scene, key, pc); };
    for (const side of ['R', 'L']) {
      const left = side === 'L';
      for (const pose of ['walk0', 'walk1', 'point', 'clap0', 'clap1', 'wave']) {
        const walk = pose.startsWith('walk');
        add(`hq-staff-${pose}-${side}`, drawPosed(STAFF_LOOK, walk ? 'walk' : pose, walk ? Number(pose[4]) : 0, 0, left));
      }
      for (const helmet of ['petrol', 'electric']) {
        const look = BIKE_LOOKS[helmet];
        for (const facing of [0, 1]) for (const step of [0, 1]) {
          add(`hq-rider-${helmet}-${facing}-${step}-${side}`, drawPosed({ shirt: look.vest, legs: look.trousers, helmet: look.helmet, ...riderSkin() }, 'walk', step, facing, left));
        }
      }
    }
    add('hq-mother-0', drawWaver(MOTHER_LOOK));
    add('hq-mother-1', drawWaver(MOTHER_LOOK, true));
    CHILD_LOOKS.forEach((look, i) => { add(`hq-child${i}-0`, drawChild(look, true)); add(`hq-child${i}-1`, drawChild(look, false)); });
    add('hq-cone', drawCone());
    for (let n = 1; n <= 4; n++) for (const lit of [0, 1]) add(`hq-gate-${n}-${lit}`, drawTrackGate(n, !!lit));
    add('hq-bow', drawBow());
    add('hq-desk', drawDesk());
    this.banner = drawBanner();
    add('hq-banner', this.banner.canvas);
    for (const axis of ['x', 'y']) {
      const p = drawFencePanel(axis);
      add(`hq-fence-${axis}`, p.canvas);
      this[`fence${axis}`] = p;
    }
  }

  /** A screen position on whole pixels for a world point (metres); the depth sorts it with the bike. */
  #put(img, x, y, bias = 0) {
    const p = toScreen(x, y, this.world.heightAt(x, y));
    return img.setPosition(Math.round(p.x), Math.round(p.y)).setDepth((x + y) / T + bias);
  }

  #person(key, tx, ty) {
    return this.#put(this.scene.add.image(0, 0, key).setOrigin(PX, PY), tx * T, ty * T);
  }

  #fence(scene, world) {
    const r = HQ.yard, gIn = HQ.gates.in, gOut = HQ.gates.out;
    const open = (x) => (x >= gIn[0] && x < gIn[1]) || (x >= gOut[0] && x < gOut[1]);
    const panel = (axis, tx, ty) => {
      const p = this[`fence${axis}`];
      const s = toScreen(tx * T, ty * T, world.heightAt(tx * T, ty * T));
      placeOnPixels(scene.add.image(0, 0, `hq-fence-${axis}`), s, p.groundX, p.groundY)
        .setDepth(tx + ty + 0.5);
    };
    const pole = (x, y) => world.poles.push({ kind: 'pole', x, y, radius: 0.3 });
    for (let tx = r.x0; tx <= r.x1; tx++) {
      panel('x', tx, r.y0);
      if (!open(tx)) panel('x', tx, r.y1 + 1);
    }
    for (let ty = r.y0; ty <= r.y1; ty++) { panel('y', r.x0, ty); panel('y', r.x1 + 1, ty); }
    // Collision poles every metre along the fence, with the gates open.
    for (let m = 0; m <= (r.x1 + 1 - r.x0) * T; m += 1) {
      pole(r.x0 * T + m, r.y0 * T);
      if (!open(r.x0 + m / T)) pole(r.x0 * T + m, (r.y1 + 1) * T);
    }
    for (let m = 0; m <= (r.y1 + 1 - r.y0) * T; m += 1) { pole(r.x0 * T, r.y0 * T + m); pole((r.x1 + 1) * T, r.y0 * T + m); }
    // The banner over the exit gate.
    const bx = ((gOut[0] + gOut[1]) / 2) * T, by = (r.y1 + 1) * T;
    placeOnPixels(scene.add.image(0, 0, 'hq-banner'), toScreen(bx, by, world.heightAt(bx, by)), this.banner.groundX, this.banner.groundY).setDepth(bx / T + r.y1 + 1.2);
  }

  #yard(scene, world) {
    const bikeOrigin = [BIKE_CANVAS.groundX / BIKE_CANVAS.width, BIKE_CANVAS.groundY / BIKE_CANVAS.height];
    const parked = (type, x, y, heading) => {
      world.poles.push({ kind: 'pole', x, y, radius: COLLISION.bikeRadius + 0.15 });
      return this.#put(scene.add.image(0, 0, parkedKey(scene, type, bikeFrameForHeading(heading))).setOrigin(...bikeOrigin), x, y);
    };
    // The rows of new Alphas, nose to the south. Yours has the bow (it shows during the mission).
    this.alphas = alphaSpots().map((s) => ({ ...s, img: parked('electric', s.x, s.y, Math.PI / 2) }));
    const mine = this.alphas.find((a) => a.ribbon);
    this.ribbonAlpha = mine;
    this.bow = this.#put(scene.add.image(0, 0, 'hq-bow').setOrigin(BOW_CANVAS.groundX / BOW_CANVAS.width, BOW_CANVAS.groundY / BOW_CANVAS.height), mine.x, mine.y, 0.05);
    this.bow.y -= 14;
    // The trade-in row of old petrol motos, nose to the east (one free spot at the end for yours).
    for (const s of tradeSpots()) parked('petrol', s.x, s.y, 0);
    // The desk, a staff member behind it, and one beside your Alpha who points to it.
    this.#put(scene.add.image(0, 0, 'hq-desk').setOrigin(DESK_CANVAS.groundX / DESK_CANVAS.width, DESK_CANVAS.groundY / DESK_CANVAS.height), HQ.desk.x * T, HQ.desk.y * T);
    world.poles.push({ kind: 'pole', x: HQ.desk.x * T, y: HQ.desk.y * T, radius: 0.9 });
    this.clerk = this.#person('hq-staff-point-R', HQ.desk.x - 0.25, HQ.desk.y - 0.3);
    this.pointer = this.#person('hq-staff-point-L', mine.x / T + 0.55, mine.y / T + 0.55);
    // The test track: the cones and the 4 gates.
    const track = trackLayout();
    const co = [CONE_CANVAS.groundX / CONE_CANVAS.width, CONE_CANVAS.groundY / CONE_CANVAS.height];
    this.cones = track.cones.map((c) => ({ ...c, img: this.#put(scene.add.image(0, 0, 'hq-cone').setOrigin(...co), c.x, c.y) }));
    const go = [GATE_CANVAS.groundX / GATE_CANVAS.width, GATE_CANVAS.groundY / GATE_CANVAS.height];
    this.gates = track.gates.map((g) => ({ ...g, img: this.#put(scene.add.image(0, 0, `hq-gate-${g.n}-0`).setOrigin(...go), g.x, g.y, -0.4) }));
  }

  /** The hand-in: a staff member walks to the old moto and walks it to the trade-in row. */
  startTrade(oldBike) {
    const spot = tradeSpots(HQ.tradeRow.count + 1).at(-1);
    this.trade = { t: 0, from: { ...oldBike }, to: spot, desk: { x: HQ.desk.x * T, y: HQ.desk.y * T } };
    this.oldMoto.setTexture(parkedKey(this.scene, 'petrol', bikeFrameForHeading(oldBike.heading))).setVisible(true);
    this.#put(this.oldMoto, oldBike.x, oldBike.y);
  }

  /** The ride out: confetti, the family waves, the staff clap. (x, y): the bike in metres. */
  celebrate(x, y) {
    const p = toScreen(x, y, this.world.heightAt(x, y));
    this.celebration = HQ.confetti.seconds + 2;
    this.pieces = Array.from({ length: HQ.confetti.pieces }, (_, i) => ({
      x: p.x + (Math.random() - 0.5) * 120,
      y: p.y - 40 - Math.random() * 70,
      vx: (Math.random() - 0.5) * 18,
      vy: 8 + Math.random() * 16,
      spin: Math.random() * Math.PI * 2,
      colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
      life: HQ.confetti.seconds * (0.7 + Math.random() * 0.3),
    }));
  }

  /** hq: the mission state (or null). ride: the scene (the bike, the time). */
  update(hq, ride, dt, now) {
    const stage = hq?.stage ?? null;
    const mission = !!hq && stage !== 'done';
    // Your Alpha with the bow waits until you get on it.
    const waiting = mission && (stage === 'ride' || stage === 'desk' || stage === 'alpha');
    this.ribbonAlpha.img.setVisible(!hq || waiting); // on the track and after it, you ride it
    this.bow.setVisible(waiting);
    this.pointer.setVisible(waiting);
    if (waiting) this.pointer.setTexture(stage === 'alpha' && Math.floor(now / 500) % 2 ? 'hq-staff-wave-L' : 'hq-staff-point-L');
    this.clerk.setTexture(stage === 'desk' && Math.floor(now / 600) % 2 ? 'hq-staff-wave-R' : 'hq-staff-point-R');
    // The walker.
    const w = hq?.walker;
    this.walker.setVisible(!!w);
    if (w) {
      const sx = w.dx - w.dy, sy = (w.dx + w.dy) / 2;
      w.metres = (w.metres ?? 0) + (w.moving ? dt * HQ.walkMs : 0);
      const step = w.moving ? Math.floor(w.metres / 0.45) % 2 : 0;
      this.walker.setTexture(`hq-rider-petrol-${sy < 0 ? 1 : 0}-${step}-${sx < 0 ? 'L' : 'R'}`);
      const p = toScreen(w.x, w.y, this.world.heightAt(w.x, w.y));
      this.walker.setPosition(p.x, p.y).setDepth((w.x + w.y) / T);
    }
    this.#updateTrade(dt);
    // The cones that fell over, and the next gate (lit).
    if (hq) hq.cones.forEach((c, i) => { const v = this.cones[i]; if (v && c.down && !v.down) { v.down = true; v.img.setAngle(c.x > ride.bike.x ? 80 : -80); } });
    this.gates.forEach((g, i) => g.img.setTexture(`hq-gate-${g.n}-${stage === 'track' && i === hq.gate && Math.floor(now / 250) % 2 ? 1 : 0}`));
    this.#updateParty(dt, now);
  }

  #updateTrade(dt) {
    const t = this.trade;
    if (!t) return;
    t.t += dt;
    const walk = 1.6, carry = 3.2;
    let px, py, mx = t.from.x, my = t.from.y, carrying = false;
    if (t.t < walk) {
      const k = t.t / walk;
      px = t.desk.x + (t.from.x - 0.9 - t.desk.x) * k;
      py = t.desk.y + (t.from.y - t.desk.y) * k;
    } else {
      const k = Math.min(1, (t.t - walk) / carry);
      mx = t.from.x + (t.to.x - t.from.x) * k;
      my = t.from.y + (t.to.y - t.from.y) * k;
      px = mx - 0.9; py = my;
      carrying = k < 1;
    }
    const step = Math.floor(t.t / 0.3) % 2;
    this.porter.setVisible(t.t < walk + carry).setTexture(`hq-staff-walk${step}-${px > (this.lastPorterX ?? px) - 0.001 ? 'R' : 'L'}`);
    this.lastPorterX = px;
    this.#put(this.porter, px, py, 0.01);
    if (t.t >= walk) {
      this.oldMoto.setTexture(parkedKey(this.scene, 'petrol', carrying ? bikeFrameForHeading(Math.atan2(t.to.y - t.from.y, t.to.x - t.from.x)) : 0));
      this.#put(this.oldMoto, mx, my);
    }
    if (t.t >= walk + carry) this.trade = null; // the old moto stays in the trade-in row
  }

  #updateParty(dt, now) {
    const on = (this.celebration ?? 0) > 0;
    for (const img of [...this.family, ...this.cheer]) img.setVisible(on);
    const g = this.confetti.clear();
    if (!on) return;
    this.celebration -= dt;
    const beat = Math.floor(now / 280) % 2;
    this.family[0].setTexture(beat ? 'hq-mother-0' : 'hq-mother-1');
    this.family[1].setTexture(`hq-child0-${beat}`);
    this.family[2].setTexture(`hq-child1-${1 - beat}`);
    this.cheer[0].setTexture(`hq-staff-clap${beat}-L`);
    this.cheer[1].setTexture(`hq-staff-clap${1 - beat}-R`);
    for (const p of this.pieces) {
      if ((p.life -= dt) <= 0) continue;
      p.vy = Math.min(26, p.vy + 6 * dt);
      p.x += (p.vx + Math.sin(now / 300 + p.spin) * 10) * dt;
      p.y += p.vy * dt;
      const flat = Math.abs(Math.sin(now / 120 + p.spin)) > 0.5;
      g.fillStyle(p.colour, Math.min(1, p.life * 2)).fillRect(Math.round(p.x), Math.round(p.y), flat ? 2 : 1, flat ? 1 : 2);
    }
  }
}
