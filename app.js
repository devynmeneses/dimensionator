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
// Config (UI removed; change here)
// -----------------------------
const CFG = {
  DIM_SIZE: 2200,
  WEB_SIZE: 2200,
  BG_MODE: "auto",
  WHITE_THRESHOLD: 245,

  // Visual ratios
  MARGIN_LEFT_RATIO: 0.16,
  MARGIN_BOTTOM_RATIO: 0.16,
  PAD_RATIO: 0.08,
  LINE_W_RATIO: 0.004,

  // Web/Silo padding
  WEB_PAD_RATIO: 0.08,
  SILO_PAD_RATIO: 0.045,

  // Font
  FONT_SCALE: 0.25
};

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

function stripSuffixesForDim(stem) {
  if (stem.endsWith("_SILO-2200x2200")) stem = stem.slice(0, -"_SILO-2200x2200".length);
  if (stem.endsWith("_SILO")) stem = stem.slice(0, -"_SILO".length);
  if (stem.endsWith("_DIM")) stem = stem.slice(0, -"_DIM".length);
  return stem;
}
function stripSuffixesForSilo(stem) {
  if (stem.endsWith("_SILO-2200x2200")) stem = stem.slice(0, -"_SILO-2200x2200".length);
  if (stem.endsWith("_DIM")) stem = stem.slice(0, -"_DIM".length);
  // keep _SILO if already there
  return stem;
}
function stripSuffixesForWeb(stem) {
  if (stem.endsWith("_SILO")) stem = stem.slice(0, -"_SILO".length);
  if (stem.endsWith("_DIM")) stem = stem.slice(0, -"_DIM".length);
  // keep _SILO-2200x2200 if already there
  return stem;
}

function stemFromName(name) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(0, dot) : name;
}

function makeDimName(originalName) {
  const stem = stripSuffixesForDim(stemFromName(originalName));
  return `${stem}_DIM.jpg`;
}
function makeSiloName(originalName) {
  let stem = stripSuffixesForSilo(stemFromName(originalName));
  if (!stem.endsWith("_SILO")) stem = `${stem}_SILO`;
  return `${stem}.jpg`;
}
function makeWebName(originalName) {
  let stem = stripSuffixesForWeb(stemFromName(originalName));
  if (!stem.endsWith("_SILO-2200x2200")) stem = `${stem}_SILO-2200x2200`;
  return `${stem}.jpg`;
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

// Simple CSV parsing with quoted fields support
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

  if (maxX < 0) return null;
  return { left: minX, top: minY, right: maxX + 1, bottom: maxY + 1 };
}

// -----------------------------
// Pot center (rim-based)
// -----------------------------
function computePotCenterXRimBased(imageData, bbox, opts = {}) {
  const { data, width: w } = imageData;

  const alphaMin = opts.alphaMin ?? 10;
  const minRunFrac = opts.minRunFrac ?? 0.25;
  const colorVarMax = opts.colorVarMax ?? 18;

  const { left, right, bottom, top } = bbox;
  const bboxW = right - left;
  const minRun = Math.floor(bboxW * minRunFrac);

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
            return (runStart + runEnd) / 2;
          }
        }

        runStart = null;
      }
    }
  }

  return null;
}

// -----------------------------
// Shared: pot-centered placement + bbox analysis
// -----------------------------
function analyzeResized(sourceImg, newW, newH, bgMode, whiteThreshold) {
  const c = document.createElement("canvas");
  c.width = newW;
  c.height = newH;
  const cctx = c.getContext("2d", { willReadFrequently: true });
  cctx.clearRect(0, 0, newW, newH);
  cctx.drawImage(sourceImg, 0, 0, newW, newH);

  const imgData = cctx.getImageData(0, 0, newW, newH);
  let bbox = foregroundBBoxFromImageData(imgData, bgMode, whiteThreshold);
  if (!bbox) bbox = { left: 0, top: 0, right: newW, bottom: newH };

  let potCenterX = computePotCenterXRimBased(imgData, bbox, {
    alphaMin: 10,
    minRunFrac: 0.25,
    colorVarMax: 18
  });
  if (potCenterX == null) potCenterX = newW / 2;

  return { bbox, potCenterX };
}

