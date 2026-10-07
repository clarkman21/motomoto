import Phaser from 'phaser';
import { INCOME, COSTS, loanPayment } from '../sim/economy.js';
import { MONEY } from '../config.js';
import { dayEndStory } from '../sim/family.js';
import { wrapRetro, RETRO_CELL } from '../world/retro-font.js';
import { UI, pixelScale, ensureRetroFont, ensureIcons, retroLabel, retroWidth, drawWindow } from './retro-ui.js';

// The day end summary (what you earned, what you spent, your profit) and the level up screen,
// in the same retro 16-bit look as the menus and the HUD: low resolution, the pixel font, blue
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
    if (summary.declinedLoan) this.scene.get('ride').engineSound.jingle('gameOver');
    // Measure first (the window is drawn under the text), so draw the text into a list.
    let y = 0;
    const draw = [];
    const T = (dx, dy, text, tint, scale) => draw.push(() => this.#text(x + dx, dy, text, tint, scale));
    T(10, 8, summary.outOfCash === 'gameOver' ? `GAME OVER · DAY ${summary.day}` : `END OF DAY ${summary.day}`, UI.white, 2);
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
    // Notes: cash, regen, loan, out of cash, the savings goal.
    const notes = [`Cash now: ${money(summary.cash)}`];
    if (summary.regenSaved > 0) notes.push(`Regen put back ${Math.round(summary.regenFraction * 100)}% of a battery (about ${money(summary.regenSaved)} saved)`);
    if (summary.loan) notes.push(`Loan: ${money(summary.loan.payment)} each day, ${summary.loan.daysLeft} days left`);
    const loanOffer = summary.outOfCash === 'loan';
    const gameOver = summary.outOfCash === 'gameOver';
    if (loanOffer) notes.push(`You are out of cash. Take a loan of ${money(MONEY.loan.amount)}? You pay back ${money(loanPayment())} each day for ${MONEY.loan.days} days. You can take only one loan.`);
    if (gameOver) notes.push('GAME OVER. You are out of cash.', `You restart level ${summary.level.n} (${summary.level.name}) with ${money(MONEY.startCash)}. Your earlier milestones stay.`);
    const atOffice = summary.level.buyAt === 'office';
    const ready = summary.milestoneReady && !atOffice; // the electric moto: you buy it at the showroom
    if (!gameOver && !loanOffer) {
      notes.push(summary.milestoneReady && atOffice
        ? `You saved enough for: ${summary.level.milestone}! Tomorrow, ride to the Ampersand showroom on Kacyiru boulevard and press F to buy it.`
        : ready
        ? `You saved enough for: ${summary.level.milestone} (${money(summary.level.goal)}).`
        : `Level ${summary.level.n} goal: ${summary.level.milestone}. Save ${money(summary.savingsTarget)} (goal + ${money(summary.savingsTarget - summary.level.goal)} working money).`);
    }
    for (const note of notes) {
      const tint = /GAME OVER|out of cash/i.test(note) ? UI.red : /saved enough/i.test(note) ? UI.gold : UI.dim;
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
    const restartGameOver = () => this.scene.restart({ summary: { ...summary, outOfCash: 'gameOver', declinedLoan: true }, onContinue });
    const by = H + 6;
    if (loanOffer) {
      this.#buttons(by, [['L · TAKE THE LOAN', () => finish('loan')], ['ENTER · END THE GAME', restartGameOver]]);
      this.input.keyboard.once('keydown-L', () => finish('loan'));
      this.input.keyboard.once('keydown-ENTER', restartGameOver);
      return;
    }
    if (ready) {
      this.#buttons(by, [['M · BUY THE MILESTONE', () => finish('buy')], ['ENTER · KEEP SAVING', () => finish('next')]]);
      this.input.keyboard.once('keydown-M', () => finish('buy'));
      this.input.keyboard.once('keydown-ENTER', () => finish('next'));
      return;
    }
    const choice = gameOver ? 'restart' : 'next';
    const touch = this.sys.game.device.input.touch;
    this.#buttons(by, [[touch ? (gameOver ? 'TAP: RESTART THE LEVEL' : 'TAP: NEXT DAY') : (gameOver ? `ENTER · RESTART LEVEL ${summary.level.n}` : 'ENTER · NEXT DAY'), () => finish(choice)], ...(touch ? [] : [['N · NEW GAME', () => finish('newGame')]])]);
    this.input.keyboard.once('keydown-ENTER', () => finish(choice));
    this.input.keyboard.once('keydown-N', () => finish('newGame'));
    this.input.once('pointerdown', (p) => { if (!p.hitButton) finish(choice); });
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
    const goal = next.freePlay ? 'Free play: the next levels come in the next build.' : `Next goal: ${next.milestone} (${money(next.goal)}).`;
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
