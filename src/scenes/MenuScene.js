import Phaser from 'phaser';
import { loadGame } from './save.js';
import { levelDef } from '../sim/levels.js';
import { STEERING_LABELS } from '../sim/controls.js';

// Menus: the welcome menu when the game starts, the pause menu in the game, How to play and Settings.
// The ride scene draws the city behind the menu. Keyboard: ↑ ↓ to choose, Enter to select, Esc to go back.
// Mouse and touch: tap a button.

const FONT_BODY = '"Instrument Sans", system-ui, sans-serif';
const FONT_LABEL = '"Barlow Condensed", "Instrument Sans", system-ui, sans-serif';
const GREEN = 0x44bc9d;
const money = (n) => `${Math.round(n).toLocaleString('en')} RWF`;

// How to play: one page for each topic. Simplified Technical English.
const HELP = [
  {
    title: 'The goal',
    lines: [
      'You are a moto taxi rider in Kigali. Carry passengers and cargo, and make money.',
      'Each level has a savings goal: school fees, a phone, an electric moto and more. Save the goal plus 5,000 RWF of working money. Then buy the milestone at the end of a day. The next level starts, and a new part of the city opens.',
      'Each shift ends at a fixed hour. Then you pay the rent for the bike. If you have no cash, you can take one loan. After that, the game is over for the level, and you start the level again.',
    ],
  },
  {
    title: 'Controls',
    lines: [
      'W or ↑: throttle.   S or ↓: brake. Hold it when you stand still to walk the bike back.',
      'A D or ← →: steer.   C: change the steering mode.',
      'E and Q: shift up and down (petrol moto).   G: automatic shift on or off.',
      '1 to 4: take a job. Stop next to a person who waves and press 1 to take a street hail.   Backspace: cancel the job.',
      'F: buy fuel (then 1, 2 or 3: enough for the next job, the next two jobs, or a full tank), swap the battery, or service the bike at the garage.',
      'H: horn.   V: sound.   R: put the bike back on the road.   Esc or P: pause menu.',
      'Touch: the stick on the left steers. GO and STOP are on the right, + and − shift. Tap a job card to take it.',
    ],
  },
  {
    title: 'Money',
    lines: [
      'Income: fares, cargo, tips (a smooth ride gives a bigger tip) and a bonus for a row of clean rides.',
      'Costs: fuel or battery swaps, the rent, the service at the garage, repairs after a crash, and fines from speed cameras and the police.',
      'Fuel: like real riders, buy only what you need for the next job or two. A full tank ties up cash that you may need for the rent. Learn where the stations are: there is no arrow.',
      'Service: the OIL meter fills as you ride, faster on bad roads, off the road and at high revs. The garage does an oil change and a check, and new brake pads when they are worn. At 100% the bike loses power. At 150% it breaks down, and you must push it to the garage.',
    ],
  },
  {
    title: 'Tips',
    lines: [
      'Hills: shift down before a climb. With a passenger, a petrol moto needs first gear on the steep roads.',
      'The Nyabugogo bus park has the most customers. Buses bring new customers all the time.',
      'Rival riders race you to the pickup. Take the near jobs first.',
      'Slow down for speed bumps, potholes and speed cameras. A hit faster than 18 km/h throws you off the bike.',
      'At night, the lamps light only the main roads. The murram lanes are dark.',
    ],
  },
];

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  /** mode: 'welcome' (the game starts) or 'pause' (from the game). */
  create({ mode = 'welcome' } = {}) {
    this.mode = mode;
    this.ride = this.scene.get('ride');
    // The first time, start the ride scene behind the menu. It stays paused until you start.
    if (!this.scene.isActive('ride') && !this.scene.isPaused('ride')) this.scene.launch('ride', { menu: true });
    this.scene.bringToTop();
    this.layer = this.add.container(0, 0);
    this.items = [];
    this.focus = 0;
    this.confirm = null;
    this.input.keyboard.on('keydown', (e) => this.#key(e));
    this.scale.on('resize', this.#redraw, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.#redraw, this));
    this.screen = mode === 'pause' ? 'pause' : 'main';
    this.#redraw();
  }

  // ---------------------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------------------

  #redraw() {
    this.layer.removeAll(true);
    this.items = [];
    const { width, height } = this.scale.gameSize;
    this.s = height < 560 || width < 640 ? 0.75 : 1;
    const dim = this.mode === 'welcome' && this.screen === 'main' ? 0.35 : 0.6;
    this.layer.add(this.add.rectangle(0, 0, width, height, 0x000000, dim).setOrigin(0));
    if (this.screen === 'main') this.#main();
    else if (this.screen === 'pause') this.#pause();
    else if (this.screen === 'help') this.#help();
    else if (this.screen === 'settings') this.#settings();
    else if (this.screen === 'confirm') this.#confirmScreen();
    this.focus = Math.min(this.focus, Math.max(0, this.items.length - 1));
    this.#showFocus();
  }

  #main() {
    const { width, height } = this.scale.gameSize;
    const s = this.s;
    const save = loadGame();
    const session = this.ride?.started;
    let y = Math.max(24 * s, height * 0.14);
    this.#text(width / 2, y, 'MOTO KIGALI', 84, '#ffffff', FONT_LABEL, '600').setOrigin(0.5, 0).setStroke('#000000', 6);
    y += 96 * s;
    this.#text(width / 2, y, 'Ride a moto taxi on the hills of Kigali. Start on petrol, and save for an electric moto.', 17, '#e8e8e8', FONT_BODY, '400', Math.min(width - 48, 520 * s))
      .setOrigin(0.5, 0).setAlign('center').setStroke('#000000', 4);
    y += 64 * s;
    const summary = session ? this.#sessionSummary() : save ? this.#saveSummary(save) : null;
    if (summary) {
      this.#text(width / 2, y, summary, 15, '#9fe3cf', FONT_BODY).setOrigin(0.5, 0).setStroke('#000000', 4);
      y += 34 * s;
    }
    const buttons = [];
    if (session || save) buttons.push(['Continue', () => this.#start('continue')]);
    buttons.push(['New game', () => ((session || save) ? this.#ask('Start a new game? Your saved game will be deleted.', 'Yes, new game', () => this.#start('new')) : this.#start('new'))]);
    buttons.push(['How to play', () => this.#go('help')]);
    buttons.push(['Settings', () => this.#go('settings')]);
    this.#column(buttons, y + 10 * s);
    const hint = this.sys.game.device.input.touch ? 'Tap a button' : '↑ ↓ choose · Enter select · Esc back';
    this.#text(width / 2, height - 22 * s, `${hint}   ·   Prototype v0.1`, 13, '#9e9e9e', FONT_BODY).setOrigin(0.5, 1);
  }

  #pause() {
    const { width, height } = this.scale.gameSize;
    const s = this.s;
    let y = Math.max(24 * s, height * 0.18);
    this.#text(width / 2, y, 'PAUSED', 56, '#ffffff', FONT_LABEL, '600').setOrigin(0.5, 0);
    y += 66 * s;
    this.#text(width / 2, y, this.#sessionSummary(), 15, '#9fe3cf', FONT_BODY).setOrigin(0.5, 0);
    y += 40 * s;
    this.#column([
      ['Resume', () => this.#resume()],
      ['Restart shift', () => this.#ask('Restart this shift? You lose the money and the jobs of this shift.', 'Yes, restart', () => this.#restartShift())],
      ['How to play', () => this.#go('help')],
      ['Settings', () => this.#go('settings')],
      ['Main menu', () => this.#toMainMenu()],
    ], y);
  }

  #help() {
    const { width, height } = this.scale.gameSize;
    const s = this.s;
    this.page = this.page ?? 0;
    const page = HELP[this.page];
    const w = Math.min(width - 32, 640 * s);
    const x = (width - w) / 2;
    const panel = this.add.graphics();
    this.layer.add(panel);
    let y = Math.max(16, height * 0.08);
    const top = y;
    y += 16 * s;
    this.#text(x + 22 * s, y, `HOW TO PLAY · ${this.page + 1} / ${HELP.length}`, 14, '#9e9e9e', FONT_LABEL);
    y += 22 * s;
    this.#text(x + 22 * s, y, page.title, 34, '#ffffff', FONT_LABEL, '600');
    y += 46 * s;
    for (const line of page.lines) {
      const t = this.#text(x + 22 * s, y, line, 15, '#e0e0e0', FONT_BODY, '400', w - 44 * s).setLineSpacing(3);
      y += t.height + 10 * s;
    }
    panel.fillStyle(0x111417, 0.96).fillRoundedRect(x, top, w, y - top + 6 * s, 10 * s);
    const by = Math.min(height - 30 * s, y + 36 * s);
    const row = [];
    if (this.page > 0) row.push(['← Back', () => this.#turn(-1)]);
    if (this.page < HELP.length - 1) row.push(['Next →', () => this.#turn(1)]);
    row.push(['Close', () => this.#back()]);
    this.#row(row, by);
  }

  #settings() {
    const { width, height } = this.scale.gameSize;
    const s = this.s;
    const ride = this.ride;
    let y = Math.max(24 * s, height * 0.2);
    this.#text(width / 2, y, 'SETTINGS', 48, '#ffffff', FONT_LABEL, '600').setOrigin(0.5, 0);
    y += 70 * s;
    const sound = ride.engineSound.enabled;
    this.#column([
      [`Sound: ${sound ? 'on' : 'off'}`, () => { ride.toggleSound(); this.#redraw(); }],
      [`Steering: ${STEERING_LABELS[ride.steeringMode]}`, () => { ride.toggleSteering(); this.#redraw(); }],
      [`Gears: ${ride.bike.autoShift ? 'automatic' : 'manual'}`, () => { ride.toggleAutoShift(); this.#redraw(); }],
      ['Back', () => this.#back()],
    ], y);
  }

  #confirmScreen() {
    const { width, height } = this.scale.gameSize;
    const s = this.s;
    const y = Math.max(24 * s, height * 0.3);
    const t = this.#text(width / 2, y, this.confirm.question, 22, '#ffffff', FONT_BODY, '600', Math.min(width - 48, 480 * s)).setOrigin(0.5, 0).setAlign('center');
    this.#column([
      [this.confirm.yes, () => { const act = this.confirm.action; this.confirm = null; act(); }],
      ['No', () => { this.confirm = null; this.#back(); }],
    ], y + t.height + 30 * s);
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  #go(screen) {
    this.backTo = this.screen;
    this.screen = screen;
    if (screen === 'help') this.page = 0;
    this.focus = 0;
    this.#redraw();
  }

  #back() {
    this.screen = this.mode === 'pause' ? 'pause' : 'main';
    this.focus = 0;
    this.#redraw();
  }

  #ask(question, yes, action) {
    this.confirm = { question, yes, action };
    this.screen = 'confirm';
    this.focus = 1; // "No" first: a safe default
    this.#redraw();
  }

  #turn(dir) {
    this.page = Phaser.Math.Clamp(this.page + dir, 0, HELP.length - 1);
    this.#redraw();
  }

  #start(how) {
    this.scene.stop();
    this.ride.startGame(how);
  }

  #resume() {
    this.scene.stop();
    this.ride.resumeGame();
  }

  #restartShift() {
    this.scene.stop();
    this.ride.restartShift();
  }

  #toMainMenu() {
    this.ride.toMainMenu();
  }

  #saveSummary(save) {
    const w = save.wallet ?? {};
    const def = levelDef(w.level ?? 1);
    return `Saved game: level ${def.n} · ${def.name} · day ${w.day ?? 1} · ${money(w.cash ?? 0)}`;
  }

  #sessionSummary() {
    const r = this.ride;
    const h = r.clockHours;
    const clock = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    return `Level ${r.level.n} · ${r.level.name} · day ${r.wallet.day} · ${clock} · ${money(r.wallet.cash)}`;
  }

  // ---------------------------------------------------------------------------
  // Widgets and keyboard
  // ---------------------------------------------------------------------------

  #text(x, y, str, size, colour, font = FONT_BODY, weight = '400', wrap = 0) {
    const t = this.add.text(x, y, str, {
      fontFamily: font, fontSize: `${Math.round(size * this.s)}px`, fontStyle: weight, color: colour,
      wordWrap: wrap ? { width: wrap } : undefined,
    });
    this.layer.add(t);
    return t;
  }

  #button(x, y, label, onTap, w) {
    const s = this.s;
    const bw = w ?? 260 * s, bh = 44 * s;
    const bg = this.add.rectangle(x, y, bw, bh, 0x1c2126, 0.95).setStrokeStyle(2, 0x3a424a).setInteractive({ useHandCursor: true });
    const t = this.add.text(x, y, label, { fontFamily: FONT_LABEL, fontSize: `${Math.round(22 * s)}px`, fontStyle: '600', color: '#ffffff' }).setOrigin(0.5);
    this.layer.add([bg, t]);
    const item = { bg, t, onTap };
    const index = this.items.length;
    bg.on('pointerover', () => { this.focus = index; this.#showFocus(); });
    bg.on('pointerdown', () => onTap());
    this.items.push(item);
    return item;
  }

  #column(buttons, y) {
    const { width } = this.scale.gameSize;
    const gap = 54 * this.s;
    buttons.forEach(([label, fn], i) => this.#button(width / 2, y + i * gap + 22 * this.s, label, fn));
  }

  #row(buttons, y) {
    const { width } = this.scale.gameSize;
    const bw = 150 * this.s, gap = 14 * this.s;
    const total = buttons.length * bw + (buttons.length - 1) * gap;
    buttons.forEach(([label, fn], i) => this.#button(width / 2 - total / 2 + bw / 2 + i * (bw + gap), y, label, fn, bw));
  }

  #showFocus() {
    this.items.forEach((it, i) => {
      const on = i === this.focus;
      it.bg.setFillStyle(on ? GREEN : 0x1c2126, on ? 1 : 0.95).setStrokeStyle(2, on ? 0xffffff : 0x3a424a);
      it.t.setColor(on ? '#0b1a15' : '#ffffff');
    });
  }

  #key(e) {
    const n = this.items.length;
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': case 'ArrowLeft': case 'KeyA':
        if (this.screen === 'help' && (e.code === 'ArrowLeft' || e.code === 'KeyA')) return this.#turn(-1);
        this.focus = (this.focus - 1 + n) % n;
        return this.#showFocus();
      case 'ArrowDown': case 'KeyS': case 'ArrowRight': case 'KeyD': case 'Tab':
        if (this.screen === 'help' && (e.code === 'ArrowRight' || e.code === 'KeyD')) return this.#turn(1);
        e.preventDefault?.();
        this.focus = (this.focus + 1) % n;
        return this.#showFocus();
      case 'Enter': case 'Space':
        return this.items[this.focus]?.onTap();
      case 'Escape': case 'KeyP':
        if (this.screen === 'pause') return this.#resume();
        if (this.screen !== 'main') return this.#back();
        return undefined;
      default:
        return undefined;
    }
  }
}
