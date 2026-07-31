/**
 * 主题模式（浅 / 深）管理。
 * - 持久化到 localStorage，刷新保持一致
 * - 跟随系统：首次访问且无存储偏好时，读取 prefers-color-scheme
 */
const KEY = "sm-theme";

export type ThemeMode = "light" | "dark";

export function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(KEY);
  if (stored === "light" || stored === "dark") return stored;
  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
}

export function initTheme() {
  applyTheme(getStoredTheme());
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode =
    document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(KEY, next);
  return next;
}
