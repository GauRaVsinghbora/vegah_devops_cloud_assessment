# SmartURL — GitHub and CI/CD

## Repository and branches

The current checkout is `GauRaVsinghbora/vegah_devops_cloud_assessment`, on `feature/production-container-startup`. GitHub branch listing at audit time showed:

- `main`
- `develop`
- `feature/mongodb-analytics`
- `feature/nestjs-11-upgrade`
- `feature/node24-runtime`
- `feature/production-container-startup`
- `feature/security-patches`

Branch presence does not itself establish a release process or branch protection policy. The listed branches were reported as unprotected by the GitHub branches endpoint at audit time.

## GitHub Actions workflow

There is one active workflow, `SmartURL CI`, in `.github/workflows/ci.yml`. Triggers are every `push` and `pull_request`. It requests only `contents: read`.

### Backend job

Runs on Ubuntu and starts MySQL 8.4, Redis 7, and MongoDB 7 as service containers with health checks. It uses Node.js 24 and:

1. checks out the repo;
2. runs `npm ci` in `backend`;
3. generates Prisma client and applies migrations;
4. runs lint, type-check, unit tests, and integration tests;
5. builds the backend;
6. builds the backend Docker image.

### Frontend job

Runs on Ubuntu using Node.js 24 and:

1. checks out the repo;
2. runs `npm ci` in `frontend`;
3. runs lint and type-check;
4. builds Next.js with a CI-local `NEXT_PUBLIC_API_URL`;
5. builds the frontend Docker image.

## CI is not deployment

The workflow contains no Vercel, Render, Docker registry push, cloud credentials, or deployment action. It validates builds and image creation only. GitHub Actions history showed successful recent push/pull-request runs, including the latest inspected `develop` run (workflow run 21); this is a point-in-time observation, not a guarantee of future CI status.

## Items not inferred

The repository does not establish a required pull-request approval count, mandatory status checks, protected release branch policy, tag/release process, or automated rollback strategy. These require GitHub repository settings or release artifacts not present in the workflow source.

