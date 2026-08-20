# Task Tracker Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** REST API for the Task Tracker: JWT auth, owner-scoped task CRUD, filtering/search/sort/pagination, and a stats aggregation endpoint.

**Architecture:** Express app factory (`createApp`) with layered `routes → controllers → models`, Zod validation parsed in controllers and mapped centrally, `ApiError` + global error middleware, Mongoose models with compound indexes. Tests run against `mongodb-memory-server` via Supertest.

**Tech Stack:** Node 20, TypeScript 5, Express 4, Mongoose 8, Zod 3, jsonwebtoken, bcryptjs, Jest + ts-jest + Supertest + mongodb-memory-server.

**Spec:** `docs/superpowers/specs/2026-08-19-task-tracker-design.md`

## Global Constraints

- Repo is LOCAL ONLY — commit, never push.
- All API routes under `/api`; auth header `Authorization: Bearer <JWT>`; JWT payload `{sub: userId}`, 7-day expiry.
- Error shape everywhere: `{error: {message, code}}` (validation errors add `details`).
- Task status enum: `todo | in_progress | done`; priority enum: `low | medium | high`.
- Foreign/missing/invalid task id → 404 `TASK_NOT_FOUND`, never 500.
- List defaults: `sortBy=createdAt`, `order=desc`, `page=1`, `limit=10` (max 50).
- Zero code comments unless a constraint can't be expressed in code.
- Commit after every green task: `git add -A && git commit`.

---

### Task 1: Scaffold, app factory, error handling, health endpoint

**Files:**
- Create: `package.json`, `tsconfig.json`, `jest.config.js`, `.gitignore`, `docker-compose.yml`, `.env.example`
- Create: `src/config.ts`, `src/errors.ts`, `src/app.ts`, `src/server.ts`
- Test: `tests/app.test.ts`

**Interfaces:**
- Produces: `createApp(): Express` (routers mounted in later tasks); `ApiError(statusCode, message, code)`; `asyncHandler(fn)`; `errorHandler`; `notFoundHandler`; `config.{port,mongoUri,jwtSecret}`.

- [ ] **Step 1: Scaffold project**

```bash
cd /home/anirudhbollaram/projects/task-tracker-backend
npm init -y
npm i express cors mongoose zod jsonwebtoken bcryptjs
npm i -D typescript tsx @types/express @types/cors @types/node @types/jsonwebtoken @types/bcryptjs jest ts-jest @types/jest supertest @types/supertest mongodb-memory-server
```

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest --runInBand"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`jest.config.js`:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 60000,
};
```

`.gitignore`:

```
node_modules/
dist/
coverage/
.env
```

`docker-compose.yml`:

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
volumes:
  mongo-data:
```

`.env.example`:

```
PORT=4000
MONGO_URI=mongodb://localhost:27017/task_tracker
JWT_SECRET=change-me
```

- [ ] **Step 2: Write the failing test**

`tests/app.test.ts`:

```ts
import request from 'supertest';
import { createApp } from '../src/app';

describe('app', () => {
  const app = createApp();

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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/app.test.ts`
Expected: FAIL — cannot find module `../src/app`.

- [ ] **Step 4: Implement**

`src/config.ts`:

```ts
export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/task_tracker',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
};
```

`src/errors.ts`:

```ts
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
};

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL' } });
}
```

`src/app.ts`:

```ts
import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './errors';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
```

`src/server.ts`:

