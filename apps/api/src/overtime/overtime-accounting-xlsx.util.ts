import ExcelJS from 'exceljs';
import { ACCOUNTING_DAY_CODES, accountingDocumentLines } from '@fabxpert/shared/accountingDocument';
import type { AccountingTimesheetResponse } from '@fabxpert/shared/dto/overtime.dto';

/**
 * The pontaj document accounting receives, in the layout of their own
 * workbook: one sheet per month, a 31-day grid of codes per person, the
 * COUNTIF counters, then the pay columns they fill in by hand, and the legend.
 * The rates in the formulas (400 lei per Saturday, 30 per meal ticket, 9 hours
 * a day) are theirs — kept verbatim so the sheet computes like the ones before it.
 * Only the payroll is on it: external collaborators stay off the document.
 */

const MONTH_NAMES = [
  'IANUARIE',
  'FEBRUARIE',
  'MARTIE',
  'APRILIE',
  'MAI',
  'IUNIE',
  'IULIE',
  'AUGUST',
  'SEPTEMBRIE',
  'OCTOMBRIE',
  'NOIEMBRIE',
  'DECEMBRIE',
];
const MONTH_SHORT = [
  'Ian',
  'Feb',
  'Mar',
  'Apr',
  'Mai',
  'Iun',
  'Iul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const WEEKDAY_NAMES = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];

/** The grid is always 31 columns wide; a shorter month runs into the next one, header only. */
const DAY_COLUMNS = 31;
const FIRST_DAY_COLUMN = 3; // C
const LAST_DAY_COLUMN = FIRST_DAY_COLUMN + DAY_COLUMNS - 1; // AG
const FIRST_PERSON_ROW = 4;

/** Empty in their sheet, between the pay columns and the grand total. */
const UNUSED_COLUMN = 51; // AY

// The EDENRED cross-check block, written beside the legend as in their sheet.
const CHECK_TITLE_COLUMN = 8; // H
const CHECK_LABEL_COLUMN = 9; // I
const CHECK_VALUE_COLUMN = 10; // J
const CHECK_MATCH_COLUMN = 11; // K

const SUMMARY_HEADERS: { header: string; width: number }[] = [
  { header: 'Zile lucrate / EDENRED', width: 10.3 },
  { header: 'Zile CO / CM / CP', width: 7.1 },
  { header: 'Absent nemotiv', width: 6.4 },
  { header: 'CFP / CS', width: 5.9 },
  { header: 'Zile lucrătoare', width: 7.7 },
  { header: 'NET CARD', width: 7.7 },
  { header: 'Sâmbete lucrate/ Sărbători legale', width: 11.7 },
  { header: 'Ore extra', width: 7.4 },
  { header: 'Tarif ore extra 150%', width: 7.7 },
  { header: 'NET', width: 7.6 },
  { header: 'Total de plată', width: 9.1 },
  { header: 'Avansuri / Retineri', width: 9.1 },
  { header: 'Stat de plată', width: 9.1 },
  { header: 'Carduri edenred', width: 9.1 },
  { header: 'Extra', width: 12 },
  { header: 'Ore dashboard', width: 8.1 },
  { header: 'Tichete masă DB', width: 8.1 },
];

// 1-based columns of the summary block, in header order.
const COL = {
  worked: 34, // AH
  leave: 35, // AI
  absent: 36, // AJ
  unpaid: 37, // AK
  workingDays: 38, // AL
  netCard: 39, // AM
  saturdays: 40, // AN
  extraHours: 41, // AO
  extraRate: 42, // AP
  net: 43, // AQ
  totalPay: 44, // AR
  advances: 45, // AS
  payroll: 46, // AT
  edenred: 47, // AU
  extra: 48, // AV
  dashboardHours: 49, // AW
  mealTickets: 50, // AX
  grandTotal: 52, // AZ — untitled in the template, kept for its total
} as const;

const FONT_NAME = 'Arial Narrow';

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

const HEADER_FILL = solidFill('FF434343');
const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: FONT_NAME,
  size: 10,
  color: { argb: 'FFFFFF00' },
};
const SUMMARY_FILL = solidFill('FFEFEFEF');

