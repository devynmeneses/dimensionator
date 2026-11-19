/**
 * SILO output: the plant at its ORIGINAL resolution (never resized), on a
 * white canvas cropped to a fixed aspect ratio (5:7 by default), centered.
 */

import { SETTINGS } from "../settings.js";
import { boxCenter, boxHeight, boxWidth, clamp, fullBox, insetBox } from "../core/box.js";
import { createCanvas } from "../core/canvas.js";
import { centerXOf, drawPlaced, placePlant } from "../core/place-plant.js";

const settings = SETTINGS.silo;

export const siloOutput = {
  id: "silo",
  label: "Silo JPG",
  fileSuffix: settings.fileSuffix,
  checkedByDefault: settings.checkedByDefault,
  fields: [],

  render({ image, analysis }) {
    const { bounds } = analysis;

    // Padding scales with the plant, within limits.
    const largerSide = Math.max(boxWidth(bounds), boxHeight(bounds));
    const padding = clamp(
      Math.round(largerSide * settings.padding),
      settings.minPaddingPx,
      settings.maxPaddingPx,
    );

    // Make the canvas wide enough that the plant (or pot) can sit in the exact
    // middle, then grow it (never shrink it) to match the aspect ratio.
    const centerX = centerXOf(analysis, settings.centerOn);
    const halfWidth = Math.max(centerX - bounds.left, bounds.right - centerX) + padding;
    const size = growToAspectRatio(
      Math.ceil(2 * halfWidth),
      boxHeight(bounds) + 2 * padding,
      settings.aspectRatio,
    );

    const canvas = createCanvas(size.width, size.height, SETTINGS.export.background);
    const placement = placePlant({
      analysis,
      frame: insetBox(fullBox(canvas.width, canvas.height), padding),
      anchor: boxCenter(fullBox(canvas.width, canvas.height)),
      centerOn: settings.centerOn,
      maxShrinkToCenterPot: SETTINGS.layout.maxShrinkToCenterPot,
      maxScale: 1, // keep original resolution
    });
    drawPlaced(canvas.getContext("2d"), image, placement);

    return canvas;
  },
};

/** Enlarges width OR height so that width:height matches the ratio. */
function growToAspectRatio(width, height, ratio) {
  const target = ratio.width / ratio.height;
  if (width / height > target) {
    return { width, height: Math.ceil(width / target) }; // too wide → taller
  }
  return { width: Math.ceil(height * target), height }; // too tall → wider
}
