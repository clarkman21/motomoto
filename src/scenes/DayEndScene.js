import Phaser from 'phaser';
import { INCOME, COSTS, loanPayment } from '../sim/economy.js';
import { MONEY } from '../config.js';

// The day end summary: what you earned, what you spent, and your profit.

const FONT_BODY = '"Instrument Sans", system-ui, sans-serif';
const FONT_LABEL = '"Barlow Condensed", "Instrument Sans", system-ui, sans-serif';
const money = (n) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en')} RWF`;

export class DayEndScene extends Phaser.Scene {
  constructor() {
    super('dayEnd');
  }

  create({ summary, onContinue, levelUp }) {
    if (levelUp) return this.#levelUp(levelUp, onContinue);
    const { width, height } = this.scale.gameSize;
    const s = height < 560 ? 0.72 : 1;
    const w = Math.min(width - 32, 460 * s);
    const lines = [];
    for (const [k, label] of Object.entries(INCOME)) if (summary.income[k]) lines.push([label, summary.income[k], '#44bc9d']);
    lines.push(['Total income', summary.totalIncome, '#ffffff', true]);
    for (const [k, label] of Object.entries(COSTS)) if (summary.costs[k]) lines.push([label, -summary.costs[k], '#ec5825']);
    lines.push(['Total costs', -summary.totalCosts, '#ffffff', true]);
    const rowH = 22 * s;
    const h = (150 + lines.length * 22 + 70) * s;
    const x = (width - w) / 2, y = Math.max(8, (height - h) / 2);

    this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0);
    const panel = this.add.graphics(); // filled at the end, when the content height is known
    this.add.text(x + 20 * s, y + 16 * s, summary.outOfCash === 'gameOver' ? `Game over · day ${summary.day}` : `End of day ${summary.day}`, { fontFamily: FONT_LABEL, fontSize: `${Math.round(32 * s)}px`, fontStyle: '600', color: '#ffffff' });
    const bikeName = summary.bikeType === 'electric' ? 'Electric moto' : 'Petrol moto';
    const offRoad = summary.offRoadKm >= 0.05 ? ` (${summary.offRoadKm.toFixed(1)} off road)` : '';
    this.add.text(x + 20 * s, y + 56 * s, `${bikeName} · ${summary.gameKm.toFixed(1)} km ridden${offRoad} · service meter ${Math.round(summary.serviceDue * 100)}% · brake pads ${Math.round(summary.brakePads * 100)}%`, {
      fontFamily: FONT_BODY, fontSize: `${Math.round(14 * s)}px`, color: '#9e9e9e', wordWrap: { width: w - 40 * s },
    });
    let ly = y + 92 * s;
    for (const [label, value, colour, bold] of lines) {
      const style = { fontFamily: FONT_BODY, fontSize: `${Math.round(15 * s)}px`, color: bold ? '#ffffff' : '#d8d8d8', fontStyle: bold ? '600' : '400' };
      this.add.text(x + 20 * s, ly, label, style);
      this.add.text(x + w - 20 * s, ly, money(value), { ...style, color: colour }).setOrigin(1, 0);
      ly += rowH;
    }
    ly += 8 * s;
    const profitColour = summary.profit >= 0 ? '#44bc9d' : '#ec5825';
    this.add.text(x + 20 * s, ly, 'Profit', { fontFamily: FONT_LABEL, fontSize: `${Math.round(26 * s)}px`, fontStyle: '600', color: '#ffffff' });
    this.add.text(x + w - 20 * s, ly, money(summary.profit), { fontFamily: FONT_LABEL, fontSize: `${Math.round(26 * s)}px`, fontStyle: '600', color: profitColour }).setOrigin(1, 0);
    ly += 34 * s;
    const notes = [`Cash now: ${money(summary.cash)}`];
    if (summary.regenSaved > 0) notes.push(`Regen put back ${Math.round(summary.regenFraction * 100)}% of a battery (about ${money(summary.regenSaved)} saved)`);
    if (summary.loan) notes.push(`Loan: ${money(summary.loan.payment)} each day, ${summary.loan.daysLeft} days left`);
    // Out of cash: a choice (loan or game over), or game over.
    const loanOffer = summary.outOfCash === 'loan';
    const gameOver = summary.outOfCash === 'gameOver';
    if (loanOffer) {
      notes.push('', `You are out of cash. Take a loan of ${money(MONEY.loan.amount)}? You pay back ${money(loanPayment())} each day for ${MONEY.loan.days} days. You can take only one loan.`);
    }
    if (gameOver) {
      notes.push('', `GAME OVER. You are out of cash.`, `You restart level ${summary.level.n} (${summary.level.name}) with ${money(MONEY.startCash)}. Your earlier milestones stay.`);
    }
    const ready = summary.milestoneReady;
    if (!gameOver && !loanOffer) {
      notes.push(ready
        ? `You saved enough for: ${summary.level.milestone} (${money(summary.level.goal)}).`
        : `Level ${summary.level.n} goal: ${summary.level.milestone}. Save ${money(summary.savingsTarget)} (goal + ${money(summary.savingsTarget - summary.level.goal)} working money).`);
    }
    const noteText = this.add.text(x + 20 * s, ly, notes.join('\n'), { fontFamily: FONT_BODY, fontSize: `${Math.round(14 * s)}px`, color: '#d8d8d8', lineSpacing: 4, wordWrap: { width: w - 40 * s } });
    const bottom = ly + noteText.height + 18 * s;
    panel.fillStyle(0x111417, 0.96).fillRoundedRect(x, y, w, bottom - y, 10 * s);
    const finish = (choice) => {
      this.scene.stop();
      onContinue(choice);
    };
    const promptY = Math.min(height - 24 * s, bottom + 26 * s);
    if (loanOffer) {
      // Two buttons: take the loan, or end the game.
      this.#button(width / 2 - 120 * s, promptY, 'L · Take the loan', s, () => finish('loan'));
      this.#button(width / 2 + 120 * s, promptY, 'Enter · End the game', s, () => this.scene.restart({ summary: { ...summary, outOfCash: 'gameOver' }, onContinue }));
      this.input.keyboard.once('keydown-L', () => finish('loan'));
      this.input.keyboard.once('keydown-ENTER', () => this.scene.restart({ summary: { ...summary, outOfCash: 'gameOver' }, onContinue }));
      return;
    }
    if (ready) {
      // Buy the milestone now, or keep saving.
      this.#button(width / 2 - 130 * s, promptY, 'M · Buy the milestone', s, () => finish('buy'));
      this.#button(width / 2 + 130 * s, promptY, 'Enter · Keep saving', s, () => finish('next'));
      this.input.keyboard.once('keydown-M', () => finish('buy'));
      this.input.keyboard.once('keydown-ENTER', () => finish('next'));
      return;
    }
    const choice = gameOver ? 'restart' : 'next';
    const label = gameOver ? `restart level ${summary.level.n}` : 'start the next day';
    const prompt = this.sys.game.device.input.touch ? `Tap to ${label}` : `Press Enter to ${label} · N: new game`;
    this.add.text(width / 2, promptY, prompt, { fontFamily: FONT_BODY, fontSize: `${Math.round(15 * s)}px`, color: '#ffffff' }).setOrigin(0.5);
    this.input.keyboard.once('keydown-ENTER', () => finish(choice));
    this.input.keyboard.once('keydown-N', () => finish('newGame'));
    this.input.once('pointerdown', (p) => { if (!p.hitButton) finish(choice); });
  }

  /** After a milestone: what you bought and what the new level brings. */
  #levelUp({ bought, next }, onContinue) {
    const { width, height } = this.scale.gameSize;
    const s = height < 560 ? 0.72 : 1;
    const w = Math.min(width - 32, 480 * s);
    const x = (width - w) / 2;
    this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0);
    const panel = this.add.graphics();
    let y = height * 0.18;
    const top = y;
    const text = (str, size, colour, font = FONT_BODY, weight = '400') => {
      const t = this.add.text(x + 22 * s, y, str, { fontFamily: font, fontSize: `${Math.round(size * s)}px`, fontStyle: weight, color: colour, wordWrap: { width: w - 44 * s }, lineSpacing: 4 });
      y += t.height + 10 * s;
      return t;
    };
    y += 16 * s;
    text('MILESTONE REACHED', 14, '#9e9e9e', FONT_LABEL);
    text(bought.milestone, 26, '#44bc9d', FONT_LABEL, '600');
    y += 8 * s;
    text(`Level ${next.n}: ${next.name}`, 34, '#ffffff', FONT_LABEL, '600');
    text(next.news, 15, '#d8d8d8');
    const shift = `${String(next.shift.start).padStart(2, '0')}:00–${String(next.shift.end).padStart(2, '0')}:00`;
    const goal = next.freePlay ? 'Free play: the next levels come in the next build.' : `Next goal: ${next.milestone} (${money(next.goal)}).`;
    text(`Shift ${shift} · ${next.rivals} rivals · fares ×${next.fare.toFixed(1)} · petrol ×${next.petrol.toFixed(1)}\n${goal}`, 14, '#9e9e9e');
    panel.fillStyle(0x111417, 0.96).fillRoundedRect(x, top, w, y - top + 8 * s, 10 * s);
    const prompt = this.sys.game.device.input.touch ? 'Tap to start' : 'Press Enter to start';
    this.add.text(width / 2, y + 30 * s, prompt, { fontFamily: FONT_BODY, fontSize: `${Math.round(15 * s)}px`, color: '#ffffff' }).setOrigin(0.5);
    const go = () => {
      this.scene.stop();
      onContinue();
    };
    this.input.keyboard.once('keydown-ENTER', go);
    this.input.once('pointerdown', go);
  }

  #button(x, y, label, s, onTap) {
    const t = this.add
      .text(x, y, label, { fontFamily: FONT_BODY, fontSize: `${Math.round(15 * s)}px`, fontStyle: '600', color: '#ffffff', backgroundColor: '#2a3036', padding: { x: 14, y: 8 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    t.on('pointerdown', (p) => { p.hitButton = true; onTap(); });
    return t;
  }
}
