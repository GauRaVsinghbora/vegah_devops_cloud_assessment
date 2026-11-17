# SmartURL — Redis Architecture

## Client configuration

`RedisModule` creates one ioredis client, preferring `REDIS_URL` and otherwise using `REDIS_HOST`, `REDIS_PORT`, and optional `REDIS_PASSWORD`. The default client has `maxRetriesPerRequest: 2` and connects eagerly. Compose runs Redis with append-only persistence and a named volume for local development; the application still treats URL mappings as cache, not as the authoritative URL store.

## Stored values and key patterns

| Purpose | Exact key | Value |
|---|---|---|
| Redirect cache | `short-url:<shortCode>` | JSON object `{ "destination": "<original URL>", "userId": "<owner ID>" }` |
| Register per-email counter | `auth-register:<lowercased-email-input>` | Redis integer |
| Login per-email counter | `auth-login:<lowercased-email-input>` | Redis integer |
| Authentication per-IP counter | `auth-ip:<first 24 hex chars of SHA-256(request.ip)>` | Redis integer |
| Redirect per-IP counter | `redirect:<first 24 hex chars of SHA-256(request.ip)>` | Redis integer |

The IP digest is a truncated hash, not the raw address. The controller lowercases the submitted email for the Redis key; `AuthService` trims and lowercases it before database operations. Email identifiers are embedded in authentication Redis keys. No source path writes permanent URL records to Redis.

## Cache lifecycle

`UrlsService.resolve` rate-limits first, then reads `short-url:<code>`. A valid hit bypasses MySQL. A miss queries `Url` by unique short code and requires `status === 'ACTIVE'`; it then writes the mapping with `SET ... EX 3600` (one hour). Invalid JSON/shape entries are deleted and reloaded from MySQL. Cache read/write errors are logged and handled as cache misses/ignored writes.

`UrlsService.setStatus` and `remove` delete the key after the MySQL update/delete. There is no transaction spanning MySQL and Redis. If invalidation fails after a database mutation, the operation can report an error despite the database change having committed; an old cached mapping can remain usable until its TTL expires. A cached hit does not re-check MySQL status. Cache invalidation reliability is therefore material to disabled/deleted redirect behavior.

## Rate limiting

`RedisService.consumeRateLimit(key, limit, windowSeconds)` performs:

1. `INCR key`
2. If the returned count is `1`, `EXPIRE key windowSeconds`
3. Allow iff `count <= limit`

The current callers configure these fixed windows:

| Request class | Identifier | Limit |
|---|---|---|
| Registration | email key and IP-hash key | 10 per email per 60 seconds; 60 per IP per 60 seconds |
| Login | email key and IP-hash key | 10 per email per 60 seconds; 60 per IP per 60 seconds |
| Redirect | IP-hash key | 120 per IP per 60 seconds |

Authentication checks both counters in parallel. Redirect limits are checked before cache lookup. Exceeding any applicable limit returns HTTP 429 (`Too many authentication attempts...` or `Redirect rate limit exceeded`).

This is a fixed-window counter, not a sliding-window or token-bucket implementation. `INCR` and first-count `EXPIRE` are separate commands rather than one atomic Lua script/transaction. There is no special Redis-outage fallback for rate-limit operations: a Redis error rejects the request before authentication or redirect resolution. Cache get/set has a limited fallback, but that does not make redirects available when the preceding rate-limit operation cannot reach Redis.

