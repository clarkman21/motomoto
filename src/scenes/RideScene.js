import Phaser from 'phaser';
import { VIEW, WORLD, BIKES, DAY, MONEY, MAINTENANCE } from '../config.js';
import { World } from '../world/world.js';
import { buildKigaliMap } from '../world/maps/kigali.js';
import { ChunkStreamer } from './chunks.js';
import { addCanvasTexture } from './textures.js';
import { toScreen } from '../world/iso.js';
import {
  drawBike, drawBlock, drawShadow, drawGlow, drawPuff, bikeFrameForHeading, BIKE_CANVAS, BIKE_DIRECTIONS,
  drawCamera, drawSpeedSign, drawMarkerRing, drawMarkerPin, drawArrow, PROP_CANVAS,
  BIKE_LOADS, drawWaitingPassenger, drawCargoPile,
} from '../world/sprites.js';
import { createBike, stepBike, forwardSpeed, shiftGear, bestGear } from '../sim/bike.js';
import { readControls, STEERING_MODES } from '../sim/controls.js';
import { EngineSound } from '../audio/engine-sound.js';
import { createWallet, earn, spend, buyFuel, swapBattery, fuelFillCost, repairCost, endDay, takeLoan, payGarage } from '../sim/economy.js';
import { garageQuote, serviceDue } from '../sim/maintenance.js';
import { createJobBoard, updateBoard, acceptOffer, cancelJob, updateJob, jobTarget } from '../sim/jobs.js';
import { createCameraState, checkCameras, speedLimitAt } from '../sim/law.js';

const FIXED_DT = 1 / 120; // physics step in seconds
const BARKS = {
  bumpHard: 'Speed bump too fast!',
  wall: 'Bang!',
  empty: 'Out of energy! Hold throttle to push the bike to a station',
  pothole: 'Pothole! Speed −30%, more wear',
  overRev: 'Too fast to shift down',
  noGears: 'Electric moto: no gears',
  brakesWorn: 'Brakes worn! Downshift or use regen',
  lugging: 'Shift down!',
  offRoad: 'Off road! The bike wears 4 times faster',
  serviceSoon: 'Service soon: 80%. Plan a garage visit',
  serviceDue: 'Service due! The bike loses power. Go to the garage',
  breakdown: 'Breakdown! Push the bike to the garage',
};
const REPAIR_LABELS = { wall: 'Crash damage' };
const STATION_RANGE_METRES = 6;

export class RideScene extends Phaser.Scene {
  constructor() {
    super('ride');
  }

