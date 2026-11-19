/**
 * Placement: works out how big to draw the source image on an output canvas,
 * and where.
 *
 * Every output type uses this. It describes the layout it wants:
 *
 *   frame    – Box the plant must stay inside (in output pixels)
 *   anchor   – the point {x, y} where the plant should be centered
 *   centerOn – what lines up with anchor.x:
 *                "plant" – the middle of the plant's pixels (leaves + pot)
 *                "pot"   – the pot's center, so lopsided leaves don't shift it
 *              Vertically, the middle of the plant's pixels always lines up with anchor.y.
 *
 * and gets back:
 *
 *   {
 *     scale,       // multiply source size by this
 *     x, y,        // where the source image's top-left corner goes
 *     width,       // drawn size of the whole source image
 *     height,
 *     plantBox,    // where the plant ends up (Box, output pixels)
 *     potCenterX,  // where the pot's center ends up (output pixels)
 *   }
 */

import { boxCenter, boxHeight, boxWidth, clamp, transformBox } from "./box.js";

/**
 * The x position (in source pixels) that should line up with the anchor.
 * @param {object} analysis              PlantAnalysis from analyze-plant.js
 * @param {"plant"|"pot"} centerOn
 */
export function centerXOf(analysis, centerOn) {
  return centerOn === "pot" ? analysis.potCenterX : boxCenter(analysis.bounds).x;
}

/**
 * @param {object}  options
 * @param {object}  options.analysis              PlantAnalysis from analyze-plant.js
 * @param {object}  options.frame                 Box the plant must fit inside
 * @param {object}  options.anchor                {x, y} to center the plant on
 * @param {"plant"|"pot"} options.centerOn        see above
 * @param {number}  options.maxShrinkToCenterPot  see settings.layout
 * @param {number} [options.maxScale]             e.g. 1 to never enlarge
 */
export function placePlant({ analysis, frame, anchor, centerOn, maxShrinkToCenterPot, maxScale = Infinity }) {
  const { bounds } = analysis;
  const centerX = centerXOf(analysis, centerOn);
  const centerY = boxCenter(bounds).y;

  // Largest scale that fits the plant in the frame, ignoring centering.
  const fitScale = Math.min(boxWidth(frame) / boxWidth(bounds), boxHeight(frame) / boxHeight(bounds));

  // Largest scale that fits the plant in the frame while it is exactly
  // centered on the anchor. Each side of the plant can only stretch as far
  // as the room between the anchor and that side of the frame.
  const centeredScale = Math.min(
    roomRatio(anchor.x - frame.left, centerX - bounds.left),
    roomRatio(frame.right - anchor.x, bounds.right - centerX),
    roomRatio(anchor.y - frame.top, centerY - bounds.top),
    roomRatio(frame.bottom - anchor.y, bounds.bottom - centerY),
  );

  // Prefer exact centering, unless that shrinks the plant too much.
  const smallestAllowed = fitScale * (1 - maxShrinkToCenterPot);
  const scale = Math.min(Math.max(centeredScale, smallestAllowed), fitScale, maxScale);

  // Put the anchor point where we want it, then nudge so the plant stays in the frame.
  // Rounded to whole pixels so images drawn at full size stay sharp.
  const x = Math.round(clamp(
    anchor.x - centerX * scale,
    frame.left - bounds.left * scale,
    frame.right - bounds.right * scale,
  ));
  const y = Math.round(clamp(
    anchor.y - centerY * scale,
    frame.top - bounds.top * scale,
    frame.bottom - bounds.bottom * scale,
  ));

  return {
    scale,
    x,
    y,
    width: analysis.width * scale,
    height: analysis.height * scale,
    plantBox: transformBox(bounds, scale, x, y),
    potCenterX: analysis.potCenterX * scale + x,
  };
}

/** How much a plant distance can be scaled to fit in the available room. */
function roomRatio(room, plantDistance) {
  return plantDistance > 0 ? room / plantDistance : Infinity;
}

/** Draws the source image onto a canvas using a placement from placePlant(). */
export function drawPlaced(ctx, image, placement) {
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, placement.x, placement.y, placement.width, placement.height);
}
