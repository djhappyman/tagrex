// Surface families are independent of light/dark mode and the user's accent.
export const PALETTE_DEFAULT = "navy";
export const PALETTES = [
  { id: "navy", accent: "#d4a15a" },
  { id: "graphite", accent: "#7697c5" },
  { id: "forest", accent: "#bba36b" },
  { id: "plum", accent: "#ba99cc" },
];
export const DEFAULT_ACCENT = PALETTES[0].accent;
export function normalizePalette(value) {
  return PALETTES.some((palette) => palette.id === value) ? value : PALETTE_DEFAULT;
}
export function paletteAccent(value) {
  return PALETTES.find((palette) => palette.id === normalizePalette(value)).accent;
}
