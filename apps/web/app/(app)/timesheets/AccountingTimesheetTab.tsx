'use client';

import {
  exportAccountingTimesheetXlsx,
  formatOvertimeHours,
  getAccountingTimesheet,
  reopenAccountingMonth,
  resolveAccountingDays,
  type ResolveAccountingDaysInput,
  type AccountingTimesheetLineDto,
  type AccountingTimesheetResponse,
  type AccountingTimesheetStatus,
} from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { filterChipClassName } from '@/components/filterChipStyles';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { PersonName } from '@/components/PersonAvatar';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { downloadBlobFile } from '@/utils/downloadBlobFile';
import { AccountingGapsPanel } from './AccountingGapsPanel';
import { AccountingPreviewModal } from './AccountingPreviewModal';
import { MonthPicker } from './MonthPicker';
import { StatTile, StatTileRow } from './StatTile';
import { formatHoursDecimal, formatRomanianDate } from './timesheetFormat';
import { currentMonth, formatMonthLabel, lastCompleteMonth } from './timesheetMonths';
import {
  ACCOUNTING_STATUS_LABELS,
  accountingStatusBadgeClassName,
  STATUS_BADGE_CLASS,
} from './timesheetStatus';

interface AccountingTimesheetTabProps {
  active: boolean;
  /** Step 3 of the flow — where the missing approvals are. */
  onOpenApprovals: () => void;
}

type StatusFilter = 'all' | AccountingTimesheetStatus;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Toate' },
  { id: 'IN_PREGATIRE', label: ACCOUNTING_STATUS_LABELS.IN_PREGATIRE },
  { id: 'GATA_EXPORT', label: ACCOUNTING_STATUS_LABELS.GATA_EXPORT },
  { id: 'EXPORTAT', label: ACCOUNTING_STATUS_LABELS.EXPORTAT },
];

const ALL_ROLES = 'all';