function fitAndPlacePotCentered({
  sourceImg,
  targetW,
  targetH,
  pad,
  bgMode,
  whiteThreshold
}) {
  // Fit image into inner box, then compute pot center on resized, then place pot-centered
  const maxW = Math.max(1, targetW - 2 * pad);
  const maxH = Math.max(1, targetH - 2 * pad);

  let scale = Math.min(maxW / sourceImg.width, maxH / sourceImg.height);
  let newW = Math.max(1, Math.floor(sourceImg.width * scale));
  let newH = Math.max(1, Math.floor(sourceImg.height * scale));

  const halfX = targetW / 2;

  let bbox = null;
  let potCenterX = newW / 2;

  for (let iter = 0; iter < 6; iter++) {
    const a = analyzeResized(sourceImg, newW, newH, bgMode, whiteThreshold);
    bbox = a.bbox;
    potCenterX = a.potCenterX;

    const x0Ideal = Math.floor(halfX - potCenterX);
    if (x0Ideal >= pad && x0Ideal <= targetW - pad - newW) break;

    // shrink and retry if it can't be placed with padding
    scale *= 0.92;
    newW = Math.max(1, Math.floor(sourceImg.width * scale));
    newH = Math.max(1, Math.floor(sourceImg.height * scale));
  }

  const x0Ideal = Math.floor(halfX - potCenterX);
  const x0 = Math.max(pad, Math.min(x0Ideal, targetW - pad - newW));
  const y0 = Math.max(pad, Math.min(Math.floor((targetH - newH) / 2), targetH - pad - newH));

  return { newW, newH, x0, y0, bbox, potCenterX };
}

