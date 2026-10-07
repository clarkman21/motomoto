import Phaser from 'phaser';
import { BIKES, COLOURS, GEARBOX, LAW, JOBS, SAVINGS_FLOAT, DISTRICTS } from '../config.js';
import { forwardSpeed } from '../sim/bike.js';
import { serviceDue } from '../sim/maintenance.js';
import { wrapRetro, RETRO_CELL } from '../world/retro-font.js';
import { MinimapView } from './MinimapView.js';
import { textBit, textWidth } from '../world/garage-sprites.js';
import { UI, pixelScale, ensureRetroFont, ensureIcons, retroLabel, retroWidth, drawWindow, drawSegBar } from './retro-ui.js';

// The HUD in a retro 16-bit console style, like the menus: everything is drawn at a low
// resolution (about 480 × 270 virtual pixels, like the game view) with the pixel font, pixel icons, blue windows and
// segmented bars, then scaled up by a whole number. It reads the ride scene state each frame and
// writes the touch controls back.

const PANEL_W = 150;
const JOBS_W = 162;
const LINE = RETRO_CELL.height + 1; // virtual pixels between text lines
const PETROL_RED = 0xec5825;
const money = (n) => `${Math.round(n).toLocaleString('en')}`;

export class HudScene extends Phaser.Scene {
  constructor() {
    super('hud');
  }

