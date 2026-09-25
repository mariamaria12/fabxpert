import { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

/**
 * A project workbook breaks every assembly down into its parts on the
 * "Detaliere ansamble" sheet. The preview adds those up the way the workbook
 * counts its own "Nr. piese/to", and the import stores the figure as the
 * project's complexity.
 */
describe('Assembly workbook parts (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;

  const TEKLA_HEADER = [
    'Ansamblu',
    'Piesa',
    'Nr. buc.',
    'Secțiune',
    'Material',
    'Lungime (mm)',
    'Lățime / Grosime TBN\n (mm)',
    'Înălțime (mm)',
    'Masa individuală (kg)',
    'NR. TOTAL DE REPERE',
    'Masa totală (kg)',
    'Lungime totală profile\n(mm)',
    'Suprafață totală TBN\n(mp)',
    'Masa totală ANSAMBLU (kg)',
  ];

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  async function workbook(sheets: Record<string, (string | number | null)[][]>): Promise<Buffer> {
    const book = new ExcelJS.Workbook();
    for (const [name, rows] of Object.entries(sheets)) {
      book.addWorksheet(name).addRows(rows);
    }
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  const assemblySheet = [
    ['Ansamblu', 'Nr. buc', 'Profil', 'Lungime', 'Greutate'],
    ['GBAL/1', 2, 'HEA 200', 1000, 50],
    ['GBAL/2', 1, 'IPE 120', 800, 100],
  ];

  function preview(buffer: Buffer) {
    return request(app.getHttpServer())
      .post('/assemblies/preview/file')
      .set(authHeader(adminCookie))
      .attach('file', buffer, 'proiect.xlsx')
      .expect(200);
  }

  it('adds up the parts of a Tekla breakdown the way the workbook does', async () => {
    const buffer = await workbook({
      ANSAMBLE: assemblySheet,
      'Detaliere ansamble': [
        TEKLA_HEADER,
        // The workbook's own summary row: labels, not a part.
        ['Proiect', null, null, null, null, null, null, null, 'Nr. piese', 7, 'Nr.piese/ to', 35, 'TOTAL kg.', 200],
        ['GBAL/1', null, 2, null, 'HEA 200', null, null, null, 50, 2, 100, null, null, 100],
        [null, 'p/1', 1, 'HEA200', 'S235JR', 1000, null, null, 40, 2, 80, 2000, 0, null],
        [null, 'p/2', 2, 'TBN', 'S355JR', 100, 10, 100, 5, 4, 20, 0, 0.04, null],
        // A plate with no mark is left out, as the workbook's own sum leaves it out.
        [null, null, 3, 'TBN', null, 500, 10, 500, 3, 6, 9, 0, 0, null],
        ['GBAL/2', null, 1, null, 'IPE 120', null, null, null, 100, 1, 100, null, null, 100],
        [null, 'p/3', 1, 'IPE120', 'S235JR', 800, null, null, 100, 1, 100, 800, 0, null],
      ],
    });

    const response = await preview(buffer);

    expect(response.body.rows).toHaveLength(2);
    expect(response.body.parts).toEqual({ pieces: 7, weightKg: 200, piecesPerTon: 35 });
  });

  it('skips the assembly rows of the hand-made template, which say "buc." instead of a part', async () => {
    const buffer = await workbook({
      ANSAMBLE: assemblySheet,
      'Detaliere ansamble': [
        [
          'Ansamblu',
          'Nr. buc.',
          'Reper',
          'Tip profil  / material',
          'Număr de repere în ansamblu',
          'Masa individuală (kg)',
          'NR. TOTAL DE REPERE',
          'Masa totală (kg)',
        ],
        ['AGE/1', 2, 'buc.', null, null, 30, null, 60],
        ['AGE/1', 2, 'pge/53', 'SHS70X70X5', 1, 20, 2, 40],
        ['AGE/1', 2, 'pge/16', 'TBN', 3, 10 / 3, 6, 20],
      ],
    });

    const response = await preview(buffer);

    expect(response.body.parts).toEqual({ pieces: 8, weightKg: 60, piecesPerTon: 133.3 });
  });

  it('reads no parts from a workbook without the breakdown', async () => {
    const response = await preview(await workbook({ ANSAMBLE: assemblySheet }));

    expect(response.body.rows).toHaveLength(2);
    expect(response.body.parts).toBeNull();
  });

  it('stores the complexity with the list, and a plain import leaves it alone', async () => {
    const created = await request(app.getHttpServer())
      .post('/projects')
      .set(authHeader(adminCookie))
      .send({
        name: 'E2E Workbook Parts',
        code: `E2E-WB-PARTS-${Date.now()}`,
        companyId: FIXTURES.companies.c1.id,
        piecesPerTon: 12,
      })
      .expect(201);
    const projectId = created.body.id;

    function importRows(body: Record<string, unknown>) {
      return request(app.getHttpServer())
        .post(`/projects/${projectId}/assemblies/import`)
        .set(authHeader(adminCookie))
        .send({
          rows: [{ row: 1, name: 'GBAL/1', quantity: 2, profile: null, length: null, weightPerPiece: 50 }],
          ...body,
        })
        .expect(200);
    }

    await importRows({ replace: true, piecesPerTon: 35 });
    const replaced = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .expect(200);
    expect(replaced.body.piecesPerTon).toBe(35);

    await importRows({});
    const plain = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set(authHeader(adminCookie))
      .expect(200);
    expect(plain.body.piecesPerTon).toBe(35);
  });
});
