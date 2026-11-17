# SmartURL — MongoDB Click Analytics

## Collection and event shape

`MongoService` uses the `click_events` collection. `ClickEvent` is a TypeScript type, not a MongoDB server-side schema validator. The inserted fields are:

| Field | Meaning |
|---|---|
| `short_code` | Visited short code |
| `user_id` | Owner ID from the resolved MySQL URL/cache mapping |
| `browser` | Coarse user-agent classification |
| `operating_system` | Coarse user-agent classification |
| `device_type` | `Tablet`, `Mobile`, or `Desktop` classification |
| `referrer` | Referrer header, truncated to 2048 characters, or `null` |
| `clicked_at` | API server timestamp |

The source does not store raw IP addresses or country. It does store the referrer value, which can include query-string information supplied by the referring site. MongoDB receives no retention/TTL policy in the inspected code; events are not removed when a URL is deleted.

## Event generation and parsing

After `UrlsService.resolve` obtains an active destination, it calls `void this.recordClick(...)` and returns the destination to the controller, which sends HTTP 302. Event insertion is fire-and-forget within the same API process; it is not awaited before the redirect and is not placed on a durable queue. `recordClick` catches Mongo insert errors and logs them, so analytics failure does not block a successful redirect. A process termination can lose an in-flight event.

The `User-Agent` value is classified with ordered regular expressions:

- Browser: Edge (`Edg/`), Firefox, Chrome, Safari, else `Other`.
- OS: Windows, macOS (`Mac OS`), Android, iOS/iPhone/iPad, Linux, else `Other`.
- Device: tablet/iPad, mobile/iPhone/Android, else `Desktop`.

These are heuristic labels, not a full UA parser. Referrer comes from the `referer` request header.

## Indexes

During `MongoService.onModuleInit`, the service creates:

- `{ short_code: 1, clicked_at: -1 }`
- `{ user_id: 1, clicked_at: -1 }`

No TTL index is created.

## Aggregation and frontend retrieval

`AnalyticsController` protects both routes with `AuthGuard`.

- `GET /api/analytics`: `AnalyticsService.dashboard(userId)` loads the user's codes from MySQL, then queries Mongo for lifetime click count, top five codes, last-seven-days activity, browser/device/referrer breakdowns (up to ten buckets), and ten recent events. It also reads total/active URL counts from MySQL.
- `GET /api/analytics/:urlId`: checks that the URL belongs to the authenticated user in MySQL, then returns lifetime click count, daily activity over the last 90 days (up to 90 grouped days), breakdowns, and up to 30 recent events.
- `GET /api/urls`: joins recent URL records with per-code click counts aggregated from Mongo for up to 200 rows.

The browser calls these endpoints through `frontend/lib/api.ts`; dashboard and detail views are rendered by `Dashboard` and `AnalyticsDetails` in `frontend/components/smarturl.tsx`. Dashboard data loads on mount and after relevant URL actions; the source does not implement periodic analytics polling.

## Example event path

```text
GET /api/r/abc123
  -> rate-limit request in Redis
  -> resolve short code from Redis or MySQL
  -> start Mongo insert (short_code, user_id, UA-derived fields, referrer, clicked_at)
  -> return 302 to destination without waiting for insert
  -> later GET /api/analytics or /api/analytics/<urlId> aggregates stored events
```

