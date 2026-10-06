/** Copy a PixelCanvas into a Phaser canvas texture (replacing an old one with the same key). */
export function addCanvasTexture(scene, key, pc) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, pc.width, pc.height);
  tex.context.putImageData(new ImageData(pc.data, pc.width, pc.height), 0, 0);
  tex.refresh();
}
