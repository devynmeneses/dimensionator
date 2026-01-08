// -----------------------------
// Tabs
// -----------------------------
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// -----------------------------
// Utilities
// -----------------------------

let renderFontReady = null;

function loadRenderFont() {
  if (!renderFontReady) {
    renderFontReady = document.fonts.load('64px "din2014"');
  }
  return renderFontReady;
}

function computePotCenterXRimBased(imageData, bbox, opts = {}) {
  const { data, width: w } = imageData;

  const alphaMin = opts.alphaMin ?? 10;
  const minRunFrac = opts.minRunFrac ?? 0.25; // rim must be wide
  const colorVarMax = opts.colorVarMax ?? 18;

  const { left, right, bottom, top } = bbox;
  const bboxW = right - left;
  const minRun = Math.floor(bboxW * minRunFrac);

  // Scan upward from bottom
  for (let y = bottom - 1; y >= top; y--) {
    const rowBase = y * w * 4;

    let runStart = null;

    for (let x = left; x < right; x++) {
      const idx = rowBase + x * 4;
      const a = data[idx + 3];

      if (a > alphaMin) {
        if (runStart === null) runStart = x;
      } else if (runStart !== null) {
        const runEnd = x - 1;
        const runW = runEnd - runStart + 1;

        if (runW >= minRun) {
          // check color variance across the run
          let rSum = 0, gSum = 0, bSum = 0;
          for (let i = runStart; i <= runEnd; i++) {
            const ii = rowBase + i * 4;
            rSum += data[ii];
            gSum += data[ii + 1];
            bSum += data[ii + 2];
          }
          const n = runW;
          const rAvg = rSum / n, gAvg = gSum / n, bAvg = bSum / n;

          let varSum = 0;
          for (let i = runStart; i <= runEnd; i++) {
            const ii = rowBase + i * 4;
            varSum += Math.abs(data[ii] - rAvg);
            varSum += Math.abs(data[ii + 1] - gAvg);
            varSum += Math.abs(data[ii + 2] - bAvg);
          }

          const colorVar = varSum / (n * 3);
          if (colorVar <= colorVarMax) {
            // Found pot rim
            return (runStart + runEnd) / 2;
          }
        }

        runStart = null;
      }
    }
  }

  return null;
}


function computePotCenterXFromBBox(imageData, bbox, opts = {}) {
  const { data, width: w, height: h } = imageData;

  const alphaMin   = opts.alphaMin ?? 10;
  const potFrac    = opts.potFrac ?? 0.38;   // bottom ~38% of the plant bbox height
  const minRunFrac = opts.minRunFrac ?? 0.10; // run must be >= 10% of bbox width
  const keepRowFrac= opts.keepRowFrac ?? 0.72; // keep rows within 72% of max run

  const left = bbox.left, right = bbox.right, top = bbox.top, bottom = bbox.bottom;
  const bboxW = Math.max(1, right - left);
  const bboxH = Math.max(1, bottom - top);

  const yStart = Math.floor(bottom - bboxH * potFrac);
  const minRun = Math.max(2, Math.floor(bboxW * minRunFrac));

  let globalBestW = 0;
  const rows = []; // { xMid, runW }

  for (let y = yStart; y < bottom; y++) {
    const rowBase = y * w * 4;

    let bestW = 0;
    let bestMid = null;

    let inRun = false;
    let runStart = 0;

    for (let x = left; x < right; x++) {
      const a = data[rowBase + x * 4 + 3];
      const fg = a > alphaMin;

      if (fg && !inRun) {
        inRun = true;
        runStart = x;
      } else if (!fg && inRun) {
        inRun = false;
        const runEnd = x - 1;
        const runW = runEnd - runStart + 1;

        if (runW >= minRun && runW > bestW) {
          bestW = runW;
          bestMid = (runStart + runEnd) / 2;
        }
      }
    }

    if (inRun) {
      const runEnd = right - 1;
      const runW = runEnd - runStart + 1;
      if (runW >= minRun && runW > bestW) {
        bestW = runW;
        bestMid = (runStart + runEnd) / 2;
      }
    }

    if (bestMid != null) {
      rows.push({ xMid: bestMid, runW: bestW });
      if (bestW > globalBestW) globalBestW = bestW;
    }
  }

  if (!rows.length || globalBestW === 0) return null;

  const keepW = globalBestW * keepRowFrac;

  let sumX = 0, sumW = 0;
  for (const r of rows) {
    if (r.runW >= keepW) {
      sumX += r.xMid * r.runW;
      sumW += r.runW;
    }
  }

  if (sumW === 0) return null;
  return sumX / sumW; // X in imageData coordinates (0..w)
}

