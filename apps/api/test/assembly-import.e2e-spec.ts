import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

describe('Assembly import (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let projectId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;

    const project = await request(app.getHttpServer())
      .post('/projects')
      .set(authHeader(adminCookie))
      .send({
        name: 'E2E Assembly Import',
        code: `E2E-ASM-IMPORT-${Date.now()}`,
        companyId: FIXTURES.companies.c1.id,
      })
      .expect(201);
    projectId = project.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function importRows(rows: object[], replace = false) {
    return request(app.getHttpServer())
      .post(`/projects/${projectId}/assemblies/import`)
      .set(authHeader(adminCookie))
      .send({ rows, replace })
      .expect(200);
  }

  it('re-imports a revised list as updates, in one batch, nulls included', async () => {
    const first = await importRows([
      { row: 1, name: 'GBAL/1', quantity: 4, profile: 'HEA 200', length: 2981.6, weightPerPiece: 12.5 },
      { row: 2, name: 'GBAL/2', quantity: 2, profile: null, length: null, weightPerPiece: null },
      { row: 3, name: 'GBAL/3', quantity: 1, profile: 'IPE 120', length: 1000, weightPerPiece: 3 },
    ]);
    expect(first.body).toMatchObject({ created: 3, updated: 0, deleted: 0 });

    // The first row now clears every optional column and the second fills them,
    // so a value in one row cannot be guessed from the other.
    const second = await importRows(
      [
        { row: 1, name: 'GBAL/1', quantity: 6, profile: null, length: null, weightPerPiece: null },
        { row: 2, name: 'GBAL/2', quantity: 3, profile: 'UPN 100', length: 500.5, weightPerPiece: 4.25 },
        { row: 3, name: 'GBAL/4', quantity: 7, profile: 'IPE 120', length: 1200, weightPerPiece: 3 },
      ],
      true,
    );
    expect(second.body).toMatchObject({ created: 1, updated: 2, deleted: 1 });

    const prisma = getTestPrisma();
    const rows = await prisma.projectAssembly.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });

    const byName = new Map(rows.map((row) => [row.name, row]));
    expect(byName.get('GBAL/1')).toMatchObject({
      quantity: 6,
      profile: null,
      profileKey: null,
      length: null,
      weightPerPiece: null,
      deletedAt: null,
    });
    expect(byName.get('GBAL/2')).toMatchObject({
      quantity: 3,
      profile: 'UPN 100',
      length: 500.5,
      weightPerPiece: 4.25,
      deletedAt: null,
    });
    expect(byName.get('GBAL/2')?.profileKey).not.toBeNull();
    expect(byName.get('GBAL/3')?.deletedAt).not.toBeNull();
    expect(byName.get('GBAL/4')).toMatchObject({ quantity: 7, deletedAt: null });

    const updatedAt = byName.get('GBAL/1')?.updatedAt.getTime() ?? 0;
    expect(updatedAt).toBeGreaterThan(byName.get('GBAL/1')?.createdAt.getTime() ?? Infinity);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    expect(project?.weight).toBeCloseTo(3 * 4.25 + 7 * 3, 5);
  });

  it('revives a deleted mark when it comes back on the list', async () => {
    const revived = await importRows([
      { row: 1, name: 'GBAL/3', quantity: 2, profile: 'IPE 120', length: 1000, weightPerPiece: 3 },
    ]);
    expect(revived.body).toMatchObject({ created: 0, updated: 1, deleted: 0 });

    const row = await getTestPrisma().projectAssembly.findFirst({
      where: { projectId, name: 'GBAL/3' },
    });
    expect(row).toMatchObject({ quantity: 2, deletedAt: null });
  });
});
