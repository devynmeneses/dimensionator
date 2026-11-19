/**
 * Builds the output checkboxes (Silo JPG / Web JPG / DIM) from OUTPUT_TYPES,
 * so new output types show up automatically.
 *
 * The checkboxes live inside a collapsed "Legacy Options" section, since the
 * usual job is DIM only (set by `checkedByDefault` in settings.js). When the
 * selection differs from the defaults, the closed section says what's chosen
 * so it's never a hidden surprise.
 */

import { OUTPUT_TYPES } from "../outputs/index.js";

/**
 * @param {HTMLElement} container  where the section goes
 * @param {function} onChange      called whenever a box is ticked/unticked
 * @returns {{ selected: () => object[] }}  selected() lists the checked output types
 */
export function createOutputPicker(container, onChange) {
  const section = document.createElement("details");
  section.className = "legacy-options";
  section.innerHTML = `<summary>Legacy Options <span class="legacy-summary"></span></summary><div class="checks"></div>`;
  const summaryNote = section.querySelector(".legacy-summary");
  const checksRow = section.querySelector(".checks");

  const checkboxes = OUTPUT_TYPES.map((output) => {
    const label = document.createElement("label");
    label.className = "check";
    label.innerHTML = `<input type="checkbox" /><span></span>`;

    const checkbox = label.querySelector("input");
    checkbox.checked = output.checkedByDefault;
    checkbox.addEventListener("change", () => {
      updateSummary();
      onChange();
    });
    label.querySelector("span").textContent = output.label;

    checksRow.append(label);
    return { output, checkbox };
  });

  container.append(section);
  updateSummary();

  function selected() {
    return checkboxes.filter((c) => c.checkbox.checked).map((c) => c.output);
  }

  /** e.g. "· Silo JPG, DIM" when not the default, nothing otherwise. */
  function updateSummary() {
    const isDefault = checkboxes.every((c) => c.checkbox.checked === c.output.checkedByDefault);
    const names = selected().map((output) => output.label);
    summaryNote.textContent = isDefault ? "" : `· ${names.length ? names.join(", ") : "nothing selected"}`;
  }

  return { selected };
}
