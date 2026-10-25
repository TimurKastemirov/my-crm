import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthResult, TaskDto } from '@crm/shared';
import { createE2eApp, hasE2eDatabase } from './support/e2e-app.js';

/** Tasks: optional fields can be cleared on edit; timestamps round-trip in UTC. */
describe.runIf(hasE2eDatabase)('Tasks (e2e)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('an edit can clear the description and due date', async () => {
    const reg = await api()
      .post('/api/v1/auth/register')
      .send({
        email: `tasks.${Date.now()}@e2e.test`,
        password: 'correct-horse-42',
        firstName: 'Tess',
        lastName: 'Task',
        organizationName: 'Task Org',
      })
      .expect(201);
    const auth = {
      Authorization: `Bearer ${(reg.body as AuthResult).tokens.accessToken}`,
    };

    const dueAt = '2026-03-01T06:15:00.000Z';
    const created = await api()
      .post('/api/v1/tasks')
      .set(auth)
      .send({ title: 'Call back', description: 'Notes', dueAt })
      .expect(201);
    expect((created.body as TaskDto).dueAt).toBe(dueAt);

    const cleared = await api()
      .patch(`/api/v1/tasks/${(created.body as TaskDto).id}`)
      .set(auth)
      .send({ description: null, dueAt: null })
      .expect(200);
    expect(cleared.body).toMatchObject({
      description: null,
      dueAt: null,
      title: 'Call back',
    });
  });

  it('creating with null optional fields leaves them empty', async () => {
    const reg = await api()
      .post('/api/v1/auth/register')
      .send({
        email: `tasks.null.${Date.now()}@e2e.test`,
        password: 'correct-horse-42',
        firstName: 'Nell',
        lastName: 'Null',
        organizationName: 'Null Org',
      })
      .expect(201);
    const created = await api()
      .post('/api/v1/tasks')
      .set({
        Authorization: `Bearer ${(reg.body as AuthResult).tokens.accessToken}`,
      })
      .send({ title: 'No details', description: null, dueAt: null })
      .expect(201);
    expect(created.body).toMatchObject({
      title: 'No details',
      description: null,
      dueAt: null,
    });
  });
});