```ts
import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';

async function main() {
  await mongoose.connect(config.mongoUri);
  createApp().listen(config.port, () => {
    console.log(`API listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/app.test.ts` — expected: 2 passed. Also `npm run build` must succeed.

- [ ] **Step 6: Commit** — `chore: scaffold express app with error handling`

---

### Task 2: User model + signup

**Files:**
- Create: `src/models/User.ts`, `src/schemas/auth.ts`, `src/controllers/auth.ts`, `src/routes/auth.ts`
- Create: `tests/helpers.ts`
- Modify: `src/app.ts` (mount `/api/auth`)
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `createApp`, `ApiError`, `asyncHandler`, `config.jwtSecret`.
- Produces: `User` model (`name, email, passwordHash`, timestamps); `signToken(userId: string): string`; `toUserDto(user): {id, name, email}`; test helpers `setupTestDb()`, `teardownTestDb()`, `clearDb()`, `signupUser(app, overrides?): Promise<{token: string, user: {id,name,email}}>`.

- [ ] **Step 1: Write test helpers**

`tests/helpers.ts`:

```ts
import { Express } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

let mongod: MongoMemoryServer;
let counter = 0;

export async function setupTestDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function teardownTestDb() {
  await mongoose.disconnect();
  await mongod.stop();
}

export async function clearDb() {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function signupUser(app: Express, overrides: Record<string, unknown> = {}) {
  counter += 1;
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name: 'Test User', email: `user${counter}@example.com`, password: 'password123', ...overrides });
  return res.body as { token: string; user: { id: string; name: string; email: string } };
}
```

- [ ] **Step 2: Write the failing tests**

`tests/auth.test.ts`:

```ts
import request from 'supertest';
import { createApp } from '../src/app';
import { clearDb, setupTestDb, teardownTestDb } from './helpers';

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
```

- [ ] **Step 3: Run to verify failure** — `npx jest tests/auth.test.ts` fails (no route → 404).

- [ ] **Step 4: Implement**

`src/models/User.ts`:

```ts
import { model, Schema } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
```

`src/schemas/auth.ts`:

```ts
import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
```

`src/controllers/auth.ts`:

```ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ApiError, asyncHandler } from '../errors';
import { User } from '../models/User';
import { loginSchema, signupSchema } from '../schemas/auth';

const signToken = (userId: string) => jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });

const toUserDto = (user: { id: string; name: string; email: string }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

export const signup = asyncHandler(async (req, res) => {
  const body = signupSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 10);
  try {
    const user = await User.create({ name: body.name, email: body.email, passwordHash });
    res.status(201).json({ token: signToken(user.id), user: toUserDto(user) });
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      throw new ApiError(409, 'Email already registered', 'EMAIL_TAKEN');
    }
    throw err;
  }
});

export const login = asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await User.findOne({ email: body.email });
  const valid = user && (await bcrypt.compare(body.password, user.passwordHash));
  if (!valid) throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  res.json({ token: signToken(user.id), user: toUserDto(user) });
});
```

`src/routes/auth.ts`:

```ts
import { Router } from 'express';
import { login, signup } from '../controllers/auth';

