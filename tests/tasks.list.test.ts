import request from 'supertest';
import { createApp } from '../src/app';
import { clearDb, setupTestDb, signupUser, teardownTestDb } from './helpers';

const app = createApp();
let token: string;

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearDb);

const seed = [
  { title: 'Alpha report', status: 'todo', priority: 'low', dueDate: '2026-09-03T00:00:00.000Z' },
  { title: 'Beta review', status: 'in_progress', priority: 'high', dueDate: '2026-09-01T00:00:00.000Z' },
  { title: 'Gamma deploy', status: 'done', priority: 'medium', dueDate: '2026-09-02T00:00:00.000Z' },
  { title: 'alpha follow-up', status: 'todo', priority: 'high' },
];

beforeEach(async () => {
  ({ token } = await signupUser(app));
  for (const t of seed) {
    await request(app).post('/api/tasks').set({ Authorization: `Bearer ${token}` }).send(t);
  }
});

const list = (query: Record<string, string | number> = {}, t = token) =>
  request(app).get('/api/tasks').query(query).set({ Authorization: `Bearer ${t}` });

describe('GET /api/tasks', () => {
  it('returns all own tasks with pagination metadata', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 4, page: 1, totalPages: 1 });
    expect(res.body.tasks).toHaveLength(4);
  });

  it('filters by status and priority', async () => {
    expect((await list({ status: 'todo' })).body.total).toBe(2);
    expect((await list({ priority: 'high' })).body.total).toBe(2);
    expect((await list({ status: 'todo', priority: 'high' })).body.total).toBe(1);
  });

  it('searches title case-insensitively as substring', async () => {
    const res = await list({ search: 'alpha' });
    expect(res.body.total).toBe(2);
    expect((await list({ search: 'eta rev' })).body.total).toBe(1);
  });

  it('sorts by dueDate asc with missing dates handled', async () => {
    const res = await list({ sortBy: 'dueDate', order: 'asc' });
    const titles = res.body.tasks.map((t: { title: string }) => t.title);
    expect(titles.indexOf('Beta review')).toBeLessThan(titles.indexOf('Gamma deploy'));
    expect(titles.indexOf('Gamma deploy')).toBeLessThan(titles.indexOf('Alpha report'));
  });

  it('sorts by priority semantically, not alphabetically', async () => {
    const res = await list({ sortBy: 'priority', order: 'desc' });
    const priorities = res.body.tasks.map((t: { priority: string }) => t.priority);
    expect(priorities.slice(0, 2)).toEqual(['high', 'high']);
    expect(priorities[3]).toBe('low');
  });

  it('paginates', async () => {
    const res = await list({ limit: 3, page: 2 });
    expect(res.body).toMatchObject({ total: 4, page: 2, totalPages: 2 });
    expect(res.body.tasks).toHaveLength(1);
  });

  it("rejects bad params and never leaks other users' tasks", async () => {
    expect((await list({ limit: 999 })).status).toBe(400);
    const other = await signupUser(app);
    expect((await list({}, other.token)).body.total).toBe(0);
  });
});
