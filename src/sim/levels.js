import { LEVELS, SAVINGS_FLOAT, MONEY, JOBS, STREAK, DISTRICTS } from '../config.js';

// Levels: savings goals, milestones and the difficulty of each level. No Phaser here.

export function levelDef(n) {
  return LEVELS[Math.min(n, LEVELS.length) - 1];
}

/** The districts open at a level: the map grows as you go up the levels. */
export function districtsForLevel(n) {
  return Object.entries(DISTRICTS).filter(([, d]) => d.unlockLevel <= n).map(([id]) => id);
}

/** The settings for the wallet's current level, with the effects of milestones you bought. */
export function levelSettings(wallet) {
  const def = levelDef(wallet.level);
  return {
    ...def,
    districts: districtsForLevel(def.n),
    bikeType: wallet.perks.electric ? 'electric' : 'petrol',
    maxOffers: JOBS.maxOffers + (wallet.perks.phone ? 1 : 0),
  };
}

/** Savings needed to buy this level's milestone (the goal plus the working float). */
export function savingsTarget(wallet) {
  return levelDef(wallet.level).goal + SAVINGS_FLOAT;
}

export function milestoneReady(wallet) {
  const def = levelDef(wallet.level);
  return !def.freePlay && wallet.cash >= def.goal + SAVINGS_FLOAT;
}

/** Buy the milestone: the money goes, its effect applies, and the next level starts. Returns the bought level, or null. */
export function buyMilestone(wallet) {
  if (!milestoneReady(wallet)) return null;
  const def = levelDef(wallet.level);
  wallet.cash -= def.goal;
  if (def.effect) wallet.perks[def.effect] = true;
  wallet.milestones.push({ level: def.n, milestone: def.milestone, day: wallet.day });
  wallet.level += 1;
  wallet.streak = 0;
  return def;
}

/**
 * Restart the current level with start cash. Level, perks and milestones stay. The game over does
 * not use it (you start again at level 1); it is for a later "Restart level" choice in the menu.
 */
export function restartLevel(wallet) {
  wallet.cash = MONEY.startCash;
  wallet.streak = 0;
}

/** Fare multiplier from the clean ride streak. */
export function streakMultiplier(wallet) {
  return 1 + (wallet.streak ?? 0);
}

/** A delivery: a clean one adds to the streak, a bad one resets it. */
export function updateStreak(wallet, clean) {
  wallet.streak = clean ? Math.min(STREAK.max - 1, (wallet.streak ?? 0) + STREAK.step) : 0;
}
