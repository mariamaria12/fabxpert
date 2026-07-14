export const DROPDOWN_GAP_PX = 4;
export const DROPDOWN_MAX_HEIGHT_PX = 224;

export type DropdownPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function computeDropdownPlacement(input: HTMLElement): DropdownPlacement {
  const rect = input.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP_PX;
  const spaceAbove = rect.top - DROPDOWN_GAP_PX;
  const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;

  if (openUpward) {
    const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT_PX, spaceAbove);
    return {
      top: rect.top - DROPDOWN_GAP_PX - maxHeight,
      left: rect.left,
      width: rect.width,
      maxHeight,
    };
  }

  const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT_PX, spaceBelow);
  return {
    top: rect.bottom + DROPDOWN_GAP_PX,
    left: rect.left,
    width: rect.width,
    maxHeight,
  };
}