// -----------------------------
// Renderers
// -----------------------------
function renderDim({ sourceImg, heightLabel = "", widthLabel = "" }) {
  const target = CFG.DIM_SIZE;

  // Output canvas
  const out = document.createElement("canvas");
  out.width = target;
  out.height = target;
  const ctx = out.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, target, target);

  // Layout (same vibe as the original working version)
  const marginLeft = Math.floor(target * CFG.MARGIN_LEFT_RATIO);
  const marginBottom = Math.floor(target * CFG.MARGIN_BOTTOM_RATIO);

  // Slightly tighter inner padding just for DIM to "zoom in"
  const pad = Math.floor(target * (CFG.PAD_RATIO * 0.15));

  const lineW = Math.max(2, Math.floor(target * CFG.LINE_W_RATIO));
  const fontSize = Math.max(32, Math.floor(marginBottom * CFG.FONT_SCALE));

  // The area the plant must fit into (reserving left and bottom zones)
  const plantAreaW = target - marginLeft;
  const plantAreaH = target - marginBottom;

  const maxW = Math.max(1, plantAreaW - 2 * pad);
  const maxH = Math.max(1, plantAreaH - 2 * pad);

  // Base scale to fit (will shrink further if centered placement would violate constraints)
  let scale = Math.min(maxW / sourceImg.width, maxH / sourceImg.height);
  let newW = 1, newH = 1;

  // We'll compute bbox + potCenterX at the final chosen scale
  let bbox = null;
  let potCenterX = null;

  function analyzeAtSize(w, h) {
    const ac = document.createElement("canvas");
    ac.width = w;
    ac.height = h;
    const actx = ac.getContext("2d", { willReadFrequently: true });

    actx.clearRect(0, 0, w, h);
    actx.drawImage(sourceImg, 0, 0, w, h);

    const imgData = actx.getImageData(0, 0, w, h);
    let bb = foregroundBBoxFromImageData(imgData, CFG.BG_MODE, CFG.WHITE_THRESHOLD);
    if (!bb) bb = { left: 0, top: 0, right: w, bottom: h };

    let pcx = computePotCenterXRimBased(imgData, bb, {
      alphaMin: 10,
      minRunFrac: 0.25,
      colorVarMax: 18
    });
    if (pcx == null) pcx = w / 2;

    return { bb, pcx };
  }

  const halfX = target / 2;
  const halfY = target / 2;

  // Constraints: keep plant out of left/bottom zones, but maintain "centered" composition
  const minX0_base = marginLeft + pad;
  const minY0_base = pad;

  // Key behavior: if ideal centered placement doesn't fit, shrink slightly and retry
  for (let iter = 0; iter < 7; iter++) {
    newW = Math.max(1, Math.floor(sourceImg.width * scale));
    newH = Math.max(1, Math.floor(sourceImg.height * scale));

    const analysis = analyzeAtSize(newW, newH);
    bbox = analysis.bb;
    potCenterX = analysis.pcx;

    // Ideal placement:
    // - X centered by pot axis
    // - Y centered by whole image height
    const x0Ideal = Math.floor(halfX - potCenterX);
    const y0Ideal = Math.floor(halfY - newH / 2);

    const maxX0 = target - pad - newW;
    const maxY0 = target - marginBottom - pad - newH;

    const xFits = x0Ideal >= minX0_base && x0Ideal <= maxX0;
    const yFits = y0Ideal >= minY0_base && y0Ideal <= maxY0;

    if (xFits && yFits) break;

    // Shrink a touch and try again (prevents "top-right drift")
    scale *= 0.92;
  }

  // Final placement (safety clamp)
  const x0Ideal = Math.floor(halfX - potCenterX);
  const y0Ideal = Math.floor(halfY - newH / 2);

  const minX0 = marginLeft + pad;
  const maxX0 = target - pad - newW;

  const minY0 = pad;
  const maxY0 = target - marginBottom - pad - newH;

  const x0 = Math.max(minX0, Math.min(x0Ideal, maxX0));
  const y0 = Math.max(minY0, Math.min(y0Ideal, maxY0));

  // Draw plant
  ctx.drawImage(sourceImg, x0, y0, newW, newH);

  // Use bbox (foreground pixels) to set line extents
  const plantLeft = x0 + bbox.left;
  const plantTop = y0 + bbox.top;
  const plantRight = x0 + bbox.right;
  const plantBottom = y0 + bbox.bottom;

  const edgePad = Math.max(2, Math.floor(target * 0.005));

  const vyTop = plantTop + edgePad;
  const vyBot = plantBottom - edgePad;
  const hxLeft = plantLeft + edgePad;
  const hxRight = plantRight - edgePad;

  // Annotation style
  ctx.lineWidth = lineW;
  ctx.strokeStyle = "rgb(120,120,120)";
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.font = `${fontSize}px din2014, sans-serif`;
  ctx.textBaseline = "top";

  // Fixed vertical line X (does not move with label)
  const vx = Math.floor(marginLeft / 2);

  // ----- Height (left) -----
  const hLabel = (heightLabel || "").trim();
  if (hLabel.length > 0) {
    const textW = ctx.measureText(hLabel).width;
    const th = fontSize;
    const padding = Math.max(6, Math.floor(th / 3));
    const clearance = Math.floor(th * 0.75);

    const cy = Math.floor((vyTop + vyBot) / 2);
    const tx = Math.floor(vx - textW / 2);
    const ty = Math.floor(cy - th / 2);

    // split line around the label (line stays fixed at vx)
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
    ctx.fillText(hLabel, tx, ty);
  } else {
    // no label: full line
    ctx.beginPath();
    ctx.moveTo(vx, vyTop);
    ctx.lineTo(vx, vyBot);
    ctx.stroke();
  }

  // ----- Width (bottom) -----
  const hy = target - Math.floor(marginBottom / 2);
  const potAxisX = Math.floor(x0 + potCenterX);

  const wLabel = (widthLabel || "").trim();
  if (wLabel.length > 0) {
    const textW = ctx.measureText(wLabel).width;
    const th = fontSize;
    const padding = Math.max(6, Math.floor(th / 4));

    // center label on pot axis
    let tx = Math.floor(potAxisX - textW / 2);
    const ty = Math.floor(hy - th / 2);

    // label box
    const boxL = tx - padding;
    const boxR = tx + textW + padding;

    // keep label box within the line extents
    if (boxL < hxLeft) tx += (hxLeft - boxL);
    else if (boxR > hxRight) tx -= (boxR - hxRight);

    const adjBoxL = tx - padding;
    const adjBoxR = tx + textW + padding;

    // line segments with gap under label
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

    // knockout + text
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(adjBoxL, ty - padding, (adjBoxR - adjBoxL), th + 2 * padding);
    ctx.fillStyle = "#000000";
    ctx.fillText(wLabel, tx, ty);
  } else {
    // no label: full line
    ctx.beginPath();
    ctx.moveTo(hxLeft, hy);
    ctx.lineTo(hxRight, hy);
    ctx.stroke();
  }

  return out;
}



