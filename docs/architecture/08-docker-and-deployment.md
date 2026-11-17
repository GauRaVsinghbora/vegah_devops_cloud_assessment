# SmartURL — Docker and Deployment

## Backend image

`backend/Dockerfile` uses Node 24 Debian slim stages:

1. **base:** installs OpenSSL and CA certificates.
2. **dependencies:** installs npm packages with Prisma schema/config available.
3. **build:** generates Prisma client and runs Nest build.
4. **production-dependencies:** installs production dependencies and generates Prisma client.
5. **runtime:** copies production dependencies, build output, schema/config, and migration files; runs as the non-root `node` user.

The image exposes port `4000`. `backend/src/main.ts` listens on `0.0.0.0`, preferring `PORT` over `API_PORT`.

**Migration command discrepancy:** `backend/package.json` defines `start:container` as `prisma migrate deploy && node dist/src/main.js`, but the Dockerfile ends with `CMD ["npm", "run", "start"]`. `start` only runs the compiled app. Therefore, the image's configured command does not automatically apply migrations, despite that behavior being described in the README.

## Frontend image

`frontend/Dockerfile` is multi-stage and uses Node 24 Alpine. It runs `npm ci`, builds Next.js with `NEXT_PUBLIC_API_URL` passed as a build argument, and copies `.next/standalone` plus static assets into a runtime image. The final image runs as a dedicated non-root `nextjs` user, exposes `3000`, and executes `node server.js`. `frontend/next.config.ts` enables standalone output.

## Docker Compose local topology

`docker-compose.yml` defines:

| Service | Container port | Host binding | Persistence / health |
|---|---:|---|---|
| `mysql` | 3306 | Loopback host port configurable, default 13306 | `mysql_data`; `mysqladmin ping` |
| `redis` | 6379 | Loopback host port configurable, default 16379 | `redis_data`; `redis-cli ping`; append-only enabled |
| `mongodb` | 27017 | Loopback host port configurable, default 27018 | `mongo_data`; `mongosh` ping |
| `backend` | 4000 | host 4000 | Waits for DB/cache services; `/api/health` container health check |
| `frontend` | 3000 | host 3000 | Waits for backend health; HTTP health check |

All services attach to the private Compose bridge network. MySQL, Redis, and MongoDB are exposed to the host only through loopback bindings. Their Compose configurations are for local development and do not by themselves establish production service security.

## Environment variable names

The inspected `.env.example`, Compose, app, and deployment configs reference:

`MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `MYSQL_HOST_PORT`, `REDIS_HOST_PORT`, `MONGODB_HOST_PORT`, `DATABASE_URL`, `REDIS_URL`, `MONGODB_URI`, `JWT_SECRET`, `TRUST_PROXY`, `API_PORT`, `FRONTEND_URL`, `PUBLIC_API_URL`, `NEXT_PUBLIC_API_URL`, `PORT`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.

Only variable names are documented here. Values from local environment files are intentionally excluded.

## Vercel / Render / managed providers

- `frontend/vercel.json` identifies the Next.js framework and build/install commands; `NEXT_PUBLIC_API_URL` is compiled into the browser bundle. This is deploy compatibility, not proof of an existing Vercel deployment.
- The backend has a container image suitable for a long-running container platform. No Render-specific manifest or live Render configuration is checked in.
- Source uses generic MySQL, Redis, and MongoDB endpoints. Provider selection (TiDB Cloud, Upstash, MongoDB Atlas or otherwise), live TLS, credentials, network allowlists, and production health configuration cannot be verified from this repository.

## Local versus production

Compose gives local containers a private service network and named volumes. Cloud hosting typically separates the frontend and API and uses managed external data services; that topology is recommended in repository guidance but not configured here. The CI workflow builds images only; it does not deploy them.