export const authRouter = Router();
authRouter.post('/signup', signup);
authRouter.post('/login', login);
```

In `src/app.ts`, before `notFoundHandler`:

```ts
import { authRouter } from './routes/auth';
// ...
app.use('/api/auth', authRouter);
```

- [ ] **Step 5: Run to verify pass** — `npx jest tests/auth.test.ts` all green. Note: `User.create` must run at least once before duplicate detection relies on the unique index; mongodb-memory-server builds indexes automatically via Mongoose `autoIndex` (default true in dev). If the 409 test flakes, add `await User.init();` in `setupTestDb` after connect.

- [ ] **Step 6: Commit** — `feat: user signup with hashed passwords`

---

### Task 3: Login test coverage, auth middleware, GET /me

**Files:**
- Create: `src/middleware/auth.ts`
- Modify: `src/controllers/auth.ts` (add `me`), `src/routes/auth.ts`
- Test: extend `tests/auth.test.ts`

**Interfaces:**
- Produces: `requireAuth` middleware setting `req.userId` (global Express augmentation), used by all task routes.

- [ ] **Step 1: Write the failing tests** (append to `tests/auth.test.ts`)

```ts
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
```

Add `signupUser` to the helpers import in this file.

- [ ] **Step 2: Run to verify failure** — `/me` tests fail with 404.

- [ ] **Step 3: Implement**

`src/middleware/auth.ts`:

```ts
import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ApiError } from '../errors';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED');
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as { sub: string };
    req.userId = payload.sub;
  } catch {
    throw new ApiError(401, 'Invalid or expired token', 'UNAUTHENTICATED');
  }
  next();
};
```

Add to `src/controllers/auth.ts`:

```ts
export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(401, 'Invalid or expired token', 'UNAUTHENTICATED');
  res.json({ user: toUserDto(user) });
});
```

Add to `src/routes/auth.ts`:

```ts
authRouter.get('/me', requireAuth, me);
```

- [ ] **Step 4: Run to verify pass** — full `npm test` green.
- [ ] **Step 5: Commit** — `feat: login, jwt auth middleware, and /me endpoint`

---

### Task 4: Task model, create, get-by-id with ownership

**Files:**
- Create: `src/models/Task.ts`, `src/schemas/task.ts`, `src/controllers/tasks.ts`, `src/routes/tasks.ts`
- Modify: `src/app.ts` (mount `/api/tasks`)
- Test: `tests/tasks.crud.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, helpers, `ApiError`, `asyncHandler`.
- Produces: `Task` model with indexes; `findOwnedTask(userId: string, id: string): Promise<TaskDoc>` (throws 404 `TASK_NOT_FOUND` for invalid/foreign/missing ids); `createTaskSchema`, `updateTaskSchema`; `tasksRouter`. Route order constraint: `/stats` (Task 7) MUST be registered before `/:id`.

- [ ] **Step 1: Write the failing tests**

`tests/tasks.crud.test.ts`:

```ts
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

  it('returns 404 for another user\'s task, missing id, and invalid id', async () => {
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
```

- [ ] **Step 2: Run to verify failure** — 404s where 201/200 expected.

- [ ] **Step 3: Implement**

`src/models/Task.ts`:

```ts
import { model, Schema } from 'mongoose';

const taskSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true },
);

taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, dueDate: 1 });
taskSchema.index({ title: 'text' });

export const Task = model('Task', taskSchema);
```

`src/schemas/task.ts`:

```ts
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const listTasksSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(['dueDate', 'priority', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
```

`src/controllers/tasks.ts`:

```ts
import { Types } from 'mongoose';
import { ApiError, asyncHandler } from '../errors';
import { Task } from '../models/Task';
import { createTaskSchema } from '../schemas/task';

async function findOwnedTask(userId: string, id: string) {
  const notFound = () => new ApiError(404, 'Task not found', 'TASK_NOT_FOUND');
  if (!Types.ObjectId.isValid(id)) throw notFound();
  const task = await Task.findOne({ _id: id, userId });
  if (!task) throw notFound();
  return task;
}

export const createTask = asyncHandler(async (req, res) => {
  const body = createTaskSchema.parse(req.body);
  const task = await Task.create({ ...body, userId: req.userId });
  res.status(201).json({ task });
});

export const getTask = asyncHandler(async (req, res) => {
  const task = await findOwnedTask(req.userId as string, req.params.id);
  res.json({ task });
});
```

`src/routes/tasks.ts`:

```ts
import { Router } from 'express';
import { createTask, getTask } from '../controllers/tasks';
import { requireAuth } from '../middleware/auth';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);
tasksRouter.post('/', createTask);
tasksRouter.get('/:id', getTask);
```

Mount in `src/app.ts` before `notFoundHandler`:

```ts
import { tasksRouter } from './routes/tasks';
// ...
app.use('/api/tasks', tasksRouter);
```

- [ ] **Step 4: Run to verify pass** — `npm test` green.
- [ ] **Step 5: Commit** — `feat: task model with create and owner-scoped get`

---

### Task 5: Update, delete, complete

**Files:**
- Modify: `src/controllers/tasks.ts`, `src/routes/tasks.ts`
- Test: extend `tests/tasks.crud.test.ts`