function renderWeb({ sourceImg }) {
  const target = CFG.WEB_SIZE;

  // Analyze at native resolution to use plant pixels (bbox)
  const c = document.createElement("canvas");
  c.width = sourceImg.width;
  c.height = sourceImg.height;
  const cctx = c.getContext("2d", { willReadFrequently: true });
  cctx.clearRect(0, 0, c.width, c.height);
  cctx.drawImage(sourceImg, 0, 0);

  const imgData = cctx.getImageData(0, 0, c.width, c.height);

  // Foreground bbox from PLANT pixels
  let bbox = foregroundBBoxFromImageData(imgData, CFG.BG_MODE, CFG.WHITE_THRESHOLD);
  if (!bbox) bbox = { left: 0, top: 0, right: c.width, bottom: c.height };

  // Pot center from POT pixels (rim-based)
  let potCenterX = computePotCenterXRimBased(imgData, bbox, {
    alphaMin: 10,
    minRunFrac: 0.25,
    colorVarMax: 18
  });
  if (potCenterX == null) potCenterX = (bbox.left + bbox.right) / 2;

  // Plant pixel dimensions (bbox)
  const plantW = Math.max(1, bbox.right - bbox.left);
  const plantH = Math.max(1, bbox.bottom - bbox.top);

  // Padding computed from PLANT pixels, clamped
  // Tune these to taste
  const PAD_RATIO = 0.22; // higher than silo so web has more breathing room
  const PAD_MIN = 70;
  const PAD_MAX = 200;

  const pad = Math.max(
    PAD_MIN,
    Math.min(PAD_MAX, Math.floor(Math.max(plantW, plantH) * PAD_RATIO))
  );

  // We fit the entire image into 2200x2200, but we "respect" bbox+pad
  // by scaling so bbox fits inside (target - 2*pad)
  const innerW = Math.max(1, target - 2 * pad);
  const innerH = Math.max(1, target - 2 * pad);

  // Scale based on bbox size (plant pixels), not full image size
  const scale = Math.min(innerW / plantW, innerH / plantH);

  const newW = Math.max(1, Math.floor(sourceImg.width * scale));
  const newH = Math.max(1, Math.floor(sourceImg.height * scale));

  // Scaled bbox + pot center
  const sLeft = bbox.left * scale;
  const sTop = bbox.top * scale;
  const sRight = bbox.right * scale;
  const sBottom = bbox.bottom * scale;
  const sPotCenterX = potCenterX * scale;

  // Target canvas
  const out = document.createElement("canvas");
  out.width = target;
  out.height = target;
  const ctx = out.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, target, target);

  // Place so pot center aligns to canvas center
  const half = target / 2;
  const x0Ideal = Math.floor(half - sPotCenterX);

  // Vertically center by bbox center
  const bboxCenterY = (sTop + sBottom) / 2;
  const y0Ideal = Math.floor(half - bboxCenterY);

  // Clamp so bbox stays inside padded area
  const minX0 = pad - sLeft;
  const maxX0 = target - pad - sRight;
  const minY0 = pad - sTop;
  const maxY0 = target - pad - sBottom;

  const x0 = Math.max(minX0, Math.min(x0Ideal, maxX0));
  const y0 = Math.max(minY0, Math.min(y0Ideal, maxY0));

  ctx.drawImage(sourceImg, x0, y0, newW, newH);

  return out;
}

