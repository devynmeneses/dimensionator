/**
 * Shared preview helpers used by the Single Image and Multi Image tabs.
 */

/**
 * Wraps a <canvas> (and an optional caption element) as a live preview.
 * The canvas sits inside a fixed-size `.preview-frame` (see app.css), which
 * scales every output to fit so the preview never changes size.
 * @returns {{ show(output, source, values), clear() }}
 */
export function createPreview(canvas, caption) {
  const frame = canvas.closest(".preview-frame");
  const setEmpty = (empty) => frame?.classList.toggle("empty", empty);
  setEmpty(true);

  return {
    /** Renders one output for one image and shows it. */
    show(output, source, values) {
      const rendered = output.render({ image: source.image, analysis: source.analysis, values });
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      canvas.getContext("2d").drawImage(rendered, 0, 0);
      setEmpty(false);
      if (caption) caption.textContent = `– ${output.label} (${rendered.width}×${rendered.height})`;
    },

    clear() {
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      setEmpty(true);
      if (caption) caption.textContent = "";
    },
  };
}

/** Which output the preview shows: the last checked one (e.g. DIM over Web over Silo). */
export function previewOutput(selectedOutputs) {
  return selectedOutputs.at(-1) ?? null;
}

/** Waits until calls stop for `ms` before running `fn` (avoids redrawing on every keystroke). */
export function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
