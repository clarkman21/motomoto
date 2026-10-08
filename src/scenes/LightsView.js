import Phaser from 'phaser';
import { WORLD, LIGHTS, COLOURS } from '../config.js';
import { toScreen } from '../world/iso.js';
import { bikeFrameForHeading, BIKE_DIRECTIONS } from '../world/sprites.js';
import {
  drawLightPool, drawHeadlightCone, headlightCanvasSize, drawLightDot, drawLampPost, lampHeadOffset, LAMP_CANVAS,
} from '../world/light-sprites.js';
import { addCanvasTexture } from './textures.js';
import { vehicleBounce } from './TrafficView.js';

// Night lights and the colour of the day. The scene calls update() each frame with the hour.
// - The night tint multiplies the colour of every world sprite (dark blue at night, warm at sunset).
// - Light sprites use additive blending and are not tinted: street lamps with a pool of light on
//   the ground, lit station walls, headlight cones, head lights and tail lights.
// The alpha of every light is `night` (0 in the day, 1 at full night).

const GROUND_LIGHT_DEPTH = -9000; // above all terrain chunks, below every sprite
const LIGHT_HEIGHT = { car: 0.7, bus: 1.0, truck: 1.2, moto: 1.0 }; // metres above the ground
const ADD = Phaser.BlendModes.ADD;

export class LightsView {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.night = 0;
    this.tint = 0xffffff;
    this.#makeTextures();
    const light = (key, depth) => {
      const img = scene.add.image(0, 0, key).setBlendMode(ADD).setDepth(depth).setVisible(false);
      img.noAmbient = true;
      return img;
    };
    this.light = light;

