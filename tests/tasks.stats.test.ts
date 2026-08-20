import request from 'supertest';
import { createApp } from '../src/app';
import { clearDb, setupTestDb, signupUser, teardownTestDb } from './helpers';

const app = createApp();

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearDb);

const getStats = (token: string) =>
  request(app).get('/api/tasks/stats').set({ Authorization: `Bearer ${token}` });

describe('GET /api/tasks/stats', () => {
  it('returns zeros for a fresh user', async () => {
    const { token } = await signupUser(app);
    const res = await getStats(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 0,
      byStatus: { todo: 0, in_progress: 0, done: 0 },
      completed: 0,
      pending: 0,
      completionPercentage: 0,
      overdue: 0,
    });
  });

  it('aggregates counts, completion percentage, and overdue', async () => {
    const { token } = await signupUser(app);
    const authed = { Authorization: `Bearer ${token}` };
    const create = (body: Record<string, unknown>) =>
      request(app).post('/api/tasks').set(authed).send(body);
    await create({ title: 'a', status: 'done' });
    await create({ title: 'b', status: 'todo', dueDate: '2020-01-01T00:00:00.000Z' });
    await create({ title: 'c', status: 'in_progress' });
    await create({ title: 'd', status: 'done', dueDate: '2020-01-01T00:00:00.000Z' });

    const res = await getStats(token);
    expect(res.body).toEqual({
      total: 4,
      byStatus: { todo: 1, in_progress: 1, done: 2 },
      completed: 2,
      pending: 2,
      completionPercentage: 50,
      overdue: 1,
    });
  });

  it('only counts own tasks', async () => {
    const a = await signupUser(app);
    await request(app)
      .post('/api/tasks')
      .set({ Authorization: `Bearer ${a.token}` })
      .send({ title: 'a task' });
    const b = await signupUser(app);
    expect((await getStats(b.token)).body.total).toBe(0);
  });
});
