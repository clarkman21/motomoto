import Phaser from 'phaser';
import { BIKES, COLOURS, GEARBOX, LAW, SAVINGS_FLOAT, DISTRICTS, RIDER, HARD_RULES, MUZUNGU, HUD_RULES } from '../config.js';
import { forwardSpeed } from '../sim/bike.js';
import { serviceDue } from '../sim/maintenance.js';
import { wrapRetro, retroText, RETRO_CELL } from '../world/retro-font.js';
import { MinimapView } from './MinimapView.js';
import { textBit, textWidth } from '../world/garage-sprites.js';
import { UI, pixelScale, ensureRetroFont, ensureIcons, retroLabel, retroWidth, drawWindow, drawSegBar, smallLabel, wrapSmall } from './retro-ui.js';

// The HUD in a retro 16-bit console style, like the menus: everything is drawn at a low
// resolution (about 480 × 270 virtual pixels, like the game view) with the pixel font, pixel icons, blue windows and
// segmented bars, then scaled up by a whole number. It reads the ride scene state each frame and
// writes the touch controls back.
// Minimal HUD (Alp, 14 October 2026): a thing shows only when it helps you now. Always: the speed and
// the gear, the fuel or battery bar, the cash and the clock, the savings bar, the minimap. Only when
// low: the service, food and WC bars. Only with a job: one job line at the top centre. Only with no
// job: a small job list (one line for each offer). Only on a change: the speed limit, the district
// name, the warnings and one message line at the bottom. The level, the goal and the quests are in
// the pause menu; the keys are in How to play (the keys line shows only in the first minute).

