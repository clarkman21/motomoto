/** Copy a PixelCanvas into a Phaser canvas texture (replacing an old one with the same key). */
export function addCanvasTexture(scene, key, pc) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, pc.width, pc.height);
  tex.context.putImageData(new ImageData(pc.data, pc.width, pc.height), 0, 0);
  tex.refresh();
}

/**
 * Put a still image (a sign, a pole) on whole pixels: its top left corner at the screen point p
 * minus its ground point (groundX, groundY). The buildings are on whole pixels too, so the image
 * does not move against them when the camera moves.
 */
export function placeOnPixels(img, p, groundX, groundY) {
  return img.setOrigin(0).setPosition(Math.round(p.x - groundX), Math.round(p.y - groundY));
}
