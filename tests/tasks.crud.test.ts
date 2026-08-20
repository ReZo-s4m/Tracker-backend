import request from 'supertest';
import { createApp } from '../src/app';
import { clearDb, setupTestDb, signupUser, teardownTestDb } from './helpers';

const app = createApp();
let token: string;

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearDb);
beforeEach(async () => {
  ({ token } = await signupUser(app));
});

const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

describe('POST /api/tasks', () => {
  it('creates a task with defaults', async () => {
    const res = await request(app).post('/api/tasks').set(auth()).send({ title: 'Write plan' });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      title: 'Write plan',
      status: 'todo',
      priority: 'medium',
      description: '',
    });
    expect(res.body.task._id).toEqual(expect.any(String));
  });

  it('accepts all fields', async () => {
    const res = await request(app).post('/api/tasks').set(auth()).send({
      title: 'Full task',
      description: 'details',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-09-01T00:00:00.000Z',
    });
    expect(res.status).toBe(201);
    expect(res.body.task.status).toBe('in_progress');
    expect(res.body.task.dueDate).toBe('2026-09-01T00:00:00.000Z');
  });

  it('rejects missing title and bad enums', async () => {
    expect((await request(app).post('/api/tasks').set(auth()).send({})).status).toBe(400);
    expect(
      (await request(app).post('/api/tasks').set(auth()).send({ title: 'x', status: 'later' })).status,
    ).toBe(400);
  });

  it('requires auth', async () => {
    expect((await request(app).post('/api/tasks').send({ title: 'x' })).status).toBe(401);
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns own task', async () => {
    const created = await request(app).post('/api/tasks').set(auth()).send({ title: 'Mine' });
    const res = await request(app).get(`/api/tasks/${created.body.task._id}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe('Mine');
  });

  it("returns 404 for another user's task, missing id, and invalid id", async () => {
    const created = await request(app).post('/api/tasks').set(auth()).send({ title: 'Mine' });
    const other = await signupUser(app);
    const foreign = await request(app)
      .get(`/api/tasks/${created.body.task._id}`)
      .set(auth(other.token));
    expect(foreign.status).toBe(404);
    expect((await request(app).get('/api/tasks/64b000000000000000000000').set(auth())).status).toBe(404);
    expect((await request(app).get('/api/tasks/not-an-id').set(auth())).status).toBe(404);
  });
});

describe('mutating tasks', () => {
  let id: string;
  beforeEach(async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set(auth())
      .send({ title: 'Original', priority: 'low', dueDate: '2026-09-01T00:00:00.000Z' });
    id = created.body.task._id;
  });

  it('PUT updates provided fields and clears dueDate with null', async () => {
    const res = await request(app)
      .put(`/api/tasks/${id}`)
      .set(auth())
      .send({ title: 'Renamed', status: 'in_progress', dueDate: null });
    expect(res.status).toBe(200);
    expect(res.body.task).toMatchObject({ title: 'Renamed', status: 'in_progress', priority: 'low', dueDate: null });
  });

  it('PATCH /complete marks task done', async () => {
    const res = await request(app).patch(`/api/tasks/${id}/complete`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('done');
  });

  it('DELETE removes the task', async () => {
    expect((await request(app).delete(`/api/tasks/${id}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/api/tasks/${id}`).set(auth())).status).toBe(404);
  });

  it("all mutations 404 on another user's task", async () => {
    const other = await signupUser(app);
    expect((await request(app).put(`/api/tasks/${id}`).set(auth(other.token)).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).patch(`/api/tasks/${id}/complete`).set(auth(other.token))).status).toBe(404);
    expect((await request(app).delete(`/api/tasks/${id}`).set(auth(other.token))).status).toBe(404);
  });
});
