/**
 * Theme toggle UI and persistence.
 */

export const THEME_STORAGE_KEY = 'datavis_theme';

export function getTheme() {
  const theme = document.documentElement.getAttribute('data-theme');
  return theme === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
  updateToggleButton();
  window.dispatchEvent(new CustomEvent('datavis-themechange', { detail: { theme: next } }));
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function updateToggleButton() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const dark = getTheme() === 'dark';
  btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  btn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
  btn.dataset.theme = getTheme();
  const label = btn.querySelector('.theme-toggle-label');
  if (label) label.textContent = dark ? 'Light' : 'Dark';
}

function initThemeToggle() {
  updateToggleButton();
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeToggle);
} else {
  initThemeToggle();
}
