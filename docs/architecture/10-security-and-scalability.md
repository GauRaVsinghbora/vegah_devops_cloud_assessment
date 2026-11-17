# SmartURL — Security, Reliability, and Scalability

## Implemented safeguards

- **Password storage:** `AuthService.register` generates a 16-byte random salt and derives a 64-byte scrypt hash. Plain passwords are not stored. `login` compares derived hashes with `timingSafeEqual`.
- **Token verification:** `AuthService` signs a custom HS256 JWT-shaped token, enforces the fixed algorithm/type, verifies the HMAC with a timing-safe comparison, and checks a seven-day expiry. The secret must be configured and at least 32 characters.
- **Ownership checks:** URL management scopes reads/updates/deletes to `userId`; per-link analytics checks ownership before querying click events.
- **Validation:** global Nest validation rejects unknown fields; auth and URL creation have class-validator constraints; custom code format and URL status are checked.
- **CORS:** allowed browser origins come from `FRONTEND_URL`, split on commas. The configured headers include content type and authorization.
- **Proxy handling:** Express proxy trust is configured only when `TRUST_PROXY` is set. Its value is parsed as boolean `true` or a numeric hop count; the correct value depends on actual hosting topology.
- **Container user:** both runtime images use non-root users.
- **MySQL TLS controls:** `createMariaDbAdapter` supports certificate/identity options and `sslaccept=strict`; it rejects unknown `sslaccept` modes. Production connection settings cannot be verified here.
- **IP privacy:** only a truncated SHA-256 digest of `request.ip` is used in Redis rate keys; raw IP is not written to click events.

## Risks and implementation limits

These are observations about current behavior, not claims that an exploit has been demonstrated.

1. **Browser token storage:** the frontend stores bearer tokens in `localStorage` (`getToken`, `AuthPage.submit`). JavaScript running in the origin can read them; an XSS issue would therefore expose active tokens. No cookie-based session mechanism or explicit Content-Security-Policy configuration was found.
2. **Token lifecycle:** tokens last seven days. The source has no refresh, revocation, issuer/audience validation, or server-side session registry. Requests verify signature/expiry but do not reload the user record for each request.
3. **Redis availability:** Redis rate-limit operations are mandatory for authentication and redirects. A Redis outage aborts those requests; cache-read/write fallback does not bypass the rate limiter.
4. **Fixed-window implementation:** `INCR` and the initial `EXPIRE` are separate commands. This is not a single atomic operation; a failure between commands can leave a counter without the intended expiry. Email strings are present in auth counter key names.
5. **Cache/database consistency:** URL writes/deletes and cache invalidation are separate. If `DEL` fails after a MySQL status/delete commit, a previously cached active destination may still redirect until cache expiry. No outbox/reconciliation mechanism exists.
6. **Analytics durability and privacy:** Mongo insert is fire-and-forget; a process failure can drop an event. Click documents have no TTL/retention or deletion cascade. Referrer values are retained up to 2048 characters and may contain information in query strings.
7. **Status representation:** `Url.status` is a `String`, not a database enum/check constraint. API service logic restricts updates but direct database writes are not constrained by the Prisma schema.
8. **Database TLS is configuration-dependent:** MySQL TLS is available but depends on URL options. In particular, supplying `sslcert` without `sslaccept=strict` or explicit `ssl=true` sets `rejectUnauthorized` false in the adapter parser. Verify production URLs enforce certificate validation. Mongo/Redis TLS depends on their connection URLs/options and cannot be established from the generic source configuration alone.
9. **External redirects:** destinations are restricted to HTTP/HTTPS, but the product is intentionally an open redirect service for links created by authenticated users. No backend fetch is performed to the destination.
10. **Health coupling:** readiness returns 503 if any of MySQL, Redis, or MongoDB is unavailable. This accurately signals dependency outage but can remove the API from service even where some endpoint capabilities might otherwise remain usable.
11. **Container migration startup:** the backend Dockerfile runs `npm run start`, not `start:container`; migrations are not applied by the image's configured command. Deployment needs an explicit migration step or a changed runtime command, neither of which should be assumed implemented.

## Scaling and bottlenecks

- The API is stateless with respect to user sessions; valid bearer tokens permit multiple API instances, subject to consistent JWT secret/config and shared dependencies.
- Redis rate counters are shared across API instances if all instances use the same Redis service. Cache and counter behavior therefore depends on Redis availability and consistent key settings.
- MySQL connection pool defaults in `createMariaDbAdapter` to 10 per process. Horizontal API replicas multiply total database connections; capacity must be matched to the managed database.
- MongoDB aggregation work scales with each user's URL code set and event volume. Compound indexes support code/user plus descending time, but no retention policy limits event growth.
- `GET /api/urls` is capped at 200 rather than paginated. Dashboard aggregation queries have limits for top/recent groups, but lifetime event counts still scan/filter relevant indexed records.
- There is no queue or separate analytics worker. Redirect response avoids waiting on Mongo insert, but analytics work still consumes API-process Mongo connections/resources.
- Single-instance and free-tier sleep/connection caps are provider-specific. Since the remote providers and hosting plans are not verified, their exact bottlenecks/limits cannot be stated as facts about this deployment.

## Failure behavior summary

| Failure | Observed behavior |
|---|---|
| MySQL unavailable | Startup connection or database-backed calls fail; health reports unavailable / 503 |
| Redis unavailable | Health reports unavailable; rate-limited auth and redirect requests fail; some cache operations alone are caught |
| MongoDB unavailable | Module connection/startup or analytics can fail; redirect click insert errors are logged and redirect continues |
| Cache stale/invalidation failure | Old active mapping can survive until the one-hour cache TTL |
| API process exits during click insert | In-flight event may not be recorded |

## Cannot be verified from source

- Actual Vercel/Render deployment state, deployment URLs, and environment-variable values.
- Whether MySQL is TiDB Cloud, Redis is Upstash, or MongoDB is Atlas.
- Production TLS settings, firewall/network policy, backup/restore drills, monitoring/alerts, and actual service plans.
- GitHub branch protection/rulesets, repository secrets, and whether CI checks are required for merges.
- Real-world load, latency, throughput, analytics accuracy under concurrency, and operational incident behavior.

