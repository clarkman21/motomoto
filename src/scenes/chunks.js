import { WORLD } from '../config.js';
import { renderTerrain } from '../world/terrain-render.js';
import { drawBlock } from '../world/sprites.js';
import { addCanvasTexture } from './textures.js';

// Streams the map in chunks of tiles: the ground image and the block sprites (buildings,
// trees) of the chunks near the bike. A big map would use too much GPU memory if all of it
// were loaded at once.

const CHUNK = 24; // tiles per side
const KEEP = 1; // chunks within this distance must be loaded now
const PRELOAD = 2; // chunks within this distance load in the background, one per frame

export class ChunkStreamer {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunks = new Map(); // key -> { terrain, blocks: [...] }
    this.cols = Math.ceil(world.width / CHUNK);
    this.rows = Math.ceil(world.height / CHUNK);
  }

  /** All loaded block sprites: { img, canvas, depth, block }. */
  get blockSprites() {
    const out = [];
    for (const c of this.chunks.values()) out.push(...c.blocks);
    return out;
  }

  /** Hide sprites outside the camera view (with a margin), so the GPU draws only what you can see. */
  cull(view) {
    const m = 64;
    const x0 = view.x - m, y0 = view.y - m, x1 = view.right + m, y1 = view.bottom + m;
    for (const c of this.chunks.values()) {
      for (const b of c.blocks) {
        const img = b.img;
        img.setVisible(img.x < x1 && img.x + img.width > x0 && img.y < y1 && img.y + img.height > y0);
      }
      const t = c.terrain;
      t.setVisible(t.x < x1 && t.x + t.width > x0 && t.y < y1 && t.y + t.height > y0);
    }
  }

  /** Call each frame with the bike position in metres. */
  update(x, y) {
    const cx = Math.floor(x / WORLD.tileMetres / CHUNK);
    const cy = Math.floor(y / WORLD.tileMetres / CHUNK);
    let preloaded = false;
    for (let dy = -PRELOAD; dy <= PRELOAD; dy++) {
      for (let dx = -PRELOAD; dx <= PRELOAD; dx++) {
        const kx = cx + dx, ky = cy + dy;
        if (kx < 0 || ky < 0 || kx >= this.cols || ky >= this.rows || this.chunks.has(`${kx},${ky}`)) continue;
        const near = Math.max(Math.abs(dx), Math.abs(dy)) <= KEEP;
        if (near || !preloaded) {
          this.#load(kx, ky);
          if (!near) preloaded = true;
        }
      }
    }
    for (const [key, chunk] of this.chunks) {
      const [kx, ky] = key.split(',').map(Number);
      if (Math.max(Math.abs(kx - cx), Math.abs(ky - cy)) > PRELOAD) this.#unload(key, chunk);
    }
  }

  #load(kx, ky) {
    const area = { tx0: kx * CHUNK, ty0: ky * CHUNK, tx1: Math.min(this.world.width, (kx + 1) * CHUNK), ty1: Math.min(this.world.height, (ky + 1) * CHUNK) };
    const key = `${kx},${ky}`;
    const terrainKey = `terrain-${key}`;
    const pc = renderTerrain(this.world, area);
    addCanvasTexture(this.scene, terrainKey, pc);
    // Ground chunks sort among themselves (back to front), always below every sprite.
    const terrain = this.scene.add.image(pc.ox, pc.oy, terrainKey).setOrigin(0).setDepth(-10000 + kx + ky);
    // All blocks of the chunk go into one texture atlas, so the GPU can draw them in a few batches.
    const items = [];
    for (const block of this.world.blocks) {
      if (block.tx < area.tx0 || block.tx >= area.tx1 || block.ty < area.ty0 || block.ty >= area.ty1) continue;
      const { canvas, depth } = drawBlock(block, this.world);
      items.push({ block, canvas, depth });
    }
    const atlasKey = `blocks-${key}`;
    const blocks = [];
    if (items.length) {
      const { width, height, places } = packShelves(items.map((i) => i.canvas));
      const tex = this.scene.textures.createCanvas(atlasKey, width, height);
      items.forEach((item, i) => {
        const p = places[i];
        tex.context.putImageData(new ImageData(item.canvas.data, item.canvas.width, item.canvas.height), p.x, p.y);
        tex.add(`b${i}`, 0, p.x, p.y, item.canvas.width, item.canvas.height);
      });
      tex.refresh();
      items.forEach((item, i) => {
        const img = this.scene.add.image(item.canvas.ox, item.canvas.oy, atlasKey, `b${i}`).setOrigin(0).setDepth(item.depth);
        blocks.push({ img, canvas: item.canvas, depth: item.depth, block: item.block });
      });
    }
    this.chunks.set(key, { terrain, terrainKey, atlasKey: items.length ? atlasKey : null, blocks });
  }

  #unload(key, chunk) {
    chunk.terrain.destroy();
    this.scene.textures.remove(chunk.terrainKey);
    for (const b of chunk.blocks) b.img.destroy();
    if (chunk.atlasKey) this.scene.textures.remove(chunk.atlasKey);
    this.chunks.delete(key);
  }
}

/** Simple shelf packing of rectangles into an atlas at most 2048 px wide. Returns positions. */
export function packShelves(canvases, maxWidth = 2048) {
  const order = canvases.map((c, i) => i).sort((a, b) => canvases[b].height - canvases[a].height);
  const places = new Array(canvases.length);
  let x = 0, y = 0, shelf = 0, width = 0;
  for (const i of order) {
    const c = canvases[i];
    if (x + c.width > maxWidth) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    places[i] = { x, y };
    x += c.width + 1;
    shelf = Math.max(shelf, c.height);
    width = Math.max(width, x);
  }
  return { width: Math.max(1, width), height: Math.max(1, y + shelf), places };
}
