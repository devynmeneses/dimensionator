/**
 * Plant analysis: works out WHERE the plant is in a source image.
 *
 * This runs once per image, at the image's original resolution. Every output
 * type (Silo, Web, DIM) reuses the result, scaling it as needed.
 *
 * Result shape (a "PlantAnalysis"):
 *   {
 *     width, height,   // size of the source image (px)
 *     bounds,          // Box tightly around the plant pixels (see box.js)
 *     potCenterX,      // x position of the pot's center (px)
 *   }
 */

import { readPixels } from "./canvas.js";
import { boxCenter, boxHeight, boxWidth, fullBox } from "./box.js";

/** Analyzes an image (ImageBitmap, HTMLImageElement or canvas). */
export function analyzePlant(image, detectionSettings) {
  return analyzePixels(readPixels(image), detectionSettings);
}

/** Same as analyzePlant, but takes raw ImageData. */
export function analyzePixels(imageData, detectionSettings) {
  const { width, height } = imageData;

  const mask = buildPlantMask(imageData, detectionSettings);
  const bounds = findBounds(mask, width, height) ?? fullBox(width, height);
  const potCenterX =
    findPotCenterX(imageData, mask, bounds, detectionSettings.pot) ?? boxCenter(bounds).x;

  return { width, height, bounds, potCenterX };
}

// ---------------------------------------------------------------------------
//  Step 1: decide which pixels are plant
// ---------------------------------------------------------------------------

/**
 * Returns a mask with one byte per pixel: 1 = plant, 0 = background.
 */
function buildPlantMask(imageData, settings) {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);
  const useAlpha = shouldUseAlpha(data, settings.backgroundMode);
  const { alphaThreshold, whiteThreshold } = settings;

  for (let i = 0, p = 0; p < mask.length; i += 4, p++) {
    if (useAlpha) {
      mask[p] = data[i + 3] > alphaThreshold ? 1 : 0;
    } else {
      const isWhite =
        data[i] >= whiteThreshold && data[i + 1] >= whiteThreshold && data[i + 2] >= whiteThreshold;
      mask[p] = isWhite ? 0 : 1;
    }
  }

  return mask;
}

function shouldUseAlpha(data, backgroundMode) {
  if (backgroundMode === "alpha") return true;
  if (backgroundMode === "white") return false;
  return hasTransparency(data); // "auto"
}

function hasTransparency(data) {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
//  Step 2: find the box around the plant
// ---------------------------------------------------------------------------

/** Returns the Box around all plant pixels, or null if there are none. */
function findBounds(mask, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (!mask[row + x]) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }

  if (right < 0) return null;
  return { left, top, right: right + 1, bottom: bottom + 1 };
}

// ---------------------------------------------------------------------------
//  Step 3: find the pot's center
// ---------------------------------------------------------------------------

/**
 * Leaves often spread unevenly, so we center on the pot instead.
 *
 * Starting at the bottom of the plant and moving up, look at each row's
 * stretches of plant pixels ("runs"):
 *
 *   1. Runs separated by small gaps are joined into one "segment". This
 *      bridges notches between a pot's feet, so a pot base like
 *      ██████  ████  (feet with a notch) counts as one piece, not two.
 *   2. A row counts as "pot" if its widest segment is wide enough and evenly
 *      colored (leaves hanging beside the pot make it uneven, so they're excluded).
 *   3. Once the first pot row is found, keep collecting pot rows in a band
 *      above it, and use the MIDDLE value (median) of their centers. One odd
 *      row (a foot, a curved base seen from above) can't throw it off.
 *
 * Returns null if no row qualifies.
 */
function findPotCenterX(imageData, mask, bounds, potSettings) {
  const { width } = imageData;
  const plantWidth = boxWidth(bounds);
  const minSegmentWidth = Math.max(1, Math.floor(plantWidth * potSettings.minRowWidth));
  const maxGap = Math.floor(plantWidth * potSettings.maxGap);
  const bandHeight = Math.max(1, Math.round(boxHeight(bounds) * potSettings.sampleHeight));

  const centers = [];
  let firstPotRow = null;

  for (let y = bounds.bottom - 1; y >= bounds.top; y--) {
    if (firstPotRow !== null && firstPotRow - y >= bandHeight) break;

    const segment = widestSegment(plantRunsInRow(mask, width, y, bounds), maxGap);
    if (!segment || segment.end - segment.start < minSegmentWidth) continue;
    if (colorVariation(imageData, mask, y, segment) > potSettings.maxColorVariation) continue;

    centers.push((segment.start + segment.end) / 2);
    firstPotRow ??= y;
  }

  return centers.length > 0 ? median(centers) : null;
}

/** Lists the unbroken stretches of plant pixels in one row, as {start, end} (end exclusive). */
function plantRunsInRow(mask, width, y, bounds) {
  const runs = [];
  const row = y * width;
  let start = null;

  for (let x = bounds.left; x < bounds.right; x++) {
    const isPlant = mask[row + x] === 1;
    if (isPlant && start === null) start = x;
    if (!isPlant && start !== null) {
      runs.push({ start, end: x });
      start = null;
    }
  }
  if (start !== null) runs.push({ start, end: bounds.right });

  return runs;
}

/** Joins runs whose gaps are at most `maxGap` px wide, and returns the widest result (or null). */
function widestSegment(runs, maxGap) {
  let widest = null;
  let current = null;

  for (const run of runs) {
    if (current && run.start - current.end <= maxGap) {
      current.end = run.end; // bridge the gap
    } else {
      current = { ...run };
    }
    if (!widest || current.end - current.start > widest.end - widest.start) widest = current;
  }

  return widest;
}

/**
 * How much the plant-pixel colors in a segment differ from their average
 * (0 = perfectly even). Background pixels in bridged gaps are ignored.
 * Measured as the mean absolute difference across the R, G and B channels.
 */
function colorVariation(imageData, mask, y, segment) {
  const { data, width } = imageData;
  const row = y * width;

  const avg = [0, 0, 0];
  let count = 0;
  for (let x = segment.start; x < segment.end; x++) {
    if (!mask[row + x]) continue;
    const i = (row + x) * 4;
    avg[0] += data[i];
    avg[1] += data[i + 1];
    avg[2] += data[i + 2];
    count++;
  }
  avg[0] /= count;
  avg[1] /= count;
  avg[2] /= count;

  let totalDiff = 0;
  for (let x = segment.start; x < segment.end; x++) {
    if (!mask[row + x]) continue;
    const i = (row + x) * 4;
    totalDiff +=
      Math.abs(data[i] - avg[0]) + Math.abs(data[i + 1] - avg[1]) + Math.abs(data[i + 2] - avg[2]);
  }

  return totalDiff / (count * 3);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
