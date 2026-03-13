// viteEnv.js
// Export VITE_PRESET_SECTIONS or fallback for Jest
export function getPresetSections() {
  try {
    // Vite/browser
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PRESET_SECTIONS)
      return JSON.parse(import.meta.env.VITE_PRESET_SECTIONS) || [];
    // Jest/node
    if (globalThis.__VITE_PRESET_SECTIONS__)
      return JSON.parse(globalThis.__VITE_PRESET_SECTIONS__);
  } catch {}
  return [];
}
