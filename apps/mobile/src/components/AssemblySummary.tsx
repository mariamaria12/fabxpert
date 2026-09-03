import { countWithNoun } from '../utils/assemblyUtils';

export type AssemblySummaryItem = {
  id: string;
  name: string;
  quantity: number;
};

interface AssemblySummaryProps {
  items: AssemblySummaryItem[];
  /** Shown as "Modifică" — left out where the list is read-only. */
  onEdit?: () => void;
  note?: string;
}

/** The marks and pieces one entry carries, above the time fields. */
export function AssemblySummary({ items, onEdit, note }: AssemblySummaryProps) {
  if (items.length === 0) {
    return null;
  }

  const totalPieces = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <div className="assembly-summary">
      <div className="assembly-summary-head">
        <span className="assembly-summary-title">
          {countWithNoun(items.length, 'ansamblu', 'ansamble')} ·{' '}
          {countWithNoun(totalPieces, 'bucată', 'bucăți')}
        </span>
        {onEdit ? (
          <button type="button" className="assembly-summary-edit" onClick={onEdit}>
            Modifică
          </button>
        ) : null}
      </div>

      <div className="assembly-chip-row">
        {items.map((item) => (
          <span key={item.id} className="assembly-chip assembly-chip-mark">
            {item.name} ×{item.quantity}
          </span>
        ))}
      </div>

      {note ? <p className="assembly-summary-note">{note}</p> : null}
    </div>
  );
}