/** Saturdays and Sundays are tinted apart in their sheet. */
const SATURDAY_FILL = solidFill('FFDEEBF7');
const SUNDAY_FILL = solidFill('FFFBE5D6');
const TOTAL_FILL = solidFill('FF000000');
const LEGEND_TITLE_FILL = solidFill('FF7CEB99');
/**
 * Their legend paints every code its own colour, and leaves X and * plain.
 * The label keeps the code's colour unless it has one of its own.
 */
const LEGEND_COLORS: Record<string, { code: string; label?: string }> = {
  CO: { code: 'FFB6D7A8' },
  INV: { code: 'FFFFC000' },
  CFP: { code: 'FFA4C2F4' },
  CM: { code: 'FFFFFF00' },
  CP: { code: 'FF76E3FF' },
  AN: { code: 'FFFF7474' },
  DS: { code: 'FFFFF2CC' },
  CS: { code: 'FFF6C3FF' },
  WTF: { code: 'FF000000', label: 'FFA5A5A5' },
};

/** The three bands of the EDENRED cross-check, top to bottom. */
const CHECK_TITLE_FILL = solidFill('FFFF7474');
const CHECK_VALUE_FILL = solidFill('FF7CEB99');
const CHECK_TICKET_FILL = solidFill('FFA3DBFF');
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};
const CENTER: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
const COUNT_FORMAT = '_-* #,##0_-;-* #,##0_-;_-* "-"??_-;_-@_-';

function parseMonth(month: string): { year: number; monthIndex: number } {
  const [year, monthNumber] = month.split('-').map(Number);
  return { year, monthIndex: monthNumber - 1 };
}

function columnLetter(column: number): string {
  let letters = '';
  let rest = column;
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    rest = Math.floor((rest - 1) / 26);
  }
  return letters;
}

function countIf(range: string, ...codes: string[]): string {
  return codes.map((code) => `COUNTIF(${range},"${code}")`).join('+');
}

export function buildAccountingTimesheetFilename(month: string): string {
  const { year, monthIndex } = parseMonth(month);
  return `Pontaj_${MONTH_SHORT[monthIndex]}_${year}.xlsx`;
}

/**
 * The two cross-checks the accountant keeps under the table: hours and meal
 * tickets split between production and office, and the EDENRED sum next to
 * what the totals row says. Which people count as office is their call, so
 * PRODUCTIV is left to be filled in and TESA follows from it.
 */
function writeCrossChecks(
  sheet: ExcelJS.Worksheet,
  rows: { totalRow: number; legendRow: number; lastPersonRow: number },
): void {
  const { totalRow, legendRow, lastPersonRow } = rows;
  const productivRow = totalRow + 1;
  const tesaRow = productivRow + 1;
  const splitColumns = [COL.dashboardHours, COL.mealTickets];

  const cell = (row: number, column: number) => {
    const target = sheet.getCell(row, column);
    target.font = { name: FONT_NAME, size: 10 };
    target.alignment = CENTER;
    target.border = THIN;
    return target;
  };

  cell(productivRow, COL.extra).value = 'PRODUCTIV';
  cell(tesaRow, COL.extra).value = 'TESA';
  for (const column of splitColumns) {
    const letter = columnLetter(column);
    cell(productivRow, column).numFmt = COUNT_FORMAT;
    const tesa = cell(tesaRow, column);
    tesa.value = { formula: `${letter}${totalRow}-${letter}${productivRow}` };
    tesa.numFmt = COUNT_FORMAT;
  }

  const valueRow = legendRow + 1;
  const ticketRow = legendRow + 2;
  const valueCell = columnLetter(CHECK_VALUE_COLUMN);

  const band = (row: number, fill: ExcelJS.Fill) => {
    for (let column = CHECK_TITLE_COLUMN; column <= CHECK_VALUE_COLUMN; column += 1) {
      cell(row, column).fill = fill;
    }
  };

  band(legendRow, CHECK_TITLE_FILL);
  const title = cell(legendRow, CHECK_TITLE_COLUMN);
  title.value = 'EDENRED';
  title.font = { name: FONT_NAME, size: 10, bold: true };
  title.alignment = { horizontal: 'left', vertical: 'middle' };

  for (const [row, label, formula, fill] of [
    [valueRow, 'VALOARE', `${valueCell}${ticketRow}*30`, CHECK_VALUE_FILL],
    [
      ticketRow,
      'TICHETE',
      `SUM(${columnLetter(COL.worked)}${FIRST_PERSON_ROW}:${columnLetter(COL.worked)}${lastPersonRow})`,
      CHECK_TICKET_FILL,
    ],
  ] as const) {
    band(row, fill);

    const labelCell = cell(row, CHECK_LABEL_COLUMN);
    labelCell.value = label;
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const amount = cell(row, CHECK_VALUE_COLUMN);
    amount.value = { formula };
    amount.numFmt = '#,##0';

    // Reads TRUE when the block agrees with the totals row.
    const match = sheet.getCell(row, CHECK_MATCH_COLUMN);
    match.value = {
      formula: `${valueCell}${row}=${columnLetter(row === valueRow ? COL.edenred : COL.worked)}${totalRow}`,
    };
    match.font = { name: FONT_NAME, size: 10 };
    match.alignment = CENTER;
  }
}

