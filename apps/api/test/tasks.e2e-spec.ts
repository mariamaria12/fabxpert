import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { TaskStreamEvent } from '@fabxpert/shared/dto/task.dto';
import { workDateToDayKey } from '@fabxpert/shared/workDate';
import { TaskEventsService } from '../src/task/task-events.service';
import { createTestApp } from './helpers/app';
import { authHeader, login } from './helpers/auth';
import { getTestPrisma } from './helpers/database';
import { E2E_PASSWORD, FIXTURES } from './helpers/fixtures';

const SECOND_ADMIN = {
  personId: 'e2e00001-0000-0000-0000-000000000009',
  userId: 'e2e00001-0000-0000-0000-000000000109',
  email: 'admin2@e2e.test',
};

function dayKey(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return workDateToDayKey(date);
}

describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let secondAdminCookie: string;

  const projectId = FIXTURES.projects.ready.id;

  const createTask = (body: Record<string, unknown>, cookie = adminCookie) =>
    request(app.getHttpServer())
      .post('/tasks')
      .set(authHeader(cookie))
      .send({
        title: 'Comandă tablă S355',
        projectId,
        assigneeUserId: SECOND_ADMIN.userId,
        ...body,
      });

  const inbox = async (cookie: string) => {
    const response = await request(app.getHttpServer())
      .get('/notifications/inbox')
      .set(authHeader(cookie))
      .expect(200);
    return response.body as {
      unreadCount: number;
      notifications: {
        id: string;
        kind: string;
        title: string;
        taskId: string;
        readAt: string | null;
      }[];
    };
  };

  beforeAll(async () => {
    app = await createTestApp();

    // The fixtures have a single admin; a task needs someone to hand it to.
    const prisma = getTestPrisma();
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: FIXTURES.users.admin.id } });
    await prisma.person.create({
      data: { id: SECOND_ADMIN.personId, firstName: 'Andrei', lastName: 'Pop' },
    });
    await prisma.user.create({
      data: {
        id: SECOND_ADMIN.userId,
        email: SECOND_ADMIN.email,
        passwordHash: admin.passwordHash,
        role: 'ADMIN',
        isOfficeUser: true,
        personId: SECOND_ADMIN.personId,
      },
    });

    adminCookie = (await login(app, FIXTURES.users.admin.email, E2E_PASSWORD)).cookieHeader;
    secondAdminCookie = (await login(app, SECOND_ADMIN.email, E2E_PASSWORD)).cookieHeader;
  });

  beforeEach(async () => {
    const prisma = getTestPrisma();
    await prisma.notification.deleteMany();
    await prisma.task.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a task with only the required fields and notifies the assignee', async () => {
    const response = await createTask({}).expect(201);

    expect(response.body.status).toBe('TODO');
    expect(response.body.priority).toBe('NORMAL');
    expect(response.body.dueDate).toBeNull();
    expect(response.body.project.code).toBe(FIXTURES.projects.ready.code);
    expect(response.body.assignee.id).toBe(SECOND_ADMIN.userId);
    expect(response.body.createdBy.id).toBe(FIXTURES.users.admin.id);
    expect(response.body.events.map((event: { type: string }) => event.type)).toEqual(['CREATED']);

    const assigneeInbox = await inbox(secondAdminCookie);
    expect(assigneeInbox.unreadCount).toBe(1);
    expect(assigneeInbox.notifications[0].kind).toBe('TASK_ASSIGNED');
    expect(assigneeInbox.notifications[0].taskId).toBe(response.body.id);
    expect(assigneeInbox.notifications[0].title).toContain('ți-a atribuit un task');

    // The author hears nothing about their own task.
    expect((await inbox(adminCookie)).unreadCount).toBe(0);
  });

  it('streams the notification to its recipient only, and the list change to everyone', async () => {
    const events = app.get(TaskEventsService);
    const received: Record<string, TaskStreamEvent[]> = { author: [], assignee: [] };
    const subscriptions = [
      events
        .subscribe(FIXTURES.users.admin.id)
        .subscribe((message) => received.author.push(message.data as TaskStreamEvent)),
      events
        .subscribe(SECOND_ADMIN.userId)
        .subscribe((message) => received.assignee.push(message.data as TaskStreamEvent)),
    ];

    try {
      await createTask({}).expect(201);
    } finally {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
    }

    expect(received.author.map((event) => event.type)).toEqual(['tasks-changed']);
    expect(received.assignee.map((event) => event.type)).toEqual(['notification', 'tasks-changed']);
  });

  it('sends one task to several people together, or to nobody', async () => {
    const sendToMany = (assigneeUserIds: string[]) =>
      request(app.getHttpServer())
        .post('/tasks/batch')
        .set(authHeader(adminCookie))
        .send({ title: 'Verifică oferta', projectId, assigneeUserIds });

    const sent = await sendToMany([FIXTURES.users.admin.id, SECOND_ADMIN.userId]).expect(201);
    expect(sent.body.map((task: { assignee: { id: string } }) => task.assignee.id).sort()).toEqual(
      [FIXTURES.users.admin.id, SECOND_ADMIN.userId].sort(),
    );

    // Each has a task of their own; only the one who did not send it is told.
    expect(await getTestPrisma().task.count()).toBe(2);
    expect((await inbox(secondAdminCookie)).notifications).toHaveLength(1);
    expect((await inbox(adminCookie)).notifications).toHaveLength(0);

    // One recipient who cannot take it stops the whole send.
    await sendToMany([SECOND_ADMIN.userId, FIXTURES.users.employee1.id]).expect(400);
    await sendToMany([]).expect(400);
    expect(await getTestPrisma().task.count()).toBe(2);
  });

  it('refuses a deadline that is not a real day', async () => {
    await createTask({ dueDate: '2026-02-31' }).expect(400);
    await createTask({ dueDate: '31.02.2026' }).expect(400);
  });

  it('does not notify someone who assigns a task to themselves', async () => {
    await createTask({ assigneeUserId: FIXTURES.users.admin.id }).expect(201);
    expect((await inbox(adminCookie)).notifications).toHaveLength(0);
  });

  it('refuses a task without a title, a project or an admin assignee', async () => {
    await createTask({ title: '  ' }).expect(400);
    await createTask({ projectId: FIXTURES.projects.deleted.id }).expect(400);
    await createTask({ assigneeUserId: FIXTURES.users.employee1.id }).expect(400);
  });

  it('keeps tasks away from employees', async () => {
    const employeeCookie = (await login(app, FIXTURES.users.employee1.email, E2E_PASSWORD))
      .cookieHeader;
    await request(app.getHttpServer()).get('/tasks').set(authHeader(employeeCookie)).expect(403);
    await createTask({}, employeeCookie).expect(403);
  });

  it('lists mine and all, and leaves finished tasks out unless asked for', async () => {
    const mine = (await createTask({ assigneeUserId: FIXTURES.users.admin.id })).body;
    const theirs = (await createTask({ title: 'Confirmă zincarea' })).body;

    const list = (query: string) =>
      request(app.getHttpServer()).get(`/tasks${query}`).set(authHeader(adminCookie)).expect(200);
    const ids = (body: { id: string }[]) => body.map((task) => task.id).sort();

    expect(ids((await list('?scope=mine')).body)).toEqual([mine.id]);
    expect(ids((await list('')).body)).toEqual([mine.id, theirs.id].sort());

    await request(app.getHttpServer())
      .patch(`/tasks/${mine.id}`)
      .set(authHeader(adminCookie))
      .send({ status: 'DONE' })
      .expect(200);

    expect(ids((await list('?scope=mine')).body)).toEqual([]);
    expect(ids((await list('?scope=mine&includeDone=true')).body)).toEqual([mine.id]);
  });

  it('records changes in the history and notifies on reassignment and completion', async () => {
    const task = (await createTask({ dueDate: dayKey(2) })).body;

    // The assignee starts and finishes it: the author is told once, on completion.
    const started = await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set(authHeader(secondAdminCookie))
      .send({ status: 'IN_PROGRESS', priority: 'URGENT', dueDate: dayKey(5) })
      .expect(200);
    expect(started.body.completedAt).toBeNull();
    expect((await inbox(adminCookie)).notifications).toHaveLength(0);

    const finished = await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set(authHeader(secondAdminCookie))
      .send({ status: 'DONE' })
      .expect(200);
    expect(finished.body.completedAt).not.toBeNull();
    // Events written by one edit share a timestamp, so only the set is checked.
    expect(finished.body.events.map((event: { type: string }) => event.type).sort()).toEqual([
      'CREATED',
      'DUE_DATE_CHANGED',
      'PRIORITY_CHANGED',
      'STATUS_CHANGED',
      'STATUS_CHANGED',
    ]);

    const authorInbox = await inbox(adminCookie);
    expect(authorInbox.notifications.map((item) => item.kind)).toEqual(['TASK_COMPLETED']);

    // Reopened and handed back to the author by the other admin.
    const reassigned = await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set(authHeader(secondAdminCookie))
      .send({ status: 'TODO', assigneeUserId: FIXTURES.users.admin.id })
      .expect(200);
    expect(reassigned.body.completedAt).toBeNull();
    expect(reassigned.body.assignee.id).toBe(FIXTURES.users.admin.id);

    const afterReassign = await inbox(adminCookie);
    expect(afterReassign.notifications.map((item) => item.kind)).toEqual([
      'TASK_ASSIGNED',
      'TASK_COMPLETED',
    ]);
    expect(afterReassign.unreadCount).toBe(2);

    await request(app.getHttpServer())
      .post(`/notifications/${afterReassign.notifications[0].id}/read`)
      .set(authHeader(adminCookie))
      .expect(204);
    expect((await inbox(adminCookie)).unreadCount).toBe(1);

    await request(app.getHttpServer())
      .post('/notifications/inbox/read-all')
      .set(authHeader(adminCookie))
      .expect(204);
    const allRead = await inbox(adminCookie);
    expect(allRead.unreadCount).toBe(0);
    expect(allRead.notifications).toHaveLength(2);
  });

  it('works out the history from the last edit when two edits race', async () => {
    const task = (await createTask({})).body;
    const setStatus = (status: string, cookie: string) =>
      request(app.getHttpServer())
        .patch(`/tasks/${task.id}`)
        .set(authHeader(cookie))
        .send({ status })
        .expect(200);

    await Promise.all([
      setStatus('IN_PROGRESS', adminCookie),
      setStatus('DONE', secondAdminCookie),
    ]);

    const events = await getTestPrisma().taskEvent.findMany({
      where: { taskId: task.id, type: 'STATUS_CHANGED' },
      orderBy: { createdAt: 'asc' },
    });
    // Whichever edit came second started from what the first one left.
    expect(events).toHaveLength(2);
    expect(events[0].fromValue).toBe('TODO');
    expect(events[1].fromValue).toBe(events[0].toValue);

    const saved = await getTestPrisma().task.findUniqueOrThrow({ where: { id: task.id } });
    expect(saved.status).toBe(events[1].toValue);
  });

  it('counts overdue and due-today tasks for the badge and per project', async () => {
    await createTask({ assigneeUserId: FIXTURES.users.admin.id, dueDate: dayKey(-1) }).expect(201);
    await createTask({ assigneeUserId: FIXTURES.users.admin.id, dueDate: dayKey(0) }).expect(201);
    await createTask({ assigneeUserId: FIXTURES.users.admin.id, dueDate: dayKey(3) }).expect(201);
    await createTask({ assigneeUserId: FIXTURES.users.admin.id }).expect(201);
    await createTask({ dueDate: dayKey(-4) }).expect(201);

    const attention = await request(app.getHttpServer())
      .get('/tasks/attention-count')
      .set(authHeader(adminCookie))
      .expect(200);
    expect(attention.body.count).toBe(2);

    const counts = await request(app.getHttpServer())
      .get('/tasks/project-counts')
      .set(authHeader(adminCookie))
      .expect(200);
    expect(counts.body).toEqual([
      {
        project: expect.objectContaining({ id: projectId }),
        openCount: 5,
        overdueCount: 2,
      },
    ]);
  });

  it('keeps a checklist and comments on the task', async () => {
    const task = (await createTask({})).body;
    const send = (method: 'post' | 'patch' | 'delete', path: string, body?: object) =>
      request(app.getHttpServer())
        [method](`/tasks/${task.id}${path}`)
        .set(authHeader(adminCookie))
        .send(body);

    await send('post', '/checklist', { text: 'Verificat necesarul' }).expect(201);
    const withItems = await send('post', '/checklist', { text: 'Cerut ofertă' }).expect(201);
    expect(withItems.body.checklist.map((item: { text: string }) => item.text)).toEqual([
      'Verificat necesarul',
      'Cerut ofertă',
    ]);

    const [first, second] = withItems.body.checklist;
    const ticked = await send('patch', `/checklist/${first.id}`, { isDone: true }).expect(200);
    expect(ticked.body.checklistDoneCount).toBe(1);
    expect(ticked.body.checklistTotalCount).toBe(2);

    const removed = await send('delete', `/checklist/${second.id}`).expect(200);
    expect(removed.body.checklistTotalCount).toBe(1);

    const commented = await send('post', '/comments', { body: 'Am primit revizia nouă.' }).expect(
      201,
    );
    expect(commented.body.commentCount).toBe(1);
    expect(commented.body.comments[0].author.id).toBe(FIXTURES.users.admin.id);
    // Comments stay out of the history.
    expect(commented.body.events).toHaveLength(1);

    // The assignee hears about the author's comment; the author does not.
    expect((await inbox(secondAdminCookie)).notifications.map((item) => item.kind)).toEqual([
      'TASK_COMMENTED',
      'TASK_ASSIGNED',
    ]);
    expect((await inbox(adminCookie)).notifications).toHaveLength(0);
  });

  it('removes a task softly and drops its notifications from the inbox', async () => {
    const task = (await createTask({})).body;
    expect((await inbox(secondAdminCookie)).notifications).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/tasks/${task.id}`)
      .set(authHeader(adminCookie))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/tasks/${task.id}`)
      .set(authHeader(adminCookie))
      .expect(404);
    expect((await inbox(secondAdminCookie)).notifications).toHaveLength(0);
    expect(await getTestPrisma().task.count()).toBe(1);
  });

  it('drops the notifications of a task whose project was removed', async () => {
    await createTask({}).expect(201);
    expect((await inbox(secondAdminCookie)).unreadCount).toBe(1);

    const prisma = getTestPrisma();
    await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });
    try {
      const afterRemoval = await inbox(secondAdminCookie);
      expect(afterRemoval.notifications).toHaveLength(0);
      expect(afterRemoval.unreadCount).toBe(0);
    } finally {
      await prisma.project.update({ where: { id: projectId }, data: { deletedAt: null } });
    }
  });
});
