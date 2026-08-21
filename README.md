# Task Tracker - Backend

Task Tracker - Backend is a REST API for the Task Tracker app. It uses Node.js, Express 5, TypeScript, MongoDB, Mongoose, JWT authentication, and Jest/Supertest for testing. The server entrypoint is [src/server.ts](src/server.ts), which reads configuration from environment variables and connects to MongoDB through `config.mongoUri`.

## Backend Setup & Deployment

This section explains how to set up, run, test, and deploy the backend from scratch on Windows.

### Project Details

- Project: Task Tracker - Backend
- Tech stack: Node.js, Express 5, TypeScript, MongoDB, Mongoose, JWT authentication, Jest/Supertest, Render, MongoDB Atlas
- Repository structure:
  - `src/`
  - `tests/`
  - `package.json`
  - `package-lock.json`
  - `tsconfig.json`
  - `jest.config.js`
  - `docker-compose.yml`

### Environment Variables

The backend reads these values from `process.env` through [src/config.ts](src/config.ts):

```dotenv
PORT=4000
MONGO_URI=mongodb://localhost:27017/task_tracker
JWT_SECRET=change-this-to-a-strong-secret
```

For MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string.

Important:

- Do not commit `.env` to GitHub.
- Keep `.env` in `.gitignore`.
- Never expose `JWT_SECRET` or MongoDB credentials in screenshots, logs, or public code.

### Local Setup From Scratch

1. Install Node.js 20 or later.
2. Clone the repository.
3. Open the backend folder in PowerShell.
4. Install dependencies:

```powershell
npm install
```

5. Create a `.env` file in the backend root.
6. Add the environment variables shown above.
7. Make sure MongoDB is running locally, or use MongoDB Atlas.

   If you want local MongoDB with Docker, start the bundled service:

```powershell
docker compose up -d
```

8. Start the development server using the actual dev script:

```powershell
npm run dev
```

9. Verify the backend is running at `http://localhost:4000`.
10. Test the health endpoint:

```powershell
curl.exe http://localhost:4000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "task-tracker-backend"
}
```

The root URL also returns the same service status:

```powershell
curl.exe http://localhost:4000/
```

### MongoDB Atlas Setup

If you use MongoDB Atlas instead of local MongoDB:

1. Create a MongoDB Atlas project.
2. Create a database cluster.
3. Create a database user.
4. Copy the MongoDB connection string from Atlas.
5. Replace the username and password with your Atlas user credentials.
6. Put the connection string in `MONGO_URI`.
7. Open MongoDB Atlas, go to Network Access, then IP Access List.
8. For development or testing, add your current IP address.
9. If you need a quick temporary test for Render, `0.0.0.0/0` can be used, but it is less secure and should be restricted for production when possible.
10. Confirm the MongoDB user has permission to read and write the target database.

If your Atlas password contains special characters, URL-encode them before placing the connection string in `MONGO_URI`.

### Running and Testing Locally

The project uses Jest and Supertest for API testing. You can run the full test suite with:

```powershell
npm test
```

You can also build the TypeScript project and run the production entrypoint locally:

```powershell
npm run build
npm start
```

### Browser, Postman, Thunder Client, and curl

#### Browser

Open this URL in your browser for a quick health check:

```text
http://localhost:4000/api/health
```

#### Postman or Thunder Client

- Use `Content-Type: application/json` for POST and PUT requests.
- Add `Authorization: Bearer <JWT_TOKEN>` for authenticated endpoints.
- Paste the JSON bodies shown in the API examples below.

#### curl examples

Use `curl.exe` in PowerShell so you do not hit the PowerShell `curl` alias. One example is shown below; use the same pattern for the other routes in Postman, Thunder Client, or curl.

### API Reference

Base URL for local development:

```text
http://localhost:4000/api
```

Authenticated routes require:

```http
Authorization: Bearer <JWT_TOKEN>
```

#### Health Check

`GET /api/health`

No authentication required.

Example:

