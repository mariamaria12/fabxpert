/** Shared password for all E2E test users. */
export const E2E_PASSWORD = 'TestPassword123!';

/** Stable UUIDs — never change so tests can reference them directly. */
export const FIXTURES = {
  employeeRole: {
    id: 'e2e00001-0000-0000-0000-000000000010',
    name: 'E2E Welder',
  },
  employeeRole2: {
    id: 'e2e00001-0000-0000-0000-000000000014',
    name: 'E2E Operator',
  },
  activities: {
    active: {
      id: 'e2e00001-0000-0000-0000-000000000011',
      name: 'E2E Active Activity',
    },
    inactive: {
      id: 'e2e00001-0000-0000-0000-000000000012',
      name: 'E2E Inactive Activity',
    },
    second: {
      id: 'e2e00001-0000-0000-0000-000000000013',
      name: 'E2E Second Activity',
    },
  },
  companies: {
    c1: {
      id: 'e2e00001-0000-0000-0000-000000000020',
      name: 'E2E Company One',
    },
    c2: {
      id: 'e2e00001-0000-0000-0000-000000000021',
      name: 'E2E Company Two',
    },
  },
  projects: {
    ready: {
      id: 'e2e00001-0000-0000-0000-000000000030',
      code: 'E2E-READY',
    },
    notReady: {
      id: 'e2e00001-0000-0000-0000-000000000031',
      code: 'E2E-NOTREADY',
    },
    deleted: {
      id: 'e2e00001-0000-0000-0000-000000000032',
      code: 'E2E-DELETED',
    },
    roleRestricted: {
      id: 'e2e00001-0000-0000-0000-000000000033',
      code: 'E2E-ROLEREADY',
    },
  },
  persons: {
    admin: { id: 'e2e00001-0000-0000-0000-000000000001' },
    employee1: { id: 'e2e00001-0000-0000-0000-000000000002' },
    employee2: { id: 'e2e00001-0000-0000-0000-000000000003' },
    inactive: { id: 'e2e00001-0000-0000-0000-000000000004' },
    unassigned: { id: 'e2e00001-0000-0000-0000-000000000005' },
  },
  users: {
    admin: {
      id: 'e2e00001-0000-0000-0000-000000000101',
      email: 'admin@e2e.test',
    },
    employee1: {
      id: 'e2e00001-0000-0000-0000-000000000102',
      email: 'employee1@e2e.test',
    },
    employee2: {
      id: 'e2e00001-0000-0000-0000-000000000103',
      email: 'employee2@e2e.test',
    },
    inactive: {
      id: 'e2e00001-0000-0000-0000-000000000104',
      email: 'inactive@e2e.test',
    },
  },
} as const;

/** Non-existent but well-formed UUID for negative tests. */
export const NON_EXISTENT_UUID = 'e2e00001-0000-0000-0000-000000000999';
