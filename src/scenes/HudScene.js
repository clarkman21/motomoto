import Phaser from 'phaser';
import { BIKES, COLOURS, GEARBOX, BRAKES, LAW, JOBS } from '../config.js';
import { forwardSpeed } from '../sim/bike.js';
import { serviceDue } from '../sim/maintenance.js';
import { STEERING_LABELS } from '../sim/controls.js';

// The HUD runs as its own scene at zoom 1, so text stays sharp at any size.
// It reads the ride scene state each frame and writes the touch controls back.

const FONT_BODY = '"Instrument Sans", system-ui, sans-serif';
const FONT_LABEL = '"Barlow Condensed", "Instrument Sans", system-ui, sans-serif';
const PETROL_RED = 0xec5825; // Racing Red, for the petrol gauge
const ALLOY_GREY = '#9e9e9e';

export class HudScene extends Phaser.Scene {
  constructor() {
    super('hud');
  }

  create() {
    this.ride = this.scene.get('ride');
    this.ride.events.on('bark', (text) => this.#bark(text));

    // Top left panel
    this.panel = this.add.graphics();
    this.speedText = this.add.text(0, 0, '0', { fontFamily: FONT_LABEL, fontSize: '44px', fontStyle: '600', color: '#ffffff' });
    this.unitText = this.add.text(0, 0, 'km/h', { fontFamily: FONT_LABEL, fontSize: '18px', color: ALLOY_GREY });
    this.energyLabel = this.add.text(0, 0, '', { fontFamily: FONT_LABEL, fontSize: '16px', color: '#ffffff' });
    this.energyBar = this.add.graphics();
    this.gearLabel = this.add.text(0, 0, 'GEAR', { fontFamily: FONT_LABEL, fontSize: '14px', color: ALLOY_GREY }).setOrigin(0.5, 0);
    this.gearText = this.add.text(0, 0, '1', { fontFamily: FONT_LABEL, fontSize: '40px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5, 0);
    this.revsLabel = this.add.text(0, 0, 'REVS', { fontFamily: FONT_LABEL, fontSize: '14px', color: ALLOY_GREY });
    this.brakesLabel = this.add.text(0, 0, 'BRAKES', { fontFamily: FONT_LABEL, fontSize: '14px', color: ALLOY_GREY });
    this.serviceLabel = this.add.text(0, 0, 'SERVICE', { fontFamily: FONT_LABEL, fontSize: '14px', color: ALLOY_GREY });
    this.meters = this.add.graphics();
    this.infoText = this.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '14px', color: '#ffffff', lineSpacing: 4 });

    // Help line and bark
    this.helpText = this.add
      .text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '14px', color: '#d8d8d8', align: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 10, y: 6 } })
      .setOrigin(0.5, 1);
    this.barkText = this.add
      .text(0, 0, '', { fontFamily: FONT_LABEL, fontSize: '28px', fontStyle: '600', color: '#ffffff', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5, 0)
      .setAlpha(0);

    // Top right: cash, day and clock, speed limit
    this.moneyPanel = this.add.graphics();
    this.cashText = this.add.text(0, 0, '', { fontFamily: FONT_LABEL, fontSize: '34px', fontStyle: '600', color: '#ffffff' }).setOrigin(1, 0);
    this.clockText = this.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '14px', color: '#d8d8d8' }).setOrigin(1, 0);
    this.limitSign = this.add.graphics();
    this.limitText = this.add.text(0, 0, '', { fontFamily: FONT_LABEL, fontSize: '20px', fontStyle: '600', color: '#111111' }).setOrigin(0.5);
    // Jobs: offers or the active job. Each offer is a card you can tap.
    this.jobPanel = this.add.graphics();
    this.jobTitle = this.add.text(0, 0, '', { fontFamily: FONT_LABEL, fontSize: '16px', color: ALLOY_GREY });
    this.jobCards = [0, 1, 2].map((i) => {
      const t = this.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '14px', color: '#ffffff', lineSpacing: 2, wordWrap: { width: 290 } });
      t.setInteractive({ useHandCursor: true }).on('pointerdown', (p) => { p.hitButton = true; this.ride.acceptJob(i); });
      return t;
    });
    // Bottom centre: station prompt or the refuel progress
    this.stationText = this.add
      .text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '16px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.7)', padding: { x: 12, y: 8 }, align: 'center' })
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p) => { p.hitButton = true; this.ride.startRefuel(); });
    // Money pop ups and the camera flash
    this.popups = [];
    this.ride.events.on('money', (amount, label) => this.#popup(amount, label));
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xffffff, 1).setOrigin(0).setAlpha(0);
    this.ride.events.on('camera', (e) => {
      this.flash.setAlpha(e.fine ? 0.75 : 0.25);
      if (!e.fine) this.#bark(`Speed camera: ${Math.round(e.speedKmh)} km/h, limit ${e.limitKmh}. OK`);
    });

    this.isTouch = this.sys.game.device.input.touch;
    if (this.isTouch) this.#createTouchControls();

    this.#layout();
    this.scale.on('resize', () => this.#layout());
  }

  #layout() {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    // Make the HUD smaller on short screens (phones in landscape). Scale the fonts, not the camera,
    // because a scaled camera makes text blocky (texture smoothing is off for pixel art).
    const s = height < 500 ? 0.72 : 1;
    const px = (n) => `${Math.round(n * s)}px`;
    this.speedText.setFontSize(px(44));
    this.unitText.setFontSize(px(18));
    this.energyLabel.setFontSize(px(16));
    this.gearLabel.setFontSize(px(14));
    this.gearText.setFontSize(px(40));
    this.revsLabel.setFontSize(px(14));
    this.brakesLabel.setFontSize(px(14));
    this.infoText.setFontSize(px(14));
    this.helpText.setFontSize(px(14));
    this.barkText.setFontSize(px(28));
    const x = 16 * s, y = 16 * s;
    this.panel.clear().fillStyle(0x000000, 0.62).fillRoundedRect(x, y, 300 * s, 188 * s, 8 * s);
    this.speedText.setPosition(x + 14 * s, y + 4 * s);
    this.unitText.setPosition(x + 90 * s, y + 26 * s);
    this.gearLabel.setPosition(x + 252 * s, y + 6 * s);
    this.gearText.setPosition(x + 252 * s, y + 16 * s);
    this.energyLabel.setPosition(x + 14 * s, y + 58 * s);
    this.energyBarPos = { x: x + 14 * s, y: y + 80 * s, w: 272 * s, h: 10 * s };
    this.revsLabel.setPosition(x + 14 * s, y + 96 * s);
    // Three meters in one row: revs, brake pads, service.
    this.brakesLabel.setPosition(x + 108 * s, y + 96 * s);
    this.serviceLabel.setFontSize(px(14)).setPosition(x + 200 * s, y + 96 * s);
    this.revsBarPos = { x: x + 14 * s, y: y + 116 * s, w: 82 * s, h: 8 * s };
    this.brakesBarPos = { x: x + 108 * s, y: y + 116 * s, w: 80 * s, h: 8 * s };
    this.serviceBarPos = { x: x + 200 * s, y: y + 116 * s, w: 86 * s, h: 8 * s };
    this.infoText.setPosition(x + 14 * s, y + 134 * s);
    this.helpText.setPosition(width / 2, height - 12 * s);
    this.helpText.setText(
      this.isTouch
        ? 'Stick: steer · GO: throttle · STOP: brake · + −: shift'
        : 'W/↑ throttle · S/↓ brake · A D/← → steer · E/Q shift · G auto shift · 1–3 take job · F fuel/swap/garage · H horn · C steering · B bike · R reset · V sound',
    );
    this.helpText.setVisible(width > 1000 || this.isTouch);
    this.barkText.setPosition(width / 2, 24 * s);
    // Right side: money panel and jobs
    this.hudScale = s;
    const rw = 320 * s, rx = width - rw - 16 * s;
    this.moneyPanel.clear().fillStyle(0x000000, 0.62).fillRoundedRect(rx, y, rw, 70 * s, 8 * s);
    this.cashText.setFontSize(px(34)).setPosition(rx + rw - 72 * s, y + 4 * s);
    this.clockText.setFontSize(px(14)).setPosition(rx + rw - 72 * s, y + 46 * s);
    this.limitPos = { x: rx + rw - 36 * s, y: y + 35 * s, r: 24 * s };
    this.limitText.setFontSize(px(20)).setPosition(this.limitPos.x, this.limitPos.y);
    this.jobBox = { x: rx, y: y + 78 * s, w: rw };
    this.jobTitle.setFontSize(px(15)).setPosition(rx + 12 * s, y + 84 * s);
    this.jobCards.forEach((t, i) => {
      t.setFontSize(px(14)).setWordWrapWidth(rw - 24 * s).setPosition(rx + 12 * s, y + (106 + i * 50) * s);
    });
    this.stationText.setFontSize(px(16)).setPosition(width / 2, height - 52 * s);
    this.flash.setSize(width, height);
    if (this.isTouch) this.#layoutTouch(width, height);
  }

  update(_time, deltaMs) {
    const ride = this.ride;
    const bike = ride.bike;
    const spec = BIKES[bike.type];
    const kmh = Math.abs(forwardSpeed(bike)) * 3.6;
    this.speedText.setText(String(Math.round(kmh)));

    const electric = bike.type === 'electric';
    const pct = Math.round(bike.energy * 100);
    // Live energy use, compared with full throttle on flat tarmac (smoothed, so it is readable).
    const ratio = (bike.energyRate ?? 0) * spec.energySeconds;
    this.useSmooth = (this.useSmooth ?? 0) + (ratio - (this.useSmooth ?? 0)) * Math.min(1, deltaMs / 250);
    const use = this.useSmooth < -0.02 ? 'CHARGING' : `USE ${Math.max(0, this.useSmooth).toFixed(1)}×`;
    this.energyLabel.setText(`${electric ? 'BATTERY' : 'FUEL'}  ${pct}%   ·   ${use}`);
    const b = this.energyBarPos;
    this.energyBar.clear().fillStyle(0x333333, 1).fillRect(b.x, b.y, b.w, b.h);
    this.energyBar.fillStyle(electric ? COLOURS.ampersandYellow : PETROL_RED, 1).fillRect(b.x, b.y, b.w * bike.energy, b.h);

    // Gear, revs and brakes
    this.gearText.setText(spec.gears ? `${bike.autoShift ? 'A' : ''}${bike.gear + 1}` : 'E');
    this.gearLabel.setText(spec.gears ? 'GEAR' : 'SINGLE');
    this.revsLabel.setText(spec.gears ? 'REVS' : 'MOTOR');
    const pads = bike.brakePads;
    this.brakesLabel.setText(`PADS ${Math.round(pads * 100)}%`).setColor(pads < BRAKES.warnBelow ? '#ec5825' : ALLOY_GREY);
    const r = this.revsBarPos, k = this.brakesBarPos, m = this.meters.clear();
    m.fillStyle(0x333333, 1).fillRect(r.x, r.y, r.w, r.h).fillRect(k.x, k.y, k.w, k.h);
    if (spec.gears) m.fillStyle(0x5c1c0e, 1).fillRect(r.x + r.w * GEARBOX.peakRevsEnd, r.y, r.w * (1 - GEARBOX.peakRevsEnd), r.h); // red zone
    const revs = Math.min(1, bike.revs);
    m.fillStyle(spec.gears && revs > GEARBOX.peakRevsEnd ? PETROL_RED : 0xf6f5ec, 1).fillRect(r.x, r.y, r.w * revs, r.h);
    m.fillStyle(pads < BRAKES.warnBelow ? PETROL_RED : 0xf6f5ec, 1).fillRect(k.x, k.y, k.w * pads, k.h);
    // Service meter: it fills up as the bike wears. Orange from 80%, red when the service is due.
    const due = serviceDue(bike);
    const sv = this.serviceBarPos;
    const late = due >= 1;
    const blink = bike.brokenDown && Math.floor(this.time.now / 300) % 2 === 0;
    this.serviceLabel.setText(bike.brokenDown ? 'BROKEN DOWN' : `SERVICE ${Math.round(due * 100)}%`).setColor(late ? '#ec5825' : due >= 0.8 ? '#e8a33a' : ALLOY_GREY);
    m.fillStyle(0x333333, 1).fillRect(sv.x, sv.y, sv.w, sv.h);
    m.fillStyle(blink ? 0xffffff : late ? PETROL_RED : due >= 0.8 ? 0xe8a33a : 0xf6f5ec, 1).fillRect(sv.x, sv.y, sv.w * Math.min(1, due), sv.h);

    const grade = Math.round(bike.grade * 100);
    const gradeText = grade === 0 ? 'Flat' : `${grade > 0 ? 'Uphill' : 'Downhill'} ${Math.abs(grade)}%`;
    const surface = bike.surface.offRoad ? 'OFF ROAD: 4× wear' : bike.surface.name;
    this.infoText.setText(`${gradeText} · ${surface}\n${spec.name} [B] · ${STEERING_LABELS[ride.steeringMode]} [C]`);
    this.infoText.setColor(bike.surface.offRoad ? '#ec5825' : '#ffffff');

    this.#updateMoney();
    this.#updateJobs();
    this.#updateStation();
    for (const p of this.popups) {
      p.life -= deltaMs / 1000;
      p.text.y -= (deltaMs / 1000) * 30;
      p.text.setAlpha(Math.min(1, p.life));
      if (p.life <= 0) p.text.destroy();
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    if (this.flash.alpha > 0) this.flash.setAlpha(Math.max(0, this.flash.alpha - deltaMs / 300));

    if (this.barkText.alpha > 0) this.barkText.setAlpha(Math.max(0, this.barkText.alpha - deltaMs / 1500));
    if (this.isTouch) this.#drawStick();
  }

  #updateMoney() {
    const ride = this.ride;
    const cash = ride.wallet.cash;
    this.cashText.setText(`${cash.toLocaleString('en')} RWF`).setColor(cash < 0 ? '#ec5825' : '#ffffff');
    const h = ride.clockHours;
    const hh = String(Math.floor(h)).padStart(2, '0');
    const mm = String(Math.floor((h % 1) * 60)).padStart(2, '0');
    // During the day end summary, wallet.day already counts the next day.
    const day = ride.dayOver ? ride.wallet.day - 1 : ride.wallet.day;
    this.clockText.setText(`Day ${day} · ${ride.dayOver ? '22:00' : `${hh}:${mm}`}`);
    // Speed limit sign. It flashes when you are over the limit by more than the camera tolerance.
    const kmh = Math.abs(forwardSpeed(ride.bike)) * 3.6;
    const limit = ride.speedLimit.limitKmh;
    const over = kmh > limit + LAW.toleranceKmh;
    const blink = over && Math.floor(this.time.now / 250) % 2 === 0;
    const { x, y, r } = this.limitPos;
    this.limitSign.clear().fillStyle(0xd0302a, 1).fillCircle(x, y, r).fillStyle(blink ? 0xec5825 : 0xffffff, 1).fillCircle(x, y, r * 0.74);
    this.limitText.setText(String(limit));
  }

  #updateJobs() {
    const ride = this.ride;
    const job = ride.board.active;
    const s = this.hudScale;
    const box = this.jobBox;
    const money = (n) => `${n.toLocaleString('en')} RWF`;
    const what = (j) => (j.type === 'passenger' ? 'Passenger' : `Cargo ${j.kg} kg${j.fragile ? ', fragile' : ''}`);
    const km = (j) => `${j.gameKm.toFixed(1)} km`;
    if (job) {
      const dist = Math.round(ride.targetDistance ?? 0);
      this.jobTitle.setText(job.stage === 'toPickup' ? 'GO TO PICKUP' : 'GO TO DROP OFF');
      const quality =
        job.stage !== 'toDropoff' ? 'Stop at the green marker.' :
        job.type === 'passenger' ? `Comfort ${Math.round(job.comfort)}% (tip up to ${Math.round(JOBS.passenger.maxTipFraction * 100)}%)` :
        job.fragile ? `Damage ${Math.round(job.damage * 100)}%` : 'Stop at the white marker.';
      this.jobCards[0].setText(`${what(job)} · ${job.from.name} → ${job.to.name}\n${money(job.pay)} · ${dist} m to go\n${quality}`);
      this.jobCards[1].setText('');
      this.jobCards[2].setText(this.isTouch ? '' : 'Backspace: cancel job (no pay)');
      this.jobPanel.clear().fillStyle(0x000000, 0.62).fillRoundedRect(box.x, box.y, box.w, 152 * s, 8 * s);
      return;
    }
    this.jobTitle.setText(this.isTouch ? 'JOBS · tap to accept' : 'JOBS · press 1, 2 or 3');
    this.jobCards.forEach((t, i) => {
      const o = ride.board.offers[i];
      t.setText(o ? `${i + 1}  ${what(o)} · ${money(o.pay)}\n    ${o.from.name} → ${o.to.name} · ${km(o)}` : '');
    });
    this.jobPanel.clear().fillStyle(0x000000, 0.62).fillRoundedRect(box.x, box.y, box.w, 182 * s, 8 * s);
  }

  #updateStation() {
    const ride = this.ride;
    if (ride.refuel) {
      const r = ride.refuel;
      const done = Math.round((1 - r.timeLeft / r.total) * 100);
      const what = r.kind === 'fuel' ? 'Filling up' : r.kind === 'swap' ? 'Swapping battery' : 'The mechanic is working';
      this.stationText.setText(`${what} · ${done}% · ${Math.ceil(r.timeLeft)} s left`).setVisible(true);
      return;
    }
    const offer = ride.stationOffer();
    this.stationText.setVisible(!!offer);
    if (offer) this.stationText.setText(this.isTouch ? offer.text.replace('F: ', 'Tap: ') : offer.text);
  }

  #popup(amount, label) {
    const { width, height } = this.scale.gameSize;
    const s = this.hudScale ?? 1;
    const sign = amount >= 0 ? '+' : '−';
    const text = this.add
      .text(width / 2, height * 0.32 + this.popups.length * 30 * s, `${sign}${Math.abs(amount).toLocaleString('en')} RWF  ${label}`, {
        fontFamily: FONT_LABEL, fontSize: `${Math.round(26 * s)}px`, fontStyle: '600',
        color: amount >= 0 ? '#44bc9d' : '#ec5825', stroke: '#000000', strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.popups.push({ text, life: 2.4 });
  }

  #bark(text) {
    this.barkText.setText(text).setAlpha(1.4);
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

  #button(label, onDown, onUp, size = 34) {
    const circle = this.add.circle(0, 0, size, 0x000000, 0.5).setStrokeStyle(2, 0xffffff, 0.7).setInteractive();
    const text = this.add.text(0, 0, label, { fontFamily: FONT_LABEL, fontSize: `${Math.round(size * 0.6)}px`, fontStyle: '600', color: '#ffffff' }).setOrigin(0.5);
    circle.on('pointerdown', (p) => { p.hitButton = true; onDown(); circle.setFillStyle(0xffffff, 0.3); });
    const up = () => { onUp?.(); circle.setFillStyle(0x000000, 0.5); };
    circle.on('pointerup', up);
    circle.on('pointerout', up);
    return { circle, text, setPosition: (x, y) => { circle.setPosition(x, y); text.setPosition(x, y); } };
  }

  #layoutTouch(width, height) {
    this.goBtn.setPosition(width - 60, height - 80);
    this.stopBtn.setPosition(width - 140, height - 60);
    // Small buttons in a row under the left panel (the right side has the money and jobs).
    const by = 16 + 188 * (this.hudScale ?? 1) + 34;
    [this.hornBtn, this.autoBtn, this.modeBtn, this.bikeBtn, this.resetBtn].forEach((b, i) => b.setPosition(40 + i * 54, by));
    this.upBtn.setPosition(width - 60, height - 165);
    this.downBtn.setPosition(width - 140, height - 140);
  }

  #drawStick() {
    const g = this.stickGfx.clear();
    if (!this.stickPointer) return;
    const s = this.ride.touch.stick;
    g.lineStyle(2, 0xffffff, 0.6).strokeCircle(this.stickBase.x, this.stickBase.y, 60);
    g.fillStyle(0xffffff, 0.5).fillCircle(this.stickBase.x + s.x * 60, this.stickBase.y + s.y * 60, 22);
  }
}
