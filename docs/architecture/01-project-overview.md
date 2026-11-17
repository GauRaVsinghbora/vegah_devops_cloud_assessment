# SmartURL — Project Overview

## What it does

SmartURL is an authenticated URL-shortening and click-analytics application. A signed-in user can create a random or custom short code, list and search links, disable or re-enable a link, delete a link, and view aggregate or per-link click analytics. The unauthenticated redirect endpoint resolves active codes and returns HTTP 302.

The application name is supported by the frontend metadata and UI (`frontend/app/layout.tsx`, `frontend/components/smarturl.tsx`). This checkout's GitHub repository is named `GauRaVsinghbora/vegah_devops_cloud_assessment`; its root package and backend package are named `smarturl` and `smarturl-backend`.

## Implemented stack

| Area | Source-backed implementation |
|---|---|
| Browser UI | Next.js App Router, React, TypeScript, Tailwind CSS, Lucide React |
| API | NestJS 11, TypeScript, REST over Express |
| Relational data | MySQL-compatible database accessed with Prisma 7 and `@prisma/adapter-mariadb` |
| Cache and request limits | Redis accessed with ioredis |
| Click events | MongoDB accessed with the official Node.js driver |
| Local orchestration | Docker Compose services for MySQL, Redis, MongoDB, backend, and frontend |
| CI | GitHub Actions build, lint, type-check, tests, and Docker image builds |

## Main capabilities

- Registration and login using email/password, scrypt password hashes, and signed HS256 tokens (`backend/src/auth/auth.service.ts`).
- Ownership-scoped URL management, custom-code validation, active/disabled status, search, and deletion (`backend/src/urls/urls.controller.ts`, `backend/src/urls/urls.service.ts`).
- Redis-first short-code lookup with a one-hour cache TTL (`UrlsService.resolve`, `cacheMapping`).
- Per-IP-hash rate limits for redirects and authentication, plus per-email limits for authentication (`RedisService.consumeRateLimit`, `AuthController.ensureAllowed`, `UrlsService.resolve`).
- MongoDB click events and aggregation-backed dashboard/per-link analytics (`UrlsService.recordClick`, `AnalyticsService`).
- Readiness endpoint checking MySQL, Redis, and MongoDB (`HealthController.check`).

## Data responsibilities

- **MySQL:** authoritative user accounts and URL records. Redis is not the permanent URL store.
- **Redis:** serialized `{destination, userId}` cache entries and expiring rate counters.
- **MongoDB:** click-event records used for click totals and analytics breakdowns.

## Deployment status and provider caveat

The repository includes a frontend Vercel configuration (`frontend/vercel.json`), container build files, and local Compose. These establish deployment-compatible configuration, not that any cloud deployment is live.

The checked-in code/configuration uses generic MySQL, Redis, and MongoDB connection variables. It does not identify TiDB Cloud, Upstash, or MongoDB Atlas as the actual remote providers; nor does it contain a Render service manifest. The README describes Vercel and container-host deployment as setup guidance and explicitly says deployment has not been performed. Provider choice and production connection/TLS settings therefore remain unverified.

## Important points for a project presentation

1. MySQL is the source of truth for users and links; Redis only caches redirect mappings and holds expiring counters.
2. Click analytics live in a separate MongoDB collection. Click insertion is asynchronous and best-effort, not a durable queue.
3. A redirect is Redis-rate-limited before cache lookup; Redis availability is therefore required for redirects even when cache fallback exists.
4. The repository builds Docker images and configures a Vercel-compatible frontend, but neither a live cloud deployment nor the named providers (TiDB, Upstash, Atlas, Render) are verifiable from source.
5. CI validates code and images on pushes and pull requests; it does not deploy.
6. Backend container migration behavior differs from the README: the image's `start` command does not invoke migrations.

## Source files inspected

- `frontend/app/{page,login/page,register/page,dashboard/page,urls/page,analytics/[id]/page}.tsx`
- `frontend/components/smarturl.tsx`, `frontend/lib/api.ts`, `frontend/app/layout.tsx`
- `backend/src/main.ts`, `app.module.ts`, `app-setup.ts`, `health.controller.ts`
- `backend/src/auth/*`, `urls/*`, `analytics/*`, `redis/*`, `mongo/*`, `prisma/*`
- `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261115000000_init/migration.sql`
- `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`

