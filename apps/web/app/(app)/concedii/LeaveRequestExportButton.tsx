'use client';

import { exportLeaveRequestDocx, type LeaveRequestDto } from '@fabxpert/shared';
import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { downloadBlobFile } from '@/utils/downloadBlobFile';

export function canExportLeaveRequestDocx(request: LeaveRequestDto): boolean {
  return request.status === 'APROBAT' && request.type === 'ODIHNA';
}

export function useLeaveRequestDocxExport() {
  const { showToast } = useToast();
  const [exportingId, setExportingId] = useState<string | null>(null);

  async function exportDocx(request: LeaveRequestDto) {
    if (!canExportLeaveRequestDocx(request) || exportingId) {
      return;
    }

    setExportingId(request.id);

    try {
      const { blob, filename } = await exportLeaveRequestDocx(request.id);
      downloadBlobFile(blob, filename ?? 'Cerere_CO.docx');
      showToast('Document generat', 'success');
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setExportingId(null);
    }
  }

  return { exportingId, exportDocx };
}

export function LeaveRequestExportButton({
  request,
  className,
  label = 'Export',
}: {
  request: LeaveRequestDto;
  className?: string;
  label?: string;
}) {
  const { exportingId, exportDocx } = useLeaveRequestDocxExport();
  const isExporting = exportingId === request.id;

  if (!canExportLeaveRequestDocx(request)) {
    return null;
  }

  return (
    <button
      type="button"
      disabled={isExporting}
      aria-label="Exportă cererea de concediu"
      title="Exportă cererea de concediu"
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        void exportDocx(request);
      }}
    >
      {isExporting ? (
        <span className="text-xs">…</span>
      ) : (
        <>
          <i className="ti ti-file-download text-base" aria-hidden="true" />
          {label ? <span className="sr-only">{label}</span> : null}
        </>
      )}
    </button>
  );
}