function debounce(fn, ms = 200) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function pad2(n) { return String(n).padStart(2, "0"); }
function timestampFolderName(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function stripSiloSuffix(stem) {
  if (stem.endsWith("_SILO-2200x2200")) return stem.slice(0, -"_SILO-2200x2200".length);
  if (stem.endsWith("_SILO")) return stem.slice(0, -"_SILO".length);
  return stem;
}

function makeDimName(originalName) {
  // originalName: filename with extension
  const dot = originalName.lastIndexOf(".");
  const stem = dot >= 0 ? originalName.slice(0, dot) : originalName;
  const clean = stripSiloSuffix(stem);
  return `${clean}_DIM.jpg`;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function canvasToJpegBlob(canvas, quality = 1) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

// Simple CSV parsing with quoted fields support (enough for typical cases)
function parseCSV(text) {
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;

  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { rows.push(row); row = []; };

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i+1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ",") { pushField(); i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { pushField(); pushRow(); i++; continue; }
      field += c; i++; continue;
    }
  }
  // final
  pushField();
  if (row.length > 1 || row[0] !== "") pushRow();

  const headers = rows.shift().map(h => h.trim());
  return rows
    .filter(r => r.some(x => (x ?? "").trim() !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, idx) => obj[h] = (r[idx] ?? "").trim());
      return obj;
    });
}



// -----------------------------
// Foreground bounding box
// -----------------------------
// Returns {left, top, right, bottom} in image coordinates
function foregroundBBoxFromImageData(imageData, mode, whiteThreshold) {
  const { data, width, height } = imageData;

  let hasTransparency = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) { hasTransparency = true; break; }
  }

  const useAlpha = (mode === "alpha") || (mode === "auto" && hasTransparency);
  const useWhite = (mode === "white") || (mode === "auto" && !hasTransparency);

  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];

      let fg = false;
      if (useAlpha) {
        fg = a > 10;
      } else if (useWhite) {
        // foreground if NOT near-white
        fg = !(r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold);
      }

      if (fg) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    // nothing found
    return null;
  }

  // right/bottom are exclusive for convenience
  return { left: minX, top: minY, right: maxX + 1, bottom: maxY + 1 };
}

