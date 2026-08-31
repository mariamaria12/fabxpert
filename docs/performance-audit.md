# Performance audit — round trips, not queries

**Date:** 2026-08-26
**Shape:** browser → Vercel (`/api` rewrite) → Railway (NestJS) → Supabase Postgres (`aws-0-eu-west-1`, session pooler)

## What was measured

| Measurement | Result |
|-------------|--------|
| `SELECT 1` from a dev machine to the dev database | **~85ms** |
| Rows in the dev database | 335 timesheets, 112 projects, 61 persons |
| `GET /health` on the deployed API (no database work) | TCP connect **25ms**, TTFB **270–345ms** |
| Most-called application query | `SELECT id, role, isActive FROM users WHERE id = $1` — 14,641 calls |

The dataset is tiny and every individual query is sub-millisecond in Postgres. Nothing was slow
because of data volume: pages were slow because a single screen fired several API calls, and each
call ran several **sequential** database round trips before answering.

Query counts per request, before → after:

| Endpoint | Queries before | Queries after | Local p50 before | Local p50 after |
|----------|----------------|---------------|------------------|-----------------|
| `GET /auth/me` | 4 | 1 | 415ms | ~80ms |
| `GET /timesheets/grouped?period=month` | 8 | 3 | 901ms | 81ms |
| `GET /projects?statusGroup=in_progress` | 6 | 2 | 379ms | 82ms |
| Sidebar leave badge | 4 | 1 | 461ms | ~80ms |
| `GET /timesheets/dashboard-metrics` | 6 | 5 (parallel) | 235ms | 79ms |

Local timings come from `pnpm --filter @fabxpert/api test:perf` against the dev database, where one
round trip costs ~80ms — so "one round trip" is the floor a request can reach.

## What was changed

1. **The JWT guard no longer queries the database on every request** (`auth-user-cache.service.ts`).
   The `id + role` lookup is cached for 30 seconds and invalidated whenever a user is updated or
   deleted. A user disabled straight in the database keeps access for at most that window.
2. **Relations load in one statement** (`relationJoins` preview + `relationLoadStrategy: 'join'`).
   Prisma loads each `include` with its own query by default; on the list endpoints, the timesheet
   read/write paths, `/auth/me` and the user list, they now come back as one joined statement.
3. **The sidebar badge counts instead of listing** — `GET /leave-requests/pending-count`.
4. **No `Cache-Control` request header on API calls.** It is not CORS-safelisted, so it forced a
   preflight on every cross-origin GET. `cache: 'no-store'` on the fetch already does the job, and
   the API sends the response header itself. CORS preflights are now cached for a day (`maxAge`).
5. **The web shell renders from the last known session** (`sessionUserCache.ts`) while `/auth/me`
   revalidates behind it, instead of blocking the page — and its requests — on that round trip.
6. **`loadAllPages` fetches pages 2..N together** instead of one after another.
7. **Editing a day sends its timesheet updates in parallel** rather than one at a time.

## Verifying

`pnpm --filter @fabxpert/api test:perf` (needs the API running and the perf seed) reports the table
above. The e2e suite passes, but only when run a few specs at a time: every spec boots its own Nest
app, and against the 15-slot Supabase session pooler a full sequential run exhausts it and fails
with `EMAXCONNSESSION` — unrelated to the code under test. Test apps now take one connection each,
which helps but does not fully remove the ceiling. Two specs fail for reasons that predate this work
(`project-list-filter` counts one in-progress fixture where there are now two; `authorization`
expects `ProjectOptionDto` to have five keys, and it has had eight since `notes`/`finisaj` were
added).

## Still open — this one is infrastructure

`GET /health` does no work at all, yet answers in ~270ms while the TCP handshake to the Railway edge
takes 25ms. That gap is the edge → container hop, and it points at the API container running far
from both its users and its database. Every database round trip pays it too.

Check the API service region in Railway (Settings → Regions). With the database in
`aws-0-eu-west-1`, the API belongs in an EU region. The API now logs, at startup:

```
[PrismaModule] Database round trip: 85ms (api region: europe-west4)
```

Single digits mean the database is next door. ~100ms means every query on every endpoint is paying
for the distance, and no amount of query tuning gets that back.
