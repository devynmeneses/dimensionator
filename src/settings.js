/**
 * ============================================================================
 *  DIMENSIONATOR SETTINGS
 * ============================================================================
 *  Every number that controls how the output images look lives in this file.
 *  Change a value, save, and refresh the page. No other file needs to change.
 *
 *  Units used below:
 *    px        – real pixels in the output image
 *    fraction  – a share of something else (0.10 = 10%). Each comment says
 *                what it's a fraction OF.
 *    0–255     – a color/opacity level, where 0 = none and 255 = full
 * ============================================================================
 */

export const SETTINGS = {
  // --------------------------------------------------------------------------
  //  Finding the plant
  // --------------------------------------------------------------------------
  detection: {
    // How to tell plant pixels from background pixels:
    //   "auto"  – use transparency if the image has any, otherwise use the
    //             background color (recommended)
    //   "alpha" – always use transparency
    //   "white" – never use transparency; always use the background color
    backgroundMode: "auto",

    // 0–255. Pixels MORE transparent than this count as background.
    alphaThreshold: 10,

    // For images without transparency, the background color is read from the
    // image's edges, so off-white or light grey borders are ignored too.
    detectBackgroundFromEdges: true,
    // 0–255. How close a pixel must be to that color to count as background.
    backgroundTolerance: 12,
    // 0–255. The edge color is only trusted if it's this light (on every
    // channel); darker edges are ignored and only the near-white rule applies.
    minBackgroundLightness: 200,

    // 0–255. Pixels whose red, green AND blue are all at or above this always
    // count as background (so a white photo on a grey border works too).
    whiteThreshold: 245,

    // Specks, dust and frame lines around the plant are ignored. Pieces
    // smaller than this (fraction of the plant's size) are thrown away;
    // detached flowers or leaves are much bigger, so they stay.
    minPieceSize: 0.002,

    // The pot's center is found by scanning up from the bottom of the plant
    // for rows that are wide and evenly colored (the pot).
    pot: {
      // fraction of the plant's width a row must span to count as "the pot"
      minRowWidth: 0.25,
      // 0–255. How evenly colored that row must be. Lower = stricter.
      maxColorVariation: 18,
      // Gaps in a row narrower than this (fraction of the plant's width) are
      // bridged, so notches between a pot's feet don't split the pot in two.
      maxGap: 0.2,
      // After the first pot row, rows in a band this tall (fraction of the
      // plant's height) are also measured, and the middle value is used.
      sampleHeight: 0.08,
    },
  },

  // --------------------------------------------------------------------------
  //  Placing the plant
  // --------------------------------------------------------------------------
  layout: {
    // VERTICALLY, the whole plant (leaves + pot) is always centered, with equal
    // space above and below, using its actual pixels (empty margins in the
    // input image are ignored).
    //
    // HORIZONTALLY, each output's `centerOn` setting picks what's centered:
    //   "pot"   – the pot's center, so lopsided leaves don't pull it off-center
    //   "plant" – the whole plant's pixels
    //
    // With "pot", a lopsided plant has to be drawn a bit smaller to fit. This
    // caps how much smaller (fraction: 0.4 = up to 40% smaller). Past that the
    // plant is nudged off-center instead.
    maxShrinkToCenterPot: 0.4,
  },

  // --------------------------------------------------------------------------
  //  Saved files
  // --------------------------------------------------------------------------
  export: {
    mimeType: "image/jpeg",
    extension: ".jpg",
    quality: 1.0, // 0–1. JPEG quality.
    background: "#ffffff",
  },

  // --------------------------------------------------------------------------
  //  SILO – the plant at its original resolution on a 5:7 white canvas
  // --------------------------------------------------------------------------
  silo: {
    fileSuffix: "_SILO",
    checkedByDefault: false,
    centerOn: "pot", // horizontal centering: "pot" or "plant" – see layout above
    aspectRatio: { width: 5, height: 7 },
    // Space around the plant, as a fraction of the plant's larger side…
    padding: 0.22,
    // …but never less / more than these (px).
    minPaddingPx: 40,
    maxPaddingPx: 300,
  },

  // --------------------------------------------------------------------------
  //  WEB – fixed-size square for the website
  // --------------------------------------------------------------------------
  web: {
    fileSuffix: "_SILO-2200x2200",
    checkedByDefault: false,
    centerOn: "pot", // horizontal centering: "pot" or "plant" – see layout above
    sizePx: 2200,
    // Space between the plant and each edge (fraction of canvas size).
    padding: 0.09,
  },

  // --------------------------------------------------------------------------
  //  DIM – square with height and width dimension lines
  // --------------------------------------------------------------------------
  dim: {
    fileSuffix: "_DIM",
    checkedByDefault: true,
    centerOn: "pot", // horizontal centering: "pot" or "plant" – see layout above
    sizePx: 2200,

    // The plant is centered on the canvas and scaled as large as possible
    // while keeping at least this much space from every edge (fraction of
    // canvas size). The dimension lines sit inside this space.
    plantMargin: 0.14,

    // Where the lines go (fraction of canvas size):
    heightLineX: 0.09, // distance of the height line from the LEFT edge
    widthLineY: 0.055, // distance of the width line from the BOTTOM edge

    // Lines stop this far inside the plant's edges (fraction of canvas size).
    lineInset: 0.005,

    lineWidth: 0.004, // fraction of canvas size (≈ 9px at 2200)
    lineColor: "rgb(120, 120, 120)",

    font: "din2014", // must match the @font-face name in styles/app.css
    fontSize: 0.04, // fraction of canvas size (≈ 88px at 2200)
    textColor: "#000000",

    // Gap between the label text and the line on each side of it
    // (fraction of the font size).
    labelGap: 0.4,

    // CSV column names used in batch mode.
    heightColumn: "PLANT HEIGHT",
    widthColumn: "PLANT WIDTH",
  },

  // --------------------------------------------------------------------------
  //  MULTI-PACKS – several copies of one plant on a 2200×2200 square
  // --------------------------------------------------------------------------
  multipack: {
    sizePx: 2200,
    centerOn: "pot", // horizontal centering of each plant: "pot" or "plant"
    // "{count}" is replaced by the pack size: Fern.png → Fern_4PACK.jpg
    fileSuffix: "_{count}PACK",
    defaultCount: 2, // pack size selected when the tab opens
    // Plants never come closer than this to the canvas edge (fraction of canvas size).
    edgeMargin: 0.015,

    // One entry per pack size, measured from the images in "multipack references".
    // All sizes are fractions of the canvas size.
    //   rows           plants in each row, top to bottom ([2, 1, 2] = 2, then 1, then 2)
    //   plantHeight    how tall each plant is drawn
    //   plantMaxWidth  how wide a plant may be (wide plants are drawn smaller to fit)
    //   columnSpacing  distance between pot centers in a row
    //   rowSpacing     distance between row centers
    // Every row is centered left-to-right and the rows are centered top-to-bottom.
    // To add a pack size, add a line here.
    layouts: {
      1: { rows: [1], plantHeight: 0.738, plantMaxWidth: 0.85, columnSpacing: 0, rowSpacing: 0 },
      2: { rows: [2], plantHeight: 0.371, plantMaxWidth: 0.47, columnSpacing: 0.5, rowSpacing: 0 },
      3: { rows: [1, 2], plantHeight: 0.361, plantMaxWidth: 0.457, columnSpacing: 0.487, rowSpacing: 0.468 },
      4: { rows: [2, 2], plantHeight: 0.337, plantMaxWidth: 0.457, columnSpacing: 0.487, rowSpacing: 0.437 },
      5: { rows: [2, 1, 2], plantHeight: 0.278, plantMaxWidth: 0.283, columnSpacing: 0.625, rowSpacing: 0.25 },
      6: { rows: [3, 3], plantHeight: 0.277, plantMaxWidth: 0.283, columnSpacing: 0.313, rowSpacing: 0.375 },
      8: { rows: [3, 2, 3], plantHeight: 0.247, plantMaxWidth: 0.303, columnSpacing: 0.333, rowSpacing: 0.333 },
      10: { rows: [4, 2, 4], plantHeight: 0.186, plantMaxWidth: 0.22, columnSpacing: 0.25, rowSpacing: 0.333 },
    },
  },

  // --------------------------------------------------------------------------
  //  Batch mode
  // --------------------------------------------------------------------------
  batch: {
    // CSV column that holds each image's file name.
    fileNameColumn: "FILE NAME",
    imageExtensions: [".png", ".jpg", ".jpeg", ".webp"],
  },
};
