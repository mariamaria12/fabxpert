import { assemblyDoneForActivity, assemblyRemainingForActivity } from '@fabxpert/shared';
import type { ActivityDto } from '@fabxpert/shared';
import {
  TICK_GRID_LIMIT,
  countWithNoun,
  formatAssemblyMeta,
  totalSelectedPieces,
  type AssemblySelection,
} from '../utils/assemblyUtils';

interface AssemblyQuantitiesProps {
  activity: ActivityDto;
  selection: AssemblySelection[];
  onChangeQuantity: (assemblyId: string, quantity: number) => void;
  onRemove: (assemblyId: string) => void;
  onAddMore: () => void;
  onContinue: () => void;
}

interface QuantityCardProps {
  entry: AssemblySelection;
  activityId: string;
  onChangeQuantity: (assemblyId: string, quantity: number) => void;
  onRemove: (assemblyId: string) => void;
}

function TickIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuantityCard({ entry, activityId, onChangeQuantity, onRemove }: QuantityCardProps) {
  const { assembly, quantity } = entry;
  const doneBefore = assemblyDoneForActivity(assembly, activityId);
  const capacity = assemblyRemainingForActivity(assembly, activityId);
  const previousTicks = Math.min(doneBefore, assembly.quantity);
  const meta = formatAssemblyMeta(assembly, { includeProfile: true, includeWeight: true });

  /**
   * Tapping the fourth box means "I did four", so it fills one to four. Tapping
   * the last filled box again clears it — that is the way back down. There is no
   * box past what is left on the list, so nothing can be reported over it.
   */
  function handleTick(index: number) {
    onChangeQuantity(assembly.id, quantity === index ? index - 1 : index);
  }

  return (
    <div className="assembly-qty-card">
      <div className="assembly-qty-head">
        <div className="assembly-qty-head-body">
          <p className="assembly-mark assembly-qty-mark">{assembly.name}</p>
          {meta ? <p className="assembly-meta">{meta}</p> : null}
        </div>
        <button
          type="button"
          className="assembly-qty-remove"
          aria-label={`Scoate ${assembly.name} din pontaj`}
          onClick={() => onRemove(assembly.id)}
        >
          ✕
        </button>
      </div>

      {capacity <= TICK_GRID_LIMIT ? (
        <div className="assembly-tick-row">
          {Array.from({ length: previousTicks }, (_, index) => (
            <span
              key={`previous-${index}`}
              className="assembly-tick assembly-tick-previous"
              aria-hidden="true"
            >
              <TickIcon />
            </span>
          ))}

          {Array.from({ length: capacity }, (_, index) => {
            const position = index + 1;
            const isOn = position <= quantity;

            return (
              <button
                key={`open-${position}`}
                type="button"
                className={`assembly-tick${isOn ? ' assembly-tick-on' : ''}`}
                aria-pressed={isOn}
                aria-label={`Bucata ${position} din ${capacity} rămase`}
                onClick={() => handleTick(position)}
              >
                <TickIcon />
              </button>
            );
          })}

        </div>
      ) : (
        <div className="assembly-stepper">
          <button
            type="button"
            className="assembly-stepper-button"
            aria-label="O bucată mai puțin"
            disabled={quantity === 0}
            onClick={() => onChangeQuantity(assembly.id, Math.max(0, quantity - 1))}
          >
            −
          </button>
          <span className="assembly-stepper-value">{quantity}</span>
          <button
            type="button"
            className="assembly-stepper-button"
            aria-label="O bucată în plus"
            disabled={quantity >= capacity}
            onClick={() => onChangeQuantity(assembly.id, Math.min(capacity, quantity + 1))}
          >
            +
          </button>
        </div>
      )}

      <div className="assembly-qty-foot">
        <span>
          {doneBefore > 0 ? (
            <>
              {doneBefore} {doneBefore === 1 ? 'făcută' : 'făcute'} înainte ·{' '}
            </>
          ) : null}
          <span className="assembly-qty-now">
            {quantity} {quantity === 1 ? 'bifată' : 'bifate'} acum
          </span>
          {capacity > TICK_GRID_LIMIT ? <> din {capacity} rămase</> : null}
        </span>

        {capacity > 0 && quantity === capacity ? (
          <span className="assembly-chip assembly-chip-complete">gata tot</span>
        ) : capacity > 1 ? (
          <button
            type="button"
            className="assembly-qty-all"
            onClick={() => onChangeQuantity(assembly.id, capacity)}
          >
            Toate rămase
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AssemblyQuantities({
  activity,
  selection,
  onChangeQuantity,
  onRemove,
  onAddMore,
  onContinue,
}: AssemblyQuantitiesProps) {
  const totalPieces = totalSelectedPieces(selection);
  /** Every card has to say how many — a selected assembly with zero is unfinished. */
  const emptyCards = selection.filter((entry) => entry.quantity === 0).length;
  const canContinue = selection.length > 0 && emptyCards === 0;

  return (
    <div className="flow-screen">
      <div className="flow-content">
        <h2 className="flow-heading">Câte bucăți ai făcut?</h2>
        <p className="flow-subheading">O bifă pentru fiecare bucată terminată.</p>

        <div className="assembly-qty-list">
          {selection.map((entry) => (
            <QuantityCard
              key={entry.assembly.id}
              entry={entry}
              activityId={activity.id}
              onChangeQuantity={onChangeQuantity}
              onRemove={onRemove}
            />
          ))}
        </div>

        <button type="button" className="flow-secondary-button" onClick={onAddMore}>
          + Adaugă alte ansamble
        </button>

        {emptyCards > 0 ? (
          <p className="assembly-missing-note" role="status">
            {emptyCards === 1
              ? 'Un ansamblu nu are nicio bucată bifată. Bifează-l sau scoate-l cu ✕.'
              : `${emptyCards} ansamble nu au nicio bucată bifată. Bifează-le sau scoate-le cu ✕.`}
          </p>
        ) : null}
      </div>

      <div className="flow-footer">
        <div className="assembly-footer-meta">
          <span>{countWithNoun(selection.length, 'ansamblu', 'ansamble')}</span>
          <span>{countWithNoun(totalPieces, 'bucată', 'bucăți')}</span>
        </div>
        <button
          type="button"
          className="flow-primary-button"
          disabled={!canContinue}
          onClick={onContinue}
        >
          Continuă la timp
        </button>
      </div>
    </div>
  );
}
