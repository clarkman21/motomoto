import Phaser from 'phaser';
import { VIEW, WORLD, BIKES, MONEY, MAINTENANCE, PEOPLE, TRAFFIC, STREAK, DISTRICTS, BUS_PARK, FUEL, LEVELS } from '../config.js';
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
import { createBike, stepBike, forwardSpeed, shiftGear, bestGear, resetToRoad } from '../sim/bike.js';
import { readControls, STEERING_MODES, STEERING_LABELS } from '../sim/controls.js';
import { EngineSound } from '../audio/engine-sound.js';
import { createWallet, earn, spend, buyFuel, swapBattery, fuelFillCost, fuelChoices, repairCost, endDay, takeLoan, payGarage } from '../sim/economy.js';
import { garageQuote, serviceDue } from '../sim/maintenance.js';
import { createJobBoard, updateBoard, acceptOffer, cancelJob, updateJob, jobTarget, acceptHail, tripMetres, passengerWaits } from '../sim/jobs.js';
import { createCameraState, checkCameras, speedLimitAt } from '../sim/law.js';
import { buildRoadGraph, openRoads } from '../sim/roads.js';
import { createTraffic, stepTraffic, insideVehicle, sendBusToPark } from '../sim/traffic.js';
import { mulberry32 } from '../sim/jobs.js';
import { TrafficView, isDiesel } from './TrafficView.js';
import { createPeople, stepPeople, hailInReach, insidePerson, busArrivalHails, honkAt } from '../sim/people.js';
import { startRace, chaseHail, stepRivals, cancelMission } from '../sim/rivals.js';
import { PeopleView } from './PeopleView.js';
import { PERSON_LOOKS } from '../world/vehicle-sprites.js';
import { trafficHonks } from '../sim/honk.js';
import { levelSettings, milestoneReady, buyMilestone, restartLevel, streakMultiplier, updateStreak, savingsTarget } from '../sim/levels.js';
import { loadGame, saveGame, clearSave, loadSettings, saveSettings } from './save.js';
import { deliveryLine } from '../sim/family.js';
import { jobFuel, legFuel } from '../sim/fuel.js';
import { LightsView } from './LightsView.js';
import { BarrierView } from './BarrierView.js';
import { GarageView } from './GarageView.js';
import { MarketView } from './MarketView.js';
import { AttendantView } from './AttendantView.js';
import { PoliceView } from './PoliceView.js';
import { SignView } from './SignView.js';
import { daylight } from '../sim/daylight.js';

const FIXED_DT = 1 / 120; // physics step in seconds
const BARKS = {
  bumpHard: 'Speed bump too fast!',
  wall: 'Bang!',
  empty: 'Out of energy! Hold throttle to push the bike to a station',
  pothole: 'Pothole! Speed −30%, more wear',
  overRev: 'Too fast to shift down',
  noGears: 'Electric moto: no gears',
  lugging: 'Shift down!',
  offRoad: 'Off road! The bike wears 4 times faster',
  serviceSoon: 'Service soon: 80%. Plan a garage visit',
  serviceDue: 'Service due! The bike loses power. Go to the garage',
  oilSoon: 'Oil change soon: 80%. High revs use the oil faster',
  oilDue: 'Oil change due! The engine loses power. Go to the garage',
  breakdown: 'Breakdown! Push the bike to the garage',
};
const REPAIR_LABELS = { wall: 'Crash damage' };
const STATION_RANGE_METRES = 6;

export class RideScene extends Phaser.Scene {
  constructor() {
    super('ride');
  }

