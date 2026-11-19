/**
 * Minimal CSV reader.
 *
 * Handles quoted fields ("18"" - 20""" → 18" - 20"), commas inside quotes,
 * Windows line endings, and the invisible marker Excel adds to the start of
 * UTF-8 files.
 *
 * Returns one object per row, keyed by column header. Headers are stored
 * trimmed and UPPERCASED, so look them up with csvValue() below.
 */

export function parseCsv(text) {
  const table = splitIntoCells(text.replace(/^﻿/, ""));
  const headers = (table.shift() ?? []).map(normalizeHeader);

  return table
    .filter((cells) => cells.some((cell) => cell.trim() !== ""))
    .map((cells) => {
      const row = {};
      headers.forEach((header, i) => {
        row[header] = (cells[i] ?? "").trim();
      });
      return row;
    });
}

/** Reads a column from a parsed row, ignoring case/spaces in the header name. */
export function csvValue(row, columnName) {
  return row[normalizeHeader(columnName)] ?? "";
}

/** Whether the parsed CSV has a column (checks the first row). */
export function csvHasColumn(rows, columnName) {
  return rows.length > 0 && normalizeHeader(columnName) in rows[0];
}

function normalizeHeader(header) {
  return header.trim().toUpperCase();
}

/** Turns CSV text into an array of rows, each an array of cell strings. */
function splitIntoCells(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'; // escaped quote
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell === "") {
      inQuotes = true; // quotes only have meaning at the start of a cell; 30" stays 30"
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  // Last row (if the file doesn't end with a newline)
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
