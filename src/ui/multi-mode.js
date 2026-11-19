/**
 * "Multi Image" tab: add several images, type each one's labels in a table,
 * flip through previews, and download everything as one ZIP. No CSV needed.
 *
 * The table has one row per image. Its label columns come from the checked
 * outputs' `fields` (e.g. DIM → Height Label, Width Label), so they appear
 * and disappear as outputs are ticked.
 *
 * Typing "=3" in a label box copies row 3's label in the same column (see
 * references.js). Values are stored exactly as typed and resolved whenever
 * they're used, so editing row 3 updates every row that refers to it.
 */

import { ALL_SUFFIXES, OUTPUT_TYPES } from "../outputs/index.js";
import { baseName, exportZipName, timestamp } from "../naming.js";
import { downloadBlob, makeZip } from "../download.js";
import { prepareSource, renderToFile } from "../render.js";
import { isImageFile } from "../batch/run-batch.js";
import { parseReference, resolveCell, updateAfterRowRemoved } from "../references.js";
import { createOutputPicker } from "./output-picker.js";
import { createPreview, debounce, previewOutput } from "./preview.js";

export function setupMultiMode() {
  const el = {
    panel: document.getElementById("multi"),
    addButton: document.getElementById("multi-add-button"),
    fileInput: document.getElementById("multi-file-input"),
    count: document.getElementById("multi-count"),
    tableWrap: document.getElementById("multi-table-wrap"),
    tableHead: document.getElementById("multi-table-head"),
    tableBody: document.getElementById("multi-table-body"),
    downloadButton: document.getElementById("multi-download"),
    clearButton: document.getElementById("multi-clear"),
    status: document.getElementById("multi-status"),
    prevButton: document.getElementById("multi-prev"),
    nextButton: document.getElementById("multi-next"),
    previewName: document.getElementById("multi-preview-name"),
  };

  /**
   * The images in the table, in order. Each item:
   *   { source,  // { name, image, analysis } from prepareSource()
   *     values } // labels as typed: values[outputId][fieldId] = "18\"-20\"" or "=1"
   */
  const items = [];
  let selectedIndex = -1;
  let busy = false;
  const defaultHint = el.status.textContent.trim().replace(/\s+/g, " ");

  const picker = createOutputPicker(document.getElementById("multi-outputs"), () => {
    renderTable();
    refreshPreview();
  });
  const preview = createPreview(
    document.getElementById("multi-preview"),
    document.getElementById("multi-preview-caption"),
  );
  const refreshPreviewSoon = debounce(refreshPreview, 150);

  // ---------------------------------------------------------------------------
  //  Events
  // ---------------------------------------------------------------------------

  el.addButton.addEventListener("click", () => el.fileInput.click());

  el.fileInput.addEventListener("change", async () => {
    const files = Array.from(el.fileInput.files);
    el.fileInput.value = ""; // so choosing the same file again still fires "change"
    await addFiles(files);
  });

  el.clearButton.addEventListener("click", () => {
    if (!confirm(`Remove all ${items.length} images? Any labels you typed will be lost.`)) return;
    items.forEach((item) => item.source.image.close());
    items.length = 0;
    selectedIndex = -1;
    setStatus("");
    renderTable();
    refreshPreview();
  });

  el.prevButton.addEventListener("click", () => select(selectedIndex - 1, { scroll: true }));
  el.nextButton.addEventListener("click", () => select(selectedIndex + 1, { scroll: true }));

  // ← / → flip through previews (unless you're typing in a box).
  document.addEventListener("keydown", (event) => {
    if (!el.panel.classList.contains("active") || event.target.matches?.("input, textarea")) return;
    if (event.key === "ArrowLeft") select(selectedIndex - 1, { scroll: true });
    if (event.key === "ArrowRight") select(selectedIndex + 1, { scroll: true });
  });

  el.downloadButton.addEventListener("click", downloadAll);

  renderTable();

  // ---------------------------------------------------------------------------
  //  Adding and removing images
  // ---------------------------------------------------------------------------

  async function addFiles(files) {
    const problems = [];
    setStatus(`Loading ${files.length} image(s)…`);

    for (const file of files) {
      if (!isImageFile(file)) {
        problems.push(`${file.name} (not an image)`);
        continue;
      }
      // Two inputs with the same base name would produce the same output file names.
      if (items.some((item) => sameBaseName(item.source.name, file.name))) {
        problems.push(`${file.name} (an image with this name is already added)`);
        continue;
      }
      try {
        items.push({ source: await prepareSource(file), values: {} });
      } catch {
        problems.push(`${file.name} (couldn't be read)`);
      }
    }

    if (selectedIndex < 0 && items.length > 0) selectedIndex = 0;
    renderTable();
    refreshPreview();
    setStatus(problems.length ? `Skipped: ${problems.join("; ")}` : "");
  }

  function removeItem(index) {
    // Keep "=N" references pointing at the same images once rows shift up.
    for (const output of OUTPUT_TYPES) {
      for (const field of output.fields) {
        const removedValue = resolvedValue(index, output, field).value;
        items.forEach((item, i) => {
          if (i === index) return;
          const text = typedText(i, output, field);
          const updated = updateAfterRowRemoved(text, index, removedValue);
          if (updated !== text) item.values[output.id] = { ...item.values[output.id], [field.id]: updated };
        });
      }
    }

    items[index].source.image.close();
    items.splice(index, 1);

    if (selectedIndex > index) selectedIndex--;
    selectedIndex = Math.min(selectedIndex, items.length - 1);

    renderTable();
    refreshPreview();
  }

  // ---------------------------------------------------------------------------
  //  Table
  // ---------------------------------------------------------------------------

  /** Rebuilds the table. Called when images are added/removed or outputs change. */
  function renderTable() {
    const columns = labelColumns();

    el.tableHead.replaceChildren(
      headerCell("#"),
      headerCell("File"),
      ...columns.map(({ field }) => headerCell(field.label)),
      headerCell(""),
    );
    el.tableBody.replaceChildren(...items.map((item, index) => tableRow(item, index, columns)));

    el.tableWrap.hidden = items.length === 0;
    el.count.textContent = items.length ? `${items.length} image(s)` : "No images yet";
    updateButtons();
    highlightSelectedRow();
    showReferenceResults();
  }

  /** One {output, field} per label column, for the checked outputs. */
  function labelColumns() {
    return picker.selected().flatMap((output) => output.fields.map((field) => ({ output, field })));
  }

  function headerCell(text) {
    const th = document.createElement("th");
    th.textContent = text;
    return th;
  }

  function tableRow(item, index, columns) {
    const row = document.createElement("tr");
    row.addEventListener("click", () => select(index));

    const number = document.createElement("td");
    number.className = "row-number";
    number.textContent = index + 1;

    const name = document.createElement("td");
    name.className = "row-name";
    name.textContent = item.source.name;
    name.title = item.source.name;

    const labelCells = columns.map(({ output, field }) => {
      const cell = document.createElement("td");
      cell.className = "label-cell";
      const input = document.createElement("input");
      input.type = "text";
      input.dataset.column = `${output.id}.${field.id}`;
      input.setAttribute("aria-label", `${field.label} for ${item.source.name}`);
      input.value = typedText(index, output, field);

      // Shows what an "=N" reference resolves to, e.g. "→ 14″" (filled in by showReferenceResults)
      const result = document.createElement("span");
      result.className = "reference-result";

      input.addEventListener("focus", () => select(index));
      input.addEventListener("input", () => {
        item.values[output.id] = { ...item.values[output.id], [field.id]: input.value.trim() };
        showReferenceResults(); // other rows may refer to this one
        refreshPreviewSoon();
      });
      // Enter → same box on the next row, for quick data entry.
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const next = el.tableBody.rows[index + 1]?.querySelector(`[data-column="${input.dataset.column}"]`);
        next?.focus();
        next?.select();
      });

      cell.append(input, result);
      return cell;
    });

    const removeCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "✕";
    removeButton.title = `Remove ${item.source.name}`;
    removeButton.setAttribute("aria-label", `Remove ${item.source.name}`);
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation(); // don't also select the row
      removeItem(index);
    });
    removeCell.append(removeButton);

    row.append(number, name, ...labelCells, removeCell);
    return row;
  }

  // ---------------------------------------------------------------------------
  //  Selection and preview
  // ---------------------------------------------------------------------------

  function select(index, { scroll = false } = {}) {
    if (index < 0 || index >= items.length || index === selectedIndex) return;
    selectedIndex = index;
    highlightSelectedRow();
    if (scroll) el.tableBody.rows[index]?.scrollIntoView({ block: "nearest" });
    refreshPreview();
  }

  function highlightSelectedRow() {
    [...el.tableBody.rows].forEach((row, i) => row.classList.toggle("selected", i === selectedIndex));
  }

  /** Marks every "=N" box with what it resolves to, or why it's broken. */
  function showReferenceResults() {
    const columns = labelColumns();
    [...el.tableBody.rows].forEach((row, index) => {
      columns.forEach(({ output, field }) => {
        const input = row.querySelector(`[data-column="${output.id}.${field.id}"]`);
        const result = input.nextElementSibling;
        const isReference = parseReference(input.value.trim()) !== null;
        const { value, error } = resolvedValue(index, output, field);

        input.classList.toggle("is-reference", isReference && !error);
        input.classList.toggle("is-broken", Boolean(error));
        result.textContent = !isReference ? "" : error ? "!" : `→ ${value || "(empty)"}`;
        input.title = error ?? (isReference ? `Copies row ${parseReference(input.value.trim())}: ${value || "(empty)"}` : "");
      });
    });
  }

  function refreshPreview() {
    const item = items[selectedIndex];
    const output = previewOutput(picker.selected());

    el.previewName.textContent = item
      ? `${selectedIndex + 1} / ${items.length} · ${item.source.name}`
      : "No image selected";
    el.previewName.title = item?.source.name ?? "";
    el.prevButton.disabled = selectedIndex <= 0;
    el.nextButton.disabled = selectedIndex < 0 || selectedIndex >= items.length - 1;

    if (item && output) {
      preview.show(output, item.source, resolvedValues(selectedIndex, output));
    } else {
      preview.clear();
    }
  }

  // ---------------------------------------------------------------------------
  //  Download
  // ---------------------------------------------------------------------------

  async function downloadAll() {
    const outputs = picker.selected();
    if (items.length === 0 || outputs.length === 0) return;

    busy = true;
    updateButtons();
    try {
      const folder = timestamp();
      const zipEntries = [];

      for (const [index, item] of items.entries()) {
        setStatus(`Rendering ${index + 1} / ${items.length}: ${item.source.name}`);
        for (const output of outputs) {
          const file = await renderToFile(output, item.source, resolvedValues(index, output));
          zipEntries.push({ path: `${folder}/${file.name}`, blob: file.blob });
        }
      }

      setStatus("Building ZIP…");
      const zipName = exportZipName(folder);
      downloadBlob(await makeZip(zipEntries), zipName);
      setStatus(`Downloaded ${zipName} (${zipEntries.length} files).${blankLabelWarning()}`);
    } catch (error) {
      setStatus(`Something went wrong: ${error.message ?? error}`);
    } finally {
      busy = false;
      updateButtons();
    }
  }

  /** A note listing images with empty labels (including broken "=N" references), or "". */
  function blankLabelWarning() {
    const columns = labelColumns();
    const blank = items.filter((item, index) =>
      columns.some(({ output, field }) => !resolvedValue(index, output, field).value),
    );
    if (blank.length === 0) return "";
    return ` Note: ${blank.length} image(s) had empty labels: ${blank.map((i) => i.source.name).join(", ")}.`;
  }

  // ---------------------------------------------------------------------------
  //  Label values
  // ---------------------------------------------------------------------------

  /** What was typed in a cell (may be a reference like "=1"). */
  function typedText(index, output, field) {
    return items[index]?.values[output.id]?.[field.id] ?? "";
  }

  /** A cell's final value, with "=N" references followed: { value, error? } */
  function resolvedValue(index, output, field) {
    return resolveCell((i) => typedText(i, output, field), items.length, index);
  }

  /** All of one output's label values for a row, ready to render, e.g. { height: '14"' } */
  function resolvedValues(index, output) {
    const values = {};
    for (const field of output.fields) values[field.id] = resolvedValue(index, output, field).value;
    return values;
  }

  // ---------------------------------------------------------------------------

  function updateButtons() {
    el.downloadButton.disabled = busy || items.length === 0 || picker.selected().length === 0;
    el.clearButton.disabled = busy || items.length === 0;
    el.addButton.disabled = busy;
  }

  /** Shows a message under the buttons, or the usage hint when there's nothing to say. */
  function setStatus(message) {
    el.status.textContent = message || defaultHint;
  }
}

function sameBaseName(a, b) {
  return baseName(a, ALL_SUFFIXES).toLowerCase() === baseName(b, ALL_SUFFIXES).toLowerCase();
}
