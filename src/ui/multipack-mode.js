/**
 * "Multi-packs" tab: pick one plant image and a pack size, see the
 * arrangement, download it as a 2200×2200 JPEG.
 * The arranging itself lives in outputs/multipack.js.
 */

import { SETTINGS } from "../settings.js";
import { PACK_SIZES, multipackOutput } from "../outputs/multipack.js";
import { downloadBlob } from "../download.js";
import { prepareSource, renderToFile } from "../render.js";
import { createPreview } from "./preview.js";

export function setupMultipackMode() {
  const fileButton = document.getElementById("multipack-file-button");
  const fileInput = document.getElementById("multipack-file-input");
  const fileName = document.getElementById("multipack-file-name");
  const countPills = document.getElementById("multipack-counts");
  const downloadButton = document.getElementById("multipack-download");
  const preview = createPreview(
    document.getElementById("multipack-preview"),
    document.getElementById("multipack-preview-caption"),
  );

  /** The loaded + analyzed image, or null. */
  let source = null;
  let count = PACK_SIZES.includes(SETTINGS.multipack.defaultCount)
    ? SETTINGS.multipack.defaultCount
    : PACK_SIZES[0];

  // One button per pack size.
  const countButtons = PACK_SIZES.map((size) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = size;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-label", `${size}-pack`);
    button.addEventListener("click", () => {
      count = size;
      refresh();
    });
    countPills.append(button);
    return button;
  });

  fileButton.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    source?.image.close();
    source = null;
    fileName.textContent = file ? file.name : "No file selected";

    if (file) {
      try {
        source = await prepareSource(file);
      } catch (error) {
        fileName.textContent = `Couldn't read ${file.name}`;
        console.error(error);
      }
    }
    refresh();
  });

  downloadButton.addEventListener("click", async () => {
    if (!source) return;
    downloadButton.disabled = true;
    try {
      const file = await renderToFile(multipackOutput(count), source);
      downloadBlob(file.blob, file.name);
    } finally {
      downloadButton.disabled = false;
    }
  });

  function refresh() {
    countButtons.forEach((button, i) => button.setAttribute("aria-checked", String(PACK_SIZES[i] === count)));
    downloadButton.disabled = !source;

    if (source) {
      preview.show(multipackOutput(count), source, {});
    } else {
      preview.clear();
    }
  }

  refresh();
}
