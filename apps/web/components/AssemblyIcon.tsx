/**
 * The icon for assemblies, wherever they are counted or opened: the icon
 * font's "assembly" — a hex nut, which reads as bolted steel. Kept behind one
 * component so every screen changes together.
 */
export function AssemblyIcon({ className }: { className?: string }) {
  return <i className={`ti ti-assembly leading-none ${className ?? ''}`} aria-hidden="true" />;
}