```powershell
curl.exe http://localhost:4000/api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

#### Auth Routes

The auth router is mounted at `/api/auth`.

| Method | Endpoint | Auth | Request Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/signup` | No | `{ "name": "...", "email": "...", "password": "..." }` | `201 { token, user }` |
| POST | `/api/auth/login` | No | `{ "email": "...", "password": "..." }` | `200 { token, user }` |
| GET | `/api/auth/me` | Yes | None | `200 { user }` |

Signup body rules:

- `name` is required, trimmed, 1-100 characters
- `email` is required, trimmed, lowercased, valid email format
- `password` is required, 8-100 characters

Login body rules:

- `email` is required and must be a valid email
- `password` is required and cannot be empty

`GET /api/auth/me` returns:

```json
{
  "user": {
    "id": "665f00000000000000000001",
    "name": "Ani",
    "email": "ani@example.com"
  }
}
```

Example signup request:

```powershell
curl.exe -X POST http://localhost:4000/api/auth/signup ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Ani\",\"email\":\"ani@example.com\",\"password\":\"password123\"}"
```

#### Task Routes

The tasks router is mounted at `/api/tasks` and requires authentication for every route.

| Method | Endpoint | Auth | Request Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/tasks` | Yes | Query: `status`, `priority`, `search`, `sortBy`, `order`, `page`, `limit` | `200 { tasks, total, page, totalPages }` |
| POST | `/api/tasks` | Yes | `{ "title": "...", "description"?: "...", "status"?: "todo\|in_progress\|done", "priority"?: "low\|medium\|high", "dueDate"?: ISO date string or null }` | `201 { task }` |
| GET | `/api/tasks/stats` | Yes | None | `200 { total, byStatus, completed, pending, completionPercentage, overdue }` |
| GET | `/api/tasks/:id` | Yes | Path parameter `id` | `200 { task }` |
| PUT | `/api/tasks/:id` | Yes | Any subset of create-task fields | `200 { task }` |
| PATCH | `/api/tasks/:id/complete` | Yes | None | `200 { task }` |
| DELETE | `/api/tasks/:id` | Yes | Path parameter `id` | `204 No Content` |

Task validation rules:

- `title` is required, trimmed, 1-200 characters
- `description` is optional, trimmed, up to 2000 characters
- `status` must be `todo`, `in_progress`, or `done`
- `priority` must be `low`, `medium`, or `high`
- `dueDate` can be omitted, an ISO date string, or `null`

Task list query rules:

- `status` filters by status
- `priority` filters by priority
- `search` performs a case-insensitive substring match on `title`
- `sortBy` accepts `dueDate`, `priority`, or `createdAt`
- `order` accepts `asc` or `desc`
- `page` must be 1 or greater
- `limit` must be between 1 and 50

Task list response example:

```json
{
  "tasks": [],
  "total": 0,
  "page": 1,
  "totalPages": 0
}
```

Task stats response example:

```json
{
  "total": 4,
  "byStatus": {
    "todo": 1,
    "in_progress": 1,
    "done": 2
  },
  "completed": 2,
  "pending": 2,
  "completionPercentage": 50,
  "overdue": 1
}
```

Example task request:

```powershell
curl.exe -X POST http://localhost:4000/api/tasks ^
  -H "Authorization: Bearer <JWT_TOKEN>" ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Write plan\",\"description\":\"Draft the rollout\",\"status\":\"todo\",\"priority\":\"medium\",\"dueDate\":\"2026-09-01T00:00:00.000Z\"}"
