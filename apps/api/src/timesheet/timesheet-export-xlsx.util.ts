import ExcelJS from 'exceljs';
import { formatTimesheetNotesCell } from '@fabxpert/shared/timesheetNotes';
import type { ResolvedSummaryPeriod } from './timesheet-summary-period.util';

/** Export row order: workDate asc, person last/first name, project name. */
export type TimesheetExportRow = {
  workDate: Date;
  durationMinutes: number;
  notes: string | null;
  project: {
    code: string;
    denumireLucrare: string | null;
    name: string;
    company: { name: string };
  };
  person: { firstName: string; lastName: string };
  activity: { name: string } | null;
  assemblies: { quantityDone: number; assembly: { name: string } }[];
};

const HEADERS = [
  'Cod Proiect',
  'Denumire Lucrare',
  'Client',
  'Nume',
  'Luna',
  'Data',
  'Nr. ORE LUCRATE',
  'Tip operație',
  'Lucrător',
  'Detalii',
  'Ansamble',
] as const;

/** 1-based sheet columns; the numeric formats and the total formula follow these. */
const HOURS_COLUMN = 7;
const MONTH_COLUMN = 5;
const DATE_COLUMN = 6;
const WORKER_COLUMN = 9;

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

/** The marks of one pontaj in one cell: "GBAL/25 x2, GBAL/26 x3". */
function formatAssembliesCell(
  assemblies: TimesheetExportRow['assemblies'],
): string {
  return assemblies.map((link) => `${link.assembly.name} x${link.quantityDone}`).join(', ');
}


export async function buildTimesheetExportXlsx(rows: TimesheetExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Pontaje');

  sheet.columns = [
    { header: HEADERS[0], key: 'projectCode', width: 20 },
    { header: HEADERS[1], key: 'denumireLucrare', width: 30 },
    { header: HEADERS[2], key: 'client', width: 24 },
    { header: HEADERS[3], key: 'projectName', width: 56 },
    { header: HEADERS[4], key: 'month', width: 8 },
    { header: HEADERS[5], key: 'date', width: 12 },
    { header: HEADERS[6], key: 'hours', width: 16 },
    { header: HEADERS[7], key: 'activity', width: 22 },
    { header: HEADERS[8], key: 'worker', width: 24 },
    { header: HEADERS[9], key: 'notes', width: 40 },
    { header: HEADERS[10], key: 'assemblies', width: 34 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };
  sheet.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }];

  for (const row of rows) {
    const workDate = calendarDateOnly(row.workDate);
    const dataRow = sheet.addRow({
      projectCode: row.project.code,
      denumireLucrare: row.project.denumireLucrare ?? '',
      client: row.project.company.name,
      projectName: row.project.name,
      month: workDate.getMonth() + 1,
      date: workDate,
      hours: row.durationMinutes / 60,
      activity: row.activity?.name ?? '',
      worker: `${row.person.lastName} ${row.person.firstName}`.trim().toUpperCase(),
      notes: formatTimesheetNotesCell(row.notes),
      assemblies: formatAssembliesCell(row.assemblies),
    });

    dataRow.getCell(MONTH_COLUMN).numFmt = '0';
    dataRow.getCell(DATE_COLUMN).numFmt = 'dd/MM/yyyy';
    dataRow.getCell(HOURS_COLUMN).numFmt = '0.0########';
  }

  if (rows.length > 0) {
    const lastDataRow = sheet.rowCount;
    const hoursLetter = sheet.getColumn(HOURS_COLUMN).letter;
    const totalRow = sheet.addRow({
      hours: { formula: `SUM(${hoursLetter}2:${hoursLetter}${lastDataRow})` },
      worker: 'TOTAL',
    });
    totalRow.font = { bold: true };
    totalRow.getCell(HOURS_COLUMN).numFmt = '0.0########';
    totalRow.getCell(WORKER_COLUMN).font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