// -----------------------------
// Rendering
// -----------------------------
function renderComposite({
  sourceImg,                 // HTMLImageElement
  heightLabel,
  widthLabel,
  outSize,
  bgMode = "auto",
  whiteThreshold = 245
}) {
  const target = outSize;

  // Create output canvas
  const out = document.createElement("canvas");
  out.width = target;
  out.height = target;
  const ctx = out.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, target, target);

  // Style ratios (match your Python defaults)
  const marginLeft = Math.floor(target * 0.16);
  const marginBottom = Math.floor(target * 0.16);
  const pad = Math.floor(target * 0.08);
  const lineW = Math.max(2, Math.floor(target * 0.004));
  const labelGap = Math.floor(target * 0.018);

  const FONT_SCALE = 0.25; // ← tweak this number for font size
  const fontSize = Math.max(32, Math.floor(marginBottom * FONT_SCALE));

  // Fit plant into (target - margins) area for scale
  const plantAreaW = target - marginLeft;
  const plantAreaH = target - marginBottom;
  const maxW = Math.max(1, plantAreaW - 2 * pad);
  const maxH = Math.max(1, plantAreaH - 2 * pad);

  let scale = Math.min(maxW / sourceImg.width, maxH / sourceImg.height);
  let newW = Math.max(1, Math.floor(sourceImg.width * scale));
  let newH = Math.max(1, Math.floor(sourceImg.height * scale));

  const half = target / 2;

  function buildAnalysisCanvas() {
    const c = document.createElement("canvas");
    c.width = newW;
    c.height = newH;
    const cctx = c.getContext("2d", { willReadFrequently: true });
    cctx.clearRect(0, 0, newW, newH);
    cctx.drawImage(sourceImg, 0, 0, newW, newH);
    return { c, cctx };
  }

  let plantC, pctx, imgData, bbox, potCenterX;

  for (let iter = 0; iter < 5; iter++) {
    ({ c: plantC, cctx: pctx } = buildAnalysisCanvas());

    imgData = pctx.getImageData(0, 0, newW, newH);
    bbox = foregroundBBoxFromImageData(imgData, bgMode, whiteThreshold);

    // fallback bbox = whole image if nothing found
    if (!bbox) bbox = { left: 0, top: 0, right: newW, bottom: newH };

    potCenterX = computePotCenterXRimBased(imgData, bbox, {
      alphaMin: 10,
      minRunFrac: 0.25,
      colorVarMax: 18
    });


    if (potCenterX == null) potCenterX = newW / 2;

    const x0Ideal = Math.floor(half - potCenterX);

    // If it fits with padding, we’re done
    if (x0Ideal >= pad && x0Ideal <= target - pad - newW) {
      break;
    }

    // Otherwise scale down a bit and try again
    // (keep aspect ratio, preserve pot-centered intent)
    const shrink = 0.92; // gentle shrink per iteration
    scale *= shrink;
    newW = Math.max(1, Math.floor(sourceImg.width * scale));
    newH = Math.max(1, Math.floor(sourceImg.height * scale));
  }

  // Now place pot-centered (with final safety clamp)
  const x0Ideal = Math.floor(half - potCenterX);
  const x0 = Math.max(pad, Math.min(x0Ideal, target - pad - newW));
  const y0 = Math.max(pad, Math.min(Math.floor((target - newH) / 2), target - pad - newH));

  ctx.drawImage(sourceImg, x0, y0, newW, newH);

  // DEBUG: visualize computed pot center
  //ctx.save();
  //ctx.strokeStyle = "red";
  //ctx.lineWidth = 2;
  //ctx.beginPath();
  //ctx.moveTo(x0 + potCenterX, 0);
  //ctx.lineTo(x0 + potCenterX, target);
  //ctx.stroke();
  //ctx.restore();



  // Use the bbox we computed in the loop
  let left = bbox.left, top = bbox.top, right = bbox.right, bottom = bbox.bottom;

  if (bbox) ({ left, top, right, bottom } = bbox);


  // Translate bbox into output coordinates
  const plantLeft = x0 + left;
  const plantTop = y0 + top;
  const plantRight = x0 + right;
  const plantBottom = y0 + bottom;

  const edgePad = Math.max(2, Math.floor(target * 0.005));

  // Dimension extents based on foreground pixels
  const vyTop = plantTop + edgePad;
  const vyBot = plantBottom - edgePad;
  const hxLeft = plantLeft + edgePad;
  const hxRight = plantRight - edgePad;

  // Draw annotations (overlay last conceptually; here we just draw after plant)
  ctx.lineWidth = lineW;
  ctx.strokeStyle = "rgb(120,120,120)";
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.font = `${fontSize}px din2014, sans-serif`;
  ctx.textBaseline = "top";

  // Left vertical dimension line X
  let vx = Math.floor(marginLeft / 2);

  // Height label: horizontal, centered on line; ensure label isn't clipped
  if (heightLabel && heightLabel.trim().length > 0) {
    const textW = ctx.measureText(heightLabel).width;
    const th = fontSize;
    const padding = Math.max(6, Math.floor(th / 3));
    const clearance = Math.floor(th * 0.75);

    const cy = Math.floor((vyTop + vyBot) / 2);

    const tx = Math.floor(vx - textW / 2);
    const ty = Math.floor(cy - th / 2);


    // split line around the label (line position stays vx)
    const topEnd = ty - clearance;
    const botStart = ty + th + clearance;

    ctx.beginPath();
    if (topEnd > vyTop) {
      ctx.moveTo(vx, vyTop);
      ctx.lineTo(vx, topEnd);
    }
    if (botStart < vyBot) {
      ctx.moveTo(vx, botStart);
      ctx.lineTo(vx, vyBot);
    }
    ctx.stroke();

    // knockout + text
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(tx - padding, ty - padding, textW + 2 * padding, th + 2 * padding);
    ctx.fillStyle = "#000000";
    ctx.fillText(heightLabel, tx, ty);

  } else {
    // No label: full line stays fixed
    ctx.beginPath();
    ctx.moveTo(vx, vyTop);
    ctx.lineTo(vx, vyBot);
    ctx.stroke();
  }

  // Bottom horizontal dimension line + label (anchored to pot center axis)
  const hy = target - Math.floor(marginBottom / 2);
  const potAxisX = Math.floor(x0 + potCenterX);

  if (widthLabel && widthLabel.trim().length > 0) {
    const label = widthLabel.trim();
    const textW = ctx.measureText(label).width;
    const th = fontSize;
    const padding = Math.max(6, Math.floor(th / 4));

    // Center the TEXT on the pot axis
    let tx = Math.floor(potAxisX - textW / 2);
    const ty = Math.floor(hy - th / 2);

    // Knockout rect bounds
    const boxL = tx - padding;
    const boxR = tx + textW + padding;

    // Keep the label box from going outside the dimension span
    // If it would, clamp tx and shift box accordingly.
    if (boxL < hxLeft) {
      tx += (hxLeft - boxL);
    } else if (boxR > hxRight) {
      tx -= (boxR - hxRight);
    }

    const adjBoxL = tx - padding;
    const adjBoxR = tx + textW + padding;

    // Draw the line in two segments, leaving a gap under the label box
    ctx.beginPath();
    if (adjBoxL > hxLeft) {
      ctx.moveTo(hxLeft, hy);
      ctx.lineTo(adjBoxL, hy);
    }
    if (adjBoxR < hxRight) {
      ctx.moveTo(adjBoxR, hy);
      ctx.lineTo(hxRight, hy);
    }
    ctx.stroke();

    // Draw knockout + text
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(adjBoxL, ty - padding, (adjBoxR - adjBoxL), th + 2 * padding);
    ctx.fillStyle = "#000000";
    ctx.fillText(label, tx, ty);

  } else {
    // No label: draw full line
    ctx.beginPath();
    ctx.moveTo(hxLeft, hy);
    ctx.lineTo(hxRight, hy);
    ctx.stroke();
  }


  return out;
}