  create() {
    this.ride = this.scene.get('ride');
    ensureRetroFont(this);
    ensureIcons(this);
    this.ride.events.on('bark', (text) => this.#bark(text));
    this.ride.events.on('money', (amount, label) => this.#popup(amount, label));
    this.ride.events.on('camera', (e) => this.flash.setAlpha(e.fine ? 0.75 : 0.2));

    // Everything except the camera flash and the touch controls is in one container, in virtual pixels.
    this.ui = this.add.container(0, 0);
    const add = (o) => (this.ui.add(o), o);
    const label = (tint = UI.white, scale = 1) => add(retroLabel(this, 0, 0, '', tint, scale));
    const icon = (name) => add(this.add.image(0, 0, 'hud-icons', name).setOrigin(0));
    this.bg = add(this.add.graphics()); // the windows (drawn again on a resize)
    this.fg = add(this.add.graphics()); // bars and signs (drawn each frame)

    // Left window: speed, gear, fuel or battery, revs, service, where you are.
    this.speedText = label(UI.white, 2);
    this.unitText = label(UI.dim);
    this.gearIcon = icon('cog');
    this.gearText = label(UI.white, 2);
    this.energyIcon = icon('fuel');
    this.energyText = label();
    this.revsLabel = label(UI.dim);
    this.useText = label(UI.dim);
    this.serviceIcon = icon('spanner');
    this.serviceText = label();
    this.groundIcon = icon('mountain');
    this.groundText = label();
    this.placeText = label(UI.dim);
    // The pause button.
    this.pauseIcon = icon('pause');
    this.#zone(() => this.ride.openPause(), (z) => (this.pauseZone = z));

    // Right window: cash, clock, speed limit, level and savings.
    this.coinIcon = icon('coin');
    this.cashText = label(UI.white, 2);
    this.rwfText = label(UI.dim);
    this.clockIcon = icon('clock');
    this.clockText = label();
    this.starIcon = icon('star');
    this.levelText = label();
    this.flameIcon = icon('flame');
    this.streakText = label(UI.orange);
    this.goalText = label(UI.dim);

    // Jobs window: a title and up to four cards. Each card has an icon and up to four lines.
    this.jobIcon = icon('pin');
    this.jobTitle = label(UI.dim);
    this.cards = [0, 1, 2, 3].map((i) => {
      const card = { icon: icon('person'), lines: [0, 1, 2, 3].map(() => label()), y: 0, h: 0 };
      this.#zone(() => this.ride.acceptJob(i), (z) => (card.zone = z));
      return card;
    });

    // Bottom: station prompt (tap = F), fuel choices (tap = 1, 2, 3), the help line.
    this.promptLines = [0, 1, 2].map(() => label());
    this.#zone(() => { if (!this.ride.acceptHail()) this.ride.startRefuel(); }, (z) => (this.promptZone = z));
    this.fuelRows = [0, 1, 2].map((i) => {
      const row = { text: label() };
      this.#zone(() => this.ride.chooseFuel(i), (z) => (row.zone = z));
      return row;
    });
    this.helpText = label(UI.grey);
    // Barks (short messages) and money pop ups.
    this.barkLines = [0, 1, 2].map(() => label());
    this.popups = [];

    this.minimap = new MinimapView(this, this.ui);
    // Prompts, fuel choices and barks are on top of everything (also on top of the minimap).
    this.over = add(this.add.graphics());
    for (const l of [...this.promptLines, ...this.fuelRows.map((r) => r.text), ...this.barkLines]) this.ui.bringToTop(l);
    for (const z of [this.promptZone, ...this.fuelRows.map((r) => r.zone)]) this.ui.bringToTop(z);
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xffffff, 1).setOrigin(0).setAlpha(0);
    this.isTouch = this.sys.game.device.input.touch;
    if (this.isTouch) this.#createTouchControls();

    this.#layout();
    this.scale.on('resize', () => this.#layout());
  }

  /** A clickable area in the container. place(zone) keeps a reference. */
  #zone(onTap, place) {
    const z = this.add.zone(0, 0, 1, 1).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', (p) => { p.hitButton = true; onTap(); });
    this.ui.add(z);
    place(z);
  }

  #layout() {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    const k = (this.k = pixelScale(width, height, 480, 270));
    this.ui.setScale(k);
    const vw = (this.vw = Math.floor(width / k)), vh = (this.vh = Math.floor(height / k));
    this.hudScale = k / 3;
    const g = this.bg.clear();

    // Left window.
    const L = (this.left = { x: 4, y: 4, w: PANEL_W, h: 82 });
    drawWindow(g, L.x, L.y, L.w, L.h);
    this.speedText.setPosition(L.x + 7, L.y + 5);
    this.gearIcon.setPosition(L.x + L.w - 34, L.y + 7);
    this.gearText.setPosition(L.x + L.w - 23, L.y + 5);
    this.energyIcon.setPosition(L.x + 6, L.y + 26);
    this.energyText.setPosition(L.x + L.w - 32, L.y + 26);
    this.energyBar = { x: L.x + 18, y: L.y + 27, w: L.w - 54, h: 8 };
    this.revsLabel.setPosition(L.x + 6, L.y + 37);
    this.revsBar = { x: L.x + 30, y: L.y + 38, w: 62, h: 6 };
    this.useText.setPosition(L.x + 96, L.y + 37);
    this.serviceIcon.setPosition(L.x + 6, L.y + 47);
    this.serviceText.setPosition(L.x + L.w - 32, L.y + 47);
    this.serviceBar = { x: L.x + 18, y: L.y + 48, w: L.w - 54, h: 8 };
    this.groundIcon.setPosition(L.x + 6, L.y + 59);
    this.groundText.setPosition(L.x + 18, L.y + 59);
    this.placeText.setPosition(L.x + 18, L.y + 69);
    // Pause button: a small window beside the left window.
    drawWindow(g, L.x + L.w + 3, L.y, 15, 15);
    this.pauseIcon.setPosition(L.x + L.w + 6, L.y + 3);
    this.pauseZone.setPosition(L.x + L.w + 3, L.y).setSize(15, 15);

    // Right window.
    const R = (this.right = { x: vw - JOBS_W - 4, y: 4, w: JOBS_W, h: 58 });
    drawWindow(g, R.x, R.y, R.w, R.h);
    this.coinIcon.setPosition(R.x + 6, R.y + 8);
    this.cashText.setPosition(R.x + 17, R.y + 5);
    this.clockIcon.setPosition(R.x + 6, R.y + 25);
    this.clockText.setPosition(R.x + 17, R.y + 25);
    this.limitPos = { x: R.x + R.w - 15, y: R.y + 15, r: 11 };
    this.starIcon.setPosition(R.x + 6, R.y + 36);
    this.levelText.setPosition(R.x + 17, R.y + 36);
    this.flameIcon.setPosition(R.x + R.w - 38, R.y + 36);
    this.streakText.setPosition(R.x + R.w - 28, R.y + 36);
    this.savingsBar = { x: R.x + 6, y: R.y + 47, w: R.w - 60, h: 7 };
    this.goalText.setPosition(R.x + R.w - 51, R.y + 46);
    this.jobBox = { x: R.x, y: R.y + R.h + 3, w: R.w };
    // Barks: at the top between the windows, or under the left window when there is no room.
    const gapX = L.x + L.w + 22, gapW = R.x - 4 - gapX;
    this.barkTop = gapW >= 110 ? { x: gapX, y: 4, w: gapW } : null;
    this.barkLow = { x: 4, y: L.y + L.h + 4, w: Math.min(R.x - 8, 300) };
    this.barkArea = this.barkTop ?? this.barkLow;

    // Bottom: the help line, the station prompt and the minimap.
    this.helpText.setText(this.isTouch ? 'STICK: STEER · GO · STOP · + − GEAR · TAP A JOB' : '↑↓←→ RIDE · 1-4 JOB · F STATION · H HORN · ESC: MENU AND HELP');
    // The help line: at the bottom, right of the minimap (if there is room).
    this.helpText.setPosition(vw - this.helpText.width - 4, vh - LINE - 1);
    this.helpText.setVisible(vw >= this.helpText.width + 146 || this.isTouch);
    if (this.helpText.visible) g.fillStyle(0x0a0c18, 0.8).fillRect(this.helpText.x - 3, this.helpText.y - 2, this.helpText.width + 6, LINE + 2);
    this.minimap.layout(4, vh - 4);
    this.flash.setSize(width, height);
    if (this.isTouch) this.#layoutTouch(width, height);
  }

