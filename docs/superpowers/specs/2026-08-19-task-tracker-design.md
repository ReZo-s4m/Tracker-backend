# Task Tracker — Design Spec

Date: 2026-08-19
Status: Approved

## Objective

A Task Tracker web app (full-stack assignment): users sign up, manage their own tasks, filter/search/sort them, and see analytics. Two repos: `task-tracker-backend` (Node.js + Express + MongoDB) and `task-tracker-frontend` (React 18 + TypeScript + Vite).

## Decisions

- Frontend: React 18 + TypeScript + Vite, CSS modules (no UI library)
- Backend: Node.js + Express + TypeScript + Mongoose
- Database: MongoDB via Docker (`docker-compose.yml` in backend repo)
- Repos: two separate repos, each with its own README and `.env.example`
- Scope: full — core requirements plus pagination, sorting, dark mode, charts, global error middleware, Mongo indexes
- Architecture: pragmatic layered backend (`routes → controllers → models` + middleware); React Query + small contexts on the frontend. No Redux, no refresh tokens, no service layer.

## Backend

### Models

- `User`: `email` (unique, indexed, lowercase), `passwordHash` (bcrypt, cost 10), `name`, timestamps.
- `Task`: `userId` (ref User, required), `title` (required, trimmed, max 200), `description` (optional, max 2000), `status` (`todo | in_progress | done`, default `todo`), `priority` (`low | medium | high`, default `medium`), `dueDate` (optional Date), timestamps.

Indexes: `{userId: 1, status: 1}`, `{userId: 1, dueDate: 1}`, text index on `title`. Every task query is scoped by `userId` first.

### API

Base path `/api`. Auth via `Authorization: Bearer <JWT>`; JWT signed with `JWT_SECRET`, 7-day expiry, payload `{sub: userId}`.

Auth:
- `POST /api/auth/signup` — `{name, email, password}` → `201 {token, user}`. Zod validation: email format, password ≥ 8 chars, name non-empty. Duplicate email → 409.
- `POST /api/auth/login` — `{email, password}` → `200 {token, user}`. Bad credentials → 401 (same message for unknown email vs wrong password).
- `GET /api/auth/me` — → `200 {user}` (requires auth).

Tasks (all require auth; a task belonging to another user → 404):
- `GET /api/tasks` — query params `status`, `priority`, `search` (title substring/text), `sortBy` (`dueDate | priority | createdAt`, default `createdAt`), `order` (`asc | desc`, default `desc`), `page` (default 1), `limit` (default 10, max 50). Returns `{tasks, total, page, totalPages}`. Priority sort uses aggregation-mapped rank (low=1, medium=2, high=3) so it sorts semantically, not alphabetically.
- `POST /api/tasks` — create → 201.
- `GET /api/tasks/:id`, `PUT /api/tasks/:id`, `DELETE /api/tasks/:id`.
- `PATCH /api/tasks/:id/complete` — sets `status: done`.
- `GET /api/tasks/stats` — single aggregation → `{total, byStatus: {todo, in_progress, done}, completed, pending, completionPercentage, overdue}`. `pending` = total − done; `overdue` = dueDate < now and status ≠ done.

### Errors

`ApiError` class (statusCode, message, code) + global error middleware. All errors return `{error: {message, code}}`; Zod validation errors → 400 with per-field details; unknown routes → 404; unexpected errors → 500 with generic message (details logged server-side only). Invalid ObjectId → 404, not 500.

## Frontend

### Pages & routing

- `/login`, `/signup` — public; redirect to `/` if already authenticated.
- `/` — Dashboard, protected route. Analytics section (stat cards: total, completed, pending, completion %; Recharts pie or bar for status breakdown) above the task list.

### Task list

Filter bar (status select, priority select, debounced title search), sort dropdown (due date / priority / created, asc/desc), pagination controls. Task cards show title, description, status badge, priority badge, due date (overdue highlighted); inline complete-toggle, edit (modal form), delete (confirm dialog). Create task via the same modal form.

### State

- React Query for all server state; mutations invalidate `tasks` and `stats` queries.
- `AuthContext`: token in localStorage, axios instance with auth interceptor; 401 response → clear token, redirect to `/login`.
- `ThemeContext`: dark mode via CSS variables on `data-theme` attribute, persisted to localStorage, defaults to system preference.

### UX states

Loading skeletons, error banners with retry, empty states ("No tasks yet" / "No tasks match your filters"). Responsive layout (single column on mobile).

## Testing

- Backend: Jest + Supertest + `mongodb-memory-server`. Coverage: signup/login/me happy paths and validation failures, task CRUD, ownership isolation (user B cannot read/update/delete user A's task), filtering/search/sort/pagination, stats aggregation, error shapes.
- Frontend: Vitest + React Testing Library on the task form (validation, submit) and filter bar (param wiring). 
- Manual E2E pass against the running stack before submission.

## Deliverables

- Both repos pushed to GitHub.
- Backend README: setup steps (Docker Mongo, env, run, test), full API endpoint table, design decisions.
- Frontend README: setup steps, screens, design decisions.
