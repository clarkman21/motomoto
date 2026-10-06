import Phaser from 'phaser';
import { VIEW, WORLD, BIKES } from '../config.js';
import { World } from '../world/world.js';
import { TEST_MAP } from '../world/map-data.js';
import { toScreen } from '../world/iso.js';
import { renderTerrain } from '../world/terrain-render.js';
import { drawBike, drawBlock, drawShadow, drawGlow, drawPuff, bikeFrameForHeading, BIKE_CANVAS, BIKE_DIRECTIONS } from '../world/sprites.js';
import { createBike, stepBike, forwardSpeed, shiftGear, bestGear } from '../sim/bike.js';
import { readControls, STEERING_MODES } from '../sim/controls.js';
import { EngineSound } from '../audio/engine-sound.js';

const FIXED_DT = 1 / 120; // physics step in seconds
const BARKS = {
  pothole: 'Pothole! Speed −30%',
  bumpHard: 'Speed bump too fast!',
  wall: 'Bang!',
  empty: 'Out of energy. Press R to reset.',
  overRev: 'Too fast to shift down',
  noGears: 'Electric moto: no gears',
  brakesWorn: 'Brakes worn! Downshift or use regen',
};

export class RideScene extends Phaser.Scene {
  constructor() {
    super('ride');
  }

  create() {
    this.world = new World(TEST_MAP);
    this.cameras.main.setBackgroundColor('#1d2a33');
    this.cameras.main.setRoundPixels(false); // smooth sub pixel camera; textures stay sharp (antialias off)

    // Ground: one image under everything.
    const terrain = renderTerrain(this.world);
    addCanvasTexture(this, 'terrain', terrain);
    this.add.image(terrain.ox, terrain.oy, 'terrain').setOrigin(0).setDepth(-1000);

    // Solid blocks: one sprite each, sorted by depth with the bike.
    this.blockSprites = this.world.blocks.map((block, i) => {
      const { canvas, depth } = drawBlock(block, this.world);
      addCanvasTexture(this, `block-${i}`, canvas);
      const img = this.add.image(canvas.ox, canvas.oy, `block-${i}`).setOrigin(0).setDepth(depth);
      return { img, canvas, depth, block };
    });

    // Bike frames, shadow, glow and smoke.
    for (const type of Object.keys(BIKES)) {
      for (let f = 0; f < BIKE_DIRECTIONS; f++) addCanvasTexture(this, `bike-${type}-${f}`, drawBike(type, f));
    }
    addCanvasTexture(this, 'shadow', drawShadow());
    addCanvasTexture(this, 'glow', drawGlow());
    addCanvasTexture(this, 'puff', drawPuff());
    const ox = BIKE_CANVAS.groundX / BIKE_CANVAS.width;
    const oy = BIKE_CANVAS.groundY / BIKE_CANVAS.height;
    this.shadow = this.add.image(0, 0, 'shadow');
    this.glow = this.add.image(0, 0, 'glow').setVisible(false);
    this.bikeSprite = this.add.image(0, 0, 'bike-petrol-0').setOrigin(ox, oy);
    // The "ghost" is the bike outline that shows when a building or tree hides the bike.
    this.ghost = this.add.image(0, 0, 'bike-petrol-0').setOrigin(ox, oy).setTintFill(0xffffff).setAlpha(0.5).setDepth(1e6).setVisible(false);
    this.puffs = [];
    this.puffTimer = 0;

    this.bike = createBike(this.world, 'petrol');
    this.steeringMode = 'bike';
    this.controls = { throttle: 0, brake: 0, steer: 0 };
    this.touch = { stick: { x: 0, y: 0, active: false }, throttle: false, brake: false };
    this.accumulator = 0;
    this.engineSound = new EngineSound();
    this.occluded = false;

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
      this.controls = readControls(this.steeringMode, raw, this.bike);
      for (const e of stepBike(this.bike, this.controls, this.world, FIXED_DT)) {
        if (e.type === 'wall' && e.speed < 4) continue; // no bark when you only touch a wall
        if (BARKS[e.type]) this.events.emit('bark', BARKS[e.type]);
      }
      this.accumulator -= FIXED_DT;
    }
    this.#placeBike();
    this.#updateSmoke(dt);
    this.#updateOcclusion();
    this.#updateCamera(dt);
    this.engineSound.update(this.bike.type, Math.min(1, this.bike.revs), this.controls.throttle);
  }

  #placeBike() {
    const b = this.bike;
    const s = toScreen(b.x, b.y, b.z);
    const bounce = b.bump > 0 ? Math.sin((b.bump / 0.3) * Math.PI) * 2 : 0;
    const depth = (b.x + b.y) / WORLD.tileMetres;
    const key = `bike-${b.type}-${bikeFrameForHeading(b.heading)}`;
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
    for (const bs of this.blockSprites) {
      if (bs.depth <= this.bikeDepth || Math.abs(bs.block.tx + bs.block.ty - this.bikeDepth) > 8) continue;
      const c = bs.canvas;
      if (samples.some(([dx, dy]) => c.alphaAt(Math.floor(s.x + dx - c.ox), Math.floor(s.y + dy - c.oy)) > 0)) {
        hidingGroups.add(groupKey(bs.block));
      }
    }
    for (const bs of this.blockSprites) bs.img.setAlpha(hidingGroups.has(groupKey(bs.block)) ? 0.45 : 1);
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

/** Copy a PixelCanvas into a Phaser canvas texture. */
function addCanvasTexture(scene, key, pc) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, pc.width, pc.height);
  tex.context.putImageData(new ImageData(pc.data, pc.width, pc.height), 0, 0);
  tex.refresh();
}
