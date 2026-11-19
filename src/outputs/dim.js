/**
 * DIM output: a fixed-size white square (2200×2200 by default) with the plant
 * centered, a height line on the left and a width line along the bottom.
 *
 *   ┌──────────────────────────────┐
 *   │                              │
 *   │  │         🌿🌿🌿            │
 *   │  │        🌿🌿🌿🌿           │
 *   │18"-20"      🌿🌿              │
 *   │  │          ████             │
 *   │  │          ████             │
 *   │                              │
 *   │      ──── 20"-22" ────       │
 *   └──────────────────────────────┘
 *
 * The plant is centered in a frame inset `plantMargin` from every edge; the
 * lines sit in that margin and span the plant's top-to-bottom and
 * left-to-right edges.
 */

import { SETTINGS } from "../settings.js";
import { boxCenter, fullBox, insetBox } from "../core/box.js";
import { createCanvas } from "../core/canvas.js";
import { drawDimensionLine } from "../core/dimension-line.js";
import { drawPlaced, placePlant } from "../core/place-plant.js";

const settings = SETTINGS.dim;

export const dimOutput = {
  id: "dim",
  label: "DIM",
  fileSuffix: settings.fileSuffix,
  checkedByDefault: settings.checkedByDefault,

  // Extra text inputs this output needs. In single mode these show as text
  // boxes; in batch mode they're read from these CSV columns.
  fields: [
    { id: "height", label: "Height Label", placeholder: 'e.g., 18"-20"', csvColumn: settings.heightColumn },
    { id: "width", label: "Width Label", placeholder: 'e.g., 20"-22"', csvColumn: settings.widthColumn },
  ],

  render({ image, analysis, values = {} }) {
    const size = settings.sizePx;
    const whole = fullBox(size, size);

    const canvas = createCanvas(size, size, SETTINGS.export.background);
    const ctx = canvas.getContext("2d");

    // 1. Plant: centered on the canvas, as large as the margin allows.
    const placement = placePlant({
      analysis,
      frame: insetBox(whole, size * settings.plantMargin),
      anchor: boxCenter(whole),
      centerOn: settings.centerOn,
      maxShrinkToCenterPot: SETTINGS.layout.maxShrinkToCenterPot,
    });
    drawPlaced(ctx, image, placement);

    // 2. Dimension lines, spanning the plant's edges.
    const plant = insetBox(placement.plantBox, size * settings.lineInset);
    const heightLineX = size * settings.heightLineX;
    const style = {
      lineWidth: Math.max(1, Math.round(size * settings.lineWidth)),
      lineColor: settings.lineColor,
      font: settings.font,
      fontSize: Math.round(size * settings.fontSize),
      textColor: settings.textColor,
      labelGap: settings.labelGap,
    };

    drawDimensionLine(
      ctx,
      {
        direction: "vertical",
        at: heightLineX,
        from: plant.top,
        to: plant.bottom,
        label: values.height,
        // The label is centered on the line, so it shrinks if it would run
        // off the left edge of the canvas or into the plant on the right.
        maxLabelWidth: 2 * Math.min(
          heightLineX * 0.9,
          placement.plantBox.left - heightLineX - style.lineWidth * 2,
        ),
      },
      style,
    );

    drawDimensionLine(
      ctx,
      {
        direction: "horizontal",
        at: size - size * settings.widthLineY,
        from: plant.left,
        to: plant.right,
        label: values.width,
        // Under the canvas center (= the pot or plant center the plant was
        // centered on), even if the leaves make the line itself lopsided.
        labelAt: size / 2,
      },
      style,
    );

    return canvas;
  },
};
