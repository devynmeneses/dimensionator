/**
 * Browser tests. Open tests/index.html through a web server.
 * Covers the logic (naming, CSV, detection, placement) and renders every
 * output for a few synthetic plants so you can eyeball them.
 */

import { SETTINGS } from "../src/settings.js";
import { OUTPUT_TYPES, ALL_SUFFIXES } from "../src/outputs/index.js";
import { baseName, outputFileName } from "../src/naming.js";
import { parseCsv, csvValue, csvHasColumn } from "../src/batch/csv.js";
import { analyzePlant } from "../src/core/analyze-plant.js";
import { placePlant } from "../src/core/place-plant.js";
import { boxWidth, boxHeight } from "../src/core/box.js";
import { parseReference, resolveCell, updateAfterRowRemoved } from "../src/references.js";
import { PACK_SIZES, multipackOutput, slotPositions } from "../src/outputs/multipack.js";

const resultsBox = document.getElementById("results");

/**
 * Real photos used as test cases. They're kept out of the public repo (see
 * .gitignore), so a missing photo returns null and its tests are skipped.
 */
async function loadFixture(name) {
  const response = await fetch(new URL(`fixtures/${name}`, import.meta.url));
  return response.ok ? createImageBitmap(await response.blob()) : null;
}
const potWithFeet = await loadFixture("pot-with-feet.webp");
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    report(`✓ ${name}`, "pass");
  } catch (error) {
    failed++;
    report(`✗ ${name}\n    ${error.message}`, "fail");
  }
}

function report(text, cls) {
  const line = document.createElement("div");
  line.className = cls;
  line.textContent = text;
  resultsBox.append(line);
}

