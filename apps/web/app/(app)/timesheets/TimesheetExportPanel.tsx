'use client';

import {
  exportTimesheetsXlsx,
  isPeriodQueryReady,
  listTimesheets,
  type Period,
  type TimesheetDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { PeriodFilter } from '@/components/PeriodFilter';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import {
  CLIENT_SEARCH_FETCH_SIZE,
  sortTimesheetsForExport,
} from './timesheetFilters';
import {
  formatExportHours,
  formatRomanianDate,
  personFullName,
  workDateMonthNumber,
} from './timesheetFormat';

interface TimesheetExportPanelProps {
  open: boolean;
  initialPeriod: Period;
  onClose: () => void;
}

const previewColumns: DataTableColumn<TimesheetDto>[] = [
  {
    key: 'project',
    header: 'Proiect',
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
    render: (row) => formatRomanianDate(row.workDate),
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
    render: (row) => personFullName(row).toUpperCase(),
  },
];

export function TimesheetExportPanel({
  open,
  initialPeriod,
  onClose,
}: TimesheetExportPanelProps) {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [isExporting, setIsExporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<TimesheetDto[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPeriod(initialPeriod);
    }
  }, [open, initialPeriod]);

  const loadPreview = useCallback(async (activePeriod: Period) => {
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
        pageSize: CLIENT_SEARCH_FETCH_SIZE,
        period: activePeriod,
      });

      setPreviewRows(sortTimesheetsForExport(response.data));
      setPreviewTotal(response.meta.total);
    } catch (caught) {
      setPreviewRows([]);
      setPreviewTotal(0);
      setPreviewError(apiErrorToastMessage(caught));
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadPreview(period);
  }, [open, period, loadPreview]);

  async function handleDownload() {
    if (!isPeriodQueryReady(period) || isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      const { blob, filename } = await exportTimesheetsXlsx({ period });
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
  const previewTotalMinutes = previewRows.reduce(
    (sum, row) => sum + row.durationMinutes,
    0,
  );
  const previewEmptyMessage = periodReady
    ? 'Nu există pontaje în perioada selectată.'
    : 'Selectează o perioadă completă pentru previzualizare.';

  return (
    <SlideOverPanel
      open={open}
      title="Export Excel"
      onClose={onClose}
      disableClose={isExporting}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canDownload}
            onClick={() => void handleDownload()}
            className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
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
        Alege perioada pentru export. Previzualizarea reflectă datele incluse în fișierul Excel.
      </p>
      <PeriodFilter value={period} onChange={setPeriod} />

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Previzualizare
          </h3>
          {periodReady && !previewLoading && !previewError && previewTotal > 0 && (
            <p className="text-xs text-text-secondary tabular-nums">
              {previewTotal} pontaje
              {!previewTruncated && (
                <> · {formatExportHours(previewTotalMinutes)} ore</>
              )}
            </p>
          )}
        </div>

        {previewError && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-3 py-2">
            <p className="text-sm text-danger">{previewError}</p>
            <button
              type="button"
              onClick={() => void loadPreview(period)}
              className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              Reîncearcă
            </button>
          </div>
        )}

        <DataTable
          columns={previewColumns}
          data={previewRows}
          rowKey={(row) => row.id}
          loading={previewLoading}
          loadingRowCount={4}
          emptyMessage={previewEmptyMessage}
        />

        {previewTruncated && !previewLoading && (
          <p className="mt-2 text-xs text-text-muted">
            Afișate primele {previewRows.length} din {previewTotal} înregistrări. Exportul
            include toate pontajele din perioadă.
          </p>
        )}
      </div>
    </SlideOverPanel>
  );
}
