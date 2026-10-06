import { screenDirToHeading, wrapAngle } from '../world/iso.js';
import { forwardSpeed } from './bike.js';

// Two steering models. Milestone 1 tests both. Bike relative is the default.
//
// Bike relative (GTA 1 style): left and right turn the bike, up is throttle,
//   down is brake. Hold down when you stand still to walk the bike backwards.
// Screen relative: push a direction and the bike goes that way on the screen.
//   The arrow keys and WASD give the direction and also open the throttle.
//
// Space is always throttle and Shift is always brake.
//
// raw = {
//   keys: { up, down, left, right, throttle, brake }   (booleans)
//   stick: { x, y, active }   (touch stick, screen space, y down, length 0..1)
//   touchThrottle, touchBrake (booleans)
// }
// Result: { throttle 0..1, brake 0..1, steer -1..1 }

export const STEERING_MODES = ['bike', 'screen'];
export const STEERING_LABELS = { screen: 'Screen relative', bike: 'Bike relative' };

// Snap touch directions to the road axes when they are this close (radians).
const AXIS_SNAP = (12 * Math.PI) / 180;

export function readControls(mode, raw, bike) {
  return mode === 'bike' ? bikeRelative(raw) : screenRelative(raw, bike);
}

function bikeRelative(raw) {
  const k = raw.keys;
  let steer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  if (raw.stick.active) steer += raw.stick.x;
  return {
    steer: Math.max(-1, Math.min(1, steer)),
    throttle: k.up || k.throttle || raw.touchThrottle ? 1 : 0,
    brake: k.down || k.brake || raw.touchBrake ? 1 : 0,
  };
}

function screenRelative(raw, bike) {
  const k = raw.keys;
  let target = null;
  let magnitude = 0;
  const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  const ky = (k.down ? 1 : 0) - (k.up ? 1 : 0);
  if (kx || ky) {
    target = keyboardHeading(kx, ky);
    magnitude = 1;
  } else if (raw.stick.active && Math.hypot(raw.stick.x, raw.stick.y) > 0.25) {
    target = snapToAxes(screenDirToHeading(raw.stick.x, raw.stick.y));
    magnitude = Math.min(1, Math.hypot(raw.stick.x, raw.stick.y));
  }

  let steer = 0, throttle = 0, brake = 0;
  if (target !== null) {
    const diff = wrapAngle(target - bike.heading);
    const v = forwardSpeed(bike);
    if (Math.abs(diff) > 2.4 && v > 2) {
      // The target is behind you: brake first, then turn.
      brake = 1;
      steer = Math.sign(diff);
    } else {
      steer = Math.max(-1, Math.min(1, diff * 3));
      throttle = magnitude * (Math.abs(diff) < 1.6 ? 1 : 0.5);
    }
  }
  if (k.throttle || raw.touchThrottle) throttle = 1;
  if (k.brake || raw.touchBrake) {
    brake = 1;
    throttle = 0;
  }
  return { steer, throttle, brake };
}

/**
 * Keyboard directions follow the isometric grid, so the four diagonals
 * (for example up + right) follow the roads exactly.
 */
export function keyboardHeading(kx, ky) {
  // Up + right is world -y, down + right is world +x.
  return Math.atan2(ky - kx, kx + ky);
}

function snapToAxes(heading) {
  const quarter = Math.PI / 2;
  const nearest = Math.round(heading / quarter) * quarter;
  return Math.abs(wrapAngle(heading - nearest)) < AXIS_SNAP ? nearest : heading;
}
