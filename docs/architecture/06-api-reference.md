# SmartURL — API Reference

All API routes have the `/api` global prefix. Request validation is applied globally through Nest `ValidationPipe` with `whitelist`, `transform`, and `forbidNonWhitelisted` enabled. Protected requests use `Authorization: Bearer <token>`.

| Method | Route | Purpose | Authentication |
|---|---|---|---|
| `GET` | `/api/health` | Checks MySQL, Redis, and MongoDB readiness; returns 503 when any is unavailable | None |
| `POST` | `/api/auth/register` | Register email/password; returns user and signed token | None; Redis-limited |
| `POST` | `/api/auth/login` | Verify credentials; returns user and signed token | None; Redis-limited |
| `POST` | `/api/urls` | Create random/custom short URL | Bearer JWT |
| `GET` | `/api/urls?search=...` | List/search current user's newest 200 URLs with click counts | Bearer JWT |
| `PATCH` | `/api/urls/:id` | Change status to `ACTIVE` or `DISABLED` | Bearer JWT |
| `DELETE` | `/api/urls/:id` | Permanently delete a URL record | Bearer JWT |
| `GET` | `/api/r/:code` | Apply redirect limit, resolve active URL, record click asynchronously, return 302 | None; Redis-limited |
| `GET` | `/api/analytics` | Current-user dashboard analytics | Bearer JWT |
| `GET` | `/api/analytics/:urlId` | Analytics for one owned URL | Bearer JWT |

## Input constraints from source

- Authentication DTO: valid email, maximum 254 characters; password is a string from 8 to 128 characters.
- URL creation DTO: HTTP/HTTPS URL with protocol and maximum 2048 characters. Optional custom code must match `^[a-zA-Z0-9_-]{3,16}$`.
- Status is accepted only when the service receives exactly `ACTIVE` or `DISABLED`.
- URL search is an optional query string; `UrlsService.list` trims it and limits results to 200. No explicit search length cap is implemented.

The exact DTOs and service behavior are in `backend/src/auth/auth.controller.ts`, `backend/src/urls/urls.controller.ts`, and `backend/src/urls/urls.service.ts`.

## Common behavior

- Invalid/expired/missing Bearer token: HTTP 401.
- Duplicate registration email or custom code: HTTP 409.
- Unknown/disabled short code or URL not owned by caller: HTTP 404.
- Invalid status: HTTP 400.
- Rate limit exceeded: HTTP 429.
- Readiness dependency failure: HTTP 503 with per-service state.
- Other uncaught persistence or service errors follow Nest's standard exception handling.

