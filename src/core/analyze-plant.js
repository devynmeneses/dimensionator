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
 *     mask,            // 1 byte per pixel: 1 = plant, 0 = background. Used by
 *                      // render.js to cut the plant out; dropped after that.
 *   }
 *
 * Steps: decide which pixels are plant (using transparency, or the
 * background color found at the image's edges), throw away specks and frame
 * lines, then find the plant's box and its pot's center.
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
  removeStrayPieces(mask, width, height, detectionSettings.minPieceSize);
  const bounds = findBounds(mask, width, height) ?? fullBox(width, height);
  const potCenterX =
    findPotCenterX(imageData, mask, bounds, detectionSettings.pot) ?? boxCenter(bounds).x;

  return { width, height, bounds, potCenterX, mask };
}

// ---------------------------------------------------------------------------
//  Step 1: decide which pixels are plant
// ---------------------------------------------------------------------------

/**
 * Returns a mask with one byte per pixel: 1 = plant, 0 = background.
 *
 * Transparent images: anything not (nearly) transparent is plant.
 * Other images: near-white is always background, and so is anything close to
 * the background color read from the image's edges. That covers off-white or
 * light grey borders, including a white-background photo sitting on one.
 */
function buildPlantMask(imageData, settings) {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);

  if (shouldUseAlpha(data, settings.backgroundMode)) {
    for (let i = 3, p = 0; p < mask.length; i += 4, p++) {
      mask[p] = data[i] > settings.alphaThreshold ? 1 : 0;
    }
    return mask;
  }

  const background = settings.detectBackgroundFromEdges ? detectBackgroundColor(imageData, settings) : null;

  const { whiteThreshold: white, backgroundTolerance: tolerance } = settings;
  for (let i = 0, p = 0; p < mask.length; i += 4, p++) {
    const isNearWhite = data[i] >= white && data[i + 1] >= white && data[i + 2] >= white;
    const isEdgeColor =
      background !== null &&
      Math.abs(data[i] - background.r) <= tolerance &&
      Math.abs(data[i + 1] - background.g) <= tolerance &&
      Math.abs(data[i + 2] - background.b) <= tolerance;
    mask[p] = isNearWhite || isEdgeColor ? 0 : 1;
  }

  return mask;
}

/**
 * The image's background color, read from a thin ring around its edges, or
 * null if the edges don't show one clear, light color (then only the
 * near-white rule is used). Only light colors are accepted so that a dark studio
 * backdrop can't turn white flowers or pots into "background".
 */
function detectBackgroundColor(imageData, settings) {
  const { data, width, height } = imageData;
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.01));
  const step = Math.max(1, Math.floor((2 * (width + height) * ring) / 4000)); // ~4000 samples
  const reds = [];
  const greens = [];
  const blues = [];

  let n = 0;
  for (let y = 0; y < height; y++) {
    const nearTopOrBottom = y < ring || y >= height - ring;
    for (let x = 0; x < width; x++) {
      if (!nearTopOrBottom && x >= ring && x < width - ring) {
        x = width - ring - 1; // skip the middle of the row
        continue;
      }
      if (n++ % step) continue;
      const i = (y * width + x) * 4;
      reds.push(data[i]);
      greens.push(data[i + 1]);
      blues.push(data[i + 2]);
    }
  }

  const color = { r: median(reds), g: median(greens), b: median(blues) };
  if (Math.min(color.r, color.g, color.b) < settings.minBackgroundLightness) return null;

  const tolerance = settings.backgroundTolerance;
  let matching = 0;
  for (let k = 0; k < reds.length; k++) {
    if (
      Math.abs(reds[k] - color.r) <= tolerance &&
      Math.abs(greens[k] - color.g) <= tolerance &&
      Math.abs(blues[k] - color.b) <= tolerance
    ) {
      matching++;
    }
  }

  return matching / reds.length >= 0.6 ? color : null;
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
//  Step 1b: throw away specks and frame lines
// ---------------------------------------------------------------------------

/**
 * Clears (in place) mask pixels that aren't part of the plant:
 *   - small pieces, like dust or specks: smaller than `minPieceSize` of the
 *     biggest piece (detached flowers and leaves are much bigger, so they stay)
 *   - outlines, like a frame line around the photo: a piece that surrounds the
 *     plant but is almost entirely empty inside
 *
 * To stay fast on big photos, pieces are found on a coarse grid (about 1000
 * cells across the long side): a cell is "plant" if any pixel in it is.
 */
function removeStrayPieces(mask, width, height, minPieceSize) {
  const cell = Math.max(1, Math.ceil(Math.max(width, height) / 1000));
  const gridW = Math.ceil(width / cell);
  const gridH = Math.ceil(height / cell);

  // 1. Coarse grid of plant cells.
  const grid = new Uint8Array(gridW * gridH);
  for (let y = 0; y < height; y++) {
    const gridRow = Math.floor(y / cell) * gridW;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x]) grid[gridRow + Math.floor(x / cell)] = 1;
    }
  }

  // 2. Label connected pieces of plant cells (diagonals count as touching).
  const labels = new Int32Array(gridW * gridH); // 0 = none, 1.. = piece number
  const pieces = [null]; // pieces[label] = { cells, left, top, right, bottom }
  const stack = [];
  for (let start = 0; start < grid.length; start++) {
    if (!grid[start] || labels[start]) continue;
    const label = pieces.length;
    const piece = { cells: 0, left: gridW, top: gridH, right: -1, bottom: -1 };
    pieces.push(piece);
    labels[start] = label;
    stack.push(start);

    while (stack.length) {
      const c = stack.pop();
      const cx = c % gridW;
      const cy = (c - cx) / gridW;
      piece.cells++;
      piece.left = Math.min(piece.left, cx);
      piece.right = Math.max(piece.right, cx);
      piece.top = Math.min(piece.top, cy);
      piece.bottom = Math.max(piece.bottom, cy);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
          const n = ny * gridW + nx;
          if (grid[n] && !labels[n]) {
            labels[n] = label;
            stack.push(n);
          }
        }
      }
    }
  }
  if (pieces.length <= 2) return; // nothing, or a single piece: nothing to remove

  // 3. Decide which pieces to keep.
  const biggest = pieces.slice(1).reduce((a, b) => (b.cells > a.cells ? b : a));
  const keep = pieces.map((piece) => {
    if (!piece) return false;
    if (piece === biggest) return true;
    if (piece.cells < biggest.cells * minPieceSize) return false; // speck
    const surroundsPlant =
      piece.left <= biggest.left && piece.right >= biggest.right &&
      piece.top <= biggest.top && piece.bottom >= biggest.bottom;
    const boxCells = (piece.right - piece.left + 1) * (piece.bottom - piece.top + 1);
    return !(surroundsPlant && piece.cells / boxCells < 0.05); // frame line
  });

  // 4. Clear pixels in dropped pieces.
  for (let y = 0; y < height; y++) {
    const gridRow = Math.floor(y / cell) * gridW;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x] && !keep[labels[gridRow + Math.floor(x / cell)]]) mask[row + x] = 0;
    }
  }
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