  /** data.menu: the welcome menu is on top. The ride waits (the city moves behind the menu) until startGame(). */
  create(data = {}) {
    this.started = !data.menu;
    this.world = new World(buildKigaliMap());
    this.cameras.main.setBackgroundColor('#1d2a33');
    this.cameras.main.setRoundPixels(false); // smooth sub pixel camera; textures stay sharp (antialias off)

    // Ground and blocks stream in chunks near the bike (see chunks.js).
    this.chunks = new ChunkStreamer(this, this.world);

    // Bike frames, shadow, glow and smoke.
    for (const type of Object.keys(BIKES)) {
      for (const load of BIKE_LOADS) {
        for (let f = 0; f < BIKE_DIRECTIONS; f++) addCanvasTexture(this, `bike-${type}-${load}-${f}`, drawBike(type, f, load));
        // The rider walks and pushes the bike (out of fuel or broken down). A passenger gets off.
        if (load === 'passenger') continue;
        for (let f = 0; f < BIKE_DIRECTIONS; f++) for (const step of [0, 1]) addCanvasTexture(this, `push-${type}-${load}-${f}-${step}`, drawBike(type, f, load, true, `push${step}`));
      }
    }
    addCanvasTexture(this, 'shadow', drawShadow());
    addCanvasTexture(this, 'glow', drawGlow());
    addCanvasTexture(this, 'puff', drawPuff());
    addCanvasTexture(this, 'puff-dark', drawPuff(true));
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
    // The moto garages: motos, mechanics, oil stains and the name sign.
    this.garages = new GarageView(this, this.world);
    this.markets = new MarketView(this, this.world);
    this.attendant = new AttendantView(this, this.world);
    // Police on the junction corners of the whole map (the full road network, not only the open roads).
    this.police = new PoliceView(this, this.world, buildRoadGraph(this.world.roads));
    this.signs = new SignView(this, this.world); // names on landmark buildings
    // Night lights and the colour of the day (see LightsView.js).
    this.lights = new LightsView(this, this.world);
    // These stay bright at night: they are not tinted.
    for (const obj of [this.ghost, this.glow, this.markerRing, this.markerPin, this.arrow]) obj.noAmbient = true;

    // Traffic, people, jobs and the open districts come from the level (see #applyLevel).
    this.barriers = new BarrierView(this, this.world);
    this.nearAgents = [];
    this.nearPeople = [];
    this.rng = mulberry32((Date.now() >> 4) & 0xffff);
    this.hailOffer = null;
    this.debug = new URLSearchParams(window.location.search).has('debug');
    this.raceRival = null; // a rival who races you to your pickup
    addCanvasTexture(this, 'pin-rival', drawMarkerPin(0xec5825));
    this.rivalPin = this.add.image(0, 0, 'pin-rival').setOrigin(0.5, 1).setDepth(1e5).setVisible(false);
    this.rivalPin.noAmbient = true;
    // The bike collides with vehicles, people and poles near it (see sim/collide.js).
    this.world.dynamicAgents = [];

    // Continue a saved game, or start a new one.
    const saved = loadGame();
    this.wallet = saved?.wallet ?? createWallet();
    this.wallet.ledger = createWallet().ledger;
    this.bike = createBike(this.world, levelSettings(this.wallet).bikeType);
    if (saved?.bike) Object.assign(this.bike, saved.bike);
    else this.bike.energy = FUEL.startLevel; // a new game starts with a part full tank: plan your first fill up
    this.bike.brakeWearKm ??= 0; // saves from before the brakes were part of the service
    this.#applyLevel();
    this.cameraState = createCameraState(this.world);
    this.dayTime = 0; // real seconds since the start of the shift
    this.station = null; // the station the bike stands at: 'fuel' or 'swap'
    this.refuel = null; // { kind, timeLeft, total } while you fill up or swap
    this.speedLimit = speedLimitAt(this.world, this.bike.x, this.bike.y);
    this.steeringMode = 'bike';
    this.controls = { throttle: 0, brake: 0, steer: 0 };
    this.touch = { stick: { x: 0, y: 0, active: false }, throttle: false, brake: false };
    this.accumulator = 0;
    this.engineSound = new EngineSound();
    this.occluded = false;
    this.showMap = true;

    // Settings from an earlier visit (sound, steering, gears).
    const settings = loadSettings();
    if (settings) {
      this.engineSound.setEnabled(settings.sound !== false);
      if (STEERING_MODES.includes(settings.steering)) this.steeringMode = settings.steering;
      this.bike.autoShift = !!settings.autoShift;
      this.showMap = settings.map !== false;
    }

    this.chunks.update(this.bike.x, this.bike.y);
    this.#setupKeys();
    this.#updateZoom();
    this.scale.on('resize', () => this.#updateZoom());
    this.#placeBike();
    const s = this.bikeScreen;
    this.cameras.main.centerOn(s.x, s.y);
    this.camPos = { x: s.x, y: s.y };
    this.attractTime = 0;

    this.#snapshotShift();
    if (this.started) this.scene.launch('hud');
  }

  // ---------------------------------------------------------------------------
  // Menus: start, pause, restart the shift, back to the main menu (see MenuScene.js)
  // ---------------------------------------------------------------------------

  /** From the welcome menu. how: 'continue' (the saved or paused game) or 'new' (a new game). */
  startGame(how) {
    if (how === 'new') this.#startDay('newGame'); // also saves the start of the shift for "Restart shift"
    this.started = true;
    this.#snapCamera();
    this.resumeGame();
  }

  /** Close the menu and play on. */
  resumeGame() {
    this.scene.resume();
    if (this.scene.isPaused('hud')) this.scene.resume('hud');
    else if (!this.scene.isActive('hud')) this.scene.launch('hud');
    this.scene.setVisible(true, 'hud');
    this.engineSound.start();
  }

  /** Esc, P or the pause button: stop the game and show the pause menu. */
  openPause() {
    if (!this.started || this.scene.isActive('dayEnd') || this.scene.isPaused()) return;
    this.scene.pause();
    if (this.scene.isActive('hud')) this.scene.pause('hud');
    this.engineSound.silence();
    this.engineSound.pause();
    this.scene.launch('menu', { mode: 'pause' });
  }

  /** From the pause menu: the welcome menu (Continue goes back to this game). */
  toMainMenu() {
    this.scene.setVisible(false, 'hud');
    this.scene.get('menu').scene.restart({ mode: 'welcome' });
  }

  /** Start this shift again: the money, the bike and the clock go back to the start of the shift. */
  restartShift() {
    const snap = this.shiftStart;
    if (this.board.active) cancelJob(this.board, this.bike);
    cancelMission(this.raceRival);
    this.wallet = structuredClone(snap.wallet);
    this.bike = structuredClone(snap.bike);
    this.dayTime = 0;
    this.dayOver = false;
    this.refuel = null;
    this.raceRival = null;
    this.#applyLevel();
    this.cameraState = createCameraState(this.world);
    this.#snapCamera();
    this.events.emit('bark', 'The shift starts again');
    this.resumeGame();
  }

  #snapshotShift() {
    this.shiftStart = { wallet: structuredClone(this.wallet), bike: structuredClone(this.bike) };
  }

