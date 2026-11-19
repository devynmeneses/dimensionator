/**
 * Saving files to the user's computer.
 */

/* global JSZip — loaded from a <script> tag in index.html */

/** Triggers a browser download of a Blob. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Give the browser a moment to start the download before freeing memory.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Bundles files into a ZIP.
 * @param {{path: string, blob: Blob}[]} files  path may include folders, e.g. "2026-11-19/Fern_DIM.jpg"
 */
export function makeZip(files) {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.blob);
  }
  return zip.generateAsync({ type: "blob" });
}