function equal(actual, expected, label = "") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function near(actual, expected, tolerance, label = "") {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} expected ≈${expected} (±${tolerance}), got ${actual}`);
  }
}

// ---------------------------------------------------------------------------
//  Synthetic plants
// ---------------------------------------------------------------------------

/**
 * Draws a pot with leaves. `lean` pushes the leaves sideways so the plant's
 * bounding box is off-center from the pot.
 */
function makePlant({ width = 1200, height = 1500, potX = 600, lean = 0, whiteBackground = false }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (whiteBackground) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  // Leaves
  ctx.fillStyle = "#2f7d32";
  for (let i = 0; i < 9; i++) {
    const angle = (i / 8) * Math.PI;
    ctx.beginPath();
    ctx.ellipse(
      potX + Math.cos(angle) * 260 + lean,
      700 - Math.sin(angle) * 360,
      150, 60, angle, 0, Math.PI * 2,
    );
    ctx.fill();
  }

  // Pot (solid color, from y=800 to y=1300, 400px wide at the top, 300 at the base)
  ctx.fillStyle = "#b5651d";
  ctx.beginPath();
  ctx.moveTo(potX - 200, 800);
  ctx.lineTo(potX + 200, 800);
  ctx.lineTo(potX + 150, 1300);
  ctx.lineTo(potX - 150, 1300);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

// ---------------------------------------------------------------------------
//  Logic tests
// ---------------------------------------------------------------------------

test("naming: strips known suffixes and extension", () => {
  equal(baseName("Fern.png", ALL_SUFFIXES), "Fern");
  equal(baseName("Fern_SILO.png", ALL_SUFFIXES), "Fern");
  equal(baseName("Fern_SILO-2200x2200.png", ALL_SUFFIXES), "Fern");
  equal(baseName("Fern_DIM.jpg", ALL_SUFFIXES), "Fern");
  equal(baseName("Big.Fern_SILO.png", ALL_SUFFIXES), "Big.Fern");
});

test("naming: multi-pack names", () => {
  equal(baseName("Fern_4PACK.png", ALL_SUFFIXES), "Fern");
  equal(outputFileName("Fern_SILO.png", "_8PACK", ALL_SUFFIXES, ".jpg"), "Fern_8PACK.jpg");
});

test("naming: builds output file names", () => {
  equal(outputFileName("Fern_SILO.png", "_DIM", ALL_SUFFIXES, ".jpg"), "Fern_DIM.jpg");
  equal(outputFileName("Fern.png", "_SILO", ALL_SUFFIXES, ".jpg"), "Fern_SILO.jpg");
  equal(outputFileName("Fern_DIM.png", "_SILO-2200x2200", ALL_SUFFIXES, ".jpg"), "Fern_SILO-2200x2200.jpg");
});

test("csv: quotes, CRLF, Excel BOM, header case", () => {
  const text = '﻿File Name, Plant Height ,PLANT WIDTH\r\n' +
    'Fern.png,"18"" - 20""","20"", wide"\r\n' +
    '\r\n' +
    'Palm.png,30",12"';
  const rows = parseCsv(text);
  equal(rows.length, 2, "row count");
  equal(csvValue(rows[0], "FILE NAME"), "Fern.png");
  equal(csvValue(rows[0], "PLANT HEIGHT"), '18" - 20"');
  equal(csvValue(rows[0], "plant width"), '20", wide');
  equal(csvValue(rows[1], "PLANT WIDTH"), '12"');
  equal(csvHasColumn(rows, "PLANT HEIGHT"), true);
  equal(csvHasColumn(rows, "NOPE"), false);
});

test("references: parsing =N", () => {
  equal(parseReference("=1"), 1);
  equal(parseReference(" = 12 "), 12);
  equal(parseReference('14"'), null);
  equal(parseReference("=x"), null);
  equal(parseReference("1=1"), null);
  equal(parseReference(""), null);
});

test("references: resolving values, chains, and broken references", () => {
  const column = ['14"', "=1", "=2", "=9", "=6", "=5", "", "=7"];
  const resolve = (i) => resolveCell((r) => column[r], column.length, i);
  equal(resolve(0), { value: '14"' });
  equal(resolve(1), { value: '14"' }, "=1");
  equal(resolve(2), { value: '14"' }, "chain =2 → =1");
  equal(resolve(3).value, "", "missing row");
  equal(Boolean(resolve(3).error), true, "missing row error");
  equal(Boolean(resolve(4).error), true, "loop error");
  equal(resolve(7), { value: "" }, "reference to an empty row is just empty");
  equal(Boolean(resolveCell(() => "=1", 1, 0).error), true, "row refers to itself");
});

test("references: removing a row keeps references on the same images", () => {
  // Remove row 2 (index 1), whose value is 20"
  equal(updateAfterRowRemoved("=1", 1, '20"'), "=1", "earlier row unchanged");
  equal(updateAfterRowRemoved("=2", 1, '20"'), '20"', "removed row → its value");
  equal(updateAfterRowRemoved("=5", 1, '20"'), "=4", "later rows shift up");
  equal(updateAfterRowRemoved('14"', 1, '20"'), '14"', "plain text unchanged");
});

test("detection: finds bounds and pot center on a transparent PNG", () => {
  const plant = makePlant({ potX: 600, lean: 0 });
  const { bounds, potCenterX } = analyzePlant(plant, SETTINGS.detection);
  near(potCenterX, 600, 2, "potCenterX");
  near(bounds.bottom, 1300, 2, "bottom");
});

test("detection: pot center ignores lopsided leaves", () => {
  const plant = makePlant({ potX: 500, lean: 250 });
  const { bounds, potCenterX } = analyzePlant(plant, SETTINGS.detection);
  near(potCenterX, 500, 2, "potCenterX");
  // Leaves push the box's center well right of the pot
  if ((bounds.left + bounds.right) / 2 < 600) throw new Error("test plant isn't lopsided enough");
});

test("detection: works on a white background (no transparency)", () => {
  const plant = makePlant({ potX: 700, lean: -150, whiteBackground: true });
  const { potCenterX, bounds } = analyzePlant(plant, SETTINGS.detection);
  near(potCenterX, 700, 2, "potCenterX");
  near(bounds.bottom, 1300, 2, "bottom");
});

if (potWithFeet) {
  test("detection: pot with feet and a notched base (real photo)", () => {
    // tests/fixtures/pot-with-feet.webp: an empty pot shot slightly from above.
    // Its base has feet and a center notch, which used to pull the center ~150px left.
    const { bounds, potCenterX } = analyzePlant(potWithFeet, SETTINGS.detection);
    near(potCenterX, (bounds.left + bounds.right) / 2, boxWidth(bounds) * 0.01, "potCenterX");
  });
} else {
  report("– skipped real-photo tests (tests/fixtures/pot-with-feet.webp isn't on this computer)", "muted");
}

test("placement (plant mode): centers the plant's pixels, ignoring empty margins", () => {
  // Plant sits in the top-left of its image, with a lopsided pot
  const analysis = { width: 1000, height: 1000, bounds: { left: 100, top: 50, right: 500, bottom: 650 }, potCenterX: 150 };
  const frame = { left: 200, top: 200, right: 1800, bottom: 1800 };
  const p = placePlant({ analysis, frame, anchor: { x: 1000, y: 1000 }, centerOn: "plant", maxShrinkToCenterPot: 0.4 });
  near((p.plantBox.left + p.plantBox.right) / 2, 1000, 1, "plant x");
  near((p.plantBox.top + p.plantBox.bottom) / 2, 1000, 1, "plant y");
  near(p.plantBox.top, 200, 1, "fills frame height");
});

test("placement (pot mode): centers the pot on the anchor when it can", () => {
  const analysis = { width: 1000, height: 1000, bounds: { left: 100, top: 100, right: 900, bottom: 900 }, potCenterX: 500 };
  const frame = { left: 0, top: 0, right: 2000, bottom: 2000 };
  const p = placePlant({ analysis, frame, anchor: { x: 1000, y: 1000 }, centerOn: "pot", maxShrinkToCenterPot: 0.4 });
  near(p.potCenterX, 1000, 1, "pot x");
  near(p.plantBox.left, 0, 1, "fills frame");
  near(p.plantBox.right, 2000, 1, "fills frame");
});

test("placement (pot mode): off-center pot shrinks plant but keeps it centered and in frame", () => {
  const analysis = { width: 1000, height: 1000, bounds: { left: 0, top: 0, right: 1000, bottom: 1000 }, potCenterX: 300 };
  const frame = { left: 0, top: 0, right: 2000, bottom: 2000 };
  const p = placePlant({ analysis, frame, anchor: { x: 1000, y: 1000 }, centerOn: "pot", maxShrinkToCenterPot: 0.4 });
  near(p.potCenterX, 1000, 1, "pot x");
  if (p.plantBox.left < -0.5 || p.plantBox.right > 2000.5) throw new Error("plant leaves frame");
});

test("placement (pot mode): very off-center pot is nudged instead of shrunk too far", () => {
  const analysis = { width: 1000, height: 1000, bounds: { left: 0, top: 0, right: 1000, bottom: 1000 }, potCenterX: 50 };
  const frame = { left: 0, top: 0, right: 2000, bottom: 2000 };
  const p = placePlant({ analysis, frame, anchor: { x: 1000, y: 1000 }, centerOn: "pot", maxShrinkToCenterPot: 0.4 });
  near(p.scale, 2 * 0.6, 0.001, "scale");
  if (p.plantBox.left < -0.5 || p.plantBox.right > 2000.5) throw new Error("plant leaves frame");
});

test("DIM: height label stays clear of a wide plant", () => {
  // A plant much wider than tall fills the frame's width, so its left edge sits at the margin.
  const wide = document.createElement("canvas");
  wide.width = 2000;
  wide.height = 800;
  const ctx = wide.getContext("2d");
  ctx.fillStyle = "#2f7d32";
  ctx.fillRect(0, 0, 2000, 800);
  const analysis = analyzePlant(wide, SETTINGS.detection);
  const canvas = OUTPUT_TYPES.find((o) => o.id === "dim").render({
    image: wide, analysis, values: { height: '100"-120"' },
  });

  // Scan the row through the label's middle: the label must end before the plant starts.
  const y = Math.round(canvas.height / 2);
  const row = canvas.getContext("2d").getImageData(0, y, canvas.width, 1).data;
  const plantLeft = Math.round(canvas.width * SETTINGS.dim.plantMargin);
  let lastLabelPixel = -1;
  for (let x = Math.round(canvas.width * SETTINGS.dim.heightLineX); x < plantLeft - 2; x++) {
    if (row[x * 4] < 200) lastLabelPixel = x; // dark = label text
  }
  if (lastLabelPixel >= plantLeft - 10) throw new Error(`label reaches x=${lastLabelPixel}, plant starts at ${plantLeft}`);
});

// ---------------------------------------------------------------------------
//  Multi-packs
// ---------------------------------------------------------------------------

for (const count of PACK_SIZES) {
  test(`multi-pack ${count}: right number of plants, centered on the canvas`, () => {
    const layout = SETTINGS.multipack.layouts[count];
    const size = SETTINGS.multipack.sizePx;
    const slots = slotPositions(layout, size);
    equal(slots.length, count, "plants");
    near(slots.reduce((sum, s) => sum + s.x, 0) / count, size / 2, 0.5, "average x");
    const ys = slots.map((s) => s.y);
    near((Math.min(...ys) + Math.max(...ys)) / 2, size / 2, 0.5, "rows centered");
  });
}

test("multi-pack: each pot sits on its spot, even with lopsided leaves", () => {
  const plant = makePlant({ potX: 500, lean: 250 }); // leaves lean right of the pot
  const analysis = analyzePlant(plant, SETTINGS.detection);
  const canvas = multipackOutput(2).render({ image: plant, analysis });
  const slots = slotPositions(SETTINGS.multipack.layouts[2], canvas.width);

  for (const slot of slots) {
    // Look at just this plant's half of the canvas.
    const half = document.createElement("canvas");
    half.width = canvas.width / 2;
    half.height = canvas.height;
    const left = slot.x < canvas.width / 2 ? 0 : canvas.width / 2;
    half.getContext("2d").drawImage(canvas, -left, 0);
    const found = analyzePlant(half, { ...SETTINGS.detection, backgroundMode: "white" });
    near(left + found.potCenterX, slot.x, 3, "pot x");
  }
});

// ---------------------------------------------------------------------------
//  Theme contrast (reads the real colors from styles/themes.css)
// ---------------------------------------------------------------------------

const { THEMES } = await import("../src/ui/theme-picker.js");

/** WCAG contrast ratio between two CSS colors like "rgb(0, 43, 54)". */
function contrast(a, b) {
  const luminance = (color) => {
    const [r, g, b] = color.match(/\d+/g).slice(0, 3).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A theme's colors as computed rgb() strings. */
function themeColors(id) {
  const probe = document.createElement("div");
  probe.dataset.theme = id;
  document.body.append(probe);
  const colors = {};
  for (const name of ["bg", "sub-alt", "border", "sub", "text", "main", "accent", "on-main"]) {
    probe.style.color = `var(--${name})`;
    colors[name] = getComputedStyle(probe).color;
  }
  probe.remove();
  return colors;
}

for (const theme of THEMES) {
  test(`theme "${theme.name}": colors have enough contrast`, () => {
    const c = themeColors(theme.id);
    const checks = [
      ["sub", "bg", 4.5], ["sub", "sub-alt", 4.5],
      ["text", "bg", 7], ["text", "sub-alt", 7],
      ["on-main", "main", 4.5], ["accent", "sub-alt", 4.5],
      ["border", "bg", 2.2],
    ];
    for (const [fg, bg, minimum] of checks) {
      const ratio = contrast(c[fg], c[bg]);
      if (ratio < minimum) throw new Error(`--${fg} on --${bg} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`);
    }
  });
}

// ---------------------------------------------------------------------------
//  Output tests + sample renders
// ---------------------------------------------------------------------------

await document.fonts.load(`64px "${SETTINGS.dim.font}"`);

const samples = [
  { name: "centered", plant: makePlant({}) },
  { name: "lopsided leaves", plant: makePlant({ potX: 500, lean: 250 }) },
  { name: "white background", plant: makePlant({ potX: 700, lean: -150, whiteBackground: true }) },
  { name: "pot with feet (photo)", plant: potWithFeet },
].filter((sample) => sample.plant); // skips photos that aren't available
const values = { height: '18"-20"', width: '20"-22"' };

for (const sample of samples) {
  const analysis = analyzePlant(sample.plant, SETTINGS.detection);

  for (const output of OUTPUT_TYPES) {
    const canvas = output.render({ image: sample.plant, analysis, values });

    test(`${output.label} / ${sample.name}: correct size`, () => {
      if (output.id === "silo") {
        near(canvas.width / canvas.height, 5 / 7, 0.002, "aspect");
      } else {
        equal([canvas.width, canvas.height], [2200, 2200]);
      }
    });

    test(`${output.label} / ${sample.name}: centered (${SETTINGS[output.id].centerOn} mode)`, () => {
      // Render without labels, and for DIM look only inside the margin, so the
      // dimension lines and labels don't count as "plant".
      const unlabeled = output.render({ image: sample.plant, analysis });
      const inset = output.id === "dim" ? Math.round(canvas.width * (SETTINGS.dim.plantMargin - 0.01)) : 0;
      const area = document.createElement("canvas");
      area.width = canvas.width - 2 * inset;
      area.height = canvas.height - 2 * inset;
      area.getContext("2d").drawImage(unlabeled, -inset, -inset);

      const found = analyzePlant(area, { ...SETTINGS.detection, backgroundMode: "white" });
      const x = inset + (SETTINGS[output.id].centerOn === "pot"
        ? found.potCenterX
        : (found.bounds.left + found.bounds.right) / 2);
      const y = inset + (found.bounds.top + found.bounds.bottom) / 2;
      near(x, canvas.width / 2, canvas.width * 0.01, "x");
      near(y, canvas.height / 2, canvas.height * 0.01, "y");
    });

    const figure = document.createElement("figure");
    canvas.style.background = "#fff";
    figure.append(canvas);
    figure.insertAdjacentHTML("beforeend", `<figcaption>${output.label} – ${sample.name} (${canvas.width}×${canvas.height})</figcaption>`);
    document.getElementById("samples").append(figure);
  }
}

report(`\n${passed} passed, ${failed} failed`, failed ? "fail" : "pass");
window.testSummary = { passed, failed };