  update(_time, deltaMs) {
    const ride = this.ride, bike = ride.bike, spec = BIKES[bike.type];
    const g = this.fg.clear();
    const L = this.left;
    const electric = bike.type === 'electric';

    // Speed and gear.
    const kmh = Math.abs(forwardSpeed(bike)) * 3.6;
    this.speedText.setText(String(Math.round(kmh)));
    this.unitText.setText('KM/H').setPosition(L.x + 9 + this.speedText.width, L.y + 12);
    this.gearIcon.setFrame(spec.gears ? 'cog' : 'battery');
    this.gearText.setText(spec.gears ? `${bike.gear + 1}` : 'E').setTint(bike.autoShift ? UI.green : UI.white);

    // Fuel or battery: a segmented bar. Live use against full throttle on flat tarmac.
    this.energyIcon.setFrame(electric ? 'battery' : 'fuel');
    const low = bike.energy < 0.25;
    this.energyText.setText(`${Math.round(bike.energy * 100)}%`).setTint(low ? UI.red : UI.white);
    const eb = this.energyBar;
    const blinkLow = bike.energy < 0.1 && Math.floor(this.time.now / 300) % 2 === 0;
    drawSegBar(g, eb.x, eb.y, eb.w, eb.h, bike.energy, blinkLow ? 0xffffff : electric ? COLOURS.ampersandYellow : low ? UI.red : PETROL_RED, 12);
    const ratio = (bike.energyRate ?? 0) * spec.energySeconds;
    this.useSmooth = (this.useSmooth ?? 0) + (ratio - (this.useSmooth ?? 0)) * Math.min(1, deltaMs / 250);
    this.useText.setText(this.useSmooth < -0.02 ? 'CHARGE' : `USE ${Math.max(0, this.useSmooth).toFixed(1)}×`).setTint(this.useSmooth < -0.02 ? UI.green : UI.dim);

    // Revs: green, then gold, then the red zone (petrol). Electric: the motor load.
    this.revsLabel.setText(spec.gears ? 'RPM' : 'MTR');
    const rb = this.revsBar, segs = 10;
    const redFrom = spec.gears ? Math.round(GEARBOX.peakRevsEnd * segs) : segs;
    drawSegBar(g, rb.x, rb.y, rb.w, rb.h, Math.min(1, bike.revs), (i) => (i >= redFrom ? UI.red : i >= redFrom - 2 ? UI.gold : UI.green), segs);

    // The moto service (oil, brake pads, chain, tyres): white, orange from 80%, red when due.
    const due = serviceDue(bike);
    const late = due >= 1;
    const blink = bike.brokenDown && Math.floor(this.time.now / 300) % 2 === 0;
    const sb = this.serviceBar;
    drawSegBar(g, sb.x, sb.y, sb.w, sb.h, Math.min(1, due), blink ? 0xffffff : late ? UI.red : due >= 0.8 ? UI.orange : 0xe8e8f8, 12);
    this.serviceText.setText(bike.brokenDown ? 'OUT' : `${Math.round(due * 100)}%`).setTint(late || bike.brokenDown ? UI.red : due >= 0.8 ? UI.orange : UI.white);

    // Where you are: slope and surface, then the district and the height above the valley.
    const grade = Math.round(bike.grade * 100);
    const slope = grade === 0 ? 'FLAT' : `${grade > 0 ? '↑' : '↓'}${Math.abs(grade)}%`;
    this.groundText.setText(bike.surface.offRoad ? 'OFF ROAD: 4× WEAR' : `${slope} · ${bike.surface.name}`).setTint(bike.surface.offRoad ? UI.red : UI.white);
    const t = ride.world.tileAt(bike.x, bike.y);
    this.placeText.setText(`${DISTRICTS[t?.district]?.name ?? ''} · ${Math.round(bike.z)} M UP`);

    this.minimap.update(this.time.now);
    this.#updateMoney(g);
    this.#updateJobs(g);
    const o = this.over.clear();
    this.#updateStation(o);
    this.#updateMessages(o, deltaMs);
    if (this.flash.alpha > 0) this.flash.setAlpha(Math.max(0, this.flash.alpha - deltaMs / 300));
    if (this.isTouch) this.#drawStick();
  }

