import request from 'supertest';
import { createApp } from '../src/app';

describe('app', () => {
  const app = createApp();

  it('responds at the service root', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'task-tracker-backend' });
  });

  it('responds to health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 404 error shape for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: 'Not found', code: 'NOT_FOUND' } });
  });
});
