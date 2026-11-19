/**
 * Draws a straight dimension line with an optional text label in the middle.
 * The line is split around the label so the text never overlaps it:
 *
 *   horizontal:   ────────  20"-22"  ────────
 *
 *   vertical:     │
 *                 │
 *              18"-20"
 *                 │
 *                 │
 */

import { clamp } from "./box.js";

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} line
 * @param {"horizontal"|"vertical"} line.direction
 * @param {number}  line.at        y of a horizontal line, or x of a vertical one
 * @param {number}  line.from      where the line starts (x for horizontal, y for vertical)
 * @param {number}  line.to        where the line ends
 * @param {string} [line.label]    text to show (empty = plain line)
 * @param {number} [line.labelAt]  preferred label position along the line (default: middle)
 * @param {number} [line.maxLabelWidth]  shrink the text if it is wider than this (px)
 * @param {object}  style          { lineWidth, lineColor, font, fontSize, textColor, labelGap } in px
 */
export function drawDimensionLine(ctx, line, style) {
  const isVertical = line.direction === "vertical";
  const text = (line.label ?? "").trim();

  // Positions along the line: [from ... to]. Empty by default, unless a label needs room.
  let gapStart = null;
  let gapEnd = null;
  let labelCenter = null;
  let labelMetrics = null;

  if (text) {
    labelMetrics = measureLabel(ctx, text, style, line.maxLabelWidth);

    const lengthAlongLine = isVertical ? labelMetrics.height : labelMetrics.width;
    const halfGap = lengthAlongLine / 2 + style.labelGap * labelMetrics.fontSize;

    // Keep the label (and its gap) inside the line's extent when possible.
    const preferred = line.labelAt ?? (line.from + line.to) / 2;
    labelCenter =
      line.to - line.from > 2 * halfGap
        ? clamp(preferred, line.from + halfGap, line.to - halfGap)
        : (line.from + line.to) / 2;

    gapStart = labelCenter - halfGap;
    gapEnd = labelCenter + halfGap;
  }

  // Line (one piece, or two pieces with a gap for the label)
  const segments = text ? [[line.from, gapStart], [gapEnd, line.to]] : [[line.from, line.to]];

  ctx.save();
  ctx.lineWidth = style.lineWidth;
  ctx.strokeStyle = style.lineColor;
  ctx.lineCap = "butt";
  ctx.beginPath();
  for (const [a, b] of segments) {
    if (b <= a) continue;
    if (isVertical) {
      ctx.moveTo(line.at, a);
      ctx.lineTo(line.at, b);
    } else {
      ctx.moveTo(a, line.at);
      ctx.lineTo(b, line.at);
    }
  }
  ctx.stroke();
  ctx.restore();

  // Label
  if (text) {
    const center = isVertical ? { x: line.at, y: labelCenter } : { x: labelCenter, y: line.at };
    drawCenteredText(ctx, text, center, style, labelMetrics);
  }
}

/** Measures a label, shrinking the font if it's wider than maxWidth. */
function measureLabel(ctx, text, style, maxWidth = Infinity) {
  let fontSize = style.fontSize;
  let metrics = measureAt(ctx, text, style.font, fontSize);

  if (metrics.width > maxWidth) {
    fontSize = Math.floor(fontSize * (maxWidth / metrics.width));
    metrics = measureAt(ctx, text, style.font, fontSize);
  }

  return {
    fontSize,
    width: metrics.width,
    ascent: metrics.actualBoundingBoxAscent,
    descent: metrics.actualBoundingBoxDescent,
    height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
  };
}

function measureAt(ctx, text, font, fontSize) {
  ctx.save();
  ctx.font = cssFont(font, fontSize);
  const metrics = ctx.measureText(text);
  ctx.restore();
  return metrics;
}

/** Draws text so its visible glyphs are centered exactly on `center`. */
function drawCenteredText(ctx, text, center, style, metrics) {
  ctx.save();
  ctx.font = cssFont(style.font, metrics.fontSize);
  ctx.fillStyle = style.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, center.x, center.y + (metrics.ascent - metrics.descent) / 2);
  ctx.restore();
}

function cssFont(family, sizePx) {
  return `${sizePx}px "${family}", sans-serif`;
}
