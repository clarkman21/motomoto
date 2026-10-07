import { FAMILY } from '../config.js';

// Story and rewards: what your money means for the rider's family. No Phaser here.

const money = (n) => `${Math.round(n).toLocaleString('en')} RWF`;

/** The biggest family need that an amount pays for, or null. */
export function needFor(amount) {
  let best = null;
  for (const n of FAMILY.needs) if (amount >= n.cost) best = n;
  return best;
}

/** A short line after a delivery: the fare, and what it pays for at home. */
export function deliveryLine(fare) {
  const need = needFor(fare);
  return need ? `+${money(fare)}: that is ${need.text}` : `+${money(fare)} for the family`;
}

/**
 * The family card at the day end: { title, lines }.
 * summary: from endDay (profit, cash, day, outOfCash), plus level and savingsTarget.
 */
export function dayEndStory(summary) {
  const { partner, children } = FAMILY;
  const kids = children.join(' and ');
  const lines = [];
  if (summary.outOfCash) {
    lines.push(`No money for home today, and the bills are not paid. ${partner} is worried.`);
  } else if (summary.profit > 0) {
    const need = needFor(summary.profit);
    lines.push(`You take ${money(summary.profit)} home today.`);
    lines.push(need ? `That pays for ${need.text}. ${pick(summary.day, [`${kids} run to the door when you come home.`, `${partner} smiles: a good day.`, `${children[0]} wants to hear about your passengers.`])}` : `It is a small help. ${partner} says: every franc counts.`);
  } else {
    lines.push(`A hard day: you made a loss of ${money(-summary.profit)}. Nothing for home today.`);
    lines.push(`${partner} says: tomorrow will be better.`);
  }
  if (summary.level && !summary.level.freePlay && summary.savingsTarget) {
    const pct = Math.max(0, Math.min(100, Math.round((summary.cash / summary.savingsTarget) * 100)));
    lines.push(`Savings for ${summary.level.milestone.toLowerCase()}: ${pct}%.`);
  }
  return { title: 'FOR YOUR FAMILY', lines };
}

/**
 * The game over story: { reason, lines, short }. summary.gameOver: 'stranded' (an empty tank or battery and
 * no cash to fill it) or 'cash' (below zero after the rent). You lose the moto and ride a bicycle taxi.
 */
export function gameOverStory(summary) {
  const { partner } = FAMILY;
  const electric = summary.bikeType === 'electric';
  const reason = summary.gameOver === 'stranded'
    ? (electric ? 'The battery is empty, and you have no cash for a swap.' : 'The tank is empty, and you have no cash for fuel.')
    : `You cannot pay the rent for the moto. Your cash is −${money(-summary.cash)}.`;
  return {
    reason,
    lines: [
      'The owner takes the moto back.',
      'Now you ride a bicycle taxi again: an igare with a soft seat on the back. You pedal your passengers up the hills of Kigali. It is slow and hard, and the fares are small.',
      `${partner} says: we start again. One fare at a time, we save for a moto.`,
    ],
    // For small screens: the same story in one line.
    short: 'The owner takes the moto back. Now you pedal a bicycle taxi up the hills again. Start again!',
  };
}

const pick = (seed, list) => list[Math.abs(seed) % list.length];
