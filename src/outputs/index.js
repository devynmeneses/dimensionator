/**
 * Every output type the app can produce.
 *
 * The UI (checkboxes, label fields, preview) and batch mode are built from
 * this list, so adding an output is:
 *   1. copy web.js to a new file and change it
 *   2. add it to the list below
 *
 * An output type is an object with:
 *   id               unique short name, e.g. "web"
 *   label            checkbox text, e.g. "Web JPG"
 *   fileSuffix       added to the file name, e.g. "_SILO-2200x2200"
 *   checkedByDefault whether its checkbox starts checked
 *   fields           extra text inputs it needs (see dim.js), or []
 *   render({ image, analysis, values }) → canvas
 *
 * Order matters: checkboxes appear in this order, and the preview shows
 * the LAST checked output in the list.
 */

import { siloOutput } from "./silo.js";
import { webOutput } from "./web.js";
import { dimOutput } from "./dim.js";
import { PACK_SIZES, multipackSuffix } from "./multipack.js";

export const OUTPUT_TYPES = [siloOutput, webOutput, dimOutput];

/** All file suffixes, used to clean up names like "Fern_SILO.png" or "Fern_4PACK.png". */
export const ALL_SUFFIXES = [
  ...OUTPUT_TYPES.map((output) => output.fileSuffix),
  ...PACK_SIZES.map(multipackSuffix), // multi-packs (see multipack.js)
];