  create() {
    this.world = new World(buildKigaliMap());
    this.cameras.main.setBackgroundColor('#1d2a33');
    this.cameras.main.setRoundPixels(false); // smooth sub pixel camera; textures stay sharp (antialias off)

    // Ground and blocks stream in chunks near the bike (see chunks.js).
    this.chunks = new ChunkStreamer(this, this.world);

    // Bike frames, shadow, glow and smoke.
    for (const type of Object.keys(BIKES)) {
      for (const load of BIKE_LOADS) {
        for (let f = 0; f < BIKE_DIRECTIONS; f++) addCanvasTexture(this, `bike-${type}-${load}-${f}`, drawBike(type, f, load));
      }
    }
    addCanvasTexture(this, 'shadow', drawShadow());
    addCanvasTexture(this, 'glow', drawGlow());
    addCanvasTexture(this, 'puff', drawPuff());
    const ox = BIKE_CANVAS.groundX / BIKE_CANVAS.width;
    const oy = BIKE_CANVAS.groundY / BIKE_CANVAS.height;
    this.shadow = this.add.image(0, 0, 'shadow');
    this.glow = this.add.image(0, 0, 'glow').setVisible(false);
    this.bikeSprite = this.add.image(0, 0, 'bike-petrol-none-0').setOrigin(ox, oy);
    // The "ghost" is the bike outline that shows when a building or tree hides the bike.
    this.ghost = this.add.image(0, 0, 'bike-petrol-none-0').setOrigin(ox, oy).setTintFill(0xffffff).setAlpha(0.5).setDepth(1e6).setVisible(false);
    this.puffs = [];
    this.puffTimer = 0;

    this.#createProps();

    this.bike = createBike(this.world, 'petrol');
    this.wallet = createWallet();
    this.board = createJobBoard(this.world, Date.now() & 0xffff);
    this.cameraState = createCameraState(this.world);
    this.dayTime = 0; // real seconds since 06:00 today
    this.station = null; // the station the bike stands at: 'fuel' or 'swap'
    this.refuel = null; // { kind, timeLeft, total } while you fill up or swap
    this.speedLimit = speedLimitAt(this.world, this.bike.x, this.bike.y);
    this.steeringMode = 'bike';
    this.controls = { throttle: 0, brake: 0, steer: 0 };
    this.touch = { stick: { x: 0, y: 0, active: false }, throttle: false, brake: false };
    this.accumulator = 0;
    this.engineSound = new EngineSound();
    this.occluded = false;

    this.chunks.update(this.bike.x, this.bike.y);
    this.#setupKeys();
    this.#updateZoom();
    this.scale.on('resize', () => this.#updateZoom());
    this.#placeBike();
    const s = this.bikeScreen;
    this.cameras.main.centerOn(s.x, s.y);
    this.camPos = { x: s.x, y: s.y };

    this.scene.launch('hud');
  }

  #setupKeys() {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D,
      space: K.SPACE, shift: K.SHIFT,
    });
    this.input.keyboard.addCapture([K.UP, K.DOWN, K.LEFT, K.RIGHT, K.SPACE]);
    this.input.keyboard.on('keydown', (e) => {
      this.engineSound.start();
      switch (e.code) {
        case 'KeyC': this.toggleSteering(); break;
        case 'KeyB': this.toggleBike(); break;
        case 'KeyR': this.resetBike(); break;
        case 'KeyH': this.horn(); break;
        case 'KeyV': this.toggleSound(); break;
        case 'KeyE': case 'KeyX': this.shift(1); break;
        case 'KeyQ': case 'KeyZ': this.shift(-1); break;
        case 'KeyG': this.toggleAutoShift(); break;
        case 'Digit1': case 'Digit2': case 'Digit3': this.acceptJob(Number(e.code.slice(5)) - 1); break;
        case 'Backspace': this.cancelJob(); break;
        case 'KeyF': this.startRefuel(); break;
      }
    });
    this.input.on('pointerdown', () => this.engineSound.start());
  }

  toggleSteering() {
    const i = STEERING_MODES.indexOf(this.steeringMode);
    this.steeringMode = STEERING_MODES[(i + 1) % STEERING_MODES.length];
  }

  toggleBike() {
    const b = this.bike;
    b.type = b.type === 'petrol' ? 'electric' : 'petrol';
    const gears = BIKES[b.type].gears;
    if (gears) b.gear = bestGear(gears, Math.max(0, forwardSpeed(b)));
    this.events.emit('bark', BIKES[b.type].name);
  }

  shift(dir) {
    const e = shiftGear(this.bike, dir);
    if (e && BARKS[e.type]) this.events.emit('bark', BARKS[e.type]);
  }

  toggleAutoShift() {
    this.bike.autoShift = !this.bike.autoShift;
    this.events.emit('bark', this.bike.autoShift ? 'Auto shift on' : 'Manual shift');
  }

  resetBike() {
    const { type, autoShift } = this.bike;
    this.bike = createBike(this.world, type);
    this.bike.autoShift = autoShift;
    this.#placeBike();
  }

  // ---------------------------------------------------------------------------
  // Money: jobs, stations, fines, day end
  // ---------------------------------------------------------------------------

  acceptJob(index) {
    if (this.board.active) {
      this.events.emit('bark', 'Finish your job first (Backspace cancels it)');
      return;
    }
    const job = acceptOffer(this.board, index);
    if (job) this.events.emit('bark', `Go to ${job.from.name}`);
  }

  cancelJob() {
    if (!this.board.active) return;
    cancelJob(this.board, this.bike);
    this.events.emit('bark', 'Job cancelled. No pay.');
  }

  /** What a stop at this station would cost, or a reason why you cannot use it. */
  stationOffer() {
    const kind = this.station;
    if (!kind || this.refuel) return null;
    const type = this.bike.type;
    if (kind === 'garage') {
      const q = garageQuote(this.bike);
      const meter = Math.round(serviceDue(this.bike) * 100);
      if (q.nothing) return { ok: false, text: `Garage. The bike is fine (service meter ${meter}%).` };
      if (this.wallet.cash < q.cost && this.bike.brokenDown) {
        return { ok: true, text: `F: Emergency repair on credit (${q.cost.toLocaleString('en')} RWF, ${MAINTENANCE.serviceSeconds} s). Cash goes below zero` };
      }
      if (this.wallet.cash < q.cost) return { ok: false, text: `A service costs ${q.cost.toLocaleString('en')} RWF. Not enough cash.` };
      const pads = q.pads ? ' + new brake pads' : '';
      return { ok: true, text: `F: Service the bike${pads} (${q.cost.toLocaleString('en')} RWF, ${MAINTENANCE.serviceSeconds} s). Meter ${meter}%` };
    }
    if (kind === 'fuel' && type !== 'petrol') return { ok: false, text: 'Fuel station. Your electric moto needs a swap station.' };
    if (kind === 'swap' && type !== 'electric') return { ok: false, text: 'Swap station. Your petrol moto needs a fuel station.' };
    if (kind === 'fuel') {
      const cost = fuelFillCost(this.bike);
      if (cost < 40) return { ok: false, text: 'The tank is full.' };
      return { ok: true, text: `F: Fill up (${cost.toLocaleString('en')} RWF, ${MONEY.fuelSeconds} s + queue)` };
    }
    if (this.bike.energy > 0.97) return { ok: false, text: 'The battery is full.' };
    if (this.wallet.cash < MONEY.swapFee) return { ok: false, text: `A swap costs ${MONEY.swapFee.toLocaleString('en')} RWF. Not enough cash.` };
    return { ok: true, text: `F: Swap battery (${MONEY.swapFee.toLocaleString('en')} RWF, ${MONEY.swapSeconds} s)` };
  }

  startRefuel() {
    const offer = this.stationOffer();
    if (!offer) return;
    if (!offer.ok) {
      this.events.emit('bark', offer.text);
      return;
    }
    const total =
      this.station === 'fuel' ? MONEY.fuelSeconds + Math.random() * MONEY.fuelQueueMaxSeconds :
      this.station === 'garage' ? MAINTENANCE.serviceSeconds : MONEY.swapSeconds;
    this.refuel = { kind: this.station, timeLeft: total, total };
  }

  #finishRefuel() {
    const kind = this.refuel.kind;
    this.refuel = null;
    const r =
      kind === 'fuel' ? buyFuel(this.wallet, this.bike) :
      kind === 'swap' ? swapBattery(this.wallet, this.bike) : payGarage(this.wallet, this.bike);
    const label = kind === 'fuel' ? 'Fuel' : kind === 'swap' ? 'Battery swap' : r.pads ? 'Service and brake pads' : 'Service';
    if (r.ok) this.events.emit('money', -r.cost, label);
    else this.events.emit('bark', 'Not enough cash');
  }

  #pay(category, amount, label) {
    if (amount <= 0) return;
    spend(this.wallet, category, amount);
    this.events.emit('money', -amount, label);
  }

  /** Money and law effects of one physics step. */
  #economyStep(bikeEvents) {
    const b = this.bike;
    for (const e of bikeEvents) {
      const cost = repairCost(e);
      if (cost) this.#pay('repairs', cost, REPAIR_LABELS[e.type]);
    }
    for (const e of updateJob(this.board, b, bikeEvents, FIXED_DT)) {
      if (e.type === 'pickup') {
        this.events.emit('bark', e.job.type === 'passenger' ? `Passenger on board. Go to ${e.job.to.name}` : `${e.job.kg} kg cargo loaded. Go to ${e.job.to.name}`);
      } else {
        earn(this.wallet, e.job.type === 'passenger' ? 'fares' : 'cargo', e.fare);
        this.events.emit('money', e.fare, e.job.type === 'passenger' ? 'Fare' : 'Cargo delivered');
        if (e.tip > 0) {
          earn(this.wallet, 'tips', e.tip);
          this.time.delayedCall(700, () => this.events.emit('money', e.tip, `Tip (comfort ${Math.round(e.job.comfort)}%)`));
        }
      }
    }
    const kmh = Math.abs(forwardSpeed(b)) * 3.6;
    for (const e of checkCameras(this.world, this.cameraState, b, kmh)) {
      this.events.emit('camera', e);
      if (e.fine) this.#pay('fines', e.fine, `Speed camera: ${Math.round(e.speedKmh)} km/h in a ${e.limitKmh} zone`);
    }
  }

  #updateStation() {
    const b = this.bike;
    const slow = Math.abs(forwardSpeed(b)) * 3.6 < 3;
    this.station = null;
    if (!slow) return;
    for (const kind of ['fuel', 'swap', 'garage']) {
      for (const p of this.world.placesWithTag(kind)) {
        if (Math.hypot(b.x - p.x * WORLD.tileMetres, b.y - p.y * WORLD.tileMetres) < STATION_RANGE_METRES) this.station = kind;
      }
    }
  }

  #endDay() {
    if (this.board.active) cancelJob(this.board, this.bike);
    this.refuel = null;
    const summary = endDay(this.wallet, this.bike);
    this.dayOver = true;
    this.scene.pause();
    this.scene.launch('dayEnd', { summary, onContinue: (choice) => this.#startDay(choice) });
  }

  /** choice: 'next' (next day), 'loan' (take the loan, then the next day) or 'restart' (new game after game over). */
  #startDay(choice = 'next') {
    this.dayTime = 0;
    this.dayOver = false;
    const { type, autoShift, energy, brakePads, brakesWarned } = this.bike;
    this.bike = createBike(this.world, type);
    if (choice === 'restart') {
      this.wallet = createWallet();
      this.bike.autoShift = autoShift;
    } else {
      if (choice === 'loan') takeLoan(this.wallet);
      Object.assign(this.bike, { autoShift, energy, brakePads, brakesWarned });
    }
    this.board = createJobBoard(this.world, Date.now() & 0xffff);
    this.#placeBike();
    this.scene.resume();
  }

  /** Game clock as hours (6.0 .. 22.0). */
  get clockHours() {
    return DAY.startHour + ((DAY.endHour - DAY.startHour) * this.dayTime) / DAY.realSeconds;
  }

  /** Debug and tests: move the bike to a tile position and snap the camera there. */
  teleport(tx, ty, headingDeg = 0) {
    const b = this.bike;
    Object.assign(b, { x: tx * WORLD.tileMetres, y: ty * WORLD.tileMetres, vx: 0, vy: 0, heading: (headingDeg * Math.PI) / 180 });
    this.chunks.update(b.x, b.y);
    this.#placeBike();
    this.camPos = { x: this.bikeScreen.x, y: this.bikeScreen.y - 10 };
  }

  horn() {
    this.engineSound.start();
    this.engineSound.horn();
    this.events.emit('bark', 'Beep beep!');
  }

  toggleSound() {
    this.engineSound.setEnabled(!this.engineSound.enabled);
    this.events.emit('bark', this.engineSound.enabled ? 'Sound on' : 'Sound off');
  }

  #updateZoom() {
    const { width, height } = this.scale.gameSize;
    // Phones in landscape are smaller than 480 × 270 × 1.5, but ×1 makes the bike too small. Use ×2 or more.
    const minZoom = Math.min(width, height) >= 320 ? 2 : 1;
    const zoom = Math.max(minZoom, Math.round(Math.min(width / VIEW.internalWidth, height / VIEW.internalHeight)));
    this.cameras.main.setZoom(zoom);
  }

  #rawInput() {
    const k = this.keys;
    return {
      keys: {
        up: k.up.isDown || k.w.isDown,
        down: k.down.isDown || k.s.isDown,
        left: k.left.isDown || k.a.isDown,
        right: k.right.isDown || k.d.isDown,
        throttle: k.space.isDown,
        brake: k.shift.isDown,
      },
      stick: this.touch.stick,
      touchThrottle: this.touch.throttle,
      touchBrake: this.touch.brake,
    };
  }

  update(_time, deltaMs) {
    const dt = Math.min(0.1, deltaMs / 1000);
    this.accumulator += dt;
    const raw = this.#rawInput();
    while (this.accumulator >= FIXED_DT) {
      // While you fill up or swap, the bike stands still.
      this.controls = this.refuel ? { throttle: 0, brake: 1, steer: 0 } : readControls(this.steeringMode, raw, this.bike);
      const events = stepBike(this.bike, this.controls, this.world, FIXED_DT);
      for (const e of events) {
        if (e.type === 'wall' && e.speed < 4) continue; // no bark when you only touch a wall
        if (BARKS[e.type]) this.events.emit('bark', BARKS[e.type]);
      }
      this.#economyStep(events);
      this.accumulator -= FIXED_DT;
    }
    if (this.refuel && (this.refuel.timeLeft -= dt) <= 0) this.#finishRefuel();
    this.#updateStation();
    updateBoard(this.board, this.world, dt);
    this.speedLimit = speedLimitAt(this.world, this.bike.x, this.bike.y);
    this.#updateMarker();
    this.chunks.update(this.bike.x, this.bike.y);
    this.#placeBike();
    this.#updateSmoke(dt);
    this.#updateOcclusion();
    this.#updateCamera(dt);
    this.chunks.cull(this.cameras.main.worldView);
    this.engineSound.update(this.bike.type, Math.min(1, this.bike.revs), this.controls.throttle);
    this.dayTime += dt;
    if (this.dayTime >= DAY.realSeconds) this.#endDay();
  }

  // Cameras and signs stand beside the road. They sort by depth like the blocks.
  #createProps() {
    addCanvasTexture(this, 'camera', drawCamera());
    const ox = PROP_CANVAS.groundX / PROP_CANVAS.width, oy = PROP_CANVAS.groundY / PROP_CANVAS.height;
    const place = (key, x, y) => {
      const s = toScreen(x * WORLD.tileMetres, y * WORLD.tileMetres, this.world.heightAt(x * WORLD.tileMetres, y * WORLD.tileMetres));
      this.add.image(s.x, s.y, key).setOrigin(ox, oy).setDepth(x + y);
    };
    for (const c of this.world.cameras) place('camera', c.x, c.y);
    for (const sign of this.world.signs) {
      const key = `sign-${sign.limitKmh}`;
      if (!this.textures.exists(key)) addCanvasTexture(this, key, drawSpeedSign(sign.limitKmh));
      place(key, sign.x, sign.y);
    }
    addCanvasTexture(this, 'ring-pickup', drawMarkerRing(0x44bc9d));
    addCanvasTexture(this, 'ring-dropoff', drawMarkerRing(0xf6f5ec));
    addCanvasTexture(this, 'pin-pickup', drawMarkerPin(0x44bc9d));
    addCanvasTexture(this, 'pin-dropoff', drawMarkerPin(0xf6f5ec));
    addCanvasTexture(this, 'arrow', drawArrow());
    addCanvasTexture(this, 'waiting-passenger', drawWaitingPassenger());
    addCanvasTexture(this, 'waiting-cargo', drawCargoPile());
    this.waiting = this.add.image(0, 0, 'waiting-passenger').setOrigin(ox, oy).setVisible(false);
    this.markerRing = this.add.image(0, 0, 'ring-pickup').setVisible(false);
    this.markerPin = this.add.image(0, 0, 'pin-pickup').setOrigin(0.5, 1).setDepth(1e5).setVisible(false);
    this.arrow = this.add.image(0, 0, 'arrow').setDepth(1e6).setVisible(false);
  }

  // Show where to go: a ring and a pin on the target place, and an arrow beside the bike.
  #updateMarker() {
    const job = this.board.active;
    const visible = !!job;
    this.markerRing.setVisible(visible);
    this.markerPin.setVisible(visible);
    this.arrow.setVisible(visible);
    this.waiting.setVisible(!!job && job.stage === 'toPickup');
    if (!job) return;
    const kind = job.stage === 'toPickup' ? 'pickup' : 'dropoff';
    const t = jobTarget(job);
    const wx = t.x * WORLD.tileMetres, wy = t.y * WORLD.tileMetres;
    const s = toScreen(wx, wy, this.world.heightAt(wx, wy));
    const pulse = 1 + 0.12 * Math.sin(this.time.now / 160);
    this.markerRing.setTexture(`ring-${kind}`).setPosition(s.x, s.y).setScale(pulse).setDepth((wx + wy) / WORLD.tileMetres - 0.5);
    this.markerPin.setTexture(`pin-${kind}`).setPosition(s.x, s.y - 30 - 3 * Math.sin(this.time.now / 220));
    // The passenger (or the cargo) waits beside the marker.
    this.waiting.setTexture(job.type === 'passenger' ? 'waiting-passenger' : 'waiting-cargo')
      .setPosition(s.x + 12, s.y - 2).setDepth((wx + wy) / WORLD.tileMetres + 0.3);
    const dx = s.x - this.bikeScreen.x, dy = s.y - this.bikeScreen.y;
    const d = Math.hypot(dx, dy);
    this.arrow.setVisible(d > 40);
    this.arrow.setPosition(this.bikeScreen.x + (dx / d) * 24, this.bikeScreen.y - 10 + (dy / d) * 16).setRotation(Math.atan2(dy, dx));
    this.targetDistance = Math.hypot(this.bike.x - wx, this.bike.y - wy);
  }

  #placeBike() {
    const b = this.bike;
    const s = toScreen(b.x, b.y, b.z);
    const bounce = b.bump > 0 ? Math.sin((b.bump / 0.3) * Math.PI) * 2 : 0;
    const depth = (b.x + b.y) / WORLD.tileMetres;
    const key = `bike-${b.type}-${b.loadType ?? 'none'}-${bikeFrameForHeading(b.heading)}`;
    this.bikeScreen = s;
    this.bikeDepth = depth;
    this.bikeSprite.setTexture(key).setPosition(s.x, s.y - bounce).setDepth(depth);
    this.ghost.setTexture(key).setPosition(s.x, s.y - bounce);
    this.shadow.setPosition(s.x, s.y).setDepth(depth - 0.002);
    const electric = b.type === 'electric';
    this.glow.setVisible(electric).setPosition(s.x, s.y).setDepth(depth - 0.003);
    if (electric) this.glow.setAlpha(0.75 + 0.25 * Math.sin(this.time.now / 180));
  }

  #updateSmoke(dt) {
    const b = this.bike;
    this.puffTimer -= dt;
    if (BIKES[b.type].smoke && this.puffTimer <= 0) {
      const throttle = this.controls.throttle;
      this.puffTimer = throttle > 0 ? 0.06 : 0.3;
      const back = 1.0; // metres behind the bike centre
      const px = b.x - Math.cos(b.heading) * back;
      const py = b.y - Math.sin(b.heading) * back;
      const s = toScreen(px, py, b.z + 0.45);
      let puff = this.puffs.find((p) => !p.img.visible);
      if (!puff) {
        puff = { img: this.add.image(0, 0, 'puff') };
        this.puffs.push(puff);
      }
      puff.img.setVisible(true).setPosition(s.x, s.y).setDepth((px + py) / WORLD.tileMetres);
      puff.life = puff.maxLife = throttle > 0 ? 0.9 : 0.6;
      puff.drift = (Math.random() - 0.5) * 6;
    }
    for (const p of this.puffs) {
      if (!p.img.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.img.setVisible(false);
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      p.img.y -= 9 * dt;
      p.img.x += p.drift * dt;
      p.img.setScale(1 + t * 1.6).setAlpha(0.7 * (1 - t));
    }
  }

  // Hills hide things: fade blocks in front of the bike and show the bike outline.
  #updateOcclusion() {
    const s = this.bikeScreen;
    const samples = [[0, -3], [0, -10], [0, -18], [0, -24], [-7, -3], [7, -3]];
    // Fade the whole building (all its tiles), not only the tiles that cover the bike.
    const hidingGroups = new Set();
    const blockSprites = this.chunks.blockSprites;
    for (const bs of blockSprites) {
      if (!bs.img.visible || bs.depth <= this.bikeDepth || Math.abs(bs.block.tx + bs.block.ty - this.bikeDepth) > 8) continue;
      const c = bs.canvas;
      if (samples.some(([dx, dy]) => c.alphaAt(Math.floor(s.x + dx - c.ox), Math.floor(s.y + dy - c.oy)) > 0)) {
        hidingGroups.add(groupKey(bs.block));
      }
    }
    for (const bs of blockSprites) bs.img.setAlpha(hidingGroups.has(groupKey(bs.block)) ? 0.45 : 1);
    const occluded = hidingGroups.size > 0;
    this.occluded = occluded;
    this.ghost.setVisible(occluded);
  }

  #updateCamera(dt) {
    const b = this.bike;
    const vel = toScreen(b.vx, b.vy, 0); // screen pixels per second
    let ax = vel.x * VIEW.lookAheadSeconds;
    let ay = vel.y * VIEW.lookAheadSeconds;
    const len = Math.hypot(ax, ay);
    if (len > VIEW.lookAheadMaxPx) {
      ax *= VIEW.lookAheadMaxPx / len;
      ay *= VIEW.lookAheadMaxPx / len;
    }
    const k = 1 - Math.pow(1 - VIEW.cameraLerp, dt * 60);
    this.camPos.x += (this.bikeScreen.x + ax - this.camPos.x) * k;
    this.camPos.y += (this.bikeScreen.y - 10 + ay - this.camPos.y) * k;
    this.cameras.main.centerOn(this.camPos.x, this.camPos.y);
  }
}

function groupKey(block) {
  if (block.kind === 'building') return 'building-' + block.groupId;
  if (block.kind === 'monument') return 'monument';
  return block.kind + '-' + block.tx + ',' + block.ty;
}
