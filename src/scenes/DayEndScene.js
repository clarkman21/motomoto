import Phaser from 'phaser';
import { INCOME, COSTS } from '../sim/economy.js';
import { GAME_OVER } from '../config.js';
import { dayEndStory, gameOverStory } from '../sim/family.js';
import { drawBicycleTaxi, drawGameOverBackdrop, drawJailCell, BICYCLE_CANVAS, BACKDROP_ROAD } from '../world/bicycle-sprites.js';
import { addCanvasTexture } from './textures.js';
import { wrapRetro, RETRO_CELL } from '../world/retro-font.js';
import { UI, pixelScale, ensureRetroFont, ensureIcons, retroLabel, retroWidth, drawWindow } from './retro-ui.js';

// The day end summary (what you earned, what you spent, your profit), the level up screen and the
// game over screen (you lost the moto and ride a bicycle taxi again), in the same retro 16-bit look as the menus and the HUD: low resolution, the pixel font, blue
// windows, scaled up by a whole number.

const money = (n) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('en')} RWF`;
const LINE = RETRO_CELL.height + 1;

export class DayEndScene extends Phaser.Scene {
  constructor() {
    super('dayEnd');
  }

  create({ summary, onContinue, levelUp }) {
    ensureRetroFont(this);
    ensureIcons(this);
    const { width, height } = this.scale.gameSize;
    const k = (this.k = pixelScale(width, height, 400, 250));
    this.vw = Math.floor(width / k);
    this.vh = Math.floor(height / k);
    this.add.rectangle(0, 0, width, height, 0x060818, 0.6).setOrigin(0);
    this.ui = this.add.container(0, 0).setScale(k);
    this.g = this.add.graphics();
    this.ui.add(this.g);
    if (levelUp) return this.#levelUp(levelUp, onContinue);
    if (summary.gameOver) return this.#gameOver(summary, onContinue);
    this.#summary(summary, onContinue);
  }

  /** Text at (x, y) in the container. Returns the label. */
  #text(x, y, text, tint = UI.white, scale = 1) {
    const t = retroLabel(this, x, y, text, tint, scale);
    this.ui.add(t);
    return t;
  }

  /** Lines of wrapped text from y. Returns the y under the last line. */
  #para(x, y, text, n, tint = UI.white) {
    for (const line of wrapRetro(text, n)) {
      this.#text(x, y, line, tint);
      y += LINE;
    }
    return y;
  }

  #icon(x, y, name) {
    this.ui.add(this.add.image(x, y, 'hud-icons', name).setOrigin(0));
  }

  #summary(summary, onContinue) {
    const W = Math.min(this.vw - 8, 300);
    const x = Math.floor((this.vw - W) / 2);
    const n = Math.floor((W - 20) / RETRO_CELL.width);
    // Measure first (the window is drawn under the text), so draw the text into a list.
    let y = 0;
    const draw = [];
    const T = (dx, dy, text, tint, scale) => draw.push(() => this.#text(x + dx, dy, text, tint, scale));
    T(10, 8, `END OF DAY ${summary.day}`, UI.white, 2);
    const bikeName = summary.bikeType === 'electric' ? 'Electric moto' : 'Petrol moto';
    const offRoad = summary.offRoadKm >= 0.05 ? ` (${summary.offRoadKm.toFixed(1)} off road)` : '';
    y = 30;
    for (const l of wrapRetro(`${bikeName} · ${summary.gameKm.toFixed(1)} km${offRoad} · service ${Math.round(summary.serviceDue * 100)}%`, n)) { T(10, y, l, UI.dim); y += LINE; }
    // The family card: what today's money means at home.
    const story = dayEndStory(summary);
    const cardTop = y + 4;
    y = cardTop + 6;
    draw.push(() => this.#icon(x + 14, cardTop + 6, 'star'));
    T(26, y, story.title, UI.green);
    y += LINE + 2;
    for (const line of story.lines) for (const l of wrapRetro(line, n - 2)) { T(16, y, l, UI.white); y += LINE; }
    const cardH = y - cardTop + 4;
    y += 10;
    // Income and costs.
    const rows = [];
    for (const [key, label] of Object.entries(INCOME)) if (summary.income[key]) rows.push([label, summary.income[key], UI.green]);
    rows.push(['Total income', summary.totalIncome, UI.white, true]);
    for (const [key, label] of Object.entries(COSTS)) if (summary.costs[key]) rows.push([label, -summary.costs[key], UI.red]);
    rows.push(['Total costs', -summary.totalCosts, UI.white, true]);
    for (const [label, value, tint, bold] of rows) {
      const v = money(value);
      T(10, y, label, bold ? UI.white : UI.dim);
      T(W - 10 - retroWidth(v), y, v, tint);
      y += LINE + (bold ? 3 : 0);
    }
    y += 4;
    const p = money(summary.profit);
    T(10, y, 'PROFIT', UI.white, 2);
    T(W - 10 - retroWidth(p, 2), y, p, summary.profit >= 0 ? UI.green : UI.red, 2);
    y += 24;
    // Notes: cash, regen, the savings goal.
    const notes = [`Cash now: ${money(summary.cash)}`];
    if (summary.regenSaved > 0) notes.push(`Regen put back ${Math.round(summary.regenFraction * 100)}% of a battery (about ${money(summary.regenSaved)} saved)`);
    const atOffice = summary.level.buyAt === 'office';
    const ready = summary.milestoneReady && !atOffice; // the electric moto: you buy it at the showroom
    notes.push(summary.milestoneReady && atOffice
      ? `You saved enough for: ${summary.level.milestone}! Tomorrow, ride to the Ampersand showroom on Kacyiru boulevard and press F to buy it.`
      : ready
      ? `You saved enough for: ${summary.level.milestone} (${money(summary.level.goal)}).`
      : `Level ${summary.level.n} goal: ${summary.level.milestone}. Save ${money(summary.savingsTarget)} (goal + ${money(summary.savingsTarget - summary.level.goal)} working money).`);
    if (summary.cash < GAME_OVER.warnBelowCash) notes.push(`Be careful: if your cash is below zero after the rent, or the ${summary.bikeType === 'electric' ? 'battery is empty and you have no cash for a swap' : 'tank is empty and you have no cash for fuel'}, the game is over.`);
    for (const note of notes) {
      const tint = /game is over/i.test(note) ? UI.orange : /saved enough/i.test(note) ? UI.gold : UI.dim;
      for (const l of wrapRetro(note, n)) { T(10, y, l, tint); y += LINE; }
      y += 2;
    }
    const H = y + 6;
    // Place the window in the middle (or at the top when it is tall), then draw. The container moves; the
    // window and the text are relative to its top.
    const top = Math.max(4, Math.floor((this.vh - H - 30) / 2));
    drawWindow(this.g, x, 0, W, H);
    this.g.fillStyle(0x0f3a2a, 0.9).fillRect(x + 8, cardTop, W - 16, cardH);
    this.g.fillStyle(0x7fe0b8, 1).fillRect(x + 8, cardTop, W - 16, 1);
    this.ui.setY(top * this.k);
    for (const d of draw) d();

    // Buttons under the window (a row of choices, like the menus) and their keys.
    const finish = (choice) => {
      this.scene.stop();
      onContinue(choice);
    };
    const by = H + 6;
    if (ready) {
      this.#buttons(by, [['M · BUY THE MILESTONE', () => finish('buy')], ['ENTER · KEEP SAVING', () => finish('next')]]);
      this.input.keyboard.once('keydown-M', () => finish('buy'));
      this.input.keyboard.once('keydown-ENTER', () => finish('next'));
      return;
    }
    const touch = this.sys.game.device.input.touch;
    this.#buttons(by, [[touch ? 'TAP: NEXT DAY' : 'ENTER · NEXT DAY', () => finish('next')], ...(touch ? [] : [['N · NEW GAME', () => finish('newGame')]])]);
    this.input.keyboard.once('keydown-ENTER', () => finish('next'));
    this.input.keyboard.once('keydown-N', () => finish('newGame'));
    this.input.once('pointerdown', (p) => { if (!p.hitButton) finish('next'); });
  }

  /**
   * Game over: why, a picture of you on a bicycle taxi (it moves), the story, what you did in this
   * game, and one choice: start again at level 1.
   */
  #gameOver(summary, onContinue) {
    const W = Math.min(this.vw - 8, 300);
    const x = Math.floor((this.vw - W) / 2);
    const n = Math.floor((W - 20) / RETRO_CELL.width);
    const story = gameOverStory(summary);
    const { career = {}, level } = summary;
    const days = career.days ?? summary.day, earned = money(career.totalIncome ?? summary.totalIncomeAllDays ?? 0);
    // Measure the full text first. On a small screen (a phone), use the short text, so that the button is on the screen.
    const layout = (compact) => {
      const draw = [];
      const T = (dx, dy, text, tint, scale) => draw.push(() => this.#text(x + dx, dy, text, tint, scale));
      const title = 'GAME OVER';
      T(Math.floor((W - retroWidth(title, 2)) / 2), compact ? 6 : 8, title, UI.red, 2);
      let y = compact ? 26 : 30;
      for (const l of wrapRetro(story.reason, n)) { T(10, y, l, UI.gold); y += LINE; }
      y += compact ? 2 : 4;
      const pic = { x: x + 10, y, w: W - 20, h: compact ? BICYCLE_CANVAS.height + 4 : 80 };
      draw.push(() => (summary.gameOver === 'jail' ? this.#jailPicture(pic) : this.#bicyclePicture(pic)));
      y += pic.h + (compact ? 4 : 6);
      const lines = compact ? [story.short] : story.lines;
      for (const line of lines) {
        for (const l of wrapRetro(line, n)) { T(10, y, l, UI.white); y += LINE; }
        y += 2;
      }
      y += 2;
      const stats = compact
        ? [`${days} ${days === 1 ? 'day' : 'days'} on the moto · ${earned} earned · level ${level.n}`]
        : [
            `Days on the moto: ${days}`,
            `Money earned in this game: ${earned}`,
            `You got to level ${level.n}: ${level.name}${career.milestones ? ` (${career.milestones} milestones)` : ''}`,
          ];
      for (const s of stats) for (const l of wrapRetro(s, n)) { T(10, y, l, UI.dim); y += LINE; }
      return { draw, H: y + 6 };
    };
    let { draw, H } = layout(false);
    if (H + LINE + 16 > this.vh) ({ draw, H } = layout(true));
    const top = Math.max(2, Math.floor((this.vh - H - LINE - 14) / 2));
    drawWindow(this.g, x, 0, W, H);
    this.ui.setY(top * this.k);
    for (const d of draw) d();
    const go = () => {
      this.scene.stop();
      onContinue('newGame');
    };
    const touch = this.sys.game.device.input.touch;
    this.#buttons(H + 4, [[touch ? 'TAP: START AGAIN' : 'ENTER · START AGAIN', go]]);
    // A short wait, so that a key that is held down from the ride does not skip the screen.
    this.time.delayedCall(800, () => {
      this.input.keyboard.once('keydown-ENTER', go);
      this.input.once('pointerdown', go);
    });
  }

  /** Jail: you sit in a cell behind bars. Now and then you look up at the window and sigh. */
  #jailPicture(pic) {
    for (const f of [0, 1]) {
      const key = `gameover-jail-${pic.w}x${pic.h}-${f}`;
      if (!this.textures.exists(key)) addCanvasTexture(this, key, drawJailCell(pic.w, pic.h, f));
    }
    const img = this.add.image(pic.x, pic.y, `gameover-jail-${pic.w}x${pic.h}-0`).setOrigin(0);
    const sigh = retroLabel(this, pic.x + Math.floor(pic.w * 0.3) + 10, pic.y + pic.h - 40, '', UI.white);
    this.ui.add([img, sigh]);
    const sound = this.scene.get('ride')?.engineSound;
    let t = 0;
    this.time.addEvent({
      delay: 400, loop: true, callback: () => {
        t += 0.4;
        const up = t % 5 > 3; // head up for 2 s in each 5 s
        img.setTexture(`gameover-jail-${pic.w}x${pic.h}-${up ? 1 : 0}`);
        if (up && t % 5 < 3.5) { sigh.setText('EH...'); sound?.grumble(); }
        else if (!up) sigh.setText('');
      },
    });
  }

  /** The bicycle taxi on the road at dusk. The pedals turn, the road moves and the rider puffs now and then. */
  #bicyclePicture(pic) {
    const frames = GAME_OVER.bicycleFrames;
    const bgKey = `gameover-backdrop-${pic.w}x${pic.h}`;
    if (!this.textures.exists(bgKey)) addCanvasTexture(this, bgKey, drawGameOverBackdrop(pic.w, pic.h));
    for (let f = 0; f < frames; f++) if (!this.textures.exists(`gameover-bicycle-${f}`)) addCanvasTexture(this, `gameover-bicycle-${f}`, drawBicycleTaxi(f, frames));
    const bg = this.add.image(pic.x, pic.y, bgKey).setOrigin(0);
    const dashes = this.add.graphics();
    const roadMid = pic.y + pic.h - BACKDROP_ROAD + 9;
    const bx = pic.x + Math.floor(pic.w * 0.3);
    const bike = this.add.image(bx, pic.y + pic.h - BACKDROP_ROAD + 6 - BICYCLE_CANVAS.groundY, 'gameover-bicycle-0').setOrigin(0);
    const puff = retroLabel(this, bx + 46, bike.y + 2, '', UI.white);
    this.ui.add([bg, dashes, bike, puff]);
    let f = 0, t = 0, nextPuff = 1.5;
    const sound = this.scene.get('ride')?.engineSound;
    this.time.addEvent({
      delay: GAME_OVER.frameMs, loop: true, callback: () => {
        f = (f + 1) % frames;
        t += GAME_OVER.frameMs / 1000;
        bike.setTexture(`gameover-bicycle-${f}`);
        // The road dashes move to the left (the bicycle goes to the right, slowly).
        const off = Math.floor(t * 14) % 16;
        dashes.clear().fillStyle(0xd8d6cc, 1);
        for (let dx = -off; dx < pic.w; dx += 16) {
          const x0 = Math.max(0, dx), x1 = Math.min(pic.w, dx + 8);
          if (x1 > x0) dashes.fillRect(pic.x + x0, roadMid, x1 - x0, 1);
        }
        // Hard work: a puff and a word now and then.
        if (t >= nextPuff) {
          const i = Math.floor(Math.random() * 4);
          puff.setText(['UFF!', 'AAH...', 'OOH!', 'EEH!'][i]);
          sound?.grunt(i);
          nextPuff = t + 2.5 + Math.random() * 2;
        } else if (t > nextPuff - 1.6) puff.setText('');
      },
    });
  }

  /** A row of choices in small windows (relative to the container). */
  #buttons(y, items) {
    const widths = items.map(([label]) => retroWidth(label) + 16);
    const total = widths.reduce((a, b) => a + b, 0) + (items.length - 1) * 8;
    let x = Math.floor((this.vw - total) / 2);
    items.forEach(([label, onTap], i) => {
      const w = widths[i];
      drawWindow(this.g, x, y, w, LINE + 8);
      this.#text(x + 8, y + 4, label, i === 0 ? UI.gold : UI.white);
      const z = this.add.zone(x, y, w, LINE + 8).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', (p) => { p.hitButton = true; onTap(); });
      this.ui.add(z);
      x += w + 8;
    });
  }

  /** After a milestone: what you bought and what the new level brings. */
  #levelUp({ bought, next }, onContinue) {
    const W = Math.min(this.vw - 8, 300);
    const x = Math.floor((this.vw - W) / 2);
    const n = Math.floor((W - 20) / RETRO_CELL.width);
    const draw = [];
    const T = (dy, text, tint, scale = 1) => draw.push(() => this.#text(x + 10, dy, text, tint, scale));
    let y = 8;
    draw.push(() => this.#icon(x + 10, 8, 'star'));
    draw.push(() => this.#text(x + 22, 8, 'MILESTONE REACHED', UI.dim));
    y += LINE + 4;
    for (const l of wrapRetro(bought.milestone, Math.floor(n / 2))) { T(y, l, UI.green, 2); y += 20; }
    if (bought.story) { for (const l of wrapRetro(bought.story, n)) { T(y, l, UI.white); y += LINE; } }
    y += 8;
    for (const l of wrapRetro(`LEVEL ${next.n}: ${next.name}`, Math.floor(n / 2))) { T(y, l, UI.gold, 2); y += 20; }
    for (const l of wrapRetro(next.news ?? '', n)) { T(y, l, UI.dim); y += LINE; }
    y += 4;
    const shift = `${String(next.shift.start).padStart(2, '0')}:00–${String(next.shift.end).padStart(2, '0')}:00`;
    const goal = next.freePlay ? 'Free play: the house is finished. Ride on and keep the fleet busy.' : `Next goal: ${next.milestone} (${money(next.goal)}).`;
    for (const l of wrapRetro(`Shift ${shift} · ${next.rivals} rivals · fares ×${next.fare.toFixed(1)} · petrol ×${next.petrol.toFixed(1)}`, n)) { T(y, l, UI.grey); y += LINE; }
    for (const l of wrapRetro(goal, n)) { T(y, l, UI.grey); y += LINE; }
    const H = y + 6;
    const top = Math.max(4, Math.floor((this.vh - H - 30) / 2));
    drawWindow(this.g, x, 0, W, H);
    this.ui.setY(top * this.k);
    for (const d of draw) d();
    const go = () => {
      this.scene.stop();
      onContinue();
    };
    this.#buttons(H + 6, [[this.sys.game.device.input.touch ? 'TAP TO START' : 'ENTER · START', go]]);
    this.input.keyboard.once('keydown-ENTER', go);
    this.input.once('pointerdown', go);
  }
}
