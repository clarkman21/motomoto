import { MODES, DEFAULT_MODE } from '../config.js';

// Difficulty modes: Kigali 2010 (easy), 2015 (medium), 2020 (hard). No Phaser here.

/** The mode of a game: { id, ...MODES[id] }. A save from before the modes is medium. */
export function modeOf(wallet) {
  const id = MODES[wallet?.mode] ? wallet.mode : DEFAULT_MODE;
  return { id, ...MODES[id] };
}

/** The automatic gearbox setting for a mode: true or false when the mode decides, else the player's choice. */
export function forcedAutoShift(mode, choice) {
  if (mode.gears === 'auto') return true;
  if (mode.gears === 'manual') return false;
  return choice;
}

/**
 * Keep only a share of the potholes and loose rocks (easy mode has fewer). Speed bumps always stay.
 * Returns true when the map changed (the ground must be drawn again).
 */
export function setHazardShare(world, share) {
  if (world.hazardShare === share) return false;
  world.hazardShare = share;
  for (const t of world.tiles) {
    if (t.baseHazard === undefined) t.baseHazard = t.hazard;
    if (t.baseHazard !== 'pothole' && t.baseHazard !== 'rocks') continue;
    // A fixed number for each tile, so the same potholes go away each time.
    const r = (((t.tx * 73856093) ^ (t.ty * 19349663)) >>> 0) % 1000 / 1000;
    t.hazard = r < share ? t.baseHazard : null;
  }
  return true;
}
