# Task Tracker — Backend

REST API for the Task Tracker app with JWT authentication, owner-scoped task management, filtering, search, sorting, pagination, and analytics. Built with Node.js, Express 5, TypeScript, and MongoDB (Mongoose).

This backend powers the frontend project in the sibling repository and is designed for local development, testing, and deployment.

## Setup

Prerequisites:

- Node.js 20+
- MongoDB running locally or via Docker

### 1. Start MongoDB

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file using the sample values from `.env.example`:

```bash
PORT=4000
MONGO_URI=mongodb://localhost:27017/task-tracker
JWT_SECRET=your-super-secret-key
```

### 4. Run the API

```bash
npm run dev
```

The API runs at:

```bash
http://localhost:4000/api
```

### 5. Useful commands

```bash
npm test
npm run build
npm start
```

## Render deployment

This repo includes a `render.yaml` file for deployment on Render.

Required environment variables:

- `MONGO_URI`
- `JWT_SECRET`

Health check endpoint:

```bash
/api/health
```

## API endpoints

Base URL:

```bash
http://localhost:4000/api
```

All routes requiring authentication expect a bearer token in the request header:

```http
Authorization: Bearer <token>
```

### Auth routes

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Create a new user account |
| POST | `/auth/login` | Sign in and receive a JWT |
| GET | `/auth/me` | Get the current authenticated user |

### Task routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/tasks` | Fetch paginated, filtered, and sorted tasks |
| POST | `/tasks` | Create a new task |
| GET | `/tasks/stats` | Fetch task analytics and summary values |
| GET | `/tasks/:id` | Get a single task by ID |
| PUT | `/tasks/:id` | Update a task |
| PATCH | `/tasks/:id/complete` | Mark a task as complete |
| DELETE | `/tasks/:id` | Delete a task |

### Task payloads

A task contains fields such as:

```json
{
  "title": "Finish resume",
  "description": "Update projects and skills section",
  "status": "in_progress",
  "priority": "medium",
  "dueDate": "2026-08-22"
}
```

Supported status values:

- `todo`
- `in_progress`
- `done`

Supported priority values:

- `low`
- `medium`
- `high`

## Error format

API errors are returned in a consistent format:

```json
{
  "error": {
    "message": "Invalid credentials",
    "code": "INVALID_CREDENTIALS"
  }
}
```

Validation errors include a `details` array with field-specific messages.

## Design decisions

- The backend uses a layered architecture: routes, controllers, services, and models, making the code easier to test and extend.
- JWT authentication is stateless and user-scoped, so each request is validated against the token without storing session data on the server.
- Task ownership is enforced for every task operation to prevent cross-user access.
- Query logic is centralized so filtering, sorting, and pagination are consistent across list and analytics requests.
- MongoDB indexes are used on user-scoped task queries to keep list and stats queries efficient.
- Tests run with an in-memory MongoDB instance so the API can be validated without external infrastructure.

## Notes

- This API is intentionally simple and production-friendly for a personal task manager.
- Frontend authentication is handled by storing the JWT client-side and attaching it to authenticated request

- **Layered layout** — `routes → controllers → models`, with middleware for auth and a single global error handler. Controllers parse input with Zod; `ZodError` and `ApiError` are mapped centrally to the one error shape.
- **Stateless JWT auth** — bcrypt-hashed passwords, `{sub: userId}` tokens, `requireAuth` middleware sets `req.userId`. Login returns the same 401 for unknown email and wrong password to avoid account enumeration.
- **404, not 403, for foreign tasks** — asking for another user's task (or an invalid/missing id) always yields `TASK_NOT_FOUND`, so the API never leaks which ids exist.
- **Single-aggregation list** — one pipeline with `$facet` returns the page and total count together; a computed `priorityRank` (`$indexOfArray`) makes priority sorting semantic; `_id` tiebreak keeps pagination stable. Stats are likewise one `$group` pass.
- **Indexes** — `{userId, status}` and `{userId, dueDate}` compound indexes match the list access patterns (every query is userId-scoped first). A text index exists on `title`, but search uses an escaped case-insensitive regex for substring UX at this data scale.
- **Hermetic tests** — Jest + Supertest against `mongodb-memory-server`: 30 tests covering auth flows, CRUD, ownership isolation, filter/search/sort/pagination, and stats, with no external dependencies.
