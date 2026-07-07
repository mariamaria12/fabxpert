const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{6})$/;

/** Convert "#RRGGBB" to rgba(r, g, b, alpha). Returns null if hex is invalid. */
export function hexToRgba(hex: string, alpha: number): string | null {
  const match = HEX_COLOR_PATTERN.exec(hex);
  if (!match) {
    return null;
  }

  const value = match[1];
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function projectOptionTintStyle(color: string | null): {
  background?: string;
  borderColor?: string;
} {
  if (!color) {
    return {};
  }

  const background = hexToRgba(color, 0.32);
  const borderColor = hexToRgba(color, 0.45);

  if (!background || !borderColor) {
    return {};
  }

  return { background, borderColor };
}
