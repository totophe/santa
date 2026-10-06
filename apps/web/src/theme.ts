import type { PublicMeta } from './api';

const TOKENS = ['bg', 'surface', 'text', 'muted', 'line', 'primary', 'on-primary', 'accent', 'on-accent', 'soft', 'success', 'warning', 'danger'];

/** Apply an edition theme's palette to CSS custom properties (light mode). */
export function applyTheme(meta: PublicMeta | null, themeName: string | null): void {
  const root = document.documentElement;
  if (!meta || !themeName) {
    // Reset to the shell default (generic light) by removing inline overrides.
    for (const t of TOKENS) root.style.removeProperty(`--${t}`);
    return;
  }
  const theme = meta.themes.find((t) => t.name === themeName);
  if (!theme) return;
  const palette = theme.palette.light;
  for (const t of TOKENS) {
    if (palette[t]) root.style.setProperty(`--${t}`, palette[t]);
  }
}