export async function buildAccountingTimesheetXlsx(
  report: AccountingTimesheetResponse,
): Promise<Buffer> {
  const { year, monthIndex } = parseMonth(report.month);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const lines = accountingDocumentLines(report.lines);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${MONTH_SHORT[monthIndex]} ${year}`);

  sheet.getColumn(1).width = 5.9;
  sheet.getColumn(2).width = 14.3;
  for (let column = FIRST_DAY_COLUMN; column <= LAST_DAY_COLUMN; column += 1) {
    sheet.getColumn(column).width = column === FIRST_DAY_COLUMN ? 7 : 6.3;
  }
  SUMMARY_HEADERS.forEach((item, index) => {
    sheet.getColumn(COL.worked + index).width = item.width;
  });

  // --- header rows 1–2 ---
  const dayColumnsMeta: { column: number; weekday: number; inMonth: boolean }[] = [];
  for (let offset = 0; offset < DAY_COLUMNS; offset += 1) {
    const column = FIRST_DAY_COLUMN + offset;
    const date = new Date(year, monthIndex, offset + 1);
    const inMonth = offset < daysInMonth;
    dayColumnsMeta.push({ column, weekday: date.getDay(), inMonth });

    const nameCell = sheet.getCell(1, column);
    nameCell.value = WEEKDAY_NAMES[date.getDay()];
    const dateCell = sheet.getCell(2, column);
    // ExcelJS serialises dates in UTC; a local midnight would land on the day before.
    dateCell.value = new Date(Date.UTC(year, monthIndex, offset + 1));
    dateCell.numFmt = 'd-mmm';
    for (const cell of [nameCell, dateCell]) {
      cell.font = HEADER_FONT;
      cell.fill = HEADER_FILL;
      cell.alignment = CENTER;
      cell.border = THIN;
    }
  }

  sheet.mergeCells(1, 1, 2, 1);
  sheet.mergeCells(1, 2, 2, 2);
  const indexHeader = sheet.getCell(1, 1);
  indexHeader.value = 'Nr.crt.';
  const titleHeader = sheet.getCell(1, 2);
  titleHeader.value = `Pontaj luna \n${MONTH_NAMES[monthIndex]}\n ${year}`;
  for (const cell of [indexHeader, titleHeader]) {
    cell.font = {
      ...HEADER_FONT,
      bold: cell === titleHeader,
      size: cell === titleHeader ? 12 : 10,
    };
    cell.fill = HEADER_FILL;
    cell.alignment = { ...CENTER, wrapText: true };
    cell.border = THIN;
  }

  SUMMARY_HEADERS.forEach((item, index) => {
    const column = COL.worked + index;
    const stands = column === COL.worked || column === COL.netCard;
    sheet.mergeCells(1, column, 2, column);
    const cell = sheet.getCell(1, column);
    cell.value = item.header;
    cell.font = { name: FONT_NAME, size: stands ? 12 : 10, bold: stands };
    // The grey band stops at NET; the columns they fill in stay white.
    if (column <= COL.net) {
      cell.fill = SUMMARY_FILL;
    }
    cell.alignment = { ...CENTER, wrapText: true };
    cell.border = THIN;
  });
  sheet.getRow(1).height = 31.15;
  sheet.getRow(2).height = 31.15;

  // --- row 3: the month's norm ---
  const normLabel = sheet.getCell(3, 2);
  normLabel.value = 'Zile lucrătoare';
  const normValue = sheet.getCell(3, FIRST_DAY_COLUMN);
  normValue.value = report.workingDays;
  for (const cell of [normLabel, normValue]) {
    cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FFFF0000' } };
    cell.alignment = CENTER;
  }
  normValue.border = THIN;
  sheet.getRow(3).height = 22.5;

  // --- one row per person ---
  const lastPersonRow = FIRST_PERSON_ROW + lines.length - 1;
  const dayRange = (row: number) =>
    `${columnLetter(FIRST_DAY_COLUMN)}${row}:${columnLetter(LAST_DAY_COLUMN)}${row}`;

  lines.forEach((line, index) => {
    const row = FIRST_PERSON_ROW + index;
    const sheetRow = sheet.getRow(row);
    sheetRow.height = 24.6;

    const indexCell = sheet.getCell(row, 1);
    indexCell.value = index === 0 ? 1 : { formula: `1+A${row - 1}`, result: index + 1 };
    indexCell.font = { name: FONT_NAME, size: 10 };
    indexCell.alignment = CENTER;
    indexCell.border = THIN;

    const nameCell = sheet.getCell(row, 2);
    nameCell.value = `${line.person.lastName} ${line.person.firstName}`;
    nameCell.font = { name: FONT_NAME, size: 10, bold: true };
    nameCell.alignment = CENTER;
    nameCell.border = THIN;

    dayColumnsMeta.forEach((meta, offset) => {
      const cell = sheet.getCell(row, meta.column);
      const code = meta.inMonth ? (line.dayCodes[offset] ?? '') : '';
      cell.value = code === '' ? null : code;
      cell.font = { name: FONT_NAME, size: 10, bold: true };
      cell.alignment = CENTER;
      cell.border = THIN;
      if (meta.inMonth && meta.weekday === 6) {
        cell.fill = SATURDAY_FILL;
      } else if (meta.inMonth && meta.weekday === 0) {
        cell.fill = SUNDAY_FILL;
      }
    });

    const range = dayRange(row);
    const formulas: Record<number, string> = {
      [COL.worked]: countIf(range, 'x', 'INV'),
      [COL.leave]: countIf(range, 'CO', 'CM', 'CP', 'DS'),
      [COL.absent]: countIf(range, 'AN'),
      [COL.unpaid]: countIf(range, 'CFP', 'CS'),
      [COL.workingDays]: `SUM(${columnLetter(COL.worked)}${row}:${columnLetter(COL.unpaid)}${row})`,
      [COL.totalPay]: `${columnLetter(COL.net)}${row}+${columnLetter(COL.extraHours)}${row}*${columnLetter(COL.extraRate)}${row}+${columnLetter(COL.saturdays)}${row}*400`,
      [COL.edenred]: `${columnLetter(COL.worked)}${row}*30`,
      [COL.dashboardHours]: `${columnLetter(COL.worked)}${row}*9`,
      [COL.mealTickets]: `30*${columnLetter(COL.worked)}${row}`,
      [COL.grandTotal]: `${columnLetter(COL.netCard)}${row}+${columnLetter(COL.totalPay)}${row}+${columnLetter(COL.edenred)}${row}+${columnLetter(COL.net)}${row}`,
    };

    // Their sheet counts the "da" written on the day; the app knows the number,
    // so it writes that and leaves the formula where it has nothing to add.
    if (line.saturdaysWorked === 0) {
      formulas[COL.saturdays] = countIf(range, 'da');
    }

    for (let column: number = COL.worked; column <= COL.grandTotal; column += 1) {
      if (column === UNUSED_COLUMN) {
        continue;
      }
      const cell = sheet.getCell(row, column);
      const formula = formulas[column];
      if (formula) {
        cell.value = { formula };
      } else if (column === COL.saturdays) {
        cell.value = line.saturdaysWorked;
      } else if (column === COL.extraHours) {
        cell.value = line.overtimeMinutes > 0 ? line.overtimeMinutes / 60 : null;
      }
      cell.font = { name: FONT_NAME, size: column === COL.worked ? 14 : 10, bold: true };
      cell.alignment = CENTER;
      if (column !== COL.grandTotal) {
        cell.border = THIN;
      }
      cell.numFmt =
        column === COL.worked ? '0' : column === COL.extraHours ? '0.0##' : COUNT_FORMAT;
    }
  });

  // --- totals row ---
  const totalRow = lastPersonRow + 1;
  sheet.getRow(totalRow).height = 27;
  const sumColumns: number[] = [
    COL.worked,
    COL.netCard,
    COL.extraHours,
    COL.net,
    COL.totalPay,
    COL.advances,
    COL.payroll,
    COL.edenred,
    COL.extra,
    COL.dashboardHours,
    COL.mealTickets,
    COL.grandTotal,
  ];
  if (lines.length > 0) {
    // Black from "Zile lucrate" through "Extra", as in their sheet — the cells
    // with nothing to total are painted too, so the band is unbroken.
    for (let column: number = COL.worked; column <= COL.mealTickets; column += 1) {
      const letter = columnLetter(column);
      const totalled = sumColumns.includes(column);
      const banded = column <= COL.extra;
      const cell = sheet.getCell(totalRow, column);
      if (totalled) {
        cell.value = { formula: `SUM(${letter}${FIRST_PERSON_ROW}:${letter}${lastPersonRow})` };
      }
      cell.font = {
        name: FONT_NAME,
        size: column === COL.worked ? 16 : column === COL.netCard ? 14 : banded ? 11 : 10,
        bold: banded && totalled,
        ...(banded ? { color: { argb: 'FFFFFFFF' } } : {}),
      };
      cell.alignment = CENTER;
      cell.border = THIN;
      cell.numFmt = column === COL.worked ? '0' : COUNT_FORMAT;
      if (banded) {
        cell.fill = TOTAL_FILL;
      }
    }

    const grandTotal = sheet.getCell(totalRow, COL.grandTotal);
    grandTotal.value = {
      formula: `SUM(${columnLetter(COL.grandTotal)}${FIRST_PERSON_ROW}:${columnLetter(COL.grandTotal)}${lastPersonRow})`,
    };
    grandTotal.font = { name: FONT_NAME, size: 10 };
    grandTotal.alignment = CENTER;
    grandTotal.numFmt = COUNT_FORMAT;
  }

  // --- legend ---
  const legendRow = totalRow + 2;
  const legendTitle = sheet.getCell(legendRow, 2);
  legendTitle.value = 'LEGENDA';
  legendTitle.font = { name: FONT_NAME, size: 10, bold: true };
  legendTitle.fill = LEGEND_TITLE_FILL;
  legendTitle.alignment = CENTER;
  legendTitle.border = THIN;

  ACCOUNTING_DAY_CODES.forEach((item, index) => {
    const row = legendRow + index;
    sheet.getRow(row).height = 15.75;
    const colors = LEGEND_COLORS[item.code];
    const codeCell = sheet.getCell(row, FIRST_DAY_COLUMN);
    codeCell.value = item.code;
    // WTF is the one they wrote to stand out: it asks for a clarification.
    codeCell.font =
      item.code === 'WTF'
        ? { name: FONT_NAME, size: 14, bold: true, color: { argb: 'FFFF0000' } }
        : { name: FONT_NAME, size: 10 };
    codeCell.alignment = CENTER;
    codeCell.border = THIN;
    if (colors) {
      codeCell.fill = solidFill(colors.code);
    }

    sheet.mergeCells(row, FIRST_DAY_COLUMN + 1, row, FIRST_DAY_COLUMN + 3);
    // Merged D:F, so this one style paints the whole band.
    const labelCell = sheet.getCell(row, FIRST_DAY_COLUMN + 1);
    labelCell.value = item.label;
    labelCell.font = { name: FONT_NAME, size: 10 };
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
    labelCell.border = THIN;
    if (colors) {
      labelCell.fill = solidFill(colors.label ?? colors.code);
    }
  });

  writeCrossChecks(sheet, { totalRow, legendRow, lastPersonRow });

  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