// -----------------------------
// Single mode
// -----------------------------
const singleImage = document.getElementById("singleImage");
const heightLabelEl = document.getElementById("heightLabel");
const widthLabelEl = document.getElementById("widthLabel");
const singleSize = document.getElementById("singleSize");
const bgMode = document.getElementById("bgMode");

const singleImageBtn = document.getElementById("singleImageBtn");
const singleImageName = document.getElementById("singleImageName");

const preview = document.getElementById("preview");
const pctx = preview.getContext("2d");

const downloadSingleBtn = document.getElementById("downloadSingle");

let singleFile = null;
let lastSingleCanvas = null;

singleImage.addEventListener("change", () => {
  singleFile = singleImage.files?.[0] || null;

  singleImageName.textContent = singleFile
  ? singleFile.name
  : "No file selected";

  // reset cached image + UI
  singleImgEl = null;
  singleImgUrl = null;
  lastSingleCanvas = null;

  downloadSingleBtn.disabled = true;
  downloadSingleBtn.classList.remove("Primary");

  renderSingleNow();
});

singleImageBtn.addEventListener("click", () => {
  singleImage.click();
});

let singleImgEl = null;          // cached decoded image element
let singleImgUrl = null;         // for object URL cleanup

async function renderSingleNow() {
  if (!singleFile) {
    // Clear preview if no file
    pctx.clearRect(0, 0, preview.width, preview.height);
    downloadSingleBtn.disabled = true;
    downloadSingleBtn.classList.remove("primary");
    return;
  }

  await loadRenderFont();

  // Load image once per file selection
  if (!singleImgEl) {
    try {
      // Use object URL and cache the decoded image
      singleImgUrl = URL.createObjectURL(singleFile);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = singleImgUrl;
      });
      singleImgEl = img;
    } catch (e) {
      alert("Could not load image.");
      downloadSingleBtn.disabled = true;
      return;
    }
  }

  const outSize = parseInt(singleSize.value, 10);
  const canvas = renderComposite({
    sourceImg: singleImgEl,
    heightLabel: heightLabelEl.value.trim(),
    widthLabel: widthLabelEl.value.trim(),
    outSize,
    bgMode: bgMode.value,
    whiteThreshold: 245
  });

  lastSingleCanvas = canvas;

  // Draw to preview canvas
  preview.width = canvas.width;
  preview.height = canvas.height;
  pctx.clearRect(0, 0, preview.width, preview.height);
  pctx.drawImage(canvas, 0, 0);

  downloadSingleBtn.disabled = false;
  downloadSingleBtn.classList.add("primary");
}

const renderSingleDebounced = debounce(renderSingleNow, 200);

// File upload -> load & render immediately
singleImage.addEventListener("change", () => {
  // Cleanup prior object URL
  if (singleImgUrl) URL.revokeObjectURL(singleImgUrl);

  singleFile = singleImage.files?.[0] || null;
  singleImgEl = null;
  singleImgUrl = null;
  lastSingleCanvas = null;

  downloadSingleBtn.disabled = true;
  downloadSingleBtn.classList.remove("primary");

  renderSingleNow();
});

// Any input change -> re-render (debounced for typing)
heightLabelEl.addEventListener("input", renderSingleDebounced);
widthLabelEl.addEventListener("input", renderSingleDebounced);
singleSize.addEventListener("change", renderSingleNow);
bgMode.addEventListener("change", renderSingleNow);



