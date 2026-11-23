/**
 * Turns an input image into saved output files.
 * Used by both single mode and batch mode, so they always behave the same.
 */

import { SETTINGS } from "./settings.js";
import { ALL_SUFFIXES } from "./outputs/index.js";
import { analyzePixels } from "./core/analyze-plant.js";
import { canvasToBlob, cutOut, loadImage, readPixels } from "./core/canvas.js";
import { outputFileName } from "./naming.js";

/**
 * Loads and analyzes an input image once, so every output can reuse it.
 *
 * `source.image` is a cleaned copy: the background (white, off-white, light
 * grey or transparent), specks and frame lines are made transparent, so no
 * output ever draws a grey box or stray dust.
 * Call source.image.close() when finished to free memory.
 */
export async function prepareSource(file) {
  const original = await loadImage(file);
  const pixels = readPixels(original);
  original.close();

  const { mask, ...analysis } = analyzePixels(pixels, SETTINGS.detection);
  const image = await cutOut(pixels, mask);
  return { name: file.name, image, analysis };
}

/**
 * @param {object} output     an output type from outputs/index.js
 * @param {object} source     { name, image, analysis } for the input image
 * @param {object} [values]   label values for outputs with fields, e.g. { height: '18"' }
 * @returns {Promise<{ name: string, blob: Blob }>}
 */
export async function renderToFile(output, source, values = {}) {
  const canvas = output.render({ image: source.image, analysis: source.analysis, values });
  const { mimeType, quality, extension } = SETTINGS.export;

  return {
    name: outputFileName(source.name, output.fileSuffix, ALL_SUFFIXES, extension),
    blob: await canvasToBlob(canvas, mimeType, quality),
  };
}