function renderSilo57({ sourceImg }) {
  const aspectW = 5, aspectH = 7;

  // Analyze at native resolution to use plant pixels (not full image)
  const c = document.createElement("canvas");
  c.width = sourceImg.width;
  c.height = sourceImg.height;
  const cctx = c.getContext("2d", { willReadFrequently: true });
  cctx.clearRect(0, 0, c.width, c.height);
  cctx.drawImage(sourceImg, 0, 0);

  const imgData = cctx.getImageData(0, 0, c.width, c.height);

  // Foreground bbox from PLANT pixels
  let bbox = foregroundBBoxFromImageData(imgData, CFG.BG_MODE, CFG.WHITE_THRESHOLD);
  if (!bbox) bbox = { left: 0, top: 0, right: c.width, bottom: c.height };

  // Pot center from POT pixels (rim-based), restricted to bbox region
  let potCenterX = computePotCenterXRimBased(imgData, bbox, {
    alphaMin: 10,
    minRunFrac: 0.25,
    colorVarMax: 18
  });
  if (potCenterX == null) potCenterX = (bbox.left + bbox.right) / 2;

  // Plant pixel dimensions
  const plantW = Math.max(1, bbox.right - bbox.left);
  const plantH = Math.max(1, bbox.bottom - bbox.top);

  // Padding computed from PLANT pixels (not image size)
  // Tune these as needed:
  const PAD_RATIO = 0.22; // smaller = tighter margins
  const PAD_MIN = 40;
  const PAD_MAX = 300;

  const basePad = Math.max(
    PAD_MIN,
    Math.min(PAD_MAX, Math.floor(Math.max(plantW, plantH) * PAD_RATIO))
  );

  // Start with a canvas that fits plant bbox + padding
  let targetW = plantW + 2 * basePad;
  let targetH = plantH + 2 * basePad;

  // Enforce 5:7 by expanding the limiting dimension (never shrink plant)
  const desiredAspect = aspectW / aspectH;
  const currentAspect = targetW / targetH;

  if (currentAspect > desiredAspect) {
    // too wide -> increase height
    targetH = Math.ceil(targetW / desiredAspect);
  } else {
    // too tall -> increase width
    targetW = Math.ceil(targetH * desiredAspect);
  }

  // Render final canvas
  const out = document.createElement("canvas");
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);

  // Place the source image so that:
  // - potCenterX is centered on the canvas
  // - plant bbox is vertically centered (using bbox center)
  const halfX = targetW / 2;
  const plantCenterY = (bbox.top + bbox.bottom) / 2;
  const halfY = targetH / 2;

  const x0Ideal = Math.floor(halfX - potCenterX);
  const y0Ideal = Math.floor(halfY - plantCenterY);

  // Clamp to keep bbox + padding inside canvas
  // (so plant never touches edges even if pot center is near edge)
  const minX0 = basePad - bbox.left;
  const maxX0 = targetW - basePad - bbox.right;
  const minY0 = basePad - bbox.top;
  const maxY0 = targetH - basePad - bbox.bottom;

  const x0 = Math.max(minX0, Math.min(x0Ideal, maxX0));
  const y0 = Math.max(minY0, Math.min(y0Ideal, maxY0));

  ctx.drawImage(sourceImg, x0, y0);

  return out;
}

// -----------------------------
// Download helpers
// -----------------------------
async function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function maybeDownloadSingleOrZip(outputs, zipBaseName) {
  // outputs: [{ name, canvas }]
  if (outputs.length === 0) return;

  if (outputs.length === 1) {
    const blob = await canvasToJpegBlob(outputs[0].canvas, 1.0);
    await downloadBlob(blob, outputs[0].name);
    return;
  }

  const zip = new JSZip();
  for (const o of outputs) {
    const blob = await canvasToJpegBlob(o.canvas, 1.0);
    zip.file(o.name, blob);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  await downloadBlob(zipBlob, zipBaseName);
}

// -----------------------------
// Single mode wiring
// -----------------------------
const singleImage = document.getElementById("singleImage");
const singleImageBtn = document.getElementById("singleImageBtn");
const singleImageName = document.getElementById("singleImageName");

const singleOutSilo = document.getElementById("singleOutSilo");
const singleOutWeb = document.getElementById("singleOutWeb");
const singleOutDim = document.getElementById("singleOutDim");
const dimInputsSingle = document.getElementById("dimInputsSingle");

const heightLabelEl = document.getElementById("heightLabel");
const widthLabelEl = document.getElementById("widthLabel");

const preview = document.getElementById("preview");
const pctx = preview.getContext("2d");
const downloadSingleBtn = document.getElementById("downloadSingle");

let singleFile = null;
let singleImgEl = null;
let singleImgUrl = null;
let lastPreviewCanvas = null;

function updateDimInputsVisibility() {
  dimInputsSingle.classList.toggle("hidden", !singleOutDim.checked);
}

function selectedSingleTypes() {
  return {
    silo: singleOutSilo.checked,
    web: singleOutWeb.checked,
    dim: singleOutDim.checked
  };
}

async function renderPreviewNow() {
  if (!singleFile) {
    pctx.clearRect(0, 0, preview.width, preview.height);
    downloadSingleBtn.disabled = true;
    downloadSingleBtn.classList.remove("primary");
    lastPreviewCanvas = null;
    return;
  }

  await loadRenderFont();

  if (!singleImgEl) {
    if (singleImgUrl) URL.revokeObjectURL(singleImgUrl);
    singleImgUrl = URL.createObjectURL(singleFile);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = singleImgUrl;
    });
    singleImgEl = img;
  }

  const types = selectedSingleTypes();
  // Preview priority: DIM > WEB > SILO
  let canvas = null;
  if (types.dim) {
    canvas = renderDim({
      sourceImg: singleImgEl,
      heightLabel: heightLabelEl.value.trim(),
      widthLabel: widthLabelEl.value.trim()
    });
  } else if (types.web) {
    canvas = renderWeb({ sourceImg: singleImgEl });
  } else if (types.silo) {
    canvas = renderSilo57({ sourceImg: singleImgEl });
  }

  lastPreviewCanvas = canvas;

  if (canvas) {
    preview.width = canvas.width;
    preview.height = canvas.height;
    pctx.clearRect(0, 0, preview.width, preview.height);
    pctx.drawImage(canvas, 0, 0);

    downloadSingleBtn.disabled = false;
    downloadSingleBtn.classList.add("primary");
  } else {
    pctx.clearRect(0, 0, preview.width, preview.height);
    downloadSingleBtn.disabled = true;
    downloadSingleBtn.classList.remove("primary");
  }
}