```

### Error Format

Errors use a consistent response shape:

```json
{
  "error": {
    "message": "Invalid credentials",
    "code": "INVALID_CREDENTIALS"
  }
}
```

Validation errors include a `details` array with field-level information.

Common auth and task errors:

- `UNAUTHENTICATED` for missing, invalid, or expired JWTs
- `INVALID_CREDENTIALS` for bad login attempts
- `EMAIL_TAKEN` for duplicate signup emails
- `TASK_NOT_FOUND` for invalid, missing, or foreign task IDs
- `VALIDATION_ERROR` for Zod validation failures

### Production Deployment on Render

This backend is ready for Render deployment.

1. Push the backend repository to GitHub.
2. In Render, create a new Web Service.
3. Connect the GitHub repository.
4. Select the correct branch, usually `main`.
5. Set the service type to Node.
6. Use the build command from `package.json`:

```text
npm install && npm run build
```

7. Use the start command from `package.json`:

```text
npm start
```

8. Add these Render environment variables:

- `MONGO_URI`
- `JWT_SECRET`
- `PORT`

Render provides `PORT` automatically. The application should read `process.env.PORT` rather than hard-coding a production port.

9. Deploy the service.

The Render service URL will look similar to this:

```text
https://<service-name>.onrender.com
```

The health endpoint will be:

```text
https://<service-name>.onrender.com/api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "task-tracker-backend"
}
```

Render free instances can spin down after inactivity, so the first request may take longer than usual.

### Frontend Integration

The frontend should point to the backend with:

```dotenv
VITE_API_URL=https://<render-service>.onrender.com/api
```

For local development:

```dotenv
VITE_API_URL=http://localhost:4000/api
```

Do not add a trailing slash after `/api` unless the frontend code specifically expects it.

If you change `.env` in a Vite frontend, restart the frontend dev server.

### Security

- Never commit `.env`.
- Never expose `JWT_SECRET`.
- Never expose MongoDB credentials.
- Use a strong production `JWT_SECRET`.
- Restrict MongoDB Atlas network access where practical.
- Use HTTPS in production.
- Do not reuse development secrets in production.

### Troubleshooting

#### `npm install` errors

- Confirm you are using Node.js 20 or later.
- Delete `node_modules` and reinstall if the dependency tree becomes inconsistent.
- Make sure you are running the command from the backend root.

#### MongoDB connection errors

- Check `MONGO_URI` in `.env` or in Render environment variables.
- Confirm MongoDB is running locally if you are not using Atlas.
- For Atlas, verify the database user, password, and URL encoding.
- Check Atlas Network Access.

#### Port already in use

- Another process is already using the port in `PORT`.
- Stop the other process or change the local `PORT` value.

#### `401 Unauthorized`

- The request is missing `Authorization: Bearer <JWT_TOKEN>`.
- The token is invalid or expired.
- The login token was not copied correctly.

#### `403 Forbidden`

- This backend normally returns `401` or `404` for auth and ownership problems.
- If you see `403`, check the frontend, proxy, or hosting layer that sits in front of the API.

#### CORS errors

- The backend enables CORS globally with `cors()`.
- Make sure the frontend is calling the correct API base URL.
- Check for browser cache or old frontend environment variables.

#### Render `502 Bad Gateway`

1. Open Render and view the Logs page.
2. Check the latest deploy and application logs.
3. Look for MongoDB connection errors.
4. If you see `ReplicaSetNoPrimary` or connection timeout errors, check MongoDB Atlas Network Access.
5. Verify `MONGO_URI` in Render environment variables.
6. Verify the database username and password.
7. Verify special characters in the password are URL encoded.
8. Confirm the latest Git commit was deployed.
9. Confirm the service is actually running.
10. Test `https://<service-name>.onrender.com/api/health`.

#### Render service not starting

- Confirm the build command is `npm install && npm run build`.
- Confirm the start command is `npm start`.
- Confirm the service type is Node.
- Confirm Render can reach the GitHub repository.

#### Frontend network errors

- Confirm `VITE_API_URL` points to the backend API.
- For local dev, use `http://localhost:4000/api`.
- For production, use the Render service URL with `/api` at the end.

#### Health endpoint works but signup/login fails

- Check `JWT_SECRET`.
- Check `MONGO_URI`.
- Confirm the MongoDB user can read and write the database.
- Confirm the request body fields match the API exactly.

## GitHub Submission Note

If you are submitting the full project, push both repositories to GitHub:

- Backend: this repository
- Frontend: the separate frontend repository

## Design Decisions

- The API uses a layered structure with routes, controllers, middleware, and models.
- JWT authentication is stateless and user-scoped.
- Task ownership is enforced for every task operation.
- Filtering, sorting, pagination, and analytics are centralized and tested.
- MongoDB indexes support the user-scoped task queries used by the list and stats endpoints.
- Jest and Supertest run against an in-memory MongoDB server, so tests do not require a real database.