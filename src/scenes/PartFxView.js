import { PART_FX, WORLD, COLOURS } from '../config.js';
import { toScreen } from '../world/iso.js';

// The effects of the garage parts on your bike (sim/partfx.js says when). Cheap by design: one pool of
// particles (made once, used again), two Graphics layers (in front of the bike, and on the ground
// under it), whole pixels only, nothing drawn when nothing plays. Only your bike has these effects.

const BIKE_SCALE = 1.25; // as in drawBike (world/sprites.js)
const C = { gold: 0xffc85a, white: 0xffffff, orange: 0xf08a24, mint: 0x7fe0b8, green: 0x58c040, blue: 0x4ab0ff, sky: 0x7fd0ff, pink: 0xe8a0b8, cream: 0xe8ecf2, net: 0xe07a2a, ink: 0x161616, mud: 0x5a3a24, water: 0x9fc8e8 };
// Small pixel icons ('#' = a pixel), drawn with a dark outline.
const ICONS = {
  shield: ['#####', '#...#', '#.#.#', '#...#', '.#.#.', '..#..'],
  tick: ['....#', '...#.', '#.#..', '.#...'],
  heart: ['.#.#.', '#####', '.###.', '..#..'],
  bolt: ['..##', '.##.', '####', '.##.', '##..'],
  plus: ['.#.', '###', '.#.'],
};
// Points on the bike (forward, side, up; metres), as drawBike draws them.
const AT = {
  frontHub: [0.62, 0, 0.3], rearHub: [-0.62, 0, 0.3], frontLow: [0.7, 0, 0.05], frontBar: [0.36, 0.26, 0.62],
  rack: [-0.62, 0, 1.25], seat: [-0.25, 0, 0.92], passengerHead: [-0.36, 0, 2.3], phone: [0.45, 0, 1.12],
  speaker: [-0.74, 0, 1.12], battery: [0.09, 0, 0.66], batteryTop: [0.09, 0, 1.05], sprocket: [-0.05, 0, 0.42],
  above: [0, 0, 2.6],
};

export class PartFxView {
  constructor(scene) {
    this.front = scene.add.graphics();
    this.ground = scene.add.graphics();
    this.pool = []; // particles: { on, rel, x, y, vx, vy, g, life, max, delay, colour, size, kind, r0, r1, icon, light }
    this.free = []; // particles of the pool that are free (no search for a free one)
    this.marks = []; // tread marks on the ground: { x, y, life }
    this.markMetres = 0;
    this.sprayTimer = 0;
    this.beat = -1;
    this.idle = true;
  }

