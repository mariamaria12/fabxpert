'use client';

import type {
  AccountingDayResolution,
  AccountingTimesheetLineDto,
  ResolveAccountingDaysInput,
} from '@fabxpert/shared';
import { useEffect, useMemo, useState } from 'react';
import { PersonName } from '@/components/PersonAvatar';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { formatRomanianDate } from './timesheetFormat';
import { formatMonthLabel } from './timesheetMonths';

interface AccountingGapsPanelProps {
  open: boolean;
  month: string;
  lines: AccountingTimesheetLineDto[];
  busy: boolean;
  onCancel: () => void;
  /** One resolution per gap — the export does not run until every gap has one. */
  onConfirm: (resolutions: ResolveAccountingDaysInput['resolutions']) => void;
}

type Choice = AccountingDayResolution | '';

const CHOICES: { id: AccountingDayResolution; label: string }[] = [
  { id: 'PRESENT', label: 'Prezent (X)' },
  { id: 'RECUPERARE', label: 'Liber din ore suplimentare (X)' },
  { id: 'ODIHNA', label: 'Concediu de odihnă (CO)' },
  { id: 'MEDICAL', label: 'Concediu medical (CM)' },
  { id: 'NEPLATIT', label: 'Concediu fără plată (CFP)' },
  { id: 'BLOOD_DONATION', label: 'Donare de sânge (DS)' },
];

function weekdayLabel(date: string): string {
  const label = new Date(`${date}T00:00:00`).toLocaleDateString('ro-RO', { weekday: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const selectClassName =
  'w-full rounded-md border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50';

/**
 * The working days that have neither a pontaj nor leave, one row each. The
 * document cannot go out with a blank working day on it, so every row needs
 * a decision before the export continues.
 */
export function AccountingGapsPanel({
  open,
  month,
  lines,
  busy,
  onCancel,
  onConfirm,
}: AccountingGapsPanelProps) {
  const rows = useMemo(
    () =>
      lines.flatMap((line) =>
        line.missingWorkingDays.map((date) => ({
          key: `${line.person.id}|${date}`,
          personId: line.person.id,
          person: line.person,
          date,
        })),
      ),
    [lines],
  );
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  useEffect(() => {
    if (open) {
      setChoices({});
    }
  }, [open]);

  const undecided = rows.filter((row) => (choices[row.key] ?? '') === '').length;

  function setAll(choice: AccountingDayResolution) {
    setChoices(Object.fromEntries(rows.map((row) => [row.key, choice])));
  }

  function confirm() {
    onConfirm(
      rows.map((row) => ({
        personId: row.personId,
        date: row.date,
        resolution: choices[row.key] as AccountingDayResolution,
      })),
    );
  }

  const footer = (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        disabled={busy || undecided > 0}
        onClick={confirm}
        title={undecided > 0 ? `Mai sunt ${undecided} zile fără decizie` : undefined}
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy
          ? 'Se completează…'
          : undecided > 0
            ? `Mai alege ${undecided} ${undecided === 1 ? 'zi' : 'zile'}`
            : `Completează ${rows.length} ${rows.length === 1 ? 'zi' : 'zile'} și exportă`}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onCancel}
        className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        Anulează
      </button>
    </div>
  );

  return (
    <SlideOverPanel
      open={open}
      title={`Zile fără pontaj — ${formatMonthLabel(month)}`}
      onClose={onCancel}
      disableClose={busy}
      footer={footer}
      widthClassName="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          {rows.length === 1 ? 'O zi lucrătoare' : `${rows.length} zile lucrătoare`} fără pontaj și
          fără concediu aprobat. Documentul se exportă abia după ce fiecare are un marcaj: „Prezent”
          pune un X fără ore, iar un concediu sau un liber creează o cerere aprobată pe ziua
          respectivă.
        </p>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-text-muted">Toate:</span>
          {CHOICES.slice(0, 2).map((choice) => (
            <button
              key={choice.id}
              type="button"
              disabled={busy}
              onClick={() => setAll(choice.id)}
              className="rounded-md border border-border px-2.5 py-1 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
            >
              {choice.label}
            </button>
          ))}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary">
              <th className="py-2 text-left font-normal">Persoană</th>
              <th className="py-2 text-left font-normal">Ziua</th>
              <th className="w-64 py-2 text-left font-normal">Pe pontaj</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const firstOfPerson = index === 0 || rows[index - 1].personId !== row.personId;
              const value = choices[row.key] ?? '';
              return (
                <tr
                  key={row.key}
                  className={firstOfPerson && index > 0 ? 'border-t border-border' : ''}
                >
                  <td className="py-1.5 pr-3 align-middle">
                    {firstOfPerson ? (
                      <PersonName person={row.person} nameClassName="font-medium" />
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3 align-middle tabular-nums text-text-secondary">
                    {weekdayLabel(row.date)}, {formatRomanianDate(row.date)}
                  </td>
                  <td className="py-1.5 align-middle">
                    <select
                      value={value}
                      disabled={busy}
                      aria-label={`Marcaj pentru ${row.person.firstName} ${row.person.lastName}, ${formatRomanianDate(row.date)}`}
                      onChange={(event) =>
                        setChoices((current) => ({
                          ...current,
                          [row.key]: event.target.value as Choice,
                        }))
                      }
                      className={`${selectClassName} ${value === '' ? 'border-warning-border' : 'border-border'}`}
                    >
                      <option value="">— alege —</option>
                      {CHOICES.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SlideOverPanel>
  );
}
