import ExcelJS from 'exceljs';
import type { ResolvedSummaryPeriod } from './timesheet-summary-period.util';

/** Export row order: workDate asc, person last/first name, project name. */
export type TimesheetExportRow = {
  workDate: Date;
  durationMinutes: number;
  project: { name: string };
  person: { firstName: string; lastName: string };
  activity: { name: string } | null;
};

const HEADERS = [
  'PROIECT EVALUAT',
  'Luna',
  'Data',
  'Nr. ORE LUCRATE',
  'Tip operație',
  'Lucrător',
] as const;

function formatFilenameDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function buildTimesheetExportFilename(resolved: ResolvedSummaryPeriod): string {
  if (resolved.from && resolved.to) {
    const toInclusive = new Date(resolved.to);
    toInclusive.setDate(toInclusive.getDate() - 1);
    return `pontaje_${formatFilenameDate(resolved.from)}_${formatFilenameDate(toInclusive)}.xlsx`;
  }

  return 'pontaje_all.xlsx';
}

function calendarDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export async function buildTimesheetExportXlsx(rows: TimesheetExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Pontaje');

  sheet.columns = [
    { header: HEADERS[0], key: 'project', width: 28 },
    { header: HEADERS[1], key: 'month', width: 8 },
    { header: HEADERS[2], key: 'date', width: 12 },
    { header: HEADERS[3], key: 'hours', width: 16 },
    { header: HEADERS[4], key: 'activity', width: 22 },
    { header: HEADERS[5], key: 'worker', width: 24 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }];

  for (const row of rows) {
    const workDate = calendarDateOnly(row.workDate);
    const dataRow = sheet.addRow({
      project: row.project.name,
      month: workDate.getMonth() + 1,
      date: workDate,
      hours: row.durationMinutes / 60,
      activity: row.activity?.name ?? '',
      worker: `${row.person.firstName} ${row.person.lastName}`.trim().toUpperCase(),
    });

    dataRow.getCell(2).numFmt = '0';
    dataRow.getCell(3).numFmt = 'dd/MM/yyyy';
    dataRow.getCell(4).numFmt = '0.0########';
  }

  if (rows.length > 0) {
    const lastDataRow = sheet.rowCount;
    const totalRow = sheet.addRow({
      project: '',
      month: '',
      date: '',
      hours: { formula: `SUM(D2:D${lastDataRow})` },
      activity: '',
      worker: 'TOTAL',
    });
    totalRow.font = { bold: true };
    totalRow.getCell(4).numFmt = '0.0########';
    totalRow.getCell(6).font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
