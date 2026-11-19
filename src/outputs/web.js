/**
 * WEB output: a fixed-size white square (2200×2200 by default) with the plant
 * scaled to fill it, minus padding, and centered.
 */

import { SETTINGS } from "../settings.js";
import { boxCenter, fullBox, insetBox } from "../core/box.js";
import { createCanvas } from "../core/canvas.js";
import { drawPlaced, placePlant } from "../core/place-plant.js";

const settings = SETTINGS.web;

export const webOutput = {
  id: "web",
  label: "Web JPG",
  fileSuffix: settings.fileSuffix,
  checkedByDefault: settings.checkedByDefault,
  fields: [],

  render({ image, analysis }) {
    const size = settings.sizePx;
    const canvas = createCanvas(size, size, SETTINGS.export.background);
    const whole = fullBox(size, size);

    const placement = placePlant({
      analysis,
      frame: insetBox(whole, size * settings.padding),
      anchor: boxCenter(whole),
      centerOn: settings.centerOn,
      maxShrinkToCenterPot: SETTINGS.layout.maxShrinkToCenterPot,
    });
    drawPlaced(canvas.getContext("2d"), image, placement);

    return canvas;
  },
};
