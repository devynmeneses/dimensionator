/**
 * "CSV / Batch" tab: pick a folder, run every image through the checked
 * outputs, download a ZIP. The actual processing lives in batch/run-batch.js.
 */

import { SETTINGS } from "../settings.js";
import { OUTPUT_TYPES } from "../outputs/index.js";
import { downloadBlob } from "../download.js";
import { isCsvFile, runBatch } from "../batch/run-batch.js";
import { createOutputPicker } from "./output-picker.js";

export function setupBatchMode() {
  const folderButton = document.getElementById("batch-folder-button");
  const folderInput = document.getElementById("batch-folder-input");
  const folderName = document.getElementById("batch-folder-name");
  const runButton = document.getElementById("batch-run");
  const logBox = document.getElementById("batch-log");

  /** Every file in the chosen folder. */
  let files = [];
  let running = false;

  const picker = createOutputPicker(document.getElementById("batch-outputs"), updateRunButton);
  showCsvColumns();

  folderButton.addEventListener("click", () => folderInput.click());

  folderInput.addEventListener("change", () => {
    files = Array.from(folderInput.files);
    logBox.textContent = "";

    if (files.length > 0) {
      const folder = files[0].webkitRelativePath.split("/")[0] || "Folder";
      folderName.textContent = `${folder} (${files.length} files)`;
    } else {
      folderName.textContent = "No folder selected";
    }
    updateRunButton();
  });

  runButton.addEventListener("click", async () => {
    running = true;
    updateRunButton();
    logBox.textContent = "";

    try {
      const result = await runBatch({ files, outputs: picker.selected(), log });
      downloadBlob(result.zipBlob, result.zipName);
      log(`Downloaded ${result.zipName}`);
    } catch (error) {
      log(`ERROR: ${error.message ?? error}`);
    } finally {
      running = false;
      updateRunButton();
    }
  });

  function log(message) {
    logBox.textContent += message + "\n";
    logBox.scrollTop = logBox.scrollHeight;
  }

  /** Enabled only when there's a folder, an output is checked, and a CSV exists if needed. */
  function updateRunButton() {
    const outputs = picker.selected();
    const needsCsv = outputs.some((output) => output.fields.length > 0);
    const ready = files.length > 0 && outputs.length > 0 && (!needsCsv || files.some(isCsvFile));
    runButton.disabled = running || !ready;
  }

  /** Fills in the required CSV column names in the help text. */
  function showCsvColumns() {
    const columns = [
      SETTINGS.batch.fileNameColumn,
      ...OUTPUT_TYPES.flatMap((output) => output.fields.map((field) => field.csvColumn)),
    ];
    document.getElementById("batch-csv-columns").textContent = columns.join(", ");
  }
}
