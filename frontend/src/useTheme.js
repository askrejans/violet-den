import { useEffect, useLayoutEffect, useState } from 'react';

const preferenceKey = 'violetden-theme';
const paletteKey = 'violetden-ha-palette';
const modes = ['violet', 'simple', 'ha'];
const colors = ['background', 'surface', 'secondary', 'primary', 'text', 'muted', 'divider'];

function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function validPalette(value) {
  if (!value || typeof value !== 'object') return null;
  const palette = {};
  for (const key of colors) {
    const color = value[key];
    if (typeof color !== 'string' || !color || color.length > 120) return null;
    if (window.CSS?.supports && !CSS.supports('color', color)) return null;
    palette[key] = color;
  }
  palette.dark = value.dark === true;
  return palette;
}

export default function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = readStored(preferenceKey, 'violet');
    return modes.includes(saved) ? saved : 'violet';
  });
  const [palette, setPalette] = useState(() => validPalette(readStored(paletteKey, null)));

  useEffect(() => {
    const receiveTheme = (event) => {
      if (window.parent === window || event.source !== window.parent) return;
      if (document.referrer && event.origin !== new URL(document.referrer).origin) return;
      if (event.data?.type !== 'ha-theme') return;
      const next = validPalette(event.data.palette);
      if (next) setPalette(next);
    };
    window.addEventListener('message', receiveTheme);
    return () => window.removeEventListener('message', receiveTheme);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme === 'violet' || (theme === 'ha' && palette?.dark) ? 'dark' : 'light';
    for (const key of colors) {
      if (palette) root.style.setProperty(`--ha-${key}`, palette[key]);
      else root.style.removeProperty(`--ha-${key}`);
    }
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(theme));
      if (palette) localStorage.setItem(paletteKey, JSON.stringify(palette));
    } catch {
      // The current selection still works when browser storage is unavailable.
    }
  }, [theme, palette]);

  return [theme, setTheme];
}
