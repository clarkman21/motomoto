import Phaser from 'phaser';
import { VIEW, WORLD, BIKES, MONEY, MAINTENANCE, PEOPLE, TRAFFIC, STREAK, DISTRICTS, BUS_PARK, FUEL, LEVELS, POLICE, SURFACES, GAME_OVER, PHYSICS, MISSIONS, EVENTS, JOBS, FLEET, RIDER, TRAFFIC_LIGHTS, HELMET_CHECKS, CROSSINGS, STORY, MODES, RUSH, ROAD_EVENTS, HARD_RULES, MUZUNGU, CREWS, HQ, RADIO, VISIBLE_PARTS } from '../config.js';
import { World } from '../world/world.js';
import { buildKigaliMap } from '../world/maps/kigali.js';
import { ChunkStreamer, groupKey } from './chunks.js';
import { addCanvasTexture, placeOnPixels } from './textures.js';
import { toScreen } from '../world/iso.js';
import {
  drawBike, drawBlock, drawShadow, drawGlow, drawPuff, bikeFrameForHeading, BIKE_CANVAS, BIKE_DIRECTIONS,
  drawCamera, drawSpeedSign, drawRoadSign, drawMarkerRing, drawMarkerPin, drawArrow, PROP_CANVAS,
  BIKE_LOADS, drawWaitingPassenger, drawCargoPile, drawMusicNote,
} from '../world/sprites.js';
import { createBike, stepBike, forwardSpeed, shiftGear, bestGear, resetToRoad } from '../sim/bike.js';
import { readControls } from '../sim/controls.js';
import { EngineSound } from '../audio/engine-sound.js';
import { Radio } from '../audio/radio.js';
import { createWallet, earn, spend, buyFuel, swapBattery, fuelFillCost, fuelChoices, repairCost, endDay, stranded, payGarage } from '../sim/economy.js';
import { garageQuote, serviceDue, crashWearShare } from '../sim/maintenance.js';
import { createJobBoard, makeOffer, updateBoard, acceptOffer, cancelJob, updateJob, jobTarget, acceptHail, tripMetres, passengerWaits, loseJobWhenEmpty, loseJobOnCrash } from '../sim/jobs.js';
import { createCameraState, checkCameras, speedLimitAt } from '../sim/law.js';
import { buildRoadGraph, openRoads } from '../sim/roads.js';
import { createTraffic, stepTraffic, addVehicle, insideVehicle, sendBusToPark, familyOf } from '../sim/traffic.js';
import { mulberry32 } from '../sim/jobs.js';
import { TrafficView, isDiesel } from './TrafficView.js';
import { createPeople, stepPeople, hailInReach, insidePerson, busArrivalHails, honkAt, newPerson } from '../sim/people.js';
import { startRace, chaseHail, stepRivals, cancelMission } from '../sim/rivals.js';
import { PeopleView } from './PeopleView.js';
import { CrewView } from './CrewView.js';
import { placeCrews, crewAt, sweepersOut, daySweepers, stepCrews } from '../sim/crews.js';
import { PERSON_LOOKS } from '../world/vehicle-sprites.js';
import { trafficHonks } from '../sim/honk.js';
import { levelSettings, milestoneReady, buyMilestone, startAtLevel, setLevel, streakMultiplier, updateStreak, savingsTarget } from '../sim/levels.js';
import { loadGame, saveGame, clearSave, loadSettings, saveSettings } from './save.js';
import { deliveryLine } from '../sim/family.js';
import { jobFuel } from '../sim/fuel.js';
import { rescueOffer, createRescue, stepRescue } from '../sim/rescue.js';
import { LightsView } from './LightsView.js';
import { BarrierView } from './BarrierView.js';
import { GarageView } from './GarageView.js';
import { MarketView } from './MarketView.js';
import { AttendantView } from './AttendantView.js';
import { PoliceView } from './PoliceView.js';
import { SignView } from './SignView.js';
import { daylight } from '../sim/daylight.js';
import { pickDayEvent, eventStage, eventBark, rainTint, parkTraffic, wakeTraffic } from '../sim/events.js';
import { RainView } from './RainView.js';
import { buyPart as shopBuy, partEffects, partsTip } from '../sim/shop.js';
import { modeOf, setHazardShare } from '../sim/modes.js';
import { createRider, stepRider, riderPower, canEat, eat } from '../sim/rider.js';
import { pickLightJunctions, attachLights, redLightCheck } from '../sim/lights.js';
import { TrafficLightView } from './TrafficLightView.js';
import { shopFronts, shopPlaces } from '../world/shops.js';
import { umugandaOffer, onMainRoad, stepPatrols, patrolCount } from '../sim/umuganda.js';
import { pickRoadWorks, planConvoy, convoyVehicles, convoyCheck, isCarFreeDay, carFreeNow, carFreeRoads } from '../sim/roadevents.js';
import { RoadEventsView } from './RoadEventsView.js';
import { oneWayRoads, noMotoRoads, pruneOneWay, strictOneWays, streetRule, pickSpeedChecks, speedChecks, overloaded, maybeHeavy, stepBladder, drinkToBladder, bladderPower } from '../sim/hardrules.js';
import { crossingPaths, stepCrossers } from '../sim/crossers.js';
import { KiteView } from './KiteView.js';
import { SmogView } from './SmogView.js';
import { smogAt, batterySpots, takeBattery } from '../sim/story.js';
import { BatteryView } from './BatteryView.js';
import { isRushHour, rushCounts, markRush, stepRush } from '../sim/rush.js';
import { pickCheckpoints, stepHelmetCheck } from '../sim/checks.js';
import { fleetRiders, planFleetDay, attachFleet, stepFleet, waitingRider, fleetDayMoney } from '../sim/fleet.js';
import { maybeVisitor, maybeVisitorHail, stepVisitor, greeting, dropOffLines, sightNear, quietNear, VISITOR_LINES } from '../sim/muzungu.js';
import { hqMissionDue, createHq, hqAction, stepWalk, stepTrack, stepExit, skipTrack, inYard, hqGoal, deskSpot, ribbonAlpha } from '../sim/hq.js';
import { HqView, parkedKey } from './HqView.js';
import { PartFxView } from './PartFxView.js';
import { FoodSignView } from './FoodSignView.js';
import { createPartFx, partFxTriggers, partFxSteady } from '../sim/partfx.js';
import { dayStats, pickQuests, recordDelivery, recordFine, checkQuests, maybeMission, stepMission, missionResult, findSecret } from '../sim/missions.js';

const FIXED_DT = 1 / 120; // physics step in seconds
const CREW_LOOKS = PERSON_LOOKS.map((l, i) => (l.basket ? -1 : i)).filter((i) => i >= 0); // no basket on the head at work
const BARKS = {
  bumpHard: 'Speed bump too fast!',
  wall: 'Bang!',
  empty: 'Out of energy! The bike rolls to a stop, and a customer on it will leave. Push the bike (throttle) to a station, or press T to call a fuel moto',
  pothole: 'Pothole! Speed −30%, more wear',
  puddle: 'SPLASH! A pothole full of rain water',
  rocksHard: 'Loose rocks! Slow down on the murram',
  overRev: 'Too fast to shift down',
  noGears: 'Electric moto: no gears',
  lugging: 'Shift down!',
  redZone: 'Red zone: shift up (E) to save fuel!',
  offRoad: 'Off road! The bike wears 4 times faster',
  serviceSoon: 'Service soon: 80%. Plan a garage visit',
  serviceDue: 'Service due! The bike loses power. Go to the garage',
  oilSoon: 'Oil change soon: 80%. High revs use the oil faster',
  oilDue: 'Oil change due! The engine loses power. Go to the garage',
  breakdown: 'Breakdown! Push the bike to the garage',
};
const REPAIR_LABELS = { wall: 'Crash damage' };
const STATION_RANGE_METRES = 6;
// What you hit, in words (a crash message).
const HIT_NAMES = { moto: 'moto', taxi: 'moto taxi', amp: 'Ampersand rider', bus: 'minibus', lorry: 'truck', tipper: 'tipper truck', truck: 'truck', pickup: 'pickup', cyclist: 'cyclist', police: 'police car', vip: 'VIP car' };
// You may also stop anywhere beside the building of a fuel station, a swap station or a garage (Alp:
// F at the garage did nothing, because the bike was not near the one stop point).
const STATION_BUILDING_METRES = 3.5;
const STATION_BLOCK_KINDS = { fuel: 'fuel', swap: 'swap', garage: 'garage' };

export class RideScene extends Phaser.Scene {
  constructor() {
    super('ride');
  }

