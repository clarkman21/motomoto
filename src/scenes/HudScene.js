import Phaser from 'phaser';
import { BIKES, COLOURS, GEARBOX, BRAKES } from '../config.js';
import { forwardSpeed } from '../sim/bike.js';
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
    this.brakesLabel.setPosition(x + 186 * s, y + 96 * s);
    this.revsBarPos = { x: x + 14 * s, y: y + 116 * s, w: 156 * s, h: 8 * s };
    this.brakesBarPos = { x: x + 186 * s, y: y + 116 * s, w: 100 * s, h: 8 * s };
    this.infoText.setPosition(x + 14 * s, y + 134 * s);
    this.helpText.setPosition(width / 2, height - 12 * s);
    this.helpText.setText(
      this.isTouch
        ? 'Stick: steer · GO: throttle · STOP: brake · + −: shift'
        : 'W/↑: throttle · S/↓: brake · A D/← →: steer · E/Q: shift · G: auto shift · H: horn · C: steering · B: bike · R: reset · V: sound',
    );
    this.helpText.setVisible(width > 900 || this.isTouch);
    this.barkText.setPosition(width / 2, 24 * s);
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
    this.brakesLabel.setText(`BRAKES ${Math.round(pads * 100)}%`).setColor(pads < BRAKES.warnBelow ? '#ec5825' : ALLOY_GREY);
    const r = this.revsBarPos, k = this.brakesBarPos, m = this.meters.clear();
    m.fillStyle(0x333333, 1).fillRect(r.x, r.y, r.w, r.h).fillRect(k.x, k.y, k.w, k.h);
    if (spec.gears) m.fillStyle(0x5c1c0e, 1).fillRect(r.x + r.w * GEARBOX.peakRevsEnd, r.y, r.w * (1 - GEARBOX.peakRevsEnd), r.h); // red zone
    const revs = Math.min(1, bike.revs);
    m.fillStyle(spec.gears && revs > GEARBOX.peakRevsEnd ? PETROL_RED : 0xf6f5ec, 1).fillRect(r.x, r.y, r.w * revs, r.h);
    m.fillStyle(pads < BRAKES.warnBelow ? PETROL_RED : 0xf6f5ec, 1).fillRect(k.x, k.y, k.w * pads, k.h);

    const grade = Math.round(bike.grade * 100);
    const gradeText = grade === 0 ? 'Flat' : `${grade > 0 ? 'Uphill' : 'Downhill'} ${Math.abs(grade)}%`;
    this.infoText.setText(
      `${gradeText} · ${bike.surface.name}\n${spec.name} [B] · ${STEERING_LABELS[ride.steeringMode]} [C]`,
    );

    if (this.barkText.alpha > 0) this.barkText.setAlpha(Math.max(0, this.barkText.alpha - deltaMs / 1500));
    if (this.isTouch) this.#drawStick();
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
    this.modeBtn.setPosition(width - 40, 40);
    this.bikeBtn.setPosition(width - 95, 40);
    this.resetBtn.setPosition(width - 150, 40);
    this.hornBtn.setPosition(width - 205, 40);
    this.autoBtn.setPosition(width - 260, 40);
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
