export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

// Runs inline in <head> before first paint so the page never flashes the
// wrong theme. Uses the saved choice, falling back to the OS preference.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var d=document.documentElement;d.classList.toggle("dark",t==="dark");d.style.colorScheme=t}catch(e){}})()`;

const listeners = new Set<() => void>();

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  listeners.forEach((listener) => listener());
}

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function getTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function getServerTheme(): Theme {
  return "light";
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked; the theme still applies for this page view.
  }
  applyTheme(theme);
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);

  // Follow OS changes until the user has picked a theme explicitly.
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (!storedTheme()) applyTheme(media.matches ? "dark" : "light");
  };
  // Keep tabs in sync when the choice changes in another window.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const theme = storedTheme();
    applyTheme(theme ?? (media.matches ? "dark" : "light"));
  };
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}
