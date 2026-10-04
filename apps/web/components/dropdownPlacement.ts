export const DROPDOWN_GAP_PX = 4;
export const DROPDOWN_MAX_HEIGHT_PX = 224;
/** Below this the list is too short to read; a phone scrolls the page instead. */
const DROPDOWN_MIN_HEIGHT_PX = 120;

/**
 * Inline style of a dropdown portalled into `document.body` and positioned
 * `absolute`, in page coordinates: the list then scrolls with the page like the
 * field it belongs to, instead of being re-pinned to the screen after the fact.
 */
export type DropdownPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  /** Set when the list opens upward, so its bottom edge stays on the field. */
  transform?: string;
};

/** The part of the layout viewport actually on screen — less the on-screen keyboard. */
function visibleBounds(): { top: number; bottom: number } {
  const viewport = window.visualViewport;
  if (!viewport) {
    return { top: 0, bottom: window.innerHeight };
  }
  return { top: viewport.offsetTop, bottom: viewport.offsetTop + viewport.height };
}

export function computeDropdownPlacement(input: HTMLElement): DropdownPlacement {
  const rect = input.getBoundingClientRect();
  const visible = visibleBounds();
  const spaceBelow = visible.bottom - rect.bottom - DROPDOWN_GAP_PX;
  const spaceAbove = rect.top - visible.top - DROPDOWN_GAP_PX;
  const left = rect.left + window.scrollX;

  // On a touch screen the keyboard and the browser's own scroll-into-view keep
  // changing the room around the field, and a list that flips sides with them
  // lands on top of the input. There it always hangs below.
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const openUpward = !isTouch && spaceBelow < 180 && spaceAbove > spaceBelow;

  if (openUpward) {
    return {
      top: rect.top - DROPDOWN_GAP_PX + window.scrollY,
      left,
      width: rect.width,
      maxHeight: Math.min(DROPDOWN_MAX_HEIGHT_PX, spaceAbove),
      transform: 'translateY(-100%)',
    };
  }

  return {
    top: rect.bottom + DROPDOWN_GAP_PX + window.scrollY,
    left,
    width: rect.width,
    maxHeight: Math.min(
      DROPDOWN_MAX_HEIGHT_PX,
      isTouch ? Math.max(spaceBelow, DROPDOWN_MIN_HEIGHT_PX) : spaceBelow,
    ),
  };
}

/**
 * Calls `update` whenever the field may have moved on screen: page or panel
 * scroll, a resize, and the visual viewport changing under an on-screen
 * keyboard — which moves the page without any window scroll or resize event.
 * Returns the cleanup.
 */
export function watchDropdownPlacement(update: () => void): () => void {
  const viewport = window.visualViewport;

  window.addEventListener('resize', update);
  window.addEventListener('scroll', update, true);
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);

  return () => {
    window.removeEventListener('resize', update);
    window.removeEventListener('scroll', update, true);
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
  };
}
