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
    //   "auto"  – use transparency if the image has any, otherwise treat
    //             near-white pixels as background (recommended)
    //   "alpha" – always use transparency
    //   "white" – always treat near-white pixels as background
    backgroundMode: "auto",

    // 0–255. Pixels MORE transparent than this count as background.
    alphaThreshold: 10,

    // 0–255. When using "white" mode, pixels whose red, green AND blue are all
    // at or above this count as background.
    whiteThreshold: 245,

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
  //  Batch mode
  // --------------------------------------------------------------------------
  batch: {
    // CSV column that holds each image's file name.
    fileNameColumn: "FILE NAME",
    imageExtensions: [".png", ".jpg", ".jpeg", ".webp"],
  },
};
