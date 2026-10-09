import { SHOP } from '../config.js';
import { spend } from './economy.js';

// Parts and upgrades at the garages. No Phaser here. wallet.parts lists the ids of the parts you own.

const NONE = { wear: 1, rough: 1, comfortHit: 1, fragile: 1, crash: 1, fuel: 1, regen: 1, wetGrip: 0, tipExtra: 0, longTripTip: 0 };

/** True when a part works on this moto type (petrol engine parts do not move to the electric moto). */
export const fitsBike = (item, bikeType) => !item.only || item.only === bikeType;

/** The shop list for the wallet: each item with { owned, locked (level too low), fits, canBuy }. */
export function shopItems(wallet, bikeType) {
  const owned = new Set(wallet.parts ?? []);
  return SHOP.items.map((item) => {
    const isOwned = owned.has(item.id);
    const locked = wallet.level < item.level;
    const fits = fitsBike(item, bikeType);
    return { ...item, owned: isOwned, locked, fits, canBuy: !isOwned && !locked && fits && wallet.cash >= item.price };
  });
}

/** Buy a part. Returns { ok, reason: 'owned' | 'locked' | 'fits' | 'cash' | 'unknown' }. */
export function buyPart(wallet, id, bikeType) {
  const item = shopItems(wallet, bikeType).find((i) => i.id === id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (item.owned) return { ok: false, reason: 'owned' };
  if (item.locked) return { ok: false, reason: 'locked' };
  if (!item.fits) return { ok: false, reason: 'fits' };
  if (wallet.cash < item.price) return { ok: false, reason: 'cash' };
  spend(wallet, 'parts', item.price);
  wallet.parts = [...(wallet.parts ?? []), id];
  return { ok: true, item };
}

/** The combined effects of the parts you own that fit this moto. Factors multiply; extras add. */
export function partEffects(wallet, bikeType) {
  const out = { ...NONE };
  const owned = new Set(wallet.parts ?? []);
  for (const item of SHOP.items) {
    if (!owned.has(item.id) || !fitsBike(item, bikeType)) continue;
    for (const [k, v] of Object.entries(item.effect)) {
      if (k === 'wetGrip' || k === 'tipExtra' || k === 'longTripTip') out[k] += v;
      else out[k] *= v;
    }
  }
  return out;
}

/** The extra tip from parts for a delivered passenger job (a share of the fare, times the comfort). */
export function partsTip(job, effects) {
  if (job.type !== 'passenger') return 0;
  const share = effects.tipExtra + (job.gameKm > SHOP.longTripKm ? effects.longTripTip : 0);
  return Math.round((job.pay * share * (job.comfort / 100)) / 10) * 10;
}
