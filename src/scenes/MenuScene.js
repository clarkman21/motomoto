import Phaser from 'phaser';
import { loadGame } from './save.js';
import { levelDef } from '../sim/levels.js';
import { MODES } from '../config.js';
import { modeOf } from '../sim/modes.js';
import { STEERING_LABELS } from '../sim/controls.js';
import { drawRetroFontSheet, RETRO_CHARS, RETRO_CELL, RETRO_PER_ROW, retroText, wrapRetro } from '../world/retro-font.js';
import { PixelCanvas } from '../world/pixel-canvas.js';
import { addCanvasTexture } from './textures.js';

// Menus in a retro 16-bit console style: the welcome menu when the game starts, the pause menu,
// How to play and Settings. Everything is drawn at a low resolution (about 320 × 200) with a pixel
// font, then scaled up by a whole number, so the pixels stay big and sharp. Blue windows with a
// light border, a ▶ cursor, scanlines and chiptune blips.
// Keyboard: ↑ ↓ to choose, Enter to select, Esc to go back. Mouse and touch: tap a line.

const money = (n) => `${Math.round(n).toLocaleString('en')} RWF`;
const WHITE = 0xffffff, DIM = 0xa8b0e0, GREEN = 0x7fe0b8, GOLD = 0xffc85a, RED = 0xd84a3a;
const ROW = 14; // virtual pixels between menu lines

