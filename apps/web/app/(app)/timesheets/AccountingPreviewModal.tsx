'use client';

import { formatOvertimeHours, type AccountingTimesheetResponse } from '@fabxpert/shared';
import { useEffect } from 'react';
import { formatMonthLabel } from './timesheetMonths';

interface AccountingPreviewModalProps {
  open: boolean;
  month: string;
  report: AccountingTimesheetResponse;
  exporting: boolean;
  onClose: () => void;
  /** Same entry point as the Exportă button: stops at the gaps dialog when needed. */
  onExport: () => void;
}

const WEEKDAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const CODE_CLASS: Record<string, string> = {
  X: 'text-text-primary',
  CO: 'bg-status-livrat-bg text-status-livrat-text',
  CM: 'bg-status-in-productie-bg text-status-in-productie-text',
  CFP: 'bg-status-ciorna-bg text-status-ciorna-text',
};

function countCodes(codes: string[], ...wanted: string[]): number {
  return codes.filter((code) => wanted.includes(code)).length;
}

/**
 * The document as it will be generated, on the whole screen: the day grid
 * per person, the counters, and every working day still unaccounted for
 * marked so it can be dealt with before the export.
 */
export function AccountingPreviewModal({
  open,
  month,
  report,
  exporting,
  onClose,
  onExport,
}: AccountingPreviewModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, monthNumber - 1, index + 1);
    const key = `${month}-${String(index + 1).padStart(2, '0')}`;
    return {
      key,
      number: index + 1,
      letter: WEEKDAY_LETTERS[date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
  const gaps = report.totals.missingDays;

  const headCell = 'sticky top-0 z-10 border-b border-border bg-surface px-1 py-1.5 text-center';
  const dayCell = 'border-b border-border-subtle px-0.5 py-1 text-center text-[11px] font-semibold';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pontaj ${formatMonthLabel(month)}`}
      className="fixed inset-0 z-50 flex flex-col bg-bg"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-medium text-text-primary">
            Pontaj luna {formatMonthLabel(month).toLowerCase()}
          </h2>
          <p className="text-xs text-text-muted">
            {report.totals.persons} persoane · {report.workingDays} zile lucrătoare ·{' '}
            {formatOvertimeHours(report.totals.overtimeMinutes)} ore suplimentare aprobate
            {gaps > 0
              ? ` · ${gaps === 1 ? '1 zi fără pontaj' : `${gaps} zile fără pontaj`} de completat înainte de export`
              : ' · gata de export'}
          </p>
        </div>
        <button
          type="button"
          disabled={exporting || report.lines.length === 0}
          onClick={onExport}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60 ${
            gaps > 0
              ? 'border border-warning-border bg-warning-bg text-warning-text'
              : 'bg-accent text-accent-contrast'
          }`}
        >
          <i
            className={`ti ${exporting ? 'ti-loader-2 animate-spin' : gaps > 0 ? 'ti-calendar-question' : 'ti-file-spreadsheet'} text-base`}
            aria-hidden="true"
          />
          {gaps > 0 ? `Completează ${gaps} ${gaps === 1 ? 'zi' : 'zile'} și exportă` : 'Exportă'}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide previzualizarea"
          title="Închide"
          className="flex size-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <i className="ti ti-x text-base" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className={`${headCell} left-0 z-20 w-8 text-text-muted`}>#</th>
              <th className={`${headCell} left-8 z-20 min-w-[180px] text-left text-text-muted`}>
                Persoană
              </th>
              {days.map((day) => (
                <th
                  key={day.key}
                  className={`${headCell} w-8 ${day.isWeekend ? 'bg-surface-sunken' : ''}`}
                >
                  <span className="block text-[10px] font-normal text-text-muted">
                    {day.letter}
                  </span>
                  <span className="tabular-nums text-text-secondary">{day.number}</span>
                </th>
              ))}
              {['Zile lucrate', 'CO / CM', 'CFP', 'Zile', 'Sâmbete', 'Ore extra'].map((header) => (
                <th
                  key={header}
                  className={`${headCell} min-w-[64px] whitespace-nowrap px-2 text-[10px] font-medium uppercase tracking-wide text-text-muted`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.lines.map((line, index) => {
              const worked = countCodes(line.dayCodes, 'X');
              const leave = countCodes(line.dayCodes, 'CO', 'CM');
              const unpaid = countCodes(line.dayCodes, 'CFP');
              const missing = new Set(line.missingWorkingDays);

              return (
                <tr key={line.person.id} className="hover:bg-surface-hover">
                  <td
                    className={`${dayCell} sticky left-0 z-10 bg-surface tabular-nums text-text-muted`}
                  >
                    {index + 1}
                  </td>
                  <td
                    className={`${dayCell} sticky left-8 z-10 whitespace-nowrap bg-surface px-2 text-left text-xs font-medium text-text-primary`}
                  >
                    {line.person.lastName} {line.person.firstName}
                    {line.isExternal ? (
                      <span className="ml-1.5 text-[10px] font-normal uppercase text-text-muted">
                        extern
                      </span>
                    ) : null}
                    {line.isAutoPresent ? (
                      <span className="ml-1.5 text-[10px] font-normal uppercase text-text-muted">
                        auto
                      </span>
                    ) : null}
                  </td>
                  {days.map((day, dayIndex) => {
                    const code = line.dayCodes[dayIndex] ?? '';
                    const isGap = missing.has(day.key);
                    return (
                      <td
                        key={day.key}
                        title={isGap ? 'Zi lucrătoare fără pontaj și fără concediu' : undefined}
                        className={`${dayCell} ${
                          isGap
                            ? 'bg-warning-bg text-warning-text'
                            : day.isWeekend
                              ? 'bg-surface-sunken'
                              : (CODE_CLASS[code] ?? 'text-text-secondary')
                        }`}
                      >
                        {isGap ? '?' : code}
                      </td>
                    );
                  })}
                  <td className={`${dayCell} px-2 text-sm tabular-nums text-text-primary`}>
                    {worked}
                  </td>
                  <td className={`${dayCell} px-2 tabular-nums text-text-secondary`}>
                    {leave || '–'}
                  </td>
                  <td className={`${dayCell} px-2 tabular-nums text-text-secondary`}>
                    {unpaid || '–'}
                  </td>
                  <td className={`${dayCell} px-2 tabular-nums text-text-secondary`}>
                    {worked + leave + unpaid}
                  </td>
                  <td className={`${dayCell} px-2 tabular-nums text-text-secondary`}>
                    {line.saturdaysWorked || '–'}
                  </td>
                  <td
                    className={`${dayCell} px-2 tabular-nums ${line.overtimeMinutes > 0 ? 'text-warning-text' : 'text-text-muted'}`}
                  >
                    {line.overtimeMinutes > 0 ? formatOvertimeHours(line.overtimeMinutes) : '–'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-text-muted">
          <span>
            <b className="text-text-secondary">X</b> prezent
          </span>
          <span>
            <b className="text-text-secondary">CO / CM / CFP</b> concediu de odihnă / medical / fără
            plată
          </span>
          <span>
            <b className="text-warning-text">?</b> zi lucrătoare fără pontaj și fără concediu — se
            completează la export
          </span>
          <span>
            sâmbetele nu primesc X: se numără separat, iar doar ce trece de 7,5 h e suplimentar
          </span>
        </div>
      </div>
    </div>
  );
}