  #snapCamera() {
    this.chunks.update(this.bike.x, this.bike.y);
    this.#placeBike();
    this.camPos = { x: this.bikeScreen.x, y: this.bikeScreen.y - 10 };
    this.cameras.main.centerOn(this.camPos.x, this.camPos.y);
  }

  #saveSettings() {
    saveSettings({ sound: this.engineSound.enabled, steering: this.steeringMode, autoShift: !!this.bike.autoShift, map: this.showMap });
  }

  /** Behind the welcome menu: the camera moves slowly over Nyabugogo at dusk, and the traffic drives. */
  #attract(dt) {
    const T = WORLD.tileMetres;
    this.attractTime = (this.attractTime + dt) % 160;
    const x = 22 * T + this.attractTime * 2.4, y = 16 * T + this.attractTime * 0.5;
    const s = toScreen(x, y, this.world.heightAt(x, y));
    this.cameras.main.centerOn(s.x, s.y);
    this.chunks.update(x, y);
    const view = this.cameras.main.worldView;
    this.chunks.cull(view);
    stepTraffic(this.traffic, this.world, [], Math.min(dt, 0.05));
    this.trafficView.update(this.world, view);
    this.peopleView.update(this.world, view, this.time.now);
    this.daylight = daylight(19);
    this.chunks.night = this.daylight.night;
    for (const bs of this.chunks.blockSprites) bs.glow?.setAlpha(this.chunks.night);
    this.lights.update(this.daylight, view, this.bike, false);
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
      if (!this.started) return; // the welcome menu has the keyboard
      this.engineSound.start();
      // The fuel choice at a station takes 1, 2, 3 and Esc.
      if (this.fuelChoice) {
        const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
        if (n >= 0) return this.chooseFuel(n);
        if (e.code === 'Escape') return (this.fuelChoice = null);
      }
      switch (e.code) {
        case 'Escape': case 'KeyP': this.openPause(); break;
        case 'KeyC': this.toggleSteering(); break;
        case 'KeyB': this.toggleBike(); break;
        case 'KeyR': this.resetBike(); break;
        case 'KeyM': this.toggleMap(); break;
        case 'KeyH': this.horn(); break;
        case 'KeyV': this.toggleSound(); break;
        case 'KeyE': case 'KeyX': this.shift(1); break;
        case 'KeyQ': case 'KeyZ': this.shift(-1); break;
        case 'KeyG': this.toggleAutoShift(); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': this.acceptJob(Number(e.code.slice(5)) - 1); break;
        case 'Backspace': this.cancelJob(); break;
        case 'KeyF': this.startRefuel(); break;
        case 'KeyK': if (this.debug) this.dayTime = this.level.shift.realSeconds; break; // debug: end the shift now
      }
    });
    this.input.on('pointerdown', () => this.engineSound.start());
  }

  toggleSteering() {
    const i = STEERING_MODES.indexOf(this.steeringMode);
    this.steeringMode = STEERING_MODES[(i + 1) % STEERING_MODES.length];
    this.events.emit('bark', STEERING_LABELS[this.steeringMode]);
    this.#saveSettings();
  }

  toggleBike() {
    // Your bike comes from the level (electric after the level 4 milestone). B works only with ?debug in the address.
    if (!this.debug) {
      this.events.emit('bark', this.bike.type === 'petrol' ? 'Save for the electric moto: level 4 milestone' : 'You ride electric');
      return;
    }
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

  /** M: show or hide the minimap. */
  toggleMap() {
    this.showMap = !this.showMap;
    this.#saveSettings();
  }

  toggleAutoShift() {
    this.bike.autoShift = !this.bike.autoShift;
    this.events.emit('bark', this.bike.autoShift ? 'Auto shift on' : 'Manual shift');
    this.#saveSettings();
  }

  /** R: put a stuck bike back on the nearest road. Fuel, wear and the job stay as they are. */
  resetBike() {
    if (!resetToRoad(this.world, this.bike)) return;
    this.events.emit('bark', 'Back on the road');
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
    if (index === 0 && this.hailOffer && this.acceptHail()) return; // key 1 takes a street hail in reach first
    const job = acceptOffer(this.board, index);
    if (!job) return;
    this.raceRival = startRace(this.traffic, this.bike, { ...job.from, jobId: job.id }, this.rng, this.level.raceChance);
    this.events.emit('bark', this.raceRival ? `Go to ${job.from.name}. A rival rider is racing you!` : `Go to ${job.from.name}`);
  }

  cancelJob() {
    if (!this.board.active) return;
    cancelMission(this.raceRival);
    this.raceRival = null;
    cancelJob(this.board, this.bike);
    updateStreak(this.wallet, false);
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
      const list = q.items.map((i) => `${i.name} ${i.cost.toLocaleString('en')}`).join(' + ');
      if (this.wallet.cash < q.cost && this.bike.brokenDown) {
        return { ok: true, text: `F: Emergency repair on credit: ${list} = ${q.cost.toLocaleString('en')} RWF. Cash goes below zero` };
      }
      if (this.wallet.cash < q.cost) return { ok: false, text: `${list} = ${q.cost.toLocaleString('en')} RWF. Not enough cash.` };
      return { ok: true, text: `F: Service (meter ${meter}%): ${list} = ${q.cost.toLocaleString('en')} RWF, ${MAINTENANCE.serviceSeconds} s` };
    }
    if (kind === 'office') return this.#officeOffer();
    if (kind === 'fuel' && type !== 'petrol') return { ok: false, text: 'Fuel station. Your electric moto needs a swap station.' };
    if (kind === 'swap' && type !== 'electric') return { ok: false, text: 'Swap station. Your petrol moto needs a fuel station.' };
    if (kind === 'fuel') {
      const cost = fuelFillCost(this.bike, this.fuelPrice);
      if (cost < 40) return { ok: false, text: 'The tank is full.' };
      if (this.fuelChoice) return { ok: true, text: 'Choose 1, 2 or 3 · F: cancel' };
      return { ok: true, text: `F: Buy fuel (tank ${Math.round(this.bike.energy * 100)}%)` };
    }
    if (this.bike.energy > 0.97) return { ok: false, text: 'The battery is full.' };
    if (this.wallet.cash < MONEY.swapFee) return { ok: false, text: `A swap costs ${MONEY.swapFee.toLocaleString('en')} RWF. Not enough cash.` };
    return { ok: true, text: `F: Swap battery (${MONEY.swapFee.toLocaleString('en')} RWF, ${MONEY.swapSeconds} s)` };
  }

  /** At the Ampersand showroom: buy the electric moto (the level 4 milestone) when you saved enough. */
  #officeOffer() {
    const L = this.level, money = (n) => `${n.toLocaleString('en')} RWF`;
    if (this.wallet.perks.electric) return { ok: false, text: 'Ampersand showroom. Murakaza neza! Swap your battery at any Ampersand station.' };
    if (L.buyAt !== 'office') {
      const e = LEVELS.find((l) => l.buyAt === 'office');
      return { ok: false, text: `Ampersand showroom. Electric motos are for sale from level ${e.n}. Keep saving!` };
    }
    if (this.board.active) return { ok: false, text: 'Ampersand showroom. Finish your job first, then come back to buy your moto.' };
    if (!milestoneReady(this.wallet)) return { ok: false, text: `Ampersand showroom. Save ${money(savingsTarget(this.wallet))} to buy your electric moto (you have ${money(this.wallet.cash)}).` };
    return { ok: true, text: `F: Buy your Ampersand electric moto (${money(L.goal)} down payment)` };
  }

  /** Buy the electric moto at the showroom: you ride away on it, and the next level starts now. */
  #buyElectric() {
    const offer = this.#officeOffer();
    if (!offer.ok) return;
    const bought = buyMilestone(this.wallet);
    if (!bought) return;
    const { x, y, heading, autoShift } = this.bike;
    this.bike = createBike(this.world, levelSettings(this.wallet).bikeType);
    Object.assign(this.bike, { x, y, heading, autoShift, z: this.world.heightAt(x, y) });
    this.station = null;
    const shift = this.level.shift; // today's shift goes on; the new level's shift starts tomorrow
    this.#applyLevel();
    this.level.shift = shift;
    this.#placeBike();
    this.#save();
    this.engineSound.jingle('levelUp');
    this.scene.pause();
    this.scene.launch('dayEnd', { levelUp: { bought, next: this.level }, onContinue: () => this.scene.resume() });
  }

  startRefuel() {
    const offer = this.stationOffer();
    if (!offer) return;
    if (!offer.ok) {
      this.events.emit('bark', offer.text);
      return;
    }
    if (this.station === 'office') {
      this.#buyElectric();
      return;
    }
    // At a fuel station you choose how much to buy (see chooseFuel).
    if (this.station === 'fuel') {
      this.fuelChoice = this.fuelChoice ? null : fuelChoices(this.bike, this.fuelPrice, this.#nextJobFuel());
      return;
    }
    const total =
      this.station === 'fuel' ? MONEY.fuelSeconds + Math.random() * MONEY.fuelQueueMaxSeconds :
      this.station === 'garage' ? MAINTENANCE.serviceSeconds : MONEY.swapSeconds;
    this.refuel = { kind: this.station, timeLeft: total, total };
    this.#passengerAtStop();
  }

  /** Buy fuel choice i (0: the next job, 1: the next two jobs, 2: a full tank). */
  chooseFuel(i) {
    const c = this.fuelChoice?.[i];
    if (!c) return;
    if (c.cost === 0) {
      this.events.emit('bark', 'You have enough fuel for that');
      return;
    }
    if (this.wallet.cash < 10) {
      this.events.emit('bark', 'No cash for fuel');
      return;
    }
    this.fuelChoice = null;
    // A small amount is quick to pump; the queue is the same.
    const total = MONEY.fuelSeconds * Math.max(0.3, c.upTo - this.bike.energy) + Math.random() * MONEY.fuelQueueMaxSeconds;
    this.refuel = { kind: 'fuel', timeLeft: total, total, upTo: c.upTo };
    this.#passengerAtStop();
  }

  /** Fuel (tank fraction) of the next jobs, with their weight and hills: the active job first, then the cheapest offers. */
  #nextJobFuel() {
    const jobs = [];
    if (this.board.active) jobs.push({ fuel: jobFuel(this.world, this.bike, this.board.active) });
    const offers = this.board.offers.map((o) => ({ fuel: jobFuel(this.world, this.bike, o) })).sort((p, q) => p.fuel - q.fuel);
    jobs.push(...offers);
    while (jobs.length < 2) jobs.push({ fuel: legFuel(this.bike.type, FUEL.approachMetres + 1500, 5, 65) });
    return jobs;
  }

  /** Fuel estimate for each job card (updated a few times each second). */
  #updateJobFuel(dt) {
    if ((this.jobFuelTimer = (this.jobFuelTimer ?? 0) - dt) > 0) return;
    this.jobFuelTimer = 0.4;
    for (const o of this.board.offers) o.fuel = jobFuel(this.world, this.bike, o);
    if (this.board.active) this.board.active.fuel = jobFuel(this.world, this.bike, this.board.active);
  }

  #finishRefuel() {
    const { kind, upTo = 1 } = this.refuel;
    this.refuel = null;
    const r =
      kind === 'fuel' ? buyFuel(this.wallet, this.bike, this.fuelPrice, upTo) :
      kind === 'swap' ? swapBattery(this.wallet, this.bike) : payGarage(this.wallet, this.bike);
    const label = kind === 'fuel' ? 'Fuel' : kind === 'swap' ? 'Battery swap' : 'Service';
    if (r.ok) this.events.emit('money', -r.cost, label);
    else this.events.emit('bark', 'Not enough cash');
  }

  #pay(category, amount, label) {
    if (amount <= 0) return;
    if ((category === 'fines' || category === 'repairs') && this.board.active) this.board.active.clean = false; // breaks the streak
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
        if (this.raceRival) {
          cancelMission(this.raceRival);
          this.raceRival = null;
        }
        this.events.emit('bark', e.job.type === 'passenger' ? `Passenger on board. Go to ${e.job.to.name}` : `${e.job.kg} kg of ${e.job.goods === 'bananas' ? 'bananas' : 'rice'} loaded. Go to ${e.job.to.name}`);
      } else {
        earn(this.wallet, e.job.type === 'passenger' ? 'fares' : 'cargo', e.fare);
        this.events.emit('money', e.fare, e.job.type === 'passenger' ? 'Fare' : 'Cargo delivered');
        // What the money means at home (see sim/family.js).
        this.events.emit('bark', deliveryLine(e.fare));
        this.engineSound.jingle('reward');
        // Clean ride streak: a bonus on the fare, then the streak grows (or resets after a bad ride).
        const bonus = Math.round((e.fare * (streakMultiplier(this.wallet) - 1)) / 10) * 10;
        if (bonus > 0) {
          earn(this.wallet, 'tips', bonus);
          this.time.delayedCall(1300, () => this.events.emit('money', bonus, `Streak bonus ×${streakMultiplier(this.wallet).toFixed(1)}`));
        }
        updateStreak(this.wallet, e.job.clean && (e.job.type !== 'passenger' || e.job.comfort >= STREAK.minComfort) && e.job.damage < 0.05);
        if (e.tip > 0) {
          earn(this.wallet, 'tips', e.tip);
          this.time.delayedCall(700, () => this.events.emit('money', e.tip, `Tip (comfort ${Math.round(e.job.comfort)}%)`));
        }
      }
    }
    const kmh = Math.abs(forwardSpeed(b)) * 3.6;
    const cameraEvents = this.level.cameras ? checkCameras(this.world, this.cameraState, b, kmh) : [];
    for (const e of cameraEvents) {
      this.events.emit('camera', e);
      if (e.fine) this.#pay('fines', e.fine, `Speed camera: ${Math.round(e.speedKmh)} km/h in a ${e.limitKmh} zone`);
    }
  }

  /** Fuel price factor here: the level's petrol price × the district's price (cheaper in the valley). */
  get fuelPrice() {
    return this.level.petrol * (DISTRICTS[this.stationPlace?.district]?.fuelPrice ?? 1);
  }

  #updateStation() {
    const b = this.bike;
    const slow = Math.abs(forwardSpeed(b)) * 3.6 < 3;
    this.station = null;
    if (!slow) {
      this.fuelChoice = null;
      return;
    }
    for (const kind of ['fuel', 'swap', 'garage', 'office']) {
      for (const p of this.world.placesWithTag(kind)) {
        if (Math.hypot(b.x - p.x * WORLD.tileMetres, b.y - p.y * WORLD.tileMetres) < STATION_RANGE_METRES) {
          this.station = kind;
          this.stationPlace = p;
        }
      }
    }
    if (this.station !== 'fuel') this.fuelChoice = null;
  }

  /** The level's settings, traffic, people and job board. Called at the start and at each new day. */
  #applyLevel() {
    const L = (this.level = levelSettings(this.wallet));
    // The map grows with the levels: only the open districts have roads, traffic, people and jobs.
    this.world.setOpenDistricts(L.districts);
    this.barriers.update();
    this.roadGraph = buildRoadGraph(openRoads(this.world.roads, this.world.districts, L.districts));
    const stop = this.world.busStops.find((s) => s.park);
    this.parkStop = stop && L.districts.includes(this.world.districtAt(stop.x, stop.y)) ? stop : null;
    this.parkEdge = this.parkStop ? this.#edgeThrough(this.parkStop) : null;
    this.busTimer = 4;
    const counts = {};
    for (const kind of ['car', 'bus', 'truck']) counts[kind] = Math.round(TRAFFIC.perDistrict[kind] * L.districts.length * L.traffic);
    counts.moto = L.rivals;
    counts.cyclist = (L.cyclists ?? 0) * L.districts.length; // slow bicycles from level 3
    this.trafficView?.destroy();
    this.peopleView?.destroy();
    this.traffic = createTraffic(this.world, this.roadGraph, mulberry32(Date.now() & 0xffff), counts);
    this.trafficView = new TrafficView(this, this.traffic);
    this.lights.setTraffic(this.traffic);
    this.people = createPeople(this.world, this.rng, { hailEvery: L.hailEvery, districts: L.districts, walkers: PEOPLE.walkersPerDistrict * L.districts.length });
    this.peopleView = new PeopleView(this, this.people);
    this.board = createJobBoard(this.world, Date.now() & 0xffff, { fareMultiplier: L.fare, offerLife: L.offerLife, districts: L.districts, maxOffers: L.maxOffers });
    this.raceRival = null;
  }

  #save() {
    const { energy, serviceWear, brokenDown, brakeWearKm } = this.bike;
    const { ledger, ...wallet } = this.wallet;
    saveGame({ wallet, bike: { energy, serviceWear, brokenDown, brakeWearKm } });
  }

  #endDay() {
    if (this.board.active) cancelJob(this.board, this.bike);
    cancelMission(this.raceRival);
    this.raceRival = null;
    this.refuel = null;
    const summary = endDay(this.wallet, this.bike, this.level.rent);
    summary.level = this.level;
    summary.milestoneReady = !summary.outOfCash && milestoneReady(this.wallet);
    summary.savingsTarget = savingsTarget(this.wallet);
    this.dayOver = true;
    // The engine stops (it used to keep humming the last note), and a short tune says the shift is over.
    this.engineSound.silence();
    this.engineSound.jingle(summary.outOfCash === 'gameOver' ? 'gameOver' : 'shiftEnd');
    this.scene.pause();
    this.scene.launch('dayEnd', { summary, onContinue: (choice) => this.#startDay(choice) });
  }

  /**
   * choice: 'next' (next day), 'loan' (take the loan, then the next day), 'restart' (game over: restart this level),
   * 'buy' (buy the milestone, then show the new level), 'newGame' (start again at level 1).
   */
  #startDay(choice = 'next') {
    if (choice === 'buy') {
      const bought = buyMilestone(this.wallet);
      if (bought) {
        this.engineSound.jingle('levelUp');
        this.#save();
        this.scene.launch('dayEnd', { levelUp: { bought, next: levelSettings(this.wallet) }, onContinue: () => this.#startDay('next') });
        return;
      }
    }
    this.dayTime = 0;
    this.dayOver = false;
    this.officeHint = false;
    this.honkBarked = false;
    const { autoShift, energy, serviceWear, brokenDown, brakeWearKm } = this.bike;
    if (choice === 'newGame') {
      clearSave();
      this.wallet = createWallet();
    } else if (choice === 'restart') {
      restartLevel(this.wallet);
    } else if (choice === 'loan') {
      takeLoan(this.wallet);
    }
    const type = levelSettings(this.wallet).bikeType;
    this.bike = createBike(this.world, type);
    this.bike.autoShift = autoShift;
    if (choice === 'newGame') this.bike.energy = FUEL.startLevel;
    // The same bike carries over (a new bike after a new game or the switch to electric).
    if (choice !== 'newGame' && type === this.level.bikeType) Object.assign(this.bike, { energy, serviceWear, brokenDown, brakeWearKm: brakeWearKm ?? 0 });
    this.#applyLevel();
    this.#placeBike();
    this.#save();
    this.#snapshotShift();
    this.scene.resume();
  }

  /** Game clock in hours. The shift of the level runs from its start to its end hour in shift.realSeconds. */
  get clockHours() {
    const { start, end, realSeconds } = this.level.shift;
    return start + ((end - start) * Math.min(this.dayTime, realSeconds)) / realSeconds;
  }

  /** Debug and tests: go to a level (opens its districts). */
  debugLevel(n) {
    this.wallet.level = n;
    this.#applyLevel();
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
    // People in front of you step out of the way.
    const moved = this.people ? honkAt(this.people, this.bike) : 0;
    this.events.emit('bark', moved ? 'Beep beep! People step aside' : 'Beep beep!');
  }

  toggleSound() {
    this.engineSound.setEnabled(!this.engineSound.enabled);
    this.events.emit('bark', this.engineSound.enabled ? 'Sound on' : 'Sound off');
    this.#saveSettings();
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
    if (!this.started) {
      this.#attract(dt);
      return;
    }
    this.accumulator += dt;
    const raw = this.#rawInput();
    this.#updateTraffic(dt);
    while (this.accumulator >= FIXED_DT) {
      // While you fill up or swap, the bike stands still.
      this.controls = this.refuel ? { throttle: 0, brake: 1, steer: 0, hold: true } : readControls(this.steeringMode, raw, this.bike);
      const events = stepBike(this.bike, this.controls, this.world, FIXED_DT);
      const crashed = events.some((e) => e.type === 'crash');
      for (const e of events) {
        if (e.type === 'crash') {
          this.#crash(e);
          continue;
        }
        if (e.type === 'wall' && !e.hit && this.#closedAhead()) {
          e.barrier = true; // a road barrier: no repair bill
          continue;
        }
        if (e.type === 'wall' && crashed && e.hit?.kind !== 'person') continue; // the crash message says it all
        if (e.type === 'wall' && e.speed > 3) {
          this.cameras.main.shake(120, 0.002);
          if (this.time.now - (this.bumpSoundTime ?? -1e9) > 300) {
            this.bumpSoundTime = this.time.now;
            this.engineSound.crash(0.3); // a light knock
          }
        }
        if (e.type === 'wall' && e.speed < 4) continue; // no bark when you only touch a wall
        if (e.type === 'wall' && e.hit?.kind === 'person') {
          if (e.speed >= PEOPLE.hitSpeed) {
            e.hit.hurt = 3;
            this.#yell(e.hit, 'AYA!');
            this.#pay('fines', PEOPLE.hitFine, 'Police: you hit a person');
            this.events.emit('bark', 'You hit a person! Slow down near people');
          }
          continue;
        }
        if (e.type === 'wall' && e.hit?.kind) {
          this.events.emit('bark', `Crash! You hit a ${e.hit.kind === 'moto' ? 'moto' : e.hit.kind === 'bus' ? 'minibus' : e.hit.kind === 'cyclist' ? 'cyclist' : e.hit.kind}`);
          e.hit.stopTimer = 2; // the other driver stops
          continue;
        }
        // A petrol engine needs an oil change: its service messages say so.
        const petrol = this.bike.type === 'petrol';
        const type = petrol && e.type === 'serviceSoon' ? 'oilSoon' : petrol && e.type === 'serviceDue' ? 'oilDue' : e.type;
        if (BARKS[type]) this.events.emit('bark', BARKS[type]);
      }
      this.#economyStep(events);
      this.accumulator -= FIXED_DT;
    }
    if (this.refuel || this.bike.engineDead) this.#passengerWaiting(dt);
    if (this.refuel && (this.refuel.timeLeft -= dt) <= 0) this.#finishRefuel();
    this.#updateStation();
    updateBoard(this.board, this.world, dt);
    this.#updateJobFuel(dt);
    this.speedLimit = speedLimitAt(this.world, this.bike.x, this.bike.y);
    this.#updateMarker();
    this.#updateFuelGuide();
    this.chunks.update(this.bike.x, this.bike.y);
    this.#placeBike();
    this.#updateSmoke(dt);
    this.#updateOcclusion();
    this.#updateCamera(dt);
    this.chunks.cull(this.cameras.main.worldView);
    this.trafficView.update(this.world, this.cameras.main.worldView);
    this.peopleView.update(this.world, this.cameras.main.worldView, this.time.now);
    this.garages.update(this.time.now);
    this.markets.update(this.time.now);
    this.attendant.update(this, dt, this.time.now);
    const officer = this.police.update(this.time.now, dt, this.bike, Math.abs(forwardSpeed(this.bike)) * 3.6, this.speedLimit.limitKmh);
    if (officer) {
      this.engineSound.whistle();
      this.#bubble(officer.x, officer.y, 30, 'PRRRT!', 0xffffff);
    }
    this.daylight = daylight(this.clockHours);
    this.chunks.night = this.daylight.night;
    this.lights.update(this.daylight, this.cameras.main.worldView, this.bike, this.controls.brake > 0.1);
    this.#updateRivalPin();
    this.#updateHonks(dt);
    // Level 4: when you saved enough, the showroom waits for you (once a day is enough).
    if (this.level.buyAt === 'office' && !this.officeHint && milestoneReady(this.wallet)) {
      this.officeHint = true;
      this.events.emit('bark', 'You saved enough! Ride to the Ampersand showroom on Kacyiru boulevard to buy your electric moto');
      this.engineSound.jingle('reward');
    }
    if (this.bike.engineDead) {
      this.engineSound.silence(); // no engine sound: you push the bike
      this.#updatePushing(dt);
    } else this.engineSound.update(this.bike.type, Math.min(1, this.bike.revs), this.controls.throttle);
    this.dayTime += dt;
    if (this.dayTime >= this.level.shift.realSeconds) this.#endDay();
  }

  /** The road graph edge that passes a bus stop. */
  #edgeThrough(stop) {
    const x = (stop.x + 0.5) * WORLD.tileMetres, y = (stop.y + 0.5) * WORLD.tileMetres;
    return this.roadGraph.edges.find((e) => {
      const t = (x - e.from.x) * e.dx + (y - e.from.y) * e.dy;
      const side = Math.abs(-(x - e.from.x) * e.dy + (y - e.from.y) * e.dx);
      return t > 0 && t < e.length && side < 4;
    }) ?? null;
  }

  // Intercity buses come to the Nyabugogo bus park, and their passengers want motos.
  #updateBusPark(dt) {
    if (!this.parkEdge || (this.busTimer -= dt) > 0) return;
    const [lo, hi] = BUS_PARK.arrivalEverySeconds;
    this.busTimer = lo + this.rng() * (hi - lo);
    const buses = this.traffic.vehicles.filter((v) => v.kind === 'bus' && !v.route.length && v.stopTimer <= 0);
    if (buses.length) sendBusToPark(this.traffic, buses[Math.floor(this.rng() * buses.length)], this.parkEdge);
  }

  #busArrived(e) {
    if (!e.stop.park) return;
    const [lo, hi] = BUS_PARK.passengers;
    const n = lo + Math.floor(this.rng() * (hi - lo + 1));
    const T = WORLD.tileMetres;
    const made = busArrivalHails(this.people, this.world, this.world.places, (e.stop.x + 0.5) * T, (e.stop.y + 0.5) * T, n);
    for (const h of made) chaseHail(this.traffic, h, this.rng);
    const b = this.bike;
    if (made.length && Math.hypot(b.x - e.vehicle.x, b.y - e.vehicle.y) < 220) {
      this.events.emit('bark', `A bus arrives at the bus park: ${made.length} customers!`);
    }
  }

  // A hard hit: the rider falls off. The passenger is upset, fragile cargo breaks (see jobs), repairs cost money.
  #crash(e) {
    const kmh = Math.round(e.speed * 3.6);
    const what = !e.hit ? 'a wall' : e.hit.kind === 'pole' ? 'a pole' : e.hit.kind === 'person' ? 'a person' : e.hit.kind === 'bus' ? 'a minibus' : `a ${e.hit.kind}`;
    this.cameras.main.shake(300, 0.008);
    this.engineSound.crash(e.speed / 12);
    this.events.emit('bark', `Crash! You hit ${what} at ${kmh} km/h and fell off`);
    for (let i = 0; i < 4; i++) this.#spawnPuff(this.bike.x + (this.rng() - 0.5) * 1.5, this.bike.y + (this.rng() - 0.5) * 1.5, 0.1);
  }

  /** A person yells: a short, cute voice and the word in a small bubble over the head. */
  #yell(person, word) {
    const look = PERSON_LOOKS[person.look] ?? {};
    // Mamas and some others have higher voices; each person has their own pitch.
    const pitch = (look.kitenge !== undefined ? 1.2 : 0.9) + ((person.id * 37) % 10) / 40;
    this.engineSound.yell(pitch);
    this.#bubble(person.x, person.y, 34, word, 0xfff2c8);
  }

  /** A word in the pixel font that floats over a point in the world (metres), then fades. */
  #bubble(x, y, above, word, tint) {
    if (!this.cache.bitmapFont.exists('retro')) return;
    const s = toScreen(x, y, this.world.heightAt(x, y));
    const text = this.add.bitmapText(Math.round(s.x), Math.round(s.y - above), 'retro', word).setOrigin(0.5, 1)
      .setTint(tint).setDepth(100000);
    text.noAmbient = true;
    this.tweens.add({ targets: text, y: text.y - 10, alpha: 0, delay: 600, duration: 700, onComplete: () => text.destroy() });
  }

  /** A stop at a station with a passenger on the bike: the passenger is not happy. */
  #passengerAtStop() {
    if (!passengerWaits(this.board, 0, true)) return;
    this.events.emit('bark', 'Your passenger is in a hurry! The tip goes down while you wait');
    this.#grumble();
    this.grumbleTimer = 4;
  }

  /** The passenger waits (a station stop, or you push the bike): the tip goes down, and they complain. */
  #passengerWaiting(dt) {
    if (!passengerWaits(this.board, dt)) return;
    this.grumbleTimer = (this.grumbleTimer ?? 2) - dt;
    if (this.grumbleTimer > 0) return;
    this.grumbleTimer = 3.5 + this.rng() * 2.5;
    this.#grumble();
  }

  #grumble() {
    this.engineSound.grumble();
    const words = ['HMPH!', 'NDAKERERWE!', 'TWIHUTE!', 'EH! TIME!', 'MANA WE...', 'ME, I AM LATE!'];
    this.#bubble(this.bike.x - 0.6, this.bike.y - 0.6, 44, words[Math.floor(this.rng() * words.length)], 0xffa080);
  }

  /** Pushing the bike: the steps of the walk, and now and then a tired sound and word. */
  #updatePushing(dt) {
    const v = Math.abs(forwardSpeed(this.bike));
    this.pushMetres = (this.pushMetres ?? 0) + v * dt;
    if (v < 0.3) return;
    this.gruntTimer = (this.gruntTimer ?? 1) - dt;
    if (this.gruntTimer > 0) return;
    this.gruntTimer = 1.4 + this.rng() * 1.4;
    const i = Math.floor(this.rng() * 4);
    this.engineSound.grunt(i);
    this.#bubble(this.bike.x, this.bike.y, 40, ['UFF!', 'AAH...', 'OOH!', 'EEH!'][i], 0xd8e0ff);
  }

  /** Traffic behind a bike that stands in the road honks (a cyclist rings the bell). */
  #updateHonks(dt) {
    if (this.refuel || !this.traffic) return;
    const b = this.bike;
    const honks = trafficHonks(this.traffic, { x: b.x, y: b.y, speed: Math.abs(forwardSpeed(b)) }, dt, this.rng);
    const words = { car: 'BEEP BEEP!', bus: 'POOOO!', truck: 'BWAAAP!', moto: 'BIP BIP!', cyclist: 'TRING TRING!' };
    for (const v of honks) {
      this.engineSound.honk(v.kind, 1 - Math.hypot(v.x - b.x, v.y - b.y) / 20);
      this.#bubble(v.x, v.y, v.kind === 'bus' || v.kind === 'truck' ? 40 : 28, words[v.kind] ?? 'BEEP!', 0xffe080);
      if (!this.honkBarked) {
        this.honkBarked = true;
        this.events.emit('bark', 'You block the road! Traffic is waiting behind you');
      }
    }
  }

  /** At the edge of a closed district: tell the rider when it opens. Returns true if the bike is there. */
  #closedAhead() {
    const b = this.bike;
    const id = this.barriers.closedDistrictAt(b.x + Math.cos(b.heading) * 1.5, b.y + Math.sin(b.heading) * 1.5);
    if (!id) return false;
    if ((this.closedBarkTime ?? -1e9) < this.time.now - 4000) {
      this.closedBarkTime = this.time.now;
      this.events.emit('bark', `Road closed: ${DISTRICTS[id].name} opens at level ${DISTRICTS[id].unlockLevel}`);
    }
    return true;
  }

  #updateTraffic(dt) {
    const b = this.bike;
    this.#updateBusPark(dt);
    const bikeObstacle = { x: b.x, y: b.y, length: 2, width: 0.9, speed: Math.abs(forwardSpeed(b)) };
    for (const e of stepTraffic(this.traffic, this.world, [bikeObstacle, ...(this.trafficPeople ?? [])], dt)) {
      if (e.type === 'busArrived') {
        this.#busArrived(e);
        continue;
      }
      const v = e.vehicle;
      // Exhaust only near the bike (you cannot see the rest).
      if (Math.abs(v.x - b.x) + Math.abs(v.y - b.y) > 90) continue;
      const back = v.length / 2;
      this.#spawnPuff(v.x - Math.cos(v.heading) * back, v.y - Math.sin(v.heading) * back, 0.4, isDiesel(v));
    }
    this.nearAgents = this.traffic.vehicles.filter((v) => Math.abs(v.x - b.x) < 12 && Math.abs(v.y - b.y) < 12);
    this.#updatePeople(dt);
  }

  #updatePeople(dt) {
    const b = this.bike;
    for (const e of stepPeople(this.people, this.world, b, this.world.places, dt)) {
      if (e.type === 'hailNew') chaseHail(this.traffic, e.hail, this.rng);
      if (e.type === 'hailGone') this.#cancelRivalsFor('hail', e.hail.id);
      if (e.type === 'nearMiss') this.#yell(e.person, e.word);
    }
    for (const e of stepRivals(this.traffic, dt)) this.#rivalArrived(e);
    const near = (p) => Math.abs(p.x - b.x) < 12 && Math.abs(p.y - b.y) < 12;
    this.nearPeople = this.people.walkers.filter(near).concat(this.people.hails.filter(near));
    this.world.dynamicAgents = [...this.nearAgents, ...this.nearPeople, ...this.world.poles.filter(near)];
    // A customer within reach of a stopped bike (only when you have no job).
    this.hailOffer = this.board.active ? null : hailInReach(this.people, b, Math.abs(forwardSpeed(b)));
    // People on the road are obstacles for traffic.
    this.trafficPeople = this.people.walkers.filter((p) => {
      const t = this.world.tileAt(p.x, p.y);
      return t && t.surface !== 'pavement' && t.surface !== 'grass';
    });
  }

  #cancelRivalsFor(type, id) {
    for (const v of this.traffic.vehicles) if (v.mission?.type === type && v.mission.id === id) cancelMission(v);
  }

  #rivalArrived(e) {
    const { mission } = e;
    const job = this.board.active;
    if (mission.type === 'job' && job && job.id === mission.id && job.stage === 'toPickup') {
      cancelJob(this.board, this.bike);
      this.raceRival = null;
      updateStreak(this.wallet, false);
      this.events.emit('bark', 'Too slow! A rival rider took your passenger');
    }
    if (mission.type === 'hail') {
      const h = this.people.hails.find((x) => x.id === mission.id);
      if (h) {
        h.taken = true;
        h.life = 0;
        if (Math.hypot(h.x - this.bike.x, h.y - this.bike.y) < 50) this.events.emit('bark', 'A rival rider took that customer');
      }
    }
  }

  /** Take the street hail in reach. */
  acceptHail() {
    const h = this.hailOffer;
    if (!h || this.board.active) return false;
    acceptHail(this.board, h, this.bike);
    h.taken = true;
    h.life = 0;
    this.#cancelRivalsFor('hail', h.id);
    this.hailOffer = null;
    this.events.emit('bark', `Street hail! Go to ${h.to.name}`);
    return true;
  }

  /** An exhaust puff at a world point (metres). */
  #spawnPuff(px, py, z, dark = false) {
    const s = toScreen(px, py, this.world.heightAt(px, py) + z);
    let puff = this.puffs.find((p) => !p.img.visible);
    if (!puff) {
      if (this.puffs.length > 160) return;
      puff = { img: this.add.image(0, 0, 'puff') };
      this.puffs.push(puff);
    }
    puff.img.setTexture(dark ? 'puff-dark' : 'puff').setVisible(true).setPosition(s.x, s.y).setDepth((px + py) / WORLD.tileMetres);
    puff.life = puff.maxLife = dark ? 1.3 : 0.9;
    puff.drift = (Math.random() - 0.5) * 6;
  }

  // A red pin over the rival who races you to your pickup.
  #updateRivalPin() {
    const v = this.raceRival;
    const show = !!v && !!v.mission;
    this.rivalPin.setVisible(show);
    if (!show) return;
    const s = toScreen(v.x, v.y, this.world.heightAt(v.x, v.y));
    this.rivalPin.setPosition(s.x, s.y - 30 - 3 * Math.sin(this.time.now / 200));
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
    addCanvasTexture(this, 'waiting-bananas', drawCargoPile('bananas'));
    addCanvasTexture(this, 'waiting-rice', drawCargoPile('rice'));
    this.waiting = this.add.image(0, 0, 'waiting-passenger').setOrigin(ox, oy).setVisible(false);
    this.markerRing = this.add.image(0, 0, 'ring-pickup').setVisible(false);
    this.markerPin = this.add.image(0, 0, 'pin-pickup').setOrigin(0.5, 1).setDepth(1e5).setVisible(false);
    this.arrow = this.add.image(0, 0, 'arrow').setDepth(1e6).setVisible(false);
    this.fuelWarned = 1; // the last low fuel warning level (see #updateFuelGuide)
  }

  // Low fuel: warn once at each level. There is no arrow: you learn where the stations are.
  #updateFuelGuide() {
    const e = this.bike.energy;
    const electric = this.bike.type === 'electric';
    if (e > FUEL.lowAt + 0.05) this.fuelWarned = 1;
    if (this.refuel) return;
    if (e < FUEL.lowAt && this.fuelWarned > FUEL.lowAt) {
      this.fuelWarned = FUEL.lowAt;
      this.events.emit('bark', electric ? `Battery low: ${Math.round(e * 100)}%. Go to a swap station` : `Fuel low: ${Math.round(e * 100)}%. Go to a fuel station`);
    } else if (e < FUEL.reserveAt && this.fuelWarned > FUEL.reserveAt) {
      this.fuelWarned = FUEL.reserveAt;
      this.events.emit('bark', electric ? 'Battery reserve! Swap now' : 'Reserve! Fill up now or push the bike');
    }
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
    this.waiting.setTexture(job.type === 'passenger' ? 'waiting-passenger' : `waiting-${job.goods ?? 'rice'}`)
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
    // Out of fuel or charge, or broken down: the rider walks beside the bike and pushes it.
    const load = b.loadType ?? 'none';
    const key = b.engineDead && !(b.crashed > 0)
      ? `push-${b.type}-${load === 'passenger' ? 'none' : load}-${bikeFrameForHeading(b.heading)}-${Math.floor((this.pushMetres ?? 0) / 0.7) % 2}`
      : `bike-${b.type}-${load}-${bikeFrameForHeading(b.heading)}`;
    this.bikeScreen = s;
    this.bikeDepth = depth;
    // After a crash the bike and the rider lie on the ground.
    const angle = b.crashed > 0 ? (Math.cos(b.heading - Math.PI / 4) >= 0 ? 80 : -80) : 0;
    this.bikeSprite.setTexture(key).setPosition(s.x, s.y - bounce).setDepth(depth).setAngle(angle);
    this.ghost.setTexture(key).setPosition(s.x, s.y - bounce).setAngle(angle);
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
      this.#spawnPuff(b.x - Math.cos(b.heading) * back, b.y - Math.sin(b.heading) * back, 0.45);
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
    for (const bs of blockSprites) {
      const alpha = hidingGroups.has(groupKey(bs.block)) ? 0.45 : 1;
      bs.img.setAlpha(alpha);
      bs.glow?.setAlpha(alpha * this.chunks.night); // lit windows fade with the building
    }
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
