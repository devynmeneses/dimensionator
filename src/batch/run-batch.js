/**
 * Batch mode: processes every image in a folder and returns one ZIP.
 *
 * - Every image gets every checked output.
 * - Outputs that need labels (DIM) read them from the folder's CSV. Images
 *   with no matching CSV row are skipped for that output, and logged.
 *
 * This file has no UI code; it reports progress through `log(message)`.
 */

import { SETTINGS } from "../settings.js";
import { ALL_SUFFIXES } from "../outputs/index.js";
import { baseName, exportZipName, fileStem, timestamp } from "../naming.js";
import { makeZip } from "../download.js";
import { prepareSource, renderToFile } from "../render.js";
import { csvHasColumn, csvValue, parseCsv } from "./csv.js";

/**
 * @param {object}   options
 * @param {File[]}   options.files    everything in the chosen folder
 * @param {object[]} options.outputs  checked output types
 * @param {function} options.log      called with progress messages
 * @returns {Promise<{ zipBlob: Blob, zipName: string, succeeded: number, failed: number }>}
 */
export async function runBatch({ files, outputs, log }) {
  const images = files.filter(isImageFile);
  if (images.length === 0) throw new Error("No images found in the selected folder.");

  const needsCsv = outputs.some((output) => output.fields.length > 0);
  const csvLookup = needsCsv ? await loadCsvLookup(files, outputs, log) : null;

  const folder = timestamp();
  const zipEntries = [];
  const usedCsvRows = new Set();
  let succeeded = 0;
  let failed = 0;

  log(`Processing ${images.length} image(s)…`);

  for (const [index, file] of images.entries()) {
    const prefix = `[${index + 1}/${images.length}]`;
    let source = null;

    try {
      source = await prepareSource(file);
      const row = csvLookup?.find(file.name);
      if (row) usedCsvRows.add(row);

      for (const output of outputs) {
        if (output.fields.length > 0 && !row) {
          log(`${prefix} SKIP ${output.label}: no CSV row for ${file.name}`);
          continue;
        }
        const values = row ? readFieldValues(output, row) : {};
        const result = await renderToFile(output, source, values);
        zipEntries.push({ path: `${folder}/${result.name}`, blob: result.blob });
      }

      succeeded++;
      log(`${prefix} OK   ${file.name}`);
    } catch (error) {
      failed++;
      log(`${prefix} FAIL ${file.name} (${error.message ?? error})`);
    } finally {
      source?.image.close();
    }
  }

  csvLookup?.rows
    .filter((row) => !usedCsvRows.has(row))
    .forEach((row) => log(`CSV row with no matching image: "${csvValue(row, SETTINGS.batch.fileNameColumn)}"`));

  log("");
  log(`Done. Succeeded: ${succeeded} | Failed: ${failed}`);
  log("Building ZIP…");

  return {
    zipBlob: await makeZip(zipEntries),
    zipName: exportZipName(folder),
    succeeded,
    failed,
  };
}

/** True for image files, ignoring hidden files like .DS_Store. */
export function isImageFile(file) {
  const name = file.name.toLowerCase();
  return !name.startsWith(".") && SETTINGS.batch.imageExtensions.some((ext) => name.endsWith(ext));
}

/** True for a visible .csv file. */
export function isCsvFile(file) {
  const name = file.name.toLowerCase();
  return !name.startsWith(".") && name.endsWith(".csv");
}

// ---------------------------------------------------------------------------

/**
 * Reads the folder's CSV and returns { rows, find(imageName) → row }.
 * Images are matched to rows by exact name, then by name without extension,
 * then by base name (ignoring _SILO etc.), all case-insensitively.
 */
async function loadCsvLookup(files, outputs, log) {
  const csvFile = files.find(isCsvFile);
  if (!csvFile) {
    const names = outputs.filter((output) => output.fields.length > 0).map((output) => output.label);
    throw new Error(`${names.join(", ")} needs a CSV, but none was found in the folder.`);
  }

  log(`Using CSV: ${csvFile.name}`);
  const rows = parseCsv(await csvFile.text());

  const requiredColumns = [
    SETTINGS.batch.fileNameColumn,
    ...outputs.flatMap((output) => output.fields.map((field) => field.csvColumn)),
  ];
  for (const column of requiredColumns) {
    if (!csvHasColumn(rows, column)) throw new Error(`CSV is missing the column "${column}".`);
  }

  const index = new Map();
  for (const row of rows) {
    const name = csvValue(row, SETTINGS.batch.fileNameColumn);
    if (!name) continue;
    for (const key of matchKeys(name)) {
      if (!index.has(key)) index.set(key, row);
    }
  }

  return {
    rows,
    find: (imageName) => matchKeys(imageName).map((key) => index.get(key)).find(Boolean),
  };
}

/** Name variations to try when matching, most specific first. */
function matchKeys(name) {
  return [name, fileStem(name), baseName(name, ALL_SUFFIXES)].map((key) => key.trim().toLowerCase());
}

function readFieldValues(output, row) {
  const values = {};
  for (const field of output.fields) {
    values[field.id] = csvValue(row, field.csvColumn);
  }
  return values;
}
