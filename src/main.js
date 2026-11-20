/**
 * App entry point. Loaded by index.html.
 *
 * Folder guide:
 *   settings.js      ← all the numbers you might want to tweak
 *   outputs/         ← one file per output type (Silo, Web, DIM) + the list of them
 *   core/            ← image logic: finding the plant, placing it, drawing lines
 *   batch/           ← CSV reading and folder processing
 *   ui/              ← page wiring (buttons, previews, logs)
 *   naming.js        ← output file-name rules
 *   render.js        ← image file → output file (shared by every tab)
 *   download.js      ← saving files / building ZIPs
 */

import { SETTINGS } from "./settings.js";
import { setupSingleMode } from "./ui/single-mode.js";
import { setupMultiMode } from "./ui/multi-mode.js";
import { setupMultipackMode } from "./ui/multipack-mode.js";
import { setupBatchMode } from "./ui/batch-mode.js";
import { setupThemePicker } from "./ui/theme-picker.js";

document.getElementById("load-warning").remove();

// The label font must be loaded before anything is drawn with it.
await document.fonts.load(`64px "${SETTINGS.dim.font}"`);

setupThemePicker();
setupTabs();
setupSingleMode();
setupMultiMode();
setupMultipackMode();
setupBatchMode();

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      for (const other of tabs) {
        const isActive = other === tab;
        other.classList.toggle("active", isActive);
        document.getElementById(other.dataset.panel).classList.toggle("active", isActive);
      }
    });
  }
}