    // Street lamps: the post (tinted like the world), the lamp head and the pool on the ground.
    const T = WORLD.tileMetres;
    const ox = LAMP_CANVAS.groundX / LAMP_CANVAS.width, oy = LAMP_CANVAS.groundY / LAMP_CANVAS.height;
    this.lamps = world.lamps.map((l) => {
      const z = world.heightAt(l.x * T, l.y * T);
      const s = toScreen(l.x * T, l.y * T, z);
      const head = lampHeadOffset(l.side);
      const post = scene.add.image(s.x, s.y, `lamp-${l.side}`).setOrigin(ox, oy).setDepth(l.x + l.y);
      const dot = light('dot-lamp', l.x + l.y + 0.01).setPosition(s.x + head.x, s.y + head.y);
      // The pool is on the ground under the lamp head, a little over the road.
      const top = (LIGHTS.lampHeightMetres / WORLD.levelMetres) * WORLD.levelPx;
      const pool = light('pool-lamp', GROUND_LIGHT_DEPTH).setPosition(s.x + head.x, s.y + head.y + top);
      return { post, dot, pool, x: s.x, y: s.y };
    });
    // Stations shine at night: a pool of light in front of each.
    this.stations = [];
    for (const tag of ['fuel', 'swap', 'garage']) {
      for (const p of world.placesWithTag(tag)) {
        const s = toScreen(p.x * T, p.y * T, world.heightAt(p.x * T, p.y * T));
        this.stations.push({ pool: light(`pool-${tag === 'swap' ? 'swap' : 'station'}`, GROUND_LIGHT_DEPTH).setPosition(s.x, s.y), x: s.x, y: s.y });
      }
    }
    // The player's bike.
    this.bikeLights = this.#vehicleLights('moto');
    this.vehicles = new Map();
  }

  #makeTextures() {
    const scene = this.scene;
    if (scene.textures.exists('headlights')) return;
    addCanvasTexture(scene, 'pool-lamp', drawLightPool(LIGHTS.poolRadiusMetres, LIGHTS.poolColour, LIGHTS.poolAlpha));
    addCanvasTexture(scene, 'pool-station', drawLightPool(LIGHTS.stationPoolRadiusMetres, 0xfff0d8, 110));
    addCanvasTexture(scene, 'pool-swap', drawLightPool(LIGHTS.stationPoolRadiusMetres, COLOURS.ampersandYellow, 120));
    addCanvasTexture(scene, 'dot-lamp', drawLightDot(4, LIGHTS.lampHeadColour));
    addCanvasTexture(scene, 'dot-head', drawLightDot(2, LIGHTS.headDotColour));
    addCanvasTexture(scene, 'dot-tail', drawLightDot(1, LIGHTS.tailDotColour));
    for (const side of ['north', 'south', 'west', 'east']) addCanvasTexture(scene, `lamp-${side}`, drawLampPost(side));
    // 16 headlight cones in one texture, one frame per heading.
    const { width, height } = headlightCanvasSize();
    const tex = scene.textures.createCanvas('headlights', width * BIKE_DIRECTIONS, height);
    for (let f = 0; f < BIKE_DIRECTIONS; f++) {
      const c = drawHeadlightCone(f);
      tex.context.putImageData(new ImageData(c.data, c.width, c.height), f * width, 0);
      tex.add(`cone-${f}`, 0, f * width, 0, width, height);
    }
    tex.refresh();
  }

  /** Light sprites for one vehicle: a cone on the ground, head lights and tail lights. */
  #vehicleLights(kind) {
    const pairs = kind === 'moto' ? 1 : 2;
    const cone = this.light('headlights', GROUND_LIGHT_DEPTH + 1).setFrame('cone-0');
    const heads = Array.from({ length: pairs }, () => this.light('dot-head', 0));
    const tails = Array.from({ length: pairs }, () => this.light('dot-tail', 0));
    return { kind, cone, heads, tails };
  }

  /** Make light sprites for a new set of traffic (after a level change). */
  setTraffic(traffic) {
    for (const l of this.vehicles.values()) this.#destroyLights(l);
    this.vehicles.clear();
    for (const v of [...traffic.vehicles, ...(traffic.dormant ?? [])]) if (v.kind !== 'cyclist') this.vehicles.set(v.id, this.#vehicleLights(v.kind)); // bicycles have no lights
    this.traffic = traffic;
  }

  #destroyLights(l) {
    l.cone.destroy();
    for (const d of [...l.heads, ...l.tails]) d.destroy();
  }

  #hideLights(l) {
    l.cone.setVisible(false);
    for (const d of [...l.heads, ...l.tails]) d.setVisible(false);
  }

  /**
   * Place the lights of one vehicle. v: { x, y, z?, heading, length, width }. braking: brighter tail lights.
   * lift: pixels up (the vehicle jumps on a bump). The lights use the heading of the sprite (one of 16
   * directions), not the exact heading: so they stay on the vehicle when it turns.
   */
  #placeLights(l, v, z, braking, lift = 0) {
    const night = this.night;
    const s = toScreen(v.x, v.y, z);
    const depth = (v.x + v.y) / WORLD.tileMetres;
    const frame = bikeFrameForHeading(v.heading);
    l.cone.setFrame(`cone-${frame}`).setPosition(s.x, s.y).setAlpha(night).setVisible(true);
    const heading = (frame / BIKE_DIRECTIONS) * Math.PI * 2;
    const c = Math.cos(heading), sn = Math.sin(heading);
    const half = (v.length ?? 2) / 2;
    const side = l.heads.length > 1 ? (v.width ?? 1) / 2 - 0.3 : 0;
    const h = LIGHT_HEIGHT[l.kind] ?? 1;
    const put = (dot, along, across, alpha) => {
      const wx = v.x + c * along - sn * across, wy = v.y + sn * along + c * across;
      const p = toScreen(wx, wy, z + h);
      // A light on the far side of the vehicle is behind its sprite.
      const d = (wx + wy) / WORLD.tileMetres > depth ? depth + 0.005 : depth - 0.005;
      dot.setPosition(p.x, p.y - lift).setDepth(d).setAlpha(alpha).setVisible(alpha > 0.02);
    };
    l.heads.forEach((dot, i) => put(dot, half, l.heads.length > 1 ? (i ? side : -side) : 0, night));
    const tail = Math.max(night * 0.7, braking ? 0.9 : 0);
    l.tails.forEach((dot, i) => put(dot, -half, l.tails.length > 1 ? (i ? side : -side) : 0, tail));
  }

  /** Multiply the colour of all world sprites by the tint (lights and markers are not tinted). */
  #applyTint(tint) {
    for (const obj of this.scene.children.list) {
      if (obj.noAmbient || !obj.setTint) continue;
      if (tint === 0xffffff) obj.clearTint();
      else obj.setTint(tint);
    }
    const bg = Phaser.Display.Color.IntegerToColor(0x1d2a33);
    const t = Phaser.Display.Color.IntegerToColor(tint);
    this.scene.cameras.main.setBackgroundColor(Phaser.Display.Color.GetColor((bg.red * t.red) / 255, (bg.green * t.green) / 255, (bg.blue * t.blue) / 255));
  }

  /**
   * Call each frame. light: the result of daylight(hour). view: the camera world view.
   * bike: the player's bike (braking: is the brake on).
   */
  update(light, view, bike, braking) {
    this.night = light.night;
    const count = this.scene.children.list.length;
    // New sprites (chunks, puffs) come in all the time, so apply the tint again when the list changes.
    // In full daylight nothing is tinted, and new sprites start untinted: no pass is needed.
    const allDay = light.tint === 0xffffff && this.tint === 0xffffff;
    if (!allDay && (light.tint !== this.tint || count !== this.tintCount || --this.tintTimer <= 0)) {
      this.tint = light.tint;
      this.tintCount = count;
      this.tintTimer = 30;
      this.#applyTint(light.tint);
    }
    const on = this.night > 0.01;
    const m = 140;
    const inView = (x, y) => x > view.x - m && x < view.right + m && y > view.y - m && y < view.bottom + m;
    for (const l of this.lamps) {
      const show = on && inView(l.x, l.y);
      l.dot.setVisible(show).setAlpha(this.night);
      l.pool.setVisible(show).setAlpha(this.night);
    }
    for (const st of this.stations) st.pool.setVisible(on && inView(st.x, st.y)).setAlpha(this.night);

    if (on || braking) this.#placeLights(this.bikeLights, { x: bike.x, y: bike.y, heading: bike.heading, length: 1.9 }, bike.z, braking);
    else this.#hideLights(this.bikeLights);
    if (!on) this.bikeLights.cone.setVisible(false);

    for (const v of this.traffic?.vehicles ?? []) {
      const l = this.vehicles.get(v.id);
      if (!l) continue;
      const z = this.world.heightAt(v.x, v.y);
      const s = toScreen(v.x, v.y, z);
      if (!on || !inView(s.x, s.y)) {
        this.#hideLights(l);
        continue;
      }
      this.#placeLights(l, v, z, v.speed < 0.5, vehicleBounce(v));
    }
  }
}
