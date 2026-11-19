/**
 * Builds text inputs for outputs that need labels (e.g. DIM's Height and
 * Width). Each output's inputs are only shown while that output is checked.
 */

import { OUTPUT_TYPES } from "../outputs/index.js";

/**
 * @param {HTMLElement} container  where the inputs go
 * @param {function} onInput       called as the user types
 * @returns {{ showFor(outputs), valuesFor(output) }}
 */
export function createLabelFields(container, onInput) {
  const inputsByOutput = new Map();

  for (const output of OUTPUT_TYPES) {
    const inputs = {};
    for (const field of output.fields) {
      const label = document.createElement("label");
      label.className = "field";
      label.hidden = true;
      label.innerHTML = `<span class="field-label"></span><input type="text" />`;
      label.querySelector(".field-label").textContent = field.label;

      const input = label.querySelector("input");
      input.placeholder = field.placeholder ?? "";
      input.addEventListener("input", onInput);

      container.append(label);
      inputs[field.id] = input;
    }
    inputsByOutput.set(output, inputs);
  }

  return {
    /** Shows only the inputs belonging to the given (checked) outputs. */
    showFor(outputs) {
      for (const [output, inputs] of inputsByOutput) {
        const visible = outputs.includes(output);
        Object.values(inputs).forEach((input) => (input.closest("label").hidden = !visible));
      }
    },

    /** The typed values for one output, e.g. { height: '18"-20"', width: '20"-22"' } */
    valuesFor(output) {
      const values = {};
      for (const [id, input] of Object.entries(inputsByOutput.get(output) ?? {})) {
        values[id] = input.value.trim();
      }
      return values;
    },
  };
}
