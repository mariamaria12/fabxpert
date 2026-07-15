import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import PizZip from 'pizzip';
import { countInclusiveLeaveDays } from '@fabxpert/shared/leaveDays';
import { parseWorkDateString } from '@fabxpert/shared/workDate';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { FIXTURES, E2E_PASSWORD } from './helpers/fixtures';

function leaveDateIso(month: number, day: number): string {
  const year = new Date().getFullYear();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function expectedLeaveDays(startDate: string, endDate: string): number {
  return countInclusiveLeaveDays(
    parseWorkDateString(startDate),
    parseWorkDateString(endDate),
  );
}

function firstWeekendRangeInYear(): { startDate: string; endDate: string } {
  const year = new Date().getFullYear();
  for (let month = 0; month < 12; month += 1) {
    for (let day = 1; day <= 27; day += 1) {
      const saturday = new Date(year, month, day);
      if (saturday.getDay() === 6) {
        return {
          startDate: leaveDateIso(month + 1, day),
          endDate: leaveDateIso(month + 1, day + 1),
        };
      }
    }
  }

  throw new Error('No Saturday found in current year');
}

describe('Leave requests (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let employee1Cookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminCookie = (
      await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)
    ).cookieHeader;
    employee1Cookie = (
      await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD)
    ).cookieHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  it('EMPLOYEE creates a request (personId from auth) → IN_ASTEPTARE in /mine and admin list', async () => {
    const create = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'ODIHNA',
        startDate: leaveDateIso(7, 10),
        endDate: leaveDateIso(7, 14),
        reason: 'Vacanță',
      });

    expect(create.status).toBe(201);
    expect(create.body.leaveRequest.person.id).toBe(FIXTURES.persons.employee1.id);
    expect(create.body.leaveRequest.status).toBe('IN_ASTEPTARE');
    expect(create.body.leaveRequest.dayCount).toBe(
      expectedLeaveDays(leaveDateIso(7, 10), leaveDateIso(7, 14)),
    );
    expect(create.body.balance.personId).toBe(FIXTURES.persons.employee1.id);
    expect(create.body.balance.annualLeaveDays).toBe(21);

    const mine = await request(app.getHttpServer())
      .get('/leave-requests/mine')
      .set(authHeader(employee1Cookie));

    expect(mine.status).toBe(200);
    expect(mine.body.data.some((row: { id: string }) => row.id === create.body.leaveRequest.id)).toBe(
      true,
    );

    const adminList = await request(app.getHttpServer())
      .get('/leave-requests')
      .set(authHeader(adminCookie));

    expect(adminList.status).toBe(200);
    expect(
      adminList.body.data.some((row: { id: string }) => row.id === create.body.leaveRequest.id),
    ).toBe(true);
  });

  it('weekend-only period → 400', async () => {
    const weekend = firstWeekendRangeInYear();
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'ODIHNA',
        startDate: weekend.startDate,
        endDate: weekend.endDate,
      });

    expect(res.status).toBe(400);
  });

  it('endDate before startDate → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'ODIHNA',
        startDate: leaveDateIso(8, 10),
        endDate: leaveDateIso(8, 5),
      });

    expect(res.status).toBe(400);
  });

  it('edit and cancel own PENDING request → ok; edit after APROBAT → blocked', async () => {
    const create = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'ODIHNA',
        startDate: leaveDateIso(9, 1),
        endDate: leaveDateIso(9, 2),
      });

    expect(create.status).toBe(201);
    const id = create.body.leaveRequest.id;

    const patch = await request(app.getHttpServer())
      .patch(`/leave-requests/${id}`)
      .set(authHeader(employee1Cookie))
      .send({ reason: 'Updated reason' });

    expect(patch.status).toBe(200);
    expect(patch.body.leaveRequest.reason).toBe('Updated reason');

    const approve = await request(app.getHttpServer())
      .post(`/leave-requests/${id}/review`)
      .set(authHeader(adminCookie))
      .send({ status: 'APROBAT' });

    expect(approve.status).toBe(200);

    const patchAfterApprove = await request(app.getHttpServer())
      .patch(`/leave-requests/${id}`)
      .set(authHeader(employee1Cookie))
      .send({ reason: 'Too late' });

    expect(patchAfterApprove.status).toBe(409);

    const createPending = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'NEPLATIT',
        startDate: leaveDateIso(9, 7),
        endDate: leaveDateIso(9, 8),
      });

    expect(createPending.status).toBe(201);
    const pendingId = createPending.body.leaveRequest.id;

    const cancel = await request(app.getHttpServer())
      .delete(`/leave-requests/${pendingId}`)
      .set(authHeader(employee1Cookie));

    expect(cancel.status).toBe(204);

    const mine = await request(app.getHttpServer())
      .get('/leave-requests/mine')
      .set(authHeader(employee1Cookie));

    expect(mine.body.data.some((row: { id: string }) => row.id === pendingId)).toBe(false);
  });

  it('admin approve ODIHNA increases usedDays; MEDICAL approval leaves balance unchanged', async () => {
    const balanceBefore = await request(app.getHttpServer())
      .get('/leave-requests/my-balance')
      .set(authHeader(employee1Cookie));

    expect(balanceBefore.status).toBe(200);
    const usedBefore = balanceBefore.body.usedDays;

    const odihna = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'ODIHNA',
        startDate: leaveDateIso(10, 1),
        endDate: leaveDateIso(10, 3),
      });

    expect(odihna.status).toBe(201);
    const odihnaId = odihna.body.leaveRequest.id;

    const approveOdihna = await request(app.getHttpServer())
      .post(`/leave-requests/${odihnaId}/review`)
      .set(authHeader(adminCookie))
      .send({ status: 'APROBAT' });

    expect(approveOdihna.status).toBe(200);
    expect(approveOdihna.body.leaveRequest.reviewedBy.id).toBe(FIXTURES.users.admin.id);
    expect(approveOdihna.body.leaveRequest.reviewedAt).toBeTruthy();

    const balanceAfterOdihna = await request(app.getHttpServer())
      .get('/leave-requests/my-balance')
      .set(authHeader(employee1Cookie));

    expect(balanceAfterOdihna.body.usedDays).toBe(
      usedBefore + expectedLeaveDays(leaveDateIso(10, 1), leaveDateIso(10, 3)),
    );
    expect(balanceAfterOdihna.body.remainingDays).toBe(
      balanceAfterOdihna.body.annualLeaveDays - balanceAfterOdihna.body.usedDays,
    );

    const medical = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'MEDICAL',
        startDate: leaveDateIso(10, 10),
        endDate: leaveDateIso(10, 12),
      });

    expect(medical.status).toBe(201);
    const medicalId = medical.body.leaveRequest.id;

    const approveMedical = await request(app.getHttpServer())
      .post(`/leave-requests/${medicalId}/review`)
      .set(authHeader(adminCookie))
      .send({ status: 'APROBAT' });

    expect(approveMedical.status).toBe(200);

    const balanceAfterMedical = await request(app.getHttpServer())
      .get('/leave-requests/my-balance')
      .set(authHeader(employee1Cookie));

    expect(balanceAfterMedical.body.usedDays).toBe(balanceAfterOdihna.body.usedDays);
    expect(balanceAfterMedical.body.remainingDays).toBe(balanceAfterOdihna.body.remainingDays);
  });

  it('approving ODIHNA beyond balance succeeds with overBalanceWarning', async () => {
    const patchPerson = await request(app.getHttpServer())
      .patch(`/persons/${FIXTURES.persons.employee2.id}`)
      .set(authHeader(adminCookie))
      .send({ annualLeaveDays: 2 });

    expect(patchPerson.status).toBe(200);
    expect(patchPerson.body.annualLeaveDays).toBe(2);

    const employee2Cookie = (
      await login(app, FIXTURES.users.employee2.email, E2E_PASSWORD)
    ).cookieHeader;

    const create = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee2Cookie))
      .send({
        type: 'ODIHNA',
        startDate: leaveDateIso(11, 1),
        endDate: leaveDateIso(11, 5),
      });

    expect(create.status).toBe(201);
    const id = create.body.leaveRequest.id;

    const approve = await request(app.getHttpServer())
      .post(`/leave-requests/${id}/review`)
      .set(authHeader(adminCookie))
      .send({ status: 'APROBAT' });

    expect(approve.status).toBe(200);
    expect(approve.body.overBalanceWarning).toBe(true);
  });

  it('EMPLOYEE cannot call admin review endpoint (403)', async () => {
    const create = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'ODIHNA',
        startDate: leaveDateIso(12, 1),
        endDate: leaveDateIso(12, 2),
      });

    expect(create.status).toBe(201);

    const review = await request(app.getHttpServer())
      .post(`/leave-requests/${create.body.leaveRequest.id}/review`)
      .set(authHeader(employee1Cookie))
      .send({ status: 'APROBAT' });

    expect(review.status).toBe(403);
  });

  it('overlapping period on create → 409', async () => {
    const first = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'ODIHNA',
        startDate: leaveDateIso(3, 10),
        endDate: leaveDateIso(3, 14),
      });

    expect(first.status).toBe(201);

    const overlap = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'MEDICAL',
        startDate: leaveDateIso(3, 12),
        endDate: leaveDateIso(3, 16),
      });

    expect(overlap.status).toBe(409);
    expect(overlap.body.message).toContain('Există deja o cerere');
  });

  it('adjacent non-overlapping periods → ok', async () => {
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'ODIHNA',
        startDate: leaveDateIso(4, 15),
        endDate: leaveDateIso(4, 17),
      });

    expect(res.status).toBe(201);
  });

  it('admin can edit annualLeaveDays via person update and balance recomputes', async () => {
    const employee2Cookie = (
      await login(app, FIXTURES.users.employee2.email, E2E_PASSWORD)
    ).cookieHeader;

    const balanceBefore = await request(app.getHttpServer())
      .get(`/leave-requests/balance/${FIXTURES.persons.employee2.id}`)
      .set(authHeader(adminCookie));

    expect(balanceBefore.status).toBe(200);

    const patchPerson = await request(app.getHttpServer())
      .patch(`/persons/${FIXTURES.persons.employee2.id}`)
      .set(authHeader(adminCookie))
      .send({ annualLeaveDays: 30 });

    expect(patchPerson.status).toBe(200);

    const balanceAfter = await request(app.getHttpServer())
      .get('/leave-requests/my-balance')
      .set(authHeader(employee2Cookie));

    expect(balanceAfter.status).toBe(200);
    expect(balanceAfter.body.annualLeaveDays).toBe(30);
    expect(balanceAfter.body.usedDays).toBe(balanceBefore.body.usedDays);
    expect(balanceAfter.body.remainingDays).toBe(30 - balanceAfter.body.usedDays);
  });

  it('GET /leave-requests/balances returns all person balances in one call', async () => {
    const response = await request(app.getHttpServer())
      .get('/leave-requests/balances')
      .set(authHeader(adminCookie))
      .expect(200);

    expect(response.body.year).toBe(new Date().getFullYear());
    expect(Array.isArray(response.body.rows)).toBe(true);
    expect(response.body.rows.length).toBeGreaterThan(0);

    const employee1Row = response.body.rows.find(
      (row: { person: { id: string } }) => row.person.id === FIXTURES.persons.employee1.id,
    );
    expect(employee1Row).toBeDefined();
    expect(employee1Row.balance.personId).toBe(FIXTURES.persons.employee1.id);
    expect(typeof employee1Row.balance.usedDays).toBe('number');
    expect(typeof employee1Row.balance.remainingDays).toBe('number');
  });

  it('GET /leave-requests/:id/export.docx returns filled docx for approved ODIHNA', async () => {
    const create = await request(app.getHttpServer())
      .post('/leave-requests')
      .set(authHeader(employee1Cookie))
      .send({
        type: 'ODIHNA',
        startDate: leaveDateIso(11, 3),
        endDate: leaveDateIso(11, 7),
      })
      .expect(201);

    const id = create.body.leaveRequest.id as string;

    await request(app.getHttpServer())
      .get(`/leave-requests/${id}/export.docx`)
      .set(authHeader(employee1Cookie))
      .expect(400);

    await request(app.getHttpServer())
      .post(`/leave-requests/${id}/review`)
      .set(authHeader(adminCookie))
      .send({ status: 'APROBAT' })
      .expect(200);

    const exportResponse = await request(app.getHttpServer())
      .get(`/leave-requests/${id}/export.docx`)
      .set(authHeader(adminCookie))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(exportResponse.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(String(exportResponse.headers['content-disposition'])).toContain('.docx');
    expect(exportResponse.body.subarray(0, 2).toString()).toBe('PK');
    expect(exportResponse.body.length).toBeGreaterThan(1000);

    const documentXml = new PizZip(exportResponse.body)
      .file('word/document.xml')
      ?.asText();
    expect(documentXml).toBeDefined();
    expect(documentXml).not.toContain('{{balanceBefore}}');
    expect(documentXml).not.toContain('{{balanceAfter}}');
    expect(documentXml).toMatch(
      /anterior aprobării:<\/w:t>[\s\S]*?w14:paraId="3D36FB96"[\s\S]*?<w:t>\d+<\/w:t>/,
    );
    expect(documentXml).toMatch(
      /după aprobare:<\/w:t>[\s\S]*?w14:paraId="4B6B82DE"[\s\S]*?<w:t>\d+<\/w:t>/,
    );
  });
});
