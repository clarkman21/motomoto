import Phaser from 'phaser';
import { INCOME, COSTS } from '../sim/economy.js';

// The day end summary: what you earned, what you spent, and your profit.

const FONT_BODY = '"Instrument Sans", system-ui, sans-serif';
const FONT_LABEL = '"Barlow Condensed", "Instrument Sans", system-ui, sans-serif';
const money = (n) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en')} RWF`;

export class DayEndScene extends Phaser.Scene {
  constructor() {
    super('dayEnd');
  }

  create({ summary, onContinue }) {
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
    this.add.text(x + 20 * s, y + 16 * s, `End of day ${summary.day}`, { fontFamily: FONT_LABEL, fontSize: `${Math.round(32 * s)}px`, fontStyle: '600', color: '#ffffff' });
    const bikeName = summary.bikeType === 'electric' ? 'Electric moto' : 'Petrol moto';
    this.add.text(x + 20 * s, y + 56 * s, `${bikeName} · ${summary.gameKm.toFixed(1)} km ridden · brake pads ${Math.round(summary.brakePads * 100)}%${summary.padsReplaced ? ' (new)' : ''}`, {
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
    const noteText = this.add.text(x + 20 * s, ly, notes.join('\n'), { fontFamily: FONT_BODY, fontSize: `${Math.round(14 * s)}px`, color: '#d8d8d8', lineSpacing: 4, wordWrap: { width: w - 40 * s } });
    const bottom = ly + noteText.height + 18 * s;
    panel.fillStyle(0x111417, 0.96).fillRoundedRect(x, y, w, bottom - y, 10 * s);
    const prompt = this.sys.game.device.input.touch ? 'Tap to start the next day' : 'Press Enter to start the next day';
    this.add.text(width / 2, Math.min(height - 12, bottom + 22 * s), prompt, { fontFamily: FONT_BODY, fontSize: `${Math.round(15 * s)}px`, color: '#ffffff' }).setOrigin(0.5);

    const go = () => {
      this.scene.stop();
      onContinue();
    };
    this.input.keyboard.once('keydown-ENTER', go);
    this.input.once('pointerdown', go);
  }
}
