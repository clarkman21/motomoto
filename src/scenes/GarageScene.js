import Phaser from 'phaser';
import { COLOURS, SHOP, MAINTENANCE } from '../config.js';
import { RETRO_CELL, retroText, wrapRetro } from '../world/retro-font.js';
import { ensureRetroFont, drawWindow, UI } from './retro-ui.js';
import { garageQuote, serviceDue } from '../sim/maintenance.js';
import { shopItems } from '../sim/shop.js';

// The garage screen, in the retro 16-bit style of the menus (like a shop in a role playing game):
// the service of the moto, then the parts and upgrades for sale, then Leave. The ride scene waits.
// Keyboard: ↑ ↓ to choose, Enter to select, Esc to leave. Mouse and touch: tap a line.

const money = (n) => `${Math.round(n).toLocaleString('en')} RWF`;
const ROW = 11; // virtual pixels between lines

export class GarageScene extends Phaser.Scene {
  constructor() {
    super('garage');
  }

  /** data: { place } (the garage). */
  create({ place }) {
    this.ride = this.scene.get('ride');
    this.place = place;
    this.focus = 0;
    this.top = 0; // the first list line in view (the list scrolls on a small screen)
    this.note = null; // { text, tint }: the result of the last choice
    // The mechanic's line: one for each garage.
    const seed = [...(place?.name ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0);
    this.talk = SHOP.talk[seed % SHOP.talk.length];
    ensureRetroFont(this);
    this.input.keyboard.on('keydown', (e) => this.#key(e));
    this.scale.on('resize', this.#redraw, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.#redraw, this));
    this.#redraw();
  }

  update(time) {
    if (this.cursor) this.cursor.x = this.cursorX + (Math.floor(time / 260) % 2);
  }

  /** The lines of the list: the service, each part, Leave. */
  #rows() {
    const ride = this.ride, bike = ride.bike, wallet = ride.wallet;
    const q = garageQuote(bike);
    const meter = Math.round(serviceDue(bike) * 100);
    const rows = [];
    const credit = bike.brokenDown && wallet.cash < q.cost;
    rows.push({
      kind: 'service',
      label: bike.brokenDown ? 'REPAIR THE BREAKDOWN' : `SERVICE (METER ${meter}%)`,
      right: q.nothing ? 'NOT NEEDED' : money(q.cost),
      rightTint: q.nothing ? UI.grey : wallet.cash >= q.cost || credit ? UI.white : UI.red,
      text: q.nothing
        ? `The moto is fine: the service meter is at ${meter}%.`
        : `${q.items.map((i) => i.name).join(', ')}. ${MAINTENANCE.serviceSeconds} s.${credit ? ' On credit: your cash goes below zero.' : ''}`,
    });
    for (const it of shopItems(wallet, bike.type)) {
      const electric = it.only === 'electric';
      rows.push({
        kind: 'part', item: it,
        label: it.name,
        labelTint: electric ? COLOURS.ampersandYellow : undefined, // Ampersand products in Surge Yellow
        right: it.owned ? 'OWNED' : it.locked ? `LEVEL ${it.level}` : !it.fits ? `${it.only.toUpperCase()} ONLY` : money(it.price),
        rightTint: it.owned ? UI.green : it.locked || !it.fits ? UI.grey : it.canBuy ? UI.white : UI.red,
        text: it.locked ? `Comes to the shop at level ${it.level}. ${it.text}` : it.text,
      });
    }
    rows.push({ kind: 'leave', label: 'LEAVE', right: '', text: 'Back to the road.' });
    return rows;
  }

  #redraw() {
    this.children.removeAll(true);
    this.cursor = null;
    this.lines = [];
    const { width, height } = this.scale.gameSize;
    this.k = Math.max(2, Math.min(6, Math.floor(Math.min(width / 320, height / 200))));
    this.vw = Math.floor(width / this.k);
    this.vh = Math.floor(height / this.k);
    this.add.rectangle(0, 0, width, height, 0x060818, 0.55).setOrigin(0);
    this.ui = this.add.container(Math.floor((width - this.vw * this.k) / 2), Math.floor((height - this.vh * this.k) / 2)).setScale(this.k);
    const g = this.add.graphics();
    this.ui.add(g);
    const rows = (this.rows = this.#rows());
    this.focus = Math.min(this.focus, rows.length - 1);
    const W = Math.min(this.vw - 8, 300);
    const x = Math.floor((this.vw - W) / 2);
    // Title window: the garage name and your cash.
    drawWindow(g, x, 4, W, 22);
    this.#label(x + 8, 8, `${this.place?.sign ?? 'GARAGE'} · PARTS AND SERVICE`, UI.gold);
    const cash = money(this.ride.wallet.cash);
    this.#label(x + W - 8 - retroText(cash).length * RETRO_CELL.width, 16, cash, this.ride.wallet.cash < 0 ? UI.red : UI.white);
    this.#label(x + 8, 16, `LEVEL ${this.ride.wallet.level}`, UI.dim);
    // The list window (it scrolls on a small screen).
    const descH = 34;
    const listTop = 30;
    const visible = Math.max(4, Math.floor((this.vh - listTop - descH - 10) / ROW));
    if (this.focus < this.top) this.top = this.focus;
    if (this.focus >= this.top + visible) this.top = this.focus - visible + 1;
    const shown = rows.slice(this.top, this.top + visible);
    const listH = shown.length * ROW + 8;
    drawWindow(g, x, listTop, W, listH);
    shown.forEach((r, i) => {
      const index = this.top + i;
      const y = listTop + 5 + i * ROW;
      const t = this.#label(x + 16, y, r.label, r.labelTint ?? UI.dim);
      const right = r.right ? this.#label(x + W - 8 - retroText(r.right).length * RETRO_CELL.width, y, r.right, r.rightTint ?? UI.white) : null;
      const zone = this.add.zone(x + 4, y - 2, W - 8, ROW).setOrigin(0).setInteractive({ useHandCursor: true });
      this.ui.add(zone);
      zone.on('pointerover', () => { if (this.focus !== index) { this.focus = index; this.#showFocus(); } });
      zone.on('pointerdown', () => { this.focus = index; this.#select(); });
      this.lines.push({ index, t, right, x: x + 16, y, baseTint: r.labelTint });
    });
    if (this.top > 0) this.#label(x + W - 14, listTop + 1, '↑', UI.grey);
    if (this.top + visible < rows.length) this.#label(x + W - 14, listTop + listH - 8, '↓', UI.grey);
    // The description window: what the focused line does, or the result of the last choice.
    const dy = listTop + listH + 4;
    drawWindow(g, x, dy, W, descH);
    this.desc = { x: x + 8, y: dy + 5, n: Math.floor((W - 16) / RETRO_CELL.width) };
    this.#showFocus();
  }

  #label(x, y, text, tint = UI.white) {
    const t = this.add.bitmapText(x, y, 'retro', retroText(text)).setTint(tint);
    this.ui.add(t);
    return t;
  }

  #showFocus() {
    for (const l of this.lines) l.t.setTint(l.index === this.focus ? UI.white : l.baseTint ?? UI.dim);
    const line = this.lines.find((l) => l.index === this.focus);
    if (!line) return this.#redraw();
    if (!this.cursor) this.cursor = this.#label(0, 0, '▶', UI.gold);
    this.cursorX = line.x - 10;
    this.cursor.setPosition(this.cursorX, line.y);
    // The description text (2 lines), then the mechanic's talk or the result of the last choice.
    for (const t of this.descTexts ?? []) t.destroy();
    const r = this.rows[this.focus];
    const lines = wrapRetro(r.text, this.desc.n).slice(0, 2);
    this.descTexts = lines.map((l, i) => this.#label(this.desc.x, this.desc.y + i * 9, l, UI.white));
    const foot = this.note ?? { text: `MECHANIC: ${this.talk}`, tint: UI.dim };
    this.descTexts.push(this.#label(this.desc.x, this.desc.y + 19, wrapRetro(foot.text, this.desc.n)[0], foot.tint));
  }

  #select() {
    const r = this.rows[this.focus];
    const sound = this.ride.engineSound;
    sound?.start();
    if (r.kind === 'leave') return this.#close();
    if (r.kind === 'service') {
      const res = this.ride.startService();
      if (res.ok) {
        sound?.blip('select');
        return this.#close();
      }
      this.note = { text: res.text, tint: UI.red };
      sound?.blip('move');
      return this.#redraw();
    }
    const res = this.ride.buyPart(r.item.id);
    if (res.ok) {
      sound?.jingle('reward');
      this.note = { text: `BOUGHT: ${r.item.name}!`, tint: UI.green };
    } else {
      sound?.blip('move');
      const why = { owned: 'You have it already.', locked: `It comes at level ${r.item.level}.`, fits: `It fits only a ${r.item.only} moto.`, cash: 'Not enough cash.' }[res.reason] ?? 'Not for sale.';
      this.note = { text: why, tint: UI.red };
    }
    this.#redraw();
  }

  #close() {
    this.ride.closeGarage();
  }

  #key(e) {
    const n = this.rows.length;
    const move = (d) => {
      this.focus = (this.focus + d + n) % n;
      this.note = null;
      this.ride.engineSound?.blip('move');
      this.#redraw();
    };
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': return move(-1);
      case 'ArrowDown': case 'KeyS': case 'Tab':
        e.preventDefault?.();
        return move(1);
      case 'Enter': case 'Space': case 'KeyF': return this.#select();
      case 'Escape': case 'Backspace': return this.#close();
      default: return undefined;
    }
  }
}
