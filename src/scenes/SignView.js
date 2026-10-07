import { WORLD } from '../config.js';
import { BUILDING_STYLES } from '../world/world.js';
import { toScreen } from '../world/iso.js';
import { drawBuildingSign } from '../world/garage-sprites.js';
import { addCanvasTexture } from './textures.js';

// The names on landmark buildings: big letters on the roof of a tower (lit at night), and a
// blue board on the front wall of a government office, a school or a market.

export class SignView {
  constructor(scene, world) {
    const T = WORLD.tileMetres, L = WORLD.levelMetres;
    for (const lm of world.landmarks) {
      if (!lm.sign) continue;
      const blocks = world.blocks.filter((b) => b.tx >= lm.x0 && b.tx <= lm.x1 && b.ty >= lm.y0 && b.ty <= lm.y1);
      if (!blocks.length) continue;
      const top = Math.max(...blocks.map((b) => b.topLevel));
      const roof = BUILDING_STYLES[lm.style] === 'tower';
      const sign = drawBuildingSign(lm.sign, lm.sign2 ?? '', roof ? 'roof' : 'wall');
      const key = `sign-${lm.x0}-${lm.y0}`;
      if (!scene.textures.exists(key)) addCanvasTexture(scene, key, sign.canvas);
      // A tower: on the roof near the front edge. Others: on the front (south) wall, under the roof edge.
      const wx = ((lm.x0 + lm.x1 + 1) / 2) * T;
      const wy = roof ? (lm.y1 + 0.8) * T : (lm.y1 + 1) * T;
      const z = (roof ? top : top - 0.3) * L;
      const p = toScreen(wx, wy, z);
      const img = scene.add.image(p.x, p.y, key)
        .setOrigin(sign.groundX / sign.canvas.width, sign.groundY / sign.canvas.height)
        .setDepth(roof ? lm.x1 + lm.y1 + 2.2 : (lm.x0 + lm.x1 + 1) / 2 + lm.y1 + 1.6);
      if (roof) {
        img.noAmbient = true; // the tower names shine at night (you see them from far away)
        // The roof is far up: a second sign over the entrance, so you can read the name near the tower.
        const door = drawBuildingSign(lm.sign, lm.sign2 ?? '', 'wall');
        const doorKey = `${key}-door`;
        if (!scene.textures.exists(doorKey)) addCanvasTexture(scene, doorKey, door.canvas);
        const base = Math.min(...blocks.map((b) => b.floorLevel ?? b.baseLevel));
        const q = toScreen(wx, (lm.y1 + 1) * T, (base + 2.6) * L);
        scene.add.image(q.x, q.y, doorKey)
          .setOrigin(door.groundX / door.canvas.width, door.groundY / door.canvas.height)
          .setDepth((lm.x0 + lm.x1 + 1) / 2 + lm.y1 + 1.6);
      }
    }
  }
}