const inputClassName =
  'rounded-md border border-border bg-surface-raised px-3 py-[7px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function formatGeneratedAt(date: Date): string {
  return date.toLocaleString('ro-RO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatExportedAt(iso: string): string {
  return new Date(iso).toLocaleString('ro-RO', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMissingDays(count: number): string {
  return count === 1 ? '1 zi fără pontaj' : `${count} zile fără pontaj`;
}

function matchesSearch(line: AccountingTimesheetLineDto, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return `${line.person.firstName} ${line.person.lastName} ${line.person.lastName} ${line.person.firstName}`
    .toLowerCase()
    .includes(needle);
}

/**
 * Step 4 of the flow: the month's hours per person, ready for accounting.
 * Nothing is saved here — "Generează" recomputes from the pontaje and the
 * approvals as they stand. Freezing the month comes with the document sent to
 * accounting, later.
 */
export function AccountingTimesheetTab({ active, onOpenApprovals }: AccountingTimesheetTabProps) {
  const { showToast } = useToast();
  const businessAutofill = useBusinessAutofillProps();
  const [month, setMonth] = useState(lastCompleteMonth);
  const [report, setReport] = useState<AccountingTimesheetResponse | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [resolvingGaps, setResolvingGaps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState(ALL_ROLES);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);

    try {
      setReport(await getAccountingTimesheet(target));
      setGeneratedAt(new Date());
    } catch (caught) {
      setReport(null);
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [month, load]);

  // Back on the step after an approval: the overtime column changed.
  useEffect(() => {
    if (active && !loading) {
      void load(month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function handleExport() {
    setExporting(true);
    try {
      const { blob, filename } = await exportAccountingTimesheetXlsx(month);
      downloadBlobFile(blob, filename ?? `Pontaj_${month}.xlsx`);
      showToast(
        `Document generat — ${formatMonthLabel(month).toLowerCase()} este marcată ca exportată.`,
        'success',
      );
      setPreviewOpen(false);
      await load(month);
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setExporting(false);
    }
  }

  /**
   * The document never goes out with a blank working day on it: while there
   * are gaps, the export stops at the dialog that fills them.
   */
  function requestExport() {
    if (report && report.totals.missingDays > 0) {
      setGapsOpen(true);
      return;
    }
    void handleExport();
  }

  async function handleGapsConfirm(resolutions: ResolveAccountingDaysInput['resolutions']) {
    setResolvingGaps(true);
    try {
      const result = await resolveAccountingDays({ month, resolutions });
      showToast(
        `${result.resolved === 1 ? '1 zi completată' : `${result.resolved} zile completate`}${
          result.skipped > 0 ? `, ${result.skipped} sărite (aveau deja pontaj sau concediu)` : ''
        }.`,
        'success',
      );
      setGapsOpen(false);
      await handleExport();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setResolvingGaps(false);
    }
  }

  async function handleReopen() {
    setReopening(true);
    try {
      await reopenAccountingMonth(month);
      showToast(`${formatMonthLabel(month)} a fost redeschisă.`, 'success');
      await load(month);
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setReopening(false);
    }
  }

  const lines = useMemo(() => report?.lines ?? [], [report]);
  const roles = useMemo(
    () =>
      [...new Set(lines.map((line) => line.person.employeeRole?.name).filter(Boolean))].sort(
        (a, b) => (a as string).localeCompare(b as string, 'ro'),
      ) as string[],
    [lines],
  );

  const visibleLines = lines.filter(
    (line) =>
      matchesSearch(line, search) &&
      (role === ALL_ROLES || line.person.employeeRole?.name === role) &&
      (statusFilter === 'all' || line.status === statusFilter),
  );

  const totals = report?.totals ?? null;
  const readyCount = lines.filter((line) => line.status === 'GATA_EXPORT').length;
  const hasFilters = search.trim() !== '' || role !== ALL_ROLES || statusFilter !== 'all';

  const columns: DataTableColumn<AccountingTimesheetLineDto>[] = [
    {
      key: 'person',
      header: 'Persoană',
      width: '240px',
      render: (line) => <PersonName person={line.person} nameClassName="font-medium" />,
    },
    {
      key: 'role',
      header: 'Rol',
      width: '170px',
      className: 'text-text-secondary',
      render: (line) => (
        <span className="flex items-center gap-1.5">
          <span className="truncate">{line.person.employeeRole?.name ?? '—'}</span>
          {line.isExternal ? (
            <span
              className="shrink-0 rounded border border-border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-text-muted"
              title="Colaborator extern — fără număr fix de zile; nu intră în documentul pentru contabilitate"
            >
              extern
            </span>
          ) : null}
          {line.isAutoPresent ? (
            <span
              className="shrink-0 rounded border border-border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-text-muted"
              title="Prezență automată — nu pontează; prezent în fiecare zi lucrătoare fără concediu"
            >
              auto
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'normal',
      header: 'Ore normale',
      width: '120px',
      className: 'text-right tabular-nums',
      render: (line) => formatOvertimeHours(line.normalMinutes),
    },
    {
      key: 'overtime',
      header: 'Ore suplimentare',
      width: '140px',
      className: 'text-right tabular-nums',
      render: (line) => (
        <span
          className={
            line.overtimeMinutes > 0 ? 'font-semibold text-warning-text' : 'text-text-muted'
          }
        >
          {line.overtimeMinutes > 0 ? formatOvertimeHours(line.overtimeMinutes) : '0h'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total ore',
      width: '110px',
      className: 'text-right tabular-nums font-semibold',
      render: (line) => formatOvertimeHours(line.totalMinutes),
    },
    {
      key: 'saturdays',
      header: 'Sâmbete lucrate',
      width: '120px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (line) => (line.saturdaysWorked === 0 ? '—' : line.saturdaysWorked),
    },
    {
      key: 'status',
      header: 'Status',
      render: (line) => (
        <div>
          <span className={`${STATUS_BADGE_CLASS} ${accountingStatusBadgeClassName(line.status)}`}>
            {ACCOUNTING_STATUS_LABELS[line.status]}
          </span>
          {line.pendingBalanceMinutes !== null ? (
            <div className="mt-1 text-[11px] text-text-muted">
              {line.pendingBalanceMinutes > 0
                ? `${formatOvertimeHours(line.pendingBalanceMinutes)} în așteptare, neincluse`
                : `datorie de ${formatOvertimeHours(line.pendingBalanceMinutes)}, de aprobat`}
            </div>
          ) : null}
          {line.missingWorkingDays.length > 0 ? (
            <div
              className="mt-1 text-[11px] text-warning-text"
              title={line.missingWorkingDays.map((day) => formatRomanianDate(day)).join(', ')}
            >
              {formatMissingDays(line.missingWorkingDays.length)}
            </div>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-text-primary">Pontaj pentru contabilitate</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Ultimul pas al fluxului: orele lunii pe fiecare persoană, cu orele suplimentare aprobate
            incluse.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={exporting || loading || lines.length === 0}
            onClick={requestExport}
            title="Descarcă documentul pentru contabilitate și marchează luna ca exportată"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
          >
            <i
              className={`ti ${exporting ? 'ti-loader-2 animate-spin' : 'ti-file-spreadsheet'} text-base`}
              aria-hidden="true"
            />
            {report?.export ? 'Exportă din nou' : 'Exportă'}
          </button>
          <button
            type="button"
            disabled={loading || !report}
            onClick={() => setPreviewOpen(true)}
            title="Arată documentul exact așa cum va fi exportat"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm"
          >
            <i
              className={`ti ${loading ? 'ti-loader-2 animate-spin' : 'ti-eye'} text-base`}
              aria-hidden="true"
            />
            Vizualizează pontaj
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <MonthPicker value={month} onChange={setMonth} max={currentMonth()} disabled={loading} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Caută persoană…"
          aria-label="Caută persoană"
          className={`${inputClassName} w-48`}
          {...businessAutofill}
        />
        <label className="inline-flex items-center gap-2 text-xs text-text-muted">
          Rol
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className={`${inputClassName} pr-8`}
          >
            <option value={ALL_ROLES}>Toate</option>
            {roles.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={filterChipClassName(statusFilter === filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {generatedAt ? (
          <span className="ml-auto hidden text-xs text-text-muted sm:inline">
            actualizat {formatGeneratedAt(generatedAt)}
          </span>
        ) : null}
      </div>

      {report?.export ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-success-border bg-success-bg px-4 py-3 text-sm text-success-text">
          <i className="ti ti-lock-check shrink-0 text-base" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold">{formatMonthLabel(month)} este exportată</span> —
            document generat la {formatExportedAt(report.export.exportedAt)}
            {report.export.exportedBy
              ? ` de ${report.export.exportedBy.firstName} ${report.export.exportedBy.lastName}`
              : ''}
            . Pontajele modificate după acest moment nu sunt în documentul trimis.
          </div>
          <button
            type="button"
            disabled={reopening}
            onClick={() => void handleReopen()}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-success-border px-2.5 py-1 text-xs font-semibold text-success-text transition-colors hover:bg-success-border/40 disabled:opacity-50"
          >
            <i
              className={`ti ${reopening ? 'ti-loader-2 animate-spin' : 'ti-lock-open'} text-sm`}
              aria-hidden="true"
            />
            Redeschide luna
          </button>
        </div>
      ) : null}

      {totals && totals.missingDays > 0 ? (
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-lg border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text">
          <i className="ti ti-calendar-question mt-0.5 shrink-0 text-base" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold">
              {formatMissingDays(totals.missingDays)} la{' '}
              {totals.missingDaysPersons === 1
                ? '1 persoană'
                : `${totals.missingDaysPersons} persoane`}
            </span>{' '}
            — zile lucrătoare fără pontaj și fără concediu aprobat. Exportul se oprește întâi la
            fereastra în care alegi pentru fiecare: prezent, concediu sau liber.
          </div>
        </div>
      ) : null}

      {report?.monthInProgress ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-info-border bg-info-bg px-4 py-3 text-sm text-info-text">
          <i className="ti ti-info-circle mt-0.5 shrink-0 text-base" aria-hidden="true" />
          <div>
            <span className="font-semibold">{formatMonthLabel(month)} nu s-a încheiat.</span> Orele
            suplimentare se aprobă abia după ultima zi a lunii, așa că pontajul de aici conține
            deocamdată doar orele normale.
          </div>
        </div>
      ) : totals && totals.pendingCount > 0 ? (
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-lg border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text">
          <i className="ti ti-alert-triangle mt-0.5 shrink-0 text-base" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold">
              {totals.pendingCount === 1
                ? '1 persoană așteaptă aprobarea'
                : `${totals.pendingCount} persoane așteaptă aprobarea`}{' '}
              ({formatOvertimeHours(totals.pendingBalanceMinutes)})
            </span>{' '}
            și orele lor suplimentare nu sunt incluse în totaluri. Orele suplimentare intră în
            contabilitate doar după aprobare.
          </div>
          <button
            type="button"
            onClick={onOpenApprovals}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-warning-border px-2.5 py-1 text-xs font-semibold text-warning-text transition-colors hover:bg-warning-border/40"
          >
            Mergi la aprobări
            <i className="ti ti-arrow-right text-sm" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        <StatTileRow>
          <StatTile
            label="Total angajați"
            icon="ti-users"
            value={loading || !totals ? '—' : totals.persons}
            hint={loading || !totals ? undefined : `${readyCount} gata pentru export`}
          />
          <StatTile
            label="Total ore normale"
            icon="ti-clock"
            value={loading || !totals ? '—' : formatHoursDecimal(totals.normalMinutes)}
            hint={formatMonthLabel(month)}
          />
          <StatTile
            label="Ore suplimentare aprobate"
            icon="ti-flame"
            value={loading || !totals ? '—' : formatHoursDecimal(totals.overtimeMinutes)}
            hint={
              totals && totals.pendingBalanceMinutes > 0
                ? `${formatOvertimeHours(totals.pendingBalanceMinutes)} în așteptare, neincluse`
                : 'doar orele aprobate'
            }
          />
          <StatTile
            label="Total ore"
            icon="ti-sum"
            accent
            value={loading || !totals ? '—' : formatHoursDecimal(totals.totalMinutes)}
            hint="de trimis către contabilitate"
          />
        </StatTileRow>
      </div>

      {error ? (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void load(month)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      ) : null}

      <div className="mt-5">
        <DataTable
          storageKey="accounting-timesheet-list"
          columns={columns}
          data={visibleLines}
          rowKey={(line) => line.person.id}
          loading={loading}
          emptyMessage={
            hasFilters ? 'Nicio persoană nu corespunde filtrelor.' : 'Nicio persoană găsită.'
          }
        />
      </div>

      {!loading && !error && lines.length > 0 ? (
        <p className="mt-3 text-xs text-text-muted">
          {hasFilters ? `Se afișează ${visibleLines.length} din ${lines.length} persoane. ` : ''}
          Personalul office nu apare pe pontaj. Colaboratorii externi apar cu zilele lucrate, dar
          fără zile lipsă și fără ore suplimentare — nu au un număr fix de zile. Persoanele cu
          „prezență automată” (conducere, contabilitate) nu pontează: apar prezente în fiecare zi
          lucrătoare fără concediu aprobat. Orele normale sunt orele pontate fără cele peste
          program; orele suplimentare sunt doar cele aprobate pentru plată. În document, o zi cu
          pontaj sau cu recuperare aprobată e X, concediile apar cu codul lor (CO, CM, CFP), iar
          sâmbetele lucrate se numără separat. „Exportă” descarcă documentul și marchează luna ca
          exportată — reversibil.
        </p>
      ) : null}

      {previewOpen && report ? (
        <AccountingPreviewModal
          open
          month={month}
          report={report}
          exporting={exporting}
          onClose={() => setPreviewOpen(false)}
          onExport={requestExport}
        />
      ) : null}

      {gapsOpen ? (
        <AccountingGapsPanel
          open
          month={month}
          lines={lines.filter((line) => line.missingWorkingDays.length > 0)}
          busy={resolvingGaps}
          onCancel={() => setGapsOpen(false)}
          onConfirm={(resolutions) => void handleGapsConfirm(resolutions)}
        />
      ) : null}
    </div>
  );
}
