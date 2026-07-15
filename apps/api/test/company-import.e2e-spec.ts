import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

describe('Company import (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (
      await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)
    ).cookieHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows two companies to share the same taxCode', async () => {
    const first = await request(app.getHttpServer())
      .post('/companies')
      .set(authHeader(adminCookie))
      .send({ name: 'E2E Shared Tax Alpha', taxCode: '43615620' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/companies')
      .set(authHeader(adminCookie))
      .send({ name: 'E2E Shared Tax Beta', taxCode: '43615620' })
      .expect(201);

    expect(first.body.taxCode).toBe('43615620');
    expect(second.body.taxCode).toBe('43615620');
    expect(first.body.id).not.toBe(second.body.id);
  });

  it('imports duplicate taxCode rows as separate companies keyed by name', async () => {
    const tsv = [
      'ORIZONT ELECTRIC S.R.L.\t43615620\tJ12/1/2020\tAddr Z\t0740000001\t.\t.\t.\tPOC Z\t0740000002',
      'ORIZONT ELECTRIC S.R.L. (Z)\t43615620\tJ12/1/2020\tAddr Z2\t0740000003\t.\t.\t.\tPOC Z2\t0740000004',
      'ORIZONT ELECTRIC S.R.L. (AR)\t43615620\tJ12/1/2020\tAddr AR\t0740000005\t.\t.\t.\tPOC AR\t0740000006',
    ].join('\n');

    const response = await request(app.getHttpServer())
      .post('/companies/import')
      .set(authHeader(adminCookie))
      .send({ tsv })
      .expect(200);

    expect(response.body).toEqual({
      created: 3,
      updated: 0,
      rejected: [],
    });

    const prisma = getTestPrisma();
    const imported = await prisma.company.findMany({
      where: {
        name: {
          in: [
            'ORIZONT ELECTRIC S.R.L.',
            'ORIZONT ELECTRIC S.R.L. (Z)',
            'ORIZONT ELECTRIC S.R.L. (AR)',
          ],
        },
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    expect(imported).toHaveLength(3);
    expect(new Set(imported.map((row) => row.taxCode))).toEqual(new Set(['43615620']));
  });

  it('updates an existing company when the import row name matches', async () => {
    const tsv = [
      'E2E Company One\t99999999\tJ99/1/2099\tUpdated address\t0700000000\t.\t.\t.\tUpdated POC\t0700000001',
    ].join('\n');

    const response = await request(app.getHttpServer())
      .post('/companies/import')
      .set(authHeader(adminCookie))
      .send({ tsv })
      .expect(200);

    expect(response.body).toEqual({
      created: 0,
      updated: 1,
      rejected: [],
    });

    const prisma = getTestPrisma();
    const company = await prisma.company.findFirstOrThrow({
      where: { id: FIXTURES.companies.c1.id },
    });

    expect(company.name).toBe('E2E Company One');
    expect(company.taxCode).toBe('99999999');
    expect(company.registeredAddress).toBe('Updated address');
    expect(company.contactPerson).toBe('Updated POC');
    expect(company.legalRepresentative).toBeNull();
    expect(company.email).toBeNull();
  });

  it('rejects a row when a soft-deleted company has the same name', async () => {
    const prisma = getTestPrisma();
    const deletedName = 'E2E Deleted Import Company';

    const deleted = await prisma.company.create({
      data: {
        name: deletedName,
        taxCode: '11111111',
        deletedAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    });

    const tsv = `${deletedName}\t22222222\t.\t.\t.\t.\t.\t.\t.\t.`;

    const response = await request(app.getHttpServer())
      .post('/companies/import')
      .set(authHeader(adminCookie))
      .send({ tsv })
      .expect(200);

    expect(response.body.created).toBe(0);
    expect(response.body.updated).toBe(0);
    expect(response.body.rejected).toEqual([
      {
        row: 1,
        name: deletedName,
        reason: 'A company with this name was previously deleted',
      },
    ]);

    const stillDeleted = await prisma.company.findUniqueOrThrow({
      where: { id: deleted.id },
    });
    expect(stillDeleted.taxCode).toBe('11111111');
    expect(stillDeleted.deletedAt).not.toBeNull();
  });

  it('rejects a row when multiple active companies share the same name', async () => {
    const prisma = getTestPrisma();
    const duplicateName = 'E2E Ambiguous Company Name';

    await prisma.company.createMany({
      data: [
        { name: duplicateName, taxCode: '33333333' },
        { name: duplicateName, taxCode: '44444444' },
      ],
    });

    const tsv = `${duplicateName}\t55555555\t.\t.\t.\t.\t.\t.\t.\t.`;

    const response = await request(app.getHttpServer())
      .post('/companies/import')
      .set(authHeader(adminCookie))
      .send({ tsv })
      .expect(200);

    expect(response.body.created).toBe(0);
    expect(response.body.updated).toBe(0);
    expect(response.body.rejected).toEqual([
      {
        row: 1,
        name: duplicateName,
        reason: 'Multiple active companies share this name',
      },
    ]);
  });
});
