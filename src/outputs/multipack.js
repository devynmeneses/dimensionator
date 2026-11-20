/**
 * MULTI-PACK output: several copies of one plant arranged on a 2200×2200
 * white square, following the patterns in settings.multipack.layouts
 * (measured from the images in "multipack references").
 *
 *   4-pack            5-pack            8-pack
 *   🪴    🪴          🪴      🪴        🪴  🪴  🪴
 *                        🪴               🪴  🪴
 *   🪴    🪴          🪴      🪴        🪴  🪴  🪴
 *
 * Each plant's POT sits on its spot left-to-right (settings.multipack.centerOn),
 * and the plant's vertical middle sits on its row.
 *
 * Unlike Silo/Web/DIM, this output takes a pack size, so it's made with
 * multipackOutput(count) rather than listed in outputs/index.js.
 */

import { SETTINGS } from "../settings.js";
import { boxCenter, boxHeight, boxWidth } from "../core/box.js";
import { createCanvas } from "../core/canvas.js";
import { centerXOf } from "../core/place-plant.js";

const settings = SETTINGS.multipack;

/** Pack sizes that have a layout, smallest first, e.g. [1, 2, 3, 4, 5, 6, 8, 10]. */
export const PACK_SIZES = Object.keys(settings.layouts)
  .map(Number)
  .sort((a, b) => a - b);

/** "_{count}PACK" → "_4PACK" */
export function multipackSuffix(count) {
  return settings.fileSuffix.replace("{count}", count);
}

/**
 * An output type (same shape as silo.js etc.) for one pack size, so it works
 * with the shared preview and renderToFile().
 */
export function multipackOutput(count) {
  const layout = settings.layouts[count];
  if (!layout) throw new Error(`No multi-pack layout for ${count} plants`);

  return {
    id: `multipack-${count}`,
    label: `${count}-pack`,
    fileSuffix: multipackSuffix(count),
    checkedByDefault: false,
    fields: [],
    render: ({ image, analysis }) => renderMultipack(image, analysis, layout),
  };
}

/** Where each plant goes: [{x, y}] in output pixels, top row first. */
export function slotPositions(layout, size) {
  const rowCount = layout.rows.length;

  return layout.rows.flatMap((plantsInRow, row) => {
    const y = size / 2 + (row - (rowCount - 1) / 2) * layout.rowSpacing * size;
    return Array.from({ length: plantsInRow }, (_, i) => ({
      x: size / 2 + (i - (plantsInRow - 1) / 2) * layout.columnSpacing * size,
      y,
    }));
  });
}

function renderMultipack(image, analysis, layout) {
  const size = settings.sizePx;
  const canvas = createCanvas(size, size, SETTINGS.export.background);
  const ctx = canvas.getContext("2d");

  const { bounds } = analysis;
  const centerX = centerXOf(analysis, settings.centerOn);
  const middleY = boxCenter(bounds).y;
  const slots = slotPositions(layout, size);
  const scale = plantScale(analysis, layout, slots, size);

  // "multiply" makes a photo's white background disappear on the white
  // canvas, so neighbouring plants can sit close (or overlap, as in the
  // 5-pack) without white corners covering each other. Transparent PNGs are
  // unaffected. (This assumes a white export background.)
  ctx.globalCompositeOperation = "multiply";
  ctx.imageSmoothingQuality = "high";

  for (const slot of slots) {
    ctx.drawImage(
      image,
      // just the plant, not the empty margins around it
      bounds.left, bounds.top, boxWidth(bounds), boxHeight(bounds),
      Math.round(slot.x - (centerX - bounds.left) * scale),
      Math.round(slot.y - (middleY - bounds.top) * scale),
      boxWidth(bounds) * scale,
      boxHeight(bounds) * scale,
    );
  }

  return canvas;
}

/**
 * How much to scale the plant: as tall as the layout says, unless that makes
 * it too wide or pushes any copy past the canvas edge.
 */
function plantScale(analysis, layout, slots, size) {
  const { bounds } = analysis;
  const centerX = centerXOf(analysis, settings.centerOn);
  const middleY = boxCenter(bounds).y;
  const margin = settings.edgeMargin * size;

  let scale = Math.min(
    (layout.plantHeight * size) / boxHeight(bounds),
    (layout.plantMaxWidth * size) / boxWidth(bounds),
  );

  for (const slot of slots) {
    scale = Math.min(
      scale,
      roomRatio(slot.x - margin, centerX - bounds.left),
      roomRatio(size - margin - slot.x, bounds.right - centerX),
      roomRatio(slot.y - margin, middleY - bounds.top),
      roomRatio(size - margin - slot.y, bounds.bottom - middleY),
    );
  }

  return scale;
}

function roomRatio(room, plantDistance) {
  return plantDistance > 0 ? room / plantDistance : Infinity;
}
