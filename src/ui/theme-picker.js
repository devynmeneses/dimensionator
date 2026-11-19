/**
 * Theme picker in the footer (like Monkeytype's): click the theme name to see
 * every theme, each drawn in its own colors, and pick one.
 *
 * Colors live in styles/themes.css. The choice is remembered in this browser
 * (an inline script in index.html applies it before the page draws).
 */

/** Every theme. `id` must match a [data-theme="…"] block in styles/themes.css. */
export const THEMES = [
  { id: "jungle", name: "jungle" }, // first = default
  { id: "cobalt", name: "cobalt (original)" },
];

const STORAGE_KEY = "dimensionator-theme";

export function setupThemePicker() {
  const button = document.getElementById("theme-button");
  const nameLabel = document.getElementById("theme-name");
  const list = document.getElementById("theme-list");

  const options = THEMES.map((theme) => {
    const item = document.createElement("li");
    const option = document.createElement("button");
    option.type = "button";
    option.className = "theme-option";
    option.dataset.theme = theme.id; // makes the option use that theme's colors
    option.setAttribute("role", "option");
    option.innerHTML = `<span></span><span class="theme-dots" aria-hidden="true">
      <span style="background: var(--main)"></span>
      <span style="background: var(--accent)"></span>
      <span style="background: var(--text)"></span>
    </span>`;
    option.firstElementChild.textContent = theme.name;
    option.addEventListener("click", () => {
      applyTheme(theme.id);
      close();
      button.focus();
    });
    item.append(option);
    list.append(item);
    return option;
  });

  button.addEventListener("click", () => (list.hidden ? open() : close()));

  // Close when clicking elsewhere or pressing Escape.
  document.addEventListener("click", (event) => {
    if (!list.hidden && !event.target.closest(".theme-picker")) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !list.hidden) {
      close();
      button.focus();
    }
  });

  // If the saved theme no longer exists, this falls back to the default and saves that instead.
  const saved = currentThemeId();
  applyTheme(saved, { save: !THEMES.some((t) => t.id === saved) });

  function open() {
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    options.find((o) => o.getAttribute("aria-selected") === "true")?.focus();
  }

  function close() {
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function applyTheme(id, { save = true } = {}) {
    const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
    document.documentElement.dataset.theme = theme.id;
    nameLabel.textContent = theme.name;
    options.forEach((o) => o.setAttribute("aria-selected", String(o.dataset.theme === theme.id)));
    if (save) {
      try {
        localStorage.setItem(STORAGE_KEY, theme.id);
      } catch {
        // Storage can be blocked (private windows); the theme still applies for this visit.
      }
    }
  }
}

function currentThemeId() {
  return document.documentElement.dataset.theme;
}
