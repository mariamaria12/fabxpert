/** Preset palette for project colors — shared by web UI and API defaults. */
export const PROJECT_COLOR_PRESETS = [
  '#B5533C',
  '#C9A227',
  '#7A8450',
  '#2F6F4E',
  '#3B7EA1',
  '#5B6BA8',
  '#8E5FA8',
  '#A85B7E',
  '#8A8A8A',
  '#9C6B4A',
] as const;

export type ProjectColorPreset = (typeof PROJECT_COLOR_PRESETS)[number];

export function isProjectColorPreset(color: string): color is ProjectColorPreset {
  return (PROJECT_COLOR_PRESETS as readonly string[]).includes(color.toUpperCase());
}

export function pickRandomProjectColor(): ProjectColorPreset {
  const index = Math.floor(Math.random() * PROJECT_COLOR_PRESETS.length);
  return PROJECT_COLOR_PRESETS[index]!;
}