const renderPreviewDebounced = debounce(renderPreviewNow, 200);

singleImageBtn.addEventListener("click", () => singleImage.click());

singleImage.addEventListener("change", () => {
  if (singleImgUrl) URL.revokeObjectURL(singleImgUrl);

  singleFile = singleImage.files?.[0] || null;
  singleImgEl = null;
  singleImgUrl = null;

  singleImageName.textContent = singleFile ? singleFile.name : "No file selected";

  downloadSingleBtn.disabled = true;
  downloadSingleBtn.classList.remove("primary");

  renderPreviewNow();
});

[singleOutSilo, singleOutWeb, singleOutDim].forEach(cb => {
  cb.addEventListener("change", () => {
    updateDimInputsVisibility();
    renderPreviewNow();
  });
});

heightLabelEl.addEventListener("input", renderPreviewDebounced);
widthLabelEl.addEventListener("input", renderPreviewDebounced);

updateDimInputsVisibility();

downloadSingleBtn.addEventListener("click", async () => {
  if (!singleFile || !singleImgEl) return;

  const types = selectedSingleTypes();
  const outputs = [];

  if (types.silo) {
    outputs.push({ name: makeSiloName(singleFile.name), canvas: renderSilo57({ sourceImg: singleImgEl }) });
  }
  if (types.web) {
    outputs.push({ name: makeWebName(singleFile.name), canvas: renderWeb({ sourceImg: singleImgEl }) });
  }
  if (types.dim) {
    outputs.push({
      name: makeDimName(singleFile.name),
      canvas: renderDim({
        sourceImg: singleImgEl,
        heightLabel: heightLabelEl.value.trim(),
        widthLabel: widthLabelEl.value.trim()
      })
    });
  }

  const zipName = `${stripSuffixesForDim(stemFromName(singleFile.name))}_EXPORT.zip`;
  await maybeDownloadSingleOrZip(outputs, zipName);
});

// -----------------------------
// Batch mode wiring
// -----------------------------
const batchFolderBtn = document.getElementById("batchFolderBtn");
const batchFolderName = document.getElementById("batchFolderName");
const batchFolder = document.getElementById("batchFolder");

const batchOutSilo = document.getElementById("batchOutSilo");
const batchOutWeb = document.getElementById("batchOutWeb");
const batchOutDim = document.getElementById("batchOutDim");

const runBatchBtn = document.getElementById("runBatch");
const batchLog = document.getElementById("batchLog");

let batchFiles = [];

function log(msg) {
  batchLog.textContent += msg + "\n";
  batchLog.scrollTop = batchLog.scrollHeight;
}

function selectedBatchTypes() {
  return {
    silo: batchOutSilo.checked,
    web: batchOutWeb.checked,
    dim: batchOutDim.checked
  };
}

function refreshBatchRunState() {
  const types = selectedBatchTypes();
  const anyType = types.silo || types.web || types.dim;

  if (!batchFiles.length || !anyType) {
    runBatchBtn.disabled = true;
    return;
  }

  if (types.dim) {
    const hasCsv = batchFiles.some(f => f.name.toLowerCase().endsWith(".csv"));
    runBatchBtn.disabled = !hasCsv;
  } else {
    runBatchBtn.disabled = false;
  }
}

batchFolderBtn.addEventListener("click", () => batchFolder.click());

