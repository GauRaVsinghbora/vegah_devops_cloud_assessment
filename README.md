# SmartURL — URL Shortener & Analytics

SmartURL is a full-stack short-link service with authenticated link management, fast redirects, and click analytics. The frontend is a responsive Next.js/React application; the NestJS REST API uses MySQL for account/link ownership, Redis for caching and rate limiting, and MongoDB for click events.

## Features

- Email/password registration and login with salted scrypt password hashes and signed HS256 JWTs.
- Protected URL management: create random or custom short codes, search, disable/re-enable, and delete links.
- Cache-first redirects with Redis TTL and cache invalidation when a URL is disabled or deleted.
- MongoDB analytics for clicks over time, popular links, browser/device breakdown, referrers, and recent activity.
- No raw IP address is written to MongoDB. Redirect rate-limit keys use a short-lived hash; country is not collected because geolocation is not configured.
- Responsive landing, authentication, dashboard, URL list, and per-link analytics pages, including loading, empty, and error states.
- Docker Compose development environment, health checks, persistent data volumes, and multi-stage non-root application images.

## Technology and structure

```text
.
├── backend/
│   ├── prisma/                 # MySQL schema and migrations
│   ├── src/auth/               # Registration, login, JWT verification/guard
│   ├── src/urls/               # Link management and cache-first redirects
│   ├── src/analytics/          # MongoDB aggregation endpoints
│   ├── src/redis/              # Redis client and rate limiting
│   ├── src/mongo/              # MongoDB client and click_events collection
│   └── test/                   # Unit and service integration tests
├── frontend/
│   ├── app/                    # Next.js routes
│   ├── components/             # SmartURL pages and dashboard UI
│   └── lib/api.ts              # Typed REST client
├── .github/workflows/ci.yml    # Build, lint, test, integration, and image checks
├── docker-compose.yml
└── .env.example
```

### Architecture

```text
Browser ── HTTPS ──> Next.js frontend (Vercel or Docker)
  │                         │ REST + Bearer JWT
  └── short link ───────────┴──> NestJS API (container host)
                                     ├── MySQL: users, URLs, ownership/status
                                     ├── Redis: short-code mapping cache, TTL, rate limits
                                     └── MongoDB: click_events and analytics aggregation
```

### Database responsibilities

- **MySQL / Prisma:** `User` and `Url` tables. URLs have a unique short code, owner foreign key, status, timestamps, and indexes for owner/date and status/code. Deleting a user cascades to their URL records.
- **Redis / ioredis:** redirects first read `short-url:<code>`. A miss queries MySQL and caches the active URL and owner for one hour. Disabling/deleting a URL evicts the mapping. Authentication and redirect rate limits use expiring Redis counters.
- **MongoDB:** the `click_events` collection stores short code, owner ID, parsed browser/OS/device, referrer, and click timestamp. Indexes support per-code and per-user analytics. Raw IP addresses and country are not stored.

### Redirect request flow

1. A visit to `/api/r/:code` is rate-limited using a short-lived hashed client-address key.
2. The API checks Redis for the short-code mapping.
3. On a cache miss, it looks up an active URL in MySQL and caches the mapping with a one-hour TTL.
4. It responds with an HTTP 302 redirect and records parsed click metadata in MongoDB.
5. Link status changes/deletion evict the Redis mapping. Click event insertion failures are logged without preventing an otherwise valid redirect.

## Run locally with Docker

Requirements: Docker Engine and the Docker Compose plugin.

```bash
cp .env.example .env
# Replace the sample local passwords and JWT secret if desired.
docker compose up --build
```

The application is at `http://localhost:3000`; the API is at `http://localhost:4000/api`. The API runs `prisma migrate deploy` before it starts. MySQL, Redis, and MongoDB are available on loopback ports `13306`, `16379`, and `27018` respectively (configurable in `.env`). Database data persists in named volumes (`mysql_data`, `redis_data`, and `mongo_data`).

Useful commands:

```bash
docker compose ps
curl http://localhost:4000/api/health
docker compose logs -f backend
docker compose down                 # Stops containers; retains data volumes
```

To clear local database contents, remove the named volumes explicitly with `docker compose down --volumes`.

## Environment variables

| Variable | Purpose |
|---|---|
| `MYSQL_PASSWORD` | MySQL application-user password |
| `MYSQL_ROOT_PASSWORD` | MySQL root password |
| `MYSQL_HOST_PORT` | Local-only MySQL port (default `13306`) |
| `REDIS_HOST_PORT` | Local-only Redis port (default `16379`) |
| `MONGODB_HOST_PORT` | Local-only MongoDB port (default `27018`) |
| `JWT_SECRET` | HS256 signing secret; use a random value of at least 32 characters |
| `TRUST_PROXY` | Express trusted proxy setting; set to the exact trusted hop count when deployed behind a proxy |
| `FRONTEND_URL` | Allowed browser origin(s), comma-separated |
| `PUBLIC_API_URL` | Public API origin used to construct shareable short links |
| `NEXT_PUBLIC_API_URL` | API base URL compiled into the browser application |
| `DATABASE_URL` | Prisma MySQL connection string (provided to the backend container) |
| `REDIS_URL` | Redis connection string (provided to the backend container) |
| `MONGODB_URI` | MongoDB connection string (provided to the backend container) |
| `API_PORT` | Backend listen port; defaults to `4000` |