**Interfaces:**
- Consumes: `findOwnedTask`, `updateTaskSchema`.
- Produces: `PUT /:id`, `DELETE /:id`, `PATCH /:id/complete`.

- [ ] **Step 1: Write the failing tests** (append to `tests/tasks.crud.test.ts`)

```ts
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

  it('all mutations 404 on another user\'s task', async () => {
    const other = await signupUser(app);
    expect((await request(app).put(`/api/tasks/${id}`).set(auth(other.token)).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).patch(`/api/tasks/${id}/complete`).set(auth(other.token))).status).toBe(404);
    expect((await request(app).delete(`/api/tasks/${id}`).set(auth(other.token))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure** — 404s.

- [ ] **Step 3: Implement** (add to `src/controllers/tasks.ts`)

```ts
export const updateTask = asyncHandler(async (req, res) => {
  const body = updateTaskSchema.parse(req.body);
  const task = await findOwnedTask(req.userId as string, req.params.id);
  Object.assign(task, body);
  await task.save();
  res.json({ task });
});

export const completeTask = asyncHandler(async (req, res) => {
  const task = await findOwnedTask(req.userId as string, req.params.id);
  task.status = 'done';
  await task.save();
  res.json({ task });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const task = await findOwnedTask(req.userId as string, req.params.id);
  await task.deleteOne();
  res.status(204).end();
});
```

Import `updateTaskSchema`. Routes:

```ts
tasksRouter.put('/:id', updateTask);
tasksRouter.patch('/:id/complete', completeTask);
tasksRouter.delete('/:id', deleteTask);
```

- [ ] **Step 4: Run to verify pass** — `npm test` green.
- [ ] **Step 5: Commit** — `feat: task update, delete, complete`

---

### Task 6: List with filters, search, sort, pagination

**Files:**
- Modify: `src/controllers/tasks.ts`, `src/routes/tasks.ts`
- Test: `tests/tasks.list.test.ts`

**Interfaces:**
- Consumes: `listTasksSchema`.
- Produces: `GET /api/tasks` → `{tasks, total, page, totalPages}`. Single aggregation with `$facet`; priority sorts semantically via rank low=0 < medium=1 < high=2 (`$indexOfArray`); stable tiebreak on `_id`.

- [ ] **Step 1: Write the failing tests**

`tests/tasks.list.test.ts`:

```ts
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

  it('rejects bad params and never leaks other users\' tasks', async () => {
    expect((await list({ limit: 999 })).status).toBe(400);
    const other = await signupUser(app);
    expect((await list({}, other.token)).body.total).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — GET / not registered → 404.

- [ ] **Step 3: Implement** (add to `src/controllers/tasks.ts`)

```ts
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listTasks = asyncHandler(async (req, res) => {
  const q = listTasksSchema.parse(req.query);
  const match: Record<string, unknown> = { userId: new Types.ObjectId(req.userId) };
  if (q.status) match.status = q.status;
  if (q.priority) match.priority = q.priority;
  if (q.search) match.title = { $regex: escapeRegex(q.search), $options: 'i' };

  const sortField = q.sortBy === 'priority' ? 'priorityRank' : q.sortBy;
  const order = q.order === 'asc' ? 1 : -1;

  const [result] = await Task.aggregate([
    { $match: match },
    { $addFields: { priorityRank: { $indexOfArray: [['low', 'medium', 'high'], '$priority'] } } },
    { $sort: { [sortField]: order, _id: 1 } },
    {
      $facet: {
        tasks: [
          { $skip: (q.page - 1) * q.limit },
          { $limit: q.limit },
          { $project: { priorityRank: 0 } },
        ],
        meta: [{ $count: 'total' }],
      },
    },
  ]);

  const total: number = result.meta[0]?.total ?? 0;
  res.json({ tasks: result.tasks, total, page: q.page, totalPages: Math.ceil(total / q.limit) });
});
```

Import `listTasksSchema`. Route (before `/:id` routes is not required for `GET /`, but keep it first for readability):

```ts
tasksRouter.get('/', listTasks);
```

- [ ] **Step 4: Run to verify pass** — `npm test` green. dueDate asc: tasks with `dueDate: null` sort first ascending (BSON null < Date) — the test only asserts relative order of dated tasks, and the frontend surfaces missing dates as "No due date".
- [ ] **Step 5: Commit** — `feat: task list with filtering, search, sorting, pagination`

---

### Task 7: Stats endpoint

**Files:**
- Modify: `src/controllers/tasks.ts`, `src/routes/tasks.ts`
- Test: `tests/tasks.stats.test.ts`

**Interfaces:**
- Produces: `GET /api/tasks/stats` → `{total, byStatus: {todo, in_progress, done}, completed, pending, completionPercentage, overdue}`. MUST be registered before `/:id` (else "stats" is parsed as an id).

- [ ] **Step 1: Write the failing tests**

`tests/tasks.stats.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure** — `/stats` hits `/:id` → 404.

- [ ] **Step 3: Implement** (add to `src/controllers/tasks.ts`)

```ts
export const taskStats = asyncHandler(async (req, res) => {
  const [row] = await Task.aggregate([
    { $match: { userId: new Types.ObjectId(req.userId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$dueDate', null] },
                  { $lt: ['$dueDate', '$$NOW'] },
                  { $ne: ['$status', 'done'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const total = row?.total ?? 0;
  const done = row?.done ?? 0;
  res.json({
    total,
    byStatus: { todo: row?.todo ?? 0, in_progress: row?.inProgress ?? 0, done },
    completed: done,
    pending: total - done,
    completionPercentage: total === 0 ? 0 : Math.round((done / total) * 100),
    overdue: row?.overdue ?? 0,
  });
});
```

Route — insert ABOVE the `/:id` routes in `src/routes/tasks.ts`:

```ts
tasksRouter.get('/stats', taskStats);
```

- [ ] **Step 4: Run to verify pass** — full `npm test` green.
- [ ] **Step 5: Commit** — `feat: task stats aggregation endpoint`

---

### Task 8: README and final verification

**Files:**
- Create: `README.md`

**Interfaces:** none — documentation and verification only.

- [ ] **Step 1: Write README.md** covering, in this order:
  1. **Setup steps**: prerequisites (Node 20+, Docker), `docker compose up -d` for Mongo, `cp .env.example .env`, `npm install`, `npm run dev`, `npm test`.
  2. **API endpoints**: a table of all 10 endpoints (method, path, auth?, body/query params, response shape) matching the implemented behavior exactly — copy shapes from the tests, not from memory.
  3. **Design decisions**: layered routes→controllers→models; JWT stateless auth with bcrypt; Zod parsing with central ZodError mapping; consistent `{error:{message,code}}` shape; 404-not-403 for foreign tasks (avoids existence leaks); single-aggregation list with `$facet` and semantic priority rank; compound indexes `{userId,status}` / `{userId,dueDate}` (text index present; regex chosen for substring UX at this scale); mongodb-memory-server for hermetic tests.
- [ ] **Step 2: Full verification** — `npm test` (all suites green) and `npm run build` (clean). If Docker is available: `docker compose up -d`, `npm run dev`, curl signup → create task → list → stats, then stop.
- [ ] **Step 3: Commit** — `docs: backend README with setup, API reference, design decisions`

---

## Self-Review Notes

- Spec coverage: signup/login/me (T2–T3), CRUD + complete (T4–T5), filters/search/sort/pagination (T6), stats incl. overdue (T7), error middleware + shapes (T1, exercised throughout), indexes (T4), docker-compose + env (T1), README (T8). No gaps.
- Route-order hazard (`/stats` vs `/:id`) called out in both T4 and T7.
- Types consistent: `signupUser` return shape used in T3–T7 matches T2 definition; `findOwnedTask` signature stable across T4–T5.