batchFolder.addEventListener("change", () => {
  batchFiles = Array.from(batchFolder.files || []);
  batchLog.textContent = "";

  if (batchFiles.length > 0) {
    const firstPath = batchFiles[0].webkitRelativePath || "";
    const folderName = firstPath.split("/")[0] || "Folder selected";
    batchFolderName.textContent = `${folderName} (${batchFiles.length} files)`;
    batchFolderBtn.classList.add("primary");
  } else {
    batchFolderName.textContent = "No folder selected";
    batchFolderBtn.classList.remove("primary");
  }

  log(`Selected ${batchFiles.length} files.`);
  refreshBatchRunState();
});

[batchOutSilo, batchOutWeb, batchOutDim].forEach(cb => {
  cb.addEventListener("change", () => {
    refreshBatchRunState();
  });
});

runBatchBtn.addEventListener("click", async () => {
  await loadRenderFont();

  if (!batchFiles.length) return;

  const types = selectedBatchTypes();
  if (!(types.silo || types.web || types.dim)) return;

  // Collect images
  const images = batchFiles.filter(f => {
    const lower = f.name.toLowerCase();
    return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp");
  });

  if (!images.length) {
    alert("No images found in selected folder.");
    return;
  }

  let rows = null;
  if (types.dim) {
    const csvFile = batchFiles.find(f => f.name.toLowerCase().endsWith(".csv"));
    if (!csvFile) {
      alert("DIM is checked, but no CSV was found in the folder.");
      return;
    }
    log(`Using CSV: ${csvFile.name}`);
    const csvText = await csvFile.text();
    rows = parseCSV(csvText);

    const required = ["input_name", "PlantHeight", "PlantWidth"];
    for (const h of required) {
      if (!(h in (rows[0] || {}))) {
        alert(`CSV missing required column: ${h}`);
        return;
      }
    }
  }

  // Index images by exact name and by stem
  const imagesByName = new Map();
  const imagesByStem = new Map();
  for (const f of images) {
    imagesByName.set(f.name, f);
    imagesByStem.set(stemFromName(f.name), f);
  }

  const zip = new JSZip();
  const folderName = timestampFolderName(new Date());
  const outFolder = zip.folder(folderName);

  let ok = 0, fail = 0;

  if (!types.dim) {
    // No CSV required: process all images
    log(`Processing ${images.length} images (no CSV)...`);
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      try {
        const img = await loadImageFromFile(file);

        if (types.silo) {
          const c = renderSilo57({ sourceImg: img });
          outFolder.file(makeSiloName(file.name), await canvasToJpegBlob(c, 1.0));
        }
        if (types.web) {
          const c = renderWeb({ sourceImg: img });
          outFolder.file(makeWebName(file.name), await canvasToJpegBlob(c, 1.0));
        }
        if (types.dim) {
          // (won’t happen here)
        }

        ok++;
        log(`[${i+1}] OK: ${file.name}`);
      } catch (e) {
        fail++;
        log(`[${i+1}] FAIL: ${file.name} (${e})`);
      }
    }
  } else {
    // DIM requires CSV rows
    log(`Processing ${rows.length} rows from CSV...`);

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

      const stem = stemFromName(inputName);
      const file = imagesByName.get(inputName) || imagesByStem.get(stem);

      if (!file) {
        fail++;
        log(`[${i+1}] FAIL: image not found for "${inputName}"`);
        continue;
      }

      try {
        const img = await loadImageFromFile(file);

        if (types.silo) {
          const c = renderSilo57({ sourceImg: img });
          outFolder.file(makeSiloName(file.name), await canvasToJpegBlob(c, 1.0));
        }
        if (types.web) {
          const c = renderWeb({ sourceImg: img });
          outFolder.file(makeWebName(file.name), await canvasToJpegBlob(c, 1.0));
        }
        if (types.dim) {
          const c = renderDim({ sourceImg: img, heightLabel: h, widthLabel: w });
          outFolder.file(makeDimName(file.name), await canvasToJpegBlob(c, 1.0));
        }

        ok++;
        log(`[${i+1}] OK: ${file.name}`);
      } catch (e) {
        fail++;
        log(`[${i+1}] FAIL: ${file.name} (${e})`);
      }
    }
  }

  log("");
  log(`Done. Success: ${ok} | Failed: ${fail}`);
  log("Generating ZIP...");

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(zipBlob);
  a.download = `Plant_EXPORT_${folderName}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
});
