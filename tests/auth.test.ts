import request from 'supertest';
import { createApp } from '../src/app';
import { clearDb, setupTestDb, signupUser, teardownTestDb } from './helpers';

const app = createApp();

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearDb);

describe('POST /api/auth/signup', () => {
  const valid = { name: 'Ani', email: 'ani@example.com', password: 'password123' };

  it('creates a user and returns token + user', async () => {
    const res = await request(app).post('/api/auth/signup').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: expect.any(String), name: 'Ani', email: 'ani@example.com' });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('rejects invalid email', async () => {
    const res = await request(app).post('/api/auth/signup').send({ ...valid, email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects password shorter than 8 chars', async () => {
    const res = await request(app).post('/api/auth/signup').send({ ...valid, password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate email with 409', async () => {
    await request(app).post('/api/auth/signup').send(valid);
    const res = await request(app).post('/api/auth/signup').send(valid);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });
});

describe('POST /api/auth/login', () => {
  it('returns token for valid credentials', async () => {
    await signupUser(app, { email: 'login@example.com', password: 'password123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('returns the same 401 for unknown email and wrong password', async () => {
    await signupUser(app, { email: 'known@example.com', password: 'password123' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'password123' });
    const wrongPw = await request(app)
      .post('/api/auth/login')
      .send({ email: 'known@example.com', password: 'wrongpassword' });
    expect(unknown.status).toBe(401);
    expect(wrongPw.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrongPw.body.error.message);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user', async () => {
    const { token, user } = await signupUser(app);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
  });

  it('rejects missing and malformed tokens', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer junk')).status).toBe(401);
  });
});
