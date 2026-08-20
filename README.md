# Task Tracker — Backend

REST API for the Task Tracker app: JWT authentication, owner-scoped task CRUD, filtering/search/sorting/pagination, and an analytics endpoint. Built with Node.js, Express 5, TypeScript, and MongoDB (Mongoose 9).

Frontend lives in the sibling repo `task-tracker-frontend`.

## GitHub

To publish the project on GitHub, push both repositories separately:

- Backend: this repo
- Frontend: the sibling `task-tracker-frontend` repo

## Setup

Prerequisites: Node 20+, Docker (for MongoDB).

```bash
docker compose up -d          # starts MongoDB on localhost:27017
cp .env.example .env          # PORT, MONGO_URI, JWT_SECRET
npm install
npm run dev                   # API on http://localhost:4000
```

Tests need no running MongoDB — they use an in-memory server:

```bash
npm test
```

Production build: `npm run build && npm start`.

## Render

This repo includes a `render.yaml` blueprint for deploying the API as a Render web service.

Required environment variables on Render:

- `MONGO_URI` pointing to a reachable MongoDB instance
- `JWT_SECRET` set to a strong secret

Health check path: `/api/health`

## API

Base URL: `http://localhost:4000/api`. Authenticated routes require `Authorization: Bearer <token>`.

All errors share one shape: `{ "error": { "message": "...", "code": "..." } }` (validation errors add a `details` array of `{path, message}`).

### Auth

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/auth/signup` | — | `{name, email, password}` (password ≥ 8 chars) | `201 {token, user}` · `409 EMAIL_TAKEN` |
| POST | `/auth/login` | — | `{email, password}` | `200 {token, user}` · `401 INVALID_CREDENTIALS` |
| GET | `/auth/me` | ✓ | — | `200 {user}` |

`user` is `{id, name, email}`. Tokens are JWTs (`{sub: userId}`, 7-day expiry).

### Tasks

Task shape: `{_id, title, description, status, priority, dueDate, createdAt, updatedAt}` with `status ∈ todo|in_progress|done`, `priority ∈ low|medium|high`, `dueDate` an ISO date or `null`.

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/tasks` | ✓ | query: `status`, `priority`, `search`, `sortBy=dueDate\|priority\|createdAt`, `order=asc\|desc`, `page` (≥1), `limit` (1–50) | `200 {tasks, total, page, totalPages}` |
| POST | `/tasks` | ✓ | `{title, description?, status?, priority?, dueDate?}` | `201 {task}` |
| GET | `/tasks/stats` | ✓ | — | `200 {total, byStatus, completed, pending, completionPercentage, overdue}` |
| GET | `/tasks/:id` | ✓ | — | `200 {task}` · `404 TASK_NOT_FOUND` |
| PUT | `/tasks/:id` | ✓ | any subset of task fields; `dueDate: null` clears it | `200 {task}` |
| PATCH | `/tasks/:id/complete` | ✓ | — | `200 {task}` (status set to `done`) |
| DELETE | `/tasks/:id` | ✓ | — | `204` |

List defaults: `sortBy=createdAt`, `order=desc`, `page=1`, `limit=10`. `search` is a case-insensitive substring match on title. Priority sorts semantically (low < medium < high), not alphabetically. `overdue` counts tasks with `dueDate` in the past and status ≠ done; `pending` = total − done.

## Design decisions

- **Layered layout** — `routes → controllers → models`, with middleware for auth and a single global error handler. Controllers parse input with Zod; `ZodError` and `ApiError` are mapped centrally to the one error shape.
- **Stateless JWT auth** — bcrypt-hashed passwords, `{sub: userId}` tokens, `requireAuth` middleware sets `req.userId`. Login returns the same 401 for unknown email and wrong password to avoid account enumeration.
- **404, not 403, for foreign tasks** — asking for another user's task (or an invalid/missing id) always yields `TASK_NOT_FOUND`, so the API never leaks which ids exist.
- **Single-aggregation list** — one pipeline with `$facet` returns the page and total count together; a computed `priorityRank` (`$indexOfArray`) makes priority sorting semantic; `_id` tiebreak keeps pagination stable. Stats are likewise one `$group` pass.
- **Indexes** — `{userId, status}` and `{userId, dueDate}` compound indexes match the list access patterns (every query is userId-scoped first). A text index exists on `title`, but search uses an escaped case-insensitive regex for substring UX at this data scale.
- **Hermetic tests** — Jest + Supertest against `mongodb-memory-server`: 30 tests covering auth flows, CRUD, ownership isolation, filter/search/sort/pagination, and stats, with no external dependencies.
