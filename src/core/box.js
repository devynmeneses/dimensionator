/**
 * A Box is a rectangle described by its four edges, in pixels:
 *
 *   { left, top, right, bottom }
 *
 * `right` and `bottom` are exclusive, so width = right - left.
 * This file holds small helpers for working with boxes.
 */

export function boxWidth(box) {
  return box.right - box.left;
}

export function boxHeight(box) {
  return box.bottom - box.top;
}

export function boxCenter(box) {
  return {
    x: (box.left + box.right) / 2,
    y: (box.top + box.bottom) / 2,
  };
}

/** A box covering a whole canvas/image of the given size. */
export function fullBox(width, height) {
  return { left: 0, top: 0, right: width, bottom: height };
}

/** Shrinks a box by `amount` px on every side. */
export function insetBox(box, amount) {
  return {
    left: box.left + amount,
    top: box.top + amount,
    right: box.right - amount,
    bottom: box.bottom - amount,
  };
}

/** Scales a box by `scale`, then moves it by (dx, dy). */
export function transformBox(box, scale, dx, dy) {
  return {
    left: box.left * scale + dx,
    top: box.top * scale + dy,
    right: box.right * scale + dx,
    bottom: box.bottom * scale + dy,
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
