import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PizZip from 'pizzip';

export type LeaveRequestExportData = {
  personName: string;
  jobTitle: string;
  requestDate: string;
  dayCount: string;
  leaveYear: string;
  startDate: string;
  endDate: string;
  administratorName: string;
  adminSignatureLine: string;
  employeeSignatureLine: string;
  balanceBefore: string;
  balanceAfter: string;
};

const DEFAULT_ADMINISTRATOR_NAME = 'Onaca Ionuț-Cristian';
const SIGNATURE_LINE = '_______________';

function resolveTemplatePath(): string {
  return join(__dirname, '..', 'assets', 'templates', 'leave-request-odihna.docx');
}

function loadTemplate(): Buffer {
  return readFileSync(resolveTemplatePath());
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatLeaveExportDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export function resolveLeaveExportAdministratorName(): string {
  return process.env.LEAVE_EXPORT_ADMINISTRATOR_NAME?.trim() || DEFAULT_ADMINISTRATOR_NAME;
}

export function buildLeaveRequestExportFilename(
  lastName: string,
  firstName: string,
  startDate: string,
): string {
  const slug = `${lastName}_${firstName}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return `Cerere_CO_${slug || 'angajat'}_${startDate}.docx`;
}

export function buildLeaveRequestExportDocx(data: LeaveRequestExportData): Buffer {
  const zip = new PizZip(loadTemplate());
  const documentFile = zip.file('word/document.xml');

  if (!documentFile) {
    throw new Error('Leave request template is missing word/document.xml');
  }

  let documentXml = documentFile.asText();

  for (const [key, value] of Object.entries(data)) {
    documentXml = documentXml.replaceAll(`{{${key}}}`, escapeXml(value));
  }

  zip.file('word/document.xml', documentXml);

  return zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
}

export function buildLeaveRequestExportData(options: {
  person: { firstName: string; lastName: string; employeeRole?: { name: string } | null };
  startDate: string;
  endDate: string;
  dayCount: number;
  createdAt: string;
  annualLeaveDays: number;
  usedDays: number;
}): LeaveRequestExportData {
  const usedWithoutThis = options.usedDays - options.dayCount;
  const balanceBefore = options.annualLeaveDays - usedWithoutThis;
  const balanceAfter = balanceBefore - options.dayCount;

  return {
    personName: `${options.person.lastName} ${options.person.firstName}`.trim(),
    jobTitle: options.person.employeeRole?.name?.trim() || '—',
    requestDate: formatLeaveExportDate(options.createdAt.slice(0, 10)),
    dayCount: String(options.dayCount),
    leaveYear: options.startDate.slice(0, 4),
    startDate: formatLeaveExportDate(options.startDate),
    endDate: formatLeaveExportDate(options.endDate),
    administratorName: resolveLeaveExportAdministratorName(),
    adminSignatureLine: SIGNATURE_LINE,
    employeeSignatureLine: SIGNATURE_LINE,
    balanceBefore: String(balanceBefore),
    balanceAfter: String(balanceAfter),
  };
}