  #updateMoney(g) {
    const ride = this.ride, R = this.right;
    const cash = ride.wallet.cash;
    this.cashText.setText(money(cash)).setTint(cash < 0 ? UI.red : UI.white);
    this.rwfText.setText('RWF').setPosition(R.x + 19 + this.cashText.width, R.y + 12);
    const h = ride.clockHours;
    const day = ride.dayOver ? ride.wallet.day - 1 : ride.wallet.day; // during the day end, wallet.day counts the next day
    const clock = ride.dayOver ? `${String(ride.level.shift.end % 24).padStart(2, '0')}:00` : `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    this.clockText.setText(`DAY ${day} · ${clock}`);
    // Speed limit sign: a red ring. It flashes when you are over the limit by more than the camera tolerance.
    const kmh = Math.abs(forwardSpeed(ride.bike)) * 3.6;
    const limit = ride.speedLimit.limitKmh;
    const blink = kmh > limit + LAW.toleranceKmh && Math.floor(this.time.now / 250) % 2 === 0;
    const { x, y, r } = this.limitPos;
    g.fillStyle(0x000000, 1).fillCircle(x, y, r + 1).fillStyle(0xd0302a, 1).fillCircle(x, y, r).fillStyle(blink ? 0xffb080 : 0xffffff, 1).fillCircle(x, y, r - 3);
    // The number in the small sign font (3 × 5 pixels a digit), like a real road sign.
    const num = String(limit), nw = textWidth(num);
    g.fillStyle(0x101010, 1);
    for (let py = 0; py < 5; py++) for (let px = 0; px < nw; px++) if (textBit(num, px, py)) g.fillRect(Math.round(x - nw / 2) + px, Math.round(y - 2) + py, 1, 1);
    // Level and savings toward the milestone.
    const Lv = ride.level;
    const target = Lv.freePlay ? 0 : Lv.goal + SAVINGS_FLOAT;
    this.levelText.setText(`L${Lv.n} ${Lv.name}`);
    const streak = ride.wallet.streak ?? 0;
    this.flameIcon.setVisible(streak > 0);
    this.streakText.setText(streak > 0 ? `×${(1 + streak).toFixed(1)}` : '');
    const frac = target ? Math.max(0, Math.min(1, cash / target)) : 1;
    const sp = this.savingsBar;
    drawSegBar(g, sp.x, sp.y, sp.w, sp.h, frac, frac >= 1 ? UI.green : UI.gold, 12);
    this.goalText.setText(Lv.freePlay ? 'FREE PLAY' : money(target)).setTint(frac >= 1 ? UI.green : UI.dim);
  }

  #updateJobs(g) {
    const ride = this.ride, bike = ride.bike, job = ride.board.active, box = this.jobBox;
    const n = Math.floor((box.w - 22) / RETRO_CELL.width); // characters on a line
    const iconOf = (j) => (j.type === 'passenger' ? 'person' : j.goods === 'bananas' ? 'bananas' : 'sack');
    const what = (j) => (j.type === 'passenger' ? 'PASSENGER' : j.goods === 'bananas' ? `BANANAS ${j.kg}KG` : `RICE ${j.kg}KG`);
    const fuel = (j) => (j.fuel === undefined ? '' : ` · FUEL ${Math.max(1, Math.round(j.fuel * 100))}%`);
    const short = (j) => j.fuel !== undefined && j.fuel > bike.energy;
    let y = box.y + 18;
    const fill = (card, i, lines, tints, tap) => {
      card.icon.setVisible(true).setPosition(box.x + 6, y);
      card.lines.forEach((l, li) => l.setText(lines[li] ?? '').setTint(tints[li] ?? UI.white).setPosition(box.x + 18, y + li * LINE).setVisible(li < lines.length));
      card.y = y;
      card.h = lines.length * LINE;
      card.zone.setPosition(box.x + 2, y - 1).setSize(box.w - 4, card.h + 2);
      card.zone.input.enabled = tap;
      y += card.h + 4;
    };
    const hide = (card) => {
      card.icon.setVisible(false);
      card.lines.forEach((l) => l.setVisible(false));
      card.zone.input.enabled = false;
    };
    if (job) {
      this.jobIcon.setFrame('pin');
      this.jobTitle.setText(job.stage === 'toPickup' ? 'GO TO THE PICKUP' : 'GO TO THE DROP OFF').setTint(job.stage === 'toPickup' ? UI.green : UI.white);
      const dist = Math.round(ride.targetDistance ?? 0);
      const racing = job.stage === 'toPickup' && ride.raceRival?.mission;
      const quality =
        racing ? 'A RIVAL IS RACING YOU!' :
        job.stage !== 'toDropoff' ? 'STOP AT THE GREEN MARKER' :
        job.type === 'passenger' ? `COMFORT ${Math.round(job.comfort)}%` :
        job.fragile ? `DAMAGE ${Math.round(job.damage * 100)}%` : 'STOP AT THE WHITE MARKER';
      const route = wrapRetro(`${job.from.name} → ${job.to.name}`, n).slice(0, 2);
      const card = this.cards[0];
      card.icon.setFrame(iconOf(job));
      const lines = [`${what(job)} · ${money(job.pay)}`, ...route, `${dist} M${fuel(job)}`];
      const shown = lines.slice(0, 4);
      fill(card, 0, shown, shown.map((_, li) => (li === 0 ? UI.white : li === shown.length - 1 ? (short(job) ? UI.red : UI.white) : UI.dim)), false);
      const q = this.cards[1];
      q.icon.setVisible(false);
      q.lines.forEach((l, li) => l.setVisible(li === 0 || (li === 1 && !this.isTouch)));
      q.lines[0].setText(quality).setTint(racing ? UI.red : UI.gold).setPosition(box.x + 6, y);
      q.lines[1].setText('BACKSPACE: CANCEL').setTint(UI.grey).setPosition(box.x + 6, y + LINE);
      q.zone.input.enabled = false;
      y += (this.isTouch ? 1 : 2) * LINE + 2;
      hide(this.cards[2]);
      hide(this.cards[3]);
    } else {
      this.jobIcon.setFrame('pin');
      const count = ride.board.offers.length;
      this.jobTitle.setText(count ? (this.isTouch ? 'JOBS · TAP ONE' : `JOBS · PRESS 1-${count}`) : 'NO JOBS NOW').setTint(UI.dim);
      this.cards.forEach((card, i) => {
        const o = ride.board.offers[i];
        if (!o) return hide(card);
        card.icon.setFrame(iconOf(o));
        // On a short screen (a phone): one line for the route, and only the cards that fit.
        const route = wrapRetro(`${o.from.name} → ${o.to.name}`, n).slice(0, this.vh < 240 ? 1 : 2);
        const lines = [`${i + 1} ${what(o)} · ${money(o.pay)}`, ...route, `${o.gameKm.toFixed(1)} KM${fuel(o)}${short(o) ? ' LOW!' : ''}`];
        if (y + lines.length * LINE > this.vh - 6) return hide(card);
        fill(card, i, lines, lines.map((_, li) => (li === 0 ? UI.white : li === lines.length - 1 && short(o) ? UI.red : UI.dim)), true);
      });
    }
    // The window behind the jobs (its height follows the cards).
    const h = y - box.y + 1;
    this.jobWindow = { x: box.x, y: box.y, w: box.w, h };
    this.#jobWindowGfx().clear();
    drawWindow(this.#jobWindowGfx(), box.x, box.y, box.w, h);
    this.jobIcon.setPosition(box.x + 6, box.y + 5);
    this.jobTitle.setPosition(box.x + 18, box.y + 5);
  }

  /** The jobs window has its own graphics under the job text (its height changes). */
  #jobWindowGfx() {
    if (!this.jobGfx) {
      this.jobGfx = this.add.graphics();
      this.ui.addAt(this.jobGfx, 1);
    }
    return this.jobGfx;
  }

  #updateStation(g) {
    const ride = this.ride, vh = this.vh;
    const bottom = vh - (this.helpText.visible ? LINE + 4 : 6);
    // The free area at the bottom: right of the minimap (when it shows).
    const left = this.ride.showMap !== false ? this.minimap.box.x + this.minimap.box.w + 4 : 4;
    const vw = this.vw - left, ox = left;
    // Fuel choices at a fuel station.
    const choices = !ride.refuel && ride.fuelChoice;
    let top = bottom;
    // The station prompt (or a street hail in reach, or the refuel progress).
    let text = null, progress = null;
    if (ride.refuel) {
      const r = ride.refuel;
      const what = r.kind === 'fuel' ? 'FILLING UP' : r.kind === 'swap' ? 'SWAPPING THE BATTERY' : 'THE MECHANIC IS WORKING';
      text = `${what} · ${Math.ceil(r.timeLeft)} S`;
      progress = 1 - r.timeLeft / r.total;
    } else if (ride.hailOffer) {
      text = `${this.isTouch ? 'TAP' : '1'}: STREET HAIL TO ${ride.hailOffer.to.name}`;
    } else {
      const offer = ride.stationOffer();
      if (offer) text = this.isTouch ? offer.text.replace('F: ', 'TAP: ') : offer.text;
    }
    const lines = text ? wrapRetro(text, Math.floor((Math.min(320, vw - 8) - 14) / RETRO_CELL.width)) : [];
    if (lines.length) {
      const w = Math.max(...lines.map((l) => retroWidth(l))) + 14;
      const h = lines.length * LINE + 8 + (progress !== null ? 9 : 0);
      const x = ox + Math.round((vw - w) / 2);
      top = bottom - h;
      drawWindow(g, x, top, w, h, 'dark');
      this.promptLines.forEach((l, i) => l.setText(lines[i] ?? '').setVisible(i < lines.length).setPosition(ox + Math.round((vw - retroWidth(lines[i] ?? '')) / 2), top + 5 + i * LINE));
      if (progress !== null) drawSegBar(g, x + 7, top + 5 + lines.length * LINE, w - 14, 6, progress, UI.green, 16);
      this.promptZone.setPosition(x, top).setSize(w, h);
      this.promptZone.input.enabled = !ride.refuel;
    } else {
      this.promptLines.forEach((l) => l.setVisible(false));
      this.promptZone.input.enabled = false;
    }
    // Fuel choices: a blue window above the prompt, one row each.
    this.fuelRows.forEach((row, i) => {
      const c = choices?.[i];
      row.text.setVisible(!!c);
      row.zone.input.enabled = !!c;
      if (!c) return;
      const what = c.label.replace(/^enough for the /i, '');
      row.text.setText(`${this.isTouch ? '' : `${i + 1} `}${what}: ${c.cost ? `${money(c.cost)} RWF` : 'ENOUGH'}`).setTint(c.cost ? UI.white : UI.grey);
    });
    if (choices) {
      const rows = this.fuelRows.filter((r) => r.text.visible);
      const w = Math.max(...rows.map((r) => r.text.width)) + 16;
      const h = rows.length * (LINE + 2) + 8;
      const x = ox + Math.round((vw - w) / 2), y = top - h - 3;
      drawWindow(g, x, y, w, h);
      rows.forEach((r, i) => {
        r.text.setPosition(x + 8, y + 5 + i * (LINE + 2));
        r.zone.setPosition(x + 2, y + 3 + i * (LINE + 2)).setSize(w - 4, LINE + 2);
      });
    }
  }

  #updateMessages(g, deltaMs) {
    // The bark: a dark window at the top centre, one or two lines. It fades out.
    const alpha = Math.min(1, this.barkAlpha ?? 0);
    if (alpha > 0) {
      this.barkAlpha -= deltaMs / 2200;
      const lines = this.barkWrapped;
      const w = Math.max(...lines.map((l) => retroWidth(l))) + 14;
      const h = lines.length * LINE + 8;
      const x = Math.round(this.barkArea.x + (this.barkArea.w - w) / 2), y = this.barkArea.y;
      drawWindow(g, x, y, w, h, 'dark', 0.9 * alpha);
      this.barkLines.forEach((l, i) => l.setText(lines[i] ?? '').setVisible(i < lines.length).setAlpha(alpha).setPosition(Math.round(this.barkArea.x + (this.barkArea.w - retroWidth(lines[i] ?? '')) / 2), y + 5 + i * LINE));
    } else {
      this.barkLines.forEach((l) => l.setVisible(false));
    }
    // Money pop ups: big numbers that float up and fade.
    for (const p of this.popups) {
      p.life -= deltaMs / 1000;
      p.text.y -= (deltaMs / 1000) * 10;
      p.text.setAlpha(Math.min(1, p.life));
      if (p.life <= 0) p.text.destroy();
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  #popup(amount, labelText) {
    const sign = amount >= 0 ? '+' : '−';
    const t = retroLabel(this, 0, 0, `${sign}${money(Math.abs(amount))} ${labelText}`, amount >= 0 ? UI.green : UI.red, 2);
    const w = t.width;
    t.setPosition(Math.round((this.vw - w) / 2), Math.round(this.vh * 0.58 + this.popups.length * 20)); // under the bike
    this.ui.add(t);
    this.popups.push({ text: t, life: 2.4 });
  }

  #bark(text) {
    // At the top between the windows when it fits in three lines; else under the left window.
    const wrap = (area) => wrapRetro(text, Math.floor((area.w - 14) / RETRO_CELL.width));
    const top = this.barkTop && wrap(this.barkTop);
    this.barkArea = top && top.length <= 3 ? this.barkTop : this.barkLow;
    this.barkWrapped = (top && top.length <= 3 ? top : wrap(this.barkLow)).slice(0, 3);
    this.barkAlpha = 1.6;
  }

  // ---------------------------------------------------------------------------
  // Touch: a virtual stick on the left half, GO and STOP buttons on the right.
  // ---------------------------------------------------------------------------
  #createTouchControls() {
    this.input.addPointer(2);
    this.stickGfx = this.add.graphics();
    this.goBtn = this.#button('GO', () => (this.ride.touch.throttle = true), () => (this.ride.touch.throttle = false));
    this.stopBtn = this.#button('STOP', () => (this.ride.touch.brake = true), () => (this.ride.touch.brake = false));
    this.modeBtn = this.#button('C', () => this.ride.toggleSteering(), null, 22);
    this.bikeBtn = this.#button('B', () => this.ride.toggleBike(), null, 22);
    this.resetBtn = this.#button('R', () => this.ride.resetBike(), null, 22);
    this.hornBtn = this.#button('H', () => this.ride.horn(), null, 22);
    this.autoBtn = this.#button('G', () => this.ride.toggleAutoShift(), null, 22);
    this.upBtn = this.#button('+', () => this.ride.shift(1), null, 26);
    this.downBtn = this.#button('−', () => this.ride.shift(-1), null, 26);
    this.stickPointer = null;
    this.input.on('pointerdown', (p) => {
      if (p.x < this.scale.gameSize.width / 2 && !this.stickPointer && !p.hitButton) {
        this.stickPointer = p;
        this.stickBase = { x: p.x, y: p.y };
      }
    });
    this.input.on('pointermove', (p) => {
      if (p !== this.stickPointer) return;
      const R = 60;
      let dx = p.x - this.stickBase.x, dy = p.y - this.stickBase.y;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx *= R / len; dy *= R / len; }
      Object.assign(this.ride.touch.stick, { x: dx / R, y: dy / R, active: true });
    });
    const release = (p) => {
      if (p !== this.stickPointer) return;
      this.stickPointer = null;
      Object.assign(this.ride.touch.stick, { x: 0, y: 0, active: false });
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  /** A round touch button with a pixel font label. */
  #button(label, onDown, onUp, size = 34) {
    const circle = this.add.circle(0, 0, size, 0x102060, 0.7).setStrokeStyle(3, 0xe8e8f8, 0.9).setInteractive();
    const text = this.add.bitmapText(0, 0, 'retro', label).setOrigin(0.5).setScale(Math.max(2, Math.round(size / 12)));
    circle.on('pointerdown', (p) => { p.hitButton = true; onDown(); circle.setFillStyle(0x3050c0, 0.9); });
    const up = () => { onUp?.(); circle.setFillStyle(0x102060, 0.7); };
    circle.on('pointerup', up);
    circle.on('pointerout', up);
    return { circle, text, setPosition: (x, y) => { circle.setPosition(x, y); text.setPosition(x, y); } };
  }

  #layoutTouch(width, height) {
    this.goBtn.setPosition(width - 60, height - 80);
    this.stopBtn.setPosition(width - 140, height - 60);
    // Small buttons in a row under the left window (the right side has the money and the jobs).
    const by = (this.left.y + this.left.h) * this.k + 34;
    [this.hornBtn, this.autoBtn, this.modeBtn, this.bikeBtn, this.resetBtn].forEach((b, i) => b.setPosition(40 + i * 54, by));
    this.upBtn.setPosition(width - 60, height - 165);
    this.downBtn.setPosition(width - 140, height - 140);
  }

  #drawStick() {
    const g = this.stickGfx.clear();
    if (!this.stickPointer) return;
    const s = this.ride.touch.stick;
    g.lineStyle(3, 0xe8e8f8, 0.6).strokeCircle(this.stickBase.x, this.stickBase.y, 60);
    g.fillStyle(0x3050c0, 0.6).fillCircle(this.stickBase.x + s.x * 60, this.stickBase.y + s.y * 60, 22);
  }
}