// How to play: one page for each topic. Simplified Technical English.
const HELP = [
  {
    title: 'The goal',
    lines: [
      'You are a moto taxi rider in Kigali. Carry passengers and cargo, and make money.',
      'Each level has a savings goal: school fees, a phone, an electric moto and more. Save the goal plus 5,000 RWF of working money. Then buy the milestone at the end of a day. The next level starts, and a new part of the city opens.',
      'Each shift ends at a fixed hour. Until you own your electric moto (level 5), you then pay the rent for the bike. If your cash is below zero at the end of the day, the game is over. If the tank is empty and you have no cash for fuel, the game is over too. Then you ride a bicycle taxi again, and you start again at level 1.',
    ],
  },
  {
    title: 'Controls',
    lines: [
      'W or ↑: throttle.   S or ↓: brake. Hold it when you stand still to walk the bike back.',
      'A D or ← →: steer.   C: change the steering mode.',
      'E and Q: shift up and down (petrol moto).   G: automatic shift on or off.',
      '1 to 4: take a job. Stop next to a person who waves and press 1 to take a street hail.   Backspace: cancel the job.',
      'F: buy fuel (then 1, 2 or 3: 25% of a tank, 50% of a tank, or a full tank), swap the battery, or service the bike at the garage.',
      'T: phone a moto that brings you 1 litre of fuel (or a charged battery), for 20% more than at a station. You can call at any time.',
      'H: horn.   V: sound.   R: put the bike back on the nearest road (your fuel and the bike wear stay as they are).   M: map on or off.   Esc or P: pause menu.',
      'Touch: the stick on the left steers. GO and STOP are on the right, + and − shift, T calls the fuel moto. Tap a job card to take it.',
    ],
  },
  {
    title: 'Money',
    lines: [
      'Income: fares, cargo, tips (a smooth ride gives a bigger tip) and a bonus for a row of clean rides.',
      'Costs: fuel or battery swaps, the bike rent (until the moto is yours), the service at the garage, repairs after a crash, and fines from speed cameras and the police.',
      'Fuel: like real riders, buy only what you need. 25% of a tank costs about 1,000 RWF (prices change by district). Each job card shows the fuel that the job needs. A full tank ties up cash that you may need for the rent or the bills. Learn where the stations are: there is no arrow.',
      'Save fuel: shift up while the RPM bar is green. Gold uses more fuel, and the red zone uses almost twice as much as green. Manual shifting with E saves more fuel than the automatic shift (G).',
      'Service: the SERVICE meter fills as you ride, faster on bad roads, off the road, at high revs and when you brake hard. The garage does an oil change, new brake pads and a check. At 100% the bike loses power and the brakes get weak. At 150% it breaks down, and you must push it to the garage.',
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
    // The first time, start the ride scene behind the menu. It waits until you start.
    if (!this.scene.isActive('ride') && !this.scene.isPaused('ride')) this.scene.launch('ride', { menu: true });
    this.scene.bringToTop();
    this.#makeFont();
    this.items = [];
    this.focus = 0;
    this.confirm = null;
    this.input.keyboard.on('keydown', (e) => this.#key(e));
    this.scale.on('resize', this.#redraw, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.#redraw, this));
    this.screen = mode === 'pause' ? 'pause' : 'main';
    this.#redraw();
  }

  update(time) {
    // The cursor bounces, and the footer hint blinks.
    if (this.cursor) this.cursor.x = this.cursorX + (Math.floor(time / 260) % 2);
    if (this.blink) this.blink.setVisible(Math.floor(time / 600) % 2 === 0);
  }

  #makeFont() {
    if (this.cache.bitmapFont.exists('retro')) return;
    addCanvasTexture(this, 'retro-font', drawRetroFontSheet());
    const config = {
      image: 'retro-font', width: RETRO_CELL.width, height: RETRO_CELL.height, chars: RETRO_CHARS,
      charsPerRow: RETRO_PER_ROW, spacing: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, lineSpacing: 1,
    };
    this.cache.bitmapFont.add('retro', Phaser.GameObjects.RetroFont.Parse(this, config));
  }

  // ---------------------------------------------------------------------------
  // Screens (in virtual pixels: this.vw × this.vh)
  // ---------------------------------------------------------------------------

  #redraw() {
    this.children.removeAll(true);
    this.items = [];
    this.cursor = null;
    this.blink = null;
    const { width, height } = this.scale.gameSize;
    // The biggest whole number scale that keeps at least 320 × 200 virtual pixels (2 at least).
    this.k = Math.max(2, Math.min(6, Math.floor(Math.min(width / 320, height / 200))));
    this.vw = Math.floor(width / this.k);
    this.vh = Math.floor(height / this.k);
    this.ui = this.add.container(Math.floor((width - this.vw * this.k) / 2), Math.floor((height - this.vh * this.k) / 2)).setScale(this.k);
    // Dim the city behind, and draw scanlines over everything.
    const dim = this.mode === 'welcome' && this.screen === 'main' ? 0.35 : 0.55;
    this.add.rectangle(0, 0, width, height, 0x060818, dim).setOrigin(0).setDepth(-1);
    this.#scanlines(width, height);
    if (this.screen === 'main') this.#main();
    else if (this.screen === 'pause') this.#pause();
    else if (this.screen === 'help') this.#help();
    else if (this.screen === 'settings') this.#settings();
    else if (this.screen === 'confirm') this.#confirmScreen();
    else if (this.screen === 'mode') this.#modeScreen();
    this.focus = Math.min(this.focus, Math.max(0, this.items.length - 1));
    this.#showFocus();
  }

  #main() {
    const save = loadGame();
    const session = this.ride?.started;
    const cx = Math.floor(this.vw / 2);
    let y = Math.max(10, Math.floor(this.vh * 0.1));
    // The title: big letters with a red shadow and a gold underline.
    this.#label(cx + 3, y + 3, 'MOTO INZIZA', RED, 3).setOrigin(0.5, 0);
    this.#label(cx, y, 'MOTO INZIZA', WHITE, 3).setOrigin(0.5, 0);
    y += 31;
    const g = this.#gfx();
    g.fillStyle(GOLD, 1).fillRect(cx - 66, y, 132, 2);
    y += 7;
    this.#label(cx, y, 'A MOTO TAXI GAME IN KIGALI', DIM).setOrigin(0.5, 0);
    y += 11;
    this.#label(cx, y, 'START ON PETROL. SAVE FOR ELECTRIC.', DIM).setOrigin(0.5, 0);
    y += 16;
    const summary = session ? this.#sessionSummary() : save ? this.#saveSummary(save) : null;
    if (summary) {
      this.#label(cx, y, summary, GREEN).setOrigin(0.5, 0);
      y += 14;
    }
    const lines = [];
    if (session || save) lines.push(['CONTINUE', () => this.#start('continue')]);
    lines.push(['NEW GAME', () => this.#go('mode')]);
    lines.push(['HOW TO PLAY', () => this.#go('help')]);
    lines.push(['SETTINGS', () => this.#go('settings')]);
    this.#menuWindow(lines, y + 4, 120);
    const hint = this.sys.game.device.input.touch ? 'TAP A LINE' : '↑↓ CHOOSE   ENTER SELECT';
    this.blink = this.#label(cx, this.vh - 22, hint, WHITE).setOrigin(0.5, 0);
    this.#label(cx, this.vh - 11, 'PROTOTYPE V0.1', DIM).setOrigin(0.5, 0);
  }

  #pause() {
    const cx = Math.floor(this.vw / 2);
    let y = Math.max(10, Math.floor(this.vh * 0.14));
    this.#label(cx + 2, y + 2, 'PAUSED', RED, 2).setOrigin(0.5, 0);
    this.#label(cx, y, 'PAUSED', WHITE, 2).setOrigin(0.5, 0);
    y += 24;
    this.#label(cx, y, this.#sessionSummary(), GREEN).setOrigin(0.5, 0);
    y += 16;
    this.#menuWindow([
      ['RESUME', () => this.#resume()],
      ['RESTART SHIFT', () => this.#ask('RESTART THIS SHIFT? YOU LOSE THE MONEY AND THE JOBS OF THIS SHIFT.', 'YES, RESTART', () => this.#restartShift())],
      ['HOW TO PLAY', () => this.#go('help')],
      ['SETTINGS', () => this.#go('settings')],
      ['MAIN MENU', () => this.#toMainMenu()],
    ], y, 132);
  }

  #help() {
    this.page = this.page ?? 0;
    const page = HELP[this.page];
    const w = Math.min(this.vw - 12, 380);
    const x = Math.floor((this.vw - w) / 2);
    const chars = Math.floor((w - 16) / RETRO_CELL.width);
    const body = [];
    for (const line of page.lines) body.push(...wrapRetro(line, chars), '');
    body.pop();
    const lineH = 10;
    const maxLines = Math.max(4, Math.floor((this.vh - 64) / lineH));
    const shown = body.slice(0, maxLines);
    const h = 30 + shown.length * lineH + 8;
    const y = Math.max(4, Math.floor((this.vh - h - 20) / 2));
    this.#window(x, y, w, h);
    this.#label(x + 8, y + 7, `${retroText(page.title)}`, GOLD);
    this.#label(x + w - 8, y + 7, `${this.page + 1}/${HELP.length}`, DIM).setOrigin(1, 0);
    shown.forEach((line, i) => this.#label(x + 8, y + 22 + i * lineH, line, WHITE));
    const row = [];
    if (this.page > 0) row.push(['◀ BACK', () => this.#turn(-1)]);
    if (this.page < HELP.length - 1) row.push(['NEXT ▶', () => this.#turn(1)]);
    row.push(['CLOSE', () => this.#back()]);
    this.#rowWindow(row, y + h + 4);
  }

  #settings() {
    const ride = this.ride;
    const cx = Math.floor(this.vw / 2);
    const y = Math.max(10, Math.floor(this.vh * 0.18));
    this.#label(cx + 2, y + 2, 'SETTINGS', RED, 2).setOrigin(0.5, 0);
    this.#label(cx, y, 'SETTINGS', WHITE, 2).setOrigin(0.5, 0);
    this.#menuWindow([
      [`SOUND: ${ride.engineSound.enabled ? 'ON' : 'OFF'}`, () => { ride.toggleSound(); this.#redraw(); }],
      [`STEERING: ${retroText(STEERING_LABELS[ride.steeringMode])}`, () => { ride.toggleSteering(); this.#redraw(); }],
      [`GEARS: ${ride.bike.autoShift ? 'AUTOMATIC' : 'MANUAL'}`, () => { ride.toggleAutoShift(); this.#redraw(); }],
      [`MAP: ${ride.showMap !== false ? 'ON' : 'OFF'}`, () => { ride.toggleMap(); this.#redraw(); }],
      // Test mode: to check the later levels, a new game starts at this level.
      [`TEST: NEW GAME AT LEVEL ${ride.testLevel ?? 1}`, () => { ride.cycleTestLevel(); this.#redraw(); }],
      ['BACK', () => this.#back()],
    ], y + 28, 240);
  }

  /** New game: choose the difficulty mode (a year of the city). */
  #modeScreen() {
    const save = loadGame();
    const session = this.ride?.started;
    const cx = Math.floor(this.vw / 2);
    let y = Math.max(8, Math.floor(this.vh * 0.08));
    this.#label(cx, y, 'CHOOSE YOUR KIGALI', GOLD, 2).setOrigin(0.5, 0);
    y += 22;
    const w = Math.min(this.vw - 12, 300);
    const x = Math.floor((this.vw - w) / 2);
    const n = Math.floor((w - 16) / RETRO_CELL.width);
    // One description for each mode, in a window.
    const texts = Object.values(MODES).map((m) => wrapRetro(`${m.name} (${m.short}): ${m.text}`, n));
    const h = 8 + texts.reduce((a, t) => a + t.length * 9 + 3, 0);
    this.#window(x, y, w, h);
    let ty = y + 5;
    Object.values(MODES).forEach((m, i) => {
      texts[i].forEach((l, j) => this.#label(x + 8, ty + j * 9, l, j === 0 ? WHITE : DIM));
      ty += texts[i].length * 9 + 3;
    });
    const start = (id) => () => ((session || save)
      ? this.#ask('START A NEW GAME? YOUR SAVED GAME WILL BE DELETED.', 'YES, NEW GAME', () => this.#start('new', id))
      : this.#start('new', id));
    this.#menuWindow([
      ...Object.entries(MODES).map(([id, m]) => [`${m.name} · ${m.short}`, start(id)]),
      ['BACK', () => this.#back()],
    ], y + h + 6, 160);
  }

  #confirmScreen() {
    const w = Math.min(this.vw - 12, 260);
    const x = Math.floor((this.vw - w) / 2);
    const lines = wrapRetro(this.confirm.question, Math.floor((w - 16) / RETRO_CELL.width));
    const h = 14 + lines.length * 10;
    const y = Math.max(8, Math.floor(this.vh * 0.25));
    this.#window(x, y, w, h);
    lines.forEach((l, i) => this.#label(x + 8, y + 8 + i * 10, l, WHITE));
    this.#menuWindow([
      [this.confirm.yes, () => { const act = this.confirm.action; this.confirm = null; act(); }],
      ['NO', () => { this.confirm = null; this.#back(); }],
    ], y + h + 6, 120);
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  #go(screen) {
    this.screen = screen;
    if (screen === 'help') this.page = 0;
    this.focus = screen === 'mode' ? 1 : 0; // the mode screen starts on Kigali 2015 (medium)
    this.#redraw();
  }

  #back() {
    this.#sound('back');
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
    const page = Phaser.Math.Clamp(this.page + dir, 0, HELP.length - 1);
    if (page === this.page) return;
    this.page = page;
    this.#sound('move');
    this.#redraw();
  }

  #start(how, mode) {
    this.scene.stop();
    this.ride.startGame(how, mode);
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
    return retroText(`Saved: ${modeOf(w).name} · level ${def.n} · day ${w.day ?? 1} · ${money(w.cash ?? 0)}`);
  }

  #sessionSummary() {
    const r = this.ride;
    const h = r.clockHours;
    const clock = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    return retroText(`Level ${r.level.n} · day ${r.wallet.day} · ${clock} · ${money(r.wallet.cash)}`);
  }

  #sound(kind) {
    const sound = this.ride?.engineSound;
    sound?.start(); // the browser starts audio only after a key press or a tap
    sound?.blip(kind);
  }

  // ---------------------------------------------------------------------------
  // Widgets (virtual pixels, inside this.ui)
  // ---------------------------------------------------------------------------

  #gfx() {
    const g = this.add.graphics();
    this.ui.add(g);
    return g;
  }

  #label(x, y, text, tint = WHITE, scale = 1) {
    const t = this.add.bitmapText(x, y, 'retro', retroText(text)).setTint(tint).setScale(scale);
    this.ui.add(t);
    return t;
  }

  /** A window like the menus of 16-bit role playing games: a blue gradient and a light border. */
  #window(x, y, w, h) {
    const g = this.#gfx();
    const bands = [0x3050c0, 0x2a48b0, 0x2440a0, 0x1e3890, 0x183080, 0x142870, 0x102060];
    const bandH = Math.ceil(h / bands.length);
    bands.forEach((col, i) => g.fillStyle(col, 0.96).fillRect(x + 2, y + 2 + i * bandH, w - 4, Math.min(bandH, h - 4 - i * bandH)));
    g.fillStyle(0x000000, 1);
    g.fillRect(x + 1, y, w - 2, 1).fillRect(x + 1, y + h - 1, w - 2, 1).fillRect(x, y + 1, 1, h - 2).fillRect(x + w - 1, y + 1, 1, h - 2);
    g.fillStyle(0xe8e8f8, 1);
    g.fillRect(x + 2, y + 1, w - 4, 1).fillRect(x + 1, y + 2, 1, h - 4);
    g.fillStyle(0x9098c8, 1);
    g.fillRect(x + 2, y + h - 2, w - 4, 1).fillRect(x + w - 2, y + 2, 1, h - 4);
    return g;
  }

  /** A window with one menu line for each item. items: [[label, onSelect]]. */
  #menuWindow(items, y, w) {
    const width = Math.max(w, ...items.map(([l]) => retroText(l).length * RETRO_CELL.width + 26));
    const h = items.length * ROW + 8;
    const x = Math.floor((this.vw - width) / 2);
    this.#window(x, y, width, h);
    items.forEach(([label, fn], i) => this.#item(x + 16, y + 6 + i * ROW, label, fn, width - 20));
  }

  /** A row of choices in one window (for example: back, next, close). */
  #rowWindow(items, y) {
    const cellW = Math.max(...items.map(([l]) => retroText(l).length * RETRO_CELL.width + 18));
    const w = cellW * items.length + 8;
    const x = Math.floor((this.vw - w) / 2);
    this.#window(x, y, w, ROW + 6);
    items.forEach(([label, fn], i) => this.#item(x + 14 + i * cellW, y + 5, label, fn, cellW - 4));
  }

  #item(x, y, label, onSelect, w) {
    const t = this.#label(x, y, label, DIM);
    const zone = this.add.zone(x - 10, y - 2, w, ROW).setOrigin(0).setInteractive({ useHandCursor: true });
    this.ui.add(zone);
    const index = this.items.length;
    zone.on('pointerover', () => { if (this.focus !== index) { this.focus = index; this.#showFocus(); this.#sound('move'); } });
    zone.on('pointerdown', () => this.#select(index));
    this.items.push({ t, x, y, onSelect });
  }

  #select(index) {
    const it = this.items[index];
    if (!it) return;
    this.#sound('select');
    it.onSelect();
  }

  #showFocus() {
    this.items.forEach((it, i) => it.t.setTint(i === this.focus ? WHITE : DIM));
    const it = this.items[this.focus];
    if (!it) return;
    if (!this.cursor) this.cursor = this.#label(0, 0, '▶', GOLD);
    this.cursorX = it.x - 10;
    this.cursor.setPosition(this.cursorX, it.y);
  }

  #scanlines(width, height) {
    const key = `scanline-${this.k}`;
    if (!this.textures.exists(key)) {
      const c = new PixelCanvas(1, this.k);
      c.setPixel(0, this.k - 1, 0x000000, 60);
      addCanvasTexture(this, key, c);
    }
    this.add.tileSprite(0, 0, width, height, key).setOrigin(0).setDepth(10);
  }

  #key(e) {
    const n = this.items.length;
    const move = (d) => {
      this.focus = (this.focus + d + n) % n;
      this.#showFocus();
      this.#sound('move');
    };
    switch (e.code) {
      case 'ArrowUp': case 'KeyW':
        return move(-1);
      case 'ArrowDown': case 'KeyS': case 'Tab':
        e.preventDefault?.();
        return move(1);
      case 'ArrowLeft': case 'KeyA':
        return this.screen === 'help' ? this.#turn(-1) : move(-1);
      case 'ArrowRight': case 'KeyD':
        return this.screen === 'help' ? this.#turn(1) : move(1);
      case 'Enter': case 'Space':
        return this.#select(this.focus);
      case 'Escape': case 'KeyP':
        if (this.screen === 'pause') return this.#resume();
        if (this.screen !== 'main') return this.#back();
        return undefined;
      default:
        return undefined;
    }
  }
}