  /** A point of the bike on the screen, from the bike's screen point s and heading. */
  #at(ride, name, dz = 0) {
    const b = ride.bike, [f, side, z] = AT[name];
    const c = Math.cos(b.heading), sn = Math.sin(b.heading);
    const p = toScreen((f * c - side * sn) * BIKE_SCALE, (f * sn + side * c) * BIKE_SCALE, (z + dz) * BIKE_SCALE);
    return { x: p.x, y: p.y }; // relative to the bike's screen point
  }

  #spawn(o) {
    let p = this.free.pop();
    if (!p) {
      if (this.pool.length >= PART_FX.maxParticles) return null;
      p = {};
      this.pool.push(p);
    }
    Object.assign(p, { on: true, rel: true, vx: 0, vy: 0, g: 0, delay: 0, size: 1, kind: 'dot', light: false, r0: 0, r1: 0, icon: null }, o);
    p.max = p.life;
    return p;
  }

  #sparks(at, n, colours, spread = 30, up = 40, life = 0.5) {
    for (let i = 0; i < n; i++) {
      this.#spawn({ x: at.x, y: at.y, vx: (Math.random() - 0.5) * spread * 2, vy: -Math.random() * up, g: 90, life: life * (0.6 + Math.random() * 0.4), colour: colours[i % colours.length], size: i % 3 ? 2 : 1, light: true });
    }
  }

  /** From a point to another in `life` seconds (relative to the bike). */
  #travel(from, to, life, delay, colour, size = 2) {
    this.#spawn({ x: from.x, y: from.y, vx: (to.x - from.x) / life, vy: (to.y - from.y) / life, life, delay, colour, size, light: true });
  }

  /** Start a short effect (sim/partfx.js partFxTriggers). */
  play(name, ride) {
    const at = (n, dz) => this.#at(ride, n, dz);
    const icon = (icon, where, colour, delay = 0, life = 1) => this.#spawn({ kind: 'icon', icon, ...where, vy: -6, life, delay, colour, light: true });
    switch (name) {
      case 'crashbars':
        this.#sparks(at('frontBar'), 10, [C.gold, C.white, C.orange], 35, 45, 0.6);
        icon('shield', at('above'), C.mint, 0.15, 1);
        break;
      case 'net':
        for (let i = 0; i < 3; i++) this.#spawn({ ...at('rack'), x: at('rack').x - 4 + i * 4, vy: -16 - i * 4, life: 0.4, colour: C.net, size: 2 });
        icon('tick', at('rack', 0.9), C.green, 0.15, 0.9);
        break;
      case 'cushion': {
        const seat = at('seat');
        for (let i = 0; i < 6; i++) this.#spawn({ x: seat.x, y: seat.y, vx: (i % 2 ? 1 : -1) * (14 + Math.random() * 10), vy: -4 - Math.random() * 6, life: 0.5, colour: C.cream, size: 2 });
        icon('heart', at('passengerHead', 0.5), C.pink, 0.15, 1);
        break;
      }
      case 'charger': {
        const a = at('phone'), b = at('passengerHead', -0.9);
        for (let k = 0; k <= 6; k++) this.#spawn({ x: a.x + ((b.x - a.x) * k) / 6, y: a.y + ((b.y - a.y) * k) / 6 + Math.sin((k / 6) * Math.PI) * 2, life: 1.2, colour: 0x6a6a6a });
        icon('bolt', at('passengerHead', 0.6), C.green, 0.1, 1.1);
        break;
      }
      case 'pads':
        this.#spawn({ kind: 'ring', ...at('frontHub'), r0: 2, r1: 6, life: 0.5, colour: C.white, light: true });
        this.#spawn({ kind: 'glint', ...at('frontHub'), life: 0.35, colour: C.white, light: true });
        break;
      case 'oldPads': this.#sparks(at('frontLow'), 12, [C.orange, C.gold, C.white], 45, 35, 0.5); break;
      case 'regen': {
        const from = at('rearHub'), to = at('battery');
        for (let i = 0; i < 6; i++) this.#travel(from, to, 0.35, i * 0.06, COLOURS.ampersandYellow); // Ampersand: Surge Yellow
        this.#sparks(from, 4, [COLOURS.ampersandYellow, C.white], 20, 20, 0.3);
        icon('plus', at('batteryTop'), C.green, 0.3, 0.8);
        break;
      }
      case 'bearings':
        for (const hub of ['frontHub', 'rearHub']) this.#spawn({ kind: 'ring', ...at(hub), r0: 5, r1: 5.5, life: 0.6, colour: C.cream, light: true });
        this.#spawn({ kind: 'glint', ...at('frontHub'), life: 0.6, colour: C.white, light: true, delay: 0.05 });
        break;
      case 'chain':
        this.#travel(at('rearHub'), at('sprocket'), 0.4, 0, C.white);
        this.#spawn({ kind: 'glint', ...at('sprocket'), life: 0.3, delay: 0.35, colour: C.white, light: true });
        break;
      default: break;
    }
    this.idle = false;
  }

  /** Each frame: the steady effects (partFxSteady), then move and draw all. */
  update(ride, dt, steady, visible) {
    const b = ride.bike, s = ride.bikeScreen, now = ride.time.now;
    const kmh = Math.hypot(b.vx, b.vy) * 3.6;
    if (visible) {
      // Tread marks: two dark pixels on the murram behind the rear wheel, every few tenths of a metre.
      if (steady.tread) {
        this.markMetres += (kmh / 3.6) * dt;
        if (this.markMetres >= PART_FX.treadEveryMetres) {
          this.markMetres = 0;
          const r = this.#at(ride, 'rearHub');
          const g = toScreen(0, 0, -0.3 * BIKE_SCALE); // from the hub down to the ground
          this.marks.push({ x: Math.round(s.x + r.x + g.x), y: Math.round(s.y + r.y + g.y), life: PART_FX.treadSeconds });
          if (this.marks.length > 60) this.marks.shift();
        }
      }
      // Spray on wet murram: drops fly back from the rear wheel.
      if (steady.spray && (this.sprayTimer -= dt) <= 0) {
        this.sprayTimer = 0.08;
        const r = this.#at(ride, 'rearHub'), back = toScreen(-Math.cos(b.heading) * 30, -Math.sin(b.heading) * 30, 0);
        for (let i = 0; i < 2; i++) this.#spawn({ rel: false, x: s.x + r.x, y: s.y + r.y + 2, vx: back.x * (0.6 + Math.random() * 0.6), vy: back.y * 0.6 - 18 - Math.random() * 10, g: 70, life: 0.35, colour: i ? C.water : C.sky });
      }
      // The speaker on the beat: a ring from the box on each beat (the music notes are in RideScene).
      const bpm = ride.radio?.song?.bpm;
      if (steady.beat && bpm && ride.radio.playing) {
        const beat = Math.floor((now / 1000) * (bpm / 60));
        if (beat !== this.beat) {
          this.beat = beat;
          this.#spawn({ kind: 'ring', ...this.#at(ride, 'speaker'), r0: 2, r1: 7, life: 0.45, colour: C.sky, light: true });
        }
      }
    }
    // Move the particles; free the dead ones.
    let live = 0;
    for (const p of this.pool) {
      if (!p.on) continue;
      if (p.delay > 0) { p.delay -= dt; live++; continue; }
      if ((p.life -= dt) <= 0) { p.on = false; this.free.push(p); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      live++;
    }
    for (const m of this.marks) m.life -= dt;
    while (this.marks.length && this.marks[0].life <= 0) this.marks.shift();
    const glow = visible && steady.glow;
    const beatLight = visible && steady.beat && ride.radio?.playing && ((now / 1000) * ((ride.radio.song?.bpm ?? 120) / 60)) % 1 < 0.3;
    if (!live && !this.marks.length && !glow && !beatLight) {
      if (!this.idle) { this.front.clear(); this.ground.clear(); this.idle = true; }
      return;
    }
    this.idle = false;
    this.#draw(ride, glow, beatLight, visible);
  }

  #draw(ride, glow, beatLight, visible) {
    const s = ride.bikeScreen, night = ride.daylight?.night ?? 0;
    const f = this.front.clear().setDepth(ride.bikeDepth + 0.02);
    const gr = this.ground.clear().setDepth(ride.bikeDepth - 0.004);
    const dim = (rgb, light) => (light || night <= 0 ? rgb : shade(rgb, 1 - 0.55 * night)); // the effects get darker at night, lights do not
    const ox = Math.round(s.x), oy = Math.round(s.y);
    for (const m of this.marks) gr.fillStyle(dim(C.mud), Math.min(0.8, m.life)).fillRect(m.x, m.y, 2, 1).fillRect(m.x + 1, m.y + 1, 2, 1);
    if (glow && visible) {
      const p = this.#at(ride, 'phone');
      f.fillStyle(C.blue, 0.22).fillCircle(ox + p.x, oy + p.y, 5).fillStyle(C.sky, 1).fillRect(Math.round(ox + p.x), Math.round(oy + p.y) - 1, 1, 2);
    }
    if (beatLight) {
      const p = this.#at(ride, 'speaker');
      f.fillStyle(C.blue, 1).fillRect(Math.round(ox + p.x) + 1, Math.round(oy + p.y) + 1, 1, 1);
    }
    for (const p of this.pool) {
      if (!p.on || p.delay > 0) continue;
      const a = Math.min(1, (p.life / p.max) * 2);
      const x = Math.round(p.rel ? ox + p.x : p.x), y = Math.round(p.rel ? oy + p.y : p.y);
      const col = dim(p.colour, p.light);
      if (p.kind === 'dot') f.fillStyle(col, a).fillRect(x, y, p.size, p.size);
      else if (p.kind === 'ring') {
        const r = p.r1 + (p.r0 - p.r1) * (p.life / p.max);
        f.fillStyle(col, a);
        for (let i = 0; i < 16; i++) f.fillRect(Math.round(x + r * Math.cos((i / 16) * Math.PI * 2)), Math.round(y + r * Math.sin((i / 16) * Math.PI * 2) * 0.6), 1, 1);
      } else if (p.kind === 'glint') {
        f.fillStyle(col, a).fillRect(x, y - 3, 1, 7).fillRect(x - 3, y, 7, 1).fillRect(x - 1, y - 1, 3, 3);
      } else if (p.kind === 'icon') {
        const rows = ICONS[p.icon], w = rows[0].length, x0 = x - Math.floor(w / 2), y0 = y - rows.length;
        // The outline first (one pixel round each pixel), then the icon.
        f.fillStyle(C.ink, a);
        rows.forEach((row, j) => { for (let i = 0; i < w; i++) if (row[i] === '#') f.fillRect(x0 + i - 1, y0 + j - 1, 3, 3); });
        f.fillStyle(col, a);
        rows.forEach((row, j) => { for (let i = 0; i < w; i++) if (row[i] === '#') f.fillRect(x0 + i, y0 + j, 1, 1); });
      }
    }
  }

  /** A new day or a new bike: no effects left over. */
  reset() {
    for (const p of this.pool) p.on = false;
    this.free = [...this.pool];
    this.marks.length = 0;
    this.front.clear();
    this.ground.clear();
    this.idle = true;
  }
}

function shade(rgb, k) {
  const r = (rgb >> 16) & 255, g = (rgb >> 8) & 255, b = rgb & 255;
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k);
}
