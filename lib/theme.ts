export type ThemePreference = "light" | "dark" | "system";

export const THEME_KEY = "lendloop.theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function readTheme(storage: Pick<Storage, "getItem"> | undefined): ThemePreference {
  try {
    const value = storage?.getItem(THEME_KEY);
    return isThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function writeTheme(storage: Pick<Storage, "setItem" | "removeItem"> | undefined, theme: ThemePreference): void {
  try {
    if (theme === "system") storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the choice lasts for this page view only.
  }
}

/** Sets data-theme on <html>; "system" removes it so the OS setting applies. */
export function applyTheme(root: HTMLElement, theme: ThemePreference): void {
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/** Inline script for <head>: applies the saved theme before first paint. */
export const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