const LEFT_W = 98;
const LIST_W = 160;
const LINE = RETRO_CELL.height + 1; // virtual pixels between text lines
const PETROL_RED = UI.petrol;
const HELP_SECONDS = 60; // the keys line shows for this long after the start
const SIGN_SECONDS = 3; // the speed limit sign shows for this long after the limit changes
const money = (n) => `${Math.round(n).toLocaleString('en')}`;
/** A short place name for the small job lines. */
const shortName = (name, max = 15) => {
  const s = String(name).toUpperCase().replace(/ MARKET\b/g, ' MKT').replace(/\bROUNDABOUT\b/g, 'RBT').replace(/\bHOTEL\b/g, '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trim()}.` : s;
};

export class HudScene extends Phaser.Scene {
  constructor() {
    super('hud');
  }

  create() {
    this.ride = this.scene.get('ride');
    ensureRetroFont(this);
    ensureIcons(this);
    // Listen to the ride. When this HUD stops (or starts again), remove the old listeners: else each
    // payment or message shows two or more times.
    const listeners = {
      bark: (text) => this.#bark(text),
      money: (amount, label) => this.#popup(amount, label),
      camera: (e) => this.flash.setAlpha(e.fine ? 0.75 : 0.2),
    };
    for (const [name, fn] of Object.entries(listeners)) this.ride.events.on(name, fn);
    this.events.once('shutdown', () => {
      for (const [name, fn] of Object.entries(listeners)) this.ride.events.off(name, fn);
    });

    // Everything except the camera flash and the touch controls is in one container, in virtual pixels.
    this.ui = this.add.container(0, 0);
    const add = (o) => (this.ui.add(o), o);
    const label = (tint = UI.white, scale = 1) => add(retroLabel(this, 0, 0, '', tint, scale));
    const small = (tint = UI.white) => add(smallLabel(this, tint));
    const icon = (name) => add(this.add.image(0, 0, 'hud-icons', name).setOrigin(0));
    this.bg = add(this.add.graphics()); // the fixed windows (drawn again on a resize)
    this.fg = add(this.add.graphics()); // windows that change, bars and signs (drawn each frame)

    // Left window: speed, gear, the revs (petrol), then one bar for each need that shows now.
    this.speedText = label(UI.white, 2);
    this.unitText = label(UI.dim);
    this.gearText = label(UI.white, 2);
    this.rows = ['energy', 'service', 'food', 'wc'].map((key) => ({ key, icon: icon({ energy: 'fuel', service: 'spanner', food: 'food', wc: 'wc' }[key]), text: small(UI.red) }));
    // The pause button.
    this.pauseIcon = icon('pause');
    this.#zone(() => this.ride.openPause(), (z) => (this.pauseZone = z));

    // Right: the cash chip (cash, clock, streak), the savings bar under it, the speed limit beside it.
    this.coinIcon = icon('coin');
    this.cashText = label(UI.white, 2);
    this.clockText = label(UI.dim);
    this.flameIcon = icon('flame');
    this.streakText = small(UI.orange);

    // The job list (no job): one line for each offer. The job line (with a job): at the top centre.
    this.listRows = [0, 1, 2, 3].map((i) => {
      const row = { key: small(), icon: icon('person'), to: small(), dist: small(UI.dim), pay: small() };
      this.#zone(() => this.ride.acceptJob(i), (z) => (row.zone = z));
      return row;
    });
    this.pill = { icon: icon('pin'), parts: [0, 1, 2, 3].map(() => small()) };
    this.warnText = small(UI.white); // a warning chip under the job line
    this.districtTitle = label(UI.white, 2);
    this.districtShadow = label(UI.textShadow, 2);

    // Bottom: station prompt (tap = F), fuel choices (tap = 1, 2, 3), the keys line (first minute).
    this.promptLines = [0, 1, 2].map(() => label());
    this.#zone(() => { if (!this.ride.acceptHail()) this.ride.startRefuel(); }, (z) => (this.promptZone = z));
    this.fuelRows = [0, 1, 2].map((i) => {
      const row = { text: label() };
      this.#zone(() => this.ride.chooseFuel(i), (z) => (row.zone = z));
      return row;
    });
    this.helpText = label(UI.grey);
    this.helpUntil = this.time.now + HELP_SECONDS * 1000;
    // The message line (short barks) and the money pop ups.
    this.barkLines = [0, 1].map(() => small());
    this.popups = [];

    this.minimap = new MinimapView(this, this.ui);
    // Prompts, fuel choices and messages are on top of everything (also on top of the minimap).
    this.over = add(this.add.graphics());
    for (const l of [...this.promptLines, ...this.fuelRows.map((r) => r.text), ...this.barkLines, this.districtShadow, this.districtTitle]) this.ui.bringToTop(l);
    for (const z of [this.promptZone, ...this.fuelRows.map((r) => r.zone)]) this.ui.bringToTop(z);
    this.flash = this.add.rectangle(0, 0, 10, 10, UI.white, 1).setOrigin(0).setAlpha(0);
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
    this.left = { x: 4, y: 4, w: LEFT_W, h: 40 }; // the height follows the bars that show (see #updateLeft)
    // Pause button: a small window beside the left window.
    drawWindow(g, 4 + LEFT_W + 3, 4, 15, 15);
    this.pauseIcon.setPosition(4 + LEFT_W + 6, 7);
    this.pauseZone.setPosition(4 + LEFT_W + 3, 4).setSize(15, 15);
    // Bottom: the keys line (first minute only), the minimap.
    this.helpText.setText(this.isTouch ? 'STICK: STEER · GO · STOP · + − GEAR · TAP A JOB' : '↑↓←→ RIDE · 1-4 JOB · F STATION · H HORN · ESC: MENU AND HELP');
    this.helpText.setPosition(vw - this.helpText.width - 4, vh - LINE - 1);
    this.helpFits = vw >= this.helpText.width + 120 || this.isTouch;
    this.minimap.layout(4, vh - 4);
    this.flash.setSize(width, height);
    this.jobLimit = vh - 6; // the lowest line of the job list (touch: above the buttons)
    if (this.isTouch) this.#layoutTouch(width, height);
  }

  update(_time, deltaMs) {
    // A phone held upright: the HUD has no room, so pause (the pause menu asks you to turn the phone).
    const { width, height } = this.scale.gameSize;
    if (this.isTouch && height > width && this.ride.started && !this.scene.isActive('dayEnd') && !this.scene.isActive('garage')) {
      this.ride.openPause();
      return;
    }
    const g = this.fg.clear();
    this.helpText.setVisible(this.helpFits && this.time.now < this.helpUntil);
    this.#updateLeft(g);
    this.minimap.update(this.time.now);
    this.#updateMoney(g);
    this.#updateJobs(g);
    const o = this.over.clear();
    const promptTop = this.#updateStation(o);
    this.#updateMessages(o, deltaMs, promptTop);
    if (this.flash.alpha > 0) this.flash.setAlpha(Math.max(0, this.flash.alpha - deltaMs / 300));
    if (this.isTouch) this.#drawStick();
  }

  /** The left window: speed, gear, revs (petrol), and the bars that show now. */
  #updateLeft(g) {
    const ride = this.ride, bike = ride.bike, spec = BIKES[bike.type], L = this.left;
    const electric = bike.type === 'electric';
    const blinkOn = Math.floor(this.time.now / 300) % 2 === 0;
    const kmh = Math.abs(forwardSpeed(bike)) * 3.6;
    // Which bars show: the fuel or battery always; the others only when they need you.
    const due = serviceDue(bike);
    const food = ride.rider ? ride.rider.energy : 1;
    const wc = this.ride.mode?.bladder && ride.rider ? ride.rider.bladder ?? 0 : 0;
    const eating = ride.refuel?.kind === 'food';
    const show = {
      energy: true,
      service: bike.brokenDown || due >= HUD_RULES.serviceFrom,
      food: !!ride.rider && (food < HUD_RULES.foodBelow || eating),
      wc: !!this.ride.mode?.bladder && !!ride.rider && wc >= HUD_RULES.wcFrom,
    };
    const rowsTop = L.y + (spec.gears ? 33 : 27);
    const shown = this.rows.filter((r) => show[r.key]);
    L.h = rowsTop - L.y + shown.length * 10 + 2;
    drawWindow(g, L.x, L.y, L.w, L.h);
    // Speed and the gear in a small black box.
    this.speedText.setText(String(Math.round(kmh))).setPosition(L.x + 6, L.y + 5);
    this.unitText.setText('KM/H').setPosition(L.x + 8 + this.speedText.width, L.y + 12);
    const gx = L.x + L.w - 21, gy = L.y + 4;
    g.fillStyle(UI.frameLight, 1).fillRect(gx - 1, gy - 1, 18, 22).fillStyle(UI.frame, 1).fillRect(gx, gy, 16, 20);
    this.gearText.setText(spec.gears ? `${bike.gear + 1}` : 'E').setPosition(gx + 2, gy + 2);
    // Revs (petrol): a thin strip, green, then gold, then the red zone. No label.
    if (spec.gears) {
      const segs = 10;
      const redFrom = Math.round(GEARBOX.peakRevsEnd * segs), goldFrom = Math.round(GEARBOX.ecoRevs * segs);
      drawSegBar(g, L.x + 6, L.y + 26, L.w - 12, 5, Math.min(1, bike.revs), (i) => (i >= redFrom ? UI.red : i >= goldFrom ? UI.gold : UI.green), segs);
    }
    let y = rowsTop;
    for (const r of this.rows) {
      const on = show[r.key];
      r.icon.setVisible(on);
      r.text.setVisible(false);
      if (!on) continue;
      r.icon.setPosition(L.x + 5, y);
      const bx = L.x + 17, bw = L.w - 23;
      if (r.key === 'energy') {
        const low = bike.energy < 0.25;
        r.icon.setFrame(electric ? 'battery' : 'fuel');
        drawSegBar(g, bx, y + 1, bw, 7, bike.energy, low && blinkOn ? UI.white : low ? UI.red : electric || bike.boost > 0 ? COLOURS.ampersandYellow : PETROL_RED, 8);
        if (low) r.text.setText(`${Math.round(bike.energy * 100)}%`).setVisible(true);
      } else if (r.key === 'service') {
        const late = due >= 1;
        drawSegBar(g, bx, y + 1, bw, 7, Math.min(1, due), bike.brokenDown && blinkOn ? UI.white : late || bike.brokenDown ? UI.red : UI.orange, 8);
        if (bike.brokenDown) r.text.setText('OUT').setVisible(true);
      } else if (r.key === 'food') {
        const hungry = food < RIDER.hungryAt;
        drawSegBar(g, bx, y + 1, bw, 7, food, food <= 0.05 && blinkOn ? UI.white : hungry ? UI.red : UI.orange, 8);
        if (hungry) r.text.setText(`${Math.round(food * 100)}%`).setVisible(true);
      } else {
        const urgent = wc >= HARD_RULES.bladder.urgentAt;
        drawSegBar(g, bx, y + 1, bw, 7, wc, wc >= 1 && blinkOn ? UI.white : wc >= 1 ? UI.red : urgent ? UI.orange : UI.water, 8);
      }
      // A number only when it matters: outside the window, on the right.
      r.text.setPosition(L.x + L.w + 4, y + 2);
      y += 10;
    }
    // The district name: large in the centre for a moment when you ride into a district.
    const t = ride.world.tileAt(bike.x, bike.y);
    const district = t?.district ?? null;
    if (district && district !== this.lastDistrict) {
      if (this.lastDistrict !== undefined) this.districtAlpha = HUD_RULES.districtSeconds + 0.6;
      this.lastDistrict = district;
      const name = (DISTRICTS[district]?.name ?? '').toUpperCase();
      this.districtTitle.setText(name);
      this.districtShadow.setText(name);
    }
  }

  #updateMoney(g) {
    const ride = this.ride, vw = this.vw;
    const cash = ride.wallet.cash;
    const h = ride.clockHours;
    const clock = ride.dayOver ? `${String(ride.level.shift.end % 24).padStart(2, '0')}:00` : `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    this.cashText.setText(money(cash)).setTint(cash < 0 ? UI.red : UI.white);
    this.clockText.setText(clock);
    const streak = ride.wallet.streak ?? 0;
    this.streakText.setText(streak > 0 ? `×${(1 + streak).toFixed(1)}` : '');
    this.flameIcon.setVisible(streak > 0);
    this.streakText.setVisible(streak > 0);
    const streakW = streak > 0 ? 12 + this.streakText.width : 0;
    const w = 6 + 9 + 3 + this.cashText.width + 5 + this.clockText.width + streakW + 6;
    const R = (this.right = { x: vw - 4 - w, y: 4, w, h: 22 });
    drawWindow(g, R.x, R.y, R.w, R.h);
    this.coinIcon.setPosition(R.x + 6, R.y + 7);
    this.cashText.setPosition(R.x + 18, R.y + 3);
    this.clockText.setPosition(R.x + 18 + this.cashText.width + 5, R.y + 10);
    this.flameIcon.setPosition(R.x + R.w - 6 - streakW, R.y + 7);
    this.streakText.setPosition(R.x + R.w - 6 - streakW + 11, R.y + 9);
    // The savings goal: a thin bar under the chip (the number is in the pause menu).
    const Lv = ride.level;
    const target = Lv.freePlay ? 0 : Lv.goal + SAVINGS_FLOAT;
    const frac = target ? Math.max(0, Math.min(1, cash / target)) : 1;
    this.savings = { x: vw - 4 - 74, y: R.y + R.h + 2, w: 74, h: 5 };
    drawSegBar(g, this.savings.x, this.savings.y, this.savings.w, this.savings.h, frac, frac >= 1 ? UI.green : UI.gold, 12);
    // Speed limit sign: beside the chip, for a moment when the limit changes, and while you ride faster.
    const kmh = Math.abs(forwardSpeed(ride.bike)) * 3.6;
    const limit = ride.speedLimit.limitKmh;
    if (limit !== this.lastLimit) {
      this.lastLimit = limit;
      this.signUntil = this.time.now + SIGN_SECONDS * 1000;
    }
    if (kmh <= limit && this.time.now > (this.signUntil ?? 0)) return;
    const blink = kmh > limit + LAW.toleranceKmh && Math.floor(this.time.now / 250) % 2 === 0;
    const r = 10, x = R.x - r - 5, y = R.y + 11;
    g.fillStyle(UI.frame, 1).fillCircle(x, y, r + 1).fillStyle(UI.signRed, 1).fillCircle(x, y, r).fillStyle(blink ? UI.signBlink : UI.white, 1).fillCircle(x, y, r - 3);
    // The number in the small sign font (3 × 5 pixels a digit), like a real road sign.
    const num = String(limit), nw = textWidth(num);
    g.fillStyle(UI.signInk, 1);
    for (let py = 0; py < 5; py++) for (let px = 0; px < nw; px++) if (textBit(num, px, py)) g.fillRect(Math.round(x - nw / 2) + px, Math.round(y - 2) + py, 1, 1);
  }

  #updateJobs(g) {
    const ride = this.ride, bike = ride.bike, job = ride.board.active;
    const iconOf = (j) => (j.type === 'passenger' ? 'person' : j.goods === 'bananas' ? 'bananas' : j.goods === 'batteries' ? 'battery' : 'sack');
    const clock = (t) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;
    const short = (j) => j.fuel !== undefined && j.fuel > bike.energy;
    const special = (j) => !!(j.mission || j.visitor);
    // The job list: only when you have no job. One line for each offer, under the savings bar.
    const top = this.savings.y + this.savings.h + 3;
    const offers = job ? [] : ride.board.offers.slice(0, 4).filter((_, i) => top + 4 + (i + 1) * 10 <= this.jobLimit);
    const x = this.vw - 4 - LIST_W;
    if (offers.length) drawWindow(g, x, top, LIST_W, offers.length * 10 + 5);
    this.listRows.forEach((row, i) => {
      const o = offers[i];
      for (const part of [row.key, row.icon, row.to, row.dist, row.pay]) part.setVisible(!!o);
      row.zone.input.enabled = !!o;
      if (!o) return;
      const y = top + 3 + i * 10;
      const tint = special(o) ? UI.gold : UI.white;
      row.key.setText(String(i + 1)).setTint(tint).setPosition(x + 5, y + 2);
      row.icon.setFrame(iconOf(o)).setPosition(x + 11, y);
      row.to.setText(shortName(o.to.name)).setTint(tint).setPosition(x + 23, y + 2);
      row.dist.setText(`${o.gameKm.toFixed(1)}KM`).setTint(short(o) ? UI.red : UI.dim);
      row.dist.setPosition(x + LIST_W - 36 - row.dist.width, y + 2);
      row.pay.setText(money(o.pay)).setTint(tint);
      row.pay.setPosition(x + LIST_W - 5 - row.pay.width, y + 2);
      row.zone.setPosition(x + 2, y).setSize(LIST_W - 4, 10);
    });
    // The job line: one line at the top centre. PICKUP or DROP OFF, the place, the distance, and one
    // more thing when it matters (a rival, the mission clock, low comfort, damage, photos).
    const p = this.pill;
    p.icon.setVisible(!!job);
    p.parts.forEach((t) => t.setVisible(!!job));
    let warnTop = 4;
    if (job) {
      const pickup = job.stage === 'toPickup';
      const place = shortName(pickup ? job.from.name : job.to.name, 22);
      const m = job.mission;
      const late = m?.limit && (m.timeLeft ?? m.limit) < 0;
      const extra =
        pickup && ride.raceRival?.mission ? ['RIVAL!', UI.red] :
        !pickup && m?.limit ? [clock(m.timeLeft ?? m.limit), late ? UI.red : UI.gold] :
        !pickup && job.type === 'passenger' && job.comfort < 80 ? [`COMFORT ${Math.round(job.comfort)}%`, job.comfort < 50 ? UI.red : UI.orange] :
        !pickup && job.fragile && job.damage > 0 ? [`DAMAGE ${Math.round(job.damage * 100)}%`, UI.orange] :
        !pickup && job.visitor && job.visitorState?.photos ? [`PHOTO ${job.visitorState.photos}/${MUZUNGU.maxPhotos}`, UI.gold] : ['', UI.white];
      const texts = [[job.visitor ? 'MUZUNGU' : pickup ? 'PICKUP' : 'DROP OFF', job.visitor ? UI.gold : pickup ? UI.green : UI.white], [place, UI.white], [`${Math.round(ride.targetDistance ?? 0)} M`, short(job) ? UI.red : UI.dim], extra];
      p.parts.forEach((t, i) => t.setText(texts[i][0]).setTint(texts[i][1]));
      const widths = p.parts.map((t) => (t.textValue ? t.width : 0));
      const w = 6 + 9 + 4 + widths.reduce((a, b) => a + (b ? b + 5 : 0), 0) + 2;
      const px = Math.round((this.vw - w) / 2);
      drawWindow(g, px, 4, w, 15);
      p.icon.setFrame(iconOf(job)).setPosition(px + 5, 7);
      let tx = px + 19;
      p.parts.forEach((t, i) => {
        t.setPosition(tx, 9);
        if (widths[i]) tx += widths[i] + 5;
      });
      warnTop = 22;
    }
    // A warning chip under the job line, while it is true: off road, a hired rider who needs you.
    const help = ride.helpWait;
    const warn = bike.surface?.offRoad ? ['OFF ROAD · 4× WEAR', UI.red]
      : help ? [`HELP ${help.rider.name.toUpperCase()} · ${clock(Math.max(0, help.rider.help.timeLeft))} · ${Math.round(Math.hypot(help.vehicle.x - bike.x, help.vehicle.y - bike.y))} M`, UI.orange]
      : null;
    this.warnText.setVisible(!!warn);
    if (warn) {
      this.warnText.setText(warn[0]).setTint(warn[1]);
      const w = this.warnText.width + 10, wx = Math.round((this.vw - w) / 2);
      drawWindow(g, wx, warnTop, w, 11, 'dark');
      this.warnText.setPosition(wx + 5, warnTop + 3);
    }
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
      const what = r.kind === 'fuel' ? 'FILLING UP' : r.kind === 'swap' ? 'SWAPPING THE BATTERY' : r.kind === 'food' ? (r.food === 'drink' ? 'DRINKING' : 'EATING') : 'THE MECHANIC IS WORKING';
      text = `${what} · ${Math.ceil(r.timeLeft)} S`;
      progress = 1 - r.timeLeft / r.total;
    } else if (ride.rescue && ride.rescue.state !== 'leaving') {
      // The fuel moto (T): on the way, then here.
      text = ride.rescue.state === 'handover' ? 'THE FUEL MOTO IS HERE' : `FUEL MOTO ON THE WAY · ${Math.ceil(ride.rescue.eta)} S`;
    } else if (ride.hailOffer) {
      text = `${this.isTouch ? 'TAP' : '1'}: ${ride.hailOffer.visitor ? `MUZUNGU ★ ×${MUZUNGU.fareFactor}` : 'STREET HAIL'} TO ${ride.hailOffer.to.name}`;
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
      row.text.setText(`${this.isTouch ? '' : `${i + 1} `}${c.label}: ${c.cost ? `${money(c.cost)} RWF` : 'FULL'}`).setTint(c.cost ? UI.white : UI.grey);
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
      top = y;
    }
    return top;
  }

  #updateMessages(g, deltaMs, promptTop) {
    // The message line: a dark window at the bottom centre (above a prompt), one or two short lines. It fades out.
    const alpha = Math.min(1, this.barkAlpha ?? 0);
    if (alpha > 0) {
      this.barkAlpha -= deltaMs / (HUD_RULES.messageSeconds * 1000);
      const lines = this.barkWrapped;
      this.barkLines.forEach((l, i) => l.setText(lines[i] ?? '').setVisible(i < lines.length).setAlpha(alpha));
      const w = Math.max(...this.barkLines.filter((l) => l.visible).map((l) => l.width)) + 12;
      const h = lines.length * 8 + 6;
      const x = Math.round((this.vw - w) / 2), y = promptTop - h - 3;
      drawWindow(g, x, y, w, h, 'dark', 0.9 * alpha);
      this.barkLines.forEach((l, i) => l.setPosition(Math.round((this.vw - l.width) / 2), y + 4 + i * 8));
    } else {
      this.barkLines.forEach((l) => l.setVisible(false));
    }
    // The district name: large in the centre, then it fades.
    const da = Math.min(1, this.districtAlpha ?? 0);
    this.districtTitle.setVisible(da > 0);
    this.districtShadow.setVisible(da > 0);
    if (da > 0) {
      this.districtAlpha -= deltaMs / 1000;
      const x = Math.round((this.vw - this.districtTitle.width) / 2), y = Math.round(this.vh * 0.2);
      this.districtTitle.setPosition(x, y).setAlpha(da);
      this.districtShadow.setPosition(x + 2, y + 2).setAlpha(da * 0.8);
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
    // One or two short lines in the small font; a longer message is cut at the end of the second line.
    const lines = wrapSmall(retroText(text), Math.min(300, this.vw - 16));
    if (lines.length > 2) lines[1] = `${lines[1].replace(/[ .,:!]*$/, '')}...`;
    this.barkWrapped = lines.slice(0, 2);
    this.barkAlpha = 1.4;
  }

  // ---------------------------------------------------------------------------
  // Touch: a virtual stick on the left half, GO and STOP buttons on the right.
  // ---------------------------------------------------------------------------
  #createTouchControls() {
    this.input.addPointer(2);
    this.stickGfx = this.add.graphics();
    this.goBtn = this.#button('GO', () => (this.ride.touch.throttle = true), () => (this.ride.touch.throttle = false));
    this.stopBtn = this.#button('STOP', () => (this.ride.touch.brake = true), () => (this.ride.touch.brake = false));
    this.bikeBtn = this.#button('T', () => this.ride.callFuelMoto(), null, 22); // phone the fuel moto
    this.resetBtn = this.#button('R', () => this.ride.resetBike(), null, 22);
    this.hornBtn = this.#button('H', () => this.ride.horn(), null, 22);
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
    const circle = this.add.circle(0, 0, size, UI.blueBands[6], 0.7).setStrokeStyle(3, UI.frameLight, 0.9).setInteractive();
    const text = this.add.bitmapText(0, 0, 'retro', retroText(label)).setOrigin(0.5).setScale(Math.max(2, Math.round(size / 12)));
    circle.on('pointerdown', (p) => { p.hitButton = true; onDown(); circle.setFillStyle(UI.blueBands[0], 0.9); });
    const up = () => { onUp?.(); circle.setFillStyle(UI.blueBands[6], 0.7); };
    circle.on('pointerup', up);
    circle.on('pointerout', up);
    return { circle, text, setPosition: (x, y) => { circle.setPosition(x, y); text.setPosition(x, y); } };
  }

  #layoutTouch(width, height) {
    this.goBtn.setPosition(width - 60, height - 80);
    this.stopBtn.setPosition(width - 140, height - 60);
    // The small buttons and the gear buttons: in one row at the bottom, between the minimap and STOP,
    // so that they cover neither the minimap nor the jobs window. If the row has no room, the old
    // places: under the left window, and above GO and STOP.
    const small = [this.hornBtn, this.bikeBtn, this.resetBtn];
    const mapRight = this.ride.showMap !== false ? (this.minimap.box.x + this.minimap.box.w) * this.k : 0;
    const x0 = mapRight + 28, x1 = width - 140 - 34 - 32;
    const step = (x1 - x0) / (small.length + 1.5);
    if (step >= 48) {
      const y = height - 44;
      small.forEach((b, i) => b.setPosition(x0 + i * step, y));
      this.downBtn.setPosition(x0 + (small.length + 0.25) * step, y - 6);
      this.upBtn.setPosition(x0 + (small.length + 1.5) * step, y - 6);
      this.jobLimit = Math.floor((height - 80 - 34 - 4) / this.k); // above GO
      this.helpText.setVisible(false); // the buttons have their labels; the row covers the help line
      return;
    }
    this.jobLimit = Math.floor((height - 165 - 26 - 4) / this.k); // above +
    const by = (this.left.y + this.left.h) * this.k + 34;
    small.forEach((b, i) => b.setPosition(40 + i * 54, by));
    this.upBtn.setPosition(width - 60, height - 165);
    this.downBtn.setPosition(width - 140, height - 140);
  }

  #drawStick() {
    const g = this.stickGfx.clear();
    if (!this.stickPointer) return;
    const s = this.ride.touch.stick;
    g.lineStyle(3, UI.frameLight, 0.6).strokeCircle(this.stickBase.x, this.stickBase.y, 60);
    g.fillStyle(UI.blueBands[0], 0.6).fillCircle(this.stickBase.x + s.x * 60, this.stickBase.y + s.y * 60, 22);
  }
}