Never use the sample credentials in production. Keep database credentials and `JWT_SECRET` in the backend hosting provider's secret manager. Only the public API origin belongs in `NEXT_PUBLIC_API_URL`.

## Local development without the frontend/backend containers

Run the databases from Compose, then run each application in its own terminal:

```bash
docker compose up -d mysql redis mongodb
```

Copy `.env.example` to `.env`; its local connection strings use the Compose host ports `13306`, `16379`, and `27018`. Generate the Prisma client, apply migrations, and start the API:

```bash
cd backend
npm ci
npx prisma migrate deploy
npm run prisma:generate
npm run start:dev
```

In another terminal, set `NEXT_PUBLIC_API_URL=http://localhost:4000/api` and run:

```bash
cd frontend
npm ci
npm run dev
```

Use Node.js 24 LTS for local development. For normal local use, Docker Compose is the simplest fully configured path.

The backend uses Prisma ORM 7 with a generated CommonJS client and the MariaDB driver adapter. `DATABASE_URL` remains the MySQL connection string used by both the Prisma CLI and backend. Prisma 7 does not generate a client automatically after `prisma migrate dev`; run `npm run prisma:generate` after migration or schema changes. For TLS connections, use `sslaccept=strict` and mount any certificate files referenced by `sslcert` or `sslidentity` into the backend runtime.

## REST API

All API routes are under `/api`. Protected routes require `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | MySQL, Redis, and MongoDB readiness |
| `POST` | `/auth/register` | Register `{ "email": "...", "password": "..." }` |
| `POST` | `/auth/login` | Login with the same credential body |
| `POST` | `/urls` | Create `{ "originalUrl": "https://...", "customCode": "optional" }` |
| `GET` | `/urls?search=...` | List/search the signed-in user's URLs and click counts |
| `PATCH` | `/urls/:id` | Set `{ "status": "ACTIVE" }` or `"DISABLED"` |
| `DELETE` | `/urls/:id` | Permanently delete a link |
| `GET` | `/r/:code` | Record a click and redirect to the active destination |
| `GET` | `/analytics` | User-level totals, popular URLs, activity, and breakdowns |
| `GET` | `/analytics/:urlId` | Per-link click analytics and recent events |

Short links returned by the API have the form `${PUBLIC_API_URL}/api/r/:code`. URL validation allows only HTTP and HTTPS destinations. Custom codes are 3–16 letters, numbers, underscores, or hyphens; uniqueness is enforced in MySQL.

## Tests and checks

```bash
npm run lint --prefix backend
npm run typecheck --prefix backend
npm test --prefix backend
npm run build --prefix backend

npm run lint --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

The backend integration test exercises actual MySQL, Redis, and MongoDB services. Start them with Compose, apply the checked-in migrations to the database, and run:

```bash
cd backend
npm run prisma:generate
npx prisma migrate deploy
npm run test:integration
```

## Docker and CI

`docker-compose.yml` runs frontend, backend, MySQL, Redis, and MongoDB on a private Compose network. Database services use named persistent volumes and health checks; the backend/frontend images use multi-stage builds and run as non-root users.

GitHub Actions runs on every push and pull request. It installs Node.js 24 dependencies, lints and type-checks each app, runs backend unit and database integration tests with MySQL/Redis/MongoDB service containers, builds both apps, and builds both Docker images. No deployment credentials are required by the CI workflow.

## Git workflow

Recommended branch flow:

- `main`: reviewed, stable releases.
- `develop`: integration branch.
- `feature/authentication`, `feature/url-shortening`, `feature/redis-cache`, `feature/mongodb-analytics`, `feature/docker`, and `feature/ci-cd`: focused changes merged through pull requests.

This workspace was provided without a Git repository, so no branches, commits, or pull requests have been created here. Initialize/connect a repository before using the branch workflow.

## Deployment architecture

- **Frontend:** import the repository into Vercel and set the project root to `frontend`. `frontend/vercel.json` configures the Next.js framework, build, and install commands. Configure `NEXT_PUBLIC_API_URL` to the deployed API base URL, e.g. `https://api.example.com/api`.
- **Backend:** deploy the backend Docker image to a container platform that supports long-running services (for example, Fly.io, Render, or ECS). Configure `DATABASE_URL`, `REDIS_URL`, `MONGODB_URI`, `JWT_SECRET`, `PUBLIC_API_URL`, and `FRONTEND_URL` as backend secrets/environment variables. The platform must provide persistent MySQL, Redis, and MongoDB-compatible services or managed databases.
- **CORS:** set `FRONTEND_URL` to the exact Vercel production origin; comma-separated origins can be used for preview environments. Enable HTTPS for all public endpoints.
- **Proxy/rate limits:** set `TRUST_PROXY` to the known proxy hop count for the backend host so per-IP limits use the client address from trusted proxy headers; do not blindly trust arbitrary forwarded headers.
- **Migrations and operations:** the backend container applies Prisma migrations before serving. Use managed database backups, restrict database network access to the backend, rotate secrets, and monitor `/api/health`.

Deployment has not been performed: no Vercel account, cloud database credentials, or hosting access was supplied. There is no live application URL yet. After configuring the services and deploying successfully, add the verified Vercel URL here.
