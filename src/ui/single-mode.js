/**
 * "Single Image" tab: pick one image, see a live preview, download outputs.
 */

import { ALL_SUFFIXES } from "../outputs/index.js";
import { baseName } from "../naming.js";
import { downloadBlob, makeZip } from "../download.js";
import { prepareSource, renderToFile } from "../render.js";
import { createOutputPicker } from "./output-picker.js";
import { createLabelFields } from "./label-fields.js";
import { createPreview, debounce, previewOutput } from "./preview.js";

export function setupSingleMode() {
  const fileButton = document.getElementById("single-file-button");
  const fileInput = document.getElementById("single-file-input");
  const fileName = document.getElementById("single-file-name");
  const downloadButton = document.getElementById("single-download");
  const preview = createPreview(
    document.getElementById("preview"),
    document.getElementById("preview-caption"),
  );

  /** The loaded + analyzed image, or null. */
  let source = null;

  const picker = createOutputPicker(document.getElementById("single-outputs"), refresh);
  const fields = createLabelFields(document.getElementById("single-fields"), debounce(refresh, 150));

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
    const outputs = picker.selected();
    if (!source || outputs.length === 0) return;

    downloadButton.disabled = true;
    try {
      const files = [];
      for (const output of outputs) {
        files.push(await renderToFile(output, source, fields.valuesFor(output)));
      }

      if (files.length === 1) {
        downloadBlob(files[0].blob, files[0].name);
      } else {
        const zip = await makeZip(files.map((f) => ({ path: f.name, blob: f.blob })));
        downloadBlob(zip, `${baseName(source.name, ALL_SUFFIXES)}_EXPORT.zip`);
      }
    } finally {
      downloadButton.disabled = false;
    }
  });

  /** Re-draws the preview and updates which controls are shown/enabled. */
  function refresh() {
    const outputs = picker.selected();
    fields.showFor(outputs);
    downloadButton.disabled = !source || outputs.length === 0;

    const output = previewOutput(outputs);
    if (source && output) {
      preview.show(output, source, fields.valuesFor(output));
    } else {
      preview.clear();
    }
  }

  refresh();
}
