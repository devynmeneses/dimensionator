/**
 * File-name rules.
 *
 * Output names are built from the input's "base name": its name with the
 * extension and any known output suffix removed. So all of these:
 *
 *   Fern.png   Fern_SILO.png   Fern_SILO-2200x2200.png   Fern_DIM.jpg
 *
 * have the base name "Fern", and produce:
 *
 *   Fern_SILO.jpg   Fern_SILO-2200x2200.jpg   Fern_DIM.jpg
 */

/** "photos/Fern_SILO.png" → "Fern_SILO" */
export function fileStem(name) {
  const fileName = name.split("/").pop();
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** "Fern_SILO.png" → "Fern" (removes any of `suffixes` from the end, longest first). */
export function baseName(name, suffixes) {
  const longestFirst = [...suffixes].sort((a, b) => b.length - a.length);
  let stem = fileStem(name);

  let removedOne = true;
  while (removedOne) {
    removedOne = false;
    for (const suffix of longestFirst) {
      if (suffix && stem.endsWith(suffix)) {
        stem = stem.slice(0, -suffix.length);
        removedOne = true;
        break;
      }
    }
  }

  return stem;
}

/** ("Fern_SILO.png", "_DIM", allSuffixes, ".jpg") → "Fern_DIM.jpg" */
export function outputFileName(inputName, suffix, allSuffixes, extension) {
  return `${baseName(inputName, allSuffixes)}${suffix}${extension}`;
}

/** 2026-11-19 14:05:09 → "2026-11-19_140509" */
export function timestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** Name for a multi-image export ZIP, e.g. "Plant_EXPORT_2026-11-19_140509.zip" */
export function exportZipName(folder) {
  return `Plant_EXPORT_${folder}.zip`;
}
