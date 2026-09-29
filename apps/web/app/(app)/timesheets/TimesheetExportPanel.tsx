'use client';

import {
  exportTimesheetsXlsx,
  formatTimesheetNotesCell,
  isPeriodQueryReady,
  listTimesheets,
  type Period,
  type TimesheetDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { PeriodFilter } from '@/components/PeriodFilter';
import { SearchableSelect, type SearchableSelectOption } from '@/components/SearchableSelect';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { loadAllProjects, toProjectOption } from './projectOptions';
import { EXPORT_PREVIEW_FETCH_SIZE, sortTimesheetsForExport } from './timesheetFilters';
import {
  formatExportHours,
  formatExportWorkerName,
  workDateMonthNumber,
} from './timesheetFormat';
import { WorkDateText } from './WorkDateText';

interface TimesheetExportPanelProps {
  open: boolean;
  initialPeriod: Period;
  /** The list's project filter; none exports every project. */
  initialProjectId?: string | null;
  /**
   * The caller's project list, when it already has one — null while it is still
   * loading. Left out, the panel loads its own.
   */
  projectOptions?: SearchableSelectOption[] | null;
  onClose: () => void;
}

/** Mirrors the xlsx column order — the preview is meant to match the file. */
const previewColumns: DataTableColumn<TimesheetDto>[] = [
  {
    key: 'projectCode',
    header: 'Cod Proiect',
    render: (row) => row.project.code,
  },
  {
    key: 'denumireLucrare',
    header: 'Denumire Lucrare',
    render: (row) => row.project.denumireLucrare || <span className="text-text-muted">—</span>,
  },
  {
    key: 'client',
    header: 'Client',
    render: (row) => row.project.company.name,
  },
  {
    key: 'projectName',
    header: 'Nume',
    render: (row) => row.project.name,
  },
  {
    key: 'month',
    header: 'Lună',
    width: '52px',
    className: 'text-text-secondary tabular-nums',
    render: (row) => workDateMonthNumber(row.workDate),
  },
  {
    key: 'date',
    header: 'Data',
    width: '88px',
    className: 'text-text-secondary',
    render: (row) => <WorkDateText iso={row.workDate} />,
  },
  {
    key: 'hours',
    header: 'Ore',
    width: '56px',
    className: 'text-text-secondary tabular-nums',
    render: (row) => formatExportHours(row.durationMinutes),
  },
  {
    key: 'activity',
    header: 'Tip operație',
    render: (row) => row.activity?.name ?? <span className="text-text-muted">—</span>,
  },
  {
    key: 'worker',
    header: 'Lucrător',
    render: (row) => formatExportWorkerName(row.person),
  },
  {
    key: 'notes',
    header: 'Detalii',
    // Same one-line shape the xlsx cell gets, so the preview matches the file.
    render: (row) =>
      formatTimesheetNotesCell(row.notes) || <span className="text-text-muted">—</span>,
  },
];

export function TimesheetExportPanel({
  open,
  initialPeriod,
  initialProjectId = null,
  projectOptions,
  onClose,
}: TimesheetExportPanelProps) {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [ownProjectOptions, setOwnProjectOptions] = useState<SearchableSelectOption[] | null>(null);
  const loadsOwnProjectOptions = projectOptions === undefined;
  const availableProjectOptions = loadsOwnProjectOptions ? ownProjectOptions : projectOptions;
  const [isExporting, setIsExporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<TimesheetDto[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRequestRef = useRef(0);

  useEffect(() => {
    if (open) {
      setPeriod(initialPeriod);
      setProjectId(initialProjectId);
    }
  }, [open, initialPeriod, initialProjectId]);

  useEffect(() => {
    if (!loadsOwnProjectOptions) {
      return;
    }

    let cancelled = false;

    loadAllProjects()
      .then((projects) => {
        if (!cancelled) {
          setOwnProjectOptions(projects.map(toProjectOption));
        }
      })
      .catch(() => {
        // Without the list the export still covers every project.
        if (!cancelled) {
          setOwnProjectOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadsOwnProjectOptions]);

  const loadPreview = useCallback(async (activePeriod: Period, activeProjectId: string | null) => {
    // The preview must match the file: an answer for an earlier choice is dropped.
    const request = ++previewRequestRef.current;

    if (!isPeriodQueryReady(activePeriod)) {
      setPreviewRows([]);
      setPreviewTotal(0);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const response = await listTimesheets({
        page: 1,
        pageSize: EXPORT_PREVIEW_FETCH_SIZE,
        period: activePeriod,
        ...(activeProjectId ? { projectId: activeProjectId } : {}),
      });
      if (request !== previewRequestRef.current) {
        return;
      }

      setPreviewRows(sortTimesheetsForExport(response.data));
      setPreviewTotal(response.meta.total);
    } catch (caught) {
      if (request !== previewRequestRef.current) {
        return;
      }
      setPreviewRows([]);
      setPreviewTotal(0);
      setPreviewError(apiErrorToastMessage(caught));
    } finally {
      if (request === previewRequestRef.current) {
        setPreviewLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadPreview(period, projectId);
  }, [open, period, projectId, loadPreview]);

  async function handleDownload() {
    if (!isPeriodQueryReady(period) || isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      const { blob, filename } = await exportTimesheetsXlsx({
        period,
        ...(projectId ? { projectId } : {}),
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename ?? 'pontaje.xlsx';
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Fișier generat', 'success');
      onClose();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  const canDownload = isPeriodQueryReady(period) && !isExporting;
  const periodReady = isPeriodQueryReady(period);

  const previewTruncated = previewTotal > previewRows.length;
  const previewTotalMinutes = previewRows.reduce((sum, row) => sum + row.durationMinutes, 0);
  const previewEmptyMessage = periodReady
    ? projectId
      ? 'Nu există pontaje pe acest proiect în perioada selectată.'
      : 'Nu există pontaje în perioada selectată.'
    : 'Selectează o perioadă completă pentru previzualizare.';

  return (
    <SlideOverPanel
      open={open}
      title="Export Excel"
      onClose={onClose}
      disableClose={isExporting}
      // Full width up to the sidebar, so the preview table fits. Phones have no
      // static sidebar, so there the panel simply covers the screen.
      widthClassName="max-w-none sm:max-w-[calc(100vw-var(--sidebar-width,0px))]"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={!canDownload}
            onClick={() => void handleDownload()}
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? 'Se generează…' : 'Descarcă Excel'}
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anulează
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-text-secondary">
        Alege perioada și, opțional, proiectul pentru export. Previzualizarea reflectă datele
        incluse în fișierul Excel.
      </p>
      <PeriodFilter value={period} onChange={setPeriod} />
      <div className="mt-4 max-w-md">
        <SearchableSelect
          id="timesheet-export-project"
          label="Proiect"
          placeholder="Toate proiectele"
          emptyMessage={
            availableProjectOptions ? 'Niciun proiect găsit.' : 'Se încarcă proiectele…'
          }
          value={projectId}
          options={availableProjectOptions ?? []}
          disabled={isExporting}
          onChange={setProjectId}
        />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Previzualizare
          </h3>
          {periodReady && !previewLoading && !previewError && previewTotal > 0 && (
            <p className="text-xs text-text-secondary tabular-nums">
              {previewTotal} pontaje
              {!previewTruncated && <> · {formatExportHours(previewTotalMinutes)} ore</>}
            </p>
          )}
        </div>

        {previewError && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-3 py-2">
            <p className="text-sm text-danger">{previewError}</p>
            <button
              type="button"
              onClick={() => void loadPreview(period, projectId)}
              className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              Reîncearcă
            </button>
          </div>
        )}

        <DataTable
          // -v2 since the "Nume" column was inserted: saved orders from the old
          // key would otherwise place it after "Lună" instead of before it.
          storageKey="timesheet-export-preview-v2"
          columns={previewColumns}
          data={previewRows}
          rowKey={(row) => row.id}
          loading={previewLoading}
          loadingRowCount={4}
          emptyMessage={previewEmptyMessage}
        />

        {previewTruncated && !previewLoading && (
          <p className="mt-2 text-xs text-text-muted">
            Afișate primele {previewRows.length} din {previewTotal} înregistrări. Exportul include
            toate pontajele{projectId ? ' proiectului' : ''} din perioadă.
          </p>
        )}
      </div>
    </SlideOverPanel>
  );
}
