'use client';

import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';

const DEMO_PAGE_SIZE = 5;

// --- Mock: Projects ---

type ProjectStatus =
  | 'ciorna'
  | 'in-ofertare'
  | 'castigat'
  | 'in-proiectare'
  | 'in-productie'
  | 'livrat';

interface MockProject {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  statusLabel: string;
  dueDate: string;
}

const STATUS_ACCENT: Record<ProjectStatus, string> = {
  ciorna: 'var(--status-ciorna-bg)',
  'in-ofertare': 'var(--status-in-ofertare-bg)',
  castigat: 'var(--status-castigat-bg)',
  'in-proiectare': 'var(--status-in-proiectare-bg)',
  'in-productie': 'var(--status-in-productie-bg)',
  livrat: 'var(--status-livrat-bg)',
};

const STATUS_BADGE: Record<ProjectStatus, string> = {
  ciorna: 'bg-status-ciorna-bg text-status-ciorna-text',
  'in-ofertare': 'bg-status-in-ofertare-bg text-status-in-ofertare-text',
  castigat: 'bg-status-castigat-bg text-status-castigat-text',
  'in-proiectare': 'bg-status-in-proiectare-bg text-status-in-proiectare-text',
  'in-productie': 'bg-status-in-productie-bg text-status-in-productie-text',
  livrat: 'bg-status-livrat-bg text-status-livrat-text',
};

const MOCK_PROJECTS: MockProject[] = [
  { id: '1', code: 'PRJ-2024-001', name: 'Hala industrială Nord', status: 'in-productie', statusLabel: 'În producție', dueDate: '2026-08-15' },
  { id: '2', code: 'PRJ-2024-002', name: 'Pod rutier DN7', status: 'in-proiectare', statusLabel: 'În proiectare', dueDate: '2026-09-01' },
  { id: '3', code: 'PRJ-2024-003', name: 'Structură depozit', status: 'castigat', statusLabel: 'Câștigat', dueDate: '2026-07-20' },
  { id: '4', code: 'PRJ-2024-004', name: 'Consolă mezanin', status: 'in-ofertare', statusLabel: 'În ofertare', dueDate: '2026-07-30' },
  { id: '5', code: 'PRJ-2023-018', name: 'Platformă offshore', status: 'livrat', statusLabel: 'Livrat', dueDate: '2026-06-10' },
  { id: '6', code: 'PRJ-2024-005', name: 'Schelă metalică', status: 'ciorna', statusLabel: 'Ciornă', dueDate: '2026-10-01' },
  { id: '7', code: 'PRJ-2024-006', name: 'Gard perimetral', status: 'in-productie', statusLabel: 'În producție', dueDate: '2026-08-22' },
  { id: '8', code: 'PRJ-2024-007', name: 'Rampe încărcare', status: 'castigat', statusLabel: 'Câștigat', dueDate: '2026-07-25' },
  { id: '9', code: 'PRJ-2024-008', name: 'Structură antrepozit', status: 'in-proiectare', statusLabel: 'În proiectare', dueDate: '2026-09-15' },
  { id: '10', code: 'PRJ-2024-009', name: 'Pasarelă pietonală', status: 'in-ofertare', statusLabel: 'În ofertare', dueDate: '2026-08-05' },
  { id: '11', code: 'PRJ-2024-010', name: 'Consolă macara', status: 'ciorna', statusLabel: 'Ciornă', dueDate: '2026-11-01' },
  { id: '12', code: 'PRJ-2023-022', name: 'Siloz cereale', status: 'livrat', statusLabel: 'Livrat', dueDate: '2026-05-20' },
];

const projectColumns: DataTableColumn<MockProject>[] = [
  {
    key: 'code',
    header: 'Cod',
    className: 'font-mono text-xs text-text-secondary',
    width: '120px',
  },
  { key: 'name', header: 'Denumire' },
  {
    key: 'status',
    header: 'Status',
    width: '140px',
    render: (row) => (
      <span
        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status]}`}
      >
        {row.statusLabel}
      </span>
    ),
  },
  {
    key: 'dueDate',
    header: 'Termen',
    width: '110px',
    className: 'text-text-secondary',
  },
];

// --- Mock: Companies ---

interface MockCompany {
  id: string;
  name: string;
  taxCode: string;
  phone: string;
  legalRepresentative: string;
}

const MOCK_COMPANIES: MockCompany[] = [
  { id: '1', name: 'Construct Steel SRL', taxCode: 'RO12345678', phone: '+40 721 000 001', legalRepresentative: 'Ion Popescu' },
  { id: '2', name: 'Metal Proiect SA', taxCode: 'RO87654321', phone: '+40 722 000 002', legalRepresentative: 'Maria Ionescu' },
  { id: '3', name: 'Fabricații Industriale', taxCode: 'RO11223344', phone: '+40 723 000 003', legalRepresentative: 'Andrei Vasilescu' },
  { id: '4', name: 'Oțelul Verde SRL', taxCode: 'RO44332211', phone: '+40 724 000 004', legalRepresentative: 'Elena Dumitrescu' },
  { id: '5', name: 'Structuri Metalice Pro', taxCode: 'RO55667788', phone: '+40 725 000 005', legalRepresentative: 'Mihai Georgescu' },
  { id: '6', name: 'Infrastructură Nord', taxCode: 'RO99887766', phone: '+40 726 000 006', legalRepresentative: 'Ana Marinescu' },
  { id: '7', name: 'Consolă Expert', taxCode: 'RO66778899', phone: '+40 727 000 007', legalRepresentative: 'Vlad Stan' },
];

const companyColumns: DataTableColumn<MockCompany>[] = [
  { key: 'name', header: 'Denumire' },
  {
    key: 'taxCode',
    header: 'CUI',
    width: '120px',
    className: 'font-mono text-xs text-text-secondary',
  },
  { key: 'phone', header: 'Telefon', width: '150px', className: 'text-text-secondary' },
  { key: 'legalRepresentative', header: 'Reprezentant legal' },
];

function paginateSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export default function TableDemoPage() {
  const [projectPage, setProjectPage] = useState(1);
  const [companyPage, setCompanyPage] = useState(1);

  const projectRows = useMemo(
    () => paginateSlice(MOCK_PROJECTS, projectPage, DEMO_PAGE_SIZE),
    [projectPage],
  );

  const companyRows = useMemo(
    () => paginateSlice(MOCK_COMPANIES, companyPage, DEMO_PAGE_SIZE),
    [companyPage],
  );

  return (
    <div className="flex flex-col gap-12">
      <div>
        <h1 className="text-[22px] font-medium text-text-primary">DataTable demo</h1>
        <p className="mt-1 text-sm text-text-muted">
          Pagină temporară — ștergeți când modulele CRUD reale sunt gata.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-text-secondary">
          Proiecte (cu accent bar)
        </h2>
        <DataTable
          columns={projectColumns}
          data={projectRows}
          rowKey={(row) => row.id}
          rowAccentColor={(row) => STATUS_ACCENT[row.status]}
        />
        <Pagination
          page={projectPage}
          pageSize={DEMO_PAGE_SIZE}
          total={MOCK_PROJECTS.length}
          onPageChange={setProjectPage}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-text-secondary">
          Companii (fără accent bar)
        </h2>
        <DataTable
          columns={companyColumns}
          data={companyRows}
          rowKey={(row) => row.id}
        />
        <Pagination
          page={companyPage}
          pageSize={DEMO_PAGE_SIZE}
          total={MOCK_COMPANIES.length}
          onPageChange={setCompanyPage}
        />
      </section>
    </div>
  );
}