downloadSingleBtn.addEventListener("click", async () => {
  if (!lastSingleCanvas || !singleFile) return;

  const blob = await canvasToJpegBlob(lastSingleCanvas, 0.95);
  const name = makeDimName(singleFile.name);

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
});

// -----------------------------
// Batch mode
// -----------------------------
const batchFolderBtn = document.getElementById("batchFolderBtn");
const batchFolderName = document.getElementById("batchFolderName");

const batchFolder = document.getElementById("batchFolder");
const batchSize = document.getElementById("batchSize");
const whiteThresholdEl = document.getElementById("whiteThreshold");
const runBatchBtn = document.getElementById("runBatch");
const batchLog = document.getElementById("batchLog");

batchFolderBtn.addEventListener("click", () => {
  batchFolder.click();
});

let batchFiles = [];

function log(msg) {
  batchLog.textContent += msg + "\n";
  batchLog.scrollTop = batchLog.scrollHeight;
}

batchFolder.addEventListener("change", () => {
  batchFiles = Array.from(batchFolder.files || []);
  batchLog.textContent = "";

  // Update label text
  if (batchFiles.length > 0) {
    // Try to infer folder name from first file path
    const firstPath = batchFiles[0].webkitRelativePath || "";
    const folderName = firstPath.split("/")[0] || "Folder selected";
    batchFolderName.textContent = `${folderName} (${batchFiles.length} files)`;

    batchFolderBtn.classList.add("primary");
  } else {
    batchFolderName.textContent = "No folder selected";
    batchFolderBtn.classList.remove("primary");
  }

  const hasCsv = batchFiles.some(f => f.name.toLowerCase().endsWith(".csv"));
  runBatchBtn.disabled = !hasCsv;

  log(`Selected ${batchFiles.length} files.`);
  log(hasCsv ? "CSV detected. Ready to run." : "No CSV detected in selection.");
});

runBatchBtn.addEventListener("click", async () => {
  await loadRenderFont();

  if (!batchFiles.length) return;

  const outSize = parseInt(batchSize.value, 10);
  const whiteThreshold = parseInt(whiteThresholdEl.value, 10) || 245;

  // Find CSV
  const csvFile = batchFiles.find(f => f.name.toLowerCase().endsWith(".csv"));
  if (!csvFile) {
    alert("No CSV found in selected folder.");
    return;
  }

  log(`Using CSV: ${csvFile.name}`);

  const csvText = await csvFile.text();
  const rows = parseCSV(csvText);

  // Validate headers (like your example)
  const required = ["input_name", "PlantHeight", "PlantWidth"];
  for (const h of required) {
    if (!(h in (rows[0] || {}))) {
      alert(`CSV missing required column: ${h}`);
      return;
    }
  }

  // Index images by name and stem
  const imagesByName = new Map();
  const imagesByStem = new Map();
  for (const f of batchFiles) {
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
      imagesByName.set(f.name, f);
      const stem = f.name.replace(/\.[^.]+$/, "");
      imagesByStem.set(stem, f);
    }
  }

  const zip = new JSZip();
  const folderName = timestampFolderName(new Date());
  const outFolder = zip.folder(folderName);

  let ok = 0, fail = 0;

  log(`Processing ${rows.length} rows...`);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const inputName = (r["input_name"] || "").trim();
    const h = (r["PlantHeight"] || "").trim();
    const w = (r["PlantWidth"] || "").trim();

    if (!inputName) {
      fail++;
      log(`[${i+1}] SKIP: empty input_name`);
      continue;
    }

    // Match by exact name OR stem
    const stem = inputName.replace(/\.[^.]+$/, "");
    const file = imagesByName.get(inputName) || imagesByStem.get(stem);

    if (!file) {
      fail++;
      log(`[${i+1}] FAIL: image not found for "${inputName}"`);
      continue;
    }

    try {
      const img = await loadImageFromFile(file);
      const canvas = renderComposite({
        sourceImg: img,
        heightLabel: h,
        widthLabel: w,
        outSize,
        bgMode: "auto",
        whiteThreshold
      });

      const blob = await canvasToJpegBlob(canvas, 0.95);
      const outName = makeDimName(file.name);

      outFolder.file(outName, blob);

      ok++;
      log(`[${i+1}] OK: ${file.name} -> ${outName}`);
    } catch (e) {
      fail++;
      log(`[${i+1}] FAIL: ${file.name} (${e})`);
    }
  }

  log("");
  log(`Done. Success: ${ok} | Failed: ${fail}`);
  log("Generating ZIP...");

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(zipBlob);
  a.download = `Plant_DIM_${folderName}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
});
