/**
 * Row references for the Multi Image table.
 *
 * Typing "=3" in a label box means "use whatever row 3 has in this same
 * column", like a spreadsheet. References can chain (row 5 = row 3 = row 1).
 *
 * This file only works with plain strings and row numbers, so it has no UI
 * code and is easy to test.
 */

/** "=3" → 3,  " = 12 " → 12,  anything else → null. Row numbers start at 1. */
export function parseReference(text) {
  const match = /^=\s*(\d+)$/.exec((text ?? "").trim());
  return match ? Number(match[1]) : null;
}

/**
 * Works out the final value of one cell, following references.
 *
 * @param {(rowIndex: number) => string} getText  the typed text of a row's cell in this column (0-based)
 * @param {number} rowCount
 * @param {number} rowIndex                       the cell to resolve (0-based)
 * @returns {{ value: string, error?: string }}   error explains a broken reference (value is then "")
 */
export function resolveCell(getText, rowCount, rowIndex) {
  const visited = new Set();
  let index = rowIndex;

  for (;;) {
    visited.add(index);
    const text = getText(index) ?? "";
    const rowNumber = parseReference(text);
    if (rowNumber === null) return { value: text };

    const target = rowNumber - 1;
    if (target < 0 || target >= rowCount) return { value: "", error: `There's no row ${rowNumber}` };
    if (visited.has(target)) return { value: "", error: "These rows refer to each other in a loop" };
    index = target;
  }
}

/**
 * Keeps a cell's reference pointing at the same image after a row is removed.
 *   - references to rows below the removed one shift up by one ("=5" → "=4")
 *   - a reference to the removed row is replaced by that row's value, so the
 *     label isn't lost
 *
 * @param {string} text              the cell's typed text
 * @param {number} removedIndex      the removed row (0-based)
 * @param {string} removedRowValue   the removed row's resolved value in this column
 */
export function updateAfterRowRemoved(text, removedIndex, removedRowValue) {
  const rowNumber = parseReference(text);
  if (rowNumber === null) return text;

  const target = rowNumber - 1;
  if (target === removedIndex) return removedRowValue;
  if (target > removedIndex) return `=${rowNumber - 1}`;
  return text;
}
