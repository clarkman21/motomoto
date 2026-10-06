import { LAW, WORLD } from '../config.js';

// Speed limits and speed cameras. No Phaser here.

/** Speed limit (km/h) and zone at a world point in metres. The lowest limit of all zones that contain the point wins. */
export function speedLimitAt(world, x, y) {
  const tx = x / WORLD.tileMetres;
  const ty = y / WORLD.tileMetres;
  let limitKmh = LAW.defaultLimitKmh;
  let zone = null;
  for (const z of world.zones) {
    if (tx >= z.x0 && tx < z.x1 && ty >= z.y0 && ty < z.y1 && z.limitKmh < limitKmh) {
      limitKmh = z.limitKmh;
      zone = z;
    }
  }
  return { limitKmh, zone };
}

/** One entry per camera: is the bike inside its range now. */
export function createCameraState(world) {
  return world.cameras.map(() => ({ inside: false }));
}

/** The fine for a speed over the limit (0 = no fine). */
export function cameraFine(speedKmh, limitKmh) {
  const over = speedKmh - limitKmh;
  if (over <= LAW.toleranceKmh) return 0;
  return over > LAW.highOverKmh ? LAW.cameraFineHigh : LAW.cameraFine;
}

/**
 * A camera measures the bike once, when the bike comes into its range.
 * Returns events: { type: 'camera', cameraId, speedKmh, limitKmh, fine }.
 */
export function checkCameras(world, state, bike, speedKmh) {
  const events = [];
  world.cameras.forEach((cam, i) => {
    const d = Math.hypot(bike.x - cam.x * WORLD.tileMetres, bike.y - cam.y * WORLD.tileMetres);
    const inside = d < LAW.cameraRadiusMetres;
    if (inside && !state[i].inside) {
      const { limitKmh } = speedLimitAt(world, bike.x, bike.y);
      events.push({ type: 'camera', cameraId: cam.id, speedKmh, limitKmh, fine: cameraFine(speedKmh, limitKmh) });
    }
    state[i].inside = inside;
  });
  return events;
}
