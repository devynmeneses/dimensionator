/**
 * Loading images and creating/saving canvases.
 */

/** Decodes an image File into something a canvas can draw. */
export async function loadImage(file) {
  return createImageBitmap(file);
}

/** Creates a canvas filled with a solid background color. */
export function createCanvas(width, height, background) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas;
}

/** Reads every pixel of an image as RGBA bytes. */
export function readPixels(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);

  return ctx.getImageData(0, 0, image.width, image.height);
}

/** Encodes a canvas as an image file (JPEG by default). */
export function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
      mimeType,
      quality,
    );
  });
}
