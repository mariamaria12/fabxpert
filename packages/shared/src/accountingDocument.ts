import type { LeaveType } from './dto/leave.dto';

/**
 * The day codes of the pontaj sent to accounting, in legend order. The app
 * writes X and the three leave codes it knows about; the rest are there for
 * accounting to fill in by hand and for the sheet's formulas to count.
 */
export const ACCOUNTING_DAY_CODES: readonly { code: string; label: string }[] = [
  { code: 'X', label: 'Prezent' },
  { code: 'CO', label: 'Concediu de odihnă' },
  { code: 'INV', label: 'Învoire' },
  { code: 'CFP', label: 'Concediu fără plată' },
  { code: 'CM', label: 'Concediu medical' },
  { code: 'CP', label: 'Concediu paternal' },
  { code: 'AN', label: 'Absență nemotivată' },
  { code: 'DS', label: 'Donare de sânge' },
  { code: 'CS', label: 'Contract suspendat' },
  { code: '*', label: 'Prezent CIM 2 ore' },
  { code: 'WTF', label: 'Clarificare' },
];

export const PRESENT_DAY_CODE = 'X';

/**
 * What an approved leave day reads as on the pontaj. RECUPERARE is time off
 * already earned, so it is paid as a worked day and marked present; a blood
 * donation day is paid but not worked, so it counts with the leave.
 */
export function leaveTypeDayCode(type: LeaveType): string {
  switch (type) {
    case 'ODIHNA':
      return 'CO';
    case 'MEDICAL':
      return 'CM';
    case 'NEPLATIT':
      return 'CFP';
    case 'RECUPERARE':
      return PRESENT_DAY_CODE;
    case 'BLOOD_DONATION':
      return 'DS';
  }
}

/**
 * The lines that reach the document accounting receives. External
 * collaborators stay on the pontaj so their days are tracked, but they are
 * not on the payroll, so the document leaves them out.
 */
export function accountingDocumentLines<T extends { isExternal: boolean }>(lines: T[]): T[] {
  return lines.filter((line) => !line.isExternal);
}
