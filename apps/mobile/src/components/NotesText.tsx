import { splitTextByRal } from '@fabxpert/shared';
import { FinisajBadge } from './FinisajBadge';

/**
 * Project notes with every RAL code shown as its colour badge, right where it
 * was written — the notes usually say which part gets which colour.
 */
export function NotesText({ value, className }: { value: string; className?: string }) {
  return (
    <p className={className}>
      {splitTextByRal(value).map((part, index) =>
        part.kind === 'ral' ? (
          <span key={index} className="notes-ral">
            <FinisajBadge value={part.label} />
          </span>
        ) : (
          part.text
        ),
      )}
    </p>
  );
}
