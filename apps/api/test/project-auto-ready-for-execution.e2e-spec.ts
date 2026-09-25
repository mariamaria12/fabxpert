import { INestApplication } from '@nestjs/common';
import type { ProjectStatus } from '@fabxpert/shared/dto/project.dto';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

type ProjectState = {
  status: ProjectStatus;
  isPinned: boolean;
  readyForExecution: boolean;
};

describe('Project readyForExecution follows pinning and status (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let employeeCookie: string;
  let projectCount = 0;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;
    employeeCookie = (await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD))
      .cookieHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  /** A fresh project per test, created exactly in the state it names. */
  async function createProject(state: ProjectState): Promise<string> {
    projectCount += 1;
    const response = await request(app.getHttpServer())
      .post('/projects')
      .set(authHeader(adminCookie))
      .send({
        name: `E2E Auto Ready ${projectCount}`,
        code: `E2E-AUTO-READY-${projectCount}`,
        companyId: FIXTURES.companies.c1.id,
        ...state,
      })
      .expect(201);
    return response.body.id as string;
  }

  /** Returns the readyForExecution the update left behind. */
  async function patchProject(id: string, body: Record<string, unknown>): Promise<boolean> {
    const response = await request(app.getHttpServer())
      .patch(`/projects/${id}`)
      .set(authHeader(adminCookie))
      .send(body)
      .expect(200);
    return response.body.readyForExecution as boolean;
  }

  async function isAvailableToEmployee(id: string): Promise<boolean> {
    const response = await request(app.getHttpServer())
      .get('/projects/available')
      .set(authHeader(employeeCookie))
      .expect(200);
    return (response.body as Array<{ id: string }>).some((project) => project.id === id);
  }

  it('shows a project in production once it is pinned', async () => {
    const id = await createProject({
      status: 'IN_PRODUCTIE',
      isPinned: false,
      readyForExecution: false,
    });

    expect(await patchProject(id, { isPinned: true })).toBe(true);
    expect(await isAvailableToEmployee(id)).toBe(true);
  });

  it('hides a project outside production once it is pinned', async () => {
    const id = await createProject({
      status: 'IN_PREGATIRE',
      isPinned: false,
      readyForExecution: true,
    });

    expect(await patchProject(id, { isPinned: true })).toBe(false);
  });

  it('shows a pinned project once it moves into production', async () => {
    const id = await createProject({
      status: 'IN_PREGATIRE',
      isPinned: true,
      readyForExecution: false,
    });

    expect(await patchProject(id, { status: 'IN_PRODUCTIE' })).toBe(true);
  });

  it('hides a visible project once it is completed', async () => {
    const id = await createProject({
      status: 'IN_PRODUCTIE',
      isPinned: true,
      readyForExecution: true,
    });

    expect(await patchProject(id, { status: 'FINALIZAT' })).toBe(false);
    expect(await isAvailableToEmployee(id)).toBe(false);
  });

  it('hides a visible project once it is suspended', async () => {
    const id = await createProject({
      status: 'IN_PRODUCTIE',
      isPinned: true,
      readyForExecution: true,
    });

    expect(await patchProject(id, { status: 'SUSPENDAT' })).toBe(false);
    expect(await isAvailableToEmployee(id)).toBe(false);
  });

  it('hides a project once it is unpinned, whatever its status', async () => {
    const inProduction = await createProject({
      status: 'IN_PRODUCTIE',
      isPinned: true,
      readyForExecution: true,
    });
    const inPreparation = await createProject({
      status: 'IN_PREGATIRE',
      isPinned: true,
      readyForExecution: true,
    });

    expect(await patchProject(inProduction, { isPinned: false })).toBe(false);
    expect(await patchProject(inPreparation, { isPinned: false })).toBe(false);
    expect(await isAvailableToEmployee(inProduction)).toBe(false);
  });

  it('keeps an unpinned project hidden when it moves into production', async () => {
    const id = await createProject({
      status: 'IN_PREGATIRE',
      isPinned: false,
      readyForExecution: true,
    });

    expect(await patchProject(id, { status: 'IN_PRODUCTIE' })).toBe(false);
  });

  it('lets a readyForExecution sent with the change win over the automatic value', async () => {
    const id = await createProject({
      status: 'IN_PRODUCTIE',
      isPinned: true,
      readyForExecution: true,
    });

    expect(await patchProject(id, { status: 'FINALIZAT', readyForExecution: true })).toBe(true);
    expect(await isAvailableToEmployee(id)).toBe(true);
  });

  it('keeps a manual choice until the next pin or status change', async () => {
    const id = await createProject({
      status: 'IN_PRODUCTIE',
      isPinned: true,
      readyForExecution: true,
    });

    expect(await patchProject(id, { readyForExecution: false })).toBe(false);
    // The project form sends the unchanged status with every save.
    expect(
      await patchProject(id, { name: 'E2E Auto Ready renamed', status: 'IN_PRODUCTIE' }),
    ).toBe(false);

    expect(await patchProject(id, { status: 'SUSPENDAT' })).toBe(false);
    expect(await patchProject(id, { status: 'IN_PRODUCTIE' })).toBe(true);
  });
});