  /** data.menu: the welcome menu is on top. The ride waits (the city moves behind the menu) until startGame(). */
  create(data = {}) {
    this.sayQueue = []; // the lines of a visitor passenger that wait to show (see #visitorSays)
    this.sayBusy = false;
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
        // The rider walks and pushes the bike (out of fuel, broken down, or backwards out of a tight spot).
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
    // The effects of the garage parts on your bike (sim/partfx.js, PartFxView.js).
    this.partFx = createPartFx();
    this.partFxView = new PartFxView(this);
    this.steadyFx = {};

    this.#createProps();
    // The moto garages: motos, mechanics, oil stains and the name sign.
    this.garages = new GarageView(this, this.world);
    this.markets = new MarketView(this, this.world);
    this.attendant = new AttendantView(this, this.world);
    // Police on the junction corners of the whole map (the full road network, not only the open roads).
    this.police = new PoliceView(this, this.world, buildRoadGraph(this.world.roads));
    // Traffic lights at the big junctions of the whole map (sim/lights.js); each level shows the open ones.
    this.allSignals = pickLightJunctions(this.world, buildRoadGraph(this.world.roads));
    this.signalView = new TrafficLightView(this, this.world, this.allSignals);
    this.signs = new SignView(this, this.world); // names on landmark buildings
    this.hq = null; // the Ampersand HQ mission (sim/hq.js), at the start of level 5
    this.hqView = new HqView(this, this.world); // the HQ yard in Gikondo: Alphas, the track, the staff
    this.foodSigns = new FoodSignView(this, this.world); // food signs over the food stops (medium and hard)
    // Shops and street life (world/shops.js): painted shop signs, boutique mannequins, and shops as job places.
    this.shops = shopFronts(this.world);
    // The building painter draws the inside of each shop by its kind (world/sprites.js); the chunks are drawn later.
    this.world.shopLooks = new Map(this.shops.map((sh) => [sh.groupId, { kind: sh.kind, muralFace: sh.muralFace }]));
    this.signs.addShopSigns(this, this.world, this.shops);
    this.world.places.push(...shopPlaces(this.shops));
    this.crossPaths = crossingPaths(this.world); // zebra crossings where people cross the road (sim/crossers.js)
    this.kitesView = new KiteView(this, this.world); // brown kites in the sky
    // Night lights and the colour of the day (see LightsView.js).
    this.lights = new LightsView(this, this.world);
    this.rainView = new RainView(this); // rain streaks on a rainy day
    this.smogView = new SmogView(this); // the petrol smog over the city: thinner at each level (story arc)
    this.batteryView = new BatteryView(this); // yellow battery pickups (story arc, levels 3 and 4)
    this.roadEventsView = new RoadEventsView(this, this.world); // road works and the car free morning
    // Hard mode challenges (sim/hardrules.js): one-way streets and streets with no motos, with their signs.
    this.oneWays = oneWayRoads(this.world.roads);
    this.noMotos = noMotoRoads(this.world.roads);
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
    // A blue pin over a hired rider who waits for your help (the blue of the riders' helmets).
    addCanvasTexture(this, 'pin-help', drawMarkerPin(0x3a7fd0));
    this.helpPin = this.add.image(0, 0, 'pin-help').setOrigin(0.5, 1).setDepth(1e5).setVisible(false);
    this.helpPin.noAmbient = true;
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
    this.dayTime = 0; // real seconds since the start of the shift
    this.#applyLevel();
    this.cameraState = createCameraState(this.world);
    this.station = null; // the station the bike stands at: 'fuel' or 'swap'
    this.refuel = null; // { kind, timeLeft, total } while you fill up or swap
    this.speedLimit = speedLimitAt(this.world, this.bike.x, this.bike.y);
    this.steeringMode = 'bike';
    this.controls = { throttle: 0, brake: 0, steer: 0 };
    this.touch = { stick: { x: 0, y: 0, active: false }, throttle: false, brake: false };
    this.accumulator = 0;
    this.engineSound = new EngineSound();
    // Radio Inziza (audio/radio.js): on a bike with the Bluetooth speaker. N: the next station.
    this.radio = new Radio(this.engineSound);
    this.radio.onTrack = (station, track) => this.events.emit('radio', station, track);
    this.radioStation = 0; // the station you listen to (-1: OFF); it stays after a reload (settings)
    this.notes = []; // the music notes that float up from the speaker
    this.noteTimer = 0;
    this.occluded = false;
    this.showMap = true;
    this.testLevel = 1; // test mode: a new game starts at this level (Settings menu)

    // Settings from an earlier visit (sound, map, test level, cheats). The steering is bike relative and
    // the gears are manual: there is no option (Alp).
    const settings = loadSettings();
    if (settings) {
      this.engineSound.setEnabled(settings.sound !== false);
      this.showMap = settings.map !== false;
      this.testLevel = settings.testLevel ?? 1;
      this.cheatsOn = !!settings.cheats;
      this.radioStation = settings.radio ?? 0;
      this.radio.setVolume(settings.music ?? RADIO.volume);
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
  /** how: 'new' or 'continue'. mode: the difficulty mode of a new game ('easy', 'medium', 'hard'). */
  startGame(how, mode) {
    if (how === 'new') this.newMode = mode;
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
    saveSettings({ sound: this.engineSound.enabled, map: this.showMap, testLevel: this.testLevel, cheats: !!this.cheatsOn, radio: this.radioStation, music: this.radio.volume });
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
        case 'KeyB': this.toggleBike(); break;
        case 'KeyR': this.resetBike(); break;
        case 'KeyM': this.toggleMap(); break;
        case 'KeyH': this.horn(); break;
        case 'KeyV': this.toggleSound(); break;
        case 'KeyN': this.nextStation(); break;
        case 'KeyE': case 'KeyX': this.shift(1); break;
        case 'KeyQ': case 'KeyZ': this.shift(-1); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': this.acceptJob(Number(e.code.slice(5)) - 1); break;
        case 'Backspace': if (this.hq?.stage === 'track') this.#hqF(); else this.cancelJob(); break;
        case 'KeyF': this.startRefuel(); break;
        case 'KeyT': this.callFuelMoto(); break;
        case 'KeyK': if (this.debug) this.dayTime = this.level.shift.realSeconds; break; // debug: end the shift now
      }
    });
    this.input.on('pointerdown', () => this.engineSound.start());
  }

  toggleBike() {
    // Your bike comes from the level (electric after the level 4 milestone). B works only with ?debug in the address.
    if (!this.debug) {
      this.events.emit('bark', this.bike.type === 'petrol' ? 'Save for your Alpha: the level 4 milestone' : 'You ride electric');
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

  /** The level a new game starts at: the test level only while the cheats are on (else level 1, the petrol moto). */
  get testStartLevel() {
    return this.cheatsOn ? this.testLevel : 1;
  }

  /** Test mode (Settings): the level that a new game starts at, 1 to 5. */
  cycleTestLevel() {
    this.testLevel = (this.testLevel % LEVELS.length) + 1;
    this.#saveSettings();
  }

  // ---------------------------------------------------------------------------
  // Radio Inziza (audio/radio.js, audio/songs.js)
  // ---------------------------------------------------------------------------

  /** True when your bike has the Bluetooth speaker (a garage part). */
  get hasSpeaker() {
    return (this.wallet.parts ?? []).includes('speaker');
  }

  /** N, the ♪ button or a tap on the radio chip: the next station; after the last one, OFF. */
  nextStation() {
    if (!this.hasSpeaker) {
      this.events.emit('bark', 'No radio: buy a Bluetooth speaker at a garage');
      return;
    }
    if (this.radio.station < 0 && this.radioStation >= 0) this.radio.tune(this.radioStation); // the first time in this visit
    else this.radio.next();
    this.radioStation = this.radio.station;
    if (this.radioStation < 0) {
      this.radio.stop();
      this.events.emit('radio', -1, 0);
    }
    this.#saveSettings();
  }

  /** Settings: the music volume, in steps of 20%. */
  cycleMusic() {
    const v = Math.round(this.radio.volume * 5);
    this.radio.setVolume(((v + 1) % 6) / 5);
    this.#saveSettings();
  }

  /** Each frame: the radio plays on a bike with the speaker (not on foot); notes float up from the speaker. */
  #updateRadio(dt) {
    const on = this.hasSpeaker && this.radioStation >= 0 && !this.hq?.walker && !this.dayOver;
    if (on && this.radio.station !== this.radioStation) this.radio.tune(this.radioStation);
    if (on) this.radio.tick();
    // The notes: one each 0.7 s, from the speaker box behind the seat.
    this.noteTimer -= dt;
    if (on && this.radio.playing && this.noteTimer <= 0) {
      this.noteTimer = 0.7;
      const b = this.bike, back = 0.8;
      const s = toScreen(b.x - Math.cos(b.heading) * back, b.y - Math.sin(b.heading) * back, b.z + 1.2);
      let n = this.notes.find((q) => !q.img.visible);
      if (!n && this.notes.length < 6) {
        n = { img: this.add.image(0, 0, 'note-0').setDepth(1e5) };
        n.img.noAmbient = true;
        this.notes.push(n);
      }
      if (n) {
        Object.assign(n, { life: 1.6, drift: (Math.random() - 0.5) * 10 });
        n.img.setTexture(`note-${Math.floor(Math.random() * 3)}`).setPosition(Math.round(s.x), Math.round(s.y)).setAlpha(1).setVisible(true);
      }
    }
    for (const n of this.notes) {
      if (!n.img.visible) continue;
      if ((n.life -= dt) <= 0) { n.img.setVisible(false); continue; }
      n.img.y -= 14 * dt;
      n.img.x += n.drift * dt;
      n.img.setAlpha(Math.min(1, n.life));
    }
  }

  /** M: show or hide the minimap. */
  toggleMap() {
    this.showMap = !this.showMap;
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
    const hqOffer = this.#hqOffer();
    if (hqOffer) return hqOffer;
    const kind = this.station;
    if (!kind || this.refuel) return null;
    const type = this.bike.type;
    if (kind === 'garage') {
      // F opens the garage screen: the service, and parts and upgrades (GarageScene).
      const meter = Math.round(serviceDue(this.bike) * 100);
      return { ok: true, text: `F: ${this.stationPlace?.name ?? 'Garage'} · service (meter ${meter}%) · parts and upgrades` };
    }
    if (kind === 'office') return this.#officeOffer();
    if (kind === 'food') {
      const f = RIDER.foods[this.foodStop.food];
      const can = canEat(this.rider, this.foodStop.food, this.clockHours);
      if (!can.ok) return { ok: false, text: can.reason === 'hours' ? `${this.foodStop.name}: lunch from ${f.fromHour}:00 to ${f.toHour}:00` : 'You are not hungry.' };
      if (this.wallet.cash < f.price) return { ok: false, text: `${f.name}: ${f.price.toLocaleString('en')} RWF. Not enough cash.` };
      return { ok: true, text: `F: ${f.name} at ${this.foodStop.name}: ${f.price.toLocaleString('en')} RWF, +${Math.round(f.energy * 100)}% energy, ${f.seconds} s` };
    }
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

  /** At the Ampersand HQ in Gikondo, when no mission waits (the mission has its own prompts, see #hqOffer). */
  #officeOffer() {
    if (this.wallet.perks.electric) return { ok: false, text: 'Ampersand HQ, Gikondo. Murakaza neza! The swap station is in the yard.' };
    return { ok: false, text: 'Ampersand HQ, Gikondo. Save for the level 4 milestone: your own Alpha waits here.' };
  }

  // ---------------------------------------------------------------------------
  // The Ampersand HQ mission (sim/hq.js): get off, hand in the old moto, get on your Alpha, the test
  // track, ride out. Start of level 5 (Kicukiro opens).
  // ---------------------------------------------------------------------------

  /** The prompt at HQ during the mission, or null. */
  #hqOffer() {
    const hq = this.hq;
    if (!hq || hq.stage === 'done') return null;
    const near = (p) => hq.walker && Math.hypot(hq.walker.x - p.x, hq.walker.y - p.y) <= HQ.reachMetres;
    switch (hq.stage) {
      case 'ride':
        if (!inYard(this.bike.x, this.bike.y)) return null;
        if (this.board.active) return { ok: false, text: 'Ampersand HQ. Finish your job first, then come back for your Alpha.' };
        if (Math.abs(forwardSpeed(this.bike)) * 3.6 > HQ.stopKmh) return { ok: false, text: 'Ampersand HQ! Stop, then press F to get off.' };
        return { ok: true, text: 'F: Get off the old moto' };
      case 'desk':
        return near(deskSpot()) ? { ok: true, text: `F: Hand in the old moto (+${HQ.tradeIn.toLocaleString('en')} RWF)` } : { ok: false, text: 'Walk to the desk (arrow keys)' };
      case 'alpha':
        return near(ribbonAlpha()) ? { ok: true, text: `${HQ.staffLine} F: Get on your Alpha` } : { ok: false, text: 'Walk to your Alpha: the one with the teal bow' };
      case 'track': {
        const t = (hq.time + hq.penalty).toFixed(1);
        return { ok: true, text: `TEST TRACK ${t} S · GATE ${Math.min(hq.gate + 1, 4)}/4${hq.penalty ? ` · CONES +${hq.penalty} S` : ''} · F: SKIP` };
      }
      case 'exit':
        return { ok: false, text: 'Ride out of the yard under the MURAKAZA NEZA banner!' };
      default:
        return null;
    }
  }

  /** F (or Backspace on the track) at HQ. Returns true when the mission used the key. */
  #hqF() {
    const hq = this.hq;
    if (!hq || hq.stage === 'done' || hq.stage === 'exit') return false;
    if (hq.stage === 'ride' && !inYard(this.bike.x, this.bike.y)) return false;
    const r = hqAction(hq, this.bike, !!this.board.active);
    if (r.type === 'no') {
      const offer = this.#hqOffer();
      if (offer) this.events.emit('bark', offer.text);
      return true;
    }
    if (r.type === 'off') {
      Object.assign(this.bike, { vx: 0, vy: 0 });
      this.engineSound.silence();
      this.events.emit('bark', 'Walk to the desk with the arrow keys, then press F');
    } else if (r.type === 'tradeIn') {
      earn(this.wallet, 'tradeIn', r.cash);
      this.events.emit('money', r.cash, 'Trade-in: the old moto');
      this.engineSound.jingle('reward');
      // The Alpha is yours now: a shift that ends here starts tomorrow on the Alpha.
      this.wallet.perks.electric = true;
      this.hqView.startTrade(hq.oldBike);
      this.#save();
      this.time.delayedCall(1200, () => this.events.emit('bark', 'Murakoze! Now find your Alpha: the one with the teal bow'));
    } else if (r.type === 'mount') {
      const { autoShift } = this.bike;
      this.bike = createBike(this.world, 'electric');
      Object.assign(this.bike, { x: r.x, y: r.y, heading: r.heading, autoShift, z: this.world.heightAt(r.x, r.y), energy: 1 });
      // Only the level settings and the parts change (the traffic, the jobs, the rider and today's shift stay).
      const shift = this.level.shift;
      this.level = levelSettings(this.wallet);
      this.level.shift = shift;
      this.bike.mods = this.#bikeMods();
      this.bike.autoShift = false;
      this.events.emit('bark', `${HQ.staffLine} Feel the power: ride the 4 gates in order (F: skip)`);
      this.engineSound.jingle('reward');
    } else if (r.type === 'trackDone') this.#hqTrackDone(r);
    return true;
  }

  #hqTrackDone(r) {
    if (r.skipped) this.events.emit('bark', 'Track skipped. Ride out of the gate!');
    else {
      this.events.emit('bark', `Track: ${r.seconds.toFixed(1)} s${r.cones ? ` (${r.cones} cones)` : ''}. ${r.bonus ? 'Under 45 s!' : 'Now ride out of the gate!'}`);
      if (r.bonus) {
        earn(this.wallet, 'tradeIn', r.bonus);
        this.events.emit('money', r.bonus, 'Test track bonus');
      }
    }
    this.engineSound.jingle('reward');
  }

  /** The mission each frame: walk, the track, the ride out. */
  #updateHq(dt) {
    const hq = this.hq;
    if (!hq) return;
    if (hq.stage === 'ride' && !this.hqAnnounced) {
      this.hqAnnounced = true;
      this.time.delayedCall(1500, () => this.events.emit('bark', 'Your Alpha is ready at the Ampersand HQ, Gikondo! Follow the yellow & on the map'));
    }
    if (hq.walker) {
      const k = this.keys, st = this.touch.stick;
      const dir = st.active ? { x: st.x, y: st.y } : {
        x: (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0),
        y: (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0),
      };
      stepWalk(hq, dir, dt);
    }
    if (hq.stage === 'track') {
      for (const e of stepTrack(hq, this.bike, dt)) {
        if (e.type === 'cone') {
          this.events.emit('bark', `A cone! +${HQ.conePenalty} s`);
          this.engineSound.crash(0.15);
        } else if (e.type === 'gate' && e.n < 4) {
          this.events.emit('bark', `Gate ${e.n}/4!`);
          this.engineSound.blip('select');
        } else if (e.type === 'trackDone') this.#hqTrackDone(e);
      }
    }
    if (hq.stage === 'exit') {
      const out = stepExit(hq, this.bike);
      if (out) this.#hqDone();
    }
  }

  /** You ride out of the yard: confetti, the family, the staff clap, a jingle, then the level 5 news. */
  #hqDone() {
    const b = this.bike;
    this.hqView.celebrate(b.x, b.y);
    this.engineSound.jingle('levelUp');
    this.wallet.perks.electric = true;
    this.#save();
    this.events.emit('bark', 'MURAKAZA NEZA! The Alpha is yours');
    this.time.delayedCall(3200, () => {
      if (this.dayOver || this.scene.isPaused()) return;
      const r = this.hq?.result;
      const story = [
        'You hand in the old petrol moto and ride your own Ampersand Alpha out of the factory. The family waves, the staff clap.',
        r && !r.skipped ? `Test track: ${r.seconds.toFixed(1)} s.` : '',
      ].filter(Boolean).join(' ');
      this.scene.pause();
      this.scene.launch('dayEnd', {
        levelUp: { title: 'AMPERSAND HQ', bought: { milestone: 'Your new Alpha!', story }, next: { ...this.level, news: this.level.hqNews ?? this.level.news } },
        onContinue: () => this.scene.resume(),
      });
    });
  }

  startRefuel() {
    if (this.#hqF()) return;
    const offer = this.stationOffer();
    if (!offer) {
      this.events.emit('bark', this.refuel ? `Wait: ${Math.ceil(this.refuel.timeLeft)} s more at this stop` : this.#stationHint());
      return;
    }
    if (!offer.ok) {
      this.events.emit('bark', offer.text);
      return;
    }
    if (this.station === 'garage') {
      this.#openGarage();
      return;
    }
    if (this.station === 'food') {
      const f = RIDER.foods[this.foodStop.food];
      this.refuel = { kind: 'food', food: this.foodStop.food, timeLeft: f.seconds, total: f.seconds };
      this.#passengerAtStop();
      return;
    }
    // At a fuel station you choose how much to buy (see chooseFuel).
    if (this.station === 'fuel') {
      this.fuelChoice = this.fuelChoice ? null : fuelChoices(this.bike, this.fuelPrice);
      return;
    }
    const total =
      this.station === 'fuel' ? MONEY.fuelSeconds + Math.random() * MONEY.fuelQueueMaxSeconds :
      this.station === 'garage' ? MAINTENANCE.serviceSeconds : MONEY.swapSeconds;
    this.refuel = { kind: this.station, timeLeft: total, total };
    this.#passengerAtStop();
  }

  /** The effects on the bike: the parts you own, times the fuel use and wear of the mode. */
  #bikeMods() {
    const m = partEffects(this.wallet, this.bike.type);
    m.wear *= this.mode.wear;
    m.fuel *= this.mode.fuelUse;
    return m;
  }

  /**
   * Through a red light: a fine (hard mode only) when a red light camera or a police officer near the
   * junction sees you (Alp). Otherwise only a warning.
   */
  #checkRedLights() {
    const b = this.bike;
    for (const l of this.signals ?? []) {
      if (Math.abs(b.x - l.x) > 20 || Math.abs(b.y - l.y) > 20) {
        this.inBox.delete(l.id);
        continue;
      }
      const { inside, red } = redLightCheck(l, this.traffic.time, b, this.inBox.has(l.id));
      if (inside) this.inBox.add(l.id);
      else this.inBox.delete(l.id);
      if (!red) continue;
      const camera = this.mode.lights === 'cameras';
      const officer = this.police.police.officers.some((o) => Math.hypot(o.x - l.x, o.y - l.y) < TRAFFIC_LIGHTS.officerRangeMetres);
      if (!this.mode.fines) this.events.emit('bark', 'You went through a red light! Careful: in Kigali 2020 (hard) that is a fine');
      else if (camera || officer) {
        this.#pay('fines', TRAFFIC_LIGHTS.fine, camera ? 'Red light camera' : 'Police: a red light');
        this.events.emit('bark', `${camera ? 'FLASH! A red light camera' : 'PRRRT! A police officer'} saw you go through a red light: ${TRAFFIC_LIGHTS.fine.toLocaleString('en')} RWF fine`);
        if (!camera) this.engineSound.whistle();
      } else this.events.emit('bark', 'You went through a red light! Lucky: no camera and no police here');
    }
  }

  /** Hard mode: police helmet checks. A passenger needs a helmet (the spare helmet from level 2). */
  #updateHelmetChecks(dt) {
    const hc = this.helmetChecks;
    if (!hc) return;
    const b = this.bike, job = this.board.active;
    // The checkpoint officers show a sign now and then, so you can see the check from far away.
    this.checkSignTimer = (this.checkSignTimer ?? 0) - dt;
    if (this.checkSignTimer <= 0) {
      this.checkSignTimer = 2.5;
      for (const o of hc.checkpoints) if (!hc.done.has(o) && Math.hypot(o.x - b.x, o.y - b.y) < 70) this.#bubble(o.x, o.y, 38, 'HELMET CHECK', 0xffd060);
    }
    const ctx = {
      bike: { x: b.x, y: b.y, speed: Math.abs(forwardSpeed(b)) },
      passenger: job?.stage === 'toDropoff' && job.type === 'passenger',
      hasHelmet: !!this.wallet.perks.phone, // the level 2 milestone: a smartphone and a spare passenger helmet
    };
    const fine = HELMET_CHECKS.fine.toLocaleString('en');
    for (const e of stepHelmetCheck(hc, ctx, dt)) {
      const o = e.officer;
      if (e.type === 'called') {
        this.engineSound.whistle();
        this.#bubble(o.x, o.y, 30, 'HAGARARA!', 0xffffff);
        this.events.emit('bark', `Police helmet check! Stop beside the officer within ${HELMET_CHECKS.stopSeconds} s`);
      } else if (e.type === 'checking') this.events.emit('bark', 'The officer checks the helmets...');
      else if (e.type === 'passed') this.events.emit('bark', 'Helmets OK. "Murakoze, safe ride!"');
      else if (e.reason === 'noHelmet') {
        this.#pay('fines', HELMET_CHECKS.fine, 'Police: passenger with no helmet');
        this.events.emit('bark', `Your passenger has no helmet: ${fine} RWF fine. A spare helmet comes with the level 2 milestone`);
      } else {
        this.#pay('fines', HELMET_CHECKS.fine, 'Police: did not stop at a helmet check');
        this.events.emit('bark', `You did not stop at the helmet check: ${fine} RWF fine`);
      }
    }
  }

  /** The story arc: the first bark of the day, the yellow battery pickups. */
  #updateStory() {
    if (this.storyBark && this.started) {
      this.events.emit('bark', this.storyBark);
      this.storyBark = null;
    }
    this.batteryView.update(this.time.now);
    const got = this.batteries?.length ? takeBattery(this.batteries, this.bike) : null;
    if (got) {
      this.bike.boost = STORY.boostSeconds;
      this.engineSound.jingle('reward');
      this.events.emit('bark', `Yellow battery! ${STORY.boostSeconds} s of electric power: strong on the hills, and no fuel. Imagine this every day...`);
    }
  }

  /** Medium and hard modes: where the rider can eat. Positions in metres. */
  #foodStops() {
    const T = WORLD.tileMetres, stops = [];
    for (const p of this.world.placesWithTag('buffet')) stops.push({ food: 'buffet', name: `Buffet, ${p.name}`, x: p.x * T, y: p.y * T });
    for (const p of this.world.placesWithTag('milk')) stops.push({ food: 'ikivuguto', name: p.name, x: p.x * T, y: p.y * T });
    for (const s of this.markets.spots ?? []) if (s.kind === 'vendor' && s.goods === 'bananas') stops.push({ food: 'bananas', name: 'a banana seller', x: s.x, y: s.y });
    for (const s of this.markets.momo ?? []) stops.push({ food: 'drink', name: 'an MTN MoMo kiosk', x: s.x, y: s.y });
    return stops;
  }

  /** Medium and hard modes: the rider's energy goes down with the clock; a hungry rider has less power. */
  #updateRider(dt) {
    if (!this.rider) return;
    const { start, end, realSeconds } = this.level.shift;
    const dHours = ((end - start) * dt) / realSeconds;
    for (const e of stepRider(this.rider, this.clockHours, dHours, this.bike.engineDead)) {
      this.events.emit('bark', e.type === 'hungry'
        ? 'You are hungry: the moto feels slow. Eat at a buffet, an Inyange Milk Zone, a banana seller or a MoMo kiosk'
        : 'You are weak with hunger! Eat something now');
      if (e.type === 'weak') this.engineSound.jingle('gameOver');
    }
    this.bike.riderPower = riderPower(this.rider) * (this.mode.bladder ? bladderPower(this.rider) : 1);
  }

  /** The garage screen: the ride waits behind it. */
  #openGarage() {
    if (this.scene.isActive('garage')) return;
    this.scene.pause();
    if (this.scene.isActive('hud')) this.scene.pause('hud');
    this.engineSound.silence();
    this.scene.launch('garage', { place: this.stationPlace });
  }

  /** From the garage screen: back to the road. */
  closeGarage() {
    this.scene.stop('garage');
    if (this.scene.isPaused('hud')) this.scene.resume('hud');
    this.scene.resume();
  }

  /** From the garage screen: start the service (it takes MAINTENANCE.serviceSeconds). Returns { ok, text }. */
  startService() {
    const q = garageQuote(this.bike);
    const meter = Math.round(serviceDue(this.bike) * 100);
    if (q.nothing) return { ok: false, text: `The moto is fine (service meter ${meter}%).` };
    if (this.wallet.cash < q.cost && !this.bike.brokenDown) return { ok: false, text: 'Not enough cash for the service.' };
    const total = MAINTENANCE.serviceSeconds;
    this.refuel = { kind: 'garage', timeLeft: total, total };
    this.#passengerAtStop();
    return { ok: true };
  }

  /** From the garage screen: buy a part. Returns the result of sim/shop.js buyPart. */
  buyPart(id) {
    const res = shopBuy(this.wallet, id, this.bike.type);
    if (res.ok) {
      this.bike.mods = this.#bikeMods();
      this.events.emit('money', -res.item.price, res.item.name);
      // The speaker: the radio starts (it plays when you ride on).
      if (id === 'speaker') {
        this.radioStation = 0;
        this.radio.tune(0);
        this.#saveSettings();
      }
      this.#save();
    }
    return res;
  }

  /** Buy fuel choice i (0: 25% of a tank, 1: 50%, 2: a full tank). */
  chooseFuel(i) {
    const c = this.fuelChoice?.[i];
    if (!c) return;
    if (c.cost === 0) {
      this.events.emit('bark', 'The tank is full');
      return;
    }
    if (this.wallet.cash < MONEY.minFuelCash) {
      this.events.emit('bark', 'No cash for fuel');
      return;
    }
    this.fuelChoice = null;
    // A small amount is quick to pump; the queue is the same.
    const total = MONEY.fuelSeconds * Math.max(0.3, c.upTo - this.bike.energy) + Math.random() * MONEY.fuelQueueMaxSeconds;
    this.refuel = { kind: 'fuel', timeLeft: total, total, upTo: c.upTo };
    this.#passengerAtStop();
  }

  /** Fuel estimate for each job card (updated a few times each second). */
  #updateJobFuel(dt) {
    if ((this.jobFuelTimer = (this.jobFuelTimer ?? 0) - dt) > 0) return;
    this.jobFuelTimer = 0.4;
    for (const o of this.board.offers) o.fuel = jobFuel(this.world, this.bike, o);
    if (this.board.active) this.board.active.fuel = jobFuel(this.world, this.bike, this.board.active);
  }

  #finishRefuel() {
    const { kind, upTo = 1, food } = this.refuel;
    this.refuel = null;
    if (kind === 'food') {
      const f = RIDER.foods[food];
      this.#pay('food', f.price, f.name);
      eat(this.rider, food, this.clockHours);
      if (this.mode.bladder) drinkToBladder(this.rider, food);
      this.events.emit('bark', food === 'ikivuguto' ? 'Ikivuguto! Cold, thick and filling. Energy for hours' : food === 'buffet' ? 'A full plate from the buffet: rice, beans, matoke. Back to work!' : food === 'drink' ? 'An energy drink: a quick boost, but it wears off soon' : 'Sweet bananas: a small snack');
      return;
    }
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
    if (category === 'fines' && this.dayStats) recordFine(this.dayStats);
    spend(this.wallet, category, amount);
    this.events.emit('money', -amount, label);
  }

  /** Pay the daily quests that are done now. */
  #checkQuests() {
    for (const q of checkQuests(this.quests ?? [], this.dayStats)) {
      earn(this.wallet, 'bonus', q.reward);
      this.time.delayedCall(1900, () => {
        this.events.emit('money', q.reward, `Quest done: ${q.text.toLowerCase()}`);
        this.events.emit('bark', `App quest done! ${q.text}`);
        this.engineSound.jingle('reward');
      });
    }
  }

  /** A bonus once in a game: a secret place (sim/missions.js findSecret). */
  #checkSecrets() {
    const found = (this.wallet.secrets ??= []);
    const s = findSecret(this.world.secrets, found, this.bike, { night: (this.chunks.night ?? 0) > 0.5, spraying: this.signs.sprays?.some((img) => img.visible) });
    if (!s) return;
    found.push(s.id);
    earn(this.wallet, 'bonus', MISSIONS.secretBonus);
    this.events.emit('money', MISSIONS.secretBonus, `Secret place: ${s.name}`);
    this.events.emit('bark', `You found a secret place: ${s.name} (${found.length} of ${this.world.secrets.length})`);
    this.engineSound.jingle('levelUp');
    this.#save();
  }

  /** Money and law effects of one physics step. */
  #economyStep(bikeEvents) {
    const b = this.bike;
    for (const e of bikeEvents) {
      const cost = Math.round((repairCost(e) * (b.mods?.crash ?? 1) * this.mode.crashRepair) / 10) * 10; // crash bars and easy mode: cheaper repairs
      if (cost) this.#pay('repairs', cost, REPAIR_LABELS[e.type]);
    }
    stepMission(this.board.active, FIXED_DT); // the clock of a rush delivery or a hotel guest
    for (const e of updateJob(this.board, b, bikeEvents, FIXED_DT)) {
      if (e.type === 'pickup') {
        if (this.raceRival) {
          cancelMission(this.raceRival);
          this.raceRival = null;
        }
        this.events.emit('bark', e.job.visitor ? `A muzungu on board! Fare ×${MUZUNGU.fareFactor}. Ride slowly past the sights for photos. Go to ${e.job.to.name}`
          : e.job.type === 'passenger' ? `Passenger on board. Go to ${e.job.to.name}` : `${e.job.kg} kg of ${e.job.goods ?? 'rice'} loaded. Go to ${e.job.to.name}`);
        if (e.job.visitor) this.#visitorSays(greeting(this.clockHours).map((text) => ({ who: 'visitor', text })));
        if (overloaded(e.job)) this.time.delayedCall(2200, () => this.events.emit('bark', `Overloaded: ${e.job.kg} kg (the limit is ${HARD_RULES.overload.limitKg} kg). Keep away from the police!`));
      } else {
        // A side mission: a bonus when you meet its condition, or less pay (a late rush).
        const result = missionResult(e.job);
        if (result?.farePenalty) e.fare = Math.max(0, e.fare - result.farePenalty);
        if (result) {
          if (result.bonus) earn(this.wallet, 'bonus', result.bonus);
          // The network (story arc): each battery delivery helps more riders go electric.
          if (result.ok && e.job.mission.kind === 'batteries') {
            this.wallet.network = (this.wallet.network ?? 0) + 1;
            this.time.delayedCall(2600, () => this.events.emit('bark', `The swap network grows: ${this.wallet.network} battery ${this.wallet.network === 1 ? 'delivery' : 'deliveries'}. More riders go electric, and the air gets cleaner!`));
          }
          this.time.delayedCall(1000, () => {
            if (result.bonus) this.events.emit('money', result.bonus, `${e.job.mission.title.toLowerCase()} bonus`);
            this.events.emit('bark', result.text);
          });
        }
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
        const clean = e.job.clean && (e.job.type !== 'passenger' || e.job.comfort >= STREAK.minComfort) && e.job.damage < 0.05;
        // A muzungu: a clean ride counts as MUZUNGU.streakRides rides for the streak.
        for (let i = 0; i < (clean && e.job.visitor ? MUZUNGU.streakRides : 1); i++) updateStreak(this.wallet, clean);
        recordDelivery(this.dayStats, e.job, e.fare, this.clockHours, clean);
        this.#checkQuests();
        if (e.tip > 0) {
          earn(this.wallet, 'tips', e.tip);
          this.time.delayedCall(700, () => this.events.emit('money', e.tip, `Tip (comfort ${Math.round(e.job.comfort)}%)`));
        }
        if (e.job.visitor) {
          const [pay, thanks, reply] = dropOffLines(this.rng);
          this.#visitorSays([{ who: 'visitor', text: pay }, { who: 'visitor', text: thanks }, { who: 'rider', text: reply }]);
          const photoTip = e.job.visitorState?.photoTip ?? 0;
          if (photoTip > 0) {
            earn(this.wallet, 'tips', photoTip);
            this.time.delayedCall(1600, () => this.events.emit('money', photoTip, `Photo stops (${e.job.visitorState.photos})`));
          }
        }
        // Parts from the garage: the speaker and the phone charger bring extra tips.
        const extra = partsTip(e.job, b.mods ?? partEffects(this.wallet, b.type));
        if (extra > 0) {
          earn(this.wallet, 'tips', extra);
          this.time.delayedCall(1000, () => this.events.emit('money', extra, 'Extra tip (music and charger)'));
        }
      }
    }
    const kmh = Math.abs(forwardSpeed(b)) * 3.6;
    this.#visitorStep(bikeEvents, kmh);
    const cameraEvents = this.level.cameras && this.mode.cameras ? checkCameras(this.world, this.cameraState, b, kmh) : [];
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
    // Medium and hard modes: food stops (a station of kind 'food'). A fuel or swap station near them comes first.
    this.foodStop = null;
    for (const f of this.foodStops ?? []) {
      if (Math.hypot(b.x - f.x, b.y - f.y) < STATION_RANGE_METRES) {
        this.station = 'food';
        this.foodStop = f;
      }
    }
    for (const kind of ['fuel', 'swap', 'garage', 'office']) {
      for (const p of this.world.placesWithTag(kind)) {
        if (this.#atStation(kind, p)) {
          this.station = kind;
          this.stationPlace = p;
        }
      }
    }
    if (this.station !== 'fuel') this.fuelChoice = null;
  }

  /** Is the bike at this station: near its stop point, or beside its building? */
  #atStation(kind, p) {
    const b = this.bike, T = WORLD.tileMetres;
    if (Math.hypot(b.x - p.x * T, b.y - p.y * T) < STATION_RANGE_METRES) return true;
    const blockKind = STATION_BLOCK_KINDS[kind];
    if (!blockKind) return false;
    if (!this.stationBlocks) this.stationBlocks = new Map();
    const key = `${kind}:${p.id ?? p.name}`;
    if (!this.stationBlocks.has(key)) {
      // The building tiles of this station: blocks of its kind within 4 tiles of the stop point.
      this.stationBlocks.set(key, this.world.blocks.filter((k) => k.kind === blockKind && Math.abs(k.tx + 0.5 - p.x) < 4 && Math.abs(k.ty + 0.5 - p.y) < 4));
    }
    return this.stationBlocks.get(key).some((k) => {
      const dx = Math.max(k.tx * T - b.x, 0, b.x - (k.tx + 1) * T), dy = Math.max(k.ty * T - b.y, 0, b.y - (k.ty + 1) * T);
      return Math.hypot(dx, dy) < STATION_BUILDING_METRES;
    });
  }

  /** F with no station here: say why, so that the key never seems to do nothing. */
  #stationHint() {
    const b = this.bike, T = WORLD.tileMetres;
    const near = ['garage', 'swap', 'fuel', 'office']
      .flatMap((kind) => this.world.placesWithTag(kind).map((p) => ({ p, d: Math.hypot(b.x - p.x * T, b.y - p.y * T) })))
      .sort((a, c) => a.d - c.d)[0];
    if (near && near.d < 25) {
      return Math.abs(forwardSpeed(b)) * 3.6 >= 3 ? `Stop at ${near.p.name} first, then press F` : `Ride closer to ${near.p.name} and stop, then press F`;
    }
    return 'F works when you stop at a station, a garage or a food stop. Garages are orange on the minimap';
  }

  /** The level's settings, traffic, people and job board. Called at the start and at each new day. */
  #applyLevel() {
    const L = (this.level = levelSettings(this.wallet));
    // The Ampersand HQ mission (sim/hq.js): while the Alpha waits and Kicukiro is open. A mission that has
    // started goes on (after the trade-in the Alpha is yours, so the mission is not "due" any more).
    if (hqMissionDue(this.wallet) && L.districts.includes('kicukiro')) {
      if (!this.hq || this.hq.stage === 'done') this.hq = createHq();
    } else if (this.hq && !['alpha', 'track', 'exit', 'done'].includes(this.hq.stage)) this.hq = null;
    // The difficulty mode (sim/modes.js): fuel use, wear, potholes, traffic. The gears are always manual.
    const mode = (this.mode = modeOf(this.wallet));
    this.bike.autoShift = false;
    // Parts and upgrades from the garage, and the fuel use and wear of the mode.
    this.bike.mods = this.#bikeMods();
    if (setHazardShare(this.world, mode.hazards)) this.chunks?.reload();
    // Medium and hard modes: the rider must eat (sim/rider.js). Breakfast at home: each day starts with RIDER.startEnergy.
    this.rider = mode.riderEnergy ? createRider(mode.riderEnergy) : null;
    this.bike.riderPower = 1;
    this.foodStops = mode.riderEnergy ? this.#foodStops() : [];
    this.foodSigns.set(this.foodStops);
    // The map grows with the levels: only the open districts have roads, traffic, people and jobs.
    this.world.setOpenDistricts(L.districts);
    this.barriers.update();
    this.roadGraph = buildRoadGraph(openRoads(this.world.roads, this.world.districts, L.districts));
    pruneOneWay(this.roadGraph, this.oneWays); // traffic keeps to the one-way streets (all modes)
    this.oneWays = strictOneWays(this.roadGraph, this.oneWays); // a dead-end part is not one-way
    this.roadEventsView.setRuleSigns(this.oneWays, this.noMotos);
    // Traffic lights in the open districts (not in Kigali 2010).
    this.signals = mode.lights === 'none' ? [] : this.allSignals.filter((l) => L.districts.includes(l.district));
    attachLights(this.roadGraph, this.signals);
    this.signalView.setActive(this.signals);
    this.inBox = new Set();
    // Hard mode: today's police helmet checks (sim/checks.js).
    const T = WORLD.tileMetres;
    this.helmetChecks = mode.helmetChecks
      ? pickCheckpoints(this.police.police.officers, (o) => this.world.districtAt(Math.floor(o.x / T), Math.floor(o.y / T)), L.districts, this.wallet.day)
      : null;
    const stop = this.world.busStops.find((s) => s.park);
    this.parkStop = stop && L.districts.includes(this.world.districtAt(stop.x, stop.y)) ? stop : null;
    this.parkEdge = this.parkStop ? this.#edgeThrough(this.parkStop) : null;
    this.busTimer = 4;
    const counts = {};
    for (const [kind, n] of Object.entries(TRAFFIC.perDistrict)) counts[kind] = Math.round(n * L.districts.length * L.traffic * mode.traffic);
    // Busy moto taxis and Ampersand riders on red Alphas (more of them at each level), then the rivals.
    const motos = Math.round(TRAFFIC.motosPerDistrict * L.districts.length * L.traffic * mode.traffic);
    counts.amp = Math.round(motos * TRAFFIC.ampShare[Math.min(L.n, TRAFFIC.ampShare.length) - 1]);
    counts.taxi = motos - counts.amp;
    counts.moto = L.rivals;
    counts.cyclist = (L.cyclists ?? 0) * L.districts.length; // slow bicycles from level 3
    // Rush hours: extra cars and minibuses (they wait off the road outside the rush hours, see sim/rush.js).
    const rush = rushCounts(counts, mode.rushExtra);
    counts.car += rush.car;
    counts.bus += rush.bus;
    const riders = fleetRiders(this.wallet);
    counts.fleet = riders.length; // your hired riders (levels 6 and 8)
    // The Umuganda run (sim/umuganda.js): police patrol cars on the main roads on an Umuganda day.
    const dayEvent = this.cheatEvent !== undefined ? this.cheatEvent : pickDayEvent(L, this.wallet.day);
    if (dayEvent === 'umuganda') counts.police = patrolCount(L.districts);
    this.umuganda = { done: 0, gap: 3, spot: { spot: null }, jobId: null };
    // The story arc: in the petrol levels 3 and 4 an Ampersand rider rides in the traffic (a fleet moto with no
    // hired rider), and yellow battery pickups lie on the roads.
    const yellow = STORY.batteryLevels.includes(L.n) && L.bikeType === 'petrol';
    if (yellow) counts.fleet += 1;
    this.batteries = yellow ? batterySpots(this.world, L.districts, this.wallet.day) : [];
    this.batteryView.set(this.world, this.batteries);
    this.bike.boost = 0;
    this.storyBark = yellow ? `An Ampersand rider passes on a red electric Alpha. Ride over a yellow battery on the road: ${STORY.boostSeconds} s of electric power!` : null;
    this.trafficView?.destroy();
    this.peopleView?.destroy();
    this.traffic = createTraffic(this.world, this.roadGraph, mulberry32(Date.now() & 0xffff), counts);
    // The day event (from level 6): Umuganda or rain (sim/events.js). The same day gives the same event.
    this.dayEvent = dayEvent; // cheatEvent: the cheat menu
    this.eventStage = undefined; // #updateEvent barks at the first frame
    const wasRain = !!this.world.rain;
    this.world.rain = this.dayEvent === 'rain';
    if (wasRain !== this.world.rain) this.chunks.reload(); // wet or dry murram: draw the ground again
    this.rainView.setRain(this.world.rain);
    // The plan of the day for the hired riders: bad days and calls for help (none on the Umuganda morning).
    this.fleetPlan = planFleetDay(riders, this.wallet.day, L.shift, this.dayEvent === 'umuganda' ? EVENTS.umuganda.endHour : L.shift.start);
    attachFleet(this.traffic, this.fleetPlan, mulberry32(this.wallet.day * 53 + 1));
    markRush(this.traffic, rush);
    if (this.dayEvent === 'umuganda') parkTraffic(this.traffic, EVENTS.umuganda.trafficShare, mulberry32(this.wallet.day * 31 + 5));
    // Street events (sim/roadevents.js): road works, a VIP convoy, a car free morning.
    const districtAt = (x, y) => this.world.districtAt(Math.floor(x / T), Math.floor(y / T));
    const works = pickRoadWorks(this.roadGraph, districtAt, L.districts, this.wallet.day, L.n);
    this.traffic.slowZones = works.map((w) => w.zone);
    this.roadEventsView.setWorks(works);
    this.convoy = { plan: planConvoy(this.roadGraph, districtAt, L.districts, this.wallet.day, L.n, L.shift), started: false, warned: false, fined: false };
    if (dayEvent === 'umuganda' && this.convoy.plan?.hour < EVENTS.umuganda.endHour) this.convoy.plan = null; // no convoy on the empty Umuganda roads
    const roads = carFreeRoads(this.world.roads).filter((r) => L.districts.includes(districtAt(((r.x0 ?? r.x) + 1) * T, ((r.y ?? r.y0) + 1) * T)));
    this.carFree = { day: (this.cheatCarFree ?? isCarFreeDay(this.wallet.day, L.n, dayEvent)) && roads.length > 0, roads, active: false, warned: false };
    this.roadEventsView.setCarFree(roads, false);
    // Hard mode: mobile speed checks (a parked patrol car with a radar) and the toilets for the bathroom need.
    this.speedChecks = mode.fines ? pickSpeedChecks(this.roadGraph, districtAt, L.districts, this.wallet.day, L.n) : [];
    this.speedCheckState = new Map();
    this.roadEventsView.setSpeedChecks(this.speedChecks);
    this.busStopWait = 0;
    this.busStopFined = null;
    if (this.rider && mode.bladder) this.rider.bladder = 0;
    this.toilets = mode.bladder ? this.#toilets() : [];
    this.toiletWait = 0;
    this.trafficView = new TrafficView(this, this.traffic);
    this.lights.setTraffic(this.traffic);
    this.people = createPeople(this.world, this.rng, { hailEvery: L.hailEvery, districts: L.districts, walkers: PEOPLE.walkersPerDistrict * L.districts.length });
    this.peopleView = new PeopleView(this, this.people);
    // Work crews (sim/crews.js): on an Umuganda morning everybody works at the road sides (hoes in the
    // fields, brooms on the roads); on a normal day a few city sweepers work in the early morning.
    this.crewView ??= new CrewView(this);
    this.crewView.setCrews([]);
    this.crewKey = '';
    this.crews = {
      umuganda: dayEvent === 'umuganda' ? placeCrews(this.world, mulberry32(this.wallet.day * 53 + 7), 'umuganda', { districts: L.districts, looks: CREW_LOOKS }) : [],
      sweepers: placeCrews(this.world, mulberry32(this.wallet.day * 59 + 3), 'sweepers', { districts: L.districts }),
      site: [],
    };
    this.crews.sweepersDay = daySweepers(this.crews.sweepers); // fewer sweepers after the morning
    this.crossState = { timers: new Map(), seen: new Set() };
    // Side missions: some new offers become special jobs (sim/missions.js).
    // Hard mode: some cargo is too heavy for a moto (overloading: more pay, but the police fine it).
    const decorate = (offer, board) => {
      // The muzungu (a foreign visitor who pays 4 times the fare): about 1 new offer in 15.
      const o = maybeVisitor(maybeMission(offer, board, this.world, L.n, board.rng), board, this.world, L.n, board.rng);
      return mode.fines ? maybeHeavy(o, board.rng) : o;
    };
    this.board = createJobBoard(this.world, Date.now() & 0xffff, { fareMultiplier: L.fare, offerLife: L.offerLife, districts: L.districts, maxOffers: L.maxOffers, decorate });
    this.#eventEffects();
    if (!eventStage(this.dayEvent, this.clockHours).customers) this.board.offers = [];
    this.raceRival = null;
    // The daily app quests (from level 3) and the stats they follow.
    this.dayStats = dayStats();
    const hasHotels = this.world.places.some((p) => p.tags.includes('hotel') && L.districts.includes(p.district));
    this.quests = pickQuests(L.n, mulberry32(this.wallet.day * 977 + L.n), hasHotels, this.dayEvent === 'umuganda' ? ['morning'] : []);
  }

  /** The effects of the day event at this hour: fares, offers, street hails. Returns the stage (sim/events.js). */
  #eventEffects() {
    const L = this.level, st = eventStage(this.dayEvent, this.clockHours);
    this.board.opts.fareMultiplier = L.fare * st.fare;
    this.board.opts.maxOffers = st.customers ? Math.min(JOBS.maxOffersShown, (L.maxOffers ?? JOBS.maxOffers) + st.extraOffers) : 0;
    this.people.hailEvery = L.hailEvery * st.hailEvery;
    this.people.noHails = !st.customers;
    return st;
  }

  /** Each frame: the event effects, the traffic that comes back after the Umuganda morning, and the barks. */
  #updateEvent(dt) {
    const st = this.#eventEffects();
    // Rush hours: the extra traffic comes and goes far from you (not on the Umuganda morning).
    if ((this.rushTimer = (this.rushTimer ?? 0) - dt) <= 0) {
      this.rushTimer = 1;
      stepRush(this.traffic, this.cheatRush ? RUSH.hours[0][0] + 0.5 : this.clockHours, this.bike, st.trafficFull);
    }
    const rushNow = (this.cheatRush || isRushHour(this.clockHours)) && this.mode.rushExtra > 0 && st.trafficFull;
    if (rushNow !== !!this.rushNow) {
      this.rushNow = rushNow;
      if (rushNow) this.events.emit('bark', 'Rush hour! Heavy traffic on the main roads. Filter with care, or take the side streets');
    }
    if (st.trafficFull && this.traffic.dormant?.length && (this.wakeTimer = (this.wakeTimer ?? 0) - dt) <= 0) {
      this.wakeTimer = 1;
      wakeTraffic(this.traffic, this.bike.x, this.bike.y, EVENTS.umuganda.wakeMetres);
    }
    // The Umuganda morning: nobody walks in the streets (they work with the crews); they come back after it.
    const quiet = this.dayEvent === 'umuganda' && st.stage === 'morning';
    if (quiet && !this.people.away) {
      this.people.away = this.people.walkers.filter((p) => !p.crosser);
      this.people.walkers = [];
    } else if (!quiet && this.people.away) {
      this.people.walkers.push(...this.people.away);
      this.people.away = null;
    }
    if (st.stage === this.eventStage) return;
    const bark = eventBark(this.dayEvent, this.eventStage, st.stage);
    this.eventStage = st.stage;
    if (bark) this.events.emit('bark', bark);
  }

  #save() {
    const { energy, serviceWear, brokenDown, brakeWearKm } = this.bike;
    const { ledger, ...wallet } = this.wallet;
    saveGame({ wallet, bike: { energy, serviceWear, brokenDown, brakeWearKm } });
  }

  /**
   * The end of the shift. reason: the game is over before the shift ends: 'stranded' (see #updateStranded)
   * or 'jail' (you hit a police officer).
   */
  #endDay(reason = null) {
    if (this.board.active) cancelJob(this.board, this.bike);
    this.#endRescue(); // a fuel moto that has not come yet: no fuel and no payment
    cancelMission(this.raceRival);
    this.raceRival = null;
    this.refuel = null;
    // The hired riders pay their rent (sim/fleet.js), and you pay the service of their motos.
    const fleet = fleetDayMoney(this.fleetPlan ?? []);
    if (fleet.rent) earn(this.wallet, 'fleet', fleet.rent);
    if (fleet.costs) spend(this.wallet, 'fleet', fleet.costs);
    const summary = endDay(this.wallet, this.bike, this.level.rent);
    summary.fleetLines = fleet.lines;
    summary.level = this.level;
    summary.event = this.dayEvent;
    summary.network = this.wallet.network ?? 0; // battery deliveries to the swap stations (story arc)
    // Game over: stranded (an empty tank and no cash), or below zero cash after the rent. There is no loan.
    summary.gameOver = reason ?? (summary.outOfCash ? 'cash' : null);
    if (reason === 'jail') summary.hitKmh = this.jailKmh;
    summary.career = { days: summary.day, totalIncome: this.wallet.totalIncome, milestones: this.wallet.milestones.length };
    summary.milestoneReady = !summary.gameOver && milestoneReady(this.wallet);
    summary.savingsTarget = savingsTarget(this.wallet);
    this.dayOver = true;
    // The engine stops (it used to keep humming the last note), and a short tune says the shift is over.
    this.engineSound.silence();
    this.engineSound.jingle(summary.gameOver ? 'gameOver' : 'shiftEnd');
    // The game is over: remove the save now, so that a reload of the page cannot bring the moto back.
    if (summary.gameOver) clearSave();
    this.scene.pause();
    this.scene.launch('dayEnd', { summary, onContinue: (choice) => this.#startDay(choice) });
  }

  /**
   * choice: 'next' (next day), 'buy' (buy the milestone, then show the new level),
   * 'newGame' (start again at level 1: after a game over, or from the day end screen).
   */
  /** The career numbers for the ending screen. */
  #endingStats() {
    const w = this.wallet;
    return {
      days: w.day, totalIncome: w.totalIncome, milestones: w.milestones.length, network: w.network ?? 0,
      secrets: (w.secrets ?? []).length, secretsTotal: this.world.secrets?.length ?? 0, modeName: modeOf(w).name,
    };
  }

  #startDay(choice = 'next') {
    if (choice === 'buy') {
      const bought = buyMilestone(this.wallet);
      if (bought) {
        this.engineSound.jingle('levelUp');
        this.#save();
        const next = levelSettings(this.wallet);
        const levelUp = () => this.scene.launch('dayEnd', { levelUp: { bought, next }, onContinue: () => this.#startDay('next') });
        // The last milestone (the house): the ending first, then free play.
        if (next.freePlay && !this.wallet.endingSeen) {
          this.wallet.endingSeen = true;
          this.#save();
          this.scene.launch('dayEnd', { ending: this.#endingStats(), onContinue: levelUp });
          return;
        }
        levelUp();
        return;
      }
    }
    this.dayTime = 0;
    this.dayOver = false;
    this.hqAnnounced = false;
    this.partFxView.reset();
    this.hq = null; // a new day: the mission starts again if the Alpha still waits (see #applyLevel)
    this.honkBarked = false;
    this.strandedTime = null;
    this.debtTime = null;
    this.jailTimer = null;
    const { autoShift, energy, serviceWear, brokenDown, brakeWearKm } = this.bike;
    if (choice === 'newGame') {
      this.cheatEvent = undefined;
      this.cheatRush = false;
      this.cheatCarFree = undefined;
      clearSave();
      this.wallet = createWallet();
      this.wallet.mode = this.newMode ?? this.wallet.mode;
      if (this.testStartLevel > 1) startAtLevel(this.wallet, this.testStartLevel); // test mode (Settings, only with the cheats on)
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

  // ---------------------------------------------------------------------------
  // The cheat menu (for tests of all the levels and functions). Type INZIZA in a menu, or tap the
  // version label 5 times, to turn it on; then CHEATS is in the pause menu (MenuScene).
  // ---------------------------------------------------------------------------

  setCheats(on) {
    this.cheatsOn = on;
    this.#saveSettings();
  }

  /** The lines of the cheat menu: [label, id]. */
  cheatItems() {
    const w = this.wallet, L = this.level, mode = this.mode;
    const ev = this.cheatEvent === undefined ? 'AUTO' : this.cheatEvent === null ? 'NONE' : this.cheatEvent.toUpperCase();
    return [
      [`LEVEL ${w.level} ▶ ${w.level < LEVELS.length ? w.level + 1 : 1} (NOW)`, 'levelUp'],
      [`LEVEL ${w.level} ▶ ${w.level > 1 ? w.level - 1 : LEVELS.length} (NOW)`, 'levelDown'],
      ...(L.freePlay ? [] : [['SAVE THE GOAL, END THE SHIFT', 'goal']]),
      ['AMPERSAND HQ MISSION NOW (LEVEL 5)', 'hqMission'],
      ['+50,000 RWF', 'cash'],
      ['FILL UP: FUEL, SERVICE, FOOD', 'fill'],
      ['CLOCK +1 HOUR', 'hour'],
      ['END THE SHIFT NOW', 'endShift'],
      [`MOTO: ${this.bike.type === 'electric' ? 'ELECTRIC (SWAP)' : 'PETROL (FUEL)'}`, 'bike'],
      [`MODE: ${mode.short}`, 'mode'],
      [`DAY EVENT: ${ev}`, 'event'],
      [`RUSH HOUR: ${this.cheatRush ? 'ON' : 'AUTO'}`, 'rush'],
      ['YELLOW BATTERY: 25 S BOOST', 'boost'],
      [`CAR FREE MORNING: ${this.carFree?.day ? 'ON' : 'OFF'}`, 'carFree'],
      ['VIP CONVOY NOW', 'convoy'],
      ['MUZUNGU ON THE BIKE NOW', 'muzungu'],
      ['GO TO: AMPERSAND HQ', 'goOffice'],
      ['GO TO: NEAREST GARAGE', 'goGarage'],
      [`GO TO: NEAREST ${this.bike.type === 'electric' ? 'SWAP' : 'FUEL'} STATION`, 'goStation'],
      ['GO TO: NYABUGOGO BUS PARK', 'goPark'],
      ['SHOW THE ENDING', 'ending'],
    ];
  }

  /**
   * Do a cheat. Returns { text, close }: close 'resume' = close the menu and ride on; 'none' = close
   * the menu, the cheat opens its own screen; no close = stay in the cheat menu.
   */
  cheat(id) {
    const w = this.wallet, b = this.bike, T = WORLD.tileMetres;
    const money = (n) => `${n.toLocaleString('en')} RWF`;
    const nearest = (tag) => this.world.placesWithTag(tag)
      .filter((p) => !p.district || this.level.districts.includes(p.district))
      .sort((p, q) => Math.hypot(p.x * T - b.x, p.y * T - b.y) - Math.hypot(q.x * T - b.x, q.y * T - b.y))[0];
    const goTo = (p, name) => {
      if (!p) return { text: `${name}: none in the open districts` };
      this.teleport(p.x, p.y, 0);
      return { text: `YOU ARE AT: ${name}`, close: 'resume' };
    };
    switch (id) {
      case 'levelUp': case 'levelDown': {
        const n = id === 'levelUp' ? (w.level % LEVELS.length) + 1 : ((w.level + LEVELS.length - 2) % LEVELS.length) + 1;
        this.#cheatLevel(n);
        return { text: `LEVEL ${n}: ${this.level.name.toUpperCase()}` };
      }
      case 'goal':
        w.cash = Math.max(w.cash, savingsTarget(w) + 20000); // + the costs of the day
        this.dayTime = this.level.shift.realSeconds;
        return { text: 'GOAL SAVED: AT THE DAY END, PRESS M', close: 'resume' };
      case 'hqMission': {
        // The Alpha waits at HQ (as after the level 4 milestone): you are on the old moto at the in gate.
        if (w.level < 5) setLevel(w, 5);
        Object.assign(w.perks, { alphaReady: true, electric: false });
        this.hq = null;
        this.hqAnnounced = false;
        this.#cheatBike();
        this.#cheatRefresh();
        this.teleport((HQ.gates.in[0] + HQ.gates.in[1]) / 2, HQ.yard.y1 + 2.4, -90);
        return { text: 'AMPERSAND HQ: RIDE IN, STOP, PRESS F', close: 'resume' };
      }
      case 'cash':
        w.cash += 50000;
        return { text: `CASH: ${money(w.cash)}` };
      case 'fill':
        Object.assign(b, { energy: 1, serviceWear: 0, brokenDown: false, brakeWearKm: 0, engineDead: false });
        if (this.rider) Object.assign(this.rider, { energy: 1, hungryWarned: false, weakWarned: false });
        return { text: 'FULL TANK, NEW SERVICE, FULL FOOD BAR' };
      case 'hour': {
        const { start, end, realSeconds } = this.level.shift;
        this.dayTime = Math.min(realSeconds, this.dayTime + realSeconds / (end - start));
        return { text: `CLOCK: ${String(Math.floor(this.clockHours)).padStart(2, '0')}:00` };
      }
      case 'endShift':
        this.dayTime = this.level.shift.realSeconds;
        return { text: 'THE SHIFT ENDS', close: 'resume' };
      case 'bike': {
        // Petrol or electric: the electric moto is yours (no bike rent, swap stations), as after the level 4 milestone.
        w.perks.electric = !w.perks.electric;
        this.#cheatBike();
        this.#cheatRefresh();
        return { text: this.bike.type === 'electric' ? 'ELECTRIC MOTO: FULL BATTERY, USE THE SWAP STATIONS' : 'PETROL MOTO: FULL TANK, USE THE FUEL STATIONS' };
      }
      case 'mode': {
        const ids = Object.keys(MODES);
        w.mode = ids[(ids.indexOf(this.mode.id) + 1) % ids.length];
        this.#cheatRefresh();
        return { text: `MODE: ${this.mode.name.toUpperCase()}` };
      }
      case 'event': {
        const order = [undefined, null, 'rain', 'umuganda'];
        this.cheatEvent = order[(order.indexOf(this.cheatEvent) + 1) % order.length];
        this.#cheatRefresh();
        return { text: `DAY EVENT: ${this.dayEvent ? this.dayEvent.toUpperCase() : 'NONE'}` };
      }
      case 'rush':
        this.cheatRush = !this.cheatRush;
        return { text: this.cheatRush ? 'RUSH HOUR TRAFFIC ON (NOT IN EASY MODE)' : 'RUSH HOURS BY THE CLOCK' };
      case 'carFree':
        this.cheatCarFree = !this.carFree?.day;
        this.#cheatRefresh();
        return { text: this.carFree.day ? `CAR FREE ${ROAD_EVENTS.carFree.fromHour}:00-${ROAD_EVENTS.carFree.toHour}:00 (KACYIRU OPEN?)` : 'NO CAR FREE MORNING' };
      case 'convoy': {
        const T = WORLD.tileMetres;
        const plan = planConvoy(this.roadGraph, (x, y) => this.world.districtAt(Math.floor(x / T), Math.floor(y / T)), this.level.districts, this.wallet.day + Math.floor(this.rng() * 1000), this.level.n, this.level.shift, true);
        if (!plan) return { text: 'NO ROUTE FOR A CONVOY HERE' };
        this.convoy = { plan: { ...plan, hour: 0 }, started: false, warned: false, fined: false };
        const start = plan.route[0];
        this.teleport((start.from.x + start.dx * 30 - start.dy * 9) / T, (start.from.y + start.dy * 30 + start.dx * 9) / T, 0);
        return { text: 'THE CONVOY COMES: PULL OVER AND STOP', close: 'resume' };
      }
      case 'muzungu': {
        // A visitor job at once: the muzungu is on the bike at a hotel or a landmark.
        const offer = maybeVisitor(makeOffer(this.world, this.rng, this.board.nextId++, this.board.opts), { ...this.board, offers: [] }, this.world, MUZUNGU.fromLevel, () => 0);
        if (!offer.visitor) return { text: 'NO VISITOR PLACES OPEN: GO TO LEVEL 2 OR MORE' };
        cancelJob(this.board, b);
        this.teleport(offer.from.x, offer.from.y, 0);
        this.board.active = { ...offer, stage: 'toDropoff', comfort: 100, damage: 0, clean: true };
        b.loadKg = offer.kg;
        b.loadType = 'visitor';
        this.time.delayedCall(400, () => this.#visitorSays(greeting(this.clockHours).map((text) => ({ who: 'visitor', text }))));
        return { text: `MUZUNGU ON BOARD: GO TO ${offer.to.name.toUpperCase()}`, close: 'resume' };
      }
      case 'boost':
        b.boost = STORY.boostSeconds;
        return { text: `${STORY.boostSeconds} S OF ELECTRIC BOOST`, close: 'resume' };
      case 'goOffice': return goTo(this.world.placesWithTag('office')[0], 'AMPERSAND HQ');
      case 'goGarage': return goTo(nearest('garage'), 'GARAGE');
      case 'goStation': return goTo(nearest(b.type === 'electric' ? 'swap' : 'fuel'), 'STATION');
      case 'goPark': return goTo(this.parkStop, 'NYABUGOGO BUS PARK');
      case 'ending':
        this.scene.launch('dayEnd', { ending: this.#endingStats(), onContinue: () => this.resumeGame() });
        return { text: '', close: 'none' };
      default:
        return { text: '' };
    }
  }

  /** Cheat: a new bike at the same place when the bike type of the wallet is not the type you ride. */
  #cheatBike() {
    const type = levelSettings(this.wallet).bikeType;
    if (type === this.bike.type) return;
    const { x, y, heading, autoShift } = this.bike;
    this.bike = createBike(this.world, type);
    Object.assign(this.bike, { x, y, heading, autoShift, z: this.world.heightAt(x, y), energy: 1 });
  }

  /** Cheat: go to level n now. A new bike when the type changes; back to the start if your district closes. */
  #cheatLevel(n) {
    setLevel(this.wallet, n);
    this.#cheatBike();
    this.#cheatRefresh();
    const T = WORLD.tileMetres;
    if (!this.level.districts.includes(this.world.districtAt(Math.floor(this.bike.x / T), Math.floor(this.bike.y / T)))) {
      this.teleport(this.world.start.x, this.world.start.y, this.world.start.headingDeg);
    }
  }

  /** Cheat: build the level again (mode, event, traffic, jobs); the clock and the bike stay. */
  #cheatRefresh() {
    this.station = null;
    this.#applyLevel();
    this.#placeBike();
    this.#save();
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
      // On foot at HQ (sim/hq.js) the old moto stands still too.
      this.controls = this.refuel || this.hq?.walker ? { throttle: 0, brake: 1, steer: 0, hold: true } : readControls(this.steeringMode, raw, this.bike);
      const events = stepBike(this.bike, this.controls, this.world, FIXED_DT);
      const crashed = events.some((e) => e.type === 'crash');
      for (const e of events) {
        if (e.type === 'crash' || (e.type === 'wall' && e.speed > 3)) this.fxWall = true; // the crash bars show
        if (e.type === 'slide') {
          this.partFxView.play('slide', this); // mud flies off the rear wheel (all bikes)
          if (this.time.now - (this.slideBarkAt ?? -1e9) > 12000) {
            this.slideBarkAt = this.time.now;
            this.events.emit('bark', 'Slippery! The wet murram slides. Turn slowly');
          }
          continue;
        }
        if (e.type === 'crash') {
          this.#crash(e);
          continue;
        }
        if (e.type === 'wall' && !e.hit && this.#closedAhead()) {
          e.barrier = true; // a road barrier: no repair bill
          continue;
        }
        // You hit a police officer: at speed, that is jail (the game is over); a touch is a warning.
        if (e.type === 'wall' && e.hit?.officer && this.jailTimer == null) {
          const kmh = Math.round(e.speed * 3.6);
          if (kmh >= POLICE.jailKmh) {
            this.jailTimer = POLICE.jailDelaySeconds;
            this.jailKmh = kmh;
            this.engineSound.whistle();
            this.events.emit('bark', `You hit a police officer at ${kmh} km/h! The police arrest you`);
          } else if (this.time.now - (this.officerTouch ?? -1e9) > 3000) {
            this.officerTouch = this.time.now;
            this.events.emit('bark', 'Careful! You touched a police officer');
          }
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
            if (this.mode.fines) this.#pay('fines', PEOPLE.hitFine, 'Police: you hit a person');
            this.events.emit('bark', 'You hit a person! Slow down near people');
          }
          continue;
        }
        if (e.type === 'wall' && e.hit?.kind) {
          this.events.emit('bark', `Crash! You hit ${e.hit.kind === 'amp' ? 'an' : 'a'} ${e.hit.kind === 'fleet' ? (e.hit.rider ? 'moto of your fleet' : 'Ampersand rider') : HIT_NAMES[e.hit.kind] ?? e.hit.kind}`);
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
    this.#updateHq(dt);
    this.#updateRadio(dt);
    this.#updateRescue(dt);
    this.#updateStation();
    this.#updateEvent(dt);
    this.#updateFleet(dt);
    this.#updateRider(dt);
    this.#updateStory();
    this.signalView.update(this.traffic.time);
    this.#checkRedLights();
    this.#updateHelmetChecks(dt);
    updateBoard(this.board, this.world, dt);
    this.#updateJobFuel(dt);
    this.speedLimit = speedLimitAt(this.world, this.bike.x, this.bike.y);
    this.#updateMarker();
    this.#updateFuelGuide();
    this.chunks.update(this.bike.x, this.bike.y);
    this.#placeBike();
    this.hqView.update(this.hq, this, dt, this.time.now);
    this.#updatePartFx(dt);
    this.#updateSmoke(dt);
    this.#updateOcclusion();
    this.#updateCamera(dt);
    this.chunks.cull(this.cameras.main.worldView);
    this.trafficView.update(this.world, this.cameras.main.worldView);
    this.peopleView.update(this.world, this.cameras.main.worldView, this.time.now);
    this.#updateCrews(dt);
    this.garages.update(this.time.now);
    this.markets.update(this.time.now);
    this.attendant.update(this, dt, this.time.now);
    this.#updatePolice(dt);
    this.#updateUmuganda(dt);
    this.#updateStreetEvents(dt);
    this.#updateHardRules(dt);
    this.daylight = daylight(this.clockHours);
    if (this.world.rain) this.daylight.tint = rainTint(this.daylight.tint); // grey light on a rainy day
    this.chunks.night = this.daylight.night;
    this.lights.update(this.daylight, this.cameras.main.worldView, this.bike, this.controls.brake > 0.1);
    this.rainView.update(this.cameras.main.worldView, dt);
    this.kitesView.update(this.time.now, dt, this.cameras.main.worldView, this.daylight.light, this.world.rain);
    this.smogView.update(this.cameras.main.worldView, dt, smogAt(this.wallet.level));
    this.#updateRivalPin();
    this.#updateHonks(dt);
    if (this.hq?.walker) this.engineSound.silence(); // on foot at HQ
    else if (this.bike.engineDead) {
      this.engineSound.silence(); // no engine sound: the bike rolls on, then you push it
      this.#updatePushing(dt);
      this.#loseJobWhenEmpty();
    } else this.engineSound.update(this.bike.type, Math.min(1, this.bike.revs), this.controls.throttle);
    this.#updateStuck(dt);
    this.dayTime += dt;
    if (this.jailTimer != null && (this.jailTimer -= dt) <= 0) {
      this.jailTimer = null;
      this.#endDay('jail');
      return;
    }
    // The shift is over. A fill, a swap or a service that has started finishes first (you pay and you get it).
    if (this.dayTime >= this.level.shift.realSeconds) {
      if (!this.refuel) this.#endDay();
    } else this.#updateStranded(dt);
  }

  /**
   * Out of cash. Below zero: a warning (earn it back before the shift ends). An empty tank or battery
   * with no cash to fill it, and nobody on the bike to pay you: a warning, then the game is over.
   */
  #updateStranded(dt) {
    if (this.wallet.cash >= 0) this.debtTime = null;
    else if (this.debtTime === null || this.debtTime === undefined) this.debtTime = 0;
    else if (this.debtTime >= 0 && (this.debtTime += dt) > 2.5) {
      // A short wait, so that the bark about the fine or the crash comes first.
      this.debtTime = -1;
      this.events.emit('bark', 'Your cash is below zero! Earn it back before the shift ends, or the game is over');
    }
    const carrying = this.board.active?.stage === 'toDropoff';
    if (this.refuel || !stranded(this.wallet, this.bike, carrying)) {
      this.strandedTime = null;
      return;
    }
    if (this.strandedTime === null || this.strandedTime === undefined) {
      this.strandedTime = 0;
      this.events.emit('bark', this.bike.type === 'electric' ? 'The battery is empty, and you have no cash for a swap...' : 'The tank is empty, and you have no cash for fuel...');
    }
    if ((this.strandedTime += dt) >= GAME_OVER.strandedSeconds) this.#endDay('stranded');
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
    if (!this.parkEdge || this.people.noHails || (this.busTimer -= dt) > 0) return; // no buses on the Umuganda morning
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
    const what = e.slip ? 'the wet murram' : !e.hit ? 'a wall' : e.hit.officer ? 'a police officer' : e.hit.kind === 'pole' ? 'a pole' : e.hit.kind === 'person' ? 'a person' : e.hit.kind === 'amp' ? 'an Ampersand rider' : `a ${HIT_NAMES[e.hit.kind] ?? e.hit.kind}`;
    this.cameras.main.shake(300, 0.008);
    this.engineSound.crash(e.speed / 12);
    // The crash also fills the service meter (sim/maintenance.js); crash bars make it smaller.
    const wear = Math.round(crashWearShare(e.speed) * (this.bike.mods?.crash ?? 1) * 100);
    // A passenger on the back gets off and does not pay: a bad name for your moto.
    const lost = loseJobOnCrash(this.board, this.bike);
    if (lost) {
      cancelMission(this.raceRival);
      this.raceRival = null;
      updateStreak(this.wallet, false);
      this.sayQueue = [];
      const words = PEOPLE.crashWords;
      this.time.delayedCall(700, () => this.#bubble(this.bike.x, this.bike.y, 46, words[Math.floor(this.rng() * words.length)], 0xffa080));
      this.events.emit('bark', `Crash at ${kmh} km/h! Your passenger gets off and does not pay. You lose the fare`);
    } else if (e.slip) this.events.emit('bark', `You slid on the wet murram at ${kmh} km/h and fell! Turn slowly when it is wet. Service +${wear}%`);
    else this.events.emit('bark', `Crash! You hit ${what} at ${kmh} km/h and fell off. Service +${wear}%`);
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

  /** The work crews that are out now: the Umuganda crews in the morning, else the city sweepers in their hours. */
  #activeCrews() {
    if (!this.crews) return [];
    if (this.dayEvent === 'umuganda' && this.eventStage === 'morning') return [...this.crews.umuganda, ...this.crews.site];
    if (!sweepersOut(this.clockHours)) return [];
    return this.clockHours < CREWS.sweepers.morningEnd ? this.crews.sweepers : this.crews.sweepersDay;
  }

  #updateCrews(dt) {
    const list = this.#activeCrews();
    const key = list === this.crews?.sweepers ? 'sweepers' : list === this.crews?.sweepersDay ? 'sweepers-day' : list.length ? `umuganda-${this.crews.site.length}` : '';
    if (key !== this.crewKey) {
      this.crewKey = key;
      this.crewView.setCrews(list);
    }
    stepCrews(this.crewView.crews, dt);
    this.crewView.update(this.world, this.cameras.main.worldView, this.time.now);
  }

  /** The muzungu on the bike: lines, photo stops (sim/muzungu.js). */
  #visitorStep(bikeEvents, kmh) {
    const job = this.board.active;
    if (!job?.visitor || job.stage !== 'toDropoff') return;
    const b = this.bike, T = WORLD.tileMetres;
    const near = (list, metres) => list.some((o) => Math.hypot(o.x - b.x, o.y - b.y) < metres);
    const ctx = {
      kmh,
      bump: bikeEvents.some((e) => e.type === 'bumpHard' || e.type === 'pothole'),
      sight: sightNear(b.x, b.y),
      quiet: quietNear(this.world.places, b.x, b.y),
      police: near(this.police.police.officers, MUZUNGU.policeMetres),
      market: near(this.world.placesWithTag('market').map((p) => ({ x: p.x * T, y: p.y * T })), MUZUNGU.marketMetres),
      uphill: (b.grade ?? 0) > MUZUNGU.uphillGrade,
    };
    const says = [];
    for (const e of stepVisitor(job, ctx, FIXED_DT, this.rng)) {
      if (e.type === 'say') says.push(e);
      else if (e.type === 'photo') {
        this.cameras.main.flash(90, 255, 255, 255);
        this.events.emit('bark', `Photo at ${e.sight.name}! The tip goes up: +${e.tip.toLocaleString('en')} RWF`);
      }
    }
    if (says.length) this.#visitorSays(says);
  }

  /** Lines over the bike, one after the other (a queue, so two lines never overlap): the visitor in white, you (the rider) in gold. */
  #visitorSays(lines) {
    this.sayQueue = [...(this.sayQueue ?? []), ...lines].slice(-4); // drop old lines when too many wait
    if (!this.sayBusy) this.#nextLine();
  }

  #nextLine() {
    const l = this.sayQueue?.shift();
    this.sayBusy = !!l;
    if (!l) return;
    if (l.who === 'visitor') this.engineSound.yell(1.35);
    this.#bubble(this.bike.x, this.bike.y, 46, l.text, l.who === 'rider' ? 0xffc85a : 0xffffff, 1500, true);
    this.time.delayedCall(2000, () => this.#nextLine());
  }

  /** A word in the pixel font that floats over a point in the world (metres), then fades. */
  // hold: milliseconds before it fades. onBike: it moves with the bike (the words of your passenger).
  #bubble(x, y, above, word, tint, hold = 600, onBike = false) {
    if (!this.cache.bitmapFont.exists('retro')) return;
    const s = toScreen(x, y, this.world.heightAt(x, y));
    const text = this.add.bitmapText(Math.round(s.x), Math.round(s.y - above), 'retro', word).setOrigin(0.5, 1)
      .setTint(tint).setDepth(100000);
    if (onBike) text.setMaxWidth(150).setCenterAlign(); // long lines of your passenger: two lines, so they fit on a phone
    text.noAmbient = true;
    const rise = { y: 0 };
    const follow = () => {
      if (onBike && this.bikeScreen) text.setPosition(Math.round(this.bikeScreen.x), Math.round(this.bikeScreen.y - above + rise.y));
    };
    this.tweens.add({ targets: rise, y: -10, delay: hold, duration: 700, onUpdate: follow });
    this.tweens.add({ targets: text, alpha: 0, delay: hold, duration: 700, onComplete: () => text.destroy() });
    if (onBike) {
      this.events.on('update', follow);
      text.once('destroy', () => this.events.off('update', follow));
    } else this.tweens.add({ targets: text, y: text.y - 10, delay: hold, duration: 700 });
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

  /**
   * T: phone a moto rider at the nearest open station, who brings you 1 litre of fuel (or a charged
   * battery) for the station price plus 20%. You pay when it comes. You can call at any time.
   */
  callFuelMoto() {
    const money = (n) => `${n.toLocaleString('en')} RWF`;
    if (this.rescue) {
      this.events.emit('bark', `The fuel moto is on the way: about ${Math.ceil(this.rescue.eta)} s`);
      return;
    }
    const electric = this.bike.type === 'electric';
    const offer = rescueOffer(this.bike.type, this.level.petrol);
    if (this.bike.energy > (electric ? 0.97 : 1 - offer.energy)) {
      this.events.emit('bark', electric ? 'Your battery is almost full' : 'Your tank is too full for one more litre');
      return;
    }
    if (this.wallet.cash < offer.cost) {
      this.events.emit('bark', `The fuel moto costs ${money(offer.cost)}. Not enough cash`);
      return;
    }
    const stations = this.world.placesWithTag(electric ? 'swap' : 'fuel').filter((p) => !this.world.isClosedTile(this.world.tile(Math.floor(p.x), Math.floor(p.y))));
    const r = createRescue(this.roadGraph, stations, this.bike);
    if (!r) {
      this.events.emit('bark', 'No station answers the phone');
      return;
    }
    this.rescue = { ...r, offer };
    this.rescueSprite = this.add.image(0, 0, 'vehicles', 'moto-none-0').setOrigin(BIKE_CANVAS.groundX / BIKE_CANVAS.width, BIKE_CANVAS.groundY / BIKE_CANVAS.height).setVisible(false);
    this.engineSound.honk('moto', 0.4);
    this.events.emit('bark', `You phone a moto: ${offer.what} for ${money(offer.cost)} (20% more than at the station). It comes in about ${Math.ceil(r.eta)} s`);
  }

  /** The fuel moto rides to you, gives you the fuel (you pay), and rides away. */
  #updateRescue(dt) {
    const r = this.rescue;
    if (!r) return;
    for (const e of stepRescue(r, this.bike, dt)) {
      if (e === 'arrived') this.#bubble(r.x, r.y, 40, r.offer.energy < 1 ? 'ONE LITRE!' : 'NEW BATTERY!', 0xffffff);
      if (e === 'delivered') {
        if (this.wallet.cash >= r.offer.cost) {
          this.#pay('fuel', r.offer.cost, 'Fuel moto');
          this.bike.energy = Math.min(1, this.bike.energy + r.offer.energy);
          this.events.emit('bark', r.offer.energy < 1 ? 'One litre of fuel: ride to a station and fill up' : 'A charged battery: you can ride again');
        } else this.events.emit('bark', 'You cannot pay the fuel moto: it rides away');
      }
      if (e === 'gone') {
        this.#endRescue();
        return;
      }
    }
    const s = toScreen(r.x, r.y, this.world.heightAt(r.x, r.y));
    this.rescueSprite.setVisible(r.state !== 'call').setFrame(`moto-none-${bikeFrameForHeading(r.heading)}`).setPosition(s.x, s.y).setDepth((r.x + r.y) / WORLD.tileMetres);
  }

  #endRescue() {
    this.rescueSprite?.destroy();
    this.rescueSprite = null;
    this.rescue = null;
  }

  /** Out of fuel or broken down during a job: when the bike stops, the customer leaves and you lose the fare. */
  #loseJobWhenEmpty() {
    const lost = loseJobWhenEmpty(this.board, this.bike, forwardSpeed(this.bike));
    if (!lost) return;
    updateStreak(this.wallet, false);
    this.engineSound.grumble();
    const words = PEOPLE.leaveWords;
    this.#bubble(this.bike.x, this.bike.y, 46, words[Math.floor(this.rng() * words.length)], 0xffa080);
    const why = this.bike.brokenDown ? 'The bike broke down!' : 'Out of fuel!';
    this.events.emit('bark', lost.type === 'passenger'
      ? `${why} Your passenger gets off and takes another moto. You lose the fare`
      : `${why} The customer sends the cargo with another moto. You lose the pay`);
  }

  /**
   * Walking the bike backwards (hold the brake when it stands still): the steps of the walk. Stuck
   * (throttle, but the bike does not move): a hint, at most once in a while.
   */
  #updateStuck(dt) {
    const b = this.bike;
    const v = forwardSpeed(b);
    if (b.reversing && !b.engineDead) this.pushMetres = (this.pushMetres ?? 0) + Math.abs(v) * dt;
    const stuck = !this.refuel && !b.engineDead && !(b.crashed > 0) && this.controls.throttle > 0.5 && Math.abs(v) < 0.3;
    this.stuckTime = stuck ? (this.stuckTime ?? 0) + dt : 0;
    if (this.stuckTime > PHYSICS.stuckHintSeconds && this.time.now - (this.stuckHintAt ?? -1e9) > 20000) {
      this.stuckHintAt = this.time.now;
      this.events.emit('bark', `Stuck? Hold ${this.sys.game.device.input.touch ? 'STOP' : 'S or ↓'} to walk the bike backwards`);
    }
  }

  /** Pushing the bike: the steps of the walk, and now and then a tired sound and word. */
  #updatePushing(dt) {
    const v = Math.abs(forwardSpeed(this.bike));
    if (v * 3.6 > PHYSICS.rideOffKmh) return; // the bike still rolls: the rider sits on it
    this.pushMetres = (this.pushMetres ?? 0) + v * dt;
    if (v < 0.3) return;
    this.gruntTimer = (this.gruntTimer ?? 1) - dt;
    if (this.gruntTimer > 0) return;
    this.gruntTimer = 1.4 + this.rng() * 1.4;
    const i = Math.floor(this.rng() * 4);
    this.engineSound.grunt(i);
    this.#bubble(this.bike.x, this.bike.y, 40, ['UFF!', 'AAH...', 'OOH!', 'EEH!'][i], 0xd8e0ff);
  }

  /**
   * Police: a whistle when you speed past. On the pavement or off road near an officer: a chase,
   * and a fine if the officer gets to you.
   */
  #updatePolice(dt) {
    const b = this.bike;
    const kmh = Math.abs(forwardSpeed(b)) * 3.6;
    let illegal = null;
    if (kmh > POLICE.ridingKmh && !b.crashed) {
      if (b.surface === SURFACES.pavement) illegal = 'pavement';
      else if (b.surface.offRoad) illegal = 'offRoad';
    }
    // You may pull in to stop at your job target or at a station.
    if (illegal) {
      const T = WORLD.tileMetres, g = POLICE.graceMetres;
      const job = this.board.active, t = job && jobTarget(job);
      const nearTarget = t && Math.hypot(t.x * T - b.x, t.y * T - b.y) < g;
      const nearStation = ['fuel', 'swap', 'garage', 'office'].some((tag) => this.world.placesWithTag(tag).some((p) => Math.hypot(p.x * T - b.x, p.y * T - b.y) < g));
      if (nearTarget || nearStation) illegal = null;
    }
    // The Umuganda run: with the passenger or the tools on the bike, an officer chases a moto on a
    // main road, in every mode (the murram back roads are safe).
    if (this.#umugandaCarrying() && kmh > POLICE.ridingKmh && !b.crashed && onMainRoad(this.world, b.x, b.y)) illegal = 'umuganda';
    // A car free morning: no motos on the closed road (hard mode: the officers chase you).
    if (!illegal && kmh > POLICE.ridingKmh && !b.crashed && this.#onCarFreeRoad()) illegal = 'carFree';
    // Hard mode challenges: the wrong way on a one-way street, a street with no motos, an overloaded moto.
    if (!illegal && kmh > POLICE.ridingKmh && !b.crashed) illegal = streetRule(this.oneWays, this.noMotos, b) ?? (this.board.active?.stage === 'toDropoff' && overloaded(this.board.active) ? 'overload' : null);
    const where = {
      pavement: 'on the pavement', offRoad: 'off the road', umuganda: 'a moto during Umuganda', carFree: 'on a car free road',
      oneWay: 'the wrong way on a one-way street', noMoto: 'on a street with no motos', overload: 'an overloaded moto',
    };
    // Kigali 2010 (easy): the officers only stand on the corners (no whistle, no chase, no fines).
    // Kigali 2015 (medium): they chase (and fine) only a moto on the pavement or off the road.
    const chased = this.mode.police || illegal === 'umuganda' || (this.mode.pavementChase && (illegal === 'pavement' || illegal === 'offRoad'));
    if (!chased) illegal = null;
    const seen = this.mode.police ? kmh : 0;
    for (const e of this.police.update(this.time.now, dt, b, { speedKmh: seen, limitKmh: this.speedLimit.limitKmh, illegal })) {
      const o = e.officer;
      if (e.type === 'whistle') {
        this.engineSound.whistle();
        this.#bubble(o.x, o.y, 30, 'PRRRT!', 0xffffff);
      } else if (e.type === 'chase') {
        this.engineSound.whistle();
        this.#bubble(o.x, o.y, 30, 'HAGARARA!', 0xffffff);
        this.events.emit('bark', e.reason === 'umuganda' ? 'Police! No motos during Umuganda. Get away, into the back roads!' : `Police! You ride ${where[e.reason]}. ${{ pavement: 'Get back on the road and get', offRoad: 'Get back on the road and get', overload: 'Get' }[e.reason] ?? 'Turn off and get'} away!`);
      } else if (e.type === 'caught' && e.reason === 'umuganda') {
        this.#bubble(o.x, o.y, 30, 'HAGARARA!', 0xffa080);
        this.#umugandaCaught();
      } else if (e.type === 'caught') {
        this.#pay('fines', POLICE.fine, `Police: riding ${where[e.reason]}`);
        this.#bubble(o.x, o.y, 30, 'FINE!', 0xffa080);
        this.events.emit('bark', `Caught! The police fine you ${POLICE.fine.toLocaleString('en')} RWF for riding ${where[e.reason]}`);
      } else if (e.type === 'escaped') {
        this.events.emit('bark', 'You got away from the police. Phew!');
      }
    }
  }

  /** Toilets for the bathroom need (hard mode): stations, buffets and the bus park. Metres. */
  #toilets() {
    const T = WORLD.tileMetres, out = [];
    for (const tag of ['fuel', 'swap', 'buffet']) for (const p of this.world.placesWithTag(tag)) out.push({ x: p.x * T, y: p.y * T, name: p.name });
    const park = this.world.busStops.find((st) => st.park);
    if (park) out.push({ x: (park.x + 0.5) * T, y: (park.y + 0.5) * T, name: 'the bus park toilets' });
    return out;
  }

  /**
   * Hard mode challenges each frame (sim/hardrules.js): mobile speed checks, stopping at a bus stop,
   * the bathroom need; warnings for the street rules in the other modes. (The officers chase the
   * wrong way, no-moto streets and overloading in #updatePolice.)
   */
  #updateHardRules(dt) {
    const b = this.bike, kmh = Math.abs(forwardSpeed(b)) * 3.6, H = HARD_RULES;
    // Mobile speed checks.
    for (const e of speedChecks(this.speedCheckState, this.speedChecks, b, kmh, this.speedLimit.limitKmh)) {
      if (!e.fine) continue;
      this.engineSound.whistle();
      this.#bubble(e.check.x, e.check.y, 34, 'RADAR!', 0xffffff);
      this.#pay('fines', e.fine, `Speed check: ${Math.round(e.speedKmh)} km/h in a ${e.limitKmh} zone`);
      this.events.emit('bark', `A police speed check! ${Math.round(e.speedKmh)} km/h in a ${e.limitKmh} zone: ${e.fine.toLocaleString('en')} RWF fine`);
    }
    // Street rules: in the other modes, a warning (on hard mode the officers chase you).
    const rule = kmh > POLICE.ridingKmh ? streetRule(this.oneWays, this.noMotos, b) : null;
    if (rule && rule !== this.ruleWarned && !this.mode.fines) {
      this.events.emit('bark', rule === 'oneWay' ? 'One-way street! You ride the wrong way. On hard mode that is a fine' : 'No motos on this street! On hard mode that is a fine');
    }
    this.ruleWarned = rule;
    // Stopping at a bus stop: the minibuses need it. Hard mode: a fine when an officer sees you.
    if (this.mode.fines) {
      const T = WORLD.tileMetres;
      const stop = kmh < 2 && this.world.busStops.find((st) => !st.park && Math.hypot((st.x + 0.5) * T - b.x, (st.y + 0.5) * T - b.y) < H.busStop.metres);
      this.busStopWait = stop ? this.busStopWait + dt : 0;
      if (stop && this.busStopWait > H.busStop.stopSeconds && this.busStopFined !== stop) {
        const officer = this.police.police.officers.some((o) => Math.hypot(o.x - b.x, o.y - b.y) < H.busStop.officerMetres);
        this.busStopFined = stop;
        if (officer) {
          this.engineSound.whistle();
          this.#pay('fines', H.fine, 'Police: stopped at a bus stop');
          this.events.emit('bark', `PRRRT! No stopping at a bus stop: ${H.fine.toLocaleString('en')} RWF fine`);
        } else this.events.emit('bark', 'You stop at a bus stop. Careful: if the police see it, that is a fine');
      }
      if (!stop && this.busStopWait === 0 && this.busStopFined && Math.hypot((this.busStopFined.x + 0.5) * T - b.x, (this.busStopFined.y + 0.5) * T - b.y) > 20) this.busStopFined = null;
    }
    // The bathroom need.
    if (this.mode.bladder && this.rider) {
      const { start, end, realSeconds } = this.level.shift;
      if (stepBladder(this.rider, ((end - start) * dt) / realSeconds) === 'urgent') {
        this.events.emit('bark', 'You need a toilet! Stop at a station, a buffet or the bus park');
      }
      const near = kmh < 1 && this.rider.bladder > 0.25 && this.toilets.find((t) => Math.hypot(t.x - b.x, t.y - b.y) < H.bladder.metres);
      this.toiletWait = near ? this.toiletWait + dt : 0;
      if (near && this.toiletWait > H.bladder.stopSeconds) {
        this.rider.bladder = 0;
        this.toiletWait = 0;
        this.#pay('food', H.bladder.cost, 'Toilet');
        this.events.emit('bark', `Aah, much better! The toilet costs ${H.bladder.cost} RWF`);
      }
    }
  }

  /** The bike is on a road that is closed now (a car free morning). */
  #onCarFreeRoad() {
    if (!this.carFree?.active) return false;
    const T = WORLD.tileMetres, tx = Math.floor(this.bike.x / T), ty = Math.floor(this.bike.y / T);
    return this.carFree.roads.some((r) => {
      const w = (r.width ?? 2) - 1;
      return r.y !== undefined ? tx >= r.x0 && tx <= r.x1 && ty >= r.y && ty <= r.y + w : ty >= r.y0 && ty <= r.y1 && tx >= r.x && tx <= r.x + w;
    });
  }

  /**
   * Street events each frame (sim/roadevents.js): the car free morning opens and closes, and the VIP
   * convoy starts at its hour, drives its route and leaves. (The road works only slow the traffic.)
   */
  #updateStreetEvents(dt) {
    const b = this.bike, kmh = Math.abs(forwardSpeed(b)) * 3.6;
    this.roadEventsView.update(this.time.now);
    // The car free morning.
    const cf = this.carFree;
    if (cf?.day) {
      const on = carFreeNow(this.clockHours);
      if (on !== cf.active) {
        cf.active = on;
        this.traffic.closed = on ? new Set(cf.roads) : null;
        this.roadEventsView.setCarFree(cf.roads, on);
        if (on) {
          // The cars on the closed road leave it; people jog and cycle on it.
          const closed = new Set(cf.roads);
          this.traffic.dormant = this.traffic.dormant ?? [];
          this.traffic.vehicles = this.traffic.vehicles.filter((v) => (closed.has(v.edge.road) ? (this.traffic.dormant.push(v), false) : true));
          this.#carFreeJoggers();
          this.events.emit('bark', `Car Free Day! ${cf.roads.map((r) => r.name).join(', ')} is closed to motos and cars until ${ROAD_EVENTS.carFree.toHour}:00. People run and cycle there`);
        } else {
          this.people.walkers = this.people.walkers.filter((p) => !p.jogger || Math.hypot(p.x - b.x, p.y - b.y) < 60);
          this.events.emit('bark', 'The car free morning is over: the boulevard is open again');
        }
      }
      if (on && this.#onCarFreeRoad() && kmh > POLICE.ridingKmh) {
        if (!cf.warned && !this.mode.police) this.events.emit('bark', 'Car Free Day: no motos on this road until 10:00! On hard mode that is a fine');
        cf.warned = true;
      } else if (!this.#onCarFreeRoad()) cf.warned = false;
    }
    // The VIP convoy.
    const c = this.convoy;
    if (c?.plan && !c.started && this.clockHours >= c.plan.hour) {
      c.started = true;
      const cars = convoyVehicles(c.plan, (kind, edge, s, route) => addVehicle(this.traffic, kind, edge, s, route));
      this.traffic.vehicles.push(...cars);
      c.cars = cars;
    }
    if (c?.cars?.length) {
      const flash = Math.floor(this.time.now / 220) % 2;
      for (const v of c.cars) if (v.kind === 'police') v.variant = flash;
      const { near, violation } = convoyCheck(c.cars, b, kmh);
      if (near && !c.warned) {
        c.warned = true;
        this.engineSound.whistle();
        this.#bubble(c.cars[0].x, c.cars[0].y, 34, 'WEE-OO!', 0xffffff);
        this.events.emit('bark', 'VIP convoy! Pull over to the side of the road and stop until it passes');
      }
      if (violation && !c.fined) {
        c.fined = true;
        if (this.mode.fines) {
          this.#pay('fines', ROAD_EVENTS.vip.fine, 'Police: did not pull over for a VIP convoy');
          this.events.emit('bark', `You did not stop for the VIP convoy: ${ROAD_EVENTS.vip.fine.toLocaleString('en')} RWF fine`);
        } else this.events.emit('bark', 'Stop for a VIP convoy! On hard mode that is a fine');
      }
      // At the end of its route, the convoy leaves (when you cannot see it).
      const done = c.cars.filter((v) => !v.route.length && Math.hypot(v.x - b.x, v.y - b.y) > 70);
      for (const v of done) {
        this.trafficView.remove(v);
        this.traffic.vehicles = this.traffic.vehicles.filter((w) => w !== v);
      }
      c.cars = c.cars.filter((v) => !done.includes(v));
    }
  }

  /** People jog and cycle on the closed road (a car free morning). */
  #carFreeJoggers() {
    const T = WORLD.tileMetres;
    for (const r of this.carFree.roads) {
      for (let i = 0; i < ROAD_EVENTS.carFree.joggers; i++) {
        const k = this.rng(), side = 1 + Math.floor(this.rng() * ((r.width ?? 2) - 1));
        const a = r.y !== undefined ? { x: (r.x0 + k * (r.x1 - r.x0)) * T, y: (r.y + side) * T } : { x: (r.x + side) * T, y: (r.y0 + k * (r.y1 - r.y0)) * T };
        const to = r.y !== undefined ? { x: (this.rng() < 0.5 ? r.x0 : r.x1) * T, y: a.y } : { x: a.x, y: (this.rng() < 0.5 ? r.y0 : r.y1) * T };
        const p = newPerson(this.people, a.x, a.y);
        Object.assign(p, { tx: to.x, ty: to.y, speed: p.speed * 2, jogger: true });
        this.people.walkers.push(p);
      }
    }
  }

  /** The Umuganda run: the passenger or the tools are on the bike. */
  #umugandaCarrying() {
    const job = this.board?.active;
    return job?.mission?.kind === 'umuganda' && job.stage === 'toDropoff';
  }

  /**
   * The Umuganda run (Alp): on an Umuganda morning, a bonus mission on the empty job board. Take the
   * passenger or the tools to the roadside work site against the clock; the patrol cars and the
   * officers on the main roads must not catch you (sim/umuganda.js).
   */
  #updateUmuganda(dt) {
    const u = this.umuganda;
    if (!u || this.dayEvent !== 'umuganda' || !this.board) return;
    const morning = !eventStage(this.dayEvent, this.clockHours).customers;
    const isRun = (o) => o.mission?.kind === 'umuganda';
    // A run that ended (delivered, too late or given up): the next one comes after a short wait.
    const active = this.board.active;
    if (u.jobId && active?.id !== u.jobId) {
      u.jobId = null;
      u.done++;
      u.gap = MISSIONS.umuganda.gapSeconds;
    }
    if (active && isRun(active)) u.jobId = active.id;
    if (!morning) {
      this.board.offers = this.board.offers.filter((o) => !isRun(o));
    } else if (!active && !this.board.offers.some(isRun) && u.done < MISSIONS.umuganda.maxPerMorning && (u.gap -= dt) <= 0) {
      const offer = umugandaOffer(this.world, this.board.rng, this.board.nextId++, this.board.opts);
      if (offer) {
        this.board.offers.unshift(offer);
        this.crews.site = crewAt(this.world, this.rng, offer.to.x, offer.to.y, CREWS.siteCrew, 10000 + offer.id * 10, CREW_LOOKS); // the people at the work site
        this.events.emit('bark', offer.type === 'passenger'
          ? `Bonus: UMUGANDA RUN! A passenger is late for Umuganda. Motos may not ride now: keep off the main roads, away from the police patrols`
          : `Bonus: UMUGANDA RUN! Take hoes and water to the Umuganda work site. Motos may not ride now: keep off the main roads, away from the police patrols`);
        this.engineSound.jingle('reward');
      } else u.gap = MISSIONS.umuganda.gapSeconds;
    }
    // The patrol cars: the siren flashes; a patrol that sees you on a main road gives you seconds to get away.
    const cars = this.traffic.vehicles.filter((v) => v.kind === 'police');
    const flash = Math.floor(this.time.now / 220) % 2;
    for (const v of cars) v.variant = v.siren ? flash : 0;
    const b = this.bike;
    for (const e of stepPatrols(u.spot, cars, b, this.#umugandaCarrying(), onMainRoad(this.world, b.x, b.y), dt)) {
      if (e.type === 'spotted') {
        this.engineSound.whistle();
        this.#bubble(e.car.x, e.car.y, 34, 'WEE-OO!', 0xffffff);
        this.events.emit('bark', `A police patrol saw you! Get ${MISSIONS.umuganda.patrolEscapeMetres} m away in ${MISSIONS.umuganda.patrolGraceSeconds} s, or you are caught`);
      } else if (e.type === 'escaped') {
        this.events.emit('bark', 'You lost the patrol. Phew! Keep to the back roads');
      } else if (e.type === 'caught') {
        this.#bubble(e.car.x, e.car.y, 34, 'HAGARARA!', 0xffa080);
        this.#umugandaCaught();
      }
    }
  }

  /** Caught on the Umuganda run: the run fails (no fare, no bonus); on hard mode, a fine too. */
  #umugandaCaught() {
    const job = this.board.active;
    if (!job) return;
    cancelJob(this.board, this.bike);
    this.engineSound.whistle();
    const who = job.type === 'passenger' ? 'Your passenger walks to the work site' : 'The police keep the tools for the work site';
    if (this.mode.fines) this.#pay('fines', POLICE.fine, 'Police: a moto during Umuganda');
    this.events.emit('bark', `Caught! No motos during Umuganda. ${who}. No fare${this.mode.fines ? `, and a ${POLICE.fine.toLocaleString('en')} RWF fine` : ''}`);
  }

  /** Traffic behind a bike that stands in the road honks (a cyclist rings the bell). */
  #updateHonks(dt) {
    if (this.refuel || !this.traffic) return;
    const b = this.bike;
    const honks = trafficHonks(this.traffic, { x: b.x, y: b.y, speed: Math.abs(forwardSpeed(b)) }, dt, this.rng);
    const words = { car: 'BEEP BEEP!', bus: 'POOOO!', truck: 'BWAAAP!', moto: 'BIP BIP!', cyclist: 'TRING TRING!' };
    for (const v of honks) {
      const fam = familyOf(v.kind);
      this.engineSound.honk(fam, 1 - Math.hypot(v.x - b.x, v.y - b.y) / 20);
      this.#bubble(v.x, v.y, fam === 'bus' || fam === 'truck' ? 40 : 28, words[fam] ?? 'BEEP!', 0xffe080);
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
      if (e.type === 'hailNew') {
        // Near a hotel or a landmark, a street hail can be a muzungu (sim/muzungu.js).
        maybeVisitorHail(e.hail, this.world.places, this.people.hails, { level: this.level.n, districts: this.level.districts }, this.rng);
        chaseHail(this.traffic, e.hail, this.rng);
      }
      if (e.type === 'hailGone') this.#cancelRivalsFor('hail', e.hail.id);
      if (e.type === 'nearMiss') this.#yell(e.person, e.word);
    }
    for (const e of stepRivals(this.traffic, dt)) this.#rivalArrived(e);
    // People cross the road on the zebra crossings; you must stop for them.
    const movers = [b, ...this.traffic.vehicles.filter((v) => Math.abs(v.x - b.x) < 110 && Math.abs(v.y - b.y) < 110)];
    const crossPaths = this.people.away ? [] : this.crossPaths ?? []; // nobody crosses on the Umuganda morning
    for (const e of stepCrossers(this.crossState, this.people, crossPaths, { bike: b, movers, mode: this.mode, districts: this.level.districts }, dt)) {
      const p = e.person;
      const officer = this.mode.fines && this.mode.police && this.police.police.officers.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < CROSSINGS.officerRangeMetres);
      this.#yell(p, 'HEY!');
      if (officer) {
        this.engineSound.whistle();
        this.#pay('fines', CROSSINGS.fine, 'Police: did not stop at a zebra crossing');
        this.events.emit('bark', `PRRRT! You did not stop for a person on the zebra crossing: ${CROSSINGS.fine.toLocaleString('en')} RWF fine`);
      } else this.events.emit('bark', 'Stop for people on the zebra crossing!');
    }
    const near = (p) => Math.abs(p.x - b.x) < 12 && Math.abs(p.y - b.y) < 12;
    this.nearPeople = this.people.walkers.filter(near).concat(this.people.hails.filter(near), (this.crewView?.crews ?? []).filter(near));
    this.world.dynamicAgents = [...this.nearAgents, ...this.nearPeople, ...this.world.poles.filter((p) => !p.off && near(p))]; // p.off: a traffic light pole not in use
    // A waving muzungu calls you when you are near.
    for (const h of this.people.hails) {
      if (!h.visitor || Math.hypot(h.x - b.x, h.y - b.y) > MUZUNGU.hailCallMetres) continue;
      h.callWait = (h.callWait ?? 0) - dt;
      if (h.callWait > 0) continue;
      h.callWait = MUZUNGU.hailCallSeconds;
      this.#bubble(h.x, h.y, 34, VISITOR_LINES.calls[Math.floor(this.rng() * VISITOR_LINES.calls.length)], 0xffffff, 1200);
    }
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
    if (h.visitor) {
      this.events.emit('bark', `A muzungu! Fare ×${MUZUNGU.fareFactor}. Ride slowly past the sights for photos. Go to ${h.to.name}`);
      this.#visitorSays(greeting(this.clockHours).map((text) => ({ who: 'visitor', text })));
    } else this.events.emit('bark', `Street hail! Go to ${h.to.name}`);
    return true;
  }

  /** An exhaust puff at a world point (metres). */
  #spawnPuff(px, py, z, dark = false, small = false) {
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
    puff.small = small;
  }

  // A red pin over the rival who races you to your pickup.
  /** The hired riders: their work on the map, and their calls for help. */
  #updateFleet(dt) {
    const b = this.bike, view = this.cameras.main.worldView;
    const inView = (x, y) => {
      const s = toScreen(x, y, this.world.heightAt(x, y));
      return s.x > view.x - 60 && s.x < view.right + 60 && s.y > view.y - 60 && s.y < view.bottom + 60;
    };
    const speed = Math.abs(forwardSpeed(b));
    for (const e of stepFleet(this.traffic, this.fleetPlan, { x: b.x, y: b.y, speed }, this.clockHours, dt, this.rng, inView)) {
      const name = e.rider.name;
      if (e.type === 'call') {
        const what = e.rider.help.problem === 'battery' ? 'the battery is empty' : 'a flat tyre';
        const t = FLEET.helpMinutes * 60;
        this.events.emit('bark', `${name} calls: ${what}! Ride to the blue pin within ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}, or the rent of today is lost.`);
        this.engineSound.jingle('reward');
      } else if (e.type === 'helped') {
        this.events.emit('bark', `You help ${name}: ${e.rider.help.problem === 'battery' ? 'a fresh battery from the swap station' : 'the tyre is fixed'}. "Thank you, boss!"`);
        this.engineSound.jingle('reward');
      } else if (e.type === 'missed') this.events.emit('bark', `${name} waited too long for help. No rent from ${name} today.`);
    }
    const w = waitingRider(this.traffic);
    this.helpWait = w;
    this.helpPin.setVisible(!!w);
    if (w) {
      const v = w.vehicle, s = toScreen(v.x, v.y, this.world.heightAt(v.x, v.y));
      this.helpPin.setPosition(s.x, s.y - 30 - 3 * Math.sin(this.time.now / 200));
    }
  }

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
      placeOnPixels(this.add.image(0, 0, key), s, PROP_CANVAS.groundX, PROP_CANVAS.groundY).setDepth(x + y);
    };
    for (const c of this.world.cameras) place('camera', c.x, c.y);
    // Speed limit signs (from the map, and made from the roads), speed bump warnings and crossing signs.
    for (const sign of this.world.signs) {
      const kind = sign.kind ?? 'limit';
      const key = kind === 'limit' ? `sign-${sign.limitKmh}` : `sign-${kind}`;
      if (!this.textures.exists(key)) addCanvasTexture(this, key, kind === 'limit' ? drawSpeedSign(sign.limitKmh) : drawRoadSign(kind));
      place(key, sign.x, sign.y);
    }
    addCanvasTexture(this, 'ring-pickup', drawMarkerRing(0x44bc9d));
    addCanvasTexture(this, 'ring-dropoff', drawMarkerRing(0xf6f5ec));
    addCanvasTexture(this, 'pin-pickup', drawMarkerPin(0x44bc9d));
    addCanvasTexture(this, 'pin-dropoff', drawMarkerPin(0xf6f5ec));
    addCanvasTexture(this, 'arrow', drawArrow());
    [0xffc85a, 0x7fe0b8, 0x7fd0ff].forEach((rgb, i) => addCanvasTexture(this, `note-${i}`, drawMusicNote(rgb))); // Radio Inziza
    addCanvasTexture(this, 'waiting-passenger', drawWaitingPassenger());
    addCanvasTexture(this, 'waiting-bananas', drawCargoPile('bananas'));
    addCanvasTexture(this, 'waiting-rice', drawCargoPile('rice'));
    for (const goods of ['ikivuguto', 'tools', 'batteries']) addCanvasTexture(this, `waiting-${goods}`, drawCargoPile(goods));
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
    const goal = job ? null : hqGoal(this.hq); // no job: the next step of the HQ mission (sim/hq.js)
    const visible = !!job || !!goal;
    this.markerRing.setVisible(visible);
    this.markerPin.setVisible(visible);
    this.arrow.setVisible(visible);
    this.waiting.setVisible(!!job && job.stage === 'toPickup');
    if (!visible) return;
    const kind = !job || job.stage === 'toPickup' ? 'pickup' : 'dropoff';
    const t = job ? jobTarget(job) : { x: goal.x / WORLD.tileMetres, y: goal.y / WORLD.tileMetres };
    const wx = t.x * WORLD.tileMetres, wy = t.y * WORLD.tileMetres;
    const s = toScreen(wx, wy, this.world.heightAt(wx, wy));
    const pulse = 1 + 0.12 * Math.sin(this.time.now / 160);
    this.markerRing.setTexture(`ring-${kind}`).setPosition(s.x, s.y).setScale(pulse).setDepth((wx + wy) / WORLD.tileMetres - 0.5);
    this.markerPin.setTexture(`pin-${kind}`).setPosition(s.x, s.y - 30 - 3 * Math.sin(this.time.now / 220));
    // The passenger (or the cargo) waits beside the marker.
    const pile = `waiting-${job?.goods ?? 'rice'}`;
    if (job) this.waiting.setTexture(job.type === 'passenger' ? 'waiting-passenger' : this.textures.exists(pile) ? pile : 'waiting-rice')
      .setPosition(s.x + 12, s.y - 2).setDepth((wx + wy) / WORLD.tileMetres + 0.3);
    const from = this.focusScreen ?? this.bikeScreen;
    const dx = s.x - from.x, dy = s.y - from.y;
    const d = Math.hypot(dx, dy);
    this.arrow.setVisible(d > 40);
    this.arrow.setPosition(from.x + (dx / d) * 24, from.y - 10 + (dy / d) * 16).setRotation(Math.atan2(dy, dx));
    if (job) this.targetDistance = Math.hypot(this.bike.x - wx, this.bike.y - wy);
  }

  #placeBike() {
    const b = this.bike;
    const s = toScreen(b.x, b.y, b.z);
    const bounce = b.bump > 0 ? Math.sin((b.bump / 0.3) * Math.PI) * 2 : 0;
    const depth = (b.x + b.y) / WORLD.tileMetres;
    // Out of fuel or charge, or broken down: the bike rolls on with the rider on it; when it is slow,
    // the rider gets off, walks beside the bike and pushes it.
    const load = b.loadType ?? 'none';
    const walking = (b.engineDead && Math.abs(forwardSpeed(b)) * 3.6 <= PHYSICS.rideOffKmh) || (b.reversing && forwardSpeed(b) < -0.05);
    const push = walking && !(b.crashed > 0);
    const step = Math.floor((this.pushMetres ?? 0) / 0.7) % 2;
    const base = push ? `push-${b.type}-${load}-${bikeFrameForHeading(b.heading)}-${step}` : `bike-${b.type}-${load}-${bikeFrameForHeading(b.heading)}`;
    // The garage parts you can see (a speaker box, crash bars ...): a texture for each set, made when first needed.
    const parts = this.#visibleParts();
    const key = parts.length ? `${base}-${parts.join('.')}` : base;
    if (parts.length && !this.textures.exists(key)) addCanvasTexture(this, key, drawBike(b.type, bikeFrameForHeading(b.heading), load, true, push ? `push${step}` : 'ride', parts));
    this.bikeScreen = s;
    this.bikeDepth = depth;
    // After a crash the bike and the rider lie on the ground.
    const angle = b.crashed > 0 ? (Math.cos(b.heading - Math.PI / 4) >= 0 ? 80 : -80) : 0;
    // On foot at HQ: the old moto stands without its rider; after the hand-in a staff member takes it (HqView).
    const hq = this.hq, onFoot = !!hq?.walker;
    const shown = !(onFoot && hq.stage !== 'desk');
    const bikeKey = onFoot ? parkedKey(this, b.type, bikeFrameForHeading(b.heading), parts) : key;
    this.bikeSprite.setTexture(bikeKey).setPosition(s.x, s.y - bounce).setDepth(depth).setAngle(angle).setVisible(shown);
    this.ghost.setTexture(bikeKey).setPosition(s.x, s.y - bounce).setAngle(angle);
    this.shadow.setPosition(s.x, s.y).setDepth(depth - 0.002).setVisible(shown);
    // The camera and the guide arrow follow the rider on foot.
    this.focusScreen = onFoot ? toScreen(hq.walker.x, hq.walker.y, this.world.heightAt(hq.walker.x, hq.walker.y)) : s;
    const electric = b.type === 'electric' && shown;
    this.glow.setVisible(electric).setPosition(s.x, s.y).setDepth(depth - 0.003);
    if (electric) this.glow.setAlpha(0.75 + 0.25 * Math.sin(this.time.now / 180));
  }

  /** The effects of the garage parts on your bike (only your bike): short ones at their triggers, steady ones. */
  #updatePartFx(dt) {
    const b = this.bike, onFoot = !!this.hq?.walker;
    const tile = this.world.tileAt(b.x, b.y)?.surface;
    const surface = this.world.rain && tile === 'murram' ? 'murramWet' : tile; // rain makes the murram wet (as the physics)
    const input = {
      parts: this.wallet.parts ?? [], type: b.type, kmh: Math.abs(forwardSpeed(b)) * 3.6,
      throttle: this.controls.throttle, brake: this.controls.hold ? 0 : this.controls.brake, bump: b.bump ?? 0,
      load: b.loadType ?? 'none', surface, night: this.daylight?.night ?? 0,
      radio: this.radio.playing, wall: !!this.fxWall,
    };
    this.fxWall = false;
    if (!onFoot) for (const name of partFxTriggers(this.partFx, input, dt)) this.partFxView.play(name, this);
    this.steadyFx = partFxSteady(input);
    this.partFxView.update(this, dt, this.steadyFx, !onFoot && !(b.crashed > 0));
  }

  /** The garage parts that show on your bike (VISIBLE_PARTS), in a fixed order. */
  #visibleParts() {
    const owned = this.wallet.parts ?? [];
    if (owned !== this.partsOwned) { // a new list after a purchase or a new game
      this.partsOwned = owned;
      this.partsShown = VISIBLE_PARTS.filter((id) => owned.includes(id));
    }
    return this.partsShown;
  }

  #updateSmoke(dt) {
    const b = this.bike;
    this.puffTimer -= dt;
    if (BIKES[b.type].smoke && !b.engineDead && this.puffTimer <= 0) { // no fuel: no exhaust
      const throttle = this.controls.throttle;
      this.puffTimer = throttle > 0 ? 0.06 : 0.3;
      const back = 1.0; // metres behind the bike centre
      this.#spawnPuff(b.x - Math.cos(b.heading) * back, b.y - Math.sin(b.heading) * back, 0.45, false, this.steadyFx.smallPuffs); // the air filter: small, light puffs
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
      p.img.setScale(p.small ? 0.5 + t * 0.7 : 1 + t * 1.6).setAlpha((p.small ? 0.4 : 0.7) * (1 - t));
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
    this.signs.fade(hidingGroups); // the names on the buildings fade with them
    this.signs.update(this.time.now); // flags in the wind, the fountain spray
    this.#checkSecrets();
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
    const f = this.focusScreen ?? this.bikeScreen;
    this.camPos.x += (f.x + ax - this.camPos.x) * k;
    this.camPos.y += (f.y - 10 + ay - this.camPos.y) * k;
    this.cameras.main.centerOn(this.camPos.x, this.camPos.y);
  }
}
